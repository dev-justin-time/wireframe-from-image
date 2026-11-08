import * as THREE from 'three';

/**
 * The ability registry behind the editor's "Abilities" panel.
 *
 * Every entry is a real, self-contained capability: toggles flip a flag the
 * renderer/plan reads, actions mutate the plan through the host. The list is the
 * single source of truth for the panel, so adding an ability is one entry.
 */
export const ABILITY_DEFAULTS = {
    // Plan overlays
    grid: true,
    axes: true,
    dimensions: true,
    areas: false,
    north: false,
    scaleBar: false,
    itemLabels: false,
    itemDims: false,
    doorArcs: true,
    windowMarks: true,
    wallHatch: false,
    halo: true,
    showHidden: true,
    vertices: false,
    ruler: false,
    coords: false,
    legend: false,
    frame: false,
    // Snapping / preview
    gridSnap: true,
    wallSnap: true,
    joinSnap: true,
    collisionWarn: false,
    autoRotateToWall: false,
    ghostPreview: true,
    // 3D
    wireframe3D: false,
    grid3D: false,
    axes3D: false,
    shadows3D: true,
    fog3D: false,
    turntable: false,
    hideWalls3D: false,
    perfHud: true,
    // Feature kit (features/ folder)
    dimensionChains: false,
    roomLabels: true,
    liftMarkers: true,
    snapGuides: true,
    elevationHeights: true,
    // Advanced kit (features/advanced)
    collisionDetect: true,
    placementWarnings: true,
    livePreview: true,
    elevationDims: true,
    alignDepth: false,
    insideCorners: false,
    sectionBox: false,
    walkthrough: false,
    // Studio kit (features/studio)
    roomFloors: true,
    comments: false,
    dirtyRender: true,
    layoutCheck: true,
    // Lab kit (features/lab)
    bloom: false,
    depthOfField: false,
    vignette: false,
    springSelection: false,
    instanceField: false,
    productAutoRotate: false,
    productShake: false
};

const PLAN_GROUP = 'Plan overlays';
const SNAP_GROUP = 'Snapping';
const ITEM_GROUP = 'Item actions';
const PLAN_ACTIONS = 'Plan actions';
const THREE_GROUP = '3D & export';
const FEATURE_GROUP = 'Feature kit';
const ADVANCED_GROUP = 'Advanced';
const STUDIO_GROUP = 'Studio';
const LAB_GROUP = 'Lab';

/** Small helper so a toggle entry is one line. */
const toggleAbility = (id, label, group, key = id) => ({
    id,
    label,
    group,
    kind: 'toggle',
    key,
    run(state) {
        state[key] = !state[key];
    }
});

const actionAbility = (id, label, group, handler) => ({
    id,
    label,
    group,
    kind: 'action',
    run(state, host) {
        return handler(state, host);
    }
});

export function createAbilityList() {
    const list = [
        // --- Plan overlays -------------------------------------------------
        toggleAbility('grid', 'Grid', PLAN_GROUP),
        toggleAbility('axes', 'Origin axes', PLAN_GROUP),
        toggleAbility('dimensions', 'Wall dimensions', PLAN_GROUP),
        toggleAbility('areas', 'Room area', PLAN_GROUP),
        toggleAbility('north', 'North arrow', PLAN_GROUP),
        toggleAbility('scaleBar', 'Scale bar', PLAN_GROUP),
        toggleAbility('itemLabels', 'Item labels', PLAN_GROUP),
        toggleAbility('itemDims', 'Item sizes', PLAN_GROUP),
        toggleAbility('doorArcs', 'Door swings', PLAN_GROUP),
        toggleAbility('windowMarks', 'Window glazing', PLAN_GROUP),
        toggleAbility('wallHatch', 'Wall hatching', PLAN_GROUP),
        toggleAbility('halo', 'Selection halo', PLAN_GROUP),
        toggleAbility('showHidden', 'Hidden ghosts', PLAN_GROUP),
        toggleAbility('vertices', 'Wall handles', PLAN_GROUP),
        toggleAbility('ruler', 'Ruler tool', PLAN_GROUP),
        toggleAbility('coords', 'Cursor coordinates', PLAN_GROUP),
        toggleAbility('legend', 'Legend', PLAN_GROUP),
        toggleAbility('frame', 'Plan border', PLAN_GROUP),

        // --- Snapping ------------------------------------------------------
        toggleAbility('gridSnap', 'Snap to grid', SNAP_GROUP),
        toggleAbility('wallSnap', 'Snap to wall face', SNAP_GROUP),
        toggleAbility('joinSnap', 'Join wall corners', SNAP_GROUP),
        toggleAbility('collisionWarn', 'Overlap warning', SNAP_GROUP),
        toggleAbility('autoRotateToWall', 'Turn to wall', SNAP_GROUP),
        toggleAbility('ghostPreview', 'Placement ghost', SNAP_GROUP),

        // --- Item actions --------------------------------------------------
        actionAbility('rotateCW', 'Rotate 90° right', ITEM_GROUP, (state, host) => host.rotateSelection(Math.PI / 2)),
        actionAbility('rotateCCW', 'Rotate 90° left', ITEM_GROUP, (state, host) => host.rotateSelection(-Math.PI / 2)),
        actionAbility('mirror', 'Mirror item', ITEM_GROUP, (state, host) => host.mirrorSelection()),
        actionAbility('nudgeRight', 'Nudge right 10 cm', ITEM_GROUP, (state, host) => host.nudgeSelection(0.1, 0)),
        actionAbility('nudgeLeft', 'Nudge left 10 cm', ITEM_GROUP, (state, host) => host.nudgeSelection(-0.1, 0)),
        actionAbility('duplicate', 'Duplicate item', ITEM_GROUP, (state, host) => host.duplicateSelection()),
        actionAbility('alignX', 'Align left edges', ITEM_GROUP, (state, host) => host.alignSelection('left')),
        actionAbility('distributeX', 'Distribute evenly', ITEM_GROUP, (state, host) => host.distributeSelection()),
        actionAbility('lockAll', 'Lock / unlock all', ITEM_GROUP, (state, host) => host.toggleLockAll()),
        actionAbility('hideAll', 'Hide / show all', ITEM_GROUP, (state, host) => host.toggleHideAll()),
        actionAbility('deleteHidden', 'Delete hidden items', ITEM_GROUP, (state, host) => host.deleteHidden()),
        actionAbility('resetElevation', 'Reset elevations', ITEM_GROUP, (state, host) => host.resetElevations()),
        actionAbility('arrayDuplicate', 'Array duplicate ×3', ITEM_GROUP, (state, host) => host.arrayDuplicateSelection()),
        actionAbility('copyItem', 'Copy item', ITEM_GROUP, (state, host) => host.copySelection()),
        actionAbility('pasteItem', 'Paste item', ITEM_GROUP, (state, host) => host.pasteSelection()),
        actionAbility('flipHorizontal', 'Flip item', ITEM_GROUP, (state, host) => host.flipSelection()),
        actionAbility('repeatRun', 'Repeat along run ×3', ITEM_GROUP, (state, host) => host.repeatSelection()),
        actionAbility('lockAxisX', 'Lock X axis', ITEM_GROUP, (state, host) => host.toggleAxisLock('x')),
        actionAbility('lockAxisZ', 'Lock Z axis', ITEM_GROUP, (state, host) => host.toggleAxisLock('z')),

        // --- Plan actions --------------------------------------------------
        actionAbility('snapWallsToGrid', 'Snap walls to grid', PLAN_ACTIONS, (state, host) => host.snapWallsToGrid()),
        actionAbility('centerPlan', 'Center plan', PLAN_ACTIONS, (state, host) => host.centerPlan()),
        actionAbility('resetWallHeights', 'Reset wall heights', PLAN_ACTIONS, (state, host) => host.resetWallHeights()),
        actionAbility('cycleWallThickness', 'Cycle wall thickness', PLAN_ACTIONS, (state, host) => host.cycleWallThickness()),
        actionAbility('removeShortWalls', 'Remove stubs (<20 cm)', PLAN_ACTIONS, (state, host) => host.removeShortWalls()),

        // --- 3D & export ---------------------------------------------------
        toggleAbility('wireframe3D', 'Wireframe 3D', THREE_GROUP),
        toggleAbility('grid3D', '3D grid', THREE_GROUP),
        toggleAbility('axes3D', '3D axes', THREE_GROUP),
        toggleAbility('shadows3D', 'Shadows', THREE_GROUP),
        toggleAbility('fog3D', 'Fog', THREE_GROUP),
        toggleAbility('turntable', 'Turntable', THREE_GROUP),
        toggleAbility('hideWalls3D', 'Hide walls in 3D', THREE_GROUP),
        toggleAbility('perfHud', 'Perf HUD (fps/calls/tris)', THREE_GROUP),
        actionAbility('cutlistCSV', 'Cut-list CSV', THREE_GROUP, (state, host) => host.exportCutList()),
        actionAbility('savePreset', 'Save ability preset', THREE_GROUP, (state, host) => host.savePreset()),
        actionAbility('loadPreset', 'Load ability preset', THREE_GROUP, (state, host) => host.loadPreset()),

        // --- Feature kit ----------------------------------------------------
        toggleAbility('dimensionChains', 'Dimension chains', FEATURE_GROUP),
        toggleAbility('roomLabels', 'Room labels', FEATURE_GROUP),
        toggleAbility('liftMarkers', 'Lifted-piece markers', FEATURE_GROUP),
        toggleAbility('snapGuides', 'Snap guides', FEATURE_GROUP),
        toggleAbility('elevationHeights', 'Elevation heights', FEATURE_GROUP),

        // --- Advanced kit ---------------------------------------------------
        toggleAbility('collisionDetect', 'Collision detection', ADVANCED_GROUP),
        toggleAbility('placementWarnings', 'Placement warnings', ADVANCED_GROUP),
        toggleAbility('livePreview', 'Live 3D drag preview', ADVANCED_GROUP),
        toggleAbility('elevationDims', 'Elevation dimensions', ADVANCED_GROUP),
        toggleAbility('alignDepth', 'Snap depth to run', ADVANCED_GROUP),
        toggleAbility('insideCorners', 'Snap to inside corners', ADVANCED_GROUP),
        toggleAbility('sectionBox', 'Section box', ADVANCED_GROUP),
        toggleAbility('walkthrough', 'Walkthrough agent', ADVANCED_GROUP),
        actionAbility('groupRun', 'Group run', ADVANCED_GROUP, (state, host) => host.groupSelection()),
        actionAbility('ungroupRun', 'Ungroup', ADVANCED_GROUP, (state, host) => host.ungroupSelection()),
        actionAbility('alignDepthAction', 'Align depth now', ADVANCED_GROUP, (state, host) => host.alignDepthSelection()),
        actionAbility('cornerAction', 'Seat in corner', ADVANCED_GROUP, (state, host) => host.snapCornerSelection()),
        actionAbility('exportGLBAction', 'Export GLB', ADVANCED_GROUP, (state, host) => host.exportGLB()),
        actionAbility('startARAction', 'Place in AR', ADVANCED_GROUP, (state, host) => host.startAR()),

        // --- Studio kit -----------------------------------------------------
        toggleAbility('roomFloors', 'Per-room floor materials', STUDIO_GROUP),
        toggleAbility('comments', 'Comment pins', STUDIO_GROUP),
        toggleAbility('dirtyRender', 'Dirty-flag rendering', STUDIO_GROUP),
        toggleAbility('layoutCheck', 'NKBA kitchen checks', STUDIO_GROUP),
        actionAbility('newStoreyAction', 'Add storey', STUDIO_GROUP, (state, host) => host.addNewStorey()),
        actionAbility('analyzeKitchenAction', 'Check kitchen layout', STUDIO_GROUP, (state, host) => host.analyzeKitchenLayout()),
        actionAbility('suggestRunAction', 'Suggest cabinet run', STUDIO_GROUP, (state, host) => host.suggestKitchenRun()),
        actionAbility('manufacturingCSVAction', 'Manufacturing CSV', STUDIO_GROUP, (state, host) => host.exportManufacturing('csv')),
        actionAbility('manufacturingDXFAction', 'Manufacturing DXF', STUDIO_GROUP, (state, host) => host.exportManufacturing('dxf')),
        actionAbility('saveNamedProjectAction', 'Save named project', STUDIO_GROUP, (state, host) => host.saveNamedProjectPrompt()),

        // --- Lab kit (features/lab) ---------------------------------------
        toggleAbility('bloom', 'Bloom', LAB_GROUP),
        toggleAbility('depthOfField', 'Depth of field', LAB_GROUP),
        toggleAbility('vignette', 'Vignette', LAB_GROUP),
        toggleAbility('springSelection', 'Spring selection', LAB_GROUP),
        toggleAbility('instanceField', 'GPU prop field', LAB_GROUP),
        toggleAbility('productAutoRotate', 'Auto-rotate placed product', LAB_GROUP),
        toggleAbility('productShake', 'Shake product', LAB_GROUP),
        actionAbility('webgpuPreview', 'WebGPU preview', LAB_GROUP, (state, host) => host.openWebGPUPreview()),
        actionAbility('exportGLTFAction', 'Export glTF', LAB_GROUP, (state, host) => host.exportGLTF()),
        actionAbility('exportOBJAction', 'Export OBJ', LAB_GROUP, (state, host) => host.exportOBJ())
    ];

    return list;
}

export function createSceneAbilities(host) {
    const state = { ...ABILITY_DEFAULTS };
    const list = createAbilityList();
    const byId = new Map(list.map((ability) => [ability.id, ability]));

    return {
        list,
        state,
        get count() {
            return list.length;
        },
        isOn(id) {
            return Boolean(state[id]);
        },
        toggle(id) {
            const ability = byId.get(id);
            if (!ability) return { ok: false, reason: 'unknown ability' };
            const result = ability.run(state, host);
            host.refresh();
            return { ok: true, id, state: state[id], result };
        },
        run(id) {
            return this.toggle(id);
        }
    };
}

/**
 * Applies the 3D ability flags to a live scene. Called after every rebuild, so
 * toggles survive the engine replacing its meshes.
 */
export function apply3DAbilities({ scene, renderer, controls }, state, helpers = {}) {
    if (!scene) return;

    if (helpers.grid) helpers.grid.visible = Boolean(state.grid3D);
    if (helpers.axes) helpers.axes.visible = Boolean(state.axes3D);

    scene.traverse((child) => {
        if (!child.isMesh) return;
        const material = child.material;
        const isWall = child.userData && child.userData.type === 'wall';
        if (Array.isArray(material)) {
            material.forEach((entry) => { if (entry && 'wireframe' in entry) entry.wireframe = Boolean(state.wireframe3D); });
        } else if (material && 'wireframe' in material) {
            material.wireframe = Boolean(state.wireframe3D);
        }
        if (isWall) child.visible = !state.hideWalls3D;
    });

    if (renderer) {
        renderer.shadowMap.enabled = Boolean(state.shadows3D);
        renderer.shadowMap.needsUpdate = true;
    }
    if (controls) controls.autoRotate = Boolean(state.turntable);

    scene.fog = state.fog3D ? new THREE.Fog(0xf3f4f6, 18, 60) : null;
}
