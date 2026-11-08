import { PIXELS_PER_METER, WALL_THICKNESS } from '../../core/world-space.js';
import { itemDimensions } from '../../core/items.js';
import { wallNormal, extentAlong } from '../../core/wall-snap.js';

/**
 * Advanced feature 20 - cabinet-to-cabinet depth alignment and inside corners.
 *
 * elevation-snap knows how pieces line up *along* a run (butt joints). These
 * two rules extend the same idea to the plan plane:
 *
 *   alignDepth      a piece joins the run's depth plane instead of sitting a
 *                   few centimetres proud of its neighbours.
 *   snapToCorner    a piece dropped near an inside corner is seated in it,
 *                   facing out along the corner's bisector.
 */

const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const HALF_WALL_PX = (WALL_THICKNESS * PIXELS_PER_METER) / 2;

/** Unit vector pointing out of the piece's front face (local +z). */
export function facingOf(fixture) {
    const rotation = fixture?.rotation || 0;
    return { x: -Math.sin(rotation), y: Math.cos(rotation) };
}

/**
 * Move the fixture onto the depth plane of the nearest parallel neighbour.
 * Returns { delta, other } in plan pixels, or null when nothing is close.
 */
export function alignDepth(fixture, others = [], { threshold = 0.15 * PIXELS_PER_METER } = {}) {
    if (!fixture) return null;

    const rotation = fixture.rotation || 0;
    const normal = { x: -Math.sin(rotation), y: Math.cos(rotation) };
    const origin = fixture.x * normal.x + fixture.y * normal.y;

    let best = null;
    for (const other of others) {
        if (!other || other === fixture || other.visible === false) continue;
        if (Math.abs(wrapAngle((other.rotation || 0) - rotation)) > 0.2) continue;

        const depth = other.x * normal.x + other.y * normal.y;
        const delta = depth - origin;
        if (Math.abs(delta) > threshold) continue;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, other };
    }

    if (!best) return null;
    fixture.x += normal.x * best.delta;
    fixture.y += normal.y * best.delta;
    return best;
}

/** Interior corner candidates: two walls sharing an endpoint, roughly square. */
export function insideCorners(walls = [], { angleTolerance = Math.PI / 9 } = {}) {
    const corners = [];
    for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
            const a = walls[i];
            const b = walls[j];
            if (!a?.start || !b?.start) continue;

            const pairs = [
                [a.start, b.start], [a.start, b.end], [a.end, b.start], [a.end, b.end]
            ];
            for (const [pa, pb] of pairs) {
                if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > 2) continue;

                const da = wallNormal(a).dir;
                const db = wallNormal(b).dir;
                const dot = Math.abs(da.x * db.x + da.y * db.y);
                const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
                if (angle < Math.PI / 2 - angleTolerance || angle > Math.PI / 2 + angleTolerance) continue;

                corners.push({ point: { x: pa.x, y: pa.y }, walls: [a, b], dirs: [da, db] });
            }
        }
    }
    return corners;
}

/**
 * Seat a piece in the nearest inside corner, facing out of it.
 * `toward` is the plan point the drop happened at (defaults to the fixture).
 */
export function snapToCorner(fixture, walls = [], { threshold = 0.35 * PIXELS_PER_METER, toward = null } = {}) {
    if (!fixture) return null;
    const target = toward || { x: fixture.x, y: fixture.y };

    let best = null;
    for (const corner of insideCorners(walls)) {
        const distance = Math.hypot(corner.point.x - target.x, corner.point.y - target.y);
        if (distance > threshold) continue;
        if (!best || distance < best.distance) best = { ...corner, distance };
    }
    if (!best) return null;

    // Wall directions follow each wall's own start->end, so neither their sum
    // nor difference reliably points into the room. Test all four bisector
    // candidates and prefer one whose probe stays inside the plan bounds and
    // heads toward the drop point.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    walls.forEach((wall) => {
        minX = Math.min(minX, wall.start.x, wall.end.x);
        maxX = Math.max(maxX, wall.start.x, wall.end.x);
        minY = Math.min(minY, wall.start.y, wall.end.y);
        maxY = Math.max(maxY, wall.start.y, wall.end.y);
    });

    const normalize = (vector) => {
        const magnitude = Math.hypot(vector.x, vector.y);
        if (magnitude < 1e-6) return null;
        return { x: vector.x / magnitude, y: vector.y / magnitude };
    };

    const towardCorner = normalize({ x: target.x - best.point.x, y: target.y - best.point.y });
    const candidates = [
        normalize({ x: best.dirs[0].x + best.dirs[1].x, y: best.dirs[0].y + best.dirs[1].y }),
        normalize({ x: best.dirs[0].x - best.dirs[1].x, y: best.dirs[0].y - best.dirs[1].y })
    ].filter(Boolean).flatMap((candidate) => [candidate, { x: -candidate.x, y: -candidate.y }]);

    let bisector = candidates[0];
    let bestScore = -Infinity;
    candidates.forEach((candidate) => {
        const probe = { x: best.point.x + candidate.x * 3, y: best.point.y + candidate.y * 3 };
        const inside = probe.x >= minX - 1 && probe.x <= maxX + 1 && probe.y >= minY - 1 && probe.y <= maxY + 1;
        const aim = towardCorner ? candidate.x * towardCorner.x + candidate.y * towardCorner.y : 0;
        const score = (inside ? 4 : 0) + aim;
        if (score > bestScore) {
            bestScore = score;
            bisector = candidate;
        }
    });

    // Face the piece out of the corner: front (-sin r, cos r) = bisector.
    fixture.rotation = Math.atan2(-bisector.x, bisector.y);

    const extent = extentAlong(fixture, bisector, fixture.rotation);
    fixture.x = best.point.x + bisector.x * (HALF_WALL_PX + extent);
    fixture.y = best.point.y + bisector.y * (HALF_WALL_PX + extent);

    return { corner: best.point, bisector, walls: best.walls };
}

/** Half the run-width of a piece, in metres (used by group/run helpers). */
export function halfWidthMetres(fixture) {
    return itemDimensions(fixture).width / 2;
}
