import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ConversionEngine3D } from '../engine/3dConversionEngine.js';
import { graphFromWalls } from '../core/floorplan-graph.js';
import { measurePlan } from '../core/measurements.js';
import { WALL_HEIGHT } from '../core/world-space.js';
import { fitCameraToGraph } from '../scene/scene-camera.js';

// Floorplan mini-demos
import { FloorplanSyncDemo } from './demo-floorplan-sync.js';
import { MaterialSystemDemo } from './demo-material-system.js';
import { FloorplanUploadDemo } from './demo-floorplan-upload.js';
import { PlacementConstraintsDemo } from './demo-placement-constraints.js';

// ----------- Core Demo State -----------

const AppState = {
  viewMode: '2d', // '2d' | '3d'
  walls: [],
  fixtures: [],
  isDrawingWall: false,
  wallStart: null,
  showDimensions: true,
  showGrid2D: true,
  showGrid3D: true,
  showAxes3D: false,
  showCeiling: false,
  showRoof: false,
  backgroundImage: null,
  backgroundScale: 1.0,
  gridSize: 30
};

let blueprintCanvas, blueprintCtx;
let scene3D, camera3D, renderer3D, controls3D, walkControls;
let conversionEngine;
const walkKeys = new Set();
const walkRaycaster = new THREE.Raycaster();
const walkForward = new THREE.Vector3();
const walkRight = new THREE.Vector3();
const walkMove = new THREE.Vector3();
const walkClock = new THREE.Clock();
const walkObstacles = [];
let gridHelper3D, axesHelper3D;

// ----------- Initialization -----------

document.addEventListener('DOMContentLoaded', () => {
  init2D();
  init3D();
  wireToolbar();
  wireUploadModal();
  wireDemoPlanButtons();
  initEmbeddedDemos();
  seedFarmhouseDemo();
  draw2D();
  animate3D();
});

// ----------- Default plan: Southern Farmhouse demo -----------
// The demo opens on the same default floorplan every other page uses. The
// JSON asset is the Editor autosave shape, so walls/fixtures map 1:1.
async function seedFarmhouseDemo() {
  if (AppState.walls.length > 0) return;
  try {
    const res = await fetch('../assets/southern-farmhouse-plan.json', { cache: 'no-store' });
    if (!res.ok) return;
    const plan = await res.json();
    applyDemoPlan(plan);
  } catch {
    // Offline or file:// fetch failure: stay on the blank canvas.
  }
}

function applyDemoPlan(plan) {
  const story = plan?.stories?.[0] || plan || {};
  const walls = story.walls || plan.walls || [];
  const fixtures = story.fixtures || plan.fixtures || [];
  AppState.walls = walls
    .filter((w) => w?.start && w?.end)
    .map((w) => ({ start: { x: w.start.x, y: w.start.y }, end: { x: w.end.x, y: w.end.y } }));
  AppState.fixtures = fixtures.map((f) => ({
    type: f.type,
    x: f.x,
    y: f.y,
    rotation: f.rotation || 0
  }));
  // Remember it as the shared autosave too, so the Editor and suites open
  // on this same plan without a second fetch.
  try {
    if (!localStorage.getItem('floorplan3d_autosave')) {
      localStorage.setItem('floorplan3d_autosave', JSON.stringify(plan));
    }
  } catch {}
  update3DFrom2D();
  draw2D();
}

function refreshDemoPerfHud() {
  const el = document.getElementById('demo-perf-hud');
  if (!el) return;
  try {
    const info = renderer3D?.info;
    if (!info || (AppState.viewMode !== '3d' && AppState.viewMode !== 'first-person')) {
      el.classList.add('hidden');
      return;
    }
    const tris = info.render?.triangles ?? 0;
    el.classList.remove('hidden');
    el.textContent = `${demoPerfFps} fps · ${info.render?.calls ?? 0} calls · ${tris >= 1000 ? `${(tris / 1000).toFixed(1)}k` : tris} tris`;
  } catch {
    el.classList.add('hidden');
  }
}

function wireDemoPlanButtons() {
  document.getElementById('demo-load-farmhouse')?.addEventListener('click', async () => {
    try {
      const res = await fetch('../assets/southern-farmhouse-plan.json', { cache: 'no-store' });
      applyDemoPlan(await res.json());
    } catch {
      alert('Could not load the demo plan.');
    }
  });
  document.getElementById('demo-new-plan')?.addEventListener('click', () => {
    AppState.walls = [];
    AppState.fixtures = [];
    update3DFrom2D();
    draw2D();
  });
}

// ----------- 2D Blueprint ----------

function init2D() {
  blueprintCanvas = document.getElementById('blueprint-canvas');
  if (!blueprintCanvas) return;
  blueprintCtx = blueprintCanvas.getContext('2d');

  resize2D();

  blueprintCanvas.addEventListener('pointerdown', onPointerDown2D);
  window.addEventListener('pointermove', onPointerMove2D); // Listen on window for smooth dragging
  window.addEventListener('pointerup', onPointerUp2D); // Listen on window to catch release outside
  window.addEventListener('resize', () => {
    resize2D();
    draw2D();
  });
}

function resize2D() {
  if (!blueprintCanvas) return;
  const parent = blueprintCanvas.parentElement;
  if (!parent) return;
  blueprintCanvas.width = parent.clientWidth;
  blueprintCanvas.height = parent.clientHeight;
  draw2D();
}

function onPointerDown2D(e) {
  const pos = getCanvasPos(e);
  const activeTool = getActiveTool();

  if (activeTool === 'wall') {
    AppState.isDrawingWall = true;
    AppState.wallStart = pos;
    // Capture pointer to ensure we get events even if mouse leaves canvas
    if(e.target.setPointerCapture) {
        try { e.target.setPointerCapture(e.pointerId); } catch(err){}
    }
    draw2D(pos); // Draw initial point/grid snap
  }
}

function onPointerMove2D(e) {
  if (!AppState.isDrawingWall) {
      // Optional: Hover effect for grid snapping visualization could go here
      return;
  }
  const pos = getCanvasPos(e);
  draw2D(pos);
}

function onPointerUp2D(e) {
  if (!AppState.isDrawingWall) return;
  const end = getCanvasPos(e);
  const start = AppState.wallStart;
  const minLen = 10;

  const len = Math.hypot(end.x - start.x, end.y - start.y);
  if (len >= minLen) {
    AppState.walls.push({
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y }
    });
    update3DFrom2D();
  }

  AppState.isDrawingWall = false;
  AppState.wallStart = null;
  
  if(e.target.releasePointerCapture) {
      try { e.target.releasePointerCapture(e.pointerId); } catch(err){}
  }
  
  draw2D();
}

function getCanvasPos(e) {
  const rect = blueprintCanvas.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;

  // Snap to grid if enabled
  if (AppState.gridSize > 0) {
    const g = AppState.gridSize;
    x = Math.round(x / g) * g;
    y = Math.round(y / g) * g;
  }
  return { x, y };
}

function draw2D(previewEnd = null) {
  if (!blueprintCtx) return;
  const ctx = blueprintCtx;
  const w = blueprintCanvas.width;
  const h = blueprintCanvas.height;
  
  const isDark = document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');

  ctx.clearRect(0, 0, w, h);

  // Background - Dark Mode Support
  ctx.fillStyle = isDark ? '#111827' : '#f8fafc'; // gray-900 or slate-50
  ctx.fillRect(0, 0, w, h);

  // Optional background blueprint image
  if (AppState.backgroundImage) {
    const img = AppState.backgroundImage;
    const baseScale = Math.min(w / img.width, h / img.height) * 0.9;
    const scale = baseScale * AppState.backgroundScale;
    const dx = (w - img.width * scale) / 2;
    const dy = (h - img.height * scale) / 2;
    ctx.globalAlpha = 0.3;
    ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale);
    ctx.globalAlpha = 1.0;
  }

  // Grid
  if (AppState.showGrid2D) {
    ctx.strokeStyle = isDark ? '#374151' : '#e5e7eb'; // Darker grid lines for dark mode
    ctx.lineWidth = 1;
    ctx.beginPath();
    const g = AppState.gridSize;
    // Draw grid relative to canvas
    for (let x = 0; x < w; x += g) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y < h; y += g) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
  }

  // Walls
  AppState.walls.forEach(wall => drawWall2D(wall.start, wall.end, false, isDark));

  // Preview wall while drawing
  if (AppState.isDrawingWall && AppState.wallStart && previewEnd) {
    drawWall2D(AppState.wallStart, previewEnd, true, isDark);
    
    // Draw snap point indicator
    ctx.fillStyle = isDark ? '#60a5fa' : '#3b82f6';
    ctx.beginPath();
    ctx.arc(previewEnd.x, previewEnd.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWall2D(start, end, isPreview = false, isDark = false) {
  const ctx = blueprintCtx;
  if (!ctx) return;

  // Base shadow
  ctx.strokeStyle = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(15, 23, 42, 0.25)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Main stroke
  ctx.strokeStyle = isPreview ? (isDark ? '#9ca3af' : '#9ca3af') : (isDark ? '#60a5fa' : '#2563eb'); // Brighter blue in dark mode
  ctx.lineWidth = 6;
  if (isPreview) ctx.setLineDash([10, 6]);
  else ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Endpoints
  ctx.fillStyle = isDark ? '#3b82f6' : '#1d4ed8';
  ctx.beginPath();
  ctx.arc(start.x, start.y, 5, 0, Math.PI * 2);
  ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(start.x, start.y, 2, 0, Math.PI * 2);
  ctx.arc(end.x, end.y, 2, 0, Math.PI * 2);
  ctx.fill();

  // Dimension label
  if (AppState.showDimensions) {
    const lenPx = Math.hypot(end.x - start.x, end.y - start.y);
    const meters = (lenPx / 30).toFixed(1) + 'm';
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    const metrics = ctx.measureText(meters);
    const pad = 4;

    ctx.fillStyle = isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255,255,255,0.9)'; // Dark bg for label in dark mode
    ctx.beginPath();
    ctx.roundRect(midX - metrics.width / 2 - pad, midY - 12, metrics.width + pad * 2, 18, 6);
    ctx.fill();

    ctx.fillStyle = isDark ? '#f3f4f6' : '#111827';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meters, midX, midY - 3);
  }
}

// ----------- 3D Preview ----------

function init3D() {
  const container = document.getElementById('render-3d-view');
  if (!container) return;

  scene3D = new THREE.Scene();
  scene3D.background = new THREE.Color(0xf1f5f9);

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  camera3D = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera3D.position.set(8, 6, 8);

  renderer3D = new THREE.WebGLRenderer({ antialias: true });
  renderer3D.setPixelRatio(window.devicePixelRatio);
  renderer3D.setSize(width, height);
  renderer3D.shadowMap.enabled = true;
  container.appendChild(renderer3D.domElement);

  controls3D = new OrbitControls(camera3D, renderer3D.domElement);
  controls3D.enableDamping = true;
  controls3D.dampingFactor = 0.05;
  controls3D.maxPolarAngle = Math.PI / 2;
  walkControls = new PointerLockControls(camera3D, renderer3D.domElement);
  renderer3D.outputColorSpace = THREE.SRGBColorSpace;
  renderer3D.toneMapping = THREE.ACESFilmicToneMapping;
  renderer3D.toneMappingExposure = 1.05;
  renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer3D.domElement.addEventListener('click', () => {
    if (AppState.viewMode === 'first-person' && !walkControls.isLocked) walkControls.lock();
  });
  walkControls.addEventListener('unlock', () => {
    walkKeys.clear();
    if (AppState.viewMode === 'first-person') setView('3d');
  });
  window.addEventListener('keydown', (event) => {
    if (AppState.viewMode !== 'first-person') return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
      event.preventDefault();
      walkKeys.add(key);
    }
  });
  window.addEventListener('keyup', (event) => walkKeys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => walkKeys.clear());

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene3D.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(10, 15, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  scene3D.add(dir);

  // Grid & axes
  gridHelper3D = new THREE.GridHelper(20, 20, 0x94a3b8, 0xe5e7eb);
  scene3D.add(gridHelper3D);

  axesHelper3D = new THREE.AxesHelper(2);
  axesHelper3D.visible = AppState.showAxes3D;
  scene3D.add(axesHelper3D);

  // Conversion engine for floorplan
  conversionEngine = new ConversionEngine3D(scene3D);

  window.addEventListener('resize', () => {
    if (!renderer3D) return;
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    renderer3D.setSize(w, h);
    camera3D.aspect = w / h;
    camera3D.updateProjectionMatrix();
  });
}

function update3DFrom2D() {
  if (!conversionEngine || !blueprintCanvas) return;

  // Rebuild the graph from the 2D walls: nodes are shared corners, so the 3D
  // scene, the 2D canvas and the measurements all reference the same geometry.
  const view = { width: blueprintCanvas.width, height: blueprintCanvas.height };
  const graph = graphFromWalls(AppState.walls, view, { snapPixels: 2 });
  const walls = graph.toCanvasWalls(view);

  const appState = {
    stories: [{
      id: 'demo_story',
      walls,
      fixtures: AppState.fixtures,
      height: WALL_HEIGHT
    }],
    currentStoryIndex: 0,
    walls,
    fixtures: AppState.fixtures,
    measurements: measurePlan(graph),
    showMeasurements: AppState.showDimensions,
    fixtureStyles: {},
    showCeiling: AppState.showCeiling,
    showRoof: AppState.showRoof,
    defaultWallTexture: null,
    defaultFloorTexture: 'tile',
    selectedFixture: null
  };

  conversionEngine.convert(appState, blueprintCanvas.width, blueprintCanvas.height);

  // Frame the first non-empty plan, then leave the camera to the user.
  if (!AppState.hasFramed3D && graph.edges.length > 0 && camera3D && controls3D) {
    fitCameraToGraph(camera3D, controls3D, graph, { targetHeight: WALL_HEIGHT * 0.45 });
    AppState.hasFramed3D = true;
  }
  if (graph.edges.length === 0) AppState.hasFramed3D = false;

  walkObstacles.length = 0;
  scene3D.traverse((object) => {
    if (object.isMesh && object.visible) walkObstacles.push(object);
  });
}

let demoPerfFrames = 0, demoPerfLast = 0, demoPerfFps = 0;

function animate3D() {
  requestAnimationFrame(animate3D);
  if (!renderer3D || !camera3D || !scene3D) return;
  if (AppState.viewMode !== '3d' && AppState.viewMode !== 'first-person') return;
  // Perf HUD (labs dashboard, docs/audit.md §7): fps + last-frame renderer info.
  const now = performance.now();
  demoPerfFrames += 1;
  if (now - demoPerfLast >= 500) {
    demoPerfFps = Math.round((demoPerfFrames * 1000) / Math.max(now - demoPerfLast, 1));
    demoPerfFrames = 0;
    demoPerfLast = now;
    refreshDemoPerfHud();
  }

  const delta = Math.min(walkClock.getDelta(), 0.05);
  if (AppState.viewMode === 'first-person' && walkControls.isLocked) {
    walkForward.set(0, 0, -1).applyQuaternion(camera3D.quaternion);
    walkForward.y = 0;
    walkForward.normalize();
    walkRight.set(-walkForward.z, 0, walkForward.x);
    walkMove.set(0, 0, 0);

    if (walkKeys.has('w') || walkKeys.has('arrowup')) walkMove.add(walkForward);
    if (walkKeys.has('s') || walkKeys.has('arrowdown')) walkMove.sub(walkForward);
    if (walkKeys.has('d') || walkKeys.has('arrowright')) walkMove.add(walkRight);
    if (walkKeys.has('a') || walkKeys.has('arrowleft')) walkMove.sub(walkRight);

    if (walkMove.lengthSq() > 0) {
      walkMove.normalize();
      const distance = 3.2 * delta;
      const origin = camera3D.position;
      walkRaycaster.far = 0.48;
      for (const height of [0.45, 1.35]) {
        walkRaycaster.ray.origin.set(origin.x, height, origin.z);
        walkRaycaster.ray.direction.copy(walkMove);
        if (walkRaycaster.intersectObjects(walkObstacles, true).length) {
          walkMove.set(0, 0, 0);
          break;
        }
      }

      camera3D.position.addScaledVector(walkMove, distance);
      camera3D.position.y = 1.6;
    }
  } else if (AppState.viewMode === '3d') {
    controls3D.update();
  }

  renderer3D.render(scene3D, camera3D);
}

// ----------- UI Wiring ----------

function getActiveTool() {
  const active = document.querySelector('.tool-btn.active');
  if (!active) return 'wall';
  const id = active.id || '';
  if (id.startsWith('tool-')) return id.replace('tool-', '');
  return 'wall';
}

function wireToolbar() {
  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      blueprintCanvas.style.cursor = getActiveTool() === 'delete' ? 'not-allowed' : 'crosshair';
    });
  });

  // Item buttons
  document.querySelectorAll('.item-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.item-button').forEach(b => b.classList.remove('ring-2', 'ring-primary'));
      btn.classList.add('ring-2', 'ring-primary');
      const item = btn.dataset.item;
      if (item) setQuickPlaceItem(item);
    });
  });

  // View switcher buttons
  window.setView = setView;
  setView('2d');

  // Settings toggles (header menu)
  window.toggleDimensions = () => {
    AppState.showDimensions = !AppState.showDimensions;
    draw2D();
  };
  window.toggleGrid2D = () => {
    AppState.showGrid2D = !AppState.showGrid2D;
    draw2D();
  };
  window.toggleGrid3D = () => {
    AppState.showGrid3D = !AppState.showGrid3D;
    if (gridHelper3D) gridHelper3D.visible = AppState.showGrid3D;
  };
  window.toggleAxes3D = () => {
    AppState.showAxes3D = !AppState.showAxes3D;
    if (axesHelper3D) axesHelper3D.visible = AppState.showAxes3D;
  };
  window.toggleCeiling = () => {
    AppState.showCeiling = !AppState.showCeiling;
    update3DFrom2D();
  };
  window.toggleRoof = () => {
    AppState.showRoof = !AppState.showRoof;
    update3DFrom2D();
  };
  window.setBgScale = (val) => {
    AppState.backgroundScale = parseFloat(val) || 1;
    draw2D();
  };
  // The slider's value label used to be mirrored by an `oninput` expression;
  // with a CSP the input calls this instead (see shared/site.js `data-input`).
  window.setBgScaleAndLabel = (val, el) => {
    window.setBgScale(val);
    if (el?.nextElementSibling) el.nextElementSibling.textContent = `${val}x`;
  };

  // Export handlers
  window.exportBlueprint = exportBlueprint;
  window.export3D = (fmt) => {
    alert(`3D export (${fmt}) is available in the full Editor. This demo focuses on the engine preview.`);
  };
  window.exportProject = () => {
    const data = {
      walls: AppState.walls,
      fixtures: AppState.fixtures
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floorplan-project.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Mobile dropdown toggles
  window.toggleDropdown = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden');
  };
}

function getPlanBounds() {
  if (!blueprintCanvas) return { x: 0, z: 0, width: 10, depth: 10 };
  const points = AppState.walls.flatMap((wall) => [wall.start, wall.end]);
  if (!points.length) return { x: 0, z: 0, width: 10, depth: 10 };
  const xs = points.map((point) => (point.x - blueprintCanvas.width / 2) / 30);
  const zs = points.map((point) => -(point.y - blueprintCanvas.height / 2) / 30);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
}

function setView(mode) {
  AppState.viewMode = mode;

  const v2d = document.getElementById('view-2d');
  const v3d = document.getElementById('view-3d');
  const btn2d = document.getElementById('btn-view-2d');
  const btn3d = document.getElementById('btn-view-3d');
  const btnFp = document.getElementById('btn-view-fp');
  const rendererView = document.getElementById('render-3d-view');
  const panoramaCanvas = document.getElementById('cv');
  const toolsPanel = document.getElementById('tools-panel');
  const walkInstructions = document.getElementById('walk-instructions');

  if (rendererView) rendererView.classList.toggle('hidden', mode === '2d');
  if (panoramaCanvas) panoramaCanvas.classList.add('hidden');
  if (toolsPanel) toolsPanel.classList.toggle('hidden', mode !== '2d');
  if (walkInstructions) walkInstructions.classList.toggle('hidden', mode !== 'first-person');

  if (btn2d && btn3d && btnFp) {
    [btn2d, btn3d, btnFp].forEach(b => {
      b.classList.remove('bg-white', 'shadow', 'text-gray-900');
      b.classList.add('text-gray-600');
    });
    const activeBtn = mode === '2d' ? btn2d : mode === '3d' ? btn3d : btnFp;
    activeBtn.classList.remove('text-gray-600');
    activeBtn.classList.add('bg-white', 'shadow', 'text-gray-900');
  }

  if (v2d && v3d) {
    if (mode === '2d') {
      if (walkControls?.isLocked) walkControls.unlock();
      v2d.style.opacity = '1';
      v2d.style.pointerEvents = 'auto';
      v3d.style.opacity = '0';
      v3d.style.pointerEvents = 'none';
    } else {
      v2d.style.opacity = '0';
      v2d.style.pointerEvents = 'none';
      v3d.style.opacity = '1';
      v3d.style.pointerEvents = 'auto';
      update3DFrom2D();
      if (rendererView && renderer3D) {
        const width = rendererView.clientWidth || window.innerWidth;
        const height = rendererView.clientHeight || window.innerHeight;
        renderer3D.setSize(width, height);
        camera3D.aspect = width / height;
        camera3D.updateProjectionMatrix();
      }

      if (mode === 'first-person') {
        controls3D.enabled = false;
        const bounds = getPlanBounds();
        camera3D.position.set(bounds.x, 1.6, bounds.z + 1.5);
        camera3D.lookAt(bounds.x, 1.6, bounds.z);
        walkClock.start();
      } else {
        if (walkControls?.isLocked) walkControls.unlock();
        controls3D.enabled = true;
        const bounds = getPlanBounds();
        const distance = Math.max(bounds.width, bounds.depth, 6) * 1.15;
        controls3D.target.set(bounds.x, 0, bounds.z);
        camera3D.position.set(bounds.x + distance * 0.8, distance * 0.65, bounds.z + distance * 0.8);
        controls3D.update();
      }
    }
  }
}

function exportBlueprint() {
  if (!blueprintCanvas) return;
  const link = document.createElement('a');
  link.href = blueprintCanvas.toDataURL('image/png');
  link.download = 'floorplan-2d.png';
  link.click();
}

// ----------- Upload Modal ----------

function wireUploadModal() {
  const modal = document.getElementById('upload-modal');
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-upload');

  if (!modal || !uploadArea || !fileInput) return;

  uploadArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          AppState.backgroundImage = img;
          AppState.backgroundScale = 1.0;
          draw2D();
          modal.classList.add('hidden');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          AppState.walls = data.walls || [];
          AppState.fixtures = data.fixtures || [];
          draw2D();
          update3DFrom2D();
          modal.classList.add('hidden');
        } catch (err) {
          console.error(err);
          alert('Invalid project file.');
        }
      };
      reader.readAsText(file);
    } else {
      alert('Please upload an image or JSON project file.');
    }
  });
}

// ----------- Quick Place Items (simple stubs) ----------

function setQuickPlaceItem(type) {
  // For the demo we just drop a simple fixture in center of canvas & update 3D.
  if (!blueprintCanvas) return;
  const x = blueprintCanvas.width / 2;
  const y = blueprintCanvas.height / 2;
  AppState.fixtures.push({
    type,
    x,
    y,
    rotation: 0,
    metadata: {}
  });
  update3DFrom2D();
  draw2D();
}

// ----------- Mini Floorplan Demos ----------

function initEmbeddedDemos() {
  try {
    const sync2D = document.getElementById('demo-sync-2d');
    const sync3D = document.getElementById('demo-sync-3d');
    if (sync2D && sync3D) {
      new FloorplanSyncDemo('demo-sync-2d', 'demo-sync-3d');
    }

    const materialContainer = document.getElementById('demo-material-system');
    if (materialContainer) {
      new MaterialSystemDemo('demo-material-system');
    }

    const uploadContainer = document.getElementById('demo-floorplan-upload');
    if (uploadContainer) {
      new FloorplanUploadDemo('demo-floorplan-upload');
    }

    const constraintsContainer = document.getElementById('demo-placement-constraints');
    if (constraintsContainer) {
      new PlacementConstraintsDemo('demo-placement-constraints');
    }
  } catch (err) {
    console.error('Failed to initialize embedded floorplan demos:', err);
  }
}

