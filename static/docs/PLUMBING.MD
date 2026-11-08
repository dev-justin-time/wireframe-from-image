# Plumbing suite · rough-in and finish

`plumbing-designer.html` is a two-part residential plumbing workspace. It starts
at the three service hookups — **water**, **sewer** and **gas** — and carries the
same plan through:

1. **Rough-in** — service sizes, supply and DWV routes, trap arms, stack vents,
   gas piping, water heater, cleanouts and the rough-in takeoff.
2. **Finish** — fixture schedule, finish grade, faucets, stops, traps, appliance
   trim, final checks and the finish takeoff.

The plan, the fixture schedule, the checks and both takeoffs read one model, so
moving a fixture or changing a hookup changes the pipe lengths, the sizes, the
cost and the rule status together.

> This is a metric design aid, not a permit drawing. The model code is the 2021
> IPC / IRC plumbing chapters and the 2021 IFGC, with US customary fixture units
> and planning prices. Local amendments, the utility's actual capacity and a
> licensed plumber always win.

---

## 1. What the suite asks about each hookup

### Water

| Input | Why it matters |
| --- | --- |
| Wall and distance along the wall | Sets the service entry and the route to the water heater and fixtures. |
| Static pressure (psi) | Drives residual pressure, PRV requirements and the expansion-tank check. |
| Meter size | The meter is a pressure loss and a capacity limit; a 3/4 in meter may not support a large simultaneous load. |
| Service pipe material | PEX, copper and PEX-AL-PEX have different internal diameters, costs and labour. |
| Backflow device | A dual check or RPZ protects the potable supply; a hose bib still needs its own vacuum breaker. |

### Sewer

| Input | Why it matters |
| --- | --- |
| Wall and distance along the wall | Sets the lateral entry and the building-drain route. |
| Invert (m below floor) | The drain must fall to the sewer; an invert that is too shallow is a hard error. |
| Lateral size | The building sewer may never be smaller than the building drain. |
| Slope (%) | 2% (1/4 in per ft) up to 2-1/2 in; 1% (1/8 in per ft) for 3–6 in under IPC Table 704.1. |
| DWV material | PVC, ABS and cast iron change the cost, labour and fitting allowance. |

### Gas

| Input | Why it matters |
| --- | --- |
| Wall and distance along the wall | Sets the meter location and the gas tree. |
| Pressure (in w.c.) | Residential natural gas is usually 7 in w.c.; a 2 psi system needs appliance regulators. |
| Gas type | Natural gas and propane have different heating values and capacity factors. |
| Meter capacity (CFH) | The connected load must fit the meter the utility will actually set. |
| Pipe material | Black steel and CSST have different costs, fittings, bonding and protection requirements. |

### Water heater

The water heater is equipment, not a fixture. Its type sets the fuel, gas input,
vent, first-hour rating and rough-in cost. The suite checks the T&P discharge, the
drain pan, thermal expansion on a closed system and the stored temperature.

---

## 2. Research steps before drawing pipe

1. **Walk the building.** Confirm which wall the water meter, sewer lateral and gas
   meter actually enter. Photograph the meter, the main shutoff, the sewer cleanout
   and the gas regulator.
2. **Measure the hookups.** Record the wall, the distance along the wall from a
   known corner, and the depth of the sewer invert below the floor. Do not assume
   the utility drawing is current.
3. **Ask the utility for capacity.** Water: meter size, static pressure and any
   utility-owned backflow device. Sewer: lateral size, invert and whether the
   connection is public sewer or septic. Gas: meter capacity, pressure and service
   size.
4. **Confirm the local code.** The suite cites the 2021 IPC, the residential
   plumbing chapters of the 2021 IRC, and the 2021 IFGC. Many jurisdictions amend
   the fixture-unit tables, the vent rules, the gas pressure and the water-heater
   requirements.
5. **Collect the appliance data.** Gas input BTU/h, minimum gas pressure, vent
   category, water-heater first-hour rating, fixture rough-in dimensions and the
   manufacturer's clearance for every appliance.
6. **Lay out the wet walls.** Put bathrooms, kitchen and laundry close to the
   stacks. A shorter drain run is cheaper and easier to vent than a long one.
7. **Set the fixture positions.** Use the template or drag each fixture. Keep the
   water closet 15 in from a side wall and 21 in clear in front; keep two wet-room
   fixtures at least 30 in centre to centre.
8. **Route the services.** Water and gas follow a tree from their hookups; drainage
   falls to the building drain and the sewer; each fixture group gets a stack vent.
9. **Size, then check.** Read the demand, DFU, gas CFH, residual pressure, slope,
   invert and trap-arm results. Fix errors before pricing.
10. **Price the two parts separately.** Rough-in and finish are separate contract
    parts with separate exclusions.
11. **Test and photograph.** Water-test the drain, pressure-test the supply and gas,
    photograph every wall before closure, and keep the records with the permit.

---

## 3. Model code and the rules the suite checks

### Service and water supply

- **IPC 2021 §604.3 and Appendix E** — water distribution design criteria and
  sizing. The suite sums water supply fixture units (WSFU), converts them to peak
  demand with a Hunter-style curve, then chooses a service that also keeps velocity
  at or below about 8 ft/s.
- **IPC 2021 §604.5** — minimum fixture supply size. The suite uses 1/2 in as the
  smallest modelled branch.
- **IPC 2021 §604.8 / §608.2** — pressure and protection. Above about 80 psi static,
  the plan warns for a pressure reducing valve; residual pressure below 8 psi at the
  worst fixture is an error.
- **IPC 2021 §608.1 / Table 608.1** — backflow protection. A hose bib needs a
  vacuum breaker; a dual check or RPZ is selected at the service.
- **IPC 2021 §607.3** — thermal expansion control where a check valve, PRV or
  backflow preventer closes the system.

### Drainage

- **IPC 2021 §702.1 / Table 710.1(1)** — building drain and sewer sizing from
  drainage fixture units (DFU). The suite uses conservative capacities: 2 in = 6 DFU,
  3 in = 42 DFU, 4 in = 160 DFU for a building drain.
- **IPC 2021 §704.1 / Table 704.1** — minimum slope. 2% up to 2-1/2 in; 1% for
  3–6 in.
- **IPC 2021 §708.1 / §708.3** — cleanouts at the base of stacks, at the sewer and
  at long horizontal runs.
- **IPC 2021 §1002.2** — trap-arm length. The suite measures each fixture to its
  group stack and compares the result with the fixture's limit: roughly 4 ft for
  1-1/2 in, 5 ft for 2 in and 6 ft for 3 in.
- **IPC 2021 §901.2 / §903 / §906** — venting and termination. One stack vent per
  fixture group is modelled; wet-vent fixture order still needs a plan review.

### Fixtures and clearances

- **IPC 2021 §405.3.1** — 15 in from the centre of a water closet, urinal, lavatory
  or bidet to a side wall.
- **IPC 2021 §405.3.2** — 21 in clear in front.
- **IPC 2021 §2902 / IRC P2705** — minimum fixtures for a dwelling: water closet,
  lavatory, kitchen sink and a bathtub or shower.
- **IPC 2021 §406** — automatic clothes washer standpipe, trap and vent.
- **IPC 2021 §413 / §414** — kitchen sink and dishwasher drain, air gap or high loop.
- **IPC 2021 §417** — shower and bathtub requirements.

### Water heaters

- **IPC 2021 §504.4** — relief valve and discharge piping.
- **IPC 2021 §504.6** — drain pan and drainage where leakage would cause damage.
- **IPC 2021 §607.3** — thermal expansion control.
- **IRC P2801 / P2803** — residential water-heater installation, relief and pan.
- **IPC 2021 §501.1 and manufacturer data** — first-hour rating and recovery, not
  just tank gallons.

### Fuel gas

- **IFGC 2021 §402.4 / Table 402.4** — pipe sizing on the total connected hourly
  load and the longest equivalent length. The suite derates the 10 ft table by the
  square root of the run length and checks the meter capacity.
- **IFGC 2021 §408.4** — sediment trap downstream of the appliance shutoff.
- **IFGC 2021 §409.1** — shutoff valve in the same room and within reach.
- **IFGC 2021 §411.1 / §411.3** — listed appliance connector, accessible and
  protected.
- **IFGC 2021 §304 / §503 / §504** — combustion air, venting and appliance
  clearances.
- **IFGC 2021 §402.2 / §410** — gas pressure and regulators.

### Testing

- **IPC 2021 §312** — rough-in inspection and tests: drainage water test, supply
  pressure test, gas pressure test, and the final inspection.
- **IPC 2021 §308 / §305** — support, protection from freezing and physical damage.
- **IFGC 2021 §407** — gas pipe support.

---

## 4. How the calculations work

### Water demand and service size

The catalogue assigns each fixture a cold and hot WSFU value. The suite sums:

```
total WSFU = Σ cold WSFU + Σ hot WSFU + 1 for the water heater
peak demand (gpm) = Hunter curve interpolated at total WSFU
```

The Hunter curve used here runs from 1 WSFU ≈ 1.0 gpm to 100 WSFU ≈ 15.5 gpm.
The service is selected from the smallest nominal size that:

1. carries the fixture-unit load in the service table, and
2. keeps velocity at or below 8 ft/s at peak demand.

Velocity:

```
v (ft/s) = 0.4085 × gpm ÷ internal diameter²
```

Friction uses a Hazen-Williams estimate:

```
psi = 4.52 × gpm^1.852 × length(ft) ÷ (C^1.852 × diameter^4.871)
```

with C = 150. Residual pressure at a fixture is:

```
static pressure
− 0.433 psi/ft × 1.2 m riser
− meter loss
− main friction over the service length
− branch friction along the tree
```

The planning target is 8 psi at the worst fixture. A short bath group may use a
1/2 in service on fixture units but be upsized to 3/4 in by velocity; the plan shows
the size it actually selected.

### Drainage and venting

Each fixture has a DFU value. The suite sums DFU by group and for the whole plan:

```
branch size = smallest DWV size carrying the group DFU (at least the fixture drain)
stack size  = smallest stack size carrying the group DFU (at least the branch)
main size   = smallest building-drain size carrying the total DFU
```

The building drain runs along the south inside wall to the sewer lateral. The
required invert is:

```
required invert = −(sewer main length × slope) − 0.30 m
```

If the entered invert is above that value the plan is a hard error. The trap-arm
check measures from each fixture to its group stack; the stack vent is sized with
the stack and counted through the roof.

### Fuel gas

```
CFH = BTU/h ÷ 1,030 (natural gas) or ÷ 2,516 (propane)
capacity(size, length) = 10 ft table capacity × √(10 / length_ft)
```

The 10 ft capacities used are 130, 280, 520, 1,100, 1,600 and 3,000 CFH for
1/2 through 2 in black steel. The tree is sized from the leaf loads back to the
meter; the meter capacity and the longest run are both checked. This is a planning
estimate — use the full IFGC table for a permit drawing.

### Costs

- Rough-in: hookup fees, water/DWV/gas pipe, fittings allowances, hangers,
  insulation, valves, cleanouts, vent flashing, water heater and equipment, fixture
  rough-in kits and rough labour at $95/h.
- Finish: fixtures at the selected grade, faucets and finish, supply stops, traps,
  appliance connectors, air gap, washing-machine trim and finish labour at $85/h.
- Premium grade multiplies the fixture base; faucet finish adds a trim allowance.

Prices are planning allowances, not quotes. Permits, utility fees, drywall repair,
appliance costs and access work are excluded.

---

## 5. Auto layout and editing

- The **whole house** template places the bathroom on the south-west wall, the
  kitchen on the north-east wall, the laundry on the south-east, the utility and
  water heater in the north-west, and the hose bib on the west wall.
- **Auto layout** re-runs that arrangement without changing the hookups.
- Drag a fixture to move it. Wall fixtures snap to the nearest wall and slide along
  it; a floor drain moves freely. Drag a **WATER**, **SEWER** or **GAS** marker to
  move the service entry.
- Add a fixture with the **Add** tool and click near a wall. Delete with the
  **Delete** tool, the inspector button or the Delete key.
- The **rough plan** shows cold, hot, DWV, vent and gas layers. The **finish plan**
  hides piping and shows fixture grade, tags and clearances.
- The plan auto-saves to `localStorage` under `plumbing-suite-plan`. **Reset**
  returns to the whole-house template.

---

## 6. Two-part scope

### Part 1 — rough-in

- Water service connection, meter set, backflow device, main shutoff.
- Water piping, fittings, hangers, insulation and branch rough-in.
- Building drain, branches, stacks, vents, cleanouts and roof flashing.
- Gas service, meter set, piping, sediment traps, shutoffs and support.
- Water heater, pan, expansion tank, relief piping and vent kit.
- Rough-in labour and pressure/water testing.

### Part 2 — finish

- Fixtures at the selected grade: water closets, lavatories, tubs, showers,
  sinks, laundry and utility fixtures.
- Faucets, spouts, shower trim and finish.
- Supply stops, escutcheons, traps and drain trim.
- Dishwasher air gap or high loop, washing-machine hoses/standpipe trim.
- Gas appliance connectors.
- Finish labour, final connections and final inspection.

---

## 7. Inspection checklist

- [ ] Confirm the water meter, sewer lateral and gas meter locations and capacities.
- [ ] Confirm the sewer invert and the building-drain fall.
- [ ] Water-test the drainage system at the required head or air pressure.
- [ ] Pressure-test the water supply with fixtures isolated.
- [ ] Pressure-test the gas piping with appliance valves closed.
- [ ] Verify every trap has a vent and every trap arm is within its limit.
- [ ] Verify cleanouts are accessible and the correct size.
- [ ] Verify fixture clearances, door swings and water-heater access.
- [ ] Verify the T&P discharge, drain pan, expansion tank and combustion air.
- [ ] Verify sediment traps, shutoffs and appliance connectors.
- [ ] Photograph every wall before closure.
- [ ] Keep the test records and the approved plan on site.

---

## 8. Limits of the model

- One storey, one pressure zone and one building drain are modelled.
- Wet venting is represented by a stack vent per fixture group; the fixture order
  and the wet-vent size still need a plan review.
- Gas sizing is a square-root derating of a 10 ft table, not the full IFGC table.
- The sewer invert is a single input; the model does not know the actual utility
  invert, crown or lateral condition.
- The water heater is sized by type and first-hour rating; no hourly draw profile is
  simulated.
- Clearance checks are rectangular planning envelopes, not a manufacturer's
  rough-in drawing.
- Prices and labour rates are planning allowances, not quotes.
- Local amendments can change every number. Confirm before permitting.
