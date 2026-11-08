/**
 * Landscape suite — pools and water features.
 *
 * Sizes a pool, spa, fountain, pond, waterfall or water wall from the space and
 * the water body, then checks it against ISPSC 2021, IRC Appendix G, NEC 680 and
 * the VGB anti-entrapment rules. See landrules.md for the clause reference.
 *
 * All dimensions are metres; volumes are reported in m³ and US gallons; flows in
 * US gallons per minute; temperatures in °C with °F alongside.
 */

export const IN = 0.0254;
export const FT = 12 * IN;
export const SQFT = FT * FT;
export const GALLONS_PER_M3 = 264.172;

export const WATER_FEATURE_TYPES = ['pool', 'spa', 'fountain', 'pond', 'waterfall', 'water-wall'];

export const WATER_FEATURE_LABELS = {
    pool: 'Swimming pool',
    spa: 'Spa / hot tub',
    fountain: 'Fountain',
    pond: 'Ornamental pond',
    waterfall: 'Waterfall',
    'water-wall': 'Water wall'
};

export const POOL_SHAPES = ['rectangle', 'roman', 'kidney', 'lap', 'circular'];

export const POOL_SHAPE_LABELS = {
    rectangle: 'Rectangle',
    roman: 'Roman (rounded ends)',
    kidney: 'Kidney',
    lap: 'Lap pool',
    circular: 'Circular'
};

/** Code values used by the checks. */
export const LANDSCAPE_CODES = {
    ISPSC2021: {
        key: 'ISPSC2021',
        label: 'ISPSC 2021 · residential pool / spa',
        barrierHeight: 48 * IN,
        barrierSphere: 4 * IN,
        gateLatchHeight: 54 * IN,
        gateSelfClosing: true,
        deckWidth: 4 * FT,
        minDepth: 3 * FT,
        maxDepth: 8 * FT,
        divingMinDepth: 7.5 * FT,
        shallowSlope: 1 / 3,
        spaMaxTempF: 104,
        spaMaxDepth: 3 * FT,
        poolTurnoverHours: 6,
        spaTurnoverHours: 0.5,
        fountainTurnoverHours: 1,
        batherAreaShallow: 15 * SQFT,
        batherAreaDeep: 20 * SQFT,
        suctionOutlets: 2,
        suctionSeparation: 3 * FT,
        drainVelocity: 1.5 * FT,
        pondMinDepth: 24 * IN,
        waterWallMinDepth: 6 * IN
    },
    IRC2021: {
        key: 'IRC2021',
        label: 'IRC 2021 · Appendix G',
        barrierHeight: 48 * IN,
        barrierSphere: 4 * IN,
        gateLatchHeight: 54 * IN,
        gateSelfClosing: true,
        deckWidth: 4 * FT,
        minDepth: 3 * FT,
        maxDepth: 8 * FT,
        divingMinDepth: 7.5 * FT,
        shallowSlope: 1 / 3,
        spaMaxTempF: 104,
        spaMaxDepth: 3 * FT,
        poolTurnoverHours: 6,
        spaTurnoverHours: 0.5,
        fountainTurnoverHours: 1,
        batherAreaShallow: 15 * SQFT,
        batherAreaDeep: 20 * SQFT,
        suctionOutlets: 2,
        suctionSeparation: 3 * FT,
        drainVelocity: 1.5 * FT,
        pondMinDepth: 24 * IN,
        waterWallMinDepth: 6 * IN
    }
};

export const WATER_RULES = [
    { id: 'POOL-BARRIER', code: 'ISPSC 2021', ref: '305.1 / 305.2', topic: 'barrier', text: 'Barrier at least 48 in high, no opening that passes a 4 in sphere', min: 48, unit: 'in' },
    { id: 'POOL-GATE', code: 'ISPSC 2021', ref: '305.3', topic: 'barrier', text: 'Gate self-closes and self-latches, opens outward, latch 54 in above grade', min: 54, unit: 'in' },
    { id: 'POOL-DECK', code: 'ISPSC 2021', ref: '306.1', topic: 'deck', text: 'Unobstructed deck at least 4 ft wide on the pool perimeter', min: 48, unit: 'in' },
    { id: 'POOL-DEPTH', code: 'ISPSC 2021', ref: '306.2', topic: 'depth', text: 'Residential pool 3 ft minimum depth; diving requires 7 ft 6 in to 9 ft', min: 36, max: 96, unit: 'in' },
    { id: 'POOL-SLOPE', code: 'ISPSC 2021', ref: '306.3', topic: 'slope', text: 'Shallow-end floor slope no steeper than 1:3; transition slope 1:1', max: 3, unit: 'run:rise' },
    { id: 'POOL-TURNOVER', code: 'ISPSC 2021', ref: '326.2 / 327', topic: 'filtration', text: 'Residential pool turnover 6 h, spa 30 min, fountain 1 h', min: 6, max: 8, unit: 'hours' },
    { id: 'POOL-SUCTION', code: 'VGB Act / ISPSC 2021', ref: '310.2', topic: 'suction', text: 'Two suction outlets 3 ft apart, VGB-listed anti-entrapment covers, SVRS or vent', min: 2, unit: 'outlets' },
    { id: 'POOL-DRAIN-VELOCITY', code: 'ISPSC 2021', ref: '310.3', topic: 'suction', text: 'Cover face velocity not over 1.5 ft/s', max: 1.5, unit: 'ft/s' },
    { id: 'SPA-TEMP', code: 'ISPSC 2021', ref: '307.4 / 609.4', topic: 'spa', text: 'Maximum water temperature 104 °F (40 °C)', max: 104, unit: '°F' },
    { id: 'SPA-DEPTH', code: 'ISPSC 2021', ref: '307.1', topic: 'spa', text: 'Spa water depth should not exceed 3 ft', max: 36, unit: 'in' },
    { id: 'POOL-BONDING', code: 'NEC 2021', ref: '680.26', topic: 'electrical', text: 'Equipotential bonding of the shell, deck, metal fittings and water', min: 8, unit: 'AWG copper' },
    { id: 'POOL-OVERHEAD', code: 'NEC 2021', ref: '680.8', topic: 'electrical', text: 'Overhead conductors 25 ft clear of the pool edge (27 ft over 750 V–15 kV)', min: 25, unit: 'ft' },
    { id: 'POOL-RECEPTACLE', code: 'NEC 2021', ref: '680.22(A)', topic: 'electrical', text: 'Receptacles at least 6 ft from the pool edge and within 20 ft', min: 6, max: 20, unit: 'ft' },
    { id: 'POOL-SETBACK', code: 'Local zoning', ref: 'varies', topic: 'siting', text: 'Pool shells and equipment typically 5–10 ft off a property line; check the AHJ', min: 5, unit: 'ft' },
    { id: 'POND-DEPTH', code: 'ISPSC 2021', ref: 'Appendix', topic: 'pond', text: 'Ornamental pond at least 24 in deep for fish, with aeration and a 1:3 bank slope', min: 24, unit: 'in' },
    { id: 'WALL-DEPTH', code: 'Manufacturer', ref: '—', topic: 'water-wall', text: 'Water-wall basin at least 6 in deep with a pump sump and autofill', min: 6, unit: 'in' },
    { id: 'DECK-SLOPE', code: 'IRC 2021', ref: 'R401.3', topic: 'deck', text: 'Surrounding decks slope 1/4 in per foot away from the pool and building', unit: '' },
    { id: 'POOL-CHEM', code: 'ANSI/APSP/ICC-11', ref: 'Table 1', topic: 'water', text: 'pH 7.2–7.8, free chlorine 1–3 ppm, alkalinity 80–120 ppm, CYA 30–50 ppm', unit: '' }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

export const POOL_DEFAULTS = {
    pool: {
        shape: 'rectangle',
        width: 4.0,
        length: 9.0,
        shallow: 1.1,
        deep: 1.9,
        deck: 1.22,
        barrier: true,
        barrierHeight: 48 * IN,
        gateSelfClosing: true,
        gateLatchHeight: 54 * IN,
        turnoverHours: 6,
        suctionOutlets: 2,
        diving: false
    },
    spa: {
        shape: 'circular',
        width: 2.4,
        length: 2.4,
        shallow: 0.9,
        deep: 0.9,
        deck: 1.0,
        barrier: true,
        barrierHeight: 48 * IN,
        gateSelfClosing: true,
        gateLatchHeight: 54 * IN,
        turnoverHours: 0.5,
        jets: 6,
        waterTempF: 102,
        suctionOutlets: 2,
        head: 50
    },
    fountain: {
        shape: 'circular',
        width: 2.4,
        length: 2.4,
        shallow: 0.35,
        deep: 0.45,
        deck: 0.6,
        barrier: false,
        turnoverHours: 1,
        jets: 4,
        head: 20
    },
    pond: {
        shape: 'kidney',
        width: 3.5,
        length: 5.0,
        shallow: 0.45,
        deep: 0.9,
        deck: 0.0,
        barrier: false,
        turnoverHours: 4,
        aeration: true,
        head: 10
    },
    waterfall: {
        shape: 'rectangle',
        width: 2.4,
        length: 1.2,
        shallow: 0.25,
        deep: 0.4,
        deck: 0.4,
        barrier: false,
        turnoverHours: 0.5,
        weirLength: 2.4,
        drop: 0.6,
        head: 25
    },
    'water-wall': {
        shape: 'rectangle',
        width: 3.0,
        length: 0.5,
        shallow: 0.2,
        deep: 0.35,
        deck: 0.4,
        barrier: false,
        turnoverHours: 0.5,
        weirLength: 3.0,
        drop: 2.4,
        head: 30
    }
};

export function defaultWaterConfig(type = 'pool') {
    const key = WATER_FEATURE_TYPES.includes(type) ? type : 'pool';
    return { type: key, code: 'ISPSC2021', ...POOL_DEFAULTS[key] };
}

/** Surface area for a shape, without cutting the corners off a rectangle. */
export function surfaceArea(shape, width, length) {
    if (shape === 'circular') return Math.PI * (width / 2) ** 2;
    if (shape === 'roman') return width * length - 4 * (1 - Math.PI / 4) * (width * 0.12) ** 2;
    if (shape === 'kidney') return width * length * 0.82;
    return width * length;
}

/** Plan outline points for the shape, in local metres. Used by the 2D canvas. */
export function planOutline(shape, width, length, segments = 48) {
    const hw = width / 2;
    const hl = length / 2;
    if (shape === 'circular') {
        return Array.from({ length: segments }, (_, i) => {
            const a = (i / segments) * Math.PI * 2;
            return { x: hw * Math.cos(a), z: hw * Math.sin(a) };
        });
    }
    if (shape === 'roman') {
        const r = Math.min(hw, hl) * 0.6;
        const points = [];
        const corner = (cx, cz, start) => {
            for (let i = 0; i <= 8; i++) {
                const a = start + (i / 8) * (Math.PI / 2);
                points.push({ x: cx + r * Math.cos(a), z: cz + r * Math.sin(a) });
            }
        };
        corner(hw - r, hl - r, 0);
        corner(-hw + r, hl - r, Math.PI / 2);
        corner(-hw + r, -hl + r, Math.PI);
        corner(hw - r, -hl + r, Math.PI * 1.5);
        return points;
    }
    if (shape === 'kidney') {
        const points = [];
        for (let i = 0; i < segments; i++) {
            const t = (i / segments) * Math.PI * 2;
            const wobble = 1 - 0.22 * Math.cos(t) ** 2;
            points.push({ x: hw * Math.cos(t) * wobble, z: hl * Math.sin(t) });
        }
        return points;
    }
    if (shape === 'lap') {
        return [
            { x: -hw, z: -hl }, { x: hw, z: -hl }, { x: hw, z: -hl * 0.92 },
            { x: hw * 0.92, z: 0 }, { x: hw, z: hl * 0.92 }, { x: hw, z: hl },
            { x: -hw, z: hl }, { x: -hw, z: hl * 0.92 }, { x: -hw * 0.92, z: 0 },
            { x: -hw, z: -hl * 0.92 }
        ];
    }
    return [
        { x: -hw, z: -hl }, { x: hw, z: -hl }, { x: hw, z: hl }, { x: -hw, z: hl }
    ];
}

/** Weir flow over a waterfall lip, in US gpm (sharp-crested weir). */
export function weirFlowGpm(length, head) {
    const lengthFt = Math.max(0.01, length / FT);
    const headFt = Math.max(0.001, head / FT);
    const cfs = 3.33 * lengthFt * headFt ** 1.5;
    return cfs * 448.831;
}

/**
 * Compute a water feature.
 *
 * Input: type, shape, width, length, shallow, deep, deck, barrier settings,
 * turnoverHours, jets, waterTempF, weirLength, drop, suctionOutlets.
 */
export function computeWaterFeature(input = {}) {
    const type = WATER_FEATURE_TYPES.includes(input.type) ? input.type : 'pool';
    const code = LANDSCAPE_CODES[input.code] || LANDSCAPE_CODES.ISPSC2021;
    const base = defaultWaterConfig(type);
    const config = { ...base, ...input, code: code.key };
    const shape = POOL_SHAPES.includes(config.shape) ? config.shape : base.shape;
    const width = clamp(number(config.width, base.width), 0.6, 50);
    const length = clamp(number(config.length, base.length), 0.6, 60);
    const shallow = clamp(number(config.shallow, base.shallow), 0.15, 6);
    const deep = clamp(number(config.deep, Math.max(base.deep, shallow + 0.1)), shallow, 6);
    const deck = clamp(number(config.deck, base.deck), 0, 6);
    const issues = [];
    const push = (severity, key, message) => issues.push({ severity, code: key, message });

    const area = surfaceArea(shape, width, length);
    const avgDepth = type === 'pool' ? (shallow + deep) / 2 : deep;
    const volumeM3 = area * avgDepth;
    const gallons = volumeM3 * GALLONS_PER_M3;
    const turnoverHours = clamp(number(config.turnoverHours, base.turnoverHours), 0.25, 24);
    const flowGpm = gallons / (turnoverHours * 60);
    const head = number(config.head, 40); // total dynamic head, feet of water
    const pumpHp = (flowGpm * head) / (3960 * 0.65);
    const batherArea = avgDepth > 1.4 ? code.batherAreaDeep : code.batherAreaShallow;
    const bathers = Math.floor(area / batherArea);
    const jets = Math.max(0, Math.round(number(config.jets, 0)));
    const jetFlow = jets ? jets * 12 : 0;
    const weirLength = number(config.weirLength, width);
    const drop = number(config.drop, 0.6);
    const weir = type === 'waterfall' || type === 'water-wall'
        ? weirFlowGpm(weirLength, clamp(number(config.weirHead, 0.006), 0.003, 0.012))
        : 0;

    if (type === 'pool') {
        if (shallow < code.minDepth - 1e-6) {
            push('error', 'depth', `Shallow end ${(shallow / FT).toFixed(1)} ft is below the ${(code.minDepth / FT).toFixed(0)} ft minimum`);
        }
        if (deep > code.maxDepth + 1e-6) {
            push('warning', 'depth-max', `Deep end ${(deep / FT).toFixed(1)} ft exceeds ${(code.maxDepth / FT).toFixed(0)} ft; a diving pool needs a stamped design`);
        }
        if (config.diving && deep < code.divingMinDepth - 1e-6) {
            push('error', 'diving', `Diving needs at least ${(code.divingMinDepth / FT).toFixed(1)} ft of water; this pool has ${(deep / FT).toFixed(1)} ft`);
        }
        const slope = (deep - shallow) / Math.max(0.1, length - width);
        if (slope > code.shallowSlope * 2) {
            push('info', 'slope', `Average floor slope 1:${(1 / slope).toFixed(1)}; the shallow end is limited to 1:3`);
        }
        if (turnoverHours > 8) push('warning', 'turnover', `Turnover ${turnoverHours} h is slower than the 6–8 h residential range`);
    }
    if (type === 'spa') {
        const tempF = number(config.waterTempF, 102);
        if (tempF > code.spaMaxTempF + 1e-6) {
            push('error', 'spa-temp', `Spa setpoint ${tempF} °F exceeds the ${code.spaMaxTempF} °F maximum`);
        }
        if (deep > code.spaMaxDepth + 1e-6) {
            push('warning', 'spa-depth', `Spa depth ${(deep / FT).toFixed(1)} ft exceeds the ${(code.spaMaxDepth / FT).toFixed(0)} ft recommendation`);
        }
        if (turnoverHours > 1) push('warning', 'spa-turnover', 'Spa turnover should be 30 minutes or faster');
    }
    if (type === 'pond') {
        if (deep < code.pondMinDepth - 1e-6) {
            push('warning', 'pond-depth', `Pond ${(deep / IN).toFixed(0)} in deep is shallower than the 24 in fish minimum`);
        }
        if (!config.aeration) push('info', 'aeration', 'Add aeration or a pump for a pond over 18 in deep');
        if (!config.liner) push('info', 'liner', 'Specify a 45 mil EPDM liner or a bentonite/clay seal');
    }
    if (type === 'waterfall' || type === 'water-wall') {
        if (weir < 5) push('info', 'weir', 'Weir flow is very low; check the lip level and pump');
        if (type === 'water-wall' && deep < 0.15) push('warning', 'wall-basin', 'Water-wall basin should be at least 6 in deep');
    }

    if (config.barrier) {
        const barrierHeight = number(config.barrierHeight, code.barrierHeight);
        const latch = number(config.gateLatchHeight, code.gateLatchHeight);
        if (barrierHeight < code.barrierHeight - 1e-6) {
            push('error', 'barrier', `Barrier ${(barrierHeight / IN).toFixed(0)} in is below the 48 in minimum`);
        }
        if (config.gateSelfClosing === false) {
            push('error', 'gate', 'Pool barrier gate must be self-closing and self-latching');
        }
        if (latch < code.gateLatchHeight - 1e-6) {
            push('error', 'latch', `Gate latch ${(latch / IN).toFixed(0)} in is below 54 in above grade`);
        }
    } else if (type !== 'pond') {
        push('info', 'barrier-missing', 'No barrier specified; a pool or spa needs a 48 in barrier unless it is fully enclosed by the building');
    }

    const suctionOutlets = Math.max(0, Math.round(number(config.suctionOutlets, code.suctionOutlets)));
    if ((type === 'pool' || type === 'spa') && suctionOutlets < 2) {
        push('error', 'suction', 'Two suction outlets at least 3 ft apart are required (VGB Act / ISPSC 310.2)');
    }
    if (turnoverHours > 12) push('info', 'filtration', 'Very slow turnover; confirm the pump curve and filter size');
    if (jetFlow && jetFlow > flowGpm * 1.5) {
        push('info', 'jets', `Jets want ${Math.round(jetFlow)} gpm but the turnover only provides ${Math.round(flowGpm)} gpm; add a booster pump`);
    }

    return {
        type,
        typeLabel: WATER_FEATURE_LABELS[type],
        code: code.key,
        codeLabel: code.label,
        shape,
        shapeLabel: POOL_SHAPE_LABELS[shape],
        width,
        length,
        shallow,
        deep,
        avgDepth,
        deck,
        area,
        areaSqFt: area / SQFT,
        volumeM3,
        gallons,
        turnoverHours,
        flowGpm,
        pumpHp,
        headFeet: head,
        bathers,
        jets,
        jetFlowGpm: jetFlow,
        weirLength,
        weirFlowGpm: weir,
        drop,
        waterTempF: number(config.waterTempF, 102),
        waterTempC: (number(config.waterTempF, 102) - 32) * 5 / 9,
        barrier: {
            required: Boolean(config.barrier),
            height: number(config.barrierHeight, code.barrierHeight),
            sphere: code.barrierSphere,
            latchHeight: number(config.gateLatchHeight, code.gateLatchHeight),
            selfClosing: config.gateSelfClosing !== false
        },
        suctionOutlets,
        footprint: {
            width: width + deck * 2,
            depth: length + deck * 2,
            waterWidth: width,
            waterDepth: length
        },
        config,
        issues,
        compliant: !issues.some((issue) => issue.severity === 'error'),
        errors: issues.filter((issue) => issue.severity === 'error'),
        warnings: issues.filter((issue) => issue.severity === 'warning')
    };
}

export function isWaterFeature(item) {
    return Boolean(item?.type && WATER_FEATURE_TYPES.includes(item.type));
}

export function waterConfigForItem(item) {
    return { ...defaultWaterConfig(item?.type), ...(item?.landscape || {}) };
}

export function waterDesignForItem(item) {
    return computeWaterFeature(waterConfigForItem(item));
}

export function waterSummary(design) {
    if (!design) return [];
    const lines = [
        `${design.typeLabel} · ${design.shapeLabel} · ${(design.width / FT).toFixed(1)} × ${(design.length / FT).toFixed(1)} ft`,
        `${design.gallons.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal (${design.volumeM3.toFixed(1)} m³) · ${design.areaSqFt.toFixed(0)} sq ft surface`,
        `Turnover ${design.turnoverHours} h · ${design.flowGpm.toFixed(0)} gpm · ~${design.pumpHp.toFixed(1)} hp at ${design.headFeet.toFixed(0)} ft head`,
        `${design.bathers} bathers · ${design.suctionOutlets} suction outlets · barrier ${(design.barrier.height / IN).toFixed(0)} in`
    ];
    if (design.weirFlowGpm) lines.push(`Weir ${design.weirLength.toFixed(2)} m · ${design.weirFlowGpm.toFixed(0)} gpm over the lip`);
    design.issues.forEach((issue) => {
        lines.push(`${issue.severity === 'error' ? '✖' : issue.severity === 'warning' ? '⚠' : 'ℹ'} ${issue.message}`);
    });
    return lines;
}
