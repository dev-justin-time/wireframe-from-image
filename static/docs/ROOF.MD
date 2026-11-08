# ROOF.MD — Rules and regulations for every roof concern

**Scope.** This document collects the rules behind the roof suite: structure,
deck, trusses, waterproofing, flashing, coverings, installation, drainage,
ventilation, thermal performance, insurance, warranty and jobsite safety. It is
the reference for `roof-designer.html`, `features/roof/*` and the editor's Roof
panel.

**Which rule wins.** Apply the strictest of:

1. the locally adopted building code (usually IRC 2021 / IBC 2021, with state
   and municipal amendments),
2. the covering manufacturer's printed installation instructions and code
   evaluation report,
3. the insurer's policy conditions, and
4. the suite's own design rules (listed as **suite rule**).

**This is a design aid, not legal advice, an engineering design or a quote.**
Confirm slope, loads, fire/wind class, insulation and permit requirements with
the authority having jurisdiction (AHJ), a licensed engineer and the product
manufacturer before building. Section references are to the 2021 IRC unless
noted; editions differ and are amended locally.

---

## 0. Quick reference

| Concern | Rule | Reference | Suite check |
| --- | --- | --- | --- |
| Asphalt shingle slope | 2:12 minimum; double underlayment 2:12–4:12 | IRC R905.2.2 | `pitch-covering` |
| Clay/concrete tile slope | 2.5:12 code minimum; 4:12 suite/product minimum | IRC R905.3.2 | `pitch-covering`, `pitch-style` |
| Metal panel slope | 3:12 lapped without sealant; 0.5:12 with sealant; 0.25:12 standing seam | IRC R905.10.2 | `pitch-covering` |
| Slate slope | 4:12 | IRC R905.6.2 | `pitch-covering` |
| Roll roofing slope | 1:12 | IRC R905.5.2 | `pitch-covering` |
| BUR / modified bitumen / single-ply | 0.25:12 design slope | IRC R905.9.1, R905.11, R905.12 | `low-slope`, `ponding` |
| Underlayment | ASTM D226/D4869/D6757/D1970; two layers below 4:12 | IRC R905.1.1 | `underlayment` |
| Ice barrier | Eaves + 24 in inside the exterior wall where required; 36 in on ≥8:12 | IRC R905.1.2 | `ice-dam` |
| Drip edge | Eaves and rakes, 2 in laps, 2 in up the deck, 1/4 in below sheathing, 12 in o.c. | IRC R905.2.8.5 | takeoff line |
| Valleys | Open metal valley ≥24 in wide, 0.019 in metal | IRC R905.2.8.2 | `valley` |
| Sidewall flashing | Step flashing ≥4 × 4 in | IRC R905.2.8.3 | `chimney` when present |
| Cricket | Required above chimneys/penetrations >30 in wide | IRC R903.2.2 | `chimney` |
| Ventilation | 1:150 free area, reducible to 1:300 when balanced / vapor retarder | IRC R806.2 | `ventilation` |
| Roof live load | 20 psf minimum (0.96 kN/m²) plus snow per IRC/ASCE 7 | IRC R301.6 | — |
| Fall protection | 6 ft (1.8 m) trigger | OSHA 1926.501 | — |
| Two layers maximum | Tear-off where two or more applications exist | IRC R908 | — |

---

## 1. Structural components

### 1.1 Deck / sheathing

**Rules**

- Solid sheathing is required under asphalt shingles, tile, slate, roll
  roofing and most metal shingles; spaced sheathing only where the product and
  code explicitly allow it (IRC R905.2.1, R905.3.1, R905.5.1, R905.6.1).
- Panel thickness and span rating must match the truss/rafter spacing and the
  covering dead load (IRC Chapter 8 and the panel's span rating). 7/16 in
  (11 mm) OSB is the lightest common deck at 24 in (610 mm) o.c.; use 15/32 in
  (12 mm) or 19/32 in (15 mm) plywood for tile, slate and heavy systems.
- Panels are laid long edge across supports, gapped 1/8 in (3 mm) at edges,
  and fastened at the manufacturer's schedule (commonly 6 in/12 in, 150 mm,
  at supported edges and 12 in/300 mm in the field for roofs).
- Replace delaminated, wet, rotten or fire-damaged decking; do not cover it.
- A smooth, flat deck is required for self-adhering membranes and standing-seam
  panels; defects telegraph through single-ply and thin metal.

**Suite rule** — sheet count = roof area × (1 + waste) ÷ 2.9768 m² per
1220 × 2440 sheet; the sheathing check reports nail spacing and product.

### 1.2 Rafters, trusses and bracing

- Rafters and trusses are designed for dead + live + snow + wind loads
  (IRC R301, ASCE 7). Minimum roof live load is 20 psf (0.96 kN/m²) unless the
  code sets a higher snow load.
- Wood trusses must be designed per ANSI/TPI 1 and installed with the
  manufacturer's permanent bracing, plus temporary bracing until sheathing is
  complete (IRC R802.10).
- Do not cut, notch or drill top chords, bottom chords or webs without the
  truss designer's written repair.
- Truss spacing is normally 24 in (610 mm) o.c. for shingles and 16 in
  (406 mm) for tile, slate and snow country unless the design says otherwise.
- Ceiling joists or bottom chords resist the outward thrust of rafters; a
  ridge beam design needs posts and footings, not a "ridge board only".
- Provide a continuous load path from roof to foundation: truss-to-wall
  connectors, wall-to-floor, floor-to-foundation, and anchorage per the wind
  and seismic provisions.

**Suite rule** — truss count = ⌈length ÷ spacing⌉ + 1 (plus the cross run for
a cross gable). Tile at more than 406 mm o.c. is an **error** (`truss-spacing`).

### 1.3 Ridge, eave, gable, hip, rake

- **Ridge** — highest horizontal line; covered by ridge cap and, if vented, a
  ridge vent. Ridge board/beam size per design; hips and valleys need
  supporting members.
- **Eave** — lower horizontal edge with overhang; must carry fascia, soffit,
  gutter and the first covering course. Eave height above grade and egress
  openings follow the building code.
- **Gable** — triangular wall closing the end of a ridged roof; gable wall
  bracing and gable-end wind resistance are structural requirements.
- **Hip** — four planes; hips need rafters/trusses and hip/ridge cap. Hip roofs
  are self-bracing and preferred in high-wind exposure.
- **Rake** — sloped gable edge; treated like an eave for wind uplift and
  flashing, with rake drip edge and rake trim.
- **Overhang** — 500 mm is typical; beyond about 900 mm the lookout/truss
  cantilever, blocking and uplift need engineering. Do not reduce the
  overhang below the manufacturer's minimum for the chosen edge detail.

**Suite check** — `overhang` warns above 900 mm.

### 1.4 Soffit, fascia and parapet

- **Soffit** — the finished underside of the eave; where vented, it is the
  intake half of attic ventilation. Keep a 1 in (25 mm) clear air channel
  between insulation and the roof deck at the eave (IRC R806.3). Soffit must
  be fixed to resist wind uplift and allow maintenance access.
- **Fascia** — vertical edge board carrying the gutter; sound, straight and
  properly flashed. Gutter hangers must be fixed into framing or a reinforced
  fascia, not just vinyl or thin trim.
- **Parapet** — low perimeter wall on a flat roof. Provide non-combustible,
  weatherproof coping at least the wall thickness wide (IRC R903.3), base and
  counter flashing, and overflow drainage. Parapets require design for wind
  uplift and, where accessible, guard heights per code.

### 1.5 Valley

- Internal intersection that concentrates flow. Line the valley before the
  covering; never rely on shingles alone.
- Provide positive slope to the outlet; avoid dead valleys (Section 9).
- Valley material and width follow Section 3.2; ice barrier/cementing is
  required in cold climates (IRC R905.3.8 for tile valleys).

---

## 2. Waterproofing and flashing

Flashing is required wherever water can enter: wall/roof intersections,
changes in slope or direction, penetrations, chimneys, parapets and eaves
meeting a sidewall (IRC R903.2.1). Metal flashing must be corrosion resistant
and at least 0.019 in (0.5 mm, No. 26 galvanized) thick unless the product
standard requires heavier.

### 2.1 Layer order (shingle roof, typical)

1. Deck.
2. Ice and water shield at eaves/valleys where required.
3. Underlayment (double layer 2:12–4:12).
4. Drip edge: underlayment **over** the drip edge at eaves, **under** it at
   rakes (IRC R905.2.8.5).
5. Starter strip.
6. Field shingles, step/apron flashing woven in with each course.
7. Ridge and hip caps.

Follow the manufacturer where its detail differs; the stricter detail governs.

### 2.2 Underlayment

- Products: ASTM D226 Type I/II felt, D4869, D6757 synthetic, or D1970
  self-adhered membrane (IRC R905.1.1).
- 2:12–4:12 requires two layers: a 19 in (483 mm) strip at the eave plus
  36 in (914 mm) sheets lapped 19 in; end laps 4 in, offset 6 ft.
- 4:12 and steeper: one layer, shingle fashion, 2 in side laps, 4 in end laps,
  offset 6 ft.
- High-wind areas require heavier underlayment (D226 Type II, D4869 Type
  III/IV) and cap-nail fastening in a 12 in × 6 in grid (IRC Table
  R905.1.1(3)).
- Underlayment is not a substitute for ice barrier at eaves or a membrane at
  low-slope transitions.

**Suite check** — `underlayment` compares the product's minimum slope with the
design pitch and counts rolls at 92.9 m² per roll plus 5%.

### 2.3 Ice and water shield

- Required where the jurisdiction has a history of ice dams (IRC Table
  R301.2), and always a good idea in cold climates.
- Extend from the lowest roof edge to at least 24 in (610 mm) **inside** the
  exterior wall line; on slopes ≥8:12 extend at least 36 in (914 mm) along the
  slope from the eave (IRC R905.1.2).
- Also use it in valleys, around chimneys/skylights, at wall/roof junctions
  and on low-slope transitions.
- Do not apply over a wet, dirty or frozen deck; follow the membrane's
  temperature limits and primer requirements.

**Suite rule** — eave length × min(0.9 m, slope length) when enabled; the
`ice-dam` check makes it an error to omit it in the cold climate preset.

### 2.4 Drip edge, gutter apron and kickout

- **Drip edge** — at eaves and rakes; overlaps ≥2 in (51 mm); extends ≥1/4 in
  (6 mm) below the sheathing and ≥2 in (51 mm) up the deck; fastened ≤12 in
  (305 mm) o.c. with roofing nails (IRC R905.2.8.5).
- **Gutter apron** — metal strip under the first course turning into the
  gutter, keeping water out of the fascia; lap over the underlayment and under
  the starter strip.
- **Kickout flashing** — required at the bottom of a roof-to-wall joint or
  valley terminating at a wall, to throw water into the gutter instead of down
  the wall. It is the most commonly omitted flashing on production roofs.

**Suite quantities** — drip edge = eave + rake; gutter apron = eave length;
kickouts = 2 on a cross gable.

### 2.5 Step, counter and apron flashing

- **Step flashing** — one piece per shingle course at a sidewall; minimum
  4 × 4 in (102 × 102 mm), 2 in head lap, 4 in end lap, corrosion-resistant;
  the vertical leg runs under the siding (IRC R905.2.8.3).
- **Counter flashing** — embedded in masonry/parapet (reglet at least 1 in /
  25 mm deep, sealed) or surface-mounted with a sealed top edge; it laps over
  the base flashing, never behind it. Masonry veneer counter flashing follows
  IRC R703.8.2.2.
- **Apron flashing** — across the low/front face of a chimney or dormer,
  turned up the face and out over the covering.
- Metal thickness ≥0.019 in (0.5 mm); sealant is a backup, not the primary
  weather barrier.

### 2.6 Valleys

- Open metal valley: lining ≥24 in (610 mm) wide, metal per IRC Table
  R905.2.8.2 (galvanized 26 ga, copper 16 oz, aluminium 0.024 in, etc.).
- Closed valley: one ply smooth roll roofing ≥36 in (914 mm) wide, or a
  D1970 membrane.
- Tile valleys: flashing extends ≥11 in (279 mm) each side of the centreline,
  with a ≥1 in splash diverter rib and 4 in end laps (IRC R905.3.8). Provide a
  36 in underlayment strip under metal valleys.
- In cold climates, cement the valley underlayment to the roofing
  underlayment below 7:12, or use self-adhered membrane.

**Suite check** — `valley` reports valley length and adds valley metal.

### 2.7 Cricket and penetration boots

- **Cricket** — required on the uphill side of a chimney or penetration more
  than 30 in (762 mm) wide measured perpendicular to the slope (IRC R903.2.2).
  Cover it with metal or the same covering as the roof.
- **Vent boot** — collar over a pipe, lapped under the uphill course and over
  the downhill course; the rubber collar is a wear item and must be replaced
  when cracked. Use a lead boot or high-temperature boot on hot flues.
- Other penetrations (skylights, vents, solar mounts) follow the product's
  flashing kit and the manufacturer's torque/sealant values. Never rely on
  surface caulk alone.

**Suite rule** — choosing a chimney adds step, apron and counter flashing, a
cricket and 4 m of step metal; `pipeVents` adds boots.

---

## 3. Coverings and materials

### 3.1 Slope table (code minimum vs suite minimum)

| Covering | Code minimum | Suite minimum | Maximum (suite) | Notes |
| --- | --- | --- | --- | --- |
| 3-tab asphalt | 2:12 | 2:12 | 20:12 | Double underlayment 2:12–4:12 |
| Architectural asphalt | 2:12 | 2:12 | 20:12 | 3 bundles/square; Class 4 hail optional |
| Standing-seam metal | 0.25:12 (standing seam); 3:12 lapped | 3:12 | 24:12 | Panel profile/evaluation report may set higher |
| Clay tile | 2.5:12 | 4:12 | 16:12 | Battens; heavy; 100 tiles/square |
| Concrete tile | 2.5:12 | 4:12 | 16:12 | 95 tiles/square; 50 kg/m² |
| Slate | 4:12 | 4:12 | 24:12 | 2 fasteners per slate; headlap 4/3/2 in by slope |
| Modified bitumen | 0.25:12 | 1:12 | 4:12 | Two plies typical; torch/self-adhered |
| Built-up roof (3-ply) | 0.25:12 | 0.25:12 | 3:12 | Gravel or cap sheet |
| Single-ply TPO/EPDM | 0.25:12 | 0.25:12 | 3:12 | Heat-welded seams; no granules |
| Roll roofing | 1:12 | 1:12 | 4:12 | 1–2 plies; shortest life |

The suite's stricter minimum applies to its own checks and takeoff. Where the
code permits a lower slope than the product, the product wins for warranty.

### 3.2 Asphalt shingles

- Products must comply with ASTM D3462 (IRC R905.2.4). Fire class per
  ASTM E108/UL 790; wind class per ASTM D7158 (or D3161 where D7158 does not
  apply) for the design wind speed (IRC R905.2.4.1).
- Nails: galvanized/stainless/aluminium/copper, minimum 12 ga (0.105 in)
  shank, 3/8 in (9.5 mm) head, penetrating at least 3/4 in (19 mm) into the
  deck or through it (IRC R905.2.5).
- Fasteners: at least 4 per strip shingle or 2 per individual shingle, more
  where the manufacturer requires (commonly 6 in high wind); above 21:12
  follow the manufacturer (IRC R905.2.6).
- Nail placement: 1 in above the exposure line, straight, flush — not
  over-driven, not high. Exposed nails are defects except where a product
  explicitly permits face-nailing (Section 9.5).
- **Starter strip** at the eave: seals the bottom edge and resists wind uplift;
  not counted as a field square.
- **Ridge cap** over the ridge and hips; 35 lf per bundle is typical.
- **Granules** protect the asphalt from UV; granule loss in gutters signals
  ageing. Do not power-wash shingles.
- **3-tab shingle** is flat and single-layer; **architectural (dimensional)**
  is laminated and heavier. Both are permitted at 2:12 with the required
  underlayment.
- **Racking** — installing courses vertically instead of staggering them — is
  an incorrect method; joints must be offset per the manufacturer.
- **Blistering** — trapped moisture or a manufacturing defect; open blisters
  that expose the mat require repair. Ventilation and correct storage reduce
  risk.

### 3.3 Tile and slate

- Clay tile ASTM C1167, concrete tile ASTM C1492 (IRC R905.3.4/5); slate
  ASTM C406 (R905.6.4).
- Solid sheathing; battens where the system requires them. Battens must be
  treated/preservative and fixed through the underlayment into framing; a
  counter-batten creates the drainage plane.
- Tile fasteners: 11 ga, 5/16 in head, 3/4 in penetration; two per tile in
  snow areas; perimeter zones (three courses or 36 in from hips/ridges/eaves/
  rakes) fully fastened (IRC R905.3.6/7).
- Slate: 2 fasteners per slate; headlap 4 in for 4:12–8:12, 3 in for
  8:12–20:12, 2 in above 20:12 (IRC R905.6.5).
- Heavy coverings require the truss, sheathing and connections designed for
  the dead load (45–55 kg/m²); confirm with the truss designer.
- Walking on tile/slate requires boards; cracked units are replaced, not
  caulked.

**Suite checks** — `dead-load`, `truss-spacing`, `pitch-covering`.

### 3.4 Metal roofing

- Standing seam: concealed clips, expansion allowance, panel thermal
  movement, eave and rake closures, and a minimum slope of 0.25:12 by code;
  the panel's evaluation report often requires more (the suite uses 3:12).
- Lapped/screw-through panels: 3:12 without lap sealant, 0.5:12 with the
  manufacturer's sealant (IRC R905.10.2).
- Fasteners: gasketed screws at the manufacturer's spacing, driven square and
  not over-tightened; isolate dissimilar metals (copper/steel/aluminium) to
  prevent galvanic corrosion.
- Underlayment per R905.1.1; high-wind areas require heavier felt/synthetic.
- Oil-canning, waviness and scratched finish are quality/warranty issues;
  cut edges must be treated per the manufacturer.

### 3.5 Low-slope systems

- **Built-up roof (BUR)** — alternating asphalt and ply sheets; 3-ply typical;
  slope ≥0.25:12 (IRC R905.9.1), except coal-tar BUR at 0.125:12. Gravel
  surfacing adds weight and UV protection.
- **Modified bitumen** — SBS or APP sheet, torch-applied or self-adhered;
  slope ≥0.25:12 by code, the suite uses 1:12 as a conservative design floor;
  two plies typical. Fire precautions are critical for torch work.
- **Single-ply membrane (TPO/EPDM/PVC)** — slope ≥0.25:12; heat-welded or
  adhered seams, termination bars, and mechanically fastened per the membrane's
  approval. **Ply** = one layer; a two-ply membrane has two layers.
- **Roll roofing** — 1:12 minimum (IRC R905.5.2), 1–2 plies, shortest service
  life; laps sealed with asphalt cement.

### 3.6 Underlayment products

- **Felt (tar paper)** — 15 lb (D226 Type I) or 30 lb (Type II); 30 lb is the
  historic standard under shingles; tears and wrinkles are more likely in
  heat.
- **Synthetic underlayment** — woven/non-woven, higher tear strength, lighter,
  usually 10 squares per roll.
- **Ice and water shield** — self-adhering polymer-modified bitumen (ASTM
  D1970), used at eaves/valleys/penetrations.
- Do not mix incompatible products; follow the covering manufacturer's
  approved underlayment list for warranty.

### 3.7 Waste and ordering

- Standard waste: 5–10% for simple gables, 10–15% for hips/valleys, up to 20%
  for complex cross gables and dormers.
- Waste below 5% is unrealistic; above 25% usually signals a plan or ordering
  error. The suite clamps 0–40% and warns outside 5–25%.
- **Square** = 100 ft² = 9.29 m²; shingles, tile and labour are priced per
  square. Materials ship in bundles (3 per square for shingles) or units.

---

## 4. Installation, repair and maintenance

### 4.1 Tear-off versus overlay

- New covering may be installed over an existing one only where the deck is
  sound, the existing covering is dry and well adhered, and the code permits
  it. IRC R908 requires removal where there are two or more existing
  applications of any covering, where the existing covering is water-soaked
  or deteriorated, or where the new product needs a smooth substrate.
- Many manufacturers require a full tear-off for their material warranty;
  some allow one overlay. Verify before pricing.
- Re-decking is required where the existing deck is thin, delaminated, gapped
  (gaps ≥1/4 in), or cannot hold fasteners.
- Tear-off exposes the deck for repair, ice-barrier installation, flashing
  replacement and inspection — budget for it.

**Suite rule** — `tearOff` adds a per-square labour line; roof `waste` covers
breakage and cut-offs, not the tear-off.

### 4.2 Ventilation

- Net free vent area ≥1:150 of the attic area; may be reduced to 1:300 where a
  Class I/II vapor retarder is on the warm side or intake and exhaust are
  balanced (IRC R806.2).
- Provide intake at the soffit and exhaust high on the roof (ridge vent, box
  vent, gable vent). Balanced is best; one-sided ventilation is a warning.
- Keep insulation clear of the eave vent with baffles; 1 in (25 mm) minimum
  air space (IRC R806.3).
- Unvented (conditioned) attics need an approved air-impermeable insulation
  system and no vapor trap; follow IRC R806.5.
- **Ice dams** are a ventilation/air-sealing problem first, a membrane problem
  second: seal warm-air leaks, insulate, ventilate, then add eave membrane.

**Suite check** — `ventilation` compares provided free area with roof area ÷
300 and warns when intake/exhaust is missing or one-sided.

### 4.3 Ponding, drainage and low-slope

- Roofs must drain; ponding is water remaining 48 hours after rain.
- Provide slope to drains/scuppers; low points need primary drains and
  secondary overflow (IRC R903.4.1: overflow 2 in above the low point, or
  scuppers three times the drain size).
- Below 0.25:12 use a continuous membrane system; structural design must
  include ponding load.
- **Dead valley** — a valley with no positive outlet. Fix with a widened
  valley, a cricket, a drain or a redesigned slope; do not just add sealant.

**Suite checks** — `ponding` (error below 0.25:12), `low-slope`, `valley`.

### 4.4 Ice dams and hail

- **Ice dam** — a ridge of ice at the eave that backs water under the
  covering. Prevent with air sealing, insulation, ventilation and eave
  membrane; remove snow safely from the ground, never with an axe on the roof.
- **Hail damage** — dents/bruises that break granules and mat. Insurers may
  distinguish functional from cosmetic damage. Class 4 impact-resistant
  shingles (UL 2218) can earn premium discounts; document damage with dated
  photos and a contractor report.

### 4.5 Maintenance schedule

- Inspect twice a year and after major storms: flashing, boots, valleys,
  ridge/hip caps, gutters, fasteners, sealant, granule loss, ponding.
- Clean gutters and downspouts; keep discharge 4–6 ft from the foundation.
- Replace cracked pipe boots promptly; re-seal counter-flashing reglets.
- Trim trees, remove debris, and keep the roof free of stored materials.
- Keep the warranty, receipts and inspection photos; most warranties require
  proof of ventilation and professional installation.

---

## 5. Rain gutter and drainage system

The code requires roof drainage (IRC R903.4) but does not prescribe gutter
capacity; use the manufacturer's tables, SMACNA's Architectural Sheet Metal
Manual or the plumbing code (IPC 1106/1108) where drains and leaders are
sized.

### 5.1 Rules

- Slope gutters toward outlets at about 1/16 in per ft (0.5%, roughly 1:192);
  standing water in a gutter accelerates corrosion and mosquito breeding.
- Hangers at 24 in (600 mm) o.c. for K-style and 20 in (500 mm) for
  half-round, closer in snow/ice regions; fix into framing or a gutter
  reinforcement.
- One downspout per 30–40 ft (9–12 m) of run and per the profile's roof-area
  capacity; minimum two per roof. The suite sizes by area per downspout
  (40–95 m² depending on profile) and by run length.
- End caps at open ends; outlets and elbows where the run turns; downspouts
  discharge to splash blocks, leaders or a storm system — not onto the
  foundation.
- Overflow: on flat/parapet roofs provide secondary drainage as above; on
  steep roofs the gutter must handle the design rainfall or water backs into
  the fascia.
- Ice: use ice-and-water shield, keep gutters clear, and use heat cable only
  with a GFCI and manufacturer-approved clips.
- Leaf guards reduce maintenance but must not reduce capacity below the design
  flow; clean them.

**Suite package** — gutter run = eave length; downspouts auto =
max(2, ⌈run ÷ 12 m⌉, ⌈area ÷ capacity⌉); hangers = ⌈run ÷ 0.6 m⌉; end caps,
outlets and two elbows per downspout. The `gutter-capacity` check warns when
area per downspout exceeds the profile's rating.

### 5.2 Profiles

| Profile | Capacity (suite) | Downspout | Typical use |
| --- | --- | --- | --- |
| 5 in K-style aluminium | 55 m²/downspout | 2 × 3 in | Standard residential |
| 6 in K-style aluminium | 95 m² | 3 × 4 in | Long runs, large roofs |
| 5 in half-round aluminium | 45 m² | 3 in round | Heritage, tile roofs |
| 4 in box steel | 40 m² | 3 in round | Commercial/outbuildings |
| 6 in K-style copper | 95 m² | 3 × 4 in copper | Premium, long life |

---

## 6. Thermal and moisture rules

- **R-value** — thermal resistance; higher is better. Vented attics commonly
  need R-30 to R-60 depending on climate zone; check the locally adopted IECC
  table (2021 IECC Table R402.1.2) and amendments.
- **BTU** — 1 BTU ≈ 1.055 kJ. Insulation is specified by R-value, not BTU;
  use BTU for heating/cooling load calculations.
- **Vapor barrier/retarder** — on the warm side in cold climates; Class I/II
  where required. Do not install two vapor barriers; a vented roof relies on
  air sealing and a balanced vent path (IRC R702.7, IRC R806).
- Insulation must not block eave vents; use baffles and maintain the 1 in air
  channel. In cathedral ceilings, provide a vent channel above the insulation
  or use an unvented assembly designed for it.
- Air sealing (top plates, penetrations, attic hatches, chimney chases) is the
  single biggest ice-dam and energy measure.
- Roof colour and ventilation affect attic temperature; a cool roof or
  reflective coating reduces heat gain but must suit the covering warranty.

**Suite rule** — no thermal layer is priced; `covering.weightKgM2` and the
`dead-load` check report the structural consequence of the chosen covering.

---

## 7. Financial, insurance and warranty rules

*General consumer-protection information, not legal advice. Insurance law and
AOB rules vary by state/province and policy.*

### 7.1 Claim basis

- **RCV (Replacement Cost Value)** — pays the full cost to replace with new
  materials of like kind and quality. Most policies pay ACV first and release
  withheld depreciation after completion and invoicing.
- **ACV (Actual Cash Value)** — pays depreciated value: RCV − depreciation.
  An ACV settlement may leave a gap the homeowner must fund.
- **Deductible** — the policy deductible is the homeowner's share; waiving or
  absorbing it is restricted or illegal in many jurisdictions.
- **Matching** — some states require insurers to match undamaged shingles/
  siding where a repair cannot be reasonably matched; others do not.
- **AOB (Assignment of Benefits)** — transfers the claim rights to the
  contractor. Several states restrict, regulate or prohibit residential AOB;
  never present it as routine. It changes who negotiates, who is paid, and the
  homeowner's control of the claim.

### 7.2 Inspection and documentation

- A **roofing inspection** should record slope, covering type and layers,
  deck condition, flashings, penetrations, ventilation, gutter condition,
  ponding/drainage, hail/wind/ice damage and dated photographs.
- Document code-required items (ice barrier, drip edge, ventilation) because
  insurers and AHJs ask for them.
- Keep the contract, scope, material specifications, permit, photos and
  warranty documents together.
- Public adjusters and roof consultants must be licensed where required; fees
  and contingency arrangements are regulated in many states.

### 7.3 Warranty

- **Material warranty** — manufacturer's limited warranty, usually pro-rated,
  conditional on installation per instructions, ventilation, fasteners and
  maintenance. It covers defects, not wear or storm damage.
- **Workmanship warranty** — contractor's promise, typically 1–10 years;
  verify it is written, transferable and backed by insurance.
- Typical conditions that void coverage: insufficient ventilation, improper
  fasteners or nailing, installing below the minimum slope, covering an
  existing roof without approval, poor deck, incompatible products.
- Keep receipts and proof of maintenance; register the warranty where the
  manufacturer requires it.

### 7.4 Estimate versus quote

- The suite's cost is an **illustrative estimate** (material + labour, with
  waste); it is not a fixed quote, does not include permits, scaffolding,
  disposal, taxes, overhead/profit or local premiums.
- Price per square is the normal comparison unit; confirm what the square
  includes (tear-off, underlayment, flashing, vents, gutters, disposal).

---

## 8. Jobsite safety and permits

### 8.1 Fall protection

- Fall protection is required at 6 ft (1.8 m) or more above a lower level for
  construction work (OSHA 29 CFR 1926.501). Residential roofing has specific
  requirements under 1926.501(b)(13); a written fall-protection plan is
  required where conventional systems are infeasible.
- Use guardrails, safety nets or personal fall-arrest systems; anchor to a
  rated point, inspect harnesses/lanyards, and provide rescue arrangements.
- Roof jacks/scaffolding must be rated for the load; do not stand on the top
  two rungs of a ladder.

### 8.2 Access, weather and housekeeping

- Ladders at 4:1 (one unit out for four up), extend 3 ft above the landing,
  secured, and on stable footing (OSHA 1926.1053).
- Do not install shingles, membranes or sealants in rain, snow, high wind or
  outside the product's temperature range. Hot-work (torch) requires a permit,
  fire watch and extinguisher.
- Keep the deck clear of offcuts; do not overload the roof with bundles.
  Protect openings, skylights and the ground below.
- PPE: head, eye, hand, foot, hearing and respiratory protection as required;
  asphalt fume and cutting dust need ventilation.
- Electrical: keep cords/GFCI protected, away from wet surfaces and standing
  water; lock out solar arrays before working near them.

### 8.3 Permits and inspections

- Most jurisdictions require a roofing permit for tear-off, re-roof and
  structural work; some allow minor repairs without one. Confirm before work.
- Inspections commonly cover deck condition, underlayment/ice barrier,
  flashing, ventilation, fasteners and final covering.
- Structural alterations (truss repairs, ridge/beam changes, new openings)
  need sealed engineering; the AHJ may require it for any truss modification.
- Historic districts, wildfire zones and coastal high-wind zones add
  requirements (Class A fire rating, WUI detailing, wind-borne debris).

---

## 9. Additional concerns

### 9.1 Dormer

- A dormer creates two valleys, two sidewalls of step flashing, an apron, and
  a small roof plane; each must be flashed independently and woven into the
  main roof. Provide a cricket where the dormer is wide/close to the ridge.
- Not modelled by the suite (count it as extra flashing/valley and roof area).

### 9.2 Shed roof

- Single plane, one eave, two rakes, no ridge or hip cap. Any covering may be
  used within its own slope limits; a shed roof is a form, not a material.
- The low edge needs the same drip edge, gutter and ice-barrier treatment as
  any eave; the high edge needs wall flashing/counter flashing.

### 9.3 Low-slope roof

- Less than 2:12; use BUR, modified bitumen, single-ply or a proprietary
  low-slope system. Provide positive drainage, secondary overflow and a
  continuous membrane; do not use shingles below 2:12.

### 9.4 Dead valley

- A valley with insufficient outlet; water ponds or backs up. Correct the
  slope, widen the valley, add a cricket or drain. Sealant is not a fix, and a
  dead valley is a repeat-leak location.

### 9.5 Exposed-nail method

- Face-nailing where heads remain exposed is limited to products and
  occupancies that permit it (some agricultural/low-cost buildings). It is not
  acceptable for architectural shingles, tile or most residential warranties;
  exposed heads must be sealed and are a maintenance liability. Check the
  product's installation instructions before using it.

### 9.6 Ply

- Ply = one layer of roofing material. A two-ply membrane has two layers; a
  3-ply BUR has three reinforcing sheets. More plies generally mean more
  weight, cost and redundancy, not a different slope.

### 9.7 BTU and R-value

- BTU is heat energy; R-value is thermal resistance. Convert: 1 BTU ≈
  1.055 kJ; R-value (imperial) × 0.176 ≈ RSI (metric). Insulation code
  compliance is by R-value per climate zone, not BTU.

### 9.8 Vapor barrier

- Limits vapor diffusion; required on the warm side in cold climates and in
  some assemblies. A vapor barrier is not an air barrier — air sealing is
  separate and more important for ice dams. Avoid trapping moisture between
  two low-permeability layers.

### 9.9 Batten

- A strip of wood or metal across rafters supporting tile or metal, creating a
  drainage/ventilation gap. Use preservative-treated battens, fix through the
  underlayment into framing, and follow the tile/metal gauge. Counter-battens
  run perpendicular for a true drainage plane.

### 9.10 Fascia, soffit and gutter interfaces

- Keep the roof-edge sequence correct: fascia → drip edge → underlayment →
  gutter apron → gutter hangers → covering. A gutter screwed through the drip
  edge without sealant is a leak path; use standoffs or sealed fasteners.

---

## 10. Compliance workflow for a design

1. **Slope and style** — measure the actual slope; pick a covering whose code
   and product minimum is met. The suite flags `pitch-covering`,
   `pitch-style`, `low-slope` and `ponding`.
2. **Structure** — confirm deck thickness/span, truss design and bracing,
   dead load, snow/wind exposure and load path. Engineering required for
   truss changes and long spans.
3. **Underlayment and ice barrier** — select product by slope and climate;
   detail eaves, valleys and penetrations. Checks: `underlayment`, `ice-dam`.
4. **Flashing** — drip edge, valleys, step/counter/apron, kickouts, boots,
   cricket. Checks: `valley`, `chimney`.
5. **Covering and attachments** — fasteners, starter, ridge/hip caps, wind and
   fire class, hail class. Checks: `pitch-covering`, `dead-load`,
   `truss-spacing`.
6. **Ventilation** — intake/exhaust, free area, baffles, unvented assemblies.
   Check: `ventilation`.
7. **Drainage** — gutters, downspouts, overflow, discharge. Checks:
   `gutter-capacity`, `gutter`.
8. **Thermal and moisture** — insulation R-value, vapor retarder, air
   sealing. No suite check; verify against IECC.
9. **Permit, safety, insurance and warranty** — permit, fall plan, scope,
   photos, ACV/RCV and warranty conditions.
10. **Handover** — as-built slopes, product labels, warranty registration,
    maintenance schedule and a photo record.

---

## 11. Inspection checklist

**Deck and structure**

- [ ] Deck thickness, span rating, gaps, fasteners, rot/delamination
- [ ] Truss spacing, bracing, no cuts/notches, load path and connectors
- [ ] Ridge/hip/valley framing and support
- [ ] Overhang and lookout support; fascia sound

**Waterproofing**

- [ ] Underlayment type, layers, laps, offsets, fastening
- [ ] Ice and water shield coverage (eave, valleys, penetrations)
- [ ] Drip edge at eaves and rakes, laps, 1/4 in below sheathing
- [ ] Valley lining width, metal thickness, laps, diverter rib
- [ ] Step flashing at sidewalls, 4 × 4 in minimum, woven per course
- [ ] Counter flashing reglet/sealant; apron and kickout flashing
- [ ] Cricket above wide chimney; pipe boots and skylight kits
- [ ] Chimney/parapet counter flashing and coping

**Covering**

- [ ] Slope, product, fire/wind/hail class
- [ ] Starter strip, exposure, stagger, nail placement and count
- [ ] Ridge/hip caps, vents and closures
- [ ] Tile/slate fasteners, battens, broken units replaced
- [ ] Metal panel clips/fasteners, gaskets, expansion, dissimilar metals
- [ ] Low-slope membrane seams, terminations, drains and overflow

**Ventilation, drainage and thermal**

- [ ] Soffit intake clear, baffles, ridge/box exhaust, free area ≥1:300 (or 1:150)
- [ ] Gutters slope, hangers, end caps, outlets, downspouts, discharge
- [ ] Ponding, dead valleys, drain function
- [ ] Insulation R-value, vapor retarder, air sealing

**Safety, paperwork and handover**

- [ ] Fall protection, ladder setup, weather, hot-work permit
- [ ] Building permit and inspections
- [ ] Photos, product labels, warranty registration, maintenance schedule

---

## Appendix A — Conversions

| Imperial | Metric |
| --- | --- |
| 1 in | 25.4 mm |
| 1 ft | 0.3048 m |
| 1 square (100 ft²) | 9.2903 m² |
| 1 psf | 0.0479 kN/m² |
| 1:12 slope | 4.76° |
| 2:12 | 9.46° |
| 4:12 | 18.43° |
| 6:12 | 26.57° |
| 8:12 | 33.69° |
| 12:12 | 45° |
| 1/4:12 | 1.19° |
| 1 BTU | 1.055 kJ |
| R-1 (imperial) | RSI 0.176 |

**Slope factor** = √(1 + (pitch ÷ 12)²); 6:12 → 1.118. Roof area = plan area ×
slope factor (summed plane by plane when the roof is not a simple gable).

## Appendix B — Suite check mapping

| Check id | Concern |
| --- | --- |
| `pitch-covering` | Covering slope window |
| `pitch-style` | Style's preferred pitch |
| `pitch-max` | Covering maximum pitch |
| `low-slope` | Below 2:12 |
| `ponding` | Below 0.25:12 |
| `deck` | Sheathing and fastening |
| `dead-load` | Covering weight |
| `truss-spacing` | Tile at wide spacing |
| `ice-dam` | Eave membrane |
| `ventilation` | Free area and balance |
| `gutter-capacity` | Roof area per downspout |
| `gutter` | No gutter package |
| `underlayment` | Product slope minimum |
| `valley` | Valley metal |
| `chimney` | Chimney flashing and cricket |
| `hail` | Impact-resistant shingles |
| `overhang` | Deep overhang support |
| `waste` | Ordering allowance |
| `warranty` | Conditions that protect coverage |

## Appendix C — Sources

- International Residential Code 2021, Chapter 9 (Roof Assemblies): R902,
  R903, R905.1–R905.12; Chapter 8 (Roof-Ceiling Construction); Chapter 7
  (Wall Covering / flashing); R806 (Ventilation); R908 (Re-roofing).
- International Building Code 2021, Chapter 15 (Roof Assemblies and
  Rooftop Structures) for commercial work.
- International Energy Conservation Code 2021 (R-values, air sealing).
- International Plumbing Code 2021, Chapters 11 (storm drainage) where roof
  drains and leaders are sized.
- ASTM D226, D4869, D6757, D1970 (underlayment/membrane); D3462, D7158, D3161
  (asphalt shingles); C1167, C1492 (tile); C406 (slate); D3909/D6380 (roll
  roofing); E108/UL 790 (fire); UL 2218 (impact).
- ANSI/TPI 1 (wood trusses), ASCE 7 (loads), SMACNA Architectural Sheet Metal
  Manual (gutter/downspout sizing).
- OSHA 29 CFR 1926 (fall protection, ladders, PPE).
- Local amendments, manufacturer installation instructions and code evaluation
  reports; state insurance statutes and policy wording.
