import * as THREE from 'three';
import { PIXELS_PER_METER, WALL_THICKNESS } from '../../core/world-space.js';

/**
 * Electrical service panel geometry.
 *
 * The designer has no plan placement, so the panel is mounted on the outer face
 * of the editor house's right-most wall. That is the side the default 3D camera
 * sees from +x/+z, and it is a plausible service location beside the utility
 * entry. With no walls the panel stands at the origin.
 */

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

/** Mount pose for the panel in world metres. */
export function electricalPanelPlacement(design, walls = [], view = { width: 1, height: 1 }, elevation = 0) {
    const panel = {
        width: 0.42,
        height: 0.95,
        depth: 0.15,
        mount: 1.05
    };
    const house = worldBounds(walls, view);
    if (!house) {
        return {
            x: 1.6,
            y: elevation + panel.mount + panel.height / 2,
            z: 0,
            rotation: Math.PI / 2,
            normal: { x: 1, z: 0 },
            panel,
            wall: null
        };
    }

    // Right-most wall, falling back to the longest wall if all midpoints tie.
    const center = { x: (house.minX + house.maxX) / 2, z: (house.minZ + house.maxZ) / 2 };
    const candidates = (walls || [])
        .filter((wall) => wall?.start && wall?.end)
        .map((wall) => {
            const ax = (wall.start.x - view.width / 2) / PIXELS_PER_METER;
            const az = (wall.start.y - view.height / 2) / PIXELS_PER_METER;
            const bx = (wall.end.x - view.width / 2) / PIXELS_PER_METER;
            const bz = (wall.end.y - view.height / 2) / PIXELS_PER_METER;
            const length = Math.hypot(bx - ax, bz - az);
            return { wall, ax, az, bx, bz, length, midX: (ax + bx) / 2, midZ: (az + bz) / 2 };
        })
        .filter((entry) => entry.length > 0.3)
        .sort((a, b) => (b.midX - a.midX) || (b.length - a.length));

    const chosen = candidates[0];
    if (!chosen) {
        return { x: 1.6, y: elevation + panel.mount + panel.height / 2, z: 0, rotation: Math.PI / 2, normal: { x: 1, z: 0 }, panel, wall: null };
    }

    const dx = chosen.bx - chosen.ax;
    const dz = chosen.bz - chosen.az;
    const length = chosen.length || 1;
    let normal = { x: -dz / length, z: dx / length };
    const away = { x: chosen.midX - center.x, z: chosen.midZ - center.z };
    if (normal.x * away.x + normal.z * away.z < 0) normal = { x: -normal.x, z: -normal.z };
    if (Math.abs(normal.x) + Math.abs(normal.z) < 1e-3) normal = { x: 1, z: 0 };

    const offset = WALL_THICKNESS / 2 + panel.depth / 2 + 0.025;
    return {
        x: chosen.midX + normal.x * offset,
        y: elevation + panel.mount + panel.height / 2,
        z: chosen.midZ + normal.z * offset,
        rotation: Math.atan2(normal.x, normal.z),
        normal,
        panel,
        wall: { id: chosen.wall.id, x: chosen.midX, z: chosen.midZ }
    };
}

function box(group, {
    width, height, depth, x = 0, y = 0, z = 0,
    color, material, roughness = 0.55, metalness = 0.45
}) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        material || new THREE.MeshStandardMaterial({ color, roughness, metalness })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
}

/**
 * Build the panel, its breaker faces and the service raceway. The group origin
 * is the panel centre; `rotation` makes local +z the outward face.
 */
export function buildElectricalPanelGroup(design, { walls = [], view = { width: 1, height: 1 }, elevation = 0 } = {}) {
    if (!design?.config) return null;
    const placement = electricalPanelPlacement(design, walls, view, elevation);
    const { width, height, depth } = placement.panel;

    const group = new THREE.Group();
    group.name = 'electrical-panel';
    group.position.set(placement.x, placement.y, placement.z);
    group.rotation.y = placement.rotation;
    group.userData = {
        type: 'electrical-panel',
        label: design.panel?.label || 'Electrical panel',
        serviceAmps: design.serviceAmps,
        circuits: design.circuits?.length || 0,
        spaces: design.spaces?.used || 0
    };

    const enclosure = new THREE.MeshStandardMaterial({ color: 0x9ca8b4, roughness: 0.42, metalness: 0.72 });
    const door = new THREE.MeshStandardMaterial({ color: 0xb5c0c9, roughness: 0.36, metalness: 0.68 });
    const recess = new THREE.MeshStandardMaterial({ color: 0x18232e, roughness: 0.7, metalness: 0.2 });
    const breaker = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.6, metalness: 0.15 });

    box(group, { width, height, depth, color: 0x8d99a6, material: enclosure });
    // Door sits proud of the enclosure, with a small handle and label strip.
    box(group, { width: width - 0.035, height: height - 0.055, depth: 0.012, x: 0, y: 0, z: depth / 2 + 0.007, color: 0xb5c0c9, material: door });
    box(group, { width: 0.035, height: 0.12, depth: 0.02, x: width / 2 - 0.06, y: -0.08, z: depth / 2 + 0.022, color: 0x6b7682, material: enclosure });

    // Recessed breaker window behind the door: two columns of handles.
    box(group, { width: width * 0.64, height: height * 0.48, depth: 0.008, x: -width * 0.08, y: 0.1, z: depth / 2 + 0.015, color: 0x18232e, material: recess });
    const rows = Math.max(4, Math.min(12, Math.ceil((design.spaces?.used || design.circuits?.length || 8) / 2)));
    const handleWidth = width * 0.22;
    const handleHeight = Math.min(0.035, (height * 0.42) / rows * 0.55);
    for (let index = 0; index < rows; index += 1) {
        const y = 0.1 + (height * 0.4) / 2 - (index + 0.5) * ((height * 0.4) / rows);
        [-1, 1].forEach((side) => {
            box(group, {
                width: handleWidth,
                height: handleHeight,
                depth: 0.018,
                x: -width * 0.08 + side * handleWidth * 0.62,
                y,
                z: depth / 2 + 0.025,
                color: 0x111820,
                material: breaker
            });
        });
    }
    // Main breaker and directory label.
    box(group, { width: width * 0.26, height: 0.055, depth: 0.022, x: -width * 0.08, y: height * 0.37, z: depth / 2 + 0.028, color: 0x1f2937, material: breaker });
    box(group, { width: width * 0.48, height: 0.075, depth: 0.01, x: -width * 0.08, y: -height * 0.33, z: depth / 2 + 0.018, color: 0xf3f4f6, material: new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.8, metalness: 0.05 }) });

    // Service raceway down the wall and a small meter socket beside the panel.
    const raceway = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, Math.max(0.2, placement.y - height / 2), 10),
        new THREE.MeshStandardMaterial({ color: 0x7f8a95, roughness: 0.5, metalness: 0.65 })
    );
    raceway.position.set(-width / 2 - 0.05, -placement.y / 2 - height / 4, depth / 2);
    raceway.castShadow = true;
    group.add(raceway);

    const meter = box(group, {
        width: 0.26, height: 0.36, depth: 0.11,
        x: width / 2 + 0.18, y: -0.05, z: depth / 2,
        color: 0xa9b4bf, material: enclosure
    });
    meter.name = 'meter-socket';
    box(group, { width: 0.16, height: 0.16, depth: 0.014, x: width / 2 + 0.18, y: 0.02, z: depth / 2 + 0.06, color: 0x334155, material: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.4 }) });

    group.userData.size = { width, height, depth };
    group.userData.placement = { x: round(placement.x), y: round(placement.y), z: round(placement.z), rotation: round(placement.rotation) };
    return group;
}
