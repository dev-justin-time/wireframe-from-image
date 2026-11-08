import { PIXELS_PER_METER } from '../core/world-space.js';
import { formatLength } from '../core/measurements.js';

/**
 * Dimension chains.
 *
 * Walls that share an endpoint and lie on the same line form a run; a chain is
 * that run's breakpoints measured end to end, with a tick and a length at every
 * segment (and the total at the far end). Lengths are converted to metres and
 * printed with measurements.formatLength, so they match the rest of the app.
 */

const EPSILON = 1e-6;

const directionOf = (wall) => {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
};

const samePoint = (a, b, tolerance) => Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;

/** Parallel incl. opposite directions: the cross product of unit vectors is ~0. */
const parallel = (a, b) => Math.abs(a.x * b.y - a.y * b.x) < 2e-3;

export function buildDimensionChains(walls = [], { tolerance = 2 } = {}) {
    const usable = (walls || []).filter((wall) => wall?.start && wall?.end
        && Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) > 1);
    if (usable.length === 0) return [];

    const parent = usable.map((_, index) => index);
    const find = (index) => {
        let current = index;
        while (parent[current] !== current) current = parent[current];
        return current;
    };
    const union = (a, b) => {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB) parent[rootB] = rootA;
    };

    const directions = usable.map(directionOf);
    for (let i = 0; i < usable.length; i++) {
        for (let j = i + 1; j < usable.length; j++) {
            if (!parallel(directions[i], directions[j])) continue;
            const sharesEndpoint = samePoint(usable[i].start, usable[j].start, tolerance)
                || samePoint(usable[i].start, usable[j].end, tolerance)
                || samePoint(usable[i].end, usable[j].start, tolerance)
                || samePoint(usable[i].end, usable[j].end, tolerance);
            if (sharesEndpoint) union(i, j);
        }
    }

    const groups = new Map();
    usable.forEach((wall, index) => {
        const root = find(index);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push({ wall, direction: directions[index] });
    });

    return [...groups.values()].map((group, index) => {
        const dir = group[0].direction;
        const normal = { x: -dir.y, y: dir.x };
        const project = (point) => point.x * dir.x + point.y * dir.y;

        const points = [];
        group.forEach(({ wall }) => {
            points.push({ point: wall.start, t: project(wall.start) });
            points.push({ point: wall.end, t: project(wall.end) });
        });
        points.sort((a, b) => a.t - b.t);

        const stops = [];
        points.forEach((entry) => {
            if (stops.length === 0 || Math.abs(entry.t - stops[stops.length - 1].t) > tolerance) {
                stops.push(entry);
            }
        });
        if (stops.length < 2) return null;

        const segments = [];
        for (let i = 1; i < stops.length; i++) {
            const length = stops[i].t - stops[i - 1].t;
            if (length <= tolerance) continue;
            segments.push({
                from: stops[i - 1].point,
                to: stops[i].point,
                length,
                midpoint: {
                    x: (stops[i - 1].point.x + stops[i].point.x) / 2,
                    y: (stops[i - 1].point.y + stops[i].point.y) / 2
                }
            });
        }
        if (segments.length === 0) return null;

        return {
            id: `chain_${index + 1}`,
            direction: dir,
            normal,
            from: stops[0].point,
            to: stops[stops.length - 1].point,
            length: stops[stops.length - 1].t - stops[0].t,
            segments
        };
    }).filter(Boolean);
}

/** Offset a plan point along the chain's normal (away from the wall line). */
function offsetPoint(point, normal, amount) {
    return { x: point.x + normal.x * amount, y: point.y + normal.y * amount };
}

/**
 * Draw the chains. `ctx` is already in plan-pixel space.
 * Text is kept upright: runs pointing left are rotated by PI.
 */
export function drawDimensionChains(ctx, chains = [], { offset = 24, scale = PIXELS_PER_METER } = {}) {
    if (!chains.length) return;

    chains.forEach((chain) => {
        const { normal, direction } = chain;
        const from = offsetPoint(chain.from, normal, offset);
        const to = offsetPoint(chain.to, normal, offset);

        ctx.save();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chain.from.x + normal.x * 4, chain.from.y + normal.y * 4);
        ctx.lineTo(from.x, from.y);
        ctx.moveTo(chain.to.x + normal.x * 4, chain.to.y + normal.y * 4);
        ctx.lineTo(to.x, to.y);
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        const reversed = direction.x < -EPSILON;
        const angle = Math.atan2(direction.y, direction.x) + (reversed ? Math.PI : 0);

        chain.segments.forEach((segment) => {
            const start = offsetPoint(segment.from, normal, offset);
            const end = offsetPoint(segment.to, normal, offset);

            // Tick marks across the chain line.
            ctx.beginPath();
            ctx.moveTo(start.x + normal.x * 5, start.y + normal.y * 5);
            ctx.lineTo(start.x - normal.x * 5, start.y - normal.y * 5);
            ctx.stroke();

            const text = formatLength(segment.length / scale);
            const mid = offsetPoint(segment.midpoint, normal, offset + 9);
            ctx.save();
            ctx.translate(mid.x, mid.y);
            ctx.rotate(angle);
            ctx.font = 'bold 9px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const width = ctx.measureText(text).width;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(-width / 2 - 3, -6, width + 6, 12);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillText(text, 0, 0);
            ctx.restore();
        });

        // Total at the far end of the run.
        const total = formatLength(chain.length / scale);
        const end = offsetPoint(chain.to, normal, offset - 12);
        ctx.save();
        ctx.translate(end.x, end.y);
        ctx.rotate(angle);
        ctx.font = 'bold 10px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(14, 116, 144, 0.9)';
        ctx.fillText(total, 0, 0);
        ctx.restore();

        ctx.restore();
    });
}
