import { LUMBER } from '../lumber.js';

/**
 * Deck products, lumber values and allowance prices.
 *
 * The dressed section sizes come from the stair suite's part library (a 2x10 is
 * 1½ × 9¼ in wherever it is used), so the deck framing and the stair framing
 * can never disagree about what a 2x10 is. Species values are NDS reference
 * design values (Fb, Ft, Fv, Fc, Fc⊥, E) for visually graded, dry, normal
 * temperature lumber; the engine applies the code load duration factor and the
 * stud/column formulae from there.
 */

export const IN = 0.0254;
export const FT = 12 * IN;

/** Deck framing is designed for 40 psf live and 10 psf dead (IRC Table R301.5). */
export const DECK_LOADS = {
    livePsf: 40,
    deadPsf: 10,
    totalPsf: 50,
    /** Guard systems are designed for a 200 lb concentrated load (IRC R312.1.2). */
    guardLoadLb: 200
};

/**
 * NDS Supplement reference design values in psi. `incising` marks the
 * pressure-treated species that lose capacity when incised for treatment;
 * the engine applies the 0.80 Fb / 0.90 E incising factor to those sizes.
 */
export const SPECIES = [
    {
        id: 'spf-2',
        label: 'Spruce-Pine-Fir #2',
        grade: '#2',
        Fb: 875, Ft: 450, Fv: 135, Fc: 1150, FcPerp: 425, E: 1.4e6,
        incising: false,
        note: 'The common North American deck lumber; the span tables’ baseline.'
    },
    {
        id: 'syp-2',
        label: 'Southern Pine #2',
        grade: '#2',
        Fb: 1200, Ft: 675, Fv: 175, Fc: 1575, FcPerp: 565, E: 1.6e6,
        incising: true,
        note: 'Strongest of the common treated framing species; often incised for ground contact.'
    },
    {
        id: 'dfl-2',
        label: 'Douglas Fir-Larch #2',
        grade: '#2',
        Fb: 900, Ft: 575, Fv: 180, Fc: 1700, FcPerp: 625, E: 1.7e6,
        incising: false,
        note: 'Stiffer than SPF: usually the longest joist spans per size.'
    },
    {
        id: 'hf-2',
        label: 'Hem-Fir #2',
        grade: '#2',
        Fb: 850, Ft: 500, Fv: 150, Fc: 1300, FcPerp: 405, E: 1.3e6,
        incising: true,
        note: 'Common in the west; treated Hem-Fir is frequently incised.'
    },
    {
        id: 'wrc-2',
        label: 'Western Red Cedar #2',
        grade: '#2',
        Fb: 750, Ft: 400, Fv: 95, Fc: 850, FcPerp: 325, E: 1.1e6,
        incising: false,
        note: 'Naturally durable; use for rails and trim rather than long spans.'
    },
    {
        id: 'composite',
        label: 'Composite lumber',
        grade: 'Manufacturer',
        Fb: 1400, Ft: 700, Fv: 200, Fc: 1500, FcPerp: 600, E: 1.6e6,
        incising: false,
        note: 'Generic composite: always design to the manufacturer’s span table, not to these values.'
    }
];

export const JOIST_SIZES = ['2x6', '2x8', '2x10', '2x12'];
export const BEAM_SIZES = ['2x8', '2x10', '2x12'];
export const POST_SIZES = ['4x4', '6x6'];
export const JOIST_SPACINGS_IN = [12, 16, 24];
export const BEAM_PLIES = [2, 3];

/** Allowance prices in USD, per metre of dressed lumber. */
export const LUMBER_PRICES = {
    '2x6': 4.6,
    '2x8': 6.4,
    '2x10': 9.2,
    '2x12': 12.8,
    '4x4': 7.4,
    '6x6': 17.5,
    '2x4': 3.2,
    '5/4x6': 6.1,
    '1x6': 5.4
};

/** Section properties in inches, from the shared dressed sizes. */
export function sectionProps(size) {
    const dressed = LUMBER[size];
    if (!dressed) return null;
    const b = dressed.thickness / IN;
    const d = dressed.width / IN;
    return {
        size,
        b,
        d,
        area: b * d,
        S: (b * d * d) / 6,
        I: (b * d * d * d) / 12
    };
}

export function lumberPrice(size) {
    return LUMBER_PRICES[size] ?? 8;
}

/**
 * Decking products. `maxJoistIn` is the maximum joist spacing for the board at
 * 40 psf live load, perpendicular to the joists; boards laid diagonally need
 * one size closer. `coverageM` is the exposed face width in metres after the
 * manufacturer’s gap.
 */
export const DECKING = [
    {
        id: 'pt-5/4x6',
        label: 'Pressure-treated 5/4×6',
        family: 'wood',
        boardWidthIn: 5.5,
        thicknessIn: 1.0,
        maxJoistIn: 16,
        gapIn: 0.1875,
        coverageM: 0.135,
        costPerSqm: 26,
        fastener: 'Stainless or coated deck screws, 2 per joist',
        note: 'The default value decking; needs annual sealing or a penetrating stain.'
    },
    {
        id: 'cedar-5/4x6',
        label: 'Western red cedar 5/4×6',
        family: 'wood',
        boardWidthIn: 5.5,
        thicknessIn: 1.0,
        maxJoistIn: 16,
        gapIn: 0.1875,
        coverageM: 0.135,
        costPerSqm: 42,
        fastener: 'Stainless deck screws, 2 per joist',
        note: 'Naturally durable and stable; softer underfoot than treated pine.'
    },
    {
        id: 'ipe-1x6',
        label: 'Ipe / hardwood 1×6',
        family: 'hardwood',
        boardWidthIn: 5.5,
        thicknessIn: 0.75,
        maxJoistIn: 16,
        gapIn: 0.25,
        coverageM: 0.133,
        costPerSqm: 118,
        fastener: 'Hidden clip system or stainless screws',
        note: 'Very dense: pre-drill every hole and use stainless fasteners only.'
    },
    {
        id: 'composite-grooved',
        label: 'Composite, grooved edge',
        family: 'composite',
        boardWidthIn: 5.5,
        thicknessIn: 1.0,
        maxJoistIn: 16,
        gapIn: 0.1875,
        coverageM: 0.136,
        costPerSqm: 82,
        fastener: 'Hidden clip, 1 clip per joist per board edge',
        note: 'Needs 1/8 in end gaps and a clip at every joist; span to the maker’s table.'
    },
    {
        id: 'pvc-1x6',
        label: 'PVC 1×6',
        family: 'pvc',
        boardWidthIn: 5.5,
        thicknessIn: 1.0,
        maxJoistIn: 16,
        gapIn: 0.1875,
        coverageM: 0.136,
        costPerSqm: 112,
        fastener: 'Stainless screws through a clearance hole',
        note: 'Expands more than wood: leave 3/16 in end gaps and never butt tight.'
    },
    {
        id: 'aluminium-2x6',
        label: 'Aluminium plank 2×6',
        family: 'metal',
        boardWidthIn: 5.5,
        thicknessIn: 1.5,
        maxJoistIn: 24,
        gapIn: 0.125,
        coverageM: 0.137,
        costPerSqm: 148,
        fastener: 'Stainless clip or screw per the system',
        note: 'Hot underfoot in full sun; the widest joist spacing of the set.'
    }
];

export const BOARD_PATTERNS = [
    { id: 'perpendicular', label: 'Perpendicular to joists', waste: 0.08, diagonal: false },
    { id: 'parallel', label: 'Parallel to joists (needs blocking)', waste: 0.10, diagonal: false },
    { id: 'diagonal', label: 'Diagonal 45°', waste: 0.16, diagonal: true }
];

/** Guard systems: post spacing, infill and allowance cost per metre. */
export const RAILING_SYSTEMS = [
    {
        id: 'wood',
        label: 'Wood posts and balusters',
        postSpacingM: 1.8,
        infill: 'Balusters at 4 in on center',
        openingIn: 4,
        costPerM: 96,
        note: 'The cheapest guard; check every baluster is within the 4 in sphere.'
    },
    {
        id: 'composite',
        label: 'Composite rail kit',
        postSpacingM: 1.8,
        infill: 'Composite balusters or panels',
        openingIn: 4,
        costPerM: 168,
        note: 'Match the post sleeve to the decking line so the rail does not read as an add-on.'
    },
    {
        id: 'cable',
        label: 'Stainless cable rail',
        postSpacingM: 1.5,
        infill: 'Horizontal 1/8 in cable at 3 in on center',
        openingIn: 3,
        costPerM: 214,
        note: 'Cable must not pass a 4 in sphere; tighter posts carry the tension.'
    },
    {
        id: 'glass',
        label: 'Frameless glass panels',
        postSpacingM: 1.2,
        infill: 'Tempered laminated glass panels',
        openingIn: 4,
        costPerM: 326,
        note: 'Use laminated tempered glass and a shoe or standoff system rated for the guard load.'
    },
    {
        id: 'aluminium',
        label: 'Aluminium picket rail',
        postSpacingM: 1.8,
        infill: 'Aluminium pickets at 4 in on center',
        openingIn: 4,
        costPerM: 186,
        note: 'Powder-coated systems are the usual choice for a low-maintenance deck.'
    }
];

/** Hardware, flashing and concrete allowances. */
export const HARDWARE = {
    hanger: { id: 'hanger', label: 'Joist hanger', unit: 'each', cost: 3.4 },
    hangerScrew: { id: 'hanger-screw', label: 'Hanger screws (box)', unit: 'box', cost: 18 },
    postBase: { id: 'post-base', label: 'Post base, elevated', unit: 'each', cost: 14 },
    postCap: { id: 'post-cap', label: 'Post cap', unit: 'each', cost: 4.5 },
    tensionTie: { id: 'tension-tie', label: 'Lateral tension tie', unit: 'each', cost: 21 },
    ledgerFlashing: { id: 'ledger-flashing', label: 'Ledger flashing (roll)', unit: 'roll', cost: 46 },
    joistTape: { id: 'joist-tape', label: 'Joist tape (roll)', unit: 'roll', cost: 24 },
    ledgerLag: { id: 'ledger-lag', label: '1/2 in ledger lag screw', unit: 'each', cost: 1.15 },
    ledgerBolt: { id: 'ledger-bolt', label: '1/2 in through-bolt and washer', unit: 'each', cost: 2.1 },
    structuralScrew: { id: 'structural-screw', label: 'Structural screw (box)', unit: 'box', cost: 52 },
    deckScrew: { id: 'deck-screw', label: 'Deck screws, 5 lb box', unit: 'box', cost: 44 },
    clip: { id: 'clip', label: 'Hidden deck clip (bucket)', unit: 'bucket', cost: 68 },
    concrete: { id: 'concrete', label: 'Concrete mix, 80 lb bag', unit: 'bag', cost: 7.8 }
};

/** One 80 lb bag yields about 0.6 cu ft of mixed concrete. */
export const CONCRETE_BAG_M3 = 0.6 * FT ** 3;

export const SOIL_BEARING_PSF = [
    { id: 'sand', label: 'Sand / gravel (3,000 psf)', psf: 3000 },
    { id: 'assumed', label: 'Assumed default (2,000 psf)', psf: 2000 },
    { id: 'clay', label: 'Clay / silt (1,500 psf)', psf: 1500 }
];

export const FROST_DEPTH_IN = [
    { id: 'none', label: 'No frost (0 in)', inches: 0 },
    { id: 'shallow', label: 'Shallow frost (12 in)', inches: 12 },
    { id: 'moderate', label: 'Moderate frost (24 in)', inches: 24 },
    { id: 'deep', label: 'Deep frost (36 in)', inches: 36 },
    { id: 'severe', label: 'Severe frost (48 in)', inches: 48 }
];

export const DECK_SHAPES = ['rectangle', 'l-shape', 'octagon'];
export const DECK_SHAPE_LABELS = {
    rectangle: 'Rectangle',
    'l-shape': 'L-shape',
    octagon: 'Octagon'
};

export const COVER_TYPES = [
    { id: 'none', label: 'Open to the sky' },
    { id: 'pergola', label: 'Pergola over part of the deck' },
    { id: 'roof', label: 'Solid roof (roof suite trusses)' }
];

export function speciesById(id) {
    return SPECIES.find((entry) => entry.id === id) || SPECIES[0];
}

export function deckingById(id) {
    return DECKING.find((entry) => entry.id === id) || DECKING[0];
}

export function railingById(id) {
    return RAILING_SYSTEMS.find((entry) => entry.id === id) || RAILING_SYSTEMS[0];
}

export function soilById(id) {
    return SOIL_BEARING_PSF.find((entry) => entry.id === id) || SOIL_BEARING_PSF[1];
}

export function frostById(id) {
    return FROST_DEPTH_IN.find((entry) => entry.id === id) || FROST_DEPTH_IN[2];
}

export function boardPatternById(id) {
    return BOARD_PATTERNS.find((entry) => entry.id === id) || BOARD_PATTERNS[0];
}
