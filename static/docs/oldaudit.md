# Production-release audit — Shaker 3D floor plan

Date: 2026-10-28 (final pass) · Scope: the whole tracked tree (192 JS modules plus 21
scripts, 28 pages plus the root redirect, 17 docs) and the 29 routes they serve. Method:
`npm test` was run end to end — all 21 scripts, the 29-route sweep, both page sweeps — plus
targeted browser probes for the error reporting, the failed-save notice and the corrected
lighting rule.

> **Verdict: the six release blockers are closed; this build is ready to deploy.** Every
> gate below is green: **1,757 assertions pass / 0 fail**, 29/29 pages load with no console
> error and no missing asset, and the site makes **zero third-party runtime requests**.
> The accessibility, metadata, clearance and support-matrix items from §3 are now closed too;
> what remains there is payload size and the CSP, neither a release blocker.

---

## 1. Release gate status

| Gate | Measured 2026-10-28 | Status |
| --- | --- | --- |
| Scripts with assertions (17 `check-*` + `browser-check`) | **1,757 pass / 0 fail** | pass |
| Page sweep (29 routes) | **29/29 clean** — no console errors, no failed local asset | pass |
| Local links and module specifiers | every local `href`/`src`/`url()` and every module specifier resolves | pass |
| Runtime dependencies | none external: three.js, CSG, pathfinding helper, joystick, Tailwind, fonts and hero images are all local | pass |
| Error reporting | `shared/error-reporting.js` on 28 pages; save failures surface in the editor | pass |
| Licence | `LICENSE` (proprietary, all rights reserved) + `"license": "UNLICENSED"` | pass |
| Automated gate | `npm test` runs all 21 scripts; `.github/workflows/checks.yml` runs it on every push | pass |
| Deploy config | `_headers` declares the four security headers and the cache policy, is checked by `check-pages`, and keeps the CSP commented until 10.4 | pass |
| SEO metadata | 28 pages carry a unique description, an absolute `canonical` and `og:url`; `sitemap.xml` and `robots.txt` share one declared origin, enforced by `check-pages` | pass (§10.2 closed) |
| Data durability | debounced autosave, flush on `beforeunload` + `pagehide`, visible failure notice with Export | pass (local-only by design) |
| Accessibility | `lang` on every page; `aria-pressed` on the view and elevation toggles; labels on icon-only controls; a `aria-live` text summary of the plan behind the canvases; no inline handler left on any page | pass (§3.1 closed, issue 10.4 phase 1) |
| Responsive/mobile | support matrix stated on `features.html`; editor is desktop-first by design | pass (§3.5 closed) |

Counts re-derived: every tracked module is reachable from a page — the six system barrels
(`features/{bid,bim,deck,electrical,framing,wall}/index.js`) are now imported by
`features/systems.js`, which builds the studio's Systems panel, and `features/import/{dxf,geo}.js`
are imported by the editor's upload modal; 29 routes = 28 pages plus the root redirect;
21 scripts = 17 `check-*` harnesses + `browser-check` (206 assertions) + the link/console
sweep (`check-pages`) + the legacy page sweep (`browser-pages`) + 1 repricing script.

## 2. Blockers — all closed

| # | Blocker (2026-10-28 audit) | Fix | Evidence |
| --- | --- | --- | --- |
| B1 | 12 finish textures referenced, none on disk; 4 404s on 3 routes; silent flat-colour fallback | `scripts/generate-textures.mjs` writes 12 seamless 512² PNGs to `textures/`; `core/metadata.js` and the finishes presets point at them | `check-pages` 29/29 clean; `check-studio` 86/86 with the new URLs |
| B2 | Title 24 dimming tested per fitting (9 × 14 W = no warning); stale `CODE_SCOPE` assertion | rule now sums the **controlled load per switch** (`features/lighting/engine.js`), exemption applied to the load; assertion updated to the California codes | `check-lighting` **123/123**; probe: nine 14 W on one plain switch → “Controlled loads: 126 W” warning |
| B3 | every page loaded three.js from esm.sh, Tailwind from the Play CDN, fonts and hero images from Google; npm deps unused | `scripts/vendor-deps.mjs` copies the 258-file addon closure + three/CSG/bvh/nipplejs; Tailwind compiled to `assets/tailwind.css`; `scripts/vendor-fonts.mjs` self-hosts 11 font files; hero images downloaded into `assets/images/` | 0 external URLs left in `pages/*.html`; 0 remote module imports; 29/29 pages clean |
| B4 | no error reporting; failed `localStorage` write only logged to console | `shared/error-reporting.js` (classic script, 28 pages) captures errors, rejections and resource failures into a sessionStorage ring buffer with an optional `error-endpoint` meta; the editor shows a “Project not saved / Export” notice and reports it | probe: uncaught throw → logged + notice; forced `QuotaExceededError` → save notice + `save: Could not save the project to local storage` |
| B5 | no licence | `LICENSE` with a proprietary all-rights-reserved notice plus a design-aid disclaimer; `package.json` `"license": "UNLICENSED"` | files committed |
| B6 | nothing enforced the checks; two failures survived two commits | `scripts/run-checks.mjs` runs all 21 scripts, starts the server the sweeps need, skips browser checks when no Chrome is installed, and exits non-zero on any failure; `npm test`; CI runs build/vendor/texture drift checks, then the suite | `npm test`: **21 checks passed, 0 failed, 0 skipped** |

### Notes on the fixes

- **Textures are generated, not photographed.** They are tileable pattern textures (marble,
  wood planks, ceramic grid, concrete, stone courses, carpet, paint) at design-aid quality —
  no 404s, and the finishes are visibly different. Replacing them with photographed
  materials is a content task, not a code change.
- **The lighting rule now reports the load it measured**, e.g. “9 luminaire(s) have no
  dimmer… Controlled loads: 126 W”, so a failed inspection is explainable.
- **Third-party code is vendored, not bundled.** Import maps resolve `three`,
  `three/addons/`, `three/nodes`, `three-bvh-csg`, `three-mesh-bvh` to `vendor/`; the legacy
  `app.html` loads the UMD nipplejs build as a classic script. A static deploy needs no
  `npm install`, and `scripts/vendor-deps.mjs` reproduces the tree from `package.json`.
- **One harness timing fix.** `browser-check` held WASD for 1.4 s; with real textures the
  SwiftShader software renderer produces so few frames that the walker sometimes never
  ticked. The hold is now 4 s — the assertion (>0.5 m moved) is unchanged.

## 3. Launch-week polish (not blockers)

1. **Accessibility — closed.** Every page carries `lang`; the 2D/3D/Elevation switch and the
   five elevation buttons now report `aria-pressed` as the state changes
   (`updateViewButtons`/`updateElevationButtons`); the icon-only wall stepper has
   `aria-label`; the plan canvas is `tabindex="0"` with `aria-describedby`, the 3D host is a
   labelled `role="group"` (not `img`, so the WebGL failure alert inside it stays readable),
   and both point at a `aria-live="polite"` summary that `updatePlanA11ySummary()` rewrites on
   every rebuild (“Floor plan: 4 walls, 1 room, 3 fixtures. Nothing is selected.”). The
   save-failure, error and 3D-failure notices use `role="alert"`.
   Still open: the canvases have no non-text visual equivalent for a blind user (see 6).
2. **SEO/social metadata — closed.** Every one of the 28 pages has a unique
   `<meta name="description">`, Open Graph and Twitter-card tags (title, description, image,
   site name) and an absolute `<link rel="canonical">` plus `og:url`, all derived from the one
   origin declared in `scripts/site-origin.mjs`. `sitemap.xml` lists all 28 pages and
   `robots.txt` advertises it; `npm run sitemap` regenerates both.
3. **Payload and rebuild cost — open.** `pages/Editor.html` pulls **140 local modules / 1.8 MB**
   unminified (measured 2026-10-28 after the Systems panel was wired) plus vendored three.js,
   and every committed edit still runs `saveAndSync()` → `update3D()` →
   `conversionEngine.convert()` (full CSG rebuild).
4. **Kitchen clearance — closed.** `features/studio/layout-solver.js` no longer keeps a second
   copy of the numbers: `NKBA.aisle`, `sinkLanding`, `stoveLanding` and `counterDepth` are
   read from `KITCHEN_GAPS` in `features/kitchen/catalog.js`, so the studio's plan check and
   the kitchen run check apply the same 240 mm sink landing, 380 mm range landing and 1.07 m
   aisle. The 900 mm figure the solver used is gone; the suite's rule copy (15 in each side,
   one side minimum, both preferred) is now what both checks enforce.
5. **Support matrix — closed.** `pages/features.html` has a “What you need” section: current
   desktop Chrome/Edge/Firefox/Safari, WebGL 2 (WebGPU demo needs Chrome/Edge 113+), mouse
   and keyboard for the studio, 1024 px minimum width, and the local-storage durability note.
6. **CSP — handlers done, non-importmap blocks externalised (2026-10-30).** Removing the
   CDNs made a policy possible. All **130 inline event handlers** are gone: each control
   declares a `data-click` / `data-input` / `data-change` / `data-go` action that
   `shared/site.js` runs from one delegated listener, and `check-pages` fails if a handler
   comes back. The 25 non-importmap `<script>` blocks were moved to
   `assets/page-scripts/*.js` (26 files including the root redirect); what still requires
   `'unsafe-inline'` is **20 inline import maps** (one per three.js page — import maps must
   be inline, external `src` is not processed). `check-pages` budgets 20 and the 2026-10-30
   sweep is green (38/38). Move the import maps into a build step, then ship
   `Content-Security-Policy: default-src 'self'`.
7. **One stray file — excluded from deploys (2026-10-30).**
   `resnet-18-classification-paddleocr.ipynb` (830 KB, unrelated ML notebook) stays on disk
   (only copy — not deleted) but `*.ipynb` is now in `.gitignore`, so deploys that respect
   ignore rules no longer ship it.

## 4. What is production-quality

- All 29 routes load; every internal link, asset and module specifier resolves; no console
  error on any route.
- 1,757 assertions pass across the ten design suites, the editor, the upload pipeline, the
  DXF/geo importers and the BIM quantities, the toolbox conversions, image tools and model UV
  checks, the shared plan modules,
  the 29-route sweep and two browser sweeps. `browser-check` (206/206) drives stairs,
  landscape, roof and wall through the real editor.
- The site is self-contained: no runtime request leaves the origin, so CDN outages,
  corporate proxies and supply-chain tampering cannot take it down mid-session.
- Projects are versioned (`migrateProject`/`stampProject`), export/import as JSON, and the
  upload → studio hand-off (55 walls, 2 room slabs) round-trips.
- Autosave is throttled and dirty-only, flushes on both unload events, and a failed write is
  visible to the user with an Export escape hatch.
- Every designer draft is read and written through `core/drafts.js`: versioned payloads,
  one-shot reads, legacy payloads still accepted, and a dropped draft leaves a named entry in
  the support log. The wall/roof/landscape/stair suites carry their rule registers and
  design-aid disclaimers into the UI.

## 5. Architecture debt that raises production risk

**One 5,876-line controller with no exports.** `editor/editor.js` holds the whole studio;
every action is a `window.*` global or an inline `onclick`, and `grep "^export "` returns
nothing. All pages, drafts and browser harnesses boot through it.

**`ConversionEngine3D` (792 lines) is a god class.** Textures, lights, floors, ceilings, CSG
wall cuts, roof extrusion, measurement sprites, GLB loading and item dispatch all live in
`convert()`, which `saveAndSync()` calls on every interaction (line 5325).

**Three application states.** `editor/editor.js:191`, `demo/demo.js:18` and
`app/js/main.js:17` each define an `AppState` with different fields.

**Renderer/camera setup is duplicated.** `new THREE.WebGLRenderer` is called 12 times in
9 files — editor 1, `demo/*` 4, `scene/SharedViewer.js` 2 (panorama and plan),
`features/roof/preview.js` 1, `features/wall/preview.js` 1, legacy `app/js/main.js` 3. Only
`scene/scene-camera.js` (framing) is shared.

**Snapping is split four ways** — `core/wall-snap.js`, `core/elevation-snap.js`,
`features/advanced/snapping.js`, `InWallItem.calculateSnap` — with thresholds in three
units. `Item.isValidPosition()` is a real rotated-footprint test, enforced before add and
drag commit.

**Drafts are a versioned localStorage contract — closed.** Nine `*-editor-draft` keys now go
through `core/drafts.js` (`{ version, savedAt, data }`, legacy v0 accepted, malformed payloads
reported), so issue 10.11 no longer applies.

**Dead code and leftovers — closed.** The system barrels are no longer dead re-exports:
`features/systems.js` imports `features/{bid,bim,deck,electrical,framing,wall}/index.js` and
is the only module the editor uses to build the studio's Systems panel, so each barrel is the
single construction point for its system. The two written-never-
read `AppState.graph` assignments (`editor/editor.js`, `demo/demo.js`) are removed.

## 6. Deployment checklist

1. **Serve from the repository root** (the import maps and page links use `/vendor/…` and
   `/assets/…` absolute paths). Any static host works; no build step is required because
   `vendor/`, `textures/` and `assets/tailwind.css` are committed.
2. **Hosting config is committed**: `_headers` (issue 10.12) carries the cache policy and
   the security headers in the format Netlify and Cloudflare Pages read — nothing to add for
   either. `check-pages` fails if a rule goes missing.
   - **nginx:** `location ~* \.html$ { add_header Cache-Control no-cache; }`,
     `location ~* ^/(vendor|textures|assets/fonts)/ { add_header Cache-Control "public, max-age=31536000, immutable"; }`,
     `gzip on; gzip_types text/css application/javascript image/svg+xml text/markdown;`
   - **Apache:** the same via `mod_headers` `Header set Cache-Control …` inside
     `<FilesMatch>`/`<DirectoryMatch>` blocks plus `mod_deflate` for those types.
   - **Vercel:** translate the `_headers` blocks into `vercel.json` `headers[]` entries.
   - **GitHub Pages:** no `_headers` support, and no header control at all; use Cloudflare in
     front, or accept the default caching.
   Compression is not a header — every host above gzips/brotli text automatically except a
   bare nginx, where the `gzip` line above is required. The names under `vendor/`, `textures/`
   and `assets/fonts/` are stable, so a long `max-age` needs a query string or new path when
   a file's content is replaced in place.
3. **Security headers**: the four are already in `_headers`. Uncomment the
   `Content-Security-Policy` block there once §3.6 / issue 10.4 is done (no inline handler is
   left; the 32 inline `<script>` blocks must move into files first);
   `img-src 'self' data: blob:` and `connect-src 'self'` cover the current app.
4. **Watch errors**: add `<meta name="error-endpoint" content="…">` to the pages if you
   want the captured reports posted; support can otherwise read `window.errorLog()`.
5. **Staging pass**: deploy to a staging origin and run `npm test` against it by setting
   `BASE_URL`; the suite's sweep covers every route.
6. **Housekeeping**: delete the untracked notebook (§3.7).

## 7. Verification log (2026-10-28, final)

| Script | Result |
| --- | --- |
| `check-kitchen.js` | 27 / 27 |
| `check-kitchen-page.mjs` | 29 / 29 |
| `check-scene-upload.mjs` | 32 / 32 |
| `check-editor-wiring.mjs` | **44 / 44** |
| `check-studio.js` | 86 / 86 |
| `check-drafts.mjs` | **44 / 44** |
| `check-framing.mjs` | 49 / 49 |
| `check-new-suites.mjs` | 53 / 53 |
| `check-plumbing.js` | 128 / 128 |
| `check-roof.js` | 126 / 126 |
| `check-wall.js` | 153 / 153 |
| `check-stairs.js` | 185 / 185 |
| `check-ocr.js` | 56 / 56 |
| `check-lighting.js` | **123 / 123** |
| `check-imports.mjs` | **98 / 98** |
| `check-toolbox.mjs` | **246 / 246** |
| `check-toolbox-browser.mjs` | **72 / 72** |
| `browser-check.mjs` | 206 / 206 |
| `check-pages.mjs` | 29 / 29 pages clean, `_headers` rules present |
| `browser-pages.mjs` | 4 legacy pages, 0 console errors |
| `check-price-suites.mjs` | every quoted row in 8 suites repriced at its quoted price |

`npm test` → **21 checks passed, 0 failed, 0 skipped; 1,757 assertions passed.**

Targeted probes (run, then removed):

- **Controlled load:** a 6 × 5 m living room, nine 14 W downlights, one single-pole switch
  → `energy-controls` warning, “Controlled loads: 126 W”.
- **Error capture:** `setTimeout(() => { throw new Error('probe-boom') })` → entry
  `error: Uncaught Error: probe-boom` in `window.errorLog()`, `role="alert"` notice shown.
- **Failed save:** `localStorage.setItem('floorplan3d_autosave', …)` forced to throw
  `QuotaExceededError` → “Project not saved … Export” notice plus a `save:` log entry.
- **Offline:** no `https://` URL remains in `pages/*.html`, and no JS module imports a
  remote specifier.
- **Accessibility state:** drawing one wall set the live region to “Floor plan: 1 wall, 0
  rooms, 0 fixtures. Nothing is selected.”; pressing 2D → 3D → Elevation flipped
  `aria-pressed` on the mode group and the elevation group (3D, then Front) and left no
  runtime error.
- **Studio systems panel:** the five tabs render and the bid panel builds from the barrels
  (“No suites · $1650”, empty state) with no console error; the 3D view composites 1,895
  distinct colours after a four-wall plan, so the studio render is live.
- **HiDPI canvases (device scale 2):** the 3D panel’s backing store is 2272×1414 for a
  1136×707 box and the plan canvas the same, a wall dragged from 25 % to 75 % of the box still
  lands at 270→840 plan pixels (grid-snapped, unchanged), and a 2D click on its midpoint still
  selects it and opens the inspector.
- **3D failure states:** launched with `--disable-webgl --disable-webgl2 --disable-3d-apis`,
  the editor shows “The 3D view needs WebGL” inside the panel (`role="alert"`, no canvas, no
  retry) while a wall can still be drawn and selected on the plan. With a scene object whose
  `onBeforeRender` throws, the panel shows “The 3D view stopped drawing” plus the error text
  and a retry button; fixing the scene and pressing retry removes the panel and advances the
  render loop’s frame count.

## 8. Changes this session

- **3D toolbox (phases 0–2).** `pages/toolbox.html` is one route for the browser utilities
  planned in `toolplan.md`, with `features/toolbox/` as its kit: `units.js` (IEC 61966-2-1
  sRGB ↔ linear with an exact-inverse knee, hex/`rgb()` parsing, the six-quantity unit table
  and the scale-mismatch hints), `texture.js` (texel density and the BC/ETC2/EAC/ASTC block
  budgets with mip chains and POT reduction), `image.js` (exact box and nearest resampling,
  tiling, wrap shift, the edge-seam metric, a wrapped high-pass for lighting and the seamless
  generator, whose seam pass writes each averaged opposite edge pair onto both sides so the
  boundary is identical by construction), `pbr.js` (the OpenGL ↔ DirectX green flip and
  channel packing with glTF ORM, Unreal and Unity HDRP presets plus a JSON sidecar), `io.js`
  (bitmap decode capped at the 4096 px working limit, preview canvases, PNG/JSON download and
  drop zones), `index.js` (the registry the nav, the router and the harness all read),
  `shell.js` (the `?tool=` route, nav, late-panel guard and the `window.toolboxKit` handle)
  and one panel per tool. Seven tools ship — colour space, units, texel density, texture
  memory, seamless texture, channel packer, normal-map flipper — with the other ten listed as
  planned, not stubbed. Clean-room: written from the published specs, nothing copied from the
  reference site. The page joins `shared/site.js`'s Tools menu and the route sweep;
  `scripts/check-toolbox.mjs` (246 assertions) pins every constant — including the `G = 255 −
  G` involution, the ORM channel order and the exact edge equality — and imports each panel in
  Node, so a registry entry without a panel fails the gate. Verified in headless Chrome: each
  tool mounts from the nav and from a deep link, white reports luminance 1, 2.54 in reads
  64.516 mm, 1024 px over 2.7 m reads 379.2593 px/m, 2048² RGBA8 with mips reads 21.333 MiB,
  a 64 px ramp reads a 255 seam before the pass and 0 after, the glTF pack reads
  30/120/200/255 and repacks to 200/30/255/255 under the Unity mask, a normal map's green
  flips 200 → 55 with `rock_n_dx.png` as the download name, and the page raises no console
  error (only the app-wide favicon 404 every route has). **Note 2026-10-28:** those three
  probing runs are now a committed harness, `scripts/check-toolbox-browser.mjs` (72
  assertions, registered in `npm test`): it mounts all seven panels through the same
  `select()` the navigation uses, asserts each panel's controls are present and no error
  message is showing, then drives the image tools and parses the downloaded bytes — the
  seamless PNG is 64 × 64, the packed sheet 4 × 4 RGBA, the sidecar names `metalness` in red
  with `metal.png` behind it, and the flipped file is a 2 × 1 PNG named `rock_n_dx.png`.
- **Model import for texel density (tool 3's per-model part).** `features/toolbox/model.js`
  reads GLB/glTF, OBJ, STL and PLY through three's loaders (imported per format, not at module
  scope, so the file still loads in Node) and hands back plain position/UV/index buffers with
  positions in world space, so a scaled node measures in metres. `features/toolbox/mesh.js`
  welds UV vertices, walks the shells and reports each shell's 3D area, UV share and
  `sqrt(UV × W × H / area)` density, plus mirrored, outside-0–1 and UV-degenerate flags and
  the spread between shells. `OBJLoader`, `STLLoader` and `PLYLoader` joined the vendored
  closure (255 → 258 files, 2.65 MB); the `three/addons/` entry already in the page's import
  map resolves them, and `check-toolbox` now asserts that map is there. The
  texel panel's third section drops a model, shows the per-shell table and remeasures when
  the sheet size changes; the browser harness drives it with real OBJ, GLB, PLY and STL files
  (1024 px/m for a 1 m quad with full UVs, “no UVs” for the STL) and an unsupported file that
  must be refused by name.
- **Textures shipped.** `scripts/generate-textures.mjs` + 12 PNGs in `textures/`; metadata
  and preset expectations moved from `.jpg` to `.png`.
- **Lighting rule corrected** to compare controlled load per switch; the stale `CODE_SCOPE`
  assertion now checks the California codes the document cites.
- **Dependencies vendored.** `scripts/vendor-deps.mjs` (258 files, 2.65 MB) and the import
  maps rewritten in 15 pages; `three-mesh-bvh` added to `package.json`;
  `scripts/vendor-fonts.mjs` (11 files, 576 KB); hero images local.
- **Tailwind compiled.** `tailwind.config.cjs`, `assets/tailwind.src.css`,
  `assets/tailwind.css` (59 KB); the Play CDN and the inline `tailwind.config` blocks were
  removed from 26 pages, including the calculator's `brand` palette and Inter face.
- **Error reporting added.** `shared/error-reporting.js` on all 28 pages; the editor reports
  and displays failed saves; the per-save `console.log` was removed from
  `core/storage.js`; autosave flushes on `pagehide` as well as `beforeunload`.
- **Licence added.** Proprietary `LICENSE` + `"license": "UNLICENSED"`.
- **Release gate added.** `scripts/run-checks.mjs`, `npm test`, and a CI workflow that also
  rejects stale `assets/tailwind.css`, `vendor/` or `textures/`.
- **Repo hygiene.** `.server.log` untracked and removed; `.gitignore` now covers logs,
  `.freebuff/` and `node_modules/`.
- **Harness timing.** `browser-check` holds WASD for 4 s so the software renderer can tick;
  the assertion threshold is unchanged.
- **The system barrels are the construction point.** `features/systems.js` imports them
  (`features/{bid,bim,deck,electrical,framing,wall}/index.js`) and builds the studio's Systems
  panel (one `studio-panel.js` per system, plus the BIM panel in `features/bim/takeoff.js`);
  the editor imports every cross-suite helper from a barrel instead of deep module paths, and
  `check-wall.js` asserts the barrel wiring.
- **Accessibility wiring.** `aria-pressed` on the view-mode and elevation buttons (updated in
  `updateViewButtons`/`updateElevationButtons`), `aria-label` on the wall stepper, a focusable
  plan canvas with a `aria-live` summary rewritten by `updatePlanA11ySummary()`, and a
  labelled `role="group"` 3D host.
- **Render assertions in the gate.** `check-editor-wiring` grew from 14 to 25 assertions so a
  blank 3D view fails the suite: the 3D canvas must fill its panel and both canvases must size
  their backing store to `min(devicePixelRatio, 2)` (checked at 1× and again under
  `Emulation.setDeviceMetricsOverride` at 2×), the loop must have drawn frames and must draw
  more after a resize, the fallback must be absent while WebGL works, the composited panel
  must not be one flat colour, and it must visibly change when the plan is cleared. Mutating
  the page to hide the 3D canvas makes the repaint and 2× sizing assertions fail, so the new
  checks are not vacuous.
- **Visible 3D failure state.** `show3DFallback()` renders a `role="alert"` panel inside
  `#render-3d-view` when the renderer cannot be created (“The 3D view needs WebGL”, no retry)
  or when a frame throws (“The 3D view stopped drawing”, with the error text and a “Try the 3D
  view again” button that rebuilds the scene). `init3D` returns cleanly after a start failure,
  so the plan, inspectors and suites keep working, and the frame guard stops the loop from
  spraying an error every animation frame.
- **Metadata.** A unique description, Open Graph and Twitter-card tags on all 28 pages, an
  absolute `canonical` and `og:url` generated from `scripts/site-origin.mjs`, a `sitemap.xml`
  covering every page and a `robots.txt` that advertises it.
- **Clean-room import and BIM modules.** IngeTrazo is GPL-3.0-or-later and this tree is
  proprietary, so nothing was ported from it. `features/import/dxf.js` reads an ASCII DXF
  header (`$INSUNITS`/`$MEASUREMENT`, with a `unitScale` override) and flattens
  LINE/LWPOLYLINE/POLYLINE/ARC/CIRCLE/ELLIPSE into metre segments, dropping slivers and
  reversed duplicates, then centres the drawing in the plan (y flipped, fitted to the view).
  `features/import/geo.js` parses KML, KMZ (stored or deflated entries; a ZIP reader, not a
  dependency) and GeoJSON into local metres with a cos-latitude projection and fits the site
  inside a rectangle with north up. `features/bim/takeoff.js` maps plan types to IFC classes,
  computes wall length/net area/volume and fixture footprints, deducts the doors and windows
  bound to each wall, reports unattached or oversized openings, and writes the QTO CSV.
- **Drawing import wired into the editor.** The upload modal has a “Load Drawing” tile
  (`#upload-dxf-btn`) that takes `.dxf`, `.kml`, `.kmz` and `.geojson` through the same
  hidden input as the image and JSON imports, replaces the traced walls, clears the
  reference image and re-centres the plan. A DXF keeps its header units (guesses and skipped
  INSERTs are logged); a site boundary is projected to metres, kept at **real size**
  (`fitFeaturesToSite(..., { fit: false })`) and centred with north up, and the session warns
  when it is larger than the view instead of shrinking a surveyed boundary.
- **BIM in the studio.** `features/bim/index.js` is the sixth system barrel and `BIM` is a
  sixth Systems tab. Its panel is built from the plan on screen (`systemsContext().bim`), so
  the quantity rows, the checks and the `Download IFC CSV` action all come from one
  `bimTakeoffSnapshot` and cannot disagree.
- **Import/BIM gate.** `check-imports.mjs` (98 assertions, now in `npm test`) pins the unit
  table, entity flattening, duplicate/sliver cleaning, placement, GeoJSON/KML/KMZ parsing and
  projection, the IFC class map, the quantity maths and the CSV quoting. Mutating the
  millimetre scale to 1 fails 8 unit/arc/placement assertions, so the checks are not vacuous.
  `check-editor-wiring` grew from 25 to 44 assertions: the drawing tile sets the file picker
  to `.dxf,.kml,.kmz,.geojson`, a 4 m × 3 m DXF becomes four walls at 120/90 px and sits
  inside the plan, a 20 m GeoJSON boundary becomes a square of four walls at real size
  centred in the plan, the BIM tab classifies the walls as `IfcWall`, the panel headline
  matches the takeoff, and the intercepted CSV download is named `ifc-takeoff.csv`, has the
  IFC header, one row per wall and an area sum equal to the panel total. Keeping only two of
  the imported walls makes five of those assertions fail.
- **One clearance policy.** `features/studio/layout-solver.js` reads its landing, aisle and
  counter-depth minima from `KITCHEN_GAPS`, so the plan check and the kitchen run check cannot
  disagree again.
- **Support matrix stated.** `pages/features.html` gained “What you need” (browsers, WebGL 2,
  pointer input, 1024 px, local-storage durability).
- **Dead state removed.** The two `AppState.graph` assignments that nothing read are gone.
- **3D render robustness.** The WebGL renderer now matches `devicePixelRatio` (capped at 2), a
  frame requested while the 3D tab is hidden stays pending instead of being consumed by a
  frame that draws nothing, a `ResizeObserver` resizes the drawing buffer when the panel
  changes size without a window resize (a stale or 0×0 buffer is what a blank 3D view looks
  like), and a lost context is reported and repainted on `webglcontextrestored`.
- **Plan canvas is DPR-aware too.** `blueprint-canvas` sizes its backing store from
  `planView` (the CSS box) times `devicePixelRatio` (capped at 2), and `draw2D()` scales the
  context once so drawing stays in the logical plan pixels that `PIXELS_PER_METER`, fixture
  positions, hit testing and the snap thresholds are measured in. Plan maths now reads
  `planViewSize()` instead of `canvas.width`, so the device ratio cannot leak into a
  coordinate, a wall length or a snap distance.

## 9. Historical notes

- The lab demos were folded into `features/lab/kit.js` and wired into the editor; the React
  prototype, lab pages and unused lab components were removed.
- The unwired root dumps (`Qwen_javascript_*.js`, `pages/helper.html`, `pages/Qwen_html_*`,
  `txt.txt`, `TXT2.TXT`, vendored `three.js`) were merged or deleted; no unreferenced dump
  files remain.
- Earlier audits' fixed findings (dead wall selection, always-true `isValidPosition`, fixed
  1 m grid, unversioned project schema, unused `footprint()`, noisy autosave) are recorded
  in git history and are no longer true.
- **CSP phase 2 + notebook ignore (2026-10-30).** The 25 non-importmap inline `<script>`
  blocks were extracted verbatim to `assets/page-scripts/*.js` (26 files with the root
  redirect); relative imports inside them were rewritten `../` → `../../` for the new
  location. `scripts/check-pages.mjs` budget is now 20 (import maps only) and the sweep is
  green at 38/38 pages, 0 failures — sitemap/canonical/og:url hold at 37 pages plus the
  root redirect. `*.ipynb` added to `.gitignore` (§10.5) so the stray notebook no longer
  ships in a deploy. No engine code was touched; all extracted files pass `node --check`.

## 10. Issue register — pros and cons of every open item

Measured 2026-10-28, after the §3 fixes. Each entry defines the issue, then costs fixing it
against leaving it, and records a verdict. Nothing in this section is a release blocker;
§2 lists the blockers that are closed.

### 10.1 Residual accessibility — canvases have no text equivalent

**What it is.** The plan, elevation and 3D views are canvases. A screen-reader user now gets
`#plan-a11y-summary` (“Floor plan: 4 walls, 1 room, 3 fixtures. Nothing is selected.”) and can
focus the plan, but cannot inspect geometry: wall lengths, openings, fixture positions.

- **Fix pros.** Closes the last real WCAG gap in the studio; needed for a VPAT or a public-
  sector sale; a structured export (SVG or text) also serves print and integration use.
- **Fix cons.** A true equivalent is a new output surface (SVG/text of the plan), not a patch;
  it needs its own tests (geometry, units, ordering) and will drift from the canvas unless the
  same model feeds both.
- **Cost.** Days, and a product decision about what a “text plan” contains.
- **Verdict.** The announcement layer is done. Treat the export as a feature request.

### 10.2 Sitemap, canonical and `og:url` — **closed**

**What it was.** All 28 pages carried a unique description plus Open Graph/Twitter tags, and
`robots.txt` allowed crawling, but nothing told a crawler which absolute URL a page lives at:
no `sitemap.xml`, no `<link rel="canonical">`, no `og:url`. A sitemap needs absolute URLs and
no origin was declared anywhere in the repository.

**Fix.** The origin is declared once, in `scripts/site-origin.mjs`:
`https://dev-justin-time.github.io/floorplan_3d`, the GitHub Pages project URL for the
dev-justin-time/floorplan_3d remote. A project site is served from `/<repo>/`, so the prefix
is part of every URL. `scripts/generate-sitemap.mjs` (`npm run sitemap`) derives everything
from that one constant: it upserts an absolute `canonical` and `og:url` into all 28 pages,
writes `sitemap.xml` with 28 `<loc>` entries, and renders the `Sitemap:` line in `robots.txt`.
The root `index.html` only redirects, so it stays out of the sitemap and its canonical names
`pages/index.html`.

The output is deterministic — a second run writes nothing — and the gate holds it there.
`check-pages` fails when a page's canonical or `og:url` differs from the declared origin, when
`sitemap.xml` misses a page, lists one twice or lists a non-page, or when `robots.txt` does not
advertise exactly one sitemap. CI re-runs the generator and fails on a diff, the same pattern
as the compiled CSS, vendored three.js and generated textures. This is what makes the
“wrong-but-consistent origin” risk measurable: moving or renaming the site is a one-line
change plus a regeneration, not 28 hand edits.

**Verification.** Mutation-tested before trusting it: pointing one page's canonical at another
domain, deleting one sitemap entry and dropping the robots line each produced a named failure
(`canonical is …, want …`, `missing: …`, `want one line …`) and passed again once restored.
`npm test` is green with the new assertions.

**Still the host's job.** Nothing in the repository publishes anything: Settings → Pages has to
serve this branch (or a Pages workflow has to exist) before the declared URLs resolve, and TLS
with the `http`→`https` redirect is GitHub's. A custom domain later means editing `SITE_ORIGIN`
and running `npm run sitemap`. Note also that `_headers` (§10.12) is a Netlify/Cloudflare file
that GitHub Pages ignores.

**Cost.** Half an hour, as estimated.

### 10.3 Payload and rebuild cost

**What it is.** The editor reaches **140 modules / 1.8 MB** unminified plus vendored three.js
(measured; the earlier 110 / 1.3 MB figure predates the Systems panel). Every committed edit
still calls `saveAndSync()` → `update3D()` → `conversionEngine.convert()`, a full CSG rebuild.

- **Fix pros.** 1.8 MB becomes roughly 350–450 KB minified (one bundle gzips to ~220 KB), so
  first paint on mobile-class hardware improves by seconds; a bundled build also simplifies
  CSP and hosts that do not do HTTP/2.
- **Fix cons.** It ends the “no build step, commit `vendor/` and serve the repo” property that
  §6 relies on; adds a bundler to `devDependencies` and a CI drift check; the import maps and
  page-level inline modules have to move to build output; a regression here is a silently
  broken page that only `browser-check` (206 assertions) would catch.
- **Cost.** A project, not a patch — a day plus a full harness pass on both sides.
- **Verdict.** Worth doing, as its own change with measurements before and after.

### 10.4 Content-Security-Policy — **phase 1 closed (handlers), inline blocks remain**

**What it was.** 130 inline `onclick`/`oninput`/`onchange` handlers, 16 inline import maps and
16 other inline `<script>` blocks. A static host cannot nonce them, so `'self'` blocks them
all; the CDN removal is what made the policy conceivable in the first place.

**Fix (phase 1).** No page carries an inline handler any more. A control declares what it does
and `shared/site.js` runs it from one delegated listener, resolved against `window` (dotted
names such as `planOcr.runCurrent` keep their owner as `this`):

| Attribute | Runs |
| --- | --- |
| `data-click="undo" data-args='["3d"]'` | `window.undo('3d')` |
| `data-input="setWallHeight"` | `window.setWallHeight(value, element)` |
| `data-change="setRoofOption" data-args='["gutters"]'` | `window.setRoofOption('gutters', checked, element)` |
| `data-go="Editor.html"` | `location.assign` |
| `data-show` / `data-hide="#upload-modal"` | toggle the `hidden` class |
| `data-disclosure="#abilities-list" data-icon="#…-icon"` | toggle a panel and flip its chevron |
| `data-confirm="Clear project?"` | confirm before the action runs |
| `data-clicks="#floorplan-upload"` | forward the click to another element |

A name that is not a function reports through `window.reportClientError` with
`kind: 'action'`, so a control that lost its binding lands in the support log instead of doing
nothing silently. Two expressions that were statements in markup moved into the module that
owns them: the demo's slider label is `setBgScaleAndLabel` in `demo/demo.js`, the calculator's
theme switch is `toggleTheme` in its page script.

**What is left (2026-10-30).** 20 inline `<script>` blocks still need `'unsafe-inline'`,
and all 20 are import maps (one per three.js page). The other 25 blocks were externalised to
`assets/page-scripts/*.js` with import paths rewritten (`../` → `../../`); `check-pages`
budgets 20 and the sweep is green (38/38). Externalising an import map needs `src=`
support (not processed by browsers) or a build step, so this remainder belongs with 10.3
rather than on its own.

**Cost.** The handlers took two hours of mechanical work rather than a day; the blocks are the
rest.

**Verified.** `npm test`: 21 checks, 1,757 assertions, including `browser-check`'s 206
expressions that drive the editor toolbar, and `check-pages` asserting zero inline handlers on
all 29 pages plus a real `data-go` click from `about.html` to the editor. The gate counts
both kinds of inline code: handlers must stay at 0, blocks are a ratchet that may only fall.

### 10.5 Stray notebook

**What it is.** `resnet-18-classification-paddleocr.ipynb` (830 KB), untracked, unrelated to
the app; a folder-upload deploy would ship it.

- **Fix pros.** One fewer unrelated artifact in a deploy; no ambiguity about what the project
  contains.
- **Fix cons.** It is the only copy on disk — deletion is not recoverable from this repository.
- **Cost.** One `rm`.
- **Verdict (2026-10-30).** Fixed without deletion: `*.ipynb` added to `.gitignore`.
  The file stays on disk but no longer ships in a deploy; deletion still needs an explicit
  decision.

### 10.6 One 5,876-line controller with no exports

**What it is.** `editor/editor.js` holds the whole studio; every action is a `window.*` global
or an inline `onclick`; `grep "^export "` returns nothing; all pages, drafts and harnesses
boot through it.

- **Fix pros.** Testable seams; small diffs; drag, snapping and the Systems panels could be
  unit-tested instead of driven through headless Chrome.
- **Fix cons.** Every `window.*` global and every `data-*` action is a consumer; splitting it
  without a compatibility facade breaks those, the three harnesses and saved user sessions.
  Highest regression risk of anything in §5.
- **Cost.** Weeks, in slices, not one change.
- **Verdict.** Refactor behind a facade only when a feature needs it.

### 10.7 `ConversionEngine3D` (792 lines) is a god class

**What it is.** Textures, lights, floors, ceilings, CSG wall cuts, roof extrusion, measurement
sprites, GLB loading and item dispatch all live in `convert()`, which runs on every commit.

- **Fix pros.** The rebuild is the editor's hot path; separating floors/ceilings/CSG/roof
  would allow rebuilding only what changed — the structural fix behind 10.3's cost.
- **Fix cons.** The CSG output is what the 3D pick, the elevation cut and the measurement
  sprites index into; a wrong split changes geometry that only a human eye catches, and the
  SwiftShader render checks are weak evidence.
- **Cost.** Weeks, with visual review after every slice.
- **Verdict.** Defer until profiling justifies it; riskiest refactor in the tree.

### 10.8 Three `AppState` definitions

**What it is.** `editor/editor.js`, `demo/demo.js` and `app/js/main.js` each define an
`AppState` with different fields.

- **Fix pros.** One project model, one migration path, drafts and storage stop diverging.
- **Fix cons.** The demo and the legacy app are separate entry points by design; unifying them
  means porting `app/js/main.js` onto the studio model — a rewrite of a working page with no
  user-visible gain.
- **Cost.** Days.
- **Verdict.** Leave; retire the legacy page instead if it is not a product surface.

### 10.9 Twelve `WebGLRenderer` constructions in nine files

**What it is.** Editor 1, `demo/*` 4, `scene/SharedViewer.js` 2, `features/roof/preview.js` 1,
`features/wall/preview.js` 1, legacy `app/js/main.js` 3; only `scene/scene-camera.js` is shared.

- **Fix pros.** One factory would centralise tone mapping, pixel ratio, context-loss handling
  and disposal, which differ per page today.
- **Fix cons.** Each caller sets different size/DPR/antialias options; a factory that guesses
  wrong costs a debugging session per page, for no user-visible gain.
- **Cost.** Hours, spread across pages that each need a visual pass.
- **Verdict.** Cosmetic; fold it into whichever renderer change comes next.

### 10.10 Snapping is split four ways

**What it is.** `core/wall-snap.js`, `core/elevation-snap.js`, `features/advanced/snapping.js`
and `InWallItem.calculateSnap`, with thresholds in three units. `Item.isValidPosition()` is a
real rotated-footprint test, enforced before add and drag commit.

- **Fix pros.** One threshold unit and one order means a fixture snaps identically in 2D,
  elevation and 3D; today four priorities can disagree.
- **Fix cons.** Changing snap order changes stored coordinates, so existing saved projects
  place fixtures differently; the validity test interacts with both add and drag commit.
- **Cost.** Days, plus a decision about existing projects.
- **Verdict.** Worth unifying, but it needs a migration story; not a drop-in.

### 10.11 Nine unversioned `*-editor-draft` localStorage keys — **closed**

**What it was.** Each draft was consumed once by an `apply*EditorDraft()`; a malformed draft
was dropped silently, and a payload change had no way to announce itself.

**Fix.** `core/drafts.js` is now the only reader and writer of the nine keys. A save is
`{ version: 1, savedAt, data }`; a read accepts an old bare payload as version 0 (drafts
already on a user's disk still import), refuses a payload written by a newer build instead of
half-applying it, drops malformed JSON, removes the key, and reports the reason through
`window.reportClientError(..., { kind: 'draft', fatal: false })` — the support log names the
key and the reason, with no error banner. The two keys the studio and the bid builder both
read (`deck-` and `electrical-editor-draft`) use `consume: false`, and
`features/bid/sources.js` unwraps through the same function instead of parsing JSON itself.

**Behaviour change.** None for a valid draft. A draft that used to disappear now leaves an
explained entry in `window.errorLog()`.

**Cost.** The estimated hour.

**Verified.** `check-drafts.mjs`, 44 assertions: round trip, one-shot consume, legacy v0
payload, newer version refused, malformed JSON removed, unavailable and blocked storage,
the report path, every writer/reader call site, and that the bid harvest unwraps instead of
reading the envelope as the draft. The four hand-off flows (kitchen run, uploaded plan,
framing harvest, wall covering) pass end to end.

### 10.12 Hosting config and security headers — **closed in the repo**

**What it was.** §6 asks for gzip/brotli, long-lived caching for `vendor/`, `assets/fonts/` and
`textures/`, `no-cache` for HTML, plus `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: SAMEORIGIN`.

**Fix.** `_headers` at the repository root, in the format Netlify and Cloudflare Pages read:
the four security headers on `/*` (adding `Permissions-Policy` to close geolocation,
microphone and camera), `no-cache` for `*.html`, one-year immutable caching for `/vendor/*`,
`/assets/fonts/*` and `/textures/*`, and the CSP block written but commented out with the
reason and the line to uncomment. `check-pages` asserts all of it, plus that the CSP stays
disabled while inline `<script>` blocks remain, so a deleted or drifted line fails the gate
instead of rotting quietly.

**Still the host's job.** TLS, the transition/canonical redirect and compression are deploy
properties, not repo files: both hosts compress text automatically, and §6 now carries the
nginx, Apache, Vercel and GitHub Pages equivalents for the same policy.

**Cost.** Minutes, as estimated.

### 10.13 Error endpoint and staging run

**What it is.** §6 asks for `<meta name="error-endpoint">` so captured reports are posted, and
`BASE_URL=<staging> npm test` against the deployed origin.

- **Fix pros.** Turns the `sessionStorage` ring buffer into something support can see; the
  staging run catches deploy-path breakage (absolute `/vendor/…` links) before users do.
- **Fix cons.** An endpoint is a privacy and retention decision, and needs a service choice;
  posting client errors also needs a volume/quota plan.
- **Cost.** The staging run is free; the endpoint is a design decision plus a small receiver.
- **Verdict.** Run the suite against staging now; add the endpoint when there is a place to
  send it.

### Recommended order

| Order | Item | Why now |
| --- | --- | --- |
| ~~1~~ | ~~10.12 hosting config/headers~~ — **done**, `_headers` + gate | No code, immediate benefit, opens the CSP slot |
| ~~2~~ | ~~10.11 draft versioning~~ — **done**, `core/drafts.js` | An hour, no behaviour change, better diagnostics |
| ~~3~~ | ~~10.2 sitemap/canonical~~ — **done**, `site-origin.mjs` + generator + gate | Origin supplied; one constant drives 28 pages, sitemap and robots |
| 4 | 10.4 CSP — **handlers done**, 32 inline `<script>` blocks left | The project-sized item; unblocks the header |
| 5 | 10.3 payload/bundling | Only once a build step is acceptable |
| 6 | 10.6, 10.7, 10.10 refactors | Defer until a feature or a profile demands them |
