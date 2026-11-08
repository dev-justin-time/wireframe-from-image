import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
// nipplejs ships a UMD bundle, so app.html loads it as a classic script and
// the joystick manager is read off the global rather than a module import.
const nipplejs = globalThis.nipplejs;
import WebGPURenderer from 'three/addons/renderers/webgpu/WebGPURenderer.js';
import { FloorPlanProcessor } from '../../engine/floorPlanProcessor.js';
import { ConversionEngine3D } from '../../engine/3dConversionEngine.js';
import { Wall, ItemFactory } from '../../core/items.js';
import { TEXTURES, GLOBAL_CONFIG } from '../../core/metadata.js';
import { StorageManager } from '../../core/storage.js';
import { StateManager } from '../../core/state-manager.js';
import { MOCK_DATA as TEST_DATA } from '../../demo/test-data.js';

// Core Application State
const AppState = {
    currentView: 'panorama',
    isFirstPerson: false,
    isDrawing: false,
    currentTool: null,
    startPoint: null,
    
    // Multi-story Support
    stories: [
        { id: 'story_0', name: 'Ground Floor', height: 2.7, walls: [], fixtures: [] }
    ],
    currentStoryIndex: 0,
    
    // These are references to the current story's data for easier access in 2D editor
    walls: [], 
    fixtures: [],
    
    selectedFixture: null,
    fixtureStyles: {},
    isDragging: false,
    draggedItem: null,
    dragOffset: { x: 0, y: 0 },
    isDraggingWallNode: false,
    draggedWallNode: null,
    wallSplitTarget: null,
    snapToGrid: true,
    showGrid2D: true, // NEW: Independent visual toggle
    showDimensions: true,
    showCeiling: false,
    showRoof: false, // NEW: Roof State
    showGrid3D: true, // NEW
    showAxes3D: true, // NEW
    gridSize: 20,
    defaultWallTexture: null,
    defaultFloorTexture: 'tile',
    textureTarget: 'wall',
    bgScale: 1.0 // New: Nominal scale for background image
};

// Managers
let stateManager;

// Scene References
let panoramaCamera, panoramaScene, panoramaRenderer;
let floorplanCamera, floorplanScene, floorplanRenderer, floorplanControls;
let gridHelper3D, axesHelper3D; // Global refs for toggling
let fpControls; // PointerLockControls
let joystickManager; // Nipple
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

let blueprintCanvas, blueprintCtx, blueprintImage;

// Engines
const scanner = new FloorPlanProcessor();
let conversionEngine;
let dragPlane; // Plane for 3D raycasting

// Constants
const SCALE = GLOBAL_CONFIG.pixelsPerMeter;

// Add model loading support indicator
console.log('3D model loading enabled (GLTF/GLB)');

// Add UI for custom model upload
function setupCustomModelUpload() {
    const modelInput = document.createElement('input');
    modelInput.type = 'file';
    modelInput.accept = '.glb,.gltf';
    modelInput.id = 'model-upload';
    modelInput.style.display = 'none';
    document.body.appendChild(modelInput);
    
    modelInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const url = await websim.upload(file);
            const newFixture = ItemFactory.create('custom_model', 
                blueprintCanvas.width / 2, 
                blueprintCanvas.height / 2
            );
            newFixture.modelUrl = url;
            newFixture.metadata = {
                ...newFixture.metadata,
                modelUrl: url,
                width: 1,
                depth: 1,
                height: 1,
                scale: 1
            };
            
            AppState.fixtures.push(newFixture);
            stateManager.saveState();
            update3DFloorplan();
            drawBlueprint();
        } catch (error) {
            console.error('Model upload failed:', error);
            alert('Failed to upload 3D model');
        }
    });
}

function init() {
    console.log('Initializing Modular Floorplan App...');
    
    // Initialize References
    AppState.walls = AppState.stories[0].walls;
    AppState.fixtures = AppState.stories[0].fixtures;

    // Initialize State Manager
    stateManager = new StateManager(AppState, restoreStateSnapshot);
    
    initBlueprint();
    initPanorama().then(() => {
        console.log("Panorama initialized");
    });
    initFloorplan3D();
    setupEventListeners();
    
    // Detect initial tool from UI
    const activeToolBtn = document.querySelector('.tool-btn.active');
    if (activeToolBtn) {
        const tool = activeToolBtn.id.replace('tool-', '');
        setTool(tool);
    }
    
    // Initial state save
    stateManager.saveState();
    updateStorySelectUI();
    drawBlueprint();
    
    // Expose global API for UI
    window.undo = () => stateManager.undo();
    window.redo = () => stateManager.redo();
    window.AppState = AppState;
    window.toggleDimensions = () => {
        AppState.showDimensions = !AppState.showDimensions;
        drawBlueprint();
    };
    window.toggleGrid2D = () => {
        AppState.showGrid2D = !AppState.showGrid2D;
        drawBlueprint();
    };
    window.toggleGrid3D = () => {
        AppState.showGrid3D = !AppState.showGrid3D;
        if(gridHelper3D) gridHelper3D.visible = AppState.showGrid3D;
    };
    window.toggleAxes3D = () => {
        AppState.showAxes3D = !AppState.showAxes3D;
        if(axesHelper3D) axesHelper3D.visible = AppState.showAxes3D;
    };
    window.toggleCeiling = () => {
        AppState.showCeiling = !AppState.showCeiling;
        update3DFloorplan();
    };
    window.toggleRoof = () => {
        AppState.showRoof = !AppState.showRoof;
        update3DFloorplan();
    };
    window.addStory = addStory;
    window.switchStory = switchStory;
    window.exportProject = exportProject;
    window.export3D = export3D;
    window.loadTemplate = loadTemplate;
    window.setBgScale = (val) => { AppState.bgScale = parseFloat(val); drawBlueprint(); };
    window.update3DFloorplan = update3DFloorplan; // Expose for UI
    
    // Initialize Walk Mode Button
    const walkBtn = document.getElementById('walk-btn');
    if (walkBtn) {
        walkBtn.addEventListener('click', toggleFirstPersonMode);
    }

    // Load default template to ensure visual content
    loadTemplate('bedroom');
    // Force resize to ensure canvas dimensions are correct
    setTimeout(onResize, 100);
}

function toggleFirstPersonMode() {
    if (AppState.currentView !== '3d') {
        // Force 3D view
        document.getElementById('view-toggle').click();
    }
    
    AppState.isFirstPerson = !AppState.isFirstPerson;
    const instructions = document.getElementById('walk-instructions');
    const nippleZone = document.getElementById('nipple-container');
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if (AppState.isFirstPerson) {
        // Switch to First Person
        if (isMobile) {
            // Mobile Controls
            floorplanControls.enabled = false; // Disable orbit
            
            // Move camera to eye level inside the room center-ish
            floorplanCamera.position.set(0, 1.7, 0); 
            floorplanCamera.lookAt(0, 1.7, -5);
            
            nippleZone.style.display = 'block';
            initJoystick();
        } else {
            // Desktop Controls
            if (!fpControls) {
                fpControls = new PointerLockControls(floorplanCamera, document.body);
                fpControls.addEventListener('lock', () => {
                    instructions.style.display = 'block';
                });
                fpControls.addEventListener('unlock', () => {
                    instructions.style.display = 'none';
                    // If user pressed ESC, we might want to exit walk mode or just pause?
                    // For now, keep isFirstPerson true but unlocked.
                    // To fully exit, user should click 'Walk' button again or we handle it here.
                    if (AppState.isFirstPerson) { 
                         // Optional: toggleFirstPersonMode(); 
                    }
                });
            }
            
            // Reset position for walk
            floorplanCamera.position.set(0, 1.7, 0);
            floorplanCamera.lookAt(0, 1.7, -5);
            
            floorplanControls.enabled = false;
            fpControls.lock();
        }
        document.getElementById('walk-btn').classList.add('bg-primary', 'text-white');
    } else {
        // Switch back to Orbit
        if (fpControls) fpControls.unlock();
        if (joystickManager) {
            joystickManager.destroy();
            joystickManager = null;
        }
        nippleZone.style.display = 'none';
        instructions.style.display = 'none';
        
        floorplanControls.enabled = true;
        // Reset camera to top-down
        floorplanCamera.position.set(8, 6, 8);
        floorplanCamera.lookAt(0, 0, 0);
        
        document.getElementById('walk-btn').classList.remove('bg-primary', 'text-white');
    }
}

function initJoystick() {
    const zone = document.getElementById('nipple-container');
    if (!joystickManager) {
        joystickManager = nipplejs.create({
            zone: zone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: '#13a4ec'
        });
        
        joystickManager.on('move', (evt, data) => {
            const forward = data.vector.y;
            const turn = data.vector.x;
            
            // Simple movement logic for mobile
            velocity.x = forward * 0.1; // Move forward/back
            velocity.y = turn * 0.05; // Rotate
        });
        
        joystickManager.on('end', () => {
            velocity.x = 0;
            velocity.y = 0;
        });
    }
}

function restoreStateSnapshot(snapshot) {
    // Reconstruct global story structure if present
    if (snapshot.stories) {
        AppState.stories = snapshot.stories.map(s => ({
            ...s,
            walls: s.walls.map(w => Wall.fromJSON(w)),
            fixtures: s.fixtures.map(f => ItemFactory.fromJSON(f))
        }));
    } else {
        // Legacy fallback: put walls into ground floor
        AppState.stories = [{
            id: 'story_0',
            name: 'Ground Floor',
            height: 2.7,
            walls: snapshot.walls.map(w => Wall.fromJSON(w)),
            fixtures: snapshot.fixtures.map(f => ItemFactory.fromJSON(f))
        }];
    }
    
    AppState.currentStoryIndex = snapshot.currentStoryIndex || 0;
    if (AppState.currentStoryIndex >= AppState.stories.length) AppState.currentStoryIndex = 0;
    
    // Update references
    AppState.walls = AppState.stories[AppState.currentStoryIndex].walls;
    AppState.fixtures = AppState.stories[AppState.currentStoryIndex].fixtures;
    
    AppState.fixtureStyles = JSON.parse(JSON.stringify(snapshot.fixtureStyles));
    
    if (snapshot.showRoof !== undefined) AppState.showRoof = snapshot.showRoof;
    const roofToggle = document.getElementById('roof-toggle');
    if (roofToggle) roofToggle.checked = AppState.showRoof;

    if (snapshot.showCeiling !== undefined) {
        AppState.showCeiling = snapshot.showCeiling;
        const ceilingToggle = document.getElementById('ceiling-toggle');
        if (ceilingToggle) ceilingToggle.checked = AppState.showCeiling;
    }

    AppState.selectedFixture = null;
    updateStorySelectUI();
    drawBlueprint();
    update3DFloorplan();
}

// NEW: Multi-story Logic
function addStory() {
    const newId = `story_${AppState.stories.length}`;
    AppState.stories.push({
        id: newId,
        name: `Level ${AppState.stories.length}`,
        height: 2.7,
        walls: [], // Could potentially copy walls from below for ease
        fixtures: []
    });
    switchStory(AppState.stories.length - 1);
}

function switchStory(index) {
    index = parseInt(index);
    if (index >= 0 && index < AppState.stories.length) {
        AppState.currentStoryIndex = index;
        AppState.walls = AppState.stories[index].walls;
        AppState.fixtures = AppState.stories[index].fixtures;
        
        // Deselect items when switching floors to prevent bugs
        AppState.selectedFixture = null;
        
        stateManager.saveState();
        updateStorySelectUI();
        drawBlueprint();
        update3DFloorplan(); // Updates 3D to emphasize current story if we add that logic later
    }
}

function updateStorySelectUI() {
    const select = document.getElementById('story-select');
    if (!select) return;
    
    select.innerHTML = '';
    AppState.stories.forEach((story, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.text = story.name;
        if (idx === AppState.currentStoryIndex) option.selected = true;
        select.appendChild(option);
    });
}

// Moved here from ConversionEngine3D: dragging only needs the mesh a rebuild
// already produced, so the engine no longer carries a single-caller method.
function updateItemTransform(item, canvasWidth, canvasHeight) {
    if (!conversionEngine) return;
    const mesh = conversionEngine.meshes.find(m => m.userData.id === item.id);
    if (!mesh) return;

    const x = (item.x - canvasWidth / 2) / SCALE;
    const z = (item.y - canvasHeight / 2) / SCALE;
    mesh.position.set(x, mesh.position.y, z);
    mesh.rotation.y = -item.rotation;

    const box = conversionEngine.meshes.find(m => m.type === 'BoxHelper');
    if (box) box.update();
}

// WebGPURenderer renders async; WebGLRenderer does not. Both are drawn through
// this so the animation loops work with either backend.
function renderFrame(renderer, scene, camera) {
    if (typeof renderer.renderAsync === 'function') return renderer.renderAsync(scene, camera);
    return renderer.render(scene, camera);
}

function snapToGrid(x, y) {
    if (!AppState.snapToGrid) return { x, y };
    return {
        x: Math.round(x / AppState.gridSize) * AppState.gridSize,
        y: Math.round(y / AppState.gridSize) * AppState.gridSize
    };
}

// ... existing code ...
// Reuse most initialization logic but update handlers to use StateManager

async function initPanorama() {
    const canvas = document.getElementById('cv');
    const container = document.getElementById('panorama-3d-view');
    if (!canvas || !container) return;

    const w = container.clientWidth, h = container.clientHeight;
    panoramaCamera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    panoramaCamera.position.set(0.001, 0, 0);
    
    panoramaScene = new THREE.Scene();
    panoramaRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    panoramaRenderer.setSize(w, h);

    const loader = new THREE.TextureLoader();
    return new Promise(resolve => {
        loader.load('/assets/sc-bp-bath.png', texture => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            const geo = new THREE.SphereGeometry(500, 60, 40);
            geo.scale(-1, 1, 1);
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture }));
            panoramaScene.add(mesh);
            animatePanorama();
            resolve();
        }, undefined, () => {
            const geo = new THREE.SphereGeometry(500, 60, 40);
            geo.scale(-1, 1, 1);
            panoramaScene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x87ceeb })));
            animatePanorama();
            resolve();
        });
    });
}

function initBlueprint() {
    blueprintCanvas = document.getElementById('blueprint-canvas');
    if (!blueprintCanvas) return;
    blueprintCtx = blueprintCanvas.getContext('2d');
    const p = blueprintCanvas.parentElement;
    blueprintCanvas.width = p.clientWidth;
    blueprintCanvas.height = p.clientHeight;
    
    blueprintImage = new Image();
    blueprintImage.crossOrigin = 'anonymous';
    blueprintImage.src = '/assets/blueprint.png';
    blueprintImage.onload = () => drawBlueprint();
    blueprintImage.onerror = () => drawBlueprint();
}

function initFloorplan3D() {
    const container = document.getElementById('render-3d-view');
    if (!container) return;
    
    const w = container.parentElement.clientWidth;
    const h = container.parentElement.clientHeight;
    
    floorplanScene = new THREE.Scene();
    floorplanScene.background = new THREE.Color(0xf0f0f0);
    floorplanScene.fog = new THREE.Fog(0xf0f0f0, 10, 50);
    
    floorplanCamera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    floorplanCamera.position.set(8, 6, 8);
    
    // Fallback for WebGPU
    // WebGPU when the browser and this three build both offer it, WebGL
    // otherwise. r160's WebGPURenderer no longer ships a static isAvailable(),
    // so probe it before calling instead of relying on the throw below.
    try {
        const webgpuReady = typeof WebGPURenderer.isAvailable === 'function' && WebGPURenderer.isAvailable();
        if (webgpuReady) {
            floorplanRenderer = new WebGPURenderer({ antialias: true });
        } else {
            console.warn('WebGPU not available, falling back to WebGL');
            floorplanRenderer = new THREE.WebGLRenderer({ antialias: true });
        }
    } catch (e) {
        console.error('Renderer init error:', e);
        floorplanRenderer = new THREE.WebGLRenderer({ antialias: true });
    }

    floorplanRenderer.setSize(w, h);
    floorplanRenderer.shadowMap.enabled = true;
    floorplanRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(floorplanRenderer.domElement);
    
    floorplanControls = new OrbitControls(floorplanCamera, floorplanRenderer.domElement);
    floorplanControls.enableDamping = true;
    
    // Add interaction listener
    floorplanRenderer.domElement.addEventListener('pointerdown', on3DPointerDown);
    floorplanRenderer.domElement.addEventListener('pointermove', on3DPointerMove);
    floorplanRenderer.domElement.addEventListener('pointerup', on3DPointerUp);
    
    conversionEngine = new ConversionEngine3D(floorplanScene);
    
    // Invisible plane for drag raycasting
    dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    gridHelper3D = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
    floorplanScene.add(gridHelper3D);
    
    axesHelper3D = new THREE.AxesHelper(5);
    floorplanScene.add(axesHelper3D);
    
    animate3D();
}

function setupEventListeners() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const tool = e.currentTarget.id.replace('tool-', '');
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            setTool(tool);
        });
    });
    
    document.querySelectorAll('.item-button').forEach(btn => {
        btn.addEventListener('click', e => {
            const item = e.currentTarget.dataset.item;
            document.querySelectorAll('.item-button').forEach(b => b.classList.remove('border-primary', 'border-2'));
            e.currentTarget.classList.add('border-primary', 'border-2');
            setTool(item);
        });
    });

    document.getElementById('delete-button')?.addEventListener('click', () => setTool('delete'));

    if (blueprintCanvas) {
        blueprintCanvas.addEventListener('pointerdown', onBlueprintPointerDown);
        blueprintCanvas.addEventListener('pointermove', onBlueprintPointerMove);
        blueprintCanvas.addEventListener('pointerup', onBlueprintPointerUp);
    }
    
    document.getElementById('view-toggle')?.addEventListener('change', toggleView);
    
    setupStyleControls();
    setupCustomTextureHandlers();
    document.addEventListener('keydown', handleKeyboard);
    window.addEventListener('resize', onResize);
    setupUploads();
}

function on3DPointerDown(event) {
    if (AppState.currentView !== '3d') return;
    
    const rect = floorplanRenderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, floorplanCamera);

    const intersects = raycaster.intersectObjects(floorplanScene.children, true);

    if (intersects.length > 0) {
        let target = intersects[0].object;
        while(target && !target.userData.id && target.parent) {
            target = target.parent;
        }

        if (target && target.userData.id && target.userData.type === 'item') {
            const fixture = AppState.fixtures.find(f => f.id === target.userData.id);
            if (fixture) {
                AppState.selectedFixture = fixture;
                AppState.isDragging = true;
                
                // Disable controls while dragging item
                floorplanControls.enabled = false;
                
                drawBlueprint();
                update3DFloorplan();
                return;
            }
        }
    }
    
    if (AppState.selectedFixture) {
        AppState.selectedFixture = null;
        drawBlueprint();
        update3DFloorplan();
    }
}

function on3DPointerMove(event) {
    if (AppState.currentView !== '3d' || !AppState.isDragging || !AppState.selectedFixture) return;

    const rect = floorplanRenderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, floorplanCamera);
    
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, target);
    
    if (target) {
        const cvW = blueprintCanvas.width;
        const cvH = blueprintCanvas.height;
        
        // Convert 3D world coords back to 2D Blueprint coords
        // x3d = (x2d - w/2)/SCALE => x2d = x3d * SCALE + w/2
        // z3d = -(y2d - h/2)/SCALE => y2d = -z3d * SCALE + h/2
        
        const newX = target.x * SCALE + cvW / 2;
        const newY = -target.z * SCALE + cvH / 2;
        
        const s = snapToGrid(newX, newY);
        AppState.selectedFixture.x = s.x;
        AppState.selectedFixture.y = s.y;
        
        // Use optimized update instead of full re-render
        updateItemTransform(AppState.selectedFixture, cvW, cvH);
    }
}

function on3DPointerUp() {
    if (AppState.isDragging) {
        AppState.isDragging = false;
        floorplanControls.enabled = true; // Re-enable camera controls
        stateManager.saveState();
        drawBlueprint();
    }
}

function setTool(tool) {
    AppState.currentTool = tool;
    if (tool === 'delete') blueprintCanvas.style.cursor = 'not-allowed';
    else if (tool === 'wall') blueprintCanvas.style.cursor = 'crosshair';
    else blueprintCanvas.style.cursor = 'pointer';
}

function setupStyleControls() {
    // Texture Target Toggle Logic
    const targetWallBtn = document.getElementById('target-wall');
    const targetFloorBtn = document.getElementById('target-floor');

    if (targetWallBtn && targetFloorBtn) {
        targetWallBtn.addEventListener('click', () => {
            AppState.textureTarget = 'wall';
            targetWallBtn.classList.add('bg-white', 'dark:bg-gray-600', 'text-gray-800', 'dark:text-gray-200', 'shadow-sm');
            targetWallBtn.classList.remove('text-gray-500', 'dark:text-gray-400');
            targetFloorBtn.classList.remove('bg-white', 'dark:bg-gray-600', 'text-gray-800', 'dark:text-gray-200', 'shadow-sm');
            targetFloorBtn.classList.add('text-gray-500', 'dark:text-gray-400');
        });

        targetFloorBtn.addEventListener('click', () => {
            AppState.textureTarget = 'floor';
            targetFloorBtn.classList.add('bg-white', 'dark:bg-gray-600', 'text-gray-800', 'dark:text-gray-200', 'shadow-sm');
            targetFloorBtn.classList.remove('text-gray-500', 'dark:text-gray-400');
            targetWallBtn.classList.remove('bg-white', 'dark:bg-gray-600', 'text-gray-800', 'dark:text-gray-200', 'shadow-sm');
            targetWallBtn.classList.add('text-gray-500', 'dark:text-gray-400');
        });
    }

    document.querySelectorAll('.texture-button').forEach(btn => {
        btn.addEventListener('click', e => {
            const tex = e.currentTarget.dataset.texture;
            if (AppState.selectedFixture) {
                if(!AppState.fixtureStyles[AppState.selectedFixture.id]) AppState.fixtureStyles[AppState.selectedFixture.id] = {};
                AppState.fixtureStyles[AppState.selectedFixture.id].texture = tex;
            } else {
                // Apply to global defaults based on toggle target
                if (AppState.textureTarget === 'floor') {
                    AppState.defaultFloorTexture = tex;
                } else {
                    AppState.defaultWallTexture = tex;
                }
            }
            stateManager.saveState();
            update3DFloorplan();
        });
    });

    document.querySelectorAll('.color-button').forEach(btn => {
        btn.addEventListener('click', e => {
            if (AppState.selectedFixture) {
                if(!AppState.fixtureStyles[AppState.selectedFixture.id]) AppState.fixtureStyles[AppState.selectedFixture.id] = {};
                AppState.fixtureStyles[AppState.selectedFixture.id].color = e.currentTarget.dataset.color;
                stateManager.saveState();
                drawBlueprint();
                update3DFloorplan();
            }
        });
    });
}

function setupCustomTextureHandlers() {
    const handleUpload = (type, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target.result;
            if (AppState.selectedFixture) {
                if (!AppState.fixtureStyles[AppState.selectedFixture.id]) AppState.fixtureStyles[AppState.selectedFixture.id] = {};
                AppState.fixtureStyles[AppState.selectedFixture.id][type === 'diffuse' ? 'texture' : type] = url;
                // Store actual map type url if needed in metadata logic, 
                // but conversion engine needs to know how to handle 'normal' and 'roughness' props in style
            } else {
                // Apply to defaults
                if (type === 'diffuse') {
                    if (AppState.textureTarget === 'floor') AppState.defaultFloorTexture = url;
                    else AppState.defaultWallTexture = url;
                }
            }
            // For now, only diffuse is fully supported in standard pipeline unless we update ConversionEngine3D
            // to read 'normal' and 'roughness' from fixtureStyles.
            // Let's assume ConversionEngine3D will be updated or we handle it here by passing a special object.
            
            // Just saving state and updating view usually triggers the engine
            stateManager.saveState();
            update3DFloorplan();
        };
        reader.readAsDataURL(file);
    };

    document.getElementById('custom-diffuse')?.addEventListener('change', (e) => handleUpload('diffuse', e.target.files[0]));
    document.getElementById('custom-normal')?.addEventListener('change', (e) => handleUpload('normalMap', e.target.files[0]));
    document.getElementById('custom-roughness')?.addEventListener('change', (e) => handleUpload('roughnessMap', e.target.files[0]));
}

function setupUploads() {
    const fileInput = document.getElementById('file-upload');
    if(fileInput) {
        fileInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if(file) {
                if (file.type === 'application/json') {
                    try {
                        const data = await StorageManager.importProject(file);
                        if (data && data.walls && data.fixtures) {
                             restoreStateSnapshot(data);
                             stateManager.saveState();
                             alert('Project loaded successfully!');
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Error loading project file.');
                    }
                } else {
                    // Image background
                    const reader = new FileReader();
                    reader.onload = ev => {
                        blueprintImage.src = ev.target.result;
                        // Reset scale to 1 on new upload
                        AppState.bgScale = 1.0;
                        const scaleInput = document.getElementById('bg-scale-input');
                        if(scaleInput) scaleInput.value = "1.0";
                        drawBlueprint();
                    };
                    reader.readAsDataURL(file);
                    
                    // Close modal if present
                    document.getElementById('upload-modal')?.classList.remove('active');
                }
            }
        });
    }

    const photoInput = document.getElementById('kitchen-photo-upload');
    if(photoInput) {
        photoInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if(file) {
                try {
                    const result = await scanner.processImage(file);
                    if(result && result.walls) {
                        AppState.walls = [];
                        const sx = blueprintCanvas.width / result.width;
                        const sy = blueprintCanvas.height / result.height;
                        result.walls.forEach(pts => {
                            for(let i=1; i<pts.length; i++) {
                                AppState.walls.push(new Wall(pts[i-1][0]*sx, pts[i-1][1]*sy, pts[i][0]*sx, pts[i][1]*sy));
                            }
                        });
                        stateManager.saveState();
                        drawBlueprint();
                        update3DFloorplan();
                        alert(`Detected ${AppState.walls.length} walls!`);
                    }
                } catch(err) {
                    console.error(err);
                    alert("Error processing image.");
                }
            }
        });
    }
}

// Core Interaction Logic
function onBlueprintPointerDown(e) {
    const rect = blueprintCanvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    const s = snapToGrid(x,y);
    x = s.x; y = s.y;

    // 1. Check for wall corner interaction first (allows joining walls)
    const handleRadius = 15;
    for (let i = 0; i < AppState.walls.length; i++) {
        const w = AppState.walls[i];
        if (Math.hypot(w.start.x - x, w.start.y - y) < handleRadius) {
            AppState.isDraggingWallNode = true;
            AppState.draggedWallNode = { wallIndex: i, node: 'start' };
            return;
        }
        if (Math.hypot(w.end.x - x, w.end.y - y) < handleRadius) {
            AppState.isDraggingWallNode = true;
            AppState.draggedWallNode = { wallIndex: i, node: 'end' };
            return;
        }
    }

    // 2. Hit testing fixtures
    for (let i=AppState.fixtures.length-1; i>=0; i--) {
        const f = AppState.fixtures[i];
        const w = (f.metadata.width || 1) * SCALE / 2; 
        const h = (f.metadata.depth || 1) * SCALE / 2;
        if (Math.hypot(f.x - x, f.y - y) < Math.max(w, h, 20)) {
            AppState.selectedFixture = f;
            AppState.isDragging = true;
            AppState.draggedItem = f;
            AppState.dragOffset = { x: x - f.x, y: y - f.y };
            drawBlueprint();
            return;
        }
    }
    
    AppState.selectedFixture = null;

    // 3. Tool actions
    if (AppState.currentTool === 'wall') {
        if (!AppState.isDrawing) {
            AppState.startPoint = { x, y };
            AppState.isDrawing = true;
        } else {
            AppState.walls.push(new Wall(AppState.startPoint.x, AppState.startPoint.y, x, y));
            AppState.startPoint = { x, y }; // Chain walls
            stateManager.saveState();
            update3DFloorplan();
        }
    } else if (AppState.currentTool === 'delete') {
        deleteNearest(x, y);
    } else if (AppState.currentTool) {
        const item = ItemFactory.create(AppState.currentTool, x, y);
        if (item.snapToWall) {
            item.snapToWall(AppState.walls, 100);
        }
        
        AppState.fixtures.push(item);
        AppState.fixtureStyles[item.id] = { color: item.metadata.color ? '#' + item.metadata.color.toString(16).padStart(6, '0') : '#13a4ec', material: 'gloss' };
        stateManager.saveState();
        update3DFloorplan();
    }
    drawBlueprint();
}

function onBlueprintPointerMove(e) {
    const rect = blueprintCanvas.getBoundingClientRect();
    let x = e.clientX - rect.left; 
    let y = e.clientY - rect.top;
    const s = snapToGrid(x,y); x=s.x; y=s.y;

    if (AppState.isDraggingWallNode && AppState.draggedWallNode) {
        const w = AppState.walls[AppState.draggedWallNode.wallIndex];
        // Check for snapping to other walls to join them
        const snapThreshold = 15;
        let snapped = false;
        AppState.wallSplitTarget = null;
        
        // 1. Snap to endpoints (Join)
        for(let i=0; i<AppState.walls.length; i++) {
            if(i === AppState.draggedWallNode.wallIndex) continue;
            const other = AppState.walls[i];
            if(Math.hypot(other.start.x - x, other.start.y - y) < snapThreshold) { x = other.start.x; y = other.start.y; snapped = true; break; }
            if(Math.hypot(other.end.x - x, other.end.y - y) < snapThreshold) { x = other.end.x; y = other.end.y; snapped = true; break; }
        }

        // 2. Snap to wall segments (Split)
        if (!snapped) {
             for(let i=0; i<AppState.walls.length; i++) {
                 if(i === AppState.draggedWallNode.wallIndex) continue;
                 const other = AppState.walls[i];
                 
                 // Distance to line segment
                 const A = x - other.start.x;
                 const B = y - other.start.y;
                 const C = other.end.x - other.start.x;
                 const D = other.end.y - other.start.y;
                 
                 const dot = A * C + B * D;
                 const lenSq = C * C + D * D;
                 let param = -1;
                 if (lenSq !== 0) param = dot / lenSq;
                 
                 if (param > 0.1 && param < 0.9) { // Avoid snapping to endpoints here, handled above
                     const xx = other.start.x + param * C;
                     const yy = other.start.y + param * D;
                     const dist = Math.hypot(x - xx, y - yy);
                     
                     if (dist < snapThreshold) {
                         x = xx;
                         y = yy;
                         snapped = true;
                         AppState.wallSplitTarget = { index: i, point: { x, y } };
                         break;
                     }
                 }
             }
        }

        if (AppState.draggedWallNode.node === 'start') { w.start.x = x; w.start.y = y; }
        else { w.end.x = x; w.end.y = y; }
        
        drawBlueprint();
        // Visual feedback for split
        if (AppState.wallSplitTarget) {
            blueprintCtx.fillStyle = '#ff9900';
            blueprintCtx.beginPath();
            blueprintCtx.arc(x, y, 6, 0, Math.PI*2);
            blueprintCtx.fill();
        }
        return;
    }

    // NEW: Snap drawing cursor to existing endpoints for watertight walls
    if (AppState.currentTool === 'wall') {
        const snapThreshold = 15;
        for(let i=0; i<AppState.walls.length; i++) {
            const other = AppState.walls[i];
            // Don't snap to the start point of the wall currently being drawn (if any)
            if (Math.hypot(other.start.x - x, other.start.y - y) < snapThreshold) { x = other.start.x; y = other.start.y; break; }
            if (Math.hypot(other.end.x - x, other.end.y - y) < snapThreshold) { x = other.end.x; y = other.end.y; break; }
        }
    }

    if (AppState.isDragging && AppState.draggedItem) {
        const item = AppState.draggedItem;
        
        if (item.snapToWall) {
            item.x = x - AppState.dragOffset.x;
            item.y = y - AppState.dragOffset.y;
            item.snapToWall(AppState.walls);
        } else {
            item.x = x - AppState.dragOffset.x;
            item.y = y - AppState.dragOffset.y;
        }
        drawBlueprint();
    }
    
    // Preview line for wall drawing
    if (AppState.isDrawing && AppState.currentTool === 'wall' && AppState.startPoint) {
        drawBlueprint();
        blueprintCtx.beginPath();
        blueprintCtx.moveTo(AppState.startPoint.x, AppState.startPoint.y);
        blueprintCtx.lineTo(x, y);
        blueprintCtx.strokeStyle = '#999';
        blueprintCtx.setLineDash([5, 5]);
        blueprintCtx.stroke();
        blueprintCtx.setLineDash([]);
    }
}

function onBlueprintPointerUp() {
    if (AppState.isDragging || AppState.isDraggingWallNode) {
        
        // Handle Wall Split
        if (AppState.isDraggingWallNode && AppState.wallSplitTarget) {
            const targetIdx = AppState.wallSplitTarget.index;
            const splitPt = AppState.wallSplitTarget.point;
            const oldWall = AppState.walls[targetIdx];
            
            // Create new wall from split point to end
            const newWall = new Wall(splitPt.x, splitPt.y, oldWall.end.x, oldWall.end.y, oldWall.thickness);
            AppState.walls.push(newWall);
            
            // Update old wall to end at split point
            oldWall.end.x = splitPt.x;
            oldWall.end.y = splitPt.y;
            
            // The dragged wall node is already at splitPt from Move
            
            AppState.wallSplitTarget = null;
        }

        stateManager.saveState();
        update3DFloorplan();
    }
    AppState.isDragging = false;
    AppState.draggedItem = null;
    AppState.isDraggingWallNode = false;
    AppState.draggedWallNode = null;
    AppState.wallSplitTarget = null;
    drawBlueprint();
}

function deleteNearest(x, y) {
    const thresh = 20;

    // Handle keyboard deletion where x/y might be undefined
    if (x === undefined || y === undefined) {
        if (AppState.selectedFixture) {
            const idx = AppState.fixtures.indexOf(AppState.selectedFixture);
            if (idx > -1) {
                AppState.fixtures.splice(idx, 1);
                finishDelete();
                return;
            }
        }
        return;
    }
    
    // Check fixtures
    const fIdx = AppState.fixtures.findIndex(f => Math.hypot(f.x - x, f.y - y) < thresh);
    if (fIdx >= 0) {
        AppState.fixtures.splice(fIdx, 1);
        finishDelete();
        return;
    }
    
    // Check walls (center point)
    const wIdx = AppState.walls.findIndex(w => {
        const cx = (w.start.x + w.end.x) / 2;
        const cy = (w.start.y + w.end.y) / 2;
        return Math.hypot(cx - x, cy - y) < thresh;
    });
    if (wIdx >= 0) {
        AppState.walls.splice(wIdx, 1);
        finishDelete();
        return;
    }
}

function finishDelete() {
    stateManager.saveState();
    update3DFloorplan();
    drawBlueprint();
    AppState.selectedFixture = null;
}

function drawBlueprint() {
    if (!blueprintCtx) return;
    blueprintCtx.clearRect(0,0,blueprintCanvas.width, blueprintCanvas.height);
    
    // Grid
    if(AppState.showGrid2D) {
        blueprintCtx.strokeStyle = '#f0f0f0'; // Lighter grid
        blueprintCtx.beginPath();
        for(let i=0; i<blueprintCanvas.width; i+=AppState.gridSize) { blueprintCtx.moveTo(i,0); blueprintCtx.lineTo(i, blueprintCanvas.height); }
        for(let i=0; i<blueprintCanvas.height; i+=AppState.gridSize) { blueprintCtx.moveTo(0,i); blueprintCtx.lineTo(blueprintCanvas.width, i); }
        blueprintCtx.stroke();
    }

    // Image
    if(blueprintImage?.complete && blueprintImage.naturalWidth > 0) {
        // Calculate fit scale then apply user nominal scale multiplier
        const fitScale = Math.min(blueprintCanvas.width/blueprintImage.width, blueprintCanvas.height/blueprintImage.height)*0.9;
        const finalScale = fitScale * AppState.bgScale;
        
        const dx = (blueprintCanvas.width - blueprintImage.width*finalScale)/2;
        const dy = (blueprintCanvas.height - blueprintImage.height*finalScale)/2;
        
        blueprintCtx.globalAlpha = 0.3;
        blueprintCtx.drawImage(blueprintImage, dx, dy, blueprintImage.width*finalScale, blueprintImage.height*finalScale);
        blueprintCtx.globalAlpha = 1;
    }

    // Walls
    // Only draw current story walls in blueprint
    AppState.walls.forEach(w => {
        // High Contrast Walls
        blueprintCtx.strokeStyle = '#2563eb'; // Bright Blue
        blueprintCtx.lineWidth = 6;
        blueprintCtx.lineCap = 'round';
        blueprintCtx.beginPath();
        blueprintCtx.moveTo(w.start.x, w.start.y);
        blueprintCtx.lineTo(w.end.x, w.end.y);
        blueprintCtx.stroke();
        
        // Draw endpoints
        blueprintCtx.fillStyle = '#1e3a8a'; // Darker Blue
        blueprintCtx.beginPath();
        blueprintCtx.arc(w.start.x, w.start.y, 6, 0, Math.PI*2);
        blueprintCtx.arc(w.end.x, w.end.y, 6, 0, Math.PI*2);
        blueprintCtx.fill();
        
        // Inner white dot for contrast
        blueprintCtx.fillStyle = '#ffffff';
        blueprintCtx.beginPath();
        blueprintCtx.arc(w.start.x, w.start.y, 2, 0, Math.PI*2);
        blueprintCtx.arc(w.end.x, w.end.y, 2, 0, Math.PI*2);
        blueprintCtx.fill();

        // Dimensions
        if (AppState.showDimensions) {
            const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
            const lenM = (len / SCALE).toFixed(1) + 'm';
            const midX = (w.start.x + w.end.x) / 2;
            const midY = (w.start.y + w.end.y) / 2;
            
            blueprintCtx.save();
            blueprintCtx.font = 'bold 11px "Space Grotesk", sans-serif';
            const tm = blueprintCtx.measureText(lenM);
            const pad = 4;
            
            // White background box
            blueprintCtx.fillStyle = 'rgba(255,255,255,0.85)';
            blueprintCtx.beginPath();
            blueprintCtx.roundRect(midX - tm.width/2 - pad, midY - 8, tm.width + pad*2, 16, 4);
            blueprintCtx.fill();
            
            // Text
            blueprintCtx.fillStyle = '#333';
            blueprintCtx.textAlign = 'center';
            blueprintCtx.textBaseline = 'middle';
            blueprintCtx.fillText(lenM, midX, midY);
            blueprintCtx.restore();
        }
    });

    // Fixtures
    AppState.fixtures.forEach(f => {
        blueprintCtx.save();
        blueprintCtx.translate(f.x, f.y);
        blueprintCtx.rotate(f.rotation);
        
        if (f.type === 'door') {
            blueprintCtx.fillStyle = '#8b4513';
            blueprintCtx.fillRect(-15, -5, 30, 10);
            blueprintCtx.beginPath();
            blueprintCtx.arc(-15, -5, 30, 0, Math.PI/2);
            blueprintCtx.stroke();
        } else if (f.type === 'window') {
            blueprintCtx.fillStyle = '#87ceeb';
            blueprintCtx.fillRect(-20, -5, 40, 10);
            blueprintCtx.strokeRect(-20, -5, 40, 10);
        } else {
            blueprintCtx.fillStyle = AppState.fixtureStyles[f.id]?.color || '#13a4ec';
            const w = (f.metadata.width || 0.5) * SCALE;
            const d = (f.metadata.depth || 0.5) * SCALE;
            
            // Draw item body
            blueprintCtx.fillRect(-w/2, -d/2, w, d);
            
            // Orientation indicator
            blueprintCtx.strokeStyle = 'rgba(255,255,255,0.5)';
            blueprintCtx.beginPath();
            blueprintCtx.moveTo(0, 0);
            blueprintCtx.lineTo(w/2, 0);
            blueprintCtx.stroke();
        }
        
        if (f === AppState.selectedFixture) {
            blueprintCtx.strokeStyle = '#ff0000';
            blueprintCtx.lineWidth = 2;
            const w = (f.metadata.width || 0.5) * SCALE;
            const d = (f.metadata.depth || 0.5) * SCALE;
            blueprintCtx.strokeRect(-w/2 - 4, -d/2 - 4, w + 8, d + 8);
        }
        
        blueprintCtx.restore();
    });
    
    // Walls (ghosting)
    // Optional: Draw wall ghosting from floor below?
    if (AppState.currentStoryIndex > 0) {
        const lower = AppState.stories[AppState.currentStoryIndex - 1];
        lower.walls.forEach(w => {
            blueprintCtx.strokeStyle = '#e0e0e0';
            blueprintCtx.lineWidth = 2;
            blueprintCtx.beginPath();
            blueprintCtx.moveTo(w.start.x, w.start.y);
            blueprintCtx.lineTo(w.end.x, w.end.y);
            blueprintCtx.stroke();
        });
    }
}

function update3DFloorplan() {
    if(conversionEngine) conversionEngine.convert(AppState, blueprintCanvas.width, blueprintCanvas.height);
}

function toggleView() {
    const cv = document.getElementById('cv');
    const r3d = document.getElementById('render-3d-view');
    if(AppState.currentView === 'panorama') {
        AppState.currentView = '3d';
        cv.style.display = 'none';
        r3d.style.display = 'block';
        update3DFloorplan();
    } else {
        AppState.currentView = 'panorama';
        cv.style.display = 'block';
        r3d.style.display = 'none';
    }
}

// Animation Loops
let lat = 0, lon = 0;
function animatePanorama() {
    requestAnimationFrame(animatePanorama);
    if(AppState.currentView !== 'panorama' || !panoramaRenderer) return;
    lat = Math.max(-89, Math.min(89, lat));
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    panoramaCamera.lookAt(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
    );
    renderFrame(panoramaRenderer, panoramaScene, panoramaCamera);
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if(AppState.currentView === '3d' && floorplanRenderer && floorplanControls) {
        floorplanControls.update();
        renderFrame(floorplanRenderer, floorplanScene, floorplanCamera);
    }
}

function handleKeyboard(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); stateManager.undo(); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); stateManager.redo(); } // Redo hotkey
    if (e.key === 'Delete' || e.key === 'Backspace') {
        // Use selected item if available, otherwise fallback to cursor logic handled by delete tool
        deleteNearest(undefined, undefined); 
    }
    
    // WASD Controls
    if (AppState.isFirstPerson) {
        switch ( e.code ) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
        }
    }
}

document.addEventListener( 'keyup', ( event ) => {
    if (AppState.isFirstPerson) {
        switch ( event.code ) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    }
});

function onResize() {
    if(panoramaRenderer && document.getElementById('panorama-3d-view')) {
        const c = document.getElementById('panorama-3d-view');
        panoramaRenderer.setSize(c.clientWidth, c.clientHeight);
        panoramaCamera.aspect = c.clientWidth / c.clientHeight;
        panoramaCamera.updateProjectionMatrix();
    }
    if(floorplanRenderer && document.getElementById('render-3d-view')) {
        const c = document.getElementById('render-3d-view').parentElement;
        floorplanRenderer.setSize(c.clientWidth, c.clientHeight);
        floorplanCamera.aspect = c.clientWidth / c.clientHeight;
        floorplanCamera.updateProjectionMatrix();
    }
    initBlueprint();
}

// API Implementation
function exportProject() {
    const data = {
        version: '2.0',
        stories: AppState.stories.map(s => ({
            ...s,
            walls: s.walls.map(w => w.toJSON()),
            fixtures: s.fixtures.map(f => f.toJSON())
        })),
        fixtureStyles: AppState.fixtureStyles,
        settings: {
            gridSize: AppState.gridSize,
            snapToGrid: AppState.snapToGrid,
            showCeiling: AppState.showCeiling,
            showRoof: AppState.showRoof,
            currentStoryIndex: AppState.currentStoryIndex
        }
    };
    StorageManager.exportProject(data, 'floorplan-project.json');
}

function export3D(format) {
    if (!floorplanScene) return;
    
    // Temporary cleanup for export
    const helpers = floorplanScene.children.filter(c => c.isGridHelper || c.isAxesHelper || c.isLight);
    helpers.forEach(h => floorplanScene.remove(h));
    
    // Ensure we are exporting the floorplan scene content
    // Note: WebGPURenderer scene might need specific handling, but exporters usually traverse standard scene graph
    
    const onExport = (blob, ext) => {
        // Restore helpers
        helpers.forEach(h => floorplanScene.add(h));
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `floorplan-3d.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (format === 'gltf') {
        const exporter = new GLTFExporter();
        exporter.parse(
            floorplanScene,
            (gltf) => {
                const output = JSON.stringify(gltf, null, 2);
                const blob = new Blob([output], { type: 'text/plain' });
                onExport(blob, 'gltf');
            },
            (err) => console.error(err),
            { binary: false }
        );
    } else if (format === 'obj') {
        const exporter = new OBJExporter();
        const result = exporter.parse(floorplanScene);
        const blob = new Blob([result], { type: 'text/plain' });
        onExport(blob, 'obj');
    }
}

function loadTemplate(type) {
    // Load template from test-data.js
    if(TEST_DATA[type]) {
        const tData = TEST_DATA[type];
        
        // Convert to class instances
        // Detect if template is old format or new
        if (tData.stories) {
            AppState.stories = tData.stories.map(s => ({
                ...s,
                walls: s.walls.map(w => new Wall(w.start.x, w.start.y, w.end.x, w.end.y, w.thickness)),
                fixtures: s.fixtures.map(f => ItemFactory.create(f.type, f.x, f.y, f.rotation))
            }));
            AppState.currentStoryIndex = 0;
            AppState.walls = AppState.stories[0].walls;
            AppState.fixtures = AppState.stories[0].fixtures;
        } else {
            // Old format
            AppState.stories = [{
                id: 'story_0',
                name: 'Ground Floor',
                height: 2.7,
                walls: tData.walls.map(w => new Wall(w.start.x, w.start.y, w.end.x, w.end.y, w.thickness)),
                fixtures: tData.fixtures.map(f => ItemFactory.create(f.type, f.x, f.y, f.rotation))
            }];
            AppState.currentStoryIndex = 0;
            AppState.walls = AppState.stories[0].walls;
            AppState.fixtures = AppState.stories[0].fixtures;
        }
        
        AppState.fixtureStyles = tData.fixtureStyles || {};
        
        stateManager.saveState();
        drawBlueprint();
        update3DFloorplan();
        console.log(`Loaded template: ${type}`);
    } else {
        console.warn(`Template not found: ${type}`);
    }
}

// Module scripts are deferred and the three/nipple imports come from a CDN, so
// this file can start after DOMContentLoaded has already fired. Boot directly
// in that case instead of waiting for an event that will never come again.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
