import { renderRelatedPricing, onProjectChange, getProjectSnapshot } from '../../shared/project-context.js';
const $ = (id) => document.getElementById(id);
const KEY = 'foundation-suite-draft';
const defaults = { width: 9.6, depth: 7.2, storeys: 2, soil: 150, type: 'strip', strip: 600, depthmm: 300, frost: 600, slab: 100, wallh: 0.6, rebar: 'mesh', rate: 180 };
let cfg = { ...defaults };
try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw) cfg = { ...defaults, ...raw }; } catch {}
function sync() {
    $('f-width').value = cfg.width; $('f-depth').value = cfg.depth; $('f-storeys').value = cfg.storeys; $('f-soil').value = String(cfg.soil);
    $('f-type').value = cfg.type; $('f-strip').value = cfg.strip; $('f-depthmm').value = cfg.depthmm; $('f-frost').value = cfg.frost;
    $('f-slab').value = cfg.slab; $('f-wallh').value = cfg.wallh; $('f-rebar').value = cfg.rebar; $('f-rate').value = cfg.rate;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} }
function calc() {
    const perim = 2 * (cfg.width + cfg.depth);
    const loadKNm = 6 + cfg.storeys * 12;
    const needM = loadKNm / Math.max(cfg.soil, 50);
    const provM = cfg.strip / 1000;
    const stripM3 = perim * provM * (cfg.depthmm / 1000);
    const slabM3 = cfg.width * cfg.depth * (cfg.slab / 1000);
    const wallM3 = perim * cfg.wallh * 0.2;
    const totalM3 = stripM3 + slabM3 + wallM3;
    const rebarKg = perim * (cfg.rebar === 'heavy' ? 14 : cfg.rebar === 'grid' ? 9 : 5) + cfg.width * cfg.depth * 2.2;
    const cost = totalM3 * cfg.rate + rebarKg * 2.4;
    $('m-perim').textContent = `${perim.toFixed(1)} m`;
    $('m-strip').textContent = `${stripM3.toFixed(1)} m³`;
    $('m-slab').textContent = `${slabM3.toFixed(1)} m³`;
    $('m-wall').textContent = `${wallM3.toFixed(1)} m³`;
    $('m-total').textContent = `${totalM3.toFixed(1)} m³`;
    $('m-rebar').textContent = `${Math.round(rebarKg)} kg`;
    const ok = provM >= needM;
    $('m-bearing').textContent = ok ? `OK ${(needM * 1000).toFixed(0)}mm needed` : `WIDEN to ${(needM * 1000).toFixed(0)}mm`;
    $('m-bearing').style.color = ok ? '#15803d' : '#dc2626';
    $('m-cost').textContent = `$${Math.round(cost).toLocaleString()}`;
    $('status').textContent = `${cfg.type} · frost ${cfg.frost}mm · ${getProjectSnapshot().plan ? 'floorplan linked' : 'no floorplan yet'}`;
    draw(perim);
    return { perim, stripM3, slabM3, wallM3, totalM3, rebarKg, cost, ok };
}
function draw(perim) {
    const c = $('footing-canvas'); const r = c.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = Math.max(r.width * dpr, 50); c.height = Math.max(r.height * dpr, 50);
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const W = r.width, H = r.height;
    x.fillStyle = '#f8fafc'; x.fillRect(0, 0, W, H);
    // Section (left half).
    x.fillStyle = '#0f172a'; x.font = 'bold 10px system-ui'; x.fillText('STRIP SECTION', 12, 18);
    const gx = 12, gy = 120, s = 0.12;
    x.fillStyle = '#e7dcc4'; x.fillRect(gx, gy, 300, H - gy - 12);
    x.fillStyle = '#94a3b8'; x.fillRect(gx, gy, 300, 2);
    const sw = cfg.strip * s, sd = cfg.depthmm * s;
    x.fillStyle = '#b9c2cc'; x.fillRect(gx + 150 - sw / 2, gy, sw, sd);
    x.strokeStyle = '#475569'; x.strokeRect(gx + 150 - sw / 2, gy, sw, sd);
    x.fillStyle = '#cbd5e1'; x.fillRect(gx + 150 - sw / 2 + 8, gy - 60, sw - 16, 60);
    x.strokeStyle = '#64748b'; x.strokeRect(gx + 150 - sw / 2 + 8, gy - 60, sw - 16, 60);
    x.fillStyle = '#475569'; x.font = '9px ui-monospace,monospace';
    x.fillText(`${cfg.strip}mm × ${cfg.depthmm}mm`, gx + 150 - sw / 2, gy + sd + 12);
    // Plan (right half).
    const px = W / 2 + 10, pw = W / 2 - 20, ph = H - 60;
    const sc = Math.min(pw / cfg.width, ph / cfg.depth);
    const ox = px + (pw - cfg.width * sc) / 2, oy = 40 + (ph - cfg.depth * sc) / 2;
    x.fillStyle = '#0f172a'; x.font = 'bold 10px system-ui'; x.fillText('SLAB PLAN', px, 18);
    x.fillStyle = '#fff'; x.fillRect(ox, oy, cfg.width * sc, cfg.depth * sc);
    x.strokeStyle = '#1e293b'; x.lineWidth = 2; x.strokeRect(ox, oy, cfg.width * sc, cfg.depth * sc);
    x.strokeStyle = '#b45309'; x.lineWidth = 5;
    x.strokeRect(ox, oy, cfg.width * sc, cfg.depth * sc);
    x.strokeStyle = '#94a3b8'; x.lineWidth = 1;
    for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(ox + (cfg.width * sc * i) / 5, oy); x.lineTo(ox + (cfg.width * sc * i) / 5, oy + cfg.depth * sc); x.stroke(); }
}
function refresh() { save(); calc(); }
['f-width', 'f-depth', 'f-storeys', 'f-soil', 'f-type', 'f-strip', 'f-depthmm', 'f-frost', 'f-slab', 'f-wallh', 'f-rebar', 'f-rate'].forEach((id) => {
    $(id).addEventListener('change', () => {
        cfg = { width: +$('f-width').value || 9.6, depth: +$('f-depth').value || 7.2, storeys: +$('f-storeys').value || 1, soil: +$('f-soil').value || 150, type: $('f-type').value, strip: +$('f-strip').value || 600, depthmm: +$('f-depthmm').value || 300, frost: +$('f-frost').value || 600, slab: +$('f-slab').value || 100, wallh: +$('f-wallh').value || 0, rebar: $('f-rebar').value, rate: +$('f-rate').value || 180 };
        refresh();
    });
});
$('from-plan').addEventListener('click', () => {
    try {
        const raw = JSON.parse(localStorage.getItem('floorplan3d_autosave') || 'null');
        const walls = raw?.walls || raw?.stories?.[0]?.walls || [];
        if (!walls.length) { $('status').textContent = 'No Editor floorplan saved yet.'; return; }
        const xs = walls.flatMap((w) => [w.start?.x ?? w.x1 ?? 0, w.end?.x ?? w.x2 ?? 0]);
        const ys = walls.flatMap((w) => [w.start?.y ?? w.z1 ?? 0, w.end?.y ?? w.z2 ?? 0]);
        cfg.width = Math.max(3, (Math.max(...xs) - Math.min(...xs)) / 30);
        cfg.depth = Math.max(3, (Math.max(...ys) - Math.min(...ys)) / 30);
        sync(); refresh(); $('status').textContent = `Footprint ${cfg.width.toFixed(1)} × ${cfg.depth.toFixed(1)} m from floorplan.`;
    } catch { $('status').textContent = 'Could not read the floorplan.'; }
});
$('reset').addEventListener('click', () => { cfg = { ...defaults }; sync(); refresh(); });
$('export-csv').addEventListener('click', () => {
    const r = calc();
    const csv = ['item,qty,unit,unitCost,total', `Strip concrete,${r.stripM3.toFixed(2)},m3,${cfg.rate},${(r.stripM3 * cfg.rate).toFixed(2)}`, `Slab concrete,${r.slabM3.toFixed(2)},m3,${cfg.rate},${(r.slabM3 * cfg.rate).toFixed(2)}`, `Wall concrete,${r.wallM3.toFixed(2)},m3,${cfg.rate},${(r.wallM3 * cfg.rate).toFixed(2)}`, `Rebar,${Math.round(r.rebarKg)},kg,2.4,${(r.rebarKg * 2.4).toFixed(2)}`].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'foundation-takeoff.csv'; a.click();
});
window.addEventListener('resize', () => calc());
sync(); calc();
renderRelatedPricing(document.getElementById('related-pricing'), ['framing', 'plumbing']);
onProjectChange(() => calc());
