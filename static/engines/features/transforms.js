import { PIXELS_PER_METER } from '../core/world-space.js';
import { ItemFactory } from '../core/items.js';
import { extentAlong } from '../core/wall-snap.js';
import { snapAlongAxis } from '../core/elevation-snap.js';

/**
 * Item transforms: per-axis locks, cloning, linear repeat and flips.
 *
 * These all work on plan objects (Item and friends) and keep their styles in
 * the same per-id map the editor uses, so a copy looks like its source.
 */

// --- Per-axis locks ---------------------------------------------------

export function lockedAxesOf(item) {
    return {
        x: Boolean(item?.lockedAxes?.x),
        z: Boolean(item?.lockedAxes?.z)
    };
}

/** Lock or unlock one plan axis. Locking both axes is a full position lock. */
export function setAxisLock(item, axis, locked) {
    if (!item || (axis !== 'x' && axis !== 'z')) return null;
    item.lockedAxes = { ...(item.lockedAxes || {}), [axis]: Boolean(locked) };
    return item.lockedAxes;
}

export function toggleAxisLock(item, axis) {
    if (!item) return null;
    const axes = lockedAxesOf(item);
    return setAxisLock(item, axis, !axes[axis]);
}

export function anyAxisLocked(item) {
    const axes = lockedAxesOf(item);
    return axes.x || axes.z;
}

/**
 * Keep a proposed position on the locked axes. `origin` is where the object was
 * before the gesture started; a locked axis ignores every move.
 */
export function constrainToLocks(item, position, origin) {
    const axes = lockedAxesOf(item);
    return {
        x: axes.x && origin ? origin.x : position.x,
        y: axes.z && origin ? origin.y : position.y
    };
}

// --- Clone / duplicate ------------------------------------------------

/**
 * A copy with a fresh id. `ItemFactory.fromJSON(item.toJSON())` carries over
 * size, lift, visibility, locks, bound wall and flip state.
 */
export function cloneItem(item, { dx = 0, dy = 0, styles = null } = {}) {
    if (!item) return null;

    const data = item.toJSON();
    delete data.id; // let the factory mint a new one
    data.x = item.x + dx * PIXELS_PER_METER;
    data.y = item.y + dy * PIXELS_PER_METER;

    const copy = ItemFactory.fromJSON(data);
    if (styles && styles[item.id]) styles[copy.id] = { ...styles[item.id] };
    return copy;
}

// --- Linear repeat ----------------------------------------------------

/**
 * Repeat a piece `count` times along its own width.
 *
 * With no pitch the copies are butted edge to edge (the previous piece's width
 * along the run). Every copy is then run through elevation-snap's
 * `snapAlongAxis`, so a copy that lands a hair off the neighbour's edge snaps
 * onto it instead of leaving a sliver gap.
 */
export function repeatAlongAxis(source, { count = 2, pitch = null, direction = null, styles = null } = {}) {
    if (!source) return [];

    const axis = direction || { x: Math.cos(source.rotation || 0), y: Math.sin(source.rotation || 0) };
    const sequence = [source];
    const copies = [];

    for (let index = 0; index < count; index++) {
        const previous = sequence[sequence.length - 1];
        const copy = cloneItem(previous, { styles });
        if (!copy) break;

        const stepPixels = pitch == null
            ? extentAlong(previous, axis) * 2
            : pitch * PIXELS_PER_METER;

        copy.x = previous.x + axis.x * stepPixels;
        copy.y = previous.y + axis.y * stepPixels;

        const snap = snapAlongAxis(copy, sequence, axis, { threshold: 0.25 });
        if (snap.snapped) {
            copy.x += axis.x * snap.delta * PIXELS_PER_METER;
            copy.y += axis.y * snap.delta * PIXELS_PER_METER;
        }

        sequence.push(copy);
        copies.push(copy);
    }

    return copies;
}

// --- Flip -------------------------------------------------------------

/**
 * Mirror a piece in place.
 *
 * Reflecting across the piece's own centre line keeps its centre put and maps
 * the rotation to `PI - rotation` (about the vertical screen axis) or
 * `-rotation` (about the horizontal one), which swaps the width/depth axes it
 * occupies. The flip is recorded so the 3D builder mirrors the mesh rather than
 * looking like an unflipped piece again.
 */
export function flipItem(item, axis = 'x') {
    if (!item) return null;

    item.flipped = { x: false, z: false, ...(item.flipped || {}) };

    if (axis === 'z') {
        item.rotation = -(item.rotation || 0);
        item.flipped.z = !item.flipped.z;
    } else {
        item.rotation = Math.PI - (item.rotation || 0);
        item.flipped.x = !item.flipped.x;
    }

    // Asymmetric pieces are positioned by a local offset; swapping it keeps the
    // mirrored piece on its own footprint.
    if (item.offset) {
        item.offset = { x: item.offset.z ?? item.offset.y ?? 0, z: item.offset.x ?? 0 };
    }

    return item;
}
