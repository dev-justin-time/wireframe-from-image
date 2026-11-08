import { PIXELS_PER_METER } from './world-space.js';
import { extentAlong } from './wall-snap.js';

/**
 * Snapping maths for the elevation views.
 *
 * An elevation looks at a wall head-on: the screen's horizontal axis is the
 * "run" axis (along the wall) and the screen's vertical axis is height off the
 * floor. Dragging therefore moves a piece in two directions, and both are
 * snapped against the pieces already in the same run:
 *
 *   along the run   butt joints - one piece's edge to its neighbour's edge
 *   vertically      stacking    - a bottom onto a top, tops/bottoms aligned,
 *                                 or down onto the floor
 *
 * Everything here is in metres; plan pixels are converted at the boundary so
 * the thresholds read the same as the drawer sizes.
 */

export const ELEVATION_SNAP = 0.12; // capture distance, metres

const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Plan-space position of a fixture in metres (plan y is the world z axis). */
export function planMetres(fixture) {
    return {
        x: (fixture.x || 0) / PIXELS_PER_METER,
        y: (fixture.y || 0) / PIXELS_PER_METER
    };
}

/** Half the fixture's footprint along a unit direction, in metres. */
export function halfExtentAlong(fixture, axis) {
    return extentAlong(fixture, axis) / PIXELS_PER_METER;
}

/**
 * The fixture's near/far edges and centre along the run axis, in metres.
 * Width runs along the axis for a piece snapped to a wall.
 */
export function edgesAlong(fixture, axis) {
    const point = planMetres(fixture);
    const centre = point.x * axis.x + point.y * axis.y;
    const half = halfExtentAlong(fixture, axis);
    return { centre, min: centre - half, max: centre + half };
}

/**
 * Two pieces belong to the same run when they sit in the same depth plane
 * (both against the same wall face) and face the same way.
 * `normal` is the plan direction pointing from the wall toward the viewer.
 */
export function inSameRun(a, b, normal, { planeTolerance = 0.3, rotationTolerance = 0.4 } = {}) {
    if (!a || !b || !normal) return false;
    const pa = planMetres(a);
    const pb = planMetres(b);
    const depthA = pa.x * normal.x + pa.y * normal.y;
    const depthB = pb.x * normal.x + pb.y * normal.y;
    if (Math.abs(depthA - depthB) > planeTolerance) return false;
    return Math.abs(wrapAngle((a.rotation || 0) - (b.rotation || 0))) <= rotationTolerance;
}

/**
 * Best butt-joint snap along the run axis.
 *
 * Any edge of the moving piece (left, right, centre) may meet any edge of a
 * neighbour (left, right); the smallest correction inside `threshold` wins.
 * Returns { delta } in metres to add along `axis`, or snapped: false.
 */
export function snapAlongAxis(moving, others = [], axis, { threshold = ELEVATION_SNAP } = {}) {
    if (!moving || !axis) return { delta: 0, snapped: false };

    const edges = edgesAlong(moving, axis);
    const movingEdges = [
        { name: 'min', value: edges.min },
        { name: 'max', value: edges.max },
        { name: 'centre', value: edges.centre }
    ];

    let best = null;
    for (const other of others) {
        if (!other) continue;
        const target = edgesAlong(other, axis);
        for (const targets of [
            { name: 'min', value: target.min },
            { name: 'max', value: target.max },
            { name: 'centre', value: target.centre }
        ]) {
            for (const edge of movingEdges) {
                const delta = targets.value - edge.value;
                if (Math.abs(delta) > threshold) continue;
                if (!best || Math.abs(delta) < Math.abs(best.delta)) {
                    best = { delta, snapped: true, edge: edge.name, targets, other };
                }
            }
        }
    }

    return best || { delta: 0, snapped: false };
}

/**
 * Best vertical snap for a piece whose bottom/top are `moving` (metres above
 * the floor, world Y). Neighbours are { bottom, top } in the same units.
 *
 * Candidates: bottom-to-floor, and every moving edge against every neighbour
 * edge - bottom onto a neighbour's top (stacking) is the common one.
 * Returns { bottom, delta, snapped }.
 */
export function snapVertically(moving = {}, others = [], { threshold = ELEVATION_SNAP, floor = 0 } = {}) {
    const bottom = Number(moving.bottom);
    const top = Number(moving.top);
    if (!Number.isFinite(bottom) || !Number.isFinite(top)) {
        return { bottom: 0, delta: 0, snapped: false };
    }

    const movingEdges = [
        { name: 'bottom', value: bottom },
        { name: 'top', value: top }
    ];
    const targets = [{ name: 'floor', value: floor }];
    for (const other of others) {
        if (!other) continue;
        if (Number.isFinite(other.bottom)) targets.push({ name: 'bottom', value: other.bottom });
        if (Number.isFinite(other.top)) targets.push({ name: 'top', value: other.top });
    }

    let best = null;
    for (const target of targets) {
        for (const edge of movingEdges) {
            const delta = target.value - edge.value;
            if (Math.abs(delta) > threshold) continue;
            if (!best || Math.abs(delta) < Math.abs(best.delta)) {
                best = { delta, snapped: true, edge: edge.name, target: target.name };
            }
        }
    }

    if (!best) return { bottom, delta: 0, snapped: false };
    return { bottom: bottom + best.delta, delta: best.delta, snapped: true, edge: best.edge, target: best.target };
}
