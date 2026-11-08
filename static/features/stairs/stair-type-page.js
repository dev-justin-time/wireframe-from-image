/**
 * Shared logic for the dedicated stair-type designer pages
 * (L, U, spiral, steep). Each page collects its own inputs, sizes the stair
 * with the shared engine (features/stairs/design.js), draws a dimensioned
 * 2D plan preview with the same symbol the editor places
 * (features/stairs/geometry.js drawStairPlan), builds the 3D preview with
 * buildStairGeometry, and saves the same `stair-designer-draft` the editor
 * picks up — so every type lands in the plan with one click.
 */

import { computeStairDesign, STAIR_CODES } from './design.js';
import { buildStairGeometry, drawStairPlan, stairPlanBounds } from './geometry.js';

export { STAIR_CODES };

export const MM = 1000;
const IN = 0.0254;

export const codeOptions = () => Object.values(STAIR_CODES).map((c) => ({
    key: c.key, label: c.label
}));

/** Fake editor item so plan + 3D reuse the exact editor builders. */
export function stairItemFor(config) {
    return { x: 0, y: 0, rotation: 0, stair: { ...config } };
}

/** Size + validate; returns { design, item, bounds }. */
export function sizeStairType(config) {
    const design = computeStairDesign(config);
    const item = stairItemFor(config);
    const bounds = stairPlanBounds(item, { storeyHeight: config.storeyHeight, design });
    return { design, item, bounds };
}

/** Dimensioned 2D plan preview: footprint, treads, walkline, UP arrow. */
export function drawPlanPreview(canvas, item, storeyHeight, { title = '' } = {}) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(280, Math.floor(rect.width));
    const H = Math.max(240, Math.floor(rect.height));
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const design = drawStairPlanRaw(ctx, item, storeyHeight, W, H);
    void title;
    return design;
}

function drawStairPlanRaw(ctx, item, storeyHeight, W, H) {
    // Fit the footprint (plus a margin) into the canvas, then draw the real
    // editor symbol centred — so the preview IS the plan that gets placed.
    const probe = stairPlanBounds(item, { storeyHeight });
    const pad = 34;
    const scale = Math.min(
        (W - pad * 2) / Math.max(probe.width, 0.4),
        (H - pad * 2) / Math.max(probe.depth, 0.4)
    );
    const PIX = scale; // px per metre
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-W / 2, -H / 2, W, H);
    // Light grid, 0.5 m.
    ctx.strokeStyle = '#e8edf5';
    ctx.lineWidth = 1;
    const step = 0.5 * PIX;
    for (let gx = -W / 2; gx < W / 2; gx += step) {
        ctx.beginPath(); ctx.moveTo(gx, -H / 2); ctx.lineTo(gx, H / 2); ctx.stroke();
    }
    for (let gy = -H / 2; gy < H / 2; gy += step) {
        ctx.beginPath(); ctx.moveTo(-W / 2, gy); ctx.lineTo(W / 2, gy); ctx.stroke();
    }
    const design = drawStairPlan(ctx, { ...item, x: 0, y: 0, rotation: 0 }, {
        storeyHeight, scale: PIX, color: '#0ea5e9'
    });
    ctx.restore();

    // Dimensions under the symbol.
    ctx.save();
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    const label = `${probe.width.toFixed(2)} × ${probe.depth.toFixed(2)} m footprint`;
    ctx.fillText(label, W / 2, H - 10);
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${design.risers} risers · run ${Number(design.runUsed || 0).toFixed(2)} m`, W / 2, H - 24);
    ctx.restore();
    return design;
}

/** 3D preview bound to a container; call render() on each input change. */
export async function createStagePreview(stageEl) {
    const THREE = await import('three');
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stageEl.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(6, 10, 7);
    scene.add(key);
    scene.add(new THREE.GridHelper(24, 24, 0xdbe3ee, 0xe8edf5));
    let group = null;
    const resize = () => {
        const r = stageEl.getBoundingClientRect();
        const w = Math.max(280, Math.floor(r.width));
        const h = Math.max(200, Math.floor(r.height));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    };
    const render = (item, storeyHeight) => {
        if (group) {
            group.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
            scene.remove(group);
        }
        group = buildStairGeometry(item, { storeyHeight });
        scene.add(group);
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        const centre = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(centre);
        const radius = Math.max(size.x, size.y, size.z) * 0.75;
        const dist = (radius / Math.sin((camera.fov * Math.PI / 180) / 2)) * 1.5;
        camera.position.set(centre.x + dist * 0.7, centre.y + dist * 0.55, centre.z + dist * 0.9);
        camera.near = Math.max(dist / 500, 0.02);
        camera.far = dist * 8;
        camera.updateProjectionMatrix();
        controls.target.copy(centre);
        controls.update();
        resize();
        renderer.render(scene, camera);
    };
    controls.addEventListener('change', () => renderer.render(scene, camera));
    window.addEventListener('resize', () => { resize(); renderer.render(scene, camera); });
    resize();
    return { render, resize };
}

/** Generic takeoff rows shared by every stair type page. */
export function takeoffRows(design, extra = []) {
    const rows = [
        ['treads', design.treads ?? design.steps ?? 0, `${in2(design.treadDepth)} in tread`],
        ['risers', design.risers ?? 0, `${in2(design.riserHeight)} in riser`],
        ['run used', 1, `${Number(design.runUsed || 0).toFixed(2)} m`],
        ['footprint', 1, `${Number(design.footprint.width).toFixed(2)} × ${Number(design.footprint.depth).toFixed(2)} m`],
        ['handrail', 2, 'both sides where open'],
        ...extra
    ];
    return rows;
}

export function takeoffCsv(label, design, extra = []) {
    const rows = takeoffRows(design, extra);
    return ['item,qty,note', ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
}

export const in2 = (m) => m == null ? '—' : (m / IN).toFixed(2);
export const mm1 = (m) => m == null ? '—' : `${Math.round(m * MM)} mm`;

export function checkLi(issue) {
    const icon = issue.severity === 'error' ? '✖' : issue.severity === 'warning' ? '⚠' : 'ℹ';
    const cls = issue.severity === 'error' ? 'check-error' : issue.severity === 'warning' ? 'check-warn' : 'check-info';
    return `<li class="${cls}">${icon} ${issue.message}</li>`;
}

/** Save the sized config so Editor.html places exactly this stair. */
export function saveTypeDraft(config, designer = {}) {
    try {
        localStorage.setItem('stair-designer-draft', JSON.stringify({
            stair: { ...config },
            designer: { ...designer }
        }));
        return true;
    } catch { return false; }
}

export function downloadCsv(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
