import { getProjectSnapshot, renderProgressBar, renderRelatedPricing, onProjectChange } from '../../shared/project-context.js';
import { FLOORPLAN_USE_CASES, useCaseStatus, collectUseCaseInputs, checkUseCase, summarizeAutosave, summarizeLighting } from '../../shared/floorplan-usecases.js';
import { ensureSeededAutosave } from '../../shared/demo-plan.js';
const CARDS = [
    { id: 'site', title: '01 · Site plan', page: 'site-plan.html', key: 'site-plan-draft', action: 'Place the house inside setbacks', detail: 'Lot, coverage, driveway' },
    { id: 'floorplan', title: '02 · Floorplan', page: 'Editor.html', key: 'floorplan3d_autosave', action: 'Draw walls, rooms, openings', detail: 'The source every plan stacks on' },
    { id: 'foundation', title: '03 · Foundation plan', page: 'foundation-designer.html', key: 'foundation-suite-draft', action: 'Size footings from soil + frost', detail: 'Strips, slab, rebar' },
    { id: 'framing', title: '04 · Framing plan', page: 'framing-designer.html', key: 'framing-suite-draft', action: 'Stud walls + headers', detail: 'Cut list + sheathing' },
    { id: 'mep', title: '05 · MEP plans', page: 'electrical-designer.html', key: 'electrical-suite-draft', action: 'Overlay plumbing + electrical', detail: 'Clash check in Layers' },
    { id: 'cost', title: '06 · Price the plans', page: 'bid-builder.html', key: 'bid-builder-state', action: 'Quotes → bid → schedule', detail: 'Every takeoff in one bid' }
];
function started(key) { try { const v = localStorage.getItem(key); return v != null && String(v).length > 2; } catch { return false; } }
function paintCards() {
    document.getElementById('plan-cards').innerHTML = CARDS.map((c) => {
        const on = started(c.key);
        return `<div class="rounded-lg border p-3 ${on ? 'step-done' : 'bg-white'} border-slate-200">
            <div class="flex items-center justify-between gap-2"><b class="text-[12px]">${c.title}</b><span class="text-[9px] font-bold ${on ? 'text-emerald-700' : 'text-slate-400'}">${on ? '● PLAN EXISTS' : '○ NOT STARTED'}</span></div>
            <p class="text-[11px] text-slate-600 mt-0.5">${c.action}</p>
            <p class="text-[10px] text-slate-400">${c.detail}</p>
            <a href="${c.page}" class="mt-2 inline-block rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold hover:bg-slate-50">${on ? 'Open + refine →' : 'Create plan →'}</a>
        </div>`;
    }).join('');
    document.getElementById('logic-list').innerHTML = CARDS.map((c, i) => {
        const next = CARDS[i + 1];
        return `<div class="rounded-lg border border-slate-200 p-2 bg-slate-50/60"><b>${c.title}.</b> ${c.action}.${next ? ` Then <a class="underline" href="${next.page}">${next.title}</a>.` : ' Then build.'}</div>`;
    }).join('');
}
function fitCanvas(id) {
    const c = document.getElementById(id), r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = Math.max(r.width * dpr, 50); c.height = Math.max(r.height * dpr, 50);
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    return { x, W: r.width, H: r.height };
}
function drawPlan() {
    const { x, W, H } = fitCanvas('v-plan');
    x.fillStyle = '#f8fafc'; x.fillRect(0, 0, W, H);
    let walls = [];
    try { const raw = JSON.parse(localStorage.getItem('floorplan3d_autosave') || 'null'); walls = raw?.walls || raw?.stories?.[0]?.walls || []; } catch {}
    x.fillStyle = '#0f172a'; x.font = 'bold 10px system-ui'; x.fillText(walls.length ? `${walls.length} WALLS · LIVE` : 'NO FLOORPLAN YET · OPEN EDITOR', 10, 18);
    if (!walls.length) { x.fillStyle = '#64748b'; x.font = '11px system-ui'; x.fillText('Draw walls in the Editor — this visual updates automatically.', 10, H / 2); return; }
    const pts = walls.flatMap((w) => [w.start || { x: w.x1 || 0, y: w.z1 || 0 }, w.end || { x: w.x2 || 0, y: w.z2 || 0 }]);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const bw = Math.max(...xs) - Math.min(...xs) || 1, bh = Math.max(...ys) - Math.min(...ys) || 1;
    const s = Math.min((W - 40) / bw, (H - 60) / bh);
    const ox = 20 - Math.min(...xs) * s, oy = 36 - Math.min(...ys) * s;
    x.strokeStyle = '#0f172a'; x.lineWidth = 4; x.lineCap = 'round';
    walls.forEach((w) => {
        const a = w.start || { x: w.x1 || 0, y: w.z1 || 0 }, b = w.end || { x: w.x2 || 0, y: w.z2 || 0 };
        x.beginPath(); x.moveTo(ox + a.x * s, oy + a.y * s); x.lineTo(ox + b.x * s, oy + b.y * s); x.stroke();
    });
}
function drawOverlay() {
    const { x, W, H } = fitCanvas('v-overlay');
    x.fillStyle = '#0b1220'; x.fillRect(0, 0, W, H);
    x.font = 'bold 10px system-ui';
    x.fillStyle = '#7dd3fc'; x.fillText('SITE', 10, 18);
    x.strokeStyle = '#7dd3fc'; x.strokeRect(10, 26, W - 20, H - 60);
    x.fillStyle = '#86efac'; x.fillText('FOUNDATION', 10, H - 26);
    x.strokeStyle = '#86efac'; x.strokeRect(30, 46, W - 60, H - 100);
    x.fillStyle = '#fcd34d'; x.fillText('MEP', W - 50, 18);
    x.strokeStyle = '#fcd34d'; x.setLineDash([5, 4]);
    x.beginPath(); x.moveTo(30, H - 40); x.lineTo(W - 30, 46); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#94a3b8'; x.font = '9px system-ui';
    x.fillText('One footprint · site + foundation + services stacked', 10, H - 10);
}
function paintAll() { paintCards(); drawPlan(); drawOverlay(); paintUseCases(); drawInteriors(); drawRcp(); drawSection(); renderProgressBar(document.getElementById('studio-progress'), getProjectSnapshot()); }

// --- Floorplan use cases (mirrors the SketchUp drawing set) ----------------
const DOT = { pass: '#16a34a', warn: '#d97706', todo: '#cbd5e1' };

function paintUseCases() {
    const status = useCaseStatus();
    const cards = document.getElementById('uc-cards');
    if (cards) {
        cards.innerHTML = status.map((u) => {
            const also = (u.also || []).map((p) => `<a href="${p}" class="underline text-slate-500">${p.replace('.html', '')}</a>`).join(' · ');
            return `<div class="rounded-lg border p-3 ${u.started ? 'step-done' : 'bg-white'} border-slate-200">
                <div class="flex items-center justify-between gap-2">
                    <b class="text-[12px]">${u.step} · ${u.label}</b>
                    <span class="flex items-center gap-1.5">
                        <span class="rounded bg-slate-100 px-1 py-px font-mono text-[9px] text-slate-500" title="SketchUp authoring source">${u.skp}</span>
                        <span class="text-[9px] font-bold ${u.started ? 'text-emerald-700' : 'text-slate-400'}">${u.started ? '● STARTED' : '○ NOT STARTED'}</span>
                    </span>
                </div>
                <p class="text-[11px] text-slate-600 mt-0.5">${u.blurb}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">Layers: ${u.layers.join(' · ')}</p>
                <div class="mt-1.5 flex items-center gap-2">
                    <a href="${u.page}" class="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold hover:bg-slate-50">${u.started ? 'Open + refine →' : 'Create →'}</a>
                    ${also ? `<span class="text-[10px] text-slate-400">also ${also}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    }
    const list = document.getElementById('uc-checks');
    if (list) {
        const ctx = collectUseCaseInputs();
        list.innerHTML = FLOORPLAN_USE_CASES.map((u) => {
            const checks = checkUseCase(u.id, ctx);
            return `<div class="rounded-lg border border-slate-200 p-2 bg-slate-50/60">
                <div class="flex items-baseline justify-between gap-2"><b>${u.step} · ${u.label}.</b><a class="underline text-[10px]" href="${u.page}">${u.page.replace('.html', '')} →</a></div>
                <div class="mt-1 space-y-0.5">${checks.map((c) =>
                    `<div class="flex items-start gap-1.5"><span style="color:${DOT[c.status]};font-weight:700">${c.status === 'pass' ? '●' : c.status === 'warn' ? '▲' : '○'}</span><span><b>${c.label}</b> — ${c.detail}</span></div>`
                ).join('')}</div>
                <div class="mt-1 text-slate-500">Next: ${u.action}</div>
            </div>`;
        }).join('');
    }
}

function fitWalls(walls) {
    const pts = walls.flatMap((w) => [w.start || { x: w.x1 || 0, y: w.z1 ?? w.y1 ?? 0 }, w.end || { x: w.x2 || 0, y: w.z2 ?? w.y2 ?? 0 }]);
    const xs = pts.map((p) => Number(p.x) || 0), ys = pts.map((p) => Number(p.y) || 0);
    return { minX: Math.min(...xs), minY: Math.min(...ys), bw: (Math.max(...xs) - Math.min(...xs)) || 1, bh: (Math.max(...ys) - Math.min(...ys)) || 1 };
}

const FURN_COLOUR = (type = '') => {
    if (/bed|nightstand|wardrobe|rug|sofa|armchair|coffee|tv_stand|desk|office_chair|bookshelf|sideboard|dining|lounger|patio/.test(type)) return '#7c3aed';
    if (/stove|fridge|kitchen|stove|merlot|shaker|sink/.test(type)) return '#d97706';
    if (/bathtub|toilet|shower/.test(type)) return '#0284c7';
    if (/door|window/.test(type)) return '#0f172a';
    return '#16a34a';
};

/** Interiors visual: furniture plan — walls thin, fixtures as colour dots. */
function drawInteriors() {
    const el = document.getElementById('v-interiors');
    if (!el) return;
    const { x, W, H } = fitCanvas('v-interiors');
    x.fillStyle = '#f8fafc'; x.fillRect(0, 0, W, H);
    let autosave = null;
    try { autosave = JSON.parse(localStorage.getItem('floorplan3d_autosave') || 'null'); } catch {}
    const summary = summarizeAutosave(autosave);
    x.fillStyle = '#0f172a'; x.font = 'bold 10px system-ui';
    if (!summary) {
        x.fillText('NO FLOORPLAN YET · OPEN EDITOR', 10, 18);
        x.fillStyle = '#64748b'; x.font = '11px system-ui';
        x.fillText('Furniture dots appear once rooms are furnished.', 10, H / 2);
        return;
    }
    const box = fitWalls(summary.walls);
    const s = Math.min((W - 40) / box.bw, (H - 70) / box.bh);
    const ox = 20 - box.minX * s, oy = 36 - box.minY * s;
    x.fillText(`${summary.fixtures.length} FIXTURES · LIVE`, 10, 18);
    x.strokeStyle = '#94a3b8'; x.lineWidth = 1.5;
    summary.walls.forEach((w) => {
        const a = w.start || { x: w.x1 || 0, y: w.z1 ?? w.y1 ?? 0 }, b = w.end || { x: w.x2 || 0, y: w.z2 ?? w.y2 ?? 0 };
        x.beginPath(); x.moveTo(ox + a.x * s, oy + a.y * s); x.lineTo(ox + b.x * s, oy + b.y * s); x.stroke();
    });
    summary.fixtures.forEach((f) => {
        x.fillStyle = FURN_COLOUR(f.type);
        x.beginPath(); x.arc(ox + (Number(f.x) || 0) * s, oy + (Number(f.y) || 0) * s, 4, 0, Math.PI * 2); x.fill();
    });
    x.font = '9px ui-monospace,monospace'; let lx = 12;
    [['#7c3aed', 'rooms'], ['#d97706', 'cook'], ['#0284c7', 'wash'], ['#16a34a', 'other']].forEach(([colour, label]) => {
        x.fillStyle = colour; x.beginPath(); x.arc(lx + 4, H - 16, 3.5, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#475569'; x.textAlign = 'left'; x.fillText(label, lx + 10, H - 13);
        lx += 10 + x.measureText(label).width + 14;
    });
}

/** RCP visual: reflected ceiling — grid, luminaires, switches from the lighting draft. */
function drawRcp() {
    const el = document.getElementById('v-rcp');
    if (!el) return;
    const { x, W, H } = fitCanvas('v-rcp');
    x.fillStyle = '#1e293b'; x.fillRect(0, 0, W, H);
    let raw = null, auto = null;
    try { raw = JSON.parse(localStorage.getItem('lighting-suite-plan') || 'null'); } catch {}
    try { auto = JSON.parse(localStorage.getItem('floorplan3d_autosave') || 'null'); } catch {}
    let rcp = summarizeLighting(raw);
    if (!rcp) {
        const s = summarizeAutosave(auto);
        if (!s) {
            x.fillStyle = '#e2e8f0'; x.font = 'bold 10px system-ui'; x.fillText('NO CEILING PLAN YET', 10, 18);
            x.fillStyle = '#94a3b8'; x.font = '11px system-ui'; x.fillText('Open Lighting → auto-place lights.', 10, H / 2);
            return;
        }
        rcp = { width: s.widthM, depth: s.depthM, height: s.wallHeight, mountingHeight: s.wallHeight - 0.3, roomType: 'whole plan', luminaires: [], switches: [], circuits: 0 };
    }
    const pad = 44;
    const sc = Math.min((W - pad * 2) / rcp.width, (H - pad * 2 - 30) / rcp.depth);
    const ox = (W - rcp.width * sc) / 2, oy = 40 + (H - 40 - rcp.depth * sc) / 2;
    const toS = (mx, my) => ({ x: ox + mx * sc, y: oy + my * sc });
    x.fillStyle = '#7dd3fc'; x.font = 'bold 10px system-ui';
    x.fillText(`RCP · ${rcp.roomType.toUpperCase()} · ${rcp.height.toFixed(2)} M CLG`, 10, 18);
    const c0 = toS(0, 0);
    x.fillStyle = '#0f172a'; x.fillRect(c0.x, c0.y, rcp.width * sc, rcp.depth * sc);
    x.strokeStyle = '#475569'; x.lineWidth = 1;
    for (let gx = 0; gx <= rcp.width + 1e-6; gx += 0.6) {
        const a = toS(gx, 0), b = toS(gx, rcp.depth);
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
    }
    for (let gy = 0; gy <= rcp.depth + 1e-6; gy += 0.6) {
        const a = toS(0, gy), b = toS(rcp.width, gy);
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
    }
    x.strokeStyle = '#e2e8f0'; x.lineWidth = 2; x.strokeRect(c0.x, c0.y, rcp.width * sc, rcp.depth * sc);
    rcp.luminaires.forEach((d) => {
        const p = toS(d.x, d.y);
        x.strokeStyle = '#fbbf24'; x.lineWidth = 1.6;
        x.beginPath(); x.arc(p.x, p.y, 6, 0, Math.PI * 2); x.stroke();
        x.beginPath();
        x.moveTo(p.x - 4, p.y - 4); x.lineTo(p.x + 4, p.y + 4);
        x.moveTo(p.x + 4, p.y - 4); x.lineTo(p.x - 4, p.y + 4);
        x.stroke();
    });
    rcp.switches.forEach((d) => {
        const p = toS(d.x, d.y);
        x.fillStyle = '#38bdf8'; x.fillRect(p.x - 3, p.y - 3, 6, 6);
    });
    if (!rcp.luminaires.length) {
        x.fillStyle = '#94a3b8'; x.font = '11px system-ui'; x.textAlign = 'center';
        x.fillText('No fittings — open Lighting → auto-place', W / 2, oy + (rcp.depth * sc) / 2);
        x.textAlign = 'left';
    }
    x.fillStyle = '#94a3b8'; x.font = '9px ui-monospace,monospace';
    x.fillText(`${rcp.luminaires.length} FITTINGS · ${rcp.switches.length} SWITCHES · ${rcp.circuits} CKTS @ ${rcp.mountingHeight.toFixed(2)} M`, 10, H - 10);
}

/** Section visual: indicative cross-section from storey heights + roof. */
function drawSection() {
    const el = document.getElementById('v-section');
    if (!el) return;
    const { x, W, H } = fitCanvas('v-section');
    x.fillStyle = '#f8fafc'; x.fillRect(0, 0, W, H);
    let autosave = null;
    try { autosave = JSON.parse(localStorage.getItem('floorplan3d_autosave') || 'null'); } catch {}
    const s = summarizeAutosave(autosave);
    x.fillStyle = '#0f172a'; x.font = 'bold 10px system-ui';
    if (!s) {
        x.fillText('NO SECTION YET · OPEN EDITOR', 10, 18);
        x.fillStyle = '#64748b'; x.font = '11px system-ui';
        x.fillText('Draw a plan to cut a section through it.', 10, H / 2);
        return;
    }
    let roof = null;
    try { roof = JSON.parse(localStorage.getItem('roof-suite-draft') || localStorage.getItem('roof-editor-draft') || 'null'); } catch {}
    const span = Math.max(s.widthM, 1), wallH = s.wallHeight, slab = s.floorDepth;
    const rise = roof ? Math.min(Math.max(Number(roof.ridgeHeight) || Number(s.roofConfig?.height) || 1.5, 0.6), 4.5) : 1.5;
    const padX = 50, baseY = H - 52, topY = 44;
    const sc = Math.min((W - padX * 2) / span, (baseY - topY) / (wallH + slab + rise));
    const ox = (W - span * sc) / 2;
    const wallTop = baseY - (wallH + slab) * sc, slabTop = baseY - slab * sc;
    x.fillStyle = '#0f172a';
    x.fillText(`SECTION A–A · ${span.toFixed(1)} M SPAN`, 10, 18);
    // Ground + hatch.
    x.strokeStyle = '#0f172a'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(10, baseY); x.lineTo(W - 10, baseY); x.stroke();
    x.strokeStyle = '#94a3b8'; x.lineWidth = 1;
    for (let hx = 14; hx < W - 10; hx += 12) {
        x.beginPath(); x.moveTo(hx, baseY); x.lineTo(hx - 7, baseY + 9); x.stroke();
    }
    // Slab.
    x.fillStyle = '#cbd5e1'; x.fillRect(ox, slabTop, span * sc, slab * sc);
    x.strokeStyle = '#475569'; x.strokeRect(ox, slabTop, span * sc, slab * sc);
    // Walls at both ends.
    x.fillStyle = '#e7e5e4';
    const wt = Math.max(4, 0.15 * sc);
    [[ox, 1], [ox + span * sc - wt, -1]].forEach(([wx]) => {
        x.fillRect(wx, wallTop, wt, wallH * sc);
        x.strokeStyle = '#57534e'; x.strokeRect(wx, wallTop, wt, wallH * sc);
    });
    x.fillStyle = '#f8fafc'; x.fillRect(ox + wt, wallTop, span * sc - wt * 2, wallH * sc);
    // Roof mass (solid when designed, dashed preview otherwise).
    const ridgeY = wallTop - rise * sc;
    x.beginPath(); x.moveTo(ox - 8, wallTop); x.lineTo(ox + (span * sc) / 2, ridgeY); x.lineTo(ox + span * sc + 8, wallTop); x.closePath();
    if (roof) { x.fillStyle = '#fed7aa'; x.fill(); x.strokeStyle = '#9a3412'; x.lineWidth = 2; x.stroke(); }
    else { x.setLineDash([6, 4]); x.strokeStyle = '#9a3412'; x.lineWidth = 1.5; x.stroke(); x.setLineDash([]); }
    // Dimensions.
    x.fillStyle = '#475569'; x.font = '9px ui-monospace,monospace'; x.textAlign = 'center';
    x.fillText(`${span.toFixed(1)} m`, ox + (span * sc) / 2, baseY + 22);
    x.save(); x.translate(ox - 14, (wallTop + slabTop) / 2); x.rotate(-Math.PI / 2);
    x.fillText(`${wallH.toFixed(2)} m`, 0, 0); x.restore();
    x.fillText(roof ? `ridge +${rise.toFixed(2)} m` : `roof preview +${rise.toFixed(2)} m — design it`, ox + (span * sc) / 2, Math.max(ridgeY - 6, 30));
    x.textAlign = 'left';
    x.fillStyle = '#94a3b8'; x.fillText('Indicative massing — not a construction section.', 10, H - 10);
}
document.getElementById('open-3d').addEventListener('click', () => import('../../shared/project-viewer.js').then(({ openProjectViewer }) => openProjectViewer()));
window.addEventListener('resize', () => { paintUseCases(); drawPlan(); drawOverlay(); drawInteriors(); drawRcp(); drawSection(); });
// Same default as the Editor/demo/landing page: first visit seeds the
// Southern Farmhouse plan, then repaints so every card, check and visual
// reflects it without a reload.
ensureSeededAutosave().then((result) => { if (result.seeded) paintAll(); }).catch(() => {});
onProjectChange(() => paintAll());
paintAll();
renderRelatedPricing(document.getElementById('related-pricing'), ['framing', 'plumbing', 'electrical']);
