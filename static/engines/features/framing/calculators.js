import { SPECIES, sectionProps, speciesById, lumberPrice } from './catalog.js';
import { LUMBER } from '../lumber.js';
import { ftIn } from './engine.js';

/**
 * Framing calculators.
 *
 * The calculators found on the lumber-span sites, rebuilt on the same NDS
 * mechanics as the framing engine rather than on copied tables:
 *
 *  - lumber span, span table, 2x4 span, 2x6, floor joist, ceiling joist,
 *    roof span, rafter span and wood beam span;
 *  - LVL beam span and size, glulam beam size;
 *  - 2x4 load, framing lumber, ceiling joist count and floor truss planning.
 *
 * Every entry is a pure definition: fields plus a compute function. The suite
 * renders the form and the result from the registry, so adding a calculator
 * never needs a new page. Engineered lumber values are generic and the result
 * always says that the supplier's table governs.
 */

export const IN = 0.0254;
export const FT = 0.3048;

export const GRADES = [
    { id: 'ss', label: 'Select Structural', fb: 1.3, e: 1.15 },
    { id: '1', label: 'No. 1', fb: 1.15, e: 1.05 },
    { id: '2', label: 'No. 2', fb: 1, e: 1 },
    { id: 'stud', label: 'Stud', fb: 0.85, e: 0.95 }
];

export const LOAD_CASES = {
    floor: { id: 'floor', label: 'Floor (40 psf live)', live: 40, dead: 10, limit: 360 },
    roof: { id: 'roof', label: 'Roof (20 psf live)', live: 20, dead: 15, limit: 180 },
    attic: { id: 'attic', label: 'Attic / light storage', live: 20, dead: 10, limit: 240 },
    ceiling: { id: 'ceiling', label: 'Ceiling (10 psf live)', live: 10, dead: 5, limit: 240 },
    deck: { id: 'deck', label: 'Deck (40 psf live, wet)', live: 40, dead: 10, limit: 360 }
};

const SPACINGS = [12, 16, 19.2, 24];
const SIZES = ['2x4', '2x6', '2x8', '2x10', '2x12'];
const SPECIES_OPTIONS = SPECIES.map((entry) => [entry.id, entry.label]);
const GRADE_OPTIONS = GRADES.map((entry) => [entry.id, entry.label]);
const LOAD_OPTIONS = Object.values(LOAD_CASES).map((entry) => [entry.id, entry.label]);

export const LVL = {
    label: 'LVL (generic)',
    Fb: 2600, Fv: 285, E: 1.9e6, widthIn: 1.75,
    depthsIn: [9.25, 9.5, 11.25, 11.875, 14, 16]
};

export const GLULAM = {
    label: 'Glulam (generic)',
    Fb: 2400, Fv: 265, E: 1.8e6,
    widthsIn: [3.5, 5.5, 6.75],
    depthsIn: [9, 10.5, 12, 13.5, 15, 16.5, 18, 21, 24]
};

const round = (value, digits = 1) => Math.round((Number(value) || 0) * 10 ** digits) / 10 ** digits;
const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
const feet = (metres) => Number(metres) / FT;
const inches = (metres) => Number(metres) / IN;

/** Feet-and-inches label for a length in feet. */
export function feetLabel(valueFt) {
    return ftIn(Math.max(0, Number(valueFt) || 0) * FT);
}

export function inchLabel(valueIn) {
    return `${round(valueIn, 2)} in`;
}

function select(key, label, options, value) {
    return { key, label, type: 'select', options, default: value };
}

function number(key, label, value, unit = '', extra = {}) {
    return { key, label, type: 'number', default: value, unit, ...extra };
}

function checkbox(key, label, value = false) {
    return { key, label, type: 'checkbox', default: value };
}

function sortedOptions(entries) {
    return entries.map((entry) => [entry.id, entry.label]);
}

function speciesOf(values) {
    return speciesById(values.species || 'spf-2');
}

function gradeOf(values) {
    return GRADES.find((grade) => grade.id === (values.grade || '2')) || GRADES[2];
}

/** Section properties in inches for a sawn member, with the grade adjustment. */
function sawn(values, size) {
    const props = sectionProps(size) || sectionProps('2x6');
    const species = speciesOf(values);
    const grade = gradeOf(values);
    return {
        ...props,
        props,
        Fb: species.Fb * grade.fb,
        Fv: species.Fv,
        E: species.E * grade.e,
        label: `${species.label} · ${grade.label}`
    };
}

function engineered(material, depthIn, plies = 1) {
    const definition = material === 'glulam' ? GLULAM : LVL;
    const widthIn = material === 'glulam' ? definition.widthsIn[1] : definition.widthIn * Math.max(1, plies);
    const props = {
        b: widthIn,
        d: depthIn,
        area: widthIn * depthIn,
        S: (widthIn * depthIn * depthIn) / 6,
        I: (widthIn * depthIn * depthIn * depthIn) / 12
    };
    return {
        ...props,
        props,
        Fb: definition.Fb,
        Fv: definition.Fv,
        E: definition.E,
        label: `${definition.label} · ${round(widthIn, 2)} × ${round(depthIn, 2)} in`
    };
}

/**
 * Maximum simple or continuous span. Bending uses wL²/8 at the support;
 * deflection uses 5/384 for a simple span and 0.0054 for a two-span continuous
 * beam. Shear is checked but almost never governs residential members.
 */
export function solveSpan({
    S, I, area, Fb, Fv, E,
    livePsf, deadPsf, tributaryFt,
    limit = 360, continuous = false, maxSpanFt = 26
}) {
    const wLive = Math.max(0, livePsf) * Math.max(tributaryFt, 0.1);
    const wTotal = (Math.max(0, livePsf) + Math.max(0, deadPsf)) * Math.max(tributaryFt, 0.1);
    if (!S || !I || !wTotal) return { spanFt: 0, governing: 'input', wLive, wTotal };
    const wTotalIn = wTotal / 12;
    const wLiveIn = wLive / 12;
    const bendIn = Math.sqrt((8 * Fb * S) / wTotalIn);
    const coefficient = continuous ? 0.0054 : 5 / 384;
    const deflIn = Math.cbrt((E * I) / (coefficient * Math.max(limit, 1) * Math.max(wLiveIn, 1e-9)));
    const shearFt = (2 * Fv * area) / (1.5 * Math.max(wTotal, 1e-9));
    const candidates = [
        { spanFt: Math.min(bendIn / 12, maxSpanFt), governing: 'bending' },
        { spanFt: Math.min(deflIn / 12, maxSpanFt), governing: 'deflection' },
        { spanFt: Math.min(shearFt, maxSpanFt), governing: 'shear' }
    ];
    const chosen = candidates.reduce((best, entry) => (entry.spanFt < best.spanFt ? entry : best), candidates[0]);
    return {
        spanFt: Math.max(0, chosen.spanFt),
        governing: chosen.spanFt >= maxSpanFt - 1e-6 ? 'code cap' : chosen.governing,
        wLive,
        wTotal,
        bendFt: bendIn / 12,
        deflFt: deflIn / 12,
        shearFt
    };
}

/** Allowable uniform and midspan point load for one member at a given span. */
export function solveLoad({ S, I, area, Fb, Fv, E, spanFt, limit = 360 }) {
    const spanIn = Math.max(spanFt, 0.1) * 12;
    const wBend = (12 * 8 * Fb * S) / (spanIn * spanIn); // lb/ft
    const wDefl = (12 * 384 * E * I) / (5 * limit * Math.pow(spanIn, 3));
    const wShear = (2 * Fv * area) / (1.5 * Math.max(spanFt, 0.1));
    const pointBend = (4 * Fb * S) / spanIn;
    const pointDefl = (48 * E * I) / (limit * spanIn * spanIn);
    const pointShear = (2 * Fv * area) / 1.5;
    const entries = [
        { w: wBend, p: pointBend, governing: 'bending' },
        { w: wDefl, p: pointDefl, governing: 'deflection' },
        { w: wShear, p: pointShear, governing: 'shear' }
    ];
    const chosen = entries.reduce((best, entry) => (entry.w < best.w ? entry : best), entries[0]);
    return {
        wPerFt: Math.max(0, chosen.w),
        wTotal: Math.max(0, chosen.w) * Math.max(spanFt, 0.1),
        pointLb: Math.max(0, chosen.p),
        governing: chosen.governing
    };
}

const result = (primary, rows, notes, formula, code) => ({ primary, rows, notes, formula, code });

function spanResult(label, solved, extraRows = []) {
    return result(
        { label, value: feetLabel(solved.spanFt) },
        [
            { label: 'Governing case', value: solved.governing },
            { label: 'Design load', value: `${round(solved.wTotal, 1)} lb/ft total` },
            { label: 'Live load', value: `${round(solved.wLive, 1)} lb/ft` },
            ...extraRows
        ],
        [
            'Bending, shear and live-load deflection all checked; the shortest wins.',
            'Continuous spans use the interior-support moment and a continuous-beam deflection coefficient.',
            'Verify against the adopted code table or an engineer before building.'
        ],
        'M = wL²/8 · Δ = 5wL⁴/(384EI) ≤ L/limit',
        'IRC §R301.5 · Table R502.3(1) · AWC NDS'
    );
}

function spanFields(sizeDefault = '2x10', loadDefault = 'floor') {
    return [
        select('size', 'Lumber size', SIZES.map((size) => [size, size]), sizeDefault),
        select('species', 'Species', SPECIES_OPTIONS, 'spf-2'),
        select('grade', 'Grade', GRADE_OPTIONS, '2'),
        select('spacing', 'On center', SPACINGS.map((value) => [String(value), `${value} in`]), '16'),
        select('load', 'Load case', LOAD_OPTIONS, loadDefault),
        checkbox('continuous', 'Continuous span (3+ supports)')
    ];
}

function computeSpan(values, sizeOverride = null) {
    const size = sizeOverride || values.size || '2x10';
    const load = LOAD_CASES[values.load] || LOAD_CASES.floor;
    const material = sawn(values, size);
    const solved = solveSpan({
        ...material,
        livePsf: load.live,
        deadPsf: load.dead,
        tributaryFt: Number(values.spacing || 16) / 12,
        limit: load.limit,
        continuous: Boolean(values.continuous)
    });
    return spanResult(`${size} maximum span`, solved, [
        { label: 'Section', value: `${round(material.props.b, 2)} × ${round(material.props.d, 2)} in` },
        { label: 'Fb / E', value: `${Math.round(material.Fb)} psi / ${(material.E / 1e6).toFixed(2)} × 10⁶ psi` }
    ]);
}

/** Generic beam span from a tributary width rather than a joist spacing. */
export function solveBeamSpan({
    material = 'sawn', size = '2x10', values = {}, tributaryFt = 12, livePsf = 40, deadPsf = 10, limit = 360, continuous = false
}) {
    const definition = material === 'glulam'
        ? engineered('glulam', Number(values.depth || 12), 1)
        : material === 'lvl'
            ? engineered('lvl', Number(values.depth || 11.25), Number(values.plies || 1))
            : sawn(values, size);
    return {
        ...definition,
        ...solveSpan({
            ...definition,
            livePsf, deadPsf, tributaryFt, limit, continuous, maxSpanFt: 40
        })
    };
}

function beamResult(label, definition, solved) {
    return result(
        { label, value: feetLabel(solved.spanFt) },
        [
            { label: 'Governing case', value: solved.governing },
            { label: 'Section', value: `${round(definition.props.b, 2)} × ${round(definition.props.d, 2)} in` },
            { label: 'Total load', value: `${round(solved.wTotal, 1)} lb/ft` },
            { label: 'Reaction at max span', value: `${round((solved.wTotal * solved.spanFt) / 2, 0)} lb` }
        ],
        [
            'The beam is checked in bending, shear and live deflection against the same load case.',
            'Bearing, connections and lateral bracing are separate checks.',
            'Engineered lumber is generic here: the supplier’s span table governs.'
        ],
        'M = wL²/8 · Δ = 5wL⁴/(384EI) ≤ L/limit',
        'AWC NDS · IRC §R502.3'
    );
}

// ---------------------------------------------------------------------------
// Calculator definitions
// ---------------------------------------------------------------------------

export const CALCULATOR_GROUPS = [
    { id: 'span', label: 'Span tables' },
    { id: 'beam', label: 'Beams' },
    { id: 'load', label: 'Loads & quantities' }
];

export const CALCULATORS = [
    {
        id: 'lumber-span',
        label: 'Lumber span',
        group: 'span',
        blurb: 'Maximum span for any size, species, grade, spacing and load case. The main span-table calculator.',
        fields: spanFields('2x10', 'floor'),
        compute: (values) => computeSpan(values)
    },
    {
        id: 'span-table',
        label: 'Span calculator (custom loads)',
        group: 'span',
        blurb: 'Enter your own live and dead load and deflection limit for a bespoke span check.',
        fields: [
            ...spanFields('2x10', 'floor').filter((field) => field.key !== 'load'),
            number('live', 'Live load (psf)', 40, 'psf', { min: 0, max: 200, step: 5 }),
            number('dead', 'Dead load (psf)', 10, 'psf', { min: 0, max: 100, step: 1 }),
            number('limit', 'Deflection limit (L/)', 360, '', { min: 120, max: 720, step: 60 })
        ],
        compute: (values) => {
            const size = values.size || '2x10';
            const material = sawn(values, size);
            const solved = solveSpan({
                ...material,
                livePsf: Number(values.live ?? 40),
                deadPsf: Number(values.dead ?? 10),
                tributaryFt: Number(values.spacing || 16) / 12,
                limit: Number(values.limit || 360),
                continuous: Boolean(values.continuous)
            });
            return spanResult(`${size} maximum span`, solved, [
                { label: 'Deflection limit', value: `L/${values.limit || 360}` }
            ]);
        }
    },
    {
        id: '2x4-span',
        label: '2×4 span',
        group: 'span',
        blurb: 'How far a 2×4 can span as a joist, rafter, ceiling joist or plate.',
        fields: spanFields('2x4', 'roof').filter((field) => field.key !== 'size'),
        compute: (values) => computeSpan(values, '2x4')
    },
    {
        id: '2x6',
        label: '2×6 span & quantity',
        group: 'span',
        blurb: 'Span plus the number of 2×6 pieces and board feet for a run at your spacing.',
        fields: [
            ...spanFields('2x6', 'floor').filter((field) => field.key !== 'size'),
            number('length', 'Run length (ft)', 16, 'ft', { min: 1, max: 200, step: 1 })
        ],
        compute: (values) => {
            const base = computeSpan(values, '2x6');
            const runFt = Math.max(1, Number(values.length) || 16);
            const spacing = Math.max(6, Number(values.spacing) || 16);
            const count = Math.ceil((runFt * 12) / spacing) + 1;
            const boardFeet = round((2 * 6 * count * runFt) / 12, 1);
            return {
                ...base,
                rows: [
                    ...base.rows,
                    { label: 'Pieces for the run', value: `${count} × ${feetLabel(runFt)}` },
                    { label: 'Board feet', value: `${boardFeet} bf` },
                    { label: 'Cost allowance', value: `$${round(count * lumberPrice('2x6') * runFt * FT, 2)}` }
                ]
            };
        }
    },
    {
        id: 'floor-joist-span',
        label: 'Floor joist span',
        group: 'span',
        blurb: 'Habitable floor joists at 40 psf live, 10 psf dead and L/360.',
        fields: spanFields('2x10', 'floor'),
        compute: (values) => computeSpan({ ...values, load: 'floor' })
    },
    {
        id: 'ceiling-joist-span',
        label: 'Ceiling joist span',
        group: 'span',
        blurb: 'Ceiling joists at 10 psf live, 5 psf dead and L/240.',
        fields: spanFields('2x8', 'ceiling'),
        compute: (values) => computeSpan({ ...values, load: 'ceiling' })
    },
    {
        id: 'roof-span',
        label: 'Roof span',
        group: 'span',
        blurb: 'Roof joists and rafters at 20 psf live, 15 psf dead and L/180.',
        fields: spanFields('2x8', 'roof'),
        compute: (values) => computeSpan({ ...values, load: 'roof' })
    },
    {
        id: 'rafter-span',
        label: 'Rafter span',
        group: 'span',
        blurb: 'Rafter span along the slope, with the horizontal run and rise for the pitch.',
        fields: [
            ...spanFields('2x8', 'roof').filter((field) => field.key !== 'continuous'),
            number('pitch', 'Pitch (x:12)', 6, ':12', { min: 0.5, max: 16, step: 0.5 })
        ],
        compute: (values) => {
            const base = computeSpan({ ...values, load: 'roof' });
            const pitch = clamp(Number(values.pitch) || 6, 0.5, 16);
            const slope = Math.atan(pitch / 12);
            const spanFt = parseFeet(base.primary.value);
            const runFt = spanFt * Math.cos(slope);
            const riseFt = runFt * Math.tan(slope);
            return {
                ...base,
                primary: { label: `${values.size || '2x8'} maximum rafter span`, value: feetLabel(spanFt) },
                rows: [
                    ...base.rows,
                    { label: 'Horizontal run', value: feetLabel(runFt) },
                    { label: 'Rise over that run', value: feetLabel(riseFt) },
                    { label: 'Pitch', value: `${pitch}:12` }
                ],
                notes: [
                    ...base.notes,
                    'Span is measured along the rafter, not horizontally; the bird’s mouth and overhang are extra.'
                ]
            };
        }
    },
    {
        id: 'beam-span',
        label: 'Wood beam span',
        group: 'beam',
        blurb: 'Sawn beam span from a tributary width, with reactions at the maximum span.',
        fields: [
            select('size', 'Beam size', SIZES.map((size) => [size, size]), '2x10'),
            select('species', 'Species', SPECIES_OPTIONS, 'spf-2'),
            select('grade', 'Grade', GRADE_OPTIONS, '2'),
            number('tributary', 'Tributary width (ft)', 12, 'ft', { min: 1, max: 40, step: 1 }),
            select('load', 'Load case', LOAD_OPTIONS, 'floor'),
            checkbox('continuous', 'Continuous over a support')
        ],
        compute: (values) => {
            const load = LOAD_CASES[values.load] || LOAD_CASES.floor;
            const definition = sawn(values, values.size || '2x10');
            const solved = solveBeamSpan({
                material: 'sawn',
                size: values.size || '2x10',
                values,
                tributaryFt: Number(values.tributary) || 12,
                livePsf: load.live,
                deadPsf: load.dead,
                limit: load.limit,
                continuous: Boolean(values.continuous)
            });
            return beamResult(`${values.size || '2x10'} beam span`, definition, solved);
        }
    },
    {
        id: 'lvl-beam-span',
        label: 'LVL beam span',
        group: 'beam',
        blurb: 'Span for a generic LVL beam at a chosen depth and ply count.',
        fields: [
            select('depth', 'Depth (in)', LVL.depthsIn.map((value) => [String(value), `${value} in`]), '11.25'),
            select('plies', 'Plies', [['1', '1 ply'], ['2', '2 plies'], ['3', '3 plies'], ['4', '4 plies']], '2'),
            number('tributary', 'Tributary width (ft)', 12, 'ft', { min: 1, max: 40, step: 1 }),
            number('live', 'Live load (psf)', 40, 'psf', { min: 0, max: 200, step: 5 }),
            number('dead', 'Dead load (psf)', 10, 'psf', { min: 0, max: 100, step: 1 }),
            number('limit', 'Deflection limit (L/)', 360, '', { min: 120, max: 720, step: 60 }),
            checkbox('continuous', 'Continuous over a support')
        ],
        compute: (values) => {
            const plies = Number(values.plies) || 1;
            const definition = engineered('lvl', Number(values.depth) || 11.25, plies);
            const solved = solveSpan({
                ...definition,
                livePsf: Number(values.live ?? 40),
                deadPsf: Number(values.dead ?? 10),
                tributaryFt: Number(values.tributary) || 12,
                limit: Number(values.limit) || 360,
                continuous: Boolean(values.continuous),
                maxSpanFt: 40
            });
            return beamResult(`${plies} ply LVL beam span`, definition, solved);
        }
    },
    {
        id: 'lvl-beam-size',
        label: 'LVL beam size',
        group: 'beam',
        blurb: 'Smallest generic LVL depth and ply count for a required span and load.',
        fields: [
            number('span', 'Required span (ft)', 18, 'ft', { min: 2, max: 50, step: 1 }),
            number('tributary', 'Tributary width (ft)', 12, 'ft', { min: 1, max: 40, step: 1 }),
            number('live', 'Live load (psf)', 40, 'psf', { min: 0, max: 200, step: 5 }),
            number('dead', 'Dead load (psf)', 10, 'psf', { min: 0, max: 100, step: 1 }),
            number('limit', 'Deflection limit (L/)', 360, '', { min: 120, max: 720, step: 60 }),
            checkbox('continuous', 'Continuous over a support')
        ],
        compute: (values) => {
            const required = Math.max(2, Number(values.span) || 18);
            const candidates = [];
            [1, 2, 3, 4].forEach((plies) => {
                LVL.depthsIn.forEach((depth) => {
                    const definition = engineered('lvl', depth, plies);
                    const solved = solveSpan({
                        ...definition,
                        livePsf: Number(values.live ?? 40),
                        deadPsf: Number(values.dead ?? 10),
                        tributaryFt: Number(values.tributary) || 12,
                        limit: Number(values.limit) || 360,
                        continuous: Boolean(values.continuous),
                        maxSpanFt: 50
                    });
                    if (solved.spanFt >= required) candidates.push({ depth, plies, solved, definition });
                });
            });
            const chosen = candidates.sort((a, b) => a.depth - b.depth || a.plies - b.plies)[0];
            if (!chosen) {
                return result(
                    { label: 'No generic LVL section passes', value: 'engineered' },
                    [{ label: 'Required span', value: feetLabel(required) }],
                    ['Use a deeper section, add a support, or have the beam engineered.'],
                    'M = wL²/8 · Δ ≤ L/limit',
                    'Manufacturer’s LVL span table governs'
                );
            }
            return result(
                { label: 'Minimum section', value: `${chosen.plies} ply ${round(chosen.depth, 2)} in LVL` },
                [
                    { label: 'Depth', value: `${round(chosen.depth, 2)} in` },
                    { label: 'Plies', value: `${chosen.plies} × 1¾ in` },
                    { label: 'Capacity', value: feetLabel(chosen.solved.spanFt) },
                    { label: 'Governing case', value: chosen.solved.governing }
                ],
                ['Generic LVL values are used for planning. The supplier’s table, grade and holes govern.'],
                'M = wL²/8 · Δ = 5wL⁴/(384EI) ≤ L/limit',
                'Manufacturer’s LVL span table governs'
            );
        }
    },
    {
        id: 'glulam-beam-size',
        label: 'Glulam beam size',
        group: 'beam',
        blurb: 'Smallest generic glulam width and depth for a required span and load.',
        fields: [
            number('span', 'Required span (ft)', 20, 'ft', { min: 2, max: 60, step: 1 }),
            number('tributary', 'Tributary width (ft)', 12, 'ft', { min: 1, max: 40, step: 1 }),
            number('live', 'Live load (psf)', 40, 'psf', { min: 0, max: 200, step: 5 }),
            number('dead', 'Dead load (psf)', 10, 'psf', { min: 0, max: 100, step: 1 }),
            number('limit', 'Deflection limit (L/)', 360, '', { min: 120, max: 720, step: 60 }),
            checkbox('continuous', 'Continuous over a support')
        ],
        compute: (values) => {
            const required = Math.max(2, Number(values.span) || 20);
            const candidates = [];
            GLULAM.widthsIn.forEach((widthIn) => {
                GLULAM.depthsIn.forEach((depth) => {
                    const section = engineered('glulam', depth, 1);
                    const sectionPropsForWidth = {
                        b: widthIn,
                        d: depth,
                        area: widthIn * depth,
                        S: (widthIn * depth * depth) / 6,
                        I: (widthIn * depth * depth * depth) / 12
                    };
                    Object.assign(section, sectionPropsForWidth);
                    section.props = sectionPropsForWidth;
                    const solved = solveSpan({
                        ...section,
                        livePsf: Number(values.live ?? 40),
                        deadPsf: Number(values.dead ?? 10),
                        tributaryFt: Number(values.tributary) || 12,
                        limit: Number(values.limit) || 360,
                        continuous: Boolean(values.continuous),
                        maxSpanFt: 60
                    });
                    if (solved.spanFt >= required) candidates.push({ widthIn, depth, solved, section });
                });
            });
            const chosen = candidates.sort((a, b) => a.depth - b.depth || a.widthIn - b.widthIn)[0];
            if (!chosen) {
                return result(
                    { label: 'No generic glulam passes', value: 'engineered' },
                    [{ label: 'Required span', value: feetLabel(required) }],
                    ['Add a support or have the member engineered.'],
                    'M = wL²/8 · Δ ≤ L/limit',
                    'Manufacturer’s glulam design table governs'
                );
            }
            return result(
                { label: 'Minimum section', value: `${round(chosen.widthIn, 2)} × ${round(chosen.depth, 2)} in glulam` },
                [
                    { label: 'Breadth', value: `${round(chosen.widthIn, 2)} in` },
                    { label: 'Depth', value: `${round(chosen.depth, 2)} in` },
                    { label: 'Capacity', value: feetLabel(chosen.solved.spanFt) },
                    { label: 'Governing case', value: chosen.solved.governing }
                ],
                ['Generic glulam values; the manufacturer’s design table, grade and connection details govern.'],
                'M = wL²/8 · Δ = 5wL⁴/(384EI) ≤ L/limit',
                'APA/AITC glulam design table governs'
            );
        }
    },
    {
        id: '2x4-load',
        label: '2×4 load',
        group: 'load',
        blurb: 'Allowable uniform load and midspan point load for a 2×4 at a given span.',
        fields: [
            number('span', 'Span (ft)', 6, 'ft', { min: 0.5, max: 20, step: 0.5 }),
            select('species', 'Species', SPECIES_OPTIONS, 'spf-2'),
            select('grade', 'Grade', GRADE_OPTIONS, '2'),
            number('limit', 'Deflection limit (L/)', 360, '', { min: 120, max: 720, step: 60 })
        ],
        compute: (values) => {
            const definition = sawn(values, '2x4');
            const solved = solveLoad({
                ...definition,
                spanFt: Number(values.span) || 6,
                limit: Number(values.limit) || 360
            });
            return result(
                { label: 'Allowable uniform load', value: `${round(solved.wPerFt, 0)} lb/ft` },
                [
                    { label: 'Total on the member', value: `${round(solved.wTotal, 0)} lb` },
                    { label: 'Midspan point load', value: `${round(solved.pointLb, 0)} lb` },
                    { label: 'Governing case', value: solved.governing },
                    { label: 'Fb / E', value: `${Math.round(definition.Fb)} psi / ${(definition.E / 1e6).toFixed(2)} × 10⁶ psi` }
                ],
                [
                    'Loads are for a single 2×4 on edge, laterally supported and dry.',
                    'A flat-oriented 2×4 is much weaker; check the actual orientation.',
                    'Connections, bearing and notches are separate checks.'
                ],
                'w = 8FbS/L² · Δ = 5wL⁴/(384EI) ≤ L/limit',
                'AWC NDS reference values'
            );
        }
    },
    {
        id: 'framing-lumber',
        label: 'Framing lumber & cost',
        group: 'load',
        blurb: 'Board feet, piece count, waste and cost for an order of framing lumber.',
        fields: [
            select('size', 'Size', SIZES.map((size) => [size, size]), '2x6'),
            number('length', 'Length (ft)', 16, 'ft', { min: 1, max: 24, step: 1 }),
            number('qty', 'Pieces', 40, 'ea', { min: 1, max: 5000, step: 1 }),
            number('waste', 'Waste (%)', 10, '%', { min: 0, max: 40, step: 1 }),
            number('price', 'Price per piece (USD)', 0, '$', { min: 0, max: 500, step: 0.1 })
        ],
        compute: (values) => {
            const size = values.size || '2x6';
            const [nominalB, nominalD] = String(size).split('x').map(Number);
            const lengthFt = Math.max(1, Number(values.length) || 16);
            const qty = Math.max(1, Math.round(Number(values.qty) || 1));
            const waste = clamp(Number(values.waste ?? 10) / 100, 0, 0.5);
            const pieces = Math.ceil(qty * (1 + waste));
            const boardFeet = round((nominalB * nominalD * lengthFt * pieces) / 12, 1);
            const unitCost = Number(values.price) > 0
                ? Number(values.price)
                : round(lumberPrice(size) * lengthFt * FT, 2);
            return result(
                { label: 'Board feet to order', value: `${boardFeet} bf` },
                [
                    { label: 'Pieces with waste', value: `${pieces} ea` },
                    { label: 'Waste', value: `${round(waste * 100, 0)}% (${pieces - qty} extra)` },
                    { label: 'Unit price', value: `$${unitCost.toFixed(2)} each` },
                    { label: 'Material cost', value: `$${round(pieces * unitCost, 2).toFixed(2)}` },
                    { label: 'Actual size', value: `${round(LUMBER[size]?.thickness / IN, 2) || nominalB} × ${round(LUMBER[size]?.width / IN, 2) || nominalD} in` }
                ],
                [
                    'Board feet use nominal dimensions; the actual dressed size is smaller.',
                    'Prices are planning allowances, not a supplier quote.'
                ],
                'bf = nominal b × d × length (ft) × pieces ÷ 12',
                'Lumber ordering practice'
            );
        }
    },
    {
        id: 'ceiling-joist',
        label: 'Ceiling joist count',
        group: 'load',
        blurb: 'Number of ceiling joists across a room, plus the span check for the chosen size.',
        fields: [
            number('room', 'Room length (ft)', 24, 'ft', { min: 1, max: 200, step: 1 }),
            select('spacing', 'On center', SPACINGS.map((value) => [String(value), `${value} in`]), '16'),
            select('size', 'Size', SIZES.map((size) => [size, size]), '2x8'),
            select('species', 'Species', SPECIES_OPTIONS, 'spf-2'),
            select('grade', 'Grade', GRADE_OPTIONS, '2'),
            number('span', 'Clear span (ft)', 12, 'ft', { min: 1, max: 40, step: 1 })
        ],
        compute: (values) => {
            const roomFt = Math.max(1, Number(values.room) || 24);
            const spacing = Math.max(6, Number(values.spacing) || 16);
            const count = Math.floor((roomFt * 12) / spacing) + 1;
            const definition = sawn(values, values.size || '2x8');
            const solved = solveSpan({
                ...definition,
                livePsf: LOAD_CASES.ceiling.live,
                deadPsf: LOAD_CASES.ceiling.dead,
                tributaryFt: spacing / 12,
                limit: LOAD_CASES.ceiling.limit
            });
            const spanFt = Number(values.span) || 12;
            return result(
                { label: 'Ceiling joists', value: `${count} pieces` },
                [
                    { label: 'Maximum span', value: feetLabel(solved.spanFt) },
                    { label: 'Clear span entered', value: feetLabel(spanFt) },
                    { label: 'Span check', value: spanFt <= solved.spanFt ? 'passes' : 'over the limit' },
                    { label: 'Board feet', value: `${round((2 * Number(String(values.size).split('x')[1]) * count * roomFt) / 12, 1)} bf` }
                ],
                [
                    spanFt <= solved.spanFt ? 'The chosen joist carries the entered span.' : 'Go up a size, reduce the spacing or add a support.',
                    'Ceiling joists are not floor joists: do not store heavy goods on them.'
                ],
                'N = floor(room × 12 ÷ spacing) + 1',
                'IRC §R802.4 · Table R802.4(1)'
            );
        }
    },
    {
        id: 'floor-truss',
        label: 'Floor truss planning',
        group: 'load',
        blurb: 'Planning depth, maximum moment and chord force for a parallel-chord floor truss.',
        fields: [
            number('span', 'Span (ft)', 20, 'ft', { min: 4, max: 60, step: 1 }),
            select('spacing', 'On center', SPACINGS.map((value) => [String(value), `${value} in`]), '16'),
            number('live', 'Live load (psf)', 40, 'psf', { min: 0, max: 100, step: 5 }),
            number('dead', 'Dead load (psf)', 15, 'psf', { min: 0, max: 50, step: 1 }),
            number('depth', 'Truss depth (in, 0 = auto)', 0, 'in', { min: 0, max: 40, step: 1 })
        ],
        compute: (values) => {
            const spanFt = Math.max(4, Number(values.span) || 20);
            const spacingFt = Math.max(6, Number(values.spacing) || 16) / 12;
            const live = Math.max(0, Number(values.live) || 40);
            const dead = Math.max(0, Number(values.dead) || 15);
            const wTotal = (live + dead) * spacingFt;
            const depthIn = Number(values.depth) > 0
                ? Number(values.depth)
                : clamp(Math.round((spanFt * 12) / 16), 12, 24);
            const momentLbFt = (wTotal * spanFt * spanFt) / 8;
            const chordLb = (momentLbFt * 12) / depthIn;
            return result(
                { label: 'Planning truss depth', value: `${depthIn} in` },
                [
                    { label: 'Total load', value: `${round(wTotal, 1)} lb/ft` },
                    { label: 'Maximum moment', value: `${round(momentLbFt, 0)} lb·ft` },
                    { label: 'Chord force', value: `${round(chordLb, 0)} lb` },
                    { label: 'Reaction', value: `${round((wTotal * spanFt) / 2, 0)} lb` },
                    { label: 'Design live deflection target', value: 'L/360' }
                ],
                [
                    'Planning estimate only: a floor truss is an engineered product and must be designed and sealed by the truss manufacturer.',
                    'The depth rule is about span/16 in inches, clamped to 12–24 in; the truss designer may use more or less.',
                    'Chords, webs, plates and connections are not sized here.'
                ],
                'M = wL²/8 · chord force = M ÷ depth',
                'IRC §R502.11 · truss design drawings govern'
            );
        }
    }
];

export const CALCULATOR_BY_ID = Object.fromEntries(CALCULATORS.map((entry) => [entry.id, entry]));

/** Parse a feet-and-inches label back to feet, for chained calculations. */
function parseFeet(label) {
    const match = String(label).match(/^(?:(\d+)')?-?(\d+(?:\s+\d+\/\d+)?)?"$/);
    if (!match) return 0;
    const [wholeInches, fraction = ''] = String(match[2] || '0').split(/\s+/);
    const [numerator, denominator] = fraction.split('/').map(Number);
    const fractional = denominator ? numerator / denominator : 0;
    const totalInches = Number(match[1] || 0) * 12 + Number(wholeInches || 0) + fractional;
    return totalInches / 12;
}

/** Default field values for a calculator. */
export function defaultValues(id) {
    const definition = CALCULATOR_BY_ID[id];
    if (!definition) return {};
    return definition.fields.reduce((values, field) => {
        values[field.key] = field.default;
        return values;
    }, {});
}

/** Run one calculator, returning a display-ready result. */
export function computeCalculator(id, values = {}) {
    const definition = CALCULATOR_BY_ID[id];
    if (!definition) return null;
    const merged = { ...defaultValues(id), ...values };
    try {
        return { id, label: definition.label, ...definition.compute(merged), values: merged };
    } catch (error) {
        return {
            id,
            label: definition.label,
            primary: { label: 'Calculation error', value: '—' },
            rows: [{ label: 'Input', value: error.message }],
            notes: ['Check the entered values.'],
            formula: '',
            code: definition.code || ''
        };
    }
}

export function searchCalculators(query = '') {
    const term = String(query || '').toLowerCase().trim();
    if (!term) return CALCULATORS;
    return CALCULATORS.filter((entry) => [entry.label, entry.blurb, entry.id].join(' ').toLowerCase().includes(term));
}

export function calculatorsByGroup() {
    return CALCULATOR_GROUPS.map((group) => ({
        ...group,
        calculators: CALCULATORS.filter((entry) => entry.group === group.id)
    }));
}


