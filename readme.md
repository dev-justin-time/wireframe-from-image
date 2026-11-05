# Blueprint to 3D Wireframe Converter

Turns a black-and-white blueprint PNG — or a vector PDF — into an extruded 3D wireframe and exports it
as OBJ or glTF. A raster is read from its ink; a PDF is read from its own paths.

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
| `--write-plan <path>` | — | Write the plan JSON (`units`, `wallHeight`, `studSpacingMm`, `walls`, `rooms`) used by `ports/`. |
| `--json` | — | Print that plan JSON to stdout. |
| `--mm-per-pt <n>` | `35.28` | PDF only: millimetres of building per PDF point. 35.28 is a 1:100 plan at 72 dpi. |
| `--page <n>` | `0` | PDF only: zero-based page to read. |
| `--gltf <path>` | beside the OBJ | Write a glTF 2.0 LINES model instead of `outputs/<uuid>.gltf`. |

Upload endpoint: `POST /upload` with a multipart body containing one image field,
which returns the path of the generated OBJ under `/outputs/`.

```bash
curl -F "file=@fixtures/floor_plan.png" http://127.0.0.1:3000/upload
```

## PDF vector extraction

A PDF is not a picture of a plan: every wall in it is a path object with real
co-ordinates. `src/pdf.rs` binds PDFium, walks the page objects, keeps the path
objects, converts their segments into the same `Line` struct the raster detector
returns (in PDF points, y flipped to grow down the page), and from there the plan
builder, the takeoff and both exporters run unchanged.

```text
PDF -> PDFium -> path objects -> segments -> Line[] -> walls, rooms, takeoff
                                                   -> extrude -> OBJ / glTF
```

Scale: one PDF point is 1/72", so `--mm-per-pt` is the drawing ratio times
0.3528 — `35.28` for 1:100, `17.64` for 1:50. The port's default is 35.28.

**PDFium is not vendored.** Put `pdfium.dll` / `libpdfium.so` on the path, or
set `PDFIUM_DYNAMIC_LIB_PATH` to the library or the directory holding it. Without
it the PDF path reports that and exits; the image path never loads it.

**Curves become chords.** PDFium's path API exposes a segment's end point only,
not a cubic's control points, so a bezier is emitted as the straight line between
its endpoints. That is exact for the polylines CAD exports use for walls, and
slightly short for a curved wall or a door-swing arc — the count of such segments
is printed as `curves` so you can see if a page depends on them.

The studio accepts a PDF upload to the same endpoint and takes its scale from
`mmPerPt`.

## Studio

`cargo run` serves the studio at <http://127.0.0.1:3000>; `PORT=8080 cargo run` moves
it. `static/index.html` is the shell, `static/app.js` holds the screens — plain ES
modules, no build step, no dependencies.

One endpoint feeds all of it: `POST /api/plan` takes the same image plus optional
`mmPerPx`, `mmPerPt`, `wallHeight` and `studSpacing` fields and returns the detected walls and
rooms, the takeoff, the plan JSON and the URLs of the OBJ and glTF to draw.

```bash
curl -F "file=@fixtures/floor_plan.png" -F "mmPerPx=10" http://127.0.0.1:3000/api/plan
```

| Group | Screens |
| --- | --- |
| Design | Plan studio (upload + wireframe), Editor (walls and rooms), App, Wall designer, Kitchen designer, Toolbox, Demo, WebGPU demo |
| Structure | Framing, Deck, Roof, Stair, L stair, U stair, Spiral stair, Steep stair, Stair gallery/parts/glossary, Foundation |
| Systems | Electrical, Lighting, Plumbing |
| Site | Landscape, Site plan |
| Project | Dashboard, Schedule, Permits and inspections, Bid builder, Price book, Pricing, Calculator |
| About | Home, Features, Gallery, About, Contact |

The designers compute from the plan the server returned — wall length, floor area,
height and stud spacing are prefilled from it — plus their own inputs. They are
planning checks, not a second copy of the suites: the authoritative member sizing,
loads and costs live in the Rust, Python and Lua ports under `floorplan3d/ports/`.

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
  covers the wall rather than the whole image diagonal.
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
- **Takeoff.** Wall length and gross area, floor area, volume, drywall sheets
  (2.4 × 1.2 m), paint (2 coats over 10 m²/L), flooring with 10% waste, baseboard,
  studs at the spacing, three plate runs and sheathing panels. These are the same
  formulas the ports use, so the CLI and `ports/` agree on a shared plan.

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

- **Openings.** The detector finds wall strokes, not the gaps and arcs that mark
  doors and windows, so `openings` is empty and wall areas are gross. A doorway
  gap is already visible as two walls meeting an opening; the missing piece is
  classifying it.
- **Wall thickness.** Walls are lines, not double lines, so areas are measured on
the centre line.
- **Text and dimensions.** Annotation is filtered as short segments, not read; a
  drawn dimension string is not used to set the scale automatically.

## Fixtures

`fixtures/floor_plan.png` (7 walls, including a doorway) and
`fixtures/angled_plan.png` (6 walls, including a diagonal) are generated by
`examples/make_fixtures.rs`. Both are covered by tests that assert the exact wall
count and that walls come out axis aligned.

## Next step

PDF vector extraction via PDFium, so architectural plans are read from source
geometry instead of raster pixels.

```text
PDF -> PDFium -> extract vector paths -> convert to lines -> extrude -> OBJ / glTF
```
