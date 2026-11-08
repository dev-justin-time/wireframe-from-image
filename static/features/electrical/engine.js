import {
    APPLIANCE_KEYS,
    AWG,
    BOX_VOLUME_PER_CONDUCTOR,
    BOXES,
    BREAKER_PRICES,
    CIRCUIT_TEMPLATES,
    CONDUITS,
    DEVICES,
    ELECTRICAL_DEFAULTS,
    PANELS,
    STANDARD_BREAKERS,
    ampacityFor,
    awgBySize,
    breakerPrice,
    conductorPrice,
    equipmentGroundFor,
    groundingElectrodeFor,
    nextBreaker,
    nextService
} from './catalog.js';

/**
 * Electrical panel and circuit engine.
 *
 * The demand calculation follows NEC Article 220: the 220.42 tiers for the
 * general load, 220.53 for appliances, 220.60 for heating and cooling, and
 * 220.82 for the optional dwelling method. Conductor ampacity comes from Table
 * 310.16 with the ambient and conductor-count adjustments of 310.15(C)(1), so
 * the breaker, the conductor and the voltage drop always agree.
 */

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

const ceil = (value) => Math.ceil(Math.max(Number(value) || 0, 0) - 1e-9);
const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
const templateById = (id) => CIRCUIT_TEMPLATES.find((entry) => entry.id === id) || CIRCUIT_TEMPLATES[0];

/** Lighting load: 3 VA per square foot, 33 VA per square metre (220.12). */
export function lightingLoadVa(areaM2) {
    return Math.max(Number(areaM2) || 0, 0) * 33;
}

/** 220.42 demand tiers for the general lighting and small-appliance load. */
export function generalDemand(generalVa) {
    const total = Math.max(Number(generalVa) || 0, 0);
    const first = Math.min(total, 3000);
    const second = Math.min(Math.max(total - 3000, 0), 117000);
    const third = Math.max(total - 120000, 0);
    return {
        va: round(first + second * 0.35 + third * 0.25, 1),
        first: round(first, 1),
        second: round(second, 1),
        third: round(third, 1)
    };
}

/** Ambient correction factor, interpolated from Table 310.15(B)(1) at 30 °C base. */
export function ambientFactor(celsius) {
    const table = [
        [10, 1.22], [15, 1.15], [20, 1.08], [25, 1.04], [30, 1.0],
        [35, 0.94], [40, 0.88], [45, 0.82], [50, 0.75], [55, 0.67], [60, 0.58]
    ];
    const value = clamp(celsius, 10, 60);
    for (let index = 1; index < table.length; index += 1) {
        const [highTemp, highFactor] = table[index];
        if (value <= highTemp) {
            const [lowTemp, lowFactor] = table[index - 1];
            const t = (value - lowTemp) / (highTemp - lowTemp);
            return round(lowFactor + (highFactor - lowFactor) * t, 3);
        }
    }
    return 0.58;
}

/** Conductor-count adjustment from 310.15(C)(1). */
export function conductorCountFactor(count) {
    if (count <= 3) return 1;
    if (count <= 6) return 0.8;
    if (count <= 9) return 0.7;
    if (count <= 20) return 0.5;
    return 0.45;
}

export function adjustedAmpacity(size, { column = 'amp75', ambientC = 30, currentCarrying = 3 } = {}) {
    const base = ampacityFor(size, column);
    return round(base * ambientFactor(ambientC) * conductorCountFactor(currentCarrying), 2);
}

/** Smallest conductor whose adjusted ampacity carries the current. */
export function conductorFor(amps, options = {}) {
    const limit = Math.max(Number(amps) || 0, 1);
    return AWG.find((entry) => adjustedAmpacity(entry.size, options) >= limit)?.size
        || AWG[AWG.length - 1].size;
}

/** Voltage drop percent for a single-phase run, Table 8 resistance. */
export function voltageDropPercent({ amps, lengthM, size, voltage = 240 }) {
    const resistance = awgBySize(size).resistance; // ohms per 1,000 ft
    const ohmsPerM = resistance / 304.8;
    const drop = 2 * Math.max(lengthM, 0) * Math.max(amps, 0) * ohmsPerM;
    return round((drop / Math.max(voltage, 1)) * 100, 2);
}

/** Panels that can carry the service and the space count. */
export function panelFor(amps, spaces = 0, id = null) {
    if (id) {
        const chosen = PANELS.find((entry) => entry.id === id);
        if (chosen && chosen.amps >= amps && chosen.spaces >= spaces) return chosen;
    }
    const candidates = PANELS
        .filter((entry) => entry.amps >= amps && entry.spaces >= spaces)
        .sort((a, b) => (a.amps - b.amps) || (a.spaces - b.spaces));
    return candidates[0] || PANELS[PANELS.length - 1];
}

function circuitFor(template, config, overrides = {}) {
    const entry = { ...template, ...overrides };
    const voltage = entry.voltage;
    const va = Number(entry.va) || 0;
    const amps = voltage ? va / voltage : 0;
    const continuous = entry.id === 'ev' || entry.continuous === true;
    const designAmps = amps * (continuous ? 1.25 : 1);
    const breaker = Math.max(entry.breaker || 0, nextBreaker(designAmps));
    const column = config.conductor === 'nm-b' ? 'amp60' : 'amp75';
    const conductor = conductorFor(breaker, { column, ambientC: config.ambientC, currentCarrying: config.currentCarrying });
    const drop = voltageDropPercent({ amps, lengthM: config.branchLengthM, size: conductor, voltage });
    return {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        voltage,
        va: round(va, 0),
        amps: round(amps, 1),
        breaker,
        conductor,
        egc: equipmentGroundFor(breaker),
        gfci: Boolean(entry.gfci),
        afci: Boolean(entry.afci) && config.afci,
        vdPercent: drop,
        continuous,
        note: entry.note || ''
    };
}

/** Build the panel schedule from the load list. */
export function buildCircuits(config) {
    const circuits = [];
    const lightingVaTotal = lightingLoadVa(config.areaM2);
    const perLighting = 120 * 15 * 0.8; // 80% of a 15 A circuit
    const lightingCircuits = Math.max(1, ceil(lightingVaTotal / perLighting));
    for (let index = 0; index < lightingCircuits; index += 1) {
        circuits.push(circuitFor(templateById('lighting'), config, {
            id: `lighting-${index + 1}`,
            label: lightingCircuits > 1 ? `General lighting ${index + 1}` : 'General lighting',
            va: round(lightingVaTotal / lightingCircuits, 0)
        }));
    }
    for (let index = 0; index < Math.max(1, config.sabc); index += 1) {
        circuits.push(circuitFor(templateById('sabc'), config, {
            id: `sabc-${index + 1}`,
            label: config.sabc > 1 ? `Small appliance ${index + 1}` : 'Small appliance'
        }));
    }
    if (config.laundry) circuits.push(circuitFor(templateById('laundry'), config));
    for (let index = 0; index < Math.max(1, config.bathroom); index += 1) {
        circuits.push(circuitFor(templateById('bathroom'), config, {
            id: `bathroom-${index + 1}`,
            label: config.bathroom > 1 ? `Bathroom ${index + 1}` : 'Bathroom receptacle'
        }));
    }
    if (config.outdoorReceptacle) circuits.push(circuitFor(templateById('outdoor'), config));
    circuits.push(circuitFor(templateById('garage'), config));

    APPLIANCE_KEYS.forEach((key) => {
        const va = Number(config.appliances?.[key]) || 0;
        if (va <= 0) return;
        const template = templateById(key === 'wellPump' ? 'well-pump' : key);
        circuits.push(circuitFor(template, config, { va }));
    });

    return circuits;
}

export function computeElectricalDesign(options = {}) {
    const config = { ...ELECTRICAL_DEFAULTS, ...options };
    config.appliances = { ...ELECTRICAL_DEFAULTS.appliances, ...(options.appliances || {}) };
    config.areaM2 = clamp(config.areaM2, 10, 2000);
    config.sabc = clamp(config.sabc, 1, 6);
    config.bathroom = clamp(config.bathroom, 1, 8);
    config.feederLengthM = clamp(config.feederLengthM, 1, 200);
    config.branchLengthM = clamp(config.branchLengthM, 1, 120);
    config.ambientC = clamp(config.ambientC, 10, 60);
    config.currentCarrying = clamp(config.currentCarrying, 2, 20);

    const lightingVa = lightingLoadVa(config.areaM2);
    const sabcVa = 1500 * config.sabc;
    const laundryVa = config.laundry ? 1500 : 0;
    const generalNameplate = lightingVa + sabcVa + laundryVa;
    const general = generalDemand(generalNameplate);

    const applianceRows = APPLIANCE_KEYS
        .filter((key) => key !== 'ac' && key !== 'heating')
        .map((key) => ({ key, va: Number(config.appliances[key]) || 0 }))
        .filter((entry) => entry.va > 0);
    const applianceNameplate = applianceRows.reduce((total, entry) => total + entry.va, 0);
    const applianceFactor = applianceRows.length >= 4 ? 0.75 : 1;
    const applianceDemand = applianceNameplate * applianceFactor;

    const heatVa = Number(config.appliances.heating) || 0;
    const coolVa = Number(config.appliances.ac) || 0;
    const hvacDemand = Math.max(heatVa, coolVa);

    const motorVa = ['pool', 'wellPump'].reduce((largest, key) => Math.max(largest, Number(config.appliances[key]) || 0), 0);
    const motorDemand = motorVa * 0.25;

    const standard = {
        va: round(general.va + applianceDemand + hvacDemand + motorDemand, 1),
        general,
        applianceNameplate,
        applianceFactor,
        applianceDemand: round(applianceDemand, 1),
        hvacDemand,
        motorDemand: round(motorDemand, 1)
    };

    const otherVa = generalNameplate + applianceNameplate;
    const optional = {
        va: round(Math.min(otherVa, 10000) + Math.max(otherVa - 10000, 0) * 0.4 + hvacDemand + motorDemand, 1),
        base: round(Math.min(otherVa, 10000), 1),
        remainder: round(Math.max(otherVa - 10000, 0) * 0.4, 1),
        hvacDemand,
        motorDemand: round(motorDemand, 1)
    };

    const method = config.method === 'optional' ? 'optional' : 'standard';
    const demandVa = method === 'optional' ? optional.va : standard.va;
    const demandAmps = demandVa / 240;
    const serviceAmps = nextService(Math.max(100, demandAmps));
    const mainBreaker = nextBreaker(serviceAmps);
    const column = config.conductor === 'nm-b' ? 'amp60' : 'amp75';
    const serviceConductor = conductorFor(serviceAmps, {
        column,
        ambientC: config.ambientC,
        currentCarrying: config.currentCarrying
    });
    const feeder = {
        amps: round(demandAmps, 1),
        size: serviceConductor,
        vdPercent: voltageDropPercent({ amps: demandAmps, lengthM: config.feederLengthM, size: serviceConductor, voltage: 240 }),
        adjustedAmpacity: adjustedAmpacity(serviceConductor, { column, ambientC: config.ambientC, currentCarrying: config.currentCarrying })
    };

    const unbalancedVa = general.va + 0.7 * (Number(config.appliances.dryer) || 0) + 0.8 * (Number(config.appliances.range) || 0);
    const neutralDemandVa = Math.min(unbalancedVa, 200 * 240) + Math.max(unbalancedVa - 200 * 240, 0) * 0.7;
    const neutralAmps = neutralDemandVa / 240;
    const neutralSize = conductorFor(Math.max(neutralAmps, 1), {
        column,
        ambientC: config.ambientC,
        currentCarrying: config.currentCarrying
    });
    const neutral = {
        va: round(neutralDemandVa, 1),
        amps: round(neutralAmps, 1),
        size: neutralSize
    };

    const gec = groundingElectrodeFor(serviceConductor);
    const egc = equipmentGroundFor(mainBreaker);

    const circuits = buildCircuits(config);
    const doublePole = circuits.filter((circuit) => circuit.voltage > 150).length;
    const spacesUsed = circuits.length + doublePole;
    // A chosen panel is used only if it can actually carry the service; the
    // suite never hides an undersized panel behind an override.
    const requestedPanel = PANELS.find((entry) => entry.id === config.panel);
    const panel = requestedPanel && requestedPanel.amps >= serviceAmps && requestedPanel.spaces >= spacesUsed
        ? requestedPanel
        : panelFor(serviceAmps, spacesUsed);
    const spares = Math.max(panel.spaces - spacesUsed, 0);
    const legs = { a: 0, b: 0 };
    circuits.forEach((circuit, index) => {
        const load = circuit.va / 2;
        if (index % 2 === 0) legs.a += load;
        else legs.b += load;
    });
    const balance = {
        a: round(legs.a, 0),
        b: round(legs.b, 0),
        imbalance: round(Math.abs(legs.a - legs.b), 0),
        percent: round((Math.abs(legs.a - legs.b) / Math.max(legs.a + legs.b, 1)) * 100, 1)
    };

    const largestCircuit = circuits.reduce((worst, circuit) => (
        !worst || circuit.breaker > worst.breaker ? circuit : worst
    ), null);
    const box = BOXES.find((entry) => entry.id === '4x4x2.125');
    const boxFill = {
        conductorSize: largestCircuit?.conductor || '12',
        allowances: 3 + 2 + 1, // hot, neutral, ground + device + clamp
        volume: round((BOX_VOLUME_PER_CONDUCTOR[largestCircuit?.conductor || '12'] || 2.25) * 6, 2),
        boxVolume: box.volume,
        box: box.label,
        pass: (BOX_VOLUME_PER_CONDUCTOR[largestCircuit?.conductor || '12'] || 2.25) * 6 <= box.volume
    };

    const feederCount = 4; // two hots, neutral, ground
    const feederArea = (awgBySize(serviceConductor).areaThhn || 0.1) * feederCount;
    const conduit = CONDUITS.find((entry) => feederArea / entry.area <= 0.4) || CONDUITS[CONDUITS.length - 1];
    const conduitFill = {
        conductor: serviceConductor,
        count: feederCount,
        area: round(feederArea, 3),
        conduit: conduit.label,
        conduitArea: conduit.area,
        fillPercent: round((feederArea / conduit.area) * 100, 1),
        pass: feederArea / conduit.area <= 0.4
    };

    // --- Bill of materials ------------------------------------------------
    const bom = { rows: [], material: 0, total: 0 };
    const add = (group, item, qty, unit, unitCost, note = '') => {
        const cost = round(qty * unitCost, 2);
        bom.rows.push({ group, item, qty: round(qty, 2), unit, unitCost: round(unitCost, 2), cost, note });
    };

    add('Panel', panel.label, 1, 'each', panel.cost, `${panel.amps} A, ${panel.spaces} spaces`);
    add('Panel', 'Main breaker', 1, 'each', breakerPrice(mainBreaker) * 0.6, `${mainBreaker} A, supplied with the panel`);
    circuits.forEach((circuit) => {
        const premium = circuit.gfci && circuit.afci ? 68 : circuit.gfci ? 34 : circuit.afci ? 38 : 0;
        add('Breakers', `${circuit.breaker} A ${circuit.voltage > 150 ? 'double-pole' : 'single-pole'} breaker`,
            circuit.voltage > 150 ? 2 : 1, 'space', (breakerPrice(circuit.breaker) + premium) / (circuit.voltage > 150 ? 2 : 1),
            circuit.label + (premium ? ' · GFCI/AFCI' : ''));
    });
    add('Conductors', `Service conductors ${serviceConductor}`, 3, 'run', conductorPrice(serviceConductor, config.conductor) * config.feederLengthM,
        `${round(config.feederLengthM, 1)} m, 2 hots + neutral`);
    add('Conductors', `Equipment ground ${egc}`, 1, 'run', conductorPrice(egc, config.conductor) * config.feederLengthM, 'Feeder EGC');
    const branchBySize = new Map();
    circuits.forEach((circuit) => {
        const key = circuit.conductor;
        const length = config.branchLengthM * (circuit.voltage > 150 ? 3 : 3);
        branchBySize.set(key, (branchBySize.get(key) || 0) + length);
    });
    branchBySize.forEach((length, size) => {
        add('Conductors', `Branch conductors ${size}`, round(length, 1), 'm', conductorPrice(size, config.conductor), 'Hot, neutral and ground');
    });
    add('Raceway', conduit.label, round(config.feederLengthM * 1.1, 1), 'm', conduit.costPerM, 'Service and feeder raceway');
    add('Raceway', 'Conduit fittings and straps', 1, 'set', 42, 'Per 10 m of raceway');
    add('Devices', DEVICES.receptacle.label, Math.max(8, ceil(config.areaM2 / 12)), 'each', DEVICES.receptacle.cost, 'Dwelling receptacle count');
    add('Devices', DEVICES.gfci.label, Math.max(2, config.bathroom + 1), 'each', DEVICES.gfci.cost, 'Bathroom, kitchen and outdoor');
    add('Devices', DEVICES.switch.label, Math.max(6, ceil(config.areaM2 / 25)), 'each', DEVICES.switch.cost, 'Lighting control');
    add('Devices', DEVICES.box.label, Math.max(14, ceil(config.areaM2 / 10)), 'each', DEVICES.box.cost, 'Device boxes');
    add('Devices', DEVICES.cover.label, config.outdoorReceptacle ? 1 : 0, 'each', DEVICES.cover.cost, 'Outdoor in-use cover');
    add('Grounding', DEVICES.groundRod.label, config.groundingElectrodes, 'each', DEVICES.groundRod.cost, 'Ground rods');
    add('Grounding', DEVICES.acorn.label, config.groundingElectrodes, 'each', DEVICES.acorn.cost, 'Rod clamps');
    add('Grounding', `Grounding electrode conductor ${gec}`, round(config.feederLengthM * 0.6, 1), 'm', conductorPrice(gec), 'Unspliced to the electrode');
    add('Grounding', DEVICES.bond.label, 4, 'each', DEVICES.bond.cost, 'Water, gas, structural steel and panel');
    add('Grounding', DEVICES.label.label, 1, 'set', DEVICES.label.cost, 'Panel directory');

    bom.material = round(bom.rows.reduce((total, row) => total + row.cost, 0), 2);
    bom.labour = round(bom.material * 0.85, 2);
    bom.total = round(bom.material + bom.labour, 2);

    const model = {
        config,
        method,
        general,
        generalNameplate: round(generalNameplate, 0),
        lightingVa: round(lightingVa, 0),
        standard,
        optional,
        demandVa: round(demandVa, 0),
        demandAmps: round(demandAmps, 1),
        serviceAmps,
        mainBreaker,
        panel,
        spaces: { used: spacesUsed, spares, total: panel.spaces },
        feeder,
        neutral,
        gec,
        egc,
        circuits,
        balance,
        boxFill,
        conduitFill,
        bom,
        costPerCircuit: circuits.length ? round(bom.total / circuits.length, 2) : 0
    };

    model.checks = electricalChecks(model);
    model.errors = model.checks.filter((check) => check.severity === 'error').length;
    model.warnings = model.checks.filter((check) => check.severity === 'warning').length;
    model.ok = model.errors === 0;

    return model;
}

export function electricalChecks(model) {
    const checks = [];
    const push = (id, severity, label, message, rule) => checks.push({ id, severity, label, message, rule });
    const { config, serviceAmps, mainBreaker, feeder, neutral, panel, spaces, circuits } = model;

    push('demand-load', model.demandAmps <= serviceAmps ? 'ok' : 'error', 'Demand load',
        `${model.demandVa} VA (${model.demandAmps} A at 240 V) by the ${model.method} method; the ${serviceAmps} A service carries it.`,
        'NEC 2021 §220.42');
    push('service-size', serviceAmps >= 100 ? 'ok' : 'error', 'Service size',
        `${serviceAmps} A service, main breaker ${mainBreaker} A.`,
        'NEC 2021 §230.79');
    push('main-breaker', mainBreaker <= panel.amps ? 'ok' : 'error', 'Main breaker',
        `${mainBreaker} A main in a ${panel.amps} A panel.`,
        'NEC 2021 §408.36');
    push('service-conductor', feeder.adjustedAmpacity >= serviceAmps ? 'ok' : 'error', 'Service conductors',
        `${feeder.size} adjusted to ${feeder.adjustedAmpacity} A for ${serviceAmps} A.`,
        'NEC 2021 §310.16');
    push('ambient-derate', 'ok', 'Ambient and bundling',
        `${config.ambientC} °C ambient, ${config.currentCarrying} current-carrying conductors: factors applied to every conductor.`,
        'NEC 2021 §310.15(C)(1)');
    push('neutral', neutral.amps <= feeder.adjustedAmpacity ? 'ok' : 'error', 'Neutral',
        `${neutral.va} VA unbalanced (${neutral.amps} A), neutral ${neutral.size}.`,
        'NEC 2021 §220.61');
    push('gec', 'ok', 'Grounding electrode conductor',
        `${model.gec} to ${config.groundingElectrodes} ground rods, sized from Table 250.66.`,
        'NEC 2021 §250.66');
    push('egc', 'ok', 'Equipment grounding conductor',
        `${model.egc} for the ${mainBreaker} A feeder, sized from Table 250.122.`,
        'NEC 2021 §250.122');
    push('grounding-electrode', config.groundingElectrodes >= 2 ? 'ok' : 'warning', 'Grounding electrodes',
        config.groundingElectrodes >= 2
            ? 'Two rods, so the 25 ohm test is not required.'
            : 'One rod: a second rod or a 25 ohm test is required.',
        'NEC 2021 §250.53');
    push('service-disconnect', 'ok', 'Service disconnect',
        `${mainBreaker} A main marked as the service disconnect at the point of entry.`,
        'NEC 2021 §230.70');
    push('working-clearance', 'info', 'Working space',
        'Keep 30 in wide, 36 in deep and 6 ft 6 in clear in front of the panel (110.26).',
        'NEC 2021 §110.26');
    push('panel-spaces', spaces.spares >= 0 ? 'ok' : 'error', 'Panel spaces',
        `${spaces.used} of ${spaces.total} spaces used, ${spaces.spares} spare.`,
        'NEC 2021 §408.54');
    push('directory', 'info', 'Panel directory',
        'Label every circuit by room or load; the takeoff includes a directory set.',
        'NEC 2021 §408.4');
    push('feeder-vd', feeder.vdPercent <= 3 ? 'ok' : 'warning', 'Feeder voltage drop',
        `${feeder.vdPercent}% over ${config.feederLengthM} m of ${feeder.size}.`,
        'NEC 2021 §215.2(A)(1)');
    const worstBranch = circuits.reduce((worst, circuit) => (!worst || circuit.vdPercent > worst.vdPercent ? circuit : worst), null);
    push('branch-vd', (worstBranch?.vdPercent ?? 0) <= 3 ? 'ok' : 'warning', 'Branch voltage drop',
        worstBranch ? `Worst branch ${worstBranch.label}: ${worstBranch.vdPercent}% over ${config.branchLengthM} m.` : 'No branch circuits.',
        'NEC 2021 §210.19(A)');
    push('conduit-fill', model.conduitFill.pass ? 'ok' : 'error', 'Raceway fill',
        `${model.conduitFill.count} × ${model.conduitFill.conductor} in ${model.conduitFill.conduit}: ${model.conduitFill.fillPercent}% (40% limit).`,
        'NEC 2021 Chapter 9 Table 1');
    push('box-fill', model.boxFill.pass ? 'ok' : 'error', 'Box fill',
        `${model.boxFill.volume} in³ of allowances in a ${model.boxFill.boxVolume} in³ box.`,
        'NEC 2021 §314.16');

    const has = (id) => circuits.some((circuit) => circuit.id.startsWith(id));
    push('sabc', (circuits.filter((circuit) => circuit.id.startsWith('sabc')).length >= 2) ? 'ok' : 'error', 'Small-appliance circuits',
        `${circuits.filter((circuit) => circuit.id.startsWith('sabc')).length} kitchen small-appliance circuits (two required).`,
        'NEC 2021 §210.11(C)(1)');
    push('laundry', config.laundry ? 'ok' : 'warning', 'Laundry circuit',
        config.laundry ? 'Dedicated 20 A laundry circuit included.' : 'No laundry circuit: add one if the home has laundry equipment.',
        'NEC 2021 §210.11(C)(2)');
    push('bathroom', has('bathroom') ? 'ok' : 'error', 'Bathroom circuit',
        `${circuits.filter((circuit) => circuit.id.startsWith('bathroom')).length} bathroom receptacle circuit(s).`,
        'NEC 2021 §210.11(C)(3)');
    push('lighting-outlets', 'ok', 'Lighting outlets',
        `${circuits.filter((circuit) => circuit.id.startsWith('lighting')).length} general lighting circuits with switched outlets.`,
        'NEC 2021 §210.70');
    push('receptacle-spacing', 'info', 'Receptacle spacing',
        'Keep every point within 6 ft of a receptacle on the working drawings.',
        'NEC 2021 §210.52');
    push('outdoor-receptacle', config.outdoorReceptacle ? 'ok' : 'warning', 'Outdoor receptacle',
        config.outdoorReceptacle ? 'Outdoor GFCI receptacle with an in-use cover included.' : 'No outdoor receptacle: 210.64 requires one at grade level.',
        'NEC 2021 §210.64');
    push('gfci', circuits.every((circuit) => !['sabc', 'bathroom', 'outdoor', 'garage', 'dishwasher', 'disposal', 'microwave', 'pool', 'spa', 'ev'].some((key) => circuit.id.startsWith(key)) || circuit.gfci) ? 'ok' : 'error', 'GFCI protection',
        `${circuits.filter((circuit) => circuit.gfci).length} circuits with GFCI protection.`,
        'NEC 2021 §210.8');
    push('afci', config.afci ? 'ok' : 'warning', 'AFCI protection',
        config.afci ? `${circuits.filter((circuit) => circuit.afci).length} circuits with AFCI protection.` : 'AFCI is switched off: dwelling living areas need it.',
        'NEC 2021 §210.12');
    push('range-circuit', has('range') ? 'ok' : 'info', 'Range circuit',
        has('range') ? `${circuits.find((circuit) => circuit.id === 'range').breaker} A range circuit.` : 'No electric range.',
        'NEC 2021 §220.55');
    push('dryer-circuit', has('dryer') ? 'ok' : 'info', 'Dryer circuit',
        has('dryer') ? `${circuits.find((circuit) => circuit.id === 'dryer').breaker} A dryer circuit.` : 'No electric dryer.',
        'NEC 2021 §220.54');
    push('motor-25', model.standard.motorDemand > 0 ? 'ok' : 'info', 'Motor load',
        model.standard.motorDemand > 0 ? `25% of the largest motor added (${model.standard.motorDemand} VA).` : 'No motor load in the calculation.',
        'NEC 2021 §430.24');
    push('ev-circuit', has('ev') ? 'ok' : 'info', 'EV charging',
        has('ev') ? `${circuits.find((circuit) => circuit.id === 'ev').breaker} A EV circuit at 125% of the continuous current.` : 'No EV charger.',
        'NEC 2021 §625.41');
    push('pool-circuit', (has('pool') || has('spa')) ? 'ok' : 'info', 'Pool and spa',
        (has('pool') || has('spa')) ? 'GFCI protection and a disconnect within sight included.' : 'No pool or spa load.',
        'NEC 2021 §680.21');
    push('subpanel', has('subpanel') ? 'ok' : 'info', 'Detached feeder',
        has('subpanel') ? 'Detached-building feeder with a remote disconnect and ground bar.' : 'No detached-building feeder.',
        'NEC 2021 §225.30');
    push('inspection', 'info', 'Inspection pack',
        'Load calculation, panel schedule, grounding detail and the GFCI/AFCI list are all exportable.',
        'Plan review');

    return checks;
}

const csvField = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function electricalTakeoffCsv(design) {
    const header = '"group","item","qty","unit","unit cost","cost","note"';
    const body = design.bom.rows.map((row) => [
        row.group, row.item, row.qty, row.unit, row.unitCost, row.cost, row.note
    ].map(csvField).join(','));
    const summary = [
        ['Summary', 'Service', `${design.serviceAmps} A`, '', '', '', ''],
        ['Summary', 'Demand load', design.demandVa, 'VA', '', '', design.method],
        ['Summary', 'Main breaker', `${design.mainBreaker} A`, '', '', '', ''],
        ['Summary', 'Service conductors', design.feeder.size, '', '', '', ''],
        ['Summary', 'Grounding electrode', design.gec, '', '', '', ''],
        ['Summary', 'Material', design.bom.material, '', '', '', ''],
        ['Summary', 'Labour', design.bom.labour, '', '', '', ''],
        ['Summary', 'Total', design.bom.total, '', '', '', '']
    ].map((row) => row.map(csvField).join(','));
    return [header, ...body, ...summary].join('\n');
}

export function panelScheduleCsv(design) {
    const rows = [['space', 'circuit', 'voltage', 'va', 'amps', 'breaker', 'conductor', 'egc', 'gfci', 'afci', 'vd_percent']];
    let space = 1;
    design.circuits.forEach((circuit) => {
        rows.push([
            circuit.voltage > 150 ? `${space}-${space + 1}` : String(space),
            circuit.label, circuit.voltage, circuit.va, circuit.amps, circuit.breaker,
            circuit.conductor, circuit.egc, circuit.gfci ? 'yes' : '', circuit.afci ? 'yes' : '', circuit.vdPercent
        ]);
        space += circuit.voltage > 150 ? 2 : 1;
    });
    rows.push(['', 'SPARE', '', '', '', '', '', '', '', '', '']);
    return rows.map((row) => row.map(csvField).join(',')).join('\n');
}

export function demandCsv(design) {
    const rows = [['item', 'standard_va', 'optional_va']];
    rows.push(['General lighting + SABC + laundry', design.general.va, design.optional.base]);
    rows.push(['Appliances', design.standard.applianceDemand, design.optional.remainder]);
    rows.push(['Heating or cooling', design.standard.hvacDemand, design.optional.hvacDemand]);
    rows.push(['Largest motor 25%', design.standard.motorDemand, design.optional.motorDemand]);
    rows.push(['Total', design.standard.va, design.optional.va]);
    return rows.map((row) => row.map(csvField).join(',')).join('\n');
}

export function electricalSummaryText(design) {
    if (!design) return [];
    return [
        `${design.serviceAmps} A service · ${design.demandVa} VA demand (${design.method})`,
        `${design.mainBreaker} A main · ${design.feeder.size} service conductors · ${design.gec} GEC`,
        `${design.circuits.length} circuits · ${design.spaces.used}/${design.panel.spaces} spaces`,
        `Neutral ${design.neutral.size} (${design.neutral.amps} A unbalanced)`,
        `Conduit ${design.conduitFill.conduit} at ${design.conduitFill.fillPercent}% fill`,
        `Material $${design.bom.material.toFixed(0)} · total $${design.bom.total.toFixed(0)}`
    ];
}

export { STANDARD_BREAKERS, BREAKER_PRICES };
