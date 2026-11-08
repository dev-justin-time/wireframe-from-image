# Electrical rules (USA)

Design reference for the **electrical-designer** suite. The machine-readable
register is **elecrules.csv**; the plan checks and the rules browser read the
same clause set, and every check id maps back to a rule id.

**This is a design aid, not a stamped drawing.** Local amendments, the utility,
and the electrical inspector always govern.

Primary sources:

- **NEC 2021 Article 210** — branch circuits, receptacle spacing, GFCI, AFCI.
- **NEC 2021 Article 220** — branch-circuit, feeder and service calculations.
- **NEC 2021 Article 230** — services, disconnects, service conductors.
- **NEC 2021 Article 250** — grounding, bonding, GEC and EGC.
- **NEC 2021 Article 310** — conductor ampacities; Table 310.16 and 310.15(C)(1).
- **NEC 2021 Article 314** — outlet, device and junction box fill.
- **NEC 2021 Chapter 9** — raceway and conductor areas, fill percentages.
- **NEC 2021 Articles 430, 625, 680** — motors, EV charging, pools and spas.

## 1. Load calculation

| Rule id | Requirement | Suite field |
|---|---|---|
| `demand-standard` | 3 VA/sq ft lighting, 1,500 VA per small-appliance and laundry circuit, 220.42 tiers (100/35/25%), 220.53 75% appliance factor, 220.60 larger of heat/cool (Art. 220) | `areaM2`, `sabc`, `laundry`, `appliances` |
| `demand-optional` | Dwelling optional method: 100% of the first 10 kVA + 40% of the rest, plus 220.82(C) loads (220.82) | `method` |

## 2. Service and panel

| Rule id | Requirement | Suite field |
|---|---|---|
| `service-size` | Service carries the calculated load; dwelling minimum **100 A** (230.42, 230.79) | computed |
| `service-disconnect` | Disconnect at the point of entry, marked, max six in one enclosure (230.70, 230.71) | `serviceType` |
| `panel-spaces` | A directory for every circuit and enough spaces for the breakers plus spares (408.4, 408.54) | `panel` |
| `working-clearance` | **30 in × 36 in × 6 ft 6 in** clear in front of the panel (110.26) | site note |

## 3. Conductors and raceways

| Rule id | Requirement | Suite field |
|---|---|---|
| `conductor-ampacity` | Table 310.16 for the termination temperature; **NM-B limited to 60 °C** (310.16, 334.80) | `conductor` |
| `ambient-adjustment` | Ambient correction and **80/70/50%** for 4–6 / 7–9 / 10–20 current-carrying conductors (310.15) | `ambientC`, `currentCarrying` |
| `conduit-fill` | **40%** fill for three or more conductors (Chapter 9 Table 1) | `feederLengthM`, computed |
| `box-fill` | **2.0 / 2.25 / 2.5 in³** per 14/12/10 AWG, plus two per device and one for grounds (314.16) | computed |
| `voltage-drop` | **3%** branch, **5%** feeder plus branch at load (informational 210.19, 215.2) | `feederLengthM`, `branchLengthM` |

## 4. Branch circuits

| Rule id | Requirement | Suite field |
|---|---|---|
| `sabc` | Two **20 A** kitchen small-appliance circuits, nothing else on them (210.11(C)(1)) | `sabc` |
| `laundry-bath` | Dedicated 20 A laundry circuit; bathroom-only 20 A circuit (210.11(C)(2), (C)(3)) | `laundry`, `bathroom` |
| `lighting-outlets` | Switched lighting in habitable rooms, halls, stairs, garage and entrances (210.70) | `areaM2` |
| `receptacle-spacing` | Every wall point within **6 ft** of a receptacle; kitchen counter within **24 in** (210.52) | drawing note |
| `outdoor-receptacle` | One outdoor receptacle at grade, GFCI, in-use cover (210.64) | `outdoorReceptacle` |

## 5. Protection

| Rule id | Requirement | Suite field |
|---|---|---|
| `gfci` | GFCI in bathrooms, kitchens, laundry, outdoors, garages, basements, within 6 ft of sinks (210.8) | per circuit |
| `afci` | AFCI in dwelling living areas, bedrooms, halls, closets, kitchens, laundry (210.12) | `afci` |

## 6. Grounding and bonding

| Rule id | Requirement | Suite field |
|---|---|---|
| `grounding-electrode` | All available electrodes bonded; a rod needs **25 Ω or a second rod** (250.50, 250.53) | `groundingElectrodes` |
| `equipment-grounding` | EGC from Table 250.122 by breaker: **14 / 12 / 10 / 8 / 6 / 4 / 3** AWG for 15 / 20 / 60 / 100 / 200 / 300 / 400 A | computed |
| `neutral` | Maximum unbalanced load, **100% to 200 A + 70% above** (220.61) | computed |

## 7. Special loads

| Rule id | Requirement | Suite field |
|---|---|---|
| `range-dryer` | Range from Table 220.55; dryer **5,000 VA** minimum (220.54, 220.55) | `appliances.range`, `appliances.dryer` |
| `motors` | **125%** of the largest motor on the feeder; Table 430.52 branch protection (430.24, 430.52) | `appliances.pool`, `appliances.wellPump` |
| `ev-charging` | **125%** of the continuous charger current, GFCI, in the service calculation (625.41, 625.42) | `appliances.ev` |
| `pool-equipment` | GFCI pump circuit, disconnect in sight, Article 680 bonding (680.21, 680.26) | `appliances.pool` |
| `subpanel` | One feeder per detached building, disconnect and ground bar at the remote panel (225.30, 250.32) | `appliances` |

## 8. Formulas the suite runs

```
lighting VA      3 VA/sq ft × area              (33 VA/m²)
general demand   3 kVA + 35% of the next 117 kVA + 25% above
appliance demand 75% of four or more loads       (220.53)
service amps     total VA ÷ 240
optional method  10 kVA + 40% of the remainder   (220.82)
neutral          100% to 200 A + 70% above       (220.61)
voltage drop     2 × L × I × R ÷ 1000            (R ohms per 1,000 ft)
conduit fill     Σ conductor area ÷ raceway area ≤ 0.40
box fill         Σ allowances ≤ box volume
```

## 9. Suite workflow

1. Set the floor area, small-appliance count and bathroom circuits.
2. Enter the appliance loads; leave a load at zero to take it out.
3. Choose the calculation method and compare standard against optional.
4. Check the service, main breaker and conductor the suite selects.
5. Confirm the panel spaces, neutral, GEC and EGC.
6. Review the panel schedule, the GFCI/AFCI list and the voltage drop.
7. Export the schedule, the load calculation and the takeoff.
8. Send the design to the editor and have the service reviewed before the permit.

## 10. Inspection checklist

1. Load calculation states the method and the connected loads.
2. Service and main breaker ratings match the calculation.
3. Service conductors sized from Table 310.16 with the 60 °C rule for NM-B.
4. Grounding electrode system bonded, two rods or a 25 Ω test.
5. Neutral and ground separated after the service.
6. Two small-appliance circuits, one laundry and a bathroom circuit.
7. GFCI and AFCI circuits listed at the panel.
8. Working space clear in front of the panel.
9. Box fill and raceway fill within the code allowances.
10. Panel directory filled in before the final inspection.

## 11. CSV register schema

`elecrules.csv` columns:

`id, category, jurisdiction, code_ref, topic, title, level, requirement, min, max, unit, applies_to, severity, check_ids, source_url`

`check_ids` lists the plan-check ids the suite emits for the rule; `severity` is
the default level when a check fails (`error`, `warning`, `info`). Keep the ids
unchanged when a rule is amended so saved projects still map.

## 12. Source links

- NFPA 70 (NEC) 2021: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
- NEC Article 220 calculations: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
- NEC Article 250 grounding: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
- NEC Chapter 9 tables: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
- NFPA 70 free access: https://www.nfpa.org/codes-and-standards/free-access
- UL 67 panelboards: https://www.ul.com/
- EV charging (Article 625): https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
