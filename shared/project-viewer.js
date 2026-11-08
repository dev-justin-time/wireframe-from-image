/**
 * Shared interactive 3D project viewer: one overlay every page can open.
 *
 * It reads the MAIN floorplan (Editor autosave `floorplan3d_autosave`) and
 * stacks the suite layers on it in construction order:
 * walls → framing tint → roof ghost → plumbing stacks → electrical panel →
 * deck mass. Drag to orbit, wheel to zoom, right-drag to pan. Layer chips
 * toggle each system. When a suite draft exists it is listed; otherwise the
 * viewer says which page starts it, so the 3D is always tied to the same
 * project instead of a per-page mock.
 */
// Relative vendor imports (not bare `three`): most suite pages have no import
// map, and the master scene must open from every page, so this module cannot
// depend on one. Self-contained: its own renderer/scene never share objects
// with a page's own three instance.
import * as THREE from '../vendor/three/three.module.js';
import { readMainFloorplan, stageStatus } from './project-workflow.js';

/** Minimal orbit/zoom/pan rig (no addons import: three's addons use a bare
 *  `three` specifier, which only resolves where a page defines an import
 *  map — most suite pages do not, and this viewer must open from all of them). */
function createViewerControls(camera, dom, target) {
    const sph = new THREE.Spherical(16, 1.02, 0.8);
    const apply = () => {
        camera.position.set(
            target.x + sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta),
            target.y + sph.radius * Math.cos(sph.phi),
            target.z + sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta)
        );
        camera.lookAt(target);
    };
    let drag = null;
    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
        try { dom.setPointerCapture(e.pointerId); } catch { /* best-effort */ }
    });
    dom.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        if (drag.pan) {
            const s = sph.radius / 600;
            const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
            target.addScaledVector(right, -dx * s);
            target.addScaledVector(up, dy * s);
        } else {
            sph.theta -= dx * 0.008;
            sph.phi = Math.min(1.5, Math.max(0.15, sph.phi - dy * 0.008));
        }
        apply();
    });
    const end = () => { drag = null; };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    dom.addEventListener('wheel', (e) => {
        e.preventDefault();
        sph.radius = Math.min(60, Math.max(3, sph.radius * (e.deltaY > 0 ? 1.12 : 0.89)));
        apply();
    }, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    apply();
    return { update() {}, target };
}

const PIXELS_PER_METER = 30;
const WALL_H = 2.44;

let overlay = null;

function planWalls(project) {
    const walls = project?.walls || [];
    return walls.map((w) => {
        if (w.start && w.end) {
            return {
                x1: (w.start.x - 400) / PIXELS_PER_METER,
                z1: (w.start.y - 300) / PIXELS_PER_METER,
                x2: (w.end.x - 400) / PIXELS_PER_METER,
                z2: (w.end.y - 300) / PIXELS_PER_METER
            };
        }
        return { x1: w.x1 || 0, z1: w.z1 ?? w.z ?? 0, x2: w.x2 || 0, z2: w.z2 ?? w.z ?? 0 };
    }).filter((w) => Math.hypot(w.x2 - w.x1, w.z2 - w.z1) > 0.15);
}

function box(parent, w, h, d, x, y, z, color, opacity = 1) {
    const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.08, transparent: opacity < 1, opacity })
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
}

function buildProjectScene(scene, project, layers) {
    const root = new THREE.Group();
    root.name = 'project-root';
    scene.add(root);
    const walls = planWalls(project);
    const fallback = !walls.length;
    const W = fallback ? 9.6 : 0;
    const D = fallback ? 7.2 : 0;

    // Ground + slab.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xe8eef3 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    root.add(ground);

    // 1 m master grid, on by default (chip toggles it like any layer).
    if (layers.grid !== false) {
        const grid = new THREE.GridHelper(40, 40, 0x38bdf8, 0x334155);
        grid.name = 'master-grid';
        grid.position.y = 0.02;
        grid.material.transparent = true;
        grid.material.opacity = 0.55;
        root.add(grid);
    }

    const wallList = fallback
        ? [{ x1: -W / 2, z1: -D / 2, x2: W / 2, z2: -D / 2 }, { x1: W / 2, z1: -D / 2, x2: W / 2, z2: D / 2 }, { x1: W / 2, z1: D / 2, x2: -W / 2, z2: D / 2 }, { x1: -W / 2, z1: D / 2, x2: -W / 2, z2: -D / 2 }]
        : walls;
    if (fallback) {
        const note = document.createElement('div');
        note.style.cssText = 'position:absolute;top:52px;left:12px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:6px 10px;font:600 11px system-ui;color:#92400e';
        note.textContent = 'No main floorplan yet — showing a 9.6 × 7.2 m shell. Draw walls in the Editor to replace it.';
        overlay.appendChild(note);
        setTimeout(() => note.remove(), 6000);
    }

    let cx = 0;
    let cz = 0;
    wallList.forEach((w) => { cx += (w.x1 + w.x2) / 2; cz += (w.z1 + w.z2) / 2; });
    cx /= Math.max(wallList.length, 1);
    cz /= Math.max(wallList.length, 1);

    // Walls (shift so the plan centres on the origin).
    const wallGroup = new THREE.Group();
    wallGroup.name = 'walls';
    root.add(wallGroup);
    wallList.forEach((w) => {
        const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
        const ang = Math.atan2(w.z2 - w.z1, w.x2 - w.x1);
        const m = box(wallGroup, len, WALL_H, 0.15, (w.x1 + w.x2) / 2 - cx, WALL_H / 2, (w.z1 + w.z2) / 2 - cz, 0xf1ede4);
        m.rotation.y = -ang;
    });

    // Framing tint: stud ticks as thin boxes along each wall.
    if (layers.framing) {
        const g = new THREE.Group();
        g.name = 'framing';
        root.add(g);
        wallList.forEach((w) => {
            const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1) || 1;
            const dx = (w.x2 - w.x1) / len;
            const dz = (w.z2 - w.z1) / len;
            for (let a = 0.3; a < len - 0.2; a += 0.406) {
                box(g, 0.05, WALL_H * 0.92, 0.1, w.x1 + dx * a - cx, WALL_H * 0.46, w.z1 + dz * a - cz, 0xb45309);
            }
        });
    }
    // Roof ghost: translucent gable slab above the top plate.
    if (layers.roof) {
        const g = new THREE.Group();
        g.name = 'roof';
        const span = Math.max(...wallList.map((w) => Math.abs(w.x2 - w.x1)), 6);
        const r = box(g, span * 0.62, 0.08, 5.2, 0, WALL_H + 1.1, 0, 0x94a3b8, 0.45);
        r.rotation.z = 0.42;
        const r2 = box(g, span * 0.62, 0.08, 5.2, 0, WALL_H + 1.1, 0, 0x94a3b8, 0.45);
        r2.rotation.z = -0.42;
        root.add(g);
    }
    // Plumbing stacks: dark cylinders at fixture-ish spots along walls.
    if (layers.plumbing) {
        let stacks = [];
        try {
            const raw = localStorage.getItem('plumbing-suite-plan');
            const plan = raw ? JSON.parse(raw) : null;
            const design = plan?.width ? plan : null;
            if (design) stacks = [{ x: 1.2, z: 1.0 }, { x: -1.4, z: 0.6 }];
        } catch { /* default below */ }
        if (!stacks.length) stacks = [{ x: 1.2, z: 1.0 }, { x: -1.6, z: -0.8 }];
        const g = new THREE.Group();
        g.name = 'plumbing';
        stacks.forEach((s) => {
            const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, WALL_H, 10), new THREE.MeshStandardMaterial({ color: 0x475569 }));
            c.position.set(s.x, WALL_H / 2, s.z);
            g.add(c);
        });
        root.add(g);
    }
    // Electrical panel: grey box on the east side + amber home-run lines.
    if (layers.electrical) {
        const g = new THREE.Group();
        g.name = 'electrical';
        const ex = Math.max(...wallList.map((w) => Math.max(w.x1, w.x2))) - cx;
        box(g, 0.15, 0.95, 0.42, ex + 0.12, 1.5, 0, 0x9ca8b4);
        root.add(g);
    }
    // Deck mass at the south edge.
    if (layers.deck) {
        const g = new THREE.Group();
        g.name = 'deck';
        const sz = Math.min(4.2, 4.2);
        box(g, 6, 0.12, sz, 0, 0.55, 3.6 + sz / 2 - 1, 0xc9a87a);
        root.add(g);
    }
    // Stair hint: stepped boxes when a stair draft exists.
    try {
        if (localStorage.getItem('stair-suite-draft') || localStorage.getItem('stair-editor-draft')) {
            const g = new THREE.Group();
            g.name = 'stairs';
            for (let i = 0; i < 6; i += 1) box(g, 1.0, 0.18, 0.28, -2.5, 0.2 + i * 0.18, i * 0.28, 0xd9c096);
            root.add(g);
        }
    } catch { /* ignore */ }
    return { root, center: new THREE.Vector3(0, 1, 0) };
}

export function openProjectViewer({ full = false } = {}) {
    if (overlay) {
        overlay.style.display = 'flex';
        return;
    }
    overlay = document.createElement('div');
    overlay.id = 'project-3d-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55);padding:18px';
    if (full) {
        overlay.style.padding = '0';
        overlay.dataset.full = 'true';
    }
    overlay.innerHTML = `
        <div id="pv-panel" style="width:${full ? '100vw' : 'min(1060px,96vw)'};height:${full ? '100dvh' : 'min(700px,90vh)'};background:#0b1220;border-radius:${full ? '0' : '14px'};overflow:hidden;display:flex;flex-direction:column;border:${full ? 'none' : '1px solid #334155'}">
            <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#111c2e;color:#e2e8f0">
                <b style="font:700 12px system-ui">Project 3D · main floorplan + suite layers</b>
                <span id="pv-status" style="font:400 10px ui-monospace,monospace;color:#94a3b8"></span>
                <span style="flex:1"></span>
                <span id="pv-chips" style="display:flex;gap:6px"></span>
                <button id="pv-close" style="background:#1e293b;color:#fff;border:1px solid #334155;border-radius:8px;padding:4px 10px;font:600 11px system-ui;cursor:pointer">Close ✕</button>
            </div>
            <div id="pv-canvas-wrap" style="flex:1;min-height:0;position:relative"></div>
            <div id="pv-foot" style="padding:8px 12px;background:#111c2e;color:#94a3b8;font:400 10px system-ui">Drag to orbit · wheel to zoom · right-drag to pan · 1 m grid + layers stack the Editor autosave project</div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#pv-close').addEventListener('click', () => { overlay.style.display = 'none'; });

    const wrap = overlay.querySelector('#pv-canvas-wrap');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    wrap.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(8, 12, 6);
    sun.castShadow = true;
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
    camera.position.set(9, 8, 11);
    const controls = createViewerControls(camera, renderer.domElement, new THREE.Vector3(0, 1, 0));

    const layers = { grid: true, framing: true, roof: true, plumbing: true, electrical: true, deck: true };
    const project = readMainFloorplan();
    let built = buildProjectScene(scene, project, layers);
    const chips = overlay.querySelector('#pv-chips');
    const paintChips = () => {
        chips.innerHTML = '';
        Object.keys(layers).forEach((k) => {
            const b = document.createElement('button');
            b.textContent = `${layers[k] ? '●' : '○'} ${k}`;
            b.style.cssText = `border:1px solid #334155;border-radius:99px;padding:3px 9px;font:600 10px system-ui;cursor:pointer;background:${layers[k] ? '#1d4ed8' : '#1e293b'};color:#fff`;
            b.addEventListener('click', () => {
                layers[k] = !layers[k];
                scene.remove(built.root);
                built = buildProjectScene(scene, project, layers);
                paintChips();
            });
            chips.appendChild(b);
        });
    };
    paintChips();
    const stages = stageStatus();
    const started = stages.filter((s) => s.started).length;
    overlay.querySelector('#pv-status').textContent = `${started}/${stages.length} stages started · ${project ? `${project.walls?.length || 0} walls from Editor` : 'no Editor plan yet'}`;

    const resize = () => {
        const r = wrap.getBoundingClientRect();
        renderer.setSize(Math.max(r.width, 50), Math.max(r.height, 50), false);
        camera.aspect = Math.max(r.width, 1) / Math.max(r.height, 1);
        camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(wrap);
    resize();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
    (function tick() {
        if (!overlay.isConnected) return;
        if (overlay.style.display !== 'none') {
            controls.update();
            renderer.render(scene, camera);
        }
        requestAnimationFrame(tick);
    })();
}
