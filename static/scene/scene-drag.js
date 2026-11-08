import { PIXELS_PER_METER } from '../core/world-space.js';
import { constrainToLocks } from '../features/transforms.js';
import { gridSnap, wallSnap } from '../features/advanced/snapping.js';
import { isStairItem } from '../features/stairs/design.js';
import { stairPlanContains } from '../features/stairs/geometry.js';
import { buildCollisionIndex, overlapsFor } from '../features/advanced/collision.js';
import { footprint } from '../core/wall-snap.js';

/**
 * Dragging for plan objects (fixtures, windows, doors).
 *
 * Points are plan-space canvas pixels, the same space the editors store walls
 * and fixtures in. In-wall items re-snap to their wall while dragging, which is
 * what keeps a window's opening attached to the window.
 */

/** Topmost fixture under a plan-space point, or null. */
export function fixtureAt(fixtures, point, { slack = 10, storeyHeight } = {}) {
    for (let i = fixtures.length - 1; i >= 0; i--) {
        const fixture = fixtures[i];
        if (fixture.visible === false) continue;

        // The rotated footprint uses the item's live dimensions, including a
        // per-item size override, so a resized cabinet is picked over the whole
        // shape the plan draws rather than its original metadata rectangle.
        const { width: widthPx, depth: depthPx } = footprint(fixture);

        // Hit test in the fixture's own rotated frame.
        const rotation = fixture.rotation || 0;
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const dx = point.x - fixture.x;
        const dy = point.y - fixture.y;
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        // Stairs are picked on their drawn footprint (run plus automatic
        // landings), not the run-only metadata rectangle, so the area the plan
        // symbol and the selection box cover is the area that selects.
        if (isStairItem(fixture)) {
            if (stairPlanContains(fixture, {
                x: localX / PIXELS_PER_METER,
                z: localY / PIXELS_PER_METER
            }, { storeyHeight, slack: slack / PIXELS_PER_METER })) {
                return fixture;
            }
            continue;
        }

        if (Math.abs(localX) <= widthPx / 2 + slack && Math.abs(localY) <= depthPx / 2 + slack) {
            return fixture;
        }
    }
    return null;
}

/**
 * Capture the grab offset so the object does not jump to the cursor, and build
 * a spatial index of the other pieces once for the whole gesture.
 */
export function beginDrag(fixture, point, { fixtures = null, collision = true } = {}) {
    if (!fixture) return null;

    const others = collision && fixtures
        ? fixtures.filter((other) => other && other !== fixture)
        : [];

    return {
        fixture,
        offset: { x: point.x - fixture.x, y: point.y - fixture.y },
        // Where the piece started, so locked axes have something to stay on.
        origin: { x: fixture.x, y: fixture.y, rotation: fixture.rotation || 0 },
        collisionIndex: others.length ? buildCollisionIndex(others) : null,
        valid: null,
        overlaps: []
    };
}

/**
 * Move the dragged object to the cursor with grid snapping, then snap it to a
 * wall: in-wall items ride the centreline (which updates the wall id used for
 * cutting the opening), floor items sit flush against the wall face.
 */
export function dragTo(drag, point, walls, { gridSize = 0, snapThreshold = 20, wallSnap: snapToWall = true, collision = true } = {}) {
    if (!drag || !drag.fixture) return null;
    const { fixture, offset } = drag;

    let x = point.x - offset.x;
    let y = point.y - offset.y;

    // Grid rounding goes through the unified snapping module (feature 19).
    ({ x, y } = gridSnap({ x, y }, gridSize));

    if (typeof fixture.setPosition === 'function') {
        fixture.setPosition(x, y);
    } else {
        fixture.x = x;
        fixture.y = y;
    }

    const meta = fixture.metadata || {};
    if (meta.type === 'in_wall' || meta.type === 'in_wall_floor') {
        if (typeof fixture.snapToWall === 'function') {
            fixture.snapToWall(walls, snapThreshold);
        }
    } else if (snapToWall) {
        // Flush against the nearest wall, width along the wall
        const snapped = wallSnap(fixture, walls, { threshold: snapThreshold });
        drag.snappedWall = snapped ? snapped.wall : null;
    }

    // Per-axis locks win over everything above: a locked axis keeps the
    // position the gesture started from.
    const constrained = constrainToLocks(fixture, { x: fixture.x, y: fixture.y }, drag.origin);
    fixture.x = constrained.x;
    fixture.y = constrained.y;

    // Collision is feedback, not a hard stop: the plan overlays turn the ghost
    // red and name nothing, while the user keeps control of the placement.
    if (collision && drag.collisionIndex) {
        drag.overlaps = overlapsFor(fixture, [], { index: drag.collisionIndex });
        drag.valid = drag.overlaps.length === 0;
    } else {
        drag.overlaps = [];
        drag.valid = null;
    }

    return fixture;
}

/** Cursor for hovering a fixture. */
export function cursorFor(fixtures, point, options) {
    return fixtureAt(fixtures, point, options) ? 'move' : 'default';
}
