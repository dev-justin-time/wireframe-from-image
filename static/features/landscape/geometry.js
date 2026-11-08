import * as THREE from 'three';
import { toWireframe } from '../../engine/wireframe.js';
import { planOutline, waterDesignForItem } from './design.js';

/**
 * Landscape geometry.
 *
 * Pools and water features are drawn from their plan outline: a water surface at
 * the design level, a shell ring down to the floor, a coping band and a deck
 * surround. Every feature sits with y = 0 at the surrounding grade, which is
 * what the plan's floor plane means.
 */

const WATER_LEVEL = -0.06;
const COPING_WIDTH = 0.30;

const palette = {
    water: 0x38bdf8,
    shell: 0xf1f5f9,
    coping: 0xcbd5e1,
    deck: 0xe2e8f0,
    stone: 0x78716c,
    steel: 0x94a3b8,
    wall: 0x9ca3af,
    plant: 0x16a34a
};

function material(color, options = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.7,
        metalness: options.metalness ?? 0.05,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
        side: options.side ?? THREE.DoubleSide
    });
}

const MATS = {
    water: () => material(palette.water, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.72 }),
    shell: () => material(palette.shell, { roughness: 0.85 }),
    coping: () => material(palette.coping, { roughness: 0.8 }),
    deck: () => material(palette.deck, { roughness: 0.9 }),
    stone: () => material(palette.stone, { roughness: 0.95 }),
    steel: () => material(palette.steel, { roughness: 0.35, metalness: 0.8 }),
    wall: () => material(palette.wall, { roughness: 0.85 }),
    plant: () => material(palette.plant, { roughness: 0.9 })
};

function shapeFrom(points) {
    const shape = new THREE.Shape();
    points.forEach((point, index) => {
        if (index === 0) shape.moveTo(point.x, point.z);
        else shape.lineTo(point.x, point.z);
    });
    shape.closePath();
    return shape;
}

function offsetPoints(points, amount) {
    // Radial offset from the centroid: enough for irregular outlines and exact
    // for the rectangle/circle cases the kit uses.
    const center = points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, z: acc.z + point.z / points.length }), { x: 0, z: 0 });
    return points.map((point) => {
        const dx = point.x - center.x;
        const dz = point.z - center.z;
        const length = Math.hypot(dx, dz) || 1;
        return { x: point.x + (dx / length) * amount, z: point.z + (dz / length) * amount };
    });
}

function ring(inner, outer, y, mat) {
    const shape = shapeFrom(outer);
    statefulHole(shape, inner);
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, y, 0);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.receiveShadow = true;
    return mesh;
}

function statefulHole(shape, points) {
    const hole = new THREE.Path();
    points.forEach((point, index) => {
        if (index === 0) hole.moveTo(point.x, point.z);
        else hole.lineTo(point.x, point.z);
    });
    hole.closePath();
    shape.holes.push(hole);
    return shape;
}

function floorMesh(inner, y, mat) {
    const geometry = new THREE.ShapeGeometry(shapeFrom(inner));
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, y, 0);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.receiveShadow = true;
    return mesh;
}

function addWater(group, points, y, mat, name = 'water-surface') {
    const water = floorMesh(points, y, mat);
    water.name = name;
    water.userData.isWater = true;
    group.add(water);
    return water;
}

function addShell(group, points, depth, mat) {
    const outer = offsetPoints(points, 0.16);
    const wall = ring(points, outer, 0, mat);
    wall.name = 'pool-shell';
    group.add(wall);
    // Wall band down to the basin floor, as a thin extruded wall per segment.
    const floorY = WATER_LEVEL - depth;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length < 1e-4) continue;
        const geometry = new THREE.BoxGeometry(length, depth, 0.16);
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.set((a.x + b.x) / 2, floorY + depth / 2, (a.z + b.z) / 2);
        mesh.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        mesh.receiveShadow = true;
        group.add(mesh);
    }
    const floor = floorMesh(points, floorY, mat);
    floor.name = 'pool-floor';
    group.add(floor);
    return floorY;
}

function addCoping(group, points, mat) {
    const outer = offsetPoints(points, COPING_WIDTH);
    const coping = ring(points, outer, 0.015, mat);
    coping.name = 'coping';
    group.add(coping);
}

function addDeck(group, points, deckWidth, mat) {
    if (deckWidth <= 0) return;
    const inner = offsetPoints(points, COPING_WIDTH);
    const outer = offsetPoints(points, COPING_WIDTH + deckWidth);
    const deck = ring(inner, outer, 0.0, mat);
    deck.name = 'deck';
    group.add(deck);
}

function poolFeature(design) {
    const group = new THREE.Group();
    const points = planOutline(design.shape, design.width, design.length);
    const mats = MATS;
    addShell(group, points, Math.max(0.4, design.avgDepth), mats.shell());
    addWater(group, points, WATER_LEVEL, mats.water());
    addCoping(group, points, mats.coping());
    addDeck(group, points, design.deck, mats.deck());

    // Entry steps at the shallow end.
    const steps = 3;
    for (let i = 0; i < steps; i++) {
        const step = new THREE.Mesh(
            new THREE.BoxGeometry(design.width * 0.55, 0.18, 0.35),
            mats.shell()
        );
        step.position.set(0, WATER_LEVEL - 0.09 - i * 0.18, -design.length / 2 + 0.35 + i * 0.35);
        step.receiveShadow = true;
        group.add(step);
    }

    // Ladder rails at the deep end.
    const railMaterial = mats.steel();
    [-0.28, 0.28].forEach((side) => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 10), railMaterial);
        rail.position.set(side, 0.35, design.length / 2 - 0.25);
        group.add(rail);
    });
    const rungs = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.56, 10), railMaterial);
    rungs.rotation.z = Math.PI / 2;
    rungs.position.set(0, 0.1, design.length / 2 - 0.25);
    group.add(rungs);
    return group;
}

function spaFeature(design) {
    const group = new THREE.Group();
    const points = planOutline(design.shape === 'rectangle' ? 'roman' : design.shape, design.width, design.length);
    const rise = 0.45;

    // Raised shell: extruded ring up to the spa rim.
    const outer = offsetPoints(points, 0.22);
    const shape = shapeFrom(outer);
    statefulHole(shape, points);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: rise, bevelEnabled: false, curveSegments: 24 });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, rise, 0);
    const shell = new THREE.Mesh(geometry, MATS.shell());
    shell.name = 'spa-shell';
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    addWater(group, points, rise - 0.08, MATS.water());

    const copingOuter = offsetPoints(points, COPING_WIDTH);
    const coping = ring(points, copingOuter, rise + 0.01, MATS.coping());
    coping.name = 'spa-coping';
    group.add(coping);

    addDeck(group, points, design.deck, MATS.deck());

    // Jets around the rim.
    const jets = Math.max(2, design.jets || 4);
    for (let i = 0; i < jets; i++) {
        const angle = (i / jets) * Math.PI * 2;
        const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), MATS.steel());
        jet.position.set(
            Math.cos(angle) * design.width * 0.42,
            rise - 0.12,
            Math.sin(angle) * design.length * 0.42
        );
        group.add(jet);
    }
    return group;
}

function fountainFeature(design) {
    const group = new THREE.Group();
    const points = planOutline('circular', design.width, design.length);
    const basinDepth = Math.max(0.25, design.deep);
    addShell(group, points, basinDepth, MATS.stone());
    addWater(group, points, WATER_LEVEL, MATS.water());
    addCoping(group, points, MATS.coping());
    addDeck(group, points, design.deck, MATS.deck());

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.7, 16), MATS.stone());
    pedestal.position.y = 0.35;
    group.add(pedestal);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.42, 0.12, 24), MATS.stone());
    bowl.position.y = 0.76;
    group.add(bowl);

    const water = new THREE.Mesh(new THREE.CircleGeometry(0.58, 24), MATS.water());
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.83;
    group.add(water);

    // Jet: a thin column and a crown of droplets.
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, design.config?.head ? Math.min(2, design.config.head) : 1.0, 10), MATS.water());
    jet.position.y = 0.8 + jet.geometry.parameters.height / 2;
    jet.name = 'fountain-jet';
    group.add(jet);
    return group;
}

function pondFeature(design) {
    const group = new THREE.Group();
    const points = planOutline(design.shape, design.width, design.length, 40);
    addShell(group, points, Math.max(0.3, design.deep), MATS.stone());
    addWater(group, points, WATER_LEVEL, MATS.water());
    addCoping(group, points, MATS.stone());

    // Rock edging: one dodecahedron per outline vertex.
    const rockMaterial = MATS.stone();
    points.filter((_, index) => index % 2 === 0).forEach((point, index) => {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (index % 3) * 0.04, 0), rockMaterial);
        rock.position.set(point.x, 0.06, point.z);
        rock.rotation.set(index * 0.7, index * 1.1, index * 0.3);
        rock.castShadow = true;
        group.add(rock);
    });

    // Marginal planting shelf.
    const shelf = ring(offsetPoints(points, -0.05), offsetPoints(points, -0.45), -0.18, MATS.stone());
    shelf.name = 'planting-shelf';
    group.add(shelf);
    return group;
}

function waterfallFeature(design) {
    const group = new THREE.Group();
    const width = design.weirLength || design.width;
    const drop = design.drop;
    const basinDepth = Math.max(0.3, design.deep);

    // Catch basin.
    const basinPoints = planOutline('rectangle', width + 0.4, Math.max(1.0, design.length));
    addShell(group, basinPoints, basinDepth, MATS.stone());
    addWater(group, basinPoints, WATER_LEVEL, MATS.water());
    addCoping(group, basinPoints, MATS.stone());

    // Weir wall behind the basin with a spill lip.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, drop + 0.5, 0.32), MATS.wall());
    wall.position.set(0, (drop + 0.5) / 2 - 0.15, -design.length / 2 - 0.1);
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.name = 'weir-wall';
    group.add(wall);

    const lip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 0.1), MATS.coping());
    lip.position.set(0, drop, -design.length / 2 + 0.06);
    group.add(lip);

    // Falling sheet of water, slightly proud of the wall face.
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, drop), MATS.water());
    sheet.position.set(0, drop / 2 + WATER_LEVEL, -design.length / 2 + 0.06);
    sheet.name = 'water-sheet';
    group.add(sheet);

    return group;
}

function waterWallFeature(design) {
    const group = new THREE.Group();
    const width = design.weirLength || design.width;
    const height = Math.max(1.2, design.drop);
    const basinDepth = Math.max(0.2, design.deep);

    const basinPoints = planOutline('rectangle', width + 0.3, Math.max(0.5, design.length));
    addShell(group, basinPoints, basinDepth, MATS.stone());
    addWater(group, basinPoints, WATER_LEVEL, MATS.water());

    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.22), MATS.wall());
    wall.position.set(0, height / 2, -design.length / 2 - 0.05);
    wall.castShadow = true;
    wall.name = 'water-wall-panel';
    group.add(wall);

    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.04, height - 0.1), MATS.water());
    sheet.position.set(0, height / 2 - 0.05, -design.length / 2 + 0.075);
    sheet.name = 'water-sheet';
    group.add(sheet);

    // Top spout bar and a bottom collection lip.
    const spout = new THREE.Mesh(new THREE.BoxGeometry(width - 0.06, 0.05, 0.06), MATS.steel());
    spout.position.set(0, height - 0.04, -design.length / 2 + 0.11);
    group.add(spout);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(width - 0.02, 0.04, 0.12), MATS.coping());
    lip.position.set(0, 0.02, -design.length / 2 + 0.09);
    group.add(lip);

    // Basalt/stone cladding hint: three horizontal bands.
    for (let i = 1; i <= 3; i++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, 0.235), MATS.stone());
        band.position.set(0, (height / 4) * i, -design.length / 2 - 0.05);
        group.add(band);
    }
    return group;
}

/**
 * Build a placed water feature. y = 0 is the surrounding grade; the item's
 * width/depth are read from its metadata unless the config overrides them.
 */
export function buildWaterFeature(item, { design = null, color = null } = {}) {
    const resolved = design || waterDesignForItem(item);
    let group;
    if (resolved.type === 'spa') group = spaFeature(resolved);
    else if (resolved.type === 'fountain') group = fountainFeature(resolved);
    else if (resolved.type === 'pond') group = pondFeature(resolved);
    else if (resolved.type === 'waterfall') group = waterfallFeature(resolved);
    else if (resolved.type === 'water-wall') group = waterWallFeature(resolved);
    else group = poolFeature(resolved);

    if (color != null) {
        group.traverse((child) => {
            if (child.isMesh && !child.userData.isWater) {
                child.material = child.material.clone();
                child.material.color = new THREE.Color(color);
            }
        });
    }

    group.name = `landscape-${resolved.type}`;
    group.userData = {
        type: 'landscape',
        feature: resolved.type,
        design: resolved,
        gallons: resolved.gallons,
        water: true
    };
    return group;
}

/** The same feature as edges, for the wireframe previews. */
export function buildWaterFeatureWireframe(item, options = {}) {
    const solid = buildWaterFeature(item, options);
    if (!solid) return null;
    const wire = toWireframe(solid, { color: options.wireColor ?? 0x0369a1, thresholdAngle: 22 });
    solid.traverse((child) => {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
    });
    wire.userData = { ...solid.userData, wireframe: true };
    return wire;
}

/**
 * 2D plan symbol for a water feature, drawn in canvas pixels at the item's plan
 * position and rotation: deck, coping, water and the feature lift.
 */
export function drawWaterPlan(ctx, item, { design = null, scale = 30, color = '#38bdf8' } = {}) {
    const resolved = design || waterDesignForItem(item);
    const points = planOutline(resolved.shape, resolved.width, resolved.length);
    const px = (metres) => metres * scale;

    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation || 0);

    const trace = (list, expand = 0) => {
        ctx.beginPath();
        list.forEach((point, index) => {
            const length = Math.hypot(point.x, point.z) || 1;
            const x = px(point.x + (point.x / length) * expand);
            const z = px(point.z + (point.z / length) * expand);
            if (index === 0) ctx.moveTo(x, z);
            else ctx.lineTo(x, z);
        });
        ctx.closePath();
    };

    if (resolved.deck > 0) {
        trace(points, resolved.deck + 0.3);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    trace(points, 0.3);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.stroke();

    trace(points, 0);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.fill();
    ctx.strokeStyle = item.selected ? '#f59e0b' : '#0284c7';
    ctx.lineWidth = item.selected ? 3 : 1.5;
    ctx.stroke();

    // Depth band and a spray mark for moving water.
    if (resolved.type === 'fountain' || resolved.type === 'waterfall' || resolved.type === 'water-wall') {
        ctx.strokeStyle = '#0369a1';
        ctx.beginPath();
        ctx.arc(0, 0, px(Math.min(resolved.width, resolved.length) * 0.18), 0, Math.PI * 2);
        ctx.stroke();
    }
    if (resolved.type === 'pond') {
        ctx.setLineDash([3, 3]);
        trace(points, -0.25);
        ctx.strokeStyle = '#475569';
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(resolved.typeLabel, 0, 0);
    ctx.restore();
    return resolved;
}

/** Plan outline for the 2D canvas, in plan pixels around the item. */
export function waterPlanOutline(item, design) {
    const resolved = design || waterDesignForItem(item);
    return {
        design: resolved,
        points: planOutline(resolved.shape, resolved.width, resolved.length),
        deck: resolved.deck,
        coping: COPING_WIDTH
    };
}
