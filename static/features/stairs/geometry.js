import * as THREE from 'three';
import { PIXELS_PER_METER } from '../../core/world-space.js';
import { stairDesignForItem } from './design.js';
import { buildStairAssembly } from './assembly.js';
import { getOutdoorSystem } from './outdoor.js';
import { getStairModel, stairModelDesignForItem } from './models.js';

/**
 * Stair geometry.
 *
 * The run is built in stair-local metres; the assembly adds the top and bottom
 * landings (automatic unless the assembly disables them), the outdoor footings
 * and guard, and the support type. The returned root group sits at y = 0 on the
 * lower floor with its footprint centred on the item origin, so the engine can
 * place it like any other fixture.
 */

const TREAD_THICKNESS = 0.045;
const RISER_THICKNESS = 0.028;
const RAIL_HEIGHT = 0.9;
const POST_RADIUS = 0.018;

// Tread finishes a model can ask for. The colour is the model's material, not
// the item tint, so a steel spiral never reads as oak.
const TREAD_FINISHES = {
    wood: { color: 0x8b5a2b, roughness: 0.65, metalness: 0.05 },
    steel: { color: 0x64748b, roughness: 0.4, metalness: 0.75 },
    aluminium: { color: 0xb6bfc9, roughness: 0.35, metalness: 0.9 },
    grate: { color: 0x4b5563, roughness: 0.55, metalness: 0.7 },
    concrete: { color: 0xcbd5e1, roughness: 0.95, metalness: 0 },
    composite: { color: 0x6b7280, roughness: 0.8, metalness: 0 }
};

function materials(color = 0x8b5a2b, model = null) {
    const finish = TREAD_FINISHES[model?.treadMaterial] || { color, roughness: 0.65, metalness: 0.05 };
    return {
        tread: new THREE.MeshStandardMaterial({ ...finish }),
        riser: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.8 }),
        stringer: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.4 }),
        rail: new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.35, metalness: 0.75 }),
        column: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 }),
        concrete: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.95 }),
        footing: new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.95 }),
        warning: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
    };
}

function mesh(geometry, material, { cast = true } = {}) {
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = cast;
    object.receiveShadow = true;
    return object;
}

function addRail(group, points, mat) {
    if (points.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(points);
    const rail = mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), 0.025, 6, false), mat);
    group.add(rail);
}

function addPost(group, x, y, z, mat, height = RAIL_HEIGHT) {
    const post = mesh(new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, height, 6), mat);
    post.position.set(x, y + height / 2, z);
    group.add(post);
}

function sectorShape(inner, outer, a0, a1, clockwise) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, a0, a1, clockwise);
    shape.absarc(0, 0, inner, a1, a0, !clockwise);
    shape.closePath();
    return shape;
}

function sectorTread(inner, outer, a0, a1, top, clockwise, treadMaterial) {
    const shape = sectorShape(inner, outer, a0, a1, clockwise);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: TREAD_THICKNESS, bevelEnabled: false, curveSegments: 10 });
    // Shape XY -> world XZ; extrusion depth becomes thickness below the top.
    geometry.rotateX(Math.PI / 2);
    const tread = mesh(geometry, treadMaterial);
    tread.position.y = top;
    return tread;
}

function straightStair(design, mats, options = {}) {
    const group = new THREE.Group();
    const { width, rise, risers, treadDepth, runUsed } = design;
    // `rise` is the whole storey; each step climbs one riser.
    const stepRise = design.riserHeight;
    const run = runUsed;
    const railHeight = options.railHeight ?? RAIL_HEIGHT;
    const openRisers = Boolean(options.openRisers);

    for (let i = 0; i < risers - 1; i++) {
        const top = (i + 1) * stepRise;
        const z = -run / 2 + (i + 0.5) * treadDepth;
        const tread = mesh(new THREE.BoxGeometry(width, TREAD_THICKNESS, treadDepth + 0.02), mats.tread);
        tread.position.set(0, top - TREAD_THICKNESS / 2, z);
        group.add(tread);

        if (!openRisers) {
            const riser = mesh(new THREE.BoxGeometry(width, stepRise, RISER_THICKNESS), mats.riser);
            riser.position.set(0, top - stepRise / 2, z - treadDepth / 2 + 0.01);
            group.add(riser);
        }
    }

    // Sloped stringers on both sides.
    const length = Math.hypot(run, rise);
    [-1, 1].forEach((side) => {
        const stringer = mesh(new THREE.BoxGeometry(0.06, 0.26, length), mats.stringer);
        stringer.position.set(side * (width / 2 + 0.03), rise / 2 + 0.02, 0);
        stringer.rotation.x = -Math.atan2(rise, run);
        group.add(stringer);

        const railPoints = [];
        for (let i = 0; i < risers - 1; i += 2) {
            const z = -run / 2 + (i + 0.5) * treadDepth;
            const top = (i + 1) * stepRise;
            addPost(group, side * (width / 2 - 0.04), top, z, mats.rail, railHeight);
        }
        for (let i = 0; i < risers - 1; i++) {
            const z = -run / 2 + (i + 0.5) * treadDepth;
            railPoints.push(new THREE.Vector3(side * (width / 2 - 0.04), (i + 1) * stepRise + railHeight, z));
        }
        addRail(group, railPoints, mats.rail);
    });

    return group;
}

/**
 * Floating mono stringer: one plate on edge, treads cantilevered both sides.
 */
function monoStringerStair(design, mats, options = {}) {
    const group = new THREE.Group();
    const { width, rise, risers, treadDepth, runUsed: run } = design;
    const stepRise = design.riserHeight;
    const railHeight = options.railHeight ?? RAIL_HEIGHT;
    const length = Math.hypot(run, rise);

    const spine = mesh(new THREE.BoxGeometry(0.012, 0.3, length), mats.stringer);
    spine.position.set(0, rise / 2 + 0.01, 0);
    spine.rotation.x = -Math.atan2(rise, run);
    spine.name = 'mono-stringer';
    group.add(spine);

    for (let i = 0; i < risers - 1; i++) {
        const top = (i + 1) * stepRise;
        const z = -run / 2 + (i + 0.5) * treadDepth;
        const tread = mesh(new THREE.BoxGeometry(width, TREAD_THICKNESS, treadDepth + 0.02), mats.tread);
        tread.position.set(0, top - TREAD_THICKNESS / 2, z);
        group.add(tread);
    }

    [-1, 1].forEach((side) => {
        const railPoints = [];
        for (let i = 0; i < risers - 1; i++) {
            const z = -run / 2 + (i + 0.5) * treadDepth;
            const top = (i + 1) * stepRise;
            if (i % 2 === 0) addPost(group, side * (width / 2 - 0.04), top, z, mats.rail, railHeight);
            railPoints.push(new THREE.Vector3(side * (width / 2 - 0.04), top + railHeight, z));
        }
        addRail(group, railPoints, mats.rail);
        // Hairline cables between the posts.
        if (options.cable) {
            for (let level = 1; level <= 3; level++) {
                const cable = railPoints.map((point) => new THREE.Vector3(point.x, point.y - level * 0.22, point.z));
                addRail(group, cable, mats.stringer);
            }
        }
    });

    return group;
}

/**
 * Alternating tread device: a half tread either side of a centre stringer on
 * every riser, handrails both sides.
 */
function alternatingTreadStair(design, mats, options = {}) {
    const group = new THREE.Group();
    const { width, rise, risers, treadDepth, runUsed: run } = design;
    const stepRise = design.riserHeight;
    const railHeight = options.railHeight ?? RAIL_HEIGHT;
    const length = Math.hypot(run, rise);

    const spine = mesh(new THREE.BoxGeometry(0.05, 0.26, length), mats.stringer);
    spine.position.set(0, rise / 2, 0);
    spine.rotation.x = -Math.atan2(rise, run);
    group.add(spine);

    const half = width / 2 - 0.03;
    for (let i = 0; i < risers - 1; i++) {
        const top = (i + 1) * stepRise;
        const z = -run / 2 + (i + 0.5) * treadDepth;
        const side = i % 2 === 0 ? -1 : 1;
        const tread = mesh(new THREE.BoxGeometry(half, TREAD_THICKNESS, treadDepth + 0.02), mats.tread);
        tread.position.set(side * (width / 4), top - TREAD_THICKNESS / 2, z);
        tread.name = `alt-tread-${i + 1}`;
        group.add(tread);
    }

    [-1, 1].forEach((side) => {
        const railPoints = [];
        for (let i = 0; i < risers - 1; i++) {
            const z = -run / 2 + (i + 0.5) * treadDepth;
            const top = (i + 1) * stepRise;
            if (i % 2 === 0) addPost(group, side * (width / 2 - 0.03), top, z, mats.rail, railHeight);
            railPoints.push(new THREE.Vector3(side * (width / 2 - 0.03), top + railHeight, z));
        }
        addRail(group, railPoints, mats.rail);
    });

    return group;
}

/** Ships ladder: two channels, 5 in treads and grab rails above the landing. */
function shipsLadder(design, mats, options = {}) {
    const group = new THREE.Group();
    const { width, rise, risers, treadDepth, runUsed: run } = design;
    const stepRise = design.riserHeight;
    const railHeight = options.railHeight ?? 42 * 0.0254;
    const length = Math.hypot(run, rise);
    const pitch = -Math.atan2(rise, run);

    [-1, 1].forEach((side) => {
        const stringer = mesh(new THREE.BoxGeometry(0.075, 0.2, length), mats.stringer);
        stringer.position.set(side * (width / 2 + 0.04), rise / 2, 0);
        stringer.rotation.x = pitch;
        group.add(stringer);

        // Grab rail carried above the top landing, hand over hand.
        const grab = mesh(new THREE.CylinderGeometry(0.02, 0.02, railHeight, 8), mats.rail);
        grab.position.set(side * (width / 2 - 0.04), rise + 0.35, run / 2 - 0.1);
        group.add(grab);
    });

    for (let i = 0; i < risers - 1; i++) {
        const top = (i + 1) * stepRise;
        const z = -run / 2 + (i + 0.5) * treadDepth;
        const tread = mesh(new THREE.BoxGeometry(width, TREAD_THICKNESS, treadDepth), mats.tread);
        tread.position.set(0, top - TREAD_THICKNESS / 2, z);
        tread.name = `ladder-tread-${i + 1}`;
        group.add(tread);
    }

    return group;
}

/**
 * In-line crossover: up flight, mid platform, second flight. The platform is
 * where the conveyor or pipe run passes between the two flights.
 */
function crossoverStair(design, mats, options = {}) {
    const group = new THREE.Group();
    const { width, rise, risers, treadDepth } = design;
    const stepRise = design.riserHeight;
    const railHeight = options.railHeight ?? 42 * 0.0254;
    const mid = Math.max(2, Math.round(risers / 2));
    const platformDepth = Math.max(0.9, width);
    const upTreads = mid - 1;
    const downTreads = risers - mid - 1;
    const runUp = upTreads * treadDepth;
    const runDown = downTreads * treadDepth;
    const total = runUp + platformDepth + runDown;
    const startZ = -total / 2;

    const treadAt = (z, top) => {
        const tread = mesh(new THREE.BoxGeometry(width, TREAD_THICKNESS, treadDepth + 0.02), mats.tread);
        tread.position.set(0, top - TREAD_THICKNESS / 2, z);
        group.add(tread);
    };

    for (let i = 0; i < upTreads; i++) {
        treadAt(startZ + (i + 0.5) * treadDepth, (i + 1) * stepRise);
    }
    const platformZ = startZ + runUp + platformDepth / 2;
    const platform = mesh(new THREE.BoxGeometry(width + 0.08, TREAD_THICKNESS, platformDepth), mats.tread);
    platform.position.set(0, mid * stepRise - TREAD_THICKNESS / 2, platformZ);
    platform.name = 'crossover-platform';
    group.add(platform);

    const guardZ = [platformZ - platformDepth / 2, platformZ + platformDepth / 2];
    [-1, 1].forEach((side) => {
        guardZ.forEach((z) => addPost(group, side * (width / 2), mid * stepRise, z, mats.rail, railHeight));
        addRail(group, guardZ.map((z) => new THREE.Vector3(side * (width / 2), mid * stepRise + railHeight, z)), mats.rail);
    });

    for (let i = 0; i < downTreads; i++) {
        treadAt(startZ + runUp + platformDepth + (i + 0.5) * treadDepth, (mid + i + 1) * stepRise);
    }

    const length = Math.hypot(total, rise);
    [-1, 1].forEach((side) => {
        const stringer = mesh(new THREE.BoxGeometry(0.07, 0.24, length), mats.stringer);
        stringer.position.set(side * (width / 2 + 0.03), rise / 2, 0);
        stringer.rotation.x = -Math.atan2(rise, total);
        group.add(stringer);
    });

    return group;
}

/**
 * Disappearing stair, drawn stowed: ceiling opening, folded flight on the
 * panel and the pull rod hanging into the room below.
 */
function foldingStair(design, mats) {
    const group = new THREE.Group();
    const { width, rise, risers, treadDepth } = design;
    const stepRise = design.riserHeight;
    const depth = Math.max(1.2, treadDepth * Math.min(risers, 6));
    const y = rise - 0.06;

    const frameMaterial = mats.stringer;
    [[-width / 2, 0], [width / 2, 0]].forEach(([x]) => {
        const bar = mesh(new THREE.BoxGeometry(0.05, 0.12, depth + 0.12), frameMaterial);
        bar.position.set(x, y, 0);
        group.add(bar);
    });
    [-(depth + 0.12) / 2, (depth + 0.12) / 2].forEach((z) => {
        const bar = mesh(new THREE.BoxGeometry(width + 0.1, 0.12, 0.05), frameMaterial);
        bar.position.set(0, y, z);
        group.add(bar);
    });

    // Folded panel and tread stack, stowed against the ceiling.
    const panel = mesh(new THREE.BoxGeometry(width - 0.06, 0.04, depth), mats.tread);
    panel.position.set(0, y - 0.1, 0);
    panel.name = 'disappearing-panel';
    group.add(panel);

    const folded = Math.min(risers - 1, 7);
    for (let i = 0; i < folded; i++) {
        const tread = mesh(new THREE.BoxGeometry(width - 0.1, 0.025, 0.09), mats.tread);
        tread.position.set(0, y - 0.14 - i * 0.035, -depth / 2 + 0.1 + i * 0.055);
        tread.name = `folded-tread-${i + 1}`;
        group.add(tread);
    }

    const rod = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 8), mats.rail);
    rod.position.set(0, y - 0.72, depth / 2 - 0.1);
    group.add(rod);

    return group;
}

function curvedStair(design, mats) {
    const group = new THREE.Group();
    const { innerRadius, outerRadius, walklineRadius, startAngle, sweep, direction, treads, rise } = design;
    const stepRise = design.riserHeight;

    for (let i = 0; i < treads; i++) {
        const a0 = startAngle + direction * sweep * (i / treads);
        const a1 = startAngle + direction * sweep * ((i + 1) / treads);
        const top = (i + 1) * stepRise;
        group.add(sectorTread(innerRadius, outerRadius, a0, a1, top, direction < 0, mats.tread));

        // Landing edge is the top of the flight; the floor above closes it.
        if (i % 2 === 0) {
            const angle = (a0 + a1) / 2;
            addPost(group, outerRadius * Math.cos(angle), top, outerRadius * Math.sin(angle), mats.rail);
        }
    }

    const railPoints = [];
    for (let i = 0; i <= treads; i++) {
        const angle = startAngle + direction * sweep * (i / treads);
        railPoints.push(new THREE.Vector3(
            (outerRadius - 0.03) * Math.cos(angle),
            Math.min(i + 1, treads) * stepRise + RAIL_HEIGHT,
            (outerRadius - 0.03) * Math.sin(angle)
        ));
    }
    addRail(group, railPoints, mats.rail);

    // Newel at the bottom and a slim stringer band under the walkline.
    addPost(group, walklineRadius * Math.cos(startAngle), 0, walklineRadius * Math.sin(startAngle), mats.rail, RAIL_HEIGHT + 0.15);
    return group;
}

function spiralStair(design, mats) {
    const group = new THREE.Group();
    const { columnRadius, outerRadius, startAngle, sweep, treads, rise } = design;
    const stepRise = design.riserHeight;

    const column = mesh(new THREE.CylinderGeometry(columnRadius, columnRadius, rise, 16), mats.column);
    column.position.y = rise / 2;
    group.add(column);

    for (let i = 0; i < treads; i++) {
        const a0 = startAngle + sweep * (i / treads);
        const a1 = startAngle + sweep * ((i + 1) / treads);
        const top = (i + 1) * stepRise;
        group.add(sectorTread(columnRadius, outerRadius, a0, a1, top, false, mats.tread));
        if (i % 2 === 0) {
            const angle = (a0 + a1) / 2;
            addPost(group, (outerRadius - 0.03) * Math.cos(angle), top, (outerRadius - 0.03) * Math.sin(angle), mats.rail);
        }
    }

    const railPoints = [];
    for (let i = 0; i <= treads * 2; i++) {
        const s = i / (treads * 2);
        const angle = startAngle + sweep * s;
        railPoints.push(new THREE.Vector3(
            (outerRadius - 0.03) * Math.cos(angle),
            s * rise + RAIL_HEIGHT,
            (outerRadius - 0.03) * Math.sin(angle)
        ));
    }
    addRail(group, railPoints, mats.rail);
    return group;
}

function firePole(design, mats) {
    const group = new THREE.Group();
    const { rise, pole } = design;
    const radius = pole.diameter / 2;
    const top = rise + pole.aboveFloor;

    const shaft = mesh(new THREE.CylinderGeometry(radius, radius, top + 0.05, 20), mats.column);
    shaft.position.y = top / 2;
    shaft.name = 'fire-pole-shaft';
    group.add(shaft);

    const flange = mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.02, 24), mats.column);
    flange.position.y = 0.01;
    group.add(flange);

    // Escutcheon at the upper floor and the anti-skid landing mat.
    const ring = mesh(new THREE.TorusGeometry(pole.opening / 2, 0.025, 8, 32), mats.stringer);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = rise;
    group.add(ring);

    if (pole.landingMat) {
        const mat = mesh(new THREE.RingGeometry(radius + 0.01, pole.mat / 2, 32), mats.warning, { cast: false });
        mat.rotation.x = -Math.PI / 2;
        mat.position.y = rise + 0.012;
        group.add(mat);
    }

    if (pole.guard) {
        const guardRadius = pole.opening / 2 + 0.06;
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
            addPost(group, guardRadius * Math.cos(angle), rise, guardRadius * Math.sin(angle), mats.rail, pole.guardHeight);
        }
        const guard = mesh(new THREE.TorusGeometry(guardRadius, 0.022, 6, 30), mats.rail);
        guard.rotation.x = Math.PI / 2;
        guard.position.y = rise + pole.guardHeight;
        group.add(guard);
    }

    // Warning sign above the opening.
    const sign = mesh(new THREE.BoxGeometry(0.22, 0.16, 0.015), mats.warning);
    sign.position.set(0, rise + 1.35, -0.32);
    group.add(sign);

    return group;
}

/** Depth of a landing stone/tread platform. */
const LANDING_THICKNESS = 0.06;

/**
 * Add a landing platform at the entry or exit of the run.
 * `end` is 1 for the top landing, 0 for the bottom one.
 */
function addLanding(group, design, assembly, end, mats) {
    const landing = end === 1 ? assembly.subTypes.landing.top : assembly.subTypes.landing.bottom;
    if (!landing?.enabled || !design.path) return;
    const t = end;
    const width = landing.width || design.width;
    const depth = landing.depth;
    if (!(depth > 0)) return;

    const point = design.path.pointAt(t);
    const tangent = design.path.tangentAt(t);
    const direction = end === 1 ? 1 : -1;
    const height = end === 1 ? design.rise : 0;
    const platform = mesh(
        new THREE.BoxGeometry(width, LANDING_THICKNESS, depth),
        assembly.structure === 'concrete' ? mats.concrete : mats.tread
    );
    platform.position.set(
        point.x + tangent.x * direction * (depth / 2 + landing.offset),
        height + LANDING_THICKNESS / 2,
        point.z + tangent.z * direction * (depth / 2 + landing.offset)
    );
    platform.rotation.y = -Math.atan2(tangent.x, tangent.z);
    platform.name = end === 1 ? 'top-landing' : 'bottom-landing';
    platform.userData = { landing: end === 1 ? 'top' : 'bottom', depth, width };
    group.add(platform);

    // Guard posts at the free corners of the landing.
    if (assembly.design?.guard?.required !== false) {
        const sideX = -tangent.z;
        const sideZ = tangent.x;
        [-1, 1].forEach((side) => {
            const x = platform.position.x + (sideX * side * width) / 2;
            const z = platform.position.z + (sideZ * side * width) / 2;
            addPost(group, x, height, z, mats.rail, 1.0);
        });
    }
}

/** Outdoor structure: piers under the stringers and posts at the landing. */
function addOutdoorStructure(group, design, assembly, mats) {
    if (!assembly?.system) return;
    const spec = getOutdoorSystem(assembly.system);
    if (!spec || spec.structure === 'concrete' || !spec.footingDepth) return;
    const depth = spec.footingDepth;
    const width = design.width;
    const run = design.runUsed || 0;
    [-1, 1].forEach((side) => {
        [0, 1].forEach((end) => {
            const z = end ? run / 2 : -run / 2;
            const footing = mesh(new THREE.CylinderGeometry(0.15, 0.15, depth, 14), mats.footing, { cast: false });
            footing.position.set(side * width / 2, -depth / 2, z);
            footing.name = 'pier-footing';
            group.add(footing);
        });
    });
}

/** Resolve the design an item is drawn from (model checks included). */
export function stairDesignForItemOrModel(item, storeyHeight) {
    return stairModelDesignForItem(item, storeyHeight) || stairDesignForItem(item, storeyHeight);
}

/** Which builder a design/model pair uses. */
function stairGeometryKey(design, model) {
    return model?.geometry || (
        design.type === 'spiral' ? 'spiral'
            : design.type === 'fire-pole' ? 'fire-pole'
                : design.type === 'curve-right' || design.type === 'curve-left' ? 'curve'
                    : 'straight'
    );
}

/** The four-part assembly (run, landings, levels, support) for an item. */
export function stairAssemblyForItem(item, design) {
    return buildStairAssembly({
        design,
        system: item?.stair?.system || null,
        structure: item?.stair?.structure,
        support: item?.stair?.support,
        material: item?.stair?.material,
        nosing: item?.stair?.nosing,
        baseElevation: 0,
        landings: item?.stair?.landings,
        nosingEnabled: item?.stair?.nosingEnabled
    });
}

/**
 * Plan extents (stair-local metres) the stair actually occupies.
 *
 * The run footprint is symmetrical about the item origin, but the automatic top
 * and bottom landings extend past its ends by different depths, so the drawn
 * plan symbol, the selection box and the 3D have to agree on one rectangle.
 * Only the builders that draw landings (the straight and pan families) add
 * them; mono, curve, spiral, crossover and folded stairs keep the run footprint.
 */
export function stairPlanBounds(item, { storeyHeight, design = null } = {}) {
    const resolved = design || stairDesignForItemOrModel(item, storeyHeight);
    const model = getStairModel(item?.stair?.model) || getStairModel(item?.metadata?.stair?.model);
    const geometryKey = stairGeometryKey(resolved, model);
    const halfWidth = resolved.footprint.width / 2;
    const bounds = {
        minX: -halfWidth,
        maxX: halfWidth,
        minZ: -resolved.footprint.depth / 2,
        maxZ: resolved.footprint.depth / 2,
        landings: [],
        design: resolved
    };

    if (geometryKey !== 'straight' && geometryKey !== 'pan') {
        return finalisePlanBounds(bounds);
    }

    const assembly = stairAssemblyForItem(item, resolved);
    const ends = [['top', 1], ['bottom', -1]];
    ends.forEach(([end, sign]) => {
        const landing = end === 'top' ? assembly.subTypes.landing.top : assembly.subTypes.landing.bottom;
        if (!landing?.enabled || !(landing.depth > 0)) return;
        const s = sign === 1 ? 1 : 0;
        const point = resolved.path.pointAt(s);
        const tangent = resolved.path.tangentAt(s);
        const reach = landing.depth / 2 + landing.offset;
        const cx = point.x + tangent.x * sign * reach;
        const cz = point.z + tangent.z * sign * reach;
        const halfDepth = landing.depth / 2;
        const halfLanding = landing.width / 2;
        const rect = {
            end,
            minX: cx - halfLanding,
            maxX: cx + halfLanding,
            minZ: cz - halfDepth,
            maxZ: cz + halfDepth,
            width: landing.width,
            depth: landing.depth
        };
        bounds.landings.push(rect);
        bounds.minX = Math.min(bounds.minX, rect.minX);
        bounds.maxX = Math.max(bounds.maxX, rect.maxX);
        bounds.minZ = Math.min(bounds.minZ, rect.minZ);
        bounds.maxZ = Math.max(bounds.maxZ, rect.maxZ);
    });

    return finalisePlanBounds(bounds);
}

function finalisePlanBounds(bounds) {
    bounds.width = bounds.maxX - bounds.minX;
    bounds.depth = bounds.maxZ - bounds.minZ;
    bounds.centreX = (bounds.minX + bounds.maxX) / 2;
    bounds.centreZ = (bounds.minZ + bounds.maxZ) / 2;
    return bounds;
}

/**
 * True when a stair-local metre point is inside the drawn plan footprint.
 * Used for picking so the automatic landings can be clicked like the run.
 */
export function stairPlanContains(item, local, { storeyHeight, slack = 0, design = null } = {}) {
    const bounds = stairPlanBounds(item, { storeyHeight, design });
    return local.x >= bounds.minX - slack && local.x <= bounds.maxX + slack
        && local.z >= bounds.minZ - slack && local.z <= bounds.maxZ + slack;
}

/**
 * Set an item's size from the plan footprint it is drawn with, so the floor
 * opening, takeoff and picking all agree with the 3D build (landings included).
 */
export function sizeStairItem(item, storeyHeight) {
    if (!item) return null;
    const design = stairDesignForItemOrModel(item, storeyHeight);
    const bounds = stairPlanBounds(item, { storeyHeight, design });
    item.size = {
        width: Math.max(0.4, bounds.width),
        depth: Math.max(0.4, bounds.depth),
        height: Math.max(0.6, design.rise)
    };
    return bounds;
}

/**
 * Build the 3D stair/pole for an item. Returns a Group at local y = 0 (the lower
 * floor), footprint centred on the item origin.
 */
export function buildStairGeometry(item, { storeyHeight, color = 0x8b5a2b, design = null } = {}) {
    // Model items carry the family checks (slope, family width, egress limits)
    // on the same design object the geometry is drawn from.
    const resolved = design || stairDesignForItemOrModel(item, storeyHeight);
    const assembly = stairAssemblyForItem(item, resolved);
    const model = getStairModel(item?.stair?.model) || getStairModel(item?.metadata?.stair?.model);
    const mats = materials(color, model);
    const options = {
        railHeight: model?.guardHeight || RAIL_HEIGHT,
        openRisers: model ? model.openRisers : false,
        cable: model?.geometry === 'mono'
    };
    const geometryKey = stairGeometryKey(resolved, model);
    let inner;

    switch (geometryKey) {
        case 'fire-pole':
            inner = firePole(resolved, mats);
            break;
        case 'spiral':
            inner = spiralStair(resolved, mats);
            break;
        case 'mono-arc': {
            inner = curvedStair(resolved, mats);
            // Curved spine under the walkline: the mono stringer that carries
            // the winders instead of the usual two side channels.
            const spine = [];
            for (let i = 0; i <= 12; i++) {
                const s = i / 12;
                const angle = resolved.startAngle + resolved.direction * resolved.sweep * s;
                spine.push(new THREE.Vector3(
                    resolved.walklineRadius * Math.cos(angle),
                    s * resolved.rise - 0.12,
                    resolved.walklineRadius * Math.sin(angle)
                ));
            }
            addRail(inner, spine, mats.stringer);
            break;
        }
        case 'curve':
            inner = curvedStair(resolved, mats);
            break;
        case 'mono':
            inner = monoStringerStair(resolved, mats, options);
            break;
        case 'alternating':
            inner = alternatingTreadStair(resolved, mats, options);
            break;
        case 'ladder':
            inner = shipsLadder(resolved, mats, options);
            break;
        case 'crossover':
            inner = crossoverStair(resolved, mats, options);
            break;
        case 'fold':
            inner = foldingStair(resolved, mats, options);
            break;
        default:
            inner = straightStair(resolved, mats, options);
            addLanding(inner, resolved, assembly, 1, mats);
            addLanding(inner, resolved, assembly, 0, mats);
            addOutdoorStructure(inner, resolved, assembly, mats);
            break;
    }

    inner.position.set(-resolved.offset.x, 0, -resolved.offset.z);
    inner.userData = {
        type: 'stair',
        stairType: resolved.type,
        model: model?.key || null,
        geometryKey,
        design: resolved,
        assembly,
        walkable: resolved.type !== 'fire-pole' && geometryKey !== 'fold'
    };
    inner.name = model ? `stair-${model.key}` : `stair-${resolved.type}`;

    // The root group is free for the engine to position at the item centre.
    const root = new THREE.Group();
    root.add(inner);
    root.userData = { ...inner.userData };
    return root;
}

/**
 * 2D plan symbol for a stair item, drawn in canvas pixels at the item's plan
 * position and rotation. Shows the footprint, every tread and the up direction.
 */
export function drawStairPlan(ctx, item, { storeyHeight, scale = PIXELS_PER_METER, color = '#475569' } = {}) {
    const design = stairDesignForItem(item, storeyHeight);
    const bounds = stairPlanBounds(item, { storeyHeight, design });
    const px = (metres) => metres * scale;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation || 0);

    const isSelected = item.selected;
    ctx.strokeStyle = isSelected ? '#f59e0b' : color;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = isSelected ? 3 : 1;

    if (design.type === 'spiral') {
        ctx.beginPath();
        ctx.arc(0, 0, px(design.outerRadius), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, px(design.columnRadius), 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < design.treads; i++) {
            const a = design.startAngle + (i / design.treads) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * px(design.columnRadius), Math.sin(a) * px(design.columnRadius));
            ctx.lineTo(Math.cos(a) * px(design.outerRadius), Math.sin(a) * px(design.outerRadius));
            ctx.stroke();
        }
    } else if (design.type === 'curve-right' || design.type === 'curve-left') {
        const { innerRadius, outerRadius, startAngle, sweep, direction, treads } = design;
        ctx.beginPath();
        ctx.arc(-px(design.offset.x), -px(design.offset.z), px(outerRadius), startAngle, startAngle + direction * sweep, direction < 0);
        ctx.arc(-px(design.offset.x), -px(design.offset.z), px(innerRadius), startAngle + direction * sweep, startAngle, direction > 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i <= treads; i++) {
            const a = startAngle + direction * sweep * (i / treads);
            ctx.beginPath();
            ctx.moveTo(-px(design.offset.x) + Math.cos(a) * px(innerRadius), -px(design.offset.z) + Math.sin(a) * px(innerRadius));
            ctx.lineTo(-px(design.offset.x) + Math.cos(a) * px(outerRadius), -px(design.offset.z) + Math.sin(a) * px(outerRadius));
            ctx.stroke();
        }
    } else {
        const w = px(design.width);
        const run = px(design.runUsed || 0);
        const model = getStairModel(item?.stair?.model);
        ctx.beginPath();
        ctx.rect(-w / 2, -run / 2, w, run);
        ctx.fill();
        ctx.stroke();
        const tread = px(design.treadDepth || 0);
        ctx.beginPath();
        if (model?.geometry === 'alternating') {
            // Half treads alternate either side of the centre stringer.
            for (let i = 0; i <= (design.treads || 0); i++) {
                const z = -run / 2 + i * tread;
                if (i % 2 === 0) {
                    ctx.moveTo(-w / 2, z);
                    ctx.lineTo(0, z);
                } else {
                    ctx.moveTo(0, z);
                    ctx.lineTo(w / 2, z);
                }
            }
            ctx.moveTo(0, -run / 2);
            ctx.lineTo(0, run / 2);
        } else {
            for (let i = 1; i < (design.treads || 0); i++) {
                const z = -run / 2 + i * tread;
                ctx.moveTo(-w / 2, z);
                ctx.lineTo(w / 2, z);
            }
        }
        ctx.stroke();

        if (model?.geometry === 'fold') {
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(-w / 2 + px(0.05), -run / 2 + px(0.05), w - px(0.1), run - px(0.1));
            ctx.setLineDash([]);
        }

        // Automatic top and bottom landings, at the depth and offset the 3D
        // build uses, so the plan symbol and the selection box match the model.
        bounds.landings.forEach((landing) => {
            const lw = px(landing.maxX - landing.minX);
            const ld = px(landing.maxZ - landing.minZ);
            ctx.beginPath();
            ctx.rect(px(landing.minX), px(landing.minZ), lw, ld);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px(landing.minX), px(landing.maxZ));
            ctx.lineTo(px(landing.maxX), px(landing.maxZ));
            ctx.stroke();
        });
    }

    // Up arrow along the walkline.
    ctx.strokeStyle = isSelected ? '#b45309' : '#0f172a';
    ctx.beginPath();
    const arrowLength = px(0.5);
    ctx.moveTo(0, px(design.footprint.depth * 0.18));
    ctx.lineTo(0, px(design.footprint.depth * 0.18) - arrowLength);
    ctx.lineTo(-0.1 * scale / 3, px(design.footprint.depth * 0.18) - arrowLength + 0.1 * scale / 3);
    ctx.moveTo(0, px(design.footprint.depth * 0.18) - arrowLength);
    ctx.lineTo(0.1 * scale / 3, px(design.footprint.depth * 0.18) - arrowLength + 0.1 * scale / 3);
    ctx.stroke();

    if (design.type === 'fire-pole') {
        ctx.beginPath();
        ctx.arc(0, 0, px(design.pole.mat) / 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#dc2626';
        ctx.stroke();
    }

    ctx.restore();
    return design;
}

/** Flat plan footprint used by callers that only need size and shape. */
export function stairPlanOutline(item, storeyHeight) {
    const design = stairDesignForItem(item, storeyHeight);
    const bounds = stairPlanBounds(item, { storeyHeight, design });
    return {
        design,
        bounds,
        width: bounds.width,
        depth: bounds.depth,
        shape: design.footprint.shape
    };
}
