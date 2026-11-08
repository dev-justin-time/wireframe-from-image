/**
 * Wall coverings - the paint, plaster, wallpaper, panel, tile, siding, stucco
 * and masonry catalogue behind the wall suite.
 *
 * Every covering carries the surfaces it is allowed on, its coverage and pack
 * size, the coats it needs, installed cost, fire class, vapour class and the
 * weather limits the checks enforce. Paint also carries a sheen and a colour
 * palette, so the same data drives the 3D preview, the editor's finishes panel
 * and the takeoff.
 */

export const LITRE_PER_GALLON = 3.78541;
export const SHEET_M2 = 1.22 * 2.44;
export const SQUARE_M2 = 9.2903;
export const MIL_M2_PER_LITRE = 24.58; // 1 wet mil over 1 m² is 0.0254 L

const can = (item, coveragePerLitre, costPerCan, group, extra = {}) => ({
    item,
    unit: 'can',
    packLabel: '3.78 L can',
    coveragePerPack: coveragePerLitre * LITRE_PER_GALLON,
    costPerPack: costPerCan,
    group,
    ...extra
});

const pack = (item, unit, coveragePerPack, costPerPack, group, extra = {}) => ({
    item,
    unit,
    packLabel: unit,
    coveragePerPack,
    costPerPack,
    group,
    ...extra
});

/**
 * Sheens. Gloss units are measured at 60°, scrub cycles follow ASTM D2486;
 * `wetArea` says whether the finish is allowed in a bathroom or kitchen.
 */
export const PAINT_SHEENS = [
    { id: 'dead-flat', label: 'Dead flat', glossUnits: '1–3', scrubCycles: 50, wetArea: false, bestFor: 'Ceilings and low-traffic bedrooms', note: 'Hides trowel marks and ceiling framing; marks easily and is not washable.' },
    { id: 'matte', label: 'Matte', glossUnits: '2–5', scrubCycles: 200, wetArea: false, bestFor: 'Living and dining rooms', note: 'Soft, deep colour with little sheen; keep it out of splash zones.' },
    { id: 'eggshell', label: 'Eggshell', glossUnits: '5–10', scrubCycles: 500, wetArea: true, bestFor: 'Hallways, bedrooms and most rooms', note: 'The everyday choice: a slight sheen that wipes clean without looking glossy.' },
    { id: 'satin', label: 'Satin', glossUnits: '10–25', scrubCycles: 1000, wetArea: true, bestFor: 'Kitchens, bathrooms and children’s rooms', note: 'Moisture-resistant and scrubbable; shows surface defects more than matte.' },
    { id: 'semi-gloss', label: 'Semi-gloss', glossUnits: '25–40', scrubCycles: 2000, wetArea: true, bestFor: 'Trim, doors, cabinets and wet rooms', note: 'Hard, washable film; the standard for trim and joinery.' },
    { id: 'gloss', label: 'Gloss', glossUnits: '40–60', scrubCycles: 3000, wetArea: true, bestFor: 'Trim, doors and high-traffic joinery', note: 'Maximum washability and light reflection; amplifies every dent.' },
    { id: 'exterior-satin', label: 'Exterior satin', glossUnits: '20–35', scrubCycles: 1500, wetArea: true, bestFor: 'Siding, soffits and exterior trim', note: 'Flexible acrylic film that sheds water and resists dirt pickup.' },
    { id: 'exterior-gloss', label: 'Exterior gloss', glossUnits: '40–60', scrubCycles: 2000, wetArea: true, bestFor: 'Exterior doors, shutters and trim', note: 'Tough and easy to clean; surface preparation decides how long it lasts.' },
    { id: 'masonry-flat', label: 'Masonry flat', glossUnits: '2–5', scrubCycles: 300, wetArea: true, bestFor: 'Stucco, brick, block and concrete', note: 'Breathable flat finish that lets masonry dry to the outside.' }
];

export const PAINT_COLOURS = [
    { id: 'chalk-white', label: 'Chalk white', hex: '#F7F5EF', family: 'white', undertone: 'warm' },
    { id: 'cotton-white', label: 'Cotton white', hex: '#F3EFE7', family: 'white', undertone: 'warm' },
    { id: 'warm-white', label: 'Warm white', hex: '#EFE9DD', family: 'white', undertone: 'warm' },
    { id: 'bone', label: 'Bone', hex: '#E6DFD2', family: 'neutral', undertone: 'warm' },
    { id: 'greige', label: 'Greige', hex: '#D6CFC2', family: 'neutral', undertone: 'neutral' },
    { id: 'mushroom', label: 'Mushroom', hex: '#BEB2A3', family: 'neutral', undertone: 'warm' },
    { id: 'putty', label: 'Putty', hex: '#D8CBB6', family: 'neutral', undertone: 'warm' },
    { id: 'sand', label: 'Sand', hex: '#D3BFA0', family: 'warm', undertone: 'yellow' },
    { id: 'clay', label: 'Clay', hex: '#BE8F72', family: 'warm', undertone: 'orange' },
    { id: 'terracotta', label: 'Terracotta', hex: '#B25E45', family: 'warm', undertone: 'red' },
    { id: 'ochre', label: 'Ochre', hex: '#C79A44', family: 'warm', undertone: 'yellow' },
    { id: 'sage', label: 'Sage', hex: '#A9B6A2', family: 'green', undertone: 'grey-green' },
    { id: 'olive', label: 'Olive', hex: '#7C8467', family: 'green', undertone: 'yellow-green' },
    { id: 'forest', label: 'Forest', hex: '#33503F', family: 'green', undertone: 'blue-green' },
    { id: 'teal', label: 'Teal', hex: '#2F6A66', family: 'green', undertone: 'blue-green' },
    { id: 'powder-blue', label: 'Powder blue', hex: '#C4D5DD', family: 'blue', undertone: 'cool' },
    { id: 'sky', label: 'Sky', hex: '#9BBBCB', family: 'blue', undertone: 'cool' },
    { id: 'denim', label: 'Denim', hex: '#4D6C86', family: 'blue', undertone: 'grey-blue' },
    { id: 'navy', label: 'Navy', hex: '#2C3A52', family: 'blue', undertone: 'cool' },
    { id: 'slate', label: 'Slate', hex: '#55606A', family: 'neutral', undertone: 'cool' },
    { id: 'charcoal', label: 'Charcoal', hex: '#34383B', family: 'dark', undertone: 'neutral' },
    { id: 'espresso', label: 'Espresso', hex: '#3A2E28', family: 'dark', undertone: 'warm' },
    { id: 'blush', label: 'Blush', hex: '#E3C2BB', family: 'red', undertone: 'pink' },
    { id: 'plum', label: 'Plum', hex: '#5B4451', family: 'red', undertone: 'violet' },
    { id: 'brick', label: 'Brick', hex: '#8A4636', family: 'red', undertone: 'orange' },
    { id: 'black', label: 'Black', hex: '#1E1E1E', family: 'dark', undertone: 'neutral' }
];

export const HARMONIES = [
    { id: 'monochrome', label: 'Monochrome', note: 'One colour family, separated by light and dark.' },
    { id: 'analogous', label: 'Analogous', note: 'Neighbouring hues, low contrast and calm.' },
    { id: 'complementary', label: 'Complementary', note: 'Opposite hues for a deliberate accent.' },
    { id: 'neutral', label: 'Neutral', note: 'Warm and cool neutrals with a quiet accent.' }
];

/** Surfaces a covering can be applied over. */
export const SUBSTRATES = [
    { id: 'gypsum-new', label: 'New gypsum board', group: 'Interior', porous: true, primer: true, moistureMax: 0, cureDays: 0 },
    { id: 'gypsum-painted', label: 'Painted gypsum', group: 'Interior', porous: false, primer: true, moistureMax: 0, cureDays: 0 },
    { id: 'gypsum-wet', label: 'Water-resistant gypsum', group: 'Interior', porous: false, primer: true, moistureMax: 0, cureDays: 0 },
    { id: 'plaster-new', label: 'New plaster', group: 'Interior', porous: true, primer: true, moistureMax: 0, cureDays: 28 },
    { id: 'plaster-painted', label: 'Painted plaster', group: 'Interior', porous: false, primer: true, moistureMax: 0, cureDays: 0 },
    { id: 'concrete-new', label: 'New concrete', group: 'Masonry', porous: true, primer: true, moistureMax: 4, cureDays: 28 },
    { id: 'concrete-cured', label: 'Cured concrete', group: 'Masonry', porous: true, primer: true, moistureMax: 4, cureDays: 0 },
    { id: 'masonry', label: 'Brick or block', group: 'Masonry', porous: true, primer: true, moistureMax: 4, cureDays: 0 },
    { id: 'wood-bare', label: 'Bare wood', group: 'Wood', porous: true, primer: true, moistureMax: 19, cureDays: 0 },
    { id: 'wood-primed', label: 'Primed wood', group: 'Wood', porous: false, primer: false, moistureMax: 19, cureDays: 0 },
    { id: 'fiber-cement', label: 'Fiber cement', group: 'Wood', porous: true, primer: true, moistureMax: 16, cureDays: 0 },
    { id: 'metal', label: 'Metal', group: 'Metal', porous: false, primer: true, moistureMax: 0, cureDays: 0 },
    { id: 'vinyl', label: 'Vinyl', group: 'Plastic', porous: false, primer: false, moistureMax: 0, cureDays: 0 },
    { id: 'wallpaper', label: 'Existing wallpaper', group: 'Interior', porous: false, primer: true, moistureMax: 0, cureDays: 0 }
];

const MASONRY_ONLY = ['masonry', 'concrete-new', 'concrete-cured', 'plaster-new', 'plaster-painted'];
const INTERIOR_PAINT_SURFACES = ['gypsum-new', 'gypsum-painted', 'plaster-new', 'plaster-painted', 'concrete-cured', 'masonry', 'wood-primed', 'fiber-cement', 'metal'];
const EXTERIOR_PAINT_SURFACES = ['wood-primed', 'fiber-cement', 'masonry', 'concrete-cured', 'concrete-new', 'metal', 'vinyl'];

const paint = ({ id, label, exposure, sheen, colour, coverage, primerCoverage = 10, paintCost, primerCost = 48, labour, life, maintenance, voc, minTemp = 10, note, code }) => ({
    id,
    label,
    family: 'paint',
    exposure,
    sheen,
    colour,
    substrates: exposure === 'exterior' ? EXTERIOR_PAINT_SURFACES : INTERIOR_PAINT_SURFACES,
    unit: 'can',
    coats: 2,
    primer: 'recommended',
    primerCoverage,
    primerCost,
    coverage,
    costPerUnit: paintCost,
    labourPerM2: labour,
    waste: 0.05,
    lifeYears: life,
    maintenanceYears: maintenance,
    fireClass: 'A',
    vapourClass: 'III',
    weightKgM2: 0.25,
    thicknessMm: 0.1,
    vocGL: voc,
    minTempC: minTemp,
    recoatHours: 4,
    cureDays: 7,
    wetAreaOk: true,
    texture: 'paint',
    defaultColour: colour,
    components: [
        can('Primer', primerCoverage, primerCost, 'Preparation', { primer: true, coverageRate: primerCoverage }),
        can('Finish paint', coverage, paintCost, 'Finish', { perCoat: true, coverageRate: coverage }),
        pack('Painter’s tape', 'roll', 50, 8, 'Accessories', { basis: 'perimeter' }),
        pack('Drop cloth', 'pack', 50, 12, 'Accessories')
    ],
    note,
    code
});

const system = ({
    id, label, family, exposure, substrates, unit, coats = 1, primer = 'none',
    components, perimeterComponents = [], labour, waste, life, maintenance,
    fireClass, vapourClass = null, weight, thickness, voc = 0, minTemp = 5,
    recoatHours = 24, cureDays = 7, wetAreaOk = false, requiresWrb = false,
    requiresDrainage = false, minGrade = 0, texture = null, colour,
    note, code
}) => ({
    id, label, family, exposure, substrates, unit, coats, primer,
    components, perimeterComponents, labourPerM2: labour, waste,
    lifeYears: life, maintenanceYears: maintenance, fireClass, vapourClass,
    weightKgM2: weight, thicknessMm: thickness, vocGL: voc, minTempC: minTemp,
    recoatHours, cureDays, wetAreaOk, requiresWrb, requiresDrainage,
    minGradeClearanceMm: minGrade, texture, defaultColour: colour, note, code
});

export const WALL_COVERINGS = [
    // --- Interior paint ---------------------------------------------
    paint({
        id: 'paint-dead-flat', label: 'Ceiling paint · dead flat', exposure: 'interior', sheen: 'dead-flat',
        colour: 'chalk-white', coverage: 13, paintCost: 58, labour: 8, life: 8, maintenance: 7, voc: 30,
        note: 'A flat ceiling white that hides framing shadows and roller overlap.',
        code: 'IRC R702.1; ASTM D4956 not applicable. Follow the manufacturer’s coverage and recoat window.'
    }),
    paint({
        id: 'paint-matte', label: 'Interior paint · matte', exposure: 'interior', sheen: 'matte',
        colour: 'greige', coverage: 11, paintCost: 68, labour: 9, life: 8, maintenance: 7, voc: 35,
        note: 'Deep, velvet colour for dry rooms; not for kitchens or bathrooms.',
        code: 'IRC R702.1. Scrub resistance to ASTM D2486; matte films are not washable.'
    }),
    paint({
        id: 'paint-eggshell', label: 'Interior paint · eggshell', exposure: 'interior', sheen: 'eggshell',
        colour: 'cotton-white', coverage: 11, paintCost: 72, labour: 9, life: 9, maintenance: 7, voc: 40,
        note: 'The general-purpose wall finish: wipes clean, keeps a low sheen.',
        code: 'IRC R702.1; Class III vapour retarder when applied as the interior finish (IRC R702.7).'
    }),
    paint({
        id: 'paint-satin', label: 'Interior paint · satin', exposure: 'interior', sheen: 'satin',
        colour: 'sage', coverage: 10, paintCost: 78, labour: 10, life: 9, maintenance: 7, voc: 45,
        note: 'Moisture-resistant finish for kitchens, bathrooms and busy halls.',
        code: 'IRC R702.1. Use with an approved water-resistant backer in wet areas.'
    }),
    paint({
        id: 'paint-semi-gloss', label: 'Interior paint · semi-gloss', exposure: 'interior', sheen: 'semi-gloss',
        colour: 'warm-white', coverage: 10, paintCost: 82, labour: 11, life: 10, maintenance: 8, voc: 50,
        note: 'Hard trim and joinery film that scrubs clean.',
        code: 'IRC R702.1. Degloss existing gloss before recoating.'
    }),
    paint({
        id: 'paint-gloss', label: 'Interior paint · gloss', exposure: 'interior', sheen: 'gloss',
        colour: 'charcoal', coverage: 9.5, paintCost: 92, labour: 12, life: 10, maintenance: 8, voc: 60,
        note: 'Maximum sheen and washability for doors, trim and joinery.',
        code: 'IRC R702.1. Surface preparation controls adhesion; do not apply over chalky or glossy paint.'
    }),
    {
        id: 'limewash', label: 'Limewash · mineral paint', family: 'paint', exposure: 'interior',
        sheen: 'masonry-flat', colour: 'bone', substrates: MASONRY_ONLY, unit: 'tub',
        coats: 2, primer: 'none', primerCoverage: 0, primerCost: 0, coverage: 8,
        costPerUnit: 95, labourPerM2: 16, waste: 0.08, lifeYears: 6, maintenanceYears: 4,
        fireClass: 'A', vapourClass: 'III', weightKgM2: 0.15, thicknessMm: 0.1,
        vocGL: 3, minTempC: 8, recoatHours: 12, cureDays: 3, wetAreaOk: true,
        texture: 'paint', defaultColour: 'bone',
        components: [
            pack('Limewash', '5 L tub', 40, 95, 'Finish', { perCoat: true, coverageRate: 8 }),
            pack('Limewash primer', '5 L tub', 35, 70, 'Preparation')
        ],
        note: 'Breathable mineral finish that ages with movement and patina.',
        code: 'IRC R702.1. Apply over mineral substrates, never over gypsum or vinyl.'
    },

    // --- Interior plasters and textures -----------------------------
    system({
        id: 'plaster-skim', label: 'Skim coat plaster', family: 'plaster', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-new', 'plaster-painted', 'concrete-cured', 'masonry'],
        unit: 'bag', coats: 2, primer: 'required',
        components: [
            pack('Skim coat compound', '25 kg bag', 8, 32, 'Finish', { perCoat: true }),
            pack('Bonding agent', '3.78 L can', 30, 48, 'Preparation'),
            pack('Joint tape', '50 m roll', 50, 8, 'Accessories', { basis: 'perimeter' })
        ],
        labour: 35, waste: 0.15, life: 40, maintenance: 15, fireClass: 'A', vapourClass: 'III',
        weight: 2.5, thickness: 2, voc: 0, minTemp: 5, recoatHours: 24, cureDays: 7,
        wetAreaOk: false, texture: 'paint', colour: 'chalk-white',
        note: 'A 2 mm trowel coat that flattens board joints and leaves a plaster sheen.',
        code: 'IRC R702.2.1; ASTM C841, C842 and C843 for gypsum plaster application.'
    }),
    system({
        id: 'plaster-venetian', label: 'Venetian plaster · polished', family: 'plaster', exposure: 'interior',
        substrates: ['gypsum-new', 'plaster-new', 'plaster-painted', 'concrete-cured', 'masonry'],
        unit: 'bag', coats: 3, primer: 'required',
        components: [
            pack('Venetian plaster base', '25 kg bag', 3.5, 120, 'Finish', { perCoat: true }),
            pack('Sealer', '3.78 L can', 30, 60, 'Preparation'),
            pack('Finishing wax', '1 kg tin', 20, 45, 'Accessories')
        ],
        labour: 90, waste: 0.2, life: 30, maintenance: 12, fireClass: 'A', vapourClass: 'III',
        weight: 4, thickness: 3, voc: 10, minTemp: 10, recoatHours: 24, cureDays: 7,
        wetAreaOk: true, texture: 'paint', colour: 'bone',
        note: 'Burnished lime plaster with depth and movement; sample panels decide the colour.',
        code: 'IRC R702.2.1. Manufacturer’s system and sealer required; wax is not a wet-area finish.'
    }),
    system({
        id: 'texture-orange-peel', label: 'Orange-peel texture', family: 'texture', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-new', 'plaster-painted'],
        unit: 'bag', coats: 1, primer: 'required',
        components: [
            pack('Texture compound', '25 kg bag', 25, 28, 'Finish'),
            pack('Texture primer', '3.78 L can', 37.8, 42, 'Preparation')
        ],
        labour: 18, waste: 0.12, life: 20, maintenance: 10, fireClass: 'A', vapourClass: 'III',
        weight: 1.2, thickness: 1, voc: 0, minTemp: 10, recoatHours: 12, cureDays: 2,
        wetAreaOk: false, texture: 'paint', colour: 'warm-white',
        note: 'Sprayed splatter finish that hides taped joints and small dents.',
        code: 'IRC R702.3.5: 1/2 in board at 16 in o.c. before a water-based texture; 3/8 in not allowed on ceilings.'
    }),
    system({
        id: 'texture-knockdown', label: 'Knockdown texture', family: 'texture', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-new', 'plaster-painted'],
        unit: 'bag', coats: 1, primer: 'required',
        components: [
            pack('Texture compound', '25 kg bag', 20, 30, 'Finish'),
            pack('Texture primer', '3.78 L can', 37.8, 42, 'Preparation')
        ],
        labour: 22, waste: 0.12, life: 20, maintenance: 10, fireClass: 'A', vapourClass: 'III',
        weight: 1.5, thickness: 1.5, voc: 0, minTemp: 10, recoatHours: 12, cureDays: 2,
        wetAreaOk: false, texture: 'paint', colour: 'warm-white',
        note: 'Flattened trowel texture with soft shadows; common on production ceilings.',
        code: 'IRC R702.3.5. Water-based texture raises the board thickness requirement.'
    }),

    // --- Interior wall coverings ------------------------------------
    system({
        id: 'wallpaper-paper', label: 'Wallpaper · paper', family: 'wallpaper', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-new', 'plaster-painted'],
        unit: 'roll', coats: 1, primer: 'required',
        components: [
            pack('Wallpaper', '5.3 m² roll', 5.3, 65, 'Finish'),
            pack('Wallpaper adhesive', '5 kg tub', 25, 30, 'Preparation'),
            pack('Sizing', '5 L tub', 40, 35, 'Preparation'),
            pack('Seam roller', 'each', 40, 12, 'Accessories')
        ],
        labour: 25, waste: 0.15, life: 10, maintenance: 6, fireClass: 'B', vapourClass: 'III',
        weight: 0.3, thickness: 0.5, voc: 20, minTemp: 15, recoatHours: 24, cureDays: 2,
        wetAreaOk: false, texture: 'paint', colour: 'bone',
        note: 'Paper wallpaper for dry rooms; pattern repeat decides the real roll count.',
        code: 'IRC R702.1 and R302.9 flame spread. Paper is Class B and not a wet-area finish.'
    }),
    system({
        id: 'wallpaper-vinyl', label: 'Wallpaper · vinyl', family: 'wallpaper', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-new', 'plaster-painted'],
        unit: 'roll', coats: 1, primer: 'required',
        components: [
            pack('Vinyl wallpaper', '5.3 m² roll', 5.3, 78, 'Finish'),
            pack('Wallpaper adhesive', '5 kg tub', 25, 30, 'Preparation'),
            pack('Sizing', '5 L tub', 40, 35, 'Preparation')
        ],
        labour: 27, waste: 0.15, life: 12, maintenance: 7, fireClass: 'B', vapourClass: 'I',
        weight: 0.4, thickness: 0.6, voc: 25, minTemp: 15, recoatHours: 24, cureDays: 2,
        wetAreaOk: true, texture: 'paint', colour: 'powder-blue',
        note: 'Washable vinyl wall covering for halls, kitchens and bathrooms.',
        code: 'IRC R702.7: a vinyl covering is a Class I vapour retarder; do not trap a second Class I layer in a cold wall.'
    }),
    system({
        id: 'wallpaper-grasscloth', label: 'Wallpaper · grasscloth', family: 'wallpaper', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-painted'],
        unit: 'roll', coats: 1, primer: 'required',
        components: [
            pack('Grasscloth', '5.3 m² roll', 5.3, 145, 'Finish'),
            pack('Wallpaper adhesive', '5 kg tub', 25, 30, 'Preparation'),
            pack('Sizing', '5 L tub', 40, 35, 'Preparation')
        ],
        labour: 35, waste: 0.2, life: 10, maintenance: 6, fireClass: 'B', vapourClass: 'III',
        weight: 0.5, thickness: 0.8, voc: 20, minTemp: 18, recoatHours: 24, cureDays: 2,
        wetAreaOk: false, texture: 'paint', colour: 'sand',
        note: 'Natural fibre with visible seams and colour variation; seams are part of the look.',
        code: 'IRC R702.1; Class III vapour retarder. Keep out of wet rooms and direct sun.'
    }),
    system({
        id: 'panel-wood', label: 'Wood veneer panelling', family: 'panel', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-painted', 'wood-bare'],
        unit: 'sheet', coats: 1, primer: 'none',
        components: [
            pack('Veneer panel', '1220 × 2440 sheet', 2.98, 95, 'Finish'),
            pack('Panel adhesive', 'tube', 6, 9, 'Accessories'),
            pack('Screws', 'box (200)', 15, 12, 'Accessories'),
            pack('Batten', '2.44 m length', 1.5, 12, 'Accessories')
        ],
        labour: 30, waste: 0.1, life: 25, maintenance: 10, fireClass: 'C', vapourClass: 'III',
        weight: 4, thickness: 10, voc: 30, minTemp: 15, recoatHours: 0, cureDays: 1,
        wetAreaOk: true, texture: 'wood', colour: 'sand',
        note: 'Wood veneer panels on battens; the cavity is a service and wiring zone.',
        code: 'IRC R702.5: 1/4 in or thicker paneling, framing at 16 in o.c.; thinner panels need a 3/8 in backer.'
    }),
    system({
        id: 'wainscot-beadboard', label: 'Beadboard wainscot', family: 'panel', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-painted', 'wood-bare'],
        unit: 'sheet', coats: 1, primer: 'required',
        components: [
            pack('Beadboard panel', '1220 × 2440 sheet', 2.98, 70, 'Finish'),
            pack('Chair rail', '2.44 m length', 2.44, 14, 'Accessories', { basis: 'perimeter' }),
            pack('Construction adhesive', 'tube', 6, 9, 'Accessories'),
            pack('Finishing nails', 'box (500)', 20, 10, 'Accessories')
        ],
        labour: 35, waste: 0.12, life: 25, maintenance: 10, fireClass: 'C', vapourClass: 'III',
        weight: 3.5, thickness: 9, voc: 25, minTemp: 15, recoatHours: 0, cureDays: 1,
        wetAreaOk: true, texture: 'wood', colour: 'warm-white',
        note: 'Beadboard to 1.2 m with a chair rail; paint the grooves before hanging.',
        code: 'IRC R702.5. Keep the bottom rail clear of wet mopping and seal cut edges.'
    }),
    system({
        id: 'shiplap', label: 'Shiplap boards', family: 'panel', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-painted', 'wood-bare'],
        unit: 'bundle', coats: 1, primer: 'required',
        components: [
            pack('Shiplap boards', 'bundle (5 × 2.44 m)', 1.7, 45, 'Finish'),
            pack('Batten', '2.44 m length', 1.5, 12, 'Accessories'),
            pack('Finishing nails', 'box (500)', 20, 10, 'Accessories')
        ],
        labour: 30, waste: 0.12, life: 20, maintenance: 8, fireClass: 'C', vapourClass: 'III',
        weight: 3, thickness: 14, voc: 0, minTemp: 15, recoatHours: 0, cureDays: 1,
        wetAreaOk: true, texture: 'wood', colour: 'bone',
        note: 'Horizontal boards with a shadow line at every lap.',
        code: 'IRC R702.5. Acclimate the boards 48–72 hours before fixing.'
    }),
    system({
        id: 'board-batten', label: 'Board and batten', family: 'panel', exposure: 'both',
        substrates: ['gypsum-new', 'gypsum-painted', 'plaster-painted', 'wood-bare', 'fiber-cement'],
        unit: 'sheet', coats: 1, primer: 'required',
        components: [
            pack('Board panel', '1220 × 2440 sheet', 2.98, 85, 'Finish'),
            pack('Batten', '2.44 m length', 1.5, 20, 'Accessories'),
            pack('Screws', 'box (200)', 15, 12, 'Accessories')
        ],
        labour: 40, waste: 0.12, life: 20, maintenance: 8, fireClass: 'C', vapourClass: 'III',
        weight: 4, thickness: 18, voc: 0, minTemp: 5, recoatHours: 0, cureDays: 1,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 152,
        texture: 'wood', colour: 'warm-white',
        note: 'Vertical battens over a painted panel; exterior versions are a rainscreen.',
        code: 'IRC R703.2 water-resistive barrier and R703.4 flashing when used outside.'
    }),
    system({
        id: 'tile-ceramic', label: 'Ceramic wall tile', family: 'tile', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-painted', 'gypsum-wet', 'plaster-new', 'plaster-painted', 'fiber-cement'],
        unit: 'box', coats: 1, primer: 'required',
        components: [
            pack('Ceramic tile', 'box (1.2 m²)', 1.2, 45, 'Finish'),
            pack('Thinset', '20 kg bag', 5, 22, 'Preparation'),
            pack('Grout', '5 kg bag', 4, 16, 'Finish'),
            pack('Backer board', '1220 × 2440 sheet', 2.98, 18, 'Preparation'),
            pack('Backer screws', 'box (200)', 15, 12, 'Accessories'),
            pack('Trim', '2.44 m length', 2.44, 16, 'Accessories', { basis: 'perimeter' })
        ],
        labour: 55, waste: 0.12, life: 30, maintenance: 15, fireClass: 'A', vapourClass: null,
        weight: 14, thickness: 8, voc: 15, minTemp: 5, recoatHours: 24, cureDays: 7,
        wetAreaOk: true, texture: 'tile', colour: 'chalk-white',
        note: 'Glazed wall tile over a cement or fiber-cement backer in wet areas.',
        code: 'IRC R702.4, R702.3.7 and R702.4.2; ANSI A108/A136 and ASTM C1178/C1325 backers.'
    }),
    system({
        id: 'tile-porcelain', label: 'Porcelain tile · large format', family: 'tile', exposure: 'interior',
        substrates: ['gypsum-new', 'gypsum-wet', 'plaster-new', 'fiber-cement', 'concrete-cured'],
        unit: 'box', coats: 1, primer: 'required',
        components: [
            pack('Porcelain tile', 'box (1.44 m²)', 1.44, 70, 'Finish'),
            pack('Thinset', '20 kg bag', 5, 26, 'Preparation'),
            pack('Grout', '5 kg bag', 4, 18, 'Finish'),
            pack('Backer board', '1220 × 2440 sheet', 2.98, 22, 'Preparation'),
            pack('Levelling clips', 'box (200)', 10, 18, 'Accessories'),
            pack('Trim', '2.44 m length', 2.44, 22, 'Accessories', { basis: 'perimeter' })
        ],
        labour: 65, waste: 0.15, life: 35, maintenance: 15, fireClass: 'A', vapourClass: null,
        weight: 22, thickness: 10, voc: 15, minTemp: 5, recoatHours: 24, cureDays: 7,
        wetAreaOk: true, texture: 'tile', colour: 'greige',
        note: 'Large-format porcelain needs a flat substrate and a levelling system.',
        code: 'IRC R702.4; ANSI A108.5 and A136.1. Deflection must not exceed L/360 for the backing.'
    }),
    system({
        id: 'stone-veneer-interior', label: 'Stone veneer · interior', family: 'stone', exposure: 'interior',
        substrates: ['masonry', 'concrete-cured', 'plaster-new', 'fiber-cement'],
        unit: 'box', coats: 1, primer: 'none',
        components: [
            pack('Stone veneer', 'box (0.5 m²)', 0.5, 55, 'Finish'),
            pack('Mortar', '25 kg bag', 3, 18, 'Preparation'),
            pack('Metal lath', 'sheet (2.98 m²)', 2.98, 16, 'Preparation'),
            pack('Masonry ties', 'box (50)', 10, 25, 'Accessories')
        ],
        labour: 70, waste: 0.12, life: 60, maintenance: 20, fireClass: 'A', vapourClass: null,
        weight: 40, thickness: 40, voc: 0, minTemp: 5, recoatHours: 24, cureDays: 7,
        wetAreaOk: true, texture: 'stone', colour: 'mushroom',
        note: 'Thin stone veneer on lath and mortar for a feature wall or fireplace.',
        code: 'IRC R702.1 and R703.8 for support and anchorage; interior veneer needs no airspace.'
    }),
    system({
        id: 'brick-slip', label: 'Brick slip cladding', family: 'masonry', exposure: 'interior',
        substrates: ['masonry', 'concrete-cured', 'plaster-new', 'fiber-cement'],
        unit: 'box', coats: 1, primer: 'none',
        components: [
            pack('Brick slips', 'box (0.5 m²)', 0.5, 48, 'Finish'),
            pack('Brick adhesive', '25 kg bag', 4, 20, 'Preparation'),
            pack('Mortar for pointing', '25 kg bag', 5, 18, 'Finish')
        ],
        labour: 60, waste: 0.1, life: 75, maintenance: 25, fireClass: 'A', vapourClass: null,
        weight: 30, thickness: 15, voc: 0, minTemp: 5, recoatHours: 24, cureDays: 7,
        wetAreaOk: true, texture: 'stone', colour: 'brick',
        note: 'Cut brick slips glued to a flat backer and pointed like full brick.',
        code: 'IRC R702.1; interior masonry veneer follows R703.7.1 support and R703.7.4 anchorage.'
    }),

    // --- Exterior paint ---------------------------------------------
    paint({
        id: 'paint-exterior-acrylic', label: 'Exterior acrylic paint · satin', exposure: 'exterior', sheen: 'exterior-satin',
        colour: 'warm-white', coverage: 10, paintCost: 82, labour: 12, life: 10, maintenance: 8, voc: 50,
        note: 'Flexible acrylic for wood, fiber cement and primed metal.',
        code: 'IRC R703.1 weather-resistant envelope. Follow the primer and recoat data sheet.'
    }),
    paint({
        id: 'paint-elastomeric', label: 'Elastomeric masonry paint', exposure: 'exterior', sheen: 'masonry-flat',
        colour: 'greige', coverage: 6, paintCost: 105, labour: 14, life: 12, maintenance: 10, voc: 60,
        note: 'Thick, crack-bridging film for stucco, block and concrete.',
        code: 'IRC R703; elastomeric coatings need a sound, cured and primed masonry substrate.'
    }),
    paint({
        id: 'paint-masonry-exterior', label: 'Breathable masonry paint', exposure: 'exterior', sheen: 'masonry-flat',
        colour: 'bone', coverage: 8, paintCost: 75, labour: 12, life: 12, maintenance: 10, voc: 40,
        note: 'Vapour-open mineral paint that lets stucco and brick dry outward.',
        code: 'IRC R703 and R702.7. Never seal a masonry wall with a low-perm film.'
    }),

    // --- Exterior cladding ------------------------------------------
    system({
        id: 'stucco-3coat', label: 'Stucco · 3-coat over lath', family: 'stucco', exposure: 'exterior',
        substrates: ['wood-bare', 'wood-primed', 'fiber-cement', 'masonry', 'concrete-new'],
        unit: 'bag', coats: 3, primer: 'none',
        components: [
            pack('Scratch coat', '25 kg bag', 1.2, 18, 'Finish'),
            pack('Brown coat', '25 kg bag', 1.2, 18, 'Finish'),
            pack('Finish coat', '25 kg bag', 6, 24, 'Finish', { perCoat: false }),
            pack('Metal lath', 'sheet (2.98 m²)', 2.98, 16, 'Preparation'),
            pack('Water-resistive barrier', 'roll (92.9 m²)', 92.9, 120, 'Preparation'),
            pack('Weep screed', '3 m length', 3, 14, 'Accessories', { basis: 'perimeter' }),
            pack('Control joint', '3 m length', 3, 12, 'Accessories')
        ],
        labour: 45, waste: 0.12, life: 50, maintenance: 12, fireClass: 'A', vapourClass: null,
        weight: 25, thickness: 22, voc: 0, minTemp: 4, recoatHours: 24, cureDays: 28,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 102,
        texture: 'concrete', colour: 'bone',
        note: 'Scratch, brown and finish coats over self-furring lath; 7/8 in total.',
        code: 'IRC R703.7 and Table R702.1(1); ASTM C926 and C1063; second coat after 24 h, finish after 48 h.'
    }),
    system({
        id: 'stucco-2coat', label: 'Stucco · 2-coat over masonry', family: 'stucco', exposure: 'exterior',
        substrates: ['masonry', 'concrete-new', 'concrete-cured'],
        unit: 'bag', coats: 2, primer: 'none',
        components: [
            pack('Base coat', '25 kg bag', 1.2, 18, 'Finish'),
            pack('Finish coat', '25 kg bag', 6, 24, 'Finish', { perCoat: false }),
            pack('Bonding agent', '3.78 L can', 25, 55, 'Preparation'),
            pack('Weep screed', '3 m length', 3, 14, 'Accessories', { basis: 'perimeter' })
        ],
        labour: 40, waste: 0.12, life: 45, maintenance: 12, fireClass: 'A', vapourClass: null,
        weight: 22, thickness: 18, voc: 0, minTemp: 4, recoatHours: 48, cureDays: 28,
        wetAreaOk: true, requiresDrainage: true, minGrade: 102,
        texture: 'concrete', colour: 'putty',
        note: 'Two coats directly on a prepared masonry base; no lath.',
        code: 'IRC R703.7 and Table R702.1(1): two coats permitted over masonry; finish after 48 h.'
    }),
    system({
        id: 'eifs', label: 'EIFS · drained and back-vented', family: 'eifs', exposure: 'exterior',
        substrates: ['wood-bare', 'wood-primed', 'fiber-cement', 'masonry'],
        unit: 'sheet', coats: 1, primer: 'none',
        components: [
            pack('Insulation board', '1220 × 2440 sheet', 2.98, 32, 'Finish'),
            pack('Base coat', '25 kg bag', 4, 28, 'Finish'),
            pack('Reinforcing mesh', 'roll (50 m²)', 50, 65, 'Preparation'),
            pack('Finish coat', '25 kg bag', 6, 30, 'Finish'),
            pack('Water-resistive barrier', 'roll (92.9 m²)', 92.9, 120, 'Preparation'),
            pack('Weep screed', '3 m length', 3, 14, 'Accessories', { basis: 'perimeter' })
        ],
        labour: 50, waste: 0.12, life: 25, maintenance: 10, fireClass: 'B', vapourClass: null,
        weight: 6, thickness: 40, voc: 25, minTemp: 4, recoatHours: 24, cureDays: 7,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 102,
        texture: 'concrete', colour: 'greige',
        note: 'Insulated facade with a drained, back-vented cavity and mesh-reinforced base coat.',
        code: 'IRC R703; ASTM E2273 drainage and E2568/E2486 for EIFS. A drained assembly is required over wood frame.'
    }),
    system({
        id: 'fiber-cement-siding', label: 'Fiber cement lap siding', family: 'siding', exposure: 'exterior',
        substrates: ['wood-bare', 'wood-primed', 'fiber-cement', 'masonry'],
        unit: 'square', coats: 1, primer: 'required',
        components: [
            pack('Fiber cement siding', 'square (9.29 m²)', 9.29, 210, 'Finish'),
            pack('Water-resistive barrier', 'roll (92.9 m²)', 92.9, 120, 'Preparation'),
            pack('Siding nails', 'box (5 lb)', 20, 10, 'Accessories'),
            pack('Corner trim', '3 m length', 3, 18, 'Accessories', { basis: 'perimeter' }),
            pack('Caulk', 'tube', 6, 8, 'Accessories')
        ],
        labour: 35, waste: 0.1, life: 30, maintenance: 10, fireClass: 'A', vapourClass: null,
        weight: 18, thickness: 8, voc: 0, minTemp: 0, recoatHours: 0, cureDays: 1,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 152,
        texture: 'wood', colour: 'greige',
        note: 'Dimensionally stable lap siding; factory finish or field paint.',
        code: 'IRC R703.10 and R703.2; ASTM C1186. Keep 6 in above grade and 1/8 in gaps at trim.'
    }),
    system({
        id: 'vinyl-siding', label: 'Vinyl siding', family: 'siding', exposure: 'exterior',
        substrates: ['wood-bare', 'fiber-cement', 'masonry'],
        unit: 'square', coats: 1, primer: 'none',
        components: [
            pack('Vinyl siding', 'square (9.29 m²)', 9.29, 130, 'Finish'),
            pack('Water-resistive barrier', 'roll (92.9 m²)', 92.9, 120, 'Preparation'),
            pack('Siding nails', 'box (5 lb)', 20, 10, 'Accessories'),
            pack('Corner post', '3 m length', 3, 16, 'Accessories', { basis: 'perimeter' }),
            pack('J-channel', '3 m length', 3, 9, 'Accessories')
        ],
        labour: 25, waste: 0.1, life: 25, maintenance: 6, fireClass: 'B', vapourClass: null,
        weight: 3, thickness: 1, voc: 0, minTemp: 0, recoatHours: 0, cureDays: 1,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 152,
        texture: null, colour: 'warm-white',
        note: 'Loose-fit vinyl laps that move with temperature; never caulk the joints.',
        code: 'IRC R703.11 and R703.11.1; ASTM D4756. 6 in above grade and 1/2 in clearance at adjacent surfaces.'
    }),
    system({
        id: 'wood-cladding', label: 'Wood cladding · rainscreen', family: 'siding', exposure: 'exterior',
        substrates: ['wood-bare', 'wood-primed', 'fiber-cement'],
        unit: 'square', coats: 2, primer: 'required',
        components: [
            pack('Wood cladding', 'square (9.29 m²)', 9.29, 320, 'Finish'),
            pack('Water-resistive barrier', 'roll (92.9 m²)', 92.9, 120, 'Preparation'),
            pack('Battens', '2.44 m length', 1.5, 20, 'Preparation'),
            pack('Stainless nails', 'box (5 lb)', 20, 16, 'Accessories'),
            pack('Corner trim', '3 m length', 3, 22, 'Accessories', { basis: 'perimeter' })
        ],
        labour: 30, waste: 0.1, life: 20, maintenance: 6, fireClass: 'B', vapourClass: null,
        weight: 12, thickness: 18, voc: 40, minTemp: 5, recoatHours: 12, cureDays: 2,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 152,
        texture: 'wood', colour: 'sand',
        note: 'Ventilated rainscreen over a drained cavity; back-prime every cut.',
        code: 'IRC R703.2 and R703.4; ASTM E331. Wood siding needs 6–8 in above grade and a vented cavity.'
    }),
    system({
        id: 'brick-veneer', label: 'Brick veneer', family: 'masonry', exposure: 'exterior',
        substrates: ['wood-bare', 'fiber-cement', 'masonry', 'concrete-new'],
        unit: 'brick', coats: 1, primer: 'none',
        components: [
            pack('Brick', '100 bricks (2 m²)', 2, 90, 'Finish'),
            pack('Mortar', '25 kg bag', 3, 16, 'Preparation'),
            pack('Masonry ties', 'box (50)', 10, 25, 'Accessories'),
            pack('Flashing', '3 m length', 3, 18, 'Accessories', { basis: 'perimeter' }),
            pack('Weep vents', 'box (50)', 5, 18, 'Accessories')
        ],
        labour: 60, waste: 0.08, life: 75, maintenance: 25, fireClass: 'A', vapourClass: null,
        weight: 190, thickness: 90, voc: 0, minTemp: 4, recoatHours: 24, cureDays: 7,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 102,
        texture: 'stone', colour: 'brick',
        note: 'One-wythe brick veneer with ties, weep holes and a drained cavity.',
        code: 'IRC R703.8; anchored veneer, 1 in airspace, flashing and weep holes at the base.'
    }),
    system({
        id: 'stone-veneer-exterior', label: 'Stone veneer · exterior', family: 'stone', exposure: 'exterior',
        substrates: ['masonry', 'concrete-new', 'wood-bare', 'fiber-cement'],
        unit: 'box', coats: 1, primer: 'none',
        components: [
            pack('Stone veneer', 'box (0.5 m²)', 0.5, 60, 'Finish'),
            pack('Mortar', '25 kg bag', 3, 18, 'Preparation'),
            pack('Metal lath', 'sheet (2.98 m²)', 2.98, 16, 'Preparation'),
            pack('Water-resistive barrier', 'roll (92.9 m²)', 92.9, 120, 'Preparation'),
            pack('Flashing', '3 m length', 3, 18, 'Accessories', { basis: 'perimeter' })
        ],
        labour: 70, waste: 0.12, life: 75, maintenance: 25, fireClass: 'A', vapourClass: null,
        weight: 90, thickness: 50, voc: 0, minTemp: 4, recoatHours: 24, cureDays: 7,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 102,
        texture: 'stone', colour: 'mushroom',
        note: 'Adhered or anchored stone veneer over a drained, flashed backer.',
        code: 'IRC R703.8 and R703.2; ASTM C1670 for manufactured stone. Keep 4 in above grade.'
    }),
    system({
        id: 'metal-cladding', label: 'Metal wall cladding', family: 'metal', exposure: 'exterior',
        substrates: ['wood-bare', 'fiber-cement', 'masonry'],
        unit: 'panel', coats: 1, primer: 'none',
        components: [
            pack('Metal panel', '1 m² panel', 1, 85, 'Finish'),
            pack('Water-resistive barrier', 'roll (92.9 m²)', 92.9, 120, 'Preparation'),
            pack('Clips and fasteners', 'box (100)', 10, 20, 'Accessories'),
            pack('Trim', '3 m length', 3, 22, 'Accessories', { basis: 'perimeter' })
        ],
        labour: 55, waste: 0.1, life: 40, maintenance: 12, fireClass: 'A', vapourClass: null,
        weight: 7, thickness: 2, voc: 0, minTemp: 5, recoatHours: 0, cureDays: 1,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 152,
        texture: null, colour: 'slate',
        note: 'Concealed-fix metal panels over a drained cavity; cut edges need a matching trim.',
        code: 'IRC R703.3 and R703.4; wind resistance to ASTM E330. Dissimilar metals need isolation.'
    }),
    system({
        id: 'render-acrylic', label: 'Acrylic render · textured', family: 'stucco', exposure: 'exterior',
        substrates: ['masonry', 'concrete-cured', 'fiber-cement'],
        unit: 'bag', coats: 1, primer: 'required',
        components: [
            pack('Render base coat', '25 kg bag', 4, 26, 'Finish'),
            pack('Reinforcing mesh', 'roll (50 m²)', 50, 65, 'Preparation'),
            pack('Textured finish', '25 kg bag', 6, 28, 'Finish'),
            pack('Primer', '3.78 L can', 37.8, 55, 'Preparation')
        ],
        labour: 45, waste: 0.12, life: 20, maintenance: 10, fireClass: 'B', vapourClass: null,
        weight: 8, thickness: 8, voc: 20, minTemp: 5, recoatHours: 24, cureDays: 7,
        wetAreaOk: true, requiresWrb: true, requiresDrainage: true, minGrade: 102,
        texture: 'concrete', colour: 'putty',
        note: 'Thin acrylic render over a mesh-reinforced base; coloured finish, no paint.',
        code: 'IRC R703; manufacturer’s system over a drained substrate. Keep 4 in above grade.'
    })
];

export const COVERING_COUNT = WALL_COVERINGS.length;

/** The covering a fresh wall starts on, per side of the envelope. */
export const DEFAULT_COVERING_BY_EXPOSURE = {
    interior: 'paint-eggshell',
    exterior: 'paint-exterior-acrylic'
};

export function defaultCoveringFor(exposure = 'interior') {
    const id = DEFAULT_COVERING_BY_EXPOSURE[exposure === 'exterior' ? 'exterior' : 'interior'];
    return WALL_COVERINGS.find((entry) => entry.id === id) || WALL_COVERINGS[0];
}

/** A sensible first substrate for a covering, preferring the correct side. */
export function defaultSubstrateFor(covering, exposure = 'interior') {
    const order = exposure === 'exterior'
        ? ['wood-primed', 'fiber-cement', 'masonry', 'concrete-new', 'wood-bare', 'concrete-cured', 'metal', 'vinyl']
        : ['gypsum-painted', 'gypsum-new', 'plaster-painted', 'plaster-new', 'gypsum-wet', 'concrete-cured', 'masonry', 'wood-primed', 'fiber-cement', 'metal', 'wallpaper'];
    const allowed = covering?.substrates || [];
    return order.find((id) => allowed.includes(id)) || allowed[0] || SUBSTRATES[0].id;
}

export function coveringById(id) {
    return WALL_COVERINGS.find((entry) => entry.id === id) || WALL_COVERINGS[0];
}

export function coveringOptions({ exposure = 'interior' } = {}) {
    const wanted = exposure === 'exterior' ? ['exterior', 'both'] : ['interior', 'both'];
    return WALL_COVERINGS.filter((entry) => wanted.includes(entry.exposure));
}

export function sheenById(id) {
    return PAINT_SHEENS.find((entry) => entry.id === id) || PAINT_SHEENS[2];
}

// The paint product that carries each sheen, for the editor hand-off. A sheen
// is a property of the product there, not a separate field.
export const PAINT_COVERING_BY_SHEEN = {
    'dead-flat': 'paint-dead-flat',
    matte: 'paint-matte',
    eggshell: 'paint-eggshell',
    satin: 'paint-satin',
    'semi-gloss': 'paint-semi-gloss',
    gloss: 'paint-gloss',
    'exterior-satin': 'paint-exterior-acrylic',
    'exterior-gloss': 'paint-exterior-acrylic'
};

export function paintCoveringForSheen(sheenId) {
    return PAINT_COVERING_BY_SHEEN[sheenId] || null;
}

export function colourById(id) {
    return PAINT_COLOURS.find((entry) => entry.id === id) || null;
}

export function substrateById(id) {
    return SUBSTRATES.find((entry) => entry.id === id) || SUBSTRATES[0];
}

/** Coverings grouped by family, for an optgroup select. */
export function coveringsByFamily({ exposure = 'interior' } = {}) {
    const groups = new Map();
    coveringOptions({ exposure }).forEach((entry) => {
        const key = entry.family;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    });
    return [...groups.entries()].map(([family, entries]) => ({ family, entries }));
}

/** The patch the editor writes into a wall's style map. */
export function finishPatchFor(coveringId, colourId = null) {
    const covering = coveringById(coveringId);
    const colour = colourById(colourId) || colourById(covering.defaultColour);
    return {
        covering: covering.id,
        texture: covering.texture || null,
        color: colour ? colour.hex : null
    };
}

/** RGB, hue and LRV from a #rrggbb colour. LRV follows the CIE Y value. */
export function rgbOf(hex) {
    const value = String(hex || '').replace('#', '');
    const full = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
    const number = Number.parseInt(full, 16);
    if (!Number.isFinite(number)) return { r: 255, g: 255, b: 255 };
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

export function hueOf(hex) {
    const { r, g, b } = rgbOf(hex);
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    if (max === min) return 0;
    const delta = max - min;
    let hue;
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    return (hue * 60 + 360) % 360;
}

export function lrvOf(hex) {
    const { r, g, b } = rgbOf(hex);
    const channel = (value) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    return Math.round(luminance * 1000) / 10;
}

export function hexToRgb(hex) {
    return rgbOf(hex);
}

/** Nearest named palette colour to an arbitrary hex. */
export function nearestColour(hex) {
    const target = rgbOf(hex);
    let best = PAINT_COLOURS[0];
    let bestDistance = Infinity;
    PAINT_COLOURS.forEach((entry) => {
        const candidate = rgbOf(entry.hex);
        const distance = (target.r - candidate.r) ** 2 + (target.g - candidate.g) ** 2 + (target.b - candidate.b) ** 2;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = entry;
        }
    });
    return best;
}

/** Shift a hex colour's lightness by a fraction, keeping its hue. */
export function shiftLightness(hex, amount) {
    const { r, g, b } = rgbOf(hex);
    const toHsl = (red, green, blue) => {
        const rn = red / 255;
        const gn = green / 255;
        const bn = blue / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        const l = (max + min) / 2;
        if (max === min) return { h: 0, s: 0, l };
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        const h = max === rn
            ? ((gn - bn) / d + (gn < bn ? 6 : 0))
            : max === gn
                ? ((bn - rn) / d + 2)
                : ((rn - gn) / d + 4);
        return { h: h * 60, s, l };
    };
    const hsl = toHsl(r, g, b);
    const lightness = Math.min(Math.max(hsl.l + amount, 0.04), 0.97);
    const c = (1 - Math.abs(2 * lightness - 1)) * hsl.s;
    const x = c * (1 - Math.abs(((hsl.h / 60) % 2) - 1));
    const m = lightness - c / 2;
    let [rr, gg, bb] = [0, 0, 0];
    if (hsl.h < 60) [rr, gg, bb] = [c, x, 0];
    else if (hsl.h < 120) [rr, gg, bb] = [x, c, 0];
    else if (hsl.h < 180) [rr, gg, bb] = [0, c, x];
    else if (hsl.h < 240) [rr, gg, bb] = [0, x, c];
    else if (hsl.h < 300) [rr, gg, bb] = [x, 0, c];
    else [rr, gg, bb] = [c, 0, x];
    const channel = (value) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
    return `#${channel(rr)}${channel(gg)}${channel(bb)}`.toUpperCase();
}

/** Shift a hex colour's hue by degrees, keeping saturation and lightness. */
export function shiftHue(hex, degrees) {
    const { r, g, b } = rgbOf(hex);
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === min ? 0
        : max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0))
            : max === gn ? ((bn - rn) / d + 2)
                : ((rn - gn) / d + 4);
    h = (((h * 60 + degrees) % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let [rr, gg, bb] = [0, 0, 0];
    if (h < 60) [rr, gg, bb] = [c, x, 0];
    else if (h < 120) [rr, gg, bb] = [x, c, 0];
    else if (h < 180) [rr, gg, bb] = [0, c, x];
    else if (h < 240) [rr, gg, bb] = [0, x, c];
    else if (h < 300) [rr, gg, bb] = [x, 0, c];
    else [rr, gg, bb] = [c, 0, x];
    const channel = (value) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
    return `#${channel(rr)}${channel(gg)}${channel(bb)}`.toUpperCase();
}

/**
 * A four-colour scheme around a base wall colour. The harmony picks the
 * accent; trim and ceiling are chosen for a readable LRV separation, which is
 * also what the suite checks.
 */
export function buildColourScheme(baseId, harmony = 'monochrome') {
    const base = colourById(baseId) || colourById('greige');
    const wallLrv = lrvOf(base.hex);
    const accentHue = harmony === 'analogous' ? shiftHue(base.hex, 32)
        : harmony === 'complementary' ? shiftHue(base.hex, 180)
            : base.hex;
    const accent = harmony === 'neutral'
        ? (PAINT_COLOURS.find((entry) => entry.family === 'neutral' && lrvOf(entry.hex) < wallLrv - 12) || colourById('mushroom'))
        : {
            id: `accent-${harmony}`,
            label: harmony === 'complementary' ? `${base.label} complement` : `${base.label} neighbour`,
            hex: accentHue
        };
    const accentLrv = lrvOf(accent.hex);
    const trim = wallLrv >= 60
        ? PAINT_COLOURS.find((entry) => entry.family === 'white' && lrvOf(entry.hex) >= Math.min(wallLrv + 18, 96)) || colourById('chalk-white')
        : colourById('cotton-white');
    const ceiling = PAINT_COLOURS.filter((entry) => entry.family === 'white').sort((a, b) => lrvOf(b.hex) - lrvOf(a.hex))[0];
    return {
        harmony,
        wall: { id: base.id, label: base.label, hex: base.hex, lrv: wallLrv },
        trim: { id: trim.id, label: trim.label, hex: trim.hex, lrv: lrvOf(trim.hex) },
        accent: { id: accent.id || nearestColour(accent.hex).id, label: accent.label || nearestColour(accent.hex).label, hex: accent.hex, lrv: accentLrv },
        ceiling: { id: ceiling.id, label: ceiling.label, hex: ceiling.hex, lrv: lrvOf(ceiling.hex) },
        contrast: {
            trim: Math.abs(lrvOf(trim.hex) - wallLrv),
            accent: Math.abs(accentLrv - wallLrv),
            ceiling: Math.abs(lrvOf(ceiling.hex) - wallLrv)
        }
    };
}
