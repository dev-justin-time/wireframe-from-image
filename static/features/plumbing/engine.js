import {
    FIXTURE_TYPES,
    fixtureById,
    heaterById,
    waterPipeSize,
    WATER_PIPE_SIZES,
    waterMaterialById,
    dwvSize,
    DWV_SIZES,
    dwvMaterialById,
    gasSize,
    GAS_SIZES,
    gasMaterialById,
    finishGradeById,
    faucetFinishById,
    BTU_PER_CF_NATURAL,
    BTU_PER_CF_PROPANE,
    PSI_PER_FOOT,
    CLEANOUT_COST,
    VENT_FLASHING_COST,
    HANGER_COST,
    SUPPLY_STOP_COST,
    TRAP_TRIM_COST,
    GAS_SEDIMENT_TRAP_COST,
    GAS_SHUTOFF_COST,
    GAS_CONNECTOR_COST,
    WATER_SERVICE_TAP_COST,
    SEWER_TAP_COST,
    GAS_METER_SET_COST,
    PRV_COST,
    EXPANSION_TANK_COST,
    HEATER_PAN_COST,
    RELIEF_PIPE_COST,
    INSULATION_COST_PER_M,
    LABOUR_RATE_ROUGH,
    LABOUR_RATE_FINISH
} from './catalog.js';
import {
    fixturesOf,
    drainFixtures,
    gasFixtures,
    waterFixtures,
    hasGas,
    positionFor,
    heaterPosition,
    hookupPoint,
    planSummary,
    normalizePlan
} from './plan.js';

/** Rounding, money and small geometry helpers. */
const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const money = (value) => round(Number(value) || 0, 2);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const pathLength = (points) => points.reduce((sum, point, index) => (
    index === 0 ? 0 : sum + distance(points[index - 1], point)
), 0);

/** A simple orthogonal route: one bend, routed on the longer axis first. */
export function orthogonalRoute(a, b) {
    if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) return [a, b];
    if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
        return [a, { x: round(b.x), y: round(a.y) }, b];
    }
    return [a, { x: round(a.x), y: round(b.y) }, b];
}

/**
 * Build a service tree from a root point to weighted targets. Each target
 * connects to the nearest node already in the tree, which avoids parallel
 * trunks without pretending to know which wall a plumber would drill.
 */
export function buildTree(rootPoint, targets) {
    const root = { id: 'root', point: rootPoint, weight: 0, label: 'source' };
    const nodes = [root];
    const edges = [];
    [...targets]
        .sort((a, b) => manhattan(rootPoint, a.point) - manhattan(rootPoint, b.point))
        .forEach((target) => {
            let best = null;
            nodes.forEach((node) => {
                const score = manhattan(node.point, target.point);
                if (!best || score < best.score) best = { node, score };
            });
            const points = orthogonalRoute(best.node.point, target.point);
            edges.push({
                from: best.node,
                to: target,
                points,
                length: round(pathLength(points), 3),
                service: target.service || null
            });
            nodes.push(target);
        });
    const children = new Map();
    edges.forEach((edge) => {
        if (!children.has(edge.from.id)) children.set(edge.from.id, []);
        children.get(edge.from.id).push(edge);
    });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const loadOf = (id) => {
        const node = nodeById.get(id);
        let total = Number(node?.weight) || 0;
        (children.get(id) || []).forEach((edge) => {
            total += loadOf(edge.to.id);
        });
        return total;
    };
    edges.forEach((edge) => {
        edge.load = round(loadOf(edge.to.id), 3);
    });
    return { root, nodes, edges, parent: new Map(edges.map((edge) => [edge.to.id, edge])) };
}

/** Edges from the root to one target, in order. */
export function pathTo(tree, targetId) {
    const edges = [];
    let current = targetId;
    let guard = 0;
    while (tree.parent.has(current) && guard < 200) {
        const edge = tree.parent.get(current);
        edges.unshift(edge);
        current = edge.from.id;
        guard += 1;
    }
    return edges;
}

/** Hunter-style demand curve, interpolated between the published points. */
const DEMAND_CURVE = [
    [1, 1.0], [2, 1.5], [3, 2.5], [4, 3.2], [5, 3.8], [6, 4.4], [8, 5.2],
    [10, 5.8], [15, 6.8], [20, 7.6], [25, 8.4], [30, 9.2], [40, 10.4],
    [50, 11.5], [75, 13.5], [100, 15.5], [150, 18.5], [200, 21.0]
];

export function demandForWsfu(wsfu) {
    const value = Math.max(Number(wsfu) || 0, 0);
    if (value <= 0) return 0;
    if (value <= DEMAND_CURVE[0][0]) return DEMAND_CURVE[0][1];
    for (let index = 1; index < DEMAND_CURVE.length; index += 1) {
        const [x1, y1] = DEMAND_CURVE[index - 1];
        const [x2, y2] = DEMAND_CURVE[index];
        if (value <= x2) return round(y1 + ((value - x1) / (x2 - x1)) * (y2 - y1), 2);
    }
    return DEMAND_CURVE[DEMAND_CURVE.length - 1][1];
}

export function waterPipeId(sizeId, materialId) {
    const size = waterPipeSize(sizeId);
    const material = waterMaterialById(materialId);
    if (material.id === 'copper') return size.copperId;
    return size.pexId;
}

export function velocityFps(gpm, diameterIn) {
    if (!(gpm > 0) || !(diameterIn > 0)) return 0;
    return round((0.4085 * gpm) / (diameterIn ** 2), 2);
}

/** Hazen-Williams friction loss in psi over a length in metres. */
export function frictionPsi(gpm, diameterIn, lengthM, c = 150) {
    if (!(gpm > 0) || !(diameterIn > 0) || !(lengthM > 0)) return 0;
    const lengthFt = lengthM / 0.3048;
    return round((4.52 * gpm ** 1.852 * lengthFt) / (c ** 1.852 * diameterIn ** 4.871), 3);
}

export function waterSizeForWsfu(wsfu, { service = false } = {}) {
    const limit = (entry) => (service ? entry.maxServiceWsfu : entry.maxWsfu);
    return (WATER_PIPE_SIZES.find((entry) => limit(entry) >= wsfu) || WATER_PIPE_SIZES[WATER_PIPE_SIZES.length - 1]).id;
}

/** Pick a service size that satisfies both the fixture-unit table and velocity. */
function waterServiceSizeFor(wsfu, demandGpm, materialId) {
    const candidates = WATER_PIPE_SIZES.filter((entry) => entry.maxServiceWsfu >= wsfu);
    const size = candidates.find((entry) => velocityFps(demandGpm, waterPipeId(entry.id, materialId)) <= 8)
        || candidates[candidates.length - 1]
        || WATER_PIPE_SIZES[WATER_PIPE_SIZES.length - 1];
    return size.id;
}

export function meterLossPsi(meterSize, demandGpm) {
    const lossAt10 = meterSize === '5/8' ? 4.5 : meterSize === '1' ? 1.7 : meterSize === '1-1/4' ? 1.0 : 2.7;
    return round(lossAt10 * (Math.max(demandGpm, 0) / 10) ** 1.85, 2);
}

/** Drainage capacities from the conservative catalogue tables. */
export function dwvSizeFor(dfu, kind = 'branch') {
    const key = kind === 'main' ? 'mainDfu' : kind === 'stack' ? 'stackDfu' : 'branchDfu';
    return (DWV_SIZES.find((entry) => entry[key] >= dfu) || DWV_SIZES[DWV_SIZES.length - 1]).id;
}

export function dwvMinimumSlope(sizeId) {
    return dwvSize(sizeId).minSlope;
}

/** Fuel-gas capacity derated from the 10 ft table by the square root of length. */
export function gasCapacity(sizeId, lengthM, type = 'natural') {
    const size = gasSize(sizeId);
    const lengthFt = Math.max(lengthM / 0.3048, 10);
    const derate = Math.sqrt(10 / lengthFt);
    const fuelFactor = type === 'propane' ? 0.94 : 1;
    return round(size.capacity10 * derate * fuelFactor, 1);
}

export function gasSizeForLoad(cfh, lengthM, type = 'natural') {
    return (GAS_SIZES.find((entry) => gasCapacity(entry.id, lengthM, type) >= cfh) || GAS_SIZES[GAS_SIZES.length - 1]).id;
}

export function gasCfh(btu, type = 'natural') {
    const factor = type === 'propane' ? BTU_PER_CF_PROPANE : BTU_PER_CF_NATURAL;
    return round((Number(btu) || 0) / factor, 2);
}

/** Group tags and appliance tags are stable for a given plan. */
function tagFixtures(plan) {
    const counters = new Map();
    return plan.fixtures.map((entry) => {
        const type = fixtureById(entry.typeId);
        const prefix = type.tagPrefix || 'P';
        const count = (counters.get(prefix) || 0) + 1;
        counters.set(prefix, count);
        return {
            ...entry,
            type,
            tag: `${prefix}${count}`,
            position: positionFor(plan, entry, type),
            bounds: null
        };
    });
}

function fixtureGroup(fixture) {
    return fixture.type.group || 'utility';
}

function buildWaterModel(plan, fixtures) {
    const heater = plan.waterHeater ? {
        ...plan.waterHeater,
        type: heaterById(plan.waterHeater.typeId),
        position: heaterPosition(plan, plan.waterHeater)
    } : null;
    const coldFixtures = fixtures.filter((entry) => entry.type.wsfuCold > 0 || entry.type.wsfuHot > 0);
    const hotFixtures = fixtures.filter((entry) => entry.type.wsfuHot > 0);
    const coldWsfu = round(fixtures.reduce((sum, entry) => sum + entry.type.wsfuCold, 0) + (heater ? 1 : 0), 2);
    const hotWsfu = round(fixtures.reduce((sum, entry) => sum + entry.type.wsfuHot, 0), 2);
    const totalWsfu = round(coldWsfu + hotWsfu, 2);
    const demandGpm = demandForWsfu(totalWsfu);
    const coldDemand = demandForWsfu(coldWsfu);
    const hotDemand = demandForWsfu(hotWsfu);
    const material = waterMaterialById(plan.water.serviceMaterial);
    const serviceSize = waterServiceSizeFor(totalWsfu, demandGpm, material.id);
    const mainSize = serviceSize;
    const serviceId = waterPipeId(serviceSize, material.id);
    const serviceVelocity = velocityFps(demandGpm, serviceId);
    const mainLength = Math.max(Number(plan.water.mainLength) || 0, 3);
    const mainFriction = frictionPsi(demandGpm, serviceId, mainLength, 150);
    const meterLoss = meterLossPsi(plan.water.meterSize, demandGpm);
    const staticAtFixture = plan.water.pressure - PSI_PER_FOOT * 1.2;
    const coldTargets = coldFixtures.map((entry) => ({
        id: entry.id,
        point: entry.position,
        weight: entry.type.wsfuCold,
        label: entry.tag,
        service: 'cold'
    }));
    if (heater) {
        coldTargets.push({
            id: 'heater_inlet',
            point: heater.position,
            weight: 1,
            label: 'Water heater cold inlet',
            service: 'cold'
        });
    }
    const coldTree = coldTargets.length ? buildTree(hookupPoint(plan, 'water'), coldTargets) : null;
    const hotTargets = hotFixtures.map((entry) => ({
        id: entry.id,
        point: entry.position,
        weight: entry.type.wsfuHot,
        label: entry.tag,
        service: 'hot'
    }));
    const hotTree = heater && hotTargets.length ? buildTree(heater.position, hotTargets) : null;

    const sizeEdges = (tree, kind) => {
        if (!tree) return [];
        tree.edges.forEach((edge) => {
            const size = waterSizeForWsfu(Math.max(edge.load, 0.5), { service: false });
            edge.size = size;
            edge.material = material.id;
            edge.kind = kind;
            edge.service = 'water';
            edge.label = `${size} ${material.label}`;
        });
        return tree.edges;
    };
    const coldEdges = sizeEdges(coldTree, 'cold');
    const hotEdges = sizeEdges(hotTree, 'hot');

    const edgeFriction = (edge) => {
        const flow = demandForWsfu(edge.load);
        const id = waterPipeId(edge.size, material.id);
        return frictionPsi(flow, id, edge.length, 150);
    };

    const pressureAt = (fixture) => {
        if (!fixture) {
            return round(staticAtFixture - meterLoss - mainFriction, 2);
        }
        const coldPath = coldTree ? pathTo(coldTree, fixture.id) : [];
        const hotPath = fixture.type.wsfuHot > 0 && hotTree ? pathTo(hotTree, fixture.id) : [];
        const branch = [...coldPath, ...hotPath].reduce((sum, edge) => sum + edgeFriction(edge), 0);
        return round(staticAtFixture - meterLoss - mainFriction - branch, 2);
    };

    const readings = coldFixtures.map((entry) => ({
        id: entry.id,
        tag: entry.tag,
        pressure: pressureAt(entry)
    }));
    if (heater) readings.push({ id: 'heater_inlet', tag: 'Water heater', pressure: pressureAt(null) });
    const worst = [...readings].sort((a, b) => a.pressure - b.pressure)[0] || null;

    return {
        heater,
        coldFixtures,
        hotFixtures,
        coldWsfu,
        hotWsfu,
        totalWsfu,
        demandGpm,
        coldDemand,
        hotDemand,
        serviceSize,
        mainSize,
        serviceVelocity,
        mainLength,
        mainFriction,
        meterLoss,
        staticAtFixture: round(staticAtFixture, 2),
        residual: worst ? worst.pressure : null,
        worstFixture: worst,
        readings,
        coldTree,
        hotTree,
        routes: [...coldEdges, ...hotEdges],
        material,
        hotLength: round(hotEdges.reduce((sum, edge) => sum + edge.length, 0), 2),
        coldLength: round(coldEdges.reduce((sum, edge) => sum + edge.length, 0), 2)
    };
}

function buildDrainModel(plan, fixtures) {
    const drains = fixtures.filter((entry) => entry.type.dfu > 0);
    const totalDfu = round(drains.reduce((sum, entry) => sum + entry.type.dfu, 0), 2);
    const mainSize = dwvSizeFor(totalDfu, 'main');
    const slope = Number(plan.sewer.slope) || 0.02;
    const minimumSlope = dwvMinimumSlope(mainSize);
    const mainLength = Math.max(Number(plan.sewer.mainLength) || 0, 3);
    const requiredInvert = round(-(mainLength * slope) - 0.3, 2);
    const groupMap = new Map();
    drains.forEach((entry) => {
        const key = fixtureGroup(entry);
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(entry);
    });
    const stacks = [];
    const routes = [];
    const trapArms = [];

    groupMap.forEach((entries, group) => {
        const meanX = entries.reduce((sum, entry) => sum + entry.position.x, 0) / entries.length;
        const meanY = entries.reduce((sum, entry) => sum + entry.position.y, 0) / entries.length;
        const stack = {
            id: `stack_${group}`,
            group,
            x: round(clamp(meanX, 0.45, plan.width - 0.45)),
            y: round(meanY < plan.depth / 2 ? 0.48 : plan.depth - 0.48),
            dfu: round(entries.reduce((sum, entry) => sum + entry.type.dfu, 0), 2)
        };
        const largestFixtureDrain = entries.reduce((max, entry) => {
            const sizes = DWV_SIZES.map((size) => size.id);
            return sizes.indexOf(entry.type.drainSize) > sizes.indexOf(max) ? entry.type.drainSize : max;
        }, '1-1/2');
        stack.branchSize = dwvSizeFor(stack.dfu, 'branch');
        if (DWV_SIZES.findIndex((entry) => entry.id === largestFixtureDrain) > DWV_SIZES.findIndex((entry) => entry.id === stack.branchSize)) {
            stack.branchSize = largestFixtureDrain;
        }
        stack.size = DWV_SIZES.findIndex((entry) => entry.id === dwvSizeFor(stack.dfu, 'stack')) > DWV_SIZES.findIndex((entry) => entry.id === stack.branchSize)
            ? dwvSizeFor(stack.dfu, 'stack')
            : stack.branchSize;
        stack.ventSize = stack.size;
        stack.ventLength = round(plan.wallHeight + 1.2, 2);
        stacks.push(stack);

        entries.forEach((entry) => {
            const points = orthogonalRoute(stack, entry.position);
            const length = round(pathLength(points), 2);
            const limit = entry.type.trapArmMax || 1.5;
            trapArms.push({
                fixtureId: entry.id,
                tag: entry.tag,
                group,
                length,
                limit,
                stackId: stack.id,
                ok: length <= limit
            });
            routes.push({
                id: `drain_${entry.id}`,
                service: 'drain',
                points,
                length,
                size: stack.branchSize,
                material: plan.sewer.material,
                label: `${stack.branchSize} drain · ${entry.tag}`
            });
        });
    });

    const mainY = round(plan.depth - 0.22, 2);
    const mainStart = { x: 0.28, y: mainY };
    const mainEnd = { x: round(plan.width - 0.28, 2), y: mainY };
    const sewer = hookupPoint(plan, 'sewer');
    const mainPoints = [mainStart, mainEnd];
    const mainRouteLength = round(distance(mainStart, mainEnd) + distance(mainEnd, sewer), 2);
    routes.push({
        id: 'building_drain',
        service: 'drain',
        points: mainPoints,
        length: round(distance(mainStart, mainEnd), 2),
        size: mainSize,
        material: plan.sewer.material,
        label: `${mainSize} building drain · ${(slope * 100).toFixed(1)}%`
    });
    routes.push({
        id: 'sewer_lateral',
        service: 'drain',
        points: orthogonalRoute(mainEnd, sewer),
        length: round(distance(mainEnd, sewer), 2),
        size: plan.sewer.size,
        material: plan.sewer.material,
        label: `${plan.sewer.size} lateral to sewer`
    });
    stacks.forEach((stack) => {
        const mainPoint = { x: stack.x, y: mainY };
        routes.push({
            id: `stack_riser_${stack.group}`,
            service: 'drain',
            points: [stack, mainPoint],
            length: round(distance(stack, mainPoint), 2),
            size: stack.size,
            material: plan.sewer.material,
            label: `${stack.size} stack · ${stack.group}`
        });
    });

    return {
        drains,
        totalDfu,
        mainSize,
        mainLength,
        mainRouteLength,
        slope,
        minimumSlope,
        requiredInvert,
        mainY,
        sewer,
        stacks,
        routes,
        trapArms,
        ventCount: stacks.length,
        cleanoutCount: stacks.length + 1
    };
}

function buildGasModel(plan, fixtures, heater) {
    const usesGas = hasGas(plan);
    const targets = [
        ...fixtures.filter((entry) => entry.type.gasBtu > 0).map((entry) => ({
            id: entry.id,
            point: entry.position,
            weight: entry.type.gasBtu,
            label: entry.tag,
            service: 'gas'
        }))
    ];
    if (heater && heater.type.gasBtu > 0) {
        targets.push({
            id: 'heater_gas',
            point: heater.position,
            weight: heater.type.gasBtu,
            label: 'Water heater',
            service: 'gas'
        });
    }
    const totalBtu = round(targets.reduce((sum, target) => sum + target.weight, 0), 0);
    const type = plan.gas.type === 'propane' ? 'propane' : 'natural';
    const totalCfh = gasCfh(totalBtu, type);
    const tree = usesGas && targets.length ? buildTree(hookupPoint(plan, 'gas'), targets) : null;
    const material = gasMaterialById(plan.gas.material);
    if (tree) {
        tree.edges.forEach((edge) => {
            const size = gasSizeForLoad(edge.load, edge.length, type);
            edge.size = size;
            edge.material = material.id;
            edge.service = 'gas';
            edge.label = `${size} gas`;
            edge.capacity = gasCapacity(size, edge.length, type);
        });
    }
    const edges = tree ? tree.edges : [];
    const mainSize = gasSizeForLoad(totalCfh, Math.max(Number(plan.gas.mainLength) || 10, 5), type);
    const longestRun = edges.reduce((max, edge) => Math.max(max, edge.length), 0);
    const capacity = gasCapacity(mainSize, Math.max(Number(plan.gas.mainLength) || 10, 5), type);
    return {
        usesGas,
        targets,
        totalBtu,
        totalCfh,
        type,
        tree,
        edges,
        routes: edges,
        mainSize,
        material,
        longestRun: round(longestRun, 2),
        capacity,
        meterCapacity: Number(plan.gas.meterCapacity) || 0,
        applianceCount: targets.length
    };
}

function buildChecks(plan, fixtures, water, drain, gas) {
    const checks = [];
    const push = (id, severity, label, detail, extra = {}) => {
        checks.push({ id, severity, label, detail, ...extra });
    };
    const ok = (id, label, detail) => push(id, 'ok', label, detail);
    const heater = plan.waterHeater ? heaterById(plan.waterHeater.typeId) : null;

    // Hookups and service.
    if (plan.water && plan.water.pressure > 0) {
        ok('water-hookup', 'Water service is connected', `${plan.water.meterSize} meter, ${plan.water.pressure} psi static`);
    } else {
        push('water-hookup', 'error', 'No water service', 'Set a water hookup before routing supply piping.');
    }
    ok('sewer-hookup', 'Sewer connection is set', `${plan.sewer.size} lateral, invert ${plan.sewer.invert.toFixed(2)} m`);
    if (gas.usesGas) {
        ok('gas-hookup', 'Gas service is connected', `${gas.totalCfh} CFH at ${plan.gas.pressure} in w.c.`);
    } else {
        ok('gas-hookup', 'No gas load on this plan', 'The gas hookup is shown but no appliance uses it.');
    }

    if (plan.water.pressure > 80) {
        push('water-pressure-high', 'warn', 'Pressure reducing valve needed', `${plan.water.pressure} psi static exceeds the usual 80 psi limit; add a PRV after the meter.`);
    } else {
        ok('water-pressure-high', 'Static pressure is in the normal range', `${plan.water.pressure} psi; a PRV is not required by the model.`);
    }
    if (water.residual !== null && water.residual < 8) {
        push('water-pressure-low', 'error', 'Residual pressure too low at a fixture', `Worst case ${water.residual} psi at ${water.worstFixture?.tag || 'the far fixture'}; upsize the service or reduce the run.`);
    } else {
        ok('water-pressure-low', 'Residual pressure is adequate', `${water.residual ?? 0} psi at the worst fixture.`);
    }
    if (water.serviceVelocity > 8) {
        push('water-service', 'warn', 'Service velocity is high', `${water.serviceVelocity} ft/s at peak demand; upsize the service or meter.`);
    } else {
        ok('water-service', 'Service velocity is reasonable', `${water.serviceVelocity} ft/s at ${water.demandGpm} gpm.`);
    }
    if (plan.water.meterSize === '3/4' && water.demandGpm > 14) {
        push('water-meter', 'warn', 'Meter may be undersized', `${water.demandGpm} gpm peak through a 3/4 in meter; check the utility's meter capacity.`);
    } else {
        ok('water-meter', 'Meter size matches the demand', `${plan.water.meterSize} meter at ${water.demandGpm} gpm peak.`);
    }

    // Water heater.
    if (!plan.waterHeater && water.totalWsfu > 0) {
        push('water-heater-missing', 'error', 'No water heater', 'A dwelling with hot-water fixtures needs a water heater; add one in the utility zone.');
    } else if (plan.waterHeater) {
        ok('water-heater-missing', 'Water heater is scheduled', `${heater.label}`);
        if (!plan.waterHeater.reliefPipe) {
            push('water-heater-relief', 'error', 'T&P relief pipe is missing', 'The temperature and pressure relief valve needs a full-size discharge pipe to a safe location.');
        } else {
            ok('water-heater-relief', 'T&P relief is piped', 'Discharge pipe is included; terminate it where scalding water cannot injure anyone.');
        }
        if (heater.tankGal > 0 && !plan.waterHeater.pan) {
            push('water-heater-pan', 'warn', 'Drain pan missing under a tank', 'A tank in a finished space needs a pan and a drain, or a shutoff/leak detector.');
        } else {
            ok('water-heater-pan', 'Tank is protected by a pan', heater.tankGal > 0 ? 'Pan and drain included.' : 'Tankless unit: no tank pan required.');
        }
        if (heater.tankGal > 0 && !plan.waterHeater.expansionTank && plan.water.backflow !== 'none') {
            push('water-heater-expansion', 'warn', 'Closed system needs thermal expansion control', 'A check valve, backflow preventer or PRV can trap expanded water; add an expansion tank.');
        } else {
            ok('water-heater-expansion', 'Thermal expansion is controlled', heater.tankGal > 0 ? 'Expansion tank included.' : 'Tankless unit: confirm the manufacturer’s expansion requirement.');
        }
        if (plan.waterHeater.temperature > 120) {
            push('water-heater-temp', 'warn', 'Stored water is above 120°F', `${plan.waterHeater.temperature}°F at the tank; use a thermostatic mixing valve at the fixtures.`);
        } else {
            ok('water-heater-temp', 'Stored water temperature is scald-safe', `${plan.waterHeater.temperature}°F at the tank.`);
        }
    } else {
        ok('water-heater-missing', 'No water heater is required', 'This plan has no hot-water fixtures.');
        ok('water-heater-relief', 'No relief pipe required', 'No storage water heater.');
        ok('water-heater-pan', 'No pan required', 'No storage water heater.');
        ok('water-heater-expansion', 'No expansion tank required', 'No storage water heater.');
        ok('water-heater-temp', 'No tank temperature to check', 'No storage water heater.');
    }

    // Drainage and venting.
    if (plan.sewer.invert > drain.requiredInvert) {
        push('sewer-invert', 'error', 'Sewer invert is too shallow', `At ${plan.sewer.mainLength} m and ${(drain.slope * 100).toFixed(1)}% slope, the invert must be at or below ${drain.requiredInvert.toFixed(2)} m; it is ${plan.sewer.invert.toFixed(2)} m.`);
    } else {
        ok('sewer-invert', 'Sewer invert gives gravity fall', `Invert ${plan.sewer.invert.toFixed(2)} m is below the required ${drain.requiredInvert.toFixed(2)} m.`);
    }
    if (drain.slope < drain.minimumSlope) {
        push('sewer-slope', 'error', 'Drain slope is below minimum', `${(drain.slope * 100).toFixed(1)}% is less than ${(drain.minimumSlope * 100).toFixed(1)}% for a ${drain.mainSize} drain.`);
    } else {
        ok('sewer-slope', 'Drain slope meets the table', `${(drain.slope * 100).toFixed(1)}% minimum for the ${drain.mainSize} building drain.`);
    }
    if (DWV_SIZES.findIndex((entry) => entry.id === plan.sewer.size) < DWV_SIZES.findIndex((entry) => entry.id === drain.mainSize)) {
        push('sewer-size', 'error', 'Sewer lateral is smaller than the building drain', `${plan.sewer.size} lateral cannot carry the ${drain.mainSize} building drain load.`);
    } else {
        ok('sewer-size', 'Sewer size carries the fixture units', `${drain.totalDfu} DFU through a ${plan.sewer.size} lateral; the model needs ${drain.mainSize}.`);
    }
    drain.trapArms.forEach((arm) => {
        if (!arm.ok) {
            push('trap-arm', 'error', `Trap arm is too long at ${arm.tag}`, `${arm.length.toFixed(2)} m from the ${arm.group} stack; ${arm.limit.toFixed(2)} m is the limit for this fixture.`, { fixtureId: arm.fixtureId });
        }
    });
    if (drain.trapArms.every((arm) => arm.ok)) {
        ok('trap-arm', 'Every trap arm is within its limit', `${drain.trapArms.length} fixture connection(s) checked.`);
    }
    if (drain.stacks.every((stack) => DWV_SIZES.find((entry) => entry.id === stack.ventSize)?.stackDfu >= stack.dfu)) {
        ok('vent-size', 'Vent stacks are sized for their groups', `${drain.stacks.length} stack vent(s).`);
    } else {
        push('vent-size', 'warn', 'One vent stack looks small', 'Increase the vent or split the group; confirm wet-vent rules for the fixture order.');
    }
    if (drain.cleanoutCount < plan.sewer.cleanouts) {
        push('cleanout', 'warn', 'Add cleanouts', `${drain.cleanoutCount} cleanout(s) are modelled; ${plan.sewer.cleanouts} were requested.`);
    } else {
        ok('cleanout', 'Cleanouts are provided', `${drain.cleanoutCount} cleanout(s) at the stack base and sewer.`);
    }

    // Fixtures, clearances and fit.
    fixtures.forEach((entry) => {
        const type = entry.type;
        const centre = entry.position;
        const along = entry.wall === 'north' || entry.wall === 'south' ? centre.x : centre.y;
        const runLength = entry.wall === 'north' || entry.wall === 'south' ? plan.width : plan.depth;
        const side = Math.min(along, runLength - along);
        const front = entry.wall === 'north' ? plan.depth - (centre.y + type.depth / 2)
            : entry.wall === 'south' ? centre.y - type.depth / 2
                : entry.wall === 'west' ? plan.width - (centre.x + type.depth / 2)
                    : centre.x - type.depth / 2;
        if (side < type.clearSide) {
            push('fixture-clearance', 'warn', `${entry.tag} is tight to a side wall`, `${(side * 1000).toFixed(0)} mm to the side; ${(type.clearSide * 1000).toFixed(0)} mm is the usual minimum.`, { fixtureId: entry.id });
        }
        if (front < type.clearFront) {
            push('fixture-clearance', 'warn', `${entry.tag} lacks front clearance`, `${(front * 1000).toFixed(0)} mm in front; ${(type.clearFront * 1000).toFixed(0)} mm is the usual minimum.`, { fixtureId: entry.id });
        }
        const box = {
            left: centre.x - (entry.wall === 'east' || entry.wall === 'west' ? type.depth : type.width) / 2,
            right: centre.x + (entry.wall === 'east' || entry.wall === 'west' ? type.depth : type.width) / 2,
            top: centre.y - (entry.wall === 'east' || entry.wall === 'west' ? type.width : type.depth) / 2,
            bottom: centre.y + (entry.wall === 'east' || entry.wall === 'west' ? type.width : type.depth) / 2
        };
        entry.bounds = box;
        if (box.left < -0.01 || box.right > plan.width + 0.01 || box.top < -0.01 || box.bottom > plan.depth + 0.01) {
            push('fixture-outside', 'error', `${entry.tag} is outside the plan`, 'Move the fixture inside the room boundary.', { fixtureId: entry.id });
        }
    });
    if (!checks.some((entry) => entry.id === 'fixture-clearance')) {
        ok('fixture-clearance', 'Fixture clearances are workable', 'Side and front clearances pass the planning minimums.');
    }
    if (!checks.some((entry) => entry.id === 'fixture-outside')) {
        ok('fixture-outside', 'Every fixture is inside the plan', `${fixtures.length} fixture(s) checked.`);
    }
    let overlap = null;
    for (let i = 0; i < fixtures.length && !overlap; i += 1) {
        for (let j = i + 1; j < fixtures.length; j += 1) {
            const a = fixtures[i].bounds;
            const b = fixtures[j].bounds;
            if (!a || !b) continue;
            if (a.left < b.right - 0.02 && a.right > b.left + 0.02 && a.top < b.bottom - 0.02 && a.bottom > b.top + 0.02) {
                overlap = [fixtures[i], fixtures[j]];
                break;
            }
        }
    }
    if (overlap) {
        push('fixture-overlap', 'error', 'Two fixtures overlap', `${overlap[0].tag} and ${overlap[1].tag} occupy the same floor space.`, { fixtureId: overlap[0].id });
    } else {
        ok('fixture-overlap', 'Fixtures do not overlap', `${fixtures.length} footprints checked.`);
    }

    // Centre-to-centre spacing for water closets and lavatories.
    const wetRoom = fixtures.filter((entry) => ['toilet', 'lavatory', 'bidet'].includes(entry.type.id));
    let tightPair = null;
    for (let i = 0; i < wetRoom.length && !tightPair; i += 1) {
        for (let j = i + 1; j < wetRoom.length; j += 1) {
            if (wetRoom[i].wall !== wetRoom[j].wall) continue;
            const gap = distance(wetRoom[i].position, wetRoom[j].position);
            if (gap < 0.762) tightPair = [wetRoom[i], wetRoom[j], gap];
        }
    }
    if (tightPair) {
        push('fixture-spacing', 'warn', 'Water closets or lavatories are too close', `${tightPair[0].tag} and ${tightPair[1].tag} are ${(tightPair[2] * 1000).toFixed(0)} mm apart; 30 in (762 mm) is the usual centre-to-centre minimum.`);
    } else {
        ok('fixture-spacing', 'Wet-room fixtures are spaced', 'Centre-to-centre spacing is at least 762 mm.');
    }

    const required = { toilet: false, lavatory: false, kitchen: false, bathing: false };
    fixtures.forEach((entry) => {
        if (entry.type.id === 'toilet') required.toilet = true;
        if (entry.type.id === 'lavatory') required.lavatory = true;
        if (entry.type.id === 'kitchen-sink') required.kitchen = true;
        if (entry.type.id === 'bathtub' || entry.type.id === 'shower') required.bathing = true;
    });
    const needsKitchen = ['house', 'kitchen-laundry', 'adu'].includes(plan.template);
    const needsBathing = ['house', 'bath', 'adu'].includes(plan.template);
    const needsToilet = ['house', 'bath', 'adu'].includes(plan.template);
    const needsLavatory = ['house', 'bath', 'adu'].includes(plan.template);
    const missing = [];
    if (needsToilet && !required.toilet) missing.push('water closet');
    if (needsLavatory && !required.lavatory) missing.push('lavatory');
    if (needsKitchen && !required.kitchen) missing.push('kitchen sink');
    if (needsBathing && !required.bathing) missing.push('bathtub or shower');
    if (missing.length) {
        push('fixture-count', 'warn', 'The template is missing a basic fixture', `Add: ${missing.join(', ')}.`);
    } else {
        ok('fixture-count', 'The fixture set covers the template', `${fixtures.length} fixture(s) in the plan.`);
    }

    // Fuel gas.
    if (gas.usesGas) {
        if (gas.totalCfh > gas.meterCapacity) {
            push('gas-meter', 'error', 'Gas meter is undersized', `${gas.totalCfh} CFH connected load through a ${gas.meterCapacity} CFH meter; request a larger meter.`);
        } else {
            ok('gas-meter', 'Gas meter carries the connected load', `${gas.totalCfh} CFH of ${gas.meterCapacity} CFH.`);
        }
        if (gas.totalCfh > gas.capacity) {
            push('gas-size', 'error', 'Gas main is undersized', `${gas.mainSize} carries ${gas.capacity} CFH at the run length; the connected load is ${gas.totalCfh} CFH.`);
        } else {
            ok('gas-size', 'Gas main is sized for the load', `${gas.mainSize} at ${gas.capacity} CFH available.`);
        }
        if (!plan.gas.sedimentTraps) {
            push('gas-sediment-trap', 'error', 'Sediment traps are missing', 'Install a sediment trap downstream of each appliance shutoff, unless the appliance includes one.');
        } else {
            ok('gas-sediment-trap', 'Sediment traps are included', `${gas.applianceCount} appliance connection(s).`);
        }
        if (!plan.gas.shutoffs) {
            push('gas-shutoff', 'error', 'Appliance shutoffs are missing', 'Each appliance needs a listed shutoff valve in the same room and within reach.');
        } else {
            ok('gas-shutoff', 'Appliance shutoffs are included', 'One shutoff per gas appliance.');
        }
        if (!plan.gas.connectors) {
            push('gas-connector', 'warn', 'Appliance connectors are not included', 'Add a listed connector or a rigid connection at each appliance.');
        } else {
            ok('gas-connector', 'Appliance connectors are included', 'Listed connectors for the final connection.');
        }
        if (Number(plan.gas.pressure) !== 7) {
            push('gas-pressure', 'warn', 'Gas pressure is not the usual 7 in w.c.', `${plan.gas.pressure} in w.c.; confirm the appliance ratings and the regulator setting.`);
        } else {
            ok('gas-pressure', 'Gas pressure matches low-pressure appliances', '7 in w.c. nominal.');
        }
        if (!plan.gas.venting) {
            push('gas-vent', 'error', 'Combustion venting is not confirmed', 'Gas appliances need a listed vent or a direct-vent termination; check combustion air too.');
        } else {
            ok('gas-vent', 'Combustion venting is included', 'Vent kits and combustion-air coordination are in the scope.');
        }
    } else {
        ok('gas-meter', 'No gas meter load', 'No gas appliance on this plan.');
        ok('gas-size', 'No gas main required', 'No gas appliance on this plan.');
        ok('gas-sediment-trap', 'No sediment traps required', 'No gas appliance on this plan.');
        ok('gas-shutoff', 'No gas shutoffs required', 'No gas appliance on this plan.');
        ok('gas-connector', 'No gas connectors required', 'No gas appliance on this plan.');
        ok('gas-pressure', 'No gas pressure to check', 'No gas appliance on this plan.');
        ok('gas-vent', 'No combustion venting required', 'No gas appliance on this plan.');
    }

    // Backflow, appliance trim and testing.
    const badBib = fixtures.find((entry) => entry.type.id === 'hose-bib' && !entry.vacuumBreaker);
    if (badBib || plan.water.backflow === 'none') {
        push('backflow', 'warn', 'Backflow protection is incomplete', badBib ? `${badBib.tag} has no vacuum breaker.` : 'No backflow device is selected at the service.');
    } else {
        ok('backflow', 'Backflow protection is specified', 'Service device and hose-bib vacuum breakers are included.');
    }
    const dishwasher = fixtures.find((entry) => entry.type.id === 'dishwasher');
    if (dishwasher && !plan.finish.airGap) {
        push('dishwasher-airgap', 'warn', 'Dishwasher drain needs an air gap or high loop', 'Prevent waste from siphoning back into the dishwasher.');
    } else {
        ok('dishwasher-airgap', 'Dishwasher drain is protected', dishwasher ? 'Air gap or high loop included.' : 'No dishwasher on this plan.');
    }
    const washer = fixtures.find((entry) => entry.type.id === 'washing-machine');
    if (washer && !plan.finish.washerStandpipe) {
        push('washer-standpipe', 'warn', 'Washing machine needs a standpipe', 'Use a 2 in standpipe and trap, or the listed box for the appliance.');
    } else {
        ok('washer-standpipe', 'Washing machine drain is detailed', washer ? 'Standpipe and trap included.' : 'No washing machine on this plan.');
    }

    return checks;
}

function buildTakeoff(plan, fixtures, water, drain, gas) {
    const rows = [];
    const add = (part, group, label, qty, unit, unitCost, note = '', labour = false) => {
        const quantity = round(qty, 2);
        const cost = money(unitCost);
        rows.push({
            part,
            group,
            label,
            qty: quantity,
            unit,
            unitCost: cost,
            total: money(quantity * cost),
            note,
            labour
        });
    };

    // Hookups and service connections.
    add('rough', 'Hookups', 'Water service connection and meter set', 1, 'ea', WATER_SERVICE_TAP_COST, 'Tap, meter and service valve; utility fees vary.');
    add('rough', 'Hookups', 'Sewer lateral connection', 1, 'ea', SEWER_TAP_COST, 'Tap at the public sewer or septic inlet.');
    if (gas.usesGas) add('rough', 'Hookups', 'Gas meter set and service connection', 1, 'ea', GAS_METER_SET_COST, 'Meter, regulator and service valve.');

    // Water piping by size and material.
    const waterRows = new Map();
    water.routes.forEach((edge) => {
        const key = `${edge.size}|${edge.kind}`;
        if (!waterRows.has(key)) waterRows.set(key, { size: edge.size, kind: edge.kind, length: 0, edges: 0 });
        const entry = waterRows.get(key);
        entry.length += edge.length;
        entry.edges += 1;
    });
    waterRows.forEach(({ size, kind, length }) => {
        const material = water.material;
        const unitCost = (size === '1/2' ? waterPipeSize(size).costPex : waterPipeSize(size).costPex) * material.factor;
        const buy = material.id === 'copper' ? Math.ceil(length / 3) * 3 : Math.ceil(length / 30.5) * 30.5;
        add('rough', 'Water piping', `${material.label} ${waterPipeSize(size).label} · ${kind}`, buy, 'm', unitCost, `${length.toFixed(1)} m measured plus coil waste.`);
        add('rough', 'Water piping', `Fittings allowance · ${size} ${kind}`, 1, 'lot', money(unitCost * Math.max(length, 1) * material.fittingFactor), 'Elbows, tees, couplings and press/solder fittings.');
    });
    const waterLength = water.routes.reduce((sum, edge) => sum + edge.length, 0);
    add('rough', 'Water piping', 'Pipe hangers and isolators', Math.ceil(waterLength / 1.2), 'ea', HANGER_COST, 'Support at the code interval and at changes of direction.');
    if (plan.water.insulation) {
        add('rough', 'Water piping', 'Hot-water pipe insulation', Math.ceil(water.hotLength), 'm', INSULATION_COST_PER_M, 'Insulate the hot line; include the first 2 m of cold at the tank.');
    }
    add('rough', 'Water piping', 'Main shutoff and drain valve', 1, 'ea', 88, 'Full-port shutoff at the service entry.');
    if (plan.water.pressure > 80) add('rough', 'Water piping', 'Pressure reducing valve', 1, 'ea', PRV_COST, 'Set to 50–60 psi; add a strainer and a test port.');
    if (plan.water.backflow !== 'none') add('rough', 'Water piping', 'Backflow preventer', 1, 'ea', 165, plan.water.backflow === 'rpz' ? 'RPZ assembly; annual testing is typical.' : 'Dual-check or vacuum-breaker assembly as selected.');

    // Drainage, waste and vent.
    const drainRows = new Map();
    drain.routes.forEach((route) => {
        if (!drainRows.has(route.size)) drainRows.set(route.size, 0);
        drainRows.set(route.size, drainRows.get(route.size) + route.length);
    });
    const dwvMaterial = dwvMaterialById(plan.sewer.material);
    drainRows.forEach((length, size) => {
        const sizeData = dwvSize(size);
        const unitCost = (sizeData.costPvc || sizeData.costPvc) * dwvMaterial.factor;
        const buy = Math.ceil(length / 3) * 3;
        add('rough', 'DWV piping', `${dwvMaterial.label} ${sizeData.label}`, buy, 'm', unitCost, `${length.toFixed(1)} m measured plus cut waste.`);
        add('rough', 'DWV piping', `DWV fittings allowance · ${size}`, 1, 'lot', money(unitCost * Math.max(length, 1) * dwvMaterial.fittingFactor), 'Sanitary tees, wyes, bends and couplings.');
    });
    const drainLength = drain.routes.reduce((sum, route) => sum + route.length, 0);
    add('rough', 'DWV piping', 'Pipe hangers and strapping', Math.ceil(drainLength / 1.5), 'ea', HANGER_COST, 'Support horizontal drain at the code interval.');
    add('rough', 'DWV piping', 'Cleanouts', drain.cleanoutCount, 'ea', CLEANOUT_COST, 'Stack base and sewer; add one at each long horizontal run.');
    drain.stacks.forEach((stack) => {
        add('rough', 'Venting', `Vent stack · ${stack.ventSize} · ${stack.group}`, stack.ventLength, 'm', dwvSize(stack.ventSize).costPvc * dwvMaterial.factor, 'Stack vent through the roof; confirm the termination height.');
        add('rough', 'Venting', `Vent flashing · ${stack.group}`, 1, 'ea', VENT_FLASHING_COST, 'Listed roof flashing and cap.');
    });

    // Fuel gas.
    if (gas.usesGas) {
        const gasRows = new Map();
        gas.edges.forEach((edge) => {
            if (!gasRows.has(edge.size)) gasRows.set(edge.size, 0);
            gasRows.set(edge.size, gasRows.get(edge.size) + edge.length);
        });
        gasRows.forEach((length, size) => {
            const gasMaterial = gas.material;
            const unitCost = gasSize(size).costSteel * gasMaterial.factor;
            add('rough', 'Fuel gas', `${gasMaterial.label} ${gasSize(size).label}`, Math.ceil(length / 3) * 3, 'm', unitCost, `${length.toFixed(1)} m measured; gas pipe is bought in 3 m lengths.`);
            add('rough', 'Fuel gas', `Gas fittings allowance · ${size}`, 1, 'lot', money(unitCost * Math.max(length, 1) * gasMaterial.fittingFactor), 'Elbows, tees, couplings and reducers.');
        });
        const gasLength = gas.edges.reduce((sum, edge) => sum + edge.length, 0);
        add('rough', 'Fuel gas', 'Gas pipe support and bonding', Math.ceil(gasLength / 2), 'ea', 5.5, 'Support at the code interval; bond CSST per the manufacturer.');
        if (plan.gas.sedimentTraps) add('rough', 'Fuel gas', 'Sediment trap', gas.applianceCount, 'ea', GAS_SEDIMENT_TRAP_COST, 'Downstream of each appliance shutoff.');
        if (plan.gas.shutoffs) add('rough', 'Fuel gas', 'Appliance shutoff valve', gas.applianceCount, 'ea', GAS_SHUTOFF_COST, 'Same room, within reach of the appliance.');
    }

    // Water heater and equipment.
    if (plan.waterHeater) {
        const heater = water.heater?.type || heaterById(plan.waterHeater.typeId);
        add('rough', 'Equipment', `${heater.label} water heater`, 1, 'ea', heater.cost, heater.notes);
        if (heater.tankGal > 0 && plan.waterHeater.pan) add('rough', 'Equipment', 'Water-heater drain pan and drain', 1, 'ea', HEATER_PAN_COST, 'Pan with a drain to a safe location.');
        if (heater.tankGal > 0 && plan.waterHeater.expansionTank) add('rough', 'Equipment', 'Thermal expansion tank', 1, 'ea', EXPANSION_TANK_COST, 'Required on a closed system with a check valve or PRV.');
        if (plan.waterHeater.reliefPipe) add('rough', 'Equipment', 'T&P relief discharge piping', 1, 'ea', RELIEF_PIPE_COST, 'Full-size pipe to within 6 in of the floor or a safe receptor.');
        if (heater.gasBtu > 0) add('rough', 'Equipment', `${heater.vent} vent kit`, 1, 'ea', 260, 'Vent, termination and combustion-air coordination.');
        if (plan.waterHeater.insulated && heater.tankGal > 0) add('rough', 'Equipment', 'Heater blanket and pipe insulation', 1, 'ea', 55, 'Follow the manufacturer; do not cover the T&P or the flue.');
    }

    // Rough-in kits per fixture.
    const roughByType = new Map();
    fixtures.forEach((entry) => {
        const key = entry.type.id;
        if (!roughByType.has(key)) roughByType.set(key, { type: entry.type, count: 0 });
        roughByType.get(key).count += 1;
    });
    roughByType.forEach(({ type, count }) => {
        add('rough', 'Fixture rough-in', `${type.label} rough-in kit`, count, 'ea', type.roughCost, 'Drain stub, supply stubs, valve box and mounting coordination.');
    });

    // Rough labour.
    const roughHours = fixtures.reduce((sum, entry) => sum + entry.type.labourRough, 0)
        + waterLength * 0.12 + drainLength * 0.18 + gas.edges.reduce((sum, edge) => sum + edge.length, 0) * 0.12
        + (plan.waterHeater ? heaterById(plan.waterHeater.typeId).installHours : 0) + 3;
    add('rough', 'Labour', 'Plumbing rough-in labour', round(roughHours, 1), 'h', LABOUR_RATE_ROUGH, 'Layout, drilling, piping, fitting and pressure testing.', true);

    // Finish fixtures and trim.
    fixtures.forEach((entry) => {
        const grade = finishGradeById(entry.finish);
        const faucet = faucetFinishById(entry.faucet);
        const fixtureCost = entry.type.baseCost > 0
            ? entry.type.baseCost * grade.multiplier + entry.type.trimCost
            : 0;
        if (fixtureCost > 0) {
            add('finish', 'Fixtures', `${entry.type.label} · ${grade.label}`, 1, 'ea', fixtureCost, `${entry.tag} · ${entry.type.notes}`);
        } else if (entry.type.trimCost > 0) {
            add('finish', 'Fixtures', `${entry.type.label} connection trim`, 1, 'ea', entry.type.trimCost, `${entry.tag} · appliance supplied by owner.`);
        }
        if (entry.type.hasFaucet) {
            add('finish', 'Faucets & trim', `${entry.type.label} faucet · ${faucet.label}`, 1, 'ea', 140 * grade.multiplier + faucet.cost, 'Faucet, spout, handles and aerator.');
        }
        if (entry.type.dfu > 0) {
            if (plan.finish.supplyStops) add('finish', 'Faucets & trim', 'Supply stops and escutcheons', 2, 'ea', SUPPLY_STOP_COST, 'One stop per supply; quarter-turn ball stops.');
            add('finish', 'Faucets & trim', 'Trap and drain trim', 1, 'ea', TRAP_TRIM_COST, 'P-trap, tailpiece and escutcheon; trap arm is rough.');
        }
        if (entry.type.id === 'hose-bib') {
            add('finish', 'Faucets & trim', 'Hose-bib vacuum breaker', 1, 'ea', 22, 'Backflow protection at the sillcock.');
        }
        if (entry.type.id === 'gas-range' || entry.type.id === 'gas-dryer' || entry.type.id === 'gas-grill') {
            if (plan.gas.connectors) add('finish', 'Fuel gas trim', 'Appliance connector', 1, 'ea', GAS_CONNECTOR_COST, 'Listed connector for the final connection.');
        }
    });
    if (fixtures.some((entry) => entry.type.id === 'dishwasher') && plan.finish.airGap) {
        add('finish', 'Faucets & trim', 'Dishwasher air gap', 1, 'ea', 38, 'Air gap or high loop for the drain.');
    }
    if (fixtures.some((entry) => entry.type.id === 'washing-machine') && plan.finish.washerStandpipe) {
        add('finish', 'Faucets & trim', 'Washing-machine hoses and standpipe trim', 1, 'set', 58, 'Braided hoses, standpipe trim and drain hose.');
    }
    const finishHours = fixtures.reduce((sum, entry) => sum + entry.type.labourFinish, 0)
        + fixtures.filter((entry) => entry.type.hasFaucet).length * 0.8 + 2;
    add('finish', 'Labour', 'Fixture and trim labour', round(finishHours, 1), 'h', LABOUR_RATE_FINISH, 'Set fixtures, faucets, trim, drains and final connections.', true);

    const groupsFor = (part) => {
        const map = new Map();
        rows.filter((row) => row.part === part).forEach((row) => {
            if (!map.has(row.group)) map.set(row.group, { group: row.group, rows: [], total: 0 });
            const group = map.get(row.group);
            group.rows.push(row);
            group.total = money(group.total + row.total);
        });
        return [...map.values()];
    };
    const totalsFor = (part) => {
        const partRows = rows.filter((row) => row.part === part);
        return {
            rows: partRows,
            groups: groupsFor(part),
            materials: money(partRows.filter((row) => !row.labour).reduce((sum, row) => sum + row.total, 0)),
            labour: money(partRows.filter((row) => row.labour).reduce((sum, row) => sum + row.total, 0)),
            total: money(partRows.reduce((sum, row) => sum + row.total, 0))
        };
    };
    const rough = totalsFor('rough');
    const finish = totalsFor('finish');
    return {
        rows,
        rough,
        finish,
        total: money(rough.total + finish.total),
        assumptions: [
            'Prices are planning allowances in US dollars, not quotes; supplier pricing, permits and utility fees vary.',
            'Pipe lengths are measured on orthogonal routes plus 10% waste; fittings are an allowance, not a piece count.',
            'Rough labour is $95/h and finish labour is $85/h at a planning rate; access, drywall repair and permits are excluded.',
            'Fixtures are priced at the selected grade; appliances such as a range, dryer or washing machine are owner-supplied unless noted.',
            'The model code is the 2021 IPC / IRC and 2021 IFGC with US customary fixture units; local amendments always win.'
        ]
    };
}

function buildSchedule(fixtures, water, gas, plan) {
    return fixtures.map((entry) => {
        const faucet = faucetFinishById(entry.faucet);
        const grade = finishGradeById(entry.finish);
        const gasFlow = entry.type.gasBtu > 0 ? gasCfh(entry.type.gasBtu, plan.gas.type) : 0;
        return {
            id: entry.id,
            tag: entry.tag,
            fixture: entry.type.label,
            group: entry.type.group,
            location: entry.wall === 'free' ? `Floor at ${entry.position.x.toFixed(2)}, ${entry.position.y.toFixed(2)} m` : `${entry.wall} wall at ${entry.along.toFixed(2)} m`,
            coldWsfu: entry.type.wsfuCold,
            hotWsfu: entry.type.wsfuHot,
            dfu: entry.type.dfu,
            drain: entry.type.drainSize || '—',
            supply: entry.type.supplySize || '—',
            gasBtu: entry.type.gasBtu,
            gasCfh: gasFlow,
            finish: `${grade.label} · ${faucet.label}`,
            pressure: water.readings.find((reading) => reading.id === entry.id)?.pressure ?? null
        };
    });
}

export const GLOSSARY = [
    { term: 'Rough-in', category: 'Two-part suite', short: 'The piping, fittings and equipment installed before the walls are closed.', detail: 'Part 1 covers the service hookups, supply and DWV routes, venting, gas piping, water heater and the rough-in inspection.' },
    { term: 'Finish', category: 'Two-part suite', short: 'The visible fixtures, faucets, trim and final connections installed after the finishes.', detail: 'Part 2 covers the fixture schedule, finish grade, faucets, stops, traps and the final plumbing inspection.' },
    { term: 'Water service', category: 'Water', short: 'The pipe from the meter or private well to the building shutoff.', detail: 'Sized on demand and pressure; a 1 in service is common for a whole house, but the meter and utility rules decide the final size.' },
    { term: 'WSFU', category: 'Water', short: 'Water supply fixture unit — a relative demand weight for one fixture.', detail: 'The suite sums cold and hot fixture units, converts them to peak demand with a Hunter-style curve, then sizes the service and branches.' },
    { term: 'Residual pressure', category: 'Water', short: 'The pressure left at a fixture while it is flowing.', detail: 'Static pressure minus elevation, meter loss and pipe friction. The usual planning target is at least 8 psi at the worst fixture.' },
    { term: 'PRV', category: 'Water', short: 'Pressure reducing valve; keeps street pressure from damaging the system.', detail: 'Required when static pressure is above about 80 psi. Set it to 50–60 psi and leave a test port.' },
    { term: 'Thermal expansion', category: 'Water', short: 'Water grows when heated; a closed system needs somewhere for it to go.', detail: 'A check valve, backflow preventer or PRV can trap the expansion. Add a listed expansion tank on a storage heater.' },
    { term: 'DFU', category: 'Drainage', short: 'Drainage fixture unit — the likely waste load of a fixture.', detail: 'The suite sizes branch, stack and building drain from DFU, then checks the slope, invert and trap arms.' },
    { term: 'Trap arm', category: 'Drainage', short: 'The pipe between a fixture trap and its vent connection.', detail: 'Length limits depend on pipe size and fixture; a long trap arm siphons the trap and smells.' },
    { term: 'Building drain', category: 'Drainage', short: 'The horizontal drain inside the building that leads to the building sewer.', detail: 'Slope is 2% up to 2-1/2 in and 1% for 3–6 in under IPC Table 704.1; the suite uses the conservative value.' },
    { term: 'Sewer invert', category: 'Drainage', short: 'The elevation of the inside bottom of the sewer pipe at the connection.', detail: 'The invert must be low enough for the building drain to fall to it without lifting the pipe.' },
    { term: 'Stack vent', category: 'Venting', short: 'The continuation of a soil or waste stack through the roof.', detail: 'The stack vent lets air into the drain so traps do not siphon. Wet venting has extra rules; confirm the fixture order.' },
    { term: 'Cleanout', category: 'Drainage', short: 'A removable access plug for clearing a drain.', detail: 'Typical locations are the base of each stack and the building sewer; long horizontal runs need more.' },
    { term: 'Air gap', category: 'Water quality', short: 'A physical break between a fixture drain and the sewer.', detail: 'A dishwasher air gap or a high loop stops waste from siphoning into the appliance.' },
    { term: 'Backflow', category: 'Water quality', short: 'Water flowing the wrong way in a supply pipe.', detail: 'A hose bib needs a vacuum breaker; a boiler or irrigation system needs the device listed for its hazard.' },
    { term: 'T&P relief', category: 'Water heater', short: 'Temperature and pressure relief valve on a storage water heater.', detail: 'It needs a full-size discharge pipe to a safe place, never a cap or a reduced line.' },
    { term: 'Sediment trap', category: 'Fuel gas', short: 'A dirt leg downstream of the appliance shutoff.', detail: 'It catches pipe scale before it reaches the appliance controls; a tee with a capped nipple is the usual form.' },
    { term: 'Appliance connector', category: 'Fuel gas', short: 'The listed flexible or rigid final connection to a gas appliance.', detail: 'Keep it accessible, protected and not used to support the appliance.' },
    { term: 'Combustion air', category: 'Fuel gas', short: 'The air a gas appliance needs to burn safely.', detail: 'A closet furnace or water heater may need high and low openings or a direct-vent kit; the suite flags venting as a coordination item.' },
    { term: 'Water heater first-hour rating', category: 'Water heater', short: 'How much hot water the tank can deliver in the first hour.', detail: 'Compare it with the morning demand; a tankless unit is sized on the coldest incoming water and simultaneous fixtures.' },
    { term: 'Fixture clearance', category: 'Fixtures', short: 'The free space around a fixture for use and cleaning.', detail: 'A water closet needs 15 in centre to a side wall and 21 in in front; the suite also checks centre-to-centre spacing.' },
    { term: 'Rough-in inspection', category: 'Inspection', short: 'The inspection after piping is installed and before it is covered.', detail: 'The drain is usually water-tested and the supply is pressure-tested; photograph the walls before closing them.' },
    { term: 'Final inspection', category: 'Inspection', short: 'The inspection after fixtures and trim are installed and working.', detail: 'Every fixture should drain, every valve should shut off, and the water heater relief and gas connections should be visible and accessible.' }
];

export function glossaryByCategory() {
    const map = new Map();
    GLOSSARY.forEach((entry) => {
        if (!map.has(entry.category)) map.set(entry.category, { category: entry.category, entries: [] });
        map.get(entry.category).entries.push(entry);
    });
    return [...map.values()];
}

/** Build every plumbing number for one plan. */
export function designPlumbing(rawPlan) {
    const plan = normalizePlan(rawPlan);
    const fixtures = tagFixtures(plan);
    const water = buildWaterModel(plan, fixtures);
    const drain = buildDrainModel(plan, fixtures);
    const gas = buildGasModel(plan, fixtures, water.heater);
    const checks = buildChecks(plan, fixtures, water, drain, gas);
    const takeoff = buildTakeoff(plan, fixtures, water, drain, gas);
    const schedule = buildSchedule(fixtures, water, gas, plan);
    const errors = checks.filter((entry) => entry.severity === 'error');
    const warnings = checks.filter((entry) => entry.severity === 'warn');
    const okChecks = checks.filter((entry) => entry.severity === 'ok');
    const pressureValues = water.readings.map((entry) => entry.pressure);
    return {
        plan,
        fixtures,
        water,
        drain,
        gas,
        checks,
        errors,
        warnings,
        ok: okChecks,
        takeoff,
        schedule,
        summary: {
            fixtureCount: fixtures.length,
            waterFixtures: waterFixtures(plan).length,
            drainFixtures: drainFixtures(plan).length,
            gasAppliances: gas.applianceCount,
            totalWsfu: water.totalWsfu,
            demandGpm: water.demandGpm,
            totalDfu: drain.totalDfu,
            gasCfh: gas.totalCfh,
            rough: takeoff.rough.total,
            finish: takeoff.finish.total,
            total: takeoff.total,
            errors: errors.length,
            warnings: warnings.length,
            residual: water.residual,
            pressureRange: pressureValues.length ? [Math.min(...pressureValues), Math.max(...pressureValues)] : [0, 0]
        },
        counts: planSummary(plan)
    };
}

export function designSummaryText(design) {
    const summary = design.summary;
    return `${summary.fixtureCount} fixtures · ${summary.demandGpm} gpm · ${summary.totalDfu} DFU · ${summary.gasCfh} CFH · rough $${summary.rough.toLocaleString()} + finish $${summary.finish.toLocaleString()}`;
}

const csvCell = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function scheduleCsv(design) {
    const header = ['Tag', 'Fixture', 'Group', 'Location', 'Cold WSFU', 'Hot WSFU', 'DFU', 'Drain', 'Supply', 'Gas BTU', 'Gas CFH', 'Finish', 'Pressure (psi)'];
    const rows = design.schedule.map((entry) => [
        entry.tag, entry.fixture, entry.group, entry.location, entry.coldWsfu, entry.hotWsfu,
        entry.dfu, entry.drain, entry.supply, entry.gasBtu, entry.gasCfh, entry.finish, entry.pressure ?? ''
    ]);
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function takeoffCsv(design, part = 'rough') {
    const section = design.takeoff[part];
    const header = ['Part', 'Group', 'Item', 'Qty', 'Unit', 'Unit cost', 'Total', 'Labour', 'Note'];
    const rows = section.rows.map((row) => [
        part, row.group, row.label, row.qty, row.unit, row.unitCost.toFixed(2), row.total.toFixed(2),
        row.labour ? 'yes' : 'no', row.note
    ]);
    rows.push(['', '', 'Materials', '', '', '', section.materials.toFixed(2), '', '']);
    rows.push(['', '', 'Labour', '', '', '', section.labour.toFixed(2), '', '']);
    rows.push(['', '', 'TOTAL', '', '', '', section.total.toFixed(2), '', '']);
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function scheduleSummary(design) {
    return design.schedule.map((entry) => `${entry.tag}: ${entry.fixture} · ${entry.drain} drain · ${entry.finish}`).join('\n');
}
