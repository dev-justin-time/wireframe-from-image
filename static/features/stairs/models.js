import { IN, computeStairDesign } from './design.js';

/**
 * Stair model families.
 *
 * The BIMobject construction > stairs category is dominated by manufacturer
 * product types rather than generic runs: steel and aluminium spirals, mono
 * stringer straight and L-turn floating stairs, alternating tread devices,
 * ships ladders, fixed industrial/Osha stairs, crossovers, loading dock steps,
 * disappearing (pull-down) stairs, concrete-filled pan stairs and grating
 * treads.
 *
 * Each family here is that product type expressed as parameters over the shared
 * design engine, so a selected model still gets real riser/tread maths, code
 * checks, walkable geometry and a parts takeoff. Nothing is downloaded: the
 * geometry is generated, which is what the licensed BIM files would otherwise
 * be used for.
 *
 * Code values are the model-code aids described in staircode.md, not a
 * substitute for the manufacturer's engineering or the AHJ.
 */

const deg = (radians) => (radians * 180) / Math.PI;

export const MODEL_CATEGORIES = [
    'Spiral',
    'Mono stringer',
    'Steep access',
    'Industrial',
    'Site'
];

const RAIL_36 = 36 * IN;
const RAIL_42 = 42 * IN;

export const STAIR_MODELS = [
    // --- Spiral -------------------------------------------------------
    {
        key: 'spiral-steel',
        label: 'Classic steel spiral',
        category: 'Spiral',
        type: 'spiral',
        code: 'IRC2021',
        diameter: 60 * IN,
        geometry: 'spiral',
        structure: 'steel',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'steel',
        openRisers: true,
        guardHeight: RAIL_36,
        handrailSides: 1,
        minWidth: 26 * IN,
        summary: '1.5 m steel spiral on a 3.5 in centre column with 14 ga treads, one continuous outer handrail.',
        notes: [
            'Measured as a 60 in diameter with a 12 in walkline; a smaller drum fails the 7.5 in walkline tread.',
            'Spiral stairways are limited as a means of egress (IBC 1011.10); they serve a dwelling or a small occupancy.'
        ],
        refs: [
            { code: 'IRC 2021', ref: 'R311.7.5.2', url: 'https://up.codes/s/spiral-stairways' },
            { code: 'IBC 2021', ref: '1011.10', url: 'https://up.codes/s/spiral-stairways' }
        ],
        defaults: { availableRun: 2.0, availableWidth: 60 * IN, width: 60 * IN }
    },
    {
        key: 'spiral-aluminium',
        label: 'Aluminium spiral, exterior',
        category: 'Spiral',
        type: 'spiral',
        code: 'IRC2021',
        diameter: 72 * IN,
        geometry: 'spiral',
        structure: 'aluminium',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'aluminium',
        openRisers: true,
        guardHeight: RAIL_36,
        handrailSides: 1,
        minWidth: 26 * IN,
        summary: '1.8 m aluminium spiral with mill-finish plate treads and a galvanised column for exterior use.',
        notes: [
            'Aluminium treads and stainless fasteners are the usual choice at the coast; isolate steel from aluminium.',
            'Ice, leaf litter and sand fall through open treads, so the exterior spiral stays usable in winter.'
        ],
        refs: [
            { code: 'IRC 2021', ref: 'R311.7.5.2', url: 'https://up.codes/s/spiral-stairways' }
        ],
        defaults: { availableRun: 2.4, availableWidth: 72 * IN, width: 72 * IN }
    },

    // --- Mono stringer ------------------------------------------------
    {
        key: 'mono-straight',
        label: 'Mono stringer, straight run',
        category: 'Mono stringer',
        type: 'straight',
        code: 'IRC2021',
        width: 42 * IN,
        geometry: 'mono',
        structure: 'steel',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'wood',
        openRisers: true,
        guardHeight: RAIL_36,
        handrailSides: 2,
        minWidth: 36 * IN,
        summary: 'Floating straight run on one 3/8 in steel plate stringer: open treads, two cable rails, no risers.',
        notes: [
            'Open risers must reject a 4 in sphere (IRC R311.7.5.1) — the tread pitch here is 10 in with a 7½ in gap.',
            'The single centre stringer is engineered, not cut on site; the tread brackets set the 10 in going.',
            'Code minimum clear width is 36 in; 42 in reads better against the open side of a room.'
        ],
        refs: [
            { code: 'IRC 2021', ref: 'R311.7.1 / R311.7.5.1', url: 'https://up.codes/s/stairways-and-handrails' }
        ],
        defaults: { availableRun: 4.6, availableWidth: 1.4, width: 42 * IN }
    },
    {
        key: 'mono-turn',
        label: 'Mono stringer, 90° turn',
        category: 'Mono stringer',
        type: 'curve-right',
        code: 'IRC2021',
        width: 42 * IN,
        geometry: 'mono-arc',
        structure: 'steel',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'wood',
        openRisers: true,
        guardHeight: RAIL_36,
        handrailSides: 2,
        minWidth: 36 * IN,
        summary: 'Quarter-turn floating stair with winder treads on a curved steel spine, open risers and a cable rail.',
        notes: [
            'Winders are checked at the 12 in walkline: the inside tread must stay above 6 in on a dwelling stair.',
            'A curved spine needs a fabricated template — the radius shown is the outside face, not the walkline.',
            'Keep the turn clear of the floor opening: the plan footprint is the swept rectangle, not the arc.'
        ],
        refs: [
            { code: 'IRC 2021', ref: 'R311.7.5 / R311.7.6', url: 'https://up.codes/s/stairways-and-handrails' }
        ],
        defaults: { availableRun: 5.4, availableWidth: 3.2, width: 42 * IN, turnDegrees: 90 }
    },

    // --- Steep access -------------------------------------------------
    {
        key: 'alt-tread',
        label: 'Alternating tread device',
        category: 'Steep access',
        type: 'straight',
        code: 'IBC_ALT',
        width: 24 * IN,
        geometry: 'alternating',
        structure: 'steel',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'grate',
        openRisers: true,
        guardHeight: RAIL_42,
        handrailSides: 2,
        minWidth: 20 * IN,
        slope: { min: 0, max: 51 },
        summary: 'Steep access stair with half treads alternating left and right of a centre stringer — 9.5 in rise on 8.5 in treads.',
        notes: [
            'IBC 1011.14: 20 in minimum width, 8.5 in minimum tread, 9.5 in maximum riser, handrails on both sides.',
            'The alternating treads let each foot land on a full tread at roughly half the going of a normal stair.',
            'Not a component of an accessible route, and not permitted where the occupant load needs a standard stair.'
        ],
        refs: [
            { code: 'IBC 2021', ref: '1011.14', url: 'https://up.codes/s/alternating-tread-devices' }
        ],
        defaults: { availableRun: 3.4, availableWidth: 0.9, width: 24 * IN }
    },
    {
        key: 'ships-ladder',
        label: 'Ships ladder',
        category: 'Steep access',
        type: 'straight',
        code: 'IBC_SHIP',
        width: 24 * IN,
        geometry: 'ladder',
        structure: 'steel',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'grate',
        openRisers: true,
        guardHeight: RAIL_42,
        handrailSides: 2,
        minWidth: 20 * IN,
        slope: { min: 50, max: 70 },
        summary: '70° ships ladder: 20 in wide, 5 in treads, 10 in rises, grab rails carried above the landing.',
        notes: [
            'IBC 1011.16: 20 in minimum width, 5 in minimum tread, 10 in maximum riser, 70° maximum slope.',
            'Grab rails extend at least 30 in above the top landing so the last step is taken hand over hand.',
            'For mechanical rooms and roof access, not for occupied floors or an accessible route.'
        ],
        refs: [
            { code: 'IBC 2021', ref: '1011.16', url: 'https://up.codes/s/ships-ladders' }
        ],
        defaults: { availableRun: 1.9, availableWidth: 0.8, width: 24 * IN }
    },
    {
        key: 'disappearing',
        label: 'Disappearing (pull-down) stair',
        category: 'Steep access',
        type: 'straight',
        // Manufacturers build these to the steep-access ladder profile: a
        // narrow, fixed flight used for occasional access, never egress.
        code: 'IBC_SHIP',
        width: 24 * IN,
        geometry: 'fold',
        structure: 'aluminium',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'aluminium',
        openRisers: true,
        guardHeight: RAIL_36,
        handrailSides: 0,
        minWidth: 20 * IN,
        slope: { min: 0, max: 70 },
        egress: false,
        summary: 'Counterbalanced pull-down stair folded into a 24 × 54 in ceiling opening, shown in its stowed position.',
        notes: [
            'A disappearing stair is occasional access to storage or mechanical space, never a means of egress.',
            'The ceiling opening needs a 20 × 30 in clear head and a full perimeter frame; the spring carries the panel.',
            'Headroom at the bottom step is the reason these are limited to shallow rises; check the 6 ft 8 in line.'
        ],
        refs: [
            { code: 'IBC 2021', ref: '1011.16', url: 'https://up.codes/s/ships-ladders' },
            { code: 'IRC 2021', ref: 'R311.7.9', url: 'https://up.codes/s/stairways-and-handrails' }
        ],
        defaults: { availableRun: 2.4, availableWidth: 0.7, width: 24 * IN }
    },

    // --- Industrial ---------------------------------------------------
    {
        key: 'industrial-osha',
        label: 'Fixed industrial stair',
        category: 'Industrial',
        type: 'straight',
        code: 'OSHA_STAIR',
        width: 30 * IN,
        geometry: 'straight',
        structure: 'steel',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'grate',
        openRisers: true,
        guardHeight: RAIL_42,
        handrailSides: 2,
        minWidth: 22 * IN,
        slope: { min: 30, max: 50 },
        summary: 'OSHA 1910.25 industrial access stair: 22 in minimum width, 30–50° slope, grating treads, 42 in guards.',
        notes: [
            'Risers and treads are uniform within ¼ in over the whole flight; the slope stays between 30° and 50°.',
            'Bar grating or checker plate with a 1 in nosing band; open risers are normal on an industrial stair.',
            'Guard the open sides at 42 in and carry handrails the full length, both sides where the stair is 44 in or wider.'
        ],
        refs: [
            { code: 'OSHA 1910.25', ref: '(b)(3) / (d)(2) / (e)', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.25' }
        ],
        defaults: { availableRun: 4.8, availableWidth: 1.1, width: 30 * IN }
    },
    {
        key: 'grating',
        label: 'Bar grating industrial stair',
        category: 'Industrial',
        type: 'straight',
        code: 'OSHA_STAIR',
        width: 36 * IN,
        geometry: 'straight',
        structure: 'steel',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'grate',
        openRisers: true,
        guardHeight: RAIL_42,
        handrailSides: 2,
        minWidth: 22 * IN,
        slope: { min: 30, max: 50 },
        summary: '36 in galvanised grating stair on channel stringers for plant rooms, mezzanines and roof access.',
        notes: [
            'Grating lets water, dust and light through — the usual choice for a wash-down or plant deck.',
            'Galvanise after fabrication; site-cut edges need a zinc-rich repair coat.',
            'Treads are bolted, not welded, so a worn pan can be replaced without cutting the stringer.'
        ],
        refs: [
            { code: 'OSHA 1910.25', ref: '(d)(2) / (e)(1)', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.25' }
        ],
        defaults: { availableRun: 5.0, availableWidth: 1.2, width: 36 * IN }
    },
    {
        key: 'crossover',
        label: 'Industrial crossover',
        category: 'Industrial',
        type: 'straight',
        code: 'OSHA_STAIR',
        width: 36 * IN,
        geometry: 'crossover',
        structure: 'steel',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'grate',
        openRisers: true,
        guardHeight: RAIL_42,
        handrailSides: 2,
        minWidth: 22 * IN,
        slope: { min: 30, max: 50 },
        summary: 'Two-flight crossover with a mid platform, sized to span conveyor or pipe runs at 42 in guards.',
        notes: [
            'The mid platform is at least 36 in deep and carries guards on every open edge.',
            'A crossover is the standard way over a conveyor: both flights sit inside the 30–50° band.',
            'Keep 6 ft 8 in clear under the platform if people pass beneath it.'
        ],
        refs: [
            { code: 'OSHA 1910.25', ref: '(b)(3) / (c)(4)', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.25' }
        ],
        defaults: { availableRun: 5.2, availableWidth: 1.3, width: 36 * IN }
    },

    // --- Site ---------------------------------------------------------
    {
        key: 'dock-steps',
        label: 'Loading dock steps',
        category: 'Site',
        type: 'straight',
        code: 'IBC2021',
        width: 48 * IN,
        geometry: 'straight',
        structure: 'aluminium',
        support: 'stringer',
        material: 'steel',
        treadMaterial: 'aluminium',
        openRisers: false,
        guardHeight: RAIL_42,
        handrailSides: 2,
        minWidth: 44 * IN,
        summary: '48 in aluminium dock steps with a 42 in guard, closed risers and a bolt-down base plate at the dock edge.',
        notes: [
            'Dock steps are fixed equipment, so the 42 in guard is a fall-protection device as much as a stair rail.',
            'Closed risers stop a pallet truck wheel and keep the flight clear of wind-blown debris.',
            'Base plates are anchored to the dock face; check the edge distance before drilling.'
        ],
        refs: [
            { code: 'IBC 2021', ref: '1011.2 / 1015', url: 'https://up.codes/s/stairways' },
            { code: 'OSHA 1910.28', ref: '(b)(1)', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.28' }
        ],
        defaults: { availableRun: 4.2, availableWidth: 1.5, width: 48 * IN }
    },
    {
        key: 'pan-stair',
        label: 'Concrete-filled pan stair',
        category: 'Site',
        type: 'straight',
        code: 'IBC2021',
        width: 44 * IN,
        geometry: 'pan',
        structure: 'concrete',
        support: 'concrete',
        material: 'concrete',
        treadMaterial: 'concrete',
        openRisers: false,
        guardHeight: RAIL_42,
        handrailSides: 2,
        minWidth: 44 * IN,
        summary: 'Steel pan stair filled with concrete: 44 in clear, 7 in / 11 in, steel channel stringers, cast nosings.',
        notes: [
            'Pans are set and filled in one pour so the tread and riser form a monolithic unit.',
            'Cast abrasive nosings are set into the pan before the concrete is struck.',
            'The filled pan gives the acoustic mass a steel stair lacks — the usual choice in a rated enclosure.'
        ],
        refs: [
            { code: 'IBC 2021', ref: '1011.2 / 1011.5.2', url: 'https://up.codes/s/stairways' }
        ],
        defaults: { availableRun: 5.2, availableWidth: 1.5, width: 44 * IN }
    }
];

export const STAIR_MODEL_MAP = new Map(STAIR_MODELS.map((model) => [model.key, model]));

export function getStairModel(key) {
    return STAIR_MODEL_MAP.get(key) || null;
}

export function modelsByCategory() {
    return MODEL_CATEGORIES.map((category) => ({
        category,
        models: STAIR_MODELS.filter((model) => model.category === category)
    })).filter((group) => group.models.length > 0);
}

/** Item config (`item.stair`) for a model, ready to size and save. */
export function stairModelConfig(key, { storeyHeight } = {}) {
    const model = getStairModel(key);
    if (!model) return null;
    const config = {
        model: model.key,
        type: model.type,
        code: model.code,
        width: model.defaults.width,
        availableRun: model.defaults.availableRun,
        availableWidth: model.defaults.availableWidth,
        structure: model.structure,
        support: model.support,
        material: model.material,
        openRisers: model.openRisers,
        guardHeight: model.guardHeight
    };
    if (model.type === 'spiral') {
        config.availableWidth = model.diameter;
        config.width = model.diameter;
    }
    if (Number.isFinite(Number(storeyHeight))) config.storeyHeight = Number(storeyHeight);
    return config;
}

/**
 * Size a model.
 *
 * Input is the same shape as `computeStairDesign`: any of the model defaults can
 * be overridden (width, run, depth, storeyHeight, code). The design carries a
 * `model` block with the resolved family, the slope, and the model-specific
 * checks, so the panel, the geometry and the takeoff read one object.
 */
export function computeStairModel(key, input = {}) {
    const model = getStairModel(key) || getStairModel('mono-straight');
    const preset = stairModelConfig(model.key, { storeyHeight: input.storeyHeight });
    const config = {
        ...preset,
        ...input,
        model: model.key,
        type: input.type || preset.type,
        code: input.code || preset.code
    };

    const design = computeStairDesign(config);
    const checks = [];
    const check = (severity, code, message) => checks.push({ severity, code, message });

    const slope = design.type === 'fire-pole' || !design.riserHeight || !design.treadDepth
        ? 0
        : deg(Math.atan2(design.riserHeight, design.treadDepth));

    if (design.type === 'spiral') {
        if (design.clearWidth < model.minWidth - 1e-6) {
            check('error', 'model-clear-width',
                `Clear width ${(design.clearWidth / IN).toFixed(1)} in is below the ${(model.minWidth / IN).toFixed(0)} in ${model.label.toLowerCase()} minimum`);
        }
    } else {
        if (design.width < model.minWidth - 1e-6) {
            check('error', 'model-width',
                `${(design.width / IN).toFixed(1)} in is narrower than the ${(model.minWidth / IN).toFixed(0)} in minimum for this model`);
        }
        if (model.slope && slope > model.slope.max + 0.5) {
            check('error', 'model-slope', `Slope ${slope.toFixed(1)}° is steeper than ${model.slope.max}°`);
        }
        if (model.slope && slope < model.slope.min - 0.5) {
            check('info', 'model-slope-shallow', `Slope ${slope.toFixed(1)}° is shallower than the ${model.slope.min}° this model is built for`);
        }
    }

    if (model.egress === false) {
        check('warning', 'model-not-egress', `${model.label} is occasional access only, not a means of egress`);
    }
    if (model.code === 'IBC_ALT' && model.handrailSides < 2) {
        check('error', 'model-alt-rails', 'Alternating tread devices need handrails on both sides (IBC 1011.14)');
    }
    if (model.type === 'spiral' && model.code !== 'IRC2021') {
        check('info', 'model-spiral-egress', 'Spiral stairways are limited as a means of egress (IBC 1011.10)');
    }
    if (model.openRisers && design.treadDepth) {
        const gap = design.riserHeight - 0.045;
        if (model.code === 'IRC2021' && gap > 4 * IN) {
            check('warning', 'model-open-riser',
                `Open riser gap ${(gap / IN).toFixed(1)} in exceeds the 4 in sphere rule; close it or tighten the pitch`);
        }
    }
    if (model.guardHeight && design.type !== 'spiral' && model.guardHeight < 36 * IN - 1e-6) {
        check('error', 'model-guard', 'Guard height is below 36 in');
    }

    design.issues.push(...checks);
    design.modelChecks = checks;
    design.compliant = !design.issues.some((issue) => issue.severity === 'error');
    design.errors = design.issues.filter((issue) => issue.severity === 'error');
    design.warnings = design.issues.filter((issue) => issue.severity === 'warning');
    design.model = {
        key: model.key,
        label: model.label,
        category: model.category,
        geometry: model.geometry,
        structure: model.structure,
        support: model.support,
        material: model.material,
        treadMaterial: model.treadMaterial,
        openRisers: model.openRisers,
        handrailSides: model.handrailSides,
        guardHeight: model.guardHeight,
        minWidth: model.minWidth,
        slope,
        slopeDegrees: Number(slope.toFixed(1)),
        egress: model.egress !== false,
        summary: model.summary,
        notes: model.notes,
        refs: model.refs
    };
    return design;
}

/** Model design for a placed item, or null when the item is not a model. */
export function stairModelDesignForItem(item, storeyHeight) {
    const key = item?.stair?.model || item?.metadata?.stair?.model;
    if (!key) return null;
    return computeStairModel(key, { ...(item.metadata?.stair || {}), ...(item.stair || {}), storeyHeight });
}

/** Lines for the panel summary. */
export function stairModelSummary(design) {
    const model = design?.model;
    if (!model) return [];
    const lines = [
        `${model.label} · ${model.category}`,
        `${(design.width / IN).toFixed(1)} in wide · ${design.risers} risers × ${(design.riserHeight / IN).toFixed(2)} in`,
        `${(design.treadDepth / IN).toFixed(2)} in tread · ${model.slopeDegrees}° slope`
    ];
    if (design.runUsed) {
        lines.push(`Run ${design.runUsed.toFixed(2)} m · ${(design.width / IN).toFixed(1)} in wide`);
    }
    return lines;
}

/** One-line takeoff rows for the model (the full BOM comes from the assembly). */
export function modelTakeoffCsv(design) {
    const model = design?.model;
    if (!model) return 'part,qty,note\n';
    const rows = [
        ['model', 1, `${model.key} ${model.label}`],
        ['tread', design.treads, model.treadMaterial],
        ['riser', model.openRisers ? 0 : design.risers, model.openRisers ? 'open risers' : model.material],
        ['guard', 2, `${(model.guardHeight / IN).toFixed(0)} in, ${model.handrailSides} handrail sides`]
    ];
    return ['part,qty,note', ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
}

/** Model presets written into a stair item when the model changes. */
export function applyModelToConfig(config = {}, key, { storeyHeight } = {}) {
    const preset = stairModelConfig(key, { storeyHeight });
    if (!preset) {
        const { model, ...rest } = config;
        return rest;
    }
    return { ...config, ...preset, model: preset.model };
}

/** Rounded code reference for the model, used by docs and the panel. */
export function modelCodeLine(design) {
    const model = design?.model;
    if (!model?.refs?.length) return '';
    const ref = model.refs[0];
    return `${ref.code} ${ref.ref}`;
}

export const STAIR_MODEL_COUNT = STAIR_MODELS.length;
