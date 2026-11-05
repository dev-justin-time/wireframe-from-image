/**
 * Electrical catalogue: conductors, overcurrent devices, boxes and loads.
 *
 * Ampacities and areas are NEC 2021 values: Table 310.16 for conductor
 * ampacity, Chapter 9 Table 8 for resistance, Table 5 for THHN areas and
 * Table 4 for conduit areas, Table 314.16(B) for box volumes and Table 250.122
 * for equipment grounding conductors. They are model values, not a listing.
 */

export const AWG = [
    { size: '14', amp60: 15, amp75: 20, amp90: 25, resistance: 3.07, areaThhn: 0.0097 },
    { size: '12', amp60: 20, amp75: 25, amp90: 30, resistance: 1.93, areaThhn: 0.0133 },
    { size: '10', amp60: 30, amp75: 35, amp90: 40, resistance: 1.21, areaThhn: 0.0211 },
    { size: '8', amp60: 40, amp75: 50, amp90: 55, resistance: 0.764, areaThhn: 0.0366 },
    { size: '6', amp60: 55, amp75: 65, amp90: 75, resistance: 0.491, areaThhn: 0.0507 },
    { size: '4', amp60: 70, amp75: 85, amp90: 95, resistance: 0.308, areaThhn: 0.0824 },
    { size: '3', amp60: 85, amp75: 100, amp90: 115, resistance: 0.245, areaThhn: 0.0973 },
    { size: '2', amp60: 95, amp75: 115, amp90: 130, resistance: 0.194, areaThhn: 0.1158 },
    { size: '1', amp60: 110, amp75: 130, amp90: 145, resistance: 0.154, areaThhn: 0.1562 },
    { size: '1/0', amp60: 125, amp75: 150, amp90: 170, resistance: 0.122, areaThhn: 0.1855 },
    { size: '2/0', amp60: 145, amp75: 175, amp90: 195, resistance: 0.0967, areaThhn: 0.2223 },
    { size: '3/0', amp60: 165, amp75: 200, amp90: 225, resistance: 0.0766, areaThhn: 0.2679 },
    { size: '4/0', amp60: 195, amp75: 230, amp90: 260, resistance: 0.0608, areaThhn: 0.3237 },
    { size: '250 kcmil', amp60: 215, amp75: 255, amp90: 290, resistance: 0.0515, areaThhn: 0.3908 },
    { size: '350 kcmil', amp60: 240, amp75: 310, amp90: 350, resistance: 0.0367, areaThhn: 0.5242 },
    { size: '400 kcmil', amp60: 260, amp75: 335, amp90: 380, resistance: 0.0321, areaThhn: 0.5958 },
    { size: '500 kcmil', amp60: 290, amp75: 380, amp90: 430, resistance: 0.0258, areaThhn: 0.7400 }
];

export const STANDARD_BREAKERS = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400];

export const STANDARD_SERVICES = [100, 125, 150, 200, 225, 320, 400];

export const CONDUCTOR_TYPES = [
    { id: 'thhn-copper', label: 'THHN copper in conduit', column: 'amp75', note: '75 °C terminals, conduit wiring method.' },
    { id: 'nm-b', label: 'NM-B copper cable', column: 'amp60', note: '334.80 limits NM-B to the 60 °C column.' },
    { id: 'xhhw-al', label: 'XHHW aluminium', column: 'amp75', note: 'Aluminium needs one size larger than copper and listed connectors.' }
];

export const CONDUITS = [
    { id: 'emt-1/2', label: 'EMT 1/2 in', area: 0.304, costPerM: 3.4 },
    { id: 'emt-3/4', label: 'EMT 3/4 in', area: 0.533, costPerM: 4.3 },
    { id: 'emt-1', label: 'EMT 1 in', area: 0.864, costPerM: 5.8 },
    { id: 'emt-1-1/4', label: 'EMT 1 1/4 in', area: 1.496, costPerM: 8.1 },
    { id: 'emt-1-1/2', label: 'EMT 1 1/2 in', area: 2.036, costPerM: 9.6 },
    { id: 'emt-2', label: 'EMT 2 in', area: 3.356, costPerM: 12.4 },
    { id: 'emt-2-1/2', label: 'EMT 2 1/2 in', area: 3.484, costPerM: 16.2 },
    { id: 'emt-3', label: 'EMT 3 in', area: 5.211, costPerM: 21.5 },
    { id: 'pvc-2', label: 'PVC schedule 40, 2 in', area: 2.874, costPerM: 6.2 },
    { id: 'pvc-2-1/2', label: 'PVC schedule 40, 2 1/2 in', area: 4.149, costPerM: 8.9 },
    { id: 'pvc-3', label: 'PVC schedule 40, 3 in', area: 6.0, costPerM: 11.4 },
    { id: 'pvc-4', label: 'PVC schedule 40, 4 in', area: 10.0, costPerM: 16.8 }
];

/** Table 314.16(B): volume allowance per conductor, cubic inches. */
export const BOX_VOLUME_PER_CONDUCTOR = {
    '14': 2.0,
    '12': 2.25,
    '10': 2.5,
    '8': 3.0,
    '6': 5.0
};

export const BOXES = [
    { id: '4x4x1.5', label: '4 × 4 × 1 1/2 in box', volume: 21.5, cost: 2.4 },
    { id: '4x4x2.125', label: '4 × 4 × 2 1/8 in box', volume: 30.3, cost: 3.1 },
    { id: '4-11/16x2.125', label: '4 11/16 × 2 1/8 in box', volume: 42.0, cost: 4.6 },
    { id: 'octagon-1.5', label: 'Octagon 1 1/2 in box', volume: 15.5, cost: 2.2 }
];

/** Table 250.122: minimum equipment grounding conductor by OCPD rating. */
export function equipmentGroundFor(breakerAmps) {
    const table = [
        [15, '14'], [20, '12'], [60, '10'], [100, '8'], [200, '6'],
        [300, '4'], [400, '3'], [500, '2'], [600, '1/0'], [800, '2/0'],
        [1200, '3/0']
    ];
    return (table.find(([amps]) => breakerAmps <= amps) || [Infinity, '4/0'])[1];
}

/** Table 250.66: grounding electrode conductor by service conductor size. */
export function groundingElectrodeFor(serviceSize) {
    const order = ['14', '12', '10', '8', '6', '4', '3', '2', '1', '1/0', '2/0', '3/0', '4/0', '250 kcmil', '350 kcmil', '400 kcmil', '500 kcmil'];
    const limits = [
        ['2', '8'], ['1/0', '6'], ['3/0', '4'], ['350 kcmil', '2'], ['600 kcmil', '1/0'], ['1100 kcmil', '2/0']
    ];
    const index = order.indexOf(serviceSize);
    for (const [limit, gec] of limits) {
        const limitIndex = order.indexOf(limit);
        if (limitIndex === -1 || index <= limitIndex) return gec;
    }
    return '3/0';
}

/**
 * Circuit templates the suite starts from. `va` is the connected load, `va` at
 * `voltage` gives the amps; `breaker` is the usual overcurrent size.
 */
export const CIRCUIT_TEMPLATES = [
    { id: 'lighting', label: 'General lighting', voltage: 120, va: 1440, breaker: 15, gfci: false, afci: true, category: 'general' },
    { id: 'sabc', label: 'Small-appliance (kitchen)', voltage: 120, va: 1500, breaker: 20, gfci: true, afci: true, category: 'general' },
    { id: 'laundry', label: 'Laundry', voltage: 120, va: 1500, breaker: 20, gfci: true, afci: true, category: 'general' },
    { id: 'bathroom', label: 'Bathroom receptacle', voltage: 120, va: 1500, breaker: 20, gfci: true, afci: false, category: 'general' },
    { id: 'outdoor', label: 'Outdoor receptacle', voltage: 120, va: 1500, breaker: 20, gfci: true, afci: true, category: 'general' },
    { id: 'garage', label: 'Garage receptacle', voltage: 120, va: 1800, breaker: 20, gfci: true, afci: true, category: 'general' },
    { id: 'range', label: 'Electric range', voltage: 240, va: 8000, breaker: 40, gfci: false, afci: false, category: 'appliance' },
    { id: 'dryer', label: 'Clothes dryer', voltage: 240, va: 5000, breaker: 30, gfci: false, afci: false, category: 'appliance' },
    { id: 'water-heater', label: 'Water heater', voltage: 240, va: 4500, breaker: 30, gfci: false, afci: false, category: 'appliance' },
    { id: 'dishwasher', label: 'Dishwasher', voltage: 120, va: 1500, breaker: 20, gfci: true, afci: true, category: 'appliance' },
    { id: 'disposal', label: 'Food-waste disposer', voltage: 120, va: 1000, breaker: 20, gfci: true, afci: true, category: 'appliance' },
    { id: 'microwave', label: 'Microwave', voltage: 120, va: 1500, breaker: 20, gfci: true, afci: true, category: 'appliance' },
    { id: 'ac', label: 'Air conditioner', voltage: 240, va: 5500, breaker: 30, gfci: false, afci: false, category: 'hvac' },
    { id: 'heating', label: 'Electric heat', voltage: 240, va: 9000, breaker: 50, gfci: false, afci: false, category: 'hvac' },
    { id: 'ev', label: 'EV charger', voltage: 240, va: 9600, breaker: 50, gfci: true, afci: false, category: 'appliance' },
    { id: 'pool', label: 'Pool pump', voltage: 240, va: 1500, breaker: 20, gfci: true, afci: false, category: 'motor' },
    { id: 'spa', label: 'Hot tub', voltage: 240, va: 6000, breaker: 50, gfci: true, afci: false, category: 'appliance' },
    { id: 'well-pump', label: 'Well pump', voltage: 240, va: 1500, breaker: 20, gfci: false, afci: false, category: 'motor' },
    { id: 'subpanel', label: 'Detached-building feeder', voltage: 240, va: 12000, breaker: 60, gfci: false, afci: false, category: 'feeder' }
];

export const APPLIANCE_KEYS = [
    'range', 'dryer', 'waterHeater', 'dishwasher', 'disposal', 'microwave',
    'ac', 'heating', 'ev', 'pool', 'spa', 'wellPump'
];

export const PANELS = [
    { id: 'loadcentre-200', label: '200 A, 40-space loadcentre', amps: 200, spaces: 40, cost: 320 },
    { id: 'loadcentre-125', label: '125 A, 24-space loadcentre', amps: 125, spaces: 24, cost: 210 },
    { id: 'meter-main-200', label: '200 A meter-main', amps: 200, spaces: 40, cost: 480 },
    { id: 'panel-400', label: '400 A, 42-space panel', amps: 400, spaces: 42, cost: 980 }
];

export const BREAKER_PRICES = {
    15: 9, 20: 10, 25: 13, 30: 14, 35: 16, 40: 18, 45: 22, 50: 24,
    60: 32, 70: 40, 80: 48, 90: 56, 100: 64, 110: 78, 125: 92, 150: 118,
    175: 140, 200: 168, 225: 198, 250: 232, 300: 310, 350: 380, 400: 450
};

export const DEVICES = {
    receptacle: { label: 'Duplex receptacle', unit: 'each', cost: 2.6 },
    gfci: { label: 'GFCI receptacle', unit: 'each', cost: 22 },
    switch: { label: 'Single-pole switch', unit: 'each', cost: 3.4 },
    box: { label: 'Device box', unit: 'each', cost: 3.1 },
    cover: { label: 'Weatherproof in-use cover', unit: 'each', cost: 12 },
    groundRod: { label: 'Ground rod, 8 ft', unit: 'each', cost: 19 },
    acorn: { label: 'Ground-rod acorn', unit: 'each', cost: 3.2 },
    gec: { label: 'Grounding electrode conductor (per m)', unit: 'm', cost: 4.6 },
    bond: { label: 'Bonding jumper', unit: 'each', cost: 4.1 },
    label: { label: 'Panel directory and labels', unit: 'set', cost: 8 }
};

export function awgBySize(size) {
    return AWG.find((entry) => entry.size === String(size)) || AWG[0];
}

export function ampacityFor(size, column = 'amp75') {
    const entry = awgBySize(size);
    return entry ? entry[column] : 0;
}

export function breakerPrice(amps) {
    const standard = STANDARD_BREAKERS.find((size) => size >= amps) || amps;
    return BREAKER_PRICES[standard] ?? 100;
}

export function nextBreaker(amps) {
    return STANDARD_BREAKERS.find((size) => size >= amps - 1e-9) || STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];
}

export function nextService(amps) {
    return STANDARD_SERVICES.find((size) => size >= amps - 1e-9) || STANDARD_SERVICES[STANDARD_SERVICES.length - 1];
}

/** Cheap conductor allowance per metre, by size and method. */
export function conductorPrice(size, type = 'thhn-copper') {
    const base = {
        '14': 1.3, '12': 1.8, '10': 2.9, '8': 4.6, '6': 7.2, '4': 11.5,
        '3': 14.2, '2': 17.8, '1': 22.4, '1/0': 28.6, '2/0': 34.2,
        '3/0': 41.5, '4/0': 49.8, '250 kcmil': 62.4, '350 kcmil': 84.0,
        '400 kcmil': 96.0, '500 kcmil': 118.0
    }[String(size)] ?? 20;
    const factor = type === 'nm-b' ? 1.15 : type === 'xhhw-al' ? 0.8 : 1;
    return Math.round(base * factor * 100) / 100;
}

export const SERVICE_TYPES = [
    { id: 'overhead', label: 'Overhead service drop' },
    { id: 'underground', label: 'Underground service lateral' }
];

export const ELECTRICAL_DEFAULTS = {
    areaM2: 180,
    storeys: 2,
    sabc: 2,
    laundry: true,
    bathroom: 2,
    method: 'standard',
    appliances: {
        range: 8000,
        dryer: 5000,
        waterHeater: 4500,
        dishwasher: 1500,
        disposal: 1000,
        microwave: 1500,
        ac: 5500,
        heating: 9000,
        ev: 0,
        pool: 0,
        spa: 0,
        wellPump: 0
    },
    conductor: 'thhn-copper',
    panel: 'loadcentre-200',
    panelSpaces: 40,
    feederLengthM: 18,
    branchLengthM: 14,
    ambientC: 30,
    currentCarrying: 3,
    serviceType: 'overhead',
    groundingElectrodes: 2,
    outdoorReceptacle: true,
    afci: true
};
