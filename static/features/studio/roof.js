import { PIXELS_PER_METER, ROOF_OVERHANG } from '../../core/world-space.js';
import { TRUSS_SPACING_M, TRUSS_MEMBER_M, JOIST_DEPTH_M } from './construction.js';
import {
    roofStyle,
    roofGeometry,
    trussMembers,
    eaveSegments,
    ridgeSegments,
    hipSegments
} from '../roof/styles.js';
import { coveringById } from '../roof/materials.js';
import { createInstancedBoxes } from './instancing.js';

/**
 * Top-storey roof (studio feature 41).
 *
 * The last storey gets an 8 in ceiling/joist band, then a truss package and the
 * roof layers on top. The plan footprint supplies span and length; the style,
 * pitch, covering and gutter come from the roof suite, so the editor previews
 * the same geometry the designer prices.
 *
 * Layers built here: sheathing deck, covering, ridge and hip caps, ridge vent,
 * fascia, drip edge, gutter runs and downspouts.
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function footprint(walls = [], view = { width: 1, height: 1 }) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    (walls || []).forEach((wall) => {
        [wall.start, wall.end].forEach((point) => {
            if (!point) return;
            const x = (point.x - view.width / 2) / PIXELS_PER_METER;
            const z = (point.y - view.height / 2) / PIXELS_PER_METER;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        });
    });
    if (!Number.isFinite(minX)) return null;
    return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}

function box(THREE, w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/** A box stretched between two 3D points, used for ridge and hip caps. */
function beam(THREE, from, to, width, depth, material) {
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(length, 0.02), depth, width), material);
    const direction = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
    mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

const COVERING_COLOURS = {
    shingle: { color: 0x4a4a4f, roughness: 0.94, metalness: 0.02 },
    metal: { color: 0x9aa3a8, roughness: 0.32, metalness: 0.72 },
    tile: { color: 0xa4553a, roughness: 0.86, metalness: 0.03 },
    'low-slope': { color: 0x2f3437, roughness: 0.8, metalness: 0.05 }
};

const GUTTER_COLOURS = {
    Aluminium: 0xd3d8dc,
    'Painted steel': 0x6f7a82,
    Copper: 0xb87333
};

function trussMesh(THREE, members, material) {
    const group = new THREE.Group();
    members.forEach((member) => {
        const dx = member.x2 - member.x1;
        const dy = member.y2 - member.y1;
        const length = Math.hypot(dx, dy);
        if (length < 0.05) return;
        const mesh = box(THREE, length, TRUSS_MEMBER_M.depth, TRUSS_MEMBER_M.width, material);
        mesh.position.set((member.x1 + member.x2) / 2, (member.y1 + member.y2) / 2, 0);
        mesh.rotation.z = Math.atan2(dy, dx);
        mesh.name = {
            king: 'truss-king-post',
            web: 'truss-web',
            'chord-bottom': 'truss-bottom-chord',
            'chord-top': 'truss-top-chord',
            tie: 'truss-tie'
        }[member.kind] || 'truss-member';
        group.add(mesh);
    });
    group.name = 'roof-truss';
    return group;
}

/** Quad mesh for one roof plane, plus a deck copy set below it. */
function planeMeshes(THREE, plane, deckMaterial, coveringMaterial) {
    const group = new THREE.Group();
    const positions = [];
    const normal = new THREE.Vector3();
    const points = plane.points;
    // Normal from the first three corners, which defines the plane's up side.
    const a = new THREE.Vector3(points[0].x, points[0].y, points[0].z);
    const b = new THREE.Vector3(points[1].x, points[1].y, points[1].z);
    const c = new THREE.Vector3(points[2].x, points[2].y, points[2].z);
    normal.copy(b).sub(a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (normal.y < 0) normal.negate();

    const offset = 0.035;
    for (let i = 1; i < points.length - 1; i += 1) {
        [points[0], points[i], points[i + 1]].forEach((point) => {
            positions.push(point.x, point.y, point.z);
        });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    const deckGeometry = geometry.clone();
    const deck = new THREE.Mesh(deckGeometry, deckMaterial);
    deck.position.set(-normal.x * offset, -normal.y * offset, -normal.z * offset);
    deck.name = 'roof-deck';
    deck.receiveShadow = true;

    const covering = new THREE.Mesh(geometry, coveringMaterial);
    covering.name = 'roof-plane';
    covering.castShadow = true;
    covering.receiveShadow = true;

    group.add(deck, covering);
    return group;
}

/**
 * Build the top storey roof group, placed at the wall top. The group owns the
 * 8 in joist band, the ceiling joists, the trusses, the layered roof planes and
 * the rain-gutter package.
 */
export function buildTrussRoof(THREE, {
    walls = [],
    view = { width: 1, height: 1 },
    overhang = ROOF_OVERHANG,
    spacing = TRUSS_SPACING_M,
    joistDepth = JOIST_DEPTH_M,
    style = 'gable-king',
    pitch = null,
    covering = 'asphalt-arch',
    gutter = 'k5-alum',
    gutters = true,
    ridgeVent = true
} = {}) {
    const group = new THREE.Group();
    group.name = 'truss-roof';
    group.userData = { type: 'truss-roof' };
    const plan = footprint(walls, view);
    if (!plan || plan.width < 0.3 || plan.depth < 0.3) return group;

    const ridgeAlongX = plan.width >= plan.depth;
    const span = ridgeAlongX ? plan.depth : plan.width;
    const length = ridgeAlongX ? plan.width : plan.depth;
    const centre = { x: (plan.minX + plan.maxX) / 2, z: (plan.minZ + plan.maxZ) / 2 };
    const definition = roofStyle(style);

    // No explicit pitch keeps the old auto-rise behaviour (cap 2.4 m).
    let pitchValue = Number(pitch);
    if (!Number.isFinite(pitchValue) || pitchValue <= 0) {
        const targetRise = clamp(span * 0.34, 0.7, 2.4);
        pitchValue = definition.family === 'shed' ? (targetRise * 12) / span : (targetRise * 12) / (span / 2);
    }
    pitchValue = clamp(pitchValue, 0.5, 18);

    const geometry = roofGeometry({
        style: definition.key,
        span,
        length,
        pitch: pitchValue,
        overhang
    });
    const members = trussMembers(definition.key, geometry);
    const coveringSpec = coveringById(covering);

    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x8f6b45, roughness: 0.85 });
    const trussMaterial = new THREE.MeshStandardMaterial({ color: 0xb0895e, roughness: 0.8 });
    const joistMaterial = new THREE.MeshStandardMaterial({ color: 0xa37b52, roughness: 0.85 });
    const deckMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a978, roughness: 0.95, side: THREE.DoubleSide });
    const finish = COVERING_COLOURS[coveringSpec.family] || COVERING_COLOURS.shingle;
    const coveringMaterial = new THREE.MeshStandardMaterial({ ...finish, side: THREE.DoubleSide });
    const capMaterial = new THREE.MeshStandardMaterial({ ...finish, roughness: Math.min(finish.roughness + 0.05, 1) });
    const gutterMaterial = new THREE.MeshStandardMaterial({
        color: GUTTER_COLOURS[gutterSpecMaterial(gutter)] || GUTTER_COLOURS.Aluminium,
        roughness: 0.45,
        metalness: 0.55
    });
    const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.8 });

    // 8 in joist/ceiling band around the shell. The lengths differ, so the
    // shared unit box is scaled per instance and the whole rim is one draw call.
    const rimBoxes = [];
    walls.forEach((wall) => {
        if (!wall?.start || !wall?.end) return;
        const x1 = (wall.start.x - view.width / 2) / PIXELS_PER_METER;
        const z1 = (wall.start.y - view.height / 2) / PIXELS_PER_METER;
        const x2 = (wall.end.x - view.width / 2) / PIXELS_PER_METER;
        const z2 = (wall.end.y - view.height / 2) / PIXELS_PER_METER;
        const wallLength = Math.hypot(x2 - x1, z2 - z1);
        if (wallLength < 0.05) return;
        rimBoxes.push({
            x: (x1 + x2) / 2,
            y: joistDepth / 2,
            z: (z1 + z2) / 2,
            width: wallLength,
            height: joistDepth,
            depth: 0.05,
            rotationY: -Math.atan2(z2 - z1, x2 - x1)
        });
    });
    const rimMesh = createInstancedBoxes(rimBoxes, {
        material: rimMaterial,
        name: 'roof-joist-bands'
    });
    if (rimMesh) group.add(rimMesh);

    // Everything above the joist space is generated in the roof's local frame
    // (x across the span, z along the ridge) and then turned onto the plan.
    const local = new THREE.Group();
    local.position.set(centre.x, 0, centre.z);
    if (ridgeAlongX) local.rotation.y = Math.PI / 2;
    local.name = 'roof-frame';

    const count = Math.max(2, Math.ceil(length / spacing) + 1);
    const ceilingBoxes = [];
    let joists = 0;
    for (let i = 0; i < count; i += 1) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const along = -length / 2 + t * length;

        ceilingBoxes.push({
            x: 0,
            y: joistDepth / 2,
            z: along,
            width: span,
            height: 0.038,
            depth: 0.14
        });
        joists += 1;

        const frame = trussMesh(THREE, members, trussMaterial);
        frame.position.set(0, joistDepth, along);
        local.add(frame);
    }

    const ceilingJoists = createInstancedBoxes(ceilingBoxes, {
        material: joistMaterial,
        name: 'roof-ceiling-joists'
    });
    if (ceilingJoists) local.add(ceilingJoists);

    geometry.planes.forEach((plane) => {
        const meshes = planeMeshes(THREE, plane, deckMaterial, coveringMaterial);
        meshes.position.y = joistDepth;
        local.add(meshes);
    });

    // Ridge cap, plus hip caps where the style has hips.
    ridgeSegments(geometry).forEach((segment) => {
        const from = { x: segment.x1, y: (segment.y ?? geometry.rise) + 0.04 + joistDepth, z: segment.z1 };
        const to = { x: segment.x2 ?? segment.x1, y: (segment.y2 ?? segment.y ?? geometry.rise) + 0.04 + joistDepth, z: segment.z2 };
        const cap = beam(THREE, from, to, 0.3, 0.06, capMaterial);
        cap.name = 'roof-ridge-cap';
        local.add(cap);
        if (ridgeVent) {
            const vent = beam(THREE, { ...from, y: from.y + 0.04 }, { ...to, y: to.y + 0.04 }, 0.2, 0.03, ventMaterial);
            vent.name = 'roof-ridge-vent';
            local.add(vent);
        }
    });
    hipSegments(geometry).forEach((segment) => {
        const cap = beam(
            THREE,
            { x: segment.x1, y: geometry.rise + 0.04 + joistDepth, z: segment.z1 },
            { x: segment.x2, y: (segment.y2 ?? 0) + joistDepth, z: segment.z2 },
            0.3, 0.06, capMaterial
        );
        cap.name = 'roof-hip-cap';
        local.add(cap);
    });

    // Fascia, drip edge and the gutter runs.
    const runs = eaveSegments(geometry);
    runs.forEach((run) => {
        const dx = run.x2 - run.x1;
        const dz = run.z2 - run.z1;
        const runLength = Math.hypot(dx, dz);
        if (runLength < 0.1) return;
        const mid = { x: (run.x1 + run.x2) / 2, z: (run.z1 + run.z2) / 2 };
        const nx = dz / runLength;
        const nz = -dx / runLength;
        const outward = nx * mid.x + nz * mid.z >= 0 ? 1 : -1;
        const rotation = -Math.atan2(dz, dx);

        const fascia = box(THREE, runLength, 0.18, 0.04, rimMaterial);
        fascia.position.set(mid.x, run.y + joistDepth - 0.09, mid.z);
        fascia.rotation.y = rotation;
        fascia.name = 'roof-fascia';
        local.add(fascia);

        const drip = box(THREE, runLength, 0.09, 0.03, gutterMaterial);
        drip.position.set(mid.x + nx * outward * 0.02, run.y + joistDepth + 0.02, mid.z + nz * outward * 0.02);
        drip.rotation.y = rotation;
        drip.name = 'roof-drip-edge';
        local.add(drip);

        if (!gutters) return;
        const trough = box(THREE, runLength, 0.1, 0.13, gutterMaterial);
        trough.position.set(mid.x + nx * outward * 0.08, run.y + joistDepth - 0.12, mid.z + nz * outward * 0.08);
        trough.rotation.y = rotation;
        trough.name = 'roof-gutter';
        local.add(trough);

        // One downspout at the run's end, two on a long run.
        const ends = runLength > 10 ? [0.15, 0.85] : [0.85];
        ends.forEach((fraction) => {
            const x = run.x1 + dx * fraction + nx * outward * 0.1;
            const z = run.z1 + dz * fraction + nz * outward * 0.1;
            const pipe = new THREE.Mesh(
                new THREE.CylinderGeometry(0.045, 0.045, 2.2, 8),
                gutterMaterial
            );
            pipe.position.set(x, run.y + joistDepth - 1.2, z);
            pipe.castShadow = true;
            pipe.name = 'roof-downspout';
            local.add(pipe);
        });
    });

    group.add(local);

    group.userData = {
        type: 'truss-roof',
        style: definition.key,
        styleName: definition.name,
        trusses: count,
        joists,
        span,
        length,
        rise: geometry.rise,
        pitch: geometry.pitch,
        roofArea: geometry.roofArea,
        squares: geometry.roofArea / 9.2903,
        covering: coveringSpec.id,
        coveringFamily: coveringSpec.family,
        gutter: gutters ? gutter : null,
        gutterRuns: runs.length
    };
    return group;
}

function gutterSpecMaterial(id) {
    const system = { 'k5-alum': 'Aluminium', 'k6-alum': 'Aluminium', 'half-round-5': 'Aluminium', 'box-4': 'Painted steel', 'copper-k6': 'Copper' };
    return system[id] || 'Aluminium';
}

/** Roof takeoff for the editor panel: area, squares and the chosen layers. */
export function roofTakeoff(roof) {
    if (!roof?.userData) return null;
    const data = roof.userData;
    return {
        style: data.styleName || data.style,
        pitch: data.pitch,
        area: data.roofArea,
        squares: data.squares,
        trusses: data.trusses,
        covering: data.covering,
        gutterRuns: data.gutterRuns
    };
}
