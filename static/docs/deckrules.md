# Deck and framing rules (USA)

Design reference for the **deck-designer** suite. The machine-readable register
is **deckrules.csv**; the suite's plan checks and the rules browser read the same
clause set, and every check id maps back to a rule id.

**This is a design aid, not a sealed plan.** Local amendments, the authority
having jurisdiction, a soils report and a licensed engineer always govern.

Primary sources:

- **IRC 2021 §R507** — decks: footings, posts, beams, joists, ledgers, decking.
- **IRC 2021 §R312** — guards and guard openings.
- **IRC 2021 §R311.7** — stairways, treads, risers, handrails, headroom.
- **IRC 2021 §R401.4 / §R403.1** — soil bearing and footing size.
- **IRC 2021 §R301 / Table R301.5** — 40 psf live load for decks.
- **IRC 2021 §R317 / AWPA U1** — decay protection and ground-contact treatment.
- **AWC NDS** — reference design values, load duration, column stability.

## 1. Footings and soil

| Rule id | Requirement | Suite field |
|---|---|---|
| `footing-depth` | Bearing below the frost depth and at least **12 in** below undisturbed grade (R403.1.4) | `frost` |
| `footing-size` | Minimum **12 in** diameter, area = post load ÷ allowable soil bearing (R403.1.1) | `footingDiameterIn` |
| `soil-bearing` | **2,000 psf** assumed default; **1,500 psf** clay, **3,000 psf** compact sand or gravel (R401.4.1) | `soil` |

## 2. Posts, beams and joists

| Rule id | Requirement | Suite field |
|---|---|---|
| `joist-span` | Joist span from bending and L/360 live, L/240 total deflection at 40 psf live + 10 psf dead; cantilever ≤ ¼ of the back span (R507.5) | `joistSize`, `joistSpacingIn`, `species`, `cantileverM` |
| `joist-spacing` | Spacing within the decking's listed span: 16 in for 5/4 boards, 24 in for 2x6, closer for diagonal layouts (R507.10) | `joistSpacingIn`, `decking`, `pattern` |
| `beam-span` | Beam carries 50 psf × half the joist span; span is the post spacing (R507.6) | `beamSize`, `beamPlies`, `postSpacingM` |
| `deck-post` | 6x6 practical minimum under a beam, checked axially with the NDS column formula; 14 ft prescriptive height limit (R507.4) | `postSize`, `height` |
| `post-connection` | Standoff post base into the footing, beam connected to the post, end grain above concrete (R507.3) | post count, base and cap rows |

**Design values used** (NDS reference, psi): SPF #2 Fb 875 / Fc 1,150 / E 1.4 M;
Southern Pine #2 Fb 1,200 / Fc 1,575 / E 1.6 M; Douglas Fir-Larch #2 Fb 900 /
Fc 1,700 / E 1.7 M; Hem-Fir #2 Fb 850 / Fc 1,300 / E 1.3 M; WRC #2 Fb 750 /
Fc 850 / E 1.1 M. Incised treated lumber takes the 0.80 Fb and 0.90 E incising
factors. `CD = 1.0` for deck dead + live.

## 3. Ledger and attachment

| Rule id | Requirement | Suite field |
|---|---|---|
| `ledger-attachment` | Two staggered rows of **1/2 in** lag screws or bolts at the table spacing; check the band joist first (R507.9.1.3) | `ledger` |
| `ledger-flashing` | Z-flashing over, bottom flashing or spacer, joist tape on the top edge (R507.9.1.6) | takeoff rows |
| `lateral-restraint` | At least **two** tension ties, or a designed frame, so the deck cannot pull off the house (R507.9.2) | `ledger` |

## 4. Decking

| Rule id | Requirement | Suite field |
|---|---|---|
| `decking-span` | Board span within the listing; 5/4 boards 16 in, 2x6 24 in, composite often 16 in (R507.10) | `decking`, `joistSpacingIn` |
| `decking-gap` | **1/8–1/4 in** between boards, plus end gaps for composite and PVC | `decking`, `pattern` |
| `decking-fastener` | Two fasteners per joist, stainless or coated, hidden clip where listed (R317.3) | `decking` |

## 5. Guards

| Rule id | Requirement | Suite field |
|---|---|---|
| `guard-required` | Guard on every open side when the deck is more than **30 in** above grade (R312.1.1) | `height`, `guard` |
| `guard-height` | **36 in** minimum, designed for **200 lb** concentrated load (R312.1.2) | `guardHeightIn` |
| `guard-opening` | No opening passes a **4 in sphere**; stair triangle limited to **6 in** (R312.1.3) | `guard` system infill |
| `guard-post` | Posts about **6 ft** maximum on center, through-bolted with blocking behind (R312.1.2) | `guard` system |

## 6. Stairs and handrails

| Rule id | Requirement | Suite field |
|---|---|---|
| `stair-riser` | Riser **≤ 7¾ in (196 mm)**, all risers within **3/8 in** (R311.7.5) | `height`, `stairs` |
| `stair-tread` | Tread **≥ 10 in (254 mm)**, nosing ¾–1¼ in (R311.7.5.2) | tread depth |
| `stair-width` | **36 in** clear width and **6 ft 8 in** headroom, landing at the foot (R311.7.1, R311.7.2) | `stairWidthM` |
| `stair-handrail` | **34–38 in** above the nosing, graspable, 1½ in clear, for four or more risers (R311.7.8) | riser count |
| `stair-stringer` | 2x12 stringers at 16–36 in on center, bearing at both ends (R311.7) | `stairWidthM`, run |

## 7. Siting, decay and drainage

| Rule id | Requirement | Suite field |
|---|---|---|
| `decay-protection` | Ground-contact treatment, field-treated cuts, galvanised or stainless connectors (R317.1, AWPA U1) | takeoff rows |
| `deck-drainage` | Grade falls away from the house; boards drain through the gaps (R401.3) | `height`, site notes |
| `ventilation` | **18 in** clear under the joists, or a ventilated skirt | `height` |
| `setback` | Side, rear and front setbacks, easements, lot coverage (local zoning) | site notes |
| `inspection` | Framing plan, footing schedule, ledger detail, guard and stair details, connector listing | exports |

## 8. Formulas the suite runs

```
joist load      w = 50 psf × spacing (ft)            lb/ft
bending span    L = √(8 Fb S / w)                    S = b d²/6
deflection      L = (384 E I / (5 w × limit))^(1/3)  I = b d³/12
beam load       w = 50 psf × joist span / 2          lb/ft
post load       P = 50 psf × post spacing × joist span / 2
column          P = Fc* A Cp,  FcE = 0.822 E / (le/d)²
footing area    A = P ÷ soil bearing                 minimum 12 in round
stairs          risers = ⌈height ÷ 7.75 in⌉, treads = risers − 1
stringer        √(rise² + run²) plus bearing cuts
concrete        1 bag (80 lb) ≈ 0.6 cu ft ≈ 0.017 m³
```

## 9. Suite workflow

1. Set the deck shape, size and height above grade.
2. Pick the fixed edge: house ledger or freestanding frame.
3. Choose the species, joist size and spacing; watch the joist-span check.
4. Size the beam and post spacing together — the beam span is the post spacing.
5. Set the footing diameter, frost depth and soil bearing.
6. Choose the decking and layout; the joist spacing limit follows the board.
7. Add the guard and the stair; check the 4 in sphere and the riser height.
8. Review **Plan checks**, then export the framing schedule, cut list and takeoff.
9. Send the deck to the editor and have the plan reviewed before building.

## 10. Inspection and handover checklist

1. Footings below frost, pads sized for the post load, soil assumption recorded.
2. Posts stand on bases with end grain clear of concrete; beam capped or notched.
3. Ledger fastened with two staggered rows, flashed, taped, and the band joist verified.
4. Two tension ties, or a braced freestanding frame.
5. Joists crowned, hangers sized to the member, blocking at bearings and board ends.
6. Guard at 36 in, 4 in sphere test, posts at 6 ft with blocking, 200 lb check.
7. Stairs: riser ≤ 196 mm, tread ≥ 254 mm, 36 in wide, handrail 34–38 in.
8. Decking gap and fastener pattern per the board listing.
9. Grade falls away, framing ventilated, cut ends field-treated.
10. Takeoff, cut list and schedule handed over with the permit drawings.

## 11. CSV register schema

`deckrules.csv` columns:

`id, category, jurisdiction, code_ref, topic, title, level, requirement, min, max, unit, applies_to, severity, check_ids, source_url`

`check_ids` lists the plan-check ids the suite emits for the rule; `severity` is
the default level when a check fails (`error`, `warning`, `info`). Keep the ids
unchanged when a rule is amended so saved projects still map.

## 12. Source links

- IRC 2021 decks (§R507): https://up.codes/s/decks
- IRC 2021 guards (§R312): https://up.codes/s/guards
- IRC 2021 stairways (§R311.7): https://up.codes/s/stairways
- IRC 2021 footings (§R403): https://up.codes/s/footings
- AWC NDS: https://awc.org/codes-standards/publications/nds-2018
- AWPA U1 use categories: https://awpa.com/standards/u1
- Deck ledger and lateral load guidance: https://www.woodworks.org/
- AWC deck construction guide: https://awc.org/publications/dca6-deck-construction-guide/
