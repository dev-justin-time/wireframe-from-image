/**
 * Advanced feature 30 - material library per product line.
 *
 * Merlot and Shaker are lines, not individual item types, so their finish
 * belongs on the line. `resolveItemStyle` merges, in order:
 *
 *   per-item style in fixtureStyles  (what the user picked)
 *   line palette                     (the line's finish)
 *   ITEM_METADATA colour             (fallback for loose items)
 */

export const LINE_PALETTES = {
    merlot: {
        id: 'merlot',
        label: 'Merlot',
        color: '#5c2b26',
        accent: '#b9c0c7',
        material: 'gloss',
        texture: null,
        doorStyle: 'slab'
    },
    shaker: {
        id: 'shaker',
        label: 'Shaker',
        color: '#d9d2c5',
        accent: '#a89f90',
        material: 'matte',
        texture: null,
        doorStyle: 'five-piece'
    }
};

export function paletteFor(item) {
    return LINE_PALETTES[item?.metadata?.line] || null;
}

const metadataColor = (item) => (item?.metadata?.color != null
    ? `#${item.metadata.color.toString(16).padStart(6, '0')}`
    : null);

export function resolveItemStyle(item, styles = null) {
    const explicit = styles?.[item?.id] || {};
    const palette = paletteFor(item) || {};

    return {
        color: explicit.color ?? palette.color ?? metadataColor(item) ?? '#94a3b8',
        material: explicit.material ?? palette.material ?? 'matte',
        texture: explicit.texture ?? palette.texture ?? null,
        wireframe: Boolean(item?.metadata?.wireframe),
        wireframeColor: explicit.wireframeColor ?? palette.accent ?? explicit.color ?? '#334155',
        line: item?.metadata?.line ?? null,
        doorStyle: palette.doorStyle ?? 'slab'
    };
}

/**
 * Write a line palette into the per-item style map (clearing the colour override
 * so the palette shows). Passing `reset: true` restores the metadata colour.
 */
export function applyLinePalette(items = [], styles = {}, { line = null, reset = false } = {}) {
    const updated = [];
    (items || []).forEach((item) => {
        const palette = line ? LINE_PALETTES[line] : paletteFor(item);
        if (!palette) return;

        styles[item.id] = {
            ...(styles[item.id] || {}),
            color: reset ? metadataColor(item) : palette.color,
            material: reset ? null : palette.material
        };
        updated.push(item.id);
    });
    return updated;
}

export function linesAvailable() {
    return Object.values(LINE_PALETTES).map(({ id, label, color, material }) => ({ id, label, color, material }));
}
