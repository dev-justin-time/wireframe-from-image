# Framing suite — builder's reference and review guide

The framing suite frames wood stud walls the way a crew does: a stud layout at
16 in on center, king and jack studs around every opening, a header sized for
the span and the load above, cripples, blocking, a treated sole plate and a
double top plate. Every storey is framed independently, then stacked as a
platform for the next floor.

Two artefacts share one design model:

- **Framing suite** — `pages/framing-designer.html`: multi-storey plan, wall
  elevation, wall schedule, cut list, takeoff, code register and glossary.
- **Editor overlay** — the same engine draws the studs in the 3D editor scene,
  replacing the finished walls while the Framing switch is on.

The code register is in **framingrules.md** and **framingrules.csv**. This guide
explains the system, the defaults and the limits of the calculation.

---

## 1. What the suite draws

### Wall components

| Component | Where it goes | What the suite does |
|---|---|---|
| Common stud | Between the sole plate and the top plate | 2×4 or 2×6 at 12, 16 or 24 in on center, crowned the same way |
| Sole (bottom) plate | Under the studs | Pressure-treated, one layer, cut away at door openings |
| Top plate | Over the studs | Two layers, 1½ in each, continuous over openings |
| King stud | Full height each side of an opening | Cut to the stud length, nailed to the header and trimmer |
| Trimmer (jack) stud | Each side of the opening, under the header | Cut to the opening height; carries the header |
| Header | Over the opening, on the jacks | Two or three plies, sized in bending and L/360 deflection |
| Cripple stud | Above a header, below a window sill | Keeps the stud rhythm and carries the sheathing |
| Rough sill | Bottom of a window opening | Spans between the jacks, cripples below |
| Blocking | Between studs at mid-height | Solid 2× blocks on the stud line |
| Sheathing | Over the exterior face | 4 × 8 ft panels, 8d common at 6 in edge / 12 in field |

### Defaults

| Setting | Default | Why |
|---|---|---|
| Stud size | 2×4 | The common interior and one-storey exterior size |
| Stud spacing | 16 in on center | Residential wall default, aligns with sheet goods |
| Precut stud | 92½ in | With a 1½ in sole and two 1½ in top plates: a 97 in (8 ft 1 in) wall |
| Top plates | 2 | Laps corners and partitions, ties walls together |
| Bottom plate | Pressure-treated | Sits on concrete, slab or treated sill |
| Header plies | 2 in a 2×4 wall, 3 in a 2×6 wall | Fills the stud depth face to face |
| Sheathing | 7/16 in OSB | Rated braced-wall panel |
| Species / grade | Spruce-Pine-Fir #2 | The common North American framing grade |

Changing the precut length re-cuts every storey: 92⅝ in gives a 97⅛ in wall,
104⅝ in a 9 ft wall and 116⅝ in a 10 ft wall.

When the editor already has a plan framed at 96 in (the studio default), the
overlay cuts the stud to 91½ in so the plates meet the existing wall top. A
suite plan imported by **Send to editor** keeps its 97 in walls and its 92½ in
precut stud.

---

## 2. Multi-storey workflow

1. **Set the footprint.** Width and depth in feet, then **Rectangle** to build
   four exterior walls and a centre partition on the active storey.
2. **Draw or edit walls.** Drag on the plan in **Draw wall** mode; click a wall
   to select it and edit its name, exterior flag and openings. Endpoints snap to
   a 1 ft grid and to existing wall ends.
3. **Add storeys.** **Add storey** copies the wall layout upward; **Copy below**
   brings the walls from the storey underneath after they have been edited. Each
   storey has its own precut length and top-plate count.
4. **Check the stack.** The suite warns when an upper wall sits more than 1.2 m
   off any wall below. Line bearing walls up, or add a beam.
5. **Read the checks, schedule and cut list.** Every change updates the plan,
   the wall elevation, the schedule, the BOM and the price in the same frame.
6. **Send to editor.** The member choices and the suite plan go to the editor.
   If the editor has no plan of its own, the suite walls are imported as editor
   walls and openings; otherwise the editor's existing plan is framed with the
   suite's member choices.

Floors between storeys are sized as platform framing: joists across the short
direction, a double rim, glued and screwed subfloor, and a mid-span girder with
posts when a single sawn joist runs out. The girder is a planning member; the
posts still need a footing or a wall below.

---

## 3. Openings and headers

An opening is framed with two king studs (full height), two jack studs (cut to
the opening height), a header across the jacks and cripples above the header.
Windows also get a rough sill and cripples below it.

The header is checked twice:

- **Bending:** `M = wL² / 8`, `S = bd² / 6`, `Fb′ = Fb × 1.15`.
- **Deflection:** `Δ = 5wL⁴ / (384EI) ≤ L / 360` using live load only.

`w` is the load on the header per linear foot: 40 psf live and 10 psf dead for
each floor above, plus the wall above, times the tributary width. The default
tributary is the floor span under the header (12 ft), not the opening width.

A conservative prescriptive minimum sits underneath the calculation:

| Clear opening | Minimum header (2 plies) |
|---|---|
| Up to 3 ft | 2×6 |
| Up to 4 ft | 2×8 |
| Up to 6 ft | 2×10 |
| Up to 8 ft | 2×12 |
| Over 8 ft | Engineered LVL or designed beam |

The suite reports the governing case and the utilisation. A span that runs out
of sawn lumber is an error, not a silent substitution: specify an LVL with the
supplier's design, or get the header engineered.

**Rough opening:** unit width plus shim and flashing allowance, usually ½ to
1 in. The header bears at least 1½ in on each jack stud.

---

## 4. Floor platform and joist sizing

Floors use 40 psf live and 10 psf dead, with L/360 live deflection. The engine
computes the maximum span for each candidate joist from the section properties
of the dressed size and the species values, instead of copying a table for a
different species.

- At 16 in on center, 50 psf total gives `w = 66.7 lb/ft`.
- Bending span: `L = √(8Fb′S / w)`.
- Deflection span: `L = ∛(384EI / (5 × 360 × w_live))`.

When the short direction exceeds the largest sawn joist, the floor switches to a
mid-span girder: joists span wall to girder at half the distance, and the girder
is checked as a built-up beam carrying half the floor. Posts are counted, but
their footings are outside the suite.

## 4a. Framing calculators

The **Calculators** tab is a span-table desk built on the same engine values as
this suite. It covers the lumber-span calculators a framer reaches for on site:

| Group | Calculators |
|---|---|
| Span tables | Lumber span, custom-load span, 2×4 span, 2×6 span & quantity, floor joist, ceiling joist, roof, rafter |
| Beams | Wood beam, LVL span, LVL size, glulam size |
| Loads & quantities | 2×4 load, framing lumber & cost, ceiling joist count, floor truss planning |

Every calculator uses the same bending, shear and live-load deflection checks
as the suite: `M = wL²/8`, `Δ = 5wL⁴/(384EI) ≤ L/limit`, and a shear check on
`1.5V/A`. Inputs are size, species, grade, spacing and load case, so a result
matches the wall, floor and header checks elsewhere in the page. The rafter
calculator also reports the horizontal run and rise for the entered pitch. The
quantity calculators add piece counts, board feet, waste and planning cost.

Results are planning checks, not sealed designs. Engineered LVL and glulam use
generic section values; the supplier’s span table, grade and connection details
govern. Every result names its governing case and its code reference.

## 4b. Roof framing (adjacent suite)

This suite stops at the top plate. The **Roof suite** (`roof-designer.html`)
frames and costs the roof; the components below are the review vocabulary.

- **Trusses** are prefabricated triangulated units, delivered with an engineered
  drawing, set at 24 in on center and braced before loading.
- **Stick framing** sets a ridge board at the peak and pairs of rafters with a
  bird's mouth notch seated on the top plate.
- **Rafter ties or ceiling joists** run horizontally between opposing rafters to
  resist the outward thrust; collar ties higher up reduce the rafter span.
- **Purlins** support rafters or roof deck between the main supports; lookouts
  carry the eave overhang.
- **Roof sheathing** (5/8 or 3/4 in OSB/plywood) is nailed to the trusses or
  rafters with staggered joints, then drip edge, underlayment and the covering
  dry the structure in.
- **Top-plate tie:** every other truss or rafter is tied to the top plate with an
  approved connector, completing the uplift load path from roof to foundation.

---

## 5. Platform vs balloon framing

| | Platform (western) framing | Balloon framing |
|---|---|---|
| Studs | One storey high | Continuous from foundation to roof |
| Floors | Each floor is a platform the next wall sits on | Joists hang from the continuous studs |
| Fire safety | The platform is a natural fire stop | The cavity is a chimney; fire blocking is mandatory |
| Construction | Walls built flat and tilted up | Long studs, scaffolding, harder to raise |
| Lumber | Standard 8–16 ft lengths | Scarce, costly long studs |
| Shrinkage | More joints, slightly more movement | Fewer joints, less movement |
| Use today | Standard residential | Historic restoration and specialty tall walls |

The suite frames platform framing by default. Turning on **Balloon framing**
adds fire blocking at the floor line and reports the missing blocking as an error
if it is switched off.

---

## 6. Build sequence

1. **Verify the foundation and set out the plan.** Level, square, both diagonals,
   anchor bolt layout.
2. **Sill plate and floor platform.** Treated sill on a sill seal, anchored,
   rim joists, joists at 16 or 24 in, blocking, glued and screwed subfloor.
3. **Frame and raise the walls.** Sole plate, studs at 16 in, kings and jacks,
   headers, cripples, double top plate. Sheathe the exterior face, tip up,
   brace, nail down.
4. **Sheathe, brace and tie.** Complete the structural sheathing and water-
   resistive barrier, install hold-downs and lateral ties.
5. **Second-floor platform and repeat.** Joists on the top plates, rim and deck,
   then the wall sequence again. Check the diagonals at every level.
6. **Roof framing.** Trusses at 24 in on center, or stick rafters against a ridge
   board, then sheathe and dry in.
7. **Inspections and dry-in.** Framing, sheathing and anchor inspections before
   insulation; record the as-built dimensions.

---

## 7. Lumber grades and moisture

| Grade | Typical use | Fb | E |
|---|---|---|---|
| Select Structural | Heavy headers, exposed beams | 1,500–2,000 psi | 1.7–2.4 × 10⁶ psi |
| No. 1 | Joists, rafters, headers | 1,000–1,500 psi | 1.3–1.7 × 10⁶ psi |
| No. 2 | General framing (the workhorse) | 725–1,100 psi | 1.1–1.6 × 10⁶ psi |
| No. 3 / Utility | Blocking, plates, non-critical | 500–750 psi | 0.9–1.1 × 10⁶ psi |

Values vary by species and width: Douglas Fir-Larch #2 2×8–2×10 is Fb 900 psi,
E 1.6 × 10⁶ psi; SPF #2 is Fb 725 psi, E 1.1 × 10⁶ psi. The suite uses the
species table from the shared deck catalogue, so the same grade is priced and
checked the same way in every suite.

**Moisture.** NDS reference values assume sawn lumber at or below 19% moisture
content. Above that, wet-service factors apply (Fb 0.85, E 0.93, Fc⊥ 0.67).
Treated framing arrives wet, so stack it to drain, field-treat cuts and keep it
clear of grade. Treated lumber needs hot-dip galvanised or stainless fasteners.

**Temperature.** Below 100 °F no adjustment; sustained 100–150 °F reduces
strength; above 150 °F the loss can be permanent and structural use should be
avoided.

---

## 8. Code quick reference

| Topic | Reference | What it means here |
|---|---|---|
| Stud size, height, spacing | IRC Table R602.3(5) | Height limit for the size and spacing; over 12 ft needs engineering |
| Stud grade | IRC §R602.3.1 | No. 2 or better for bearing walls; utility grade restricted |
| Sole plate decay resistance | IRC §R317.1 | Treated plate on concrete or masonry |
| Top plates and splices | IRC §R602.3.2–3.3 | Double plate, joints offset 24 in |
| Headers | IRC §R602.7, Tables R602.7(1)–(3) | Sized for span and tributary load; engineered beyond sawn range |
| Rough openings | IRC §R602.6 | King, jack, header and cripples |
| Exterior sheathing | IRC §R703.1–2 | Rated panel and water-resistive barrier |
| Wall bracing | IRC §R602.10 | Braced wall lines, CS-WSP panels, hold-downs |
| Anchor bolts | IRC §R403.1.6 | ½ in, 7 in embed, 6 ft maximum, 12 in from ends |
| Floor joists | IRC §R502.3, Table R502.3(1) | 40 psf live, L/360 |
| Subfloor | IRC §R503.2 | Glued and screwed, joints staggered |
| Fire blocking | IRC §R302.11, §R602.8 | Floor line, ceiling line, penetrations |
| Fastening | IRC Table R602.3(1) | Two 16d per stud end, four per header end, 8d at 6/12 in |

The register in **framingrules.md** expands each row into a summary, a set of
requirements and the checks the suite runs. Local amendments and the authority
having jurisdiction always govern.

---

## 9. The editor overlay

Open the suite, design the frame and press **Send to editor**. The editor:

- stores the member choices from the suite (`framing-editor-draft`);
- imports the suite plan into an empty editor project (walls and openings);
- hides the finished wall meshes and adds the stud frame to the 3D scene;
- shows the same stud count, header size, sheathing sheets and price in the
  Framing panel.

Toggle **Framing** in the header or the sidebar to switch between the stud frame
and the finished walls. Turning it off restores the walls and removes every
framing mesh.

The overlay draws the wall frame: plates, studs, kings, jacks, headers,
cripples, sills and blocking. It does **not** draw sheathing, house wrap, roof
framing, or the floor joists in 3D; those are counted in the takeoff and drawn in
the suite.

---

## 10. Limits and review notes

- The frame is a **design aid**, not a sealed structural design. Engineered
  headers, tall walls, unusual loads, seismic details and multi-storey hold-down
  design need a licensed professional.
- Header and joist capacities use NDS reference values with a conservative
  duration factor and a simple tributary assumption. Confirm the tributary width
  and the load case for the actual plan.
- Bracing is reported as a planning estimate of the required braced length, not a
  full Table R602.10.3(1) takeoff by method, exposure and seismic category.
- The floor is framed from the plan's bounding rectangle. Irregular plans with
  wings, stair openings and cantilevers need a proper floor layout.
- The comparison prices are allowances in USD, not quotes. Replace them with the
  supplier's numbers before a bid.
- The editor imports the suite plan only when the editor project is empty, so an
  existing project is never overwritten.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| Stud | Vertical 2× member between the plates |
| Sole plate | Bottom horizontal member; treated over concrete |
| Top plate | Horizontal member over the studs, usually doubled |
| King stud | Full-height stud beside an opening |
| Jack / trimmer stud | Shorter stud that carries the header |
| Cripple stud | Short stud above a header or below a sill |
| Header | Built-up beam over an opening |
| Rough opening | Framed hole for a window or door, slightly larger than the unit |
| Rough sill | Horizontal member at the bottom of a window opening |
| Blocking | Short horizontal pieces between studs for nailing, bracing or fire stopping |
| Sheathing | Structural panel skin on the frame |
| House wrap | Water-resistive barrier over the sheathing |
| Hold-down | Metal tie resisting uplift and overturning at a wall end |
| Anchor bolt | Foundation bolt through the sill plate |
| Rim joist | Perimeter band joist that closes the floor platform |
| Girder | Beam carrying several joists |
| Bridging | Cross-bracing between joists to stop rolling |
| Rafter | Sloping roof member |
| Ridge board | Board at the roof peak; an alignment member, not a beam |
| Bird's mouth | Notch where a rafter sits on the top plate |
| Collar tie | Horizontal tie between opposing rafters |
| Purlin | Horizontal roof member supporting rafters or deck |
| Truss | Prefabricated triangulated roof or floor unit |
| Platform framing | One-storey studs on a floor deck at every level |
| Balloon framing | Continuous studs from foundation to roof |
| On center (OC) | Repeated spacing from the centre of one member to the next |
| Dry-in | Roof and walls keep the weather out; rough-ins can start |

---

## 12. Files

| File | Purpose |
|---|---|
| `features/framing/catalog.js` | Lumber, sheathing, fasteners, connectors, defaults |
| `features/framing/calculators.js` | 16 span, beam, load and quantity calculators |
| `features/framing/rules.js` | 30-rule code register, formulas, glossary, build sequence |
| `features/framing/engine.js` | Wall and floor framing, headers, takeoff, checks, CSVs |
| `features/framing/plan.js` | Plan and wall-elevation drawings |
| `features/framing/page.js` | Designer page controller |
| `features/framing/scene.js` | 3D editor overlay |
| `features/framing/panel.js` | Editor readout and bid lines |
| `pages/framing-designer.html` | Designer page |
| `framingrules.md`, `framingrules.csv` | Code register for review |
| `.check-framing.mjs` | Headless verification |

---

## 13. Reference sources

- **IRC 2021**, Chapter 6 (wood wall construction: §R602 studs, plates, headers,
  bracing, sheathing; §R302 fire blocking) and Chapter 5 (§R502 floor framing,
  §R503 subfloor), with §R301 loads, §R317 decay and §R403 anchorage.
- **AWC National Design Specification for Wood Construction (NDS)** and its
  Supplement: reference design values, adjustment factors (CD, CM, Ct) and the
  beam/column equations used here.
- **AWC Wood Frame Construction Manual (WFCM)** for prescriptive wall, floor and
  roof assemblies beyond the IRC tables.
- **APA – The Engineered Wood Association**, *Panel Guide* and wall-bracing
  literature for sheathing grades, nailing and CS-WSP panels.
- **IRC Table R602.3(5)** for stud height and spacing; **Tables R602.7(1)-(3)**
  for header and girder spans; **Table R602.10.3(1)** for braced wall length.
- Manufacturer’s installation instructions for connectors, hold-downs, LVL and
  treated lumber; the product listing governs over any generic table here.

The register summarises these documents for design review. It does not replace
the adopted code, the approved plans or a licensed engineer’s sealed design.
