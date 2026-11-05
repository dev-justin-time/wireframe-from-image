import { normalizePlan } from '../plumbing/plan.js';
import { designPlumbing } from '../plumbing/engine.js';

/**
 * Shared MEP layer renderers: electrical, plumbing and framing drawn on one
 * common footprint, each on its own canvas, plus a stacked composite.
 *
 * The footprint comes from the plumbing draft when present (it carries real
 * room dimensions), otherwise from the framing footprint, otherwise a
 * 11.5 × 8.5 m default. Every renderer fits that footprint with a margin so
 * the separate layers and the stacked view line up with each other.
 */

const FT = 0.3048;

function readJson(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function readLayerSources() {
    const plumbingRaw = readJson('plumbing-suite-plan');
    const framingRaw = readJson('framing-suite-draft');
    const electricalRaw = readJson('electrical-suite-draft');
    let plumbingPlan = null;
    let plumbingDesign = null;
    try {
        if (plumbingRaw) {
            plumbingPlan = normalizePlan(plumbingRaw);
            plumbingDesign = designPlumbing(plumbingPlan);
        }
    } catch {
        plumbingPlan = null;
        plumbingDesign = null;
    }
    return { plumbingPlan, plumbingDesign, framingRaw, electricalRaw };
}

export function resolveFootprint(sources = {}) {
    const plan = sources.plumbingPlan;
    if (plan && Number(plan.width) > 0 && Number(plan.depth) > 0) {
        return { width: Number(plan.width), depth: Number(plan.depth), source: 'Plumbing plan' };
    }
    const fp = sources.framingRaw?.footprintFt;
    if (fp && Number(fp.width) > 0 && Number(fp.depth) > 0) {
        return { width: Number(fp.width) * FT, depth: Number(fp.depth) * FT, source: 'Framing footprint' };
    }
    const walls = sources.framingRaw?.storeys?.[0]?.walls;
    if (Array.isArray(walls) && walls.length) {
        const xs = walls.flatMap((w) => [Number(w.x1) || 0, Number(w.x2) || 0]);
        const zs = walls.flatMap((w) => [Number(w.z1) || 0, Number(w.z2) || 0]);
        const w = Math.max(...xs) - Math.min(...xs);
        const d = Math.max(...zs) - Math.min(...zs);
        if (w > 1 && d > 1) return { width: w, depth: d, source: 'Framing walls' };
    }
    return { width: 11.5, depth: 8.5, source: 'Default 11.5 × 8.5 m' };
}

function fitView(canvasW, canvasH, footprint) {
    const pad = 46;
    const scale = Math.min(
        (canvasW - pad * 2) / Math.max(footprint.width, 1),
        (canvasH - pad * 2) / Math.max(footprint.depth, 1)
    );
    const ox = (canvasW - footprint.width * scale) / 2;
    const oy = (canvasH - footprint.depth * scale) / 2;
    return { scale, ox, oy, toScreen: (x, y) => ({ x: ox + x * scale, y: oy + y * scale }) };
}

function setupCanvas(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
}

function drawFootprint(ctx, view, footprint, tint = '#ffffff') {
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,0.10)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = tint;
    ctx.fillRect(view.ox, view.oy, footprint.width * view.scale, footprint.depth * view.scale);
    ctx.restore();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(view.ox, view.oy, footprint.width * view.scale, footprint.depth * view.scale);
    // 1 m grid.
    ctx.strokeStyle = '#e8eef4';
    ctx.lineWidth = 1;
    for (let x = 1; x < footprint.width; x += 1) {
        const a = view.toScreen(x, 0);
        const b = view.toScreen(x, footprint.depth);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    for (let y = 1; y < footprint.depth; y += 1) {
        const a = view.toScreen(0, y);
        const b = view.toScreen(footprint.width, y);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
}

function title(ctx, w, text, sub) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px ui-sans-serif, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(text.toUpperCase(), 10, 16);
    if (sub) {
        ctx.fillStyle = '#64748b';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(sub, 10, 28);
    }
}

function scaleBar(ctx, w, h, view) {
    const metres = view.scale * 2 > 90 ? 2 : 1;
    const len = metres * view.scale;
    const x0 = w - len - 16;
    const y0 = h - 14;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + len, y0);
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${metres} m`, x0 + len, y0 - 4);
}

function traceRoute(ctx, view, route, colour, width, dash = []) {
    if (!route?.points || route.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    route.points.forEach((p, i) => {
        const s = view.toScreen(p.x, p.y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.restore();
}

function pill(ctx, x, y, text, colour = '#334155') {
    ctx.font = 'bold 8px ui-monospace, monospace';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(x - w / 2, y - 8, w, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 2);
}

/** Framing layer: exterior + partition walls with stud ticks and openings. */
export function drawFramingLayer(ctx, w, h, sources, footprint, options = {}) {
    const dpr = options.dpr || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    setupCanvas(ctx, w, h);
    const view = fitView(w, h, footprint);
    title(ctx, w, 'Framing layer', `${footprint.width.toFixed(1)} × ${footprint.depth.toFixed(1)} m · studs 16 in o.c.`);
    drawFootprint(ctx, view, footprint);

    let walls = sources.framingRaw?.storeys?.[0]?.walls;
    if (!Array.isArray(walls) || !walls.length) {
        const W = footprint.width;
        const D = footprint.depth;
        walls = [
            { x1: 0, z1: 0, x2: W, z2: 0, exterior: true, openings: [] },
            { x1: W, z1: 0, x2: W, z2: D, exterior: true, openings: [] },
            { x1: W, z1: D, x2: 0, z2: D, exterior: true, openings: [] },
            { x1: 0, z1: D, x2: 0, z2: 0, exterior: true, openings: [] },
            { x1: W / 2, z1: 0, x2: W / 2, z2: D, exterior: false, openings: [] }
        ];
    }
    const depthM = 0.089; // 2x4 stud depth
    walls.forEach((wall) => {
        const x1 = Number(wall.x1) || 0;
        const z1 = Number(wall.z1 ?? wall.y1) || 0;
        const x2 = Number(wall.x2) || 0;
        const z2 = Number(wall.z2 ?? wall.y2) || 0;
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz) || 1;
        const nx = (-dz / len) * depthM / 2;
        const nz = (dx / len) * depthM / 2;
        const corners = [
            view.toScreen(x1 - nx, z1 - nz), view.toScreen(x2 - nx, z2 - nz),
            view.toScreen(x2 + nx, z2 + nz), view.toScreen(x1 + nx, z1 + nz)
        ];
        ctx.beginPath();
        corners.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.closePath();
        ctx.fillStyle = wall.exterior ? '#e7e5e4' : '#eef2f7';
        ctx.fill();
        ctx.strokeStyle = wall.exterior ? '#78716c' : '#94a3b8';
        ctx.lineWidth = wall.exterior ? 1.6 : 1;
        ctx.stroke();
        // Stud ticks every 406 mm.
        ctx.strokeStyle = '#57534e';
        ctx.lineWidth = 1;
        for (let a = 0.2; a < len - 0.1; a += 0.406) {
            const cx = x1 + (dx / len) * a;
            const cz = z1 + (dz / len) * a;
            const p0 = view.toScreen(cx - nx * 0.85, cz - nz * 0.85);
            const p1 = view.toScreen(cx + nx * 0.85, cz + nz * 0.85);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
        }
    });
    const mid = view.toScreen(footprint.width / 2, footprint.depth + 0.32);
    pill(ctx, Math.min(Math.max(mid.x, 90), w - 90), Math.min(mid.y, h - 22), 'STUDS · PLATES · HEADERS', '#57534e');
    scaleBar(ctx, w, h, view);
    ctx.restore();
}

/** Plumbing layer: cold / hot / DWV / gas routes plus fixture markers. */
export function drawPlumbingLayer(ctx, w, h, sources, footprint, options = {}) {
    const dpr = options.dpr || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    setupCanvas(ctx, w, h);
    const view = fitView(w, h, footprint);
    const design = sources.plumbingDesign;
    title(ctx, w, 'Plumbing layer', design ? `${design.fixtureCount ?? sources.plumbingPlan?.fixtures?.length ?? 0} fixtures · water + DWV + gas` : 'no plumbing draft — default layout');
    drawFootprint(ctx, view, footprint);
    if (!design) {
        ctx.fillStyle = '#64748b';
        ctx.font = '11px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Open the Plumbing suite and place fixtures', w / 2, h / 2);
        ctx.restore();
        return;
    }
    const show = { cold: true, hot: true, drain: true, vent: true, gas: true, ...(options.show || {}) };
    if (show.drain) (design.drain?.routes || []).forEach((r) => traceRoute(ctx, view, r, '#475569', 4));
    if (show.cold) (design.water?.routes || []).filter((r) => r.kind === 'cold').forEach((r) => traceRoute(ctx, view, r, '#0284c7', 2.4));
    if (show.hot) (design.water?.routes || []).filter((r) => r.kind === 'hot').forEach((r) => traceRoute(ctx, view, r, '#dc2626', 2.4));
    if (show.gas) (design.gas?.routes || []).forEach((r) => traceRoute(ctx, view, r, '#d97706', 2.4, [7, 4]));
    if (show.vent) (design.drain?.stacks || []).forEach((s) => {
        const p = view.toScreen(s.x, s.y);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('S', p.x, p.y + 3);
        ctx.strokeStyle = '#7c3aed';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - 14);
        ctx.stroke();
        ctx.setLineDash([]);
    });
    // Fixture dots from the plumbing plan.
    (sources.plumbingPlan?.fixtures || []).forEach((f) => {
        const type = f.typeId || '';
        const x = Number(f.x ?? f.along ?? 1);
        const y = Number(f.y ?? 1);
        const cx = f.wall === 'north' ? x : f.wall === 'south' ? x : f.wall === 'west' ? 0.4 : footprint.width - 0.4;
        const cy = f.wall === 'north' ? 0.4 : f.wall === 'south' ? footprint.depth - 0.4 : y;
        const p = view.toScreen(Math.min(Math.max(cx, 0.2), footprint.width - 0.2), Math.min(Math.max(cy, 0.2), footprint.depth - 0.2));
        ctx.fillStyle = '#0ea5e9';
        ctx.strokeStyle = '#0c4a6e';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        void type;
    });
    pill(ctx, w / 2, h - 22, 'COLD · HOT · DWV · GAS', '#0284c7');
    scaleBar(ctx, w, h, view);
    ctx.restore();
}

/** Electrical layer: panel, receptacle runs, lighting grid and home runs. */
export function drawElectricalLayer(ctx, w, h, electricalDesign, footprint, options = {}) {
    const dpr = options.dpr || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    setupCanvas(ctx, w, h);
    const view = fitView(w, h, footprint);
    title(ctx, w, 'Electrical layer', electricalDesign ? `${electricalDesign.circuits?.length ?? 0} circuits · ${electricalDesign.serviceAmps ?? 0} A service` : 'no electrical design');
    drawFootprint(ctx, view, footprint, '#fffef5');

    // Panel on the east wall midpoint.
    const panel = view.toScreen(footprint.width, footprint.depth * 0.5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(panel.x - 3, panel.y - 16, 10, 32);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(panel.x + 14, panel.y - 6);
    ctx.lineTo(panel.x + 8, panel.y);
    ctx.lineTo(panel.x + 14, panel.y + 6);
    ctx.stroke();
    pill(ctx, Math.max(panel.x - 46, 70), panel.y, 'PANEL', '#b45309');

    // Receptacles: small circles every ~2.4 m along the walls.
    ctx.strokeStyle = '#b45309';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 1.4;
    const spacing = 2.4;
    const put = (x, y) => {
        const p = view.toScreen(x, y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x - 4, p.y);
        ctx.lineTo(p.x + 4, p.y);
        ctx.stroke();
    };
    for (let x = 1.2; x < footprint.width - 0.5; x += spacing) { put(x, 0.25); put(x, footprint.depth - 0.25); }
    for (let y = 1.2; y < footprint.depth - 0.5; y += spacing) { put(0.25, y); put(footprint.width - 0.25, y); }

    // Lighting grid: ceiling points with switch legs.
    const nx = Math.max(2, Math.round(footprint.width / 3));
    const ny = Math.max(2, Math.round(footprint.depth / 3));
    for (let i = 0; i < nx; i += 1) {
        for (let j = 0; j < ny; j += 1) {
            const x = footprint.width * (i + 0.5) / nx;
            const y = footprint.depth * (j + 0.5) / ny;
            const p = view.toScreen(x, y);
            ctx.strokeStyle = '#ca8a04';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(p.x - 5, p.y - 5);
            ctx.lineTo(p.x + 5, p.y + 5);
            ctx.moveTo(p.x + 5, p.y - 5);
            ctx.lineTo(p.x - 5, p.y + 5);
            ctx.stroke();
        }
    }
    // Home runs back to the panel (representative radial legs).
    ctx.strokeStyle = 'rgba(180,83,9,0.55)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.4;
    [[0.3, 0.3], [0.3, footprint.depth - 0.3], [footprint.width / 2, footprint.depth - 0.3]].forEach(([x, y]) => {
        const a = view.toScreen(x, y);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(panel.x, panel.y);
        ctx.stroke();
    });
    ctx.setLineDash([]);
    const circuits = electricalDesign?.circuits?.length ?? 0;
    pill(ctx, w / 2, h - 22, `${circuits} CIRCUITS · OUTLETS + LIGHTS`, '#b45309');
    scaleBar(ctx, w, h, view);
    ctx.restore();
}

/** Stacked composite: framing + plumbing + electrical on one footprint. */
export function drawStackedLayers(ctx, w, h, sources, electricalDesign, footprint, options = {}) {
    const dpr = options.dpr || 1;
    const show = { framing: true, plumbing: true, electrical: true, ...(options.show || {}) };
    ctx.save();
    ctx.scale(dpr, dpr);
    setupCanvas(ctx, w, h);
    const view = fitView(w, h, footprint);
    title(ctx, w, 'Stacked · all layers', `${show.framing ? 'framing' : ''}${show.plumbing ? ' + plumbing' : ''}${show.electrical ? ' + electrical' : ''}`.replace(/^ \+ /, ''));
    drawFootprint(ctx, view, footprint);

    if (show.framing) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        let walls = sources.framingRaw?.storeys?.[0]?.walls;
        if (!Array.isArray(walls) || !walls.length) {
            const W = footprint.width;
            const D = footprint.depth;
            walls = [
                { x1: 0, z1: 0, x2: W, z2: 0 }, { x1: W, z1: 0, x2: W, z2: D },
                { x1: W, z1: D, x2: 0, z2: D }, { x1: 0, z1: D, x2: 0, z2: 0 }
            ];
        }
        walls.forEach((wall) => {
            const a = view.toScreen(Number(wall.x1) || 0, Number(wall.z1 ?? wall.y1) || 0);
            const b = view.toScreen(Number(wall.x2) || 0, Number(wall.z2 ?? wall.y2) || 0);
            ctx.strokeStyle = '#78716c';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.strokeStyle = '#57534e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        });
        ctx.restore();
    }
    const design = sources.plumbingDesign;
    if (show.plumbing && design) {
        ctx.save();
        ctx.globalAlpha = 0.95;
        (design.drain?.routes || []).forEach((r) => traceRoute(ctx, view, r, '#475569', 4.5));
        (design.water?.routes || []).filter((r) => r.kind === 'cold').forEach((r) => traceRoute(ctx, view, r, '#0284c7', 2.6));
        (design.water?.routes || []).filter((r) => r.kind === 'hot').forEach((r) => traceRoute(ctx, view, r, '#dc2626', 2.6));
        (design.gas?.routes || []).forEach((r) => traceRoute(ctx, view, r, '#d97706', 2.6, [7, 4]));
        (design.drain?.stacks || []).forEach((s) => {
            const p = view.toScreen(s.x, s.y);
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 8px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.fillText('S', p.x, p.y + 3);
        });
        ctx.restore();
    }
    if (show.electrical) {
        ctx.save();
        ctx.globalAlpha = 0.95;
        const panel = view.toScreen(footprint.width, footprint.depth * 0.5);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(panel.x - 3, panel.y - 16, 10, 32);
        ctx.strokeStyle = 'rgba(180,83,9,0.7)';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.6;
        [[0.3, 0.3], [0.3, footprint.depth - 0.3], [footprint.width / 2, footprint.depth - 0.3]].forEach(([x, y]) => {
            const a = view.toScreen(x, y);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(panel.x, panel.y);
            ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.strokeStyle = '#b45309';
        ctx.fillStyle = '#fff';
        for (let x = 1.2; x < footprint.width - 0.5; x += 2.4) {
            [0.25, footprint.depth - 0.25].forEach((y) => {
                const p = view.toScreen(x, y);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        }
        ctx.restore();
    }
    // Legend chips.
    const chips = [
        show.framing && ['#78716c', 'framing'],
        show.plumbing && ['#0284c7', 'plumbing'],
        show.electrical && ['#b45309', 'electrical']
    ].filter(Boolean);
    ctx.font = '9px ui-monospace, monospace';
    let lx = 12;
    chips.forEach(([colour, label]) => {
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(lx + 5, h - 22, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'left';
        ctx.fillText(label, lx + 12, h - 19);
        lx += 12 + ctx.measureText(label).width + 16;
    });
    scaleBar(ctx, w, h, view);
    ctx.restore();
}
