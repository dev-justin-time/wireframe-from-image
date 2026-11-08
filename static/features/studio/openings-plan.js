import { PIXELS_PER_METER, planToWorld } from '../../core/world-space.js';

/**
 * Floor openings drawn on the plan (the cutout tool).
 *
 * An opening belongs to the storey whose floor it cuts, so it is stored on that
 * story in `story.openings` as a polygon in plan canvas pixels. The 3D engine
 * converts it through `openingToWorld` and adds it to the room floor shape as a
 * hole. Points can be dragged one at a time, so a rectangle becomes any polygon
 * without a separate mode.
 */

let openingCounter = 0;
const nextOpeningId = () => `opening_${Date.now()}_${(openingCounter += 1)}`;

const clean = (value) => Math.round(value * 10) / 10;

export function rectOpening(start, end) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return {
        id: nextOpeningId(),
        points: [
            { x: clean(minX), y: clean(minY) },
            { x: clean(maxX), y: clean(minY) },
            { x: clean(maxX), y: clean(maxY) },
            { x: clean(minX), y: clean(maxY) }
        ]
    };
}

export function polygonArea(points = []) {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}

export function openingAreaMetres(opening) {
    return opening ? polygonArea(opening.points) / (PIXELS_PER_METER * PIXELS_PER_METER) : 0;
}

export function pointInPolygon(point, points = []) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i];
        const b = points[j];
        if ((a.y > point.y) !== (b.y > point.y)) {
            const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
            if (point.x < x) inside = !inside;
        }
    }
    return inside;
}

export function openingAt(openings = [], point) {
    for (let i = openings.length - 1; i >= 0; i -= 1) {
        if (pointInPolygon(point, openings[i].points)) return openings[i];
    }
    return null;
}

export function vertexAt(opening, point, tolerance = 8) {
    if (!opening) return -1;
    return opening.points.findIndex((vertex) => Math.hypot(vertex.x - point.x, vertex.y - point.y) <= tolerance);
}

export function edgeAt(opening, point, tolerance = 8) {
    if (!opening) return -1;
    const points = opening.points;
    for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;
        if (!lengthSq) continue;
        const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
        const px = a.x + t * dx;
        const py = a.y + t * dy;
        if (Math.hypot(point.x - px, point.y - py) <= tolerance) return i;
    }
    return -1;
}

export function moveVertex(opening, index, point) {
    if (!opening?.points?.[index]) return opening;
    opening.points[index] = { x: clean(point.x), y: clean(point.y) };
    return opening;
}

/** Insert a vertex on `edge` at `point`, so a rectangle can grow a notch. */
export function insertVertex(opening, edge, point) {
    if (!opening || edge < 0) return opening;
    opening.points.splice(edge + 1, 0, { x: clean(point.x), y: clean(point.y) });
    return opening;
}

/** Remove a vertex; a polygon needs at least three. */
export function removeVertex(opening, index) {
    if (!opening || opening.points.length <= 3 || index < 0) return false;
    opening.points.splice(index, 1);
    return true;
}

export function moveOpening(opening, dx, dy) {
    if (!opening) return opening;
    opening.points.forEach((point) => {
        point.x = clean(point.x + dx);
        point.y = clean(point.y + dy);
    });
    return opening;
}

/** Plan pixels -> world x/z metres, in the same mapping as walls and items. */
export function openingToWorld(opening, view = { width: 1, height: 1 }) {
    return (opening?.points || []).map((point) => planToWorld({
        x: (point.x - view.width / 2) / PIXELS_PER_METER,
        z: (point.y - view.height / 2) / PIXELS_PER_METER
    }));
}

/** A deep copy, so a history snapshot cannot share point objects. */
export function cloneOpenings(openings = []) {
    return openings.map((opening) => ({
        id: opening.id || nextOpeningId(),
        points: (opening.points || []).map((point) => ({ x: Number(point.x), y: Number(point.y) }))
    }));
}

export function openingCentroid(opening) {
    const points = opening?.points || [];
    if (!points.length) return { x: 0, y: 0 };
    const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Plan symbol for the cutout tool: dashed holes for every opening on the active
 * storey, amber with draggable points for the selected one, and the rubber-band
 * rectangle while a new cutout is being dragged.
 */
export function drawFloorOpenings(ctx, {
    openings = [],
    selectedId = null,
    selectedVertexIndex = null,
    draft = null,
    active = false
} = {}) {
    const trace = (points = [], { color, fill, dash = [], width = 2 } = {}) => {
        if (points.length < 2) return;
        ctx.save();
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        ctx.setLineDash(dash);
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    };

    openings.forEach((opening) => {
        const selected = opening.id === selectedId;
        trace(opening.points, selected
            ? { color: '#f59e0b', fill: 'rgba(245, 158, 11, 0.14)', width: 2.5 }
            : { color: '#0ea5e9', fill: 'rgba(14, 165, 233, 0.07)', dash: [6, 4] });

        // Point handles only on the selected opening, so the plan stays quiet.
        if (selected) {
            (opening.points || []).forEach((point, index) => {
                const current = index === selectedVertexIndex;
                ctx.beginPath();
                ctx.arc(point.x, point.y, current ? 6 : 4.5, 0, Math.PI * 2);
                ctx.fillStyle = current ? '#f59e0b' : '#ffffff';
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#b45309';
                ctx.stroke();
            });
        }

        const area = openingAreaMetres(opening);
        if (!active && !selected) return;
        if (area < 0.001) return;
        const centre = openingCentroid(opening);
        const text = `${area.toFixed(2)} m²`;
        ctx.save();
        ctx.font = 'bold 10px "Space Grotesk", sans-serif';
        const measured = ctx.measureText(text);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(centre.x - measured.width / 2 - 3, centre.y - 7, measured.width + 6, 14);
        ctx.fillStyle = selected ? '#b45309' : '#0369a1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, centre.x, centre.y);
        ctx.restore();
    });

    if (draft) {
        trace(draft.points, { color: '#f59e0b', fill: 'rgba(245, 158, 11, 0.1)', dash: [8, 4], width: 2 });
    }
}
