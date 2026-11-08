/**
 * Plumbing catalogue - the fixtures, water heaters, pipe sizes, materials and
 * finish grades the two-part rough-in / finish suite designs with.
 *
 * Sizes are nominal; costs are planning allowances in US dollars. Fixture
 * units follow the 2021 IPC tables closely enough for a residential layout,
 * but the suite is a design aid, not a stamped permit drawing.
 */

export const INCH = 0.0254;
export const FOOT = 0.3048;
export const LITRE_PER_GALLON = 3.78541;
export const PSI_PER_FOOT = 0.433;
export const BTU_PER_CF_NATURAL = 1030;
export const BTU_PER_CF_PROPANE = 2516;

export const HOOKUP_SIDES = ['north', 'south', 'east', 'west'];

export const GROUP_LABELS = {
    bath: 'Bathroom',
    kitchen: 'Kitchen',
    laundry: 'Laundry',
    utility: 'Utility',
    outdoor: 'Outdoor',
    gas: 'Fuel gas'
};

export const GROUP_COLOURS = {
    bath: '#dbeafe',
    kitchen: '#dcfce7',
    laundry: '#fef3c7',
    utility: '#f3e8ff',
    outdoor: '#e0f2fe',
    gas: '#ffedd5'
};

const fixture = (entry) => ({
    category: 'plumbing',
    group: 'bath',
    kind: 'fixture',
    width: 0.6,
    depth: 0.55,
    height: 0.8,
    wsfuCold: 0,
    wsfuHot: 0,
    dfu: 0,
    drainSize: null,
    supplySize: '1/2',
    trapArmMax: 1.5,
    clearFront: 0.533,
    clearSide: 0.381,
    requiresWater: true,
    requiresDrain: true,
    hasFaucet: false,
    gasBtu: 0,
    gasConnection: null,
    roughCost: 150,
    baseCost: 0,
    trimCost: 0,
    labourRough: 1.2,
    labourFinish: 0.9,
    ...entry
});

/**
 * Fixtures and appliances. `group` decides which drain stack serves the piece;
 * `wsfuCold` / `wsfuHot` are the water supply fixture units, `dfu` the drainage
 * fixture units, and `trapArmMax` the IPC horizontal trap-arm limit for the
 * fixture drain size.
 */
export const FIXTURE_TYPES = [
    fixture({
        id: 'toilet', label: 'Water closet', short: 'WC', tagPrefix: 'WC', group: 'bath',
        width: 0.38, depth: 0.72, height: 0.78, shape: 'toilet',
        wsfuCold: 2.5, wsfuHot: 0, dfu: 3, drainSize: '3', supplySize: '1/2', trapArmMax: 1.8,
        clearFront: 0.533, clearSide: 0.381,
        roughCost: 185, baseCost: 320, trimCost: 55, labourRough: 1.4, labourFinish: 1.2,
        notes: '15 in centre to a side wall and 21 in clear in front; a 3 in drain and a 2 in vent are the usual residential minimums.'
    }),
    fixture({
        id: 'lavatory', label: 'Lavatory', short: 'LAV', tagPrefix: 'L', group: 'bath',
        width: 0.56, depth: 0.48, height: 0.85, shape: 'lavatory',
        wsfuCold: 0.7, wsfuHot: 0.7, dfu: 1, drainSize: '1-1/4', supplySize: '1/2', trapArmMax: 1.5,
        hasFaucet: true,
        roughCost: 165, baseCost: 240, trimCost: 110, labourRough: 1.1, labourFinish: 1.0,
        notes: 'A 1-1/4 in trap arm is common; confirm the manufacturer allows the proposed waste and trap.'
    }),
    fixture({
        id: 'bathtub', label: 'Bathtub', short: 'TUB', tagPrefix: 'BT', group: 'bath',
        width: 1.7, depth: 0.76, height: 0.55, shape: 'tub',
        wsfuCold: 0.7, wsfuHot: 0.7, dfu: 2, drainSize: '2', supplySize: '1/2', trapArmMax: 1.8,
        hasFaucet: true, clearFront: 0.6,
        roughCost: 220, baseCost: 650, trimCost: 190, labourRough: 2.0, labourFinish: 2.2,
        notes: 'A 2 in waste and an overflow are required; a tub waste that is not accessible needs a cleanout.'
    }),
    fixture({
        id: 'shower', label: 'Shower', short: 'SH', tagPrefix: 'SH', group: 'bath',
        width: 0.92, depth: 0.92, height: 2.0, shape: 'shower',
        wsfuCold: 0.7, wsfuHot: 0.7, dfu: 2, drainSize: '2', supplySize: '1/2', trapArmMax: 1.8,
        hasFaucet: true, clearFront: 0.6,
        roughCost: 235, baseCost: 850, trimCost: 260, labourRough: 2.2, labourFinish: 2.0,
        notes: 'A 2 in drain, a sloped pan and a listed shower pan are typical; a curbless pan needs framing and waterproofing coordination.'
    }),
    fixture({
        id: 'bidet', label: 'Bidet', short: 'BD', tagPrefix: 'BD', group: 'bath',
        width: 0.38, depth: 0.55, height: 0.42, shape: 'bidet',
        wsfuCold: 0.7, wsfuHot: 0.7, dfu: 1, drainSize: '1-1/4', supplySize: '1/2', trapArmMax: 1.5,
        hasFaucet: true,
        roughCost: 170, baseCost: 420, trimCost: 120, labourRough: 1.1, labourFinish: 1.1,
        notes: 'Treat side and front clearances like a water closet.'
    }),
    fixture({
        id: 'kitchen-sink', label: 'Kitchen sink', short: 'KS', tagPrefix: 'KS', group: 'kitchen',
        width: 0.82, depth: 0.6, height: 0.9, shape: 'sink',
        wsfuCold: 0.7, wsfuHot: 0.7, dfu: 2, drainSize: '2', supplySize: '1/2', trapArmMax: 1.5,
        hasFaucet: true,
        roughCost: 190, baseCost: 380, trimCost: 180, labourRough: 1.2, labourFinish: 1.0,
        notes: 'A 1-1/2 in trap arm is common for a dwelling sink; a garbage disposer adds a second trap arm on the same trap.'
    }),
    fixture({
        id: 'dishwasher', label: 'Dishwasher', short: 'DW', tagPrefix: 'DW', group: 'kitchen',
        width: 0.6, depth: 0.62, height: 0.9, shape: 'dishwasher',
        wsfuCold: 0, wsfuHot: 1.0, dfu: 2, drainSize: '1-1/2', supplySize: '1/2', trapArmMax: 1.5,
        requiresWater: true, requiresDrain: true, hasFaucet: false,
        roughCost: 150, baseCost: 0, trimCost: 85, labourRough: 1.0, labourFinish: 0.8,
        notes: 'Hot-water supply, a 1-1/2 in waste, an air gap or a high loop, and a dedicated receptacle are typical.'
    }),
    fixture({
        id: 'bar-sink', label: 'Bar sink', short: 'BS', tagPrefix: 'BS', group: 'kitchen',
        width: 0.4, depth: 0.4, height: 0.85, shape: 'sink',
        wsfuCold: 0.7, wsfuHot: 0.7, dfu: 1, drainSize: '1-1/4', supplySize: '1/2', trapArmMax: 1.5,
        hasFaucet: true,
        roughCost: 130, baseCost: 180, trimCost: 90, labourRough: 0.9, labourFinish: 0.8,
        notes: 'A small sink still needs a trap and a vent; an island sink needs island venting.'
    }),
    fixture({
        id: 'washing-machine', label: 'Washing machine', short: 'WM', tagPrefix: 'WM', group: 'laundry',
        width: 0.69, depth: 0.66, height: 0.9, shape: 'washer',
        wsfuCold: 0.7, wsfuHot: 0.7, dfu: 2, drainSize: '2', supplySize: '1/2', trapArmMax: 1.8,
        requiresWater: true, requiresDrain: true, hasFaucet: false,
        roughCost: 185, baseCost: 0, trimCost: 95, labourRough: 1.4, labourFinish: 1.0,
        notes: 'A 2 in standpipe and a 2 in trap are common; the standpipe should be at least 18 in and not more than 42 in above the floor.'
    }),
    fixture({
        id: 'laundry-sink', label: 'Laundry sink', short: 'LS', tagPrefix: 'LS', group: 'laundry',
        width: 0.6, depth: 0.55, height: 0.9, shape: 'sink',
        wsfuCold: 0.7, wsfuHot: 0.7, dfu: 2, drainSize: '1-1/2', supplySize: '1/2', trapArmMax: 1.5,
        hasFaucet: true,
        roughCost: 155, baseCost: 280, trimCost: 120, labourRough: 1.1, labourFinish: 1.0,
        notes: 'Use a 1-1/2 in trap and a deep-seal trap where the fixture is rarely used.'
    }),
    fixture({
        id: 'utility-sink', label: 'Utility sink', short: 'US', tagPrefix: 'US', group: 'utility',
        width: 0.6, depth: 0.55, height: 0.9, shape: 'sink',
        wsfuCold: 0.7, wsfuHot: 0.7, dfu: 2, drainSize: '1-1/2', supplySize: '1/2', trapArmMax: 1.5,
        hasFaucet: true,
        roughCost: 155, baseCost: 260, trimCost: 110, labourRough: 1.1, labourFinish: 0.9,
        notes: 'A utility sink is a good place for a hose-bib vacuum breaker and a cleanout nearby.'
    }),
    fixture({
        id: 'floor-drain', label: 'Floor drain', short: 'FD', tagPrefix: 'FD', group: 'utility',
        width: 0.3, depth: 0.3, height: 0.05, shape: 'floor-drain',
        wsfuCold: 0, wsfuHot: 0, dfu: 2, drainSize: '2', supplySize: null, trapArmMax: 2.0,
        requiresWater: false, requiresDrain: true, hasFaucet: false,
        roughCost: 110, baseCost: 65, trimCost: 0, labourRough: 1.0, labourFinish: 0.2,
        notes: 'A floor drain needs a trap primer where the trap can dry out; a 2 in trap is the usual minimum.'
    }),
    fixture({
        id: 'hose-bib', label: 'Hose bib', short: 'HB', tagPrefix: 'HB', group: 'outdoor',
        width: 0.16, depth: 0.16, height: 0.2, shape: 'hose-bib',
        wsfuCold: 2.5, wsfuHot: 0, dfu: 0, drainSize: null, supplySize: '1/2', trapArmMax: 0,
        requiresWater: true, requiresDrain: false, hasFaucet: false,
        roughCost: 95, baseCost: 35, trimCost: 0, labourRough: 0.8, labourFinish: 0.3,
        notes: 'A vacuum breaker or a hose-bib backflow device is required; a frost-proof sillcock protects the pipe in cold climates.'
    }),
    fixture({
        id: 'gas-range', label: 'Gas range', short: 'RG', tagPrefix: 'RG', group: 'kitchen',
        width: 0.76, depth: 0.66, height: 0.9, shape: 'range',
        requiresWater: false, requiresDrain: false, gasBtu: 65000, gasConnection: '1/2',
        roughCost: 150, baseCost: 0, trimCost: 0, labourRough: 1.0, labourFinish: 0.5,
        notes: 'A shutoff in the same room, a sediment trap, and a listed appliance connector are the usual fuel-gas requirements.'
    }),
    fixture({
        id: 'gas-dryer', label: 'Gas dryer', short: 'DR', tagPrefix: 'DR', group: 'laundry',
        width: 0.69, depth: 0.66, height: 0.9, shape: 'dryer',
        requiresWater: false, requiresDrain: false, gasBtu: 22000, gasConnection: '1/2',
        roughCost: 125, baseCost: 0, trimCost: 0, labourRough: 0.9, labourFinish: 0.4,
        notes: 'A 1/2 in connection, a shutoff and a sediment trap; the dryer vent is a separate exhaust system.'
    }),
    fixture({
        id: 'gas-furnace', label: 'Gas furnace', short: 'FN', tagPrefix: 'FN', group: 'utility',
        width: 0.66, depth: 0.66, height: 1.4, shape: 'furnace',
        requiresWater: false, requiresDrain: false, gasBtu: 100000, gasConnection: '1/2',
        roughCost: 260, baseCost: 0, trimCost: 0, labourRough: 1.5, labourFinish: 0.5,
        notes: 'Sizing uses the connected load at full input; combustion air and venting are separate code checks.'
    }),
    fixture({
        id: 'gas-grill', label: 'Gas grill', short: 'GR', tagPrefix: 'GR', group: 'outdoor',
        width: 0.8, depth: 0.55, height: 0.9, shape: 'grill',
        requiresWater: false, requiresDrain: false, gasBtu: 40000, gasConnection: '1/2',
        roughCost: 145, baseCost: 0, trimCost: 0, labourRough: 1.0, labourFinish: 0.4,
        notes: 'Outdoor shutoff and a listed quick-disconnect; protect the line from UV and physical damage.'
    }),
    fixture({
        id: 'gas-fireplace', label: 'Gas fireplace', short: 'FP', tagPrefix: 'FP', group: 'utility',
        width: 0.9, depth: 0.4, height: 0.8, shape: 'fireplace',
        requiresWater: false, requiresDrain: false, gasBtu: 45000, gasConnection: '1/2',
        roughCost: 165, baseCost: 0, trimCost: 0, labourRough: 1.0, labourFinish: 0.5,
        notes: 'A shutoff, sediment trap and connector within the appliance enclosure; follow the listed clearances.'
    })
];

export const FIXTURE_COUNT = FIXTURE_TYPES.length;

const byId = new Map(FIXTURE_TYPES.map((entry) => [entry.id, entry]));

export function fixtureById(id) {
    return byId.get(id) || FIXTURE_TYPES[0];
}

export function fixturesForGroup(group) {
    return FIXTURE_TYPES.filter((entry) => entry.group === group);
}

export function isGasFixture(type) {
    return Boolean(type && type.gasBtu > 0);
}

/** Water heaters are equipment, not fixtures, but they live on the plan. */
const heater = (entry) => ({
    kind: 'water-heater',
    fuel: 'gas',
    tankGal: 50,
    width: 0.55,
    depth: 0.55,
    height: 1.5,
    mount: 'floor',
    firstHourGal: 70,
    recoveryGph: 40,
    gasBtu: 0,
    vent: 'B-vent',
    cost: 1200,
    installHours: 3.5,
    pan: true,
    expansionTank: true,
    reliefPipe: true,
    temperature: 120,
    ...entry
});

export const HEATER_TYPES = [
    heater({
        id: 'tank-40-gas', label: '40 gal gas tank', tankGal: 40, firstHourGal: 62, recoveryGph: 40, gasBtu: 40000,
        cost: 1050, installHours: 3.5, notes: 'A standard atmospheric tank; needs a vent, a T&P relief pipe and a drain pan.'
    }),
    heater({
        id: 'tank-50-gas', label: '50 gal gas tank', tankGal: 50, firstHourGal: 78, recoveryGph: 42, gasBtu: 50000,
        cost: 1280, installHours: 4.0, notes: 'The usual whole-house gas tank; confirm the flue and combustion air for the input.'
    }),
    heater({
        id: 'tank-50-hp', label: '50 gal heat-pump tank', tankGal: 50, firstHourGal: 65, recoveryGph: 24, fuel: 'electric',
        gasBtu: 0, vent: 'none', cost: 2900, installHours: 5.0, width: 0.62, depth: 0.62, height: 1.75,
        notes: 'Needs a condensate drain, air circulation and a 240 V circuit; no gas or flue.'
    }),
    heater({
        id: 'tankless-gas', label: 'Tankless gas', tankGal: 0, firstHourGal: 180, recoveryGph: 180, gasBtu: 199000,
        mount: 'wall', width: 0.45, depth: 0.28, height: 0.6, vent: 'PVC', cost: 2450, installHours: 5.5,
        notes: 'Size on the coldest incoming water and the fixtures that can run together; the gas line is usually oversized relative to a tank.'
    }),
    heater({
        id: 'tankless-electric', label: 'Tankless electric', tankGal: 0, firstHourGal: 120, recoveryGph: 120, fuel: 'electric',
        gasBtu: 0, mount: 'wall', width: 0.4, depth: 0.2, height: 0.55, vent: 'none', cost: 1350, installHours: 4.0,
        notes: 'Usually needs 240 V and a large dedicated circuit; confirm the service capacity before selecting.'
    })
];

export const HEATER_COUNT = HEATER_TYPES.length;
const heaters = new Map(HEATER_TYPES.map((entry) => [entry.id, entry]));

export function heaterById(id) {
    return heaters.get(id) || HEATER_TYPES[1];
}

/**
 * Nominal water pipe sizes. `pexId` and `copperId` are internal diameters in
 * inches, used for velocity and friction; `maxWsfu` is a conservative branch
 * capacity from the Hunter curves used by IPC Appendix E.
 */
export const WATER_PIPE_SIZES = [
    { id: '1/2', label: '1/2 in', pexId: 0.475, copperId: 0.545, maxWsfu: 6, maxServiceWsfu: 8, costPex: 4.2, costCopper: 13.5 },
    { id: '3/4', label: '3/4 in', pexId: 0.671, copperId: 0.785, maxWsfu: 12, maxServiceWsfu: 18, costPex: 6.4, costCopper: 19.5 },
    { id: '1', label: '1 in', pexId: 0.863, copperId: 0.995, maxWsfu: 25, maxServiceWsfu: 35, costPex: 9.8, costCopper: 28.5 },
    { id: '1-1/4', label: '1-1/4 in', pexId: 1.054, copperId: 1.245, maxWsfu: 45, maxServiceWsfu: 60, costPex: 14.5, costCopper: 40.0 },
    { id: '1-1/2', label: '1-1/2 in', pexId: 1.244, copperId: 1.481, maxWsfu: 75, maxServiceWsfu: 100, costPex: 18.5, costCopper: 51.0 },
    { id: '2', label: '2 in', pexId: 1.589, copperId: 1.959, maxWsfu: 130, maxServiceWsfu: 180, costPex: 26.0, costCopper: 69.0 }
];

export const WATER_PIPE_COUNT = WATER_PIPE_SIZES.length;
const waterSizes = new Map(WATER_PIPE_SIZES.map((entry) => [entry.id, entry]));

export function waterPipeSize(id) {
    return waterSizes.get(id) || WATER_PIPE_SIZES[1];
}

export const WATER_MATERIALS = [
    {
        id: 'pex', label: 'PEX-A', factor: 1, fittingFactor: 0.28, labourFactor: 1,
        note: 'Flexible, fewer fittings, freeze-tolerant; protect from UV and use listed fittings.'
    },
    {
        id: 'copper', label: 'Copper type L', factor: 3.1, fittingFactor: 0.38, labourFactor: 1.55,
        note: 'Long service life and familiar to inspectors; soldered joints need protection from fire.'
    },
    {
        id: 'pex-alum', label: 'PEX-AL-PEX', factor: 1.8, fittingFactor: 0.32, labourFactor: 1.15,
        note: 'Holds shape and resists UV better than plain PEX; use the manufacturer’s press or compression fittings.'
    }
];

const waterMaterials = new Map(WATER_MATERIALS.map((entry) => [entry.id, entry]));
export function waterMaterialById(id) {
    return waterMaterials.get(id) || WATER_MATERIALS[0];
}

/**
 * Drainage sizes with conservative horizontal-branch, stack and building-drain
 * capacities in fixture units. Slopes follow IPC Table 704.1: 2% up to 2-1/2 in,
 * 1% for 3 in to 6 in.
 */
export const DWV_SIZES = [
    { id: '1-1/4', label: '1-1/4 in', branchDfu: 1, stackDfu: 2, mainDfu: 1, minSlope: 0.02, costPvc: 4.6, costAbs: 5.2, costCast: 18 },
    { id: '1-1/2', label: '1-1/2 in', branchDfu: 3, stackDfu: 5, mainDfu: 3, minSlope: 0.02, costPvc: 5.8, costAbs: 6.4, costCast: 22 },
    { id: '2', label: '2 in', branchDfu: 6, stackDfu: 10, mainDfu: 6, minSlope: 0.02, costPvc: 7.8, costAbs: 8.6, costCast: 29 },
    { id: '3', label: '3 in', branchDfu: 20, stackDfu: 30, mainDfu: 42, minSlope: 0.02, costPvc: 12.5, costAbs: 13.8, costCast: 45 },
    { id: '4', label: '4 in', branchDfu: 100, stackDfu: 160, mainDfu: 160, minSlope: 0.01, costPvc: 18.5, costAbs: 20.5, costCast: 62 }
];

export const DWV_SIZE_COUNT = DWV_SIZES.length;
const dwvSizes = new Map(DWV_SIZES.map((entry) => [entry.id, entry]));

export function dwvSize(id) {
    return dwvSizes.get(id) || DWV_SIZES[2];
}

export const DWV_MATERIALS = [
    { id: 'pvc', label: 'PVC Schedule 40', factor: 1, fittingFactor: 0.32, labourFactor: 1, note: 'The usual residential DWV material; solvent welding needs clean, dry joints.' },
    { id: 'abs', label: 'ABS Schedule 40', factor: 1.08, fittingFactor: 0.32, labourFactor: 1, note: 'Common in some regions; check local acceptance and transition cement at material changes.' },
    { id: 'cast', label: 'Cast iron no-hub', factor: 3.4, fittingFactor: 0.45, labourFactor: 1.6, note: 'Quiet and fire-resistant; heavy, and the couplings need the listed torque.' }
];

const dwvMaterials = new Map(DWV_MATERIALS.map((entry) => [entry.id, entry]));
export function dwvMaterialById(id) {
    return dwvMaterials.get(id) || DWV_MATERIALS[0];
}

/**
 * Fuel-gas sizes with approximate capacity in cubic feet per hour at a 10 ft
 * equivalent length and 0.5 in w.c. pressure drop (natural gas). Capacity is
 * derated for longer runs; see `gasCapacity`.
 */
export const GAS_SIZES = [
    { id: '1/2', label: '1/2 in', idIn: 0.622, capacity10: 130, costSteel: 15, costCsst: 11 },
    { id: '3/4', label: '3/4 in', idIn: 0.824, capacity10: 280, costSteel: 21, costCsst: 15 },
    { id: '1', label: '1 in', idIn: 1.049, capacity10: 520, costSteel: 29, costCsst: 21 },
    { id: '1-1/4', label: '1-1/4 in', idIn: 1.380, capacity10: 1100, costSteel: 42, costCsst: 30 },
    { id: '1-1/2', label: '1-1/2 in', idIn: 1.610, capacity10: 1600, costSteel: 56, costCsst: 39 },
    { id: '2', label: '2 in', idIn: 2.067, capacity10: 3000, costSteel: 78, costCsst: 54 }
];

export const GAS_SIZE_COUNT = GAS_SIZES.length;
const gasSizes = new Map(GAS_SIZES.map((entry) => [entry.id, entry]));

export function gasSize(id) {
    return gasSizes.get(id) || GAS_SIZES[0];
}

export const GAS_MATERIALS = [
    { id: 'black-steel', label: 'Black steel Schedule 40', factor: 1, fittingFactor: 0.34, labourFactor: 1, note: 'Threaded steel is the traditional fuel-gas pipe; joints must be accessible unless the local code permits concealment.' },
    { id: 'csst', label: 'CSST', factor: 0.8, fittingFactor: 0.25, labourFactor: 0.72, note: 'Corrugated stainless tubing is fast to run; it needs bonding and the manufacturer’s strike protection.' }
];

const gasMaterials = new Map(GAS_MATERIALS.map((entry) => [entry.id, entry]));
export function gasMaterialById(id) {
    return gasMaterials.get(id) || GAS_MATERIALS[0];
}

export const FINISH_GRADES = [
    { id: 'standard', label: 'Builder standard', multiplier: 1, note: 'Reliable builder-grade fixtures and chrome trim.' },
    { id: 'premium', label: 'Premium', multiplier: 1.8, note: 'Comfort-height, better valves and a brushed or matte finish.' },
    { id: 'luxury', label: 'Luxury', multiplier: 3.0, note: 'Designer fixtures, solid-brass trim and specialty finishes.' }
];

const grades = new Map(FINISH_GRADES.map((entry) => [entry.id, entry]));
export function finishGradeById(id) {
    return grades.get(id) || FINISH_GRADES[0];
}

export const FAUCET_FINISHES = [
    { id: 'chrome', label: 'Chrome', cost: 0, note: 'The default; hardest and usually the cheapest.' },
    { id: 'brushed-nickel', label: 'Brushed nickel', cost: 45, note: 'Hides water spots better than polished chrome.' },
    { id: 'matte-black', label: 'Matte black', cost: 85, note: 'Trend finish; some matte coatings show soap residue.' },
    { id: 'brass', label: 'Unlacquered brass', cost: 145, note: 'Living finish that patinas; costs more and needs care.' }
];

const faucets = new Map(FAUCET_FINISHES.map((entry) => [entry.id, entry]));
export function faucetFinishById(id) {
    return faucets.get(id) || FAUCET_FINISHES[0];
}

export const PLAN_TEMPLATES = [
    {
        id: 'house',
        label: 'Whole house',
        width: 11.5,
        depth: 8.5,
        fixtures: ['toilet', 'lavatory', 'bathtub', 'kitchen-sink', 'dishwasher', 'washing-machine', 'gas-dryer', 'gas-range', 'gas-furnace', 'floor-drain', 'hose-bib'],
        heater: 'tank-50-gas'
    },
    {
        id: 'bath',
        label: 'Bathroom core',
        width: 5.4,
        depth: 4.4,
        fixtures: ['toilet', 'lavatory', 'bathtub'],
        heater: 'tank-50-gas'
    },
    {
        id: 'kitchen-laundry',
        label: 'Kitchen + laundry',
        width: 7.8,
        depth: 6.4,
        fixtures: ['kitchen-sink', 'dishwasher', 'washing-machine', 'gas-dryer', 'gas-range'],
        heater: 'tank-50-gas'
    },
    {
        id: 'adu',
        label: 'ADU / basement flat',
        width: 8.4,
        depth: 6.8,
        fixtures: ['toilet', 'lavatory', 'shower', 'kitchen-sink', 'washing-machine', 'gas-range', 'gas-furnace', 'floor-drain'],
        heater: 'tank-50-gas'
    }
];

const templates = new Map(PLAN_TEMPLATES.map((entry) => [entry.id, entry]));
export function templateById(id) {
    return templates.get(id) || PLAN_TEMPLATES[0];
}

export const CLEANOUT_COST = 42;
export const VENT_FLASHING_COST = 38;
export const HANGER_COST = 2.4;
export const SUPPLY_STOP_COST = 18;
export const TRAP_TRIM_COST = 26;
export const GAS_SEDIMENT_TRAP_COST = 26;
export const GAS_SHUTOFF_COST = 28;
export const GAS_CONNECTOR_COST = 34;
export const WATER_SERVICE_TAP_COST = 850;
export const SEWER_TAP_COST = 1200;
export const GAS_METER_SET_COST = 420;
export const PRV_COST = 165;
export const EXPANSION_TANK_COST = 195;
export const HEATER_PAN_COST = 65;
export const RELIEF_PIPE_COST = 85;
export const INSULATION_COST_PER_M = 4.2;
export const LABOUR_RATE_ROUGH = 95;
export const LABOUR_RATE_FINISH = 85;
