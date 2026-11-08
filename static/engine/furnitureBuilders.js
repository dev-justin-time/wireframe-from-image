import * as THREE from 'three';
import { WINDOW_SILL_HEIGHT } from '../core/world-space.js';

// --- Helpers ---
export const createMat = (color, metalness = 0, roughness = 0.9, map = null) => 
    new THREE.MeshStandardMaterial({ color, metalness, roughness, map });

// Helper to cleanly add a child mesh to a group at a specific position
const addChild = (group, mesh, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
};

// --- Builders ---

export const buildDoor = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const frameMat = createMat(0xffffff, 0.1, 0.5);
    const doorMat = material || createMat(0x8b5a2b, 0.0, 0.8); // Default wood

    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.05, height + 0.05, 0.15), frameMat);
    addChild(group, frame, 0, height / 2, 0);

    // Door slab
    const door = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.05), doorMat);
    addChild(group, door, 0, height / 2, 0.05);

    // Handle
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), createMat(0xffd700, 0.9, 0.1));
    addChild(group, handle, width * 0.35, height / 2, 0.08);
    
    return group;
};

export const buildWindow = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    // sillHeight is measured from the floor to the bottom of the window.
    const sill = fixture?.metadata?.sillHeight ?? fixture?.metadata?.altitude ?? WINDOW_SILL_HEIGHT;
    const frameMat = createMat(0xffffff, 0.1, 0.5);
    
    // Outer frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.15), frameMat);
    addChild(group, frame, 0, 0, 0);

    // Realistic Glass (Transmission)
    const glassMat = new THREE.MeshPhysicalMaterial({ 
        color: 0x87ceeb, transparent: true, opacity: 0.2, roughness: 0.0, transmission: 0.9, thickness: 0.1 
    });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, height - 0.08, 0.02), glassMat);
    addChild(group, glass, 0, 0, 0.06);

    // Muntins (crossbars) for realism
    if (width > 0.8 && height > 0.8) {
        const barH = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.04, 0.03), frameMat);
        addChild(group, barH, 0, 0, 0.07);
        const barV = new THREE.Mesh(new THREE.BoxGeometry(0.04, height - 0.08, 0.03), frameMat);
        addChild(group, barV, 0, 0, 0.07);
    }    group.position.y = sill + height / 2;
    return group;


};

export const buildRoundWindow = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const r = width / 2;
    const sill = fixture?.metadata?.sillHeight ?? fixture?.metadata?.altitude ?? 1.5;
    const frameMat = createMat(0xffffff, 0.1, 0.5);
    
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 16, 32), frameMat);
    addChild(group, torus, 0, 0, 0);
    
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.2, roughness: 0.0, transmission: 0.9, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, 32), glassMat);
    addChild(group, glass, 0, 0, 0.02);

    group.position.y = sill + r;
    return group;
};

/** A ceiling luminaire sent from the lighting suite; the disc is emissive. */
export const buildCeilingLight = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    group.position.y = fixture?.metadata?.mountHeight ?? 2.4;
    const trimMat = createMat(0xf8fafc, 0.15, 0.55);
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(width / 2, width / 2, Math.max(height, 0.04), 24), trimMat);
    addChild(group, trim, 0, 0, 0);
    const diffuserMat = new THREE.MeshStandardMaterial({
        color: 0xfff4cf, emissive: 0xffe8a3, emissiveIntensity: 0.85, roughness: 0.4
    });
    const diffuser = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.4, width * 0.4, 0.012, 24), diffuserMat);
    addChild(group, diffuser, 0, -Math.max(height, 0.04) / 2 - 0.006, 0);
    return group;
};

/** Wall switch faceplate; binds to a wall like a window but cuts no opening. */
export const buildWallSwitch = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    group.position.y = fixture?.metadata?.mountHeight ?? 1.2;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(width, height, Math.max(depth, 0.012)), createMat(0xffffff, 0.05, 0.55));
    addChild(group, plate, 0, 0, 0);
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, height * 0.55, 0.006), material || createMat(0xe2e8f0, 0.05, 0.7));
    addChild(group, rocker, 0, 0, Math.max(depth, 0.012) / 2 + 0.003);
    return group;
};

/** Socket faceplate with two slots, sized to the lighting suite's wall devices. */
export const buildWallSocket = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    group.position.y = fixture?.metadata?.mountHeight ?? 0.3;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(width, height, Math.max(depth, 0.012)), createMat(0xffffff, 0.05, 0.55));
    addChild(group, plate, 0, 0, 0);
    const slotMat = createMat(0x475569, 0.1, 0.8);
    [-width * 0.2, width * 0.2].forEach((x) => {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(width * 0.08, height * 0.22, 0.006), slotMat);
        addChild(group, slot, x, 0, Math.max(depth, 0.012) / 2 + 0.003);
    });
    return group;
};

export const buildSofa = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const seatH = height * 0.5 || 0.45;
    const backH = height || 0.8;
    const armH = seatH + 0.15;
    const mat = material || createMat(0x556b2f, 0.0, 0.9); // Default fabric

    // Base
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, seatH, depth), mat), 0, seatH / 2, 0);
    // Backrest
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, backH - seatH, 0.2), mat), 0, seatH + (backH - seatH) / 2, -depth / 2 + 0.1);
    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, armH - seatH, depth);
    addChild(group, new THREE.Mesh(armGeo, mat), -width / 2 + 0.1, seatH + (armH - seatH) / 2, 0);
    addChild(group, new THREE.Mesh(armGeo, mat), width / 2 - 0.1, seatH + (armH - seatH) / 2, 0);

    // Cushions (visual detail)
    const cushionMat = createMat(material?.color?.getHex() || 0x6b8e23, 0.0, 0.95);
    const cushionGeo = new THREE.BoxGeometry(width / 2 - 0.05, 0.15, depth - 0.1);
    addChild(group, new THREE.Mesh(cushionGeo, cushionMat), -width / 4, seatH + 0.075, 0);
    addChild(group, new THREE.Mesh(cushionGeo, cushionMat), width / 4, seatH + 0.075, 0);

    return group;
};

export const buildBed = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x8b4513, 0.0, 0.8); // Wood frame
    
    // Frame
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), mat), 0, 0.15, 0);

    // Mattress
    const mattressMat = createMat(0xffffff, 0.0, 0.9);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, height * 0.6, depth - 0.1), mattressMat), 0, 0.3 + (height * 0.6) / 2, 0);

    // Headboard
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height * 1.2, 0.1), mat), 0, 0.3 + height * 0.6, -depth / 2 + 0.05);

    // Pillows
    const pillowMat = createMat(0xf0f0f0, 0.0, 1.0);
    const pillowGeo = new THREE.BoxGeometry(width * 0.35, 0.15, 0.5);
    addChild(group, new THREE.Mesh(pillowGeo, pillowMat), -width * 0.2, 0.3 + height * 0.6 + 0.075, -depth / 2 + 0.4);
    addChild(group, new THREE.Mesh(pillowGeo, pillowMat), width * 0.2, 0.3 + height * 0.6 + 0.075, -depth / 2 + 0.4);

    // Blanket
    const blanketMat = createMat(0x4682b4, 0.0, 0.9);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.05, depth * 0.6), blanketMat), 0, 0.3 + height * 0.6 + 0.025, depth * 0.2);

    return group;
};

export const buildStove = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const bodyMat = material || createMat(0x222222, 0.6, 0.4); // Stainless/Matte black
    
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat), 0, height / 2, 0);

    // Oven door
    const doorMat = createMat(0x111111, 0.8, 0.2);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width * 0.8, height * 0.6, 0.05), doorMat), 0, height * 0.35, depth / 2 + 0.025);
    
    // Handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, width * 0.6, 8), createMat(0xcccccc, 0.9, 0.1));
    handle.rotation.z = Math.PI / 2;
    addChild(group, handle, 0, height * 0.55, depth / 2 + 0.05);

    // Burners & Grates
    const burnerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
    const burnerMat = createMat(0x111111, 0.8, 0.2);
    const positions = [[-width/3, -depth/3], [width/3, -depth/3], [-width/3, depth/3], [width/3, depth/3]];
    
    positions.forEach(([x, z]) => {
        addChild(group, new THREE.Mesh(burnerGeo, burnerMat), x, height + 0.01, z);
        const grate = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.01, 8, 16), createMat(0x333333, 0.9, 0.8));
        grate.rotation.x = Math.PI / 2;
        addChild(group, grate, x, height + 0.03, z);
    });

    return group;
};

export const buildFloorLamp = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const poleMat = material || createMat(0x333333, 0.8, 0.2);
    
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), poleMat), 0, 0.025, 0);
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, height, 8), poleMat), 0, height / 2, 0);
    
    // Shade
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xffffee, side: THREE.DoubleSide, transparent: true, opacity: 0.85, roughness: 0.9 });
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(width / 2, width / 2.5, 0.5, 16, 1, true), shadeMat), 0, height - 0.25, 0);
    
    // Bulb & Light
    addChild(group, new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffddaa })), 0, height - 0.3, 0);
    const light = new THREE.PointLight(0xffaa00, 0.8, 4);
    light.position.set(0, height - 0.3, 0);
    group.add(light);

    return group;
};

export const buildCoffeeTable = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x8b5a2b, 0.0, 0.8);
    
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), mat), 0, height, 0);
    
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, height, 8);
    const legMat = createMat(0x222222, 0.8, 0.2);
    [[-width/2 + 0.1, -depth/2 + 0.1], [width/2 - 0.1, -depth/2 + 0.1], [-width/2 + 0.1, depth/2 - 0.1], [width/2 - 0.1, depth/2 - 0.1]].forEach(([x, z]) => {
        addChild(group, new THREE.Mesh(legGeo, legMat), x, height / 2, z);
    });
    return group;
};

export const buildDesk = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0xffffff, 0.1, 0.5);
    
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), mat), 0, height, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width * 0.3, height - 0.05, depth - 0.1), mat), width / 2 - width * 0.15, (height - 0.05) / 2, 0);
    
    // Drawer handles
    for(let i = 0; i < 3; i++) {
        addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), createMat(0x888888, 0.9, 0.1)), width / 2 - width * 0.15, height * (0.8 - i * 0.25), depth / 2 - 0.05 + 0.01);
    }
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.05, height - 0.05, depth - 0.1), mat), -width / 2 + 0.025, (height - 0.05) / 2, 0);
    return group;
};

export const buildBookshelf = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x8b5a2b, 0.0, 0.8);
    
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.05, height, depth), mat), -width / 2 + 0.025, height / 2, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.05, height, depth), mat), width / 2 - 0.025, height / 2, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), mat), 0, 0.025, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), mat), 0, height - 0.025, 0);
    
    const numShelves = 4;
    const shelfGeo = new THREE.BoxGeometry(width - 0.1, 0.03, depth - 0.05);
    const bookColors = [0x8b0000, 0x00008b, 0x006400, 0x4b0082, 0x8b4513, 0x2f4f4f];
    
    for (let i = 1; i <= numShelves; i++) {
        const y = (height / (numShelves + 1)) * i;
        addChild(group, new THREE.Mesh(shelfGeo, mat), 0, y, 0);
        
        // Procedural books
        let currentX = -width / 2 + 0.1;
        while (currentX < width / 2 - 0.15) {
            const bookW = 0.03 + Math.random() * 0.05;
            const bookH = 0.2 + Math.random() * 0.15;
            const color = bookColors[Math.floor(Math.random() * bookColors.length)];
            addChild(group, new THREE.Mesh(new THREE.BoxGeometry(bookW, bookH, depth - 0.1), createMat(color, 0.0, 0.9)), currentX + bookW / 2, y + 0.015 + bookH / 2, 0);
            currentX += bookW + 0.01;
        }
    }
    return group;
};

export const buildKitchenCabinet = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0xffffff, 0.1, 0.5);
    
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat), 0, height / 2, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.04, depth + 0.04), createMat(0x333333, 0.1, 0.2)), 0, height, 0); // Countertop
    
    const handleMat = createMat(0xcccccc, 0.9, 0.1);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), handleMat), -width / 4, height / 2, depth / 2 + 0.02);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), handleMat), width / 4, height / 2, depth / 2 + 0.02);
    return group;
};

export const buildDiningTable = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x8b5a2b, 0.0, 0.8);
    
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), mat), 0, height, 0);
    
    if (width > 1.5) {
        // Legs
        const legGeo = new THREE.BoxGeometry(0.08, height, 0.08);
        [[-width/2 + 0.1, -depth/2 + 0.1], [width/2 - 0.1, -depth/2 + 0.1], [-width/2 + 0.1, depth/2 - 0.1], [width/2 - 0.1, depth/2 - 0.1]].forEach(([x, z]) => {
            addChild(group, new THREE.Mesh(legGeo, mat), x, height / 2, z);
        });
    } else {
        // Pedestal
        addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, height, 16), mat), 0, height / 2, 0);
        addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.6), mat), 0, 0.025, 0);
    }
    return group;
};

export const buildPottedPlant = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 12), createMat(0x8b4513, 0.0, 0.9)), 0, 0.2, 0); // Pot
    addChild(group, new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), createMat(0x3b2f2f, 0.0, 1.0)).rotateX(-Math.PI / 2), 0, 0.39, 0); // Soil

    // Procedural leaves
    addChild(group, new THREE.Mesh(new THREE.DodecahedronGeometry(0.25), createMat(0x228b22, 0.0, 0.8)), 0, 0.6, 0);
    addChild(group, new THREE.Mesh(new THREE.DodecahedronGeometry(0.2), createMat(0x32cd32, 0.0, 0.8)), 0.15, 0.8, 0.1);
    addChild(group, new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), createMat(0x228b22, 0.0, 0.8)), -0.1, 0.75, -0.1);
    return group;
};

export const buildRug = (width, height, depth, material, fixture) => {
    const isRound = fixture?.type === 'rug_round';
    const geo = isRound ? new THREE.CylinderGeometry(width / 2, width / 2, 0.02, 32) : new THREE.BoxGeometry(width, 0.02, depth);
    const mat = material || createMat(0x8b0000, 0.0, 1.0); // High roughness for fabric
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.01;
    mesh.receiveShadow = true;
    return mesh;
};

export const buildPainting = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const alt = fixture?.metadata?.altitude || 1.5;
    
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.05), createMat(0x333333, 0.1, 0.5)), 0, 0, 0); // Frame
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material || createMat(0xffffff, 0.0, 0.9));
    canvas.position.z = 0.03;
    group.add(canvas);
    
    group.position.y = alt;
    return group;
};

// --- Bathroom ---

export const buildSink = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0xffffff, 0.1, 0.2);

    // Vanity body
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat), 0, height / 2, 0);

    // Basin lip
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, 0.06, depth * 0.85), createMat(0xdddddd, 0.4, 0.1)), 0, height + 0.03, 0);

    // Tap
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8), createMat(0xaaaaaa, 0.9, 0.1)), 0, height + 0.12, -depth * 0.35);
    return group;
};

export const buildShower = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();

    // Tray
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), createMat(0xffffff, 0.1, 0.3)), 0, 0.04, 0);

    // Glass enclosure (kept out of the shadow pass so it stays transparent)
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.25, roughness: 0.05, transmission: 0.9, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), glassMat);
    glass.position.set(0, height / 2 + 0.08, 0);
    group.add(glass);

    // Shower head
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), createMat(0xcccccc, 0.9, 0.1)), 0, height, -depth / 2 + 0.08);
    return group;
};

// --- Kitchen ---

export const buildFridge = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const bodyMat = material || createMat(0xdddddd, 0.2, 0.4);

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat), 0, height / 2, 0);

    // Door seam between freezer and fridge
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width + 0.005, 0.01, depth + 0.005), createMat(0x999999, 0.4, 0.5)), 0, height * 0.65, 0);

    // Vertical handles on the front
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, height * 0.22, 8);
    const handleMat = createMat(0x888888, 0.9, 0.1);
    addChild(group, new THREE.Mesh(handleGeo, handleMat), -0.06, height * 0.8, depth / 2 + 0.03);
    addChild(group, new THREE.Mesh(handleGeo, handleMat), 0.06, height * 0.45, depth / 2 + 0.03);
    return group;
};

export const buildKitchenSink = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0xffffff, 0.1, 0.5);

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat), 0, height / 2, 0);

    // Countertop with basin cutout illusion
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), createMat(0x333333, 0.1, 0.3)), 0, height + 0.025, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width * 0.75, 0.02, depth * 0.7), createMat(0xbbbbbb, 0.7, 0.2)), 0, height + 0.055, 0);

    // Tap
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25, 8), createMat(0xaaaaaa, 0.9, 0.1)), 0, height + 0.17, -depth * 0.35);
    return group;
};

export const buildKitchenIsland = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0xf5f5dc, 0.0, 0.8);

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat), 0, height / 2, 0);

    // Countertop overhang on all sides
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.05, depth + 0.1), createMat(0x333333, 0.1, 0.3)), 0, height, 0);

    // Door lines
    const gapMat = createMat(0x333333, 0.1, 0.6);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.01, height * 0.9, 0.01), gapMat), 0, height / 2, depth / 2 + 0.005);
    return group;
};

// --- Living Room ---

export const buildArmchair = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x555555, 0.0, 0.9);
    const seatH = height * 0.55;

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, seatH, depth), mat), 0, seatH / 2, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height - seatH, 0.2), mat), 0, seatH + (height - seatH) / 2, -depth / 2 + 0.1);

    const armGeo = new THREE.BoxGeometry(0.15, height * 0.35, depth);
    addChild(group, new THREE.Mesh(armGeo, mat), -width / 2 + 0.075, seatH + height * 0.175, 0);
    addChild(group, new THREE.Mesh(armGeo, mat), width / 2 - 0.075, seatH + height * 0.175, 0);

    // Seat cushion
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width - 0.35, 0.12, depth - 0.1), createMat(0x6b8e23, 0.0, 0.95)), 0, seatH + 0.06, 0.02);
    return group;
};

export const buildTvStand = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x1a1a1a, 0.2, 0.6);

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat), 0, height / 2, 0);

    // TV panel
    const screen = new THREE.Mesh(new THREE.BoxGeometry(width * 0.8, width * 0.45, 0.05), createMat(0x111111, 0.3, 0.2));
    addChild(group, screen, 0, height + (width * 0.45) / 2 + 0.05, 0);

    // Stand neck
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.1), createMat(0x333333, 0.8, 0.2)), 0, height + 0.025, 0);
    return group;
};

// --- Bedroom ---

export const buildWardrobe = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x5d4037, 0.0, 0.8);

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat), 0, height / 2, 0);

    // Centre seam between the two doors
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.01, height * 0.94, 0.01), createMat(0x000000, 0.0, 0.9)), 0, height / 2, depth / 2 + 0.005);

    // Handles
    const handleMat = createMat(0xcccccc, 0.9, 0.1);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), handleMat), -0.06, height / 2, depth / 2 + 0.02);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), handleMat), 0.06, height / 2, depth / 2 + 0.02);
    return group;
};

export const buildNightstand = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x5d4037, 0.0, 0.8);

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat), 0, height / 2, 0);

    // Drawer face and handle
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, height * 0.4, 0.01), createMat(0x4e342e, 0.0, 0.8)), 0, height * 0.72, depth / 2 + 0.005);
    addChild(group, new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), createMat(0xcccccc, 0.9, 0.1)), 0, height * 0.72, depth / 2 + 0.03);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.04, height * 0.12, 0.04);
    [[-width / 2 + 0.05, -depth / 2 + 0.05], [width / 2 - 0.05, -depth / 2 + 0.05], [-width / 2 + 0.05, depth / 2 - 0.05], [width / 2 - 0.05, depth / 2 - 0.05]].forEach(([x, z]) => {
        addChild(group, new THREE.Mesh(legGeo, mat), x, -height * 0.06 + height / 2, z);
    });
    return group;
};

// --- Office ---

export const buildOfficeChair = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x212121, 0.1, 0.7);
    const metalMat = createMat(0x333333, 0.8, 0.2);

    // Seat
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, depth), mat), 0, height * 0.45, 0);

    // Backrest
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.45, 0.05), mat), 0, height * 0.7, -depth / 2 + 0.025);

    // Gas stem
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, height * 0.4, 8), metalMat), 0, height * 0.22, 0);

    // Base and wheels
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(width * 0.55, width * 0.55, 0.05, 16), metalMat), 0, 0.025, 0);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        addChild(group, new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), metalMat), Math.cos(a) * width * 0.5, 0.04, Math.sin(a) * width * 0.5);
    }
    return group;
};

// --- Dining ---

export const buildDiningChair = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x3e2723, 0.0, 0.8);
    const seatH = height * 0.5;

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), mat), 0, seatH, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.5, 0.05), mat), 0, seatH + height * 0.25, -depth / 2 + 0.025);

    const legGeo = new THREE.BoxGeometry(0.04, seatH, 0.04);
    [[-width / 2 + 0.05, -depth / 2 + 0.05], [width / 2 - 0.05, -depth / 2 + 0.05], [-width / 2 + 0.05, depth / 2 - 0.05], [width / 2 - 0.05, depth / 2 - 0.05]].forEach(([x, z]) => {
        addChild(group, new THREE.Mesh(legGeo, mat), x, seatH / 2, z);
    });
    return group;
};

export const buildSideboard = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x5d4037, 0.0, 0.8);

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat), 0, height / 2, 0);

    // Two door panels
    const doorMat = createMat(0x333333, 0.1, 0.6);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width / 2 - 0.05, height - 0.1, 0.02), doorMat), -width / 4, height / 2, depth / 2 + 0.01);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width / 2 - 0.05, height - 0.1, 0.02), doorMat), width / 4, height / 2, depth / 2 + 0.01);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.05, height * 0.1, 0.05);
    [[-width / 2 + 0.06, -depth / 2 + 0.06], [width / 2 - 0.06, -depth / 2 + 0.06], [-width / 2 + 0.06, depth / 2 - 0.06], [width / 2 - 0.06, depth / 2 - 0.06]].forEach(([x, z]) => {
        addChild(group, new THREE.Mesh(legGeo, mat), x, -height * 0.05 + height / 2, z);
    });
    return group;
};

// --- Lighting / Outdoor ---

export const buildWallLamp = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const alt = fixture?.metadata?.altitude || 1.8;

    // Backplate
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width * 0.5, height, 0.03), material || createMat(0x333333, 0.8, 0.2)), 0, 0, 0);

    // Arm
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, depth), material || createMat(0x333333, 0.8, 0.2)), 0, 0, depth / 2);

    // Shade
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.35, width * 0.25, height * 0.4, 12), new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0x332200, side: THREE.DoubleSide }));
    shade.position.set(0, -height * 0.2, depth);
    group.add(shade);

    const light = new THREE.PointLight(0xffaa00, 0.4, 2.5);
    light.position.set(0, -height * 0.2, depth);
    group.add(light);    group.position.y = sill + height / 2;
    return group;


};

export const buildPatioTable = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0x8b4513, 0.0, 0.8);

    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(width / 2, width / 2, 0.05, 32), mat), 0, height, 0);
    addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.25, height, 8), mat), 0, height / 2, 0);
    return group;
};

export const buildPatioChair = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0xf5f5dc, 0.0, 0.8);
    const seatH = height * 0.45;

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), mat), 0, seatH, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height - seatH, 0.08), mat), 0, seatH + (height - seatH) / 2, -depth / 2 + 0.04);

    const legGeo = new THREE.BoxGeometry(0.04, seatH, 0.04);
    [[-width / 2 + 0.05, -depth / 2 + 0.05], [width / 2 - 0.05, -depth / 2 + 0.05], [-width / 2 + 0.05, depth / 2 - 0.05], [width / 2 - 0.05, depth / 2 - 0.05]].forEach(([x, z]) => {
        addChild(group, new THREE.Mesh(legGeo, mat), x, seatH / 2, z);
    });
    return group;
};

export const buildLounger = (width, height, depth, material, fixture) => {
    const group = new THREE.Group();
    const mat = material || createMat(0xffffff, 0.0, 0.9);

    // Base
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.1, depth), mat), 0, height * 0.3, 0);

    // Inclined backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.6, 0.08), mat);
    back.rotation.x = -Math.PI / 4;
    back.position.set(0, height * 0.45, -depth / 2 + 0.15);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.05, height * 0.3, 0.05);
    [[-width / 2 + 0.06, -depth / 2 + 0.2], [width / 2 - 0.06, -depth / 2 + 0.2], [-width / 2 + 0.06, depth / 2 - 0.2], [width / 2 - 0.06, depth / 2 - 0.2]].forEach(([x, z]) => {
        addChild(group, new THREE.Mesh(legGeo, mat), x, height * 0.15, z);
    });
    return group;
};

// Fallback
export const buildDefaultBox = (width, height, depth, material, fixture) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.y = fixture?.type?.includes('rug') ? 0.01 : height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

// --- Merlot cabinetry line -------------------------------------------------
// One finish, one construction language, across a full kitchen: base units,
// wall units, tall units, island and trim. All sizes are metres.

const MERLOT_COUNTER = () => createMat(0xe9e6df, 0.05, 0.3);
const MERLOT_PULL = () => createMat(0xb9c0c7, 0.9, 0.22);
const MERLOT_KICK = () => createMat(0x241110, 0.0, 0.9);
const merlotCarcass = (material) => material || createMat(0x5c2b26, 0.05, 0.42);

const addPanel = (group, w, h, x, y, z, mat, depth = 0.02) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), mat);
    return addChild(group, panel, x, y, z);
};

const addBarPull = (group, panelWidth, x, y, z) => {
    const pull = new THREE.Mesh(new THREE.BoxGeometry(Math.min(panelWidth * 0.6, 0.16), 0.015, 0.02), MERLOT_PULL());
    return addChild(group, pull, x, y, z + 0.022);
};

const buildMerlotUnit = (width, height, depth, material, options = {}) => {
    const { doors = 1, drawers = 0, counter = true, toeKick = 0.1 } = options;
    const group = new THREE.Group();
    const carcass = merlotCarcass(material);

    const counterThickness = counter ? 0.03 : 0;
    const bodyHeight = height - counterThickness;
    const kickHeight = Math.min(toeKick, height * 0.15);

    // Recessed toe kick
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, kickHeight, depth * 0.8), MERLOT_KICK()),
        0, kickHeight / 2, -depth * 0.08);

    // Carcass
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, bodyHeight - kickHeight, depth), carcass),
        0, kickHeight + (bodyHeight - kickHeight) / 2, 0);

    // Countertop
    if (counter) {
        addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, counterThickness, depth + 0.02), MERLOT_COUNTER()),
            0, height - counterThickness / 2, 0.01);
    }

    const frontZ = depth / 2 + 0.011;
    const gap = 0.008;
    const frontHeight = bodyHeight - kickHeight - 0.02;
    const frontY = kickHeight + frontHeight / 2 + 0.01;

    if (drawers > 0) {
        const rowHeight = (frontHeight - gap * (drawers + 1)) / drawers;
        for (let i = 0; i < drawers; i++) {
            const y = kickHeight + gap * (i + 1) + rowHeight * (i + 0.5);
            addPanel(group, width - gap * 2, rowHeight, 0, y, frontZ, carcass);
            addBarPull(group, width, 0, y, frontZ);
        }
    } else {
        const colWidth = (width - gap * (doors + 1)) / doors;
        for (let i = 0; i < doors; i++) {
            const x = -width / 2 + gap * (i + 1) + colWidth * (i + 0.5);
            addPanel(group, colWidth, frontHeight, x, frontY, frontZ, carcass);
            const pullOffset = colWidth * 0.3 * (doors > 1 && i % 2 === 1 ? -1 : 1);
            addBarPull(group, colWidth, x + pullOffset, frontY, frontZ);
        }
    }

    return group;
};

export const buildMerlotBaseCabinet = (w, h, d, m) => buildMerlotUnit(w, h, d, m, { doors: 1 });
export const buildMerlotDrawerBase = (w, h, d, m) => buildMerlotUnit(w, h, d, m, { drawers: 3 });

export const buildMerlotSinkBase = (w, h, d, m) => {
    const group = buildMerlotUnit(w, h, d, m, { doors: 2, drawers: 1 });
    // Undermount basin, sunk into the counter
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.2, d * 0.55), createMat(0x9aa3ad, 0.9, 0.25)),
        0, h - 0.12, 0);
    return group;
};

export const buildMerlotCornerBase = (w, h, d, m) => {
    const group = buildMerlotUnit(w, h, d, m, { doors: 1 });
    // Blind corner panel on the return side
    addPanel(group, d - 0.04, h - 0.16, w / 2 + 0.011, (h - 0.13) / 2 + 0.05, 0, merlotCarcass(m))
        .rotation.y = Math.PI / 2;
    return group;
};

export const buildMerlotWallCabinet = (w, h, d, m, fixture) => {
    const group = buildMerlotUnit(w, h, d, m, { doors: 1, counter: false, toeKick: 0 });
    group.position.y = fixture?.metadata?.mountHeight ?? 1.37;
    return group;
};

export const buildMerlotWallCabinetDouble = (w, h, d, m, fixture) => {
    const group = buildMerlotUnit(w, h, d, m, { doors: 2, counter: false, toeKick: 0 });
    group.position.y = fixture?.metadata?.mountHeight ?? 1.37;
    return group;
};

export const buildMerlotTallPantry = (w, h, d, m) => buildMerlotUnit(w, h, d, m, { doors: 2, counter: false });

export const buildMerlotOvenTower = (w, h, d, m) => {
    const group = buildMerlotUnit(w, h, d, m, { counter: false });
    const frontZ = d / 2 + 0.02;
    // Built-in oven: dark glass panel with a bar handle
    addPanel(group, w - 0.06, 0.55, 0, h * 0.55, frontZ, createMat(0x14171a, 0.35, 0.25));
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(w - 0.16, 0.02, 0.03), MERLOT_PULL()), 0, h * 0.55 + 0.29, frontZ + 0.03);
    return group;
};

export const buildMerlotIsland = (w, h, d, m) => {
    // Three-door island; the counter stays within the declared footprint so the
    // 2D plan rectangle matches the 3D body exactly.
    return buildMerlotUnit(w, h, d, m, { doors: 3 });
};

export const buildMerlotOpenShelf = (w, h, d, m, fixture) => {
    const group = new THREE.Group();
    const plankThickness = 0.05;
    const bracketHeight = 0.14;

    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(w, plankThickness, d), merlotCarcass(m)), 0, 0, 0);
    const bracket = merlotCarcass(m);
    [-w / 2 + 0.1, w / 2 - 0.1].forEach((x) => {
        addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.03, bracketHeight, d * 0.7), bracket), x, -plankThickness / 2 - bracketHeight / 2, -d * 0.1);
    });
    // Consistent with the other wall-mounted pieces: mountHeight is the bottom
    // of the unit's bounding box.
    group.position.y = (fixture?.metadata?.mountHeight ?? 1.52) + plankThickness / 2 + bracketHeight;
    return group;
};

export const buildMerlotBarPull = (w, h, d, m, fixture) => {
    const group = new THREE.Group();
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(w || 0.16, h || 0.03, d || 0.03), MERLOT_PULL()), 0, 0, 0);
    return group;
};

export const buildMerlotCrown = (w, h, d, m, fixture) => {
    const group = new THREE.Group();
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), merlotCarcass(m)), 0, 0, 0);
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.4, d * 1.15), merlotCarcass(m)), 0, -h * 0.5, d * 0.05);
    // mountHeight is the underside of the moulding.
    group.position.y = (fixture?.metadata?.mountHeight ?? 2.18) + (h || 0.09) / 2 + 0.01;
    return group;
};

// --- Shaker cabinetry line (wireframe) -------------------------------------
// Modelled on the reference kitchen in shaker.glb: five-piece shaker fronts
// (two stiles, two rails, recessed centre panel) on a frameless carcass with a
// recessed toe kick. The line is drawn as wireframe in 3D, so the stile/rail
// construction stays visible; the frame proportions below are the reference's.

export const SHAKER_STYLE = {
    finish: 0xefeae2,          // RAL 9016 traffic white panels (W980 grain)
    counter: 0xd7d2c7,
    frameWidth: 0.057,         // 2 1/4" stile / rail
    doorThickness: 0.019,      // 3/4" door
    panelThickness: 0.019,
    recessDepth: 0.008
};

const shakerFinish = (material) => material || createMat(SHAKER_STYLE.finish, 0.02, 0.55);

// A five-piece door or drawer front, centred on (x, y) and mounted on the
// cabinet face at `faceZ`. The centre panel sits back from the frame.
const addShakerFront = (group, frontWidth, frontHeight, x, y, faceZ, mat, options = {}) => {
    const { frameWidth = SHAKER_STYLE.frameWidth, thickness = SHAKER_STYLE.doorThickness } = options;
    const f = Math.max(0.02, Math.min(frameWidth, frontWidth / 3, frontHeight / 3));
    const frameZ = faceZ + thickness / 2;
    const innerWidth = frontWidth - f * 2;
    const innerHeight = frontHeight - f * 2;

    // Stiles (full height) and rails (between them)
    addPanel(group, f, frontHeight, x - frontWidth / 2 + f / 2, y, frameZ, mat, thickness);
    addPanel(group, f, frontHeight, x + frontWidth / 2 - f / 2, y, frameZ, mat, thickness);
    addPanel(group, innerWidth, f, x, y + frontHeight / 2 - f / 2, frameZ, mat, thickness);
    addPanel(group, innerWidth, f, x, y - frontHeight / 2 + f / 2, frameZ, mat, thickness);

    // Recessed centre panel, set back from the frame face
    const panelDepth = Math.max(0.008, thickness - SHAKER_STYLE.recessDepth);
    addPanel(group, innerWidth, innerHeight, x, y, faceZ + panelDepth / 2, mat, panelDepth);
};

const addShakerPull = (group, x, y, faceZ) => {
    // Bar pull sits on the door face and stops at the cabinet's depth envelope
    const pullDepth = 0.02;
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, pullDepth), MERLOT_PULL());
    return addChild(group, pull, x, y, faceZ + SHAKER_STYLE.doorThickness + pullDepth / 2);
};

const buildShakerUnit = (width, height, depth, material, options = {}) => {
    const { doors = 1, drawers = 0, counter = true, toeKick = 0.1, shelf = false } = options;
    const group = new THREE.Group();
    const mat = shakerFinish(material);
    const t = SHAKER_STYLE.panelThickness;
    const doorT = SHAKER_STYLE.doorThickness;
    const pullT = 0.02;

    const counterThickness = counter ? 0.03 : 0;
    const bodyHeight = height - counterThickness;
    const kickHeight = Math.min(toeKick, height * 0.15);
    const innerWidth = Math.max(0.05, width - t * 2);

    // Declared depth is the outer envelope: carcass + door + pull. Everything
    // built here stays inside it, so the 2D footprint matches the 3D body.
    const carcassDepth = Math.max(0.05, depth - doorT - pullT);
    const backZ = -depth / 2;
    const faceZ = backZ + carcassDepth;
    const carcassMidZ = backZ + carcassDepth / 2;

    // Carcass as panels, not a solid block
    addPanel(group, t, bodyHeight, -width / 2 + t / 2, bodyHeight / 2, carcassMidZ, mat, carcassDepth);
    addPanel(group, t, bodyHeight, width / 2 - t / 2, bodyHeight / 2, carcassMidZ, mat, carcassDepth);
    addPanel(group, innerWidth, t, 0, bodyHeight - t / 2, carcassMidZ, mat, carcassDepth);
    addPanel(group, innerWidth, t, 0, kickHeight + t / 2, carcassMidZ, mat, carcassDepth);
    addPanel(group, innerWidth, bodyHeight - kickHeight - t, 0, kickHeight + (bodyHeight - kickHeight) / 2, backZ + 0.006, mat, 0.012);

    // Recessed toe kick
    if (kickHeight > 0.01) {
        addPanel(group, width - 0.02, kickHeight, 0, kickHeight / 2, faceZ - 0.075, mat, t);
    }

    // Shelf (wall units / tall units)
    if (shelf) {
        const shelfY = kickHeight + (bodyHeight - kickHeight) * 0.5;
        addPanel(group, innerWidth - 0.004, t * 0.8, 0, shelfY, carcassMidZ, mat, carcassDepth - 0.03);
    }

    // Countertop, full footprint
    if (counter) {
        addChild(group, new THREE.Mesh(new THREE.BoxGeometry(width, counterThickness, depth), createMat(SHAKER_STYLE.counter, 0.05, 0.35)),
            0, height - counterThickness / 2, 0);
    }

    const gap = 0.008;
    const frontHeight = bodyHeight - kickHeight - 0.02;
    const frontY = kickHeight + 0.01 + frontHeight / 2;

    if (drawers > 0) {
        const rowHeight = (frontHeight - gap * (drawers + 1)) / drawers;
        for (let i = 0; i < drawers; i++) {
            const y = kickHeight + gap * (i + 1) + rowHeight * (i + 0.5);
            addShakerFront(group, width - gap * 2, rowHeight, 0, y, faceZ, mat);
            addShakerPull(group, 0, y, faceZ);
        }
    } else {
        const colWidth = (width - gap * (doors + 1)) / doors;
        for (let i = 0; i < doors; i++) {
            const x = -width / 2 + gap * (i + 1) + colWidth * (i + 0.5);
            addShakerFront(group, colWidth, frontHeight, x, frontY, faceZ, mat);
            // Pulls sit on the stiles next to the opening edge
            const side = doors > 1 && i % 2 === 1 ? -1 : 1;
            const pullX = x + side * (colWidth / 2 - SHAKER_STYLE.frameWidth - 0.02);
            addShakerPull(group, pullX, frontY + frontHeight / 2 - 0.12, faceZ);
        }
    }

    return group;
};

export const buildShakerBaseCabinet = (w, h, d, m) => buildShakerUnit(w, h, d, m, { doors: 1 });
export const buildShakerDrawerBase = (w, h, d, m) => buildShakerUnit(w, h, d, m, { drawers: 3 });

export const buildShakerSinkBase = (w, h, d, m) => {
    const group = buildShakerUnit(w, h, d, m, { doors: 2 });
    // Undermount basin sunk into the stone top
    addChild(group, new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.2, d * 0.55), createMat(0x9aa3ad, 0.9, 0.25)),
        0, h - 0.12, 0);
    return group;
};

export const buildShakerWallCabinet = (w, h, d, m, fixture) => {
    const group = buildShakerUnit(w, h, d, m, { doors: 1, counter: false, toeKick: 0, shelf: true });
    group.position.y = fixture?.metadata?.mountHeight ?? 1.37;
    return group;
};

export const buildShakerWallCabinetDouble = (w, h, d, m, fixture) => {
    const group = buildShakerUnit(w, h, d, m, { doors: 2, counter: false, toeKick: 0, shelf: true });
    group.position.y = fixture?.metadata?.mountHeight ?? 1.37;
    return group;
};

export const buildShakerTallPantry = (w, h, d, m) => buildShakerUnit(w, h, d, m, { doors: 2, counter: false });

export const buildShakerIsland = (w, h, d, m) => buildShakerUnit(w, h, d, m, { doors: 3 });

// --- Factory Registry ---
export const FurnitureFactory = {
    'door': buildDoor,
    'window': buildWindow,
    'round_window': buildRoundWindow,
    'ceiling_light': buildCeilingLight,
    'wall_switch': buildWallSwitch,
    'wall_socket': buildWallSocket,

    // Merlot cabinetry line
    'merlot_base_cabinet': buildMerlotBaseCabinet,
    'merlot_drawer_base': buildMerlotDrawerBase,
    'merlot_sink_base': buildMerlotSinkBase,
    'merlot_corner_base': buildMerlotCornerBase,
    'merlot_wall_cabinet': buildMerlotWallCabinet,
    'merlot_wall_cabinet_double': buildMerlotWallCabinetDouble,
    'merlot_tall_pantry': buildMerlotTallPantry,
    'merlot_oven_tower': buildMerlotOvenTower,
    'merlot_island': buildMerlotIsland,
    'merlot_open_shelf': buildMerlotOpenShelf,
    'merlot_bar_pull': buildMerlotBarPull,
    'merlot_crown': buildMerlotCrown,

    // Shaker cabinetry line (wireframe)
    'shaker_base_cabinet': buildShakerBaseCabinet,
    'shaker_drawer_base': buildShakerDrawerBase,
    'shaker_sink_base': buildShakerSinkBase,
    'shaker_wall_cabinet': buildShakerWallCabinet,
    'shaker_wall_cabinet_double': buildShakerWallCabinetDouble,
    'shaker_tall_pantry': buildShakerTallPantry,
    'shaker_island': buildShakerIsland,
    'bathtub': (w, h, d, m, f) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w || 1.6, h || 0.5, d || 0.8), m || createMat(0xffffff, 0.1, 0.2));
        mesh.position.y = (h || 0.5) / 2;
        return mesh;
    },
    'toilet': (w, h, d, m, f) => {
        const group = new THREE.Group();
        const mat = m || createMat(0xffffff, 0.1, 0.2);
        addChild(group, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.4, 16), mat), 0, 0.2, 0);
        addChild(group, new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.2), mat), 0, 0.55, -0.25);
        const seat = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 16), mat);
        seat.rotation.x = Math.PI / 2;
        addChild(group, seat, 0, 0.42, 0.05);
        return group;
    },
    'sink': buildSink,
    'shower': buildShower,
    'fridge': buildFridge,
    'kitchen_sink': buildKitchenSink,
    'kitchen_island': buildKitchenIsland,
    'sofa': buildSofa,
    'armchair': buildArmchair,
    'coffee_table': buildCoffeeTable,
    'tv_stand': buildTvStand,
    'bed_queen': buildBed,
    'bed_single': buildBed,
    'wardrobe': buildWardrobe,
    'nightstand': buildNightstand,
    'desk': buildDesk,
    'office_chair': buildOfficeChair,
    'bookshelf': buildBookshelf,
    'kitchen_cabinet': buildKitchenCabinet,
    'dining_table': buildDiningTable,
    'dining_chair': buildDiningChair,
    'sideboard': buildSideboard,
    'stove': buildStove,
    'floor_lamp': buildFloorLamp,
    'wall_lamp': buildWallLamp,
    'potted_plant': buildPottedPlant,
    'rug_large': buildRug,
    'rug_round': buildRug,
    'painting': buildPainting,
    'patio_table': buildPatioTable,
    'patio_chair': buildPatioChair,
    'lounger': buildLounger,
};