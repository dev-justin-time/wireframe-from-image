import { renderRelatedPricing, onProjectChange } from '../../shared/project-context.js';
const $ = (id) => document.getElementById(id);
const KEY = 'site-plan-draft';
const defaults = { lotW: 30, lotD: 24, front: 6, side: 3, rear: 5, maxcov: 40, houseW: 9.6, houseD: 7.2, houseX: 10, houseY: 8 };
let cfg = { ...defaults };
try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw) cfg = { ...defaults, ...raw }; } catch {}
let drag = null;
function sync() { $('s-lotw').value = cfg.lotW; $('s-lotd').value = cfg.lotD; $('s-front').value = cfg.front; $('s-side').value = cfg.side; $('s-rear').value = cfg.rear; $('s-maxcov').value = cfg.maxcov; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} }
function metrics() {
    const houseA = cfg.houseW * cfg.houseD, lotA = cfg.lotW * cfg.lotD;
    const cov = lotA ? (houseA / lotA) * 100 : 0;
    const inX = cfg.houseX >= cfg.side && (cfg.houseX + cfg.houseW) <= (cfg.lotW - cfg.side);
    const inY = cfg.houseY >= cfg.front && (cfg.houseY + cfg.houseD) <= (cfg.lotD - cfg.rear);
    const okSet = inX && inY, okCov = cov <= cfg.maxcov;
    $('m-house').textContent = `${cfg.houseW.toFixed(1)} × ${cfg.houseD.toFixed(1)} m`;
    $('m-cov').textContent = `${cov.toFixed(1)}% / ${cfg.maxcov}%`;
    $('m-cov').style.color = okCov ? '#15803d' : '#dc2626';
    $('m-set').textContent = okSet ? 'PASS' : 'FAIL';
    $('m-set').style.color = okSet ? '#15803d' : '#dc2626';
    $('m-drive').textContent = `${(cfg.front * 3).toFixed(0)} m² est`;
    const ok = okSet && okCov;
    $('status').textContent = ok ? 'Logical action: site plan passes — safe to send to Foundation + Permits.' : 'Logical action: move/shrink the house until setbacks + coverage pass.';
    $('status').style.color = ok ? '#15803d' : '#b45309';
    return { ok, cov };
}
function view() {
    const c = $('site-canvas'), r = c.getBoundingClientRect();
    const pad = 40, s = Math.min((r.width - pad * 2) / cfg.lotW, (r.height - pad * 2) / cfg.lotD);
    return { s, ox: (r.width - cfg.lotW * s) / 2, oy: (r.height - cfg.lotD * s) / 2, w: r.width, h: r.height };
}
function draw() {
    const c = $('site-canvas'), r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = Math.max(r.width * dpr, 50); c.height = Math.max(r.height * dpr, 50);
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const v = view(), S = (mx, my) => ({ x: v.ox + mx * v.s, y: v.oy + my * v.s });
    x.fillStyle = '#eef3ec'; x.fillRect(0, 0, r.width, r.height);
    // Lot.
    let p = S(0, 0);
    x.fillStyle = '#fff'; x.fillRect(p.x, p.y, cfg.lotW * v.s, cfg.lotD * v.s);
    x.strokeStyle = '#1e293b'; x.lineWidth = 2.5; x.strokeRect(p.x, p.y, cfg.lotW * v.s, cfg.lotD * v.s);
    // Buildable.
    const b = S(cfg.side, cfg.front);
    x.fillStyle = 'rgba(22,163,74,0.10)'; x.fillRect(b.x, b.y, (cfg.lotW - cfg.side * 2) * v.s, (cfg.lotD - cfg.front - cfg.rear) * v.s);
    x.strokeStyle = '#16a34a'; x.setLineDash([6, 4]); x.strokeRect(b.x, b.y, (cfg.lotW - cfg.side * 2) * v.s, (cfg.lotD - cfg.front - cfg.rear) * v.s); x.setLineDash([]);
    x.fillStyle = '#166534'; x.font = 'bold 9px system-ui'; x.fillText('BUILDABLE', b.x + 6, b.y + 14);
    // Driveway.
    const d = S(cfg.houseX + cfg.houseW / 2 - 1.5, 0);
    x.fillStyle = '#dde3ea'; x.fillRect(d.x, d.y, 3 * v.s, cfg.front * v.s);
    x.strokeStyle = '#64748b'; x.strokeRect(d.x, d.y, 3 * v.s, cfg.front * v.s);
    // House (draggable).
    const h = S(cfg.houseX, cfg.houseY);
    const m = metrics();
    x.fillStyle = m.ok ? '#dbeafe' : '#fee2e2'; x.fillRect(h.x, h.y, cfg.houseW * v.s, cfg.houseD * v.s);
    x.strokeStyle = m.ok ? '#1d4ed8' : '#dc2626'; x.lineWidth = 2; x.strokeRect(h.x, h.y, cfg.houseW * v.s, cfg.houseD * v.s);
    x.fillStyle = '#0f172a'; x.font = 'bold 10px system-ui'; x.textAlign = 'center';
    x.fillText('HOUSE (drag me)', h.x + (cfg.houseW * v.s) / 2, h.y + (cfg.houseD * v.s) / 2);
    x.textAlign = 'left';
    // North arrow + scale.
    x.fillStyle = '#0f172a'; x.font = 'bold 11px system-ui'; x.fillText('N ↑', r.width - 40, 28);
    const barM = v.s * 5 > 90 ? 5 : 2;
    x.strokeStyle = '#0f172a'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(14, r.height - 16); x.lineTo(14 + barM * v.s, r.height - 16); x.stroke();
    x.fillStyle = '#475569'; x.font = '9px ui-monospace,monospace'; x.fillText(`${barM} m`, 16 + barM * v.s, r.height - 13);
    x.fillStyle = '#64748b'; x.fillText(`${cfg.lotW.toFixed(0)} × ${cfg.lotD.toFixed(0)} m lot`, 12, 20);
}
function toWorld(e) {
    const r = $('site-canvas').getBoundingClientRect(), v = view();
    return { x: (e.clientX - r.left - v.ox) / v.s, y: (e.clientY - r.top - v.oy) / v.s };
}
$('site-canvas').addEventListener('pointerdown', (e) => {
    const w = toWorld(e);
    if (w.x >= cfg.houseX && w.x <= cfg.houseX + cfg.houseW && w.y >= cfg.houseY && w.y <= cfg.houseY + cfg.houseD) {
        drag = { dx: w.x - cfg.houseX, dy: w.y - cfg.houseY };
        $('site-canvas').setPointerCapture(e.pointerId);
    }
});
$('site-canvas').addEventListener('pointermove', (e) => {
    if (!drag) return;
    const w = toWorld(e);
    cfg.houseX = Math.round((w.x - drag.dx) * 10) / 10;
    cfg.houseY = Math.round((w.y - drag.dy) * 10) / 10;
    save(); metrics(); draw();
});
['pointerup', 'pointercancel'].forEach((ev) => $('site-canvas').addEventListener(ev, () => { drag = null; save(); draw(); }));
['s-lotw', 's-lotd', 's-front', 's-side', 's-rear', 's-maxcov'].forEach((id) => $(id).addEventListener('change', () => {
    cfg = { ...cfg, lotW: +$('s-lotw').value || 30, lotD: +$('s-lotd').value || 24, front: +$('s-front').value || 0, side: +$('s-side').value || 0, rear: +$('s-rear').value || 0, maxcov: +$('s-maxcov').value || 40 };
    save(); metrics(); draw();
}));
$('from-plan').addEventListener('click', () => {
    try {
        const raw = JSON.parse(localStorage.getItem('floorplan3d_autosave') || 'null');
        const walls = raw?.walls || raw?.stories?.[0]?.walls || [];
        if (!walls.length) return;
        const xs = walls.flatMap((w) => [w.start?.x ?? w.x1 ?? 0, w.end?.x ?? w.x2 ?? 0]);
        const ys = walls.flatMap((w) => [w.start?.y ?? w.z1 ?? 0, w.end?.y ?? w.z2 ?? 0]);
        cfg.houseW = Math.round(((Math.max(...xs) - Math.min(...xs)) / 30) * 10) / 10;
        cfg.houseD = Math.round(((Math.max(...ys) - Math.min(...ys)) / 30) * 10) / 10;
        save(); metrics(); draw();
    } catch {}
});
$('center').addEventListener('click', () => { cfg.houseX = Math.round(((cfg.lotW - cfg.houseW) / 2) * 10) / 10; cfg.houseY = Math.round(((cfg.lotD - cfg.houseD) / 2) * 10) / 10; save(); metrics(); draw(); });
$('reset').addEventListener('click', () => { cfg = { ...defaults }; sync(); save(); metrics(); draw(); });
$('export-csv').addEventListener('click', () => {
    const m = metrics();
    const csv = ['item,value', `Lot,${cfg.lotW}x${cfg.lotD}m`, `House,${cfg.houseW}x${cfg.houseD}m`, `Coverage,${m.cov.toFixed(1)}%`, `Setbacks front/side/rear,${cfg.front}/${cfg.side}/${cfg.rear}m`].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'site-plan.csv'; a.click();
});
window.addEventListener('resize', draw);
sync(); save(); metrics(); draw();
renderRelatedPricing(document.getElementById('related-pricing'), ['framing', 'landscape']);
onProjectChange(() => metrics());
