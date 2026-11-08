import * as THREE from 'three';
import { PIXELS_PER_METER, WALL_THICKNESS } from '../../core/world-space.js';
import { deckOutline } from './engine.js';
import { sectionProps } from './materials.js';

/**
 * Deck scene geometry.
 *
 * The deck designer works in a local plan (x along the house, y out from it).
 * This module places that plan against the outer face of the editor's house and
 * builds the physical deck: rim, joists, beams, posts, footings, guard, stairs
 * and the walking surface. The editor's 3D engine owns disposal, so every mesh
 * here is plain three.js.
 */

const IN = 0.0254;
const round = (value, digits = 3) => Math.round((Number(value) || 0) * 10 ** digits) / 10 ** digits;

function worldBounds(walls = [], view = { width: 1, height: 1 }) {
    const points = [];
    (walls || []).forEach((wall) => {
        if (wall?.start) points.push(wall.start);
        if (wall?.end) points.push(wall.end);
    });
    if (!points.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    points.forEach((point) => {
        const x = (point.x - view.width / 2) / PIXELS_PER_METER;
        const z = (point.y - view.height / 2) / PIXELS_PER_METER;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
    });
    return { minX, maxX, minZ, maxZ };
}

/**
 * Where the local deck origin sits in world metres. A ledger deck starts on the
 * outer face of the house's +z wall; a freestanding deck leaves a gap. With no
 * house at all the deck is centred at the origin so it is still visible.
 */
export function deckPlacement(design, walls = [], view = { width: 1, height: 1 }, elevation = 0) {
    const config = design?.config || {};
    const width = Math.max(Number(config.width) || 6, 1);
    const depth = Math.max(Number(config.depth) || 4.2, 1);
    const house = worldBounds(walls, view);
    const attached = (config.ledger || 'house') === 'house';

    if (!house) {
        return { x: -width / 2, y: elevation, z: -depth / 2, width, depth, attached, house: null };
    }

    return {
        x: (house.minX + house.maxX) / 2 - width / 2,
        y: elevation,
        z: house.maxZ + (attached ? WALL_THICKNESS / 2 + 0.02 : 0.6),
        width,
        depth,
        attached,
        house
    };
}

export function outlineIntervalsAtX(outline = [], x = 0) {
    const crossings = [];
    outline.forEach((point, index) => {
        const next = outline[(index + 1) % outline.length];
        if ((point.x <= x && next.x > x) || (next.x <= x && point.x > x)) {
            const t = (x - point.x) / (next.x - point.x);
            crossings.push(point.y + t * (next.y - point.y));
        }
    });
    crossings.sort((a, b) => a - b);
    const intervals = [];
    for (let index = 0; index + 1 < crossings.length; index += 2) {
        intervals.push([crossings[index], crossings[index + 1]]);
    }
    return intervals;
}

function material(color, options = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.82,
        metalness: options.metalness ?? 0.04,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1
    });
}

function box(group, {
    width, height, depth, x = 0, y = 0, z = 0, rotation = 0, rotationX = 0,
    color, material: custom, cast = true
}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), custom || material(color));
    mesh.position.set(x, y, z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = rotation;
    mesh.rotation.x = rotationX;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
}

function addFooting(group, x, z, diameterIn) {
    const radius = Math.max(0.12, (Number(diameterIn) || 12) * IN / 2);
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 1.06, 0.28, 16),
        material(0xb9b6ae, { roughness: 0.95 })
    );
    mesh.position.set(x, 0.14, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
}

/**
 * Build one deck group in world metres. Returns null when there is no design.
 */
export function buildDeckSceneGroup(design, { walls = [], view = { width: 1, height: 1 }, elevation = 0 } = {}) {
    if (!design?.config) return null;
    const config = design.config;
    const outline = design.outline?.length ? design.outline : deckOutline(config);
    if (!outline.length) return null;

    const placement = deckPlacement(design, walls, view, elevation);
    const group = new THREE.Group();
    group.name = 'deck';
    group.userData = {
        type: 'deck',
        areaM2: design.areas?.deckM2 || 0,
        shape: config.shape || 'rectangle',
        height: config.height,
        posts: design.post?.count || 0
    };
    group.position.set(placement.x, placement.y, placement.z);

    const deckY = Math.max(Number(config.height) || 0.9, 0.15);
    const boardThickness = 0.032;
    const joistProps = sectionProps(config.joistSize || '2x10') || { b: 1.5, d: 9.25 };
    const beamProps = sectionProps(config.beamSize || '2x10') || { b: 1.5, d: 9.25 };
    const joistWidth = joistProps.b * IN;
    const joistDepth = joistProps.d * IN;
    const beamWidth = beamProps.b * IN * Math.max(1, Number(config.beamPlies) || 1);
    const beamDepth = beamProps.d * IN;
    const postSize = 0.14;
    const wood = 0x9a6f45;
    const framing = 0x7a5939;
    const railColor = config.guard === 'none' ? wood : 0x8b6542;

    // Walking surface, following the outline. A ShapeGeometry is flat, so it
    // is laid into the x/z plane; the rim below gives it visible thickness.
    const shape = new THREE.Shape();
    outline.forEach((point, index) => {
        if (index === 0) shape.moveTo(point.x, point.y);
        else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    const surfaceGeometry = new THREE.ShapeGeometry(shape);
    surfaceGeometry.rotateX(Math.PI / 2);
    const surfaceMaterial = material(config.decking?.product?.color || 0xb08968, { roughness: 0.9 });
    // The shape is laid down with its normal pointing down; render both faces
    // so the deck reads as a surface from the orbit camera.
    surfaceMaterial.side = THREE.DoubleSide;
    const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    surface.position.y = deckY;
    surface.receiveShadow = true;
    surface.castShadow = true;
    group.add(surface);

    const edgeMaterial = material(framing);
    outline.forEach((point, index) => {
        const next = outline[(index + 1) % outline.length];
        const length = Math.hypot(next.x - point.x, next.y - point.y);
        if (length < 0.02) return;
        box(group, {
            width: length,
            height: 0.18,
            depth: 0.05,
            x: (point.x + next.x) / 2,
            y: deckY - 0.1,
            z: (point.y + next.y) / 2,
            rotation: -Math.atan2(next.y - point.y, next.x - point.x),
            material: edgeMaterial
        });
    });

    // Joists run out from the house and are clipped by the polygon at each x.
    const spacing = Math.max(0.3, (Number(config.joistSpacingIn) || 16) * IN);
    const joistY = deckY - boardThickness - joistDepth / 2;
    for (let x = 0.06; x < placement.width - 0.02; x += spacing) {
        const intervals = outlineIntervalsAtX(outline, x);
        intervals.forEach(([start, end]) => {
            const length = end - start;
            if (length < 0.05) return;
            box(group, {
                width: joistWidth,
                height: joistDepth,
                depth: length,
                x,
                y: joistY,
                z: (start + end) / 2,
                material: material(framing)
            });
        });
    }

    const beamY = joistY - joistDepth / 2 - beamDepth / 2;
    const beamLines = design.beam?.lines?.length
        ? design.beam.lines
        : [{ label: 'Front beam', length: placement.width, y: placement.depth }];
    const postSpacing = Math.max(0.6, Number(config.postSpacingM) || 1.8);

    beamLines.forEach((line) => {
        const isRing = /ring/i.test(line.label || '');
        if (isRing) {
            // A ring beam follows the outline; its segments are already the rim.
            return;
        }
        const length = Math.max(0.2, Math.min(Number(line.length) || placement.width, placement.width));
        box(group, {
            width: length,
            height: beamDepth,
            depth: beamWidth,
            x: length / 2,
            y: beamY,
            z: line.y,
            material: material(framing)
        });

        const count = Math.max(2, Math.ceil(length / postSpacing) + 1);
        for (let index = 0; index < count; index += 1) {
            const x = length * (index / (count - 1));
            const postHeight = Math.max(0.1, beamY - beamDepth / 2);
            box(group, {
                width: postSize,
                height: postHeight,
                depth: postSize,
                x,
                y: postHeight / 2,
                z: line.y,
                material: material(0x6f4e30)
            });
            addFooting(group, x, line.y, design.footing?.diameterIn || config.footingDiameterIn);
        }
    });

    // Guarding. The house edge is omitted for a ledger deck; the stair opening
    // is cut out of the front rail so the steps are usable.
    const guardHeight = Math.max(0.76, (Number(config.guardHeightIn) || 36) * IN);
    const stairWidth = Math.max(0.6, Number(config.stairWidthM) || 0.9144);
    const stairs = Boolean(config.stairs);
    const stairStart = Math.max(0.3, placement.width - stairWidth - 0.25);
    const stairEnd = stairStart + stairWidth;

    const addGuardRun = (x1, z1, x2, z2) => {
        const length = Math.hypot(x2 - x1, z2 - z1);
        if (length < 0.25) return;
        const angle = -Math.atan2(z2 - z1, x2 - x1);
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;
        box(group, { width: length, height: 0.055, depth: 0.09, x: cx, y: deckY + guardHeight - 0.03, z: cz, rotation: angle, material: material(railColor) });
        box(group, { width: length, height: 0.04, depth: 0.05, x: cx, y: deckY + 0.11, z: cz, rotation: angle, material: material(railColor) });

        const posts = Math.max(2, Math.ceil(length / 1.8) + 1);
        for (let index = 0; index < posts; index += 1) {
            const t = index / (posts - 1);
            box(group, {
                width: 0.09,
                height: guardHeight,
                depth: 0.09,
                x: x1 + (x2 - x1) * t,
                y: deckY + guardHeight / 2,
                z: z1 + (z2 - z1) * t,
                material: material(railColor)
            });
        }

        // Vertical infill at 100 mm centres; enough to read as a guard without
        // adding a mesh per inch.
        const balusters = Math.floor(length / 0.11);
        for (let index = 1; index < balusters; index += 1) {
            const t = index / balusters;
            box(group, {
                width: 0.018,
                height: guardHeight - 0.18,
                depth: 0.018,
                x: x1 + (x2 - x1) * t,
                y: deckY + guardHeight / 2,
                z: z1 + (z2 - z1) * t,
                material: material(railColor)
            });
        }
    };

    if (config.guard !== 'none' && guardHeight > 0) {
        outline.forEach((point, index) => {
            const next = outline[(index + 1) % outline.length];
            const isHouseEdge = placement.attached
                && Math.abs(point.y) < 1e-6 && Math.abs(next.y) < 1e-6;
            if (isHouseEdge) return;
            const isFrontEdge = Math.abs(point.y - placement.depth) < 1e-6
                && Math.abs(next.y - placement.depth) < 1e-6;
            if (config.stairs && isFrontEdge && stairEnd > Math.min(point.x, next.x) && stairStart < Math.max(point.x, next.x)) {
                addGuardRun(point.x, point.y, Math.min(stairStart, next.x), next.y);
                addGuardRun(Math.max(stairEnd, point.x), point.y, next.x, next.y);
            } else {
                addGuardRun(point.x, point.y, next.x, next.y);
            }
        });
    }

    // Stairs descend from the front edge at the right-hand end of the deck.
    if (stairs && design.stair?.risers > 0) {
        const risers = Math.max(2, design.stair.risers);
        const rise = deckY / risers;
        const treads = Math.max(1, design.stair.treads || risers - 1);
        for (let index = 0; index < treads; index += 1) {
            const top = deckY - (index + 1) * rise;
            box(group, {
                width: stairWidth,
                height: 0.04,
                depth: 0.28,
                x: stairStart + stairWidth / 2,
                y: Math.max(0.05, top - 0.02),
                z: placement.depth + 0.16 + index * 0.26,
                material: material(config.decking?.product?.color || 0xb08968)
            });
        }
        [-stairWidth / 2 + 0.035, stairWidth / 2 - 0.035].forEach((offset) => {
            box(group, {
                width: 0.045,
                height: 0.24,
                depth: Math.hypot(deckY, treads * 0.26),
                x: stairStart + stairWidth / 2 + offset,
                y: deckY / 2 + 0.12,
                z: placement.depth + 0.12 + (treads * 0.26) / 2,
                rotationX: Math.atan2(deckY, treads * 0.26),
                material: material(framing)
            });
        });
    }

    // A simple pergola cover, matching the designer's post-and-rafter option.
    if (config.cover === 'pergola') {
        const postHeight = 2.35;
        const inset = 0.18;
        [[inset, inset], [placement.width - inset, inset], [inset, placement.depth - inset], [placement.width - inset, placement.depth - inset]]
            .forEach(([x, z]) => {
                box(group, { width: 0.14, height: postHeight, depth: 0.14, x, y: deckY + postHeight / 2, z, material: material(0x6f4e30) });
            });
        box(group, { width: placement.width - 0.2, height: 0.12, depth: 0.14, x: placement.width / 2, y: deckY + postHeight, z: inset, material: material(framing) });
        box(group, { width: placement.width - 0.2, height: 0.12, depth: 0.14, x: placement.width / 2, y: deckY + postHeight, z: placement.depth - inset, material: material(framing) });
        const rafters = Math.max(3, Math.round(placement.width / 0.61));
        for (let index = 0; index < rafters; index += 1) {
            const x = inset + (placement.width - inset * 2) * (index / (rafters - 1));
            box(group, { width: 0.14, height: 0.16, depth: placement.depth - 0.24, x, y: deckY + postHeight + 0.16, z: placement.depth / 2, material: material(framing) });
        }
    }

    // Keep the plan bounds in the user data for camera framing and checks.
    group.userData.outline = outline.map((point) => ({ x: round(point.x), z: round(point.y) }));
    return group;
}
