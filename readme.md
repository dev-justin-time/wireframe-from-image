# Blueprint to 3D Wireframe Converter

Turns a black-and-white blueprint PNG — or a vector PDF — into an extruded 3D wireframe and exports it
as OBJ or glTF. A raster is read from its ink; a PDF is read from its own paths, and — for the
symbols drawn in its openings — from a rendering of the page.

## Usage

```bash
# Inspect one image: prints the segments, the rooms and the takeoff,
# and writes outputs/<uuid>.obj
cargo run -- fixtures/floor_plan.png --mm-per-px 10

# Also write the plan JSON the feature suites in ports/ read
cargo run -- fixtures/floor_plan.png --mm-per-px 10 --write-plan outputs/plan.json

# Machine-readable plan on stdout (walls and room polygons)
cargo run -- fixtures/floor_plan.png --json

# A PDF goes through PDFium: paths -> segments -> the same plan and mesh
cargo run -- "Southern Farmhouse - Drawing Set - Jay Osborne 2023-02-01.pdf" --mm-per-pt 35.28 --gltf outputs/plan.gltf

# Only the glTF, alongside the OBJ every run writes
cargo run -- fixtures/floor_plan.png --gltf outputs/plan.gltf

# No argument starts the web server on http://127.0.0.1:3000
cargo run

# Regenerate the comparison fixtures, run the tests
cargo run --example make_fixtures
cargo test
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--mm-per-px <n>` | `10` | Drawing scale: millimetres of building per image pixel. Every number depends on this. |
| `--wall-height <m>` | `2.7` | Storey height used for wall areas and room volume. |
| `--stud-spacing <mm>` | `406` | Stud centres for the framing count. |
| `--write-plan <path>` | — | Write the plan JSON (`units`, `wallHeight`, `studSpacingMm`, `walls`, `rooms`, `openings`) used by `ports/`. |
| `--json` | — | Print that plan JSON to stdout. |
| `--mm-per-pt <n>` | `35.28` | PDF only: millimetres of building per PDF point. 35.28 is a 1:100 plan at 72 dpi. |
| `--page <n>` | `0` | PDF only: zero-based page to read. |
| `--gltf <path>` | beside the OBJ | Write a glTF 2.0 LINES model instead of `outputs/<uuid>.gltf`. |

Upload endpoint: `POST /upload` with a multipart body containing one image field,
which returns the path of the generated OBJ under `/outputs/`.

```bash
curl -F "file=@fixtures/floor_plan.png" http://127.0.0.1:3000/upload
```

The server reads `HOST` (127.0.0.1), `PORT` (3000), `MAX_UPLOAD_MB` (48) and
`EXTRACTION_CONCURRENCY` (one slot per core, at least two). Decoding, detection
and export run on the blocking pool behind those slots with a two-minute
deadline, so a large scan cannot stall the async runtime; requests are logged
with method, path, status and latency; SIGTERM and Ctrl-C drain in-flight work
instead of killing it.

## PDF vector extraction

A PDF is not a picture of a plan: every wall in it is a path object with real
co-ordinates. `src/pdf.rs` binds PDFium, walks the page objects, keeps the path
objects, converts their segments into the same `Line` struct the raster detector
returns (in PDF points, y flipped to grow down the page), and from there the plan
builder, the takeoff and both exporters run unchanged.

**Coordinates are reconciled with the page.** PDFium reports a path's points in
the space the page was written in — usually a form XObject at its own scale, and
mirrored in y because PDF counts up the page — while object bounds and text boxes
are already resolved. The two are matched through the objects' own centres, which
the stroke width that inflates their bounds does not move, so an 800 px drawing
printed on a 600 pt page lands at 600 pt instead of being read 1.33× too large.

```text
PDF -> PDFium -> path objects -> segments -> Line[] -> walls, rooms, takeoff
                                                   -> extrude -> OBJ / glTF
```

**The scale is read off the sheet.** Without `--mm-per-pt`, the page's dimension
strings are read and each is matched to the line it measures — nearest, parallel
and within 60 pt — so "3600" written along a 102 pt line gives 35.3 mm/pt. Two
strings have to agree within 15%, which outvotes a room label or a part number
that happens to read as a length; with no agreement the 1:100 default stands.
`/api/plan` takes `mmPerPt=auto` for the same behaviour and reports the answer as
`scaleSource` (`dimension`, `given` or `default`).

Scale: one PDF point is 1/72", so `--mm-per-pt` is the drawing ratio times
0.3528 — `35.28` for 1:100, `17.64` for 1:50. The port's default is 35.28.

**PDFium is not vendored.** Put `pdfium.dll` / `libpdfium.so` on the path, or
set `PDFIUM_DYNAMIC_LIB_PATH` to the library or the directory holding it. Without
it the PDF path reports that and exits; the image path never loads it.

**Opening symbols come from a rendering.** A path object does not say how wide its
stroke is, so the glazing across a window and the arc of a door swing are not in
the vectors at all. The page is rendered at about 2000 px across (never scaled
more than 6×) and the same ink reader the raster path uses classifies the
openings from it; a render that fails is skipped without an error and the
openings fall back to topology. The render is a second pass over the page, so a
PDF upload costs one extra page rasterisation.

**Curves are counted, not built.** PDFium's path API exposes a segment's end point
only, not a cubic's control points, so a bezier can only be approximated by its
chord — and a chord is not a wall. The curves on a plan are symbols: a door swing,
a circle, a scale bar. They are counted (printed as `curves`, so you can see when
a page depends on them) and left out; a genuinely curved wall is the one thing
that loses by it.

The studio accepts a PDF upload to the same endpoint and takes its scale from
`mmPerPt`, which is `auto` by default: the drawing's dimension strings decide it.

## Studio

`cargo run` serves the studio at <http://127.0.0.1:3000>; `PORT=8080 cargo run` moves
it. `static/index.html` is the shell, `static/app.js` holds the screens — plain ES
modules, no build step, no installed dependencies. The 3D scene is
`static/scene3d.js`, a port of floorplan_3d's `SharedViewer` running on the
vendored three.js build in `static/vendor/three/`; the 2D scene draws the same
plan as a drawing sheet or a dark viewport.

One endpoint feeds all of it: `POST /api/plan` takes the same image plus optional
`mmPerPx`, `mmPerPt`, `wallHeight` and `studSpacing` fields and returns the detected walls and
rooms, the takeoff, the plan JSON and the URLs of the OBJ and glTF to draw.

```bash
curl -F "file=@fixtures/floor_plan.png" -F "mmPerPx=10" http://127.0.0.1:3000/api/plan
```

Failures come back as statuses rather than as 200 with a complaint: 415 for
something that is not a readable image, 422 for a missing file or a number that
will not parse, 413 for an upload over `MAX_UPLOAD_MB`, 503 when PDFium is not
installed and 400 for a PDF that cannot be parsed. `GET /healthz` reports the
version, whether PDFium loaded, the upload cap and the free extraction slots.

| Group | Screens |
| --- | --- |
| Design | Plan studio (upload + wireframe), Editor (walls and rooms), App, Wall designer, Kitchen designer, Toolbox, Demo, WebGPU demo |
| Structure | Framing, Deck, Roof, Stair, L stair, U stair, Spiral stair, Steep stair, Stair gallery/parts/glossary, Foundation |
| Systems | Electrical, Lighting, Plumbing |
| Site | Landscape, Site plan |
| Project | Dashboard, Schedule, Permits and inspections, Bid builder, Report, Price book, Pricing, Calculator, Code rules |
| About | Home, Features, Gallery, About, Contact |

`2D scene` and `3D scene` sit under Design: the first draws the extracted plan as
a drawing sheet (grid, poche, dimensions, room labels, and the door swings and
window glazing the extractor classified), the second orbits the extruded plan
with shadows, one floor plate per room and a cutaway that hides the walls between
the camera and the interior. The 3D walls are built around the openings — solid
either side, a lintel over the head, the apron under a window, glass or a door
leaf in the hole — so a window is a window from every angle, not a notch. A side
elevation swaps the orbit camera for an orthographic one and hides the walls
nearest it, so a wall of openings reads flat like a drawing.

`Editor` is the same plan drawn by hand: drag a wall and its ends snap to an
existing corner, then to a 100 mm grid; a wall ending on another splits it, and
the ported wall graph closes the rooms and measures them as you go. Corner
handles move a corner instead: every wall end meeting there follows it, so a
room stays closed, and a wall that collapses is dropped. The plan itsaves is the one every other screen reads. Every wall and item edit is undoable — Ctrl+Z, and Ctrl+Shift+Z or Ctrl+Y to redo — while Delete removes the selected wall and Escape clears the selection. `Plan studio` also takes vector and
survey files: a DXF through the ported parser (LINE, LWPOLYLINE, ARC and CIRCLE
become walls), and a KML, KMZ or GeoJSON through the ported geo reader (polygon
rings and lines become walls, projected to metres at the survey's real size with
north up). Neither is fitted to the viewport — they are measurements, not
pictures. `Editor` also places floor items from the vendored catalogue: a sofa, a table,
the kitchen and bathroom pieces. The plan stores them in metres, the 3D scene
builds a box for each, and an elevation drags one along its run and up and down,
snapping to the pieces of the same run through the ported snap helpers. The plan
is the source of truth, so a drag saves and rebuilds; the editor lists what is
placed with its footprint and lift.

The `Report` screen puts the same plan on one sheet: the summary and extents, the takeoff quantities, the rooms and the contract the bid engine prices. `Download PDF` writes that sheet as an A4 file in the browser — `static/pdf.js` is a small writer for text, rules and boxes, so there is no jsPDF, no build step and no print dialog — and `static/report-data.js` is the model both the sheet and the file read, so the numbers cannot drift apart. The page's print stylesheet still applies if the page itself is printed. The same print rules serve every other screen: a bid line or a code rule is one record, so a table paginates between rows rather than through one, and a heading never leaves its table overleaf.

`2D scene` carries the services sheets on a second
canvas — framing, the plumbing water/DWV/gas routes and the panel's circuits —
because those drawings fit their own 0..W × 0..D view rather than the sheet's.

The designers compute from the plan the server returned — wall length, floor area,
height and stud spacing are prefilled from it — plus their own inputs. They are
planning checks, but not this repo's own approximations: each system screen runs
floorplan_3d's own calculation engines, vendored verbatim under `static/engines/`.

## Engines from floorplan_3d

The system screens are not approximations any more. `static/engines/` vendors
floorplan_3d's calculation engines with their imports untouched, so the layout
matches `E:\floorplan_3d\features\`:

| Engine | Computes |
| --- | --- |
| `framing/engine.js` | Every wall member by member — kings, jacks, a header sized from its span, cripples, plates, sheathing, subfloor — with a cut list and price (30 checks) |
| `deck/engine.js` | Joist, beam, post and footing sizing by NDS bending and deflection, guard, stairs, decking and the bill (35 checks) |
| `roof/design.js` | Roof geometry, every layer takeoff, ventilation and the gutter package |
| `electrical/engine.js` | NEC 220 demand, service and feeder, the circuit list and the panel bill |
| `plumbing/engine.js` | A laid-out plan's fixture units, Hunter demand, DWV, gas and the rough-in takeoff |
| `lighting/photometry.js` | Room index, utilization, spacing and the lumen method |
| `wall/materials.js` | 22 interior coverings, substrates, sheens, coverage and labour |
| `kitchen/engine.js` | A cabinet run: clearance rules, fillers, gaps and a layout score |
| `stairs/design.js`, `designer.js`, `models.js` | Straight, winder, spiral and catalogue-model stairs with their IRC checks |
| `landscape/engine.js` | Water features: geometry, gallons, turnover, pump and filter sizing, barrier, bill |
| `bid/engine.js` | One contract price over the engines' itemised takeoff rows: overhead, profit, contingency, tax, billing |
| `pricing/catalog.js` | Every quotable material line the engines price, with supplier quotes |
| `bim/takeoff.js` | Walls as IFC classes with net area and volume |
| `*/rules.js` | 135 code rules with the clause each one cites |
| `core/floorplan-graph.js`, `core/measurements.js` | The wall graph, its room faces, wall measurements and areas — the editor's geometry |
| `features/import/dxf.js` | DXF lines, polylines, arcs and circles as plan segments in metres, with the units from the header |
| `features/import/geo.js` | KML, KMZ and GeoJSON to lon/lat features, projected to local metres without distorting the survey |
| `features/layers/mep-layers.js` | The framing, plumbing and electrical layer drawings, and the three stacked |
| `scene/scene-abilities.js`, `scene/scene-camera.js` | The ability flags applied to a live 3D scene, and the shared camera framing |
| `scene/scene-elevation.js`, `scene/scene-gizmo.js` | Orthographic side views with the near walls cut, and the elevation drag/snap helpers |
| `core/elevation-snap.js`, `features/advanced/snapping.js`, `features/transforms.js` | Run and vertical snapping, lock constraints and the elevation constants |

Six small adapters do the mapping: `static/engines-bridge.js` for framing, deck,
roof, electrical, plumbing, lighting, wall finishes and the rule libraries;
`static/engines-extra.js` for the kitchen run, water features, the cross-suite
bid, the BIM schedule, the price book and the dashboard roll-up; and
`static/stairs-bridge.js` for the stair engines, which import `three` and so load
through the browser's import map rather than in Node; `static/plan-edit.js` for
the graph and measurements behind the editor; `static/plan-import.js` for the DXF and
KML/GeoJSON imports; and `static/plan-layers.js` for the services layer
drawings. Each turns
the extracted
plan (metres) into an engine config — framing walls go into a storey, plumbing
type ids into `createPlan` — and the design back into the `{cards, rows}` a screen
renders. Unset inputs are dropped before the engine sees them, because an
explicit `undefined` would overwrite a default. The `Code rules` screen lists and
searches all five libraries.

The copied files are unmodified; compare with `cmp` against
`E:\floorplan_3d\features\` after a re-copy (the command is in
`static/engines/README.md`). Every designer screen now runs on a vendored engine;
what is still this repo's own is the foundation screen (floorplan3d has no
foundation suite to read). The editor here is one working slice — draw, move,
split, place, measure, save — not a port of `editor/editor.js`: the toolbox, item library,
OCR, WebGPU, collaboration and elevation scenes were not brought over. Their
engines are here where they are pure, their DOM shells are not. Both importers
that ship with the engines are wired — DXF, and KML/KMZ/GeoJSON. Elevation is
wired: the 3D screen's four side views run
`scene-elevation.js` on an orthographic camera, with the near walls hidden by
its visibility helper. Its drag handles (`scene-gizmo.js`, and the snapping and
lock modules behind them) load too, but a detected plan has no items for them to
drag yet.

## UI check

`tools/ui-check.mjs` drives the studio in headless Chrome over the DevTools
protocol, with nothing to install: Node 24 has a global `WebSocket`. It visits
each screen, records console errors and exceptions, flags a blank canvas,
an unmounted viewer, horizontal overflow or `undefined`/`NaN`/`[object Object]`
in the rendered text, uploads `fixtures/floor_plan.png` through the Plan studio
form, follows that plan into every screen, and reloads a deep link to prove the
plan survives. Screenshots and `report.json` land in `outputs/ui`.

With `scene-3d` in the route list it also sweeps the four elevation sides: it
sets each side, records which side the viewer reports, saves one screenshot
clipped to the viewport per side and compares the images and the near-wall cut.
`ELEVATIONS=0` skips that sweep.

`outputs/probe-screens.mjs` drives the four slices that have interaction: it
seeds a known plan, drags a wall and a corner on the editor canvas, imports a DXF
and a KML through their Plan studio buttons, ticks the services sheet and checks the layer drawings
painted, then toggles wireframe, hide-walls and grid on the 3D scene and reads
the meshes back. `outputs/probe-plan-edit.mjs` covers the graph, the DXF parser
and the layer model in Node.

```bash
cargo run                                    # the studio, on :3000

# in another shell: headless Chrome with a debugging port
chrome --headless=new --remote-debugging-port=9223 \
       --user-data-dir=.cdp --enable-unsafe-swiftshader about:blank

node tools/ui-check.mjs
echo $?                                      # 0 when every screen passed

# a focused run: fewer screens, no screenshots
ROUTES='["plan-studio","scene-3d"]' SHOTS=0 node tools/ui-check.mjs
```

`BASE`, `CDP_PORT`, `ROUTES` (a JSON array), `OUT`, `FIXTURE` and `SHOTS=0` are
read from the environment. The script exits non-zero if any screen is flagged, so
it can gate a change; the screenshots are only for a human to look at.

WebGL needs `--enable-unsafe-swiftshader` on a machine without a GPU, and the
page is reloaded with the cache ignored, because a heuristically cached `app.js`
would otherwise test the previous build.

## Pipeline

```text
PNG -> grayscale -> Otsu threshold -> Hough accumulate -> peak suppression
    -> ink-run extent per peak -> axis snapping -> collinear merge
    -> duplicate removal -> scale -> wall graph -> rooms -> takeoff
    -> extrude -> OBJ / plan JSON
```

`src/detect.rs` holds the detection; `src/main.rs` holds the CLI, the Axum server
and the OBJ writer.

### What each stage does

- **Otsu threshold** picks the ink/paper split from the image histogram, so blueprints
  that are not pure black on pure white still work.
- **Hough transform** accumulates votes over 180 angles, so vertical and diagonal
  walls are found, not just horizontal ones.
- **Ink-run extent** walks the actual pixels along each candidate line, so a segment
  covers the wall rather than the whole image diagonal. One line can carry several
  walls — the pieces either side of a doorway vote into the same Hough bin — so
  every run becomes a segment, not just the longest one, and a broken wall keeps
  both of its pieces.
- **Axis snapping** pulls walls that are within a few degrees of horizontal,
  vertical or 45 degrees onto that axis and re-reads their extent from the ink.
  Blueprints are drawn on axes, so this removes the half-degree skew that Hough
  introduces. A snap is only kept when the ink still lies along it.
- **Collinear merge** joins segments that lie on the same line and overlap or nearly
  touch; **duplicate removal** drops fragments already covered by a longer wall.
  A wall split by a doorway is kept as two walls.

## Plan extraction

`src/plan.rs` turns the detected segments into a plan with real dimensions and
then into the quantities the feature suites report:

- **Scale.** Every coordinate is millimetres of building per pixel
  (`--mm-per-px`). The detector has no idea how large the drawing is, so this is
  the one number the tool cannot guess.
- **Wall graph.** Endpoints are snapped onto a grid (`snap_m`, 30 mm) and walls
  that meet share a node, which is what makes a set of segments into a closed
  plan.
- **Rooms.** Half-edge traversal walks each enclosed face once; the single
  largest face is the outside of the plan and is dropped. A doorway leaves the
  two sides connected, so they come back as one open-plan face rather than two
  rooms and a hole. Each room gets a shoelace area, a perimeter and a centroid.
- **Openings.** Two collinear wall ends 0.5-4.0 m apart bound a gap. The gap is
  then classified twice: by topology, where a room on both sides is a door and a
  room on one side is an opening in the envelope; and by the symbols drawn inside
  it, where a swing arc is a door and glazing lines across the opening are a
  window. The symbols win when the raster shows them, and the topology is the
  answer when it does not. Doors run from the floor to a 2.1 m head, windows from
  a 0.9 m sill to the same head, so the header over a door and the apron under a
  window stay in the takeoff. Rooms are read with the gaps closed, so a broken
  outer wall does not merge the interior with the outside.
- **Drawn versus built.** A stroke half the width of the drawing's median wall is
  drawn, not built: glazing across a window, a door leaf, a dimension line. Those
  are taken out before the walls are built, and they are never merged into a wall,
  which would close the opening they sit in. A plan drawn entirely in hairlines
  keeps every wall — there is no thickness there to compare — and a wall that
  tapers to a hairline at one end also stays: it is thick at the other end and
  runs the length of the drawing, where a symbol does neither.
- **Takeoff.** Wall length and gross area, floor area, volume, drywall sheets
  (2.4 × 1.2 m), paint (2 coats over 10 m²/L), flooring with 10% waste, baseboard,
  studs at the spacing, three plate runs and sheathing panels. Drywall, paint and
  sheathing are charged on the **net** wall area, the openings deducted. These are
  the same formulas the ports use, so the CLI and `ports/` agree on a shared plan.

### From here to every other suite

`--write-plan` emits the contract in `ports/README.md`. The suites that need
placements or design decisions are then a step away, not a re-entry of the plan:

```bash
cargo run -- fixtures/floor_plan.png --mm-per-px 10 --write-plan outputs/plan.json
python ../floorplan_3d/ports/python/floorplan_core.py outputs/plan.json
```

That run adds the electrical demand, the NDS member sizing, the deck, roof and
stair checks, the plumbing load and the lighting photometry. What the image
does not carry is a `plumbing` fixture list, a `lighting` luminaire layout, a deck
or a roof pitch, so those sections stay empty until the JSON is given them.

### What it does not extract yet

- **Symbols only where the page yields ink.** A swing arc and a glazing line are
  read from ink: a PNG supplies it directly, and a PDF page is rendered to supply
  it: its path objects carry no stroke width. If a page will not render — pdfium
  missing, a damaged page — the PDF opening keeps the topology answer and an
  envelope opening is reported as a window. A glazed door drawn with a thick
  frame, or a door drawn without its swing, also falls back to topology.
- **Openings narrower than 0.5 m or wider than 4.0 m** are treated as a break in the
  ink or as unrelated wall pieces, so a very wide cased opening is not deducted.
- **Wall thickness.** Walls are lines, not double lines, so areas are measured on
the centre line.
- **Text is only ever the scale, and only in a PDF.** A dimension string sets the
  scale when the page has a text layer, matched to the nearest parallel line; a
  scanned PDF or an image has no text, so its scale is given or defaulted. Nothing
  else is read from the drawing's annotation — no room names, notes or tables.

## Fixtures

`fixtures/floor_plan.png` (7 walls, including a doorway) and
`fixtures/angled_plan.png` (6 walls, including a diagonal) are generated by
`examples/make_fixtures.rs`. Both are covered by tests that assert the exact wall
count and that walls come out axis aligned. `fixtures/symbol_plan.png` draws the
opening symbols the way a plan does — hairlines glazed across a 1.2 m window and a
swing arc on a 0.9 m doorway — and a test reads it end to end and asserts both
are reported with the right kind and width.

`fixtures/symbol_plan.html` is the same drawing laid out as a page to print, with
the dimension strings a paper plan carries, and `fixtures/symbol_plan.pdf` is its
printed form. A test reads that PDF the way the server does — walls from the
vector paths, symbols from a rendering of the page, scale from the two strings
("7000" over 525 pt is 13.33 mm/pt) — and asserts the 1.2 m window and the 0.9 m
door come out. Regenerate the page with `cargo run --example make_fixtures`, then
print it:

```bash
chrome --headless=new --no-pdf-header-footer \
  --print-to-pdf=fixtures/symbol_plan.pdf fixtures/symbol_plan.html
```

## Next step

PDF vector extraction via PDFium, so architectural plans are read from source
geometry instead of raster pixels.

```text
PDF -> PDFium -> extract vector paths -> convert to lines -> extrude -> OBJ / glTF
```
