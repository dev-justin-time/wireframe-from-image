import { snapToWalls } from '../../core/wall-snap.js';
import { snapAlongAxis, snapVertically } from '../../core/elevation-snap.js';

/**
 * Advanced feature 19 - one snapping entry point.
 *
 * The editor grew three snapping implementations (grid rounding in
 * scene-drag, wall-face fitting in wall-snap, run/vertical fitting in
 * elevation-snap). They stay where they are, but every caller now goes through
 * this module, which fixes the priority order in one place:
 *
 *   1. grid        coarse placement
 *   2. wall face   flush against a wall (overrides the grid)
 *   3. run         butt joints along a wall run (elevation views)
 *   4. vertical    stacking / floor (elevation views)
 *
 * `resolveSnap` is the plan-space pipeline (1 -> 2); `runSnap` and
 * `verticalSnap` are the elevation-space pipeline (3 -> 4), re-exported here so
 * both views quote the same rules.
 */

export const SNAP_PRIORITY = ['grid', 'wall', 'run', 'vertical'];

export function gridSnap(point, gridSize) {
    if (!gridSize || gridSize <= 0) return { x: point.x, y: point.y };
    return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize
    };
}

export function wallSnap(fixture, walls = [], options = {}) {
    return snapToWalls(fixture, walls, options);
}

export function runSnap(moving, others = [], axis, options = {}) {
    return snapAlongAxis(moving, others, axis, options);
}

export function verticalSnap(moving, others = [], options = {}) {
    return snapVertically(moving, others, options);
}

/**
 * Snap a fixture for a plan-space drag.
 *
 * Mutates the fixture's position/rotation and reports which source won, so the
 * caller can draw the matching guide (wall seat, grid, or nothing).
 */
export function resolveSnap({
    fixture,
    point,
    walls = [],
    gridSize = 0,
    wallEnabled = true,
    threshold = 20,
    rotation = null
} = {}) {
    if (!fixture || !point) return null;

    const grid = gridSnap(point, gridSize);
    fixture.x = grid.x;
    fixture.y = grid.y;
    if (rotation != null) fixture.rotation = rotation;

    let source = gridSize > 0 ? 'grid' : 'none';
    let wall = null;
    let gap = null;

    if (wallEnabled) {
        const snapped = snapToWalls(fixture, walls, { threshold });
        if (snapped) {
            source = 'wall';
            wall = snapped.wall;
            gap = snapped.gap;
        }
    }

    return {
        x: fixture.x,
        y: fixture.y,
        rotation: fixture.rotation,
        source,
        wall,
        gap
    };
}
