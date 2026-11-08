# Landscape and water-feature rules (USA)

Design reference for the landscape-designer suite. The machine-readable
register is **landrules.csv**; the suite's checks and the rules browser read the
same clause set. Values are model-code minimums for residential pools, spas,
fountains, ponds, waterfalls and water walls.

**This is a design aid, not a permit submission.** State amendments, local
zoning, the health department, the electrical AHJ and a licensed pool engineer
always govern.

Primary sources:

- **ISPSC 2021** — International Swimming Pool and Spa Code: Chapter 3
  (barriers, decks, depth, slopes), Chapter 4 (energy), Chapter 5 (water
  quality), Chapter 6 (spas), Chapter 7 (fountains and water features),
  Chapter 10 (suction entrapment).
- **IRC 2021 Appendix G** — pools and spas for one- and two-family dwellings
  (largely mirrors the ISPSC).
- **VGB Act** (15 U.S.C. 8001; CPSC 16 CFR 1450) — anti-entrapment covers, two
  suction outlets, SVRS.
- **NEC 2021 Article 680** — overhead conductors (680.8), motors (680.21),
  receptacles (680.22), luminaires (680.23), bonding (680.26).
- **ANSI/APSP/ICC-11** — water quality in pools and spas.
- **ADA 2010 Standards 242 / 1009** — accessible pool entry and route.
- **ASTM F1346** — safety covers.
- Local zoning for setbacks, impervious cover, floodplain and barrier
  equivalency.

## 1. Barrier and safety

| Rule id | Requirement | Suite field |
|---|---|---|
| `barrier-height` | **48 in / 1219 mm** minimum above grade on the outside; no opening passes a **4 in / 102 mm** sphere; not climbable (ISPSC 305.2) | `barrier`, `barrierHeight` |
| `barrier-gate` | Gate opens away from the water, self-closes and self-latches; release **54 in / 1372 mm** above grade (ISPSC 305.3) | `gateSelfClosing`, `gateLatchHeight` |
| `barrier-door` | Door with direct pool access: alarm or self-latch at **54 in**; operable window limited to 4 in or alarmed (ISPSC 305.4) | site notes |
| `barrier-cover` | Safety cover listed to **ASTM F1346**, 485 lb load; a secondary layer, never a substitute (ISPSC 305.5) | `safetyCover` |
| `spa-safety` | **104 °F / 40 °C** maximum, emergency shut-off within **5 ft**, signage, 15 min blower timer (ISPSC 307.4 / 609) | `waterTempF`, `emergencyShutoff`, `signage` |

## 2. Geometry and entry

| Rule id | Requirement | Suite field |
|---|---|---|
| `pool-depth` | Shallow end **3 ft / 914 mm** minimum; **8 ft / 2438 mm** maximum without an engineered design; diving envelope **7 ft 6 in – 9 ft** (ISPSC 306.2 / 304) | `shallow`, `deep`, `diving` |
| `pool-slope` | Shallow floor no steeper than **1:3**; transition **1:1** with a cove (ISPSC 306.3) | `shallow`, `deep`, `length` |
| `pool-entry` | Steps, ladder or sloped entry at the shallow end; **two entries** over 30 ft (ISPSC 306.4) | notes |
| `pool-deck` | Unobstructed deck **4 ft / 1.22 m** wide; slope **¼ in per foot** away from water and building (ISPSC 306.1; IRC R401.3) | `deck`, `deckSlopePercent` |
| `pool-coping` | Bullnose or eased coping, **1–2 in** overhang, slip resistant, bedded with an expansion joint | `deck` detail |

## 3. Circulation and filtration

| Rule id | Requirement | Suite field |
|---|---|---|
| `turnover` | Pool **6 h** (8 h maximum), spa **30 min**, fountain/feature **1 h** (ISPSC 326.2 / 327) | `turnoverHours` |
| `suction` | **Two** suction outlets at least **3 ft** apart, VGB-listed covers, SVRS or vent where duplication is impossible (ISPSC 310.2) | `suctionOutlets` |
| `suction` (velocity) | Cover face velocity not over **1.5 ft/s** (ISPSC 310.3) | `flowGpm`, outlets |
| `filtration` | Filter media rate: sand **15 gpm/sq ft**, DE **2**, cartridge **0.25**; pump from flow and TDH | `filterMedia`, `head` |
| `skimmers` | One skimmer per **400–500 sq ft** on the windward side, within **30–50 gpm** | `skimmers` |
| `bather-load` | **15 sq ft** per bather shallow, **20 sq ft** deep (ISPSC 421) | computed |
| `weir` | Q = **3.33 × L × H^1.5** cfs; lip level within **1/8 in**; 1–2 gpm per inch | `weirLength`, `weirHead` |
| `pond` | **24 in** minimum for fish, 45 mil EPDM or clay seal, aeration over 18 in, **1:3** banks | `deep`, `liner`, `aeration` |

## 4. Water quality

| Rule id | Requirement |
|---|---|
| `water-balance` | pH **7.2–7.8**; free chlorine **1–3 ppm** (spa 3–5); alkalinity **80–120 ppm**; CYA **30–50 ppm** (100 max); calcium **200–400 ppm** |
| `fountain-basin` | **6 in** of water over the intake; autofill and overflow; splash contained; pump sump accessible |
| `spa-water` | **104 °F** high limit, **30 min** turnover, two VGB outlets, marked emergency shut-off |

## 5. Electrical and bonding

| Rule id | Requirement | Suite field |
|---|---|---|
| `bonding` | **#8 AWG** copper equipotential bonding of shell, steel, coping, deck, fittings, pumps, rails, ladders and water; inspect before the deck pour (NEC 680.26) | `bonded` |
| `gfci` | GFCI for pump circuits, underwater luminaires, receptacles and 125–250 V pool equipment; disconnect within sight (NEC 680.21–680.23) | `gfci` |
| `overhead` | **25 ft** horizontal from the water edge up to 750 V; **27 ft** for 750 V–15 kV (NEC 680.8) | `overheadClearance` |
| `receptacles` | One receptacle within **20 ft**, at least **6 ft** from the water; GFCI and in-use cover (NEC 680.22) | `receptacleDistance` |
| `pool-luminaire` | Listed for pool use, 12 V or GFCI protected, bonded shell and niche, deck box at the required distance (NEC 680.23 / 680.24) | `luminairesListed` |

## 6. Siting, drainage and access

| Rule id | Requirement | Suite field |
|---|---|---|
| `setbacks` | Pool shell, deck and equipment clear of side/rear/front setbacks and utility easements; typical residential **5–10 ft** | `site.width`, `site.depth`, feature position |
| `drainage` | Deck about **2%** away from the water and building; deck drain or French drain; grade falling away (IRC R401.3) | `deckSlopePercent` |
| `freeze` | Drain and blow out lines, freeze sensor and low-temperature lockout, listed cover | `freezeClimate`, `winterized`, `safetyCover` |
| `equipment-access` | Level drained pad, **3 ft** clear in front of serviceable equipment, panel working clearance, disconnect in sight | `equipmentClearance` |
| `ada-entry` | Public pool: pool lift or sloped entry plus an accessible route; spa lift where the ADA applies (ADA 242 / 1009) | `publicPool`, `accessibleEntry` |
| `inspection` | Dimensioned plan, equipment schedule, barrier detail, bonding inspection and water-balance start-up sheet | exports |

## 7. Formulas

```
surface area   rectangle w×l · circular πr² · kidney 0.82×w×l
volume (m³)    area × average depth          (pool: mean of shallow and deep)
gallons        m³ × 264.172
turnover gpm   gallons ÷ (hours × 60)
pump hp        gpm × head(ft) ÷ (3960 × 0.65)
filter area    flow gpm ÷ media rate (15 / 2 / 0.25 gpm/sq ft)
weir gpm       3.33 × L(ft) × H(ft)^1.5 × 448.831
bather load    area ÷ 15 sq ft (shallow) or 20 sq ft (deep)
heater btu/h   gallons × 8.34 × ΔT ÷ hours
```

## 8. Suite workflow

1. Pick the water body (pool, spa, fountain, pond, waterfall, water wall) and
   shape, then set the water dimensions and depths.
2. Set the site size, drag the water body away from the property lines, and
   confirm the setback for the AHJ.
3. Set the deck width, deck slope, barrier and gate.
4. Choose the filter media, turnover and total dynamic head; the suite sizes the
   filter, skimmers, returns, heater and pump.
5. Confirm the electrical clearances, bonding and GFCI.
6. Review **Plan checks**; every error maps to a rule id in `landrules.csv`.
7. Export the equipment schedule and takeoff, then send the feature to the
   editor.
8. Have a licensed pool engineer and the local building department review the
   final drawing and calculations.

## 9. Start-up checklist

1. Barrier 48 in, 4 in sphere test, gate self-closing with a 54 in latch.
2. Deck 4 ft wide, 2% away, slip resistant, with a drain.
3. Water depth within 3–8 ft; diving pool engineered to the ISPSC envelope.
4. Turnover 6 h pool / 30 min spa / 1 h feature; filter and pump matched.
5. Two VGB suction outlets 3 ft apart; covers documented.
6. Spa at or below 104 °F with a shut-off and signage.
7. Bonding and GFCI complete; overhead lines 25 ft clear.
8. Setbacks, impervious cover, floodplain and barrier equivalency confirmed.
9. Water balanced on start-up: pH, chlorine, alkalinity, CYA, calcium.
10. Handover pack with schedules, cut sheets and the barrier test.

## 10. CSV register schema

`landrules.csv` columns:

`id, category, jurisdiction, code_ref, topic, title, level, requirement, min, max, unit, applies_to, severity, check_ids, source_url`

`check_ids` lists the plan-check ids the suite uses; `severity` is the default
level when the check fails (`error`, `warning`, `info`). Keep the ids unchanged
when a rule is amended so old projects still map.

## 11. Source links

- ISPSC 2021: https://codes.iccsafe.org/content/ISPSC2021P1
- ISPSC Chapter 3: https://codes.iccsafe.org/s/ISPSC2021P1/chapter-3-general-compliance
- IRC 2021 Appendix G: https://up.codes/s/swimming-pools-spas-and-hot-tubs
- NEC Article 680: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
- VGB Act / CPSC: https://www.cpsc.gov/Business--Manufacturing/Statutes-Rules-Regulations/Virginia-Graeme-Baker-Pool-and-Spa-Safety-Act
- ANSI/APSP/ICC-11 water quality: https://www.phta.org/standards-and-codes/
- ADA pool access: https://www.access-board.gov/ada/guides/chapter-10-recreation-facilities/
- ASTM F1346 safety covers: https://www.astm.org/f1346-91r18.html
- Weir flow reference: https://www.engineeringtoolbox.com/weirs-flow-rate-d_592.html
- EPA pond guide: https://www.epa.gov/sites/default/files/2015-11/documents/pondguide.pdf
