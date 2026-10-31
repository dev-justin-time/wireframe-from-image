// Blueprint Studio — the floorplan3d screens over the image→plan extractor.
// No dependencies: the plan comes from POST /api/plan, the wireframe from the
// OBJ the server writes, and each designer computes from the plan plus inputs.

const GROUPS = [
  ['Design', ['plan-studio', 'editor', 'app', 'wall-designer', 'kitchen-designer', 'toolbox', 'demo', 'webgpu-demo']],
  ['Structure', ['framing-designer', 'deck-designer', 'roof-designer', 'stair-designer', 'stair-l-designer',
    'stair-u-designer', 'stair-spiral-designer', 'stair-steep-designer', 'stair-gallery', 'stair-parts',
    'stair-glossary', 'foundation-designer']],
  ['Systems', ['electrical-designer', 'lighting-designer', 'plumbing-designer']],
  ['Site', ['landscape-designer', 'site-plan']],
  ['Project', ['project-dashboard', 'project-schedule', 'permits-inspections', 'bid-builder', 'price-book',
    'pricing', 'calc']],
  ['About', ['index', 'features', 'gallery', 'about', 'contact']],
];

const TITLES = {
  'plan-studio': 'Plan studio', editor: 'Editor', app: 'App', 'wall-designer': 'Wall designer',
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
      root.querySelectorAll('[data-k]').forEach((input) => { values[input.dataset.k] = num(input.value, 0); });
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
  host.innerHTML = `
    ${cards([
      [d.walls.length, 'walls', `${f(d.takeoff.wallLength, 2)} m`],
      [d.rooms.length, 'rooms', `${f(d.takeoff.floorArea, 2)} m²`],
      [f(d.takeoff.floorArea, 1), 'm² floor', `${f(d.takeoff.volume, 1)} m³`],
      [d.segments, 'segments', `${f(d.mmPerPx, 1)} mm/px`],
    ])}
    <canvas class="wire" id="wire"></canvas>
    <p class="hint">Room polygons are filled behind the walls. Drag to pan, wheel to zoom.
      The plan is saved in this browser, so every screen keeps it after a reload.
      <a class="btn" href="${d.obj}" download>Download OBJ</a>
      <a class="btn" href="#" id="dl-plan">Download plan JSON</a></p>
    ${table([
      ['Wall length', f(d.takeoff.wallLength), 'm'],
      ['Wall area (gross)', f(d.takeoff.wallGrossArea), 'm²'],
      ['Floor area', f(d.takeoff.floorArea), 'm²'],
      ['Volume', f(d.takeoff.volume), 'm³'],
      ['Drywall', d.takeoff.drywallSheets, 'sheets'],
      ['Paint', d.takeoff.paintLitres, 'L'],
      ['Flooring (+10%)', f(d.takeoff.flooringM2), 'm²'],
      ['Baseboard', f(d.takeoff.baseboardM), 'm'],
      ['Studs', d.takeoff.studs, 'ea'],
      ['Plates', f(d.takeoff.platesM), 'm'],
      ['Sheathing', d.takeoff.sheathingPanels, 'panels'],
    ])}`;
  drawObj(host.querySelector('#wire'), d.obj, d.rooms).catch(() => {});
  host.querySelector('#dl-plan').onclick = (e) => {
    e.preventDefault();
    download(`${d.project || 'plan'}.json`, JSON.stringify(d.plan, null, 2));
  };
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
      <label><span>Wall height</span><input type="number" name="wallHeight" step="0.05" value="${state.data?.wallHeight ?? 2.7}"><em>m</em></label>
      <label><span>Stud spacing</span><input type="number" name="studSpacing" step="1" value="${state.data?.studSpacingMm ?? 406}"><em>mm</em></label>
    </form>
    <p><button class="primary" id="go">Detect plan</button>
      <button id="clear">Clear saved plan</button> <span id="msg" class="hint"></span></p>
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
  planResult(result);
}

function editor(root) {
  root.innerHTML = `<h2>Editor</h2><p class="note">The detected plan as an editable list: walls first, then rooms and their polygons.</p>
    <div id="res"></div><h3>Walls</h3><div id="walls"></div><h3>Rooms</h3><div id="rooms"></div>`;
  planResult(root.querySelector('#res'));
  const d = data();
  root.querySelector('#walls').innerHTML = d
    ? table(d.walls.map((w, i) => [`Wall ${i + 1}`, `(${f(w.x1)}, ${f(w.y1)}) → (${f(w.x2)}, ${f(w.y2)})`, `${f(w.length, 2)} m`]))
    : '<p class="hint">No plan yet.</p>';
  root.querySelector('#rooms').innerHTML = d
    ? table(d.rooms.map((r) => [r.name, `${f(r.area, 2)} m² · ${f(r.perimeter, 2)} m perimeter`, `${r.polygon.length} pts`]))
    : '<p class="hint">No plan yet.</p>';
}

function appShell(root) {
  root.innerHTML = `<h2>App</h2><p class="note">Every screen in this studio, one per floorplan3d page. Each designer recomputes as you type.</p>
    ${GROUPS.map(([group, ids]) => `<h3>${group}</h3><div class="cards">${ids.map((id) =>
      `<div class="card"><span>${TITLES[id] || id}</span><br><a href="#/${id}">open</a></div>`).join('')}</div>`).join('')}`;
}

const wallDesigner = designer({
  title: 'Wall designer',
  blurb: 'Pick a detected wall and price its framing and finish.',
  fields: () => {
    const walls = data()?.walls ?? [];
    return [
      { k: 'index', label: 'Wall', type: 'select', value: 0, options: walls.length ? walls.map((w, i) => [i, `Wall ${i + 1} · ${f(w.length, 2)} m`]) : [[0, 'No plan loaded']] },
      { k: 'height', label: 'Height', unit: 'm', value: height() },
      { k: 'spacing', label: 'Stud spacing', unit: 'mm', value: spacer() },
      { k: 'opening', label: 'Openings', unit: 'm', value: 0 },
    ];
  },
  compute: (v) => {
    const wall = data()?.walls[v.index] ?? { length: wallLen() };
    const length = wall.length;
    const gross = length * v.height;
    const studs = Math.floor(length * 1000 / Math.max(v.spacing, 1)) + 1 + 2 * (v.opening > 0 ? 1 : 0);
    return {
      rows: [
        ['Length', f(length), 'm'],
        ['Gross area', f(gross), 'm²'],
        ['Net area (openings)', f(Math.max(gross - v.opening * 2.1, 0)), 'm²'],
        ['Studs', studs, 'ea'],
        ['Plates (3 runs)', f(length * 3), 'm'],
        ['Sheathing', ceil(gross / 2.88), 'sheets'],
        ['Drywall', ceil((gross + length * 0.3) / 2.88), 'sheets'],
      ],
    };
  },
});

const kitchenDesigner = designer({
  title: 'Kitchen designer',
  blurb: 'A linear run: base and wall cabinets, worktop and toe kick.',
  fields: () => [
    { k: 'run', label: 'Run length', unit: 'm', value: 3.6 },
    { k: 'baseWidth', label: 'Base cabinet width', unit: 'm', value: 0.6 },
    { k: 'wallRun', label: 'Wall cabinet run', unit: 'm', value: 2.4 },
    { k: 'topDepth', label: 'Worktop depth', unit: 'm', value: 0.62 },
  ],
  compute: (v) => {
    const base = ceil(v.run / Math.max(v.baseWidth, 0.3));
    const wall = ceil(v.wallRun / Math.max(v.baseWidth, 0.3));
    return {
      cards: [[base, 'base cabinets', `${f(v.run, 2)} m`], [wall, 'wall cabinets', `${f(v.wallRun, 2)} m`], [f(v.run * v.topDepth, 2), 'm² worktop']],
      rows: [
        ['Base cabinets', base, 'ea'],
        ['Wall cabinets', wall, 'ea'],
        ['Worktop', f(v.run * v.topDepth), 'm²'],
        ['Toe kick', f(v.run), 'm'],
        ['Splashback', f(v.wallRun * 0.6), 'm²'],
        ['Door and drawer fronts', base + wall, 'ea'],
      ],
    };
  },
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

const framingDesigner = designer({
  title: 'Framing designer',
  blurb: 'Studs, plates, sheathing and drywall from the plan geometry at the chosen spacing.',
  fields: () => [
    { k: 'length', label: 'Wall length', unit: 'm', value: f(wallLen(), 2) },
    { k: 'spacing', label: 'Stud spacing', unit: 'mm', value: spacer() },
    { k: 'height', label: 'Height', unit: 'm', value: height() },
    { k: 'openings', label: 'Opening width', unit: 'm', value: 0 },
  ],
  compute: (v) => {
    const studs = Math.floor(v.length * 1000 / Math.max(v.spacing, 1)) + 1 + 2 * (v.openings > 0 ? 1 : 0);
    const gross = v.length * v.height;
    const floor = floorArea();
    const covered = gross + floor;
    return {
      cards: [[studs, 'studs', `${v.spacing} mm o.c.`], [ceil(covered / 2.88), 'drywall sheets'], [f(covered, 1), 'm² to cover']],
      rows: [
        ['Studs', studs, 'ea'],
        ['Extra studs at openings', v.openings > 0 ? 2 : 0, 'ea'],
        ['Plates (bottom + double top)', f(v.length * 3), 'm'],
        ['Sheathing', ceil(gross / 2.88), 'panels'],
        ['Drywall (walls + ceiling)', ceil(covered / 2.88), 'sheets'],
        ['Paint (2 coats, 10 m²/L)', ceil(covered * 2 / 10), 'L'],
      ],
    };
  },
});

const deckDesigner = designer({
  title: 'Deck designer',
  blurb: 'Joists, posts, footings and decking for a rectangular deck.',
  fields: () => [
    { k: 'width', label: 'Width', unit: 'm', value: 3.6 },
    { k: 'projection', label: 'Projection', unit: 'm', value: 3.0 },
    { k: 'joistSpacing', label: 'Joist spacing', unit: 'm', value: 0.406 },
    { k: 'postSpacing', label: 'Post spacing', unit: 'm', value: 1.8 },
    { k: 'soil', label: 'Soil bearing', unit: 'psf', value: 2000 },
  ],
  compute: (v) => {
    const area = v.width * v.projection;
    const joists = ceil(v.projection / Math.max(v.joistSpacing, 0.2)) + 1;
    const posts = Math.max(4, ceil(v.width / Math.max(v.postSpacing, 0.6)) * 2);
    const postLoad = 50 * v.postSpacing * (v.projection / 2);
    const footingIn = Math.max(12, Math.sqrt(4 * (postLoad / Math.max(v.soil, 500)) / Math.PI / 0.09290304) * 12);
    const footingVolume = posts * Math.PI * Math.pow(footingIn * 0.0254 / 2, 2) * 0.9;
    return {
      cards: [[f(area, 1), 'm² deck'], [joists, 'joists'], [posts, 'posts']],
      rows: [
        ['Deck area', f(area), 'm²'],
        ['Joists', joists, 'ea'],
        ['Rim joists', 2, 'ea'],
        ['Posts', posts, 'ea'],
        ['Post load', f(postLoad, 0), 'lb'],
        ['Footing diameter', f(footingIn, 1), 'in'],
        ['Concrete', f(footingVolume, 2), 'm³'],
        ['Concrete bags (0.017 m³)', ceil(footingVolume / 0.017), 'bags'],
        ['Decking boards (3.6 m)', ceil(area * 1.05 / (0.14 * 3.6)), 'ea'],
      ],
    };
  },
});

const roofDesigner = designer({
  title: 'Roof designer',
  blurb: 'Slope factor, roof area, covering and the layer takeoff for a chosen pitch.',
  fields: () => [
    { k: 'floor', label: 'Plan area', unit: 'm²', value: f(floorArea(), 2) },
    { k: 'pitch', label: 'Pitch', unit: 'rise:12', value: 6 },
    { k: 'overhang', label: 'Overhang', unit: 'm', value: 0.45 },
    { k: 'covering', label: 'Covering', type: 'select', value: 'arch', options: [['3tab', '3-tab shingle'], ['arch', 'Architectural shingle'], ['metal', 'Standing-seam metal'], ['tile', 'Clay tile'], ['slate', 'Slate']] },
  ],
  compute: (v) => {
    const slope = Math.sqrt(1 + Math.pow(v.pitch / 12, 2));
    const planArea = v.floor + Math.max(v.overhang, 0) * 2 * (Math.sqrt(v.floor) * 4);
    const area = planArea * slope;
    const squares = area / 9.2903;
    const rates = { '3tab': 115, arch: 155, metal: 520, tile: 920, slate: 1650 };
    const units = { '3tab': 3, arch: 3, metal: 1, tile: 100, slate: 220 };
    return {
      cards: [[f(area, 1), 'm² roof'], [f(squares, 2), 'squares'], [f(slope, 3), 'slope factor']],
      rows: [
        ['Slope factor', f(slope, 3), ''],
        ['Pitch angle', f(Math.atan(v.pitch / 12) * 180 / Math.PI, 1), '°'],
        ['Roof area', f(area), 'm²'],
        ['Squares', f(squares), ''],
        ['Squares with 10% waste', f(squares * 1.1), ''],
        ['Covering units', ceil(squares * 1.1 * units[v.covering]), units[v.covering] === 1 ? 'square' : 'units'],
        ['Covering cost', `$${f(squares * 1.1 * rates[v.covering], 0)}`, ''],
        ['Underlayment rolls (92.9 m²)', ceil(area * 1.05 / 92.9), 'rolls'],
        ['Sheathing (2.4 × 1.2 m)', ceil(area * 1.1 / 2.88), 'sheets'],
        ['Ice and water shield', ceil(area * 0.15 / 18.6), 'rolls'],
      ],
    };
  },
});

function stairDesigner({ title, blurb, extra = [], compute }) {
  return designer({
    title,
    blurb,
    fields: () => [
      { k: 'rise', label: 'Total rise', unit: 'm', value: 2.85 },
      { k: 'width', label: 'Width', unit: 'm', value: 1.0 },
      { k: 'run', label: 'Run available', unit: 'm', value: 4.2 },
      { k: 'tread', label: 'Tread depth', unit: 'm', value: 0.28 },
      ...extra,
    ],
    compute,
  });
}

function stairChecks(risers, rise, tread, v) {
  const riserH = rise / risers;
  const treads = Math.max(risers - 1, 1);
  const run = treads * tread;
  const comfortable = 2 * riserH + tread;
  return {
    rows: [
      ['Risers', risers, 'ea'],
      ['Riser height', f(riserH * 1000, 0), 'mm'],
      ['Treads', treads, 'ea'],
      ['Tread depth', f(tread * 1000, 0), 'mm'],
      ['Run', f(run), 'm'],
      ['Run available', f(v.run), 'm'],
      ['2R + T', f(comfortable * 1000, 0), 'mm'],
      ['Riser ≤ 196 mm', riserH <= 0.196 + 1e-6 ? '<span class="ok">pass</span>' : '<span class="err">fail</span>', ''],
      ['Tread ≥ 254 mm', tread >= 0.254 - 1e-6 ? '<span class="ok">pass</span>' : '<span class="err">fail</span>', ''],
      ['Width ≥ 914 mm', v.width >= 0.914 - 1e-6 ? '<span class="ok">pass</span>' : '<span class="err">fail</span>', ''],
      ['Run fits', run <= v.run + 1e-6 ? '<span class="ok">pass</span>' : '<span class="err">fail</span>', ''],
    ],
  };
}

const stairDesignerMain = stairDesigner({
  title: 'Stair designer',
  blurb: 'Straight run against IRC R311.7: riser, tread, width and the 2R+T comfort rule.',
  compute: (v) => stairChecks(ceil(v.rise / 0.196), v.rise, v.tread, v),
});

const stairL = stairDesigner({
  title: 'L stair',
  blurb: 'Two flights at 90° with a landing.',
  extra: [{ k: 'landing', label: 'Landing', unit: 'm', value: 1.0 }],
  compute: (v) => {
    const risers = ceil(v.rise / 0.196);
    const result = stairChecks(risers, v.rise, v.tread, v);
    result.rows.push(['Flights', 2, 'ea'], ['Landing', f(v.landing), 'm'], ['Total run', f((risers - 1) * v.tread + v.landing), 'm']);
    return result;
  },
});

const stairU = stairDesigner({
  title: 'U stair',
  blurb: 'Two parallel flights with a half landing.',
  extra: [{ k: 'landing', label: 'Landing depth', unit: 'm', value: 1.2 }],
  compute: (v) => {
    const risers = ceil(v.rise / 0.196);
    const perFlight = Math.ceil(risers / 2);
    const result = stairChecks(risers, v.rise, v.tread, v);
    result.rows.push(['Flights', 2, 'ea'], ['Risers per flight', perFlight, 'ea'], ['Landing', f(v.landing), 'm'], ['Well width', f(v.width * 2 + 0.1), 'm']);
    return result;
  },
});

const stairSpiral = stairDesigner({
  title: 'Spiral stair',
  blurb: 'A helical flight: treads per turn and the walk line.',
  extra: [{ k: 'diameter', label: 'Diameter', unit: 'm', value: 1.6 }],
  compute: (v) => {
    const risers = ceil(v.rise / 0.196);
    const turnLength = Math.PI * Math.max(v.diameter - v.width, 0.3);
    return {
      rows: [
        ['Risers', risers, 'ea'],
        ['Riser height', f((v.rise / risers) * 1000, 0), 'mm'],
        ['Diameter', f(v.diameter), 'm'],
        ['Walk-line length', f(turnLength), 'm per turn'],
        ['Treads per turn', ceil(turnLength / Math.max(v.tread, 0.2)), 'ea'],
        ['Clear width', f(Math.max(v.diameter - v.width, 0)), 'm'],
        ['Headroom at 2.0 m rise', f(v.rise - 2.0), 'm'],
      ],
    };
  },
});

const stairSteep = stairDesigner({
  title: 'Steep stair (ship ladder)',
  blurb: '75° access stair: steeper risers, narrower treads, handrails both sides.',
  extra: [{ k: 'angle', label: 'Pitch', unit: '°', value: 70 }],
  compute: (v) => {
    const risers = ceil(v.rise / 0.23);
    return {
      rows: [
        ['Risers', risers, 'ea'],
        ['Riser height', f((v.rise / risers) * 1000, 0), 'mm'],
        ['Treads', Math.max(risers - 1, 1), 'ea'],
        ['Tread depth', f(v.tread * 1000, 0), 'mm'],
        ['Pitch', f(v.angle, 0), '°'],
        ['Run', f((risers - 1) * v.tread), 'm'],
        ['Handrail both sides', 'required', ''],
      ],
    };
  },
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
  blurb: 'NEC 220.42 lighting and receptacle tiers, then the 220.82 service load.',
  fields: () => [
    { k: 'area', label: 'Floor area', unit: 'm²', value: f(floorArea(), 1) },
    { k: 'sabc', label: 'Small-appliance circuits', unit: 'ea', value: 2 },
    { k: 'laundry', label: 'Laundry circuits', unit: 'ea', value: 1 },
    { k: 'appliances', label: 'Appliance load', unit: 'VA', value: 9000 },
    { k: 'heating', label: 'Heating', unit: 'VA', value: 0 },
    { k: 'cooling', label: 'Cooling', unit: 'VA', value: 12000 },
  ],
  compute: (v) => {
    const ft2 = v.area / 0.09290304;
    const general = ft2 * 3;
    const tiered = general <= 3000 ? general
      : 3000 + (Math.min(general, 120000) - 3000) * 0.35 + Math.max(0, general - 120000) * 0.25;
    const demand = tiered + v.sabc * 1500 + v.laundry * 1500 + v.appliances * 0.75 + Math.max(v.heating, v.cooling);
    const amps = demand / 240;
    const services = [100, 125, 150, 200, 225, 320, 400];
    const service = services.find((size) => size >= amps) ?? 400;
    return {
      cards: [[f(demand / 1000, 1), 'kVA demand'], [f(amps, 0), 'A at 240 V'], [service, 'A service']],
      rows: [
        ['Floor area', f(v.area, 1), 'm²'],
        ['General lighting (3 VA/ft²)', f(general, 0), 'VA'],
        ['Tiered general (220.42)', f(tiered, 0), 'VA'],
        ['Small-appliance circuits', f(v.sabc * 1500, 0), 'VA'],
        ['Laundry', f(v.laundry * 1500, 0), 'VA'],
        ['Appliances (75%)', f(v.appliances * 0.75, 0), 'VA'],
        ['Heating / cooling', f(Math.max(v.heating, v.cooling), 0), 'VA'],
        ['Total demand', f(demand, 0), 'VA'],
        ['Amps at 240 V', f(amps), 'A'],
        ['Service', service, 'A'],
      ],
    };
  },
});

const lightingDesigner = designer({
  title: 'Lighting designer',
  blurb: 'Lumen method: room index, utilization, average illuminance and the fitting count.',
  fields: () => [
    { k: 'width', label: 'Width', unit: 'm', value: 5.5 },
    { k: 'depth', label: 'Depth', unit: 'm', value: 4.2 },
    { k: 'mount', label: 'Mounting height', unit: 'm', value: 2.4 },
    { k: 'target', label: 'Target', unit: 'lx', value: 200 },
    { k: 'lumens', label: 'Lumens per fitting', unit: 'lm', value: 1100 },
    { k: 'watts', label: 'Watts per fitting', unit: 'W', value: 14 },
    { k: 'llf', label: 'Light loss factor', value: 0.8 },
    { k: 'cu', label: 'Coefficient of utilization', value: 0.55 },
  ],
  compute: (v) => {
    const area = Math.max(v.width * v.depth, 0.1);
    const index = area / (Math.max(v.mount, 0.1) * (v.width + v.depth));
    const required = v.lumens > 0 && v.cu * v.llf > 0 ? Math.ceil(v.target * area / (v.lumens * v.cu * v.llf)) : 0;
    const installed = required * v.lumens * v.cu * v.llf / area;
    return {
      cards: [[f(required, 0), 'fittings'], [f(installed, 0), 'lx achieved'], [f(required * v.watts / area, 2), 'W/m²']],
      rows: [
        ['Area', f(area), 'm²'],
        ['Room index', f(index), ''],
        ['Target', f(v.target, 0), 'lx'],
        ['Required fittings', required, 'ea'],
        ['Achieved illuminance', f(installed, 1), 'lx'],
        ['Connected load', f(required * v.watts, 0), 'W'],
        ['Lighting power density', f(required * v.watts / area, 2), 'W/m²'],
        ['Efficacy', f(v.lumens / Math.max(v.watts, 1), 1), 'lm/W'],
      ],
    };
  },
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
  compute: (v) => {
    const cold = v.wc * 2.5 + v.lav * 0.7 + v.tub * 0.7 + v.sink * 0.7;
    const hot = v.lav * 0.7 + v.tub * 0.7 + v.sink * 0.7 + v.washer * 0.7;
    const dfu = v.wc * 3 + v.lav * 1 + v.tub * 2 + v.sink * 2 + v.dish * 2 + v.washer * 2;
    const total = cold + hot;
    const service = total <= 8 ? '1/2' : total <= 18 ? '3/4' : total <= 35 ? '1' : '1-1/4';
    const drain = dfu <= 6 ? '2' : dfu <= 20 ? '3' : '4';
    return {
      cards: [[f(total, 1), 'WSFU'], [dfu, 'DFU'], [`${service} in`, 'service']],
      rows: [
        ['Cold WSFU', f(cold, 1), ''],
        ['Hot WSFU', f(hot, 1), ''],
        ['Total WSFU', f(total, 1), ''],
        ['Service size', `${service} in`, ''],
        ['Drainage fixture units', dfu, ''],
        ['Building drain', `${drain} in`, ''],
        ['Fixtures', v.wc + v.lav + v.tub + v.sink + v.dish + v.washer + v.bib, 'ea'],
      ],
    };
  },
});

const landscapeDesigner = designer({
  title: 'Landscape designer',
  blurb: 'Water body sizing: area, volume, turnover, flow and the filter.',
  fields: () => [
    { k: 'type', label: 'Feature', type: 'select', value: 'pool', options: [['pool', 'Pool'], ['spa', 'Spa'], ['fountain', 'Fountain'], ['pond', 'Pond']] },
    { k: 'shape', label: 'Shape', type: 'select', value: 'rectangle', options: [['rectangle', 'Rectangle'], ['circular', 'Circular'], ['kidney', 'Kidney']] },
    { k: 'width', label: 'Width', unit: 'm', value: 5.2 },
    { k: 'length', label: 'Length', unit: 'm', value: 9.5 },
    { k: 'deep', label: 'Depth', unit: 'm', value: 1.7 },
    { k: 'turnover', label: 'Turnover', unit: 'h', value: 6 },
  ],
  compute: (v) => {
    const area = v.shape === 'circular' ? Math.PI * Math.pow(v.width / 2, 2)
      : v.shape === 'kidney' ? v.width * v.length * 0.82 : v.width * v.length;
    const volume = area * v.deep;
    const gallons = volume * 264.172;
    const flow = gallons / (Math.max(v.turnover, 0.25) * 60);
    return {
      cards: [[f(gallons, 0), 'US gallons'], [f(flow, 1), 'gpm'], [f(flow * 40 / (3960 * 0.65), 2), 'hp']],
      rows: [
        ['Surface area', f(area), 'm²'],
        ['Area', f(area / 0.09290304, 0), 'sq ft'],
        ['Volume', f(volume), 'm³'],
        ['Gallons', f(gallons, 0), 'US gal'],
        ['Turnover', f(v.turnover, 2), 'h'],
        ['Flow', f(flow, 2), 'gpm'],
        ['Pump horsepower', f(flow * 40 / (3960 * 0.65), 2), 'hp'],
        ['Cartridge filter (0.25 gpm/sq ft)', f(flow / 0.25, 0), 'sq ft'],
        ['Skimmers (1 per 500 sq ft)', Math.max(1, Math.ceil(area / 0.09290304 / 500)), 'ea'],
      ],
    };
  },
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
  root.innerHTML = `<h2>Project dashboard</h2><p class="note">Everything the plan alone can answer.</p><div id="res"></div><div id="list"></div>`;
  planResult(root.querySelector('#res'));
  root.querySelector('#list').innerHTML = d
    ? table(d.rooms.map((room) => [room.name, `${f(room.area, 2)} m²`, `${f(room.perimeter, 2)} m`]))
    : '';
}

function schedule(root) {
  const t = takeoff();
  root.innerHTML = `<h2>Schedule</h2><p class="note">Indicative durations from the quantities: a planning sequence, not a critical path.</p>`;
  if (!t) { root.innerHTML += '<p class="hint">Load a plan first.</p>'; return; }
  const phases = [
    ['Site and setting out', Math.max(1, Math.ceil(t.floorArea / 80))],
    ['Foundation and slab', Math.max(2, Math.ceil(t.baseboardM / 12))],
    ['Framing', Math.max(2, Math.ceil(t.studs / 60))],
    ['Roof', Math.max(2, Math.ceil(t.floorArea / 35))],
    ['Rough-in (electrical, plumbing)', Math.max(2, Math.ceil(t.floorArea / 45))],
    ['Insulation and drywall', Math.max(2, Math.ceil(t.drywallSheets / 12))],
    ['Finishes and paint', Math.max(2, Math.ceil(t.paintLitres / 12))],
    ['Fixtures, trim and handover', Math.max(2, Math.ceil(t.floorArea / 50))],
  ];
  const total = phases.reduce((sum, [, days]) => sum + days, 0);
  root.innerHTML += table(phases.map(([name, days]) => [name, days, 'days']))
    + `<p class="hint">${total} working days in total.</p>`;
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

function bid(root) {
  const t = takeoff();
  root.innerHTML = `<h2>Bid builder</h2><p class="note">The takeoff at the rate book, with a contingency line.</p><div id="bid"></div>`;
  const host = root.querySelector('#bid');
  if (!t) { host.innerHTML = '<p class="hint">Load a plan first.</p>'; return; }
  const rows = [
    ['Framing', t.studs * 4.5 + t.platesM * RATES.framing],
    ['Sheathing', t.sheathingPanels * RATES.sheathing],
    ['Drywall', t.drywallSheets * RATES.drywall],
    ['Paint', t.paintLitres * RATES.paint],
    ['Flooring', t.flooringM2 * RATES.flooring],
    ['Roofing', t.floorArea * 1.35 * RATES.roofing * 0.35],
    ['Electrical', t.floorArea * RATES.electrical],
    ['Plumbing', t.floorArea * RATES.plumbing],
    ['Foundation', t.baseboardM * RATES.foundation * 0.55],
  ];
  const subtotal = rows.reduce((sum, [, value]) => sum + value, 0);
  const contingency = subtotal * 0.1;
  const total = subtotal + contingency;
  host.innerHTML = cards([[`$${f(total, 0)}`, 'bid', 'incl. 10% contingency'], [`$${f(total / Math.max(t.floorArea, 1), 0)}`, 'per m²']])
    + table(rows.map(([name, value]) => [name, `$${f(value, 0)}`, '']))
    + table([
      ['Subtotal', `$${f(subtotal, 0)}`, ''],
      ['Contingency 10%', `$${f(contingency, 0)}`, ''],
      ['Total', `$${f(total, 0)}`, ''],
    ]);
}

function priceBook(root) {
  root.innerHTML = `<h2>Price book</h2><p class="note">Planning rates per unit; the bid multiplies them by the takeoff.</p>`
    + table(Object.entries(RATES).map(([name, rate]) => [name, `$${rate}`, 'per unit']))
    + `<p class="hint">Labour and material combined, US dollars, 2024 planning level. Supplier quotes and permits replace these.</p>`;
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

const VIEWS = {
  'plan-studio': planStudio,
  editor,
  app: appShell,
  'wall-designer': wallDesigner,
  'kitchen-designer': kitchenDesigner,
  toolbox,
  demo,
  'webgpu-demo': webgpuDemo,
  'framing-designer': framingDesigner,
  'deck-designer': deckDesigner,
  'roof-designer': roofDesigner,
  'stair-designer': stairDesignerMain,
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
  'bid-builder': bid,
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
