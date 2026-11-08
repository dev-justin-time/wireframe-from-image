/**
 * Framing readout shared by the editor panel and the takeoff screens.
 *
 * The editor frames the plan it already has, so this summary is the bridge
 * between the 3D overlay and the numbers: the same stud spacing, the same
 * header sizes and the same sheathing count that the designer page shows.
 */

export function framingEditorSummary(design) {
    if (!design) {
        return { headline: 'No framing yet', rows: [], checks: [], ok: false, studs: 0, sheets: 0, total: 0 };
    }
    const config = design.config || {};
    const worst = design.walls.flatMap((wall) => wall.openings).reduce((entry, opening) => (
        !entry || opening.header.utilisation > entry.header.utilisation ? opening : entry
    ), null);
    const headerLabel = worst
        ? (worst.header.engineered ? 'engineered LVL' : `${worst.header.plies} ply ${worst.header.size}`)
        : 'none';

    const rows = [
        { label: 'Storeys', value: `${design.storeys.length}` },
        { label: 'Walls', value: `${design.walls.length} · ${design.metrics.linearM} m` },
        { label: 'Studs', value: `${config.studSize || '2x4'} @ ${config.studSpacingIn || 16} in` },
        { label: 'Stud length', value: `${config.studLengthIn || 0} in precut` },
        { label: 'Largest header', value: headerLabel },
        { label: 'Studs & cripples', value: `${design.metrics.studs}` },
        { label: 'Sheathing', value: `${design.metrics.sheets} sheets` },
        { label: 'Floor', value: `${design.metrics.floorAreaM2} m²` },
        { label: 'Material', value: `$${design.bom.material.toFixed(0)}` },
        { label: 'Total', value: `$${design.bom.total.toFixed(0)}` }
    ];

    return {
        headline: `${design.storeys.length} storey${design.storeys.length === 1 ? '' : 's'} · ${design.metrics.linearM} m framed`,
        rows,
        checks: design.checks.filter((check) => check.severity === 'error' || check.severity === 'warn'),
        ok: design.errors === 0,
        studs: design.metrics.studs,
        sheets: design.metrics.sheets,
        total: design.bom.total,
        config: { ...config },
        boardFeet: design.bom.boardFeet
    };
}

export function framingDraftLines(design) {
    if (!design) return [];
    return design.bom.rows
        .filter((row) => row.group !== 'Labour')
        .map((row) => ({
            suite: 'framing',
            code: row.item.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            description: row.item,
            qty: row.qty,
            unit: row.unit,
            unitCost: row.unitCost,
            group: row.group
        }));
}
