/**
 * Deck readout shared by the editor and the takeoff screens.
 *
 * The editor applies a deck draft (sent from the designer page) and shows the
 * same rows here, so the editor and the designer can never disagree about the
 * joist size, the beam or the price.
 */

export function deckEditorSummary(design) {
    if (!design) {
        return { headline: 'No deck design', rows: [], checks: [], ok: false };
    }

    const { config, joist, beam, post, footing, guard, stair } = design;
    const rows = [
        { label: 'Deck', value: `${design.areas.deckM2.toFixed(1)} m² · ${config.height.toFixed(2)} m high` },
        { label: 'Joists', value: `${joist.count} × ${joist.size} @ ${config.joistSpacingIn} in` },
        { label: 'Joist span', value: `${joist.spanM.toFixed(2)} m of ${joist.capacityM.toFixed(2)} m` },
        { label: 'Beam', value: `${config.beamPlies} × ${config.beamSize}, posts at ${config.postSpacingM.toFixed(2)} m` },
        { label: 'Posts', value: `${post.count} × ${config.postSize}` },
        { label: 'Footings', value: `${footing.count} × ${footing.diameterIn} in × ${footing.depthM.toFixed(2)} m` },
        { label: 'Guard', value: guard.lengthM ? `${guard.lengthM.toFixed(1)} m ${guard.system.label}` : 'not required' },
        { label: 'Stairs', value: stair.risers ? `${stair.risers} risers at ${Math.round(stair.riserMm)} mm` : 'none' },
        { label: 'Material', value: `$${design.bom.material.toFixed(0)}` },
        { label: 'Total', value: `$${design.bom.total.toFixed(0)}` }
    ];

    return {
        headline: `${config.shape} deck, ${design.areas.deckM2.toFixed(1)} m²`,
        rows,
        checks: design.checks.filter((check) => check.severity !== 'ok'),
        ok: design.errors === 0,
        config: { ...config }
    };
}

export function deckDraftLines(design) {
    if (!design) return [];
    return design.bom.rows.map((row) => ({
        suite: 'deck',
        code: row.item.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description: row.item,
        qty: row.qty,
        unit: row.unit,
        unitCost: row.unitCost,
        group: row.group
    }));
}
