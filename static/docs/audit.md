# Ability-continuity audit — every past ability, where it is now

Date: 2026-10-30 · Scope: the full git history (53 commits) against the working
tree. Method: top-level function inventories of `editor.js` / `app/js/main.js` /
`demo/demo.js` across five eras, `pages/Editor.html` control inventories
(`data-click`, `data-input`, `data-change`, `data-tool`, `id`) old vs new,
deleted-file review, draft-key review, and headless-Chrome probes (CDP) that
clicked the real controls and read back live state.

> **Verdict: no user-facing ability is missing.** Two renames, one harness
> staleness (fixed in this audit), and the rest is moves to new homes. The only
> items with no equivalent are dev-only dashboards and prototype scaffolding
> that was intentionally removed. Details per item below.

---

## 1. Floorplan viewing in the Editor — all present, all wired

Every viewing mode found in any past commit still works in `pages/Editor.html`
+ `editor/editor.js`, verified headlessly on 2026-10-30 (CDP: switched each
mode, read back canvas opacity, toggled walk, clicked palette headers):

| Ability (past) | Status now | Where it is now |
| --- | --- | --- |
| 2D plan canvas (draw/select/pan/grid/dimensions) | present | `editor/editor.js` `init2D`/`draw2D`/`drawGrid`; `AppState.showGrid2D`/`showDimensions` toggles wired |
| 3D orbit view | present | `init3D`/`update3D` + `setViewMode('3d')`; `data-view-mode="3d"` button |
| Elevation (front/side, one wall at a time) | present | `updateElevationCamera`, `elevation-btn` side buttons, `elevation-bar` |
| First-person walk (WASD + mouse look, wall clearance) | present | `togglePlanWalk` → `createWalkMode` (`features/studio/walk-mode.js`); `walk-btn`, `walk-hud`; probe: enter/exit both return true, no exceptions |
| 2D/3D toggle helper | present | `toggleView()` (`AppState.viewMode === '2d' ? '3d' : '2d'`) |
| Item palette category collapse | present | `data-click="toggleCategory"` → `window.toggleCategory` in `assets/page-scripts/Editor.js` (classic script, global on purpose); probe: `structure-items` hides/shows |
| All 54 page actions (`data-click`/`data-input`/`data-change`) | present | each resolves to a `window.*` handler; full table probed `ok`, zero dead |
| Background plan image underlay + scale | present | 32 `backgroundImage`/`backgroundScale` refs; upload modal + `setBgScale` |
| OCR words + symbols pinned at origins | present | `planOcr.*` actions → `features/ocr.js`, `features/ocr-symbols.js` |
| `centerPlan` reframe | present | `editor/editor.js:1912`, exposed on the kit |
| Room labels / item labels / dims / arcs / hatches | present | `abilitiesState()` lists 60+ toggles incl. `roomLabels`, `itemLabels`, `doorArcs`, `snapGuides`; `renderAbilityPanel` |
| Show labels + reset view (old React `ViewControls`) | present | labels = ability toggles above; reset = `centerPlan` + elevation reframe (`frameElevation`) |

`panorama` was never an Editor mode in any commit (it lives in `app.html` /
`demo.html` via `scene/SharedViewer.js`) — nothing to restore there.

## 2. Editor function renames (not losses)

Function inventories across `b06fe5c → af1d9b7 → 473d4e9 → ade096e →
51f7270 → 4ddd15b → now` (30 → 181 → 204 → 223 → 223 → 228 → 228
top-level functions; the file only ever grows). Between consecutive eras the
lost-function diff is empty except:

| Past function | Status now | Where it is now |
| --- | --- | --- |
| `selectItemAtPointer` (3D click → fixture select) | renamed + upgraded | `selectAtPointer` (`editor/editor.js:4744`) — same `pickItemId` raycast, plus wall picking via `pickWallIdAtPointer`, exposed to harnesses as `editorKit.selectAt` |
| `animate3D` (rAF loop, `controls.update` + render) | superseded | `createRenderLoop` (dirty-render, pixel-ratio aware, resize-safe); covered by `check-editor-wiring` render-loop assertions |

## 3. Editor.html controls — nothing removed

113 controls (`data-click/input/change/tool`, `id`) at `af1d9b7` vs 193 now;
the set-difference old-minus-new is exactly one entry: the inline
`id="tailwind-config"` Play-CDN stub, replaced by compiled
`assets/tailwind.css` (documented in the 2026-10-28 production audit, B3).
The `toggleCategory` scare during this audit was a false positive: the handler
was externalised to `assets/page-scripts/Editor.js` as an intentional global.

## 4. Panorama app (`app/js/main.js`) and demo (`demo/demo.js`) — intact

| Ability (past) | Status now | Where it is now |
| --- | --- | --- |
| Panorama viewer (drag look, 3D toggle) | present | `pages/app.html` + `scene/SharedViewer.js`; headless load clean |
| Mobile joystick (nipplejs UMD global) | present | `vendor/nipplejs/nipplejs.js` → `globalThis.nipplejs` (verified 200, 20 KB, `typeof window.nipplejs === 'object'` live; one probe misread was a stale CDP target, re-probed clean) |
| Pointer-lock first-person + WASD | present | `app/js/main.js` unchanged (37/37 functions identical); `demo.html` first-person button clicked headlessly with no errors |
| Demo plan seeding (farmhouse default) | present, extended | `shared/demo-plan.js` + `demo/demo.js` `seedFarmhouseDemo` |

## 5. Deleted files — ability map

| Deleted file(s) | Ability it carried | Where it is now |
| --- | --- | --- |
| `SceneAbilities.jsx` (`PostEffects`, `SpringCabinet`, `InstancedProps`, `PathAgent`) | bloom/DOF/vignette, spring selection, instancing, path agent | `features/lab/kit.js` (`LabPostProcessing`, spring selection, instance field) + walkthrough agent (`createWalkthrough`, feature 36); toggles in `abilitiesState()` (`bloom`, `depthOfField`, `vignette`, `springSelection`, `instanceField`) |
| `LabShakerAR.js`, `LabShaker3DViewer.js`, `LabShakerPhysics.js` | product-model AR / physics viewer | placeable `shaker` model (`core/metadata.js`, `/assets/shaker.glb` + `setLabScale/Shake/Instances`); generic XR in `features/advanced/xr.js` |
| `LabUpload.js`, `UploadFloorPlan.tsx`, `LabFloorPlanUpload` | plan-image upload → 3D | `engine/floorPlanProcessor.js` + Editor upload modal (`applyFloorplanEditorDraft`) + `demo-floorplan-upload.js` |
| `ViewControls.js` (labels toggle, reset view) | 2-button overlay | §1 row above |
| `ControlPanel.js`, `CustomizationPanel.tsx`, `Cutlist.js`, `KitchenScene.jsx`, `Scene.jsx`, `SceneLabPanel.jsx`, `FloorPlan3D.tsx`, `Cabinet.js`, `Lab*` demos | React/R3F prototype stack | intentionally retired in `03803b4`; equivalents are the vanilla suites (kitchen, cut-list via `features/cut-list.js` + `manufacturingPackage`, lab kit, WebGPU preview `pages/webgpu-demo.html`) |
| `pages/app-demo.html` (R3F kitchen prototype) | prototype only | `pages/kitchen-designer.html` + `features/kitchen/*` |
| `pages/helper.html` (was `SharedViewer.js` source) | panorama/3D viewer class | `scene/SharedViewer.js`, used by `pages/index.html` + `pages/demo.html` |
| `pages/labs.html` (FPS/memory/draw-call dashboard, react-root demos) | dev perf dashboard | no user-facing equivalent — dev-only loss, accepted; closest coverage is the `check-*` harness assertion counts + `renderLoop.stats` |
| `pages/Qwen_html_*.html`, `Qwen_*.js`, `testData.ts`, `TXT2.TXT`, `.tmp-studio-console.mjs`, `.server.log` | agent scratch / dup test data | scratch, accepted; canonical test data is `demo/test-data.js` |
| `App.jsx`, `page.tsx`, `pages/*` (upload flow copies) | Next.js prototype | retired with the React stack; no route ever served them |

## 6. Draft keys and the versioned envelope — no loss

`51f7270` moved suite↔studio handoff behind `core/drafts.js`, which
**accepts the old unversioned shapes**, so saves written by any past release
still load (`migrateProject` refuses only *newer*-than-app versions, which is
correct). No draft key was dropped; the registry only added the envelope.

## 7. Fixed by this audit — harness staleness (the one real regression)

`4ddd15b` added the correct multi-touch guard `if (e.isPrimary === false)
return` to wall drawing. Synthetic `PointerEvent`s default to
`isPrimary: false`, so three check harnesses silently lost the ability to
draw/select in their own tests: `check-editor-wiring` failed at the wall-draw
step (`walls()[0].id` threw). Real input was never affected. Restored by
adding `isPrimary: true, pointerId: 7` to all 19 synthetic dispatches:

- `scripts/check-editor-wiring.mjs` — **44/44 pass** after the fix (wall draw,
  3D pick, inspector, DXF/GeoJSON import, BIM, render loop, 3D fallback)
- `scripts/check-kitchen-page.mjs` — **29/29 pass**
- `scripts/browser-check.mjs` — same stale pattern corrected (full run: see
  `npm test`)

Editor logic intentionally untouched — the guard is correct.

## 8. Genuinely without an equivalent (accepted) — one since restored

1. ~~`pages/labs.html` live FPS/memory/draw-call dashboard — dev-only~~
   **Restored 2026-10-30** as a Perf HUD status chip: `perfHud` ability toggle
   (`scene/scene-abilities.js`, default on, `3D & export` group) driving
   `#perf-hud` in the Editor 3D view (`editor/editor.js` `refreshPerfHud` on a
   500 ms sampler + every view switch; fps from `renderLoop.stats`, draw
   calls/triangles from `renderer.info`, JS heap when available; hidden in 2D
   or when WebGL fails) and `#demo-perf-hud` in `demo.html`/`demo/demo.js`.
   Harness handle: `window.editorKit.perf()` returns the last reading.
2. R3F/drei-specific conveniences (`ContactShadows`, `useGLTF` hot-reload) —
   prototype scaffolding; the vanilla three.js scenes are the product.
3. Agent scratch files (`TXT2.TXT`, Qwen outputs) — not abilities.

## 9. Follow-ups (not blockers)

- `browser-check.mjs` is long; run it via `npm test` on CI rather than locally
  to confirm the `isPrimary` corrections there end to end.
- ~~Consider a `renderLoop.stats` line in the Editor status bar~~ Done: Perf
  HUD chip in the Editor 3D view + demo 3D view, toggleable, harness-readable.
- `https://errors.example.com/collect` is still a placeholder beacon
  (ERR_CONNECTION_REFUSED in headless logs); needs the §10.13 retention
  decision recorded in the production audit.

## 10. Editor viewport/buttons/live-sync/dark pass (2026-10-30)

- Wall click-drag was blocked on load: `#upload-modal` in `pages/Editor.html`
  missed the `hidden` class, so the popup overlay sat over the plan canvas and
  swallowed every pointer gesture. Now hidden until Import is pressed.
- `setStatus()` was called (invalid placement, presets) but never defined — a
  `ReferenceError` that broke the pointer-up path. Now a transient
  `#plan-status` toast in `editor/editor.js`.
- `showWelcomeToast` used an inline `onclick` (dead under CSP); now wired with
  `addEventListener`. `window.toggleCategory` is also defined in the module as
  a fallback if the classic page script is blocked.
- New: **Start New** (`data-click="startNewProject"` → blank plan, wall tool,
  2D) and **Master Scene** (`showMasterScene`: all storeys visible, every
  visual overlay on, 3D view; interaction-hijacking and hiding modes excluded).
- Live scene links: the Editor re-applies suite drafts on cross-tab `storage`
  events (deck/electrical/framing/kitchen/lighting/roof/wall) and refreshes
  the Systems panel; the electrical Layers tab repaints on the same events, so
  stacked layers follow other tabs without a reload.
- Dark mode for every page: `shared/site.js` defaults to dark (persisted as
  `fp-theme`), adds a ☀️/🌙 toggle to the Pages menu, and injects the new
  `shared/dark-mode.css` remap on pages without native `dark:` support.
  Plan canvases stay on a light sheet, like the Editor 2D view.
- Verification: `.demo-work/probe-editor-fix.mjs` **14/14** (modal hidden,
  canvas sized, click-drag draws a wall, zero dead `data-click/input/change`
  actions, 3D canvas live after view switch, master/start-new, zero uncaught
  errors, suite dark default + theme sheet); `check-editor-wiring` **44/44**.
- Untouched, as requested by the other side's in-flight work: `pages/calc.html`
  (their fix), deleted-asset entries in `git status`, and the placeholder error
  beacon above.
