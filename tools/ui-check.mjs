// Drives the studio in headless Chrome over CDP, with nothing to install: Node 24
// has a global WebSocket. Visits each screen, records console errors and
// exceptions, probes the rendered DOM for blank canvases, unmounted viewers and
// undefined/NaN text, uploads the fixture through the Plan studio form, follows
// that plan into every screen, reloads a deep link, and writes screenshots and
// report.json under OUT. Exits non-zero when any screen is flagged, so a change
// can be gated on it.
//
//   cargo run                                   # the server, on :3000
//   chrome --headless=new --remote-debugging-port=9223 \
//          --user-data-dir=.cdp --enable-unsafe-swiftshader about:blank
//   node tools/ui-check.mjs
//
// Environment: BASE (http://127.0.0.1:3000), CDP_PORT (9223), ROUTES (JSON
// array of screens), OUT (outputs/ui), FIXTURE (fixtures/floor_plan.png),
// SHOTS=0 to skip the screenshots, ELEVATIONS=0 to skip the elevation sweep.
// With scene-3d in the route list it also frames the four elevation sides, renders
// each one to an image and compares it with the baseline recorded in
// OUT/baseline, so a change in what an elevation looks like fails the run instead
// of only being visible in report.json. Re-record the baselines after an intended
// change with UPDATE_BASELINES=1.
// Run it from the repository root: the fixture path and the screenshot directory
// are relative to it.
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const PORT = Number(process.env.CDP_PORT || 9223);
const OUT = process.env.OUT || 'outputs/ui';
const FIXTURE = process.env.FIXTURE || 'fixtures/floor_plan.png';
const SHOTS = process.env.SHOTS !== '0';
const ELEVATIONS = process.env.ELEVATIONS !== '0';
// The recorded elevation images: one PNG per side plus the manifest that says
// which bytes each one is. Kept under OUT so a run writes nothing outside it.
const BASELINE_DIR = process.env.BASELINES || `${OUT}/baseline`;
const BASELINE_MANIFEST = `${BASELINE_DIR}/elevations.json`;
const UPDATE_BASELINES = process.env.UPDATE_BASELINES === '1';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function devtoolsWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* chrome still starting */ }
    await sleep(250);
  }
  throw new Error('no devtools page target');
}

const ws = new WebSocket(await devtoolsWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let nextId = 1;
const pending = new Map();
let events = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
  } else if (msg.method) {
    events.push(msg);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = nextId++;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
// A heuristically cached app.js makes every probe test the previous build.
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('DOM.enable');

const failed = [];
ws.addEventListener('message', () => {}); // keep reference

async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description || exceptionDetails.text || 'eval threw');
  }
  return result.value;
}

function drainProblems() {
  const out = [];
  for (const ev of events) {
    if (ev.method === 'Runtime.exceptionThrown') {
      const d = ev.params.exceptionDetails;
      out.push(`exception: ${d.exception?.description || d.text} @ ${d.url || ''}:${d.lineNumber}`);
    } else if (ev.method === 'Runtime.consoleAPICalled' && ev.params.type === 'error') {
      out.push(`console.error: ${ev.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}`);
    } else if (ev.method === 'Log.entryAdded' && ev.params.entry.level === 'error') {
      out.push(`log: ${ev.params.entry.text} ${ev.params.entry.url || ''}`);
    }
  }
  events = [];
  return out;
}

const PROBE = `(() => {
  const view = document.getElementById('view');
  const text = view ? view.innerText : '';
  const canvases = [...document.querySelectorAll('canvas')].map((c) => {
    let painted = -1;
    try {
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]) { n++; if (n > 50) break; }
      painted = n;
    } catch (e) { painted = -2; }
    return { cls: c.className, w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, painted };
  });
  return {
    hash: location.hash,
    h2: view?.querySelector('h2')?.textContent ?? null,
    navLinks: document.querySelectorAll('#nav a').length,
    viewChildren: view ? view.children.length : -1,
    textLen: text.length,
    bad: {
      undefined: (text.match(/undefined/g) || []).length,
      NaN: (text.match(/NaN/g) || []).length,
      objectObject: (text.match(/\\[object Object\\]/g) || []).length,
      nul: (text.match(/\\bnull\\b/g) || []).length,
    },
    tables: view ? view.querySelectorAll('table.t').length : 0,
    tableRows: view ? view.querySelectorAll('table.t tr').length : 0,
    cards: view ? view.querySelectorAll('.card').length : 0,
    forms: view ? view.querySelectorAll('input,select').length : 0,
    canvases,
    viewers: [...document.querySelectorAll('.viewer')].map((v) => ({
      canvases: v.querySelectorAll('canvas').length,
      w: v.clientWidth, h: v.clientHeight,
      cw: v.querySelector('canvas')?.width || 0,
      ch: v.querySelector('canvas')?.height || 0,
      empty: Boolean(v.querySelector('.viewer-empty')),
    })),
    // The 3D viewer publishes its mesh counts, so a wall built around an
    // opening can be told from a wall drawn as if there were none.
    viewerStats: (() => { try { return document.querySelector('.viewer')?.__viewer?.stats?.() ?? null; } catch { return null; } })(),
    webgl2: (() => { try { return Boolean(document.createElement('canvas').getContext('webgl2')); } catch { return false; } })(),
    status: document.getElementById('status')?.textContent ?? null,
    hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyH: document.body.scrollHeight,
  };
})()`;

const ROUTES = JSON.parse(process.env.ROUTES
  || '["index","plan-studio","editor","scene-2d","scene-3d","wall-designer","calc"]');
const results = [];
// One count per screen or interaction that came back flagged.
let failures = 0;

async function visit(route, { shot = false } = {}) {
  await send('Page.navigate', { url: `${BASE}/#/${route}` });
  await sleep(700);
  let probe;
  try {
    probe = await evaluate(PROBE);
  } catch (err) {
    probe = { error: String(err.message) };
  }
  const problems = drainProblems();
  if (shot && SHOTS) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${route.replace(/[^\w-]/g, '_')}.png`, Buffer.from(data, 'base64'));
  }
  const row = { route, ...probe, problems };
  results.push(row);
  const flags = [];
  if (row.error) flags.push(row.error);
  if (problems.length) flags.push(`${problems.length} console error(s)`);
  if (row.bad) {
    for (const [k, v] of Object.entries(row.bad)) if (v) flags.push(`${v}×${k}`);
  }
  if (row.hOverflow > 2) flags.push(`h-overflow ${row.hOverflow}px`);
  if (row.viewChildren === 0) flags.push('empty view');
  if (row.canvases?.some((c) => c.painted === 0)) flags.push('blank canvas');
  if (row.viewers?.some((v) => v.canvases === 0 || v.empty)) flags.push('viewer not mounted');
  console.log(`${flags.length ? 'FAIL' : ' ok '} #/${route}  h2=${JSON.stringify(row.h2)} ` +
    `children=${row.viewChildren} tables=${row.tables} cards=${row.cards} forms=${row.forms} ` +
    `canvas=${row.canvases?.map((c) => `${c.cls}:${c.cw}x${c.ch}:p${c.painted}`).join(',') || '-'}` +
    (row.viewers?.length ? ` viewer=${row.viewers.map((v) => `${v.cw}x${v.ch}/${v.canvases}cv${v.empty ? ' empty' : ''}`).join(',')}` : '') +
    (row.viewerStats ? ` meshes=${JSON.stringify(row.viewerStats)}` : '') +
    (flags.length ? `\n      -> ${flags.join(' | ')}` : ''));

  // interaction: nudge the first numeric input and make sure the output survives
  const bug = await evaluate(`(() => {
    const input = document.querySelector('#view .grid input[type=number]');
    if (!input) return null;
    const before = document.querySelector('#view .out')?.innerText || '';
    input.value = String(Number(input.value) + 1);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const after = document.querySelector('#view .out')?.innerText || '';
    return { changed: before !== after, afterLen: after.length };
  })()`);
  if (bug && !bug.changed && route.includes('designer')) {
    console.log(`      -> input change did not recompute (${route})`);
    row.problems.push('input did not recompute');
  }
  if (flags.length || row.problems.length) failures += 1;
  return row;
}

// 1. empty state (fresh profile: no localStorage plan)
await send('Page.navigate', { url: `${BASE}/#/index` });
await sleep(300);
// A hash-only navigation keeps the previous document, and with it the previous
// app.js module, so reload with the cache ignored to test what is on disk now.
await send('Page.reload', { ignoreCache: true });
await sleep(1200);
console.log('nav links:', await evaluate(`document.querySelectorAll('#nav a').length`));
drainProblems();

const EMPTY = ['index', 'plan-studio', 'editor', 'app'];
for (const route of EMPTY) await visit(route, { shot: route === 'index' || route === 'plan-studio' });

// 2. upload the fixture through the Plan studio form, like a user
await send('Page.navigate', { url: `${BASE}/#/plan-studio` });
await sleep(800);
drainProblems();
const doc = await send('DOM.getDocument', { depth: -1 });
const { nodeId } = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
const abs = process.cwd().replace(/\\/g, '/');
await send('DOM.setFileInputFiles', { nodeId, files: [`${abs}/${FIXTURE}`] });
await evaluate(`document.getElementById('go').click()`);
await sleep(2500);
const upload = await evaluate(`({ msg: document.getElementById('msg')?.textContent, status: document.getElementById('status')?.textContent, h2: document.querySelector('#view h2')?.textContent, tables: document.querySelectorAll('#view table.t tr').length, canvas: (() => { const c = document.querySelector('canvas.wire'); if (!c) return null; const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<d.length;i+=4) if (d[i]) n++; return { w:c.width, h:c.height, painted:n }; })() })`);
const uploadProblems = drainProblems();
if (uploadProblems.length) failures += 1;
console.log('upload ->', JSON.stringify(upload), uploadProblems.length ? `errors: ${uploadProblems.join(' | ')}` : 'no console errors');
{
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${OUT}/plan-studio-loaded.png`, Buffer.from(data, 'base64'));
}

// 3. every screen with the plan loaded
const shots = new Set(['scene-2d', 'scene-3d', 'editor', 'wall-designer', 'framing-designer', 'roof-designer', 'stair-designer', 'bid-builder', 'calc', 'gallery']);
for (const route of ROUTES) await visit(route, { shot: shots.has(route) });

// 4. elevation sides: set the side, carry it into the screenshot, compare views.
const SIDES = ['front', 'back', 'left', 'right'];
const elevationRows = [];
// The captured PNG of each view, keyed by the side name the row carries.
const elevationBytes = new Map();

const hashOf = (bytes) => createHash('sha256').update(bytes).digest('hex');

function loadBaseline() {
  try { return JSON.parse(fs.readFileSync(BASELINE_MANIFEST, 'utf8')); } catch { return null; }
}

/** Record what each elevation looks like now, images next to the manifest. */
function writeBaseline() {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  const views = {};
  for (const row of elevationRows) {
    const bytes = elevationBytes.get(row.side);
    if (!bytes) continue;
    fs.writeFileSync(`${BASELINE_DIR}/${row.side}.png`, bytes);
    views[row.side] = {
      hash: hashOf(bytes),
      bytes: bytes.length,
      width: row.width,
      height: row.height,
      hidden: row.hidden,
      active: row.active,
    };
  }
  fs.writeFileSync(BASELINE_MANIFEST, `${JSON.stringify({
    note: 'Elevation baselines for tools/ui-check.mjs. Re-record with UPDATE_BASELINES=1.',
    plan: upload?.status ?? null,
    views,
  }, null, 2)}\n`);
  return views;
}

/** Every way the live view has drifted from what was recorded. */
function compareBaseline(baseline) {
  const problems = [];
  for (const row of elevationRows) {
    const expected = baseline?.views?.[row.side];
    row.baseline = expected?.hash ?? null;
    if (!expected) {
      problems.push(`no stored baseline for ${row.side}`);
      continue;
    }
    const bytes = elevationBytes.get(row.side);
    if (!bytes) {
      problems.push(`${row.side} rendered nothing to compare`);
      continue;
    }
    if (expected.width !== row.width || expected.height !== row.height) {
      problems.push(`${row.side} canvas resized ${expected.width}x${expected.height} -> ${row.width}x${row.height}`);
    }
    if (expected.hash !== hashOf(bytes)) {
      problems.push(`${row.side} changed: ${expected.hash.slice(0, 16)}/${expected.bytes}B -> ${row.hash}/${row.bytes}B`);
      continue;
    }
    // The stored image has to be the one the manifest describes, or a stale
    // picture would pass as a baseline nobody can look at.
    let stored = null;
    try { stored = fs.readFileSync(`${BASELINE_DIR}/${row.side}.png`); } catch { /* reported below */ }
    if (!stored) problems.push(`${row.side} baseline image is missing (${row.side}.png)`);
    else if (hashOf(stored) !== expected.hash) problems.push(`${row.side} baseline image no longer matches its manifest hash`);
    if ((expected.hidden || []).join(',') !== (row.hidden || []).join(',')) {
      problems.push(`${row.side} cuts different walls than the baseline`);
    }
  }
  return problems;
}

async function elevationView(side) {
  const refused = await evaluate(`(() => {
    const select = document.querySelector('#elev3');
    if (!select) return 'no elevation select';
    select.value = ${JSON.stringify(side)};
    select.dispatchEvent(new Event('change'));
    return null;
  })()`);
  if (refused) return { side, error: refused };
  await sleep(600);

  // Render once and read the drawing buffer: a clipped page screenshot leaves
  // the WebGL canvas out, which would make every side compare identical.
  const state = await evaluate(`(() => {
    const viewer = document.querySelector('#scene-3d-host')?.__viewer;
    if (!viewer) return { error: 'viewer not mounted' };
    const camera = viewer.elevation ? viewer.elevationCamera : viewer.camera;
    viewer.renderer.render(viewer.scene, camera);
    return {
      active: viewer.elevation,
      ortho: Boolean(viewer.elevationCamera.isOrthographicCamera),
      hidden: viewer.wallMeshes.map((mesh, index) => (mesh.visible ? -1 : index)).filter((index) => index >= 0),
      total: viewer.wallMeshes.length,
      width: viewer.renderer.domElement.width,
      height: viewer.renderer.domElement.height,
      dataUrl: viewer.renderer.domElement.toDataURL('image/png'),
    };
  })()`);
  if (state.error) return { side, error: state.error };

  const bytes = Buffer.from(String(state.dataUrl).split(',')[1] || '', 'base64');
  const name = side === '' ? 'perspective' : side;
  elevationBytes.set(name, bytes);
  if (SHOTS) fs.writeFileSync(`${OUT}/elevation-${name}.png`, bytes);
  return {
    side,
    active: state.active,
    ortho: state.ortho,
    hidden: state.hidden,
    total: state.total,
    width: state.width,
    height: state.height,
    hash: createHash('sha256').update(bytes).digest('hex').slice(0, 16),
    bytes: bytes.length,
  };
}

async function elevationSweep() {
  console.log('\nelevation sweep');
  // The sweep drives the scene-3d screen itself, from a fresh mount: a route list
  // can end on a page with no viewer, and the visit before it may have nudged a
  // form field (a hash-only navigate would keep that page alive).
  await send('Page.navigate', { url: `${BASE}/#/scene-3d` });
  await sleep(400);
  await send('Page.reload', { ignoreCache: true });
  await sleep(1200);
  // The reload asks for favicon.ico, which this server does not serve: that 404
  // is browser noise, not a screen error. Anything else here is real, since the
  // page was just loaded fresh.
  const settled = drainProblems().filter((problem) => !/favicon\.ico/.test(problem));
  if (settled.length) {
    failures += 1;
    console.log(`      -> scene-3d reported ${settled.length} console error(s): ${settled.join(' | ')}`);
  }
  for (const side of ['perspective', ...SIDES]) {
    const view = await elevationView(side === 'perspective' ? '' : side);
    // The requested label is what gets compared against viewer.elevation.
    const row = { ...view, side };
    elevationRows.push(row);
    console.log(`${row.error ? 'FAIL' : ' ok '} ${side.padEnd(11)} ` + (row.error
      ? row.error
      : `active=${row.active} ortho=${row.ortho} hidden=${row.hidden.length}/${row.total} ` +
        `image=${row.hash} ${row.bytes}B ${row.width}x${row.height}`));
  }

  const sides = elevationRows.filter((row) => row.side !== 'perspective');
  const hiddenKey = (row) => (row.hidden || []).join(',');
  const problems = [];
  if (elevationRows.some((row) => row.error)) problems.push('a side did not apply');
  if (sides.some((row) => row.active !== row.side)) problems.push('active side does not match the request');
  if (sides.some((row) => !row.ortho)) problems.push('a side is not orthographic');
  if (sides.some((row) => !row.hidden?.length)) problems.push('a side did not cut the near wall');
  const hashes = new Set(elevationRows.map((row) => row.hash).filter(Boolean));
  if (hashes.size !== elevationRows.length) problems.push('two views rendered the same pixels');
  if (hiddenKey(sides[0]) === hiddenKey(sides[1])) problems.push('front and back hide the same walls');
  if (hiddenKey(sides[2]) === hiddenKey(sides[3])) problems.push('left and right hide the same walls');

  // The pixels themselves, against the recorded images: a shading, framing or
  // visibility change is a failure here, not a note in report.json.
  const baseline = loadBaseline();
  if (UPDATE_BASELINES || !baseline) {
    const ready = elevationRows.every((row) => !row.error) && elevationBytes.size === elevationRows.length;
    if (ready) {
      const views = writeBaseline();
      console.log(`      -> ${UPDATE_BASELINES ? 're-recorded' : 'recorded'} ${Object.keys(views).length} baselines in ${BASELINE_MANIFEST}`);
    } else {
      problems.push('baselines could not be recorded: a view failed to render');
    }
  } else {
    const drift = compareBaseline(baseline);
    console.log(drift.length
      ? `      -> baseline drift in ${drift.length} view(s)`
      : '      -> all five views match the stored baselines');
    problems.push(...drift);
  }

  if (problems.length) failures += 1;
  console.log(problems.length
    ? `      -> ${problems.join(' | ')}`
    : '      -> four sides differ in pixels and in which walls they cut');
}

if (ELEVATIONS && ROUTES.includes('scene-3d')) await elevationSweep();

// 5. persistence across reload, and a deep-link straight into a screen
await send('Page.navigate', { url: `${BASE}/#/wall-designer` });
await sleep(500);
await send('Page.reload', {});
await sleep(1200);
const persist = await evaluate(`({ status: document.getElementById('status')?.textContent, h2: document.querySelector('#view h2')?.textContent, rows: document.querySelectorAll('#view table.t tr').length })`);
console.log('reload #/wall-designer ->', JSON.stringify(persist));
drainProblems();

fs.writeFileSync(`${OUT}/report.json`,
  JSON.stringify({ upload, uploadProblems, persist, elevations: elevationRows, results }, null, 2));
console.log('\nwrote', `${OUT}/report.json`, `(${results.length} routes)`);
console.log(failures ? `${failures} screen(s) flagged` : 'every screen passed');
ws.close();
process.exit(failures ? 1 : 0);
