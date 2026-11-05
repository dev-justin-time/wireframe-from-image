// Blueprint Studio — the floorplan3d screens over the image→plan extractor.
// The plan comes from POST /api/plan, the wireframe from the OBJ the server
// writes, each designer computes from the plan plus inputs, and the 3D scene
// runs on the vendored three.js build under vendor/three.
import { PlanViewer } from './scene3d.js';

import {
  framingResult,
  framingCatalog,
  deckResult,
  roofResult,
  electricalResult,
  plumbingResult,
  lightingResult,
  finishResult,
  finishCatalog,
  lightingCatalog,
  ruleLibraries,
  rulesFor,
  ruleCount,
} from './engines-bridge.js';
import {
  kitchenResult,
  landscapeResult,
  bidResult,
  scheduleResult,
  priceBookResult,
  projectRollup,
  kitchenCatalog,
  waterCatalog,
} from './engines-extra.js';
import {
  straightStairResult,
  turnStairResult,
  spiralStairResult,
  steepStairResult,
} from './stairs-bridge.js';
import {
  planFromWalls, addWall, removeWall, snapPoint, canvasView, planCorners, moveCorner,
} from './plan-edit.js';
import { planFromDxf, planFromGeo } from './plan-import.js';
import { layerModel, drawLayer, LAYER_OPTIONS } from './plan-layers.js';
import { apply3DAbilities } from './engines/scene/scene-abilities.js';

const GROUPS = [
  ['Design', ['plan-studio', 'editor', 'scene-2d', 'scene-3d', 'app', 'wall-designer', 'kitchen-designer', 'toolbox', 'demo', 'webgpu-demo']],
  ['Structure', ['framing-designer', 'deck-designer', 'roof-designer', 'stair-designer', 'stair-l-designer',
    'stair-u-designer', 'stair-spiral-designer', 'stair-steep-designer', 'stair-gallery', 'stair-parts',
    'stair-glossary', 'foundation-designer']],
  ['Systems', ['electrical-designer', 'lighting-designer', 'plumbing-designer']],
  ['Site', ['landscape-designer', 'site-plan']],
  ['Project', ['project-dashboard', 'project-schedule', 'permits-inspections', 'bid-builder', 'price-book',
    'pricing', 'calc', 'code-rules']],
  ['About', ['index', 'features', 'gallery', 'about', 'contact']],
];

const TITLES = {
  'plan-studio': 'Plan studio', 'code-rules': 'Code rules', editor: 'Editor', 'scene-2d': '2D scene', 'scene-3d': '3D scene',
  app: 'App', 'wall-designer': 'Wall designer',
  'kitchen-designer': 'Kitchen designer', toolbox: 'Toolbox', demo: 'Demo', 'webgpu-demo': 'WebGPU demo',
  'framing-designer': 'Framing designer', 'deck-designer': 'Deck designer', 'roof-designer': 'Roof designer',
  'stair-designer': 'Stair designer', 'stair-l-designer': 'L stair', 'stair-u-designer': 'U stair',
  'stair-spiral-designer': 'Spiral stair', 'stair-steep-designer': 'Steep stair', 'stair-gallery': 'Stair gallery',
  'stair-parts': 'Stair parts', 'stair-glossary': 'Stair glossary', 'foundation-designer': 'Foundation designer',
  'electrical-designer': 'Electrical designer', 'lighting-designer': 'Lighting designer',
  'plumbing-designer': 'Plumbing designer', 'landscape-designer': 'Landscape designer', 'site-plan': 'Site plan',
  'project-dashboard': 'Project dashboard', 'project-schedule': 'Schedule', 'permits-inspections': 'Permits and inspections',
  'bid-builder': 'Bid builder', 'price-book': 'Price book', pricing: 'Pricing', calc: 'Calculator',
  index: 'Home', features: 'Features', gallery: 'Gallery', about: 'About', contact: 'Contact',
};

// The last detected plan is kept in this browser, so a reload does not throw
// away the plan every other screen reads. The OBJ stays on the server under
// outputs/, so the wireframe survives a reload as long as the server is up.
const STORE_KEY = 'blueprint3d.plan';

function loadPlan() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const ok = saved && Array.isArray(saved.walls) && Array.isArray(saved.rooms) && saved.takeoff;
    return ok ? saved : null;
  } catch {
    return null;
  }
}

function savePlan(plan) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}

function clearPlan() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* storage blocked */ }
  state.data = null;
}

const state = { data: loadPlan() };

// The 3D screen owns a WebGL context and an animation loop; the router stops it
// when another screen takes over.
let activeViewer = null;

const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const f = (v, d = 2) => (Number.isFinite(Number(v)) ? Number(v) : 0).toFixed(d);
const ceil = (v) => Math.ceil(Math.max(v, 0) - 1e-9);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const data = () => state.data;
const takeoff = () => state.data?.takeoff ?? null;
const wallLen = (fallback = 24) => takeoff()?.wallLength ?? fallback;
const floorArea = (fallback = 60) => takeoff()?.floorArea ?? fallback;
const spacer = (fallback = 406) => state.data?.studSpacingMm ?? fallback;
const height = (fallback = 2.7) => state.data?.wallHeight ?? fallback;

function table(rows) {
  return `<table class="t">${rows.map(([label, value, unit]) =>
    `<tr><th>${label}</th><td>${value}</td><td class="u">${unit ?? ''}</td></tr>`).join('')}</table>`;
}

function cards(list) {
  return `<div class="cards">${list.map(([value, label, sub]) =>
    `<div class="card"><b>${value}</b><span>${label}${sub ? ` · ${sub}` : ''}</span></div>`).join('')}</div>`;
}

function field(input) {
  if (input.type === 'select') {
    const options = input.options.map(([value, label]) =>
      `<option value="${esc(value)}"${String(value) === String(input.value) ? ' selected' : ''}>${esc(label)}</option>`).join('');
    return `<label><span>${input.label}</span><select data-k="${input.k}">${options}</select>${input.unit ? `<em>${input.unit}</em>` : ''}</label>`;
  }
  return `<label><span>${input.label}</span><input data-k="${input.k}" type="number" step="any" value="${input.value}">${input.unit ? `<em>${input.unit}</em>` : ''}</label>`;
}

function designer({ title, blurb, fields, compute }) {
  return (root) => {
    const spec = fields();
    root.innerHTML = `<h2>${title}</h2><p class="note">${blurb}</p>
      <div class="grid">${spec.map(field).join('')}</div><div class="out"></div>`;
    const out = root.querySelector('.out');
    const run = () => {
      const values = {};
      // A select carries a word ('arch', 'metal'), not a number: keep its option
      // value, or a lookup table keyed by that word returns undefined and the
      // output reads NaN. Number inputs stay numbers.
      root.querySelectorAll('[data-k]').forEach((input) => {
        values[input.dataset.k] = input.tagName === 'SELECT' ? input.value : num(input.value, 0);
      });
      const result = compute(values);
      out.innerHTML = (result.cards ? cards(result.cards) : '') + (result.rows ? table(result.rows) : '');
    };
    root.querySelectorAll('[data-k]').forEach((input) => input.addEventListener('input', run));
    run();
  };
}

// ---- wireframe -------------------------------------------------------------

async function drawObj(canvas, url, rooms = []) {
  const text = await fetch(url).then((r) => r.text());
  const verts = [];
  const edges = [];
  for (const raw of text.split('\n')) {
    const parts = raw.trim().split(/\s+/);
    if (parts[0] === 'v') verts.push([+parts[1], +parts[2]]);
    else if (parts[0] === 'l') edges.push([+parts[1] - 1, +parts[2] - 1]);
  }
  if (!verts.length) return;
  const xs = verts.map((v) => v[0]);
  const ys = verts.map((v) => v[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const ctx = canvas.getContext('2d');
  let zoom = 1, panX = 0, panY = 0;

  // Room polygons arrive in metres; the OBJ is in detector pixels, one axis
  // for both (plan.rs scales x and y by the same mm/px, y down as in the image).
  const pxPerM = 1000 / (num(state.data?.mmPerPx, 10) || 10);
  const fills = ['rgba(56,189,248,0.11)', 'rgba(74,222,128,0.11)', 'rgba(251,191,36,0.11)'];
  const roomsPx = rooms
    .filter((room) => Array.isArray(room.polygon) && room.polygon.length > 2)
    .map((room) => room.polygon.map(([x, y]) => [num(x) * pxPerM, num(y) * pxPerM]));

  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w / Math.max(maxX - minX, 1), h / Math.max(maxY - minY, 1)) * 0.88 * zoom;
    const ox = (w - (maxX - minX) * scale) / 2 + panX;
    const oy = (h - (maxY - minY) * scale) / 2 + panY;
    roomsPx.forEach((polygon, index) => {
      ctx.beginPath();
      polygon.forEach(([x, y], point) => {
        const px = ox + (x - minX) * scale;
        const py = oy + (y - minY) * scale;
        if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = fills[index % fills.length];
      ctx.fill();
      ctx.strokeStyle = fills[index % fills.length].replace(/0\.11\)$/, '0.45)');
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const [a, b] of edges) {
      const p = verts[a], q = verts[b];
      if (!p || !q) continue;
      ctx.moveTo(ox + (p[0] - minX) * scale, oy + (p[1] - minY) * scale);
      ctx.lineTo(ox + (q[0] - minX) * scale, oy + (q[1] - minY) * scale);
    }
    ctx.stroke();
  };

  let drag = null;
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom *= e.deltaY < 0 ? 1.1 : 0.9; draw(); });
  canvas.addEventListener('pointerdown', (e) => { drag = [e.offsetX, e.offsetY]; });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    panX += e.offsetX - drag[0]; panY += e.offsetY - drag[1];
    drag = [e.offsetX, e.offsetY]; draw();
  });
  window.addEventListener('pointerup', () => { drag = null; });
  window.addEventListener('resize', draw);
  draw();
}

function download(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function setStatus() {
  const el = document.getElementById('status');
  if (!state.data) { el.textContent = 'no plan loaded'; return; }
  const d = state.data;
  el.textContent = `${d.project || 'plan'} · ${d.rooms.length} rooms · ${d.walls.length} walls · ${f(d.takeoff.floorArea, 1)} m²`;
}

function planResult(host) {
  const d = data();
  if (!d) { host.innerHTML = '<p class="hint">No plan yet — open <a href="#/plan-studio">Plan studio</a> and upload a drawing.</p>'; return; }
  const t = d.takeoff ?? {};
  // An edited or imported plan has no wireframe on the server: the OBJ was
  // written from the upload the edit started from, so it is not offered.
  const drawn = Boolean(d.obj);
  const source = d.mmPerPx
    ? [d.segments, 'segments', `${f(d.mmPerPx, 1)} ${d.source === 'pdf' ? 'mm/pt' : 'mm/px'}`
      + (d.source === 'pdf'
        ? ` · PDF vectors${d.scaleSource === 'dimension' ? ' · scale read from the drawing' : ''}`
        : '')]
    : [d.walls.length, 'walls', d.source === 'dxf' ? 'imported from DXF'
      : d.source === 'geo'
        ? `imported from ${String(d.imported?.kind ?? 'kml').toUpperCase()}`
        : 'drawn in the editor'];
  const rows = [
    ['Wall length', f(t.wallLength), 'm'],
    ['Wall area (gross)', t.wallGrossArea === undefined ? undefined : f(t.wallGrossArea), 'm²'],
    ['Openings', t.doors === undefined && t.windows === undefined ? undefined
      : `${t.doors ?? 0} door · ${t.windows ?? 0} window`,
    t.openingArea === undefined ? '' : `${f(t.openingArea)} m²`],
    ['Wall area (net)', t.wallNetArea !== undefined ? f(t.wallNetArea)
      : (t.wallGrossArea === undefined ? undefined : f(t.wallGrossArea)), 'm²'],
    ['Floor area', f(t.floorArea), 'm²'],
    ['Volume', t.volume === undefined ? undefined : f(t.volume), 'm³'],
    ['Drywall', t.drywallSheets, 'sheets'],
    ['Paint', t.paintLitres, 'L'],
    ['Flooring (+10%)', t.flooringM2 === undefined ? undefined : f(t.flooringM2), 'm²'],
    ['Baseboard', t.baseboardM === undefined ? undefined : f(t.baseboardM), 'm'],
    ['Studs', t.studs, 'ea'],
    ['Plates', t.platesM === undefined ? undefined : f(t.platesM), 'm'],
    ['Sheathing', t.sheathingPanels, 'panels'],
  ].filter(([, value]) => value !== undefined && value !== null);
  host.innerHTML = `
    ${cards([
      [d.walls.length, 'walls', `${f(t.wallLength, 2)} m`],
      [d.rooms.length, 'rooms', `${f(t.floorArea, 2)} m²`],
      [f(t.floorArea, 1), 'm² floor', t.volume === undefined ? '' : `${f(t.volume, 1)} m³`],
      source,
    ])}
    ${drawn ? '<canvas class="wire" id="wire"></canvas>' : ''}
    <p class="hint">${t.stale
    ? 'Areas and wall lengths are recomputed from the edited walls; the sheet quantities below are from the upload the edit started from. '
    : ''}${drawn ? 'Room polygons are filled behind the walls. Drag to pan, wheel to zoom. ' : ''}
      The plan is saved in this browser, so every screen keeps it after a reload.
      ${drawn ? `<a class="btn" href="${d.obj}" download>Download OBJ</a>` : ''}
      ${d.gltf ? `<a class="btn" href="${d.gltf}" download>Download glTF</a>` : ''}
      <a class="btn" href="#" id="dl-plan">Download plan JSON</a></p>
    ${table(rows)}`;
  if (drawn) drawObj(host.querySelector('#wire'), d.obj, d.rooms).catch(() => {});
  host.querySelector('#dl-plan').onclick = (e) => {
    e.preventDefault();
    download(`${d.project || 'plan'}.json`, JSON.stringify(d.plan ?? d, null, 2));
  };
}

// ---- 2D and 3D scenes ------------------------------------------------------

// The detector returns wall centre lines, not thicknesses, so both scenes draw
// a nominal wall; the takeoff still measures on the centre line.
const NOMINAL_WALL_MM = 100;

// Two palettes for the 2D scene: the site's drawing sheet, and the studio's dark
// viewport.
const SCENE_THEMES = {
  sheet: {
    bg: '#f8fafc',
    gridMinor: 'rgba(15,23,42,0.05)',
    gridMajor: 'rgba(15,23,42,0.12)',
    roomFills: ['rgba(56,189,248,0.07)', 'rgba(34,197,94,0.07)', 'rgba(234,179,8,0.09)', 'rgba(168,85,247,0.07)'],
    roomStroke: 'rgba(15,23,42,0.22)',
    wallFill: '#0f172a',
    wallStroke: '#0f172a',
    label: '#0f172a',
    labelSub: '#475569',
    dimStroke: 'rgba(71,85,105,0.55)',
    dimText: '#475569',
  },
  dark: {
    bg: '#070d19',
    gridMinor: 'rgba(56,189,248,0.06)',
    gridMajor: 'rgba(56,189,248,0.16)',
    roomFills: ['rgba(56,189,248,0.10)', 'rgba(74,222,128,0.10)', 'rgba(251,191,36,0.10)', 'rgba(168,85,247,0.10)'],
    roomStroke: 'rgba(56,189,248,0.35)',
    wallFill: '#16304f',
    wallStroke: '#38bdf8',
    label: 'rgba(226,232,240,0.85)',
    labelSub: 'rgba(148,163,184,0.85)',
    dimStroke: 'rgba(148,163,184,0.5)',
    dimText: '#94a3b8',
  },
};

function planGeometry() {
  const d = data();
  if (!d) return null;
  const walls = (d.walls || [])
    .map((w) => ({ x1: num(w.x1), y1: num(w.y1), x2: num(w.x2), y2: num(w.y2) }))
    .filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 1e-6);
  if (!walls.length) return null;
  const rooms = (d.rooms || [])
    .map((r) => ({
      name: r.name || 'Room',
      area: num(r.area),
      polygon: (r.polygon || []).map(([x, y]) => [num(x), num(y)]),
    }))
    .filter((r) => r.polygon.length > 2);
  // Already classified by the extractor: the scenes only have to draw them.
  const openings = (d.openings || [])
    .map((o) => ({
      kind: o.kind === 'window' ? 'window' : 'door',
      x1: num(o.x1),
      y1: num(o.y1),
      x2: num(o.x2),
      y2: num(o.y2),
      width: num(o.width),
      sill: num(o.sill),
      head: num(o.head),
    }))
    .filter((o) => [o.x1, o.y1, o.x2, o.y2].every(Number.isFinite)
      && Math.hypot(o.x2 - o.x1, o.y2 - o.y1) > 1e-6);
  const xs = [];
  const ys = [];
  for (const w of walls) { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); }
  for (const r of rooms) for (const [x, y] of r.polygon) { xs.push(x); ys.push(y); }
  return {
    walls,
    rooms,
    openings,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    height: num(d.wallHeight, 2.7),
  };
}

/// The four corners of a wall drawn at a given thickness, in plan metres.
function wallQuad(wall, thickness) {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (thickness / 2);
  const ny = (dx / len) * (thickness / 2);
  return [
    [wall.x1 + nx, wall.y1 + ny],
    [wall.x2 + nx, wall.y2 + ny],
    [wall.x2 - nx, wall.y2 - ny],
    [wall.x1 - nx, wall.y1 - ny],
  ];
}

function polygonCentroid(points) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area) < 1e-9) {
    const n = points.length || 1;
    return [
      points.reduce((sum, point) => sum + point[0], 0) / n,
      points.reduce((sum, point) => sum + point[1], 0) / n,
    ];
  }
  return [cx / (3 * area), cy / (3 * area)];
}

function scenePlaceholder(ctx, w, h, text) {
  ctx.fillStyle = '#070d19';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#64748b';
  ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/// Orthographic plan view: grid, room fills, wall poche and the overall
/// dimensions, with the layers switchable the way a CAD plan view has them.
function scene2D(root) {
  const geometry = planGeometry();
  const thickness = NOMINAL_WALL_MM / 1000;
  root.innerHTML = `<h2>2D plan scene</h2>
    <p class="note">The extracted plan as an orthographic drawing: wall poche, room fills, an adaptive
      grid and the overall dimensions. Drag to pan, wheel to zoom, double-click to fit.</p>
    <div class="row">
      ${[['grid', 'Grid'], ['rooms', 'Rooms'], ['walls', 'Walls'], ['openings', 'Doors & windows'], ['dims', 'Dimensions'], ['labels', 'Labels']]
        .map(([key, label]) => `<label class="chk"><input type="checkbox" data-layer="${key}" checked>${label}</label>`).join('')}
      <label class="chk"><input type="checkbox" id="sheet2d" checked>Sheet</label>
      <button id="fit2d">Fit</button>
    </div>
    <canvas class="wire scene" id="scene-2d"></canvas>
    <div class="row">
      <label class="chk"><input type="checkbox" id="layers2d">Services layers</label>
      <label><span>Layer</span><select id="layer-kind">${LAYER_OPTIONS
        .map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
    </div>
    <canvas class="wire" id="mep-2d" style="height:380px"></canvas>
    <p class="hint" id="mep-note">The layer drawings use their own fitted view of the footprint, so they
      get their own sheet rather than sharing this canvas: framing walls, water/DWV/gas routes and the
      panel with its circuits, each drawn from the plan loaded here.</p>
    <p class="hint">${geometry
      ? `${geometry.walls.length} walls · ${geometry.rooms.length} rooms · ${geometry.openings.length} opening${geometry.openings.length === 1 ? '' : 's'} · ${f(geometry.maxX - geometry.minX, 2)} × ${f(geometry.maxY - geometry.minY, 2)} m at ${f(state.data?.mmPerPx, 1)} mm/px · walls drawn ${NOMINAL_WALL_MM} mm thick`
      : 'No plan yet — open <a href="#/plan-studio">Plan studio</a> and upload a drawing.'}</p>`;

  const canvas = root.querySelector('#scene-2d');
  const shown = { grid: true, rooms: true, walls: true, openings: true, dims: true, labels: true };
  let sheet = true;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let drag = null;

  root.querySelectorAll('[data-layer]').forEach((box) => {
    box.onchange = () => { shown[box.dataset.layer] = box.checked; draw(); };
  });
  root.querySelector('#sheet2d').onchange = (event) => { sheet = event.target.checked; draw(); };
  const fit = () => { zoom = 1; panX = 0; panY = 0; draw(); };
  root.querySelector('#fit2d').onclick = fit;

  // The services sheet: floorplan3d's layer drawings, fed with the walls and a
  // plumbing/electrical design laid out inside the same footprint.
  const layerCanvas = root.querySelector('#mep-2d');
  const layerBox = root.querySelector('#layers2d');
  const layerKind = root.querySelector('#layer-kind');
  const layerNote = root.querySelector('#mep-note');
  let model = null;

  function drawLayers() {
    const ctx = layerCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = layerCanvas.clientWidth || 900;
    const h = layerCanvas.clientHeight || 380;
    layerCanvas.width = Math.round(w * dpr);
    layerCanvas.height = Math.round(h * dpr);
    if (!layerBox.checked) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, w, h);
      layerNote.textContent = 'Tick services layers to draw the framing, plumbing and electrical sheets over this plan.';
      return;
    }
    if (!model) model = layerModel(data());
    if (!model) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, w, h);
      layerNote.textContent = 'No plan yet — upload or draw one first.';
      return;
    }
    // The layer functions scale the context themselves, so hand them the CSS
    // size and the ratio rather than a pre-scaled context.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    drawLayer(ctx, w, h, layerKind.value, model, dpr);
    const fixtures = model.sources.plumbingPlan?.fixtures?.length ?? 0;
    const circuits = model.electrical?.circuits?.length ?? 0;
    layerNote.textContent = `${f(model.footprint.width, 1)} × ${f(model.footprint.depth, 1)} m footprint · `
      + `${fixtures} fixtures · ${circuits} circuits · ${model.electrical?.serviceAmps ?? 0} A service`;
  }
  layerBox.onchange = drawLayers;
  layerKind.onchange = drawLayers;
  window.addEventListener('resize', drawLayers);
  drawLayers();

  function draw() {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 900;
    const h = canvas.clientHeight || 560;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!geometry) { scenePlaceholder(ctx, w, h, 'No plan yet — upload a drawing in Plan studio'); return; }

    const theme = sheet ? SCENE_THEMES.sheet : SCENE_THEMES.dark;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    const padL = 62;
    const padR = 22;
    const padT = 22;
    const padB = 54;
    const spanX = Math.max(geometry.maxX - geometry.minX, 1e-3);
    const spanY = Math.max(geometry.maxY - geometry.minY, 1e-3);
    const base = Math.min((w - padL - padR) / spanX, (h - padT - padB) / spanY);
    const scale = Math.max(base * zoom, 1e-6);
    const ox = padL + (w - padL - padR - spanX * scale) / 2 + panX;
    const oy = padT + (h - padT - padB - spanY * scale) / 2 + panY;
    const X = (x) => ox + (x - geometry.minX) * scale;
    const Y = (y) => oy + (y - geometry.minY) * scale;

    if (shown.grid) {
      const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20].find((candidate) => candidate * scale >= 16) || 20;
      const left = geometry.minX + (0 - ox) / scale;
      const right = geometry.minX + (w - ox) / scale;
      const top = geometry.minY + (0 - oy) / scale;
      const bottom = geometry.minY + (h - oy) / scale;
      ctx.lineWidth = 1;
      for (let i = Math.ceil(left / step); i * step <= right; i++) {
        const x = Math.round(X(i * step)) + 0.5;
        ctx.strokeStyle = i % 5 === 0 ? theme.gridMajor : theme.gridMinor;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let i = Math.ceil(top / step); i * step <= bottom; i++) {
        const y = Math.round(Y(i * step)) + 0.5;
        ctx.strokeStyle = i % 5 === 0 ? theme.gridMajor : theme.gridMinor;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    if (shown.rooms) {
      geometry.rooms.forEach((room, index) => {
        ctx.beginPath();
        room.polygon.forEach(([x, y], point) => {
          if (point === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
        });
        ctx.closePath();
        ctx.fillStyle = theme.roomFills[index % theme.roomFills.length];
        ctx.fill();
        ctx.strokeStyle = theme.roomStroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    if (shown.walls) {
      for (const wall of geometry.walls) {
        ctx.beginPath();
        wallQuad(wall, thickness).forEach(([x, y], point) => {
          if (point === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
        });
        ctx.closePath();
        ctx.fillStyle = theme.wallFill;
        ctx.fill();
        ctx.strokeStyle = theme.wallStroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // The walls already stop at each opening, so these are drawn in the gap: a
    // quarter-circle swing for a door, a double line with the glass for a window.
    if (shown.openings) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = theme.wallStroke;
      for (const opening of geometry.openings) {
        const len = Math.hypot(opening.x2 - opening.x1, opening.y2 - opening.y1) || 1e-6;
        const ux = (opening.x2 - opening.x1) / len;
        const uy = (opening.y2 - opening.y1) / len;
        if (opening.kind === 'window') {
          for (const side of [-1, 1]) {
            const nx = -uy * (thickness / 2) * side;
            const ny = ux * (thickness / 2) * side;
            ctx.beginPath();
            ctx.moveTo(X(opening.x1 + nx), Y(opening.y1 + ny));
            ctx.lineTo(X(opening.x2 + nx), Y(opening.y2 + ny));
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(X(opening.x1), Y(opening.y1));
          ctx.lineTo(X(opening.x2), Y(opening.y2));
          ctx.stroke();
        } else {
          // Hinge at the first end: the leaf open along the normal, the swing
          // arc back to the far end.
          const nx = -uy;
          const ny = ux;
          ctx.beginPath();
          ctx.moveTo(X(opening.x1), Y(opening.y1));
          ctx.lineTo(X(opening.x1 + nx * len), Y(opening.y1 + ny * len));
          ctx.stroke();
          ctx.beginPath();
          const steps = 16;
          for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * (Math.PI / 2);
            const cos = Math.cos(t);
            const sin = Math.sin(t);
            const px = opening.x1 + (ux * cos + nx * sin) * len;
            const py = opening.y1 + (uy * cos + ny * sin) * len;
            if (i === 0) ctx.moveTo(X(px), Y(py)); else ctx.lineTo(X(px), Y(py));
          }
          ctx.stroke();
        }
      }

      // Name each one where it is drawn: the kind the extractor decided and the
      // width it measured, set clear of the wall so the symbol stays readable.
      if (shown.labels) {
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // A halo in the sheet's own colour keeps the label readable where it
        // passes over a room name or the wall poche.
        ctx.strokeStyle = theme.bg;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.fillStyle = theme.labelSub;
        for (const opening of geometry.openings) {
          const x1 = X(opening.x1);
          const y1 = Y(opening.y1);
          const x2 = X(opening.x2);
          const y2 = Y(opening.y2);
          const span = Math.hypot(x2 - x1, y2 - y1) || 1;
          const nx = -(y2 - y1) / span;
          const ny = (x2 - x1) / span;
          const width = Number.isFinite(opening.width)
            ? opening.width
            : Math.hypot(opening.x2 - opening.x1, opening.y2 - opening.y1);
          const label = `${opening.kind} ${f(width, 2)} m`;
          const lx = (x1 + x2) / 2 + nx * 16;
          const ly = (y1 + y2) / 2 + ny * 16;
          ctx.strokeText(label, lx, ly);
          ctx.fillText(label, lx, ly);
        }
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }
    }

    if (shown.dims) {
      const yb = Y(geometry.maxY) + 30;
      const xl = X(geometry.minX) - 36;
      ctx.strokeStyle = theme.dimStroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(geometry.minX), Y(geometry.maxY) + 6);
      ctx.lineTo(X(geometry.minX), yb + 6);
      ctx.moveTo(X(geometry.maxX), Y(geometry.maxY) + 6);
      ctx.lineTo(X(geometry.maxX), yb + 6);
      ctx.moveTo(X(geometry.minX), yb);
      ctx.lineTo(X(geometry.maxX), yb);
      ctx.moveTo(X(geometry.minX) - 6, Y(geometry.minY));
      ctx.lineTo(xl - 6, Y(geometry.minY));
      ctx.moveTo(X(geometry.minX) - 6, Y(geometry.maxY));
      ctx.lineTo(xl - 6, Y(geometry.maxY));
      ctx.moveTo(xl, Y(geometry.minY));
      ctx.lineTo(xl, Y(geometry.maxY));
      ctx.stroke();
      ctx.beginPath();
      for (const x of [X(geometry.minX), X(geometry.maxX)]) {
        ctx.moveTo(x - 3, yb + 3);
        ctx.lineTo(x + 3, yb - 3);
      }
      for (const y of [Y(geometry.minY), Y(geometry.maxY)]) {
        ctx.moveTo(xl - 3, y - 3);
        ctx.lineTo(xl + 3, y + 3);
      }
      ctx.stroke();
      ctx.fillStyle = theme.dimText;
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${f(geometry.maxX - geometry.minX, 2)} m`, (X(geometry.minX) + X(geometry.maxX)) / 2, yb - 4);
      ctx.save();
      ctx.translate(xl - 8, (Y(geometry.minY) + Y(geometry.maxY)) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${f(geometry.maxY - geometry.minY, 2)} m`, 0, 0);
      ctx.restore();
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    if (shown.labels) {
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const room of geometry.rooms) {
        const [cx, cy] = polygonCentroid(room.polygon);
        ctx.fillStyle = theme.label;
        ctx.fillText(room.name, X(cx), Y(cy) - 7);
        ctx.fillStyle = theme.labelSub;
        ctx.fillText(`${f(room.area, 1)} m²`, X(cx), Y(cy) + 7);
      }
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoom = Math.min(Math.max(zoom * (event.deltaY < 0 ? 1.12 : 0.89), 0.25), 12);
    draw();
  }, { passive: false });
  canvas.addEventListener('pointerdown', (event) => { drag = [event.offsetX, event.offsetY]; });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    panX += event.offsetX - drag[0];
    panY += event.offsetY - drag[1];
    drag = [event.offsetX, event.offsetY];
    draw();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('dblclick', fit);
  window.addEventListener('resize', draw);
  draw();
}

/// The 3D scene: floorplan_3d's three.js viewer over the plan this server
/// extracted — orbit camera, shadows, one floor plate per room, cutaway walls.
function scene3D(root) {
  const geometry = planGeometry();
  const doors = geometry ? geometry.openings.filter((o) => o.kind === 'door').length : 0;
  const windows = geometry ? geometry.openings.filter((o) => o.kind === 'window').length : 0;
  root.innerHTML = `<h2>3D scene</h2>
    <p class="note">The extracted plan in the site's three.js viewer: orbit camera framed to the
      footprint, image-based lighting, a shadow-casting key light and one floor plate per room. The
      cutaway hides the walls between you and the interior, so orbiting always looks into the plan;
      the elevation view swaps in an orthographic camera from one of the four sides and hides the
      walls nearest it, so a wall of openings reads flat like a drawing.</p>
    <div class="grid">
      <label><span>Wall height</span><input id="h3" type="number" step="0.05" value="${geometry ? f(geometry.height, 2) : 2.7}"><em>m</em></label>
      <label><span>Wall thickness</span><input id="t3" type="number" step="10" value="150"><em>mm</em></label>
      <label><span>Cutaway</span><input id="cut3" type="checkbox" checked><em>near walls</em></label>
      <label><span>Room plates</span><input id="plates3" type="checkbox" checked><em>floors</em></label>
    </div>
    <div class="row">
      <label><span>Elevation</span><select id="elev3">
        <option value="">Perspective</option>
        <option value="front">Front</option>
        <option value="back">Back</option>
        <option value="left">Left</option>
        <option value="right">Right</option>
      </select></label>
      <span class="hint" id="elev-note">Orthographic side views; the walls nearest the camera are hidden.</span>
    </div>
    <div class="row">
      ${[['wireframe3D', 'Wireframe', false], ['shadows3D', 'Shadows', true], ['grid3D', 'Grid', true],
        ['axes3D', 'Axes', false], ['fog3D', 'Fog', false], ['turntable', 'Turntable', false],
        ['hideWalls3D', 'Hide walls', false]]
        .map(([key, label, on]) => `<label class="chk"><input type="checkbox" data-ability="${key}"${on ? ' checked' : ''}>${label}</label>`).join('')}
    </div>
    <div class="viewer" id="scene-3d-host"></div>
    <p class="hint">${geometry
      ? `${geometry.walls.length} walls at ${f(geometry.height, 2)} m · ${geometry.rooms.length} rooms · `
        + `${doors} door${doors === 1 ? '' : 's'} · ${windows} window${windows === 1 ? '' : 's'} · `
        + 'drag to orbit, wheel to zoom, right-drag to pan'
      : 'No plan yet — open <a href="#/plan-studio">Plan studio</a> and upload a drawing.'}</p>`;

  const host = root.querySelector('#scene-3d-host');
  if (!geometry) {
    host.innerHTML = '<p class="viewer-empty">No plan yet — upload a drawing in Plan studio</p>';
    return;
  }

  let viewer;
  try {
    viewer = new PlanViewer(host);
  } catch (err) {
    host.innerHTML = `<p class="viewer-empty">WebGL is unavailable in this browser: ${esc(err.message || err)}</p>`;
    return;
  }
  activeViewer = viewer;
  // Lets the headless check read the mesh counts: a window that was built is
  // more than a wall count.
  host.__viewer = viewer;

  viewer.setOptions({
    height: Math.max(geometry.height, 0.3),
    thickness: 150 / 1000,
    cutaway: root.querySelector('#cut3').checked,
    plates: root.querySelector('#plates3').checked,
  });
  viewer.setPlan({ walls: geometry.walls, rooms: geometry.rooms, openings: geometry.openings });

  // The vendored ability registry applies its 3D flags to a live scene; the
  // helpers are read at call time because every rebuild replaces the grid.
  const abilities = {
    wireframe3D: false, shadows3D: true, grid3D: true, axes3D: false,
    fog3D: false, turntable: false, hideWalls3D: false,
  };
  const applyAbilities = () => {
    apply3DAbilities(
      { scene: viewer.scene, renderer: viewer.renderer, controls: viewer.controls },
      abilities,
      { grid: viewer.grid, axes: viewer.axes },
    );
    // The per-frame cut-away would otherwise put the walls straight back.
    viewer.hideWalls = abilities.hideWalls3D;
    viewer.updateWallVisibility();
  };
  root.querySelectorAll('[data-ability]').forEach((box) => {
    box.onchange = () => {
      abilities[box.dataset.ability] = box.checked;
      applyAbilities();
    };
  });

  const apply = () => {
    viewer.setOptions({
      height: Math.max(num(root.querySelector('#h3').value, geometry.height), 0.3),
      thickness: Math.max(num(root.querySelector('#t3').value, 150), 20) / 1000,
      cutaway: root.querySelector('#cut3').checked,
      plates: root.querySelector('#plates3').checked,
    });
    applyAbilities();
  };
  root.querySelector('#h3').oninput = apply;
  root.querySelector('#t3').oninput = apply;
  root.querySelector('#cut3').onchange = apply;
  root.querySelector('#plates3').onchange = apply;
  root.querySelector('#elev3').onchange = (event) => {
    const side = viewer.setElevation(event.target.value || null);
    root.querySelector('#elev-note').textContent = side
      ? `${side} elevation · orthographic · near walls hidden`
      : 'Orthographic side views; the walls nearest the camera are hidden.';
  };
  applyAbilities();
}

// ---- views -----------------------------------------------------------------

function planStudio(root) {
  root.innerHTML = `
    <h2>Plan studio</h2>
    <p class="note">Upload a drawing: the detector finds the wall strokes, the plan builder closes
      rooms and measures them, and every other screen reads that plan. The scale is the one number
      the image cannot carry — 10 mm per pixel assumes a plan drawn at 1:100 on a 96 dpi raster.</p>
    <p class="note">The plan is kept in this browser (localStorage), so a reload or any other screen
      still has it. Clear it here to start over.</p>
    <form id="up" class="grid">
      <label><span>Drawing</span><input type="file" name="file" accept="image/*"></label>
      <label><span>Scale</span><input type="number" name="mmPerPx" step="0.1" value="${state.data?.mmPerPx ?? 10}"><em>mm / px</em></label>
      <label><span>PDF scale</span><input type="text" name="mmPerPt" value="auto" spellcheck="false"><em>mm / pt or auto</em></label>
      <label><span>Wall height</span><input type="number" name="wallHeight" step="0.05" value="${state.data?.wallHeight ?? 2.7}"><em>m</em></label>
      <label><span>Stud spacing</span><input type="number" name="studSpacing" step="1" value="${state.data?.studSpacingMm ?? 406}"><em>mm</em></label>
    </form>
    <p><button class="primary" id="go">Detect plan</button>
      <button id="clear">Clear saved plan</button> <span id="msg" class="hint"></span></p>
    <p class="row">
      <input type="file" id="dxf" accept=".dxf,text/plain">
      <button id="dxf-go">Import DXF</button>
      <span id="dxf-msg" class="hint">A vector plan imports straight to walls: LINE, LWPOLYLINE, ARC and
        CIRCLE entities become the wall graph, so rooms and takeoffs need no detector.</span>
    </p>
    <p class="row">
      <input type="file" id="geo" accept=".kml,.kmz,.geojson,.json">
      <button id="geo-go">Import KML / GeoJSON</button>
      <span id="geo-msg" class="hint">A survey imports at its real size: polygon rings and lines become
        walls, north up. A lot boundary and a house footprint are two rings, so each one closes.</span>
    </p>
    <div id="result"></div>`;
  const form = root.querySelector('#up');
  const result = root.querySelector('#result');
  const msg = root.querySelector('#msg');
  root.querySelector('#go').onclick = async () => {
    if (!form.file.files.length) { msg.textContent = 'choose an image first'; return; }
    msg.textContent = 'detecting…';
    try {
      const res = await fetch('/api/plan', { method: 'POST', body: new FormData(form) });
      if (!res.ok) throw new Error(await res.text());
      state.data = await res.json();
      const saved = savePlan(state.data);
      setStatus();
      planResult(result);
      msg.innerHTML = saved ? 'plan ready · saved in this browser'
        : 'plan ready · <span class="err">too large to save</span>, it will not survive a reload';
    } catch (err) {
      msg.innerHTML = `<span class="err">${esc(err.message || err)}</span>`;
    }
  };
  root.querySelector('#clear').onclick = () => {
    clearPlan();
    setStatus();
    planResult(result);
    msg.textContent = 'saved plan cleared';
  };

  const dxfInput = root.querySelector('#dxf');
  const dxfMsg = root.querySelector('#dxf-msg');
  root.querySelector('#dxf-go').onclick = async () => {
    const file = dxfInput.files?.[0];
    if (!file) { dxfMsg.textContent = 'choose a .dxf file first'; return; }
    dxfMsg.textContent = 'reading…';
    try {
      const imported = planFromDxf(await file.text(), { previous: data() });
      if (!imported.plan) {
        dxfMsg.innerHTML = `<span class="err">${esc(imported.error)}</span>`;
        return;
      }
      state.data = imported.plan;
      const saved = savePlan(state.data);
      setStatus();
      planResult(result);
      dxfMsg.innerHTML = `${imported.plan.walls.length} walls · ${imported.plan.rooms.length} rooms · `
        + `${f(imported.plan.takeoff.floorArea, 1)} m²`
        + (saved ? ' · saved in this browser' : ' · <span class="err">too large to save</span>');
    } catch (err) {
      dxfMsg.innerHTML = `<span class="err">${esc(err.message || err)}</span>`;
    }
  };

  const geoInput = root.querySelector('#geo');
  const geoMsg = root.querySelector('#geo-msg');
  root.querySelector('#geo-go').onclick = async () => {
    const file = geoInput.files?.[0];
    if (!file) { geoMsg.textContent = 'choose a .kml, .kmz or .geojson file first'; return; }
    geoMsg.textContent = 'reading…';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const imported = await planFromGeo({
        name: file.name,
        text: new TextDecoder().decode(bytes),
        bytes,
        previous: data(),
      });
      if (!imported.plan) {
        geoMsg.innerHTML = `<span class="err">${esc(imported.error)}</span>`;
        return;
      }
      state.data = imported.plan;
      const saved = savePlan(state.data);
      setStatus();
      planResult(result);
      const meta = imported.plan.imported ?? { kind: 'geo', features: 0 };
      geoMsg.innerHTML = `${String(meta.kind).toUpperCase()} · ${meta.features} feature`
        + `${meta.features === 1 ? '' : 's'} · ${imported.plan.walls.length} walls · `
        + `${imported.plan.rooms.length} rooms · ${f(imported.plan.takeoff.floorArea, 1)} m²`
        + (saved ? ' · saved in this browser' : ' · <span class="err">too large to save</span>');
    } catch (err) {
      geoMsg.innerHTML = `<span class="err">${esc(err.message || err)}</span>`;
    }
  };
  planResult(result);
}

function editor(root) {
  const start = data();
  let walls = (start?.walls ?? [])
    .map((wall) => ({ x1: num(wall.x1), y1: num(wall.y1), x2: num(wall.x2), y2: num(wall.y2) }))
    .filter((wall) => Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) > 1e-6);
  let plan = start;
  let selected = -1;
  let draft = null;
  let grabbed = null;
  let cursor = null;
  let down = null;
  let travel = 0;
  const history = [];

  root.innerHTML = `<h2>Editor</h2>
    <p class="note">Draw the walls yourself: press and drag on the canvas. An endpoint snaps to an existing
      corner, then to a 100 mm grid, and a wall ending on another wall splits it so the room closes.
      Drag a corner handle to move that corner — every wall meeting there moves with it. Click a wall
      to select it and press Delete to remove it. Every screen reads the plan this saves.</p>
    <div class="row">
      <label class="chk"><input type="checkbox" id="ed-snap" checked>Snap</label>
      <button id="ed-undo">Undo</button>
      <button id="ed-del">Delete selected</button>
      <span class="hint" id="ed-msg"></span>
    </div>
    <canvas class="wire scene" id="ed-canvas"></canvas>
    <div id="ed-sum"></div>
    <h3>Walls</h3><div id="ed-walls"></div>
    <h3>Rooms</h3><div id="ed-rooms"></div>`;

  const canvas = root.querySelector('#ed-canvas');
  const msg = root.querySelector('#ed-msg');
  const snapBox = root.querySelector('#ed-snap');

  const view = () => canvasView(walls, canvas.clientWidth || 900, canvas.clientHeight || 560);

  const pointToPlan = (event, ignore = null) => {
    const rect = canvas.getBoundingClientRect();
    const at = view().toPlan(event.clientX - rect.left, event.clientY - rect.top);
    return snapBox.checked ? snapPoint(at, walls, { ignore }) : { x: at.x, z: at.z, snapped: 'free' };
  };

  const nearestWall = (event) => {
    const rect = canvas.getBoundingClientRect();
    const viewport = view();
    const at = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    let best = -1;
    let bestDistance = 12;
    walls.forEach((wall, index) => {
      const a = viewport.toScreen(wall.x1, wall.y1);
      const b = viewport.toScreen(wall.x2, wall.y2);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSq = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / lengthSq));
      const distance = Math.hypot(at.x - (a.x + dx * t), at.y - (a.y + dy * t));
      if (distance < bestDistance) { bestDistance = distance; best = index; }
    });
    return best;
  };

  /** The corner handle under the pointer, if any: it outranks starting a wall. */
  const nearestCorner = (event) => {
    const rect = canvas.getBoundingClientRect();
    const viewport = view();
    const at = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    let best = null;
    for (const corner of planCorners(walls)) {
      const point = viewport.toScreen(corner.x, corner.z);
      const distance = Math.hypot(at.x - point.x, at.y - point.y);
      if (distance <= 10 && (!best || distance < best.distance)) best = { ...corner, distance };
    }
    return best;
  };

  function draw() {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 900;
    const h = canvas.clientHeight || 560;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070d19';
    ctx.fillRect(0, 0, w, h);

    const viewport = view();
    const S = (x, z) => viewport.toScreen(x, z);
    const bounds = viewport.bounds;

    // One metre grid, heavier every fifth line, so the drawn lengths read.
    ctx.lineWidth = 1;
    for (let x = Math.floor(bounds.minX) - 2; x <= Math.ceil(bounds.maxX) + 2; x++) {
      const at = S(x, bounds.minZ);
      ctx.strokeStyle = x % 5 === 0 ? 'rgba(56,189,248,0.16)' : 'rgba(56,189,248,0.06)';
      ctx.beginPath();
      ctx.moveTo(at.x, 0);
      ctx.lineTo(at.x, h);
      ctx.stroke();
    }
    for (let z = Math.floor(bounds.minZ) - 2; z <= Math.ceil(bounds.maxZ) + 2; z++) {
      const at = S(bounds.minX, z);
      ctx.strokeStyle = z % 5 === 0 ? 'rgba(56,189,248,0.16)' : 'rgba(56,189,248,0.06)';
      ctx.beginPath();
      ctx.moveTo(0, at.y);
      ctx.lineTo(w, at.y);
      ctx.stroke();
    }

    for (const [index, room] of (plan?.rooms ?? []).entries()) {
      if (!Array.isArray(room.polygon) || room.polygon.length < 3) continue;
      ctx.beginPath();
      room.polygon.forEach(([x, z], at) => {
        const point = S(x, z);
        if (at === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = ['rgba(56,189,248,0.10)', 'rgba(74,222,128,0.10)', 'rgba(251,191,36,0.10)'][index % 3];
      ctx.fill();
    }

    // A corner being dragged previews the walls it will produce, so the move is
    // visible before it is committed.
    const drawnWalls = grabbed ? moveCorner(walls, grabbed.from, grabbed.to) : walls;
    const highlight = grabbed ? -1 : selected;

    // Walls at the studio's nominal thickness, so a 4 m wall looks 4 m long.
    ctx.lineCap = 'round';
    drawnWalls.forEach((wall, index) => {
      const a = S(wall.x1, wall.y1);
      const b = S(wall.x2, wall.y2);
      ctx.strokeStyle = index === highlight ? '#fbbf24' : '#38bdf8';
      ctx.lineWidth = Math.max(3, Math.min(NOMINAL_WALL_MM / 1000 * viewport.scale, 14));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    // Corner handles: squares, so a draggable end never looks like a dot.
    for (const corner of planCorners(drawnWalls)) {
      const point = S(corner.x, corner.z);
      const active = Boolean(grabbed)
        && Math.hypot(corner.x - grabbed.to.x, corner.z - grabbed.to.z) < 1e-6;
      const size = active ? 5 : 3.5;
      ctx.fillStyle = active ? '#fbbf24' : '#e2e8f0';
      ctx.fillRect(point.x - size, point.y - size, size * 2, size * 2);
    }

    if (draft && cursor) {
      const a = S(draft.x, draft.z);
      const b = S(cursor.x, cursor.z);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = cursor.snapped === 'endpoint' ? '#4ade80' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`${f(Math.hypot(cursor.x - draft.x, cursor.z - draft.z), 2)} m`, b.x + 8, b.y - 8);
    }

    if (selected >= 0 && walls[selected]) {
      const wall = walls[selected];
      const mid = S((wall.x1 + wall.x2) / 2, (wall.y1 + wall.y2) / 2);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`${f(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), 2)} m`, mid.x + 8, mid.y - 8);
    }
  }

  function summary() {
    const host = root.querySelector('#ed-sum');
    if (!plan) {
      host.innerHTML = '<p class="hint">Nothing drawn yet — drag on the canvas to place the first wall.</p>';
      return;
    }
    const t = plan.takeoff ?? {};
    host.innerHTML = cards([
      [plan.walls.length, 'walls', `${f(t.wallLength, 2)} m`],
      [plan.rooms.length, 'rooms', `${f(t.floorArea, 2)} m²`],
      [f(t.floorArea, 1), 'm² floor', `${f(plan.widthM, 1)} × ${f(plan.depthM, 1)} m`],
    ]) + `<p class="hint">${plan.rooms.length
      ? 'Every closed face is a room; the outside face is dropped.'
      : 'No closed room yet — walls have to meet end to end for a face to close.'}</p>`;
  }

  function lists() {
    root.querySelector('#ed-walls').innerHTML = walls.length
      ? table(walls.map((wall, index) => [
        `Wall ${index + 1}${index === selected ? ' · selected' : ''}`,
        `(${f(wall.x1)}, ${f(wall.y1)}) → (${f(wall.x2)}, ${f(wall.y2)})`,
        `${f(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), 2)} m`,
      ]))
      : '<p class="hint">No walls yet.</p>';
    root.querySelector('#ed-rooms').innerHTML = plan?.rooms?.length
      ? table(plan.rooms.map((room) => [room.name,
        `${f(room.area, 2)} m² · ${f(room.perimeter, 2)} m perimeter`, `${room.polygon.length} pts`]))
      : '<p class="hint">No rooms yet.</p>';
  }

  function applyWalls(next, note = '') {
    walls = next;
    selected = Math.min(selected, walls.length - 1);
    plan = walls.length ? planFromWalls(walls, data()) : null;
    if (plan) {
      // The upload's OBJ and glTF describe the plan this edit started from.
      plan.obj = null;
      plan.gltf = null;
      state.data = plan;
      savePlan(plan);
    } else {
      clearPlan();
    }
    setStatus();
    draw();
    summary();
    lists();
    msg.textContent = note;
  }

  function commit(next, note) {
    history.push(walls.map((wall) => ({ ...wall })));
    if (history.length > 40) history.shift();
    applyWalls(next, note);
  }

  const removeSelected = () => {
    if (selected < 0 || !walls[selected]) { msg.textContent = 'select a wall first'; return; }
    const index = selected;
    selected = -1;
    commit(removeWall(walls, index), `wall ${index + 1} removed`);
  };
  root.querySelector('#ed-del').onclick = removeSelected;
  root.querySelector('#ed-undo').onclick = () => {
    const previous = history.pop();
    if (!previous) { msg.textContent = 'nothing to undo'; return; }
    applyWalls(previous, 'undo');
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    // Capture keeps the drag alive off-canvas, but a synthetic or already
    // released pointer id makes it throw; drawing should not depend on it.
    try { canvas.setPointerCapture(event.pointerId); } catch { /* no capture */ }
    down = { x: event.clientX, y: event.clientY };
    travel = 0;
    const corner = nearestCorner(event);
    if (corner) {
      grabbed = { from: { x: corner.x, z: corner.z }, to: { x: corner.x, z: corner.z } };
      cursor = { x: corner.x, z: corner.z, snapped: 'corner' };
      draft = null;
      draw();
      return;
    }
    grabbed = null;
    cursor = pointToPlan(event);
    draft = { x: cursor.x, z: cursor.z };
    draw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (down) travel = Math.max(travel, Math.hypot(event.clientX - down.x, event.clientY - down.y));
    if (grabbed) {
      cursor = pointToPlan(event, grabbed.from);
      grabbed.to = { x: cursor.x, z: cursor.z };
      draw();
      return;
    }
    if (!draft) return;
    cursor = pointToPlan(event);
    draw();
  });
  canvas.addEventListener('pointerup', (event) => {
    if (grabbed) {
      const from = grabbed.from;
      const to = grabbed.to;
      const moved = travel > 3 || Math.hypot(to.x - from.x, to.z - from.z) > 0.01;
      grabbed = null;
      down = null;
      travel = 0;
      if (moved) {
        selected = -1;
        commit(moveCorner(walls, from, to), 'corner moved');
      } else {
        draw();
      }
      return;
    }
    if (!draft) return;
    const from = draft;
    const to = pointToPlan(event);
    const moved = Math.max(travel, down ? Math.hypot(event.clientX - down.x, event.clientY - down.y) : 0);
    draft = null;
    down = null;
    travel = 0;
    if (moved > 6 && Math.hypot(to.x - from.x, to.z - from.z) >= 0.15) {
      commit(addWall(walls, from, to), `wall ${walls.length + 1} added`);
      return;
    }
    selected = nearestWall(event);
    draw();
    lists();
    msg.textContent = selected >= 0 ? `wall ${selected + 1} selected` : 'nothing selected';
  });
  canvas.addEventListener('pointercancel', () => {
    draft = null;
    grabbed = null;
    down = null;
    travel = 0;
    draw();
  });

  const onKey = (event) => {
    if (!document.contains(canvas)) { window.removeEventListener('keydown', onKey); return; }
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    event.preventDefault();
    removeSelected();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', draw);

  // Read-only hook for the headless checks, the way the 3D host exposes its
  // viewer: the probe needs the same fit the canvas is drawing with.
  canvas.__editor = { view, corners: () => planCorners(walls) };

  draw();
  summary();
  lists();
}

function appShell(root) {
  root.innerHTML = `<h2>App</h2><p class="note">Every screen in this studio, one per floorplan3d page. Each designer recomputes as you type.</p>
    ${GROUPS.map(([group, ids]) => `<h3>${group}</h3><div class="cards">${ids.map((id) =>
      `<div class="card"><span>${TITLES[id] || id}</span><br><a href="#/${id}">open</a></div>`).join('')}</div>`).join('')}`;
}

const wallDesigner = designer({
  title: 'Wall designer',
  blurb: 'Pick a detected wall and price its finish from the wall catalogue: coats, waste and labour.',
  fields: () => {
    const walls = data()?.walls ?? [];
    return [
      { k: 'index', label: 'Wall', type: 'select', value: 0, options: walls.length ? walls.map((w, i) => [i, `Wall ${i + 1} · ${f(w.length, 2)} m`]) : [[0, 'No plan loaded']] },
      { k: 'height', label: 'Height', unit: 'm', value: height() },
      { k: 'openings', label: 'Openings', unit: 'ea', value: 0 },
      {
        k: 'covering',
        label: 'Covering',
        type: 'select',
        value: finishCatalog.interior[0]?.id ?? 'paint-dead-flat',
        options: finishCatalog.interior.map((covering) => [covering.id, covering.label]),
      },
    ];
  },
  compute: (v) => finishResult(data(), {
    length: data()?.walls[v.index]?.length ?? wallLen(),
    height: v.height,
    openings: v.openings,
    covering: v.covering,
    exposure: 'interior',
  }),
});

const kitchenDesigner = designer({
  title: 'Kitchen designer',
  blurb: 'The engine’s six-module default run on the longest detected wall: clearance rules, fillers, gaps and a layout score.',
  fields: () => [
    { k: 'run', label: 'Run length', unit: 'm', value: f((data()?.walls ?? []).reduce((max, wall) => Math.max(max, wall.length || 0), 0) || 4.8, 2) },
    { k: 'line', label: 'Door line', type: 'select', value: 'shaker', options: kitchenCatalog.lines },
    { k: 'aisle', label: 'Aisle', unit: 'm', value: 1.2 },
  ],
  compute: (v) => kitchenResult(data(), v),
});

function toolbox(root) {
  root.innerHTML = `<h2>Toolbox</h2><p class="note">The detectors, the plan builder and the screens that read its output.</p>
    <h3>Pipeline</h3>${table([
      ['Grayscale + Otsu threshold', 'src/detect.rs', ''],
      ['Hough accumulate + peak suppression', 'src/detect.rs', ''],
      ['Ink-run extent per peak', 'src/detect.rs', ''],
      ['Axis snapping + collinear merge', 'src/detect.rs', ''],
      ['Scale to metres', 'src/plan.rs', ''],
      ['Wall graph, rooms, takeoff', 'src/plan.rs', ''],
      ['OBJ wireframe', 'src/main.rs', ''],
    ])}<h3>Jump to</h3><div class="cards">${['plan-studio', 'editor', 'framing-designer', 'roof-designer', 'bid-builder']
      .map((id) => `<div class="card"><span>${TITLES[id]}</span><br><a href="#/${id}">open</a></div>`).join('')}</div>`;
}

const demo = (root) => {
  root.innerHTML = `<h2>Demo</h2><p class="note">The whole pipeline on the bundled fixture, in four steps.</p>
    <ul class="plain">
      <li><a href="#/plan-studio">1. Upload</a> fixtures/floor_plan.png at 10 mm per pixel.</li>
      <li><a href="#/editor">2. Inspect</a> the walls the detector found and the rooms the graph closed.</li>
      <li><a href="#/framing-designer">3. Price</a> framing, then roof, stairs and the systems.</li>
      <li><a href="#/bid-builder">4. Bid</a> the takeoff at the rate book.</li>
    </ul>
    <p class="hint">The two fixtures in fixtures/ are generated by examples/make_fixtures.rs and covered by the Rust tests.</p>`;
};

function webgpuDemo(root) {
  root.innerHTML = `<h2>WebGPU demo</h2><p class="note">The wireframe as the server wrote it. This page draws it on a 2D canvas, so it runs on any browser; the floorplan3d scene renderer is WebGPU and three.js.</p>
    <div id="res"></div>`;
  planResult(root.querySelector('#res'));
}

const studSizeOptions = () =>
  (framingCatalog.studSizes ?? []).map((size) => {
    const id = typeof size === 'string' ? size : size.id ?? size.size;
    const label = typeof size === 'string' ? size : size.label ?? size.size ?? size.id;
    return [id, label];
  });

const framingDesigner = designer({
  title: 'Framing designer',
  blurb: 'The detected walls framed member by member — kings, jacks, a sized header and cripples at each opening — then priced.',
  fields: () => {
    const sizes = studSizeOptions();
    return [
      { k: 'studSize', label: 'Stud size', type: 'select', value: '2x4', options: sizes.length ? sizes : [['2x4', '2x4']] },
      { k: 'spacingIn', label: 'Stud spacing', unit: 'in', value: 16 },
    ];
  },
  compute: (v) => framingResult(data(), v),
});

const deckDesigner = designer({
  title: 'Deck designer',
  blurb: 'Joists, beam, posts and footings sized by NDS bending and deflection, with the decking and footing bill.',
  fields: () => [
    { k: 'width', label: 'Width', unit: 'm', value: f(data()?.widthM ?? 3.6, 2) },
    { k: 'depth', label: 'Projection', unit: 'm', value: 3.0 },
    { k: 'spacingIn', label: 'Joist spacing', unit: 'in', value: 16 },
    { k: 'stairs', label: 'Stairs from deck', unit: 'ea', value: 1 },
  ],
  compute: (v) => deckResult(data(), v),
});

const roofDesigner = designer({
  title: 'Roof designer',
  blurb: 'Roof geometry, every layer takeoff — sheathing, underlayment, covering, flashing — and the gutter package.',
  fields: () => [
    { k: 'span', label: 'Span', unit: 'm', value: f(data()?.widthM ?? 9, 2) },
    { k: 'length', label: 'Length', unit: 'm', value: f(data()?.depthM ?? 7, 2) },
    { k: 'pitch', label: 'Pitch', unit: 'rise:12', value: 6 },
    { k: 'overhang', label: 'Overhang', unit: 'm', value: 0.45 },
  ],
  compute: (v) => roofResult(data(), v),
});

const stairStraight = designer({
  title: 'Stair designer',
  blurb: 'The stair designer engine: Blondel’s law, the opening and headroom, and the riser, tread and width checks.',
  fields: () => [
    { k: 'rise', label: 'Total rise', unit: 'm', value: 2.85 },
    { k: 'width', label: 'Width', unit: 'm', value: 1.0 },
    { k: 'run', label: 'Run available', unit: 'm', value: 4.2 },
    { k: 'steps', label: 'Treads (0 = auto)', unit: 'ea', value: 0 },
  ],
  compute: (v) => straightStairResult(v),
});

const stairL = designer({
  title: 'L stair',
  blurb: 'A 90° winder: the walkline tread at the inside radius is the number that decides it.',
  fields: () => [
    { k: 'rise', label: 'Total rise', unit: 'm', value: 2.85 },
    { k: 'width', label: 'Width', unit: 'm', value: 1.0 },
    { k: 'run', label: 'Outer run available', unit: 'm', value: 5.6 },
  ],
  compute: (v) => turnStairResult('l', v),
});

const stairU = designer({
  title: 'U stair',
  blurb: 'A half turn through 180°: the same winder checks against the inside radius.',
  fields: () => [
    { k: 'rise', label: 'Total rise', unit: 'm', value: 2.85 },
    { k: 'width', label: 'Width', unit: 'm', value: 1.0 },
    { k: 'run', label: 'Outer run available', unit: 'm', value: 5.6 },
  ],
  compute: (v) => turnStairResult('u', v),
});

const stairSpiral = designer({
  title: 'Spiral stair',
  blurb: 'A helical flight: the walkline tread, the clear width and the diameter the tread needs.',
  fields: () => [
    { k: 'rise', label: 'Total rise', unit: 'm', value: 2.85 },
    { k: 'diameter', label: 'Diameter', unit: 'm', value: 1.6 },
    { k: 'width', label: 'Walkline offset', unit: 'm', value: 0.3 },
  ],
  compute: (v) => spiralStairResult(v),
});

const stairSteep = designer({
  title: 'Steep stair (ship ladder)',
  blurb: 'The ship’s ladder model from the catalogue: slope, tread depth and the guard it needs.',
  fields: () => [
    { k: 'rise', label: 'Total rise', unit: 'm', value: 2.85 },
    { k: 'width', label: 'Width', unit: 'm', value: 0.6 },
  ],
  compute: (v) => steepStairResult(v),
});

const foundationDesigner = designer({
  title: 'Foundation designer',
  blurb: 'Strip footing width from wall load and soil bearing, plus the concrete.',
  fields: () => [
    { k: 'perimeter', label: 'Wall perimeter', unit: 'm', value: f(wallLen(32), 2) },
    { k: 'load', label: 'Wall load', unit: 'kN/m', value: 28 },
    { k: 'soil', label: 'Soil bearing', unit: 'kPa', value: 150 },
    { k: 'thickness', label: 'Wall thickness', unit: 'mm', value: 300 },
    { k: 'depth', label: 'Footing depth', unit: 'mm', value: 300 },
    { k: 'slab', label: 'Slab thickness', unit: 'mm', value: 100 },
  ],
  compute: (v) => {
    const footingWidth = Math.max(0.3, v.load / Math.max(v.soil, 20));
    const footingVolume = v.perimeter * footingWidth * v.depth / 1000;
    const slabVolume = floorArea() * v.slab / 1000;
    const total = footingVolume + slabVolume;
    return {
      cards: [[f(footingWidth * 1000, 0), 'mm footing'], [f(total, 2), 'm³ concrete'], [ceil(total / 6), 'm³ trucks']],
      rows: [
        ['Footing width', f(footingWidth * 1000, 0), 'mm'],
        ['Footing depth', f(v.depth, 0), 'mm'],
        ['Footing concrete', f(footingVolume), 'm³'],
        ['Slab concrete', f(slabVolume), 'm³'],
        ['Total concrete', f(total), 'm³'],
        ['Concrete bags (0.017 m³)', ceil(total / 0.017), 'bags'],
        ['Reinforcement', f(v.perimeter * 3), 'm of bar'],
        ['Damp proof course', f(v.perimeter), 'm'],
      ],
    };
  },
});

const electricalDesigner = designer({
  title: 'Electrical designer',
  blurb: 'NEC 220 demand, service and feeder sizing, the circuit list and the panel bill.',
  fields: () => [
    { k: 'area', label: 'Floor area', unit: 'm²', value: f(floorArea(), 1) },
    { k: 'sabc', label: 'Small-appliance circuits', unit: 'ea', value: 2 },
    { k: 'laundry', label: 'Laundry circuits', unit: 'ea', value: 1 },
    { k: 'bathroom', label: 'Bathroom circuits', unit: 'ea', value: 2 },
    { k: 'method', label: 'Method', type: 'select', value: 'standard', options: [['standard', 'Standard (220.42)'], ['optional', 'Optional (220.82)']] },
  ],
  compute: (v) => electricalResult(data(), v),
});

const lightingDesigner = designer({
  title: 'Lighting designer',
  blurb: 'The lumen method over the ported catalogue: room index, utilization, fitting count and power density.',
  fields: () => [
    { k: 'room', label: 'Room type', type: 'select', value: lightingCatalog.presets[0]?.id ?? 'living', options: lightingCatalog.presets.map((preset) => [preset.id, preset.label]) },
    { k: 'width', label: 'Width', unit: 'm', value: 5.5 },
    { k: 'depth', label: 'Depth', unit: 'm', value: 4.2 },
    { k: 'mount', label: 'Mounting height', unit: 'm', value: 2.4 },
    { k: 'target', label: 'Target (0 = preset)', unit: 'lx', value: 0 },
    { k: 'luminaire', label: 'Luminaire', type: 'select', value: lightingCatalog.luminaires[0]?.id, options: lightingCatalog.luminaires.map((luminaire) => [luminaire.id, `${luminaire.label} · ${luminaire.lumens} lm`]) },
  ],
  compute: (v) => lightingResult(v),
});

const plumbingDesigner = designer({
  title: 'Plumbing designer',
  blurb: 'Fixture units, the size tables and the drainage load for a fixture count.',
  fields: () => [
    { k: 'wc', label: 'Water closets', value: 1 },
    { k: 'lav', label: 'Lavatories', value: 1 },
    { k: 'tub', label: 'Tubs / showers', value: 1 },
    { k: 'sink', label: 'Kitchen sinks', value: 1 },
    { k: 'dish', label: 'Dishwashers', value: 0 },
    { k: 'washer', label: 'Washing machines', value: 0 },
    { k: 'bib', label: 'Hose bibs', value: 1 },
  ],
  compute: (v) => plumbingResult(data(), v),
});

const landscapeDesigner = designer({
  title: 'Landscape designer',
  blurb: 'A water feature from the landscape engine: geometry, gallons, turnover, the hydraulic train, the barrier and the bill.',
  fields: () => [
    { k: 'type', label: 'Feature', type: 'select', value: 'pool', options: waterCatalog.types },
    { k: 'shape', label: 'Shape', type: 'select', value: 'rectangle', options: waterCatalog.shapes },
    { k: 'width', label: 'Width', unit: 'm', value: 5.2 },
    { k: 'length', label: 'Length', unit: 'm', value: 9.5 },
    { k: 'deep', label: 'Deep end', unit: 'm', value: 1.7 },
    { k: 'deck', label: 'Deck', unit: 'm', value: 1.22 },
    { k: 'turnover', label: 'Turnover', unit: 'h', value: 6 },
    { k: 'barrier', label: 'Barrier', type: 'select', value: 'yes', options: [['yes', '48 in barrier'], ['no', 'No barrier']] },
  ],
  compute: (v) => landscapeResult(data(), v),
});

const sitePlan = designer({
  title: 'Site plan',
  blurb: 'Setbacks and coverage from the plan extent.',
  fields: () => [
    { k: 'width', label: 'Site width', unit: 'm', value: f((data()?.widthM ?? 12) + 4, 1) },
    { k: 'depth', label: 'Site depth', unit: 'm', value: f((data()?.depthM ?? 9) + 5, 1) },
    { k: 'front', label: 'Front setback', unit: 'm', value: 6 },
    { k: 'side', label: 'Side setback', unit: 'm', value: 1.5 },
    { k: 'rear', label: 'Rear setback', unit: 'm', value: 3 },
    { k: 'coverage', label: 'Max coverage', unit: '%', value: 35 },
  ],
  compute: (v) => {
    const site = v.width * v.depth;
    const buildable = Math.max(v.width - v.side * 2, 0) * Math.max(v.depth - v.front - v.rear, 0);
    const footprint = floorArea();
    return {
      cards: [[f(site, 0), 'm² site'], [f(buildable, 0), 'm² buildable'], [f(footprint / site * 100, 1), '% covered']],
      rows: [
        ['Site area', f(site), 'm²'],
        ['Buildable area', f(buildable), 'm²'],
        ['Building footprint', f(footprint), 'm²'],
        ['Coverage', f(footprint / Math.max(site, 1) * 100, 1), '%'],
        ['Allowed footprint', f(site * v.coverage / 100), 'm²'],
        ['Coverage check', footprint <= site * v.coverage / 100 ? '<span class="ok">pass</span>' : '<span class="err">over</span>', ''],
        ['Remaining garden', f(Math.max(site - footprint, 0)), 'm²'],
      ],
    };
  },
});

function dashboard(root) {
  const d = data();
  root.innerHTML = `<h2>Project dashboard</h2><p class="note">Every suite the engines can price, rolled up from the detected plan.</p><div id="res"></div><div id="sum"></div><div id="list"></div>`;
  planResult(root.querySelector('#res'));
  const rollup = d ? projectRollup(d) : null;
  root.querySelector('#sum').innerHTML = rollup
    ? cards(rollup.cards) + table(rollup.rows)
    : '<p class="hint">Load a plan first.</p>';
  root.querySelector('#list').innerHTML = d
    ? table(d.rooms.map((room) => [room.name, `${f(room.area, 2)} m²`, `${f(room.perimeter, 2)} m`]))
    : '';
}

function schedule(root) {
  const d = data();
  root.innerHTML = `<h2>Schedule</h2><p class="note">The walls as BIM elements: IFC class, net area and volume, from the same quantities the bid prices.</p><div id="sched"></div>`;
  const host = root.querySelector('#sched');
  if (!d) { host.innerHTML = '<p class="hint">Load a plan first.</p>'; return; }
  const result = scheduleResult(d);
  host.innerHTML = cards(result.cards) + table(result.rows);
}

function permits(root) {
  const t = takeoff();
  const items = [
    ['Building permit application', 'Drawings, site plan and the takeoff'],
    ['Zoning and setback review', 'Site coverage and setbacks'],
    ['Foundation inspection', 'Before the pour'],
    ['Framing inspection', `${t ? t.studs : 0} studs at ${spacer()} mm`],
    ['Rough-in electrical', 'Before the drywall'],
    ['Rough-in plumbing', 'Pressure and drainage test'],
    ['Insulation inspection', 'Before lining'],
    ['Final inspection', 'Fixtures, trim and handover'],
  ];
  root.innerHTML = `<h2>Permits and inspections</h2><p class="note">The sequence a residential job usually needs, derived from what the plan contains.</p>`
    + table(items.map(([name, detail]) => [name, detail, '']));
}

const RATES = {
  framing: 62, sheathing: 18, drywall: 26, paint: 9, flooring: 55, roofing: 145, electrical: 48, plumbing: 58, stairs: 950, foundation: 190,
};

const bidBuilder = designer({
  title: 'Bid builder',
  blurb: 'Every engine’s itemised takeoff rows — framing members, roof layers, decking, circuits, pipe runs, pool equipment — priced once, then overhead, profit, contingency, permit, tax and progress billing.',
  fields: () => [
    { k: 'overhead', label: 'Overhead', unit: '%', value: 12 },
    { k: 'profit', label: 'Profit', unit: '%', value: 15 },
    { k: 'contingency', label: 'Contingency', unit: '%', value: 5 },
    { k: 'tax', label: 'Sales tax', unit: '%', value: 7.5 },
    { k: 'permit', label: 'Permit', unit: '$', value: 450 },
    { k: 'design', label: 'Design fee', unit: '$', value: 1200 },
    { k: 'deckDepth', label: 'Deck projection', unit: 'm', value: 3 },
  ],
  compute: (v) => bidResult(data(), v),
});

function priceBook(root) {
  root.innerHTML = `<h2>Price book</h2><p class="note">Every material line the engines can price, with the supplier quote where one is set. A quote replaces the default unit cost for that suite, item and unit.</p><div id="book"></div>`;
  const result = priceBookResult();
  root.querySelector('#book').innerHTML = cards(result.cards) + table(result.rows);
}

function pricing(root) {
  const t = takeoff();
  const area = t?.floorArea ?? 0;
  const packages = [
    ['Essential', 1450, 'Plan, framing, roof, shell and drywall'],
    ['Complete', 2150, 'Adds electrical, plumbing and finishes'],
    ['Premium', 2950, 'Adds joinery, lighting design and landscape'],
  ];
  root.innerHTML = `<h2>Pricing</h2><p class="note">Per-square-metre packages applied to ${f(area, 1)} m² of floor.</p>`
    + `<div class="cards">${packages.map(([name, rate, notes]) =>
      `<div class="card"><b>$${f(area * rate, 0)}</b><span>${name} · $${rate}/m²</span><br><span>${notes}</span></div>`).join('')}</div>`;
}

const calc = designer({
  title: 'Calculator',
  blurb: 'Enter the plan by hand and get the same takeoff the extractor reports.',
  fields: () => [
    { k: 'length', label: 'Wall length', unit: 'm', value: f(wallLen(), 2) },
    { k: 'floor', label: 'Floor area', unit: 'm²', value: f(floorArea(), 2) },
    { k: 'height', label: 'Wall height', unit: 'm', value: height() },
    { k: 'spacing', label: 'Stud spacing', unit: 'mm', value: spacer() },
    { k: 'waste', label: 'Flooring waste', unit: '%', value: 10 },
  ],
  compute: (v) => {
    const gross = v.length * v.height;
    const covered = gross + v.floor;
    return {
      cards: [[ceil(covered / 2.88), 'drywall sheets'], [ceil(covered * 2 / 10), 'L paint'], [ceil(v.floor * (1 + v.waste / 100)), 'm² flooring']],
      rows: [
        ['Wall area', f(gross), 'm²'],
        ['Covered area', f(covered), 'm²'],
        ['Drywall (2.4 × 1.2 m)', ceil(covered / 2.88), 'sheets'],
        ['Paint (2 coats, 10 m²/L)', ceil(covered * 2 / 10), 'L'],
        ['Flooring', f(v.floor * (1 + v.waste / 100)), 'm²'],
        ['Studs', Math.floor(v.length * 1000 / Math.max(v.spacing, 1)) + 1, 'ea'],
        ['Plates', f(v.length * 3), 'm'],
        ['Volume', f(v.floor * v.height), 'm³'],
      ],
    };
  },
});

function article(title, blurb, sections) {
  return (root) => {
    root.innerHTML = `<h2>${title}</h2><p class="note">${blurb}</p>`
      + sections.map(([heading, body]) => `<h3>${heading}</h3>${body}`).join('');
  };
}

const list = (items) => `<ul class="plain">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;

function home(root) {
  const d = data();
  root.innerHTML = `<h2>Blueprint Studio</h2>
    <p class="note">A drawing goes in, a wireframe and a measured plan come out, and every designer in
      floorplan3d reads that plan. This is the one application: the extractor, the takeoff and the screens.</p>
    ${d ? cards([[d.rooms.length, 'rooms'], [d.walls.length, 'walls'], [f(d.takeoff.floorArea, 1), 'm² floor'], [f(d.takeoff.wallLength, 1), 'm wall']])
        : cards([['—', 'no plan yet', 'upload a drawing in Plan studio']])}
    <h3>Start</h3>
    <div class="cards">
      <div class="card"><span>Detect a plan from an image</span><br><a href="#/plan-studio">Plan studio</a></div>
      <div class="card"><span>Every screen</span><br><a href="#/app">App</a></div>
      <div class="card"><span>Price the takeoff</span><br><a href="#/bid-builder">Bid builder</a></div>
      <div class="card"><span>The pipeline</span><br><a href="#/toolbox">Toolbox</a></div>
    </div>
    <h3>How it works</h3>
    ${list([
      'Otsu threshold, Hough accumulate and ink-run extent find the wall strokes.',
      'Axis snapping and collinear merge clean them into walls, then the scale turns pixels into metres.',
      'A wall graph with snapped endpoints and split junctions closes faces; the largest face is outside.',
      'Rooms, areas, studs, plates, sheets and paint come straight from that geometry.',
      'The project JSON downloads as the plan contract the ports in floorplan3d read.',
    ])}`;
}

const features = article('Features', 'What the extractor and the studio do, and what they deliberately do not.', [
  ['Extraction', list([
    'Grayscale + Otsu threshold, so blueprints that are not pure black on white still work.',
    'Hough transform over 180 angles: vertical, horizontal and diagonal walls.',
    'Ink-run extent per peak, so a segment covers the wall rather than the whole diagonal.',
    'Axis snapping with an ink check, collinear merge and duplicate removal.',
    'Endpoint clustering and T-junction splitting, which is what lets a partition close a room.',
  ])],
  ['Measurement', list([
    'Scale in millimetres of building per pixel, set per upload.',
    'Half-edge face traversal for rooms, with the outside face dropped.',
    'Takeoff formulas shared with the ports: 2.4 × 1.2 m sheets, 2 coats at 10 m²/L, 10% flooring waste, studs at the spacing plus one per wall.',
  ])],
  ['Not extracted', list([
    'Openings: door swings and window symbols are not classified, so wall areas are gross.',
    'Wall thickness: walls are centre lines, not double lines.',
    'Annotation: dimension strings are not read, so the scale stays a manual input.',
  ])],
]);

function gallery(root) {
  root.innerHTML = `<h2>Gallery</h2>
    <p class="note">The bundled fixtures, and the outputs the server has written this session.</p>
    <h3>Fixtures</h3>
    ${table([
      ['fixtures/floor_plan.png', '7 walls including a doorway, 2 rooms', '10 mm/px'],
      ['fixtures/angled_plan.png', '6 walls including a diagonal', '10 mm/px'],
    ])}
    <h3>Outputs</h3>
    <p class="hint">Every detection writes outputs/&lt;uuid&gt;.obj, served at /outputs. The link on each
      plan screen opens the one for the current upload.</p>
    <h3>Regenerate</h3>
    <p class="hint">cargo run --example make_fixtures && cargo test</p>`;
}

const about = article('About', 'A blueprint raster is the least structured form of a plan. This tool reads it anyway.', [
  ['Why', '<p class="note">Vector CAD and PDF plans carry their geometry. A scan or a photographed blueprint does not, so the walls have to be found in the ink before anything can be measured.</p>'],
  ['How', '<p class="note">Detection, snapping and a wall graph, then the same takeoff formulas the browser suites use, so the CLI and the ports agree on one plan contract.</p>'],
  ['Stack', '<p class="note">Rust: axum server, image and imageproc for the pixels, serde_json for the contract. The studio is plain ES modules with no build step.</p>'],
]);

const contact = article('Contact', 'Where the pieces live.', [
  ['Repository', '<p class="note">src/detect.rs — the detector. src/plan.rs — scale, wall graph, rooms, takeoff. src/main.rs — CLI, server, OBJ. static/ — this studio.</p>'],
  ['Fixtures', '<p class="note">examples/make_fixtures.rs generates the two images the tests assert against.</p>'],
  ['Tests', '<p class="note">cargo test covers the detector counts, the room closure and the plan JSON contract.</p>'],
]);

const stairGallery = article('Stair gallery', 'The plan forms the designer supports.', [
  ['Forms', list(['Straight run', 'L stair with a landing', 'U stair with a half landing', 'Spiral', 'Steep access stair (ship ladder)'])],
  ['Checks', '<p class="note">Every form reports riser height, tread depth, width and the run against IRC R311.7, plus 2R+T for comfort.</p>'],
]);

const stairParts = article('Stair parts', 'The vocabulary of a stair takeoff.', [
  ['Parts', list([
    'Riser — the vertical face between treads.',
    'Tread — the walking surface; the nosing overhangs the riser below.',
    'Stringer — the inclined member carrying the treads.',
    'Newel post — the post at a turn or the bottom that carries the handrail.',
    'Baluster — the infill between tread and handrail.',
    'Landing — a platform between flights.',
  ])],
]);

const stairGlossary = article('Stair glossary', 'Terms that change the numbers.', [
  ['Terms', list([
    'Total rise — floor to floor, the input to the riser count.',
    'Going — the depth of one tread, measured without the nosing.',
    'Headroom — clearance measured vertically from the nosing line.',
    'Pitch — the angle of the flight, rise over run.',
    'Well — the opening in the floor the stair passes through.',
  ])],
]);

// ---- router ----------------------------------------------------------------

function codeRules(root) {
  root.innerHTML = `<h2>Code rules</h2><p class="note">${ruleCount()} rules from the ported libraries, with the clause each one cites.</p>
    <div class="grid">
      <label><span>Library</span><select id="rules-lib">${ruleLibraries
        .map((library) => `<option value="${library.id}">${library.label} · ${library.count}</option>`)
        .join('')}</select></label>
      <label><span>Search</span><input id="rules-q" type="text" placeholder="span, GFCI, slope…"></label>
    </div><div class="out"></div>`;
  const out = root.querySelector('.out');
  const library = root.querySelector('#rules-lib');
  const query = root.querySelector('#rules-q');
  const run = () => {
    const rules = rulesFor(library.value, query.value.trim());
    out.innerHTML = rules.length
      ? table(rules.map((rule) => [rule.title, rule.body, rule.code || rule.level]))
      : '<p class="note">No rule in this library mentions that.</p>';
  };
  library.addEventListener('change', run);
  query.addEventListener('input', run);
  run();
}

const VIEWS = {
  'plan-studio': planStudio,
  editor,
  'scene-2d': scene2D,
  'scene-3d': scene3D,
  app: appShell,
  'wall-designer': wallDesigner,
  'kitchen-designer': kitchenDesigner,
  toolbox,
  demo,
  'webgpu-demo': webgpuDemo,
  'framing-designer': framingDesigner,
  'deck-designer': deckDesigner,
  'roof-designer': roofDesigner,
  'stair-designer': stairStraight,
  'stair-l-designer': stairL,
  'stair-u-designer': stairU,
  'stair-spiral-designer': stairSpiral,
  'stair-steep-designer': stairSteep,
  'stair-gallery': stairGallery,
  'stair-parts': stairParts,
  'stair-glossary': stairGlossary,
  'foundation-designer': foundationDesigner,
  'electrical-designer': electricalDesigner,
  'lighting-designer': lightingDesigner,
  'plumbing-designer': plumbingDesigner,
  'landscape-designer': landscapeDesigner,
  'site-plan': sitePlan,
  'project-dashboard': dashboard,
  'project-schedule': schedule,
  'permits-inspections': permits,
  'code-rules': codeRules,
  'bid-builder': bidBuilder,
  'price-book': priceBook,
  pricing,
  calc,
  index: home,
  features,
  gallery,
  about,
  contact,
};

function nav() {
  const host = document.getElementById('nav');
  host.innerHTML = GROUPS.map(([group, ids]) =>
    `<h3>${group}</h3>${ids.map((id) =>
      `<a href="#/${id}" data-id="${id}">${TITLES[id] || id}</a>`).join('')}`).join('');
}

function currentId() {
  return location.hash.replace(/^#\/?/, '') || 'index';
}

function render() {
  if (activeViewer) { activeViewer.dispose(); activeViewer = null; }
  const id = currentId();
  const view = document.getElementById('view');
  view.innerHTML = '';
  (VIEWS[id] || home)(view);
  document.querySelectorAll('#nav a').forEach((link) => {
    link.classList.toggle('on', link.dataset.id === id);
  });
  view.scrollIntoView({ block: 'start' });
}

nav();
setStatus();
window.addEventListener('hashchange', render);
render();
