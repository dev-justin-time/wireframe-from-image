import { WALL_HEIGHT, PIXELS_PER_METER } from '../../core/world-space.js';
import { computeStairDesign, IN, FT } from './design.js';
import { computeOutdoorStair, getOutdoorSystem } from './outdoor.js';

/**
 * BIM-style stair assembly.
 *
 * A stair is four sub-types, not one object:
 *
 *   Run Type       treads, risers, nosings, materials, riser/tread/width
 *   Landing Type   top and bottom platforms (automatic unless disabled),
 *                  plus any intermediate landings authored by hand
 *   Levels         base and top elevation, each with an offset
 *   Support Type   carriage (residential wood) or stringer (metal/concrete)
 *
 * `buildStairAssembly` derives that model from the shared design engine so the
 * editor, the geometry and the takeoff all read the same numbers. The option bar
 * in the editor writes straight into the same fields.
 */

export const SUPPORT_TYPES = {
    carriage: {
        key: 'carriage',
        label: 'Carriage (residential wood)',
        material: 'Pressure-treated 2x12 carriage',
        part: 'stringer-2x12',
        count: (width) => (width > 1.22 ? 3 : 2)
    },
    stringer: {
        key: 'stringer',
        label: 'Stringer (industrial metal)',
        material: 'Galvanised steel channel stringer',
        part: 'stringer-steel-channel',
        count: (width) => (width > 1.22 ? 3 : 2)
    },
    concrete: {
        key: 'concrete',
        label: 'Cast concrete flight',
        material: '4000 psi reinforced concrete',
        part: 'concrete-flight',
        count: () => 1
    }
};

export const NOSING_TYPES = {
    square: { key: 'square', label: 'Square edge', projection: 0 },
    nosing: { key: 'nosing', label: 'Projecting nosing', projection: 0.75 * IN },
    'anti-slip': { key: 'anti-slip', label: 'Anti-slip insert', projection: 0.75 * IN }
};

export const RUN_MATERIALS = {
    wood: { key: 'wood', label: 'Wood treads', tread: 'tread-deck', riser: 'riser-1x8' },
    concrete: { key: 'concrete', label: 'Concrete', tread: 'tread-concrete', riser: 'riser-1x8' },
    steel: { key: 'steel', label: 'Steel pan + concrete fill', tread: 'tread-concrete', riser: 'riser-1x8' },
    composite: { key: 'composite', label: 'Composite decking', tread: 'tread-deck', riser: 'riser-1x8' }
};

const landingDefaults = (width, depth, material) => ({
    enabled: true,
    width,
    depth,
    offset: 0,
    material,
    slope: 0.25 / 12
});

/**
 * Build the four-part assembly.
 *
 * Input: any `computeStairDesign` input plus
 *   system            outdoor system key (optional)
 *   baseElevation     metres, default 0
 *   baseOffset/topOffset  metres, default 0
 *   landings.top/bottom   { enabled, depth, width, offset, material }
 *   landings.intermediate [{ riser, depth, width, offset }]
 *   support           'carriage' | 'stringer' | 'concrete'
 *   nosing            'square' | 'nosing' | 'anti-slip'
 */
export function buildStairAssembly(input = {}) {
    const spec = input.system ? getOutdoorSystem(input.system) : null;
    const design = input.design
        || (spec ? computeOutdoorStair({ ...input, system: spec.key }) : computeStairDesign(input));
    const issues = [];

    const structure = spec?.structure || input.structure || (input.support === 'carriage' ? 'wood' : 'steel');
    const supportKey = input.support
        || (structure === 'wood' ? 'carriage' : structure === 'concrete' ? 'concrete' : 'stringer');
    const supportType = SUPPORT_TYPES[supportKey] || SUPPORT_TYPES.carriage;

    const baseElevation = Number(input.baseElevation ?? input.base?.elevation ?? 0);
    const baseOffset = Number(input.baseOffset ?? input.base?.offset ?? 0);
    const topOffset = Number(input.topOffset ?? input.top?.offset ?? 0);
    const topElevation = baseElevation + design.rise + topOffset;

    const nosingKey = input.nosing || (design.treadDepth && design.treadDepth < 11 * IN ? 'nosing' : 'square');
    const nosing = NOSING_TYPES[nosingKey] || NOSING_TYPES.square;
    const materialKey = input.material || (structure === 'wood' ? 'wood' : structure === 'concrete' ? 'concrete' : 'steel');
    const runMaterial = RUN_MATERIALS[materialKey] || RUN_MATERIALS.wood;

    const landingWidth = design.width;
    const codeLandingDepth = Math.min(design.width, 48 * IN);
    const defaultLandingDepth = spec?.landingDepth || Math.max(36 * IN, codeLandingDepth);
    const topLanding = { ...landingDefaults(landingWidth, defaultLandingDepth, runMaterial.key), ...(input.landings?.top || {}) };
    const bottomLanding = { ...landingDefaults(landingWidth, Math.max(36 * IN, defaultLandingDepth * 0.75), runMaterial.key), ...(input.landings?.bottom || {}) };
    const intermediates = (input.landings?.intermediate || []).map((landing, index) => ({
        riser: Number(landing.riser) || 0,
        width: Number(landing.width) || landingWidth,
        depth: Number(landing.depth) || defaultLandingDepth,
        offset: Number(landing.offset) || 0,
        material: landing.material || runMaterial.key,
        index
    }));

    // Intermediate landings break the flight and are checked as such.
    intermediates.forEach((landing) => {
        if (landing.riser <= 0 || landing.riser >= design.risers) {
            issues.push({
                severity: 'error',
                code: 'landing-riser',
                message: `Intermediate landing at riser ${landing.riser} is outside the flight (1–${design.risers - 1})`
            });
        }
        if (landing.depth < codeLandingDepth - 1e-6) {
            issues.push({
                severity: 'warning',
                code: 'landing-depth',
                message: `Intermediate landing ${landing.depth.toFixed(2)} m is shallower than ${codeLandingDepth.toFixed(2)} m`
            });
        }
    });

    if (topLanding.enabled && topLanding.depth < Math.min(36 * IN, codeLandingDepth) - 1e-6) {
        issues.push({ severity: 'error', code: 'top-landing', message: 'Top landing is shallower than the code minimum' });
    }
    if (bottomLanding.enabled && bottomLanding.depth < 36 * IN - 1e-6 && design.risers > 1) {
        issues.push({ severity: 'info', code: 'bottom-landing', message: 'Bottom landing is under 36 in; extend it where a door or gate lands' });
    }
    if (topOffset !== 0 || baseOffset !== 0) {
        issues.push({
            severity: 'info',
            code: 'level-offset',
            message: `Levels carry offsets (base ${baseOffset.toFixed(2)} m, top ${topOffset.toFixed(2)} m); verify the finish floor datums`
        });
    }

    const subTypes = {
        run: {
            type: design.type,
            risers: design.risers,
            riserHeight: design.riserHeight,
            treads: design.treads,
            treadDepth: design.treadDepth,
            treadDepthWalkline: design.treadDepthWalkline,
            width: design.width,
            nosings: nosingKey,
            materials: runMaterial.key,
            treadPart: runMaterial.tread,
            riserPart: runMaterial.riser
        },
        landing: {
            top: { ...topLanding, elevation: topElevation },
            bottom: { ...bottomLanding, elevation: baseElevation },
            intermediate: intermediates,
            automatic: topLanding.enabled && bottomLanding.enabled
        },
        levels: {
            base: { elevation: baseElevation, offset: baseOffset, finish: baseElevation + baseOffset },
            top: { elevation: topElevation, offset: topOffset, finish: topElevation },
            totalRise: design.rise
        },
        support: {
            ...supportType,
            qty: supportType.count(design.width),
            span: design.runUsed || 0,
            maxSpan: spec?.maxStringerSpan || 3.96
        }
    };

    if (subTypes.support.span > subTypes.support.maxSpan + 1e-6) {
        issues.push({
            severity: 'warning',
            code: 'support-span',
            message: `Support span ${subTypes.support.span.toFixed(2)} m exceeds ${subTypes.support.maxSpan.toFixed(2)} m; add a mid-support`
        });
    }

    return {
        design,
        system: spec?.key || null,
        structure,
        subTypes,
        issues,
        compliant: !issues.some((issue) => issue.severity === 'error'),
        footprint: design.footprint,
        offset: design.offset,
        sections: stairSectionProfile({ design, subTypes })
    };
}

/**
 * Side elevation of the assembly as polylines, for a 3D section or a drawing.
 * `treads` is the sawtooth nosing line; `soffit` is the underside of the flight.
 */
export function stairSectionProfile(assembly = {}) {
    const design = assembly.design || assembly;
    const subTypes = assembly.subTypes;
    const riser = design.riserHeight || 0;
    const tread = design.treadDepth || 0;
    const treads = design.treads || 0;
    const width = design.width || 1;
    const run = design.runUsed || tread * treads;
    const rise = design.rise || riser * (treads + 1);

    if (design.type !== 'straight') {
        return { straight: false, treads: [], soffit: [], rise, run };
    }

    const nosing = [];
    const soffit = [];
    for (let i = 0; i <= treads; i++) {
        const x = -run / 2 + i * tread;
        nosing.push({ x, y: i * riser });
        nosing.push({ x, y: (i + 1) * riser });
        soffit.push({ x, y: Math.max(0, i * riser - 0.22) });
    }
    nosing.push({ x: run / 2, y: rise });

    return {
        straight: true,
        width,
        rise,
        run,
        treads: nosing,
        riserHeight: riser,
        treadDepth: tread,
        support: subTypes?.support || null,
        landings: subTypes
            ? [
                { ...subTypes.landing.bottom, kind: 'bottom' },
                { ...subTypes.landing.top, kind: 'top' }
            ]
            : []
    };
}

function rectanglesOverlap(a, b) {
    return a.minX < b.maxX - 1e-6
        && a.maxX > b.minX + 1e-6
        && a.minZ < b.maxZ - 1e-6
        && a.maxZ > b.minZ + 1e-6;
}

function segmentHitsRect(start, end, rect) {
    // Liang-Barsky clip of the wall segment against the stair footprint.
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const p = [-dx, dx, -dz, dz];
    const q = [start.x - rect.minX, rect.maxX - start.x, start.z - rect.minZ, rect.maxZ - start.z];
    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < 4; i++) {
        if (Math.abs(p[i]) < 1e-9) {
            if (q[i] < 0) return false;
            continue;
        }
        const t = q[i] / p[i];
        if (p[i] < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
        if (t0 > t1) return false;
    }
    return true;
}

/**
 * Clash detection in the plan: stair vs walls and stair vs other fixtures.
 *
 * `placements` are world-metre rectangles: { id, label, minX, maxX, minZ, maxZ, top }
 * (top = height above the base, for a vertical overlap test).
 */
export function findStairClashes(assembly, { walls = [], placements = [], item = null, origin = null } = {}) {
    const design = assembly.design || assembly;
    const halfW = (design.footprint?.width || design.width) / 2;
    const halfD = (design.footprint?.depth || design.runUsed || 0) / 2;
    // Walls and placements are in plan pixels, like the editor's canvas; the
    // design is in metres, so the footprint is scaled and moved to the item.
    const base = item ? { x: item.x, y: item.y } : (origin || { x: 0, y: 0 });
    const rect = {
        minX: base.x + ((design.offset?.x || 0) - halfW) * PIXELS_PER_METER,
        maxX: base.x + ((design.offset?.x || 0) + halfW) * PIXELS_PER_METER,
        minZ: base.y + ((design.offset?.z || 0) - halfD) * PIXELS_PER_METER,
        maxZ: base.y + ((design.offset?.z || 0) + halfD) * PIXELS_PER_METER
    };
    const clashes = [];

    walls.forEach((wall) => {
        const start = { x: wall.start.x ?? wall.x1, z: wall.start.y ?? wall.y1 };
        const end = { x: wall.end.x ?? wall.x2, z: wall.end.y ?? wall.y2 };
        if (segmentHitsRect(start, end, rect)) {
            clashes.push({
                type: 'wall',
                id: wall.id,
                message: `Stair footprint crosses wall ${wall.id || '(unnamed)'}`,
                severity: 'error'
            });
        }
    });

    placements.forEach((placement) => {
        const other = {
            minX: placement.minX,
            maxX: placement.maxX,
            minZ: placement.minZ,
            maxZ: placement.maxZ
        };
        if (!other.minX && other.minX !== 0) return;
        if (rectanglesOverlap(rect, other) && (placement.top ?? 0) > 0.05) {
            clashes.push({
                type: 'item',
                id: placement.id,
                message: `Stair overlaps ${placement.label || placement.id || 'another item'}`,
                severity: 'warning'
            });
        }
    });

    const headroom = (design.rise || 0) - 2.03;
    if (headroom < 0) {
        clashes.push({
            type: 'headroom',
            id: 'headroom',
            message: `Only ${(2.03 + headroom).toFixed(2)} m under the top landing; 2.03 m is the IBC minimum`,
            severity: 'warning'
        });
    }

    return clashes;
}

export function assemblySummary(assembly) {
    if (!assembly) return [];
    const { subTypes, design } = assembly;
    const risers = subTypes?.run?.risers ?? design.risers;
    const riser = subTypes?.run?.riserHeight ?? design.riserHeight;
    const treads = subTypes?.run?.treads ?? design.treads;
    const tread = subTypes?.run?.treadDepth ?? design.treadDepth;
    const lines = [
        `Run: ${risers} risers × ${(riser / IN).toFixed(2)} in, ${treads} treads × ${((tread || 0) / IN).toFixed(2)} in, ${(design.width / IN).toFixed(1)} in wide`,
        `Landings: ${subTypes?.landing?.top?.enabled ? 'top ' + subTypes.landing.top.depth.toFixed(2) + ' m' : 'top off'} · ${subTypes?.landing?.bottom?.enabled ? 'bottom ' + subTypes.landing.bottom.depth.toFixed(2) + ' m' : 'bottom off'} · ${subTypes?.landing?.intermediate?.length || 0} intermediate`,
        `Levels: base ${subTypes?.levels?.base?.finish?.toFixed(2)} m → top ${subTypes?.levels?.top?.finish?.toFixed(2)} m`,
        `Support: ${subTypes?.support?.label} ×${subTypes?.support?.qty}`
    ];
    assembly.issues.forEach((issue) => {
        lines.push(`${issue.severity === 'error' ? '✖' : issue.severity === 'warning' ? '⚠' : 'ℹ'} ${issue.message}`);
    });
    return lines;
}

/**
 * Reverse of the assembly: the option bar's flat control model.
 * Values are metres, degrees and enums, so bind straight to inputs.
 */
export function assemblyControls(assembly) {
    if (!assembly) return null;
    const { design, subTypes } = assembly;
    return {
        system: assembly.system,
        type: design.type,
        code: design.code,
        riserHeight: design.riserHeight,
        treadDepth: design.treadDepth,
        runWidth: design.width,
        availableRun: design.availableRun,
        availableWidth: design.availableWidth,
        turnDegrees: Math.round((design.sweep || 0) * 180 / Math.PI) || 90,
        baseElevation: subTypes.levels.base.elevation,
        baseOffset: subTypes.levels.base.offset,
        topOffset: subTypes.levels.top.offset,
        topLanding: Boolean(subTypes.landing.top.enabled),
        topLandingDepth: subTypes.landing.top.depth,
        bottomLanding: Boolean(subTypes.landing.bottom.enabled),
        bottomLandingDepth: subTypes.landing.bottom.depth,
        nosing: subTypes.run.nosings,
        material: subTypes.run.materials,
        support: subTypes.support.key
    };
}

/** Apply one option-bar control and rebuild. */
export function applyControl(input = {}, key, value) {
    const next = { ...input };
    const numeric = ['riserHeight', 'treadDepth', 'runWidth', 'width', 'availableRun', 'availableWidth', 'turnDegrees', 'baseElevation', 'baseOffset', 'topOffset'];
    const landingKeys = ['topLanding', 'topLandingDepth', 'bottomLanding', 'bottomLandingDepth'];

    if (key === 'runWidth' || key === 'width') next.width = Number(value);
    else if (key === 'topLandingDepth') next.landings = { ...(next.landings || {}), top: { ...(next.landings?.top || {}), depth: Number(value) } };
    else if (key === 'bottomLandingDepth') next.landings = { ...(next.landings || {}), bottom: { ...(next.landings?.bottom || {}), depth: Number(value) } };
    else if (key === 'topLanding') next.landings = { ...(next.landings || {}), top: { ...(next.landings?.top || {}), enabled: Boolean(value) } };
    else if (key === 'bottomLanding') next.landings = { ...(next.landings || {}), bottom: { ...(next.landings?.bottom || {}), enabled: Boolean(value) } };
    else if (numeric.includes(key)) next[key] = Number(value);
    else next[key] = value;

    if (landingKeys.includes(key) && value === undefined) return next;
    return next;
}

/** Defaults for the option bar at a given storey height. */
export function defaultAssemblyInput({ system = 'deck', storeyHeight = WALL_HEIGHT } = {}) {
    return {
        system,
        storeyHeight,
        width: system === 'egress' || system === 'apartment' ? 44 * IN : 36 * IN,
        type: 'straight'
    };
}
