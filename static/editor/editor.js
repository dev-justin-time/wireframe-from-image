import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConversionEngine3D } from '../engine/3dConversionEngine.js';
import { Wall, ItemFactory, itemDimensions } from '../core/items.js';
import { StateManager } from '../core/state-manager.js';
import { StorageManager } from '../core/storage.js';
import { FloorPlanProcessor } from '../engine/floorPlanProcessor.js';
import { dxfToPlan } from '../features/import/dxf.js';
import { fitFeaturesToSite, parseGeoFile, projectFeatures } from '../features/import/geo.js';
import { KITCHEN_LINES } from '../features/kitchen/catalog.js';
import { graphFromWalls } from '../core/floorplan-graph.js';
import { measurePlan } from '../core/measurements.js';
import { PIXELS_PER_METER, WALL_HEIGHT, INCH, canvasToWorld, planToCanvas, wallLengthMetres, worldToCanvas } from '../core/world-space.js';
import { fitCameraToGraph } from '../scene/scene-camera.js';
import { fixtureAt, beginDrag, dragTo } from '../scene/scene-drag.js';
import { snapToWalls } from '../core/wall-snap.js';
import { readDraft } from '../core/drafts.js';
import { createItemGizmo, planFromObject, pickItemId } from '../scene/scene-gizmo.js';
import { createElevationDrag, frameElevation, applyElevationVisibility, ELEVATION_SIDES, elevationAxes } from '../scene/scene-elevation.js';
import { createSceneAbilities, apply3DAbilities } from '../scene/scene-abilities.js';
import { createLabKit } from '../features/lab/kit.js';
import { drawPlanOverlays, drawScreenOverlays } from '../engine/plan-overlays.js';
import {
    FEATURES,
    wallHeightOf,
    wallFinishOf,
    setWallHeight as setWallHeightValue,
    resetWallHeights as resetWallHeightsFeature,
    setWallFinish,
    roomLabelsFromWalls,
    roomMetrics,
    formatMetrics,
    snapGuidesFor,
    cloneItem,
    repeatAlongAxis,
    flipItem,
    toggleAxisLock as toggleAxisLockFeature,
    lockedAxesOf,
    gridPixelsFromCm,
    gridCmFromPixels,
    toggleVisible,
    isVisible,
    setCeiling,
    setRoof,
    syncShellToggles,
    WALL_FINISH_OPTIONS,
    buildCutList,
    downloadCutList,
    buildElevationAnnotations,
    disposeAnnotationGroup,
    createHeightReadout
} from '../features/index.js';
import {
    ADVANCED_FEATURES,
    alignDepth,
    buildCollisionIndex,
    snapToCorner,
    validatePlacements,
    baseOf,
    setDefaultBottom,
    groupRun,
    ungroup as ungroupItems,
    captureGroupOffsets,
    applyGroupDelta,
    copyItems as copyToClipboard,
    pasteItems as pasteFromClipboard,
    saveStateTagged,
    migrateProject,
    stampProject,
    PROJECT_SCHEMA_VERSION,
    createAutosave,
    buildElevationDimensions,
    createElevationDimensionGroup,
    createSectionBox,
    summarizeByRoom,
    formatSummary,
    previewDrag,
    support as xrSupport,
    startPlacement,
    createWalkthrough,
    exportScene,
    downloadExport,
    openingsForWall
} from '../features/advanced/index.js';
import {
    recognizePlanText,
    parsePlanText,
    planTextSummary,
    ocrLineLabel
} from '../features/ocr.js';
import {
    detectPlanSymbols,
    symbolsSummary,
    symbolLabel,
    readingNotesAtOrigins,
    toPlanPoint
} from '../features/ocr-symbols.js';
import { DEFAULT_TEXTURES, detectRoomType, getRecommendedTextures } from '../core/metadata.js';
import { ROOF_STYLES } from '../features/roof/styles.js';
import { COVERINGS, GUTTER_SYSTEMS } from '../features/roof/materials.js';
import { computeRoofDesign } from '../features/roof/design.js';
import {
    STUDIO_FEATURES,
    roomSurfacesFromWalls,
    FLOOR_TEXTURES,
    storeyStack,
    storeySummary,
    engineStories,
    syncActiveStorey,
    activateStorey,
    addStorey as addStoreyFeature,
    removeStorey as removeStoreyFeature,
    createRenderLoop,
    listProjects,
    saveNamedProject,
    loadNamedProject,
    deleteNamedProject,
    createCollaboration,
    cabinetConfigOf,
    setCabinetConfig as applyCabinetConfig,
    manufacturingPackage,
    analyzeLayout,
    formatAnalysis,
    suggestRun,
    drawStudioOverlays,
    constructionOptions,
    storeyConstruction,
    WALL_HEIGHT_M,
    JOIST_DEPTH_M,
    shellCloneSpec,
    rectOpening,
    openingAt,
    vertexAt,
    edgeAt,
    moveVertex,
    insertVertex,
    removeVertex,
    moveOpening,
    cloneOpenings,
    openingAreaMetres,
    drawFloorOpenings,
    createWalkMode
} from '../features/studio/index.js';
import {
    computeStairDesign,
    computeOutdoorStair,
    outdoorStairConfig,
    outdoorSummary,
    outdoorBomCsv,
    buildStairAssembly,
    assemblySummary,
    getOutdoorSystem,
    OUTDOOR_SYSTEMS,
    STAIR_TYPE_LABELS,
    stairLocalToPlanPoint,
    isStairItem,
    drawStairPlan,
    stairPlanBounds,
    sizeStairItem,
    readDesignerDraft,
    clearDesignerDraft,
    loadStairPresets,
    saveStairPreset,
    removeStairPreset,
    getStairPreset,
    presetNameFor,
    presetSummary,
    createStairWalker,
    findStairClashes,
    createStairPanel
} from '../features/stairs/index.js';
import {
    computeWaterFeature,
    waterConfigForItem,
    waterDesignForItem,
    waterSummary,
    isWaterFeature,
    drawWaterPlan,
    WATER_FEATURE_TYPES,
    WATER_FEATURE_LABELS,
    POOL_SHAPES,
    POOL_SHAPE_LABELS,
    createLandscapePanel
} from '../features/landscape/index.js';
// Each cross-suite system is imported through its package barrel: the wall,
// deck, electrical and framing folders expose one entry point that carries the
// catalogue, rules, engine, panel, scene and studio panel together. The Systems
// panel is rendered from features/systems.js, which is also the only place the
// bid system is assembled inside the Studio.
import { WALL_COVERINGS, coveringById, finishPatchFor, computeWallDesign, wallAreaFromPlan } from '../features/wall/index.js';
import { computeDeckDesign, deckEditorSummary, deckDraftLines, buildDeckSceneGroup } from '../features/deck/index.js';
import { applyPriceBookToDesign } from '../features/pricing/book.js';
import { computeElectricalDesign, electricalEditorSummary, electricalDraftLines, buildElectricalPanelGroup } from '../features/electrical/index.js';
import { computeEditorFraming, buildFramingGroup, disposeFramingGroup, framingSceneStats, readFramingDraft, framingEditorSummary, framingDraftLines } from '../features/framing/index.js';
import { STUDIO_SYSTEMS, systemById } from '../features/systems.js';

// Application State
const AppState = {
    viewMode: '2d',
    currentTool: 'wall',
    isDrawing: false,
    wallStart: null,
    walls: [],
    fixtures: [],
    selectedFixture: null,
    // Selected wall id; drives the wall highlight in 2D/3D and the inspector.
    selectedWallId: null,
    drag: null,
    // Ruler points ({ start, end }) and the last pointer position in plan space.
    ruler: { start: null, end: null },
    cursor: null,
    // Wall endpoint being dragged in the plan ({ id, end: 'start' | 'end' }).
    wallNodeDrag: null,
    // Mesh height and item lift captured when the 3D gizmo attaches, so a Y
    // drag can be expressed as a change in the item's elevation.
    gizmoBase: null,
    // Plan pose captured at the same moment, so an invalid 3D drag can be
    // returned to the last valid placement.
    gizmoOrigin: null,
    
    // Deck draft sent from deck-designer.html (read by window.deckKit).
    deckDraft: null,
    // Electrical draft sent from electrical-designer.html.
    electricalDraft: null,
    // Framing member choices sent from framing-designer.html, and whether the
    // stud overlay is drawn in place of the finished walls.
    framingDraft: null,
    framingEnabled: false,
    // Settings
    showDimensions: true,
    showCeiling: false,
    showRoof: true,
    gridSize: 30,
    
    // Viewport
    scale: 1,
    offset: { x: 0, y: 0 },
    isPanning: false,
    panStart: { x: 0, y: 0 },
    
    // Elevation view ('front' | 'back' | 'left' | 'right'); null is the 3D orbit
    elevationSide: null,
    // The single wall shown by the elevation, stepped with the bar's arrows.
    elevationWallId: null,
    
    // Derived plan data from the feature kit (recomputed on every save).
    roomLabels: [],
    metrics: null,

    // Advanced kit: placement warnings, per-room summary, group drag members.
    warnings: [],
    summary: null,
    groupDrag: null,

    // Background
    backgroundImage: null,
    backgroundScale: 1.0, // Added scale property
    // OCR of the imported plan (features/ocr.js + features/ocr-symbols.js):
    // recognized words AND plan symbols stay in the session so both are drawn
    // over the image, printed at their origins and copied out.
    planText: null,
    planSymbols: null,
    
    // Styles
    fixtureStyles: {},
    defaultWallTexture: null,
    // The covering the Finishes panel falls back to when no wall is selected.
    defaultWallCovering: 'paint-eggshell',
    defaultFloorTexture: 'tile',
    // Finishes palette: which surface the texture buttons apply to.
    finishTarget: 'wall',
    // Roof suite: the style, pitch, covering and rain gutter used by the top
    // storey preview (features/studio/roof.js).
    roofConfig: {
        style: 'gable-king',
        pitch: 6,
        overhang: 0.5,
        covering: 'asphalt-arch',
        gutter: 'k5-alum',
        gutters: true,
        ridgeVent: true
    },

    // Studio kit: storeys, per-room floors, comments and layout checks.
    stories: [],
    currentStoryIndex: 0,
    roomMaterials: {},
    rooms: [],
    // Cutout tool: the opening being dragged and the selected polygon, both in
    // plan canvas pixels on the active storey.
    cutoutDraft: null,
    selectedOpeningId: null,
    selectedVertexIndex: null,
    openingDrag: null,
    comments: [],
    selectedCommentId: null,
    layoutReport: null,
    projects: [],
    activeProjectId: null,
    activeProjectName: null,

    // Stair and landscape suites: the option-bar draft used until a stair or
    // water feature is selected, plus the walker state.
    stairDraft: {
        system: 'deck',
        type: 'straight',
        code: 'IRC2021',
        width: 0.9144,
        availableRun: 4.4,
        availableWidth: 1.2,
        turnDegrees: 90
    },
    landscapeDraft: {
        type: 'pool',
        shape: 'rectangle',
        code: 'ISPSC2021',
        width: 4,
        length: 9,
        shallow: 1.1,
        deep: 1.9,
        deck: 1.22,
        turnoverHours: 6,
        suctionOutlets: 2,
        waterTempF: 102,
        barrier: true
    },
    walking: false,
    // One-shot stair config armed from a saved preset: the next plan click
    // places that stair, then the pending preset is cleared.
    pendingStairPreset: null,

    lastConvert: null,
    // Last kitchen run imported from the suite (features/kitchen).
    kitchenDraft: null
};

// Systems
let blueprintCanvas, blueprintCtx;

// The plan canvas has two sizes. The CSS box it fills is the pixel space every
// plan coordinate, fixture position and snap threshold is measured in; the
// backing store is that box times the device pixel ratio, so lines and text are
// sharp on a HiDPI display. `canvas.width` is the backing store — plan maths
// must go through planView(), never through the attribute.
let planView = { width: 0, height: 0 };

const planPixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

/** Logical (CSS-pixel) size of the plan, measured from its parent if unknown. */
function planViewSize() {
    if (!planView.width || !planView.height) {
        const parent = blueprintCanvas?.parentElement;
        planView = {
            width: Math.max(parent?.clientWidth || 0, 1),
            height: Math.max(parent?.clientHeight || 0, 1)
        };
    }
    // A copy: callers pass the view into modules that must not be able to move
    // the plan's coordinate space.
    return { width: planView.width, height: planView.height };
}
let scene3D, camera3D, renderer3D, controls3D;
let orthoCamera3D, orthoControls3D; // side elevation views
let elevationBounds = null, elevationDrag = null;
let abilities = null;
let gridHelper3D = null, axesHelper3D = null;
let conversionEngine;
// 3D framing overlay (features/framing/scene.js) and its last computed design.
let framingGroup = null;
let framingResult = null;
// Exterior suite geometry: the deck and the electrical service panel.
let deckSceneGroup = null;
let electricalSceneGroup = null;
let itemGizmo;
let gizmoMode = 'translate';
let stateManager;
// Elevation height annotations (feature kit) and the live drag readout.
let elevationAnnotations = null;
let heightReadout = null;
// Advanced kit: autosave, clipping plane, walkthrough agent.
let autosave = null;
let sectionBox = null;
let walkthrough = null;
const walkthroughClock = new THREE.Clock();
// Studio kit: dirty-flag render loop and the collaboration store.
let renderLoop = null;
// Stair suite: first-person walker and its clock.
let stairWalker = null;
const stairWalkerClock = new THREE.Clock();

// Plan walk mode: first-person WASD camera at eye height on the active storey.
let planWalk = null;
const planWalkClock = new THREE.Clock();
let collaboration = null;
// Lab kit: post FX, spring selection, instanced props and the product model.
let labKit = null;

// The 3D panel is the one view that can fail outright: no WebGL at all, or a
// frame that throws (bad geometry, a shader the driver rejects). Either way the
// user should see why, and the 2D plan must keep working around it.
//   null        - drawing normally
//   'start'     - the renderer could not be created (no retry)
//   'frame'     - a frame threw (retry allowed)
let render3DFailed = null;

const ACTIVE_PROJECT_KEY = 'floorplan3d_active_project';

// Constants
const SCALE = 30; // Pixels per meter approximation for internal logic

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    init();
    showWelcomeToast();
});

function init() {
    console.log('Initializing Floorplan 3D Editor v1.0.0');
    
    // Setup State Manager
    stateManager = new StateManager(AppState, restoreState);

    // Storeys sit above the legacy walls/fixtures arrays; the ground floor
    // starts out owning them by reference.
    ensureStoreyModel();

    // Debounced, dirty-only autosave (feature 29). A failed write must be
    // visible: localStorage can be full or blocked, and silently losing the
    // project is the worst failure this app has.
    autosave = createAutosave({
        save: (payload) => {
            const saved = StorageManager.saveProject('autosave', payload);
            if (!saved) reportSaveFailure();
            return saved;
        }
    });
    // beforeunload is not reliable on mobile Safari; pagehide covers it.
    window.addEventListener('beforeunload', () => autosave?.flush());
    window.addEventListener('pagehide', () => autosave?.flush());

    init2D();
    init3D();
    setupEventListeners();
    wireUploadModal(); // Initialize modal handlers
    initAbilities(); // Plan / 3D / advanced / studio abilities + their panel
    initCollaboration();
    refreshStoreyPanel();
    refreshRoomFloorPanel();
    initRoofPanel();
    refreshPlanTextPanel();
    refreshFinishPanel();
    initWallCoveringPanel();
    refreshProjectsPanel();
    refreshCommentsPanel();
    refreshStairPanel();
    refreshStairPresetPalette();
    refreshLandscapePanel();
    
    // Load autosave + suite drafts. User data must never half-boot the
    // editor: a corrupt payload used to throw here, skipping the global
    // handlers, the first draw and the view buttons — every control dead.
    // Now it falls back to a blank plan and keeps going.
    try {
    const saved = StorageManager.loadProject('autosave');
    if (saved) {
        restoreState(saved);
        console.log('Restored from autosave');
    } else {
        // First run: seed the shared Southern Farmhouse demo so the Editor
        // (and every suite reading the autosave) opens on a real plan.
        // A floorplan-editor-draft handed from the landing page wins instead.
        const hasHandoff = (() => {
            try { return !!readDraft('floorplan-editor-draft')?.data; } catch { return false; }
        })();
        if (!hasHandoff) {
            fetch('../assets/southern-farmhouse-plan.json', { cache: 'no-store' })
                .then((res) => (res.ok ? res.json() : null))
                .then((plan) => {
                    if (!plan || !Array.isArray(plan.walls) || !plan.walls.length) return;
                    try {
                        restoreState(plan);
                        StorageManager.saveProject('autosave', plan);
                        console.log('Seeded Southern Farmhouse demo plan');
                    } catch (error) {
                        console.warn('Demo plan seed failed:', error);
                    }
                })
                .catch(() => { /* file:// or offline: stay on the blank canvas */ });
        }
    }

    // A plan converted on index.html replaces the autosave's plan first, so the
    // drafts below (roof, finishes, lighting, deck) land on the imported walls.
    applyFloorplanEditorDraft();

    // A roof designed in roof-designer.html arrives as a draft and wins over
    // the autosave's roof options, then the top storey rebuilds with it.
    const roofDraft = applyRoofEditorDraft();
    refreshRoofPanel();
    // A wall covering designed in wall-designer.html arrives the same way and
    // paints every wall on the plan, so the editor opens on the chosen finish.
    const wallDraft = applyWallEditorDraft();
    refreshWallCoveringPanel();
    // A lighting plan arrives with luminaires and wall devices as 3D pieces.
    const lightingDraft = applyLightingEditorDraft();
    // A landscape design arrives as a placed pool, spa or water feature.
    // A deck arrives as a framing config; the kit exposes its design and price.
    const deckDraft = applyDeckEditorDraft();
    const electricalDraft = applyElectricalEditorDraft();
    const landscapeDraft = applyLandscapeEditorDraft();
    const framingDraft = applyFramingEditorDraft();
    // A kitchen run arrives with its modules and gap spacing, so the cabinets
    // land in the plan exactly as the suite dimensioned them.
    const kitchenDraft = applyKitchenEditorDraft();
    if (roofDraft || wallDraft || lightingDraft || deckDraft || electricalDraft || landscapeDraft || framingDraft || kitchenDraft) update3D();

    // Initial Draw
    onResize();
    const gridSelect = document.getElementById('grid-size-select');
    if (gridSelect) gridSelect.value = String(gridCmFromPixels(AppState.gridSize) || 0);
    syncShellToggles(document, AppState);
    draw2D();
    updateViewButtons();

    // A stair designed in stair-designer.html arrives as a draft and is placed
    // at the plan centre, selected, so the option bar opens on it.
    const designerDraft = readDesignerDraft();
    if (designerDraft?.stair) {
        clearDesignerDraft();
        try {
            stairPanelApi().add(designerDraft.stair);
            draw2D();
        } catch (error) {
            console.warn('Stair designer draft was not placed', error);
        }
    }
    } catch (error) {
        console.warn('Saved project or suite drafts could not be loaded; starting blank.', error);
        window.reportClientError?.(error, { source: 'editor:boot:restore', kind: 'restore' });
        try {
            clearProject();
            setTool('wall');
            setActiveToolBtn('wall');
        } catch { /* the blank boot state is enough to draw on */ }
        setStatus('The saved plan could not be loaded, so a blank plan was started. Your files are untouched — import a backup to recover.', true);
    }

    // Expose Global API
    window.undo = () => { stateManager.undo(); updateUI(); };
    window.redo = () => { stateManager.redo(); updateUI(); };
    window.toggleView = toggleView;
    window.setViewMode = (mode) => setViewMode(mode);
    window.setElevationView = setElevationView;
    // Elevation wall stepping, for the bar buttons and the headless checks.
    window.setElevationWall = (id) => setElevationWall(id);
    window.stepElevationWall = (direction) => stepElevationWall(direction);
    window.elevationKit = {
        wall: () => AppState.elevationWallId,
        walls: () => elevationWalls().map((wall) => wall.id),
        visible: () => (scene3D ? scene3D.children.flatMap(function collect(node) {
            const found = node.userData?.type === 'wall' && node.visible ? [node.userData.id] : [];
            return found.concat(node.children.flatMap(collect));
        }) : [])
    };
    // Dimensions are an ability toggle, so the header switch flips the same flag.
    window.toggleDimensions = () => {
        if (abilities) abilities.toggle('dimensions');
        else { AppState.showDimensions = !AppState.showDimensions; draw2D(); }
        syncDimensionsSwitch();
    };
    window.toggleCeiling = () => {
        setCeiling(AppState, !AppState.showCeiling);
        syncShellToggles(document, AppState);
        saveToStorage();
        update3D();
    };
    window.toggleRoof = () => {
        setRoof(AppState, !AppState.showRoof);
        syncShellToggles(document, AppState);
        saveToStorage();
        update3D();
    };
    window.setWallHeight = (value) => {
        const wall = selectedWall();
        if (!wall) return;
        setWallHeightValue(wall, parseFloat(value));
        saveAndSync({ tag: 'inspector' });
    };
    window.setWallColor = (value) => {
        const wall = selectedWall();
        if (!wall) return;
        setWallFinish(AppState.fixtureStyles, wall.id, { color: value });
        saveAndSync({ tag: 'inspector' });
    };
    window.setWallTexture = (value) => {
        const wall = selectedWall();
        if (!wall) return;
        setWallFinish(AppState.fixtureStyles, wall.id, { texture: value || null });
        saveAndSync({ tag: 'inspector' });
    };
    window.setRoofOption = (key, value) => {
        if (!key) return;
        const numeric = key === 'pitch' || key === 'overhang';
        AppState.roofConfig = {
            ...AppState.roofConfig,
            [key]: numeric ? Number(value) : value
        };
        refreshRoofPanel();
        saveToStorage();
        update3D();
    };
    window.setGridSize = (cm) => {
        AppState.gridSize = gridPixelsFromCm(cm);
        const select = document.getElementById('grid-size-select');
        if (select) select.value = String(gridCmFromPixels(AppState.gridSize) || 0);
        saveToStorage();
        draw2D();
    };
    window.flipSelected = flipSelection;
    window.repeatSelected = repeatSelection;
    window.toggleAxisLock = toggleAxisLock;
    window.exportCutList = exportCutList;
    // OCR handle: words (Tesseract, open source) + symbols (local reader) on
    // the imported plan; readings print at their location origins.
    window.planOcr = {
        run: (source, options) => runPlanOcr(source, options),
        runCurrent: () => runPlanOcrCurrent(),
        runSymbols: () => runPlanSymbolsCurrent(),
        parse: parsePlanText,
        result: () => AppState.planText,
        symbols: () => AppState.planSymbols,
        readings: () => readingNotesAtOrigins({ lines: AppState.planText?.lines || [], symbols: AppState.planSymbols?.symbols || [] }),
        summary: () => [planTextSummary(AppState.planText), symbolsSummary(AppState.planSymbols)].filter((s) => s && !/^No /.test(s)).join(' + ') || 'No readings yet',
        setResult: (result) => {
            AppState.planText = result || null;
            refreshPlanTextPanel();
            draw2D();
            return AppState.planText;
        },
        debug: () => ({
            image: Boolean(AppState.backgroundImage),
            imageSize: AppState.backgroundImage ? [AppState.backgroundImage.width, AppState.backgroundImage.height] : null,
            scale: AppState.backgroundScale,
            lines: AppState.planText?.lines?.length || 0,
            boxes: AppState.planTextBoxCount || 0,
            rects: AppState.planTextRects || []
        }),
        clear: () => clearPlanText(),
        copy: () => copyPlanText(),
        print: () => printReadings()
    };
    // Roof suite handle: the editor's roof options and the takeoff they compute.
    window.roofKit = {
        config: () => ({ ...AppState.roofConfig }),
        size: () => roofPlanSize(),
        design: () => {
            const size = roofPlanSize();
            return size ? computeRoofDesign({ ...AppState.roofConfig, ...size }) : null;
        }
    };
    // Wall covering handle: what the Finishes panel shows and prices.
    window.wallKit = {
        coverings: () => WALL_COVERINGS.map((entry) => ({ id: entry.id, label: entry.label, exposure: entry.exposure })),
        covering: () => activeWallCoveringId(),
        area: () => planWallArea(),
        design: () => wallCoveringDesign()
    };
    // The whole feature kit on one handle, for debugging and the panel.
    window.featureKit = {
        features: FEATURES,
        metrics: () => AppState.metrics,
        roomLabels: () => AppState.roomLabels,
        walls: () => AppState.walls,
        fixtures: () => AppState.fixtures,
        abilities: () => abilitiesState(),
        annotations: () => elevationAnnotations
    };
    // Selection handle: 3D wall picking and the 2D/3D highlight share one path.
    window.selectWallById = (id) => selectWallById(id);
    window.editorKit = {
        // Read-only handles for the harnesses and for support: the 3D scene and
        // its renderer are otherwise module-private.
        scene: () => scene3D,
        renderer: () => renderer3D,
        selectedWall: () => AppState.selectedWallId,
        selectWall: (id) => selectWallById(id),
        selectAt: (event) => selectAtPointer(event || {}),
        pickWall: (event) => pickWallIdAtPointer(event || {}),
        // Screen position of a wall's midpoint, for anchoring UI and for the
        // headless pick check; it uses the same camera as the 3D view.
        wallScreenPoint: (id) => {
            const wall = AppState.walls.find((entry) => entry.id === id);
            if (!wall || !renderer3D) return null;
            const view = planViewSize();
            const mid = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
            const elevation = activeStoreyElevation() + wallHeightOf(wall) / 2;
            const world = canvasToWorld(mid, view, elevation);
            const screen = new THREE.Vector3(world.x, world.y, world.z).project(activeCamera());
            const rect = renderer3D.domElement.getBoundingClientRect();
            return {
                clientX: rect.left + ((screen.x + 1) / 2) * rect.width,
                clientY: rect.top + ((1 - screen.y) / 2) * rect.height
            };
        },
        // Perf HUD reading (labs dashboard, docs/audit.md §7); null until the
        // 3D view has produced a sample.
        perf: () => perfCache
    };
    window.setItemSize = (key, value) => {
        const fixture = AppState.selectedFixture;
        const metres = parseFloat(value) / 100;
        if (!fixture || !Number.isFinite(metres) || metres <= 0) return;
        if (!fixture.size) fixture.size = {};
        fixture.size[key] = metres;
        saveAndSync({ tag: 'inspector' });
    };
    window.setItemRotation = (value) => {
        const fixture = AppState.selectedFixture;
        const radians = (parseFloat(value) * Math.PI) / 180;
        if (!fixture || !Number.isFinite(radians)) return;
        fixture.rotation = radians;
        saveAndSync({ tag: 'inspector' });
    };
    window.deleteSelectedWall = deleteSelectedWall;
    window.deleteSelected = deleteSelected;
    window.duplicateSelected = duplicateSelected;
    window.toggleSelectedVisibility = () => {
        const fixture = AppState.selectedFixture;
        if (!fixture) return;
        toggleVisible(fixture);
        // A hidden piece cannot be dragged or gizmo'd.
        if (!isVisible(fixture)) AppState.drag = null;
        saveAndSync();
        refreshGizmo();
    };
    window.toggleSelectedLock = () => {
        const fixture = AppState.selectedFixture;
        if (!fixture) return;
        fixture.locked = !fixture.locked;
        if (fixture.locked) AppState.drag = null;
        saveAndSync();
        refreshGizmo();
    };
    // --- Advanced kit actions ----------------------------------------
    window.groupSelected = groupSelection;
    window.ungroupSelected = ungroupSelection;
    window.alignDepthSelected = alignDepthSelection;
    window.snapCornerSelected = snapCornerSelection;
    window.setItemBase = (value) => {
        const fixture = AppState.selectedFixture;
        if (!fixture) return;
        setDefaultBottom(fixture, parseFloat(value));
        saveAndSync({ tag: 'inspector' });
    };
    window.setSectionHeight = (value) => sectionBox?.setHeight(parseFloat(value));
    window.startAR = startAR;
    window.exportGLB = () => export3D('glb');
    window.exportGLTF = () => export3D('gltf');
    window.exportOBJ = () => export3D('obj');
    window.openWebGPUPreview = () => labKit?.openWebGPU();
    window.setLabInstances = (value) => {
        const count = labKit?.setInstances(value) ?? 0;
        const label = document.getElementById('lab-instance-value');
        if (label) label.textContent = String(count);
        return count;
    };
    window.setLabShake = (value) => {
        const intensity = labKit?.setShake(value) ?? 0;
        const label = document.getElementById('lab-shake-value');
        if (label) label.textContent = `${Math.round(intensity * 100)}%`;
        return intensity;
    };
    window.setLabScale = (value) => {
        const scale = labKit?.setScale(value) ?? 1;
        const label = document.getElementById('lab-scale-value');
        if (label) label.textContent = `${Math.round(scale * 100)}%`;
        return scale;
    };
    window.labKit = {
        stats: () => labKit?.stats() || null,
        setInstances: (value) => labKit?.setInstances(value),
        setShake: (value) => labKit?.setShake(value),
        setScale: (value) => labKit?.setScale(value),
        webgpu: () => labKit?.openWebGPU()
    };
    window.flushAutosave = () => autosave?.flush();
    window.advancedKit = {
        features: ADVANCED_FEATURES,
        schemaVersion: PROJECT_SCHEMA_VERSION,
        warnings: () => AppState.warnings,
        summary: () => AppState.summary,
        section: () => sectionBox,
        walkthrough: () => walkthrough,
        autosave: () => autosave?.stats,
        historyDepth: () => stateManager?.history?.length || 0,
        xr: () => xrSupport()
    };

    // --- Studio kit actions ------------------------------------------
    window.addStorey = () => addNewStorey();
    window.toggleWalk = () => togglePlanWalk();
    window.setFinishTarget = (target) => setFinishTarget(target);
    window.applyFinishTexture = (texture) => applyFinishTexture(texture);
    window.applyFinishColour = (colour) => applyFinishColour(colour);
    window.applyWallCovering = (id) => applyWallCovering(id);
    window.refreshWallCoverings = refreshWallCoveringPanel;
    window.refreshFinishes = refreshFinishPanel;
    window.selectOpening = (id) => selectOpening(id);
    window.deleteOpening = (id) => deleteOpening(id);
    window.deleteCutoutSelection = () => deleteCutoutSelection();
    window.refreshOpenings = refreshOpeningsPanel;
    window.setStorey = (index) => setStorey(Number(index));
    window.removeStorey = (index) => removeStoreyAt(Number(index));
    window.toggleStoreyVisible = (index) => toggleStoreyVisible(Number(index));
    window.setStoreyHeight = (value) => setActiveStoreyHeight(parseFloat(value));
    window.setRoomFloor = (key, texture) => setRoomFloor(key, texture);
    window.setCabinetConfig = (key, value) => updateCabinetConfig(key, value);
    window.analyzeKitchen = () => analyzeKitchenLayout();
    window.suggestKitchenRun = (count) => suggestKitchenRun(count ? Number(count) : 5);
    window.exportManufacturing = (format) => exportManufacturing(format);
    window.saveProjectAs = (name) => saveProjectAs(name);
    window.openProject = (id) => openProject(id);
    window.removeProject = (id) => removeProject(id);
    window.refreshProjects = refreshProjectsPanel;

    // --- Stair suite actions ------------------------------------------
    window.setStairField = (key, value) => applyStairField(key, value);
    window.addStairFromPanel = () => addStairFromPanel();
    window.walkStairs = () => toggleStairWalk();
    window.exportStairTakeoff = () => exportStairTakeoff();
    window.refreshStairPanel = refreshStairPanel;
    window.saveStairPreset = (name) => saveSelectedStairPreset(name);
    window.useStairPreset = (id) => useStairPreset(id);
    window.removeStairPreset = (id) => {
        const removed = removeStairPreset(id);
        refreshStairPresetPalette();
        return removed;
    };
    window.refreshStairPresets = refreshStairPresetPalette;
    window.stairKit = {
        systems: () => OUTDOOR_SYSTEMS,
        design: () => currentStairDesign(),
        assembly: () => currentStairAssembly(),
        clashes: () => findStairClashes(currentStairAssembly(), { walls: AppState.walls, item: stairPanelApi().selected }),
        walker: () => stairPanelApi().walker(),
        selected: () => stairPanelApi().selected,
        stairs: () => AppState.fixtures.filter(isStairItem),
        summary: () => assemblySummary(currentStairAssembly())
    };

    // --- Landscape actions --------------------------------------------
    window.setLandscapeField = (key, value) => applyLandscapeField(key, value);
    window.addLandscapeFromPanel = () => addLandscapeFromPanel();
    window.refreshLandscapePanel = refreshLandscapePanel;
    window.landscapeKit = {
        design: () => currentWaterDesign(),
        rules: () => WATER_FEATURE_TYPES.map((key) => ({ key, label: WATER_FEATURE_LABELS[key] })),
        summary: () => waterSummary(currentWaterDesign())
    };

    // Deck suite handle: the framing config sent from deck-designer.html.
    window.deckKit = {
        draft: () => AppState.deckDraft || null,
        design: () => deckEditorDesign(),
        summary: () => deckEditorSummary(window.deckKit.design()),
        lines: () => deckDraftLines(window.deckKit.design()),
        scene: () => suiteSceneStats(deckSceneGroup)
    };

    // Electrical suite handle: the dwelling config sent from its designer.
    window.electricalKit = {
        draft: () => AppState.electricalDraft || null,
        design: () => electricalEditorDesign(),
        summary: () => electricalEditorSummary(window.electricalKit.design()),
        circuits: () => window.electricalKit.design()?.circuits || [],
        lines: () => electricalDraftLines(window.electricalKit.design()),
        scene: () => suiteSceneStats(electricalSceneGroup)
    };

    // Framing suite handle: the member choices from framing-designer.html and
    // the frame built from the plan that is actually on screen.
    window.framingKit = {
        draft: () => AppState.framingDraft || null,
        enabled: () => AppState.framingEnabled,
        toggle: (force) => { toggleFraming(force); return AppState.framingEnabled; },
        design: () => framingResult?.design || null,
        summary: () => framingEditorSummary(framingResult?.design || null),
        scene: () => ({ ...framingSceneStats(framingGroup), wallRoot: conversionEngine?.wallRoot?.visible !== false }),
        lines: () => framingDraftLines(framingResult?.design || null),
        refresh: () => { refreshFramingOverlay(); return framingResult?.design || null; }
    };
    window.toggleFraming = toggleFraming;
    refreshFramingPanel();

    // Systems handle: the cross-suite panels, their current models and the
    // same actions the panel buttons call.
    window.systemsKit = {
        systems: () => STUDIO_SYSTEMS.map(({ id, label, suite }) => ({ id, label, suite })),
        active: () => activeSystemId,
        select: (id) => selectSystemPanel(id),
        refresh: () => { refreshSystemsPanel(); return activeSystemId; },
        model: (id = activeSystemId) => systemById(id)?.panel(systemsContext()[id] || {}) || null,
        action: (id) => handleSystemAction(id),
        bid: () => systemById('bid').snapshot(),
        bim: () => systemById('bim').snapshot(systemsContext().bim)
    };
    window.selectSystemPanel = selectSystemPanel;
    // Deferred: the bid panel harvests every saved suite, and boot should not
    // wait on a panel the user has not opened yet.
    setTimeout(refreshSystemsPanel, 0);

    window.addCommentHere = () => addCommentAt(AppState.cursor || planCenter());
    window.resolveComment = (id) => resolveComment(id);
    window.selectComment = (id) => selectComment(id);
    // Kitchen suite handle: the run that was just imported and its checks.
    window.kitchenKit = {
        draft: () => AppState.kitchenDraft || null,
        added: () => AppState.kitchenDraft?.added || 0,
        layout: () => AppState.layoutReport,
        analyze: () => analyzeKitchenLayout()
    };
    window.studioKit = {
        features: STUDIO_FEATURES,
        storeys: () => storeySummary(AppState),
        stack: () => storeyStack(AppState.stories),
        openings: () => activeOpenings().map((opening) => ({
            id: opening.id,
            points: opening.points.map((point) => ({ x: point.x, y: point.y })),
            area: openingAreaMetres(opening)
        })),
        construction: () => storeyConstruction(AppState.stories?.[AppState.currentStoryIndex] || {}),
        walk: () => planWalk?.status || null,
        finishes: () => ({
            target: AppState.finishTarget,
            wallTexture: AppState.defaultWallTexture,
            floorTexture: AppState.defaultFloorTexture,
            wall: selectedWall() ? wallFinishOf(selectedWall(), AppState.fixtureStyles, AppState.defaultWallTexture) : null,
            covering: activeWallCoveringId()
        }),
        rooms: () => AppState.rooms,
        layout: () => AppState.layoutReport,
        projects: () => AppState.projects,
        collaboration: () => collaboration?.status() || null,
        render: () => renderLoop?.stats || null,
        convert: () => AppState.lastConvert,
        history: () => ({
            index: stateManager?.historyIndex,
            depth: stateManager?.history?.length || 0,
            // Delta history exposes command metadata, not full project copies.
            commands: (stateManager?.history || [])
                .filter((entry) => entry && !entry.initial)
                .map((entry) => ({ tag: entry.tag || null, at: entry.at || 0 }))
        }),
        manufacturing: () => manufacturingPackage(AppState.fixtures)
    };

    // The lighting suite's applied draft, for its own hand-off checks.
    window.lightingKit = {
        draft: () => AppState.lightingDraft || null,
        fixtures: () => (AppState.fixtures || [])
            .filter((fixture) => ['ceiling_light', 'wall_switch', 'wall_socket'].includes(fixture.type))
            .map((fixture) => ({
                id: fixture.id,
                type: fixture.type,
                x: fixture.x,
                y: fixture.y,
                wall: fixture.boundToWallId || null,
                elevation: fixture.elevation || 0
            })),
        walls: () => (AppState.walls || []).length,
        summary: () => AppState.lightingDraft
            ? {
                room: AppState.lightingDraft.roomType,
                added: AppState.lightingDraft.added,
                lights: AppState.lightingDraft.metrics?.litCount ?? null
            }
            : null
    };

    window.exportProject = exportProject;
    window.export3D = export3D;
    window.setBgScale = (val) => {
        AppState.backgroundScale = parseFloat(val);
        document.getElementById('bg-scale-val').textContent = val + 'x';
        draw2D();
    };
    window.clearProject = clearProject;
    // Category collapse for the palette (also provided by the classic page
    // script; this copy keeps the headers working if that script is blocked).
    window.toggleCategory = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const icon = document.getElementById(`${id}-icon`);
        if (el.classList.contains('hidden')) {
            el.classList.remove('hidden');
            el.classList.add('grid');
            if (icon) icon.innerHTML = 'expand_more';
        } else {
            el.classList.add('hidden');
            el.classList.remove('grid');
            if (icon) icon.innerHTML = 'chevron_right';
        }
    };
    // Start New: a blank single-storey plan on the wall tool, in 2D.
    window.startNewProject = () => {
        clearProject();
        setTool('wall');
        setActiveToolBtn('wall');
        setViewMode('2d');
        setStatus('New project started. Click and drag on the plan to draw walls.');
    };
    // Master scene: every storey visible, every visual overlay on, 3D view.
    // Interaction-hijacking modes (comments, ruler, walkthrough, turntable)
    // and hiding ones (hideWalls3D, sectionBox, wireframe, fog) stay off so
    // the master view is always a complete, readable model.
    window.showMasterScene = () => {
        const skip = new Set(['hideWalls3D', 'comments', 'ruler', 'walkthrough', 'turntable', 'sectionBox', 'wireframe3D', 'fog3D']);
        if (abilities?.list) {
            abilities.list.forEach((ability) => {
                if (ability.kind === 'toggle' && !skip.has(ability.id)) {
                    abilities.state[ability.key || ability.id] = true;
                }
            });
        }
        (AppState.stories || []).forEach((story) => { story.visible = true; });
        refreshStoreyPanel();
        refreshAbilities();
        setViewMode('3d');
        update3D();
        draw2D();
        setStatus('Master scene: all storeys and overlays on.');
        return true;
    };
    // Live cross-page scene: suite drafts saved in another tab (deck,
    // electrical, framing, kitchen, …) re-apply here so the 3D scene and the
    // Systems panel update without a reload.
    window.addEventListener('storage', (event) => {
        if (!event.key || !/draft|plan|price|schedule|permits/i.test(event.key)) return;
        try {
            const touched = [
                applyRoofEditorDraft(),
                applyWallEditorDraft(),
                applyLightingEditorDraft(),
                applyDeckEditorDraft(),
                applyElectricalEditorDraft(),
                applyLandscapeEditorDraft(),
                applyFramingEditorDraft(),
                applyKitchenEditorDraft()
            ].some(Boolean);
            if (touched) update3D();
            refreshSystemsPanel();
        } catch (error) {
            console.warn('Live suite sync skipped:', error);
        }
    });
}

/** Transient plan notice (invalid placement, new project, master scene). */
function setStatus(message, isError = false) {
    if (!message) return;
    let note = document.getElementById('plan-status');
    if (!note) {
        note = document.createElement('div');
        note.id = 'plan-status';
        note.setAttribute('role', 'status');
        note.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-xs font-medium shadow-lg pointer-events-none transition-opacity';
        document.body.appendChild(note);
    }
    note.textContent = message;
    note.style.background = isError ? 'rgba(153,27,27,.92)' : 'rgba(17,24,39,.85)';
    note.style.color = '#fff';
    note.style.opacity = '1';
    clearTimeout(note._hide);
    note._hide = setTimeout(() => { note.style.opacity = '0'; }, 3200);
}

function showWelcomeToast() {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-4 rounded-lg shadow-xl transform transition-all duration-500 translate-y-20 z-50 flex items-center gap-4';
    toast.innerHTML = `
        <div class="bg-primary/20 p-2 rounded-full">
            <span class="material-symbols-outlined text-primary">auto_awesome</span>
        </div>
        <div>
            <h4 class="font-bold">Welcome to Studio</h4>
            <p class="text-sm text-gray-400">Start drawing walls or upload a plan to begin.</p>
        </div>
        <button type="button" data-toast-close class="text-gray-500 hover:text-white">
            <span class="material-symbols-outlined">close</span>
        </button>
    `;
    toast.querySelector('[data-toast-close]')?.addEventListener('click', () => toast.remove());
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-20');
    });
    
    // Auto dismiss
    setTimeout(() => {
        if(toast.parentElement) {
            toast.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }
    }, 5000);
}

// ------------------------------------------------------------------
// 2D Logic
// ------------------------------------------------------------------

function init2D() {
    blueprintCanvas = document.getElementById('blueprint-canvas');
    if (!blueprintCanvas) return;
    blueprintCtx = blueprintCanvas.getContext('2d');
}

/** Exact plan position of a pointer event, without grid snapping. */
function getPlanCoordinates(event) {
    const rect = blueprintCanvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left - AppState.offset.x) / AppState.scale,
        y: (event.clientY - rect.top - AppState.offset.y) / AppState.scale
    };
}

function getCanvasCoordinates(event) {
    let { x, y } = getPlanCoordinates(event);
    
    // Snap to grid
    if (AppState.gridSize > 0 && !event.shiftKey) {
        x = Math.round(x / AppState.gridSize) * AppState.gridSize;
        y = Math.round(y / AppState.gridSize) * AppState.gridSize;
    }
    
    return { x, y };
}

function onPointerDown(e) {
    if (e.button === 2 || e.buttons === 4) { // Right click or middle click
        AppState.isPanning = true;
        AppState.panStart = { x: e.clientX, y: e.clientY };
        blueprintCanvas.style.cursor = 'grabbing';
        return;
    }

    const pos = getCanvasCoordinates(e);
    AppState.cursor = pos;
    // A zero-size canvas (or a zoomed-out embed) yields NaN/Infinity: no tool
    // can use that, and drawing it would poison the plan. Ignore the gesture.
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

    // Comment mode turns a plan click into a pin (or selects an existing pin).
    if (abilitiesState().comments) {
        addCommentAt(pos);
        draw2D(pos);
        return;
    }

    // Ruler takes clicks ahead of the current tool: first click sets the start,
    // second the end, a third click begins a new measurement.
    if (abilitiesState().ruler) {
        const ruler = AppState.ruler || {};
        if (!ruler.start || ruler.end) AppState.ruler = { start: pos, end: null };
        else AppState.ruler = { start: ruler.start, end: pos };
        draw2D(pos);
        return;
    }

    // Handle Tool Interaction
    if (AppState.currentTool === 'wall') {
        // Only the primary button starts a wall; right/middle buttons pan.
        if (e.button !== 0 && e.button !== undefined) return;
        if (e.isPrimary === false) return;
        AppState.isDrawing = true;
        AppState.wallStart = pos;
        AppState.cursor = pos;
        try { blueprintCanvas.setPointerCapture(e.pointerId); } catch { /*_mouse: capture is best-effort */ }
        if (e.cancelable) e.preventDefault();
        draw2D(pos);
    } else if (AppState.currentTool === 'delete') {
        deleteObjectAt(pos.x, pos.y);
    } else if (AppState.currentTool === 'select') {
        // Wall endpoints first: they sit on top of the wall line so reshaping a
        // corner wins over selecting the whole wall.
        const node = wallNodeAt(pos);
        if (node) {
            AppState.wallNodeDrag = node;
            AppState.selectedWallId = node.id;
            AppState.selectedFixture = null;
            AppState.drag = null;
            draw2D(pos);
            refreshGizmo();
            syncSelectionPanels();
            return;
        }

        const fixture = fixtureAt(AppState.fixtures, pos, {
            slack: 10 / AppState.scale,
            storeyHeight: activeStoreyHeight()
        });
        AppState.selectedFixture = fixture;
        AppState.selectedWallId = fixture ? null : wallAt(pos);

        // Locked (or hidden) pieces can be selected and inspected, but never
        // dragged until they are unlocked.
        const abilityState = abilitiesState();
        const movable = fixture && !fixture.locked && fixture.visible !== false;
        AppState.drag = movable
            ? beginDrag(fixture, pos, {
                fixtures: AppState.fixtures,
                collision: abilityState.collisionDetect !== false
            })
            : null;
        // Group members keep their offsets from the grabbed piece (feature 25).
        AppState.groupDrag = AppState.drag ? captureGroupOffsets(AppState.fixtures, fixture) : null;

        // A group moves together, so its members' old positions must not count
        // as obstacles to the piece being dragged.
        if (AppState.drag?.collisionIndex && AppState.groupDrag?.length) {
            const moving = new Set([fixture, ...AppState.groupDrag.map((entry) => entry.item)]);
            AppState.drag.collisionIndex = buildCollisionIndex(
                AppState.fixtures.filter((candidate) => !moving.has(candidate))
            );
        }
        draw2D(pos);
        refreshGizmo();
        syncSelectionPanels();
    } else if (AppState.currentTool === 'cutout') {
        // Cut a stair opening in this storey's floor: drag a new one, drag a
        // point to reshape, or drag the polygon to move it.
        startCutout(pos);
        draw2D(pos);
    } else if (AppState.currentTool) {
        // Place item
        const item = ItemFactory.create(AppState.currentTool, pos.x, pos.y);

        // A stair armed from a saved preset carries that config; the preset is
        // one-shot, so the next placement falls back to the type's own defaults.
        if (isStairItem(item) && AppState.pendingStairPreset?.stair) {
            const preset = AppState.pendingStairPreset;
            applyStairConfig(item, preset.stair);
            AppState.stairDraft = { ...preset.stair };
            AppState.pendingStairPreset = null;
            refreshStairPanel();
            const status = document.getElementById('stair-preset-status');
            if (status) status.textContent = `Placed “${preset.name}”`;
        }
        
        // In-wall items ride the wall centreline; floor items sit flush on the
        // wall face, width along the wall. Both are ability-controlled.
        const abilityState = abilitiesState();
        if (item.metadata?.type === 'in_wall' || item.metadata?.type === 'in_wall_floor') {
            if (abilityState.wallSnap !== false && item.snapToWall) item.snapToWall(AppState.walls);
        } else if (abilityState.wallSnap !== false) {
            snapToWalls(item, AppState.walls, { threshold: 24 / AppState.scale });
        }
        
        // Default style for new items
        if (!AppState.fixtureStyles[item.id]) {
            AppState.fixtureStyles[item.id] = { 
                color: item.metadata.color ? '#' + item.metadata.color.toString(16).padStart(6, '0') : '#13a4ec', 
                material: 'gloss' 
            };
        }

        // The drawn footprint is the run plus the automatic landings, which is
        // larger than the palette's metadata size; store it on placement so the
        // floor opening and every size-based read match the 3D build.
        if (isStairItem(item) && !item.size) sizeStairItem(item, activeStoreyHeight());

        // Placement validity runs after wall/flush snapping and after the stair
        // footprint has been sized: a piece that would pass through a wall is
        // rejected instead of being added and immediately invalid.
        if (!item.isValidPosition(item.x, item.y, { walls: AppState.walls })) {
            setStatus('That position crosses a wall. Move it clear of the wall and try again.', true);
            draw2D(pos);
            return;
        }

        AppState.fixtures.push(item);
        
        // Save & Update
        saveAndSync();
        
        // Reset tool to default after placement (optional UX choice)
        // setTool('select'); 
    }
}

function onPointerMove(e) {
    if (AppState.isPanning) {
        const dx = e.clientX - AppState.panStart.x;
        const dy = e.clientY - AppState.panStart.y;
        AppState.offset.x += dx;
        AppState.offset.y += dy;
        AppState.panStart = { x: e.clientX, y: e.clientY };
        draw2D();
        return;
    }

    if (AppState.openingDrag) {
        const cutPos = getCanvasCoordinates(e);
        updateCutout(cutPos);
        draw2D(cutPos);
        return;
    }

    if (AppState.wallNodeDrag) {
        const nodePos = getCanvasCoordinates(e);
        moveWallNode(nodePos, e.shiftKey);
        draw2D(nodePos);
        scheduleDragUpdate();
        return;
    }

    if (AppState.drag) {
        const dragPos = getCanvasCoordinates(e);
        const abilityState = abilitiesState();
        const fixture = AppState.drag.fixture;

        dragTo(AppState.drag, dragPos, AppState.walls, {
            gridSize: abilityState.gridSnap === false ? 0 : AppState.gridSize,
            snapThreshold: 20 / AppState.scale,
            wallSnap: abilityState.wallSnap !== false,
            collision: abilityState.collisionDetect !== false
        });

        // Advanced snapping rules (feature 20): depth plane + inside corner.
        if (abilityState.alignDepth) alignDepth(fixture, AppState.fixtures, { threshold: 0.3 * SCALE });
        if (abilityState.insideCorners) snapToCorner(fixture, AppState.walls, { toward: dragPos });

        // Assemblies move as one (feature 25).
        applyGroupDelta(AppState.groupDrag || [], fixture);

        if (abilityState.livePreview !== false) {
            // Move the built meshes directly; the CSG rebuild waits for drop (34).
            previewDrag({
                fixture,
                members: AppState.groupDrag || [],
                getObject: findItemObject,
                view: planViewSize()
            });
        } else {
            scheduleDragUpdate();
        }

        draw2D(dragPos);
        renderLoop?.requestRender();
        return;
    }

    const pos = getCanvasCoordinates(e);
    
    // Redraw for hover effects / previews
    draw2D(pos); 
}

function onPointerUp(e) {
    if (AppState.isPanning) {
        AppState.isPanning = false;
        blueprintCanvas.style.cursor = 'crosshair';
        return;
    }

    if (AppState.openingDrag) {
        finishCutout();
        draw2D();
        return;
    }

    if (AppState.wallNodeDrag) {
        AppState.wallNodeDrag = null;
        saveAndSync();
        draw2D();
        return;
    }

    if (AppState.drag) {
        const activeDrag = AppState.drag;
        const groupDrag = AppState.groupDrag || [];
        const dragged = activeDrag.fixture;
        const snappedWall = activeDrag.snappedWall;
        AppState.drag = null;
        AppState.groupDrag = null;

        // "Turn to wall": align the piece with the wall it landed on.
        if (dragged && abilitiesState().autoRotateToWall) {
            const wall = snappedWall || nearestWall(dragged);
            if (wall) dragged.rotation = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
        }

        // Commit only a placement that clears every wall. If the drag crossed
        // one, put the piece (and its group) back where the gesture started.
        if (dragged && !dragged.isValidPosition(dragged.x, dragged.y, { walls: AppState.walls })) {
            dragged.x = activeDrag.origin.x;
            dragged.y = activeDrag.origin.y;
            dragged.rotation = activeDrag.origin.rotation;
            applyGroupDelta(groupDrag, dragged);
            setStatus('That position crosses a wall. The piece was returned to its starting point.', true);
        }

        saveAndSync();
        draw2D();
        return;
    }

    if (AppState.isDrawing && AppState.currentTool === 'wall') {
        const rawEnd = getCanvasCoordinates(e);
        const start = AppState.wallStart;
        try { if (blueprintCanvas.hasPointerCapture?.(e.pointerId)) blueprintCanvas.releasePointerCapture(e.pointerId); } catch { /* best-effort */ }
        if (start && [start.x, start.y, rawEnd.x, rawEnd.y].every(Number.isFinite)) {
            // Shift constrains the angle to 15° steps while drawing.
            const end = e.shiftKey ? snapAngle(start, rawEnd) : rawEnd;

            // Min length check (approx 30cm)
            if (Math.hypot(end.x - start.x, end.y - start.y) > 10) {
                if (!Array.isArray(AppState.walls)) AppState.walls = [];
                AppState.walls.push(new Wall(start.x, start.y, end.x, end.y));
                saveAndSync();
            }
        }

        AppState.isDrawing = false;
        AppState.wallStart = null;
        draw2D();
    }
}

/** A cancelled gesture (touch interrupt, alert, pointer lost) must never leave a stuck wall preview. */
function onPointerCancel(e) {
    try { if (blueprintCanvas.hasPointerCapture?.(e.pointerId)) blueprintCanvas.releasePointerCapture(e.pointerId); } catch { /* best-effort */ }
    if (AppState.isDrawing || AppState.wallStart) {
        AppState.isDrawing = false;
        AppState.wallStart = null;
        draw2D();
    }
}

function onWheel(e) {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity);
    
    // Zoom towards mouse pointer
    const rect = blueprintCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    AppState.offset.x -= (mouseX - AppState.offset.x) * (zoom - 1);
    AppState.offset.y -= (mouseY - AppState.offset.y) * (zoom - 1);
    AppState.scale *= zoom;
    
    draw2D();
}

/** Double-clicking a wall splits it at the clicked point (inheriting its height). */
function onDoubleClick(e) {
    if (AppState.viewMode !== '2d') return;
    // Hit-test the exact point: grid snapping here would miss walls that do not
    // sit on the grid.
    const pos = getPlanCoordinates(e);

    // Cutout tool: a double-click on an edge bends the polygon there.
    if (AppState.currentTool === 'cutout') {
        const opening = selectedOpening() || openingAt(activeOpenings(), pos);
        const edge = opening ? edgeAt(opening, pos, 12 / AppState.scale) : -1;
        if (opening && edge >= 0) {
            insertVertex(opening, edge, pos);
            AppState.selectedOpeningId = opening.id;
            AppState.selectedVertexIndex = edge + 1;
            saveAndSync();
        }
        return;
    }

    const id = wallAt(pos);
    if (!id) return;

    const wall = AppState.walls.find((item) => item.id === id);
    if (!wall) return;

    const t = projectionOnSegment(pos, wall.start, wall.end);
    if (t <= 0.05 || t >= 0.95) return;

    const point = {
        x: wall.start.x + (wall.end.x - wall.start.x) * t,
        y: wall.start.y + (wall.end.y - wall.start.y) * t
    };

    const tail = new Wall(point.x, point.y, wall.end.x, wall.end.y, wall.thickness, null, wall.height);
    wall.end = { ...point };
    AppState.walls.push(tail);
    AppState.selectedWallId = tail.id;
    saveAndSync();
}

function deleteObjectAt(x, y) {
    const point = { x, y };

    // Items are hit-tested on their rotated footprint, so clicking any part of
    // a long or resized piece removes that piece rather than a neighbour whose
    // centre happens to be closer. The same helper the selector uses keeps the
    // two interactions in agreement.
    const fixture = fixtureAt(AppState.fixtures, point, {
        slack: 10 / AppState.scale,
        storeyHeight: activeStoreyHeight()
    });
    if (fixture) {
        AppState.fixtures.splice(AppState.fixtures.indexOf(fixture), 1);
        saveAndSync();
        return;
    }

    // Walls are hit-tested on the whole centreline, not only its midpoint, so a
    // click near either end deletes the wall it is visually over.
    const wallId = wallAt(point);
    if (wallId) {
        AppState.walls.splice(AppState.walls.findIndex((wall) => wall.id === wallId), 1);
        saveAndSync();
    }
}

// ------------------------------------------------------------------
// Selection: walls and item actions
// ------------------------------------------------------------------

/** Snaps a point to 15° steps around an anchor, keeping its distance. */
function snapAngle(anchor, point, stepDegrees = 15) {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const length = Math.hypot(dx, dy);
    const step = (stepDegrees * Math.PI) / 180;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    return { x: anchor.x + Math.cos(angle) * length, y: anchor.y + Math.sin(angle) * length };
}

/** 0..1 position of the closest point on a segment. */
function projectionOnSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return 0;
    return Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
}

function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return Math.hypot(point.x - start.x, point.y - start.y);

    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/** Id of the wall within a few screen pixels of a plan point, or null. */
function wallAt(pos) {
    const threshold = 12 / AppState.scale;
    let closest = null;
    let closestDistance = Infinity;

    AppState.walls.forEach((wall) => {
        const distance = distanceToSegment(pos, wall.start, wall.end);
        if (distance < threshold && distance < closestDistance) {
            closest = wall.id;
            closestDistance = distance;
        }
    });

    return closest;
}

function selectedWall() {
    return AppState.walls.find((wall) => wall.id === AppState.selectedWallId) || null;
}

/** Closest wall to a fixture centre (turn-to-wall ability). */
function nearestWall(fixture) {
    let closest = null;
    let closestDistance = Infinity;

    AppState.walls.forEach((wall) => {
        const distance = distanceToSegment(fixture, wall.start, wall.end);
        if (distance < closestDistance) {
            closest = wall;
            closestDistance = distance;
        }
    });

    return closest;
}

/** Wall endpoint within a few screen pixels of a plan point. */
function wallNodeAt(pos) {
    const threshold = 10 / AppState.scale;
    for (let i = 0; i < AppState.walls.length; i++) {
        const wall = AppState.walls[i];
        if (Math.hypot(wall.start.x - pos.x, wall.start.y - pos.y) < threshold) return { id: wall.id, end: 'start' };
        if (Math.hypot(wall.end.x - pos.x, wall.end.y - pos.y) < threshold) return { id: wall.id, end: 'end' };
    }
    return null;
}

/** Move the dragged endpoint, snapping to the grid and to other endpoints. */
function moveWallNode(pos, constrainAngle = false) {
    const drag = AppState.wallNodeDrag;
    if (!drag) return;
    const wall = AppState.walls.find((item) => item.id === drag.id);
    if (!wall) return;

    // Shift locks the runaway angle to 15° steps from the opposite end.
    if (constrainAngle) {
        pos = snapAngle(drag.end === 'start' ? wall.end : wall.start, pos);
    }

    const abilityState = abilitiesState();
    const step = AppState.gridSize;
    let x = abilityState.gridSnap === false ? pos.x : Math.round(pos.x / step) * step;
    let y = abilityState.gridSnap === false ? pos.y : Math.round(pos.y / step) * step;

    if (abilityState.joinSnap === false) {
        if (drag.end === 'start') wall.start = { x, y };
        else wall.end = { x, y };
        return;
    }

    const joinThreshold = 12 / AppState.scale;
    AppState.walls.forEach((other) => {
        if (other.id === wall.id) return;
        [other.start, other.end].forEach((point) => {
            if (Math.hypot(point.x - x, point.y - y) < joinThreshold) {
                x = point.x;
                y = point.y;
            }
        });
    });

    if (drag.end === 'start') wall.start = { x, y };
    else wall.end = { x, y };
}

function setPanelText(id, text) {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
}

/** Mirrors the current fixture/wall selection into the sidebar inspector. */
function syncSelectionPanels() {
    const itemPane = document.getElementById('selection-item');
    const wallPane = document.getElementById('selection-wall');
    const emptyPane = document.getElementById('selection-empty');
    if (!itemPane || !wallPane) return;

    const fixture = AppState.selectedFixture;
    const wall = selectedWall();

    itemPane.classList.toggle('hidden', !fixture);
    wallPane.classList.toggle('hidden', !wall);
    if (emptyPane) emptyPane.classList.toggle('hidden', !!(fixture || wall));

    if (fixture) {
        setPanelText('sel-item-name', fixture.metadata?.label || fixture.type.replace(/_/g, ' '));
        setPanelText('sel-item-pos', `${(fixture.x / SCALE).toFixed(2)} , ${(fixture.y / SCALE).toFixed(2)} m`);
        const base = baseOf(fixture);
        setPanelText('sel-item-elev', `${base.bottom.toFixed(2)}–${base.top.toFixed(2)} m`);
        setPanelText('sel-item-visible', fixture.visible === false ? 'Show' : 'Hide');
        setPanelText('sel-item-lock', fixture.locked ? 'Unlock' : 'Lock');

        // Per-axis lock buttons read as pressed when that axis is held.
        const axes = lockedAxesOf(fixture);
        const lockX = document.getElementById('sel-item-lock-x');
        const lockZ = document.getElementById('sel-item-lock-z');
        if (lockX) lockX.classList.toggle('bg-amber-100', axes.x);
        if (lockZ) lockZ.classList.toggle('bg-amber-100', axes.z);

        const dims = itemDimensions(fixture);
        const sizeFields = { 'sel-item-width': dims.width, 'sel-item-depth': dims.depth, 'sel-item-height': dims.height };
        Object.entries(sizeFields).forEach(([id, metres]) => {
            const input = document.getElementById(id);
            if (input && document.activeElement !== input) input.value = Math.round(metres * 100);
        });
        const rotation = document.getElementById('sel-item-rotation');
        if (rotation && document.activeElement !== rotation) rotation.value = Math.round((fixture.rotation * 180) / Math.PI);

        // Stair and water-feature option bars follow the selection.
        refreshStairPanel();
        refreshLandscapePanel();

        // Parametric cabinet controls (studio feature 44). Any cabinet accepts
        // a config; the first edit switches it off its fixed line builder.
        const cabinetPane = document.getElementById('cabinet-config');
        if (cabinetPane) {
            const isCabinet = isCabinetType(fixture.type);
            cabinetPane.classList.toggle('hidden', !isCabinet);
            if (isCabinet) {
                const config = cabinetConfigOf(fixture);
                const style = document.getElementById('cabinet-door-style');
                if (style && document.activeElement !== style) style.value = config.doorStyle;
                ['doors', 'drawers', 'shelves'].forEach((key) => {
                    const input = document.getElementById(`cabinet-${key}`);
                    if (input && document.activeElement !== input) input.value = config[key];
                });
            }
        }
    }

    if (wall) {
        const view = planViewSize();
        setPanelText('sel-wall-len', `${wallLengthMetres(wall, view).toFixed(2)} m ${wallHeightOf(wall).toFixed(1)} m high`);
        const heightInput = document.getElementById('sel-wall-height');
        if (heightInput && document.activeElement !== heightInput) {
            heightInput.value = wallHeightOf(wall).toFixed(1);
        }

        // Per-wall finish, from the same style map items use.
        const style = AppState.fixtureStyles[wall.id] || {};
        const colorInput = document.getElementById('sel-wall-color');
        if (colorInput && document.activeElement !== colorInput) {
            colorInput.value = style.color || '#e0e0e0';
        }
        const textureSelect = document.getElementById('sel-wall-texture');
        if (textureSelect && document.activeElement !== textureSelect) {
            // An uploaded image is not a preset; show the default state instead.
            textureSelect.value = style.texture && !isUploadedTexture(style.texture) ? style.texture : '';
        }
    }

    // The finishes palette follows the selected wall (if any).
    refreshFinishPanel();
    refreshWallCoveringPanel();
}

const isCabinetType = (type) => /cabinet|pantry|island|sink_base|drawer_base|oven_tower/.test(String(type || ''));

function duplicateSelected() {
    const fixture = AppState.selectedFixture;
    if (!fixture) return;

    // Clone through the feature kit so the copy keeps size, lift, locks and
    // flip state, and gets a style entry of its own.
    const copy = cloneItem(fixture, { dx: 0.3, dy: 0.3, styles: AppState.fixtureStyles });
    if (!copy) return;

    AppState.fixtures.push(copy);
    AppState.selectedFixture = copy;
    AppState.selectedWallId = null;
    saveAndSync();
}

function deleteSelected() {
    const fixture = AppState.selectedFixture;
    if (!fixture) return;

    AppState.fixtures = AppState.fixtures.filter((item) => item.id !== fixture.id);
    delete AppState.fixtureStyles[fixture.id];
    AppState.selectedFixture = null;
    saveAndSync();
}

function deleteSelectedWall() {
    const wall = selectedWall();
    if (!wall) return;

    AppState.walls = AppState.walls.filter((item) => item.id !== wall.id);
    // Openings lose their host wall rather than disappearing with it.
    AppState.fixtures.forEach((fixture) => {
        if (fixture.boundToWallId === wall.id) fixture.boundToWallId = null;
    });
    AppState.selectedWallId = null;
    saveAndSync();
}

// ------------------------------------------------------------------
// Scene abilities (49)
// ------------------------------------------------------------------

function abilitiesState() {
    return abilities ? abilities.state : {};
}

/** Keeps the plan/3D in step with the ability flags. */
function refreshAbilities() {
    const state = abilitiesState();
    AppState.showDimensions = Boolean(state.dimensions);

    if (scene3D) {
        apply3DAbilities(
            { scene: scene3D, renderer: renderer3D, controls: AppState.elevationSide ? orthoControls3D : controls3D },
            state,
            { grid: gridHelper3D, axes: axesHelper3D }
        );
    }

    // Advanced view modes are renderer-level, so they follow the flags here.
    if (sectionBox) sectionBox.setEnabled(Boolean(state.sectionBox));
    if (walkthrough) walkthrough.setEnabled(Boolean(state.walkthrough));
    if (labKit) {
        labKit.setPlan(worldBounds(), activeStoreyElevation());
        labKit.apply(state);
    }

    // Height annotations and warning panels are editor-side, so they follow
    // their ability flags here. Room floors change the geometry (per-room
    // surfaces vs. the slab), so the rebuild happens after the derived plan
    // data is fresh; the wall builder reuses the walls.
    refreshPlanDerived();
    if (conversionEngine) update3D();
    else refreshElevationAnnotations();
    applyAbilityPanel();
    if (blueprintCanvas) blueprintCanvas.style.cursor = state.comments ? 'copy' : 'crosshair';
    renderLoop?.requestRender();
    draw2D();
}

/** Keep the header Dims switch on the ability flag (the abilities panel and
 *  undo/redo can move the flag without touching the header). */
function syncDimensionsSwitch() {
    const on = abilitiesState().dimensions !== false;
    document.querySelectorAll('[data-click="toggleDimensions"]')?.forEach((node) => {
        if (node instanceof HTMLInputElement && node.type === 'checkbox') node.checked = on;
    });
}

/** Re-reads toggle state into the rendered panel (actions do not need it). */
function applyAbilityPanel() {
    const container = document.getElementById('abilities-list');
    if (!container || !abilities) return;

    container.querySelectorAll('[data-ability]').forEach((node) => {
        const ability = abilities.list.find((entry) => entry.id === node.dataset.ability);
        if (!ability || ability.kind !== 'toggle') return;
        const checkbox = node.querySelector('input');
        if (checkbox) checkbox.checked = Boolean(abilities.state[ability.key]);
    });
    syncDimensionsSwitch();
}

function renderAbilityPanel() {
    const container = document.getElementById('abilities-list');
    if (!container || !abilities) return;

    container.innerHTML = '';
    let currentGroup = null;
    let groupWrap = null;

    abilities.list.forEach((ability) => {
        if (ability.group !== currentGroup) {
            currentGroup = ability.group;
            groupWrap = document.createElement('div');
            groupWrap.className = 'mt-2';
            const heading = document.createElement('p');
            heading.className = 'text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1';
            heading.textContent = ability.group;
            groupWrap.appendChild(heading);
            container.appendChild(groupWrap);
        }

        if (ability.kind === 'toggle') {
            const row = document.createElement('label');
            row.dataset.ability = ability.id;
            row.className = 'flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer';

            const text = document.createElement('span');
            text.className = 'text-xs text-gray-700 dark:text-gray-200';
            text.textContent = ability.label;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'rounded border-gray-300 text-primary focus:ring-primary';
            input.checked = Boolean(abilities.state[ability.key]);
            input.addEventListener('change', () => abilities.toggle(ability.id));

            row.append(text, input);
            groupWrap.appendChild(row);
        } else {
            const button = document.createElement('button');
            button.dataset.ability = ability.id;
            button.className = 'w-full text-left px-2 py-1 rounded-lg text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800';
            button.textContent = ability.label;
            button.addEventListener('click', () => abilities.toggle(ability.id));
            groupWrap.appendChild(button);
        }
    });

    const count = document.querySelector('[data-ability-count]');
    if (count) count.textContent = `${abilities.list.length} abilities`;
}

function initAbilities() {
    abilities = createSceneAbilities({
        refresh: refreshAbilities,
        rotateSelection,
        mirrorSelection,
        nudgeSelection,
        duplicateSelection: duplicateSelected,
        alignSelection,
        distributeSelection,
        toggleLockAll,
        toggleHideAll,
        deleteHidden,
        resetElevations,
        snapWallsToGrid,
        centerPlan,
        resetWallHeights,
        cycleWallThickness,
        removeShortWalls,
        exportCutList,
        arrayDuplicateSelection,
        copySelection,
        pasteSelection,
        flipSelection,
        repeatSelection,
        toggleAxisLock,
        groupSelection,
        ungroupSelection,
        alignDepthSelection,
        snapCornerSelection,
        exportGLB: () => export3D('glb'),
        startAR,
        openWebGPUPreview: () => labKit?.openWebGPU(),
        exportGLTF: () => export3D('gltf'),
        exportOBJ: () => export3D('obj'),
        savePreset: saveAbilityPreset,
        loadPreset: loadAbilityPreset,
        // Studio kit actions
        addNewStorey: () => addNewStorey(),
        analyzeKitchenLayout,
        suggestKitchenRun,
        exportManufacturing,
        saveNamedProjectPrompt
    });

    renderAbilityPanel();
    syncLabControls();
    refreshAbilities();
}

// --- Ability actions -------------------------------------------------

function rotateSelection(delta) {
    const fixture = AppState.selectedFixture;
    if (!fixture) return;
    fixture.rotation += delta;
    saveAndSync();
}

function mirrorSelection() {
    const fixture = AppState.selectedFixture;
    if (!fixture) return;
    fixture.rotation = -fixture.rotation;
    saveAndSync();
}

function nudgeSelection(dxMetres, dyMetres) {
    const fixture = AppState.selectedFixture;
    if (!fixture || fixture.locked) return;
    fixture.x += dxMetres * SCALE;
    fixture.y += dyMetres * SCALE;
    saveAndSync();
}

const footprintWidth = (fixture) => (fixture.metadata?.width || 0.5) * SCALE;

function alignSelection() {
    const items = AppState.fixtures.filter((fixture) => fixture.visible !== false);
    if (items.length < 2) return;

    // Align the left edges of the footprints, not the centres, so mixed-size
    // cabinets line up the way a run would.
    const leftEdge = (fixture) => fixture.x - footprintWidth(fixture) / 2;
    const leftmost = Math.min(...items.map(leftEdge));
    items.forEach((fixture) => { fixture.x = leftmost + footprintWidth(fixture) / 2; });
    saveAndSync();
}

function distributeSelection() {
    const items = [...AppState.fixtures].sort((a, b) => a.x - b.x);
    if (items.length < 3) return;

    const first = items[0].x;
    const last = items[items.length - 1].x;

    if (Math.abs(last - first) < 1) {
        // Already on one line: spread from the centre in 0.75 m steps instead of
        // collapsing them again.
        const step = 0.75 * SCALE;
        const start = (first + last) / 2 - (step * (items.length - 1)) / 2;
        items.forEach((fixture, index) => { fixture.x = start + step * index; });
    } else {
        const step = (last - first) / (items.length - 1);
        items.forEach((fixture, index) => { fixture.x = first + step * index; });
    }

    saveAndSync();
}

function toggleLockAll() {
    const anyUnlocked = AppState.fixtures.some((fixture) => !fixture.locked);
    AppState.fixtures.forEach((fixture) => { fixture.locked = anyUnlocked; });
    saveAndSync();
}

function toggleHideAll() {
    const anyVisible = AppState.fixtures.some((fixture) => fixture.visible !== false);
    AppState.fixtures.forEach((fixture) => { fixture.visible = !anyVisible; });
    saveAndSync();
}

function deleteHidden() {
    AppState.fixtures = AppState.fixtures.filter((fixture) => fixture.visible !== false);
    saveAndSync();
}

function resetElevations() {
    AppState.fixtures.forEach((fixture) => { fixture.elevation = 0; });
    saveAndSync();
}

function snapWallsToGrid() {
    const step = AppState.gridSize;
    const snap = (value) => Math.round(value / step) * step;
    AppState.walls.forEach((wall) => {
        wall.start = { x: snap(wall.start.x), y: snap(wall.start.y) };
        wall.end = { x: snap(wall.end.x), y: snap(wall.end.y) };
    });
    saveAndSync();
}

function centerPlan() {
    if (AppState.walls.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    AppState.walls.forEach((wall) => {
        minX = Math.min(minX, wall.start.x, wall.end.x);
        maxX = Math.max(maxX, wall.start.x, wall.end.x);
        minY = Math.min(minY, wall.start.y, wall.end.y);
        maxY = Math.max(maxY, wall.start.y, wall.end.y);
    });

    const dx = (minX + maxX) / 2;
    const dy = (minY + maxY) / 2;
    AppState.walls.forEach((wall) => {
        wall.start = { x: wall.start.x - dx, y: wall.start.y - dy };
        wall.end = { x: wall.end.x - dx, y: wall.end.y - dy };
    });
    AppState.fixtures.forEach((fixture) => {
        fixture.x -= dx;
        fixture.y -= dy;
    });
    saveAndSync();
}

function resetWallHeights() {
    resetWallHeightsFeature(AppState.walls);
    saveAndSync();
}

function cycleWallThickness() {
    const options = [10, 15, 20];
    const current = AppState.walls[0]?.thickness ?? options[0];
    const next = options[(options.indexOf(current) + 1) % options.length] || options[0];
    AppState.walls.forEach((wall) => { wall.thickness = next; });
    saveAndSync();
}

function removeShortWalls() {
    const minimum = 0.2 * SCALE;
    const keep = AppState.walls.filter((wall) => wall.length >= minimum);
    if (keep.length === AppState.walls.length) return;

    const removed = new Set(AppState.walls.filter((wall) => wall.length < minimum).map((wall) => wall.id));
    AppState.walls = keep;
    AppState.fixtures.forEach((fixture) => {
        if (removed.has(fixture.boundToWallId)) fixture.boundToWallId = null;
    });
    saveAndSync();
}

function exportCutList() {
    // Grouped by type and real size: ten identical cabinets are one line with
    // count 10, and a resized piece exports at its own size.
    downloadCutList(buildCutList(AppState.fixtures));
}

// ------------------------------------------------------------------
// Studio kit: storeys, room floors, projects, comments, layout
// ------------------------------------------------------------------

/** Ground floor starts out owning the legacy active arrays by reference. */
function ensureStoreyModel() {
    if (Array.isArray(AppState.stories) && AppState.stories.length > 0) return AppState.stories;
    AppState.stories = [{
        id: 'storey_ground',
        name: 'Ground floor',
        ...constructionOptions(),
        visible: true,
        walls: AppState.walls,
        fixtures: AppState.fixtures,
        openings: []
    }];
    AppState.currentStoryIndex = 0;
    return AppState.stories;
}

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

function planCenter() {
    const view = planViewSize();
    return { x: view.width / 2, y: view.height / 2 };
}

function setStorey(index) {
    ensureStoreyModel();
    if (!Number.isFinite(index) || index === AppState.currentStoryIndex) return;
    activateStorey(AppState, index);
    AppState.selectedFixture = null;
    AppState.selectedWallId = null;
    AppState.drag = null;
    AppState.groupDrag = null;
    // Openings belong to the storey that was active, so their handles go too.
    AppState.selectedOpeningId = null;
    AppState.selectedVertexIndex = null;
    AppState.cutoutDraft = null;
    AppState.openingDrag = null;
    refreshPlanDerived();
    refreshStoreyPanel();
    draw2D();
    update3D();
    syncSelectionPanels();
    refreshGizmo();
    saveToStorage();
}

function addNewStorey(options = {}) {
    ensureStoreyModel();
    const view = planViewSize();
    const source = { walls: AppState.walls || [], fixtures: AppState.fixtures || [] };
    // Second floor and above: only the exterior wall footprint and the windows
    // come up from the storey below, not the interior partitions.
    const shell = shellCloneSpec(source, view);
    addStoreyFeature(AppState, options);
    const story = AppState.stories[AppState.stories.length - 1];
    story.walls = shell.walls.map((wall) => new Wall(
        wall.start.x, wall.start.y, wall.end.x, wall.end.y, wall.thickness, null, wall.height
    ));
    story.fixtures = shell.windows.map(({ fixture, wallIndex }) => {
        const clone = ItemFactory.create(fixture.type, fixture.x, fixture.y, fixture.rotation);
        clone.metadata = fixture.metadata;
        if (fixture.size) clone.size = { ...fixture.size };
        if (fixture.elevation) clone.elevation = fixture.elevation;
        if (fixture.defaultBottom != null) clone.defaultBottom = fixture.defaultBottom;
        clone.boundToWallId = story.walls[wallIndex]?.id || null;
        const style = AppState.fixtureStyles?.[fixture.id];
        if (style) AppState.fixtureStyles[clone.id] = { ...style };
        return clone;
    });
    story.openings = [];
    activateStorey(AppState, AppState.stories.length - 1);
    AppState.selectedFixture = null;
    AppState.selectedWallId = null;
    AppState.selectedOpeningId = null;
    AppState.selectedVertexIndex = null;
    refreshPlanDerived();
    refreshStoreyPanel();
    draw2D();
    update3D();
    syncSelectionPanels();
    stateManager.saveState();
    saveToStorage();
    return story;
}

function removeStoreyAt(index) {
    ensureStoreyModel();
    if (AppState.stories.length <= 1) return false;
    if (typeof window.confirm === 'function' && !window.confirm('Delete this storey and everything on it?')) return false;
    const removed = removeStoreyFeature(AppState, index);
    if (!removed) return false;
    AppState.selectedFixture = null;
    AppState.selectedWallId = null;
    AppState.selectedOpeningId = null;
    AppState.selectedVertexIndex = null;
    AppState.cutoutDraft = null;
    AppState.openingDrag = null;
    refreshPlanDerived();
    refreshStoreyPanel();
    draw2D();
    update3D();
    syncSelectionPanels();
    stateManager.saveState();
    saveToStorage();
    return true;
}

function toggleStoreyVisible(index) {
    const story = AppState.stories?.[index];
    if (!story) return false;
    story.visible = story.visible === false;
    refreshStoreyPanel();
    update3D();
    saveToStorage();
    return story.visible;
}

/**
 * Clear wall height of the active storey, in metres. The 8 in floor structure
 * above the walls stays fixed, so the storey pitch follows it.
 */
function setActiveStoreyHeight(metres) {
    const story = AppState.stories?.[AppState.currentStoryIndex];
    if (!story || !Number.isFinite(metres) || metres <= 0) return null;
    const construction = constructionOptions({
        wallHeight: Math.min(Math.max(metres, 1.8), 6),
        floorDepth: JOIST_DEPTH_M
    });
    story.wallHeight = construction.wallHeight;
    story.floorDepth = construction.floorDepth;
    story.height = construction.height;
    refreshStoreyPanel();
    update3D();
    saveToStorage();
    return story.wallHeight;
}

function refreshStoreyPanel() {
    const list = document.getElementById('storeys-list');
    if (!list) return;
    const rows = storeySummary(AppState);

    list.innerHTML = rows.map((story) => {
        const active = story.active;
        return `
            <div class="px-2 py-1.5 rounded-lg border ${active ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'} space-y-1">
                <div class="flex items-center justify-between gap-1">
                    <button onclick="window.setStorey(${story.index})" class="text-left text-xs font-bold ${active ? 'text-primary' : 'text-gray-700 dark:text-gray-200'} truncate" title="Edit this storey">
                        ${escapeHtml(story.name)}
                    </button>
                    <div class="flex items-center gap-0.5">
                        <button onclick="window.toggleStoreyVisible(${story.index})" class="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Show / hide this storey">
                            <span class="material-symbols-outlined text-base ${story.visible ? 'text-gray-500' : 'text-gray-300'}">${story.visible ? 'visibility' : 'visibility_off'}</span>
                        </button>
                        <button onclick="window.removeStorey(${story.index})" class="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete this storey">
                            <span class="material-symbols-outlined text-base text-red-400">delete</span>
                        </button>
                    </div>
                </div>
                <div class="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                    <span>${story.elevation.toFixed(2)} m</span>
                    <span>${story.walls} walls · ${story.fixtures} items</span>
                </div>
            </div>`;
    }).join('');

    const heightInput = document.getElementById('storey-height');
    const activeStory = AppState.stories?.[AppState.currentStoryIndex];
    if (heightInput && activeStory && document.activeElement !== heightInput) {
        heightInput.value = Number(activeStory.wallHeight || WALL_HEIGHT_M).toFixed(2);
    }
    const pitch = document.getElementById('storey-pitch');
    if (pitch && activeStory) {
        const construction = storeyConstruction(activeStory);
        pitch.textContent = `${Math.round(construction.wallHeight / 0.0254)} in walls + ${Math.round(construction.floorDepth / 0.0254)} in joists = ${construction.pitch.toFixed(2)} m`;
    }
    refreshOpeningsPanel();
}

// ------------------------------------------------------------------
// Cutout tool (features/studio/openings-plan.js)
// ------------------------------------------------------------------

/** Floor openings of the active storey: the holes the cutout tool cuts. */
function activeOpenings() {
    const story = AppState.stories?.[AppState.currentStoryIndex];
    if (!story) return [];
    if (!Array.isArray(story.openings)) story.openings = [];
    return story.openings;
}

function selectedOpening() {
    return activeOpenings().find((opening) => opening.id === AppState.selectedOpeningId) || null;
}

/** Press: grab a point, grab the polygon, or rubber-band a new rectangle. */
function startCutout(pos) {
    const current = selectedOpening();
    const vertex = vertexAt(current, pos, 10 / AppState.scale);
    if (current && vertex >= 0) {
        AppState.selectedVertexIndex = vertex;
        AppState.openingDrag = { kind: 'vertex', id: current.id, index: vertex };
        return AppState.openingDrag;
    }

    const hit = openingAt(activeOpenings(), pos);
    if (hit) {
        AppState.selectedOpeningId = hit.id;
        AppState.selectedVertexIndex = null;
        AppState.openingDrag = { kind: 'move', id: hit.id, last: { x: pos.x, y: pos.y } };
        return AppState.openingDrag;
    }

    AppState.selectedOpeningId = null;
    AppState.selectedVertexIndex = null;
    AppState.cutoutDraft = rectOpening(pos, pos);
    AppState.openingDrag = { kind: 'new', origin: { x: pos.x, y: pos.y } };
    return AppState.openingDrag;
}

/** Drag: stretch the draft, move one point, or move the whole polygon. */
function updateCutout(pos) {
    const drag = AppState.openingDrag;
    if (!drag) return null;
    if (drag.kind === 'new') {
        AppState.cutoutDraft = rectOpening(drag.origin, pos);
        return AppState.cutoutDraft;
    }

    const opening = activeOpenings().find((entry) => entry.id === drag.id);
    if (!opening) return null;
    if (drag.kind === 'vertex') {
        moveVertex(opening, drag.index, pos);
        return opening;
    }
    moveOpening(opening, pos.x - drag.last.x, pos.y - drag.last.y);
    drag.last = { x: pos.x, y: pos.y };
    return opening;
}

/** Drop: keep the new hole when it covers some floor, then rebuild. */
function finishCutout() {
    const drag = AppState.openingDrag;
    const draft = AppState.cutoutDraft;
    AppState.openingDrag = null;
    AppState.cutoutDraft = null;
    AppState.selectedVertexIndex = null;

    let changed = false;
    if (drag?.kind === 'new' && draft && openingAreaMetres(draft) >= 0.05) {
        activeOpenings().push(draft);
        AppState.selectedOpeningId = draft.id;
        changed = true;
    } else if (drag?.kind === 'vertex' || drag?.kind === 'move') {
        const opening = activeOpenings().find((entry) => entry.id === drag.id);
        if (opening) AppState.selectedOpeningId = opening.id;
        changed = true;
    }

    // A plain click is only a selection: it must not add an undo step.
    if (changed) saveAndSync();
    else draw2D();
    return AppState.selectedOpeningId;
}

/** Delete the selected point, or the whole hole when it has only three left. */
function deleteCutoutSelection() {
    const opening = selectedOpening();
    if (!opening) return false;

    if (AppState.selectedVertexIndex != null && opening.points.length > 3) {
        if (!removeVertex(opening, AppState.selectedVertexIndex)) return false;
    } else {
        const openings = activeOpenings();
        const index = openings.findIndex((entry) => entry.id === opening.id);
        if (index < 0) return false;
        openings.splice(index, 1);
        AppState.selectedOpeningId = null;
    }

    AppState.selectedVertexIndex = null;
    saveAndSync();
    return true;
}

function selectOpening(id) {
    const opening = activeOpenings().find((entry) => entry.id === id) || null;
    AppState.selectedOpeningId = opening?.id || null;
    AppState.selectedVertexIndex = null;
    if (opening) setTool('cutout');
    draw2D();
    return opening;
}

function deleteOpening(id) {
    const openings = activeOpenings();
    const index = openings.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    openings.splice(index, 1);
    if (AppState.selectedOpeningId === id) AppState.selectedOpeningId = null;
    saveAndSync();
    return true;
}

/** Sidebar list of the active storey's cutouts. */
function refreshOpeningsPanel() {
    const list = document.getElementById('openings-list');
    const count = document.getElementById('openings-count');
    const openings = activeOpenings();
    if (count) count.textContent = openings.length ? String(openings.length) : '0';
    if (!list) return;

    if (!openings.length) {
        list.innerHTML = '<p class="text-[10px] text-gray-400 leading-snug">No cutouts on this floor. Pick the Cutout tool and drag over the slab.</p>';
        return;
    }

    list.innerHTML = openings.map((opening, index) => {
        const selected = opening.id === AppState.selectedOpeningId;
        return `
            <div class="flex items-center justify-between gap-1 rounded ${selected ? 'bg-amber-50 dark:bg-amber-900/20' : ''} px-1 py-0.5">
                <button onclick="window.selectOpening('${opening.id}')" class="text-left text-[10px] font-mono text-gray-600 dark:text-gray-300 truncate" title="Select this opening">
                    Hole ${index + 1} · ${openingAreaMetres(opening).toFixed(2)} m²
                </button>
                <button onclick="window.deleteOpening('${opening.id}')" class="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete this opening">
                    <span class="material-symbols-outlined text-sm text-red-400">delete</span>
                </button>
            </div>`;
    }).join('');
}

function refreshRoomFloorPanel() {
    const list = document.getElementById('room-floors-list');
    if (!list) return;

    const rooms = AppState.rooms || [];
    if (rooms.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400">Close a room with walls to give it a floor.</p>';
        return;
    }

    list.innerHTML = rooms.map((room, index) => {
        const key = room.key || `${AppState.currentStoryIndex}:${room.id}`;
        // A custom uploaded image is not one of the presets; keep it selectable.
        const custom = room.texture && !FLOOR_TEXTURES.includes(room.texture);
        const choices = custom ? [...FLOOR_TEXTURES, room.texture] : FLOOR_TEXTURES;
        const options = choices.map((texture) => (
            `<option value="${texture}" ${texture === room.texture ? 'selected' : ''}>${texture === room.texture && custom ? 'Custom image' : texture}</option>`
        )).join('');
        return `
            <div class="px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-1">
                <div class="flex items-center justify-between text-[11px]">
                    <span class="font-bold text-gray-700 dark:text-gray-200">Room ${index + 1}</span>
                    <span class="font-mono text-gray-500">${room.area.toFixed(1)} m²</span>
                </div>
                <select onchange="window.setRoomFloor('${key}', this.value)" class="w-full text-[11px] p-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                    ${options}
                </select>
            </div>`;
    }).join('');
}

function setRoomFloor(key, texture) {
    if (!key) return null;
    AppState.roomMaterials[key] = { ...(AppState.roomMaterials[key] || {}), texture };
    saveAndSync();
    renderKitchenCheck();
    return AppState.roomMaterials[key];
}

// ------------------------------------------------------------------
// Finishes palette (the legacy app.html Apply-to Walls/Floors panel)
// ------------------------------------------------------------------

const FINISH_TEXTURES = {
    wall: WALL_FINISH_OPTIONS
        .filter((option) => option.value)
        .map(({ value, label }) => ({ id: value, label })),
    floor: FLOOR_TEXTURES.map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }))
};

// The swatch row from the legacy app.html style panel.
const FINISH_COLOURS = ['#ffffff', '#5c2b26', '#d9d2c5', '#8b5a2b', '#555555', '#13a4ec'];

const isUploadedTexture = (value) => /^(data:|blob:)/.test(String(value || ''));

const finishLabel = (value) => {
    if (!value) return 'default';
    if (isUploadedTexture(value)) return 'custom image';
    return value;
};

/** Texture the palette is currently pointing at (selected wall wins). */
function currentFinishTexture() {
    if (AppState.finishTarget === 'floor') return AppState.defaultFloorTexture;
    const wall = selectedWall();
    return wall
        ? wallFinishOf(wall, AppState.fixtureStyles, AppState.defaultWallTexture).texture
        : AppState.defaultWallTexture;
}

function setFinishTarget(target) {
    AppState.finishTarget = target === 'floor' ? 'floor' : 'wall';
    refreshFinishPanel();
    return AppState.finishTarget;
}

/**
 * Apply a texture preset (or an uploaded data URL) to the selected wall, or to
 * every wall / floor on the storey when nothing is selected.
 */
function applyFinishTexture(texture) {
    const value = texture || null;
    if (AppState.finishTarget === 'floor') {
        AppState.defaultFloorTexture = value || 'tile';
    } else {
        const wall = selectedWall();
        if (wall) setWallFinish(AppState.fixtureStyles, wall.id, { texture: value });
        else AppState.defaultWallTexture = value;
    }
    saveAndSync();
    refreshFinishPanel();
    return value;
}

/**
 * Colour the selected wall or item, exactly like the legacy swatch row: with
 * nothing selected there is nothing to paint.
 */
function applyFinishColour(colour) {
    const value = String(colour || '');
    if (!value) return null;

    const wall = selectedWall();
    if (wall) {
        setWallFinish(AppState.fixtureStyles, wall.id, { color: value });
    } else if (AppState.selectedFixture) {
        const id = AppState.selectedFixture.id;
        AppState.fixtureStyles[id] = { ...(AppState.fixtureStyles[id] || {}), color: value };
    } else {
        return null;
    }

    saveAndSync();
    refreshFinishPanel();
    return value;
}

/** Read an uploaded image and apply it as the current finish. */
function applyFinishUpload(file) {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(applyFinishTexture(String(event.target?.result || '')));
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

function refreshFinishPanel() {
    const list = document.getElementById('finish-textures');
    if (!list) return;
    const target = AppState.finishTarget === 'floor' ? 'floor' : 'wall';
    const active = currentFinishTexture();

    const wallBtn = document.getElementById('finish-target-wall');
    const floorBtn = document.getElementById('finish-target-floor');
    [wallBtn, floorBtn].forEach((button) => {
        if (!button) return;
        const selected = button.id === `finish-target-${target}`;
        button.classList.toggle('bg-white', selected);
        button.classList.toggle('dark:bg-gray-700', selected);
        button.classList.toggle('shadow-sm', selected);
        button.classList.toggle('text-gray-800', selected);
        button.classList.toggle('dark:text-gray-100', selected);
        button.classList.toggle('text-gray-500', !selected);
    });

    list.innerHTML = FINISH_TEXTURES[target].map((texture) => {
        const selected = texture.id === active;
        return `<button data-finish-texture="${texture.id}" onclick="window.applyFinishTexture('${texture.id}')" class="p-1.5 rounded-lg border text-[10px] font-bold transition-colors ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary'}">${texture.label}</button>`;
    }).join('');

    // Colour swatches paint the selected wall or item only.
    const swatches = document.getElementById('finish-colours');
    if (swatches) {
        const subject = selectedWall();
        const current = subject
            ? (AppState.fixtureStyles[subject.id] || {}).color
            : (AppState.selectedFixture ? (AppState.fixtureStyles[AppState.selectedFixture.id] || {}).color : null);
        swatches.innerHTML = FINISH_COLOURS.map((colour) => {
            const selected = colour.toLowerCase() === String(current || '').toLowerCase();
            return `<button data-finish-color="${colour}" onclick="window.applyFinishColour('${colour}')" style="background:${colour}" class="w-5 h-5 rounded border ${selected ? 'ring-2 ring-primary border-primary' : 'border-gray-300 dark:border-gray-600'}" title="${colour}"></button>`;
        }).join('');
    }

    const status = document.getElementById('finish-status');
    if (status) {
        const subject = target === 'floor'
            ? 'Floors'
            : (selectedWall() ? 'Selected wall' : 'Walls');
        // Recommend from the room the selected piece implies (a bathtub reads
        // as a bathroom, a sofa as living space); otherwise the generic preset.
        const roomType = detectRoomType(AppState.selectedFixture?.metadata?.label || '');
        const suggestedId = getRecommendedTextures(roomType)[target];
        const suggested = DEFAULT_TEXTURES[target === 'floor' ? 'floors' : 'walls']
            .find((texture) => texture.id === suggestedId)?.name || suggestedId;
        status.textContent = `${subject} · ${finishLabel(active)} · suggested ${suggested}`;
    }
}

// --- Wall covering suite (features/wall) ----------------------------

/** Net wall area of the active storey, deducting its cutouts. */
function planWallArea() {
    const story = AppState.stories?.[AppState.currentStoryIndex];
    const height = storeyConstruction(story).wallHeight;
    // Deduct the doors and windows bound to walls; floor cutouts are stair
    // voids in the slab, not holes in the wall finish.
    const openings = AppState.walls.flatMap((wall) =>
        openingsForWall(wall, AppState.fixtures).map((opening) => ({ width: opening.width, height: opening.height }))
    );
    return wallAreaFromPlan(AppState.walls, { wallHeight: height, openings });
}

/** The covering on the selected wall, or the storey default. */
function activeWallCoveringId() {
    const wall = selectedWall();
    const style = wall ? AppState.fixtureStyles[wall.id] || {} : null;
    return style?.covering || AppState.defaultWallCovering || 'paint-eggshell';
}

function wallCoveringDesign() {
    const area = planWallArea();
    const covering = coveringById(activeWallCoveringId());
    return computeWallDesign({
        covering: covering.id,
        colour: covering.defaultColour,
        exposure: covering.exposure === 'exterior' ? 'exterior' : 'interior',
        substrate: covering.exposure === 'exterior' ? 'wood-primed' : 'gypsum-painted',
        condition: 'repaint',
        area: Math.max(area.net, 0.1),
        length: Math.max(area.length, 0.1),
        height: area.height,
        perimeter: Math.max(area.length, 0.1),
        waste: 0.05
    });
}

function initWallCoveringPanel() {
    const select = document.getElementById('wall-covering-select');
    if (!select) return;
    const groups = [
        { label: 'Interior', entries: WALL_COVERINGS.filter((entry) => entry.exposure === 'interior') },
        { label: 'Exterior', entries: WALL_COVERINGS.filter((entry) => entry.exposure === 'exterior') },
        { label: 'Interior or exterior', entries: WALL_COVERINGS.filter((entry) => entry.exposure === 'both') }
    ];
    select.innerHTML = '<option value="default">Storey default (no covering)</option>' + groups
        .filter((group) => group.entries.length)
        .map((group) => `<optgroup label="${group.label}">${group.entries
            .map((entry) => `<option value="${entry.id}">${entry.label}</option>`)
            .join('')}</optgroup>`)
        .join('');
    refreshWallCoveringPanel();
}

function refreshWallCoveringPanel() {
    const select = document.getElementById('wall-covering-select');
    if (!select) return;
    const wall = selectedWall();
    const style = wall ? AppState.fixtureStyles[wall.id] || {} : null;
    const active = style?.covering || AppState.defaultWallCovering;
    select.value = active && WALL_COVERINGS.some((entry) => entry.id === active) ? active : 'default';

    const status = document.getElementById('wall-covering-status');
    if (!status) return;
    const area = planWallArea();
    if (area.net <= 0) {
        status.textContent = 'No walls on this storey yet.';
        status.title = 'Draw a wall to price a covering.';
        return;
    }
    const design = wallCoveringDesign();
    const packs = design.rows.reduce((sum, row) => sum + row.qty, 0);
    const quantity = design.paint ? `${design.paint.litres} L + ${design.paint.primerLitres} L primer` : `${packs} packs`;
    status.textContent = `${area.net.toFixed(1)} m² · ${quantity} · $${design.costs.total.toFixed(0)}`;
    status.title = `${design.covering.label} · ${design.costs.perM2.toFixed(2)} $/m² · ${design.checks.filter((check) => check.severity === 'error').length} errors`;
}

/**
 * Apply a covering to the selected wall, or to every wall on the storey when
 * nothing is selected. The texture preset and colour the 3D builder reads go
 * into the same per-wall style map as the other finishes.
 */
function applyWallCovering(coveringId) {
    const wall = selectedWall();
    const isDefault = !coveringId || coveringId === 'default';
    const covering = isDefault ? null : WALL_COVERINGS.find((entry) => entry.id === coveringId);
    const patch = covering
        ? finishPatchFor(covering.id, covering.defaultColour)
        : { covering: null, texture: null, color: null };

    if (wall) {
        setWallFinish(AppState.fixtureStyles, wall.id, patch);
    } else {
        AppState.defaultWallCovering = covering ? covering.id : '';
        AppState.defaultWallTexture = patch.texture;
        AppState.walls.forEach((entry) => setWallFinish(AppState.fixtureStyles, entry.id, patch));
    }

    saveAndSync();
    refreshFinishPanel();
    refreshWallCoveringPanel();
    return covering ? covering.id : null;
}

/**
 * A lighting plan sent from lighting-designer.html becomes real 3D pieces:
 * ceiling luminaires plus wall faceplates for switches and sockets. The suite's
 * room plan is a local metre grid, so it is centred in the current storey and
 * scaled down if the editor room is smaller than the design room.
 */
/**
 * A kitchen run sent from kitchen-designer.html lands along the longest wall.
 * Module centres are taken from the suite's run layout, so the fillers and air
 * gaps the suite dimensioned survive as real spacing in the plan.
 */
function applyKitchenEditorDraft() {
    const draft = readDraft('kitchen-editor-draft')?.data ?? null;
    if (!draft) return false;

    const modules = (Array.isArray(draft?.modules) ? draft.modules : [])
        .filter((module) => module && Number.isFinite(Number(module.x)) && Number(module.width) > 0);
    if (!modules.length) return false;

    const walls = (AppState.walls || []).filter((wall) => wall?.start && wall?.end);
    if (!walls.length) return false;

    const longest = walls.reduce((best, wall) => {
        const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
        return !best || length > best.length ? { wall, length } : best;
    }, null);
    if (!longest || longest.length < 20) return false;
    const { wall, length } = longest;

    const dir = { x: (wall.end.x - wall.start.x) / length, y: (wall.end.y - wall.start.y) / length };
    // The suite's run is measured wall to wall; centre it if the wall is longer.
    const runLength = Number(draft.runLength) || (modules.reduce((max, module) => Math.max(max, Number(module.end) || 0), 0));
    const runStart = Math.max(0, (length - runLength * PIXELS_PER_METER) / 2);

    // Point the normal at the plan centre, the same inward side suggestRun uses.
    const centre = planCenter();
    const mid = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
    let normal = { x: -dir.y, y: dir.x };
    if ((centre.x - mid.x) * normal.x + (centre.y - mid.y) * normal.y < 0) {
        normal = { x: -normal.x, y: -normal.y };
    }

    const line = KITCHEN_LINES[draft.line] || KITCHEN_LINES.shaker;
    const wallThicknessPx = wall.thickness || 10;
    let added = 0;

    modules.forEach((module) => {
        const role = module.itemRole;
        const type = role === 'stove'
            ? 'stove'
            : role === 'fridge'
                ? 'fridge'
                : (line[role] || line.base);
        const item = ItemFactory.create(type, 0, 0, 0);
        if (!item) return;

        const along = runStart + Number(module.x) * PIXELS_PER_METER;
        const depth = (itemDimensions(item).depth || line.depth || 0.6) * PIXELS_PER_METER;
        item.x = wall.start.x + dir.x * along + normal.x * (wallThicknessPx / 2 + depth / 2);
        item.y = wall.start.y + dir.y * along + normal.y * (wallThicknessPx / 2 + depth / 2);
        item.rotation = Math.atan2(dir.y, dir.x);
        // Bind to the wall so the opening/collision logic sees the run.
        if (typeof item.snapToWall === 'function') item.snapToWall(AppState.walls, 1000);
        AppState.fixtures.push(item);
        added += 1;
    });

    if (!added) return false;
    AppState.kitchenDraft = { ...draft, added, wallId: wall.id };
    stateManager?.saveState?.();
    console.log(`Kitchen suite: ${added} modules placed along the ${length.toFixed(0)} px wall.`);
    return true;
}

/**
 * A plan converted on index.html arrives here and becomes the editable plan:
 * the detected walls are placed at the shared 30 px/m scale, the editor zooms
 * out to frame them, and every studio tool works on them from then on — new
 * walls, openings, items, storeys, finishes and the 3D view.
 *
 * The draft is read once and removed, so a reload does not re-import it over
 * the edits made in the studio.
 */
function applyFloorplanEditorDraft() {
    const draft = readDraft('floorplan-editor-draft')?.data ?? null;
    if (!draft) return false;

    const sourceWalls = (Array.isArray(draft?.walls) ? draft.walls : [])
        .filter((wall) => wall?.start && wall?.end);
    if (!sourceWalls.length) return false;

    const sourceWidth = Math.max(Number(draft.width) || 1, 1);
    const sourceHeight = Math.max(Number(draft.height) || 1, 1);
    // onResize() sizes the canvas from its parent and runs after the drafts,
    // so measure the same box now to keep the plan framed on first paint.
    const view = {
        width: blueprintCanvas?.parentElement?.clientWidth || 1200,
        height: blueprintCanvas?.parentElement?.clientHeight || 800
    };
    const centre = { x: view.width / 2, y: view.height / 2 };

    // 1:1 in pixels means the upload keeps the 30 px/m scale every measurement
    // in the app assumes; the view zooms out instead of shrinking the plan.
    const mapPoint = (point) => ({
        x: centre.x + (point.x - sourceWidth / 2),
        y: centre.y + (point.y - sourceHeight / 2)
    });

    const walls = [];
    sourceWalls.forEach((wall) => {
        const start = mapPoint(wall.start);
        const end = mapPoint(wall.end);
        if (Math.hypot(end.x - start.x, end.y - start.y) < 10) return;
        walls.push(new Wall(start.x, start.y, end.x, end.y));
    });
    if (!walls.length) return false;

    // The upload is the plan now: one ground floor with no leftover pieces,
    // openings or finishes from the previous project to sit off-plan.
    const storey = {
        id: 'storey_ground',
        name: 'Ground floor',
        ...constructionOptions(),
        visible: true,
        walls,
        fixtures: [],
        openings: []
    };
    AppState.stories = [storey];
    AppState.currentStoryIndex = 0;
    AppState.walls = storey.walls;
    AppState.fixtures = storey.fixtures;
    AppState.fixtureStyles = {};
    AppState.roomMaterials = {};
    AppState.selectedFixture = null;
    AppState.selectedWallId = null;
    AppState.selectedOpeningId = null;
    AppState.selectedVertexIndex = null;
    AppState.drag = null;
    AppState.groupDrag = null;
    AppState.cutoutDraft = null;
    AppState.openingDrag = null;
    AppState.comments = [];
    AppState.layoutReport = null;

    // Frame the imported plan in the plan view without changing its scale.
    const bounds = walls.reduce((box, wall) => ({
        minX: Math.min(box.minX, wall.start.x, wall.end.x),
        maxX: Math.max(box.maxX, wall.start.x, wall.end.x),
        minY: Math.min(box.minY, wall.start.y, wall.end.y),
        maxY: Math.max(box.maxY, wall.start.y, wall.end.y)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    const planWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const planHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const fit = Math.min(1, (view.width * 0.8) / planWidth, (view.height * 0.8) / planHeight);
    AppState.scale = fit;
    AppState.offset = { x: centre.x * (1 - fit), y: centre.y * (1 - fit) };

    refreshPlanDerived();
    refreshStoreyPanel();
    refreshRoomFloorPanel();
    refreshFinishPanel();
    refreshWallCoveringPanel();
    refreshCommentsPanel();
    stateManager?.saveState();
    draw2D();
    update3D();
    refreshGizmo();
    syncSelectionPanels();
    saveToStorage();
    console.log(`Uploaded plan: ${walls.length} walls loaded into the studio.`);
    return true;
}

function applyLightingEditorDraft() {
    const draft = readDraft('lighting-editor-draft')?.data ?? null;
    if (!draft) return false;
    const roomPlan = draft?.plan;
    if (!roomPlan || !Array.isArray(roomPlan.devices) || !roomPlan.devices.length) return false;

    const points = [];
    (AppState.walls || []).forEach((wall) => {
        if (wall.start) points.push(wall.start);
        if (wall.end) points.push(wall.end);
    });
    const { width: canvasWidth, height: canvasHeight } = planViewSize();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    });
    if (!points.length) {
        minX = canvasWidth / 2 - 5 * PIXELS_PER_METER;
        maxX = canvasWidth / 2 + 5 * PIXELS_PER_METER;
        minY = canvasHeight / 2 - 5 * PIXELS_PER_METER;
        maxY = canvasHeight / 2 + 5 * PIXELS_PER_METER;
    }
    const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const availableWidth = Math.max(maxX - minX, 6 * PIXELS_PER_METER);
    const availableDepth = Math.max(maxY - minY, 6 * PIXELS_PER_METER);
    const scale = Math.min(
        1,
        (availableWidth * 0.88) / Math.max((roomPlan.width || 1) * PIXELS_PER_METER, 1),
        (availableDepth * 0.88) / Math.max((roomPlan.depth || 1) * PIXELS_PER_METER, 1)
    );
    const planPoint = (x, y) => ({
        x: centre.x + ((Number(x) || 0) - roomPlan.width / 2) * PIXELS_PER_METER * scale,
        y: centre.y + ((Number(y) || 0) - roomPlan.depth / 2) * PIXELS_PER_METER * scale
    });

    const diameterFor = (category) => {
        if (category === 'task') return 0.45;
        if (category === 'accent') return 0.3;
        if (category === 'decor') return 0.5;
        return 0.38;
    };
    let added = 0;
    roomPlan.devices.forEach((device) => {
        if (!device) return;
        const point = planPoint(device.x, device.y);
        if (device.kind === 'luminaire') {
            const item = ItemFactory.create('ceiling_light', point.x, point.y, 0);
            if (!item) return;
            const diameter = diameterFor(device.category || 'ambient');
            item.size = { width: diameter, depth: diameter, height: 0.12 };
            item.elevation = Math.max(0, Number(roomPlan.mountingHeight || 2.4) - 2.4);
            AppState.fixtureStyles[item.id] = { color: '#fff4cf', material: 'gloss' };
            AppState.fixtures.push(item);
            added += 1;
        } else if (device.kind === 'switch' || device.kind === 'socket') {
            const type = device.kind === 'switch' ? 'wall_switch' : 'wall_socket';
            const item = ItemFactory.create(type, point.x, point.y, 0);
            if (!item) return;
            // With walls drawn, bind the plate to the nearest one and pull it
            // just off the face. An empty editor still receives the device at
            // its plan position so the hand-off loses nothing.
            if (AppState.walls?.length) item.snapToWall(AppState.walls, 1000);
            const wall = (AppState.walls || []).find((entry) => entry.id === item.boundToWallId);
            if (wall) {
                const dx = wall.end.x - wall.start.x;
                const dy = wall.end.y - wall.start.y;
                const length = Math.hypot(dx, dy) || 1;
                let nx = -dy / length;
                let ny = dx / length;
                const midpoint = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
                if (nx * (centre.x - midpoint.x) + ny * (centre.y - midpoint.y) < 0) { nx = -nx; ny = -ny; }
                item.x += nx * (wall.thickness / 2 + 2);
                item.y += ny * (wall.thickness / 2 + 2);
            }
            const targetHeight = device.kind === 'switch' ? 1.2 : Number(roomPlan.socketHeight || 0.3);
            item.elevation = targetHeight - (device.kind === 'switch' ? 1.2 : 0.3);
            AppState.fixtureStyles[item.id] = { color: '#f8fafc', material: 'gloss' };
            AppState.fixtures.push(item);
            added += 1;
        }
    });
    if (added) {
        AppState.lightingDraft = { ...draft, added };
        stateManager?.saveState?.();
        console.log(`Lighting suite: ${added} electrical devices added to the plan.`);
    }
    return added > 0;
}

/**
 * A water feature sent from landscape-designer.html lands at the plan centre,
 * selected, with the suite's dimensions and barrier/water settings intact.
 */
function applyLandscapeEditorDraft() {
    const draft = readDraft('landscape-editor-draft')?.data ?? null;
    if (!draft) return false;
    const feature = draft?.feature;
    if (!feature || !WATER_FEATURE_TYPES.includes(feature.type)) return false;

    const type = feature.type === 'water-wall' ? 'water_wall' : feature.type;
    const centre = planCenter();
    const item = ItemFactory.create(type, centre.x, centre.y, 0);
    if (!item) return false;
    item.landscape = { ...waterConfigForItem(item), ...feature };
    const resolved = waterDesignForItem(item);
    item.size = {
        width: resolved.footprint.width,
        depth: resolved.footprint.depth,
        height: Math.max(0.2, resolved.deep + (resolved.type === 'water-wall' ? resolved.drop : 0))
    };
    item.elevation = 0;
    AppState.fixtures.push(item);
    AppState.selectedFixture = item;
    AppState.selectedWallId = null;
    stateManager?.saveState?.();
    console.log(`Landscape suite: placed ${resolved.typeLabel.toLowerCase()} (${Math.round(resolved.gallons)} gal).`);
    return true;
}

/** A covering designed in wall-designer.html wins over the autosave. */
function applyWallEditorDraft() {
    const draft = readDraft('wall-editor-draft')?.data ?? null;
    if (!draft || !WALL_COVERINGS.some((entry) => entry.id === draft.covering)) return false;
    const covering = coveringById(draft.covering);
    const patch = finishPatchFor(covering.id, draft.colour);
    AppState.defaultWallCovering = covering.id;
    AppState.defaultWallTexture = patch.texture;
    AppState.walls.forEach((wall) => setWallFinish(AppState.fixtureStyles, wall.id, patch));
    return true;
}

// --- Roof suite panel (features/roof) --------------------------------

/**
 * The editor's roof options: the same style, pitch, covering and gutter the
 * roof designer prices. The footprint is taken from the top storey, which is
 * what buildTrussRoof sees, so the panel's area matches the 3D roof.
 */
function roofPlanSize() {
    const stories = engineStories(AppState);
    const story = stories[stories.length - 1] || { walls: AppState.walls };
    const walls = story?.walls || [];
    if (!walls.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    walls.forEach((wall) => {
        [wall.start, wall.end].forEach((point) => {
            if (!point) return;
            minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
            minZ = Math.min(minZ, point.y); maxZ = Math.max(maxZ, point.y);
        });
    });
    if (!Number.isFinite(minX)) return null;
    const width = (maxX - minX) / PIXELS_PER_METER;
    const depth = (maxZ - minZ) / PIXELS_PER_METER;
    if (width < 0.3 || depth < 0.3) return null;
    return { span: Math.min(width, depth), length: Math.max(width, depth) };
}

function applyElectricalEditorDraft() {
    // The electrical designer hands over its dwelling config and circuit list so
    // the editor can show the same service, panel schedule and takeoff. The key
    // is left in place because the bid builder reads it after the editor opens.
    const draft = readDraft('electrical-editor-draft', { consume: false })?.data ?? null;
    if (!draft || typeof draft !== 'object' || !draft.config) return false;
    AppState.electricalDraft = draft;
    return true;
}

function applyFramingEditorDraft() {
    // The framing designer sends its member choices (stud size, spacing,
    // precut length, sheathing). When the editor has no plan of its own, the
    // suite's walls are imported so there is something to frame; an existing
    // plan is never replaced.
    const draft = readFramingDraft();
    if (!draft?.config) return false;
    AppState.framingDraft = draft;
    AppState.framingEnabled = true;
    try {
        importFramingDraftPlan(draft);
    } catch (error) {
        console.warn('Framing plan could not be imported', error);
    }
    return true;
}

/** Build editor walls and openings from the suite plan, only into an empty plan. */
function importFramingDraftPlan(draft) {
    const existing = (AppState.stories || []).some((storey) => (storey.walls || []).length)
        || (AppState.walls || []).length;
    if (existing || !blueprintCanvas) return false;
    const suiteStoreys = (draft.config?.storeys || []).filter((storey) => (storey.walls || []).length);
    if (!suiteStoreys.length) return false;

    const view = planViewSize();
    const stories = suiteStoreys.map((storey, index) => {
        const wallHeight = ((Number(storey.studLengthIn) || 92.5) + 4.5) * INCH;
        const walls = [];
        const fixtures = [];
        (storey.walls || []).forEach((source, wallIndex) => {
            const a = planToCanvas({ x: source.x1, z: source.z1 }, view);
            const b = planToCanvas({ x: source.x2, z: source.z2 }, view);
            if (Math.hypot(b.x - a.x, b.y - a.y) < 3) return;
            const wall = new Wall(a.x, a.y, b.x, b.y, 10, source.id || `framing-wall-${index}-${wallIndex}`);
            walls.push(wall);
            const runPx = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const rotation = Math.atan2(b.y - a.y, b.x - a.x);
            (source.openings || []).forEach((opening, openingIndex) => {
                const t = Math.min(Math.max((Number(opening.offsetM) || 0) * PIXELS_PER_METER / runPx, 0), 1);
                const fixture = ItemFactory.create(
                    opening.type === 'door' ? 'door' : 'window',
                    a.x + (b.x - a.x) * t,
                    a.y + (b.y - a.y) * t,
                    rotation,
                    opening.id || `framing-opening-${index}-${wallIndex}-${openingIndex}`
                );
                fixture.boundToWallId = wall.id;
                fixture.metadata = {
                    ...fixture.metadata,
                    width: Math.max(0.3, Number(opening.widthM) || 1),
                    height: Math.max(0.3, Number(opening.heightM) || 1),
                    sillHeight: opening.type === 'door' ? 0 : Math.max(0, Number(opening.sillM) || 0)
                };
                fixtures.push(fixture);
            });
        });
        return {
            id: `framing-storey-${index}`,
            name: storey.name || `Floor ${index + 1}`,
            wallHeight,
            floorDepth: 8 * INCH,
            height: wallHeight + 8 * INCH,
            visible: true,
            walls,
            fixtures,
            openings: []
        };
    }).filter((storey) => storey.walls.length);

    if (!stories.length) return false;
    AppState.stories = stories;
    AppState.currentStoryIndex = 0;
    AppState.walls = stories[0].walls;
    AppState.fixtures = stories[0].fixtures;
    AppState.selectedWallId = null;
    AppState.selectedFixture = null;
    AppState.hasFramed3D = false;
    return true;
}

function applyDeckEditorDraft() {
    // The deck designer hands its framing config over so the editor can price
    // and schedule the same deck. The key is left in place: the bid builder and
    // the deck kit both read it after the editor opens.
    const draft = readDraft('deck-editor-draft', { consume: false })?.data ?? null;
    if (!draft || typeof draft !== 'object' || !draft.config) return false;
    AppState.deckDraft = draft;
    return true;
}

function applyRoofEditorDraft() {
    const draft = readDraft('roof-editor-draft')?.data ?? null;
    if (!draft || typeof draft !== 'object') return false;
    AppState.roofConfig = {
        ...AppState.roofConfig,
        ...['style', 'covering', 'gutter'].reduce((result, key) => {
            if (typeof draft[key] === 'string') result[key] = draft[key];
            return result;
        }, {}),
        ...(Number.isFinite(Number(draft.pitch)) ? { pitch: Number(draft.pitch) } : {}),
        ...(Number.isFinite(Number(draft.overhang)) ? { overhang: Number(draft.overhang) } : {}),
        ...(typeof draft.gutters === 'boolean' ? { gutters: draft.gutters } : {}),
        ...(typeof draft.ridgeVent === 'boolean' ? { ridgeVent: draft.ridgeVent } : {})
    };
    // A roof sent from the designer is meant to be seen.
    setRoof(AppState, true);
    return true;
}

function initRoofPanel() {
    const styleSelect = document.getElementById('roof-style-select');
    if (styleSelect && !styleSelect.options.length) {
        styleSelect.innerHTML = ROOF_STYLES
            .map((style) => `<option value="${style.key}">${style.name}</option>`)
            .join('');
    }
    const coveringSelect = document.getElementById('roof-covering-select');
    if (coveringSelect && !coveringSelect.options.length) {
        coveringSelect.innerHTML = COVERINGS
            .map((entry) => `<option value="${entry.id}">${entry.label}</option>`)
            .join('');
    }
    const gutterSelect = document.getElementById('roof-gutter-select');
    if (gutterSelect && !gutterSelect.options.length) {
        gutterSelect.innerHTML = GUTTER_SYSTEMS
            .map((entry) => `<option value="${entry.id}">${entry.label}</option>`)
            .join('');
    }
    refreshRoofPanel();
}

function refreshRoofPanel() {
    const config = AppState.roofConfig || {};
    const styleSelect = document.getElementById('roof-style-select');
    if (!styleSelect) return;
    styleSelect.value = config.style || 'gable-king';
    const coveringSelect = document.getElementById('roof-covering-select');
    if (coveringSelect) coveringSelect.value = config.covering || 'asphalt-arch';
    const gutterSelect = document.getElementById('roof-gutter-select');
    if (gutterSelect) gutterSelect.value = config.gutter || 'k5-alum';
    const pitchInput = document.getElementById('roof-pitch');
    if (pitchInput) pitchInput.value = String(config.pitch ?? 6);
    const overhangInput = document.getElementById('roof-overhang');
    if (overhangInput) overhangInput.value = String(config.overhang ?? 0.5);
    const guttersInput = document.getElementById('roof-gutters');
    if (guttersInput) guttersInput.checked = config.gutters !== false;
    const ridgeInput = document.getElementById('roof-ridge-vent');
    if (ridgeInput) ridgeInput.checked = config.ridgeVent !== false;

    const summary = document.getElementById('roof-summary');
    if (!summary) return;
    const size = roofPlanSize();
    if (!size) {
        summary.textContent = '—';
        return;
    }
    const design = computeRoofDesign({ ...config, span: size.span, length: size.length });
    summary.textContent = `${design.areas.squares} sq · $${(design.costs.total / 1000).toFixed(1)}k`;
    summary.title = `${design.areas.roof} m² · ${design.trussCount} trusses · ${design.gutterPackage.gutterLf} m gutter`;
}

// --- Floorplan OCR (features/ocr.js) --------------------------------

let planOcrRunning = false;

const OCR_CATEGORY_LABEL = {
    room: { label: 'Room', className: 'text-emerald-600 dark:text-emerald-400' },
    dimension: { label: 'Dim', className: 'text-sky-600 dark:text-sky-400' },
    area: { label: 'Area', className: 'text-amber-600 dark:text-amber-400' },
    scale: { label: 'Scale', className: 'text-violet-600 dark:text-violet-400' },
    label: { label: 'Text', className: 'text-gray-500 dark:text-gray-400' }
};

function ocrStatus(message) {
    const status = document.getElementById('plan-text-status');
    if (status) status.textContent = message;
    const uploadStatus = document.getElementById('upload-ocr-status');
    if (uploadStatus && document.getElementById('upload-modal') && !document.getElementById('upload-modal').classList.contains('hidden')) {
        uploadStatus.textContent = message;
    }
}

function refreshPlanTextPanel() {
    const list = document.getElementById('plan-text-list');
    if (!list) return;
    const result = AppState.planText;
    const runButton = document.getElementById('plan-text-run');
    const copyButton = document.getElementById('plan-text-copy');
    const clearButton = document.getElementById('plan-text-clear');
    const count = document.getElementById('plan-text-count');

    const symbols = AppState.planSymbols?.symbols || [];
    if (runButton) runButton.disabled = planOcrRunning || !AppState.backgroundImage;
    const symButton = document.getElementById('plan-symbols-run');
    if (symButton) symButton.disabled = planOcrRunning || !AppState.backgroundImage;
    const printButton = document.getElementById('plan-text-print');
    if (printButton) printButton.disabled = planOcrRunning || (!result?.text && !symbols.length);
    if (copyButton) copyButton.disabled = !result?.text && !symbols.length;
    if (clearButton) clearButton.disabled = !result && !symbols.length;
    if (count) {
        count.textContent = result || symbols.length
            ? String(((result?.counts?.rooms || 0) + (result?.counts?.dimensions || 0) + (result?.counts?.labels || 0)) + symbols.length)
            : '0';
    }

    if (!result && !symbols.length) {
        list.innerHTML = `<p class="text-xs text-gray-400">${AppState.backgroundImage ? 'Plan loaded. Read its words + symbols to find dimensions.' : 'No readings yet.'}</p>`;
        if (!planOcrRunning) {
            ocrStatus(AppState.backgroundImage ? 'Plan loaded. Read words + symbols when ready.' : 'Import a plan, then read its dimensions, labels and symbols.');
        }
        return;
    }

    const lines = (result?.lines || [])
        .filter((line) => OCR_CATEGORY_LABEL[line.category])
        .slice(0, 80);
    const wordsHtml = lines.length
        ? lines.map((line) => {
            const meta = OCR_CATEGORY_LABEL[line.category];
            return `<div class="flex items-baseline gap-1.5 text-[11px] leading-snug">
                <span class="text-[9px] font-bold uppercase tracking-wide ${meta.className} w-8 shrink-0">${meta.label}</span>
                <span class="text-gray-700 dark:text-gray-200 truncate" title="${line.text.replace(/"/g, '&quot;')}">${ocrLineLabel(line)}</span>
            </div>`;
        }).join('')
        : '<p class="text-xs text-gray-400">No words recognized yet.</p>';
    const symHtml = symbols.length
        ? `<p class="text-[9px] font-bold uppercase tracking-wide text-gray-400 mt-2">Symbols · ${symbolsSummary(AppState.planSymbols)}</p>` +
          symbols.slice(0, 60).map((s) => `<div class="flex items-baseline gap-1.5 text-[11px] leading-snug">
                <span class="text-[9px] font-bold uppercase tracking-wide text-orange-600 w-8 shrink-0">Sym</span>
                <span class="text-gray-700 dark:text-gray-200 truncate" title="${s.kind} ${(s.confidence || 0)}%">${symbolLabel(s)}</span>
            </div>`).join('')
        : '<p class="text-[10px] text-gray-400 mt-2">No symbols detected yet — run “Read symbols”.</p>';
    list.innerHTML = wordsHtml + symHtml;

    const scale = result?.scales?.[0]?.scale;
    ocrStatus(`${planTextSummary(result)}${scale ? ` · ${scale.note}` : ''}${symbols.length ? ` + ${symbolsSummary(AppState.planSymbols)}` : ''}`);
}

/** Box the high-signal OCR lines over the imported plan image. */
/** Where the imported plan sits on the canvas, in plan coordinates. */
function planBackgroundRect() {
    const img = AppState.backgroundImage;
    if (!img) return null;
    const width = img.width * (AppState.backgroundScale || 1);
    const height = img.height * (AppState.backgroundScale || 1);
    const view = planViewSize();
    return {
        x: view.width / 2 - width / 2,
        y: view.height / 2 - height / 2,
        width,
        height
    };
}

function drawPlanTextOverlay(ctx) {
    const result = AppState.planText;
    const symbols = AppState.planSymbols?.symbols || [];
    AppState.planTextBoxCount = (result ? result.lines.filter((line) => line.bbox).length : 0) + symbols.length;
    const background = planBackgroundRect();
    if ((!result && !symbols.length) || !background || !ctx) return;
    const scale = AppState.backgroundScale || 1;
    const originX = background.x;
    const originY = background.y;
    const colours = {
        dimension: '#0284c7',
        room: '#16a34a',
        scale: '#7c3aed',
        area: '#d97706'
    };
    const toPlan = (ix, iy) => toPlanPoint(ix, iy, background, AppState.planSymbols?.width || AppState.planText?.width || 0, AppState.planSymbols?.height || AppState.planText?.height || 0)
        || { x: originX + ix * scale, y: originY + iy * scale };
    const notes = readingNotesAtOrigins({ lines: result?.lines || [], symbols });
    ctx.save();
    ctx.lineWidth = 1.5 / Math.max(AppState.scale || 1, 0.2);
    ctx.globalAlpha = 0.85;
    const drawn = [];
    (result?.lines || []).forEach((line) => {
        const colour = colours[line.category];
        if (!colour || !line.bbox) return;
        const x = originX + line.bbox.x0 * scale;
        const y = originY + line.bbox.y0 * scale;
        const width = Math.max((line.bbox.x1 - line.bbox.x0) * scale, 4);
        const height = Math.max((line.bbox.y1 - line.bbox.y0) * scale, 4);
        ctx.strokeStyle = colour;
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(x, y, 3 / Math.max(AppState.scale || 1, 0.2), 0, Math.PI * 2);
        ctx.fill();
        drawn.push({
            category: line.category,
            x: x * AppState.scale + AppState.offset.x,
            y: y * AppState.scale + AppState.offset.y,
            width: width * AppState.scale,
            height: height * AppState.scale
        });
    });
    symbols.forEach((symbol) => {
        if (!symbol.bbox) return;
        const x = originX + symbol.bbox.x0 * scale;
        const y = originY + symbol.bbox.y0 * scale;
        const width = Math.max((symbol.bbox.x1 - symbol.bbox.x0) * scale, 4);
        const height = Math.max((symbol.bbox.y1 - symbol.bbox.y0) * scale, 4);
        ctx.strokeStyle = '#ea580c';
        ctx.setLineDash([4 / Math.max(AppState.scale || 1, 0.2), 3 / Math.max(AppState.scale || 1, 0.2)]);
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        ctx.setLineDash([]);
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(x, y, 3 / Math.max(AppState.scale || 1, 0.2), 0, Math.PI * 2);
        ctx.fill();
        drawn.push({
            category: `symbol:${symbol.kind}`,
            x: x * AppState.scale + AppState.offset.x,
            y: y * AppState.scale + AppState.offset.y,
            width: width * AppState.scale,
            height: height * AppState.scale
        });
    });
    AppState.planTextRects = drawn;
    ctx.restore();
    // Print every reading/note AT its location origin: a numbered badge plus
    // the short reading, offset upward with a leader so origins stay visible.
    printReadingNotes(ctx, notes, toPlan);
}

/** Numbered reading badges + short notes pinned at each origin on the plan. */
function printReadingNotes(ctx, notes, toPlan) {
    if (!notes?.length || !ctx) return;
    const zoom = Math.max(AppState.scale || 1, 0.2);
    const fontPx = 11 / zoom;
    ctx.save();
    ctx.font = `700 ${fontPx}px ui-monospace, monospace`;
    ctx.textBaseline = 'bottom';
    notes.slice(0, 140).forEach((note, index) => {
        const plan = toPlan(note.origin.x0, note.origin.y0);
        if (!plan) return;
        const n = String(index + 1);
        const short = note.kind === 'symbol'
            ? `#${note.origin && note.id.replace(/^s/, '')} ${note.text}`.slice(0, 26)
            : String(note.text || '').slice(0, 28);
        const label = `${n} ${short}`;
        const pad = 3 / zoom;
        const textW = ctx.measureText(label).width;
        const badgeR = 7 / zoom;
        const bx = plan.x;
        const by = plan.y - (10 / zoom);
        // Leader from the origin dot to the note.
        ctx.strokeStyle = note.kind === 'symbol' ? '#ea580c' : '#334155';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.moveTo(plan.x, plan.y);
        ctx.lineTo(bx + badgeR, by);
        ctx.stroke();
        // Badge.
        ctx.fillStyle = note.kind === 'symbol' ? '#ea580c' : '#0f172a';
        ctx.beginPath();
        ctx.arc(bx, by - (fontPx / 2), badgeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(n, bx, by);
        // Note pill.
        const pillX = bx + badgeR + pad;
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.fillRect(pillX - pad, by - fontPx - pad, textW + pad * 2, fontPx + pad * 2);
        ctx.strokeStyle = note.kind === 'symbol' ? '#ea580c' : '#64748b';
        ctx.strokeRect(pillX - pad, by - fontPx - pad, textW + pad * 2, fontPx + pad * 2);
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'left';
        ctx.fillText(label.slice(n.length + 1), pillX, by);
    });
    ctx.restore();
}

function showOcrToast(message = 'Reading plan text…') {
    const el = document.createElement('div');
    el.className = 'fixed bottom-4 right-4 bg-amber-600 text-white px-5 py-3 rounded-lg shadow-xl z-50 flex items-center gap-3 max-w-xs';
    el.innerHTML = `<span class="material-symbols-outlined text-base">document_scanner</span><span class="ocr-label text-xs font-semibold">${message}</span>`;
    document.body.appendChild(el);
    return { el, label: el.querySelector('.ocr-label') };
}

async function runPlanSymbols(image) {
    const source = image || AppState.backgroundImage;
    if (!source) {
        ocrStatus('Import a plan image first.');
        return null;
    }
    try {
        const result = await detectPlanSymbols(source.src || source);
        AppState.planSymbols = result;
        refreshPlanTextPanel();
        draw2D();
        return result;
    } catch (error) {
        console.error('Plan symbol reader failed', error);
        ocrStatus(`Symbol reader failed: ${error?.message || error}`);
        return null;
    }
}

async function runPlanOcr(source, { quiet = false, recognize } = {}) {
    if (planOcrRunning) return null;
    const image = source || AppState.backgroundImage?.src || null;
    if (!image) {
        ocrStatus('Import a plan image first.');
        return null;
    }

    planOcrRunning = true;
    refreshPlanTextPanel();
    const toast = showOcrToast();
    const onProgress = (message) => {
        const percent = Math.round((message?.progress || 0) * 100);
        const text = `${message?.status || 'Reading plan words'} ${percent}%`;
        toast.label.textContent = text;
        ocrStatus(text);
    };

    try {
        // Open-source word OCR (Tesseract.js) + local symbol reader on upload:
        // one pass yields both readings at their origins.
        const [result, symbols] = await Promise.all([
            recognizePlanText(image, { onProgress, recognize }),
            detectPlanSymbols(AppState.backgroundImage || image).catch(() => null)
        ]);
        AppState.planText = result;
        if (symbols) AppState.planSymbols = symbols;
        refreshPlanTextPanel();
        draw2D();
        toast.label.textContent = `${planTextSummary(result)}${symbols?.symbols?.length ? ` + ${symbolsSummary(symbols)}` : ''}`;
        setTimeout(() => toast.el.remove(), 2400);
        return result;
    } catch (error) {
        console.error('Plan OCR failed', error);
        toast.el.classList.remove('bg-amber-600');
        toast.el.classList.add('bg-red-600');
        toast.label.textContent = 'OCR failed — check the connection';
        ocrStatus(`OCR failed: ${error?.message || error}`);
        setTimeout(() => toast.el.remove(), 4200);
        return null;
    } finally {
        planOcrRunning = false;
        refreshPlanTextPanel();
    }
}

async function runPlanOcrCurrent() {
    if (!AppState.backgroundImage) {
        ocrStatus('Import a plan image first.');
        return null;
    }
    return runPlanOcr(AppState.backgroundImage.src || null);
}

async function runPlanSymbolsCurrent() {
    if (planOcrRunning) return null;
    if (!AppState.backgroundImage) {
        ocrStatus('Import a plan image first.');
        return null;
    }
    planOcrRunning = true;
    refreshPlanTextPanel();
    ocrStatus('Reading plan symbols…');
    try {
        const result = await runPlanSymbols(AppState.backgroundImage);
        ocrStatus(result?.symbols?.length ? symbolsSummary(result) : 'No symbols detected.');
        return result;
    } finally {
        planOcrRunning = false;
        refreshPlanTextPanel();
    }
}

async function copyPlanText() {
    const notes = readingNotesAtOrigins({ lines: AppState.planText?.lines || [], symbols: AppState.planSymbols?.symbols || [] });
    if (!notes.length) {
        ocrStatus('Nothing to copy yet.');
        return false;
    }
    const text = notes.map((note, index) => {
        const origin = note.origin;
        return `${index + 1}. [${note.kind}:${note.category}] "${note.text}" @ origin (${Math.round(origin.x0)}, ${Math.round(origin.y0)})`;
    }).join('\n');
    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        // Clipboard permissions are not guaranteed; the textarea fallback works
        // in the same click for older browsers.
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
    }
    ocrStatus(`Copied ${notes.length} readings with origins.`);
    return true;
}

/** Print sheet: every reading/note grouped at its location origin. */
function printReadings() {
    const notes = readingNotesAtOrigins({ lines: AppState.planText?.lines || [], symbols: AppState.planSymbols?.symbols || [] });
    if (!notes.length) {
        ocrStatus('Nothing to print yet — read words or symbols first.');
        return false;
    }
    const rows = notes.map((note, index) => {
        const o = note.origin;
        const plan = (() => {
            try {
                const bg = planBackgroundRect();
                const p = toPlanPoint(o.x0, o.y0, bg, AppState.planSymbols?.width || AppState.planText?.width || 0, AppState.planSymbols?.height || AppState.planText?.height || 0);
                return p ? `${Math.round(p.x)}, ${Math.round(p.y)} px` : '—';
            } catch { return '—'; }
        })();
        const safe = String(note.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return `<tr><td>${index + 1}</td><td>${note.kind}</td><td>${note.category}</td><td>${safe}</td><td>(${Math.round(o.x0)}, ${Math.round(o.y0)})</td><td>${plan}</td><td>${note.confidence ?? ''}</td></tr>`;
    }).join('');
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
        ocrStatus('Pop-up blocked — allow pop-ups to print readings.');
        return false;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Plan readings at origins</title><style>body{font:12px system-ui,sans-serif;padding:24px;color:#111}h1{font-size:16px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;font-size:11px}th{background:#f1f5f9}@media print{.no-print{display:none}}</style></head><body><h1>Plan readings at location origins</h1><p>${notes.length} readings · words + symbols · origins in image px and plan px · ${new Date().toLocaleString()}</p><table><thead><tr><th>#</th><th>Kind</th><th>Category</th><th>Reading / note</th><th>Origin (image)</th><th>Origin (plan)</th><th>Conf</th></tr></thead><tbody>${rows}</tbody></table><p class="no-print"><button onclick="window.print()">Print</button></p></body></html>`);
    win.document.close();
    ocrStatus(`Print sheet opened with ${notes.length} readings at origins.`);
    return true;
}

function clearPlanText() {
    AppState.planText = null;
    AppState.planSymbols = null;
    refreshPlanTextPanel();
    draw2D();
}

function updateCabinetConfig(key, value) {
    const fixture = AppState.selectedFixture;
    if (!fixture) return null;
    const numeric = ['doors', 'drawers', 'shelves'].includes(key);
    const config = applyCabinetConfig(fixture, {
        [key]: numeric ? Number(value) : value
    });
    saveAndSync({ tag: 'cabinet', coalesce: true });
    syncSelectionPanels();
    return config;
}

function activeProjectId() {
    try {
        return localStorage.getItem(ACTIVE_PROJECT_KEY) || 'local';
    } catch {
        return 'local';
    }
}

function rememberActiveProject(id) {
    try {
        if (id) localStorage.setItem(ACTIVE_PROJECT_KEY, id);
        else localStorage.removeItem(ACTIVE_PROJECT_KEY);
    } catch {
        /* private mode */
    }
}

function initCollaboration(projectId = activeProjectId()) {
    collaboration?.dispose?.();
    collaboration = createCollaboration({ projectId, user: { name: 'You' } });
    AppState.comments = collaboration.comments();
    collaboration.subscribe(() => {
        AppState.comments = collaboration.comments();
        refreshCommentsPanel();
        refreshPresence();
        draw2D();
    });
    refreshPresence();
    refreshCommentsPanel();
    return collaboration;
}

function refreshProjectsPanel() {
    const list = document.getElementById('projects-list');
    if (!list) return;
    AppState.projects = listProjects();

    if (AppState.projects.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400">No saved projects yet.</p>';
        return;
    }

    list.innerHTML = AppState.projects.map((project) => {
        const active = project.id === AppState.activeProjectId;
        return `
            <div class="px-2 py-1.5 rounded-lg border ${active ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}">
                <div class="flex items-center justify-between gap-1">
                    <button onclick="window.openProject('${project.id}')" class="text-left text-xs font-bold ${active ? 'text-primary' : 'text-gray-700 dark:text-gray-200'} truncate" title="Open project">
                        ${escapeHtml(project.name)}
                    </button>
                    <button onclick="window.removeProject('${project.id}')" class="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete project">
                        <span class="material-symbols-outlined text-base text-red-400">delete</span>
                    </button>
                </div>
                <div class="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                    <span>${project.walls} walls · ${project.fixtures} items</span>
                    <span>${new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
            </div>`;
    }).join('');
}

function saveNamedProjectPrompt() {
    const input = document.getElementById('project-name');
    const suggested = AppState.activeProjectName || input?.value || 'My project';
    const name = input?.value?.trim()
        || (typeof window.prompt === 'function' ? window.prompt('Save project as', suggested) : suggested);
    return saveProjectAs(name);
}

function saveProjectAs(name) {
    const input = document.getElementById('project-name');
    const resolved = String(name || input?.value || '').trim()
        || `Project ${new Date().toLocaleDateString()}`;

    const project = saveNamedProject(resolved, projectPayload(), { id: AppState.activeProjectId || null });
    if (!project) return null;

    AppState.activeProjectId = project.id;
    AppState.activeProjectName = project.name;
    rememberActiveProject(project.id);
    if (input) input.value = project.name;
    refreshProjectsPanel();
    initCollaboration(project.id);
    return project;
}

function openProject(id) {
    const loaded = loadNamedProject(id);
    if (!loaded) return null;

    AppState.activeProjectId = id;
    AppState.activeProjectName = loaded.meta?.name || 'Project';
    rememberActiveProject(id);
    restoreState(loaded.project);
    initCollaboration(id);
    refreshProjectsPanel();
    const input = document.getElementById('project-name');
    if (input) input.value = AppState.activeProjectName;
    return loaded.project;
}

function removeProject(id) {
    if (!id) return null;
    if (typeof window.confirm === 'function' && !window.confirm('Delete this saved project?')) return null;
    const entries = deleteNamedProject(id);
    if (AppState.activeProjectId === id) {
        AppState.activeProjectId = null;
        AppState.activeProjectName = null;
        rememberActiveProject(null);
    }
    AppState.projects = entries;
    refreshProjectsPanel();
    return entries;
}

function refreshPresence() {
    const node = document.querySelector('[data-presence-count]');
    if (!node) return;
    const status = collaboration?.status();
    node.textContent = status ? `${status.online} online · ${status.comments}` : 'offline';
    node.title = status ? `Transport: ${status.transport}` : '';
}

function refreshCommentsPanel() {
    const list = document.getElementById('comment-list');
    if (!list) return;

    const comments = collaboration?.comments() || AppState.comments || [];
    AppState.comments = comments;
    const open = comments.filter((comment) => !comment.resolved);

    if (open.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400">No open comments.</p>';
    } else {
        list.innerHTML = open.map((comment) => `
            <div class="px-2 py-1.5 rounded-lg border ${comment.id === AppState.selectedCommentId ? 'border-primary' : 'border-gray-200 dark:border-gray-700'} space-y-0.5">
                <button onclick="window.selectComment('${comment.id}')" class="w-full text-left text-[11px] text-gray-700 dark:text-gray-200">
                    ${escapeHtml(comment.text)}
                </button>
                <div class="flex items-center justify-between text-[10px] text-gray-400">
                    <span>${escapeHtml(comment.author?.name || 'Guest')}</span>
                    <button onclick="window.resolveComment('${comment.id}')" class="px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-green-500">Resolve</button>
                </div>
            </div>`).join('');
    }

    refreshPresence();
}

function selectComment(id) {
    const comment = (AppState.comments || []).find((entry) => entry.id === id);
    if (!comment) return null;
    AppState.selectedCommentId = id;
    const input = document.getElementById('comment-text');
    if (input && document.activeElement !== input) input.value = comment.text;
    refreshCommentsPanel();
    draw2D();
    return comment;
}

function resolveComment(id) {
    if (!collaboration) return null;
    const comment = collaboration.resolveComment(id, true);
    AppState.comments = collaboration.comments();
    if (AppState.selectedCommentId === id) AppState.selectedCommentId = null;
    refreshCommentsPanel();
    draw2D();
    return comment;
}

/** In comment mode a plan click drops a pin (or selects the nearest one). */
function addCommentAt(pos) {
    if (!collaboration) return null;
    const point = pos || planCenter();
    const input = document.getElementById('comment-text');
    const text = String(input?.value || '').trim();

    if (!text) {
        const threshold = 20 / (AppState.scale || 1);
        const nearest = (AppState.comments || [])
            .filter((comment) => !comment.resolved)
            .map((comment) => ({ comment, distance: Math.hypot(comment.x - point.x, comment.y - point.y) }))
            .filter((entry) => entry.distance <= threshold)
            .sort((a, b) => a.distance - b.distance)[0];
        if (nearest) return selectComment(nearest.comment.id);
        return null;
    }

    const comment = collaboration.addComment({ x: point.x, y: point.y, text });
    if (comment) {
        if (input) input.value = '';
        AppState.selectedCommentId = comment.id;
        AppState.comments = collaboration.comments();
        refreshCommentsPanel();
        draw2D();
    }
    return comment;
}

function renderKitchenCheck() {
    const container = document.getElementById('kitchen-check');
    const scoreNode = document.querySelector('[data-kitchen-score]');
    if (!container) return null;

    if (abilitiesState().layoutCheck === false) {
        container.innerHTML = '<p class="text-xs text-gray-400">Kitchen checks are off.</p>';
        if (scoreNode) scoreNode.textContent = 'off';
        return AppState.layoutReport;
    }

    const view = planViewSize();
    const report = analyzeLayout({ fixtures: AppState.fixtures, view });
    AppState.layoutReport = report;

    if (scoreNode) scoreNode.textContent = `${report.score}`;
    const lines = formatAnalysis(report).slice(1);
    container.innerHTML = lines.length
        ? lines.map((line) => {
            const warning = line.startsWith('⚠');
            return `<p class="text-[11px] ${warning ? 'text-amber-600' : 'text-gray-500 dark:text-gray-400'}">${escapeHtml(line)}</p>`;
        }).join('')
        : '<p class="text-xs text-green-600">Work triangle and clearances look good.</p>';

    return report;
}

function analyzeKitchenLayout() {
    const report = renderKitchenCheck();
    return report?.score ?? null;
}

function suggestKitchenRun(count = 5) {
    const placements = suggestRun({ walls: AppState.walls, count });
    if (placements.length === 0) {
        alert('Draw a longer wall first — the run needs room for the cabinets.');
        return 0;
    }

    placements.forEach((placement) => {
        const item = ItemFactory.create(placement.type, placement.x, placement.y);
        item.rotation = placement.rotation;
        if (!AppState.fixtureStyles[item.id]) {
            AppState.fixtureStyles[item.id] = {
                color: item.metadata?.color
                    ? '#' + item.metadata.color.toString(16).padStart(6, '0')
                    : '#13a4ec',
                material: 'gloss'
            };
        }
        AppState.fixtures.push(item);
    });

    saveAndSync();
    return placements.length;
}

function exportManufacturing(format = 'csv') {
    const pkg = manufacturingPackage(AppState.fixtures);
    if (!pkg.parts.length) {
        alert('No cabinets in the plan — add cabinetry first.');
        return null;
    }

    if (format === 'dxf') {
        downloadExport({ data: pkg.dxf, mime: 'application/dxf', extension: 'dxf' }, 'cutlist');
    } else {
        downloadExport({ data: pkg.csv, mime: 'text/csv', extension: 'csv' }, 'cutlist');
    }

    const stats = document.getElementById('manufacturing-stats');
    if (stats) {
        const sheets = pkg.sheets.length;
        const parts = pkg.parts.reduce((total, part) => total + part.qty, 0);
        stats.textContent = `${pkg.cabinets} cabinets · ${parts} parts · ${sheets} sheets`;
    }
    return pkg;
}

// --- More item/plan abilities ---------------------------------------

let itemClipboard = null;

function arrayDuplicateSelection(count = 3, spacing = 0.65) {
    const fixture = AppState.selectedFixture;
    if (!fixture) return;

    const copies = repeatAlongAxis(fixture, { count, pitch: spacing, styles: AppState.fixtureStyles });
    AppState.fixtures.push(...copies);
    saveAndSync();
}

/** Mirror the selected piece in place (features/transforms.flipItem). */
function flipSelection() {
    const fixture = AppState.selectedFixture;
    if (!fixture) return;
    flipItem(fixture, 'x');
    saveAndSync();
}

/** Butt-jointed repeat along the piece's own axis. */
function repeatSelection(count = 3) {
    const fixture = AppState.selectedFixture;
    if (!fixture) return;

    const copies = repeatAlongAxis(fixture, { count, styles: AppState.fixtureStyles });
    AppState.fixtures.push(...copies);
    saveAndSync();
}

/** Hold one plan axis of the selection so only the other moves. */
function toggleAxisLock(axis) {
    const fixture = AppState.selectedFixture;
    if (!fixture) return;
    toggleAxisLockFeature(fixture, axis);
    saveAndSync();
}

// --- Advanced kit actions -------------------------------------------

/** Group the selection with the pieces chained along its run (feature 25). */
function groupSelection() {
    const fixture = AppState.selectedFixture;
    if (!fixture) return 0;
    const members = groupRun(AppState.fixtures, fixture);
    saveAndSync();
    return members.length;
}

function ungroupSelection() {
    const fixture = AppState.selectedFixture;
    if (!fixture?.groupId) return;
    ungroupItems(AppState.fixtures, fixture.groupId);
    saveAndSync();
}

/** Align the selected piece with its run's depth plane (feature 20). */
function alignDepthSelection() {
    const fixture = AppState.selectedFixture;
    if (!fixture) return null;
    const result = alignDepth(fixture, AppState.fixtures, { threshold: 0.3 * SCALE });
    if (result) saveAndSync();
    return result;
}

/** Seat the selected piece in the nearest inside corner (feature 20). */
function snapCornerSelection() {
    const fixture = AppState.selectedFixture;
    if (!fixture) return null;
    const result = snapToCorner(fixture, AppState.walls);
    if (result) saveAndSync();
    return result;
}

async function startAR() {
    const result = await startPlacement({
        renderer: renderer3D,
        scene: scene3D,
        onPlace: (point) => {
            const fixture = AppState.selectedFixture;
            if (!fixture) return;
            const view = planViewSize();
            fixture.x = point.x * PIXELS_PER_METER + view.width / 2;
            fixture.y = point.z * PIXELS_PER_METER + view.height / 2;
            saveAndSync();
        }
    });

    if (!result.ok) {
        alert(result.reason || 'AR placement is not available on this device.');
    }
}

/** Placement warnings panel (feature 22). */
function renderWarnings() {
    const list = document.getElementById('placement-warnings');
    const count = document.querySelector('[data-warning-count]');
    if (!list) return;

    const warnings = AppState.warnings || [];
    if (count) count.textContent = warnings.length ? `${warnings.length}` : '0';

    if (warnings.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400">No placement issues.</p>';
        return;
    }

    list.innerHTML = warnings.slice(0, 8).map((warning) => {
        const color = warning.severity === 'error' ? 'text-red-600' : 'text-amber-600';
        return `<p class="text-[11px] ${color}">• ${warning.message}</p>`;
    }).join('') + (warnings.length > 8
        ? `<p class="text-[10px] text-gray-400">+${warnings.length - 8} more…</p>`
        : '');
}

/** Per-room count / cost summary (feature 33). */
function renderSummary() {
    const list = document.getElementById('room-summary');
    const total = document.getElementById('room-summary-total');
    if (!list) return;

    const lines = formatSummary(AppState.summary);
    list.innerHTML = lines.length
        ? lines.map((line) => `<p class="text-[11px] text-gray-600 dark:text-gray-300">${line}</p>`).join('')
        : '<p class="text-xs text-gray-400">Draw a closed room to see counts.</p>';

    if (total) {
        const value = AppState.summary?.totals;
        total.textContent = value
            ? `${value.count} items · $${Math.round(value.cost).toLocaleString('en-US')}`
            : '—';
    }
}

function copySelection() {
    const fixture = AppState.selectedFixture;
    if (!fixture) return;
    // Story-tagged snapshot (feature 26), so it can be pasted into another story.
    itemClipboard = copyToClipboard([fixture], {
        storyIndex: AppState.currentStoryIndex || 0,
        styles: AppState.fixtureStyles
    });
}

function pasteSelection() {
    const copies = pasteFromClipboard(itemClipboard, {
        dx: 0.4,
        dy: 0.4,
        styles: AppState.fixtureStyles
    });
    if (copies.length === 0) return;

    AppState.fixtures.push(...copies);
    AppState.selectedFixture = copies[0];
    AppState.selectedWallId = null;
    saveAndSync();
}

function syncLabControls() {
    const settings = labKit?.settings();
    if (!settings) return;
    const rows = [
        ['lab-instance-count', 'lab-instance-value', settings.instances, String(settings.instances)],
        ['lab-shake', 'lab-shake-value', settings.shake, `${Math.round(settings.shake * 100)}%`],
        ['lab-scale', 'lab-scale-value', settings.scale, `${Math.round(settings.scale * 100)}%`]
    ];
    rows.forEach(([inputId, labelId, value, text]) => {
        const input = document.getElementById(inputId);
        if (input) input.value = String(value);
        const label = document.getElementById(labelId);
        if (label) label.textContent = text;
    });
}

function saveAbilityPreset() {
    if (!abilities) return;
    StorageManager.saveProject('ability-preset', {
        version: 2,
        state: { ...abilities.state },
        lab: labKit?.settings() || null
    });
}

function loadAbilityPreset() {
    if (!abilities) return;
    const preset = StorageManager.loadProject('ability-preset');
    if (!preset || !preset.state) return;

    Object.keys(abilities.state).forEach((key) => {
        if (typeof preset.state[key] === 'boolean') abilities.state[key] = preset.state[key];
    });

    if (preset.lab) labKit?.applySettings(preset.lab);
    syncLabControls();
    refreshAbilities();
}

// --- Feature kit glue ------------------------------------------------

/** Guide lines for the wall the dragged piece just snapped to, or null. */
function currentSnapGuide() {
    const drag = AppState.drag;
    if (!drag?.fixture || !drag.snappedWall) return null;
    return snapGuidesFor(drag.fixture, drag.snappedWall);
}

/** Recompute room labels and the area/volume readout from the current plan. */
function refreshPlanDerived() {
    const view = planViewSize();
    AppState.roomLabels = roomLabelsFromWalls(AppState.walls, view, { wallHeight: WALL_HEIGHT });
    AppState.metrics = roomMetrics({ walls: AppState.walls, view, wallHeight: WALL_HEIGHT });
    setPanelText('plan-metrics', formatMetrics(AppState.metrics));

    // Advanced kit: placement warnings (ability-gated) and the room summary.
    AppState.warnings = abilitiesState().placementWarnings === false
        ? []
        : validatePlacements({ fixtures: AppState.fixtures, walls: AppState.walls, view });
    AppState.summary = summarizeByRoom({
        fixtures: AppState.fixtures,
        walls: AppState.walls,
        view,
        pixelsPerMetre: PIXELS_PER_METER
    });

    // Room surfaces (studio feature 38): the same closed loops the 3D floor
    // meshes use, keyed per storey so two floors can differ.
    const storyIndex = AppState.currentStoryIndex || 0;
    const scopedMaterials = {};
    Object.entries(AppState.roomMaterials || {}).forEach(([key, value]) => {
        const separator = key.indexOf(':');
        if (separator === -1) scopedMaterials[key] = value;
        else if (Number(key.slice(0, separator)) === storyIndex) scopedMaterials[key.slice(separator + 1)] = value;
    });

    AppState.rooms = roomSurfacesFromWalls(AppState.walls, view, {
        materials: scopedMaterials,
        defaultTexture: AppState.defaultFloorTexture
    }).map((room) => ({
        ...room,
        key: `${storyIndex}:${room.id}`
    }));

    renderWarnings();
    renderSummary();
    refreshRoomFloorPanel();
    renderKitchenCheck();
}

/**
 * Rebuild the elevation height annotations for the current scene. Removed and
 * re-added whenever the meshes are rebuilt or the view changes.
 */
function refreshElevationAnnotations() {
    if (elevationAnnotations) {
        disposeAnnotationGroup(elevationAnnotations);
        elevationAnnotations = null;
    }
    if (!AppState.elevationSide || !scene3D || abilitiesState().elevationHeights === false) return;

    elevationAnnotations = buildElevationAnnotations({
        THREE,
        fixtures: AppState.fixtures,
        getObject: findItemObject,
        height: WALL_HEIGHT
    });

    // Width/gap dimension strings along the run (feature 31).
    if (abilitiesState().elevationDims !== false) {
        const dimensions = buildElevationDimensions({
            THREE,
            fixtures: AppState.fixtures,
            getObject: findItemObject,
            side: AppState.elevationSide
        });
        elevationAnnotations.add(createElevationDimensionGroup({
            THREE,
            dimensions,
            axis: AppState.elevationSide === 'left' || AppState.elevationSide === 'right' ? 'z' : 'x'
        }));
    }

    scene3D.add(elevationAnnotations);
}

function draw2D(cursorPos = null) {
    const ctx = blueprintCtx;
    if (!ctx) return;
    const view = planViewSize();
    const w = view.width;
    const h = view.height;
    // One device pixel per device pixel: the context is scaled once here so all
    // of the plan drawing below stays in logical pixels.
    const dpr = planPixelRatio();
    const backingWidth = Math.round(w * dpr);
    const backingHeight = Math.round(h * dpr);
    if (blueprintCanvas.width !== backingWidth || blueprintCanvas.height !== backingHeight) {
        blueprintCanvas.width = backingWidth;
        blueprintCanvas.height = backingHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    
    ctx.save();
    ctx.translate(AppState.offset.x, AppState.offset.y);
    ctx.scale(AppState.scale, AppState.scale);
    
    const abilityState = abilitiesState();
    if (cursorPos) AppState.cursor = cursorPos;

    // Grid
    drawGrid(ctx, w, h, abilityState);
    
    // Background Image, centred in the plan and panning with it.
    const background = planBackgroundRect();
    if (background && AppState.backgroundImage) {
        ctx.globalAlpha = 0.4;
        ctx.drawImage(
            AppState.backgroundImage,
            background.x,
            background.y,
            background.width,
            background.height
        );
        ctx.globalAlpha = 1.0;
    }

    // OCR boxes over the imported plan, so recognized text is visible where it sits.
    drawPlanTextOverlay(ctx);
    
    // Floor openings on this storey (the cutout tool's output). Drawn under the
    // walls so a hole reads as part of the slab, with handles when selected.
    if (activeOpenings().length || AppState.cutoutDraft) {
        drawFloorOpenings(ctx, {
            openings: activeOpenings(),
            selectedId: AppState.selectedOpeningId,
            selectedVertexIndex: AppState.selectedVertexIndex,
            draft: AppState.cutoutDraft,
            active: AppState.currentTool === 'cutout'
        });
    }

    // Walls
    AppState.walls.forEach(wall => drawWall(ctx, wall.start, wall.end, false, wall.id === AppState.selectedWallId));
    
    // Wall Preview
    if (AppState.isDrawing && AppState.wallStart && cursorPos) {
        drawWall(ctx, AppState.wallStart, cursorPos, true);
    }
    
    // Fixtures
    AppState.fixtures.forEach(f => {
        if (f.visible === false && !abilityState.showHidden) return;
        drawFixture(ctx, f);
    });

    // Ghost Item Preview
    if (abilityState.ghostPreview !== false && cursorPos && !AppState.drag && AppState.currentTool && !['wall', 'delete', 'select', 'cutout'].includes(AppState.currentTool)) {
        ctx.globalAlpha = 0.5;
        // Mock fixture for drawing
        const ghost = { x: cursorPos.x, y: cursorPos.y, rotation: 0, type: AppState.currentTool, metadata: ItemFactory.create(AppState.currentTool,0,0).metadata };
        drawFixture(ctx, ghost);
        ctx.globalAlpha = 1.0;
    }

    // Ability + feature overlays that belong to the plan plane.
    drawPlanOverlays(ctx, {
        walls: AppState.walls,
        fixtures: AppState.fixtures,
        selected: AppState.selectedFixture,
        selectedWallId: AppState.selectedWallId,
        state: {
            ...abilityState,
            // The drag index reports whether the moving footprint is clear.
            dragValid: AppState.drag?.valid ?? null
        },
        roomLabels: AppState.roomLabels,
        snapGuide: currentSnapGuide(),
        dragged: AppState.drag?.fixture || null,
        ruler: { ...(AppState.ruler || {}), cursor: AppState.cursor }
    });

    // Collaboration comment pins (studio feature 43).
    if (AppState.comments?.length) {
        drawStudioOverlays(ctx, {
            comments: AppState.comments,
            selectedCommentId: AppState.selectedCommentId
        });
    }

    ctx.restore();

    // Viewport-fixed overlays (north, scale bar, HUD, legend, border).
    drawScreenOverlays(ctx, {
        walls: AppState.walls,
        fixtures: AppState.fixtures,
        selectedWallId: AppState.selectedWallId,
        state: abilityState,
        cursor: AppState.cursor,
        view: { width: w, height: h }
    });
}

function drawGrid(ctx, w, h, abilityState = {}) {
    const g = AppState.gridSize;
    // A grid size of 0 is the "off" option; without this guard the loop below
    // would never advance.
    if (abilityState.grid !== false && g > 0) {
        // Large enough to cover the panned view at any zoom.
        const large = 5000;
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -large; x <= large; x += g) {
            ctx.moveTo(x, -large);
            ctx.lineTo(x, large);
        }
        for (let y = -large; y <= large; y += g) {
            ctx.moveTo(-large, y);
            ctx.lineTo(large, y);
        }
        ctx.stroke();
    }

    if (abilityState.axes !== false) {
        ctx.strokeStyle = '#9ca3af';
        ctx.beginPath();
        ctx.moveTo(-20, 0); ctx.lineTo(20, 0);
        ctx.moveTo(0, -20); ctx.lineTo(0, 20);
        ctx.stroke();
    }
}

function drawWall(ctx, start, end, isPreview = false, isSelected = false) {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineWidth = isSelected ? 9 : 6;
    ctx.strokeStyle = isPreview ? '#9ca3af' : (isSelected ? '#f59e0b' : '#2563eb');
    if (isPreview) ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Endpoints
    ctx.fillStyle = isPreview ? '#9ca3af' : (isSelected ? '#b45309' : '#1e40af');
    ctx.beginPath(); ctx.arc(start.x, start.y, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(end.x, end.y, 4, 0, Math.PI*2); ctx.fill();
    
    // Dimensions
    if (AppState.showDimensions) {
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const len = Math.hypot(end.x - start.x, end.y - start.y);
        const text = (len / SCALE).toFixed(1) + 'm';
        
        ctx.save();
        ctx.font = 'bold 11px "Space Grotesk", sans-serif';
        const tm = ctx.measureText(text);
        
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(midX - tm.width/2 - 4, midY - 8, tm.width + 8, 16);
        
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, midX, midY);
        ctx.restore();
    }
}

function drawFixture(ctx, f) {
    // Stairs and water features have their own plan symbols: every tread, the
    // stair-up arrow, the coping ring and the water surface.
    const storeyHeight = activeStoreyHeight();
    if (isStairItem(f)) {
        drawStairPlan(ctx, f, { storeyHeight, scale: SCALE });
        if (AppState.selectedFixture?.id === f.id) {
            // Selection covers the whole stair: the run plus the automatic
            // landings the 3D build draws, not just the tread rectangle.
            const bounds = stairPlanBounds(f, { storeyHeight });
            const w = bounds.width * SCALE;
            const d = bounds.depth * SCALE;
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.rotation || 0);
            ctx.strokeStyle = '#f59e0b';
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(bounds.centreX * SCALE - w / 2, bounds.centreZ * SCALE - d / 2, w, d);
            ctx.restore();
        }
        return;
    }
    if (isWaterFeature(f)) {
        drawWaterPlan(ctx, f, { scale: SCALE });
        return;
    }

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);
    
    const { width, depth } = itemDimensions(f);
    const w = width * SCALE;
    const d = depth * SCALE;
    
    const isSelected = AppState.selectedFixture && AppState.selectedFixture.id === f.id;
    const isHidden = f.visible === false;

    if (isHidden) {
        // Draw hidden pieces as a dashed outline so they can still be found and
        // brought back, without pretending to be part of the plan.
        ctx.setLineDash([6, 4]);
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-w / 2, -d / 2, w, d);
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.restore();
        return;
    }

    const metaColor = f.metadata?.color != null
        ? '#' + f.metadata.color.toString(16).padStart(6, '0')
        : null;
    ctx.fillStyle = f.type === 'window' ? '#93c5fd' : (f.type === 'door' ? '#b45309' : (metaColor || '#64748b'));
    ctx.strokeStyle = isSelected ? '#f59e0b' : '#334155';
    ctx.lineWidth = isSelected ? 3 : 1;

    ctx.beginPath();
    ctx.rect(-w/2, -d/2, w, d);
    ctx.fill();
    ctx.stroke();
    
    // Orientation line
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w/2, 0);
    ctx.stroke();
    
    ctx.restore();
}

// ------------------------------------------------------------------
// 3D Logic
// ------------------------------------------------------------------

/** 
 * The visible explanation that replaces an empty 3D panel. It lives inside
 * `#render-3d-view`, so it covers nothing but the 3D view, and it is announced
 * as an alert because it appears in response to a failure.
 */
function show3DFallback(title, detail, { retry = null } = {}) {
    const host = document.getElementById('render-3d-view');
    if (!host) return;
    let panel = document.getElementById('render-3d-fallback');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'render-3d-fallback';
        panel.className = 'absolute inset-0 z-10 flex items-center justify-center p-6 bg-gray-100 dark:bg-gray-800';
        host.appendChild(panel);
    }
    panel.setAttribute('role', 'alert');
    panel.innerHTML = `
        <div class="max-w-sm text-center">
            <span class="material-symbols-outlined text-3xl text-amber-500">warning</span>
            <p class="mt-1 text-sm font-bold text-gray-800 dark:text-gray-100">${escapeHtml(title)}</p>
            <p class="mt-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400">${escapeHtml(detail)}</p>
            <p class="mt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">The 2D plan and every other panel keep working.</p>
            ${retry ? '<button type="button" id="render-3d-retry" class="mt-3 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90">Try the 3D view again</button>' : ''}
        </div>`;
    panel.querySelector('#render-3d-retry')?.addEventListener('click', () => {
        hide3DFallback();
        retry();
    });
}

function hide3DFallback() {
    document.getElementById('render-3d-fallback')?.remove();
}

/** Clear a failed frame and rebuild the 3D scene from the current plan. */
function retry3DView() {
    render3DFailed = null;
    hide3DFallback();
    update3D();
    renderLoop?.requestRender();
}

function init3D() {
    const container = document.getElementById('render-3d-view');
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0xf3f4f6);
    
    camera3D = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    camera3D.position.set(10, 10, 10);
    
    // Side elevation camera: orthographic, head-on to one of the four sides.
    orthoCamera3D = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 200);
    orthoCamera3D.position.set(0, 1.35, 20);

    try {
        renderer3D = new THREE.WebGLRenderer({ antialias: true });
    } catch (error) {
        // No WebGL2/WebGL1 context: three cannot build a renderer. Report it,
        // say so in the panel, and leave the rest of the editor running — the
        // plan, the inspectors and every suite still work.
        renderer3D = null;
        render3DFailed = 'start';
        window.reportClientError?.(error, { source: 'editor:3d:start', kind: 'render' });
        show3DFallback(
            'The 3D view needs WebGL',
            'This browser could not create a WebGL context. Turn on hardware acceleration, update the graphics driver, or open the editor in another browser.'
        );
        return;
    }
    // Match the display's pixel density (capped at 2) or the 3D view is a 1×
    // buffer stretched over a 2× panel — soft edges on every HiDPI screen.
    renderer3D.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer3D.setSize(w, h);
    renderer3D.shadowMap.enabled = true;
    container.appendChild(renderer3D.domElement);

    // A lost GL context (driver reset, GPU process restart, too many contexts)
    // leaves the canvas black until something renders again. Prevent the default
    // so three.js can rebuild its resources on restore, then draw a fresh frame.
    renderer3D.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        window.reportClientError?.(new Error('WebGL context lost in the 3D view'), {
            source: 'editor:3d',
            kind: 'render'
        });
    });
    renderer3D.domElement.addEventListener('webglcontextrestored', () => {
        renderLoop?.requestRender();
    });
    
    controls3D = new OrbitControls(camera3D, renderer3D.domElement);
    controls3D.enableDamping = true;

    // Elevation controls keep the drawing head-on: no orbit, pan and zoom only.
    orthoControls3D = new OrbitControls(orthoCamera3D, renderer3D.domElement);
    orthoControls3D.enableDamping = true;
    orthoControls3D.enableRotate = false;
    orthoControls3D.enabled = false;
    
    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.5);
    scene3D.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 5);
    dir.castShadow = true;
    scene3D.add(dir);
    
    // Section box / clipping plane (feature 32); off until its ability is on.
    sectionBox = createSectionBox({ renderer: renderer3D });

    // Lab kit: the React lab demos rebuilt against this scene (features/lab).
    labKit = createLabKit({
        scene: scene3D,
        renderer: renderer3D,
        camera: camera3D,
        container,
        requestRender: () => renderLoop?.requestRender()
    });

    conversionEngine = new ConversionEngine3D(scene3D);
    // GLB items are swapped in asynchronously; ask for a frame so the loaded
    // model replaces its proxy without waiting for the next edit.
    conversionEngine.onModelLoaded = () => renderLoop?.requestRender();

    initGizmo();

    // Pathfinding walkthrough agent (feature 36).
    walkthrough = createWalkthrough({
        scene: scene3D,
        camera: camera3D,
        domElement: renderer3D.domElement,
        getWalls: () => AppState.walls,
        getView: () => (planViewSize())
    });

    // First-person plan walk (legacy app.html Walk button): eye-level camera on
    // the active storey, WASD movement with wall clearance, mouse look.
    planWalk = createWalkMode({
        camera: camera3D,
        domElement: renderer3D.domElement,
        getWalls: () => AppState.walls,
        getView: () => (planViewSize()),
        getElevation: () => activeStoreyElevation(),
        onChange: (walking) => {
            AppState.walking = Boolean(walking);
            if (controls3D) controls3D.enabled = !walking;
            document.getElementById('walk-hud')?.classList.toggle('hidden', !walking);
            const button = document.getElementById('walk-btn');
            if (button) {
                button.classList.toggle('bg-primary', Boolean(walking));
                button.classList.toggle('text-white', Boolean(walking));
            }
            renderLoop?.requestRender();
        }
    });

    // Live bottom/top/height readout for elevation drags.
    heightReadout = createHeightReadout(document.getElementById('height-readout'));

    // Up/down and side-to-side dragging inside an elevation view.
    elevationDrag = createElevationDrag({
        scene: scene3D,
        domElement: renderer3D.domElement,
        getCamera: activeCamera,
        getSide: () => AppState.elevationSide,
        getView: () => (planViewSize()),
        getFixtures: () => AppState.fixtures,
        getObject: findItemObject,
        onDraggingChange: (active) => {
            if (orthoControls3D) orthoControls3D.enabled = Boolean(AppState.elevationSide) && !active;
        },
        onCommit: () => {
            // The mesh was moved live; rebuild so the 2D plan and storage agree
            // (and so snapping is baked into the saved position).
            saveAndSync();
            refreshGizmo();
        },
        onDrag: (info) => {
            if (!heightReadout) return;
            if (!info || info.phase === 'end') {
                heightReadout.hide();
                return;
            }
            if (abilitiesState().elevationHeights === false) return;
            heightReadout.show({ bottom: info.bottom, top: info.top, lift: info.lift });
        }
    });

    // Picking in the 3D view: click selects, drag orbits.
    let pointerDownAt = null;
    renderer3D.domElement.addEventListener('pointerdown', (e) => {
        pointerDownAt = { x: e.clientX, y: e.clientY, button: e.button };
    });
    renderer3D.domElement.addEventListener('pointerup', (e) => {
        const start = pointerDownAt;
        pointerDownAt = null;
        // Clicks look around while walking; they must not pick or open the gizmo.
        if (planWalk?.active) return;
        if (!start || start.button !== 0 || e.button !== 0) return;
        // A press that grabbed a gizmo handle or dragged a piece belongs to the
        // gizmo / elevation drag, not to selection
        if (elevationDrag && elevationDrag.dragging) return;
        if (itemGizmo && (itemGizmo.dragging || itemGizmo.controls.axis)) return;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return; // orbit, not a click
        // Walkthrough mode turns a click into a destination, not a selection.
        if (abilitiesState().walkthrough && walkthrough) {
            walkthrough.walkToEvent(e);
            return;
        }
        selectAtPointer(e);
    });
    
    // Ability helpers: the 3D grid and axes are ability toggles themselves.
    gridHelper3D = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
    gridHelper3D.visible = Boolean(abilitiesState().grid3D);
    scene3D.add(gridHelper3D);

    axesHelper3D = new THREE.AxesHelper(5);
    axesHelper3D.visible = Boolean(abilitiesState().axes3D);
    scene3D.add(axesHelper3D);

    // Studio feature 40: render only when something changed, unless an
    // animation needs frames or "render every frame" is switched on. This is
    // what keeps a drag at display rate without a CSG rebuild per pointer move.
    renderLoop = createRenderLoop({
        render: (delta) => {
            if (render3DFailed) return;
            try {
                const controls = AppState.elevationSide ? orthoControls3D : controls3D;
                if (controls) controls.update();
                if (planWalk?.active) planWalk.update(planWalkClock.getDelta());
                if (walkthrough) walkthrough.update(walkthroughClock.getDelta());
                if (stairWalker?.active) stairWalker.update(stairWalkerClock.getDelta());
                if (AppState.viewMode !== '3d') return;
                const camera = activeCamera();
                labKit?.update(delta, {
                    camera,
                    selection: findItemObject(AppState.selectedFixture?.id),
                    products: productItemObjects()
                });
                if (!labKit?.render(camera)) renderer3D.render(scene3D, camera);
            } catch (error) {
                // Stop the loop (no per-frame error spray), explain the panel and
                // offer a rebuild. The plan stays usable throughout.
                render3DFailed = 'frame';
                window.reportClientError?.(error, { source: 'editor:3d:frame', kind: 'render' });
                show3DFallback(
                    'The 3D view stopped drawing',
                    String(error?.message || error || 'A frame failed to render.').slice(0, 200),
                    { retry: retry3DView }
                );
            }
        },
        continuous: () => abilitiesState().dirtyRender === false
            || Boolean(abilitiesState().walkthrough || abilitiesState().turntable || AppState.walking)
            || (AppState.viewMode === '3d' && Boolean(labKit?.needsFrame())),
        isActive: () => AppState.viewMode === '3d'
    });
    renderLoop.start();
    controls3D.addEventListener('change', () => renderLoop?.requestRender());
    orthoControls3D.addEventListener('change', () => renderLoop?.requestRender());
    // Perf HUD sampling (labs dashboard, docs/audit.md §7): twice a second,
    // independent of the dirty-flag loop, so fps is honest even when idle.
    window.setInterval(refreshPerfHud, 500);

    // The canvas has to follow its panel, not just the window: collapsing a
    // sidebar, opening devtools or an animated layout changes the host with no
    // resize event, and a canvas stuck at a stale (or 0×0) buffer is exactly
    // what a blank 3D view looks like.
    const view3dHost = document.getElementById('render-3d-view');
    if (view3dHost && typeof ResizeObserver === 'function') {
        let lastSize = { width: 0, height: 0 };
        const observer = new ResizeObserver(() => {
            const width = view3dHost.clientWidth;
            const height = view3dHost.clientHeight;
            if (!width || !height) return;
            if (width === lastSize.width && height === lastSize.height) return;
            lastSize = { width, height };
            onResize();
        });
        observer.observe(view3dHost);
    }
}

function initGizmo() {
    if (itemGizmo || !scene3D) return;
    itemGizmo = createItemGizmo({
        scene: scene3D,
        camera: camera3D,
        renderer: renderer3D,
        orbit: controls3D,
        onPreview: (object) => {
            const fixture = AppState.selectedFixture;
            if (!fixture) return;
            // The gizmo moves the mesh; mirror it back into plan coordinates
            // so the 2D canvas follows while the handle is still held.
            const plan = planFromObject(object, blueprintCanvas);
            fixture.x = plan.x;
            fixture.y = plan.y;
            fixture.rotation = plan.rotation;

            // A Y drag becomes the item's lift, measured from the height the
            // mesh had when the gizmo attached (its builder default).
            if (AppState.gizmoBase) {
                const delta = object.position.y - AppState.gizmoBase.y;
                fixture.elevation = Math.max(-0.9, AppState.gizmoBase.elevation + delta);
            }

            draw2D();
            renderLoop?.requestRender();
        },
        onCommit: () => {
            const fixture = AppState.selectedFixture;
            if (!fixture) return;
            snapToWalls(fixture, AppState.walls, { threshold: 24 / AppState.scale });
            if (!fixture.isValidPosition(fixture.x, fixture.y, { walls: AppState.walls })) {
                if (AppState.gizmoOrigin) {
                    fixture.x = AppState.gizmoOrigin.x;
                    fixture.y = AppState.gizmoOrigin.y;
                    fixture.rotation = AppState.gizmoOrigin.rotation;
                }
                setStatus('That position crosses a wall. The piece was returned to its starting point.', true);
            }
            saveAndSync();
        }
    });
    itemGizmo.setMode(gizmoMode);
}

function findItemObject(id) {
    let found = null;
    if (!scene3D) return null;
    scene3D.traverse((child) => {
        if (!found && child.userData && child.userData.type === 'item' && child.userData.id === id) found = child;
    });
    return found;
}

/** Placed GLB items the lab animations (auto-rotate, shake, scale) follow. */
function productItemObjects() {
    return (AppState.fixtures || [])
        .filter((fixture) => fixture.metadata?.modelUrl || fixture.type === 'shaker')
        .map((fixture) => findItemObject(fixture.id))
        .filter(Boolean);
}

function refreshGizmo() {
    if (!itemGizmo) return;
    const fixture = AppState.selectedFixture;
    if (!fixture || fixture.locked || fixture.visible === false || AppState.viewMode !== '3d' || AppState.elevationSide) {
        itemGizmo.detach();
        AppState.gizmoBase = null;
        AppState.gizmoOrigin = null;
        return;
    }
    const object = findItemObject(fixture.id);
    if (object) {
        itemGizmo.attach(object);
        // Remember the mesh's builder height so Y movement maps to elevation.
        AppState.gizmoBase = { y: object.position.y, elevation: fixture.elevation || 0 };
        AppState.gizmoOrigin = { x: fixture.x, y: fixture.y, rotation: fixture.rotation };
    } else {
        itemGizmo.detach();
        AppState.gizmoBase = null;
        AppState.gizmoOrigin = null;
    }
}

/** Wall id under a 3D pointer event, or null when the click misses a wall. */
function pickWallIdAtPointer(event) {
    if (!scene3D || !renderer3D || !conversionEngine?.wallRoot) return null;
    if (conversionEngine.wallRoot.visible === false) return null;

    const rect = renderer3D.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, activeCamera());

    const visible = (object) => {
        for (let node = object; node; node = node.parent) {
            if (node.visible === false) return false;
        }
        return true;
    };
    const walls = [];
    conversionEngine.wallRoot.traverse((child) => {
        if (child.userData?.type === 'wall' && child.userData.id && visible(child)) walls.push(child);
    });
    if (walls.length === 0) return null;

    conversionEngine.wallRoot.updateWorldMatrix(true, true);
    const hit = raycaster.intersectObjects(walls, false)[0];
    if (!hit?.object?.userData?.id) return null;

    // Keep the plan cursor on the picked point: the next comment, paste or
    // keyboard action then lands where the user just clicked in 3D.
    if (hit.point && blueprintCanvas) {
        AppState.cursor = worldToCanvas(hit.point, planViewSize());
    }
    return hit.object.userData.id;
}

/** Select a wall in both the plan and the 3D view, refreshing the inspector. */
function selectWallById(id) {
    AppState.selectedWallId = id || null;
    if (id) {
        AppState.selectedFixture = null;
        AppState.currentTool = 'select';
    }
    draw2D();
    refreshGizmo();
    syncSelectionPanels();
    // Picking a wall in 2D/3D shows that wall when the elevation is open.
    if (id && AppState.elevationSide) setElevationWall(id);
    // The wall builder's highlight is part of its wall signature, so one
    // rebuild swaps the selected material without touching anything else.
    if (AppState.viewMode === '3d') update3D();
    return AppState.selectedWallId;
}

/** One pick for the 3D view: an item first, then the wall behind it. */
function selectAtPointer(event) {
    if (!scene3D || !renderer3D) return null;
    const id = pickItemId(scene3D, activeCamera(), renderer3D.domElement, event);
    if (id) {
        AppState.selectedFixture = AppState.fixtures.find((fixture) => fixture.id === id) || null;
        if (AppState.selectedFixture) AppState.selectedWallId = null;
        if (AppState.selectedFixture) AppState.currentTool = 'select';
        draw2D();
        refreshGizmo();
        syncSelectionPanels();
        return AppState.selectedFixture;
    }

    const wallId = pickWallIdAtPointer(event);
    if (wallId) return selectWallById(wallId);

    AppState.selectedFixture = null;
    AppState.selectedWallId = null;
    draw2D();
    refreshGizmo();
    syncSelectionPanels();
    return null;
}

function setGizmoMode(mode) {
    gizmoMode = mode === 'rotate' ? 'rotate' : 'translate';
    if (itemGizmo) itemGizmo.setMode(gizmoMode);
}

function activeCamera() {
    return AppState.elevationSide && orthoCamera3D ? orthoCamera3D : camera3D;
}

/** World-space (metres) footprint of the plan, used to frame the elevations. */
function worldBounds() {
    const view = planViewSize();
    const points = [];
    (AppState.walls || []).forEach((wall) => {
        if (wall.start) points.push(wall.start);
        if (wall.end) points.push(wall.end);
    });
    if (points.length === 0) {
        (AppState.fixtures || []).forEach((fixture) => points.push({ x: fixture.x, y: fixture.y }));
    }
    if (points.length === 0) return { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    points.forEach((point) => {
        const x = (point.x - view.width / 2) / PIXELS_PER_METER;
        const z = (point.y - view.height / 2) / PIXELS_PER_METER;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    });
    return { minX, maxX, minZ, maxZ };
}

/** Walls long enough to be a run; the elevation steps through these. */
function elevationWalls() {
    return (AppState.walls || []).filter((wall) => wall?.start && wall?.end
        && Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) > 10);
}

/** World-space bounds of one wall, so the camera frames just that run. */
function elevationWallBounds(wall) {
    const view = planViewSize();
    const a = {
        x: (wall.start.x - view.width / 2) / PIXELS_PER_METER,
        z: (wall.start.y - view.height / 2) / PIXELS_PER_METER
    };
    const b = {
        x: (wall.end.x - view.width / 2) / PIXELS_PER_METER,
        z: (wall.end.y - view.height / 2) / PIXELS_PER_METER
    };
    return {
        minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
        minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z)
    };
}

/**
 * The wall the elevation is showing: the one already chosen, else the 2D
 * selection, else the longest wall that faces the camera.
 */
function pickElevationWall() {
    const walls = elevationWalls();
    if (!walls.length) return null;
    const chosen = walls.find((wall) => wall.id === AppState.elevationWallId);
    if (chosen) return chosen;
    const selected = walls.find((wall) => wall.id === AppState.selectedWallId);
    if (selected) return selected;

    const axes = elevationAxes(AppState.elevationSide || 'front');
    let best = null;
    walls.forEach((wall) => {
        const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
        const nx = -(wall.end.y - wall.start.y) / length;
        const ny = (wall.end.x - wall.start.x) / length;
        const facing = axes ? Math.abs(nx * axes.normal.x + ny * axes.normal.y) : 0;
        const score = facing * 1000 + length;
        if (!best || score > best.score) best = { wall, score };
    });
    return best?.wall || walls[0];
}

function updateElevationWallLabel() {
    const label = document.getElementById('elevation-wall-label');
    const walls = elevationWalls();
    const index = walls.findIndex((wall) => wall.id === AppState.elevationWallId);
    if (label) {
        if (!AppState.elevationSide || index < 0) {
            label.textContent = '';
        } else {
            const wall = walls[index];
            const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) / PIXELS_PER_METER;
            label.textContent = `Wall ${index + 1}/${walls.length} · ${length.toFixed(2)} m`;
        }
    }
    ['elevation-prev', 'elevation-next'].forEach((id) => {
        const button = document.getElementById(id);
        if (button) button.disabled = walls.length < 2;
    });
}

/** Step to the next or previous wall while staying in the same elevation. */
function stepElevationWall(direction) {
    const walls = elevationWalls();
    if (!walls.length) return null;
    const index = walls.findIndex((wall) => wall.id === AppState.elevationWallId);
    const nextIndex = index < 0
        ? 0
        : (index + (direction < 0 ? -1 : 1) + walls.length) % walls.length;
    AppState.elevationWallId = walls[nextIndex].id;
    if (AppState.elevationSide) updateElevationCamera();
    updateElevationButtons();
    return AppState.elevationWallId;
}

function setElevationWall(id) {
    const wall = elevationWalls().find((entry) => entry.id === id);
    AppState.elevationWallId = wall?.id || null;
    if (AppState.elevationSide) updateElevationCamera();
    updateElevationButtons();
    return AppState.elevationWallId;
}

function updateElevationCamera() {
    if (!AppState.elevationSide || !orthoCamera3D) return;
    const container = document.getElementById('render-3d-view');
    const width = container?.clientWidth || 1;
    const height = container?.clientHeight || 1;

    const wall = pickElevationWall();
    AppState.elevationWallId = wall?.id || null;
    elevationBounds = wall ? elevationWallBounds(wall) : worldBounds();
    const target = frameElevation(orthoCamera3D, {
        bounds: elevationBounds,
        side: AppState.elevationSide,
        aspect: width / height
    });
    if (target && orthoControls3D) {
        orthoControls3D.target.copy(target);
        orthoControls3D.update();
    }
    applyElevationVisibility(scene3D, AppState.elevationSide, elevationBounds, {
        wallId: wall?.id || null,
        wall,
        fixtures: AppState.fixtures
    });
    updateElevationWallLabel();
}

/**
 * Switch the 3D preview between the orbit view and one of the four side
 * elevations (front/back/left/right). Passing null goes back to the orbit.
 */
function setElevationView(side) {
    const nextSide = side && ELEVATION_SIDES.includes(side) ? side : null;
    AppState.elevationSide = nextSide;
    // Leaving the elevation restores every wall; entering it frames one wall.
    AppState.elevationWallId = nextSide ? AppState.elevationWallId : null;
    setViewMode(nextSide ? 'elevation' : '3d');
    if (nextSide) updateElevationCamera();
    updateElevationButtons();
}

/**
 * The single view switch: 2D plan, 3D orbit, or a head-on elevation.
 * Elevation is the 3D canvas with a side camera, so all three modes share the
 * same scene, the same selection state and their own drag handler.
 */
function setViewMode(mode) {
    const next = ['2d', '3d', 'elevation'].includes(mode) ? mode : '2d';
    // Switching away from the orbit view leaves the first-person walk.
    if (next !== '3d' && planWalk?.active) planWalk.exit();
    const v2d = document.getElementById('view-2d');
    const v3d = document.getElementById('view-3d');
    const r3d = document.getElementById('render-3d-view');
    if (!v2d || !v3d) return;

    AppState.viewMode = next === '2d' ? '2d' : '3d';
    if (next === 'elevation') {
        AppState.elevationSide = AppState.elevationSide || 'front';
    } else {
        AppState.elevationSide = null;
    }

    const show3d = next !== '2d';
    v2d.style.opacity = show3d ? '0' : '1';
    v2d.style.pointerEvents = show3d ? 'none' : 'auto';
    v3d.style.opacity = show3d ? '1' : '0';
    v3d.style.pointerEvents = show3d ? 'auto' : 'none';
    if (r3d) r3d.style.display = show3d ? 'block' : 'none';
    // The 3D renderer is created before the responsive layout settles, so a
    // view switch has to re-measure its host; otherwise the canvas stays 0×0
    // and the first 3D click has no camera. This is also what keeps the first
    // 3D pick and the wall highlight aligned after a resize.
    if (show3d) onResize();

    if (itemGizmo) itemGizmo.detach();
    if (!show3d && elevationDrag) elevationDrag.end();
    if (!AppState.elevationSide && heightReadout) heightReadout.hide();

    if (show3d) update3D();
    if (AppState.elevationSide) updateElevationCamera();
    else if (scene3D) applyElevationVisibility(scene3D, null, null, { fixtures: AppState.fixtures });

    if (controls3D) controls3D.enabled = !AppState.elevationSide;
    if (orthoControls3D) {
        orthoControls3D.enabled = Boolean(AppState.elevationSide) && !(elevationDrag && elevationDrag.dragging);
    }

    refreshGizmo();
    updateViewButtons();
    refreshPerfHud();
}

function updateViewButtons() {
    document.querySelectorAll('[data-view-mode]').forEach((btn) => {
        const mode = btn.dataset.viewMode;
        const active = mode === 'elevation'
            ? Boolean(AppState.elevationSide)
            : mode === '3d'
                ? AppState.viewMode === '3d' && !AppState.elevationSide
                : AppState.viewMode === '2d';
        btn.classList.toggle('bg-primary', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('font-bold', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const bar = document.getElementById('elevation-bar');
    if (bar) bar.classList.toggle('hidden', !AppState.elevationSide);

    updateElevationButtons();
}

function updateElevationButtons() {
    document.querySelectorAll('.elevation-btn').forEach((btn) => {
        const isActive = (btn.dataset.side || '') === (AppState.elevationSide || '');
        btn.classList.toggle('bg-primary', isActive);
        btn.classList.toggle('font-bold', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    const hint = document.getElementById('elevation-hint');
    if (hint) {
        hint.textContent = AppState.elevationSide
            ? 'Elevation • one wall at a time — ‹ › steps walls, drag a piece up/down or side to side'
            : 'Click an object to select • G move • R rotate • Elevation for up/down';
    }
    updateElevationWallLabel();
}

function update3D() {
    if (!conversionEngine) return;
    // The rebuild replaces the meshes, so drop the old gizmo target first.
    if (itemGizmo) itemGizmo.detach();

    // The active storey's arrays are the legacy AppState.walls/fixtures, so the
    // graph the 2D canvas edits is also the graph the 3D view builds.
    ensureStoreyModel();
    syncActiveStorey(AppState);

    const view = planViewSize();
    const stories = engineStories(AppState);
    const activeIndex = Math.min(AppState.currentStoryIndex || 0, stories.length - 1);
    const graph = graphFromWalls(stories[activeIndex]?.walls || [], view, { snapPixels: 2 });

    // Storeys stack by their heights; the engine also reads each one's visible
    // flag (studio features 39-41).
    if (stories[activeIndex]) {
        stories[activeIndex] = { ...stories[activeIndex], walls: graph.toCanvasWalls(view) };
    }

    const engineState = {
        stories,
        currentStoryIndex: activeIndex,
        roomMaterials: AppState.roomMaterials,
        roomFloors: abilitiesState().roomFloors !== false,
        measurements: measurePlan(graph),
        showMeasurements: AppState.showDimensions,
        fixtureStyles: AppState.fixtureStyles,
        // Room labels from features/room-labels.js (centroid + area + volume).
        roomLabels: AppState.roomLabels,
        showRoomLabels: abilitiesState().roomLabels !== false,
        showCeiling: AppState.showCeiling,
        showRoof: AppState.showRoof,
        roofConfig: AppState.roofConfig,
        defaultWallTexture: AppState.defaultWallTexture,
        defaultFloorTexture: AppState.defaultFloorTexture,
        selectedWallId: AppState.selectedWallId,
        selectedFixture: AppState.selectedFixture
    };
    
    // Pass the plan's logical dimensions to center the model correctly
    // conversionEngine calculates: (x - width/2) / SCALE
    // So by passing the logical view, we align the plan centre with the 3D origin
    AppState.lastConvert = conversionEngine.convert(engineState, view.width, view.height);

    // Frame the first non-empty plan, then leave the camera to the user.
    if (!AppState.hasFramed3D && graph.edges.length > 0 && camera3D && controls3D) {
        fitCameraToGraph(camera3D, controls3D, graph, { targetHeight: WALL_HEIGHT * 0.45 });
        AppState.hasFramed3D = true;
    }
    if (graph.edges.length === 0) AppState.hasFramed3D = false;

    // Ability flags (wireframe, hidden walls, grid/axes, shadows) survive the
    // rebuild, so they are re-applied to the new meshes here.
    apply3DAbilities(
        { scene: scene3D, renderer: renderer3D, controls: AppState.elevationSide ? orthoControls3D : controls3D },
        abilitiesState(),
        { grid: gridHelper3D, axes: axesHelper3D }
    );

    // The rebuild replaces every wall mesh, so the elevation cut has to be
    // re-applied to the new ones.
    if (AppState.elevationSide) {
        updateElevationCamera();
    } else {
        applyElevationVisibility(scene3D, null, null, { fixtures: AppState.fixtures });
    }

    refreshGizmo();
    // The rebuild replaced every mesh, so the height annotations anchored to
    // them are rebuilt too.
    refreshElevationAnnotations();
    // The exterior suite geometry sits outside the walls, so it is rebuilt
    // after the engine has rebuilt the house it attaches to.
    refreshSuiteScene();
    // Framing is rebuilt from the same plan, after the walls it replaces.
    refreshFramingOverlay();
    labKit?.setPlan(worldBounds(), activeStoreyElevation());
    // The plan and the 3D view are canvases, so the only text a screen reader
    // gets is this summary; it is announced politely as the plan changes.
    updatePlanA11ySummary();
    renderLoop?.requestRender();
}

function updatePlanA11ySummary() {
    const summary = document.getElementById('plan-a11y-summary');
    if (!summary) return;
    const walls = AppState.walls?.length || 0;
    const fixtures = AppState.fixtures?.length || 0;
    const rooms = AppState.lastConvert?.rooms || 0;
    const selected = AppState.selectedWallId
        ? 'A wall is selected.'
        : AppState.selectedFixture
            ? 'A fixture is selected.'
            : 'Nothing is selected.';
    if (!walls && !fixtures) {
        summary.textContent = 'Empty floor plan.';
        return;
    }
    summary.textContent = `Floor plan: ${walls} wall${walls === 1 ? '' : 's'}, `
        + `${rooms} room${rooms === 1 ? '' : 's'}, ${fixtures} fixture${fixtures === 1 ? '' : 's'}. ${selected}`;
}

/** Mesh count and world bounds of one exterior suite group, for the kits. */
function suiteSceneStats(group) {
    if (!group) return null;
    let meshes = 0;
    group.traverse((object) => { if (object.isMesh) meshes += 1; });
    const box = new THREE.Box3().setFromObject(group);
    return {
        name: group.name,
        visible: group.visible,
        meshes,
        bounds: box.isEmpty() ? null : {
            minX: Math.round(box.min.x * 1000) / 1000,
            maxX: Math.round(box.max.x * 1000) / 1000,
            minY: Math.round(box.min.y * 1000) / 1000,
            maxY: Math.round(box.max.y * 1000) / 1000,
            minZ: Math.round(box.min.z * 1000) / 1000,
            maxZ: Math.round(box.max.z * 1000) / 1000
        }
    };
}

/**
 * Place the deck and the service panel against the active storey's walls.
 * Both are drafts from their designers; with no draft there is no group. The
 * groups live under the scene root rather than the engine content, so they are
 * disposed here before each rebuild.
 */
function refreshSuiteScene() {
    const disposeGroup = (group) => {
        if (!group) return;
        group.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) object.material.forEach((entry) => entry.dispose());
                else object.material.dispose();
            }
        });
        group.parent?.remove(group);
    };

    disposeGroup(deckSceneGroup);
    disposeGroup(electricalSceneGroup);
    deckSceneGroup = null;
    electricalSceneGroup = null;

    if (!scene3D || !blueprintCanvas) return;
    const stories = engineStories(AppState);
    const activeIndex = Math.min(AppState.currentStoryIndex || 0, stories.length - 1);
    const walls = stories[activeIndex]?.walls || AppState.walls || [];
    const view = planViewSize();

    try {
        const deckDesign = AppState.deckDraft?.config ? computeDeckDesign(AppState.deckDraft.config) : null;
        if (deckDesign) {
            deckSceneGroup = buildDeckSceneGroup(deckDesign, { walls, view });
            if (deckSceneGroup) scene3D.add(deckSceneGroup);
        }
    } catch (error) {
        console.warn('Deck scene could not be built', error);
        deckSceneGroup = null;
    }

    try {
        const electricalDesign = AppState.electricalDraft?.config
            ? computeElectricalDesign(AppState.electricalDraft.config)
            : null;
        if (electricalDesign) {
            electricalSceneGroup = buildElectricalPanelGroup(electricalDesign, { walls, view });
            if (electricalSceneGroup) scene3D.add(electricalSceneGroup);
        }
    } catch (error) {
        console.warn('Electrical panel scene could not be built', error);
        electricalSceneGroup = null;
    }
}

/**
 * Swap the finished walls for the stud frame, or back. The overlay is built by
 * features/framing/scene.js from the editor's actual walls, so it follows every
 * storey and every opening without a second copy of the plan.
 */
function refreshFramingOverlay() {
    if (framingGroup) {
        disposeFramingGroup(framingGroup);
        framingGroup = null;
    }
    if (conversionEngine?.wallRoot) {
        conversionEngine.wallRoot.visible = !AppState.framingEnabled;
    }

    framingResult = null;
    if (AppState.framingEnabled && scene3D && conversionEngine && blueprintCanvas) {
        try {
            const stories = engineStories(AppState);
            const stack = storeyStack(AppState.stories);
            if (stories.length) {
                framingResult = computeEditorFraming({
                    stories,
                    view: planViewSize(),
                    fixturesByStorey: stories.map((story) => story.fixtures || []),
                    draft: AppState.framingDraft
                });
                framingGroup = buildFramingGroup(framingResult.design, {
                    elevations: stack.map((entry) => entry.elevation),
                    visible: stack.map((entry) => entry.visible)
                });
                scene3D.add(framingGroup);
            }
        } catch (error) {
            console.warn('Framing overlay could not be built', error);
            framingGroup = null;
            framingResult = null;
        }
    }
    refreshFramingPanel();
}

function refreshFramingPanel() {
    const summary = framingEditorSummary(framingResult?.design || null);
    const heading = document.getElementById('framing-summary');
    if (heading) {
        heading.textContent = AppState.framingEnabled
            ? referenceFramingHeadline()
            : 'off';
    }
    const toggle = document.getElementById('framing-check');
    if (toggle) toggle.checked = Boolean(AppState.framingEnabled);
    const headerToggle = document.getElementById('framing-header-toggle');
    if (headerToggle) headerToggle.checked = Boolean(AppState.framingEnabled);
    const rows = document.getElementById('framing-rows');
    if (rows) {
        rows.innerHTML = AppState.framingEnabled
            ? summary.rows.map((row) => `<div class="flex justify-between gap-2"><span class="text-gray-400">${row.label}</span><span class="font-mono">${row.value}</span></div>`).join('')
            : '<p class="text-[10px] text-gray-400">Turn the overlay on to frame the current plan with studs, kings, jacks and headers.</p>';
    }
    const note = document.getElementById('framing-note');
    if (note) {
        if (!AppState.framingEnabled) {
            note.textContent = 'Framing view replaces the finished walls with the stud frame.';
        } else if (!framingResult || framingResult.empty) {
            note.textContent = 'Draw walls on the plan to frame them.';
        } else {
            const errors = framingResult.design.errors;
            note.textContent = `${framingSceneStats(framingGroup).meshes} framing members · ${errors ? `${errors} error${errors === 1 ? '' : 's'}` : 'checks pass'} · 16 in on center`;
        }
    }
}

// The suite's own headline is friendlier than the design object's stack of
// metrics; the panel keeps the short version above the rows.
function referenceFramingHeadline() {
    const storeys = framingResult?.design?.storeys?.length || 0;
    const linear = framingResult?.design?.metrics?.linearM || 0;
    return storeys ? `${storeys} storey${storeys === 1 ? '' : 's'} · ${linear} m` : 'no walls';
}

function toggleFraming(force) {
    AppState.framingEnabled = typeof force === 'boolean' ? force : !AppState.framingEnabled;
    update3D();
}

// ------------------------------------------------------------------
// Systems panel: bid, BIM, deck, electrical, framing, wall
// ------------------------------------------------------------------

// The cross-suite systems are rendered from features/systems.js, which
// imports each system's barrel. Only the open tab is rebuilt on a refresh: the
// bid panel harvests every saved suite, so it is the one panel with real work
// in it and it should not run on every pointer-up.
let activeSystemId = 'bid';

function deckEditorDesign() {
    return AppState.deckDraft?.config
        ? applyPriceBookToDesign('deck', computeDeckDesign(AppState.deckDraft.config))
        : null;
}

function electricalEditorDesign() {
    return AppState.electricalDraft?.config
        ? applyPriceBookToDesign('electrical', computeElectricalDesign(AppState.electricalDraft.config))
        : null;
}

function systemsContext() {
    return {
        bid: {},
        bim: {
            walls: AppState.walls,
            fixtures: AppState.fixtures,
            storeyHeight: storeyConstruction(AppState.stories?.[AppState.currentStoryIndex]).wallHeight
        },
        deck: { design: deckEditorDesign(), draft: AppState.deckDraft || null },
        electrical: { design: electricalEditorDesign(), draft: AppState.electricalDraft || null },
        framing: {
            design: framingResult?.design || null,
            draft: AppState.framingDraft || null,
            enabled: Boolean(AppState.framingEnabled)
        },
        wall: { design: wallCoveringDesign() }
    };
}

const SYSTEM_SEVERITY_CLASS = {
    error: 'text-red-600 dark:text-red-400',
    warn: 'text-amber-600 dark:text-amber-400',
    warning: 'text-amber-600 dark:text-amber-400',
    ok: 'text-emerald-600 dark:text-emerald-400',
    info: 'text-gray-400'
};

function systemsPanelHtml(model) {
    const rows = (model.rows || []).map((row) => `
        <div class="flex justify-between gap-2 py-0.5">
            <span class="text-gray-400">${escapeHtml(row.label)}</span>
            <span class="font-mono text-right">${escapeHtml(row.value)}</span>
        </div>`).join('');
    const checks = (model.checks || []).slice(0, 6).map((check) => `
        <p class="text-[10px] leading-snug ${SYSTEM_SEVERITY_CLASS[check.severity] || 'text-gray-400'}">${escapeHtml(check.label)}: ${escapeHtml(check.message)}</p>`).join('');
    const actions = (model.actions || []).map((action) => (action.kind === 'link'
        ? `<a href="${escapeHtml(action.href)}" class="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:border-primary text-[10px] font-bold">${escapeHtml(action.label)}</a>`
        : `<button type="button" data-system-action="${escapeHtml(action.id)}" class="px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary text-[10px] font-bold">${escapeHtml(action.label)}</button>`)).join('');

    return `
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
            <div class="flex items-start justify-between gap-2">
                <p class="text-[11px] font-bold leading-snug">${escapeHtml(model.headline)}</p>
                <span class="text-[9px] uppercase font-bold ${model.ok ? 'text-emerald-600' : 'text-amber-600'}">${model.empty ? 'empty' : (model.ok ? 'ready' : 'review')}</span>
            </div>
            ${rows ? `<div class="mt-1 divide-y divide-gray-100 dark:divide-gray-800 text-[10px]">${rows}</div>` : ''}
            ${model.detail ? `<p class="text-[10px] text-gray-400 leading-snug mt-1">${escapeHtml(model.detail)}</p>` : ''}
            ${checks ? `<div class="mt-1 space-y-0.5">${checks}</div>` : ''}
            <div class="flex flex-wrap gap-1 mt-2">${actions}</div>
        </div>`;
}

function renderSystemsTabs() {
    const host = document.getElementById('systems-tabs');
    if (!host) return;
    host.innerHTML = STUDIO_SYSTEMS.map((system) => {
        const active = system.id === activeSystemId;
        const tone = active
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:border-primary';
        return `<button type="button" data-system="${system.id}" class="rounded-md border px-1 py-1 text-[10px] font-bold ${tone}" title="${escapeHtml(system.label)} system">${escapeHtml(system.label)}</button>`;
    }).join('');
}

let systemsRefreshTimer = null;

/** Coalesce the refresh a burst of edits would otherwise run per commit. */
function scheduleSystemsRefresh() {
    if (systemsRefreshTimer) clearTimeout(systemsRefreshTimer);
    systemsRefreshTimer = setTimeout(() => {
        systemsRefreshTimer = null;
        refreshSystemsPanel();
    }, 400);
}

function refreshSystemsPanel() {
    const body = document.getElementById('systems-body');
    if (!body) return;
    renderSystemsTabs();

    const system = systemById(activeSystemId) || STUDIO_SYSTEMS[0];
    let model;
    try {
        model = system.panel(systemsContext()[system.id] || {});
    } catch (error) {
        window.reportClientError?.(error, { source: `editor:systems:${system.id}`, kind: 'systems' });
        model = {
            id: system.id,
            label: system.label,
            headline: `${system.label} panel could not be built`,
            rows: [],
            checks: [{ severity: 'error', label: 'Panel', message: error.message }],
            ok: false,
            empty: true,
            detail: 'The rest of the studio is unaffected.',
            actions: [{ id: 'open-suite', label: 'Open suite', kind: 'link', href: system.suite }]
        };
    }

    body.innerHTML = systemsPanelHtml(model);
    const status = document.getElementById('systems-status');
    if (status) {
        status.textContent = model.empty ? 'no design' : (model.ok ? 'checks pass' : 'review');
        status.className = `text-[10px] font-mono ${model.empty ? 'text-gray-400' : (model.ok ? 'text-emerald-600' : 'text-amber-600')}`;
        status.title = `${model.label}: ${model.headline}`;
    }
}

function selectSystemPanel(id) {
    if (!systemById(id)) return activeSystemId;
    activeSystemId = id;
    refreshSystemsPanel();
    return activeSystemId;
}

function downloadTextFile(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
        return;
    }
    fallbackCopy(text);
}

function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } catch { /* the text is still on screen */ }
    area.remove();
}

function handleSystemAction(actionId) {
    const bid = systemById('bid');
    if (actionId === 'framing-toggle') {
        toggleFraming();
        refreshSystemsPanel();
        return true;
    }
    if (actionId === 'bid-refresh') {
        refreshSystemsPanel();
        return true;
    }
    if (actionId === 'bid-csv') {
        const built = bid.snapshot();
        downloadTextFile('bid.csv', bid.csv(built.bid), 'text/csv');
        return true;
    }
    if (actionId === 'bid-proposal') {
        const built = bid.snapshot();
        copyTextToClipboard(bid.proposal(built.bid));
        return true;
    }
    if (actionId === 'bim-refresh') {
        refreshSystemsPanel();
        return true;
    }
    if (actionId === 'bim-csv') {
        // The CSV is written from the same snapshot the panel shows, so the
        // quantity table and the export cannot disagree.
        const bimSystem = systemById('bim');
        const { takeoff } = bimSystem.snapshot(systemsContext().bim);
        if (takeoff.rows.length) downloadTextFile('ifc-takeoff.csv', bimSystem.csv(takeoff), 'text/csv');
        return true;
    }
    return false;
}

// ------------------------------------------------------------------
// Interaction & UI
// ------------------------------------------------------------------

function setupEventListeners() {
    // Systems panel: tabs select a system, buttons run its actions.
    document.getElementById('systems-tabs')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-system]');
        if (button) selectSystemPanel(button.dataset.system);
    });
    document.getElementById('systems-body')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-system-action]');
        if (button) handleSystemAction(button.dataset.systemAction);
    });

    // Canvas events
    blueprintCanvas.addEventListener('pointerdown', onPointerDown);
    blueprintCanvas.addEventListener('pointermove', onPointerMove);
    blueprintCanvas.addEventListener('pointerup', onPointerUp);
    blueprintCanvas.addEventListener('pointercancel', onPointerCancel);
    blueprintCanvas.addEventListener('wheel', onWheel);
    blueprintCanvas.addEventListener('dblclick', onDoubleClick);
    
    // Context menu disable
    blueprintCanvas.addEventListener('contextmenu', e => e.preventDefault());
    
    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return; // Ignore if typing
        // The walk controller owns the keyboard while the walk is running.
        if (planWalk?.active) return;

        // Ctrl/Cmd+D duplicates the selection (before the D delete-tool shortcut).
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            duplicateSelected();
            return;
        }

        switch(e.key.toLowerCase()) {
            case 'w': setTool('wall'); setActiveToolBtn('wall'); break;
            case 'd': setTool('delete'); setActiveToolBtn('delete'); break;
            case 'c': setTool('cutout'); setActiveToolBtn('cutout'); break;
            case 'delete':
            case 'backspace':
                // In the cutout tool, Delete removes a point or the whole hole.
                if (deleteCutoutSelection()) e.preventDefault();
                break;
            case 'escape': 
                AppState.selectedOpeningId = null;
                AppState.selectedVertexIndex = null;
                setTool('select'); 
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active', 'border-primary', 'bg-blue-50', 'text-primary'));
                refreshGizmo();
                draw2D();
                break;
            case 'g': setGizmoMode('translate'); break;
            case 'r': setGizmoMode('rotate'); break;
            case 'l': window.toggleSelectedLock(); break;
            case 'h': window.toggleSelectedVisibility(); break;
            case '1': setViewMode('2d'); break;
            case '2': setViewMode('3d'); break;
            case '3': setViewMode('elevation'); break;
            case 'z':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (e.shiftKey) stateManager.redo();
                    else stateManager.undo();
                    updateUI();
                }
                break;
        }
    });

    // Window Resize
    window.addEventListener('resize', onResize);
    
    // Tools
    document.querySelectorAll('.tool-btn').forEach(btn => {
        if (btn.dataset.tool) { // Skip non-tool buttons like Clear
            btn.addEventListener('click', () => {
                setTool(btn.dataset.tool);
                setActiveBtn(btn, '.tool-btn');
            });
        }
    });
    
    // Custom finish image: applied to the selected wall, or to all walls /
    // floors when the palette has no selection.
    const finishUpload = document.getElementById('finish-upload');
    if (finishUpload) {
        finishUpload.addEventListener('change', async (event) => {
            await applyFinishUpload(event.target.files?.[0]);
            event.target.value = '';
        });
    }

    // Merlot cabinetry dropdown
    const merlotSelect = document.getElementById('merlot-select');
    if (merlotSelect) {
        merlotSelect.addEventListener('change', () => {
            if (!merlotSelect.value) return;
            setTool(merlotSelect.value);
        });
    }

    // Elevation view buttons (3D | Front | Back | Left | Right) and the
    // single-wall stepper that sits beside them.
    document.querySelectorAll('.elevation-btn').forEach((btn) => {
        btn.addEventListener('click', () => setElevationView(btn.dataset.side || null));
    });
    document.getElementById('elevation-prev')?.addEventListener('click', () => stepElevationWall(-1));
    document.getElementById('elevation-next')?.addEventListener('click', () => stepElevationWall(1));
    updateElevationButtons();

    // Shaker cabinetry dropdown
    const shakerSelect = document.getElementById('shaker-select');
    if (shakerSelect) {
        shakerSelect.addEventListener('change', () => {
            if (!shakerSelect.value) return;
            setTool(shakerSelect.value);
        });
    }

    // Items
    document.querySelectorAll('.item-button').forEach(btn => {
        btn.addEventListener('click', () => {
            setTool(btn.dataset.item);
            // Visual feedback handled by CSS active states if needed
        });
    });
    
    // File Upload handling moved to wireUploadModal
}

/**
 * Turn a CAD or site file into plan walls.
 *
 * A DXF already has metres and plan orientation (features/import/dxf.js); a
 * KML/KMZ/GeoJSON export is lon/lat, so it is projected onto local metres and
 * fitted inside the view with north up (features/import/geo.js). Either way the
 * result replaces the traced walls, centred in the plan.
 */
async function drawingWallsFromFile(file) {
    const name = String(file.name || '').toLowerCase();
    const warnings = [];
    let walls = [];

    if (name.endsWith('.dxf')) {
        const plan = dxfToPlan(await file.text(), { view: planViewSize() });
        warnings.push(...plan.warnings);
        walls = plan.walls.map((wall) => new Wall(wall.start.x, wall.start.y, wall.end.x, wall.end.y));
        return { walls, warnings };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder('utf-8').decode(bytes);
    const features = await parseGeoFile({ name, text, bytes });
    if (!features.length) {
        return { walls, warnings: ['No points, lines or polygons were found in that file.'] };
    }

    const view = planViewSize();
    // Real metres, never scaled: a surveyed boundary is a measurement, so the
    // view zooms out to the site rather than the site shrinking to the view.
    const fitted = fitFeaturesToSite(projectFeatures(features).features, {
        width: view.width / SCALE,
        depth: view.height / SCALE,
        fit: false
    });
    for (const entry of fitted.features) {
        for (const ring of entry.rings) {
            if (ring.length < 2) continue; // a lone point has no wall to draw
            const segmentCount = entry.kind === 'polygon' ? ring.length : ring.length - 1;
            for (let index = 0; index < segmentCount; index += 1) {
                const a = ring[index];
                const b = ring[(index + 1) % ring.length];
                // Polygon rings repeat their first point; the closing segment
                // already covers it.
                if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-6) continue;
                walls.push(new Wall(a.x * SCALE, a.z * SCALE, b.x * SCALE, b.z * SCALE));
            }
        }
    }
    if (fitted.scale < 1) warnings.push(`The site was scaled to ${Math.round(fitted.scale * 100)}% to fit the plan.`);
    const extentX = fitted.bounds.width * SCALE;
    const extentY = fitted.bounds.height * SCALE;
    if (extentX > view.width || extentY > view.height) {
        warnings.push('The site is larger than the view; zoom out to see the whole boundary.');
    }
    return { walls, warnings };
}

function wireUploadModal() {
    const modal = document.getElementById('upload-modal');
    const fileInput = document.getElementById('hidden-file-input');
    const btnImage = document.getElementById('upload-image-btn');
    const btnJson = document.getElementById('upload-json-btn');
    const btnAi = document.getElementById('upload-ai-btn');
    const btnOcr = document.getElementById('upload-ocr-btn');
    const btnDxf = document.getElementById('upload-dxf-btn');
    
    if (!modal || !fileInput) return;

    let uploadMode = 'image'; // image | json | ai | ocr | drawing

    const triggerUpload = (mode, accept) => {
        uploadMode = mode;
        fileInput.accept = accept;
        fileInput.click();
    };

    btnImage?.addEventListener('click', () => triggerUpload('image', 'image/*'));
    btnJson?.addEventListener('click', () => triggerUpload('json', '.json'));
    btnAi?.addEventListener('click', () => triggerUpload('ai', 'image/*'));
    btnOcr?.addEventListener('click', () => triggerUpload('ocr', 'image/*'));
    btnDxf?.addEventListener('click', () => triggerUpload('drawing', '.dxf,.kml,.kmz,.geojson'));

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        modal.classList.add('hidden');

        if (uploadMode === 'json') {
            try {
                const data = await StorageManager.importProject(file);
                restoreState(data);
                alert('Project loaded successfully');
            } catch(err) { 
                console.error(err);
                alert('Failed to load project file'); 
            }
        } else if (uploadMode === 'drawing') {
            try {
                const drawing = await drawingWallsFromFile(file);
                if (!drawing.walls.length) {
                    alert(drawing.warnings.join('\n') || 'That file has no linework to import.');
                } else {
                    AppState.planText = null;
                    AppState.planSymbols = null;
                    AppState.backgroundImage = null;
                    AppState.backgroundScale = 1;
                    AppState.offset = { x: 0, y: 0 };
                    AppState.walls = drawing.walls;
                    refreshPlanTextPanel();
                    saveAndSync();
                    // Unit guesses, skipped blocks and site scaling stay visible
                    // instead of being silently rounded away.
                    if (drawing.warnings.length) console.info(drawing.warnings.join('\n'));
                }
            } catch (err) {
                console.error(err);
                alert('That drawing could not be read. Use an ASCII DXF, KML, KMZ or GeoJSON file.');
            }
        } else if (uploadMode === 'image') {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const img = new Image();
                img.onload = () => {
                    // A new plan invalidates the previous plan's readings.
                    AppState.planText = null;
                    AppState.planSymbols = null;
                    AppState.backgroundImage = img;
                    AppState.backgroundScale = 1.0;
                    refreshPlanTextPanel();
                    draw2D();
                    // Open-source pass on every image upload: runPlanOcr
                    // reads plan words (Tesseract.js) + plan symbols (local
                    // reader) together, so one upload yields both readings
                    // at their origins.
                    runPlanOcr(file);
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        } else if (uploadMode === 'ocr') {
            // Load the plan for reference, then read words (Tesseract.js,
            // open source) + symbols (local reader) in one pass.
            const reader = new FileReader();
            reader.onload = (evt) => {
                const img = new Image();
                img.onload = () => {
                    AppState.planText = null;
                    AppState.planSymbols = null;
                    AppState.backgroundImage = img;
                    AppState.backgroundScale = 1.0;
                    draw2D();
                    refreshPlanTextPanel();
                    runPlanOcr(file);
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        } else if (uploadMode === 'ai') {
            // AI Processing
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-4 right-4 bg-purple-600 text-white px-6 py-3 rounded-lg shadow-xl z-50 flex items-center gap-3';
            toast.innerHTML = '<span class="animate-spin">⏳</span> Processing Floorplan...';
            document.body.appendChild(toast);

            try {
                const processor = new FloorPlanProcessor();
                const result = await processor.processImage(file);
                
                if (result && result.walls) {
                    // Set as background first for reference
                    const img = new Image();
                    img.onload = () => {
                        AppState.planText = null;
                        AppState.planSymbols = null;
                        AppState.backgroundImage = img;
                        
                        // Scale walls to fit canvas reasonable size (approx 20m width)
                        // This logic centers and scales the result to match the editor's coordinate system
                        const targetWidth = 20 * SCALE; // 20 meters
                        const scanScale = targetWidth / result.width;
                        AppState.backgroundScale = scanScale;

                        // The background is centred in the plan, so the scanned
                        // walls get the same frame (see planBackgroundRect()).
                        const offsetX = (result.width * scanScale) / 2;
                        const offsetY = (result.height * scanScale) / 2;
                        const frame = planViewSize();
                        const frameX = frame.width / 2;
                        const frameY = frame.height / 2;

                        AppState.walls = [];
                        result.walls.forEach(contour => {
                            for(let i=1; i<contour.length; i++) {
                                const p1 = contour[i-1];
                                const p2 = contour[i];
                                AppState.walls.push(new Wall(
                                    p1[0] * scanScale - offsetX + frameX, 
                                    p1[1] * scanScale - offsetY + frameY, 
                                    p2[0] * scanScale - offsetX + frameX, 
                                    p2[1] * scanScale - offsetY + frameY
                                ));
                            }
                        });

                        toast.remove();
                        saveAndSync();
                        alert(`AI Scan Complete: ${AppState.walls.length} walls detected.`);
                        // Read the same image for room names and dimensions.
                        runPlanOcr(file);
                    };
                    img.src = URL.createObjectURL(file);
                }
            } catch (err) {
                console.error(err);
                toast.remove();
                alert('AI processing failed. Try manual tracing mode.');
            }
        }
        
        // Reset input
        fileInput.value = '';
    });
}

function setTool(tool) {
    // A saved stair preset only applies to the tool it was armed for; choosing
    // any other item drops it.
    if (AppState.pendingStairPreset && tool !== AppState.pendingStairPreset.itemType) {
        AppState.pendingStairPreset = null;
    }
    AppState.currentTool = tool;
    AppState.drag = null;
    AppState.groupDrag = null;
    AppState.selectedFixture = null;
    // Switching tools abandons an in-progress wall so the preview can never stick.
    AppState.isDrawing = false;
    AppState.wallStart = null;
    // Leaving the cutout tool drops its in-progress rectangle and handles, but
    // the holes themselves stay on the storey.
    if (tool !== 'cutout') {
        AppState.cutoutDraft = null;
        AppState.openingDrag = null;
        AppState.selectedVertexIndex = null;
        AppState.selectedOpeningId = null;
    }
    refreshGizmo();
    console.log('Tool set to:', tool);
}

function setActiveBtn(btn, selector) {
    document.querySelectorAll(selector).forEach(b => b.classList.remove('active', 'border-primary', 'bg-blue-50', 'text-primary'));
    btn.classList.add('active', 'border-primary', 'bg-blue-50', 'text-primary');
}

function setActiveToolBtn(toolName) {
    const btn = document.querySelector(`.tool-btn[data-tool="${toolName}"]`);
    if (btn) setActiveBtn(btn, '.tool-btn');
}

function onResize() {
    const parent = blueprintCanvas.parentElement;
    planView = {
        width: Math.max(parent.clientWidth, 1),
        height: Math.max(parent.clientHeight, 1)
    };
    // Room labels are stored in plan pixels, so they move with the viewport.
    // draw2D() sizes the backing store from planView() and the pixel ratio.
    refreshPlanDerived();
    draw2D();
    
    const container3D = document.getElementById('render-3d-view');
    if (renderer3D && container3D) {
        // The pixel ratio can change when the window moves between monitors.
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        if (renderer3D.getPixelRatio() !== pixelRatio) renderer3D.setPixelRatio(pixelRatio);
        renderer3D.setSize(container3D.clientWidth, container3D.clientHeight);
        camera3D.aspect = container3D.clientWidth / container3D.clientHeight;
        camera3D.updateProjectionMatrix();
        // The ortho frustum is derived from the viewport, so it has to be
        // reframed whenever the size changes.
        if (AppState.elevationSide) updateElevationCamera();
        labKit?.resize(container3D.clientWidth, container3D.clientHeight);
        renderLoop?.requestRender();
    }
}

/** Backwards-compatible flip between the plan and the 3D orbit view. */
function toggleView() {
    setViewMode(AppState.viewMode === '2d' ? '3d' : '2d');
}

/** Restored walls/fixtures/openings, skipping single bad entries.
 *  One corrupt wall in storage must never abort the whole boot (and with it
 *  every button and the wall tool). */
function cleanRestoredWalls(walls) {
    if (!Array.isArray(walls)) return [];
    const out = [];
    for (const wall of walls) {
        try {
            const restored = Wall.fromJSON(wall);
            const pts = [restored?.start?.x, restored?.start?.y, restored?.end?.x, restored?.end?.y];
            if (pts.every(Number.isFinite)) out.push(restored);
        } catch { /* skip one bad wall, keep the plan */ }
    }
    return out;
}

function cleanRestoredFixtures(fixtures) {
    if (!Array.isArray(fixtures)) return [];
    const out = [];
    for (const fixture of fixtures) {
        try {
            const restored = ItemFactory.fromJSON(fixture);
            if (restored && Number.isFinite(restored.x) && Number.isFinite(restored.y)) out.push(restored);
        } catch { /* skip one bad fixture, keep the plan */ }
    }
    return out;
}

function cleanRestoredOpenings(openings) {
    try {
        return cloneOpenings(Array.isArray(openings) ? openings : []);
    } catch {
        return [];
    }
}

function restoreState(data) {
    // Schema guard (feature 28): old files are migrated, newer ones refused.
    const migration = migrateProject(data);
    if (migration.error) {
        console.warn('Project not restored:', migration.error);
        return;
    }
    if (migration.migrated && data.version != null) {
        console.info(`Project migrated from schema ${migration.from} to ${PROJECT_SCHEMA_VERSION}`);
    }

    const project = migration.project;

    // Storeys (studio feature 41): older files and undo snapshots only carry
    // the active arrays, which become the single ground floor.
    const rawStories = Array.isArray(project.stories) && project.stories.length
        ? project.stories
        : null;

    // Every storey carries its 96 in wall + 8 in floor parts so a saved project
    // restores the same pitch, and its cutouts so the holes survive undo/load.
    const stories = rawStories
        ? rawStories.map((story, index) => {
            const construction = storeyConstruction(story);
            return {
                id: story.id || `storey_${index + 1}`,
                name: story.name || `Floor ${index + 1}`,
                wallHeight: construction.wallHeight,
                floorDepth: construction.floorDepth,
                height: construction.pitch,
                visible: story.visible !== false,
                walls: cleanRestoredWalls(story.walls),
                fixtures: cleanRestoredFixtures(story.fixtures),
                openings: cleanRestoredOpenings(story.openings)
            };
        })
        : [{
            id: 'storey_ground',
            name: 'Ground floor',
            ...constructionOptions(),
            visible: true,
            walls: cleanRestoredWalls(project.walls),
            fixtures: cleanRestoredFixtures(project.fixtures),
            openings: []
        }];

    const storyIndex = Math.min(Math.max(Number(project.currentStoryIndex) || 0, 0), stories.length - 1);
    AppState.stories = stories;
    AppState.currentStoryIndex = storyIndex;
    AppState.walls = stories[storyIndex].walls;
    AppState.fixtures = stories[storyIndex].fixtures;
    AppState.selectedFixture = null;
    AppState.selectedWallId = null;
    AppState.drag = null;
    AppState.groupDrag = null;
    // Clone the maps: a snapshot hands back its own objects, and undoing must
    // not let later edits reach into the stored history.
    AppState.fixtureStyles = JSON.parse(JSON.stringify(project.fixtureStyles || {}));
    AppState.roomMaterials = JSON.parse(JSON.stringify(
        project.roomMaterials && typeof project.roomMaterials === 'object' ? project.roomMaterials : {}
    ));

    // Shell and grid settings ride along with the project.
    setCeiling(AppState, project.showCeiling);
    setRoof(AppState, project.showRoof);
    AppState.roofConfig = {
        ...AppState.roofConfig,
        ...(project.roofConfig && typeof project.roofConfig === 'object' ? project.roofConfig : {})
    };
    AppState.gridSize = project.gridSize;
    syncShellToggles(document, AppState);
    const gridSelect = document.getElementById('grid-size-select');
    if (gridSelect) gridSelect.value = String(gridCmFromPixels(AppState.gridSize) || 0);

    refreshPlanDerived();
    refreshStoreyPanel();
    refreshRoomFloorPanel();
    refreshFinishPanel();
    refreshWallCoveringPanel();
    stateManager.saveState(); // Reset history with new state
    draw2D();
    update3D();
    refreshGizmo();
    syncSelectionPanels();
}

function updateUI() {
    refreshPlanDerived();
    draw2D();
    update3D();
    syncSelectionPanels();
    saveToStorage();
}

let dragUpdateTimer = null;

/** Rebuild the 3D preview while dragging, throttled so CSG does not run per pixel. */
function scheduleDragUpdate() {
    if (dragUpdateTimer) return;
    dragUpdateTimer = setTimeout(() => {
        dragUpdateTimer = null;
        update3D();
    }, 60);
}

function saveAndSync({ tag = null, coalesce } = {}) {
    // Tagged saves coalesce inspector/typing bursts into one undo step (27).
    if (tag) saveStateTagged(stateManager, tag, coalesce ? { coalesce } : undefined);
    else stateManager.saveState();

    // Room labels/metrics are derived from the plan, not stored in it.
    refreshPlanDerived();
    update3D();
    draw2D();
    syncSelectionPanels();
    saveToStorage();
    scheduleSystemsRefresh();
}

/** The full project payload, stamped with the current schema version. */
function projectPayload() {
    ensureStoreyModel();
    syncActiveStorey(AppState);

    return stampProject({
        walls: AppState.walls,
        fixtures: AppState.fixtures,
        fixtureStyles: AppState.fixtureStyles,
        showCeiling: AppState.showCeiling,
        showRoof: AppState.showRoof,
        roofConfig: { ...AppState.roofConfig },
        gridSize: AppState.gridSize,
        // Studio features 41-42: every storey plus the floor finishes travel
        // with the project, so the browser projects list restores them.
        stories: AppState.stories.map((story) => ({
            id: story.id,
            name: story.name,
            wallHeight: story.wallHeight,
            floorDepth: story.floorDepth,
            height: story.height,
            visible: story.visible !== false,
            walls: (story.walls || []).map((wall) => (wall.toJSON ? wall.toJSON() : wall)),
            fixtures: (story.fixtures || []).map((fixture) => (fixture.toJSON ? fixture.toJSON() : fixture)),
            openings: cloneOpenings(story.openings || [])
        })),
        currentStoryIndex: AppState.currentStoryIndex || 0,
        roomMaterials: AppState.roomMaterials
    });
}

function saveToStorage() {
    const payload = projectPayload();
    if (!autosave) {
        if (!StorageManager.saveProject('autosave', payload)) reportSaveFailure();
        return;
    }
    // Debounced + dirty-only (feature 29).
    autosave.schedule(payload);
}

/** A failed local write is shown once per session, with an export escape hatch. */
let saveFailureShown = false;
function reportSaveFailure() {
    window.reportClientError?.(
        new Error('Could not save the project to local storage'),
        { source: 'editor:autosave', kind: 'save' }
    );
    if (saveFailureShown || !document.body) return;
    saveFailureShown = true;
    const notice = document.createElement('div');
    notice.id = 'save-failure-notice';
    notice.setAttribute('role', 'alert');
    notice.className = 'fixed bottom-4 left-4 z-50 max-w-sm rounded-lg bg-red-700 px-4 py-3 text-white shadow-xl';
    notice.innerHTML = `
        <strong class="block text-sm font-bold">Project not saved</strong>
        <span class="text-xs">Local storage is full or blocked. Export the project to keep your work.</span>
        <div class="mt-2 flex gap-2">
            <button type="button" class="rounded bg-white/20 px-2 py-1 text-xs font-bold" id="save-failure-export">Export</button>
            <button type="button" class="rounded px-2 py-1 text-xs" aria-label="Dismiss">Dismiss</button>
        </div>
    `;
    notice.querySelector('#save-failure-export')?.addEventListener('click', () => {
        try { exportProject(); } catch { /* the export path reports its own errors */ }
    });
    notice.querySelector('button[aria-label="Dismiss"]')?.addEventListener('click', () => notice.remove());
    document.body.appendChild(notice);
}

function clearProject() {
    AppState.stories = [{
        id: 'storey_ground',
        name: 'Ground floor',
        ...constructionOptions(),
        visible: true,
        walls: [],
        fixtures: [],
        openings: []
    }];
    AppState.selectedOpeningId = null;
    AppState.selectedVertexIndex = null;
    AppState.cutoutDraft = null;
    AppState.openingDrag = null;
    AppState.currentStoryIndex = 0;
    AppState.walls = AppState.stories[0].walls;
    AppState.fixtures = AppState.stories[0].fixtures;
    AppState.roomMaterials = {};
    AppState.selectedFixture = null;
    AppState.selectedWallId = null;
    AppState.backgroundImage = null;
    AppState.planText = null;
    AppState.fixtureStyles = {};
    refreshPlanTextPanel();
    refreshStoreyPanel();
    saveAndSync();
}

function exportProject() {
    StorageManager.exportProject(projectPayload());
}

async function export3D(format) {
    if (!scene3D) return;
    try {
        // One exporter for glTF, GLB and OBJ (feature 37).
        const result = await exportScene(scene3D, format);
        downloadExport(result, 'project');
    } catch (error) {
        console.error('Scene export failed', error);
        alert(`Export failed: ${error?.message || error}`);
    }
}

// ------------------------------------------------------------------
// Stair and landscape suite panels
// ------------------------------------------------------------------

let stairPanel = null;
let landscapePanel = null;

function activeStoreyHeight() {
    return AppState.stories?.[AppState.currentStoryIndex]?.height || WALL_HEIGHT;
}

/** Height of the active storey's floor above the ground floor, in metres. */
function activeStoreyElevation() {
    return storeyStack(AppState.stories || [])[AppState.currentStoryIndex || 0]?.elevation || 0;
}

/** Perf HUD: the labs FPS dashboard as a 3D-view status chip (docs/audit.md §7).
 *  Reads the dirty render loop (fps/frames) plus three.js renderer info
 *  (draw calls/triangles of the last frame) and optional JS heap. Null-safe:
 *  a failed renderer or a hidden 3D view hides the chip instead of throwing. */
let perfCache = null;
function perfReading() {
    try {
        const stats = renderLoop?.stats || null;
        const info = renderer3D?.info;
        if (!stats || !info) return null;
        const heap = (typeof performance !== 'undefined' && performance.memory)
            ? performance.memory.usedJSHeapSize : null;
        return {
            fps: stats.fps || 0,
            frames: stats.frames || 0,
            calls: info.render?.calls ?? 0,
            tris: info.render?.triangles ?? 0,
            heapMB: heap == null ? null : Math.round(heap / 1048576)
        };
    } catch {
        return null;
    }
}
function refreshPerfHud() {
    const el = document.getElementById('perf-hud');
    if (!el) return perfCache;
    const on = AppState.viewMode === '3d' && abilitiesState().perfHud !== false && !render3DFailed;
    const reading = on ? perfReading() : null;
    perfCache = reading;
    if (!reading) {
        el.classList.add('hidden');
        return null;
    }
    el.classList.remove('hidden');
    const tris = reading.tris >= 1000 ? `${(reading.tris / 1000).toFixed(1)}k` : String(reading.tris);
    el.textContent = `${reading.fps} fps · ${reading.calls} calls · ${tris} tris${reading.heapMB == null ? '' : ` · ${reading.heapMB} MB`}`;
    return reading;
}

/** Legacy app.html Walk button: first person, eye level, WASD + mouse look. */
function togglePlanWalk() {
    if (!planWalk) return false;
    if (planWalk.active) return planWalk.exit();
    if (AppState.viewMode !== '3d') setViewMode('3d');
    AppState.selectedFixture = null;
    AppState.selectedWallId = null;
    refreshGizmo();
    syncSelectionPanels();
    return planWalk.enter();
}

function stairPanelApi() {
    if (!stairPanel) {
        stairPanel = createStairPanel({
            getState: () => AppState,
            getStoreyHeight: activeStoreyHeight,
            getView: () => (planViewSize()),
            getCamera: () => camera3D,
            getRenderer: () => renderer3D,
            getControls: () => controls3D,
            getRenderLoop: () => renderLoop,
            planCenter,
            save: () => saveAndSync(),
            setViewMode: (mode) => setViewMode(mode),
            createItem: (type, x, y, rotation) => ItemFactory.create(type, x, y, rotation)
        });
    }
    return stairPanel;
}

function landscapePanelApi() {
    if (!landscapePanel) {
        landscapePanel = createLandscapePanel({
            getState: () => AppState,
            planCenter,
            save: () => saveAndSync(),
            createItem: (type, x, y, rotation) => ItemFactory.create(type, x, y, rotation)
        });
    }
    return landscapePanel;
}

function refreshStairPanel() {
    return stairPanelApi().refresh();
}

function applyStairField(key, value) {
    return stairPanelApi().applyField(key, value);
}

function addStairFromPanel() {
    return stairPanelApi().add();
}

// ------------------------------------------------------------------
// Saved stair presets (features/stairs/presets.js)
// ------------------------------------------------------------------

/** Merge a stair config into an item and re-size it, landings included. */
function applyStairConfig(item, config) {
    if (!item || !config) return item;
    item.stair = { ...(item.stair || {}), ...config };
    sizeStairItem(item, activeStoreyHeight());
    return item;
}

/** Render the "My stairs" palette section from localStorage. */
function refreshStairPresetPalette() {
    const container = document.getElementById('stair-preset-items');
    if (!container) return [];
    const presets = loadStairPresets();
    const count = document.getElementById('stair-preset-count');
    if (count) count.textContent = presets.length ? String(presets.length) : '';
    // Re-rendering must not pop the section open after the user collapsed it.
    const collapsed = container.classList.contains('hidden');

    if (!presets.length) {
        container.className = 'mt-1';
        container.innerHTML = '<p class="text-[10px] text-gray-400 leading-snug">Select a stair, then use the bookmark in the Stair design panel to save it here.</p>';
        if (collapsed) container.classList.add('hidden');
        return presets;
    }

    container.className = 'grid grid-cols-3 gap-2 mt-1';
    if (collapsed) {
        container.classList.add('hidden');
        container.classList.remove('grid');
    }
    container.innerHTML = presets.map((preset) => `
        <div class="relative group">
            <button class="item-button w-full flex flex-col items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onclick="window.useStairPreset('${escapeHtml(preset.id)}')" title="${escapeHtml(`${preset.name} — ${presetSummary(preset)}`)}">
                <span class="material-symbols-outlined text-gray-600 dark:text-gray-300">stairs</span>
                <span class="text-[10px] mt-1 text-center leading-tight">${escapeHtml(preset.name)}</span>
            </button>
            <button class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-red-500 hidden group-hover:flex group-focus-within:flex items-center justify-center" onclick="event.stopPropagation(); window.removeStairPreset('${escapeHtml(preset.id)}')" title="Remove preset">
                <span class="material-symbols-outlined text-[10px]">close</span>
            </button>
        </div>`).join('');
    return presets;
}

function saveSelectedStairPreset(name = null) {
    const item = stairPanelApi().selected;
    if (!item) {
        alert('Select a stair in the plan first, then save it as a preset.');
        return null;
    }
    const suggested = presetNameFor(item.stair || {});
    const chosen = name || window.prompt('Save this stair as', suggested);
    if (!chosen) return null;

    const preset = saveStairPreset({
        name: chosen,
        stair: item.stair,
        itemType: item.type,
        label: item.metadata?.label || null,
        color: AppState.fixtureStyles?.[item.id]?.color || null
    });
    if (!preset) return null;

    refreshStairPresetPalette();
    const status = document.getElementById('stair-preset-status');
    if (status) status.textContent = `Saved “${preset.name}” to My stairs`;
    return preset;
}

/** Arm the stair tool with a preset; the next plan click places it once. */
function useStairPreset(id) {
    const preset = getStairPreset(id);
    if (!preset) return null;
    setTool(preset.itemType || 'stair');
    AppState.pendingStairPreset = preset;
    AppState.stairDraft = { ...preset.stair };
    refreshStairPanel();
    const status = document.getElementById('stair-preset-status');
    if (status) status.textContent = `Click the plan to place “${preset.name}”`;
    return preset;
}

function exportStairTakeoff() {
    return stairPanelApi().exportTakeoff();
}

function toggleStairWalk() {
    return stairPanelApi().toggleWalk();
}

function currentStairDesign() {
    return stairPanelApi().design();
}

function currentStairAssembly() {
    return stairPanelApi().assembly();
}

function refreshLandscapePanel() {
    return landscapePanelApi().refresh();
}

function applyLandscapeField(key, value) {
    return landscapePanelApi().applyField(key, value);
}

function addLandscapeFromPanel() {
    return landscapePanelApi().add();
}

function currentWaterDesign() {
    return landscapePanelApi().design();
}
