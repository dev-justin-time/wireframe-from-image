import {
    IN,
    FT,
    DECK_LOADS,
    CONCRETE_BAG_M3,
    HARDWARE,
    SPECIES,
    boardPatternById,
    deckingById,
    frostById,
    lumberPrice,
    railingById,
    sectionProps,
    soilById,
    speciesById
} from './materials.js';
import { computeRoofDesign, takeoffRows } from '../roof/design.js';

/**
 * Deck and framing engine.
 *
 * Every member is checked twice: bending stress with the NDS reference values,
 * and deflection at L/360 live / L/240 total. Spans are therefore calculated
 * for the species and grade on site instead of copied from a table that may
 * belong to another species. The default is a ledger-attached treated deck,
 * 40 psf live and 10 psf dead, which is the load case in IRC Table R301.5.
 */

export const DECK_DEFAULTS = {
    shape: 'rectangle',
    width: 6.0,
    depth: 4.2,
    height: 0.9,
    ledger: 'house',
    species: 'spf-2',
    joistSize: '2x10',
    joistSpacingIn: 16,
    beamSize: '2x10',
    beamPlies: 2,
    postSize: '6x6',
    postSpacingM: 1.8,
    cantileverM: 0.3,
    footingDiameterIn: 12,
    frost: 'moderate',
    soil: 'assumed',
    decking: 'pt-5/4x6',
    pattern: 'perpendicular',
    boardLengthM: 4.8,
    guard: 'wood',
    guardHeightIn: 36,
    stairs: true,
    stairWidthM: 0.9144,
    cover: 'none',
    coverPitch: 4,
    waste: null
};

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

const ceil = (value) => Math.ceil(Math.max(Number(value) || 0, 0) - 1e-9);
const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
const inch = (metres) => Number(metres) / IN;

/** Plan outline in metres. x runs along the house, y runs out from it. */
export function deckOutline(config = {}) {
    const width = Math.max(Number(config.width) || 6, 1);
    const depth = Math.max(Number(config.depth) || 4.5, 1);
    const shape = config.shape || 'rectangle';

    if (shape === 'l-shape') {
        const wing = width * 0.45;
        const step = depth * 0.55;
        return [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: step },
            { x: wing, y: step },
            { x: wing, y: depth },
            { x: 0, y: depth }
        ];
    }

    if (shape === 'octagon') {
        const cx = width / 2;
        const cy = depth / 2;
        const rx = width / 2;
        const ry = depth / 2;
        return Array.from({ length: 8 }, (_, index) => {
            const angle = Math.PI / 8 + (index * Math.PI) / 4;
            return { x: round(cx + rx * Math.cos(angle), 3), y: round(cy + ry * Math.sin(angle), 3) };
        });
    }

    return [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: depth },
        { x: 0, y: depth }
    ];
}

export function polygonArea(points = []) {
    let sum = 0;
    points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        sum += point.x * next.y - next.x * point.y;
    });
    return Math.abs(sum) / 2;
}

export function polygonPerimeter(points = []) {
    return points.reduce((total, point, index) => {
        const next = points[(index + 1) % points.length];
        return total + Math.hypot(next.x - point.x, next.y - point.y);
    }, 0);
}

/** The open guard line: everything except the edge against the house. */
export function guardLineM(config = {}) {
    const points = deckOutline(config);
    const attached = (config.ledger || 'house') === 'house';
    let length = 0;
    points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const onHouse = attached && Math.abs(point.y) < 1e-6 && Math.abs(next.y) < 1e-6;
        if (!onHouse) length += Math.hypot(next.x - point.x, next.y - point.y);
    });
    if (config.stairs) length = Math.max(0, length - Math.max(Number(config.stairWidthM) || 0.9144, 0.6));
    return length;
}

/** Joist span and the beam lines that carry it, in metres. */
function framingModel(config) {
    const width = Math.max(config.width, 1);
    const depth = Math.max(config.depth, 1);
    const shape = config.shape || 'rectangle';
    const attached = (config.ledger || 'house') === 'house';
    const cantilever = clamp(config.cantileverM ?? 0.3, 0, Math.max(depth * 0.25, 0.1));
    const beams = [];
    let joistSpan = 0;

    if (shape === 'octagon') {
        joistSpan = Math.max(0.9, Math.min(width, depth) / 2);
        beams.push({ label: 'Ring beam', length: polygonPerimeter(deckOutline(config)) - (attached ? width * 0.38 : 0), tributary: joistSpan / 2, y: depth / 2 });
        beams.push({ label: 'Centre beam (2 plies)', length: width, tributary: joistSpan / 2, y: depth / 2, centre: true });
        return { joistSpanM: joistSpan, beams, cantileverM: 0, attached, joistRunM: joistSpan };
    }

    if (shape === 'l-shape') {
        const mainDepth = depth * 0.55;
        const wingWidth = width * 0.45;
        const mainSpan = Math.max(0.8, mainDepth - cantilever);
        const wingSpan = Math.max(0.8, depth - cantilever);
        joistSpan = Math.max(mainSpan, wingSpan);
        beams.push({ label: 'Main beam', length: width, tributary: mainSpan / 2, y: mainDepth - cantilever });
        beams.push({ label: 'Wing beam', length: wingWidth, tributary: wingSpan / 2, y: depth - cantilever });
        return { joistSpanM: joistSpan, beams, cantileverM: cantilever, attached, joistRunM: joistSpan };
    }

    if (attached) {
        joistSpan = Math.max(0.8, depth - cantilever);
        beams.push({ label: 'Front beam', length: width, tributary: joistSpan / 2, y: depth - cantilever });
    } else {
        joistSpan = Math.max(0.8, depth - 2 * cantilever);
        beams.push({ label: 'Front beam', length: width, tributary: joistSpan / 2, y: depth - cantilever });
        beams.push({ label: 'Rear beam', length: width, tributary: joistSpan / 2, y: cantilever });
    }

    return { joistSpanM: joistSpan, beams, cantileverM: cantilever, attached, joistRunM: joistSpan + (attached ? cantilever : cantilever) };
}

/** Bending and deflection capacity of one joist, in metres. */
export function joistCapacity({ size = '2x10', spacingIn = 16, speciesKey = 'spf-2' } = {}) {
    const props = sectionProps(size);
    const species = speciesById(speciesKey);
    if (!props) return null;

    const incisingFb = species.incising ? 0.8 : 1;
    const incisingE = species.incising ? 0.9 : 1;
    const Fb = species.Fb * incisingFb;
    const E = species.E * incisingE;
    const spacingFt = Math.max(spacingIn, 6) / 12;
    const wLive = DECK_LOADS.livePsf * spacingFt;
    const wTotal = DECK_LOADS.totalPsf * spacingFt;
    const livePerIn = wLive / 12;
    const totalPerIn = wTotal / 12;

    const bendIn = Math.sqrt((8 * Fb * props.S) / totalPerIn);
    const deflLiveIn = Math.cbrt((384 * E * props.I) / (5 * livePerIn * 360));
    const deflTotalIn = Math.cbrt((384 * E * props.I) / (5 * totalPerIn * 240));
    const spanIn = Math.min(bendIn, deflLiveIn, deflTotalIn);

    return {
        spanM: spanIn * IN,
        bendM: bendIn * IN,
        deflectionM: Math.min(deflLiveIn, deflTotalIn) * IN,
        Fb,
        E,
        props,
        wLivePlf: wLive,
        governing: spanIn === bendIn ? 'bending' : 'deflection'
    };
}

/** Bending and deflection capacity of a built-up beam, in metres. */
export function beamCapacity({ size = '2x10', plies = 2, speciesKey = 'spf-2', tributaryM = 1 } = {}) {
    const props = sectionProps(size);
    const species = speciesById(speciesKey);
    if (!props) return null;

    const Fb = species.Fb * (species.incising ? 0.8 : 1);
    const E = species.E * (species.incising ? 0.9 : 1);
    const tributaryFt = Math.max(tributaryM, 0.3) / FT;
    const wLive = DECK_LOADS.livePsf * tributaryFt;
    const wTotal = DECK_LOADS.totalPsf * tributaryFt;
    const livePerIn = wLive / 12;
    const totalPerIn = wTotal / 12;
    const S = props.S * plies;
    const I = props.I * plies;

    const bendIn = Math.sqrt((8 * Fb * S) / totalPerIn);
    const deflLiveIn = Math.cbrt((384 * E * I) / (5 * livePerIn * 360));
    const deflTotalIn = Math.cbrt((384 * E * I) / (5 * totalPerIn * 240));
    const spanIn = Math.min(bendIn, deflLiveIn, deflTotalIn);

    return {
        spanM: spanIn * IN,
        Fb,
        E,
        S,
        I,
        wLivePlf: wLive,
        wTotalPlf: wTotal,
        governing: spanIn === bendIn ? 'bending' : 'deflection'
    };
}

/** NDS column capacity: Fc* A Cp with FcE = 0.822 E / (le/d)². */
export function postCapacity({ size = '6x6', heightM = 0.9, speciesKey = 'spf-2' } = {}) {
    const props = sectionProps(size);
    const species = speciesById(speciesKey);
    if (!props) return null;

    const Fc = species.Fc;
    const E = species.E * (species.incising ? 0.9 : 1);
    const d = Math.min(props.b, props.d);
    const slenderness = Math.max((heightM / IN) / d, 1);
    const FcE = (0.822 * E) / (slenderness * slenderness);
    const c = 0.8;
    const ratio = FcE / Fc;
    const cp = (1 + ratio) / (2 * c) - Math.sqrt(((1 + ratio) / (2 * c)) ** 2 - ratio / c);
    const allowableLb = Fc * cp * props.area;

    return { allowableLb, cp, slenderness, areaIn2: props.area, Fc, FcE };
}

/** Footing diameter for a post load, in inches, never under 12 in. */
export function footingDiameterIn(loadLb, soilPsf, minimumIn = 12) {
    const areaFt2 = Math.max(loadLb, 0) / Math.max(soilPsf, 500);
    const autoIn = Math.sqrt((4 * areaFt2) / Math.PI) * 12;
    return Math.max(minimumIn, Math.ceil(autoIn / 2) * 2);
}

export function deckChecks(model) {
    const checks = [];
    const push = (id, severity, label, message, rule) => checks.push({ id, severity, label, message, rule });

    const { config, joist, beam, post, footing, decking, guard, stair, geometry } = model;

    // Joists.
    if (joist.spanM > joist.capacityM + 1e-6) {
        push('joist-span', 'error', 'Joist span',
            `${joist.size} @ ${config.joistSpacingIn} in spans ${round(joist.capacityM, 2)} m, but this deck needs ${round(joist.spanM, 2)} m. Go up a size, tighten spacing or add a beam.`,
            'IRC 2021 §R507.5');
    } else {
        push('joist-span', 'ok', 'Joist span',
            `${joist.size} @ ${config.joistSpacingIn} in spans ${round(joist.capacityM, 2)} m (${joist.governing}); used ${round(joist.spanM, 2)} m.`,
            'IRC 2021 §R507.5');
    }

    if (geometry.cantileverM > geometry.joistSpanM / 4 + 1e-6) {
        push('joist-cantilever', 'error', 'Cantilever',
            `Cantilever ${round(geometry.cantileverM, 2)} m exceeds a quarter of the ${round(geometry.joistSpanM, 2)} m back span.`,
            'IRC 2021 §R507.5');
    } else {
        push('joist-cantilever', 'ok', 'Cantilever',
            geometry.cantileverM > 0
                ? `Cantilever ${round(geometry.cantileverM, 2)} m is inside the quarter-span limit (${round(geometry.joistSpanM / 4, 2)} m).`
                : 'No cantilever.',
            'IRC 2021 §R507.5');
    }

    // Decking span limits the joist spacing.
    const maxSpacing = decking.product.maxJoistIn;
    if (config.joistSpacingIn > maxSpacing + 1e-6) {
        push('joist-spacing', 'error', 'Joist spacing',
            `${decking.product.label} spans ${maxSpacing} in, but the joists are at ${config.joistSpacingIn} in.`,
            'IRC 2021 §R507.10');
    } else {
        push('joist-spacing', 'ok', 'Joist spacing',
            `${config.joistSpacingIn} in is inside the ${maxSpacing} in ${decking.product.label} limit.`,
            'IRC 2021 §R507.10');
    }

    // Beam.
    if (beam.spanM > beam.capacityM + 1e-6) {
        push('beam-span', 'error', 'Beam span',
            `${config.beamPlies} × ${config.beamSize} spans ${round(beam.capacityM, 2)} m at this tributary, but the posts are ${round(beam.spanM, 2)} m apart. Add a ply, upsize or move the posts.`,
            'IRC 2021 §R507.6');
    } else {
        push('beam-span', 'ok', 'Beam span',
            `${config.beamPlies} × ${config.beamSize} spans ${round(beam.capacityM, 2)} m; posts at ${round(beam.spanM, 2)} m.`,
            'IRC 2021 §R507.6');
    }
    push('beam-attachment', config.beamPlies >= 2 ? 'ok' : 'error', 'Beam plies',
        config.beamPlies >= 2
            ? `${config.beamPlies} plies fastened together act as one ${config.beamSize} beam.`
            : 'A single-ply beam needs a designed connection; use at least two plies for a deck beam.',
        'IRC 2021 §R507.6');

    // Posts.
    if (config.postSize === '4x4') {
        push('post-size', 'warning', 'Post size',
            'A 4x4 post under a beam is limited to low, lightly loaded decks; 6x6 is the usual minimum.',
            'IRC 2021 §R507.4');
    } else {
        push('post-size', 'ok', 'Post size', `${config.postSize} posts carry the beam at ${round(post.tributaryM2, 2)} m² each.`, 'IRC 2021 §R507.4');
    }
    if (config.height > 4.27) {
        push('post-height', 'error', 'Post height',
            `${round(config.height, 2)} m exceeds the 14 ft post height that prescriptive deck tables cover: engineer the frame.`,
            'IRC 2021 §R507.4');
    } else {
        push('post-height', 'ok', 'Post height', `${round(config.height, 2)} m post, slenderness ${round(post.slenderness, 1)}.`, 'IRC 2021 §R507.4');
    }
    if (post.loadLb > post.allowableLb * 0.9) {
        push('post-connection', 'warning', 'Post load',
            `Each post carries ${Math.round(post.loadLb)} lb of ${Math.round(post.allowableLb)} lb allowable: check the cap and base connectors for that load.`,
            'IRC 2021 §R507.3');
    } else {
        push('post-connection', 'ok', 'Post load',
            `${Math.round(post.loadLb)} lb per post against ${Math.round(post.allowableLb)} lb allowable (${Math.round(post.utilization * 100)}%).`,
            'IRC 2021 §R507.3');
    }

    // Footings.
    push('footing-size', footing.diameterIn >= 12 ? 'ok' : 'error', 'Footing size',
        `Footings ${footing.diameterIn} in diameter; the 12 in minimum is ${footing.diameterIn >= 12 ? 'met' : 'not met'}.`,
        'IRC 2021 §R403.1.1');
    if (footing.bearingPsf > footing.allowablePsf + 1e-6) {
        push('footing-bearing', 'error', 'Footing bearing',
            `${Math.round(footing.bearingPsf)} psf exceeds the ${footing.allowablePsf} psf assumed bearing: enlarge the pad.`,
            'IRC 2021 §R401.4.1');
    } else {
        push('footing-bearing', 'ok', 'Footing bearing',
            `${Math.round(footing.bearingPsf)} psf against ${footing.allowablePsf} psf allowable.`,
            'IRC 2021 §R401.4.1');
    }
    push('footing-depth', 'ok', 'Frost depth',
        `Footings bear ${round(footing.depthM, 2)} m below grade: ${footing.frostIn} in frost plus 12 in of cover.`,
        'IRC 2021 §R403.1.4');

    // Ledger.
    if (geometry.attached) {
        push('ledger-attachment', 'ok', 'Ledger fasteners',
            `${footing.ledger.count} × ${footing.ledger.fastener} in two staggered rows at ${Math.round(footing.ledger.spacingMm)} mm on center.`,
            'IRC 2021 §R507.9.1.3');
        push('ledger-flashing', 'ok', 'Ledger flashing',
            'Z-flashing over the ledger, bottom flashing and joist tape are in the takeoff.',
            'IRC 2021 §R507.9.1.6');
        push('lateral-tie', 'ok', 'Lateral restraint',
            `${footing.ledger.tensionTies} tension ties resist the deck pulling away from the house.`,
            'IRC 2021 §R507.9.2');
    } else {
        push('ledger-attachment', 'info', 'Ledger', 'Freestanding deck: no ledger, beams at both edges instead.', 'IRC 2021 §R507.9.1.3');
        push('ledger-flashing', 'info', 'Ledger flashing', 'Not applicable to a freestanding frame.', 'IRC 2021 §R507.9.1.6');
        push('lateral-tie', 'info', 'Lateral restraint', 'Freestanding frames need knee bracing, not tension ties.', 'IRC 2021 §R507.9.2');
    }

    // Decking.
    push('decking-span', 'ok', 'Decking span',
        `${decking.product.label} on ${config.joistSpacingIn} in joists.`,
        'IRC 2021 §R507.10');
    push('decking-gap', 'ok', 'Board gap',
        `${round(decking.gapMm, 1)} mm gap between boards for drainage and expansion.`,
        'IRC 2021 §R507.10');
    push('decking-fastener', 'ok', 'Fasteners',
        `${decking.product.fastener}; ${decking.fastenerCount} fasteners estimated.`,
        'IRC 2021 §R317.3');

    // Guards.
    if (guard.required && config.guard === 'none') {
        push('guard-required', 'error', 'Guard required',
            `A deck ${round(config.height, 2)} m above grade needs a guard on every open side.`,
            'IRC 2021 §R312.1.1');
    } else {
        push('guard-required', guard.required ? 'ok' : 'ok', 'Guard',
            guard.required
                ? `Guard required and provided on ${round(guard.lengthM, 1)} m of open edge.`
                : `Deck at ${round(config.height, 2)} m is under the 30 in guard threshold.`,
            'IRC 2021 §R312.1.1');
    }
    if (config.guard !== 'none') {
        push('guard-height', config.guardHeightIn >= 36 ? 'ok' : 'error', 'Guard height',
            `${config.guardHeightIn} in guard (36 in minimum).`,
            'IRC 2021 §R312.1.2');
        push('guard-load', 'ok', 'Guard load',
            'Rail system selected for the 200 lb concentrated load at the rail height.',
            'IRC 2021 §R312.1.2');
        push('guard-opening', guard.openingIn <= 4 ? 'ok' : 'error', 'Guard openings',
            `Widest opening ${guard.openingIn} in against the 4 in sphere.`,
            'IRC 2021 §R312.1.3');
        push('guard-post', guard.postSpacingM <= 1.83 ? 'ok' : 'warning', 'Guard posts',
            `Posts at ${round(guard.postSpacingM, 2)} m on center.`,
            'IRC 2021 §R312.1.2');
    }

    // Stairs.
    if (!config.stairs || stair.risers === 0) {
        push('stair-riser', 'info', 'Stairs', 'No stair on this deck.', 'IRC 2021 §R311.7');
    } else {
        push('stair-riser', stair.riserMm <= 196.1 ? 'ok' : 'error', 'Riser height',
            `${round(stair.riserMm, 0)} mm riser against the 196 mm maximum.`,
            'IRC 2021 §R311.7.5');
        push('stair-variation', 'ok', 'Riser variation',
            `${stair.risers} equal risers: the 3/8 in variation limit is met by construction.`,
            'IRC 2021 §R311.7.5');
        push('stair-tread', stair.treadMm >= 254 ? 'ok' : 'error', 'Tread depth',
            `${Math.round(stair.treadMm)} mm tread against the 254 mm minimum.`,
            'IRC 2021 §R311.7.5.2');
        push('stair-width', stair.widthMm >= 914 ? 'ok' : 'error', 'Stair width',
            `${Math.round(stair.widthMm)} mm clear width against the 914 mm minimum.`,
            'IRC 2021 §R311.7.1');
        push('stair-headroom', 'ok', 'Headroom',
            '2,032 mm headroom assumed below the deck frame; verify at the landing.',
            'IRC 2021 §R311.7.2');
        push('stair-landing', 'ok', 'Landing',
            'Landing at the foot at least as wide as the stair.',
            'IRC 2021 §R311.7.6');
        push('stair-handrail', stair.handrailRequired ? 'ok' : 'info', 'Handrail',
            stair.handrailRequired
                ? `${stair.risers} risers: graspable handrail 34–38 in above the nosing, included.`
                : `${stair.risers} risers: a handrail is not required below four risers.`,
            'IRC 2021 §R311.7.8');
        push('stair-stringer', stair.stringerM <= 6.2 ? 'ok' : 'warning', 'Stringers',
            `2x12 stringers ${round(stair.stringerM, 2)} m long; add a mid-span support past about 6 m.`,
            'IRC 2021 §R311.7');
    }

    // Durability and siting.
    push('decay-protection', 'ok', 'Decay protection',
        'Ground-contact treated posts, field-treated cuts and galvanised connectors.',
        'IRC 2021 §R317.1');
    push('deck-drainage', 'ok', 'Drainage',
        'Board gaps drain the surface; grade below the deck must fall away from the house.',
        'IRC 2021 §R401.3');
    push('ventilation', config.height >= 0.46 ? 'ok' : 'warning', 'Ventilation',
        config.height >= 0.46
            ? `${round(config.height, 2)} m clear under the frame for airflow.`
            : 'Low deck: ventilate the skirt or accept shorter framing life.',
        'Good practice');
    push('setback', 'info', 'Setback',
        'Confirm the side, rear and front setbacks, easements and lot coverage with the AHJ.',
        'Local zoning');
    push('inspection', 'info', 'Inspection',
        'Framing plan, footing schedule, ledger detail, guard and stair details and connector listing.',
        'Plan review');

    return checks;
}

export function computeDeckDesign(options = {}) {
    const config = { ...DECK_DEFAULTS, ...options };
    config.width = clamp(config.width, 1, 30);
    config.depth = clamp(config.depth, 1, 30);
    config.height = clamp(config.height, 0, 12);
    config.joistSpacingIn = clamp(config.joistSpacingIn, 12, 24);
    config.beamPlies = clamp(config.beamPlies, 1, 4);
    config.postSpacingM = clamp(config.postSpacingM, 0.6, 6);
    config.guardHeightIn = clamp(config.guardHeightIn, 30, 48);
    config.stairWidthM = clamp(config.stairWidthM, 0.6, 3);

    const species = speciesById(config.species);
    const product = deckingById(config.decking);
    const pattern = boardPatternById(config.pattern);
    const rail = railingById(config.guard);
    const soil = soilById(config.soil);
    const frost = frostById(config.frost);

    const outline = deckOutline(config);
    const areaM2 = polygonArea(outline);
    const perimeterM = polygonPerimeter(outline);
    const geometry = framingModel(config);

    const joist = {
        size: config.joistSize,
        spacingIn: config.joistSpacingIn,
        spanM: geometry.joistSpanM,
        capacity: joistCapacity({ size: config.joistSize, spacingIn: config.joistSpacingIn, speciesKey: config.species })
    };
    const joistCapacityM = joist.capacity?.spanM ?? 0;
    joist.capacityM = joistCapacityM;
    joist.governing = joist.capacity?.governing || 'bending';
    joist.count = ceil(config.width / (config.joistSpacingIn * IN)) + 1;
    joist.lengthM = clamp(geometry.joistSpanM + geometry.cantileverM, 0.5, 20);
    joist.totalLinearM = joist.count * joist.lengthM;

    const governingBeam = geometry.beams.reduce((worst, entry) => (
        !worst || entry.length > worst.length ? entry : worst
    ), null) || { length: config.width, tributary: geometry.joistSpanM / 2, label: 'Front beam' };
    const beam = {
        size: config.beamSize,
        plies: config.beamPlies,
        spanM: config.postSpacingM,
        capacity: beamCapacity({
            size: config.beamSize,
            plies: config.beamPlies,
            speciesKey: config.species,
            tributaryM: governingBeam.tributary
        }),
        tributaryM: governingBeam.tributary,
        lines: geometry.beams,
        totalLinearM: geometry.beams.reduce((total, entry) => total + entry.length, 0) * config.beamPlies
    };
    beam.capacityM = beam.capacity?.spanM ?? 0;
    beam.governing = beam.capacity?.governing || 'bending';

    const postTributaryM2 = config.postSpacingM * Math.max(geometry.joistSpanM / 2, 0.4);
    const postLoadLb = DECK_LOADS.totalPsf * (postTributaryM2 / (FT * FT)) * 1.1;
    const postCapacityResult = postCapacity({ size: config.postSize, heightM: config.height, speciesKey: config.species });
    const post = {
        size: config.postSize,
        heightM: config.height,
        postSpacingM: config.postSpacingM,
        tributaryM2: postTributaryM2,
        loadLb: postLoadLb,
        allowableLb: postCapacityResult?.allowableLb ?? 0,
        capacity: postCapacityResult,
        slenderness: postCapacityResult?.slenderness ?? 0,
        utilization: postCapacityResult ? postLoadLb / postCapacityResult.allowableLb : 1,
        count: geometry.beams.reduce((total, entry) => total + Math.max(2, ceil(entry.length / config.postSpacingM) + 1), 0)
    };

    const frostIn = frost.inches;
    const depthM = (frostIn + 12) * IN;
    const autoDiameter = footingDiameterIn(postLoadLb, soil.psf, 12);
    const diameterIn = Math.max(autoDiameter, clamp(config.footingDiameterIn, 12, 48));
    const footingAreaFt2 = Math.PI * ((diameterIn * IN) / 2) ** 2 / (FT * FT);
    const footingVolumeM3 = Math.PI * ((diameterIn * IN) / 2) ** 2 * depthM;
    const footingBearing = postLoadLb / Math.max(footingAreaFt2, 0.1);

    const ledgerFastener = config.ledger === 'house'
        ? { fastener: '1/2 in lag screw', label: HARDWARE.ledgerLag.label, cost: HARDWARE.ledgerLag.cost }
        : { fastener: 'none', label: '', cost: 0 };
    const ledgerLengthM = config.ledger === 'house' ? config.width : 0;
    const ledgerSpacingMm = 600;
    const ledgerRows = 2;
    const ledgerCount = config.ledger === 'house'
        ? ledgerRows * (Math.floor((ledgerLengthM * 1000) / ledgerSpacingMm) + 1)
        : 0;

    const maxJoistIn = pattern.diagonal ? Math.min(product.maxJoistIn, 12) : product.maxJoistIn;
    const coverageM = Math.max(product.coverageM, 0.08);
    const waste = Number.isFinite(Number(config.waste)) ? clamp(config.waste, 0, 0.4) : pattern.waste;
    const deckingLinearM = (areaM2 / coverageM) * (1 + waste);
    const boards = ceil(deckingLinearM / Math.max(config.boardLengthM, 1));
    const joistSpacingM = config.joistSpacingIn * IN;
    const fastenerCount = ceil((deckingLinearM / joistSpacingM) * 2);
    const decking = {
        product,
        pattern,
        areaM2,
        waste,
        linearM: deckingLinearM,
        boards,
        boardLengthM: config.boardLengthM,
        gapMm: product.gapIn * 25.4,
        maxJoistIn,
        fastenerCount,
        fastenerUnit: product.family === 'composite' || product.family === 'pvc' ? 'clips' : 'screws'
    };

    const guardRequired = config.height > 0.762;
    const guardLength = guardRequired && config.guard !== 'none' ? guardLineM(config) : 0;
    const guardPostSpacing = rail.postSpacingM;
    const guard = {
        required: guardRequired,
        system: rail,
        heightIn: config.guardHeightIn,
        lengthM: guardLength,
        postCount: guardLength ? ceil(guardLength / guardPostSpacing) + 1 : 0,
        postSpacingM: guardPostSpacing,
        openingIn: rail.openingIn,
        infill: rail.infill
    };

    const risers = config.height > 0 ? Math.max(1, ceil(config.height / 0.196)) : 0;
    const riserMm = risers ? (config.height * 1000) / risers : 0;
    const treadMm = 254;
    const treads = risers ? Math.max(risers - 1, 1) : 0;
    const stairRunM = (treads * treadMm) / 1000;
    const stair = {
        risers,
        riserMm,
        treads,
        treadMm,
        runM: stairRunM,
        stringerM: Math.hypot(config.height, stairRunM) + 0.3,
        widthMm: config.stairWidthM * 1000,
        stringers: stairRunM > 2.4 ? 3 : 2,
        handrailRequired: risers >= 4,
        handrailM: Math.hypot(config.height, stairRunM),
        riserSurfaceM2: risers * config.stairWidthM * (riserMm / 1000)
    };

    let cover = { type: config.cover, rows: [], rafters: 0, note: '' };
    if (config.cover === 'roof') {
        const roof = computeRoofDesign({
            style: 'gable-king',
            span: config.width,
            length: config.depth * 0.6,
            pitch: clamp(config.coverPitch, 2, 12),
            overhang: 0.45,
            gutters: false,
            iceShield: false,
            ridgeVent: true,
            soffitVent: false
        });
        cover = {
            type: 'roof',
            rows: takeoffRows(roof),
            rafters: roof.layers?.trusses ?? 0,
            note: `Roof suite gable, ${round(roof.geometry.pitch, 1)}:12 over ${round(config.width, 2)} × ${round(config.depth * 0.6, 2)} m`
        };
    } else if (config.cover === 'pergola') {
        const rafterSpacingM = 0.61;
        const rafters = ceil(config.depth * 0.6 / rafterSpacingM) + 1;
        cover = {
            type: 'pergola',
            rows: [{
                group: 'Cover',
                item: '2 × 8 pergola rafter',
                qty: rafters,
                unit: 'pc',
                unitCost: lumberPrice('2x8') * config.width,
                cost: lumberPrice('2x8') * config.width * rafters,
                note: `${round(config.width, 2)} m span at ${round(rafterSpacingM, 2)} m on center`
            }],
            rafters,
            note: `Pergola, ${rafters} rafters`
        };
    }

    const bom = { rows: [], material: 0, labour: 0, total: 0 };
    const add = (group, item, qty, unit, unitCost, note = '') => {
        const cost = round(qty * unitCost, 2);
        bom.rows.push({ group, item, qty: round(qty, 2), unit, unitCost: round(unitCost, 2), cost, note });
    };

    // Framing.
    add('Framing', `${config.joistSize} joist`, joist.count, 'pc', lumberPrice(config.joistSize) * joist.lengthM,
        `${round(joist.lengthM, 2)} m each, ${config.joistSpacingIn} in on center`);
    add('Framing', `${config.joistSize} rim joist`, ceil(perimeterM / config.boardLengthM) + 2, 'pc',
        lumberPrice(config.joistSize) * config.boardLengthM, 'Perimeter and stair opening rim');
    for (const line of geometry.beams) {
        add('Framing', `${config.beamSize} beam (${config.beamPlies} plies)`, config.beamPlies, 'pc',
            lumberPrice(config.beamSize) * line.length, `${line.label}, ${round(line.length, 2)} m`);
    }
    add('Framing', `${config.postSize} post`, post.count, 'pc', lumberPrice(config.postSize) * Math.max(config.height, 0.6),
        `${round(config.height, 2)} m posts`);
    if (config.ledger === 'house') {
        add('Framing', `${config.joistSize} ledger`, 1, 'pc', lumberPrice(config.joistSize) * ledgerLengthM,
            `Bolted to the house, ${round(ledgerLengthM, 2)} m`);
    }
    add('Framing', '2x10 blocking', ceil(joist.count / 4), 'pc', lumberPrice('2x10') * joistSpacingM,
        'Solid blocking at beam lines and board ends');

    // Hardware.
    add('Hardware', HARDWARE.hanger.label, joist.count * 2, HARDWARE.hanger.unit, HARDWARE.hanger.cost,
        'One at each joist end');
    add('Hardware', HARDWARE.postBase.label, post.count, HARDWARE.postBase.unit, HARDWARE.postBase.cost, 'Standoff base');
    add('Hardware', HARDWARE.postCap.label, post.count, HARDWARE.postCap.unit, HARDWARE.postCap.cost, 'Beam to post');
    if (config.ledger === 'house') {
        add('Hardware', HARDWARE.ledgerLag.label, ledgerCount, HARDWARE.ledgerLag.unit, HARDWARE.ledgerLag.cost,
            `Two staggered rows at ${ledgerSpacingMm} mm`);
        add('Hardware', HARDWARE.tensionTie.label, 2, HARDWARE.tensionTie.unit, HARDWARE.tensionTie.cost, 'Lateral restraint');
        add('Hardware', HARDWARE.ledgerFlashing.label, 1, HARDWARE.ledgerFlashing.unit, HARDWARE.ledgerFlashing.cost, 'Top and bottom');
    }
    add('Hardware', HARDWARE.joistTape.label, Math.max(1, ceil(joist.totalLinearM / 30)), HARDWARE.joistTape.unit,
        HARDWARE.joistTape.cost, 'Joist tops and beam');
    add('Hardware', HARDWARE.structuralScrew.label, Math.max(1, ceil((post.count * 6) / 100)), HARDWARE.structuralScrew.unit,
        HARDWARE.structuralScrew.cost, 'Connectors and blocking');
    add('Hardware', HARDWARE.deckScrew.label, Math.max(1, ceil(fastenerCount / 350)), HARDWARE.deckScrew.unit,
        HARDWARE.deckScrew.cost, `${fastenerCount} fasteners at 2 per joist`);
    add('Hardware', HARDWARE.concrete.label, Math.ceil((footingVolumeM3 * post.count) / CONCRETE_BAG_M3), HARDWARE.concrete.unit,
        HARDWARE.concrete.cost, `${post.count} footings, ${diameterIn} in × ${round(depthM, 2)} m`);

    // Decking.
    add('Decking', product.label, round(areaM2 * (1 + waste), 2), 'm²', product.costPerSqm,
        `${pattern.label}, ${boards} boards of ${config.boardLengthM} m`);

    // Guard.
    if (guard.lengthM > 0) {
        add('Guard', `${rail.label} guard`, round(guard.lengthM, 2), 'm', rail.costPerM,
            `${config.guardHeightIn} in high, ${guard.postCount} posts at ${round(guard.postSpacingM, 2)} m`);
    }

    // Stairs.
    if (config.stairs && stair.risers > 0) {
        add('Stairs', '2x12 stringer', stair.stringers, 'pc', lumberPrice('2x12') * stair.stringerM,
            `${round(stair.stringerM, 2)} m cut stringer`);
        add('Stairs', `Tread, ${round(config.stairWidthM, 2)} m wide`, stair.treads, 'pc',
            product.costPerSqm * config.stairWidthM * 0.254 * 1.2, `${stair.treads} treads at ${treadMm} mm`);
        add('Stairs', 'Riser board', stair.risers, 'pc', lumberPrice('1x6') * config.stairWidthM, 'Closed risers');
        if (stair.handrailRequired) {
            add('Stairs', 'Graspable handrail', round(stair.handrailM, 2), 'm', 42, '34–38 in above the nosing');
        }
    }

    // Cover.
    if (config.cover === 'roof' && cover.rows.length) {
        const before = bom.rows.length;
        cover.rows.forEach((row) => {
            add('Cover', row.item, row.qty, row.unit, row.unitCost, row.note);
        });
        // Re-label the roof suite's own groups so they read as the deck cover.
        bom.rows.slice(before).forEach((row) => { row.group = 'Cover'; });
    } else if (config.cover === 'pergola') {
        cover.rows.forEach((row) => add(row.group, row.item, row.qty, row.unit, row.unitCost, row.note));
        add('Cover', '6x6 pergola post', 4, 'pc', lumberPrice('6x6') * 2.4, 'Four corner posts, 2.4 m');
        add('Cover', 'Post base and anchor', 4, 'each', HARDWARE.postBase.cost, 'Pergola posts');
    }

    bom.material = round(bom.rows.reduce((total, row) => total + row.cost, 0), 2);
    bom.labour = round(bom.material * 0.6, 2);
    bom.total = round(bom.material + bom.labour, 2);

    const cutRows = [
        { label: `${config.joistSize} joist`, size: config.joistSize, lengthM: round(joist.lengthM, 2), count: joist.count, note: 'Cut square, crown up' },
        { label: `${config.beamSize} beam ply`, size: config.beamSize, lengthM: round(Math.max(...geometry.beams.map((line) => line.length)), 2), count: config.beamPlies, note: 'Nail plies together' },
        { label: `${config.postSize} post`, size: config.postSize, lengthM: round(Math.max(config.height, 0.6), 2), count: post.count, note: 'Ground-contact treated' }
    ];
    if (config.ledger === 'house') {
        cutRows.push({ label: `${config.joistSize} ledger`, size: config.joistSize, lengthM: round(ledgerLengthM, 2), count: 1, note: 'Flashing over, tape on top' });
    }
    if (config.stairs && stair.risers > 0) {
        cutRows.push({ label: '2x12 stringer', size: '2x12', lengthM: round(stair.stringerM, 2), count: stair.stringers, note: 'Notch for every tread' });
        cutRows.push({ label: 'Tread', size: product.family === 'wood' ? '5/4x6' : '2x6', lengthM: round(config.stairWidthM, 2), count: stair.treads, note: `${treadMm} mm deep` });
    }
    if (config.cover === 'pergola') {
        cutRows.push({ label: '2x8 pergola rafter', size: '2x8', lengthM: round(config.width, 2), count: cover.rafters, note: 'Dogs at each post' });
        cutRows.push({ label: '6x6 pergola post', size: '6x6', lengthM: 2.4, count: 4, note: 'Check the cover span' });
    }

    const model = {
        config,
        outline,
        geometry,
        species,
        joist,
        beam,
        post,
        footing: {
            diameterIn,
            depthM,
            count: post.count,
            volumeM3: footingVolumeM3 * post.count,
            bags: Math.ceil((footingVolumeM3 * post.count) / CONCRETE_BAG_M3),
            bearingPsf: footingBearing,
            allowablePsf: soil.psf,
            frostIn,
            ledger: {
                attached: config.ledger === 'house',
                fastener: ledgerFastener.fastener,
                spacingMm: ledgerSpacingMm,
                rows: ledgerRows,
                count: ledgerCount,
                tensionTies: config.ledger === 'house' ? 2 : 0
            }
        },
        decking,
        guard,
        stair,
        cover,
        areas: {
            deckM2: areaM2,
            deckFt2: areaM2 / (FT * FT),
            perimeterM,
            guardLengthM: guardLength,
            framingLinearM: joist.totalLinearM + beam.totalLinearM
        },
        bom,
        cutRows,
        costPerSqm: areaM2 > 0 ? round(bom.total / areaM2, 2) : 0
    };

    const checks = deckChecks(model);
    model.checks = checks;
    model.errors = checks.filter((check) => check.severity === 'error').length;
    model.warnings = checks.filter((check) => check.severity === 'warning').length;
    model.ok = model.errors === 0;

    return model;
}

const csvField = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function deckTakeoffCsv(design) {
    const header = '"group","item","qty","unit","unit cost","cost","note"';
    const body = design.bom.rows.map((row) => [
        row.group, row.item, row.qty, row.unit, row.unitCost, row.cost, row.note
    ].map(csvField).join(','));
    const summary = [
        ['Summary', 'Deck area (m²)', round(design.areas.deckM2, 2)],
        ['Summary', 'Joists', `${design.joist.count} × ${design.joist.size}`],
        ['Summary', 'Beam', `${design.config.beamPlies} × ${design.config.beamSize}`],
        ['Summary', 'Posts', `${design.post.count} × ${design.config.postSize}`],
        ['Summary', 'Footings', `${design.footing.count} × ${design.footing.diameterIn} in`],
        ['Summary', 'Material', design.bom.material],
        ['Summary', 'Labour', design.bom.labour],
        ['Summary', 'Total', design.bom.total]
    ].map((row) => row.map(csvField).join(','));
    return [header, ...body, ...summary].join('\n');
}

export function deckCutListCsv(design) {
    const rows = [['item', 'size', 'length_m', 'count', 'note']];
    design.cutRows.forEach((row) => {
        rows.push([row.label, row.size, row.lengthM, row.count, row.note]);
    });
    return rows.map((row) => row.map(csvField).join(',')).join('\n');
}

export function deckScheduleCsv(design) {
    const rows = [['member', 'size', 'spacing', 'span_m', 'capacity_m', 'utilisation', 'check']];
    rows.push(['Joist', design.joist.size, `${design.config.joistSpacingIn} in`, round(design.joist.spanM, 2), round(design.joist.capacityM, 2), round(design.joist.spanM / Math.max(design.joist.capacityM, 0.01), 2), design.joist.governing]);
    rows.push(['Beam', `${design.config.beamPlies} × ${design.config.beamSize}`, `${round(design.config.postSpacingM, 2)} m posts`, round(design.beam.spanM, 2), round(design.beam.capacityM, 2), round(design.beam.spanM / Math.max(design.beam.capacityM, 0.01), 2), design.beam.governing]);
    rows.push(['Post', design.config.postSize, `${design.post.count} posts`, round(design.post.heightM, 2), `${Math.round(design.post.allowableLb)} lb`, round(design.post.utilization, 2), 'NDS column']);
    rows.push(['Footing', `${design.footing.diameterIn} in`, `${design.footing.count} pads`, round(design.footing.depthM, 2), `${design.footing.allowablePsf} psf`, round(design.footing.bearingPsf / design.footing.allowablePsf, 2), 'Soil bearing']);
    return rows.map((row) => row.map(csvField).join(',')).join('\n');
}

export function deckSummaryText(design) {
    if (!design) return [];
    return [
        `${round(design.areas.deckM2, 1)} m² deck at ${round(design.config.height, 2)} m`,
        `${design.joist.count} × ${design.joist.size} joists @ ${design.config.joistSpacingIn} in`,
        `${design.config.beamPlies} × ${design.config.beamSize} beam, ${design.post.count} × ${design.config.postSize} posts`,
        `${design.footing.count} footings ${design.footing.diameterIn} in × ${round(design.footing.depthM, 2)} m`,
        design.guard.required ? `${round(design.guard.lengthM, 1)} m guard, ${design.guard.postCount} posts` : 'No guard required',
        design.stair.risers ? `${design.stair.risers} risers at ${Math.round(design.stair.riserMm)} mm` : 'No stair',
        `Material $${design.bom.material.toFixed(0)} · total $${design.bom.total.toFixed(0)}`
    ];
}
