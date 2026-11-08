import { itemDimensions } from '../../core/items.js';
import { cabinetBOM, cabinetConfigOf } from './parametric.js';

/**
 * Studio feature 45 - manufacturing output.
 *
 * Explodes each cabinet into its parts (from the same parametric model the
 * builder uses), aggregates identical panels, then writes either a CSV cut list
 * or nested DXF. Panels are nested row-by-row onto 2440 x 1220 sheets, which is
 * enough for a readable, machine-importable starting point.
 */

export const SHEET = { width: 2440, height: 1220, gap: 8 };

const mm = (metres) => Math.round(metres * 1000);

const materialOf = (item) => item?.metadata?.line || 'generic';

export function cabinetFromItem(item) {
    if (!item) return null;
    const dims = itemDimensions(item);
    const config = cabinetConfigOf(item);
    return {
        id: item.id,
        type: item.type,
        label: item.metadata?.label || item.type,
        line: materialOf(item),
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        config,
        parts: cabinetBOM(item)
    };
}

/** All parts across a selection, with cabinet ids and quantities. */
export function manufacturingParts(items = []) {
    const cabinets = (items || [])
        .filter((item) => item && /cabinet|pantry|island|drawer|sink_base/.test(String(item.type)))
        .map(cabinetFromItem)
        .filter(Boolean);

    const groups = new Map();
    cabinets.forEach((cabinet) => {
        cabinet.parts.forEach((part) => {
            const key = [cabinet.line, part.label, part.widthMm, part.heightMm, part.thicknessMm, part.material].join('|');
            if (!groups.has(key)) {
                groups.set(key, {
                    part: part.label,
                    material: `${cabinet.line}/${part.material}`,
                    widthMm: part.widthMm,
                    heightMm: part.heightMm,
                    thicknessMm: part.thicknessMm,
                    qty: 0,
                    cabinets: []
                });
            }
            const group = groups.get(key);
            group.qty += part.qty;
            group.cabinets.push({ id: cabinet.id, label: cabinet.label });
        });
    });

    return {
        cabinets,
        parts: [...groups.values()].sort((a, b) => b.heightMm - a.heightMm || b.widthMm - a.widthMm)
    };
}

/** CSV grouped by part size/material, with a qty column. */
export function partsToCSV(parts = []) {
    const rows = [['part', 'material', 'width_mm', 'height_mm', 'thickness_mm', 'qty']];
    parts.forEach((part) => {
        rows.push([part.part, part.material, part.widthMm, part.heightMm, part.thicknessMm, part.qty]);
    });
    return rows.map((row) => row.map((cell) => {
        const text = String(cell ?? '');
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(',')).join('\n');
}

/** Row-by-row nesting of every part quantity onto sheets. */
export function nestParts(parts = [], sheet = SHEET) {
    const sheets = [];
    let current = { index: 1, placements: [], used: 0 };

    const pushSheet = () => {
        sheets.push(current);
        current = { index: sheets.length + 1, placements: [], used: 0 };
    };

    const expanded = [];
    parts.forEach((part) => {
        for (let i = 0; i < part.qty; i++) {
            expanded.push({ ...part, copy: i + 1 });
        }
    });

    expanded.sort((a, b) => b.heightMm - a.heightMm || b.widthMm - a.widthMm);

    let x = sheet.gap;
    let y = sheet.gap;
    let rowHeight = 0;

    expanded.forEach((part) => {
        if (part.widthMm > sheet.width || part.heightMm > sheet.height) {
            // Oversize parts go on their own sheet and are flagged.
            current.placements.push({ ...part, x: 0, y: 0, oversize: true, sheet: current.index });
            pushSheet();
            return;
        }

        if (x + part.widthMm + sheet.gap > sheet.width) {
            x = sheet.gap;
            y += rowHeight + sheet.gap;
            rowHeight = 0;
        }
        if (y + part.heightMm + sheet.gap > sheet.height) {
            pushSheet();
            x = sheet.gap;
            y = sheet.gap;
            rowHeight = 0;
        }

        current.placements.push({ ...part, x, y, oversize: false, sheet: current.index });
        current.used += part.widthMm * part.heightMm;
        x += part.widthMm + sheet.gap;
        rowHeight = Math.max(rowHeight, part.heightMm);
    });

    if (current.placements.length || sheets.length === 0) sheets.push(current);

    return sheets.map((entry) => ({
        ...entry,
        utilisation: Number((entry.used / (sheet.width * sheet.height)).toFixed(3))
    }));
}

/** Minimal ASCII DXF with one closed polyline per nested part. */
export function partsToDXF(sheets = [], sheet = SHEET) {
    const lines = ['0', 'SECTION', '2', 'ENTITIES'];

    sheets.forEach((entry) => {
        lines.push('0', 'LWPOLYLINE', '8', 'SHEET-BORDER', '90', '4', '70', '1',
            '10', '0', '20', '0', '10', String(sheet.width), '20', '0',
            '10', String(sheet.width), '20', String(sheet.height),
            '10', '0', '20', String(sheet.height));

        entry.placements.forEach((part) => {
            lines.push('0', 'LWPOLYLINE', '8', `PARTS-S${entry.index}`, '90', '4', '70', '1',
                '10', String(part.x), '20', String(part.y),
                '10', String(part.x + part.widthMm), '20', String(part.y),
                '10', String(part.x + part.widthMm), '20', String(part.y + part.heightMm),
                '10', String(part.x), '20', String(part.y + part.heightMm));
        });
    });

    lines.push('0', 'ENDSEC', '0', 'EOF');
    return lines.join('\n');
}

export function manufacturingPackage(items = []) {
    const { cabinets, parts } = manufacturingParts(items);
    const sheets = nestParts(parts);
    return {
        cabinets: cabinets.length,
        parts,
        sheets,
        csv: partsToCSV(parts),
        dxf: partsToDXF(sheets)
    };
}
