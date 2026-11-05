import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { PIXELS_PER_METER } from '../core/world-space.js';

/**
 * 3D movement handles for the selected plan object.
 *
 * The gizmo is the "gimbal": in translate mode it exposes the floor axes (X/Z,
 * no Y — plan objects live on the floor), in rotate mode only the vertical
 * ring. Edits are reported as plan-space fixture coordinates, so the 2D canvas
 * and the 3D view stay in step.
 */

export const GIZMO_STEP = 0.05; // 5 cm translation steps

export function planFromObject(object, view) {
    const world = new THREE.Vector3();
    object.getWorldPosition(world);
    if (object.parent) {
        const parentWorld = new THREE.Vector3();
        object.parent.getWorldPosition(parentWorld);
        world.sub(parentWorld);
    }
    return {
        x: world.x * PIXELS_PER_METER + view.width / 2,
        y: world.z * PIXELS_PER_METER + view.height / 2,
        rotation: -object.rotation.y
    };
}

export function pickItemId(scene, camera, domElement, event) {
    const rect = domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);

    const roots = [];
    scene.traverse((child) => {
        if (child.userData && child.userData.type === 'item' && child.userData.id) roots.push(child);
    });
    if (roots.length === 0) return null;

    const hits = raycaster.intersectObjects(roots, true);
    if (hits.length === 0) return null;

    let node = hits[0].object;
    while (node && !(node.userData && node.userData.type === 'item' && node.userData.id)) {
        node = node.parent;
    }
    return node ? node.userData.id : null;
}

export function createItemGizmo({ scene, camera, renderer, orbit, onPreview, onCommit, onDraggingChange }) {
    const gizmo = new TransformControls(camera, renderer.domElement);
    gizmo.setSize(0.8);
    gizmo.setSpace('world');
    gizmo.setTranslationSnap(GIZMO_STEP);
    gizmo.setRotationSnap(THREE.MathUtils.degToRad(15));
    scene.add(gizmo);

    const setMode = (mode) => {
        gizmo.setMode(mode);
        const translate = mode === 'translate';
        // Floor axes when moving, plus the vertical axis: a Y drag is turned
        // into the item's elevation, so pieces can be lifted in the orbit view
        // as well as in an elevation.
        gizmo.showX = translate;
        gizmo.showZ = translate;
        gizmo.showY = true;
    };
    setMode('translate');

    gizmo.addEventListener('dragging-changed', (event) => {
        if (orbit) orbit.enabled = !event.value;
        onDraggingChange?.(event.value);
    });
    gizmo.addEventListener('objectChange', () => {
        if (gizmo.object) onPreview?.(gizmo.object);
    });
    gizmo.addEventListener('mouseUp', () => {
        if (gizmo.object) onCommit?.(gizmo.object);
    });

    return {
        controls: gizmo,
        setMode,
        attach(object) {
            if (object && object !== gizmo.object) gizmo.attach(object);
        },
        detach() { gizmo.detach(); },
        get object() { return gizmo.object || null; },
        get dragging() { return Boolean(gizmo.dragging); },
        dispose() {
            gizmo.detach();
            scene.remove(gizmo);
            gizmo.dispose();
        }
    };
}
