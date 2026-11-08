import { itemDimensions } from '../../core/items.js';

/**
 * Studio feature 44 - parametric cabinet configurator.
 *
 * A cabinet is a small parts model, not one box: sides, top, bottom, back,
 * shelves, doors and drawer fronts. The same model drives the 3D builder, the
 * inspector's door/drawer controls and the manufacturing export, so changing
 * "drawers: 3" updates all three.
 */

export const DOOR_STYLES = ['slab', 'shaker', 'glass', 'open'];
export const PANEL_THICKNESS = 0.018; // metres

export const DEFAULT_CABINET_CONFIG = {
    doorStyle: 'slab',
    doors: 2,
    drawers: 0,
    shelves: 2,
    toeKick: 0.1,
    counter: true
};

export function normalizeCabinetConfig(config = {}) {
    const style = DOOR_STYLES.includes(config.doorStyle) ? config.doorStyle : DEFAULT_CABINET_CONFIG.doorStyle;
    return {
        ...DEFAULT_CABINET_CONFIG,
        ...config,
        doorStyle: style,
        doors: Math.max(0, Math.min(4, Math.round(config.doors ?? DEFAULT_CABINET_CONFIG.doors))),
        drawers: Math.max(0, Math.min(4, Math.round(config.drawers ?? DEFAULT_CABINET_CONFIG.drawers))),
        shelves: Math.max(0, Math.min(6, Math.round(config.shelves ?? DEFAULT_CABINET_CONFIG.shelves)))
    };
}

export function cabinetConfigOf(item) {
    return normalizeCabinetConfig(item?.config || {});
}

export function setCabinetConfig(item, patch = {}) {
    if (!item) return null;
    item.config = normalizeCabinetConfig({ ...(item.config || {}), ...patch });
    return item.config;
}

/**
 * Parts in cabinet-local metres with the origin at the floor centre-left of the
 * footprint. `x/y/z` are part centres; `w/h/d` full sizes.
 */
export function cabinetParts({ width = 0.762, height = 0.9, depth = 0.6, config = {} } = {}) {
    const cfg = normalizeCabinetConfig(config);
    const t = PANEL_THICKNESS;
    const kick = cfg.toeKick;
    const bodyHeight = height - kick;
    const bodyY = kick + bodyHeight / 2;
    const innerWidth = width - t * 2;
    const innerHeight = bodyHeight - t * 2;

    const parts = [];
    const add = (id, label, w, h, d, x, y, z, role = 'carcass', material = 'panel') => {
        parts.push({ id, label, w, h, d, x, y, z, role, material });
    };

    // Carcass
    add('side-left', 'Left side', t, bodyHeight, depth, -width / 2 + t / 2, bodyY, 0);
    add('side-right', 'Right side', t, bodyHeight, depth, width / 2 - t / 2, bodyY, 0);
    add('bottom', 'Bottom', innerWidth, t, depth, 0, kick + t / 2, 0);
    add('top', 'Top', innerWidth, t, depth, 0, height - t / 2, 0);
    add('back', 'Back', innerWidth, innerHeight - t, t, 0, bodyY, -depth / 2 + t / 2);

    // Shelves, evenly spaced in the carcass.
    for (let i = 1; i <= cfg.shelves; i++) {
        const y = kick + t + ((innerHeight - t) * i) / (cfg.shelves + 1);
        add(`shelf-${i}`, `Shelf ${i}`, innerWidth, t, depth - t * 2, 0, y, 0, 'shelf');
    }

    const frontZ = depth / 2 + t / 2;
    const drawerHeight = cfg.drawers > 0 ? Math.min(0.22, bodyHeight * 0.18) : 0;
    const drawerZone = drawerHeight * cfg.drawers;
    const doorHeight = Math.max(0.1, bodyHeight - drawerZone - 0.02);
    const doorY = kick + 0.01 + doorHeight / 2;

    // Drawer fronts stack from the top of the cabinet downward.
    for (let i = 0; i < cfg.drawers; i++) {
        const y = height - (i + 0.5) * drawerHeight;
        add(`drawer-${i + 1}`, `Drawer front ${i + 1}`, width - 0.02, drawerHeight - 0.006, t, 0, y, frontZ, 'front');
    }

    const doorCount = cfg.doorStyle === 'open' ? 0 : Math.max(1, cfg.doors || 1);
    if (doorCount > 0) {
        const gap = 0.006;
        const column = (width - gap * (doorCount + 1)) / doorCount;
        for (let i = 0; i < doorCount; i++) {
            const x = -width / 2 + gap * (i + 1) + column * (i + 0.5);
            add(`door-${i + 1}`, `Door ${i + 1} (${cfg.doorStyle})`, column, doorHeight, t, x, doorY, frontZ, 'front', cfg.doorStyle);
        }
    }

    if (cfg.counter) {
        add('counter', 'Countertop', width + 0.02, 0.03, depth + 0.02, 0, height - 0.015, 0.01, 'counter', 'stone');
    }

    return parts;
}

/** Bill of materials: same parts, grouped by size and material. */
export function cabinetBOM(item) {
    const dims = itemDimensions(item);
    const cfg = cabinetConfigOf(item);
    const parts = cabinetParts({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        config: cfg
    });

    const groups = new Map();
    parts.forEach((part) => {
        const key = [part.label.replace(/\d+/g, '#'), part.w.toFixed(3), part.h.toFixed(3), part.d.toFixed(3), part.material].join('|');
        if (!groups.has(key)) {
            groups.set(key, {
                label: part.label.replace(/\d+/g, '#').trim(),
                widthMm: Math.round(part.w * 1000),
                heightMm: Math.round(part.h * 1000),
                thicknessMm: Math.round(part.d * 1000),
                material: part.material,
                role: part.role,
                qty: 0
            });
        }
        groups.get(key).qty += 1;
    });

    return [...groups.values()];
}

/** Build the configured cabinet in three.js (base at y = 0). */
export function buildParametricCabinet({ THREE, width, height, depth, material, config, fixture } = {}) {
    const group = new THREE.Group();
    const cfg = normalizeCabinetConfig(config || fixture?.config || {});
    const parts = cabinetParts({ width, height, depth, config: cfg });

    const materials = {
        panel: material,
        front: cfg.doorStyle === 'glass'
            ? new THREE.MeshStandardMaterial({ color: 0xbfe6f5, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1 })
            : material,
        stone: new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.45, metalness: 0.15 })
    };

    parts.forEach((part) => {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(part.w, part.h, part.d),
            materials[part.material] || material
        );
        mesh.position.set(part.x, part.y, part.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.part = part.id;
        group.add(mesh);
    });

    return group;
}
