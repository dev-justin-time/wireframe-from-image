import { IN, FT } from './design.js';
import { computeStairDesign, STAIR_CODES, defaultStairConfig } from './design.js';
import { takeoff } from './parts.js';

/**
 * Outdoor stair systems — decks, porches, exterior egress, apartment stairs and
 * concrete walkway stairs.
 *
 * Each system is a preset over the shared design engine (IRC 2021 / IBC 2021,
 * see staircode.md) plus the things that only matter outside: frost-depth
 * footings, guard heights, open risers, corrosion-resistant hardware, landings
 * at doors, and the exit-discharge path an exterior egress stair must reach.
 */

export const OUTDOOR_SYSTEMS = [
    {
        key: 'deck',
        label: 'Wood deck stair',
        short: 'Deck',
        code: 'IRC2021',
        structure: 'wood',
        width: 36 * IN,
        guardHeight: 36 * IN,
        handrailSides: 1,
        openRisers: true,
        landingDepth: 36 * IN,
        footingDepth: 42 * IN,
        maxStringerSpan: 3.96,
        stringerKey: 'stringer-2x12',
        material: 'Pressure-treated lumber, UC4A ground contact',
        summary: 'Open or closed 36 in deck stair on cut 2x12 stringers with 4x4 posts on frost-depth piers.',
        notes: [
            'Guard required where the deck surface is more than 30 in above grade (IRC R312.1.1).',
            'Open risers must reject a 4 in sphere; a 2x2 toe board keeps the gap legal (R311.7.5.1).',
            'Ledger, stringer hangers and post bases are galvanised or stainless (R317.3).'
        ],
        defaults: { type: 'straight', availableRun: 4.4, availableWidth: 1.2 }
    },
    {
        key: 'porch',
        label: 'Porch stair',
        short: 'Porch',
        code: 'IRC2021',
        structure: 'wood',
        width: 36 * IN,
        guardHeight: 36 * IN,
        handrailSides: 1,
        openRisers: false,
        landingDepth: 36 * IN,
        footingDepth: 42 * IN,
        maxStringerSpan: 3.96,
        stringerKey: 'stringer-2x12',
        material: 'Pressure-treated lumber with composite treads',
        summary: 'Closed-riser 36 in porch stair with a 36 in landing at the door and a guard on the open side.',
        notes: [
            'The door landing is at least 36 in deep in the direction of travel (IRC R311.3).',
            'Closed risers keep the stair clear of the 4 in sphere rule and stop wind-driven rain.',
            'A 36 in guard is required on the open side of the porch and the stair (R312).'
        ],
        defaults: { type: 'straight', availableRun: 4.4, availableWidth: 1.2 }
    },
    {
        key: 'egress',
        label: 'Exterior building egress stair',
        short: 'Egress',
        code: 'IBC2021',
        structure: 'steel',
        width: 44 * IN,
        guardHeight: 42 * IN,
        handrailSides: 2,
        openRisers: false,
        landingDepth: 48 * IN,
        footingDepth: 42 * IN,
        maxStringerSpan: 4.6,
        stringerKey: 'stringer-steel-channel',
        material: 'Galvanised steel stringers, concrete-filled pan treads',
        summary: 'IBC exterior exit stair: 44 in clear, 7 in / 11 in, 42 in guards, landings every floor and at the discharge.',
        notes: [
            'Clear width is 44 in, or 36 in where the occupant load is under 50 (IBC 1011.2).',
            'Handrails are required on both sides at 34–38 in (IBC 1012.2).',
            'The stair must discharge directly to a public way or through an exit path (IBC 1027).',
            'Open on at least one side to the outdoors, or protect openings within 10 ft of the stair.'
        ],
        defaults: { type: 'straight', availableRun: 5.2, availableWidth: 1.5 }
    },
    {
        key: 'apartment',
        label: 'Apartment building stair',
        short: 'Apartment',
        code: 'IBC2021',
        structure: 'steel',
        width: 44 * IN,
        guardHeight: 42 * IN,
        handrailSides: 2,
        openRisers: false,
        landingDepth: 48 * IN,
        footingDepth: 42 * IN,
        maxStringerSpan: 4.6,
        stringerKey: 'stringer-steel-channel',
        material: 'Steel or cast-in-place concrete, rated stair enclosure',
        summary: 'R-2 multi-family egress stair with 44 in flights, 48 in landings, 42 in guards and a rated enclosure.',
        notes: [
            'Apartment (R-2) stairs are IBC means of egress, not IRC dwelling stairs.',
            'Landing depth is the stair width or 48 in, whichever is less; a straight run need not exceed 48 in (IBC 1011.6).',
            'Enclosure and opening protection follow IBC 1023 for the building height and sprinkler status.',
            'A 42 in guard and a 34–38 in handrail on each side; 6 in clear between the two rails on a 44 in stair is tight — check the section.'
        ],
        defaults: { type: 'straight', availableRun: 5.6, availableWidth: 1.6 }
    },
    {
        key: 'concrete',
        label: 'Concrete walkway stair',
        short: 'Concrete',
        code: 'IBC2021',
        structure: 'concrete',
        width: 60 * IN,
        guardHeight: 42 * IN,
        handrailSides: 2,
        openRisers: false,
        landingDepth: 60 * IN,
        footingDepth: 42 * IN,
        maxStringerSpan: 6,
        stringerKey: 'concrete-flight',
        material: 'Cast-in-place 4000 psi concrete, #4 bars each way',
        summary: 'Cast concrete stair linking exterior walkways: 5 ft wide, 7 in / 11 in, 42 in guards, landings at grade breaks.',
        notes: [
            'Accessible route: a stair is not accessible, so pair it with a 1:12 ramp, lift or elevator (ADA 2010 405).',
            'Slope landings 1/4 in per foot away from buildings; provide a slip-resistant broom finish.',
            'Minimum 4 in riser and 11 in tread under IBC 1011.5.2; 2 in concrete cover over reinforcement.',
            'Guard the open sides at 42 in and handrail both sides (IBC 1012 / 1015).'
        ],
        defaults: { type: 'straight', availableRun: 6.4, availableWidth: 1.9 }
    }
];

export const OUTDOOR_SYSTEM_MAP = new Map(OUTDOOR_SYSTEMS.map((system) => [system.key, system]));

export function getOutdoorSystem(key) {
    return OUTDOOR_SYSTEM_MAP.get(key) || OUTDOOR_SYSTEM_MAP.get('deck');
}

/** Guard height, handrail sides and hardware rules that apply outdoors. */
export const OUTDOOR_RULES = [
    { id: 'OUT-GUARD-R', code: 'IRC 2021', ref: 'R312.1.1 / R312.1.2', topic: 'guard', text: 'Guard required above 30 in; 36 in high with no 4 in sphere passing', min: 30, minUnit: 'in above grade', height: 36, unit: 'in' },
    { id: 'OUT-GUARD-C', code: 'IBC 2021', ref: '1015.2 / 1015.4', topic: 'guard', text: 'Guard required above 30 in; 42 in high, 4 in sphere, 200 lb load', min: 30, height: 42, unit: 'in' },
    { id: 'OUT-HANDRAIL', code: 'IRC 2021', ref: 'R311.7.8', topic: 'handrail', text: 'Handrail 34–38 in above nosing, graspable, one side minimum for a dwelling', min: 34, max: 38, unit: 'in' },
    { id: 'OUT-HANDRAIL-BOTH', code: 'IBC 2021', ref: '1012.2', topic: 'handrail', text: 'Handrails on both sides of an egress stair', min: 34, max: 38, unit: 'in' },
    { id: 'OUT-OPEN-RISER', code: 'IRC 2021', ref: 'R311.7.5.1', topic: 'riser', text: 'Open risers must not allow a 4 in sphere to pass', max: 4, unit: 'in clear' },
    { id: 'OUT-FOOTING', code: 'IRC 2021', ref: 'R403.1.4', topic: 'footing', text: 'Footings extend below the frost line; 12 in minimum below undisturbed grade', min: 12, unit: 'in' },
    { id: 'OUT-FASTENERS', code: 'IRC 2021', ref: 'R317.3', topic: 'hardware', text: 'Fasteners and connectors in exterior/treated wood are hot-dip galvanised, stainless or coated', unit: '' },
    { id: 'OUT-LEDGER', code: 'IRC 2021', ref: 'R507.9.1.3', topic: 'deck', text: 'Ledger is flashed, bolted per the span table and never supported by the deck', unit: '' },
    { id: 'OUT-LANDING-DOOR', code: 'IRC 2021', ref: 'R311.3', topic: 'landing', text: 'Landing at a door is at least 36 in deep in the direction of travel', min: 36, unit: 'in' },
    { id: 'OUT-LANDING-IBC', code: 'IBC 2021', ref: '1011.6', topic: 'landing', text: 'Landing depth is the stair width or 48 in, whichever is less', max: 48, unit: 'in' },
    { id: 'OUT-DISCHARGE', code: 'IBC 2021', ref: '1027.1', topic: 'egress', text: 'Exterior stair discharges directly to a public way or an exit path', unit: '' },
    { id: 'OUT-ENCLOSURE', code: 'IBC 2021', ref: '1023.2', topic: 'egress', text: 'Stair enclosure and opening protection follow the building type and sprinkler status', unit: '' },
    { id: 'OUT-WALKWAY-SLOPE', code: 'IBC 2021', ref: '1010.1.7 / ADA 405', topic: 'concrete', text: 'Walkway landings slope 1/4 in per foot; accessible routes use a 1:12 ramp instead of a stair', unit: '' },
    { id: 'OUT-CONCRETE-MIN', code: 'IBC 2021', ref: '1011.5.2', topic: 'concrete', text: 'Concrete stair riser 4–7 in, tread 11 in minimum, 2 in cover over reinforcement', min: 4, max: 7, unit: 'in' }
];

function pushIssue(issues, severity, code, message) {
    issues.push({ severity, code, message });
}

/** Preset stair config for an outdoor system. */
export function outdoorStairConfig(system = 'deck', options = {}) {
    const spec = getOutdoorSystem(system);
    const code = STAIR_CODES[options.code || spec.code] ? (options.code || spec.code) : spec.code;
    const base = defaultStairConfig(options.type || 'straight', {
        storeyHeight: options.storeyHeight
    });
    return {
        ...base,
        ...spec.defaults,
        ...options,
        system: spec.key,
        code,
        width: options.width ?? spec.width,
        guardHeight: options.guardHeight ?? spec.guardHeight
    };
}

/**
 * Size an outdoor stair and check it against the outdoor rules.
 *
 * Returns the shared stair design plus:
 *   system, guard, handrails, footing, structure, bom, outdoorIssues
 */
export function computeOutdoorStair(input = {}) {
    const spec = getOutdoorSystem(input.system);
    const config = outdoorStairConfig(spec.key, input);
    const design = computeStairDesign({ ...config, code: config.code });
    const issues = design.issues.slice();
    const width = design.width;
    const rise = design.rise;
    const guardRequired = rise > 30 * IN;
    const guardHeight = Number(input.guardHeight ?? spec.guardHeight);
    const footingDepth = Number(input.footingDepth ?? spec.footingDepth);
    const handrailSides = Number(input.handrailSides ?? spec.handrailSides);
    const openRisers = input.openRisers ?? spec.openRisers;
    const openRiserGap = Number(input.openRiserGap ?? (openRisers ? 0.09 : 0));

    if (design.type === 'spiral' && spec.key !== 'deck' && spec.key !== 'porch') {
        pushIssue(issues, 'error', 'spiral-egress',
            'A spiral stair is not a permitted egress component outside dwelling units (IBC 1011.10)');
    }
    if (design.type !== 'straight' && spec.structure === 'concrete' && design.type !== 'curve-right') {
        pushIssue(issues, 'info', 'concrete-layout',
            'Cast-in-place curved flights need a formed soffit; check the radius with the formwork supplier');
    }
    if (guardRequired && guardHeight < spec.guardHeight - 1e-6) {
        pushIssue(issues, 'error', 'guard-height',
            `Guard ${Math.round(guardHeight / IN)} in is below the ${Math.round(spec.guardHeight / IN)} in ${spec.code === 'IRC2021' ? 'residential' : 'commercial'} minimum`);
    }
    if (!guardRequired) {
        pushIssue(issues, 'info', 'guard-not-required',
            `Rise is under 30 in, so a guard is optional; add one anyway above 30 in outside grade`);
    }
    if (handrailSides < 2 && spec.handrailSides === 2) {
        pushIssue(issues, 'error', 'handrail-sides', 'An egress stair needs a handrail on both sides (IBC 1012.2)');
    }
    if (openRisers && openRiserGap > 4 * IN + 1e-6) {
        pushIssue(issues, 'error', 'open-riser',
            `Open riser gap ${(openRiserGap / IN).toFixed(1)} in exceeds 4 in; add a toe board or close the riser`);
    }
    if (spec.structure === 'wood' && footingDepth < 36 * IN - 1e-6) {
        pushIssue(issues, 'error', 'footing-depth',
            `Footing ${Math.round(footingDepth / IN)} in deep is above the 36 in minimum and likely above frost`);
    }
    if (spec.structure === 'wood' && (design.runUsed || 0) > spec.maxStringerSpan + 1e-6) {
        pushIssue(issues, 'warning', 'stringer-span',
            `Run ${design.runUsed.toFixed(2)} m exceeds the ${spec.maxStringerSpan.toFixed(2)} m 2x12 stringer span; add a mid-stringer support`);
    }
    if (spec.structure === 'concrete' && design.riserHeight < 4 * IN - 1e-6) {
        pushIssue(issues, 'error', 'concrete-riser',
            `Concrete riser ${(design.riserHeight / IN).toFixed(2)} in is below the 4 in IBC minimum`);
    }
    if (design.treadDepth && design.treadDepth < 11 * IN - 1e-6 && !input.nosing) {
        pushIssue(issues, 'info', 'nosing',
            'Tread is under 11 in, so a ¾–1¼ in nosing is needed to make the going legal');
    }
    if (rise > 12 * FT + 1e-6) {
        pushIssue(issues, 'warning', 'flight-landing',
            'The flight exceeds 12 ft between landings; insert an intermediate landing (IBC 1011.8)');
    }
    if (spec.key === 'egress' || spec.key === 'apartment') {
        pushIssue(issues, 'info', 'exit-discharge',
            'Confirm the stair lands on an exit path that reaches a public way (IBC 1027.1)');
        pushIssue(issues, 'info', 'enclosure',
            'Check the enclosure and opening protection for the building type and sprinkler status (IBC 1023)');
    }
    if (spec.structure !== 'wood') {
        pushIssue(issues, 'info', 'accessible-route',
            'Stairs are not an accessible route; provide a 1:12 ramp, lift or elevator alongside (ADA 405)');
    }
    if (spec.key === 'deck' || spec.key === 'porch') {
        pushIssue(issues, 'info', 'hardware',
            'Use hot-dip galvanised or stainless connectors and joist tape at every bearing (IRC R317.3)');
    }

    const guard = {
        required: guardRequired,
        height: guardHeight,
        maxGap: 4 * IN,
        handrailSides,
        handrailHeight: [34 * IN, 38 * IN],
        graspableDiameter: [1.25 * IN, 2 * IN]
    };

    const footing = {
        depth: footingDepth,
        diameter: 12 * IN,
        padSize: 16 * IN,
        frostProtected: footingDepth >= 36 * IN,
        structure: spec.structure
    };

    const bom = outdoorBillOfMaterials({ ...design, system: spec.key, spec, guard, openRisers, footing });

    return {
        ...design,
        system: spec.key,
        systemLabel: spec.label,
        structure: spec.structure,
        codeLabel: spec.label + ' · ' + (STAIR_CODES[config.code]?.label || config.code),
        guard,
        footing,
        openRisers,
        openRiserGap,
        handrailSides,
        landingDepth: spec.landingDepth,
        spec,
        bom,
        issues,
        compliant: !issues.some((issue) => issue.severity === 'error'),
        errors: issues.filter((issue) => issue.severity === 'error'),
        warnings: issues.filter((issue) => issue.severity === 'warning'),
        outdoorIssues: issues.filter((issue) => String(issue.code).startsWith('guard') || [
            'handrail-sides', 'open-riser', 'footing-depth', 'stringer-span', 'concrete-riser',
            'nosing', 'flight-landing', 'spiral-egress', 'exit-discharge', 'enclosure', 'accessible-route', 'hardware'
        ].includes(issue.code))
    };
}

/**
 * Bill of materials for an outdoor stair. Quantities follow the geometry:
 * one stringer per 44 in of width, a post every 6 ft of rail, footings under
 * every post that reaches grade.
 */
export function outdoorBillOfMaterials(design) {
    const spec = design.spec || getOutdoorSystem(design.system);
    const width = design.width;
    const pathLength = design.pathLength || design.runUsed || 0;
    const treads = Math.max(0, design.treads || 0);
    const risers = treads;
    const stringers = width > 1.22 ? 3 : 2;
    const railLength = Math.max(pathLength, 0.9);
    const postSpacing = 6 * FT;
    const postsPerSide = Math.ceil(railLength / postSpacing) + 1;
    const sides = Math.max(1, design.handrailSides || 1);
    const balusterCount = Math.ceil(railLength / (4 * IN + 1.5 * IN)) * sides;
    const lines = [];

    if (spec.structure === 'wood') {
        lines.push({ key: spec.stringerKey, qty: stringers, options: { run: pathLength, rise: design.rise } });
        lines.push({
            key: design.system === 'deck' ? 'tread-deck' : 'tread-2x10',
            qty: treads,
            options: { width }
        });
        if (!design.openRisers) lines.push({ key: 'riser-1x8', qty: risers, options: { width, riser: design.riserHeight } });
        else lines.push({ key: 'toe-board', qty: treads, options: { width } });
        lines.push({ key: 'nosing', qty: treads, options: { width } });
        lines.push({ key: 'post-4x4', qty: postsPerSide * sides, options: { height: design.guard.height } });
        lines.push({ key: 'pier-footing', qty: postsPerSide * sides, options: { depth: design.footing.depth } });
        lines.push({ key: 'post-anchor', qty: postsPerSide * sides });
        lines.push({ key: 'guard-top-2x4', qty: Math.ceil(railLength / 1.8), options: { run: 1.8, guard: design.guard.height } });
        lines.push({ key: 'guard-bottom-2x4', qty: Math.ceil(railLength / 1.8), options: { run: 1.8 } });
        lines.push({ key: 'baluster-2x2', qty: balusterCount, options: { height: design.guard.height - 0.12 } });
        lines.push({ key: 'handrail-round', qty: sides, options: { run: railLength } });
        lines.push({ key: 'stringer-bracket', qty: stringers });
        if (design.system === 'deck' || design.system === 'porch') {
            lines.push({ key: 'ledger-board', qty: 1, options: { width: width + 0.6 } });
        }
        lines.push({ key: 'landing-frame', qty: 1, options: { width, landing: design.landingDepth || 1.0 } });
        lines.push({ key: 'landing-deck', qty: 1, options: { width, landing: design.landingDepth || 1.0 } });
    } else if (spec.structure === 'concrete') {
        lines.push({ key: 'concrete-flight', qty: 1, options: { width, run: design.runUsed, rise: design.rise } });
        lines.push({ key: 'gravel-base', qty: 1, options: { width: width + 0.3, landing: 0.6 } });
        lines.push({ key: 'rebar', qty: Math.max(6, Math.round(width / 0.3) + Math.round(design.runUsed / 0.3)), options: { run: width } });
        lines.push({ key: 'form-board', qty: 2, options: { run: design.runUsed, height: design.rise } });
        lines.push({ key: 'landing-concrete', qty: 1, options: { width: design.landingDepth || width, landing: design.landingDepth || width } });
        lines.push({ key: 'guard-top-2x4', qty: Math.ceil(railLength / 1.8) * 2, options: { run: 1.8, guard: design.guard.height } });
        lines.push({ key: 'guard-bottom-2x4', qty: Math.ceil(railLength / 1.8) * 2, options: { run: 1.8 } });
        lines.push({ key: 'baluster-2x2', qty: balusterCount * 2, options: { height: design.guard.height - 0.12 } });
        lines.push({ key: 'handrail-round', qty: sides, options: { run: railLength } });
    } else {
        lines.push({ key: 'stringer-steel-channel', qty: stringers, options: { run: pathLength, rise: design.rise } });
        lines.push({ key: 'tread-concrete', qty: treads, options: { width } });
        lines.push({ key: 'stringer-bracket', qty: stringers });
        lines.push({ key: 'guard-top-2x4', qty: Math.ceil(railLength / 1.8) * 2, options: { run: 1.8, guard: design.guard.height } });
        lines.push({ key: 'guard-bottom-2x4', qty: Math.ceil(railLength / 1.8) * 2, options: { run: 1.8 } });
        lines.push({ key: 'baluster-2x2', qty: balusterCount * 2, options: { height: design.guard.height - 0.12 } });
        lines.push({ key: 'handrail-round', qty: sides, options: { run: railLength } });
        lines.push({ key: 'post-6x6', qty: Math.ceil(railLength / 2.4) * 2, options: { height: design.rise } });
        lines.push({ key: 'pier-footing', qty: Math.ceil(railLength / 2.4) * 2, options: { depth: design.footing.depth } });
        lines.push({ key: 'landing-concrete', qty: 1, options: { width: design.width, landing: design.landingDepth || design.width } });
    }

    const rows = takeoff(lines);
    return {
        rows,
        totals: {
            parts: rows.reduce((sum, row) => sum + row.qty, 0),
            lf: Math.round(rows.reduce((sum, row) => sum + (row.size.length || 0) * row.qty, 0) * 10) / 10
        }
    };
}

/** Human-readable summary lines for the UI and the console. */
export function outdoorSummary(design) {
    if (!design) return [];
    const lines = [
        `${design.systemLabel || design.system} · ${design.codeLabel}`,
        `${design.risers} risers × ${(design.riserHeight / IN).toFixed(2)} in · ${design.treads} treads × ${((design.treadDepth || 0) / IN).toFixed(2)} in`,
        `Width ${(design.width / IN).toFixed(1)} in · run ${(design.runUsed || 0).toFixed(2)} m · guard ${(design.guard.height / IN).toFixed(0)} in`,
        `Footings ${(design.footing.depth / IN).toFixed(0)} in deep · ${design.bom?.totals?.parts || 0} parts in the takeoff`
    ];
    design.issues.forEach((issue) => {
        lines.push(`${issue.severity === 'error' ? '✖' : issue.severity === 'warning' ? '⚠' : 'ℹ'} ${issue.message}`);
    });
    return lines;
}

/** CSV for the takeoff, ready for a spreadsheet or a supplier quote. */
export function outdoorBomCsv(design) {
    const rows = design?.bom?.rows || [];
    const head = ['part', 'material', 'qty', 'length_m', 'width_m', 'height_m'];
    const body = rows.map((row) => [
        row.label,
        row.material,
        row.qty,
        row.size.length?.toFixed(3) || '',
        row.size.width?.toFixed(3) || '',
        row.size.height?.toFixed(3) || ''
    ]);
    return [head, ...body]
        .map((cols) => cols.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');
}
