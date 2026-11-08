/**
 * Electrical readout shared by the editor and the bid builder.
 *
 * The editor applies the draft sent from electrical-designer.html and shows
 * the same service, panel and circuit numbers here, so the two screens cannot
 * disagree about the service size or the price.
 */

export function electricalEditorSummary(design) {
    if (!design) {
        return { headline: 'No electrical design', rows: [], circuits: [], checks: [], ok: false };
    }

    const rows = [
        { label: 'Service', value: `${design.serviceAmps} A, main ${design.mainBreaker} A` },
        { label: 'Demand', value: `${design.demandVa} VA (${design.demandAmps} A, ${design.method})` },
        { label: 'Service conductors', value: `${design.feeder.size}, ${design.feeder.vdPercent}% drop` },
        { label: 'Panel', value: `${design.panel.label}, ${design.spaces.used}/${design.panel.spaces} spaces` },
        { label: 'Circuits', value: `${design.circuits.length}` },
        { label: 'Neutral', value: `${design.neutral.size} (${design.neutral.amps} A unbalanced)` },
        { label: 'Grounding', value: `${design.gec} GEC, ${design.egc} EGC` },
        { label: 'Raceway', value: `${design.conduitFill.conduit} at ${design.conduitFill.fillPercent}%` },
        { label: 'Material', value: `$${design.bom.material.toFixed(0)}` },
        { label: 'Total', value: `$${design.bom.total.toFixed(0)}` }
    ];

    return {
        headline: `${design.serviceAmps} A service, ${design.circuits.length} circuits`,
        rows,
        circuits: design.circuits.map((circuit) => ({
            id: circuit.id,
            label: circuit.label,
            breaker: circuit.breaker,
            conductor: circuit.conductor,
            gfci: circuit.gfci,
            afci: circuit.afci
        })),
        checks: design.checks.filter((check) => check.severity !== 'ok'),
        ok: design.errors === 0,
        config: { ...design.config, appliances: { ...design.config.appliances } }
    };
}

export function electricalDraftLines(design) {
    if (!design) return [];
    return design.bom.rows.map((row) => ({
        suite: 'electrical',
        code: row.item.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description: row.item,
        qty: row.qty,
        unit: row.unit,
        unitCost: row.unitCost,
        group: row.group
    }));
}
