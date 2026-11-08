import * as THREE from 'three';
import { IN } from './design.js';

/**
 * Straight stair designer.
 *
 * A configurator in the shape of the EasyStair straight-staircase page and its
 * published method (see STAIR CALC.MD):
 *
 *   steps      = round(height / 175) − 1        (the number of treads)
 *   risers     = steps + 1
 *   step height= height / risers
 *   going      = Blondel − 2 × step height      (630 by default)
 *   step depth = going + overlap
 *   total run  = steps × going + landing step
 *   angle      = atan(step height / going)
 *   headroom   = tan(angle) × (floor opening length − landing step) − floor thickness
 *
 * Or solve by length instead of Blondel: going = (length − landing step) / steps.
 *
 * Metric rules: riser 150–200 (ideal 175), going 230–330 (ideal 280), angle
 * 20–50° (ideal 30–35°), G + 2H 590–650 (ideal 630), headroom ≥ 1900 (ideal
 * 2100), width ≥ 700 (ideal 800).
 *
 * The result can be handed to the plan editor via `toStairConfig()` and the
 * localStorage draft; the shared engine then pins the riser count and going.
 */

const MM = 0.001;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, places = 0) => Math.round(value * 10 ** places) / 10 ** places;

export const DESIGNER_RULES = {
    width: { min: 700, ideal: 800 },
    riser: { min: 150, max: 200, ideal: 175 },
    going: { min: 230, max: 330, ideal: 280 },
    angle: { min: 20, max: 50, idealMin: 30, idealMax: 35 },
    blondel: { min: 590, max: 650, ideal: 630 },
    headroom: { min: 1900, ideal: 2100 },
    overlap: { min: 0, max: 80, ideal: 45 },
    steps: { min: 2, max: 30 }
};

export const DESIGNER_DEFAULTS = {
    height: 2700,
    length: 4200,
    width: 1000,
    solve: 'blondel',
    blondelTarget: 630,
    steps: null,
    landingStep: 50,
    overlap: 45,
    stepThickness: 40,
    openingLength: 3600,
    floorThickness: 200,
    leftOffset: 0,
    rightOffset: 0
};

function pushCheck(checks, id, label, value, limit, severity, message) {
    checks.push({ id, label, value, limit, severity, message });
}

/** Number of steps (treads) for the ideal 175 mm riser, per the method. */
export function autoStepCount(height) {
    return clamp(Math.round(height / DESIGNER_RULES.riser.ideal) - 1, DESIGNER_RULES.steps.min, DESIGNER_RULES.steps.max);
}

/**
 * Size a straight stair. Millimetres in and out, except `steps` (count or null)
 * and `solve` ('blondel' picks the going from Blondel's law, 'length' from the
 * total run).
 */
export function computeStraightDesigner(input = {}) {
    const height = clamp(number(input.height, DESIGNER_DEFAULTS.height), 1200, 4500);
    const width = clamp(number(input.width, DESIGNER_DEFAULTS.width), 500, 2000);
    const solve = input.solve === 'length' ? 'length' : 'blondel';
    const blondelTarget = clamp(number(input.blondelTarget, DESIGNER_DEFAULTS.blondelTarget), DESIGNER_RULES.blondel.min, DESIGNER_RULES.blondel.max);
    const landingStep = clamp(number(input.landingStep, DESIGNER_DEFAULTS.landingStep), 0, 300);
    const overlap = clamp(number(input.overlap, DESIGNER_DEFAULTS.overlap), 0, DESIGNER_RULES.overlap.max);
    const stepThickness = clamp(number(input.stepThickness, DESIGNER_DEFAULTS.stepThickness), 20, 140);
    const floorThickness = clamp(number(input.floorThickness, DESIGNER_DEFAULTS.floorThickness), 80, 400);
    const openingLength = clamp(number(input.openingLength, DESIGNER_DEFAULTS.openingLength), 0, 12000);
    const leftOffset = clamp(number(input.leftOffset, DESIGNER_DEFAULTS.leftOffset), -500, 500);
    const rightOffset = clamp(number(input.rightOffset, DESIGNER_DEFAULTS.rightOffset), -500, 500);

    const requestedSteps = Math.round(number(input.steps, 0));
    const autoSteps = requestedSteps < DESIGNER_RULES.steps.min;
    const steps = autoSteps
        ? autoStepCount(height)
        : clamp(requestedSteps, DESIGNER_RULES.steps.min, DESIGNER_RULES.steps.max);
    const risers = steps + 1;
    const stepHeight = height / risers;

    // Going: from Blondel's law, or from the total run the space allows.
    const lengthInput = clamp(number(input.length, DESIGNER_DEFAULTS.length), 1000, 12000);
    const going = solve === 'length'
        ? (lengthInput - landingStep) / steps
        : blondelTarget - 2 * stepHeight;
    const stepDepth = going + overlap;
    const totalRun = steps * going + landingStep;
    const angle = (Math.atan2(stepHeight, going) * 180) / Math.PI;
    const angleRad = Math.atan2(stepHeight, going);
    const blondel = going + 2 * stepHeight;

    // The opening length includes the landing step; headroom is measured at the
    // ceiling edge, tan(angle) back from the top nosing.
    const clearanceRun = Math.max(0, openingLength - landingStep);
    const headroom = Math.tan(angleRad) * clearanceRun - floorThickness;
    const openingStart = clamp(totalRun - clearanceRun, 0, totalRun);

    const idealAngle = (DESIGNER_RULES.angle.idealMin + DESIGNER_RULES.angle.idealMax) / 2;
    const comfort = clamp(
        Math.round(100 - Math.abs(blondel - DESIGNER_RULES.blondel.ideal) / 2 - Math.max(0, Math.abs(angle - idealAngle) - 2.5) * 1.5),
        0,
        100
    );

    const checks = [];
    if (width < DESIGNER_RULES.width.min) {
        pushCheck(checks, 'width', 'Width', width, DESIGNER_RULES.width.min, 'error',
            `Width ${round(width)} mm is below the ${DESIGNER_RULES.width.min} mm minimum`);
    } else if (width < DESIGNER_RULES.width.ideal) {
        pushCheck(checks, 'width', 'Width', width, DESIGNER_RULES.width.ideal, 'warn',
            `Width is under the ${DESIGNER_RULES.width.ideal} mm comfortable minimum`);
    } else {
        pushCheck(checks, 'width', 'Width', width, DESIGNER_RULES.width.ideal, 'ok', 'Width is comfortable');
    }

    if (stepHeight < DESIGNER_RULES.riser.min || stepHeight > DESIGNER_RULES.riser.max) {
        pushCheck(checks, 'riser', 'Step height', stepHeight, DESIGNER_RULES.riser, 'error',
            `Step height ${round(stepHeight)} mm is outside ${DESIGNER_RULES.riser.min}–${DESIGNER_RULES.riser.max} mm`);
    } else if (Math.abs(stepHeight - DESIGNER_RULES.riser.ideal) > 20) {
        pushCheck(checks, 'riser', 'Step height', stepHeight, DESIGNER_RULES.riser.ideal, 'warn',
            `Step height ${round(stepHeight)} mm is away from the ${DESIGNER_RULES.riser.ideal} mm ideal`);
    } else {
        pushCheck(checks, 'riser', 'Step height', stepHeight, DESIGNER_RULES.riser.ideal, 'ok', 'Step height is comfortable');
    }

    if (going < DESIGNER_RULES.going.min || going > DESIGNER_RULES.going.max) {
        pushCheck(checks, 'going', 'Going', going, DESIGNER_RULES.going, 'error',
            `Going ${round(going)} mm is outside ${DESIGNER_RULES.going.min}–${DESIGNER_RULES.going.max} mm`);
    } else if (Math.abs(going - DESIGNER_RULES.going.ideal) > 30) {
        pushCheck(checks, 'going', 'Going', going, DESIGNER_RULES.going.ideal, 'warn',
            `Going ${round(going)} mm is away from the ${DESIGNER_RULES.going.ideal} mm ideal`);
    } else {
        pushCheck(checks, 'going', 'Going', going, DESIGNER_RULES.going.ideal, 'ok', 'Going is comfortable');
    }

    if (angle < DESIGNER_RULES.angle.min || angle > DESIGNER_RULES.angle.max) {
        pushCheck(checks, 'angle', 'Angle', angle, DESIGNER_RULES.angle, 'error',
            `Slope ${round(angle, 1)}° is outside ${DESIGNER_RULES.angle.min}–${DESIGNER_RULES.angle.max}°`);
    } else if (angle < DESIGNER_RULES.angle.idealMin - 2 || angle > DESIGNER_RULES.angle.idealMax + 2) {
        pushCheck(checks, 'angle', 'Angle', angle, DESIGNER_RULES.angle, 'warn',
            `Slope ${round(angle, 1)}° is outside the 30–35° comfort band`);
    } else {
        pushCheck(checks, 'angle', 'Angle', angle, (DESIGNER_RULES.angle.idealMin + DESIGNER_RULES.angle.idealMax) / 2, 'ok', 'Slope is comfortable');
    }

    if (blondel < DESIGNER_RULES.blondel.min || blondel > DESIGNER_RULES.blondel.max) {
        pushCheck(checks, 'blondel', 'Blondel', blondel, DESIGNER_RULES.blondel, 'error',
            `G + 2H ${round(blondel)} mm is outside ${DESIGNER_RULES.blondel.min}–${DESIGNER_RULES.blondel.max} mm`);
    } else if (Math.abs(blondel - DESIGNER_RULES.blondel.ideal) > 10) {
        pushCheck(checks, 'blondel', 'Blondel', blondel, DESIGNER_RULES.blondel.ideal, 'warn',
            `G + 2H ${round(blondel)} mm is away from the ${DESIGNER_RULES.blondel.ideal} mm ideal`);
    } else {
        pushCheck(checks, 'blondel', 'Blondel', blondel, DESIGNER_RULES.blondel.ideal, 'ok', 'Blondel value is in the comfort band');
    }

    if (headroom < DESIGNER_RULES.headroom.min) {
        pushCheck(checks, 'headroom', 'Headroom', headroom, DESIGNER_RULES.headroom.min, 'error',
            `Headroom ${round(headroom)} mm is below ${DESIGNER_RULES.headroom.min} mm; lengthen the opening`);
    } else if (headroom < DESIGNER_RULES.headroom.ideal) {
        pushCheck(checks, 'headroom', 'Headroom', headroom, DESIGNER_RULES.headroom.ideal, 'warn',
            `Headroom ${round(headroom)} mm is under the ${DESIGNER_RULES.headroom.ideal} mm ideal`);
    } else {
        pushCheck(checks, 'headroom', 'Headroom', headroom, DESIGNER_RULES.headroom.ideal, 'ok', 'Headroom is comfortable');
    }

    if (landingStep > 0 && landingStep < overlap) {
        pushCheck(checks, 'landing-step', 'Landing step', landingStep, overlap, 'warn',
            `Landing step ${round(landingStep)} mm is smaller than the ${round(overlap)} mm overlap`);
    }
    if (openingLength < 800) {
        pushCheck(checks, 'opening', 'Opening', openingLength, 800, 'warn',
            'Floor opening under 800 mm leaves no room to arrive at the top');
    }
    if (openingLength > totalRun + landingStep) {
        pushCheck(checks, 'opening-range', 'Opening', openingLength, totalRun, 'warn', 'Opening is longer than the stair run');
    }
    if (leftOffset < 0 || rightOffset < 0) {
        pushCheck(checks, 'opening-offset', 'Opening offsets', Math.min(leftOffset, rightOffset), 0, 'warn',
            'Negative offsets narrow the opening below the stair width');
    }
    if (!autoSteps) {
        pushCheck(checks, 'steps-locked', 'Steps', steps, null, 'info', 'Step count is locked');
    }

    const treads = [];
    for (let k = 1; k <= steps; k++) {
        const nosingX = (k - 1) * going;
        treads.push({
            index: k,
            top: k * stepHeight,
            nosingX,
            startX: nosingX,
            endX: nosingX + stepDepth,
            depth: stepDepth,
            landing: false
        });
    }
    if (landingStep > 0) {
        // The landing step sits at floor level in the extension of the floor and
        // overhangs the last tread by the overlap.
        treads.push({
            index: steps + 1,
            top: height,
            nosingX: totalRun,
            startX: totalRun - landingStep - overlap,
            endX: totalRun,
            depth: landingStep + overlap,
            landing: true
        });
    }

    const risersList = [];
    for (let k = 1; k <= risers; k++) {
        risersList.push({ index: k, x: (k - 1) * going, bottom: (k - 1) * stepHeight, top: k * stepHeight });
    }

    return {
        input: {
            height, width, solve, blondelTarget, steps, landingStep, overlap,
            stepThickness, openingLength, floorThickness, leftOffset, rightOffset,
            length: lengthInput
        },
        height,
        width,
        length: totalRun,
        totalRun,
        solve,
        blondelTarget,
        steps,
        risers,
        stepHeight,
        going,
        stepDepth,
        tread: stepDepth,
        overlap,
        landingStep: { size: landingStep, enabled: landingStep > 0, enabledValue: landingStep },
        stepThickness,
        angle,
        blondel,
        headroom,
        comfort,
        autoSteps,
        opening: {
            length: openingLength,
            startX: openingStart,
            endX: totalRun,
            floorThickness,
            topY: height,
            leftOffset,
            rightOffset
        },
        elevation: {
            treads,
            risers: risersList,
            nosingLine: [{ x: 0, y: stepHeight }, { x: totalRun, y: height }],
            width,
            height,
            length: totalRun,
            totalRun,
            stepHeight,
            going,
            stepDepth,
            stepThickness,
            overlap,
            landingStep,
            openingStart,
            openingLength,
            floorThickness,
            headroom,
            headroomX: openingStart,
            ceilingY: height - floorThickness
        },
        checks,
        compliant: !checks.some((check) => check.severity === 'error'),
        metres: {
            height: height * MM,
            length: totalRun * MM,
            width: width * MM,
            stepHeight: stepHeight * MM,
            going: going * MM,
            stepDepth: stepDepth * MM,
            tread: stepDepth * MM,
            overlap: overlap * MM,
            stepThickness: stepThickness * MM,
            landingStep: landingStep * MM,
            openingLength: openingLength * MM,
            floorThickness: floorThickness * MM
        }
    };
}

/** Result lines for the summary card. */
export function designerSummary(result) {
    return [
        `${result.steps} steps (${result.risers} risers) × ${round(result.stepHeight)} mm`,
        `${round(result.going)} mm going · ${round(result.stepDepth)} mm step depth`,
        `Total run ${round(result.totalRun)} mm · ${round(result.angle, 1)}° · G + 2H ${round(result.blondel)} mm`,
        `Headroom ${round(result.headroom)} mm · comfort ${result.comfort}%`
    ];
}

/** Takeoff rows for the cutting list / CSV export. */
export function designerTakeoffCsv(result) {
    const rows = [
        ['steps', result.steps, `${round(result.stepHeight)} mm riser × ${round(result.stepDepth)} mm depth`],
        ['risers', result.risers, `${round(result.stepHeight)} mm`],
        ['landing step', result.landingStep.enabled ? 1 : 0, result.landingStep.enabled ? `${round(result.landingStep.size)} mm` : 'none'],
        ['stringers', 2, `${round(Math.hypot(result.totalRun, result.height))} mm long`],
        ['floor opening', 1, `${round(result.opening.length)} × ${round(result.width)} mm`],
        ['handrail', 2, '900 mm above the nosing line']
    ];
    return ['item,qty,note', ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
}

/**
 * Map the designer onto the shared stair engine. The riser count and going are
 * pinned so the placed stair keeps the numbers shown here; the run is the flight
 * (steps × going), with the landing step and platforms added by the assembly.
 */
export function toStairConfig(result) {
    return {
        type: 'straight',
        code: 'IRC2021',
        width: result.metres.width,
        availableRun: result.steps * result.metres.going,
        storeyHeight: result.metres.height,
        risers: result.risers,
        treadDepth: result.metres.going,
        model: null,
        system: null
    };
}

export const DESIGNER_DRAFT_KEY = 'stair-designer-draft';

export function saveDesignerDraft(result, storage = globalThis.localStorage) {
    if (!storage) return false;
    storage.setItem(DESIGNER_DRAFT_KEY, JSON.stringify({
        stair: toStairConfig(result),
        designer: {
            height: result.height,
            width: result.width,
            solve: result.solve,
            blondelTarget: result.blondelTarget,
            steps: result.steps,
            landingStep: result.landingStep.size,
            overlap: result.overlap,
            stepThickness: result.stepThickness,
            openingLength: result.opening.length,
            floorThickness: result.opening.floorThickness
        }
    }));
    return true;
}

export function readDesignerDraft(storage = globalThis.localStorage) {
    if (!storage) return null;
    try {
        const raw = storage.getItem(DESIGNER_DRAFT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function clearDesignerDraft(storage = globalThis.localStorage) {
    storage?.removeItem?.(DESIGNER_DRAFT_KEY);
}

/**
 * Side elevation, fitted to the canvas box: stepped profile with overlap and
 * thickness, the landing step, the upper floor and its opening, the nosing line
 * and the headroom arrow, with the overall dimensions.
 */
export function drawStairElevation(ctx, result, { width, height, padding = 26, theme = {} } = {}) {
    const colors = {
        step: theme.step || '#e8edf5',
        stepEdge: theme.stepEdge || '#334155',
        riser: theme.riser || '#cbd5e1',
        floor: theme.floor || '#dbe3ee',
        floorEdge: theme.floorEdge || '#64748b',
        line: theme.line || '#0ea5e9',
        text: theme.text || '#0f172a',
        muted: theme.muted || '#64748b',
        bad: theme.bad || '#dc2626',
        ...theme
    };
    const e = result.elevation;
    const pad = padding;
    const worldMinX = -0.2;
    const worldMaxX = e.totalRun + Math.max(0.5, e.landingStep / 1000) + 0.15;
    const worldMinY = -0.32;
    const worldMaxY = e.height + 0.45;
    const scale = Math.min(
        (width - pad * 2) / (worldMaxX - worldMinX),
        (height - pad * 2) / (worldMaxY - worldMinY)
    );
    const X = (x) => pad + (x - worldMinX) * scale;
    const Y = (y) => height - pad - (y - worldMinY) * scale;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

    // Lower floor.
    ctx.strokeStyle = colors.floorEdge;
    ctx.beginPath();
    ctx.moveTo(X(worldMinX), Y(0));
    ctx.lineTo(X(e.totalRun + 0.12), Y(0));
    ctx.stroke();

    // Steps: tread with its overlap and thickness, then the riser face.
    e.treads.forEach((tread) => {
        ctx.fillStyle = tread.landing ? colors.floor : colors.step;
        ctx.strokeStyle = colors.stepEdge;
        ctx.beginPath();
        ctx.rect(X(tread.startX), Y(tread.top), (tread.endX - tread.startX) * scale, e.stepThickness * scale);
        ctx.fill();
        ctx.stroke();
    });
    e.risers.forEach((riser) => {
        ctx.fillStyle = colors.riser;
        ctx.strokeStyle = colors.stepEdge;
        ctx.beginPath();
        ctx.rect(X(riser.x) - 2, Y(riser.top), 2, (riser.top - riser.bottom) * scale);
        ctx.fill();
    });

    // Upper floor slab around the opening, drawn over the tucked-in steps.
    const slabStart = e.openingStart > 0.02 ? e.openingStart : e.totalRun;
    ctx.fillStyle = colors.floor;
    ctx.strokeStyle = colors.floorEdge;
    ctx.beginPath();
    ctx.rect(X(slabStart), Y(e.height), (worldMaxX - slabStart) * scale, e.floorThickness * scale);
    ctx.fill();
    ctx.stroke();

    // Nosing line.
    ctx.strokeStyle = colors.line;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(X(e.nosingLine[0].x), Y(e.nosingLine[0].y));
    ctx.lineTo(X(e.nosingLine[1].x), Y(e.nosingLine[1].y));
    ctx.stroke();
    ctx.setLineDash([]);

    // Headroom arrow at the clearing edge, drawing the reported value.
    const badHeadroom = result.headroom < DESIGNER_RULES.headroom.min;
    ctx.strokeStyle = badHeadroom ? colors.bad : colors.line;
    ctx.fillStyle = badHeadroom ? colors.bad : colors.line;
    const headroomBottom = e.ceilingY - result.headroom / 1000;
    ctx.beginPath();
    ctx.moveTo(X(e.headroomX), Y(headroomBottom));
    ctx.lineTo(X(e.headroomX), Y(e.ceilingY));
    ctx.stroke();
    [headroomBottom, e.ceilingY].forEach((y) => {
        ctx.beginPath();
        ctx.arc(X(e.headroomX), Y(y), 2.5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.fillText(`headroom ${round(result.headroom)}`, X(e.headroomX) + 6, Y((headroomBottom + e.ceilingY) / 2) + 4);

    // Overall height and run.
    ctx.strokeStyle = colors.muted;
    ctx.fillStyle = colors.text;
    const heightX = X(worldMinX + 0.05);
    ctx.beginPath();
    ctx.moveTo(heightX, Y(0));
    ctx.lineTo(heightX, Y(e.height));
    ctx.stroke();
    ctx.save();
    ctx.translate(heightX - 6, Y(e.height / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`${round(result.height)} mm`, 0, 0);
    ctx.restore();

    const lengthY = Y(worldMinY + 0.08);
    ctx.beginPath();
    ctx.moveTo(X(0), lengthY);
    ctx.lineTo(X(e.totalRun), lengthY);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillText(`run ${round(e.totalRun)} mm`, X(e.totalRun / 2), lengthY - 5);

    // Step height and going on the second step.
    const step = e.risers[1];
    if (step) {
        ctx.textAlign = 'right';
        ctx.fillText(`${round(result.stepHeight)}`, X(step.x) - 3, Y((step.bottom + step.top) / 2) + 4);
        ctx.textAlign = 'left';
        ctx.fillText(`${round(result.going)}`, X(step.x) + 4, Y(step.top) - 4);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = colors.muted;
    ctx.fillText(`${round(result.angle, 1)}°`, X(0) + 6, Y(e.stepHeight) - 6);

    ctx.restore();
    return { scale, X, Y };
}

const MATERIALS = {
    tread: new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.62, metalness: 0.04 }),
    landing: new THREE.MeshStandardMaterial({ color: 0xa87f5f, roughness: 0.62, metalness: 0.04 }),
    riser: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.85 }),
    stringer: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.55 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.35, metalness: 0.7 }),
    floor: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.92 })
};

const mesh = (geometry, material, { cast = true } = {}) => {
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = cast;
    object.receiveShadow = true;
    return object;
};

/** 3D preview: steps, landing step, stringers, guard and the floor opening. */
export function buildDesignerStair(result) {
    const group = new THREE.Group();
    const e = result.elevation;
    const width = e.width;
    const thickness = e.stepThickness;

    e.treads.forEach((tread) => {
        const depth = tread.endX - tread.startX;
        const box = mesh(new THREE.BoxGeometry(depth, thickness, width), tread.landing ? MATERIALS.landing : MATERIALS.tread);
        box.position.set(tread.startX + depth / 2, tread.top - thickness / 2, 0);
        box.name = tread.landing ? 'designer-landing-step' : `designer-tread-${tread.index}`;
        group.add(box);
    });

    e.risers.forEach((riser) => {
        const h = riser.top - riser.bottom;
        const box = mesh(new THREE.BoxGeometry(0.02, h, width), MATERIALS.riser);
        box.position.set(riser.x + 0.01, riser.bottom + h / 2, 0);
        group.add(box);
    });

    const pitch = -Math.atan2(e.height, e.totalRun);
    const stringerLength = Math.hypot(e.totalRun, e.height);
    [-1, 1].forEach((side) => {
        const stringer = mesh(new THREE.BoxGeometry(stringerLength, 0.24, 0.05), MATERIALS.stringer);
        stringer.position.set(e.totalRun / 2, e.height / 2 - 0.1, side * (width / 2 + 0.025));
        stringer.rotation.z = pitch;
        group.add(stringer);
    });

    // Guard rail on both sides, posts every second step.
    [-1, 1].forEach((side) => {
        const z = side * (width / 2 - 0.03);
        const points = [];
        e.treads.forEach((tread, index) => {
            if (index % 2 === 0) {
                const post = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.9, 8), MATERIALS.rail);
                post.position.set(tread.startX, tread.top + 0.45, z);
                group.add(post);
            }
            points.push(new THREE.Vector3(tread.startX + 0.05, tread.top + 0.9, z));
        });
        points.push(new THREE.Vector3(e.totalRun, e.height + 0.9, z));
        const curve = new THREE.CatmullRomCurve3(points);
        const rail = mesh(new THREE.TubeGeometry(curve, Math.max(12, points.length * 4), 0.022, 6, false), MATERIALS.rail);
        group.add(rail);
    });

    // Upper floor around the opening.
    const slab = { depth: 1.2, edge: 0.5, thickness: e.floorThickness };
    const leftOffset = Math.max(0, result.opening.leftOffset) * MM;
    const rightOffset = Math.max(0, result.opening.rightOffset) * MM;
    const past = mesh(
        new THREE.BoxGeometry(slab.depth, slab.thickness, width + leftOffset + rightOffset + slab.edge * 2),
        MATERIALS.floor,
        { cast: false }
    );
    past.position.set(e.totalRun + slab.depth / 2, e.height - slab.thickness / 2, 0);
    past.name = 'designer-upper-floor';
    group.add(past);

    [-1, 1].forEach((side) => {
        const inner = width / 2 + (side < 0 ? leftOffset : rightOffset);
        const sideStrip = mesh(
            new THREE.BoxGeometry(Math.max(0.2, e.openingStart), slab.thickness, slab.edge),
            MATERIALS.floor,
            { cast: false }
        );
        sideStrip.position.set(e.openingStart / 2, e.height - slab.thickness / 2, side * (inner + slab.edge / 2));
        group.add(sideStrip);
    });

    group.position.set(-e.totalRun / 2, 0, 0);
    group.userData = { type: 'designer-stair', result };
    return group;
}

export const DESIGNER_UNIT_MM = MM;
export const DESIGNER_INCH = IN;
