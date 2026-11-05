import { PIXELS_PER_METER, WALL_HEIGHT } from '../../core/world-space.js';

/**
 * Stair design suite — code-driven sizing for US stairs and fire poles.
 *
 * Everything is in metres. The code tables use the 2021 IRC (dwelling) and
 * 2021 IBC (commercial) minimums; R-3/R-2 dwelling exceptions are folded into
 * the IRC profile. See staircode.md for the clause-by-clause reference.
 */

export const IN = 0.0254;
export const FT = 12 * IN;

export const STAIR_TYPES = ['straight', 'curve-right', 'curve-left', 'spiral', 'fire-pole'];

export const STAIR_TYPE_LABELS = {
    straight: 'Straight run',
    'curve-right': 'Curve right (clockwise)',
    'curve-left': 'Curve left (counter-clockwise)',
    spiral: 'Spiral',
    'fire-pole': 'Fire pole'
};

export const STAIR_CODES = {
    IRC2021: {
        key: 'IRC2021',
        label: 'IRC 2021 · residential',
        maxRiser: 7.75 * IN,
        minRiser: 0,
        minTread: 10 * IN,
        winderTread: 10 * IN,
        winderClear: 6 * IN,
        walklineOffset: 12 * IN,
        minWidth: 36 * IN,
        headroom: 80 * IN,
        maxFlightRise: (12 * FT) + (7 * IN),
        handrailMin: 34 * IN,
        handrailMax: 38 * IN,
        uniformity: 0.375 * IN,
        nosingMin: 0.75 * IN,
        nosingMax: 1.25 * IN,
        curvedRadiusRule: false,
        spiral: {
            minWidth: 26 * IN,
            minTread: 7.5 * IN,
            walklineOffset: 12 * IN,
            maxRiser: 9.5 * IN,
            headroom: 78 * IN
        }
    },
    IBC2021: {
        key: 'IBC2021',
        label: 'IBC 2021 · commercial',
        maxRiser: 7 * IN,
        minRiser: 4 * IN,
        minTread: 11 * IN,
        winderTread: 11 * IN,
        winderClear: 10 * IN,
        walklineOffset: 12 * IN,
        minWidth: 44 * IN,
        headroom: 80 * IN,
        maxFlightRise: 12 * FT,
        handrailMin: 34 * IN,
        handrailMax: 38 * IN,
        uniformity: 0.375 * IN,
        nosingMin: 0,
        nosingMax: 1.25 * IN,
        curvedRadiusRule: true,
        spiral: {
            minWidth: 26 * IN,
            minTread: 6.75 * IN,
            walklineOffset: 12 * IN,
            maxRiser: 9.5 * IN,
            headroom: 78 * IN
        }
    },
    // Industrial access stairs. OSHA 1910.25 sets uniformity, a 30–50° slope,
    // 22 in clear width and 9.5 in riser/tread limits rather than a single
    // dwelling-style profile.
    OSHA_STAIR: {
        key: 'OSHA_STAIR',
        label: 'OSHA 1910.25 · industrial',
        maxRiser: 9.5 * IN,
        minRiser: 0,
        minTread: 9.5 * IN,
        winderTread: 9.5 * IN,
        winderClear: 6 * IN,
        walklineOffset: 12 * IN,
        minWidth: 22 * IN,
        headroom: 80 * IN,
        maxFlightRise: 30 * FT,
        handrailMin: 30 * IN,
        handrailMax: 42 * IN,
        uniformity: 0.25 * IN,
        nosingMin: 0,
        nosingMax: 1.25 * IN,
        curvedRadiusRule: false,
        spiral: {
            minWidth: 26 * IN,
            minTread: 7.5 * IN,
            walklineOffset: 12 * IN,
            maxRiser: 9.5 * IN,
            headroom: 78 * IN
        }
    },
    // Steep access devices. The width/tread/riser limits are the IBC clauses
    // for alternating tread devices (1011.14) and ships ladders (1011.16).
    IBC_ALT: {
        key: 'IBC_ALT',
        label: 'IBC 1011.14 · alternating tread',
        maxRiser: 9.5 * IN,
        minRiser: 0,
        minTread: 8.5 * IN,
        winderTread: 8.5 * IN,
        winderClear: 4 * IN,
        walklineOffset: 12 * IN,
        minWidth: 20 * IN,
        headroom: 80 * IN,
        maxFlightRise: 30 * FT,
        handrailMin: 30 * IN,
        handrailMax: 38 * IN,
        uniformity: 0.375 * IN,
        nosingMin: 0,
        nosingMax: 1 * IN,
        curvedRadiusRule: false,
        spiral: {
            minWidth: 26 * IN,
            minTread: 7.5 * IN,
            walklineOffset: 12 * IN,
            maxRiser: 9.5 * IN,
            headroom: 78 * IN
        }
    },
    IBC_SHIP: {
        key: 'IBC_SHIP',
        label: 'IBC 1011.16 · ships ladder',
        maxRiser: 10 * IN,
        minRiser: 0,
        minTread: 5 * IN,
        winderTread: 5 * IN,
        winderClear: 3 * IN,
        walklineOffset: 12 * IN,
        minWidth: 20 * IN,
        headroom: 80 * IN,
        maxFlightRise: 30 * FT,
        handrailMin: 30 * IN,
        handrailMax: 38 * IN,
        uniformity: 0.375 * IN,
        nosingMin: 0,
        nosingMax: 1 * IN,
        curvedRadiusRule: false,
        spiral: {
            minWidth: 26 * IN,
            minTread: 7.5 * IN,
            walklineOffset: 12 * IN,
            maxRiser: 9.5 * IN,
            headroom: 78 * IN
        }
    }
};

export const POLE_DEFAULTS = {
    diameter: 2.5 * IN,
    opening: 37.5 * IN,
    mat: 32 * IN,
    aboveFloor: 36 * IN,
    guardHeight: 42 * IN,
    maxDrop: 30 * FT,
    floorThickness: 5 * IN
};

export const COMFORT_TARGET = 25 * IN;
export const COMFORT_MIN = 24 * IN;
export const COMFORT_MAX = 25 * IN;
export const COLUMN_RADIUS = 0.08;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, places = 3) => Math.round(value * 10 ** places) / 10 ** places;

const normalizeAngle = (angle) => {
    let value = angle % TAU;
    if (value > Math.PI) value -= TAU;
    if (value < -Math.PI) value += TAU;
    return value;
};

/** Direction-aware angle from `start`, in [0, 2π]. */
function sweepDelta(angle, start, direction) {
    let delta = normalizeAngle(angle - start);
    if (direction > 0) {
        if (delta < 0) delta += TAU;
    } else if (delta > 0) {
        delta -= TAU;
    }
    return Math.abs(delta);
}

export function defaultStairConfig(type = 'straight', { storeyHeight = WALL_HEIGHT } = {}) {
    const base = {
        type,
        code: 'IRC2021',
        storeyHeight,
        width: 1.0,
        availableRun: 4.2,
        availableWidth: 1.2,
        turnDegrees: 90,
        columnRadius: COLUMN_RADIUS,
        poleDiameter: POLE_DEFAULTS.diameter,
        poleOpening: POLE_DEFAULTS.opening,
        poleMat: POLE_DEFAULTS.mat,
        guard: true,
        mat: true
    };

    if (type === 'curve-right' || type === 'curve-left') {
        // A quarter turn needs an outside depth of about 3.6 m at 1 m wide to
        // keep the walkline tread at the 10 in residential minimum.
        return { ...base, availableRun: 5.6, availableWidth: 3.6 };
    }
    if (type === 'spiral') {
        return { ...base, availableWidth: 1.9 };
    }
    if (type === 'fire-pole') {
        return { ...base, availableWidth: 1.2 };
    }
    return base;
}

function pushIssue(issues, severity, code, message) {
    issues.push({ severity, code, message });
}

function addComfort(issues, design) {
    if (!design.riserHeight || !design.treadDepth) return null;
    const value = 2 * design.riserHeight + design.treadDepth;
    const inRange = value >= COMFORT_MIN - 1e-6 && value <= COMFORT_MAX + 1e-6;
    design.comfort = {
        value,
        valueIn: value / IN,
        target: COMFORT_TARGET,
        min: COMFORT_MIN,
        max: COMFORT_MAX,
        inRange
    };
    if (!inRange) {
        const direction = value < COMFORT_MIN ? 'steep' : 'shallow';
        pushIssue(issues, 'info', 'comfort', `2R + T is ${round(value / IN, 1)} in (${direction}); target 24–25 in`);
    }
    return design.comfort;
}

function straightPath({ run, width, rise }) {
    return {
        length: run,
        heightAt: (s) => s * rise,
        pointAt: (s) => ({ x: 0, z: -run / 2 + s * run }),
        tangentAt: () => ({ x: 0, z: 1 }),
        project(local) {
            if (Math.abs(local.x) > width / 2 + 1e-6) return null;
            if (local.z < -run / 2 - 1e-6 || local.z > run / 2 + 1e-6) return null;
            return clamp((local.z + run / 2) / run, 0, 1);
        }
    };
}

function arcPath({ radius, startAngle, sweep, direction, offset, rise, inner, outer }) {
    const total = Math.abs(sweep);
    return {
        length: radius * total,
        heightAt: (s) => s * rise,
        pointAt: (s) => {
            const angle = startAngle + direction * total * s;
            return {
                x: radius * Math.cos(angle) - offset.x,
                z: radius * Math.sin(angle) - offset.z
            };
        },
        tangentAt: (s) => {
            const angle = startAngle + direction * total * s;
            const sign = direction;
            return {
                x: -Math.sin(angle) * sign,
                z: Math.cos(angle) * sign
            };
        },
        project(local) {
            const raw = { x: local.x + offset.x, z: local.z + offset.z };
            const r = Math.hypot(raw.x, raw.z);
            if (r < inner - 1e-6 || r > outer + 1e-6) return null;
            const delta = sweepDelta(Math.atan2(raw.z, raw.x), startAngle, direction);
            if (delta > total + 1e-6) return null;
            return clamp(delta / total, 0, 1);
        }
    };
}

/**
 * Calculate a stair from the space available and the storey height.
 *
 * Input (metres unless noted):
 *   type, code, storeyHeight, width, availableRun, availableWidth,
 *   turnDegrees (90|180), columnRadius, poleDiameter, poleOpening, poleMat.
 */
export function computeStairDesign(input = {}) {
    const type = STAIR_TYPES.includes(input.type) ? input.type : 'straight';
    const code = STAIR_CODES[input.code] || STAIR_CODES.IRC2021;
    const rise = clamp(number(input.storeyHeight ?? input.rise, WALL_HEIGHT), 0.6, 20);
    // Type-aware fallbacks: a curved stair needs more outside depth than a
    // straight one before its walkline tread reaches the minimum.
    const typeDefaults = defaultStairConfig(type, { storeyHeight: rise });
    const width = clamp(number(input.width, typeDefaults.width), 0.6, 4);
    const availableRun = clamp(number(input.availableRun, typeDefaults.availableRun), 0.4, 30);
    const availableWidth = clamp(number(input.availableWidth, typeDefaults.availableWidth), 0.6, 30);
    const issues = [];

    if (type === 'fire-pole') {
        return computeFirePole({ ...input, code, rise, availableWidth, issues });
    }

    const spiral = type === 'spiral';
    const maxRiser = spiral ? code.spiral.maxRiser : code.maxRiser;
    // A designer can pin the step count (locked steps); otherwise the flight is
    // the shortest one that keeps the riser under the limit.
    const requestedRisers = Math.round(number(input.risers, 0));
    const risers = requestedRisers >= 2 ? requestedRisers : Math.max(3, Math.ceil(rise / maxRiser - 1e-9));
    const riserHeight = rise / risers;
    const treads = risers - 1;

    if (riserHeight > maxRiser + 1e-6) {
        pushIssue(issues, 'error', 'riser-too-high', `Riser ${round(riserHeight / IN, 2)} in exceeds ${round(maxRiser / IN, 2)} in`);
    }
    if (!spiral && code.minRiser && riserHeight < code.minRiser - 1e-6) {
        pushIssue(issues, 'error', 'riser-too-low', `Riser ${round(riserHeight / IN, 2)} in is below ${round(code.minRiser / IN, 2)} in`);
    }
    if (rise > code.maxFlightRise + 1e-6) {
        pushIssue(issues, 'warning', 'flight-rise', `Flight rise ${round(rise, 2)} m exceeds ${round(code.maxFlightRise, 2)} m; add a landing`);
    }

    const design = {
        type,
        code: code.key,
        codeLabel: code.label,
        storeyHeight: rise,
        rise,
        width,
        risers,
        riserHeight,
        treads,
        availableRun,
        availableWidth,
        footprint: { width: width, depth: availableRun, shape: 'rect' },
        offset: { x: 0, z: 0 },
        entry: { x: 0, z: 0 },
        exit: { x: 0, z: 0 },
        landingDepth: 0,
        issues,
        compliant: true
    };

    if (type === 'straight') {
        const idealTread = clamp(COMFORT_TARGET - 2 * riserHeight, code.minTread, 0.36);
        // A designer-supplied tread (the going worked out from the total length)
        // wins over the comfort-derived one.
        const forcedTread = number(input.treadDepth, 0);
        let tread = availableRun / treads;
        let runUsed = availableRun;
        if (forcedTread > 0) {
            tread = forcedTread;
            runUsed = tread * treads;
        } else if (tread > idealTread) {
            tread = idealTread;
            runUsed = tread * treads;
        }
        const minRun = code.minTread * treads;

        design.treadDepth = tread;
        design.treadDepthWalkline = tread;
        design.runUsed = runUsed;
        design.minRun = minRun;
        design.footprint = { width, depth: runUsed, shape: 'rect' };
        design.landingDepth = Math.max(0, availableRun - runUsed);

        if (tread < code.minTread - 1e-6) {
            pushIssue(issues, 'error', 'tread-too-shallow',
                `Tread ${round(tread / IN, 2)} in is below ${round(code.minTread / IN, 2)} in; needs ${round(minRun, 2)} m of run`);
        }
        if (width < code.minWidth - 1e-6) {
            pushIssue(issues, 'error', 'width', `Width ${round(width / IN, 1)} in is below ${round(code.minWidth / IN, 0)} in`);
        }
        if (runUsed < availableRun - 0.05) {
            pushIssue(issues, 'info', 'surplus-run', `${round(availableRun - runUsed, 2)} m left for a landing`);
        }
        if (runUsed > availableRun + 0.005) {
            pushIssue(issues, 'warning', 'run-exceeds-space',
                `Run ${round(runUsed, 2)} m is longer than the ${round(availableRun, 2)} m available`);
        }

        design.path = straightPath({ run: runUsed, width, rise });
        design.entry = design.path.pointAt(0);
        design.exit = design.path.pointAt(1);
        design.pathLength = runUsed;
    } else if (type === 'spiral') {
        const diameter = availableWidth;
        const outerRadius = diameter / 2;
        const columnRadius = clamp(number(input.columnRadius, COLUMN_RADIUS), 0.03, 0.3);
        const innerRadius = columnRadius;
        const clearWidth = outerRadius - innerRadius;
        const walklineRadius = innerRadius + code.spiral.walklineOffset;
        const anglePerTread = TAU / treads;
        const tread = walklineRadius * anglePerTread;

        design.columnRadius = columnRadius;
        design.innerRadius = innerRadius;
        design.outerRadius = outerRadius;
        design.walklineRadius = walklineRadius;
        design.clearWidth = clearWidth;
        design.sweep = TAU;
        design.anglePerTread = anglePerTread;
        design.treadDepth = tread;
        design.treadDepthWalkline = tread;
        design.runUsed = TAU * walklineRadius;
        design.minRun = code.spiral.minTread * treads / anglePerTread;
        design.landingDepth = 0;
        design.footprint = { width: diameter, depth: diameter, shape: 'rect' };
        design.offset = { x: 0, z: 0 };

        if (clearWidth < code.spiral.minWidth - 1e-6) {
            pushIssue(issues, 'error', 'spiral-width',
                `Clear width ${round(clearWidth / IN, 1)} in is below ${round(code.spiral.minWidth / IN, 0)} in`);
        }
        if (tread < code.spiral.minTread - 1e-6) {
            const needed = 2 * (walklineRadius * (code.spiral.minTread / tread) - code.spiral.walklineOffset + columnRadius);
            design.minDiameter = Math.max(diameter, needed);
            pushIssue(issues, 'error', 'spiral-tread',
                `Tread ${round(tread / IN, 2)} in is below ${round(code.spiral.minTread / IN, 2)} in; try a ${round(design.minDiameter, 2)} m diameter`);
        }
        if (riserHeight > code.spiral.maxRiser + 1e-6) {
            pushIssue(issues, 'error', 'spiral-riser', 'Spiral riser exceeds 9.5 in');
        }

        const startAngle = -Math.PI / 2;
        design.startAngle = startAngle;
        design.path = arcPath({
            radius: walklineRadius,
            startAngle,
            sweep: TAU,
            direction: 1,
            offset: { x: 0, z: 0 },
            rise,
            inner: innerRadius,
            outer: outerRadius
        });
        design.entry = design.path.pointAt(0);
        design.exit = design.path.pointAt(1);
        design.pathLength = design.path.length;
        design.landingDepth = 0;
    } else {
        const direction = type === 'curve-right' ? 1 : -1;
        const turn = number(input.turnDegrees, 90) === 180 ? Math.PI : Math.PI / 2;
        const sweep = turn;
        const outerByRun = availableRun / sweep;
        const outerRadius = Math.max(width + 0.05, Math.min(outerByRun, availableWidth));
        const innerRadius = Math.max(0.05, outerRadius - width);
        const walklineRadius = innerRadius + code.walklineOffset;
        const anglePerTread = sweep / treads;
        const tread = walklineRadius * anglePerTread;
        const clearTread = innerRadius * anglePerTread;

        design.direction = direction;
        design.sweep = sweep;
        design.innerRadius = innerRadius;
        design.outerRadius = outerRadius;
        design.walklineRadius = walklineRadius;
        design.anglePerTread = anglePerTread;
        design.treadDepth = tread;
        design.treadDepthWalkline = tread;
        design.runUsed = outerRadius * sweep;
        design.minRun = ((code.winderTread * treads) / sweep + width - code.walklineOffset) * sweep;
        design.footprint = { width: 0, depth: 0, shape: 'rect' };

        if (tread < code.winderTread - 1e-6) {
            pushIssue(issues, 'error', 'winder-tread',
                `Walkline tread ${round(tread / IN, 2)} in is below ${round(code.winderTread / IN, 2)} in; needs about ${round(design.minRun, 1)} m of outer run`);
        }
        if (clearTread < code.winderClear - 1e-6) {
            pushIssue(issues, 'error', 'winder-clear',
                `Inside tread ${round(clearTread / IN, 2)} in is below ${round(code.winderClear / IN, 2)} in; increase the inner radius`);
        }
        if (width < code.minWidth - 1e-6) {
            pushIssue(issues, 'error', 'width', `Width ${round(width / IN, 1)} in is below ${round(code.minWidth / IN, 0)} in`);
        }
        if (code.curvedRadiusRule && innerRadius < 2 * width - 1e-6) {
            pushIssue(issues, 'error', 'curved-radius',
                `Inner radius ${round(innerRadius, 2)} m is below 2 × width (${round(2 * width, 2)} m)`);
        }

        // Bounding box of the annular sector, so the plan footprint and the
        // floor opening above match the drawn geometry.
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        const samples = 24;
        for (let i = 0; i <= samples; i++) {
            const angle = -Math.PI / 2 + direction * sweep * (i / samples);
            [innerRadius, outerRadius].forEach((radius) => {
                const x = radius * Math.cos(angle);
                const z = radius * Math.sin(angle);
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
            });
        }
        const offset = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
        design.offset = offset;
        design.footprint = { width: maxX - minX, depth: maxZ - minZ, shape: 'rect' };

        const startAngle = -Math.PI / 2;
        design.startAngle = startAngle;
        design.path = arcPath({
            radius: walklineRadius,
            startAngle,
            sweep,
            direction,
            offset,
            rise,
            inner: innerRadius,
            outer: outerRadius
        });
        design.entry = design.path.pointAt(0);
        design.exit = design.path.pointAt(1);
        design.pathLength = design.path.length;
    }

    addComfort(issues, design);
    design.compliant = !issues.some((issue) => issue.severity === 'error');
    design.errors = issues.filter((issue) => issue.severity === 'error');
    design.warnings = issues.filter((issue) => issue.severity === 'warning');
    design.requirements = {
        minRun: round(design.minRun || 0, 2),
        minWidth: round(code.minWidth, 2),
        headroom: round(spiral ? code.spiral.headroom : code.headroom, 2)
    };
    return design;
}

function computeFirePole(input) {
    const { code, rise, issues } = input;
    const diameter = clamp(number(input.poleDiameter, POLE_DEFAULTS.diameter), 0.02, 0.2);
    const opening = clamp(number(input.poleOpening, POLE_DEFAULTS.opening), 0.5, 2);
    const mat = clamp(number(input.poleMat, POLE_DEFAULTS.mat), 0.3, 2);
    const aboveFloor = clamp(number(input.poleAbove, POLE_DEFAULTS.aboveFloor), 0.3, 2);

    if (rise > POLE_DEFAULTS.maxDrop) {
        pushIssue(issues, 'warning', 'pole-drop',
            `Drop ${round(rise, 2)} m exceeds the 9.14 m standard pole; use an engineered pole`);
    }
    if (diameter < 2.4 * IN || diameter > 3.5 * IN) {
        pushIssue(issues, 'info', 'pole-diameter', 'Typical sliding poles are 2½–3½ in diameter');
    }
    pushIssue(issues, 'error', 'pole-not-egress',
        'Fire poles are not an approved means of egress or access between levels (OSHA 1910.21/1992 interpretation)');
    if (input.guard !== false) {
        pushIssue(issues, 'info', 'pole-guard', 'The floor opening needs a 42 in guardrail and self-closing gate');
    } else {
        pushIssue(issues, 'error', 'pole-guard', 'Unguarded floor opening; a rail or cover is required');
    }
    if (input.mat !== false) {
        pushIssue(issues, 'info', 'pole-mat', 'Use a 32 in anti-skid landing mat and a warning sign');
    }

    return {
        type: 'fire-pole',
        code: code.key,
        codeLabel: code.label,
        storeyHeight: rise,
        rise,
        drop: rise,
        width: opening,
        risers: 0,
        riserHeight: null,
        treads: 0,
        treadDepth: null,
        treadDepthWalkline: null,
        runUsed: 0,
        availableRun: 0,
        availableWidth: input.availableWidth,
        footprint: { width: opening, depth: opening, shape: 'circle' },
        offset: { x: 0, z: 0 },
        entry: { x: 0, z: 0 },
        exit: { x: 0, z: 0 },
        pole: {
            diameter,
            opening,
            mat,
            aboveFloor,
            guardHeight: POLE_DEFAULTS.guardHeight,
            floorThickness: POLE_DEFAULTS.floorThickness,
            landingMat: input.mat !== false,
            guard: input.guard !== false
        },
        issues,
        compliant: !issues.some((issue) => issue.severity === 'error'),
        errors: issues.filter((issue) => issue.severity === 'error'),
        warnings: issues.filter((issue) => issue.severity === 'warning'),
        requirements: {
            minRun: 0,
            minWidth: 26 * IN,
            headroom: 78 * IN
        }
    };
}

const STAIR_ITEM_TYPES = new Set(['stair', 'fire_pole', 'stair_deck', 'stair_porch', 'stair_egress', 'stair_apartment', 'stair_concrete']);

export function isStairItem(item) {
    return STAIR_ITEM_TYPES.has(item?.type) || Boolean(item?.stair);
}

export function resolveStairConfig(item) {
    const metadataConfig = item?.metadata?.stair || {};
    const type = item?.stair?.type || metadataConfig.type || (item?.type === 'fire_pole' ? 'fire-pole' : 'straight');
    const fallback = defaultStairConfig(type);
    return { ...fallback, ...(item?.metadata?.stair || {}), ...(item?.stair || {}), type };
}

/** Design for a placed item, using its storey height for the rise. */
export function stairDesignForItem(item, storeyHeight = WALL_HEIGHT) {
    const config = resolveStairConfig(item);
    return computeStairDesign({ ...config, storeyHeight });
}

/** Footprint used for the plan marker and the floor opening above. */
export function stairFootprint(item, storeyHeight = WALL_HEIGHT) {
    const design = stairDesignForItem(item, storeyHeight);
    return {
        width: design.footprint.width,
        depth: design.footprint.depth,
        shape: design.footprint.shape,
        design
    };
}

/** Plan pixels -> stair-local metres (geometry is centred on the item). */
export function planPointToStairLocal(item, point) {
    const dx = (point.x - item.x) / PIXELS_PER_METER;
    const dz = (point.y - item.y) / PIXELS_PER_METER;
    const cos = Math.cos(item.rotation || 0);
    const sin = Math.sin(item.rotation || 0);
    return {
        x: dx * cos + dz * sin,
        z: -dx * sin + dz * cos
    };
}

/** Stair-local metres -> plan pixels. */
export function stairLocalToPlanPoint(item, local) {
    const cos = Math.cos(item.rotation || 0);
    const sin = Math.sin(item.rotation || 0);
    return {
        x: item.x + (local.x * cos - local.z * sin) * PIXELS_PER_METER,
        y: item.y + (local.x * sin + local.z * cos) * PIXELS_PER_METER
    };
}

export function stairSurfaceAt(item, design, planPoint) {
    if (!design?.path) return null;
    const local = planPointToStairLocal(item, planPoint);
    const s = design.path.project(local);
    if (s == null) return null;
    return {
        s,
        height: design.path.heightAt(s),
        point: design.path.pointAt(s),
        tangent: design.path.tangentAt(s),
        design
    };
}

export function stairSummary(design) {
    if (!design) return [];
    if (design.type === 'fire-pole') {
        return [
            `Pole ${round(design.pole.diameter / IN, 2)} in × ${round(design.drop, 2)} m drop`,
            `Opening ${round(design.pole.opening / IN, 1)} in · mat ${round(design.pole.mat / IN, 1)} in`,
            ...design.issues.map((issue) => `${issue.severity === 'error' ? '✖' : 'ℹ'} ${issue.message}`)
        ];
    }
    const lines = [
        `${design.risers} risers × ${round(design.riserHeight / IN, 2)} in (${round(design.riserHeight, 3)} m)`,
        `${design.treads} treads × ${round(design.treadDepth / IN, 2)} in at ${design.type === 'straight' ? 'tread' : 'walkline'}`,
        `Run ${round(design.runUsed, 2)} m · footprint ${round(design.footprint.width, 2)} × ${round(design.footprint.depth, 2)} m`,
        `2R + T ${round(design.comfort.value / IN, 1)} in`
    ];
    design.issues.forEach((issue) => {
        lines.push(`${issue.severity === 'error' ? '✖' : issue.severity === 'warning' ? '⚠' : 'ℹ'} ${issue.message}`);
    });
    return lines;
}
