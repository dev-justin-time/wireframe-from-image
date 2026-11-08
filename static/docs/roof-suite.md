# Roof suite

A truss-roof design system: ten styles, a layered roof build-up (sheathing,
underlayment, shingle or tile covering), a rain-gutter package, a costed
takeoff and the code-style checks that tie them together. Open
`roof-designer.html` for the standalone workspace, or use the **Roof** panel in
`Editor.html` to dress the top storey.

## Pages

| File | What it does |
| --- | --- |
| `roof-designer.html` | Designer workspace: styles, geometry, layers, gutters, elevation section, 3D preview, takeoff, checks, glossary and formulas. |
| `features/roof/styles.js` | The ten styles, their plane geometry, truss member lines, eave/ridge/hip runs. |
| `features/roof/materials.js` | Sheathing, underlayment, covering and gutter catalogue with coverage, slope window, weight, life and cost. |
| `features/roof/design.js` | `computeRoofDesign()` - quantities, costs, checks, CSV and summary; `ROOF_DEFAULTS`. |
| `features/roof/glossary.js` | 62 terms in six categories plus the formulas the engine applies. |
| `features/roof/preview.js` | Three.js viewer rebuilt from a design, and the 2D elevation section. |
| `features/studio/roof.js` | Builds the same roof in the editor: deck, covering, caps, vent, fascia, drip edge, gutters and downspouts. |

## The ten styles

| Key | Name | Truss | Planes |
| --- | --- | --- | --- |
| `gable-king` | Gable · king post | King post | 2 |
| `gable-fink` | Gable · Fink | Fink (W-web) | 2 |
| `gable-howe` | Gable · Howe | Howe | 2 |
| `gable-scissor` | Gable · scissor | Scissor | 2 |
| `gable-attic` | Gable · attic | Raised tie | 2 |
| `gambrel` | Gambrel | Gambrel | 4 |
| `hip` | Hip | Hip | 4 |
| `cross-gable` | Cross gable | Cross | 4 |
| `shed` | Shed · mono-pitch | Shed | 1 |
| `saltbox` | Saltbox | Saltbox | 2 |

Geometry is generated in metres: `x` across the span, `z` along the ridge,
`y = 0` at the wall top. Overhangs lower the eave by `overhang × pitch / 12`.
Gable and saltbox ridges include the overhang; hip caps follow the slope, so
their length includes the fall from ridge to eave.

## Layers

1. **Deck** - OSB or plywood sheet count from roof area + waste (`2.9768 m²`
   per 1220 × 2440 sheet), with nail/clip allowance.
2. **Underlayment** - felt, synthetic or peel-and-stick; rolls from 92.9 m²
   coverage plus 5%, and a minimum slope per product.
3. **Ice and water shield** - eave length × `min(0.9 m, slope length)` in cold
   climates (and optional elsewhere), plus 18.6 m² rolls.
4. **Covering** - 3-tab, architectural, standing-seam metal, clay or concrete
   tile, slate, modified bitumen, 3-ply BUR, TPO/EPDM, roll roofing. Priced per
   square or per unit; bundles 3 per square for shingles, 100 tiles per square
   for clay (95 concrete, 220 slate).
5. **Starter strip and ridge/hip cap** - starter bundles for shingles; cap
   bundles (35 lf), tile pieces (0.45 m) or metal cap metres.
6. **Flashing** - drip edge (eave + rake), valley metal, step and apron
   flashing, counter flashing, kickouts, pipe boots, gutter apron and a chimney
   cricket.
7. **Ventilation** - ridge vent and soffit strip, with free area against the
   1:300 requirement.
8. **Rain gutter** - 5 in or 6 in K-style aluminium, 5 in half-round, 4 in box
   steel or 6 in copper; hangers at 500-600 mm, end caps, outlets, elbows and
   downspouts (auto: at least two, one per 12 m of run, and roof area divided by
   the profile's capacity).

## Checks

Every design returns `checks` with `severity` of `ok`, `info`, `warn` or
`error`:

- covering slope window (min/max), and low-slope below 2:12;
- ponding below 0.25:12;
- style minimum pitch;
- dead load (`kg/m²`) for tile, slate and BUR;
- tile at more than 406 mm truss spacing (error);
- ice dam protection in a cold climate;
- balanced intake/exhaust and 1:300 free vent area;
- downspout capacity per profile;
- underlayment slope minimum;
- valleys, chimney flashing, hail climate, deep overhangs and waste allowance;
- warranty conditions.

## Takeoff

`computeRoofDesign()` returns `areas` (roof, plan, squares, waste, ice shield,
vent), `layers` (sheets, rolls, covering units, caps, flashing lengths),
`structure` counts (`trussCount`, `ceilingJoists`, `trussLumberM`),
`gutterPackage`, `ventilation`, `costs` (material, labour, tear-off, gutter,
flashing, total, per square, per m², rows) and `summary`.

`roofTakeoffCsv(design)` writes the grouped bill plus a summary block;
`takeoffRows(design)` feeds the on-page table.

## Editor integration

`Editor.html` → sidebar **Roof** sets style, pitch, overhang, covering, gutter
profile, gutters and ridge vent, and summarises squares and estimate for the
top-storey footprint. The header **Roof** switch shows the result. Values travel
with the project (`roofConfig`) and restore with autosave.

**Send to editor** on the designer page stores `roof-editor-draft`; the editor
applies it after restoring the autosave, so the designed roof wins, switches the
roof on and rebuilds the 3D scene.

## Rules and regulations

[`ROOF.MD`](ROOF.MD) collects the code and manufacturer rules behind every
concern in the suite: structure, underlayment, ice barriers, flashing, covering
slopes, fastening, ventilation, drainage, thermal performance, insurance,
warranty and jobsite safety, plus the suite's check mapping and an inspection
checklist. The roof designer links to it from the header and the footer note.

## Tests

```bash
node .check-roof.js     # 119 design, takeoff, glossary and builder checks
node .check-studio.js   # 86 studio checks, including the truss roof
node .check-stairs.js   # 185 stair checks
node .browser-check.mjs # 166 browser checks (server on :8766)
```

## Limits

Quantities are a metric design aid, not an engineered truss design or a quote.
Labour rates and material prices are illustrative; the truss member lines show
the family, not a sealed truss calculation. Roof windows, solar arrays and
parapets are described in the glossary but are not modelled.
