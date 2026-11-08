import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Roof suite previews.
 *
 * `createRoofViewer` builds a small Three.js scene from a design object and
 * rebuilds it whenever the design changes; `drawRoofElevation` renders the
 * section through the roof on a 2D canvas. Both read the same planes, truss
 * members and eave runs as the takeoff, so the picture shows what is priced.
 */

const COVERING_FINISH = {
    shingle: { color: 0x4b4b52, roughness: 0.94, metalness: 0.02 },
    metal: { color: 0x9aa6ad, roughness: 0.3, metalness: 0.75 },
    tile: { color: 0xa9583c, roughness: 0.85, metalness: 0.03 },
    'low-slope': { color: 0x33383c, roughness: 0.82, metalness: 0.06 }
};

const GUTTER_COLOUR = {
    Aluminium: 0xd4d8db,
    'Painted steel': 0x6f7a82,
    Copper: 0xb87333
};

function disposeGroup(group) {
    group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => material.dispose());
        }
    });
    group.clear();
}

function quadGeometry(points) {
    const positions = [];
    for (let i = 1; i < points.length - 1; i += 1) {
        [points[0], points[i], points[i + 1]].forEach((point) => {
            positions.push(point.x, point.y, point.z);
        });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
}

function planeNormal(points) {
    const a = new THREE.Vector3(points[0].x, points[0].y, points[0].z);
    const b = new THREE.Vector3(points[1].x, points[1].y, points[1].z);
    const c = new THREE.Vector3(points[2].x, points[2].y, points[2].z);
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    return normal.y < 0 ? normal.negate() : normal;
}

function beamMesh(from, to, width, depth, material) {
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(length, 0.02), depth, width), material);
    const direction = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
    mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function roofGroup(design) {
    const group = new THREE.Group();
    const geometry = design.geometry;
    const finish = COVERING_FINISH[design.covering.family] || COVERING_FINISH.shingle;
    const deckMaterial = new THREE.MeshStandardMaterial({ color: 0xcaa878, roughness: 0.95, side: THREE.DoubleSide });
    const coveringMaterial = new THREE.MeshStandardMaterial({ ...finish, side: THREE.DoubleSide });
    const capMaterial = new THREE.MeshStandardMaterial({ ...finish, roughness: Math.min(finish.roughness + 0.06, 1) });
    const trussMaterial = new THREE.MeshStandardMaterial({ color: 0xb28b60, roughness: 0.82 });
    const gutterMaterial = new THREE.MeshStandardMaterial({
        color: GUTTER_COLOUR[design.gutter.material] || GUTTER_COLOUR.Aluminium,
        roughness: 0.42,
        metalness: 0.55
    });
    const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x262b2f, roughness: 0.85 });

    geometry.planes.forEach((plane) => {
        const normal = planeNormal(plane.points);
        const deck = new THREE.Mesh(quadGeometry(plane.points), deckMaterial);
        deck.position.set(-normal.x * 0.04, -normal.y * 0.04, -normal.z * 0.04);
        deck.receiveShadow = true;
        group.add(deck);

        const covering = new THREE.Mesh(quadGeometry(plane.points), coveringMaterial);
        covering.castShadow = true;
        covering.receiveShadow = true;
        group.add(covering);
    });

    // Trusses at the design spacing, capped so a long roof stays light.
    const stations = Math.min(Math.max(design.trussCount, 2), 26);
    const along = geometry.length;
    for (let i = 0; i < stations; i += 1) {
        const z = -along / 2 + (i / (stations - 1 || 1)) * along;
        design.members.forEach((member) => {
            const length = Math.hypot(member.x2 - member.x1, member.y2 - member.y1);
            if (length < 0.05) return;
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(length, 0.09, 0.038),
                trussMaterial
            );
            mesh.position.set((member.x1 + member.x2) / 2, (member.y1 + member.y2) / 2, z);
            mesh.rotation.z = Math.atan2(member.y2 - member.y1, member.x2 - member.x1);
            mesh.castShadow = true;
            group.add(mesh);
        });
    }

    // Ridge and hip caps.
    const ridgeY = geometry.rise;
    const ridgeLength = geometry.family === 'hip' ? geometry.ridgeLength : geometry.length;
    if (geometry.family !== 'shed' && ridgeLength > 0.1) {
        const cap = beamMesh(
            { x: 0, y: ridgeY + 0.05, z: -ridgeLength / 2 },
            { x: 0, y: ridgeY + 0.05, z: ridgeLength / 2 },
            0.3, 0.06, capMaterial
        );
        group.add(cap);
        if (design.config.ridgeVent) {
            const vent = beamMesh(
                { x: 0, y: ridgeY + 0.1, z: -ridgeLength / 2 },
                { x: 0, y: ridgeY + 0.1, z: ridgeLength / 2 },
                0.2, 0.03, ventMaterial
            );
            group.add(vent);
        }
    }
    if (geometry.family === 'hip') {
        const x = geometry.half + geometry.overhang;
        const z = geometry.length / 2 + geometry.overhang;
        const ridgeZ = geometry.ridgeLength / 2;
        [[x, z], [x, -z], [-x, z], [-x, -z]].forEach(([hx, hz]) => {
            const cap = beamMesh(
                { x: 0, y: ridgeY + 0.05, z: Math.sign(hz) * ridgeZ },
                { x: hx, y: 0, z: hz },
                0.28, 0.05, capMaterial
            );
            group.add(cap);
        });
    }

    // Gutters, fascia and downspouts on every eave run.
    design.eaveRuns.forEach((run) => {
        const dx = run.x2 - run.x1;
        const dz = run.z2 - run.z1;
        const runLength = Math.hypot(dx, dz);
        if (runLength < 0.1) return;
        const mid = { x: (run.x1 + run.x2) / 2, z: (run.z1 + run.z2) / 2 };
        const nx = dz / runLength;
        const nz = -dx / runLength;
        const outward = nx * mid.x + nz * mid.z >= 0 ? 1 : -1;

        const fascia = new THREE.Mesh(new THREE.BoxGeometry(runLength, 0.18, 0.04), trussMaterial);
        fascia.position.set(mid.x, run.y - 0.09, mid.z);
        fascia.rotation.y = -Math.atan2(dz, dx);
        group.add(fascia);

        if (!design.config.gutters) return;
        const trough = new THREE.Mesh(new THREE.BoxGeometry(runLength, 0.1, 0.14), gutterMaterial);
        trough.position.set(mid.x + nx * outward * 0.08, run.y - 0.13, mid.z + nz * outward * 0.08);
        trough.rotation.y = -Math.atan2(dz, dx);
        group.add(trough);

        const pipes = runLength > 10 ? [0.15, 0.85] : [0.85];
        pipes.forEach((fraction) => {
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.3, 8), gutterMaterial);
            pipe.position.set(
                run.x1 + dx * fraction + nx * outward * 0.1,
                run.y - 1.25,
                run.z1 + dz * fraction + nz * outward * 0.1
            );
            pipe.castShadow = true;
            group.add(pipe);
        });
    });

    return group;
}

export function createRoofViewer(mount) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9eef3);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 3;
    controls.maxDistance = 90;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x6b7280, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(12, 22, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.bias = -0.0006;
    scene.add(sun);

    const grid = new THREE.GridHelper(40, 40, 0xc3ccd5, 0xdbe2e8);
    grid.position.y = -0.02;
    scene.add(grid);
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

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
            model = roofGroup(design);
            model.name = 'roof-preview';
            scene.add(model);

            const span = design.geometry.span + design.geometry.overhang * 2;
            const length = design.geometry.length + design.geometry.overhang * 2;
            const reach = Math.max(span, length);
            const rise = Math.max(design.geometry.rise, 1);
            camera.position.set(reach * 0.95, rise * 1.5 + reach * 0.55, reach * 1.25);
            controls.target.set(0, rise * 0.35, 0);
            controls.update();
            sun.position.set(reach * 0.7, rise + reach * 1.1, reach * 0.5);
            grid.scale.setScalar(Math.max(reach / 20, 0.6));
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

/** Section through the roof at mid-length, with the layers called out. */
export function drawRoofElevation(canvas, design) {
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

    const geometry = design.geometry;
    const over = geometry.overhang;
    const half = geometry.half;
    const run = geometry.pitch / 12;
    const ridgeY = geometry.rise;
    const eaveY = -over * run;

    // Section silhouette per family: a polyline from the low eave up to the ridge and down.
    let outline;
    if (geometry.family === 'shed') {
        outline = [
            [-half - over, ridgeY + over * run],
            [half + over, -over * run]
        ];
    } else if (geometry.family === 'gambrel') {
        const breakX = half * 0.55;
        const lowerRise = ridgeY * 0.45;
        const lowerSlope = lowerRise / (half - breakX);
        outline = [
            [-half - over, -over * lowerSlope],
            [-breakX, lowerRise],
            [0, ridgeY],
            [breakX, lowerRise],
            [half + over, -over * lowerSlope]
        ];
    } else if (geometry.family === 'saltbox') {
        const leftRun = half + geometry.ridgeX;
        const rightRun = half - geometry.ridgeX;
        outline = [
            [-half - over, -over * (ridgeY / leftRun)],
            [geometry.ridgeX, ridgeY],
            [half + over, -over * (ridgeY / rightRun)]
        ];
    } else {
        outline = [
            [-half - over, eaveY],
            [0, ridgeY],
            [half + over, eaveY]
        ];
    }

    const minX = -half - over;
    const maxX = half + over;
    const minY = Math.min(...outline.map((point) => point[1]), 0);
    const maxY = ridgeY;
    const pad = { left: 54, right: 34, top: 46, bottom: 62 };
    const scale = Math.min(
        (width - pad.left - pad.right) / (maxX - minX || 1),
        (height - pad.top - pad.bottom) / (maxY - minY || 1)
    );
    const originX = pad.left + (width - pad.left - pad.right) / 2;
    const originY = height - pad.bottom;
    const px = (x) => originX + x * scale;
    const py = (y) => originY - (y - minY) * scale;

    // Walls and floor line.
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, py(0));
    ctx.lineTo(width - pad.right, py(0));
    ctx.stroke();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.fillRect(px(-half), py(0), scale * half * 2, 6);

    // Truss members.
    ctx.strokeStyle = '#b0895e';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    design.members.forEach((member) => {
        ctx.beginPath();
        ctx.moveTo(px(member.x1), py(member.y1));
        ctx.lineTo(px(member.x2), py(member.y2));
        ctx.stroke();
    });

    // Deck, then covering: a thin line under the outline for each layer.
    const drawOutline = (offset, colour, thickness) => {
        ctx.strokeStyle = colour;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        outline.forEach(([x, y], index) => {
            // Offset along the local normal of the section, roughly upward.
            const point = [px(x), py(y) + offset];
            if (index === 0) ctx.moveTo(point[0], point[1]);
            else ctx.lineTo(point[0], point[1]);
        });
        ctx.stroke();
    };
    drawOutline(4, '#caa878', 6);
    const finish = design.covering.family === 'tile' ? '#a9583c'
        : design.covering.family === 'metal' ? '#7f8c94'
            : design.covering.family === 'low-slope' ? '#33383c' : '#4b4b52';
    drawOutline(0, finish, 5);

    // Gutter and fascia at each eave.
    design.eaveRuns.slice(0, 2).forEach((run) => {
        const x = run.x1;
        const gutterX = px(x + Math.sign(x || 1) * over * 0.35);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(gutterX - 5, py(eaveY) + 2, 10, 9);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.strokeRect(gutterX - 5, py(eaveY) + 2, 10, 9);
    });

    // Dimensions.
    ctx.strokeStyle = '#0ea5e9';
    ctx.fillStyle = '#0369a1';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    // Span at the wall line.
    ctx.beginPath();
    ctx.moveTo(px(-half), py(0) + 22);
    ctx.lineTo(px(half), py(0) + 22);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`span ${geometry.span.toFixed(2)} m`, px(0), py(0) + 38);
    // Rise at the ridge.
    ctx.beginPath();
    ctx.moveTo(px(0) + 12, py(0));
    ctx.lineTo(px(0) + 12, py(ridgeY));
    ctx.stroke();
    ctx.save();
    ctx.translate(px(0) + 22, (py(0) + py(ridgeY)) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`rise ${ridgeY.toFixed(2)} m`, 0, 0);
    ctx.restore();

    // Layer callouts.
    ctx.textAlign = 'left';
    ctx.font = '600 10px ui-sans-serif, system-ui';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${design.style.name} · ${geometry.pitch.toFixed(2)}:12 (${geometry.angle.toFixed(1)}°)`, pad.left, 20);
    ctx.fillStyle = '#475569';
    ctx.font = '500 10px ui-monospace, monospace';
    ctx.fillText(`${design.covering.label} · ${design.sheathing.label} · ${design.underlayment.label}`, pad.left, 36);

    ctx.fillStyle = finish;
    ctx.fillRect(width - pad.right - 96, 26, 12, 8);
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 9px ui-monospace, monospace';
    ctx.fillText('covering', width - pad.right - 80, 34);
    ctx.fillStyle = '#caa878';
    ctx.fillRect(width - pad.right - 96, 40, 12, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fillText('sheathing', width - pad.right - 80, 48);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 9px ui-monospace, monospace';
    ctx.fillText(`overhang ${over.toFixed(2)} m`, pad.left, height - 18);
    ctx.fillText(`eave at ${py(0) - py(eaveY)} px`, pad.left, height - 6);
}
