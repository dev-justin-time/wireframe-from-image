import { INCH } from '../../core/world-space.js';

/**
 * Storey construction (studio feature 41).
 *
 * A storey is a 96 in clear wall plus an 8 in floor structure. The walls of one
 * storey carry the joists of the floor above, so the floor-to-floor pitch is
 * wall + joist. The top storey uses the same 8 in band as a ceiling/joist space
 * and carries a truss roof above it.
 *
 * `story.height` stays the floor-to-floor pitch for older callers (stairs, the
 * project schema); `story.wallHeight` and `story.floorDepth` are the parts.
 */

export const WALL_HEIGHT_IN = 96;
export const JOIST_DEPTH_IN = 8;
export const WALL_HEIGHT_M = WALL_HEIGHT_IN * INCH;
export const JOIST_DEPTH_M = JOIST_DEPTH_IN * INCH;
export const STOREY_PITCH_M = WALL_HEIGHT_M + JOIST_DEPTH_M;

export const TRUSS_SPACING_M = 24 * INCH;
export const TRUSS_MEMBER_M = { width: 1.5 * INCH, depth: 3.5 * INCH };

const positive = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);

export function storeyConstruction(story = {}) {
    const floorDepth = positive(story.floorDepth, JOIST_DEPTH_M);
    // Older projects, undo snapshots and the stair walker only carry the
    // floor-to-floor `height`; keep that pitch by taking the 8 in out of it.
    const legacyPitch = positive(story.height, null);
    const wallHeight = positive(
        story.wallHeight,
        legacyPitch ? Math.max(legacyPitch - floorDepth, WALL_HEIGHT_M) : WALL_HEIGHT_M
    );
    return {
        wallHeight,
        floorDepth,
        pitch: wallHeight + floorDepth,
        // The top storey still has the 8 in band, but it is a ceiling/joist
        // space rather than a floor structure under the next storey.
        ceilingDepth: floorDepth
    };
}

/** Wall/floor parts for a new storey, with the optional overrides applied. */
export function constructionOptions({ wallHeight = WALL_HEIGHT_M, floorDepth = JOIST_DEPTH_M } = {}) {
    const wall = positive(wallHeight, WALL_HEIGHT_M);
    const floor = positive(floorDepth, JOIST_DEPTH_M);
    return {
        wallHeight: wall,
        floorDepth: floor,
        height: wall + floor
    };
}
