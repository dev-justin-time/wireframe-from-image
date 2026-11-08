import { itemDimensions } from '../core/items.js';

/**
 * Cut-list export.
 *
 * Parts are grouped by type and effective size, so ten identical cabinets
 * become one line with `count: 10` instead of ten identical rows. Sizes come
 * from itemDimensions, which means a resized piece exports at its real size.
 */

const round = (metres) => Math.round(metres * 1000) / 1000;

export function buildCutList(fixtures = []) {
    const groups = new Map();

    (fixtures || []).forEach((fixture) => {
        if (!fixture) return;
        const dims = itemDimensions(fixture);
        const width = round(dims.width);
        const depth = round(dims.depth);
        const height = round(dims.height);
        const key = [fixture.type, width, depth, height].join('|');

        if (!groups.has(key)) {
            groups.set(key, {
                type: fixture.type,
                label: fixture.metadata?.label || String(fixture.type).replace(/_/g, ' '),
                width,
                depth,
                height,
                count: 0,
                ids: []
            });
        }

        const group = groups.get(key);
        group.count += 1;
        group.ids.push(fixture.id);
    });

    return [...groups.values()].sort((a, b) => (
        a.type === b.type ? a.width - b.width : String(a.type).localeCompare(String(b.type))
    ));
}

/** Quote a CSV field when it contains a comma, a quote or a newline. */
const csvField = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function cutListToCSV(groups = []) {
    const rows = [['type', 'label', 'count', 'width_m', 'depth_m', 'height_m']];
    groups.forEach((group) => {
        rows.push([
            group.type,
            group.label,
            group.count,
            group.width.toFixed(3),
            group.depth.toFixed(3),
            group.height.toFixed(3)
        ]);
    });
    return rows.map((row) => row.map(csvField).join(',')).join('\n');
}

export function downloadCutList(groups, filename = 'cut-list.csv') {
    const csv = cutListToCSV(groups);
    if (typeof document === 'undefined' || typeof URL === 'undefined') return csv;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return csv;
}
