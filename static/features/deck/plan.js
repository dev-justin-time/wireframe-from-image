import { deckOutline, polygonArea, polygonPerimeter } from './engine.js';
import { sectionProps } from './materials.js';

/**
 * 2D framing plan + detail views for the deck suite.
 *
 * World units are metres: x runs along the house, y runs away from it, and the
 * origin is the house wall at the left end of the deck. The plan canvas draws
 * at a fitted scale with zoom and pan; the section, footing and axonometric
 * canvases auto-fit and render actual framing imagery (decking boards with
 * grain, joist hangers, ledger bolts, beam plies, post bases, concrete
 * footings, guard balusters and stair stringers).
 */

const PADDING = 70;
const clamp = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max);

export function createDeckPlan(config = {}) {
    return normalizeDeckPlan({ config });
}

export function normalizeDeckPlan(raw = {}) {
    const config = { ...(raw.config || {}) };
    const outline = deckOutline(config);
    return { config, outline };
}

export function deckBounds(plan) {
    const outline = plan.outline || deckOutline(plan.config);
    return {
        minX: Math.min(...outline.map((point) => point.x)),
        maxX: Math.max(...outline.map((point) => point.x)),
        minY: Math.min(...outline.map((point) => point.y)),
        maxY: Math.max(...outline.map((point) => point.y))
    };
}

export function fitTransform(width, height, plan, view = {}) {
    const bounds = deckBounds(plan);
    const zoom = clamp(view.zoom ?? 1, 0.4, 5);
    const deckWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const deckDepth = Math.max(bounds.maxY - bounds.minY, 1);
    const scale = Math.min(
        (width - PADDING * 2) / deckWidth,
        (height - PADDING * 2) / deckDepth
    ) * zoom;
    const originX = width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale + (Number(view.panX) || 0);
    const originY = height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale + (Number(view.panY) || 0);

    return {
        scale,
        originX,
        originY,
        toScreen: (x, y) => ({ x: originX + x * scale, y: originY + y * scale }),
        toWorld: (x, y) => ({ x: (x - originX) / scale, y: (y - originY) / scale })
    };
}

/** Hit test for the post and footing schedule. */
export function postAt(plan, design, point, tolerance = 0.25) {
    const { beams, attached } = design?.geometry || {};
    if (!beams?.length) return null;
    const config = plan.config;
    const posts = [];
    beams.forEach((line) => {
        const count = Math.max(2, Math.ceil(line.length / Math.max(config.postSpacingM, 0.4)) + 1);
        for (let index = 0; index < count; index += 1) {
            const x = (line.length * index) / (count - 1);
            posts.push({ x, y: line.y, beam: line.label });
        }
    });
    if (!attached) {
        // The rear beam mirrors the front one.
        const rear = beams.find((line) => line.y < 0.5);
        if (rear) {
            const count = Math.max(2, Math.ceil(rear.length / Math.max(config.postSpacingM, 0.4)) + 1);
            for (let index = 0; index < count; index += 1) {
                posts.push({ x: (rear.length * index) / (count - 1), y: rear.y, beam: rear.label });
            }
        }
    }
    return posts.find((post) => Math.hypot(post.x - point.x, post.y - point.y) <= tolerance) || null;
}

/** World-space band check for the stair run at the front of the deck. */
export function stairAt(plan, point, tolerance = 0.3) {
    const config = plan.config;
    if (!config.stairs) return false;
    const half = config.stairWidthM / 2;
    const startY = config.depth - 0.05;
    return Math.abs(point.x - config.width / 2) <= half + tolerance
        && point.y >= startY - tolerance
        && point.y <= startY + 0.9;
}

function polygonPath(ctx, transform, points) {
    ctx.beginPath();
    points.forEach((point, index) => {
        const screen = transform.toScreen(point.x, point.y);
        if (index === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
    });
    ctx.closePath();
}

function arrow(ctx, from, to, colour = '#475569') {
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    [[from, angle], [to, angle + Math.PI]].forEach(([point, direction]) => {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.x - Math.cos(direction - 0.4) * 6, point.y - Math.sin(direction - 0.4) * 6);
        ctx.lineTo(point.x - Math.cos(direction + 0.4) * 6, point.y - Math.sin(direction + 0.4) * 6);
        ctx.closePath();
        ctx.fill();
    });
}

function dimension(ctx, from, to, text, colour = '#475569') {
    arrow(ctx, from, to, colour);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    ctx.font = '10px ui-monospace, monospace';
    const width = ctx.measureText(text).width + 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mid.x - width / 2, mid.y - 8, width, 14);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 0.75;
    ctx.strokeRect(mid.x - width / 2, mid.y - 8, width, 14);
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.fillText(text, mid.x, mid.y + 2);
}

function pill(ctx, x, y, text, { fg = '#475569', bg = 'rgba(255,255,255,0.92)' } = {}) {
    ctx.font = '9px ui-monospace, monospace';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = bg;
    ctx.strokeStyle = 'rgba(71,85,105,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 8, w, 14, 7);
    else ctx.rect(x - w / 2, y - 8, w, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 2);
}

/** Deterministic pseudo-random for grain / speckle (stable per frame). */
function rand(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function lumberDepthM(size) {
    try {
        const props = sectionProps(size);
        if (props) return props.d * 0.0254;
    } catch { /* fall through */ }
    const table = { '2x6': 0.14, '2x8': 0.184, '2x10': 0.235, '2x12': 0.286, '2x4': 0.089 };
    return table[size] ?? 0.235;
}

function joistPositions(config) {
    const spacing = (Number(config.joistSpacingIn) || 16) * 0.0254;
    const list = [];
    for (let x = spacing / 2; x < config.width - 1e-6; x += spacing) list.push(x);
    // Always show a rim joist at each edge.
    if (!list.length) list.push(config.width / 2);
    return { list, spacing };
}

function beamPostXs(line, postSpacingM) {
    const count = Math.max(2, Math.ceil(line.length / Math.max(postSpacingM, 0.4)) + 1);
    return Array.from({ length: count }, (_, i) => (line.length * i) / (count - 1));
}

/** A hatched wall band along the house edge. */
function drawHouse(ctx, transform, width, view) {
    const left = transform.toScreen(-0.35, 0);
    const right = transform.toScreen(width + 0.35, 0);
    const bottom = transform.toScreen(0, -0.35);
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(left.x, bottom.y, right.x - left.x, left.y - bottom.y);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    for (let x = left.x; x < right.x; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, left.y);
        ctx.lineTo(x + 8, bottom.y);
        ctx.stroke();
    }
    // Windows / siding hint.
    ctx.strokeStyle = 'rgba(100,116,139,0.5)';
    ctx.beginPath();
    ctx.moveTo(left.x + 4, (left.y + bottom.y) / 2);
    ctx.lineTo(right.x - 4, (left.y + bottom.y) / 2);
    ctx.stroke();
    if (view !== false) {
        const label = transform.toScreen(width / 2, -0.62);
        ctx.fillStyle = '#475569';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HOUSE', label.x, label.y);
    }
}

/** Decking boards with grain, gaps and butt joints, drawn under the framing. */
function drawDeckingBoards(ctx, transform, config, outline, show) {
    if (!show.decking) return;
    const diagonal = config.pattern === 'diagonal';
    const boardW = 0.14; // exposed face + gap
    const gapPx = Math.max(1, transform.scale * 0.012);
    ctx.save();
    polygonPath(ctx, transform, outline);
    ctx.clip();
    const bounds = { minX: 0, maxX: config.width, minY: 0, maxY: config.depth };
    const r = rand(7);
    const tones = ['#cfa878', '#c5a06e', '#d4b183', '#bF9a68'];
    let row = 0;
    for (let y = 0; y < bounds.maxY; y += boardW) {
        const tone = tones[row % tones.length];
        const a = transform.toScreen(bounds.minX - 1, y);
        const b = transform.toScreen(bounds.maxX + 1, y + boardW);
        // Board face.
        const grad = ctx.createLinearGradient(0, a.y, 0, b.y);
        grad.addColorStop(0, tone);
        grad.addColorStop(0.5, '#d8b98c');
        grad.addColorStop(1, tone);
        ctx.fillStyle = grad;
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        // Grain lines.
        ctx.strokeStyle = 'rgba(122,84,44,0.35)';
        ctx.lineWidth = 0.75;
        for (let g = 0; g < 2; g += 1) {
            const gy = a.y + ((b.y - a.y) * (0.3 + g * 0.35)) + (r() - 0.5) * 2;
            ctx.beginPath();
            ctx.moveTo(a.x, gy);
            ctx.bezierCurveTo(a.x + (b.x - a.x) * 0.3, gy + (r() - 0.5) * 3, a.x + (b.x - a.x) * 0.7, gy + (r() - 0.5) * 3, b.x, gy);
            ctx.stroke();
        }
        // Butt joints staggered.
        const joints = 1 + Math.floor(config.width / 2.4);
        for (let j = 1; j <= joints; j += 1) {
            const jx = ((j * 2.4 + (row % 2) * 1.2) % config.width);
            const s = transform.toScreen(jx, y);
            ctx.strokeStyle = 'rgba(91,66,50,0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(s.x, a.y);
            ctx.lineTo(s.x, b.y);
            ctx.stroke();
        }
        // Gap shadow.
        ctx.fillStyle = 'rgba(70,48,30,0.85)';
        ctx.fillRect(a.x, b.y - gapPx, b.x - a.x, gapPx);
        if (diagonal) {
            ctx.strokeStyle = 'rgba(91,66,50,0.25)';
            ctx.lineWidth = 1;
            for (let x = bounds.minX; x < bounds.maxX; x += 0.6) {
                const p1 = transform.toScreen(x, y);
                const p2 = transform.toScreen(x + 0.3, y + boardW);
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
        row += 1;
    }
    ctx.restore();
}

export function drawDeckPlan(ctx, width, height, plan, design, options = {}) {
    const view = options.view || {};
    const show = { joists: true, beam: true, posts: true, footings: true, guard: true, stairs: true, dimensions: true, decking: true, hardware: true, labels: true, ...(options.show || {}) };
    const transform = fitTransform(width, height, plan, view);
    const config = plan.config;
    const outline = plan.outline || deckOutline(config);
    const dpr = options.dpr || 1;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background grid at one metre.
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, width, height);
    const bounds = deckBounds(plan);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let x = Math.floor(bounds.minX) - 1; x <= Math.ceil(bounds.maxX) + 1; x += 1) {
        const start = transform.toScreen(x, bounds.minY - 1.5);
        const end = transform.toScreen(x, bounds.maxY + 1.5);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }
    for (let y = Math.floor(bounds.minY) - 1; y <= Math.ceil(bounds.maxY) + 1; y += 1) {
        const start = transform.toScreen(bounds.minX - 1.5, y);
        const end = transform.toScreen(bounds.maxX + 1.5, y);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }
    // Faint 300 mm sub-grid near the deck for reading cantilevers.
    ctx.strokeStyle = 'rgba(226,232,240,0.55)';
    ctx.lineWidth = 0.5;

    // Deck platform shadow + decking boards first.
    polygonPath(ctx, transform, outline);
    ctx.fillStyle = 'rgba(15,23,42,0.10)';
    ctx.save();
    ctx.translate(3, 4);
    ctx.fill();
    ctx.restore();

    polygonPath(ctx, transform, outline);
    ctx.fillStyle = '#e8d3ae';
    ctx.fill();
    drawDeckingBoards(ctx, transform, config, outline, show);

    // Deck edge / rim joist with wood edge.
    polygonPath(ctx, transform, outline);
    ctx.strokeStyle = '#5f3d1f';
    ctx.lineWidth = 3;
    ctx.stroke();
    polygonPath(ctx, transform, outline);
    ctx.strokeStyle = '#d9b382';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Joists as actual framing: filled boards with hangers + blocking.
    if (show.joists) {
        const { list, spacing } = joistPositions(config);
        const joistWpx = Math.max(2, 0.038 * transform.scale);
        list.forEach((x, idx) => {
            const from = transform.toScreen(x, 0.02);
            const to = transform.toScreen(x, config.depth - 0.02);
            // Timber body.
            ctx.strokeStyle = idx % 2 ? '#9a6a35' : '#8a5a2b';
            ctx.lineWidth = joistWpx;
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            // Centre grain.
            ctx.strokeStyle = 'rgba(255,240,214,0.55)';
            ctx.lineWidth = Math.max(0.75, joistWpx * 0.25);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        });
        // Solid blocking line at each beam.
        if (design?.geometry?.beams) {
            ctx.strokeStyle = '#6b4423';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            design.geometry.beams.forEach((line) => {
                const a = transform.toScreen(0, line.y);
                const b = transform.toScreen(config.width, line.y);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });
            ctx.setLineDash([]);
        }
        // Joist direction arrow + label.
        if (show.labels && list.length) {
            const ax = transform.toScreen(list[Math.min(1, list.length - 1)], config.depth * 0.32);
            pill(ctx, ax.x, ax.y - 12, `${config.joistSize} @ ${config.joistSpacingIn}" o.c.`);
        }
        void spacing;
    }

    // Ledger: flashing + staggered bolts + hangers.
    if (config.ledger === 'house' && show.hardware) {
        const y0 = transform.toScreen(0, 0);
        const y1 = transform.toScreen(config.width, 0);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(y0.x, y0.y);
        ctx.lineTo(y1.x, y1.y);
        ctx.stroke();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.25;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(y0.x, y0.y - 4);
        ctx.lineTo(y1.x, y1.y - 4);
        ctx.stroke();
        ctx.setLineDash([]);
        // Bolt dots staggered in two rows.
        const n = Math.max(2, Math.floor((config.width * 1000) / 600) + 1);
        for (let i = 0; i < n; i += 1) {
            const x = (config.width * i) / (n - 1);
            for (let r2 = 0; r2 < 2; r2 += 1) {
                const s = transform.toScreen(x + (r2 ? 0.15 : 0), 0.06 + r2 * 0.1);
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                ctx.arc(s.x - 0.6, s.y - 0.6, 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        if (show.labels) {
            const mid = transform.toScreen(config.width / 2, -0.3);
            pill(ctx, mid.x, mid.y - 10, 'LEDGER · ½" lags 2 rows @ 600 staggered', { fg: '#334155' });
        }
    }

    // Beams with plies + through-bolts.
    if (show.beam && design?.geometry?.beams) {
        design.geometry.beams.forEach((line) => {
            const plies = Math.max(1, config.beamPlies || 2);
            const beamDepthM = lumberDepthM(config.beamSize);
            const beamPx = Math.max(6, beamDepthM * transform.scale * 0.55);
            const centre = transform.toScreen(config.width / 2, line.y);
            // Shadow.
            ctx.fillStyle = 'rgba(15,23,42,0.18)';
            const shA = transform.toScreen(0, line.y);
            const shB = transform.toScreen(line.length, line.y);
            ctx.fillRect(shA.x, shA.y + 2, shB.x - shA.x, beamPx);
            // Timber.
            const grad = ctx.createLinearGradient(0, centre.y - beamPx / 2, 0, centre.y + beamPx / 2);
            grad.addColorStop(0, '#c47a2a');
            grad.addColorStop(0.5, '#a8621c');
            grad.addColorStop(1, '#7c3f0c');
            ctx.fillStyle = grad;
            const a = transform.toScreen(0, line.y);
            const b = transform.toScreen(line.length, line.y);
            ctx.fillRect(a.x, a.y - beamPx / 2, b.x - a.x, beamPx);
            ctx.strokeStyle = '#5b2d08';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(a.x, a.y - beamPx / 2, b.x - a.x, beamPx);
            // Ply seams.
            ctx.strokeStyle = 'rgba(60,30,5,0.7)';
            ctx.lineWidth = 1;
            for (let p = 1; p < plies; p += 1) {
                const py = a.y - beamPx / 2 + (beamPx * p) / plies;
                ctx.setLineDash([6, 3]);
                ctx.beginPath();
                ctx.moveTo(a.x, py);
                ctx.lineTo(b.x, py);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            // Through-bolts at each post.
            beamPostXs(line, config.postSpacingM).forEach((x) => {
                const s = transform.toScreen(x, line.y);
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
                ctx.fill();
            });
            if (show.labels) pill(ctx, centre.x, centre.y - beamPx / 2 - 10, `${config.beamPlies}× ${config.beamSize} · ${line.label.toUpperCase()}`);
        });
    }

    // Posts and footings with concrete texture + callouts.
    if (design?.geometry?.beams) {
        let n = 0;
        design.geometry.beams.forEach((line) => {
            beamPostXs(line, config.postSpacingM).forEach((x) => {
                n += 1;
                const centre = transform.toScreen(x, line.y);
                if (show.footings) {
                    const rPx = Math.max(5, ((design.footing.diameterIn * 0.0254) / 2) * transform.scale);
                    // Excavation ring.
                    ctx.beginPath();
                    ctx.arc(centre.x, centre.y, rPx + 3, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(168,144,108,0.35)';
                    ctx.fill();
                    // Concrete pad with speckle.
                    ctx.beginPath();
                    ctx.arc(centre.x, centre.y, rPx, 0, Math.PI * 2);
                    const g = ctx.createRadialGradient(centre.x - rPx * 0.3, centre.y - rPx * 0.3, 1, centre.x, centre.y, rPx);
                    g.addColorStop(0, '#e8edf2');
                    g.addColorStop(1, '#9aa7b4');
                    ctx.fillStyle = g;
                    ctx.fill();
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 1.25;
                    ctx.stroke();
                    const rr = rand(n * 13 + 5);
                    ctx.fillStyle = 'rgba(71,85,105,0.5)';
                    for (let s = 0; s < 7; s += 1) {
                        const a2 = rr() * Math.PI * 2;
                        const d2 = rr() * rPx * 0.7;
                        ctx.fillRect(centre.x + Math.cos(a2) * d2, centre.y + Math.sin(a2) * d2, 1.4, 1.4);
                    }
                    // Diameter tag on first footing of first beam.
                    if (show.labels && n === 1) pill(ctx, centre.x + rPx + 34, centre.y, `⌀ ${design.footing.diameterIn}" PAD`);
                }
                if (show.posts) {
                    const side = Math.max(5, (config.postSize === '6x6' ? 0.14 : 0.089) * transform.scale);
                    ctx.fillStyle = '#7c2d12';
                    ctx.fillRect(centre.x - side / 2, centre.y - side / 2, side, side);
                    ctx.strokeStyle = '#431407';
                    ctx.lineWidth = 1.25;
                    ctx.strokeRect(centre.x - side / 2, centre.y - side / 2, side, side);
                    // Cross = post grain end.
                    ctx.strokeStyle = 'rgba(255,237,213,0.7)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(centre.x - side / 2, centre.y - side / 2);
                    ctx.lineTo(centre.x + side / 2, centre.y + side / 2);
                    ctx.moveTo(centre.x + side / 2, centre.y - side / 2);
                    ctx.lineTo(centre.x - side / 2, centre.y + side / 2);
                    ctx.stroke();
                    if (show.labels && transform.scale > 28) {
                        ctx.fillStyle = '#431407';
                        ctx.font = '8px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(`P${n}`, centre.x, centre.y - side / 2 - 3);
                    }
                }
            });
        });
    }

    // Guard: rail cap + balusters + newel posts.
    if (show.guard && design?.guard?.lengthM > 0) {
        const attached = config.ledger === 'house';
        outline.forEach((point, index) => {
            const next = outline[(index + 1) % outline.length];
            const onHouse = attached && Math.abs(point.y) < 1e-6 && Math.abs(next.y) < 1e-6;
            if (onHouse) return;
            const from = transform.toScreen(point.x, point.y);
            const to = transform.toScreen(next.x, next.y);
            // Rail cap (offset outward slightly).
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = (-dy / len) * 4;
            const ny = (dx / len) * 4;
            ctx.strokeStyle = '#0f766e';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(from.x + nx, from.y + ny);
            ctx.lineTo(to.x + nx, to.y + ny);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(15,118,110,0.35)';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        });
        // Baluster ticks + newel blocks.
        const spacing = design.guard.postSpacingM || 1.8;
        outline.forEach((point, index) => {
            const next = outline[(index + 1) % outline.length];
            const onHouse = attached && Math.abs(point.y) < 1e-6 && Math.abs(next.y) < 1e-6;
            if (onHouse) return;
            const length = Math.hypot(next.x - point.x, next.y - point.y);
            const bays = Math.max(1, Math.round(length / spacing));
            for (let step = 0; step <= bays; step += 1) {
                const t = step / bays;
                const x = point.x + (next.x - point.x) * t;
                const y = point.y + (next.y - point.y) * t;
                const screen = transform.toScreen(x, y);
                ctx.fillStyle = '#0f766e';
                ctx.fillRect(screen.x - 2.5, screen.y - 2.5, 5, 5);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(screen.x - 2.5, screen.y - 2.5, 5, 5);
            }
            // Mid balusters.
            const total = Math.floor(length / 0.12);
            ctx.fillStyle = 'rgba(15,118,110,0.55)';
            for (let b = 0; b <= total; b += 1) {
                const t = b / Math.max(total, 1);
                const x = point.x + (next.x - point.x) * t;
                const y = point.y + (next.y - point.y) * t;
                const s = transform.toScreen(x, y);
                ctx.fillRect(s.x - 0.5, s.y - 0.5, 1, 1);
            }
        });
        if (show.labels) {
            const g = transform.toScreen(config.width * 0.82, config.depth + 0.18);
            pill(ctx, g.x, g.y, `GUARD ${config.guardHeightIn}" · ${design.guard.system.label.split(' ')[0].toUpperCase()}`, { fg: '#0f766e' });
        }
    }

    // Stair: stringers + shaded treads + handrails.
    if (show.stairs && config.stairs && design?.stair?.risers) {
        const widthM = config.stairWidthM;
        const half = widthM / 2;
        const cx = config.width / 2;
        const treads = design.stair.treads;
        const runM = design.stair.runM;
        const treadDepth = runM / Math.max(treads, 1);
        const startY = config.depth;
        for (let index = 0; index < treads; index += 1) {
            const y1 = startY + index * treadDepth;
            const y2 = y1 + treadDepth;
            const topLeft = transform.toScreen(cx - half, y1);
            const bottomRight = transform.toScreen(cx + half, y2);
            const w = bottomRight.x - topLeft.x;
            const h = bottomRight.y - topLeft.y;
            const grad = ctx.createLinearGradient(0, topLeft.y, 0, topLeft.y + h);
            grad.addColorStop(0, '#e7d6b8');
            grad.addColorStop(1, '#b99a6d');
            ctx.fillStyle = grad;
            ctx.fillRect(topLeft.x, topLeft.y, w, h);
            // Nosing shadow.
            ctx.fillStyle = 'rgba(60,40,20,0.5)';
            ctx.fillRect(topLeft.x, topLeft.y, w, Math.max(1.5, h * 0.18));
            ctx.strokeStyle = '#4a3419';
            ctx.lineWidth = 1;
            ctx.strokeRect(topLeft.x, topLeft.y, w, h);
            // Stringer side boards.
            ctx.strokeStyle = '#7c4a1e';
            ctx.lineWidth = 3;
            [[cx - half, -1], [cx + half, 1]].forEach(([sx]) => {
                const s1 = transform.toScreen(sx, y1);
                const s2 = transform.toScreen(sx, y2);
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();
            });
        }
        // Landing pad.
        const land = transform.toScreen(cx - half - 0.15, startY + runM);
        const land2 = transform.toScreen(cx + half + 0.15, startY + runM + 0.9);
        ctx.fillStyle = '#dde3ea';
        ctx.fillRect(land.x, land.y, land2.x - land.x, land2.y - land.y);
        ctx.strokeStyle = '#64748b';
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(land.x, land.y, land2.x - land.x, land2.y - land.y);
        ctx.setLineDash([]);
        const label = transform.toScreen(cx, startY + runM + 1.25);
        pill(ctx, label.x, label.y, `${design.stair.risers} RISERS · ${Math.round(design.stair.riserMm)} MM · ${Math.round(design.stair.widthMm)} WIDE`, { fg: '#334155' });
    }

    drawHouse(ctx, transform, config.width);

    // Dimensions with extension ticks.
    if (show.dimensions) {
        const widthLine = transform.toScreen(config.width, config.depth + 0.9);
        const widthStart = transform.toScreen(0, config.depth + 0.9);
        dimension(ctx, widthStart, widthLine, `${(config.width * 1000).toFixed(0)} mm`);
        const depthStart = transform.toScreen(-0.9, 0);
        const depthEnd = transform.toScreen(-0.9, config.depth);
        dimension(ctx, depthStart, depthEnd, `${(config.depth * 1000).toFixed(0)} mm`);
        // Cantilever + post spacing callouts.
        if (design?.geometry?.cantileverM > 0.01) {
            const beamY = design.geometry.beams[0]?.y ?? config.depth;
            const c1 = transform.toScreen(config.width + 0.35, beamY);
            const c2 = transform.toScreen(config.width + 0.35, config.depth);
            dimension(ctx, c1, c2, `${Math.round(design.geometry.cantileverM * 1000)} cantilever`);
        }
    }

    // Scale bar and legend.
    const barMetres = transform.scale > 90 ? 1 : 2;
    const barFrom = { x: 24, y: height - 26 };
    const barTo = { x: 24 + barMetres * transform.scale, y: height - 26 };
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barFrom.x, barFrom.y);
    ctx.lineTo(barTo.x, barTo.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(barFrom.x, barFrom.y - 4);
    ctx.lineTo(barFrom.x, barFrom.y + 4);
    ctx.moveTo(barTo.x, barTo.y - 4);
    ctx.lineTo(barTo.x, barTo.y + 4);
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${barMetres} m`, barTo.x + 6, barFrom.y + 3);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(`${polygonArea(outline).toFixed(1)} m² DECK · ${config.joistSize} / ${config.beamPlies}×${config.beamSize}`, width - 20, 26);
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`PERIMETER ${polygonPerimeter(outline).toFixed(1)} m · ${design?.post?.count ?? 0} POSTS · ${design?.footing?.count ?? 0} PADS`, width - 20, 42);

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Detail views: side section, footing close-up and axonometric framing view.
// All three auto-fit; they share the design model so numbers always match.
// ---------------------------------------------------------------------------

function setupCanvas(ctx, w, h, dpr) {
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
}

function sectionTitle(ctx, w, title, sub) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px ui-sans-serif, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(title.toUpperCase(), 10, 16);
    if (sub) {
        ctx.fillStyle = '#64748b';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(sub, 10, 28);
    }
}

function groundHatch(ctx, x0, x1, y) {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(100,116,139,0.6)';
    ctx.lineWidth = 1;
    for (let x = x0 + 4; x < x1; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y + 7);
        ctx.stroke();
    }
}

/** Side elevation: house → ledger → joists → beam → post → footing. */
export function drawDeckSection(ctx, w, h, plan, design, options = {}) {
    const dpr = options.dpr || 1;
    setupCanvas(ctx, w, h, dpr);
    const config = plan.config;
    const depth = Math.max(config.depth, 1);
    const height = Math.max(config.height, 0.2);
    const footingD = design?.footing?.depthM ?? 1;
    const totalH = height + footingD + 0.5;
    const pad = 44;
    const sx = (w - pad * 2) / (depth + 1.6);
    const sy = (h - pad - 30) / totalH;
    const s = Math.min(sx, sy);
    const ox = pad + 30;
    const groundY = pad + height * s;
    const X = (m) => ox + m * s;
    const Y = (mAboveGround) => groundY - mAboveGround * s;

    sectionTitle(ctx, w, 'Section · ledger to footing', `${config.joistSize} joists · ${config.beamPlies}×${config.beamSize} beam · ${config.postSize} posts`);
    const d = options.show || {};
    const showDims = d.dimensions !== false;

    // Soil block.
    ctx.fillStyle = '#e7dcc4';
    ctx.fillRect(ox - 24, groundY, depth * s + 90, h - groundY - 10);
    ctx.fillStyle = 'rgba(140,110,70,0.35)';
    const rr = rand(21);
    for (let i = 0; i < 40; i += 1) {
        ctx.fillRect(ox - 20 + rr() * (depth * s + 80), groundY + 6 + rr() * (h - groundY - 20), 8, 2.5);
    }
    groundHatch(ctx, ox - 24, ox + depth * s + 66, groundY);
    ctx.fillStyle = '#78716c';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('GRADE', ox - 24, groundY + 18);
    ctx.fillText(`BEARING ${Math.round(design?.footing?.allowablePsf ?? 2000)} PSF`, ox - 24, groundY + 28);

    const beam = design?.geometry?.beams?.[0];
    const beamY = beam?.y ?? depth - (config.cantileverM || 0);
    const joistD = lumberDepthM(config.joistSize);
    const beamD = lumberDepthM(config.beamSize);
    const deckT = 0.025;

    // House wall + ledger.
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(X(-0.55), Y(height + 0.9), 0.35 * s, (0.9 + height + 0.4) * s);
    ctx.strokeStyle = '#64748b';
    ctx.strokeRect(X(-0.55), Y(height + 0.9), 0.35 * s, (0.9 + height + 0.4) * s);
    ctx.fillStyle = '#475569';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOUSE', X(-0.37), Y(height + 0.55));
    // Ledger board.
    ctx.fillStyle = '#a8621c';
    ctx.fillRect(X(-0.2), Y(height) - joistD * s, 0.06 * s, joistD * s);
    ctx.strokeStyle = '#5b2d08';
    ctx.strokeRect(X(-0.2), Y(height) - joistD * s, 0.06 * s, joistD * s);
    // Hanger at ledger.
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(X(-0.16), Y(height) - joistD * s, 0.12 * s, joistD * s * 0.8);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(X(-0.1), Y(height) - joistD * s * 0.4, 1.8, 0, Math.PI * 2);
    ctx.arc(X(-0.1), Y(height) - joistD * s * 0.7, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Decking.
    ctx.fillStyle = '#d8b98c';
    ctx.fillRect(X(0), Y(height + deckT) - 1, depth * s, Math.max(3, deckT * s));
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 1;
    ctx.strokeRect(X(0), Y(height + deckT) - 1, depth * s, Math.max(3, deckT * s));

    // Joist body with grain.
    const jy = Y(height) - joistD * s;
    const jGrad = ctx.createLinearGradient(0, jy, 0, jy + joistD * s);
    jGrad.addColorStop(0, '#e0bd85');
    jGrad.addColorStop(1, '#a06a2c');
    ctx.fillStyle = jGrad;
    ctx.fillRect(X(0), jy, depth * s, joistD * s);
    ctx.strokeStyle = '#5f3d1f';
    ctx.strokeRect(X(0), jy, depth * s, joistD * s);
    ctx.strokeStyle = 'rgba(95,61,31,0.45)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(X(0), jy + joistD * s * 0.5);
    ctx.lineTo(X(depth), jy + joistD * s * 0.5);
    ctx.stroke();
    pill(ctx, X(depth * 0.4), jy - 10, `${config.joistSize} JOIST`);

    // Beam below joists at beamY.
    const bx = X(beamY);
    const byTop = jy + joistD * s;
    ctx.fillStyle = '#8a4d12';
    ctx.fillRect(bx - 5, byTop, 10, beamD * s);
    ctx.strokeStyle = '#4a2606';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 5, byTop, 10, beamD * s);
    // Ply seam + bolt.
    ctx.strokeStyle = 'rgba(255,235,200,0.6)';
    ctx.beginPath();
    ctx.moveTo(bx - 5, byTop + (beamD * s) / 2);
    ctx.lineTo(bx + 5, byTop + (beamD * s) / 2);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(bx, byTop + (beamD * s) / 2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a2606';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${config.beamPlies}×${config.beamSize}`, bx + 9, byTop + beamD * s * 0.6);

    // Post down to footing.
    const postTop = byTop + beamD * s;
    const postW = Math.max(6, (config.postSize === '6x6' ? 0.14 : 0.089) * s);
    const footingTop = groundY + 0.15 * s;
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(bx - postW / 2, postTop, postW, footingTop - postTop);
    ctx.strokeStyle = '#431407';
    ctx.strokeRect(bx - postW / 2, postTop, postW, footingTop - postTop);
    // Post base + cap brackets.
    ctx.fillStyle = '#334155';
    ctx.fillRect(bx - postW / 2 - 2, postTop - 3, postW + 4, 4);
    ctx.fillRect(bx - postW / 2 - 2, footingTop - 2, postW + 4, 5);

    // Footing bell.
    const diaM = (design?.footing?.diameterIn ?? 12) * 0.0254;
    const fw = Math.max(18, diaM * s);
    const fh = Math.max(22, footingD * s * 0.55);
    const fx = bx - fw / 2;
    const fy = groundY + (footingD * s) - fh;
    ctx.fillStyle = '#b9c2cc';
    ctx.beginPath();
    ctx.moveTo(fx, fy + 8);
    ctx.lineTo(fx + fw, fy + 8);
    ctx.lineTo(fx + fw - 5, fy + fh);
    ctx.lineTo(fx + 5, fy + fh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⌀${design?.footing?.diameterIn ?? 12}" × ${Number(design?.footing?.depthM ?? 0).toFixed(2)}m`, bx, fy + fh + 10);

    // Guard stick at the outer edge.
    if (config.guard !== 'none' && (design?.guard?.lengthM ?? 0) > 0) {
        const gx = X(depth);
        const gh = (config.guardHeightIn * 0.0254) * s;
        ctx.strokeStyle = '#0f766e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(gx, Y(height));
        ctx.lineTo(gx, Y(height) - gh);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx - 8, Y(height) - gh);
        ctx.lineTo(gx + 2, Y(height) - gh);
        ctx.stroke();
        for (let b = 1; b <= 4; b += 1) {
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(gx - 1, Y(height) - (gh * b) / 5);
            ctx.lineTo(gx - 5, Y(height) - (gh * b) / 5);
            ctx.stroke();
        }
        ctx.fillStyle = '#0f766e';
        ctx.font = '8px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${config.guardHeightIn}" GUARD`, gx - 10, Y(height) - gh);
    }

    if (showDims) {
        // Height dimension on the left.
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        const dx = X(-0.85);
        ctx.beginPath();
        ctx.moveTo(dx, Y(height));
        ctx.lineTo(dx, groundY);
        ctx.stroke();
        pill(ctx, dx, (Y(height) + groundY) / 2, `${Number(config.height).toFixed(2)}m`);
        // Footing depth on the right of the pad.
        pill(ctx, bx + fw / 2 + 30, groundY + (footingD * s) / 2, `${Number(design?.footing?.depthM ?? 0).toFixed(2)}m DEEP`);
    }
    ctx.restore();
}

/** Footing close-up: soil, pad, post base and beam cap with dimensions. */
export function drawDeckFootingDetail(ctx, w, h, plan, design, options = {}) {
    const dpr = options.dpr || 1;
    setupCanvas(ctx, w, h, dpr);
    const config = plan.config;
    sectionTitle(ctx, w, 'Footing detail', `⌀${design?.footing?.diameterIn ?? 12}" pad · ${Math.round(design?.footing?.bearingPsf ?? 0)} psf on ${design?.footing?.allowablePsf ?? 2000} psf`);
    const cx = w / 2;
    const groundY = 78;
    const footingD = design?.footing?.depthM ?? 1;
    const diaIn = design?.footing?.diameterIn ?? 12;
    // Soil strata.
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(14, groundY, w - 28, h - groundY - 14);
    ctx.fillStyle = 'rgba(120,90,50,0.25)';
    ctx.fillRect(14, groundY + 34, w - 28, 3);
    ctx.fillRect(14, groundY + 70, w - 28, 3);
    const rr = rand(99);
    ctx.fillStyle = 'rgba(120,90,50,0.5)';
    for (let i = 0; i < 26; i += 1) ctx.fillRect(18 + rr() * (w - 40), groundY + 8 + rr() * (h - groundY - 30), 7, 2);
    groundHatch(ctx, 14, w - 14, groundY);
    ctx.fillStyle = '#78716c';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('UNDISTURBED SOIL', 18, groundY + 16);

    const s = Math.min((w - 90) / ((diaIn * 0.0254) * 2.2), (h - 130) / (footingD + 0.7));
    const padW = Math.max(54, diaIn * 0.0254 * s);
    const padH = Math.max(30, footingD * s * 0.42);
    const padY = h - 26 - padH;
    // Concrete pad with chamfer + speckle.
    ctx.fillStyle = '#c3ccd5';
    ctx.beginPath();
    ctx.moveTo(cx - padW / 2, padY + 6);
    ctx.lineTo(cx + padW / 2, padY + 6);
    ctx.lineTo(cx + padW / 2 - 6, padY + padH);
    ctx.lineTo(cx - padW / 2 + 6, padY + padH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(71,85,105,0.45)';
    const r2 = rand(31);
    for (let i = 0; i < 22; i += 1) ctx.fillRect(cx - padW / 2 + 6 + r2() * (padW - 12), padY + 10 + r2() * (padH - 14), 1.6, 1.6);
    // Rebar hint.
    ctx.strokeStyle = 'rgba(51,65,85,0.7)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(cx - padW / 2 + 8, padY + padH - 8);
    ctx.lineTo(cx + padW / 2 - 8, padY + padH - 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // Post pier / post.
    const postW = Math.max(16, (config.postSize === '6x6' ? 0.14 : 0.089) * s);
    const postTop = 44;
    const postBot = padY + 8;
    const pg = ctx.createLinearGradient(cx - postW / 2, 0, cx + postW / 2, 0);
    pg.addColorStop(0, '#9a3412');
    pg.addColorStop(0.5, '#c25e2e');
    pg.addColorStop(1, '#7c2d12');
    ctx.fillStyle = pg;
    ctx.fillRect(cx - postW / 2, postTop, postW, postBot - postTop);
    ctx.strokeStyle = '#431407';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - postW / 2, postTop, postW, postBot - postTop);
    // Grain.
    ctx.strokeStyle = 'rgba(255,237,213,0.5)';
    ctx.lineWidth = 1;
    for (let g = -1; g <= 1; g += 1) {
        ctx.beginPath();
        ctx.moveTo(cx + (g * postW) / 4, postTop + 4);
        ctx.lineTo(cx + (g * postW) / 4, postBot - 4);
        ctx.stroke();
    }
    // Elevated base + cap.
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - postW / 2 - 5, postBot - 2, postW + 10, 7);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx - 2, postBot - 9, 4, 8);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cx - postW / 2 - 5, postTop - 2, postW + 10, 5);
    pill(ctx, cx, postTop - 10, `${config.postSize} POST`);
    // Anchor bolt.
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx + postW / 2 + 9, postBot + 1, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Dimension lines.
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    const dy = padY + padH / 2;
    ctx.beginPath();
    ctx.moveTo(cx - padW / 2, dy);
    ctx.lineTo(cx + padW / 2, dy);
    ctx.stroke();
    [cx - padW / 2, cx + padW / 2].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, dy - 5);
        ctx.lineTo(x, dy + 5);
        ctx.stroke();
    });
    pill(ctx, cx, dy - 12, `⌀ ${diaIn}"`);
    const bx = cx + padW / 2 + 26;
    ctx.beginPath();
    ctx.moveTo(bx, groundY);
    ctx.lineTo(bx, padY + padH);
    ctx.stroke();
    pill(ctx, bx, (groundY + padY + padH) / 2, `${Number(footingD).toFixed(2)}m`, { fg: '#475569' });
    ctx.fillStyle = '#64748b';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${design?.footing?.bags ?? 0} BAGS TOTAL · 12" COVER OVER FROST`, cx, h - 12);
    ctx.restore();
}

/** Oblique axonometric: decking + joists + beam + posts + guard + stairs. */
export function drawDeckAxonometric(ctx, w, h, plan, design, options = {}) {
    const dpr = options.dpr || 1;
    setupCanvas(ctx, w, h, dpr);
    const config = plan.config;
    sectionTitle(ctx, w, 'Framing view · 3D', `${design?.joist?.count ?? 0} joists · ${design?.post?.count ?? 0} posts · ${design?.footing?.count ?? 0} pads`);
    const show = { ...(options.show || {}) };
    // Oblique projection: screen = ox + x*ax + y*bx, oy + x*ay + y*by - z*cz.
    const W = Math.max(config.width, 1);
    const D = Math.max(config.depth, 1);
    const H = Math.max(config.height, 0.3);
    const ax = Math.min((w - 60) / (W + D * 0.55), (h - 110) / (D * 0.62 + H * 1.15 + 1));
    const s = Math.max(8, ax);
    const ox = w / 2 - ((W + D * 0.55) / 2) * s;
    const oy = 52 + (D * 0.62 + 0.4) * s;
    const px = (x, y, z = 0) => ({ x: ox + (x + y * 0.55) * s, y: oy + (x * 0.06 - y * 0.62) * s - z * s });
    const poly = (pts, fill, stroke = '#5f3d1f', lw = 1) => {
        ctx.beginPath();
        pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
    };
    const beamLine = (design?.geometry?.beams || [])[0];
    const beamY = beamLine?.y ?? D - (config.cantileverM || 0);
    const joistD = lumberDepthM(config.joistSize);
    const deckT = 0.03;

    // Ground shadow.
    poly([px(0, -0.2, -H - 0.02), px(W, -0.2, -H - 0.02), px(W, D + 1.4, -H - 0.02), px(0, D + 1.4, -H - 0.02)], 'rgba(15,23,42,0.10)', 'rgba(15,23,42,0)', 1);

    // Footings + posts (back to front for overlap).
    const posts = beamLine ? beamPostXs(beamLine, config.postSpacingM) : [];
    const secondBeam = (design?.geometry?.beams || [])[1];
    const posts2 = secondBeam ? beamPostXs(secondBeam, config.postSpacingM) : [];
    const drawPost = (x, y) => {
        const g = px(x, y, -H);
        const r = Math.max(3, ((design?.footing?.diameterIn ?? 12) * 0.0254 * s) / 2);
        ctx.fillStyle = '#aeb8c4';
        ctx.beginPath();
        ctx.ellipse(g.x, g.y, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.stroke();
        const top = px(x, y, 0);
        const pw = Math.max(4, 0.09 * s);
        ctx.fillStyle = '#8a3a16';
        ctx.beginPath();
        ctx.moveTo(g.x - pw / 2, g.y);
        ctx.lineTo(g.x + pw / 2, g.y);
        ctx.lineTo(top.x + pw / 2, top.y);
        ctx.lineTo(top.x - pw / 2, top.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#431407';
        ctx.stroke();
    };
    [...posts2.map((x) => ({ x, y: secondBeam.y })), ...posts.map((x) => ({ x, y: beamY }))]
        .sort((a, b) => a.y - b.y)
        .forEach((p) => { if (show.posts !== false || show.footings !== false) drawPost(p.x, p.y); });

    // Beam as a 3D box.
    const beamD = lumberDepthM(config.beamSize);
    const b0 = px(0, beamY, -beamD);
    const b1 = px(W, beamY, -beamD);
    const b2 = px(W, beamY, 0);
    const b3 = px(0, beamY, 0);
    poly([b0, b1, b2, b3], '#a8621c', '#4a2606', 1.25);
    // Front face shading.
    poly([px(0, beamY + 0.02, -beamD), px(W, beamY + 0.02, -beamD), px(W, beamY + 0.02, 0), px(0, beamY + 0.02, 0)], 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0)', 1);
    if (show.labels !== false) pill(ctx, (b1.x + b2.x) / 2 + 44, (b1.y + b2.y) / 2, `${config.beamPlies}×${config.beamSize}`);

    // Joists: one box per ~4th joist to keep it readable, rest as top lines.
    const { list } = joistPositions(config);
    list.forEach((x, i) => {
        const top0 = px(x, 0, 0);
        const top1 = px(x, D, 0);
        if (i % 3 === 0) {
            const bot0 = px(x, 0, -joistD);
            const bot1 = px(x, D, -joistD);
            poly([top0, top1, bot1, bot0], i % 2 ? '#caa06c' : '#d4af78', '#5f3d1f', 1);
        } else {
            ctx.strokeStyle = 'rgba(95,61,31,0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(top0.x, top0.y);
            ctx.lineTo(top1.x, top1.y);
            ctx.stroke();
        }
    });

    // Decking top with board seams.
    const c00 = px(0, 0, deckT);
    const c10 = px(W, 0, deckT);
    const c11 = px(W, D, deckT);
    const c01 = px(0, D, deckT);
    poly([c00, c10, c11, c01], 'rgba(216,185,140,0.88)', '#5f3d1f', 1.5);
    ctx.strokeStyle = 'rgba(95,61,31,0.4)';
    ctx.lineWidth = 0.75;
    const boards = Math.min(24, Math.max(6, Math.round(D / 0.14)));
    for (let b = 1; b < boards; b += 1) {
        const y = (D * b) / boards;
        const l = px(0, y, deckT);
        const rr2 = px(W, y, deckT);
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(rr2.x, rr2.y);
        ctx.stroke();
    }

    // Guard: newels + top rail on open edges (front + sides).
    if ((design?.guard?.lengthM ?? 0) > 0 && show.guard !== false) {
        const gh = (config.guardHeightIn * 0.0254);
        const rail = (x0, y0, x1, y1) => {
            const a = px(x0, y0, deckT + gh);
            const b = px(x1, y1, deckT + gh);
            const a0 = px(x0, y0, deckT);
            ctx.strokeStyle = '#0f766e';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            // Newels + balusters.
            [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
                const x = x0 + (x1 - x0) * t;
                const y = y0 + (y1 - y0) * t;
                const p0 = px(x, y, deckT);
                const p1 = px(x, y, deckT + gh);
                ctx.strokeStyle = t % 1 === 0 ? '#0f766e' : 'rgba(15,118,110,0.6)';
                ctx.lineWidth = t === 0 || t === 1 ? 3 : 1;
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
            });
            void a0;
        };
        rail(0, D, W, D);
        rail(0, 0, 0, D);
        rail(W, 0, W, D);
    }

    // Stair cascading off the front.
    if (config.stairs && (design?.stair?.risers ?? 0) > 0 && show.stairs !== false) {
        const sw = config.stairWidthM;
        const cx = W / 2;
        const run = design.stair.runM;
        const steps = Math.min(design.stair.treads, 12);
        for (let i = 0; i < steps; i += 1) {
            const y = D + (run * i) / steps;
            const z = deckT - ((H + deckT) * i) / steps;
            const z2 = deckT - ((H + deckT) * (i + 1)) / steps;
            const p0 = px(cx - sw / 2, y, z);
            const p1 = px(cx + sw / 2, y, z);
            const p2 = px(cx + sw / 2, y + run / steps, z2);
            const p3 = px(cx - sw / 2, y + run / steps, z2);
            poly([p0, p1, p2, p3], i % 2 ? '#d9c096' : '#c8a878', '#4a3419', 1);
        }
    }

    // Ledger on the house edge.
    if (config.ledger === 'house') {
        const h0 = px(0, 0, -joistD);
        const h1 = px(0, 0, deckT);
        const h2 = px(W, 0, deckT);
        const h3 = px(W, 0, -joistD);
        poly([h0, h1, h2, h3], 'rgba(51,65,85,0.85)', '#1e293b', 1);
        if (show.labels !== false) pill(ctx, (h1.x + h2.x) / 2, h1.y - 12, 'HOUSE · LEDGER');
    }
    ctx.restore();
}
