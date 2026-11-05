import {
    HOOKUP_SIDES,
    FIXTURE_TYPES,
    WATER_MATERIALS,
    DWV_MATERIALS,
    DWV_SIZES,
    GAS_MATERIALS,
    fixtureById,
    heaterById,
    templateById,
    PLAN_TEMPLATES,
    finishGradeById,
    faucetFinishById
} from './catalog.js';

/**
 * Plumbing plan model.
 *
 * Plan coordinates are metres: x runs left to right, y runs from the north wall
 * (top) to the south wall (bottom). Walls sit at x = 0 / width and y = 0 / depth.
 * Most fixtures hang on a wall and store `wall` + `along`; a floor drain can be
 * free at `x` + `y`. Positions are derived, so changing a room dimension keeps
 * the layout coherent.
 */

export const WALLS = ['north', 'south', 'east', 'west'];

const round = (value, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max);

function nextId(plan, prefix) {
    plan.seq = (plan.seq || 0) + 1;
    return `${prefix}_${plan.seq}`;
}

export function wallPoint(plan, wall, along) {
    if (wall === 'north') return { x: round(clamp(along, 0, plan.width)), y: 0 };
    if (wall === 'south') return { x: round(clamp(along, 0, plan.width)), y: plan.depth };
    if (wall === 'west') return { x: 0, y: round(clamp(along, 0, plan.depth)) };
    return { x: plan.width, y: round(clamp(along, 0, plan.depth)) };
}

export function nearestWall(plan, x, y) {
    return [
        { wall: 'north', distance: Math.abs(y), along: x },
        { wall: 'south', distance: Math.abs(plan.depth - y), along: x },
        { wall: 'west', distance: Math.abs(x), along: y },
        { wall: 'east', distance: Math.abs(plan.width - x), along: y }
    ].sort((a, b) => a.distance - b.distance)[0];
}

/** Rotation that puts the back of a wall fixture against its wall. */
export function rotationForWall(wall) {
    if (wall === 'south') return Math.PI;
    if (wall === 'west') return -Math.PI / 2;
    if (wall === 'east') return Math.PI / 2;
    return 0;
}

export function bodySize(width, depth, wall) {
    return wall === 'east' || wall === 'west'
        ? { x: depth, y: width }
        : { x: width, y: depth };
}

/** The centre of a fixture on the plan. */
export function positionFor(plan, item, type = fixtureById(item.typeId)) {
    if (item.wall === 'free') {
        return {
            x: round(clamp(Number(item.x) || 0.45, 0, plan.width)),
            y: round(clamp(Number(item.y) || 0.45, 0, plan.depth))
        };
    }
    const wall = WALLS.includes(item.wall) ? item.wall : 'north';
    const along = clamp(Number(item.along) || 0, 0, wall === 'north' || wall === 'south' ? plan.width : plan.depth);
    if (wall === 'north') return { x: round(along), y: round(type.depth / 2) };
    if (wall === 'south') return { x: round(along), y: round(plan.depth - type.depth / 2) };
    if (wall === 'west') return { x: round(type.depth / 2), y: round(along) };
    return { x: round(plan.width - type.depth / 2), y: round(along) };
}

export function boundsFor(plan, item, type = fixtureById(item.typeId)) {
    const centre = positionFor(plan, item, type);
    const body = bodySize(type.width, type.depth, item.wall);
    return {
        left: centre.x - body.x / 2,
        right: centre.x + body.x / 2,
        top: centre.y - body.y / 2,
        bottom: centre.y + body.y / 2,
        width: body.x,
        height: body.y,
        centre
    };
}

export function heaterPosition(plan, heater, type = heaterById(heater.typeId)) {
    return positionFor(plan, { ...heater, typeId: heater.typeId }, type);
}

export function hookupPoint(plan, service) {
    const config = plan[service];
    if (!config) return { x: 0, y: 0 };
    return wallPoint(plan, config.side, config.along);
}

/**
 * Zone boxes are a drawing aid, not a building model. They give the plan
 * readable rooms so a user can see where the bathroom, kitchen and laundry
 * sit before moving a fixture.
 */
export function zonesFor(width, depth) {
    const pad = 0.22;
    const bathW = Math.min(width * 0.43, 4.5);
    const bathH = Math.min(depth * 0.37, 3.2);
    const kitchenW = Math.min(width * 0.46, 5.2);
    const kitchenH = Math.min(depth * 0.35, 3.0);
    const laundryW = Math.min(width * 0.34, 4.0);
    const laundryH = Math.min(depth * 0.35, 3.0);
    const utilityW = Math.min(width * 0.30, 3.4);
    const utilityH = Math.min(depth * 0.33, 2.7);
    return [
        { id: 'utility', label: 'UTILITY', x: pad, y: pad, width: Math.max(utilityW, 1.4), height: Math.max(utilityH, 1.2) },
        { id: 'kitchen', label: 'KITCHEN', x: width - pad - Math.max(kitchenW, 1.6), y: pad, width: Math.max(kitchenW, 1.6), height: Math.max(kitchenH, 1.4) },
        { id: 'bath', label: 'BATH', x: pad, y: depth - pad - Math.max(bathH, 1.4), width: Math.max(bathW, 1.8), height: Math.max(bathH, 1.4) },
        { id: 'laundry', label: 'LAUNDRY', x: width - pad - Math.max(laundryW, 1.4), y: depth - pad - Math.max(laundryH, 1.4), width: Math.max(laundryW, 1.4), height: Math.max(laundryH, 1.4) }
    ];
}

function defaultFixture(typeId, plan) {
    const type = fixtureById(typeId);
    return {
        id: nextId(plan, 'fixture'),
        typeId: type.id,
        name: type.label,
        wall: 'north',
        along: 1,
        finish: plan.fixtureGrade || 'standard',
        faucet: plan.faucetFinish || 'chrome',
        vacuumBreaker: type.id === 'hose-bib',
        notes: ''
    };
}

export function createPlan({
    width = 11.5,
    depth = 8.5,
    wallHeight = 2.7,
    template = 'house',
    fixtures = null,
    heater = undefined
} = {}) {
    const preset = templateById(template);
    const w = clamp(Number(width) || preset.width, 3, 40);
    const d = clamp(Number(depth) || preset.depth, 3, 40);
    const plan = {
        id: `plumbing_plan_${Date.now()}`,
        template: preset.id,
        width: round(w),
        depth: round(d),
        wallHeight: round(clamp(Number(wallHeight) || 2.7, 2.2, 6)),
        fixtureGrade: 'standard',
        faucetFinish: 'chrome',
        water: {
            side: 'west',
            along: round(d * 0.42),
            pressure: 60,
            meterSize: '3/4',
            serviceMaterial: 'pex',
            mainLength: round(Math.max(8, w + d * 0.7)),
            backflow: 'dual-check',
            recirculation: false,
            insulation: true
        },
        sewer: {
            side: 'east',
            along: round(d * 0.55),
            invert: -1.2,
            size: '4',
            slope: 0.02,
            mainLength: round(Math.max(8, w + d * 0.6)),
            material: 'pvc',
            cleanouts: 2
        },
        gas: {
            side: 'north',
            along: round(w * 0.72),
            pressure: 7,
            type: 'natural',
            meterCapacity: 250,
            mainLength: round(Math.max(8, w * 0.8 + d * 0.5)),
            material: 'black-steel',
            sedimentTraps: true,
            shutoffs: true,
            connectors: true,
            venting: true
        },
        waterHeater: heater === false || (!heater && !preset.heater) ? null : {
            id: 'heater_1',
            typeId: heater || preset.heater || 'tank-50-gas',
            wall: 'north',
            along: 0.65,
            finish: 'standard',
            pan: true,
            expansionTank: true,
            reliefPipe: true,
            insulated: true,
            temperature: 120
        },
        fixtures: [],
        finish: {
            airGap: true,
            washerStandpipe: true,
            supplyStops: true,
            iceMakerLine: false
        },
        seq: 0
    };
    const typeIds = fixtures || preset.fixtures || [];
    typeIds.forEach((typeId) => {
        const type = fixtureById(typeId);
        const entry = defaultFixture(type.id, plan);
        plan.fixtures.push(entry);
    });
    autoLayout(plan, { resetHookups: true });
    return plan;
}

/** Fill in every field an older or hand-edited plan may be missing. */
export function normalizePlan(raw) {
    if (!raw || typeof raw !== 'object') return createPlan();
    const base = createPlan({
        width: raw.width,
        depth: raw.depth,
        wallHeight: raw.wallHeight,
        template: raw.template,
        fixtures: [],
        heater: false
    });
    const plan = {
        ...base,
        ...raw,
        water: { ...base.water, ...(raw.water || {}) },
        sewer: { ...base.sewer, ...(raw.sewer || {}) },
        gas: { ...base.gas, ...(raw.gas || {}) },
        finish: { ...base.finish, ...(raw.finish || {}) },
        waterHeater: raw.waterHeater
            ? { ...base.waterHeater, ...raw.waterHeater }
            : null,
        fixtures: Array.isArray(raw.fixtures) ? raw.fixtures : []
    };
    plan.width = round(clamp(Number(plan.width) || 11.5, 3, 40));
    plan.depth = round(clamp(Number(plan.depth) || 8.5, 3, 40));
    plan.wallHeight = round(clamp(Number(plan.wallHeight) || 2.7, 2.2, 6));
    plan.template = templateById(plan.template).id;
    plan.fixtureGrade = finishGradeById(plan.fixtureGrade).id;
    plan.faucetFinish = faucetFinishById(plan.faucetFinish).id;
    plan.water.side = HOOKUP_SIDES.includes(plan.water.side) ? plan.water.side : 'west';
    plan.sewer.side = HOOKUP_SIDES.includes(plan.sewer.side) ? plan.sewer.side : 'east';
    plan.gas.side = HOOKUP_SIDES.includes(plan.gas.side) ? plan.gas.side : 'north';
    plan.water.serviceMaterial = WATER_MATERIALS.some((entry) => entry.id === plan.water.serviceMaterial) ? plan.water.serviceMaterial : 'pex';
    plan.sewer.material = DWV_MATERIALS.some((entry) => entry.id === plan.sewer.material) ? plan.sewer.material : 'pvc';
    plan.gas.material = GAS_MATERIALS.some((entry) => entry.id === plan.gas.material) ? plan.gas.material : 'black-steel';
    plan.sewer.size = DWV_SIZES.some((entry) => entry.id === plan.sewer.size) ? plan.sewer.size : '4';
    plan.water.meterSize = ['5/8', '3/4', '1', '1-1/4'].includes(plan.water.meterSize) ? plan.water.meterSize : '3/4';
    plan.water.backflow = ['dual-check', 'rpz', 'none'].includes(plan.water.backflow) ? plan.water.backflow : 'dual-check';
    plan.gas.type = plan.gas.type === 'propane' ? 'propane' : 'natural';
    plan.water.insulation = plan.water.insulation !== false;
    plan.finish.airGap = plan.finish.airGap !== false;
    plan.finish.washerStandpipe = plan.finish.washerStandpipe !== false;
    plan.finish.supplyStops = plan.finish.supplyStops !== false;
    plan.finish.iceMakerLine = plan.finish.iceMakerLine === true;
    plan.water.along = round(clamp(plan.water.along, 0, plan.water.side === 'north' || plan.water.side === 'south' ? plan.width : plan.depth));
    plan.sewer.along = round(clamp(plan.sewer.along, 0, plan.sewer.side === 'north' || plan.sewer.side === 'south' ? plan.width : plan.depth));
    plan.gas.along = round(clamp(plan.gas.along, 0, plan.gas.side === 'north' || plan.gas.side === 'south' ? plan.width : plan.depth));
    plan.water.pressure = round(clamp(plan.water.pressure, 20, 150));
    const invert = Number(plan.sewer.invert);
    plan.sewer.invert = round(Number.isFinite(invert) ? Math.min(Math.max(invert, -5), 0.5) : -1.2);
    plan.sewer.slope = round(clamp(plan.sewer.slope, 0.005, 0.1));
    plan.gas.pressure = round(clamp(plan.gas.pressure, 3, 60));
    plan.gas.meterCapacity = round(clamp(plan.gas.meterCapacity, 50, 5000));

    plan.fixtures = plan.fixtures
        .filter((entry) => entry && typeof entry === 'object' && fixtureById(entry.typeId).id === entry.typeId)
        .map((entry, index) => {
            const type = fixtureById(entry.typeId);
            const wall = entry.wall === 'free' || WALLS.includes(entry.wall) ? entry.wall : 'north';
            return {
                ...entry,
                id: entry.id || `fixture_${index + 1}`,
                typeId: type.id,
                name: entry.name || type.label,
                wall,
                along: round(clamp(Number(entry.along) || 0.8, 0, wall === 'north' || wall === 'south' ? plan.width : plan.depth)),
                x: round(clamp(Number(entry.x) || 0.6, 0, plan.width)),
                y: round(clamp(Number(entry.y) || 0.6, 0, plan.depth)),
                finish: finishGradeById(entry.finish).id,
                faucet: faucetFinishById(entry.faucet).id,
                vacuumBreaker: entry.vacuumBreaker !== false
            };
        });

    if (plan.waterHeater) {
        const heaterWall = plan.waterHeater.wall === 'free' || WALLS.includes(plan.waterHeater.wall) ? plan.waterHeater.wall : 'north';
        const heaterRun = heaterWall === 'north' || heaterWall === 'south' ? plan.width : plan.depth;
        plan.waterHeater = {
            ...plan.waterHeater,
            id: plan.waterHeater.id || 'heater_1',
            typeId: heaterById(plan.waterHeater.typeId).id,
            wall: heaterWall,
            along: round(clamp(Number(plan.waterHeater.along) || 0.65, 0, heaterRun)),
            finish: finishGradeById(plan.waterHeater.finish).id,
            pan: plan.waterHeater.pan !== false,
            expansionTank: plan.waterHeater.expansionTank !== false,
            reliefPipe: plan.waterHeater.reliefPipe !== false,
            insulated: plan.waterHeater.insulated !== false,
            temperature: round(clamp(Number(plan.waterHeater.temperature) || 120, 100, 160))
        };
    }

    plan.seq = Math.max(Number(plan.seq) || 0, plan.fixtures.length, plan.waterHeater ? 1 : 0);
    if (!plan.fixtures.length) autoLayout(plan, { resetHookups: true });
    return plan;
}

/** Replace the plan's fixture set with a template. */
export function applyTemplate(plan, templateId) {
    const preset = templateById(templateId);
    const next = createPlan({
        width: preset.width,
        depth: preset.depth,
        wallHeight: plan.wallHeight,
        template: preset.id,
        fixtures: preset.fixtures,
        heater: preset.heater
    });
    next.id = plan.id;
    next.water = { ...plan.water, along: round(preset.depth * 0.42) };
    next.sewer = { ...plan.sewer, along: round(preset.depth * 0.55) };
    next.gas = { ...plan.gas, along: round(preset.width * 0.72) };
    next.fixtureGrade = plan.fixtureGrade;
    next.faucetFinish = plan.faucetFinish;
    autoLayout(next, { resetHookups: true });
    return next;
}

/**
 * Lay the fixtures out in the zones: bathroom along the south wall, kitchen
 * along the north, laundry along the south-east, utility in the north-west.
 * Water heater, floor drain and hose bib are handled separately so they do not
 * collide with the wall runs.
 */
export function autoLayout(plan, { resetHookups = false } = {}) {
    if (resetHookups) {
        plan.water.side = 'west';
        plan.water.along = round(plan.depth * 0.42);
        plan.sewer.side = 'east';
        plan.sewer.along = round(plan.depth * 0.55);
        plan.gas.side = 'north';
        plan.gas.along = round(plan.width * 0.72);
    }

    const pools = {
        bath: [],
        kitchen: [],
        laundry: [],
        utility: [],
        outdoor: [],
        gas: []
    };
    plan.fixtures.forEach((entry) => {
        const type = fixtureById(entry.typeId);
        if (type.id === 'gas-range') pools.kitchen.push(entry);
        else if (type.id === 'gas-dryer') pools.laundry.push(entry);
        else if (type.id === 'gas-furnace' || type.id === 'gas-fireplace') pools.utility.push(entry);
        else if (type.id === 'gas-grill') pools.outdoor.push(entry);
        else if (pools[type.group]) pools[type.group].push(entry);
        else pools.utility.push(entry);
    });

    const placeRun = (entries, wall, start, gap = 0.3) => {
        let cursor = start;
        entries.forEach((entry) => {
            const type = fixtureById(entry.typeId);
            if (type.id === 'floor-drain') return;
            const width = type.width;
            const centre = cursor + width / 2;
            entry.wall = wall;
            entry.along = round(centre);
            cursor = centre + width / 2 + gap;
        });
    };

    // Bathroom: water closet, lavatory, then the tub or shower.
    placeRun(pools.bath, 'south', 0.5, 0.31);
    // Kitchen: keep the range at one end, then the sink and dishwasher.
    placeRun(pools.kitchen, 'north', plan.width * 0.56, 0.24);
    // Laundry: washer, dryer, then a laundry sink if present.
    placeRun(pools.laundry, 'south', plan.width * 0.66, 0.24);
    // Utility fixtures other than the floor drain go on the west wall.
    placeRun(pools.utility.filter((entry) => fixtureById(entry.typeId).id !== 'gas-furnace' && fixtureById(entry.typeId).id !== 'gas-fireplace'), 'west', 2.4, 0.3);
    placeRun(pools.outdoor, 'west', plan.depth * 0.52, 0.3);

    // The furnace and fireplace need a wall but not a water connection.
    const utilityGas = pools.utility.filter((entry) => ['gas-furnace', 'gas-fireplace'].includes(fixtureById(entry.typeId).id));
    let utilityCursor = 1.65;
    utilityGas.forEach((entry) => {
        const type = fixtureById(entry.typeId);
        entry.wall = 'north';
        entry.along = round(utilityCursor + type.width / 2);
        utilityCursor += type.width + 0.4;
    });

    // Floor drains sit on the floor near the utility corner.
    const floorDrains = plan.fixtures.filter((entry) => fixtureById(entry.typeId).id === 'floor-drain');
    floorDrains.forEach((entry, index) => {
        entry.wall = 'free';
        entry.x = round(clamp(0.8 + index * 0.65, 0.3, plan.width - 0.3));
        entry.y = round(clamp(2.15, 0.3, plan.depth - 0.3));
    });

    // Gas grill on the east wall, clear of the kitchen run.
    const grill = plan.fixtures.find((entry) => fixtureById(entry.typeId).id === 'gas-grill');
    if (grill) {
        grill.wall = 'east';
        grill.along = round(clamp(1.2, 0.4, plan.depth - 0.4));
    }

    // Water heater in the utility corner, on the north wall.
    if (plan.waterHeater) {
        plan.waterHeater.wall = 'north';
        plan.waterHeater.along = 0.62;
    }

    resolveWallOverlaps(plan);
    return plan;
}

/** Nudge fixtures apart along a shared wall after auto layout or a drag. */
export function resolveWallOverlaps(plan) {
    const runs = new Map();
    plan.fixtures.forEach((entry) => {
        if (entry.wall === 'free') return;
        if (!runs.has(entry.wall)) runs.set(entry.wall, []);
        runs.get(entry.wall).push(entry);
    });
    runs.forEach((entries, wall) => {
        const length = wall === 'north' || wall === 'south' ? plan.width : plan.depth;
        entries.sort((a, b) => a.along - b.along);
        let cursor = 0.15;
        entries.forEach((entry) => {
            const type = fixtureById(entry.typeId);
            const half = type.width / 2;
            const minimum = cursor + half;
            if (entry.along < minimum) entry.along = round(minimum);
            entry.along = round(clamp(entry.along, half + 0.05, length - half - 0.05));
            cursor = entry.along + half;
        });
    });
    return plan;
}

export function fixtureAt(plan, x, y, tolerance = 0.32) {
    let best = null;
    plan.fixtures.forEach((entry) => {
        const type = fixtureById(entry.typeId);
        const centre = positionFor(plan, entry, type);
        const distance = Math.hypot(centre.x - x, centre.y - y);
        const hit = Math.max(type.width, type.depth) / 2 + tolerance;
        if (distance <= hit && (!best || distance < best.distance)) best = { fixture: entry, distance };
    });
    return best ? best.fixture : null;
}

export function heaterAt(plan, x, y, tolerance = 0.3) {
    if (!plan.waterHeater) return null;
    const type = heaterById(plan.waterHeater.typeId);
    const centre = heaterPosition(plan, plan.waterHeater, type);
    return Math.hypot(centre.x - x, centre.y - y) <= Math.max(type.width, type.depth) / 2 + tolerance
        ? plan.waterHeater
        : null;
}

export function hookupAt(plan, x, y, tolerance = 0.34) {
    const hits = ['water', 'sewer', 'gas'].map((service) => {
        const point = hookupPoint(plan, service);
        return { service, distance: Math.hypot(point.x - x, point.y - y) };
    });
    const best = hits.sort((a, b) => a.distance - b.distance)[0];
    return best && best.distance <= tolerance ? best.service : null;
}

export function addFixture(plan, typeId, x, y) {
    const type = fixtureById(typeId);
    const entry = defaultFixture(type.id, plan);
    if (type.id === 'floor-drain') {
        entry.wall = 'free';
        entry.x = round(clamp(x, 0.3, plan.width - 0.3));
        entry.y = round(clamp(y, 0.3, plan.depth - 0.3));
    } else {
        const nearest = nearestWall(plan, x, y);
        entry.wall = nearest.wall;
        entry.along = round(nearest.along);
    }
    plan.fixtures.push(entry);
    resolveWallOverlaps(plan);
    return entry;
}

export function removeFixture(plan, id) {
    const index = plan.fixtures.findIndex((entry) => entry.id === id);
    if (index < 0) return null;
    return plan.fixtures.splice(index, 1)[0];
}

export function moveFixture(plan, id, x, y) {
    const entry = plan.fixtures.find((item) => item.id === id);
    if (!entry) return null;
    const type = fixtureById(entry.typeId);
    if (entry.wall === 'free' || type.id === 'floor-drain') {
        entry.wall = 'free';
        entry.x = round(clamp(x, 0.2, plan.width - 0.2));
        entry.y = round(clamp(y, 0.2, plan.depth - 0.2));
        return entry;
    }
    const nearest = nearestWall(plan, x, y);
    entry.wall = nearest.wall;
    entry.along = round(nearest.along);
    resolveWallOverlaps(plan);
    return entry;
}

export function moveHeater(plan, x, y) {
    if (!plan.waterHeater) return null;
    const type = heaterById(plan.waterHeater.typeId);
    if (type.mount === 'wall' || plan.waterHeater.wall === 'free') {
        const nearest = nearestWall(plan, x, y);
        plan.waterHeater.wall = nearest.wall;
        plan.waterHeater.along = round(nearest.along);
    } else {
        const nearest = nearestWall(plan, x, y);
        plan.waterHeater.wall = nearest.wall;
        plan.waterHeater.along = round(nearest.along);
    }
    return plan.waterHeater;
}

export function setHookup(plan, service, side, along) {
    if (!plan[service] || !HOOKUP_SIDES.includes(side)) return null;
    plan[service].side = side;
    plan[service].along = round(clamp(along, 0, side === 'north' || side === 'south' ? plan.width : plan.depth));
    return plan[service];
}

export function fixturesOf(plan, predicate = () => true) {
    return plan.fixtures.filter((entry) => predicate(fixtureById(entry.typeId)));
}

export function drainFixtures(plan) {
    return fixturesOf(plan, (type) => type.dfu > 0);
}

export function gasFixtures(plan) {
    return fixturesOf(plan, (type) => type.gasBtu > 0);
}

export function waterFixtures(plan) {
    return fixturesOf(plan, (type) => type.wsfuCold + type.wsfuHot > 0);
}

export function hasGas(plan) {
    return gasFixtures(plan).length > 0 || Boolean(plan.waterHeater && heaterById(plan.waterHeater.typeId).gasBtu > 0);
}

export function planSummary(plan) {
    const typeCounts = {};
    plan.fixtures.forEach((entry) => {
        const type = fixtureById(entry.typeId);
        typeCounts[type.id] = (typeCounts[type.id] || 0) + 1;
    });
    return {
        fixtures: plan.fixtures.length,
        drains: drainFixtures(plan).length,
        water: waterFixtures(plan).length,
        gas: gasFixtures(plan).length + (plan.waterHeater && heaterById(plan.waterHeater.typeId).gasBtu > 0 ? 1 : 0),
        heater: plan.waterHeater ? heaterById(plan.waterHeater.typeId) : null,
        typeCounts
    };
}

export const PLAN_TEMPLATE_LIST = PLAN_TEMPLATES;
export { FIXTURE_TYPES };
