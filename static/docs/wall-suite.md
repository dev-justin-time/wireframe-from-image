# Wall covering suite

A finish-design system for walls: interior and exterior paint, plaster and
texture, wallpaper, timber panels, tile, stone, brick, stucco, EIFS, siding and
metal cladding. It prices the wall, reports the preparation and code checks,
and hands the chosen finish to the editor. Open `wall-designer.html` for the
standalone workspace, or use the **Covering** select in the editor's Finishes
panel.

## Pages and modules

| File | What it does |
| --- | --- |
| `wall-designer.html` | Designer workspace: exposure, covering, sheen, colour and harmony, surface and condition, wall run, exterior envelope, elevation, 3D, takeoff, checks, glossary, formulas and palette. |
| `features/wall/materials.js` | 35 coverings, 9 paint sheens, 26 colours, 4 harmonies, 14 substrates, pack sizes, coverage, cost, fire and vapour classes, grade clearance. |
| `features/wall/design.js` | `computeWallDesign()` - areas, packs, litres, prep, labour, costs, checks, summary and CSV; `WALL_DEFAULTS`; `wallAreaFromPlan()`. |
| `features/wall/glossary.js` | 86 terms in seven categories and 12 formulas. |
| `features/wall/preview.js` | The elevation with a cutaway through the layers, and the Three.js wall preview. |

## Coverings

**Interior paint** - ceiling dead flat, matte, eggshell, satin, semi-gloss,
gloss, plus limewash on mineral substrates.

**Interior finishes** - skim coat, Venetian plaster, orange peel, knockdown,
paper, vinyl and grasscloth wallpaper, wood veneer panelling, beadboard
wainscot, shiplap and board-and-batten.

**Tile and masonry** - ceramic wall tile, large-format porcelain, interior stone
veneer and brick slips.

**Exterior paint** - acrylic satin, elastomeric and breathable masonry paint.

**Exterior cladding** - 3-coat and 2-coat stucco, drained EIFS, fiber cement,
vinyl and wood rainscreen siding, brick and stone veneer, metal cladding and
acrylic render.

Each entry declares the substrates it is approved over, its packs and coverage,
required coats, primer, waste allowance, labour rate, service life, maintenance
interval, fire class, vapour class, VOC, minimum temperature and - for exterior
systems - whether it needs a water-resistive barrier, a drainage cavity and how
far it must sit above grade.

## Paint palette

Nine sheens carry gloss units and scrub cycles, from dead flat (1-3 GU, 50
cycles) to gloss (40-60 GU, 3000 cycles), with a wet-area flag. The 26 colours
are grouped as white, neutral, warm, green, blue, red and dark, each with an
undertone and a computed LRV.

Four harmonies build a wall / trim / accent / ceiling scheme:

- **Monochrome** - one hue, separated by value.
- **Analogous** - neighbouring hues, shifted 32°.
- **Complementary** - the opposite hue for the accent.
- **Neutral** - warm and cool neutrals with a quiet accent.

Trim is chosen at least 25 LRV lighter than the wall, and the suite reports the
actual separation rather than assuming it.

## Areas and quantities

```
gross      = Σ(wall run × height)
net        = gross − openings
with waste = net × (1 + waste)
paint      = net × coats ÷ coverage (m²/L)
cans       = ⌈net × coats ÷ (coverage × 3.785)⌉
rolls      = ⌈net × (1 + waste) ÷ 5.3⌉
boxes      = ⌈net × (1 + waste) ÷ box area⌉
squares    = net × (1 + waste) ÷ 9.2903
trim       = perimeter × (1 + waste)
```

Paint is bought in 3.78 L cans and also reported in litres and gallons. Systems
are bought in their own pack - 25 kg bags, 1.2 m² tile boxes, 2.98 m² sheets,
5.3 m² wallpaper rolls, 9.29 m² siding squares, 2 m² brick packs. Perimeter
items (baseboard, chair rail, corner trim, weep screed, flashing) are priced
from the perimeter, not the area.

`wallAreaFromPlan()` turns canvas-space walls and openings into gross, opening
and net areas for the editor, using each wall's own height where it has one.

## Checks

Every design returns `checks` with `severity` of `ok`, `info`, `warn` or
`error`:

- substrate approval and exposure match;
- coat count against the product, and primer required / recommended / none;
- wet-area suitability, matte paint and paper wallpaper in wet rooms, tile over
  drywall and tile deflection below L/360;
- vapour-retarder class against the climate zone (IRC R702.7);
- fire separation against the covering's flame-spread class (IRC R302.9);
- VOC against 50 g/L interior and 100 g/L exterior guides;
- cure time for new concrete, plaster and stucco;
- wood moisture above 19%, and application temperature outside the product
  window;
- lead paint before 1978 and asbestos in pre-1980 plaster;
- papering over paper, and board acclimation;
- exterior water-resistive barrier (IRC R703.2), drainage cavity (R703.1.1),
  flashing (R703.4), grade clearance (6 in siding, 4 in stucco and veneer),
  high wind on vinyl and rain during the window;
- dark exterior colours and low trim contrast;
- service life and maintenance interval.

## Preparation and costs

Preparation follows the condition - new work, repaint, old wallpaper or a
damaged wall - with a task list, hours and cost. Exterior work adds washing,
mildew treatment and spot priming; tile adds setting out; panels and siding add
acclimation. Labour is the covering rate per m² plus the prep cost, so a
cheap covering on a bad wall does not look artificially cheap.

## Editor integration

`Editor.html` → sidebar **Finishes** → **Covering** lists every interior,
exterior and dual-exposure covering. With a wall selected the choice applies to
that wall; with nothing selected it applies to every wall on the storey and
becomes the storey default. The status line shows the net area, litres (or
packs) and estimate from the plan.

The finish is stored in the same per-wall style map as colour and texture
(`covering`, `texture`, `color`), so it survives save, undo and project load.
The 3D wall builder reads the texture preset and colour; the suite's paint
sheens map to the paint product that carries them.

**Send to editor** on the designer page stores `wall-editor-draft`; the editor
applies it after the autosave, so the designed covering wins and every wall is
rebuilt with it.

## Tests

```bash
node .check-wall.js     # 151 catalogue, palette, design, checks, CSV and wiring checks
node .browser-check.mjs # 206 browser checks (server on :8766), including the wall page and hand-off
```

## Limits

Quantities are a metric design aid, not a specification or a quote. Coverage,
prices and labour rates are illustrative; wall assemblies vary by framing,
insulation and climate. The suite checks the finish against the substrate and
the envelope rules it knows, but a rated wall, a fire separation or a structural
veneer still needs the listed assembly and an engineer's sign-off.
