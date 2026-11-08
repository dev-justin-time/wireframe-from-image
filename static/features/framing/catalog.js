import { IN, FT, LUMBER } from '../lumber.js';
import { SPECIES, sectionProps, speciesById, lumberPrice } from '../deck/materials.js';

/**
 * Framing catalogue.
 *
 * Member sizes are dressed dimensions from the shared lumber table, so a
 * 2x4 is 1½ x 3½ in here and in the stair and deck suites. Geometry in the
 * engine is always metric (metres), while member sizes and spacing stay
 * imperial because that is how framing is ordered, cut and inspected.
 *
 * Prices are planning allowances in USD, not supplier quotes. They follow the
 * same per-linear-metre basis as the deck suite so a board costs the same in
 * every takeoff.
 */

export { SPECIES, sectionProps, speciesById, lumberPrice };

export const STUD_SIZES = ['2x4', '2x6'];
export const STUD_SPACINGS_IN = [12, 16, 24];
export const PLATE_SIZES = ['2x4', '2x6'];
export const HEADER_SIZES = ['2x6', '2x8', '2x10', '2x12'];
export const HEADER_PLIES = [2, 3];
export const JOIST_SIZES = ['2x8', '2x10', '2x12'];
export const BOARD_STOCK_FT = [8, 10, 12, 14, 16];

/**
 * Precut studs. A 92½ in stud with a single bottom plate and a double top
 * plate makes a 97 in (8 ft 1 in) wall; that is the wall height the suite
 * frames, and the wall the editor overlay draws.
 */
export const PRECUT_STUDS = [
    { id: '92.5', lengthIn: 92.5, wallIn: 97, label: '92½ in · 8 ft wall (97 in)' },
    { id: '92.625', lengthIn: 92.625, wallIn: 97.125, label: '92⅝ in · 8 ft wall (8 ft 1⅛ in)' },
    { id: '104.625', lengthIn: 104.625, wallIn: 109.125, label: '104⅝ in · 9 ft wall (9 ft 1⅛ in)' },
    { id: '116.625', lengthIn: 116.625, wallIn: 121.125, label: '116⅝ in · 10 ft wall (10 ft 1⅛ in)' }
];

/**
 * IRC Table R602.3(5) summary: the greatest stud height allowed for a size and
 * spacing, in feet. `roof` is a wall carrying a roof and ceiling only; `floor`
 * is a wall carrying one floor plus the roof and ceiling above. The table is
 * conservative for the suite because it ignores the extra capacity of a
 * continuously sheathed wall. Above 10 ft the code path is an engineered
 * design, which the suite reports rather than guessing.
 */
export const STUD_LIMITS_FT = {
    '2x4': {
        12: { roof: 10, floor: 10 },
        16: { roof: 10, floor: 9 },
        24: { roof: 9, floor: 8 }
    },
    '2x6': {
        12: { roof: 10, floor: 10 },
        16: { roof: 10, floor: 10 },
        24: { roof: 10, floor: 10 }
    }
};

export const MAX_STUD_HEIGHT_FT = 12;

/** Structural sheathing products. A 4 x 8 ft sheet is 1.2192 x 2.4384 m. */
export const SHEATHING = [
    {
        id: 'osb-7/16',
        label: '7/16 in OSB wall sheathing',
        thicknessIn: 0.4375,
        sheet: '4 x 8 ft',
        sheetM2: 1.2192 * 2.4384,
        cost: 21,
        nailsPerSheet: 56,
        nail: '8d common, 6 in edge / 12 in field',
        note: 'Rated sheathing for braced wall panels; foil or zip facings change the WRB detail.'
    },
    {
        id: 'ply-15/32',
        label: '15/32 in plywood sheathing',
        thicknessIn: 0.469,
        sheet: '4 x 8 ft',
        sheetM2: 1.2192 * 2.4384,
        cost: 29,
        nailsPerSheet: 56,
        nail: '8d common, 6 in edge / 12 in field',
        note: 'Structural plywood; the strongest common braced-wall panel.'
    },
    {
        id: 'osb-5/8',
        label: '5/8 in OSB sheathing',
        thicknessIn: 0.625,
        sheet: '4 x 8 ft',
        sheetM2: 1.2192 * 2.4384,
        cost: 26,
        nailsPerSheet: 56,
        nail: '8d common, 6 in edge / 12 in field',
        note: 'Heavier panel for high wind or a stiffer wall.'
    },
    {
        id: 'gypsum-1/2',
        label: '1/2 in gypsum sheathing',
        thicknessIn: 0.5,
        sheet: '4 x 8 ft',
        sheetM2: 1.2192 * 2.4384,
        cost: 18,
        nailsPerSheet: 48,
        nail: '1-1/4 in screws, 8 in field',
        note: 'Non-structural; needs a braced-wall method that does not rely on the panel.'
    }
];

export const SUBFLOOR = [
    {
        id: 'osb-3/4-tg',
        label: '3/4 in OSB tongue-and-groove subfloor',
        thicknessIn: 0.75,
        sheet: '4 x 8 ft',
        sheetM2: 1.2192 * 2.4384,
        cost: 38,
        screwsPerSheet: 48,
        note: 'Glue and screw; leave a 1/8 in gap at panel edges.'
    },
    {
        id: 'ply-3/4-tg',
        label: '3/4 in plywood tongue-and-groove subfloor',
        thicknessIn: 0.75,
        sheet: '4 x 8 ft',
        sheetM2: 1.2192 * 2.4384,
        cost: 46,
        screwsPerSheet: 48,
        note: 'Stiffer under tile; still glue the joists and stagger the joints.'
    },
    {
        id: 'osb-5/8',
        label: '5/8 in OSB subfloor',
        thicknessIn: 0.625,
        sheet: '4 x 8 ft',
        sheetM2: 1.2192 * 2.4384,
        cost: 31,
        screwsPerSheet: 42,
        note: 'Acceptable at 16 in joist spacing for carpet and resilient floors.'
    }
];

export const SHEATHING_BY_ID = Object.fromEntries(SHEATHING.map((entry) => [entry.id, entry]));
export const SUBFLOOR_BY_ID = Object.fromEntries(SUBFLOOR.map((entry) => [entry.id, entry]));

/** Nails and screws, priced by the box. */
export const FASTENERS = {
    '16d-common': { id: '16d-common', label: '16d common nail (3½ in)', unit: 'lb', cost: 2.4, perLb: 49, use: 'Stud to plate, header to jack, joist to rim' },
    '10d-common': { id: '10d-common', label: '10d common nail (3 in)', unit: 'lb', cost: 2.4, perLb: 70, use: 'Blocking, sill and cripple nailing' },
    '8d-common': { id: '8d-common', label: '8d common nail (2½ in)', unit: 'lb', cost: 2.4, perLb: 90, use: 'Sheathing, 6 in edge / 12 in field' },
    '8d-box': { id: '8d-box', label: '8d box nail (2⅜ in)', unit: 'lb', cost: 2.3, perLb: 100, use: 'Non-structural blocking and trim backing' },
    'screw-subfloor': { id: 'screw-subfloor', label: '1⅝ in subfloor screw', unit: 'box', cost: 34, perBox: 1000, use: 'Subfloor to joist, 12 in field / 6 in edge' },
    'screw-structural': { id: 'screw-structural', label: 'Structural framing screw (box)', unit: 'box', cost: 58, perBox: 250, use: 'Where a nailed connection is replaced by a screw' }
};

/** Post bases, hold-downs and the rest of the load path. */
export const CONNECTORS = {
    anchorBolt: { id: 'anchor-bolt', label: '½ in × 10 in anchor bolt and washer', unit: 'ea', cost: 2.9, use: 'Sill plate to foundation, 7 in embed' },
    holdDown: { id: 'hold-down', label: 'Hold-down, 4,000 lb', unit: 'ea', cost: 26, use: 'Wall end to floor or foundation, each braced wall line' },
    joistHanger: { id: 'joist-hanger', label: 'Joist hanger (2x8-2x12)', unit: 'ea', cost: 3.4, use: 'Joist to header or rim where bearing is not possible' },
    hurricaneTie: { id: 'hurricane-tie', label: 'Rafter/truss tie', unit: 'ea', cost: 1.9, use: 'Top plate to roof member, every other truss' },
    sillSeal: { id: 'sill-seal', label: 'Sill seal foam gasket (50 ft roll)', unit: 'roll', cost: 14, use: 'Between foundation and treated sill plate' },
    houseWrap: { id: 'house-wrap', label: 'House wrap (3 ft × 100 ft roll)', unit: 'roll', cost: 118, use: 'Over exterior sheathing, lapped 6 in horizontally' },
    seamTape: { id: 'seam-tape', label: 'House wrap seam tape (roll)', unit: 'roll', cost: 22, use: 'Every lap and penetration' },
    adhesive: { id: 'adhesive', label: 'Subfloor adhesive (28 oz tube)', unit: 'tube', cost: 9, use: 'One tube per 32 ft of joist' },
    framingNail: { id: 'framing-nail', label: 'Framing nailer coil (3¼ in, 3,600 ct)', unit: 'box', cost: 82, use: 'Production nailing of studs, plates and headers' }
};

export const CONNECTOR_COUNT = Object.keys(CONNECTORS).length;

export const FRAMING_DEFAULTS = {
    species: 'spf-2',
    studSize: '2x4',
    studSpacingIn: 16,
    studLengthIn: 92.5,
    topPlates: 2,
    bottomTreated: true,
    exteriorSheathing: true,
    interiorSheathing: false,
    sheathing: 'osb-7/16',
    subfloor: 'osb-3/4-tg',
    houseWrap: true,
    anchorBolts: true,
    anchorSpacingFt: 6,
    holdDowns: true,
    blockingRows: 1,
    fireBlocking: true,
    balloon: false,
    floorJoistSpacingIn: 16,
    floorJoistSize: 'auto',
    floorSpanFt: 12,
    snowLoadPsf: 30,
    waste: 0.08,
    labourRate: 68,
    storeys: [
        {
            id: 'storey-1',
            name: 'Ground floor',
            walls: [],
            floor: false
        }
    ]
};

/** Height of the framed wall in metres, from the stud plus its plates. */
export function wallHeightM(studLengthIn = FRAMING_DEFAULTS.studLengthIn, topPlates = 2) {
    return (Number(studLengthIn) + 1.5 * (1 + Number(topPlates))) * IN;
}

export function studDepthM(size = '2x4') {
    return (LUMBER[size]?.width ?? LUMBER['2x4'].width);
}

export function studThicknessM(size = '2x4') {
    return (LUMBER[size]?.thickness ?? LUMBER['2x4'].thickness);
}

/** Cost of one piece of lumber of `size` cut to `lengthM`, in USD. */
export function pieceCost(size, lengthM) {
    return round2(lumberPrice(size) * Math.max(Number(lengthM) || 0, 0));
}

/** Board feet for a member: nominal thickness x width x length in feet. */
export function boardFeet(size, lengthM, qty = 1) {
    const nominal = String(size).split('x').map(Number);
    if (nominal.length !== 2 || nominal.some((value) => !Number.isFinite(value))) return 0;
    const feet = (Number(lengthM) || 0) / FT;
    return round2((nominal[0] * nominal[1] * feet * Math.max(Number(qty) || 0, 0)) / 12);
}

export function sheathingById(id) {
    return SHEATHING_BY_ID[id] || SHEATHING[0];
}

export function subfloorById(id) {
    return SUBFLOOR_BY_ID[id] || SUBFLOOR[0];
}

export function precutById(id) {
    return PRECUT_STUDS.find((entry) => entry.id === String(id)) || PRECUT_STUDS[0];
}

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}
