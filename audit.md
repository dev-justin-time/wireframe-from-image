# Audit report — blueprint3d / Floorplan 3D studio

**Date:** 2026-11-07
**Auditor:** Buffy (coding agent)
**Scope:** the 11 files reported as changed by `git status`, plus the files and
directories they reference, plus the readme's factual claims.
**Mode:** read-only audit. No source file was modified to produce this report.

**Verdict:** the application code is in good shape — it compiles, all 36 Rust
tests pass, every changed JavaScript file parses, and the vendored engine
adapters run end to end in Node. The repository is **not** in a shippable state,
because the standalone pages under `pages/` were copied without the assets,
page scripts and helper directories they load, and because the readme
overstates two facts about the code-rule libraries.

---

## 1. Executive summary

| Area | State | One-line assessment |
| --- | --- | --- |
| Rust extractor + server | **Good** | Typed errors, bounded concurrency, deadlines, graceful shutdown, real request tests. |
| Rust test coverage | **Good** | 36 tests across 5 modules, all green in 2.82 s. |
| Changed JavaScript | **Good** | All 7 files parse; adapters produce printable output in Node. |
| `shared/` nav + error reporting | **Good with gaps** | Single source of truth, accessible; no way back to the studio, errors die with the page. |
| `pages/` standalone pages | **Broken** | 37 pages, 59 distinct referenced resources missing (57 via `src`/`href`, 2 hero images via meta/style), including every stylesheet. |
| `calc.html` | **Broken** | Markup complete, zero behaviour: its only script does not exist. |
| `static/demo/farmhouse/manifest.js` | **Good** | 32 declared sheets, 32 PNGs, 32 SVGs present. |
| Documentation accuracy | **Fair** | Excellent architecture prose; 4 concrete errors, 2 of them numeric. |
| Repo hygiene | **Weak** | No CI, no licence, no JS test entry point in CI, unbounded `outputs/models/`. |

**Most important sentence in this report:** `pages/` references `../assets/`,
`../features/`, `../docs/`, `../editor/`, `../app/`, `../demo/demo.js` and
`../vendor/nipplejs/` — none of those directories exist at the repository root.
The server masks part of the problem by serving `static/` at `/`, but
`static/assets/` contains exactly **one** page script
(`page-scripts/project-dashboard.js`), so the pages are unstyled and inert over
HTTP as well as over `file://`.

---

## 2. Method and evidence

### 2.1 Commands actually run

| Command | Result |
| --- | --- |
| `cargo check --all-targets` | Clean, exit 0, no warnings surfaced. |
| `cargo test` | `36 passed; 0 failed; 0 ignored`, 2.82 s. |
| `node --check` on all 7 changed JS files | All OK. |
| `node --input-type=module` import of `static/engines-bridge.js` | Loads; `ruleCount()` = **173**. |
| `outputs/scripts/probe-bridge.mjs` | All 8 bridge entries produce output; 173 rules, 7 libraries. |
| `outputs/scripts/probe-extra.mjs` | All adapters produce output (kitchen, landscape, bid, schedule, price book, rollup). |
| `outputs/scripts/probe-plan-edit.mjs` | Plan graph, segments, imports, items, corners, layers all pass. |
| Reference sweep of every `src`/`href` in `pages/*.html` and `static/index.html` | 57 distinct missing targets (plus 2 hero images referenced through `meta`/inline `style`). |
| Duplicate-`id` scan of all 37 pages | No duplicates. |

### 2.2 Static measurements

| Item | Count |
| --- | --- |
| Pages under `pages/` | 37 |
| Screens named in `static/nav-data.js` | 41 (37 with a page, 4 studio-only) |
| Mirrored engine modules under `static/engines/` | 66 JS files |
| Rust source lines (`src/`) | 4,777 |
| Studio JS lines (`static/`, `shared/`) | ~5,393 |
| Rust tests | 36 |
| Code rules across the seven `rules.js` libraries | 173 |
| Farmhouse sheets (manifest / PNG / SVG) | 32 / 32 / 32 |

### 2.3 What was **not** verified

- No browser run. `tools/ui-check.mjs` needs a live server plus headless Chrome;
  it was not executed, so rendering, overflow, canvas mounting and the elevation
  sweep are unverified here.
- Byte-identity of `static/engines/` against `E:\floorplan_3d` was not checked —
  the upstream tree is not on this machine. The vendoring *claim* is therefore
  untested, not proven.
- The PDF extraction test returns early when PDFium is absent. `pdfium.dll`
  exists locally and is gitignored, so a fresh clone would **pass** that test
  without exercising PDF reading at all. The green suite does not guarantee PDF
  coverage elsewhere.
- Visual fidelity of the pages (Tailwind classes) cannot be evaluated while the
  stylesheet is missing.

---

## 3. Repository-level findings

### R-1 — `pages/` lost its asset tree (P0, blocking)

| Missing target | Referencing pages | Exists anywhere? |
| --- | --- | --- |
| `assets/tailwind.css` | 36 | No |
| `assets/fonts/fonts.css` | 10 | No |
| `assets/style.css`, `assets/animated-card.css`, `assets/blueprint.png` | 1 each | No |
| `assets/images/hero-plan-1.png`, `hero-plan-2.png` | 32 (OG/Twitter/hero) | No |
| `assets/page-scripts/*.js` (24 distinct files) | 25 pages reference the directory | Only `project-dashboard.js` |
| `features/<suite>/page.js` (11 distinct) | 11 | No root `features/` |
| `docs/*` (13 distinct) | 12 | No root `docs/` |
| `editor/editor.js` | `Editor.html` | No |
| `app/js/main.js` | `app.html` | No |
| `demo/demo.js` | `demo.html` | No |
| `vendor/nipplejs/nipplejs.js` | `app.html` | No |

**Why the HTTP mount does not save this:** `app_with()` serves `pages`, `shared`
and `static` and falls back to `ServeDir::new("static")`, so `../assets/x`
becomes `/assets/x` → `static/assets/x`. That directory holds one file, so the
404s are real in the browser. Only `nav-data.js` and the `shared/` pair resolve
through that mapping.

**Impact:** every page renders without its stylesheet; every interactive page is
inert; OG/Twitter previews are broken (32 pages); the shared nav still works,
which makes the breakage look like a styling bug rather than a missing tree.

**Fix options:** (a) restore a root `assets/`, `features/`, `docs/`, `editor/`,
`app/`, `vendor/` tree from upstream; (b) repoint every page at
`../static/assets/...` and port the missing page scripts into
`static/assets/page-scripts/`; (c) add a build/copy step that emits those trees
into `static/`. (a) is the smallest change if upstream has them; (c) is the only
option that survives a rebuild.

### R-2 — `calc.html` has no behaviour at all (P0)

`pages/calc.html:262` loads `../assets/page-scripts/calc.js`, which does not
exist. All five calculators and the theme toggle are bound exclusively through
`data-click` attributes (`switchTab`, `calcSpan`, `calcStairs`, `calcConcrete`,
`calcRoof`, `calcDeck`, `setConcreteShape`, `toggleTheme`). Nothing else in the
repo dispatches those names, so the page is a static form: inputs accept text,
no result panel can ever be revealed.

This is the one changed file where the markup edit landed but its dependency did
not. It is also the file most likely to be noticed first, because the calculator
screens are the "quick win" destination in the Project group.

### R-3 — helper scripts target another machine (P2)

Five scripts hardcode `E:/floorplan_3d`:

```
outputs/scripts/check-pages.mjs:5
outputs/scripts/wire-pages.mjs:8
outputs/scripts/port-farmhouse.mjs:10
outputs/scripts/probe-engines.mjs:3
outputs/scripts/serve-upstream.mjs:7
```

`check-pages.mjs` additionally asserts `home.href = 'index.html'`, a pattern the
current `shared/site.js` never emits (it derives links from `NAV`), so that
check would fail even with the path fixed. None of the five are mentioned in the
readme's documented script set, so they are effectively dead tooling that looks
authoritative.

### R-4 — no CI, no licence, no lint configuration (P2)

There is no `.github/workflows`, no `LICENSE`, no `rustfmt.toml`, no Clippy
configuration and no JS lint/format configuration. Given 36 passing Rust tests
that run in under three seconds, the absence of CI is an easy win: `cargo test`
alone would gate the one part of the repo that has real coverage.

### R-5 — `outputs/models/` grows without bound (P2, operational)

`upload_file` and `plan_report` each write new UUID-named OBJ (and glTF) files
and nothing ever deletes them. `/outputs` is served publicly on the same origin.
A long-running instance accumulates every upload's geometry forever. The
`/upload` path also returns a bare `String` (plain text) while `/api/plan`
returns JSON — two response conventions on one API surface.

### R-6 — silent CLI fallbacks (P3, robustness)

`parse_args` uses `value.parse().unwrap_or(current)` for `--mm-per-px`,
`--mm-per-pt`, `--page`, `--wall-height` and `--stud-spacing`. A typo
(`--mm-per-px 1O`) silently keeps the default instead of failing, which is the
one class of error a measuring tool must not swallow: the resulting quantities
are plausible and wrong. Contrast this with the HTTP path, which correctly
rejects a non-numeric `mmPerPx` with 422.

### R-7 — shared nav has no way back to the studio (P3)

`shared/site.js` renders only the `NAV` list of pages. There is no link to `/`
(the studio shell). The readme calls `pages/index.html` "the way in", so this is
arguably deliberate, but it makes the pages a one-way exit from the app. The
stale `check-pages.mjs` suggests a home link was previously intended.

### R-8 — error reporting is per-document only (P3)

`shared/error-reporting.js` records into `window.blueprintErrors` with page and
timestamp. That is a genuine improvement over console-only, but the array dies
with the document: navigating between pages discards the history, so the stated
goal of making a failure "addressable" holds only while the tab stays put. There
is no export hook, no `sessionStorage` hand-off and no server endpoint.

---

## 4. Per-file audit

### 4.1 `src/main.rs` — 1,502 lines

**Purpose:** CLI, Axum server, OBJ writer, upload and `/api/plan` handlers.

**Pros**

- `ApiError` with status mapping is the right call: failures cannot be mistaken
  for a 200 body, and every handler failure routes through it.
- `run_blocking` is textbook: `spawn_blocking` + owned semaphore permit + 120 s
  deadline, with a comment explaining why cancellation of PDFium is unsafe.
- Upload limits are enforced twice — `DefaultBodyLimit` and a decoded-length
  check — and `check_declared_length` rejects before buffering.
- Security posture is sound for a local tool: binds `127.0.0.1` by default, the
  client's filename is never used as a path component (UUID temp/OBJ names), and
  PDF detection checks the `%PDF` magic rather than trusting the extension.
- Shutdown drains in-flight work on Ctrl-C and SIGTERM (`#[cfg(unix)]` split is
  correct, with `pending` on Windows rather than a dummy branch).
- Tests drive the real router via `tower::ServiceExt::oneshot`, assert the whole
  `/api/plan` contract (walls, rooms, takeoff arithmetic, glTF accessor counts)
  and clean up the artifacts they write. That is unusually good for a project of
  this size.
- `healthz` reports `pdf: available()` so a deployment can be checked before it
  is trusted.

**Cons / gaps**

- **`scaleSource` misreports raster conversions** (`main.rs:763`, `:913`). It is
  initialised from `mm_per_pt_given` and only updated in the PDF branch, so a
  raster posted with `mmPerPx=5` still reports `"default"`, and a raster posted
  with `mmPerPt=<n>` reports `"given"` even though that field cannot affect a
  raster. The metadata does not describe the conversion that happened.
- `upload_file` returns plain text; `api_plan` returns JSON. Fine for curl, poor
  for a client.
- `mm_per_px` carries millimetres-per-*point* for PDFs. Documented, but a single
  field with two units is a standing invitation to a unit bug; `PlanOptions`
  inherits the ambiguity.
- Silent numeric CLI fallbacks (R-6).
- `f32` throughout the plan pipeline; tests compensate with tolerances, but
  area/volume sums lose precision at large scales.
- Timeout returns 504 while the permit stays held until the blocking task
  finishes, so a timed-out request still occupies a slot. Deliberate, worth
  documenting as a capacity risk rather than only a safety choice.
- The PDF test skips silently without PDFium (see §2.3).

**Verdict:** solid. One metadata bug, two robustness nits, no design problems.

### 4.2 `shared/site.js` — 201 lines

**Purpose:** renders the shared navigation on every page from `static/nav-data.js`.

**Pros**

- Single source of truth: page labels and screen titles cannot drift from the
  studio, which is exactly the bug this kind of chrome usually accumulates.
- Accessibility is better than typical for injected chrome: `aria-expanded`,
  `aria-controls`, `aria-current="page"`, Escape closes and returns focus,
  outside-click closes, a `matchMedia` listener clears state when the layout
  widens, and `event.stopPropagation()` prevents the open-then-close race.
- No dependencies, no build step, no page markup rewritten; idempotent (`if
  document.getElementById('bps-nav') return`).
- Scoped CSS with a real breakpoint and a scrollable panel rather than a taller
  bar.

**Cons / gaps**

- No home/studio link (R-7).
- The breakpoint is duplicated: `NARROW = '(max-width: 700px)'` in JS and
  `@media (max-width: 700px)` in the CSS string. Changing one silently
  desynchronises the other.
- ~120 lines of CSS live inside a JS template string; no linting, no
  minification, no cache separation.
- `build()` runs on `DOMContentLoaded` and `prepend`s to `<body>`, so the bar
  appears after first paint (layout shift) and always above any page-owned
  header.
- Relative `href`s assume every consumer sits exactly one directory below the
  shared nav root. A nested page would silently link to the wrong place.
- Links are absolute file names; no support for the studio's `#/route` form, so
  the two navigation systems remain disjoint.

### 4.3 `shared/error-reporting.js` — 54 lines

**Purpose:** classic-script error recorder loaded in every page's `<head>`.

**Pros**

- Correctly a classic script with no `import`/`export`, matching how it is
  loaded — a common mistake avoided.
- Capture-phase `error` listener so resource failures are caught, with
  `detail()` reconstructing the URL from `event.target` because those events
  carry no error object.
- Bounded ring buffer (50) with `shift()`, so a broken loop cannot exhaust
  memory.
- Records kind, message, stack, page, ISO timestamp; mirrors to console;
  `unhandledrejection` covered; exposes `window.blueprintReport` for explicit
  reporting.

**Cons / gaps**

- Per-document only (R-8); navigating loses everything.
- Cross-origin script failures arrive as `"Script error."` with no stack; not
  handled specially.
- No deduplication, so a repeating animation-frame error fills the 50-slot
  buffer in milliseconds and evicts the useful first error.
- No export/download hook, no severity field, no `context` set anywhere in the
  repo (the parameter exists but is unused by callers).
- `record()` is called with `detail(event)`; for a resource failure the stack is
  a synthetic `Error` created inside the handler, which points at this file, not
  the missing asset. The URL is preserved, which is the useful part.

### 4.4 `static/nav-data.js` — 52 lines

**Purpose:** screen groups, titles, studio-only set, page resolution, derived `NAV`.

**Pros**

- Verified complete: `NAV` resolves to exactly the 37 files present in `pages/`
  (41 screens minus the 4 studio-only ones), every screen has a title, and the
  `Editor.html` case is handled by an explicit `PAGE` override.
- The `STUDIO_ONLY` set encodes a real architectural distinction (router-only
  screens) instead of leaving a comment nobody enforces.
- `NAV` is derived, not hand-maintained — the drift the file exists to prevent
  cannot occur through editing.

**Cons / gaps**

- No assertion that each derived page file exists. A renamed page would drop out
  of the nav silently (it would not 404; it would simply disappear).
- Group order, titles and page mapping are three loose structures with no schema;
  a typo in a key yields `undefined` in the nav (the consumers fall back to the
  id, which hides it further).
- Mixed quoting style (`'plan-studio'`, `editor:`) in one object literal.

### 4.5 `static/engines-bridge.js` — 463 lines

**Purpose:** adapters from the extracted plan to the seven vendored engines.

**Pros**

- **Proven to load and run:** imported cleanly in Node, and `probe-bridge.mjs`
  exercises all eight entry points, producing 13–23 rows each.
- `defined()` correctly strips `undefined`/`null`/`NaN` before an engine merges
  its config — the precise bug the readme warns about ("an explicit `undefined`
  would overwrite a default").
- Uniform `{ cards, rows }` contract makes every screen a one-line render.
- Defensive formatting (`f`, `n`, `money`, `text`, `count`) keeps `undefined`
  and `NaN` out of the UI, which is the class of bug `ui-check` exists to catch.
- `text()` handles objects by falling back through `size → label → id`, which is
  what the engine result shapes actually need.
- Seven rule libraries, 173 rules, all searchable; the kitchen library lacks a
  search helper and the file compensates deliberately (documented).
- No DOM access anywhere, so the whole layer stays Node-probeable.

**Cons / gaps**

- **Silent defaults can mask a missing plan.** `footprint()` falls back to
  9 × 7 m and `framingResult` defaults spacing to 16 in. With no plan loaded the
  screens still render confident numbers for a house that does not exist.
  Defensible for a demo, dangerous if a user reads them as measurements.
- `rulesFor()` slices to 80 rows with no "showing 80 of 173" signal; a search
  that matches more than 80 rules silently hides the rest.
- `plumbingResult` builds a fixed `template: 'house'` layout from fixture counts
  rather than from the extracted plan, so plumbing quantities are only as good
  as the user's counts — fine, but the adapter's uniformity implies more.
- Kitchen rules search re-implements the match logic against different fields
  than the other libraries use; behaviour differs by library by design, which is
  not stated anywhere a user would see.
- No unit tests in this repo for the adapters beyond probe scripts that print
  (no assertions). A wrong number still prints and still "passes".

### 4.6 `static/assets/page-scripts/project-dashboard.js` — 105 lines

**Purpose:** paints the dashboard page from `dashboardState()`.

**Pros**

- **Escapes every interpolated value** (`escape()` over `& < > " '`), including
  `suite.page` in an `href` and `data-suite`. This is the only page script in
  the repo and it is the one handling harvested, user-influenced draft data, so
  getting this right matters.
- Injects its own CSS because the page's Tailwind stylesheet is not present —
  a pragmatic mitigation for R-1 (and a symptom of it).
- Cross-tab refresh via the `storage` event; guarded `getElementById` for every
  write; try/catch converts a corrupted draft into a visible status message
  instead of a blank page.
- Reads through `dashboardState(storage)` (verified signature:
  `export function dashboardState(storage = globalThis.localStorage)`), so the
  totals come from the same model the bid engine prices rather than a second
  calculation.
- Import path is correct on disk *and* over HTTP
  (`/assets/page-scripts/../../engines/...` → `static/engines/...`).

**Cons / gaps**

- Re-parses `localStorage` and re-renders the whole grid on every `storage`
  event, with no debounce.
- `state.suites.map(...)` is unguarded; a model change that drops `suites` turns
  the dashboard into the catch-block error message.
- The page it serves still references a non-existent
  `../features/dashboard/page.js`, so it loads one 404 script alongside this
  working one.
- Duplicate styling is now in two places (this file and the page's inline
  styles), which will disagree as soon as Tailwind returns.

### 4.7 `static/demo/farmhouse/manifest.js` — 200 lines

**Purpose:** the 32-sheet Southern Farmhouse drawing set.

**Pros**

- **Verified consistent:** 32 entries, 32 PNGs, 32 SVGs, every path resolved.
- Uniform shape (`n`, `png`, `pngBytes`, `svg`) with byte sizes that let the
  studio show sizes and lazy-load thumbnails without a HEAD request.
- Generated by a documented script (`port-farmhouse.mjs`), so regeneration is
  reproducible in principle.
- Data only — no logic to break, no imports to fail.

**Cons / gaps**

- `pngBytes` is a snapshot; regenerating the PNGs without re-running the port
  leaves the UI reporting stale sizes. Nothing validates it.
- No sheet dimensions or drawing scale per page. The studio says detection
  "stays on the small fixtures" because a dense sheet exceeds the 120 s budget —
  that limit is real, and the manifest gives a consumer no way to know a sheet's
  DPI before uploading it.
- Paths are relative to `static/`, so the manifest only works for a page served
  at `/` (the studio). `pages/demo.html` could not reuse it directly.
- The generation script it depends on is one of the `E:/floorplan_3d`-hardcoded
  ones (R-3), so the reproducibility claim is machine-specific.

### 4.8 `static/engines/README.md` — 42 lines

**Purpose:** vendoring rules, re-copy procedure, drift check.

**Pros**

- States the non-negotiable rule (files are verbatim, layout must match upstream)
  and explains *why* relative imports force it.
- Gives a `cmp` drift check that is exact rather than heuristic.
- Documents the one non-obvious dependency: stair/elevation modules import
  `three`, resolved by the import map in `static/index.html`, plus the
  `TransformControls` vendoring path.
- Points at the probes that would catch a missing module after a re-copy.

**Cons / gaps**

- `proj=$(pwd -W)` is Git-Bash-on-Windows only; the recipe does not run on Linux
  or macOS despite the repo shipping `libpdfium.so` guidance elsewhere.
- Assumes `E:\floorplan_3d`; no parameterisation, no submodule, no pinned commit.
  "Verbatim" is unverifiable on any other machine.
- References `tests/validateFeatureModules` in the upstream tree, which does not
  exist here — a reader may look for it and find nothing.
- Claims "66 files mirror upstream" implicitly, but records no manifest of names
  or hashes, so a deleted file is invisible to the `cmp` loop (it only checks
  files that are still present).

### 4.9 `pages/calc.html` — 264 lines

**Purpose:** five construction calculators behind tabs.

**Pros**

- Complete, semantic markup: one tab per calculator, labelled inputs with units
  in the label text and helper copy for the expected range, `selected` defaults
  that produce sensible results, result panels pre-built with stable ids.
- Metadata is thorough and consistent with the other pages (canonical, OG,
  Twitter, description).
- Loads the shared nav and the shared error reporter correctly (module vs
  classic script split is right).
- The copy states the method ("NDS bending stress and L/360 deflection", "order
  10% extra"), which is the right level of transparency for a calculator.

**Cons / gaps**

- **The page cannot do anything** (R-2). Its script is missing, so every
  `data-click` handler is unbound, the tabs never switch, results never appear
  and the theme toggle is dead.
- Unstyled: `assets/tailwind.css` and `assets/fonts/fonts.css` are both missing,
  so all the layout classes are inert.
- Accessibility gaps that survive even with the script: `<label>` elements are
  siblings of their inputs with no `for`/`id` pairing (clicking a label does not
  focus the field); result regions have no `aria-live`, so a screen reader user
  gets no announcement when a calculation completes; emoji icons are not
  `aria-hidden`.
- No `<form>`, so Enter does not submit and there is no native validation; the
  five calculators duplicate markup rather than sharing a field renderer.
- Buttons have no `type="button"`; harmless today only because there is no
  enclosing form.
- `data-args='["span"]'` embeds JSON in an attribute — legitimate, but it hardens
  the dependency on the missing dispatcher.

### 4.10 `readme.md` — 421 lines

**Pros**

- Unusually strong architecture documentation: it explains *why* the PDF path
  needs a render for opening symbols, why curves are counted rather than built,
  why the scale is read off dimension strings, and what the detector cannot do.
  Limitations get their own honest section.
- Flags are documented in a table with defaults, servers have documented env
  vars and status codes, the pipeline is drawn twice at different levels, and
  the engine table is complete — all 36 engine/adapter paths named there exist.
- Failure statuses (415/422/413/503/400) match the code and the tests.

**Cons / errors**

| Line | Problem | Correct value |
| --- | --- | --- |
| 206 | "`*/rules.js` \| 135 code rules" | **173** (30 + 28 + 24 + 26 + 27 + 7 + 31) |
| 229 | "searches all **five** libraries" | **seven** (framing, deck, lighting, plumbing, electrical, kitchen, landscape) |
| 414–421 | "Next step — PDF vector extraction via PDFium" | Already implemented and documented at length above it; the section is stale |
| 162 | "The plan **itsaves** is the one…" | "it saves" |

- The Project group table lists `Report` and `Code rules` without marking them
  studio-only; the shared page nav deliberately omits both. A reader of the table
  will look for `pages/report.html` and `pages/code-rules.html`, which do not
  exist.
- "Six small adapters" is accurate for *engine* adapters but there are seven more
  mapping modules in `static/` (`plan-items`, `plan-history`, `scene3d`,
  `pdf`, `report-data`, `report-pdf`, `nav-data`); the count is ambiguous rather
  than wrong.
- The UI-check section says screenshots land in `outputs/ui` and `outputs/` is
  described by `outputs/README.md`; that file exists, so the claim holds.

---

## 5. Prioritised backlog

| ID | Severity | Issue | Effort | Payoff |
| --- | --- | --- | --- | --- |
| R-1 | **P0** | Restore or repoint the `pages/` asset tree (`assets/`, `features/`, `docs/`, `editor/`, `app/`, `demo/`, `vendor/`) | M–L | 36 pages become styled; 11 pages gain behaviour |
| R-2 | **P0** | Provide `calc.js` (or wire `calc.html` to a real dispatcher) | S–M | A whole product page starts working |
| D-1 | **P1** | Fix readme rule count 135 → 173 | XS | Accuracy of the headline capability claim |
| D-2 | **P1** | Fix readme "five libraries" → seven | XS | Same |
| D-3 | **P1** | Replace the stale "Next step" section | XS | Removes a contradiction at the end of the doc |
| D-4 | **P2** | Fix "itsaves" typo; mark Report/Code rules studio-only in the table | XS | Polish |
| M-1 | **P2** | Fix `scaleSource` for raster uploads | XS | Correct provenance metadata |
| M-2 | **P2** | Fail on non-numeric CLI flags instead of falling back | S | A measuring tool stops producing silent wrong numbers |
| M-3 | **P2** | Prune or TTL `outputs/models/`, or namespace per session | S | Bounded disk use |
| M-4 | **P2** | Port/replace the `E:/floorplan_3d` helper scripts | S–M | Tooling works on this repo |
| M-5 | **P2** | Add CI running `cargo test` (and optionally `ui-check`) | S | Regression gate on the covered half |
| M-6 | **P3** | Make the PDF test fail, not skip, when PDFium is absent in CI | XS | Honest coverage |
| M-7 | **P3** | Add a link back to the studio in the shared nav | XS | Navigation symmetry |
| M-8 | **P3** | Persist `blueprintErrors` across documents; add an export hook | S | Achieves the file's stated goal |
| M-9 | **P3** | Add assertions to the probe scripts (they currently only print) | M | Numbers become tested, not merely rendered |

---

## 6. Architectural assessment

**What the design gets right**

- One extraction core, two front doors (CLI, HTTP) and one downstream plan
  contract. The `/api/plan` response, the `--write-plan` JSON and the test
  assertions all describe the same shape.
- CPU work is explicitly fenced off from the async runtime, and the concurrency
  limit is configurable and reported by `healthz`. That is more operational
  maturity than most tools this size have.
- The engines are vendored rather than reimplemented, and the bridge is a thin,
  DOM-free mapping layer — the most testable arrangement available without a
  build step.
- Screens are named once (`nav-data.js`) and consumed by two independent
  renderers, which prevents the classic duplicated-menu drift.
- Failure semantics are explicit: statuses over 200-with-a-complaint, and a
  health endpoint that tells you whether PDF support is actually available.

**Where the design is weak**

- **The front end has no build or copy step, so the pages depend on a directory
  layout that only exists on the machine the pages were exported from.** This is
  the root cause of R-1 and R-2; every individual 404 is a symptom.
- **Two asset conventions coexist:** the studio imports from `/` (static root)
  while the pages import from `../assets` (a root tree). Nothing reconciles
  them, and the server's fallback quietly hides half the mismatch.
- **Demo-quality defaults are indistinguishable from measurements.** The bridge
  falls back to a 9 × 7 m footprint and 16 in spacing; the studio will render
  those as results. Fine for a walkthrough, risky for a takeoff.
- **Verification is asymmetric:** the Rust half has 36 real tests, the JS half
  has probe scripts that print without asserting, and the browser half needs a
  manually started server plus Chrome. The most user-visible code is the least
  tested.
- **Single-file studio:** `static/app.js` is 2,341 lines with a hand-written
  view table. It works and is well commented, but it is the file most likely to
  accumulate the next ten screens.

---

## 7. Pros and cons at a glance

| | Pros | Cons |
| --- | --- | --- |
| **Rust** | Typed errors, bounded blocking pool, deadline, graceful shutdown, double upload checks, contract-level tests, optional PDFium with `healthz` | `scaleSource` wrong for rasters, silent CLI fallbacks, unbounded `outputs/models`, `f32` precision, PDF test skips silently |
| **Pages** | Complete semantic markup, consistent metadata, labels and units, shared nav/reporter wired, 37/37 have `lang`, viewport and title | 59 missing resources, all stylesheets absent, 24 page scripts absent, 11 suite `page.js` absent, 32 broken OG images |
| **Shared chrome** | One name source, accessible toggle (aria, Escape, focus return, outside click), no dependencies, idempotent | No studio link, duplicated breakpoint, CSS in a string, layout shift, errors not durable |
| **Adapters** | Load and run in Node, 173 rules across 7 libraries, `defined()` guard, uniform `{cards,rows}`, DOM-free | Silent demo defaults, 80-row truncation, kitchen search divergence, probes assert nothing |
| **Docs** | Deep architecture rationale, honest limitations, accurate flag/env/status tables, complete engine table | 2 wrong counts, 1 stale "Next step", 1 typo, studio-only screens unmarked |
| **Repo** | Clean `git` separation of outputs/target/pdfium artifacts, reproducible fixtures, 32/32 farmhouse assets | No CI, no licence, no lint config, 5 dead helper scripts, no manifest of vendored files |

---

## 8. Recommended sequence

1. **Decide the page asset strategy** (restore the root tree vs repoint to
   `static/`). Everything in P0 follows from that single decision.
2. **Make `calc.html` work** — it is the smallest complete demonstration that the
   strategy is right, and the highest-visibility broken page.
3. **Fix the four documentation errors** (minutes, and they misrepresent the
   product).
4. **Fix `scaleSource` and the non-numeric CLI fallbacks** — both are small and
   both concern numbers the tool claims to be authoritative about.
5. **Add `cargo test` to CI** and make the PDF test fail rather than skip when
   PDFium is expected; then consider running `ui-check` on a schedule.
6. **Port the five hardcoded helper scripts** or delete them, so no script in
   the repo claims a check it cannot run here.

---

## Appendix A — missing reference inventory

search 
## Appendix B — verified counts

| Assertion | Evidence |
| --- | --- |
| 36 Rust tests pass | `cargo test` → `36 passed; 0 failed` |
| `cargo check --all-targets` clean | exit 0 |
| All changed JS parses | `node --check` on 7 files |
| 173 code rules, 7 libraries | `ruleCount()` / `ruleLibraries` via `engines-bridge.js` |
| Rules per library | framing 30, deck 28, lighting 24, plumbing 26, electrical 27, kitchen 7, landscape 31 |
| 37 pages, 37 with `lang`/viewport/title | `grep -l` over `pages/*.html` |
| 36 pages reference `assets/tailwind.css` | none of which exists |
| 25 pages reference `assets/page-scripts/` | one such script exists |
| 11 pages reference `features/*/page.js` | no `features/` root |
| 23 `../docs/` references (13 distinct) | no `docs/` root |
| 32 pages reference missing OG images | `../assets/images/` |
| 5 pages use `data-click` | all of them lack a binder |
| Farmhouse manifest 32 sheets / 32 PNG / 32 SVG | directory counts |
| 66 mirrored engine modules | `find static/engines -name '*.js'` |
