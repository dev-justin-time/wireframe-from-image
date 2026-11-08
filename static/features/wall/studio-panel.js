/**
 * Studio panel model for the wall-covering system.
 *
 * The Finishes section already picks the covering; this panel is the readout
 * the rest of the studio uses: net area, coats, material, labour and total for
 * the covering that is actually applied, plus the checks the suite would raise.
 */
const asCheck = (check) => ({
    severity: check.severity || 'info',
    label: check.label || check.id || 'Check',
    message: check.message || check.detail || ''
});

export function wallStudioPanel({ design = null } = {}) {
    if (!design) {
        return {
            id: 'wall',
            label: 'Wall',
            suite: 'wall-designer.html',
            headline: 'No wall covering yet',
            rows: [],
            checks: [],
            ok: false,
            empty: true,
            detail: 'Pick a covering in Finishes, or design one in the wall suite.',
            actions: [{ id: 'open-wall', label: 'Open wall suite', kind: 'link', href: 'wall-designer.html' }]
        };
    }

    const { areas, costs, covering, substrate, coats, paint } = design;
    const rows = [
        { label: 'Covering', value: covering.label },
        { label: 'Substrate', value: substrate.label },
        { label: 'Net area', value: `${areas.net.toFixed(1)} m² (${areas.gross.toFixed(1)} gross − ${areas.openings.toFixed(1)} openings)` },
        { label: 'Coats', value: `${coats} · ${areas.height.toFixed(2)} m high` },
        paint
            ? { label: 'Paint', value: `${paint.litres} L finish + ${paint.primerLitres} L primer` }
            : { label: 'Material', value: `${costs.rows.length} lines` },
        { label: 'Material', value: `$${costs.material.toFixed(0)}` },
        { label: 'Labour', value: `$${costs.labour.toFixed(0)}` },
        { label: 'Total', value: `$${costs.total.toFixed(0)} · $${costs.perM2.toFixed(2)}/m²` }
    ];
    const checks = design.checks.filter((check) => check.severity !== 'ok').map(asCheck);
    const errors = design.checks.filter((check) => check.severity === 'error').length;

    return {
        id: 'wall',
        label: 'Wall',
        suite: 'wall-designer.html',
        headline: `${covering.label} · ${areas.net.toFixed(1)} m² · $${costs.total.toFixed(0)}`,
        rows,
        checks,
        ok: errors === 0,
        empty: false,
        detail: `${design.colour.label} wall · ${design.scheme.trim.label} trim · ${design.scheme.accent.label} accent.`,
        actions: [{ id: 'open-wall', label: 'Open wall suite', kind: 'link', href: 'wall-designer.html' }]
    };
}
