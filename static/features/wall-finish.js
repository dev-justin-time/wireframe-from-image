import { WALL_HEIGHT } from '../core/world-space.js';
import { textureUrlFor } from '../core/metadata.js';

/**
 * Per-wall height and finish.
 *
 * `Wall.height` is the model value (null = use the storey height), and the
 * finish lives in the same per-id style map items use (`fixtureStyles[wall.id]`),
 * so one map covers every object in the plan and it all survives a save.
 */

export const WALL_FINISH_OPTIONS = [
    { value: '', label: 'Storey default' },
    { value: 'paint', label: 'Paint' },
    { value: 'marble', label: 'Marble' },
    { value: 'wood', label: 'Wood' },
    { value: 'tile', label: 'Tile' },
    { value: 'concrete', label: 'Concrete' },
    { value: 'stone', label: 'Stone' }
];

/** Effective height of a wall in metres, falling back to the storey height. */
export function wallHeightOf(wall, fallback = WALL_HEIGHT) {
    const height = wall?.height;
    return typeof height === 'number' && height > 0 ? height : fallback;
}

/** Set a wall's height; anything unreadable resets it to the storey height. */
export function setWallHeight(wall, metres) {
    if (!wall) return null;
    const value = Number(metres);
    wall.height = Number.isFinite(value) && value > 0.2 ? Math.min(value, 12) : null;
    return wall.height;
}

export function resetWallHeights(walls = []) {
    walls.forEach((wall) => { wall.height = null; });
    return walls;
}

export function wallStyleIndex(styles, wallId) {
    return styles?.[wallId] || {};
}

/** Merge a finish patch into the style map, keyed by wall id. */
export function setWallFinish(styles, wallId, patch = {}) {
    if (!styles || !wallId) return null;
    styles[wallId] = { ...(styles[wallId] || {}), ...patch };
    return styles[wallId];
}

/**
 * The colour/texture a wall mesh should be built with. The default wall
 * texture is the storey-wide setting; a wall's own texture wins over it.
 */
export function wallFinishOf(wall, styles, defaultTexture = null) {
    const style = wallStyleIndex(styles, wall?.id);
    return {
        color: style.color || null,
        texture: style.texture || defaultTexture || null,
        textureUrl: textureUrlFor(style.texture, 'walls')
    };
}
