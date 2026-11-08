# How much can be added to the scene — feature budget against the current logic

Date: 2026-10-25 · Baseline: `items.js` + `metadata.js` + `world-space.js` + `ConversionEngine3D.js` +
`furnitureBuilders.js` + `wall-snap.js` / `elevation-snap.js` + `scene-drag` / `scene-gizmo` /
`scene-elevation` + `editor.js`, and the merged lab kit (`features/lab/kit.js`).

Short answer: **46 new scene features are supportable without changing the architecture**
(18 of them with no new module at all), **19 more need one new module or a small contract change**,
and **11 need the engine split / dirty-flag render** before they are worth building.

---

## 1. What the scene already guarantees

These are the seams every feature below can lean on:

| Contract | Where | Why it matters |
| --- | --- | --- |
| One unit system (metres, +y up, plan x/z) | `world-space.js` | Any new object is measurable and placeable with no conversion layer |
| Item model + factory + JSON | `items.js` (`Item → FloorItem / InWallItem`, `Wall`, `wallBox`) | New furniture types are data, not code |
| Metadata schema per type | `metadata.js` (`ITEM_METADATA`) | Dimensions, colour, `line`, `mountHeight`, `wireframe` are declarative |
| Builders behind a factory | `furnitureBuilders.js` (`FurnitureFactory`) | Geometry is swappable per type |
| Snap primitives | `wall-snap.js`, `elevation-snap.js` | Flush/butt/stack snapping already exists as pure functions |
| Elevation as item state | `items.js`, `ConversionEngine3D.js` | Lifted pieces survive save/load and render |
| One wall renderer | `items.js:wallBox()` | The 2D plan, the editor 3D scene and the React scene all draw the same wall |
| Opt-in scene abilities | `features/lab/kit.js` | Post FX, spring, instancing, pathfinding, DRACO model, scene export are already in the editor's main canvas |

## 2. Tier A — no new module needed (18 features)

Purely additive; each uses an existing contract and a UI hook.

1. Wall height per wall (store on `Wall`, read in `wallBox`).
2. Wall colour/texture per wall (extend `fixtureStyles` to walls by id).
3. Room labels at polygon centroid (`world-space.planToWorld`, sprite like measurements).
4. Dimension chains across a run (reuse `measurements.formatLength`).
5. Height annotations in elevation views (`scene-elevation` already frames the run).
6. Height readout while dragging in elevation (hooked to `createElevationDrag`).
7. Lifted-piece marker in the 2D plan (dashed outline above the footprint).
8. Snap guides (short lines drawn at the snapped edge, from `wall-snap.footprint`).
9. Per-item locked axes (store `locked: {x,z}`; `scene-drag` honours it).
10. Duplicate / clone selection (`ItemFactory.fromJSON(item.toJSON())` with new id).
11. Array/linear repeat (n copies at pitch, using `snapAlongAxis`).
12. Item flip (mirror rotation by π and swap width/depth offsets).
13. Grid size selector (the editor already has `gridSize`, only UI is missing).
14. Room area/volume readout (shoelace over `floorplan-graph`).
15. North arrow + scale bar on the plan canvas.
16. Per-item visibility toggle (`Item.visible` exists, nothing reads it).
17. "Show ceiling/roof" editor toggle (`showRoof`/`showCeiling` are already engine inputs).
18. Cut-list export (metadata width/height/depth + count per type).

## 3. Tier B — one new module or a small contract change (19 features)

| # | Feature | New/changed piece | Effort |
| --- | --- | --- | --- |
| 19 | Unified snapping (grid + wall + run + vertical) | `snapping.js` from the three existing implementations | M |
| 20 | Cabinet-to-cabinet depth alignment / inside corners | extend `elevation-snap` run rules to the plan plane | M |
| 21 | Collision/overlap detection | AABB from `wall-snap.footprint`, flag on drag | S |
| 22 | Wall-aware placement warnings (door in corner, window over counter) | rule list over `ITEM_METADATA` | M |
| 23 | Multiple openings per wall with cut validation | `ConversionEngine3D` CSG already subtracts; needs clamping | M |
| 24 | Cabinet base class with `defaultBottom/defaultTop` | `items.js` + builders read it (removes the elevation special case) | M |
| 25 | Item groups / assemblies (a run moves as one) | group id on items + drag fan-out | M |
| 26 | Copy/paste between stories | `StateManager` snapshot of the clipboard | S |
| 27 | Undo granularity for multi-step edits | `StateManager` batches (coalesce by tag) | S |
| 28 | Project schema versioning + migration | `StorageManager` + `restoreState` guard | S |
| 29 | Autosave throttling / dirty-only save | `storage.js` debounce + diff | S |
| 30 | Material library per line (Merlot/Shaker palettes) | `metadata.lines` + texture lookup | M |
| 31 | Annotated elevation dimension strings between pieces | `scene-elevation` + `measurements` | M |
| 32 | Section box / clipping plane view | one `THREE.Plane` on the engine's renderer | S |
| 33 | Item count / cost summary per room | cut-list aggregation | S |
| 34 | Live 3D preview while dragging (no rebuild) | engine `updateItemTransform`-style update in editor | M |
| 35 | WebXR / AR placement of a selected cabinet | `LabShakerAR` path, needs session + reticle | L |
| 36 | Pathfinding walkthrough (agent between cabinets) | already merged via `PathAgent`; needs target picking in the editor | S |
| 37 | Scene export from the editor (GLTF/GLB/OBJ) | merged `SceneExporter`, needs an editor button | S |

## 4. Tier C — needs the architecture work first (11 features)

These are all worth building, but each is blocked by one of the audit items: the 520-line engine god
class, full CSG rebuild on every edit, and `editor.js` being a global-function blob.

38. Per-room floor materials with independent textures (needs room meshes, not one slab).
39. Selective wall rebuild (dirty walls only) — needs `WallBuilder` split.
40. 60 fps drag in 3D — needs dirty-flag render instead of `convert()` per commit.
41. Multi-floor stacking with per-storey visibility and stair openings.
42. Persistent named projects with a browser list (storage currently keys by name only).
43. Collaborative presence / comments (needs a store outside `AppState`).
44. Parametric cabinet configurator (door style, drawer count) — needs builder config objects.
45. Manufacturing output (DXF/CSV nested parts) — needs the cabinet model, not just bounds.
46. Automated kitchen layout solver (NKBA clearances) — needs the item model + rules module.

## 5. What the scene gained in this pass

Already merged and live, so the numbers above exclude them:

- One view control for three editing modes: **2D plan · 3D orbit · Elevation** (elevation sides
  appear with the mode; keys 1/2/3 switch).
- Editing in every mode: item drag in 2D, translate/rotate plus a **vertical (Y) handle** in 3D
  that writes `Item.elevation`, and up/down + along-run drag in elevation.
- Wall editing in the plan: click a wall to select/highlight it, drag its endpoints to reshape,
  with the per-wall height in the inspector.
- Wall selection highlight, per-wall height, roof toggle, and item **hide / lock / duplicate**
  (all persisted in the item JSON, honoured by 2D, 3D, gizmo and elevation drag).
- Post-processing (Bloom / DoF / Vignette) on the **main** kitchen canvas.
- Spring-animated selection.
- GPU-instanced prop field sized to the room.
- Pathfinding agent walking to the selected cabinet.
- DRACO-loaded `shaker.glb` catalog item, fitted to its footprint, with the physics-lab shake and auto-rotate.
- GLTF / GLB / OBJ export of the **live** scene.
- All lab abilities wired into the editor's Abilities panel and Lab controls; the lab pages and
  React lab components are gone.
- One wall definition for every surface (`items.js: wallBox`), plus the Blueprint Studio host page
  (`app.html`, `app/js/main.js`).

## 6. Read this as a budget, not a promise

Tier A items are each roughly a day. Tier B is a day to three each, with snapping and the cabinet
base class being the two that unlock the most (they are referenced by six other features). Tier C is
not a feature list, it is the refactor list from `audit.md` §6 — until the engine is split and the
editor has state seams, every Tier C feature costs more than it should.

Total: **46 features today, 19 with one new module, 11 after the refactor.**
