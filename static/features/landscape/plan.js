import { planOutline } from './design.js';
import { siteClearances, waterPerimeter } from './engine.js';

/**
 * 2D site plan for the landscape suite.
 *
 * World units are metres: x runs east, z runs south, and the origin is the
 * north-west corner of the property. The canvas draws at a fitted scale with
 * zoom and pan, so the page can drag the water body around the site and every
 * setback updates.
 */

const PADDING = 64;
const clamp = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max);

export function createLandscapePlan(feature, site) {
    return normalizeLandscapePlan({ feature, site });
}

export function normalizeLandscapePlan(raw = {}) {
    const feature = { ...(raw.feature || {}) };
    const site = { ...(raw.site || {}) };
    const width = Math.max(4, Number(site.width) || 12);
    const depth = Math.max(4, Number(site.depth) || 16);
    const halfW = Math.max(0.3, Number(feature.width) || 4) / 2;
    const halfL = Math.max(0.3, Number(feature.length) || 9) / 2;
    return {
        feature,
        site: {
            ...site,
            width,
            depth,
            featureX: clamp(site.featureX ?? width / 2, halfW, width - halfW),
            featureZ: clamp(site.featureZ ?? depth / 2, halfL, depth - halfL)
        }
    };
}

/** Keep the water body inside the property after a drag or a size change. */
export function clampFeatureToSite(plan) {
    const halfW = Number(plan.feature.width || 4) / 2;
    const halfL = Number(plan.feature.length || 9) / 2;
    plan.site.featureX = clamp(plan.site.featureX, halfW, Math.max(halfW, plan.site.width - halfW));
    plan.site.featureZ = clamp(plan.site.featureZ, halfL, Math.max(halfL, plan.site.depth - halfL));
    return plan;
}

export function fitTransform(width, height, plan, view = {}) {
    const zoom = clamp(view.zoom ?? 1, 0.4, 4);
    const scale = Math.min(
        (width - PADDING * 2) / Math.max(plan.site.width, 1),
        (height - PADDING * 2) / Math.max(plan.site.depth, 1)
    ) * zoom;
    const originX = width / 2 - (plan.site.width / 2) * scale + (Number(view.panX) || 0);
    const originY = height / 2 - (plan.site.depth / 2) * scale + (Number(view.panY) || 0);
    return {
        scale,
        originX,
        originY,
        toScreen: (x, z) => ({ x: originX + x * scale, y: originY + z * scale }),
        toWorld: (x, y) => ({ x: (x - originX) / scale, z: (y - originY) / scale })
    };
}

export function featureBounds(plan, design) {
    const x = plan.site.featureX;
    const z = plan.site.featureZ;
    return {
        minX: x - plan.feature.width / 2,
        maxX: x + plan.feature.width / 2,
        minZ: z - plan.feature.length / 2,
        maxZ: z + plan.feature.length / 2
    };
}

/** True when a world point is on the water (or the deck, if asked). */
export function featureAt(plan, point, includeDeck = false) {
    const pad = includeDeck ? Number(plan.feature.deck || 0) : 0;
    const halfW = plan.feature.width / 2 + pad;
    const halfL = plan.feature.length / 2 + pad;
    return Math.abs(point.x - plan.site.featureX) <= halfW
        && Math.abs(point.z - plan.site.featureZ) <= halfL;
}

/** Push an outline outward from its centroid, used for the deck and barrier. */
export function offsetOutline(points, amount) {
    return points.map((point) => {
        const length = Math.hypot(point.x, point.z) || 1;
        return {
            x: point.x + (point.x / length) * amount,
            z: point.z + (point.z / length) * amount
        };
    });
}

function polygon(ctx, transform, points, origin) {
    ctx.beginPath();
    points.forEach((point, index) => {
        const screen = transform.toScreen(origin.x + point.x, origin.z + point.z);
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
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.fillText(text, mid.x, mid.y + 2);
}

export function drawLandscapePlan(ctx, width, height, plan, design, options = {}) {
    const view = options.view || {};
    const show = { dimensions: true, barrier: true, equipment: true, setback: true, ...(options.show || {}) };
    const transform = fitTransform(width, height, plan, view);
    const origin = { x: plan.site.featureX, z: plan.site.featureZ };
    const outline = planOutline(plan.feature.shape, plan.feature.width, plan.feature.length);
    const deck = Math.max(0, Number(plan.feature.deck || 0));
    const deckOutline = offsetOutline(outline, deck);
    const barrierOutline = offsetOutline(outline, deck + 1.0);
    const clearances = siteClearances(plan.feature, plan.site);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Site ground.
    const nw = transform.toScreen(0, 0);
    const se = transform.toScreen(plan.site.width, plan.site.depth);
    ctx.fillStyle = '#f1f7ee';
    ctx.fillRect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);

    // Property line label and north arrow.
    ctx.fillStyle = '#64748b';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PROPERTY LINE', nw.x + 6, nw.y + 14);

    // Setback band.
    if (show.setback) {
        const inset = 5 * 0.0254 * 12; // 5 ft
        const s = transform.toScreen(inset, inset);
        const e = transform.toScreen(plan.site.width - inset, plan.site.depth - inset);
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
        ctx.restore();
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('5 ft setback guide', s.x + 4, s.y + 12);
    }

    // Deck.
    if (deck > 0) {
        polygon(ctx, transform, deckOutline, origin);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Barrier.
    if (show.barrier) {
        polygon(ctx, transform, barrierOutline, origin);
        ctx.save();
        ctx.setLineDash([7, 4]);
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        // Gate marker on the south side.
        const gateA = transform.toScreen(origin.x - 0.5, origin.z + plan.feature.length / 2 + deck + 1.0);
        const gateB = transform.toScreen(origin.x + 0.5, origin.z + plan.feature.length / 2 + deck + 1.0);
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(gateA.x, gateA.y);
        ctx.lineTo(gateB.x, gateB.y);
        ctx.stroke();
        ctx.fillStyle = '#b45309';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('GATE', gateB.x + 4, gateB.y + 3);
    }

    // Water.
    polygon(ctx, transform, outline, origin);
    const gradient = ctx.createLinearGradient(nw.x, nw.y, se.x, se.y);
    gradient.addColorStop(0, 'rgba(125, 211, 252, 0.65)');
    gradient.addColorStop(1, 'rgba(14, 165, 233, 0.55)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Water label.
    const label = transform.toScreen(origin.x, origin.z);
    ctx.fillStyle = '#0c4a6e';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(design?.typeLabel?.toUpperCase() || 'WATER', label.x, label.y - 2);
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(`${plan.feature.width.toFixed(1)} × ${plan.feature.length.toFixed(1)} m`, label.x, label.y + 12);

    // Equipment pad, top-right of the site.
    if (show.equipment) {
        const padX = plan.site.width - 2.5;
        const padZ = 0.8;
        const a = transform.toScreen(padX, padZ);
        const b = transform.toScreen(padX + 1.8, padZ + 1.2);
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.fillStyle = '#92400e';
        ctx.font = '8px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('EQUIP', a.x + 3, a.y + 10);
        ctx.fillText('PUMP/FILTER', a.x + 3, a.y + 20);
    }

    // Dimensions.
    if (show.dimensions) {
        const bottom = transform.toScreen(origin.x, plan.site.depth);
        const left = transform.toScreen(0, origin.z);
        const waterTop = transform.toScreen(origin.x, origin.z - plan.feature.length / 2);
        const waterBottom = transform.toScreen(origin.x, origin.z + plan.feature.length / 2);
        const waterLeft = transform.toScreen(origin.x - plan.feature.width / 2, origin.z);
        const waterRight = transform.toScreen(origin.x + plan.feature.width / 2, origin.z);
        dimension(ctx, waterLeft, waterRight, `${plan.feature.width.toFixed(2)} m`, '#0369a1');
        dimension(ctx, waterTop, waterBottom, `${plan.feature.length.toFixed(2)} m`, '#0369a1');
        dimension(ctx,
            transform.toScreen(clearances.minimum < 0 ? 0 : 0, plan.site.depth + 0.9),
            transform.toScreen(plan.site.width, plan.site.depth + 0.9),
            `SITE ${plan.site.width.toFixed(1)} m`);
        dimension(ctx,
            transform.toScreen(-0.9, 0),
            transform.toScreen(-0.9, plan.site.depth),
            `SITE ${plan.site.depth.toFixed(1)} m`);
        dimension(ctx,
            transform.toScreen(0, origin.z),
            transform.toScreen(origin.x - plan.feature.width / 2, origin.z),
            `${(clearances.left).toFixed(2)} m`, '#b45309');
        ctx.textAlign = 'left';
    }

    // Scale bar and north arrow.
    const bar = transform.toScreen(0.4, plan.site.depth - 0.7);
    const barEnd = transform.toScreen(2.4, plan.site.depth - 0.7);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bar.x, bar.y);
    ctx.lineTo(barEnd.x, barEnd.y);
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0          2 m', bar.x, bar.y + 12);

    const north = transform.toScreen(plan.site.width - 0.7, 0.7);
    ctx.beginPath();
    ctx.moveTo(north.x, north.y - 12);
    ctx.lineTo(north.x - 5, north.y + 5);
    ctx.lineTo(north.x + 5, north.y + 5);
    ctx.closePath();
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillText('N', north.x, north.y + 18);

    // Setback readout under the site.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(
        `setback ${clearances.minimum.toFixed(2)} m · deck ${deck.toFixed(2)} m · perimeter ${waterPerimeter(plan.feature).toFixed(1)} m`,
        nw.x + 6,
        se.y - 6
    );

    return { transform, clearances };
}
