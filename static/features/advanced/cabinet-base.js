import { itemDimensions } from '../../core/items.js';

/**
 * Advanced feature 24 - a cabinet base, not an elevation special case.
 *
 * Every piece has a *default bottom* (0 for floor units, mountHeight for wall
 * units) and a *top*. `elevation` is only the user's extra lift on top of that,
 * so the engine, the elevation drag, the annotations and the placement rules
 * can all ask for the same numbers instead of each rebuilding the rule.
 */

export function defaultBottomOf(item) {
    if (!item) return 0;
    if (typeof item.defaultBottom === 'number') return item.defaultBottom;

    const mount = item.metadata?.mountHeight;
    if (typeof mount === 'number' && Number.isFinite(mount)) return mount;
    if (typeof item.metadata?.defaultBottom === 'number') return item.metadata.defaultBottom;
    return 0;
}

export function defaultTopOf(item) {
    return defaultBottomOf(item) + itemDimensions(item).height;
}

export function liftOf(item) {
    return item?.elevation || 0;
}

/** Bottom/top of the piece as placed, default base plus lift, in metres. */
export function baseOf(item) {
    const bottom = defaultBottomOf(item);
    const height = itemDimensions(item).height;
    const lift = liftOf(item);
    return {
        defaultBottom: bottom,
        defaultTop: bottom + height,
        height,
        lift,
        bottom: Math.max(0, bottom + lift),
        top: Math.max(0, bottom + lift) + height
    };
}

/** Override the default mounting height for one piece. */
export function setDefaultBottom(item, metres) {
    if (!item) return null;
    // null / empty means "back to the type default", which is not the same as 0
    // (0 would force a wall cabinet onto the floor).
    if (metres == null || metres === '') {
        item.defaultBottom = null;
        return null;
    }
    const value = Number(metres);
    item.defaultBottom = Number.isFinite(value) && value >= 0 ? Math.min(value, 6) : null;
    return item.defaultBottom;
}

export function isWallMounted(item) {
    return defaultBottomOf(item) > 0.01;
}
