import { PIXELS_PER_METER, WALL_THICKNESS } from './world-space.js';
import { itemDimensions } from './items.js';

/**
 * Flush-to-wall snapping for plan objects.
 *
 * In-wall items (doors, windows) snap to the wall centreline — that is what the
 * opening cut is measured from — so they are handled by InWallItem.snapToWall.
 * Everything else (cabinets, furniture) should sit against the wall face with
 * its back flat on the wall, and with its width running along the wall.
 *
 * All values are plan-space canvas pixels, the space walls and fixtures use.
 */

const HALF_WALL_PX = (WALL_THICKNESS * PIXELS_PER_METER) / 2;

export function wallNormal(wall) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
        length,
        dir: { x: dx / length, y: dy / length },
        normal: { x: -dy / length, y: dx / length },
        angle: Math.atan2(dy, dx)
    };
}

function closestPoint(wall, point) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1,
        ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lenSq));
    return { x: wall.start.x + dx * t, y: wall.start.y + dy * t };
}

/**
 * Footprint of an object in plan pixels, plus its extent along an arbitrary
 * direction (the support function of a rotated rectangle).
 */
export function footprint(fixture, rotation = fixture.rotation || 0) {
    const { width, depth } = itemDimensions(fixture);
    return {
        width: width * PIXELS_PER_METER,
        depth: depth * PIXELS_PER_METER,
        rotation
    };
}

export function extentAlong(fixture, direction, rotation = fixture.rotation || 0) {
    const { width, depth } = footprint(fixture, rotation);
    const u = { x: Math.cos(rotation), y: Math.sin(rotation) };
    const v = { x: -Math.sin(rotation), y: Math.cos(rotation) };
    return Math.abs(u.x * direction.x + u.y * direction.y) * (width / 2) +
        Math.abs(v.x * direction.x + v.y * direction.y) * (depth / 2);
}

/**
 * Snap a floor object flush to the nearest wall.
 *
 * Returns the wall it snapped to (with the gap it closed), or null when the
 * object is not within `threshold` pixels of a wall. Position is always set;
 * rotation is aligned so the object's width runs along the wall and its front
 * faces away from it.
 */
export function snapToWalls(fixture, walls = [], options = {}) {
    const {
        threshold = 20,
        align = true,
        wallHalfThickness = HALF_WALL_PX,
        rotation = fixture?.rotation || 0
    } = options;

    if (!fixture) return null;
    // In-wall items ride the centreline instead (see InWallItem.snapToWall).
    const type = fixture.metadata?.type;
    if (type === 'in_wall' || type === 'in_wall_floor') return null;

    let best = null;

    for (const wall of walls) {
        if (!wall || !wall.start || !wall.end) continue;
        const { length, dir, normal, angle } = wallNormal(wall);
        if (length < 1) continue;

        const point = closestPoint(wall, fixture);
        const dx = fixture.x - point.x;
        const dy = fixture.y - point.y;
        const distance = Math.hypot(dx, dy);

        // Normal pointing from the wall toward the object
        const side = dx * normal.x + dy * normal.y >= 0 ? 1 : -1;
        const n = { x: normal.x * side, y: normal.y * side };

        // Aligned rotation: width along the wall, front (local +z) out of it
        let snappedRotation = rotation;
        if (align) {
            const front = { x: -Math.sin(angle), y: Math.cos(angle) };
            snappedRotation = front.x * n.x + front.y * n.y < 0 ? angle + Math.PI : angle;
        }

        const extent = extentAlong(fixture, n, snappedRotation);
        const gap = distance - (wallHalfThickness + extent);

        if (Math.abs(gap) <= threshold && (!best || Math.abs(gap) < Math.abs(best.gap))) {
            best = { wall, point, normal: n, angle, gap, snappedRotation, dir };
        }
    }

    if (!best) return null;

    const extent = extentAlong(fixture, best.normal, best.snappedRotation);
    const offset = HALF_WALL_PX + extent;

    fixture.x = best.point.x + best.normal.x * offset;
    fixture.y = best.point.y + best.normal.y * offset;
    if (align) fixture.rotation = best.snappedRotation;

    return {
        wall: best.wall,
        gap: best.gap,
        rotation: fixture.rotation,
        aligned: align
    };
}
