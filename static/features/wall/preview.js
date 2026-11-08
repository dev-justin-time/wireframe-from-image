import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Wall suite previews.
 *
 * `drawWallElevation` renders the wall the takeoff prices: the finish, the
 * baseboard and window, the grade line outside and a cutaway strip through the
 * layers. `createWallViewer` builds the same wall in Three.js and rebuilds it
 * whenever the design changes.
 */

const PATTERN_PX = 256;

const FALLBACK = '#E6DFD2';

function shade(hex, amount) {
    const value = String(hex || FALLBACK).replace('#', '');
    const full = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
    const number = Number.parseInt(full, 16);
    if (!Number.isFinite(number)) return FALLBACK;
    const channel = (part) => Math.max(0, Math.min(255, Math.round(part + amount * 255))).toString(16).padStart(2, '0');
    return `#${channel((number >> 16) & 255)}${channel((number >> 8) & 255)}${channel(number & 255)}`;
}

function colourOf(design) {
    return design?.colour?.hex || design?.covering?.defaultColour || FALLBACK;
}

/**
 * A 1 m² tile of the selected finish, used as a repeating texture in 3D and as
 * the reference for the elevation's line work.
 */
export function patternCanvas(design, size = PATTERN_PX) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const base = colourOf(design);
    const family = design?.covering?.family || 'paint';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    const line = (x1, y1, x2, y2, colour, width = 1) => {
        ctx.strokeStyle = colour;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    };

    if (family === 'paint' || family === 'plaster' || family === 'texture' || family === 'eifs') {
        // A fine roller stipple so the surface is not a flat colour block.
        const dots = family === 'paint' ? 2600 : 4200;
        for (let i = 0; i < dots; i += 1) {
            const x = (i * 73.3) % size;
            const y = (i * 151.7) % size;
            const radius = family === 'paint' ? 0.8 : 1.6;
            ctx.fillStyle = i % 3 === 0 ? shade(base, 0.035) : shade(base, -0.03);
            ctx.globalAlpha = 0.28;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (family === 'plaster') {
            [0.18, 0.55, 0.82].forEach((fraction, index) => {
                ctx.fillStyle = shade(base, index % 2 ? -0.05 : 0.04);
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.ellipse(size * fraction, size * (1 - fraction), size * 0.22, size * 0.09, fraction, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
        }
    } else if (family === 'wallpaper') {
        for (let x = 0; x < size; x += size / 8) {
            ctx.fillStyle = shade(base, 0.03);
            ctx.globalAlpha = 0.45;
            ctx.fillRect(x, 0, size / 16, size);
        }
        ctx.globalAlpha = 1;
        for (let x = size / 16; x < size; x += size / 4) {
            for (let y = size / 16; y < size; y += size / 4) {
                ctx.fillStyle = shade(base, -0.06);
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.arc(x + size / 32, y + size / 32, size / 40, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    } else if (family === 'panel') {
        for (let x = 0; x < size; x += size / 6) {
            line(x, 0, x, size, shade(base, -0.12), 2);
            line(x + 2, 0, x + 2, size, shade(base, 0.12), 1);
        }
    } else if (family === 'tile') {
        const tileW = size / 2;
        const tileH = size / 4;
        for (let x = 0; x <= size; x += tileW) line(x, 0, x, size, shade(base, -0.18), 2);
        for (let y = 0; y <= size; y += tileH) line(0, y, size, y, shade(base, -0.18), 2);
    } else if (family === 'masonry' || family === 'stone') {
        const course = size / 10;
        for (let y = 0; y <= size; y += course) {
            line(0, y, size, y, shade(base, -0.2), 2);
            const offset = (Math.round(y / course) % 2) * (size / 8);
            for (let x = offset; x < size; x += size / 4) {
                line(x, y, x, y + course, shade(base, -0.2), 2);
            }
        }
    } else if (family === 'siding') {
        const lap = size / 8;
        for (let y = 0; y <= size; y += lap) {
            ctx.fillStyle = shade(base, 0.05);
            ctx.fillRect(0, y, size, lap * 0.32);
            line(0, y + lap * 0.32, size, y + lap * 0.32, shade(base, -0.16), 2);
        }
    } else if (family === 'metal') {
        for (let x = 0; x < size; x += size / 4) {
            line(x, 0, x, size, shade(base, -0.16), 2);
            line(x + 2, 0, x + 2, size, shade(base, 0.14), 1);
        }
    }

    return canvas;
}

function patternTexture(design) {
    const canvas = patternCanvas(design);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

/** Baseboard, crown and window geometry, shared by the 3D wall and the section. */
export function wallParts(design) {
    const height = design?.config?.height || 2.7;
    const baseboard = design?.covering?.family === 'tile' ? 0 : 0.1;
    const crown = design?.covering?.family === 'tile' ? 0 : 0.07;
    const window = {
        width: Math.min(1.2, (design?.config?.length || 12) * 0.22),
        height: Math.min(1.2, height * 0.42),
        sill: Math.min(Math.max(height * 0.33, 0.75), height - 1.3)
    };
    return { baseboard, crown, window };
}

function disposeGroup(group) {
    group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => {
                material.map?.dispose?.();
                material.dispose();
            });
        }
    });
    group.clear();
}

function panelMesh(width, height, depth, material, x, y, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function wallGroup(design, texture) {
    const group = new THREE.Group();
    const height = design.config.height;
    const span = Math.min(design.config.length, 8);
    const thickness = 0.14;
    const parts = wallParts(design);
    const colour = new THREE.Color(colourOf(design));
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texture,
        roughness: design.covering.family === 'paint' ? 0.82 : 0.9,
        metalness: design.covering.family === 'metal' ? 0.6 : 0.03
    });
    texture.repeat.set(Math.max(span, 1), Math.max(height, 1));

    const wall = panelMesh(span, height, thickness, wallMaterial, 0, height / 2);
    wall.name = 'wall-preview';
    group.add(wall);

    const trimColour = new THREE.Color('#F3EFE7');
    const trimMaterial = new THREE.MeshStandardMaterial({ color: trimColour, roughness: 0.6 });
    const darkTrim = new THREE.MeshStandardMaterial({ color: 0xE2DDD2, roughness: 0.65 });

    if (parts.baseboard > 0) {
        group.add(panelMesh(span, parts.baseboard, thickness + 0.02, trimMaterial, 0, parts.baseboard / 2, 0.01));
        group.add(panelMesh(span, 0.012, thickness + 0.035, darkTrim, 0, parts.baseboard + 0.006, 0.012));
    }
    if (parts.crown > 0) {
        group.add(panelMesh(span, parts.crown, thickness + 0.02, trimMaterial, 0, height - parts.crown / 2, 0.01));
    }

    // Window: a dark reveal and a glazed panel on the face, with a sill board.
    const win = parts.window;
    const winY = Math.min(win.sill + win.height / 2, height - win.height / 2 - 0.08);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xF7F5EF, roughness: 0.55 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x9BBBCB,
        roughness: 0.12,
        metalness: 0,
        transmission: 0.35,
        transparent: true,
        opacity: 0.72
    });
    group.add(panelMesh(win.width, win.height, 0.02, new THREE.MeshStandardMaterial({ color: 0x2f3437, roughness: 0.9 }), 0, winY, thickness / 2 + 0.002));
    group.add(panelMesh(win.width - 0.1, win.height - 0.1, 0.015, glassMaterial, 0, winY, thickness / 2 + 0.02));
    const frame = 0.05;
    group.add(panelMesh(win.width + frame * 2, frame, 0.07, frameMaterial, 0, winY + win.height / 2 + frame / 2, thickness / 2 + 0.04));
    group.add(panelMesh(win.width + frame * 2, frame, 0.07, frameMaterial, 0, winY - win.height / 2 - frame / 2, thickness / 2 + 0.04));
    group.add(panelMesh(frame, win.height, 0.07, frameMaterial, -win.width / 2 - frame / 2, winY, thickness / 2 + 0.04));
    group.add(panelMesh(frame, win.height, 0.07, frameMaterial, win.width / 2 + frame / 2, winY, thickness / 2 + 0.04));
    group.add(panelMesh(win.width + 0.16, 0.045, 0.14, frameMaterial, 0, winY - win.height / 2 - frame, thickness / 2 + 0.07));

    // Vertical battens for panel and siding systems.
    if (['panel', 'siding'].includes(design.covering.family)) {
        const battenMaterial = new THREE.MeshStandardMaterial({ color: colour.clone().offsetHSL(0, 0, -0.05), roughness: 0.85 });
        for (let x = -span / 2 + 0.4; x < span / 2 - 0.2; x += 0.4) {
            if (Math.abs(x) < win.width / 2 + 0.1) continue;
            group.add(panelMesh(0.045, height, 0.03, battenMaterial, x, height / 2, thickness / 2 + 0.015));
        }
    }

    return group;
}

export function createWallViewer(mount) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9eef3);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI / 2.02;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f98, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(5, 7, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(20, 20, 0xc3ccd5, 0xdbe2e8);
    grid.position.y = -0.03;
    scene.add(grid);

    let model = new THREE.Group();
    scene.add(model);
    let current = null;
    let frame = 0;
    let disposed = false;

    const resize = () => {
        const width = Math.max(mount.clientWidth, 1);
        const height = Math.max(mount.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(mount);
    window.addEventListener('resize', resize);
    resize();

    const loop = () => {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        frame = requestAnimationFrame(loop);
    };
    loop();

    return {
        update(design) {
            current = design;
            scene.remove(model);
            disposeGroup(model);
            const texture = patternTexture(design);
            model = wallGroup(design, texture);
            model.name = 'wall-preview';
            scene.add(model);

            const span = Math.min(design.config.length, 8);
            const height = design.config.height;
            camera.position.set(span * 0.35, height * 0.6, Math.max(span * 0.9, height * 1.6));
            controls.target.set(0, height * 0.48, 0);
            controls.update();
            sun.position.set(span * 0.5, height * 1.4, Math.max(span, 3));
            sun.shadow.camera.left = -span;
            sun.shadow.camera.right = span;
            sun.shadow.camera.top = height * 1.5;
            sun.shadow.camera.bottom = -height;
            sun.shadow.camera.updateProjectionMatrix();
        },
        get design() { return current; },
        dispose() {
            disposed = true;
            cancelAnimationFrame(frame);
            if (observer) observer.disconnect();
            window.removeEventListener('resize', resize);
            controls.dispose();
            disposeGroup(model);
            renderer.dispose();
            renderer.domElement.remove();
        }
    };
}

/** Elevation of the wall the takeoff prices, with a cutaway through the layers. */
export function drawWallElevation(canvas, design) {
    if (!canvas || !design) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width < 10 || height < 10) return;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const parts = wallParts(design);
    const wallLength = design.config.length;
    const wallHeight = design.config.height;
    const pad = { left: 90, right: 190, top: 64, bottom: 74 };
    const scale = Math.min(
        (width - pad.left - pad.right) / wallLength,
        (height - pad.top - pad.bottom) / wallHeight
    );
    const drawWidth = wallLength * scale;
    const drawHeight = wallHeight * scale;
    const x0 = pad.left + (width - pad.left - pad.right - drawWidth) / 2;
    const y1 = height - pad.bottom;
    const y0 = y1 - drawHeight;
    const px = (metres) => x0 + metres * scale;
    const py = (metres) => y1 - metres * scale;

    // Background wall field.
    ctx.fillStyle = colourOf(design);
    ctx.fillRect(x0, y0, drawWidth, drawHeight);

    // Finish line work, drawn in metres so the pattern is true to the product.
    const family = design.covering.family;
    const base = colourOf(design);
    const light = shade(base, 0.06);
    const dark = shade(base, -0.08);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, drawWidth, drawHeight);
    ctx.clip();
    if (family === 'siding') {
        for (let y = 0; y < wallHeight; y += 0.18) {
            ctx.fillStyle = light;
            ctx.fillRect(x0, py(y + 0.06), drawWidth, 0.06 * scale);
            ctx.strokeStyle = dark;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x0, py(y));
            ctx.lineTo(x0 + drawWidth, py(y));
            ctx.stroke();
        }
    } else if (family === 'panel') {
        for (let x = 0; x < wallLength; x += 0.3) {
            ctx.strokeStyle = dark;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px(x), y0);
            ctx.lineTo(px(x), y1);
            ctx.stroke();
        }
    } else if (family === 'tile') {
        for (let x = 0; x < wallLength; x += 0.3) {
            ctx.strokeStyle = '#C9C3B8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px(x), y0);
            ctx.lineTo(px(x), y1);
            ctx.stroke();
        }
        for (let y = 0; y < wallHeight; y += 0.6) {
            ctx.strokeStyle = '#C9C3B8';
            ctx.beginPath();
            ctx.moveTo(x0, py(y));
            ctx.lineTo(x0 + drawWidth, py(y));
            ctx.stroke();
        }
    } else if (family === 'masonry' || family === 'stone') {
        const course = 0.075;
        for (let y = 0; y < wallHeight; y += course) {
            ctx.strokeStyle = shade(base, -0.2);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x0, py(y));
            ctx.lineTo(x0 + drawWidth, py(y));
            ctx.stroke();
            const offset = Math.round(y / course) % 2 ? 0.1075 : 0;
            for (let x = offset; x < wallLength; x += 0.215) {
                ctx.beginPath();
                ctx.moveTo(px(x), py(y));
                ctx.lineTo(px(x), py(y + course));
                ctx.stroke();
            }
        }
    } else if (family === 'wallpaper') {
        for (let x = 0; x < wallLength; x += 0.265) {
            ctx.fillStyle = light;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(px(x), y0, 0.09 * scale, drawHeight);
            ctx.globalAlpha = 1;
        }
    } else if (family === 'paint' || family === 'plaster' || family === 'texture' || family === 'eifs') {
        // A light stipple reads as a rolled or trowelled surface at this scale.
        ctx.fillStyle = light;
        ctx.globalAlpha = 0.45;
        const step = Math.max(4, scale * 0.045);
        for (let x = 0; x < drawWidth; x += step) {
            for (let y = 0; y < drawHeight; y += step) {
                if ((Math.round(x / step) + Math.round(y / step)) % 3 !== 0) continue;
                ctx.fillRect(x0 + x, y0 + y, 1, 1);
            }
        }
        ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Baseboard and crown.
    if (parts.baseboard > 0) {
        ctx.fillStyle = '#F4F1EA';
        ctx.fillRect(x0, py(parts.baseboard), drawWidth, parts.baseboard * scale);
        ctx.strokeStyle = '#D8D2C6';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0, py(parts.baseboard), drawWidth, parts.baseboard * scale);
    }
    if (parts.crown > 0) {
        ctx.fillStyle = '#F4F1EA';
        ctx.fillRect(x0, y0, drawWidth, parts.crown * scale);
        ctx.strokeStyle = '#D8D2C6';
        ctx.strokeRect(x0, y0, drawWidth, parts.crown * scale);
    }

    // Window.
    const win = parts.window;
    const winX = x0 + (drawWidth - win.width * scale) / 2;
    const winY = py(win.sill + win.height);
    const winW = win.width * scale;
    const winH = win.height * scale;
    ctx.fillStyle = '#E8EEF1';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.strokeStyle = '#F7F5EF';
    ctx.lineWidth = Math.max(3, scale * 0.05);
    ctx.strokeRect(winX, winY, winW, winH);
    ctx.strokeStyle = '#9BBBCB';
    ctx.lineWidth = Math.max(1, scale * 0.012);
    ctx.beginPath();
    ctx.moveTo(winX + winW / 2, winY);
    ctx.lineTo(winX + winW / 2, winY + winH);
    ctx.moveTo(winX, winY + winH / 2);
    ctx.lineTo(winX + winW, winY + winH / 2);
    ctx.stroke();
    ctx.fillStyle = '#F7F5EF';
    ctx.fillRect(winX - 0.06 * scale, winY + winH, winW + 0.12 * scale, 0.04 * scale);

    // Grade line and clearance outside.
    if (design.config.exposure === 'exterior') {
        const gradeY = y1 + design.config.gradeClearanceMm / 1000 * scale;
        ctx.fillStyle = 'rgba(120, 113, 100, 0.16)';
        ctx.fillRect(pad.left - 20, gradeY, width - pad.left - pad.right + 40, 5);
        ctx.strokeStyle = '#0ea5e9';
        ctx.fillStyle = '#0369a1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + 12, y1);
        ctx.lineTo(x0 + 12, gradeY);
        ctx.stroke();
        ctx.font = '600 9px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${design.config.gradeClearanceMm} mm`, x0 + 18, (y1 + gradeY) / 2 + 3);
    }

    // Dimensions.
    ctx.strokeStyle = '#0ea5e9';
    ctx.fillStyle = '#0369a1';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x0, y1 + 28);
    ctx.lineTo(x0 + drawWidth, y1 + 28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0 - 28, y0);
    ctx.lineTo(x0 - 28, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${wallLength.toFixed(2)} m`, x0 + drawWidth / 2, y1 + 42);
    ctx.save();
    ctx.translate(x0 - 38, y0 + drawHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${wallHeight.toFixed(2)} m`, 0, 0);
    ctx.restore();

    // Header and swatch.
    ctx.textAlign = 'left';
    ctx.font = '700 11px ui-sans-serif, system-ui';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${design.covering.label} · ${design.areas.net.toFixed(1)} m² net`, pad.left, 22);
    ctx.font = '500 10px ui-monospace, monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText(`${design.colour.label} · ${design.sheen.label} · ${design.areas.coats} coat${design.areas.coats === 1 ? '' : 's'}`, pad.left, 38);

    const swatchX = width - pad.right + 24;
    ctx.fillStyle = base;
    ctx.fillRect(swatchX, 18, 26, 26);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(swatchX, 18, 26, 26);
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 9px ui-monospace, monospace';
    ctx.fillText(`LRV ${Math.round(design.scheme.wall.lrv)}`, swatchX + 34, 30);
    ctx.fillStyle = '#64748b';
    ctx.fillText(design.covering.family, swatchX + 34, 42);

    // Cutaway through the layers, on the right.
    const cutX = width - pad.right + 24;
    const cutY = 76;
    const cutW = 74;
    const layers = [
        { label: 'substrate', value: 12.5, colour: '#C9B99A' },
        { label: 'primer', value: design.config.primer ? 0.15 : 0, colour: '#E8E2D6' },
        { label: 'finish', value: design.covering.thicknessMm, colour: base },
        { label: 'trim', value: parts.baseboard > 0 ? 12 : 0, colour: '#F4F1EA' }
    ].filter((layer) => layer.value > 0);
    let cursor = cutY;
    ctx.font = '600 9px ui-monospace, monospace';
    layers.forEach((layer) => {
        const thickness = Math.max(4, Math.min(26, layer.value * 0.9));
        ctx.fillStyle = layer.colour;
        ctx.fillRect(cutX, cursor, cutW, thickness);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.strokeRect(cutX, cursor, cutW, thickness);
        ctx.fillStyle = '#334155';
        ctx.fillText(`${layer.label} ${layer.value} mm`, cutX, cursor + thickness + 10);
        cursor += thickness + 18;
    });

    // Footer note.
    ctx.fillStyle = '#64748b';
    ctx.font = '500 9px ui-monospace, monospace';
    ctx.fillText(`${design.substrate.label} · ${design.covering.coats} coat system · ${design.drying.recoatHours} h recoat`, pad.left, height - 22);
    ctx.fillText(`waste ${Math.round(design.areas.waste * 100)}% · ${design.rows.length} material lines · $${design.costs.total.toFixed(0)}`, pad.left, height - 8);
}
