/**
 * Roof materials - the layer and rain-gutter catalogue behind the suite.
 *
 * Every covering carries its slope window, coverage per square, installed cost
 * and dead load, so the design engine can both price it and check that the roof
 * pitch, the truss spacing and the sheathing are suitable.
 */

export const SQUARE_M2 = 9.2903; // 100 sq ft, the roofing "square"
export const SHEET_M2 = 1.22 * 2.44;

export const SHEATHING = [
    {
        id: 'osb-716',
        label: '7/16 in OSB',
        thicknessMm: 11.1,
        sheet: { width: 1.22, height: 2.44 },
        nailSpacingMm: 150,
        edgeSupport: true,
        costPerSheet: 21,
        note: 'Lightest and cheapest deck for shingle and metal roofs at 24 in o.c.'
    },
    {
        id: 'ply-1532',
        label: '15/32 in plywood',
        thicknessMm: 11.9,
        sheet: { width: 1.22, height: 2.44 },
        nailSpacingMm: 150,
        edgeSupport: true,
        costPerSheet: 34,
        note: 'Stiffer than OSB, better for tile and slate where point loads matter.'
    },
    {
        id: 'ply-1932',
        label: '19/32 in plywood',
        thicknessMm: 15.1,
        sheet: { width: 1.22, height: 2.44 },
        nailSpacingMm: 100,
        edgeSupport: true,
        costPerSheet: 46,
        note: 'Heavy coverings and 24 in o.c. trusses; also a better nail base for slate.'
    }
];

export const UNDERLAYMENT = [
    {
        id: 'felt-15',
        label: '15 lb felt',
        rollCoverageM2: 92.9,
        costPerRoll: 38,
        minPitch: 2,
        note: 'Traditional tar paper; needs a dry day and a smooth deck.'
    },
    {
        id: 'felt-30',
        label: '30 lb felt',
        rollCoverageM2: 92.9,
        costPerRoll: 55,
        minPitch: 1,
        note: 'Heavier felt for lower slopes and longer exposure before covering.'
    },
    {
        id: 'synthetic',
        label: 'Synthetic underlayment',
        rollCoverageM2: 92.9,
        costPerRoll: 118,
        minPitch: 1,
        note: 'Tear-resistant, slip-resistant and lighter than felt.'
    },
    {
        id: 'peel-stick',
        label: 'Peel-and-stick membrane',
        rollCoverageM2: 18.6,
        costPerRoll: 145,
        minPitch: 0.25,
        note: 'Self-adhering waterproof layer for the whole deck or the eaves only.'
    }
];

export const COVERINGS = [
    {
        id: 'asphalt-3tab',
        label: '3-tab asphalt shingle',
        family: 'shingle',
        minPitch: 2,
        maxPitch: 20,
        unit: 'bundle',
        unitsPerSquare: 3,
        costPerSquare: 115,
        weightKgM2: 8.5,
        lifeYears: 25,
        starterLfPerUnit: 35,
        ridgeCapLfPerUnit: 35,
        warranty: '25-year limited',
        note: 'Flat, single-layer tabs; the budget choice for simple gable roofs.'
    },
    {
        id: 'asphalt-arch',
        label: 'Architectural (dimensional) shingle',
        family: 'shingle',
        minPitch: 2,
        maxPitch: 20,
        unit: 'bundle',
        unitsPerSquare: 3,
        costPerSquare: 155,
        weightKgM2: 11,
        lifeYears: 30,
        starterLfPerUnit: 35,
        ridgeCapLfPerUnit: 35,
        warranty: '30-year limited',
        note: 'Multi-layer laminated tabs; the default residential covering.'
    },
    {
        id: 'metal-standing-seam',
        label: 'Standing-seam metal',
        family: 'metal',
        minPitch: 3,
        maxPitch: 24,
        unit: 'square',
        unitsPerSquare: 1,
        costPerSquare: 520,
        weightKgM2: 6.5,
        lifeYears: 50,
        starterLfPerUnit: 0,
        ridgeCapLfPerUnit: 0,
        warranty: '40-year finish / 50-year substrate',
        note: 'Concealed fasteners, longest service life; needs a minimum 3:12 pitch.'
    },
    {
        id: 'clay-tile',
        label: 'Clay barrel tile',
        family: 'tile',
        minPitch: 4,
        maxPitch: 16,
        unit: 'tile',
        unitsPerSquare: 100,
        costPerSquare: 920,
        weightKgM2: 45,
        lifeYears: 50,
        starterLfPerUnit: 0,
        ridgeCapLfPerUnit: 0,
        warranty: '50-year material',
        note: 'Heavy clay units on battens; the truss and sheathing must be sized for the load.'
    },
    {
        id: 'concrete-tile',
        label: 'Concrete tile',
        family: 'tile',
        minPitch: 4,
        maxPitch: 16,
        unit: 'tile',
        unitsPerSquare: 95,
        costPerSquare: 690,
        weightKgM2: 50,
        lifeYears: 50,
        starterLfPerUnit: 0,
        ridgeCapLfPerUnit: 0,
        warranty: '50-year material',
        note: 'Lower cost than clay at similar weight; needs battens and a 4:12 minimum.'
    },
    {
        id: 'slate',
        label: 'Natural slate',
        family: 'tile',
        minPitch: 4,
        maxPitch: 24,
        unit: 'slate',
        unitsPerSquare: 220,
        costPerSquare: 1650,
        weightKgM2: 55,
        lifeYears: 75,
        starterLfPerUnit: 0,
        ridgeCapLfPerUnit: 0,
        warranty: '75-year material',
        note: 'Premium natural stone; the heaviest common roof and the longest lived.'
    },
    {
        id: 'modified-bitumen',
        label: 'Modified bitumen membrane',
        family: 'low-slope',
        minPitch: 1,
        maxPitch: 4,
        unit: 'roll',
        unitsPerSquare: 1,
        costPerSquare: 210,
        weightKgM2: 5.5,
        lifeYears: 20,
        starterLfPerUnit: 0,
        ridgeCapLfPerUnit: 0,
        warranty: '15-year material',
        note: 'Torch-applied or self-adhered roll for porch and low-slope roofs.'
    },
    {
        id: 'bur',
        label: 'Built-up roof (3-ply BUR)',
        family: 'low-slope',
        minPitch: 0.25,
        maxPitch: 3,
        unit: 'ply-square',
        unitsPerSquare: 3,
        costPerSquare: 460,
        weightKgM2: 12,
        lifeYears: 25,
        starterLfPerUnit: 0,
        ridgeCapLfPerUnit: 0,
        warranty: '20-year system',
        note: 'Alternating asphalt and ply sheets with a cap sheet or gravel surface.'
    },
    {
        id: 'tpo',
        label: 'Single-ply TPO / EPDM',
        family: 'low-slope',
        minPitch: 0.25,
        maxPitch: 3,
        unit: 'square',
        unitsPerSquare: 1,
        costPerSquare: 420,
        weightKgM2: 2.5,
        lifeYears: 25,
        starterLfPerUnit: 0,
        ridgeCapLfPerUnit: 0,
        warranty: '20-year membrane',
        note: 'Light single membrane for flat roofs; heat-welded seams, no granules.'
    },
    {
        id: 'roll-roofing',
        label: 'Roll roofing',
        family: 'low-slope',
        minPitch: 1,
        maxPitch: 4,
        unit: 'roll',
        unitsPerSquare: 1,
        costPerSquare: 130,
        weightKgM2: 4.5,
        lifeYears: 10,
        starterLfPerUnit: 0,
        ridgeCapLfPerUnit: 0,
        warranty: '5-year material',
        note: 'Economical rolled asphalt for sheds, porches and outbuildings.'
    }
];

export const GUTTER_SYSTEMS = [
    {
        id: 'k5-alum',
        label: '5 in K-style aluminium',
        widthIn: 5,
        material: 'Aluminium',
        capacityLpm: 70,
        maxRoofAreaM2: 55,
        costPerLf: 9,
        downspout: '2 × 3 in rectangular',
        downspoutCostEach: 14,
        hangerSpacingM: 0.6,
        note: 'The standard residential profile; painted aluminium is light and rust-free.'
    },
    {
        id: 'k6-alum',
        label: '6 in K-style aluminium',
        widthIn: 6,
        material: 'Aluminium',
        capacityLpm: 115,
        maxRoofAreaM2: 95,
        costPerLf: 12,
        downspout: '3 × 4 in rectangular',
        downspoutCostEach: 18,
        hangerSpacingM: 0.6,
        note: 'Larger capacity for long runs and big roof areas.'
    },
    {
        id: 'half-round-5',
        label: '5 in half-round aluminium',
        widthIn: 5,
        material: 'Aluminium',
        capacityLpm: 60,
        maxRoofAreaM2: 45,
        costPerLf: 14,
        downspout: '3 in round',
        downspoutCostEach: 16,
        hangerSpacingM: 0.5,
        note: 'Traditional profile for heritage and tile roofs; needs more hangers.'
    },
    {
        id: 'box-4',
        label: '4 in box steel',
        widthIn: 4,
        material: 'Painted steel',
        capacityLpm: 55,
        maxRoofAreaM2: 40,
        costPerLf: 16,
        downspout: '3 in round',
        downspoutCostEach: 18,
        hangerSpacingM: 0.6,
        note: 'Strong box section for commercial and outbuilding roofs.'
    },
    {
        id: 'copper-k6',
        label: '6 in K-style copper',
        widthIn: 6,
        material: 'Copper',
        capacityLpm: 115,
        maxRoofAreaM2: 95,
        costPerLf: 42,
        downspout: '3 × 4 in copper',
        downspoutCostEach: 65,
        hangerSpacingM: 0.6,
        note: 'Premium patina finish with a 70+ year service life.'
    }
];

/** Flashing, ventilation and trim items priced per metre or per piece. */
export const FLASHING = {
    dripEdgePerM: 6,
    valleyPerM: 18,
    stepPerM: 12,
    counterPerM: 16,
    apronPerM: 16,
    kickoutEach: 14,
    gutterApronPerM: 7,
    iceShieldPerM2: 14,
    pipeBootEach: 12,
    ridgeVentPerM: 22,
    soffitVentPerM: 9,
    cricketEach: 180
};

export const LABOUR = {
    tearOffPerSquare: 90,
    overlayPerSquare: 0,
    installPerSquare: 140,
    gutterPerLf: 6,
    flashingPerM: 9
};

export function sheathingById(id) {
    return SHEATHING.find((entry) => entry.id === id) || SHEATHING[0];
}

export function underlaymentById(id) {
    return UNDERLAYMENT.find((entry) => entry.id === id) || UNDERLAYMENT[0];
}

export function coveringById(id) {
    return COVERINGS.find((entry) => entry.id === id) || COVERINGS[1];
}

export function gutterById(id) {
    return GUTTER_SYSTEMS.find((entry) => entry.id === id) || GUTTER_SYSTEMS[0];
}
