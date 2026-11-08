import { PIXELS_PER_METER } from '../../core/world-space.js';
import { ItemFactory } from '../../core/items.js';

/**
 * Advanced feature 26 - copy/paste between stories.
 *
 * The snapshot records the story it came from, its schema version and the
 * styles of every copied item. Pasting into a different story is allowed: the
 * geometry is re-based with the same offset either way, and the returned items
 * are plain plan objects the caller can push into whichever story is active.
 */

export const CLIPBOARD_VERSION = 1;

export function copyItems(items = [], { storyIndex = 0, styles = null } = {}) {
    const list = (items || []).filter(Boolean);
    if (list.length === 0) return null;

    const snapshot = {
        version: CLIPBOARD_VERSION,
        storyIndex,
        createdAt: Date.now(),
        items: list.map((item) => item.toJSON()),
        styles: {}
    };

    if (styles) {
        list.forEach((item) => {
            if (styles[item.id]) snapshot.styles[item.id] = { ...styles[item.id] };
        });
    }

    return snapshot;
}

export function clipboardSize(snapshot) {
    return snapshot?.items?.length || 0;
}

/**
 * Materialise a snapshot. `dx`/`dy` are metres; each item keeps its relative
 * position inside the copied set, so a whole assembly stays together.
 */
export function pasteItems(snapshot, {
    dx = 0.4,
    dy = 0.4,
    styles = null,
    preserveGroups = true
} = {}) {
    if (!snapshot?.items?.length) return [];

    const idMap = new Map();
    const copies = snapshot.items.map((json) => {
        const data = {
            ...json,
            x: json.x + dx * PIXELS_PER_METER,
            y: json.y + dy * PIXELS_PER_METER
        };
        delete data.id;
        const copy = ItemFactory.fromJSON(data);
        idMap.set(json.id, copy);
        return copy;
    });

    if (preserveGroups) {
        const groups = new Map();
        copies.forEach((copy, index) => {
            const originalGroup = snapshot.items[index].groupId;
            if (!originalGroup) return;
            if (!groups.has(originalGroup)) groups.set(originalGroup, `group_${Date.now()}_${groups.size + 1}`);
            copy.groupId = groups.get(originalGroup);
        });
    }

    if (styles) {
        copies.forEach((copy, index) => {
            const sourceId = snapshot.items[index].id;
            if (snapshot.styles?.[sourceId]) styles[copy.id] = { ...snapshot.styles[sourceId] };
        });
    }

    return copies;
}

export function snapshotStoryIndex(snapshot) {
    return Number.isInteger(snapshot?.storyIndex) ? snapshot.storyIndex : 0;
}
