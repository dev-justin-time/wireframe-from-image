import * as THREE from 'three';
import { PIXELS_PER_METER, WALL_HEIGHT } from '../core/world-space.js';
import { pickItemId } from './scene-gizmo.js';
import { inSameRun, ELEVATION_SNAP } from '../core/elevation-snap.js';
import { runSnap, verticalSnap } from '../features/advanced/snapping.js';
import { constrainToLocks } from '../features/transforms.js';

/**
 * Elevation views for the 3D preview.
 *
 * A side elevation is an orthographic camera looking straight at the plan from
 * one of the four sides, so a wall of cabinetry reads flat: the screen's
 * horizontal axis runs along the wall, the vertical axis is height above the
 * floor. In that view pieces can be dragged up/down and side to side, and each
 * drag snaps to the pieces of the same run (butt joints and stacking).
 *
 * Walls between the camera and the plan centre are hidden so the run behind
 * them stays visible - the look of a drawing, not a walk-through.
 */

export const ELEVATION_SIDES = ['front', 'back', 'left', 'right'];

/**
 * Plan-space axes for a side.
 *   normal  unit plan vector pointing from the plan toward the camera
 *   axis    unit plan vector along the screen's horizontal axis
 * (world x -> plan x, world z -> plan y)
 */
export function elevationAxes(side) {
    switch (side) {
        case 'front': return { normal: { x: 0, y: 1 }, axis: { x: 1, y: 0 } };
        case 'back': return { normal: { x: 0, y: -1 }, axis: { x: -1, y: 0 } };
        case 'left': return { normal: { x: -1, y: 0 }, axis: { x: 0, y: 1 } };
        case 'right': return { normal: { x: 1, y: 0 }, axis: { x: 0, y: -1 } };
        default: return null;
    }
}

const span = (min, max) => Math.max(max - min, 1);

/**
 * Framed so the whole run fills the viewport: width of the plan along the
 * view direction and wall height (plus padding). Returns the look-at target.
 */
export function frameElevation(camera, { bounds, side, aspect = 1, height = WALL_HEIGHT, padding = 1.15 } = {}) {
    const axes = elevationAxes(side);
    if (!camera || !axes || !bounds) return null;

    const centreX = (bounds.minX + bounds.maxX) / 2;
    const centreZ = (bounds.minZ + bounds.maxZ) / 2;
    const horizontal = (side === 'front' || side === 'back')
        ? span(bounds.minX, bounds.maxX)
        : span(bounds.minZ, bounds.maxZ);
    const depthSpan = (side === 'front' || side === 'back')
        ? span(bounds.minZ, bounds.maxZ)
        : span(bounds.minX, bounds.maxX);

    const safeAspect = Math.max(aspect || 1, 0.01);
    const halfHeight = Math.max((height * padding) / 2, (horizontal * padding) / 2 / safeAspect);
    const halfWidth = halfHeight * safeAspect;

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;

    const target = new THREE.Vector3(centreX, height / 2, centreZ);
    const distance = Math.max(horizontal, depthSpan, height) * 1.5 + 6;
    camera.position.set(
        centreX + axes.normal.x * distance,
        height / 2,
        centreZ + axes.normal.y * distance
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target);

    camera.near = 0.1;
    camera.far = distance + Math.max(horizontal, depthSpan, height) * 2 + 20;
    camera.updateProjectionMatrix();

    return target;
}

/** Plan-space distance, in pixels, from a fixture centre to a wall segment. */
function distanceToWallPx(fixture, wall) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq < 1e-6) return Infinity;
    const t = Math.max(0, Math.min(1,
        ((fixture.x - wall.start.x) * dx + (fixture.y - wall.start.y) * dy) / lengthSq
    ));
    const x = wall.start.x + t * dx;
    const y = wall.start.y + t * dy;
    return Math.hypot(fixture.x - x, fixture.y - y);
}

/**
 * Elevation visibility.
 *
 * With no side (or no bounds) every wall and item returns to its own
 * visibility. With a side, the old behaviour hid the walls between the camera
 * and the plan centre; passing `wallId` narrows that to a single wall, so an
 * elevation shows one run at a time. Only items sitting on that wall stay
 * visible, using their plan position, so the elevation reads as one drawing.
 */
export function applyElevationVisibility(scene, side, bounds, options = {}) {
    if (!scene) return;
    const { wallId = null, wall = null, fixtures = null, itemReach = 1.1 } = options;
    const axes = side ? elevationAxes(side) : null;
    const centreX = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
    const centreZ = bounds ? (bounds.minZ + bounds.maxZ) / 2 : 0;
    const point = new THREE.Vector3();
    const reachPx = itemReach * PIXELS_PER_METER;

    scene.traverse((object) => {
        const data = object.userData || {};
        if (data.type === 'wall') {
            if (!axes || !bounds) {
                object.visible = true;
                return;
            }
            if (wallId) {
                object.visible = data.id === wallId;
                return;
            }
            object.getWorldPosition(point);
            const depth = (point.x - centreX) * axes.normal.x + (point.z - centreZ) * axes.normal.y;
            object.visible = depth <= 0;
            return;
        }

        if (data.type !== 'item' || !fixtures) return;
        const fixture = fixtures.find((entry) => entry && entry.id === data.id);
        if (!fixture) return;
        if (!axes) {
            object.visible = fixture.visible !== false;
            return;
        }
        if (!wallId || !wall) return;
        const onWall = distanceToWallPx(fixture, wall) <= reachPx;
        object.visible = fixture.visible !== false && onWall;
    });
}

/**
 * Down/up and side-to-side dragging inside an elevation view.
 *
 * Pointer movement is projected onto a vertical plane through the grabbed
 * piece, so the drag follows the drawing: horizontal moves along the run,
 * vertical changes the height off the floor. Both axes snap to the other
 * pieces of the same run while the pointer is held; the mesh is moved
 * directly during the drag (no CSG rebuild per frame) and rebuilt on release.
 */
export function createElevationDrag({
    scene,
    domElement,
    getCamera,
    getSide,
    getView,
    getFixtures,
    getObject,
    onDraggingChange,
    onCommit,
    onDrag,
    threshold = ELEVATION_SNAP
}) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane();
    let drag = null;

    function pointOnPlane(event) {
        const camera = getCamera();
        if (!camera || !domElement) return null;
        const rect = domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        pointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(pointer, camera);
        const hit = new THREE.Vector3();
        return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
    }

    function collectOthers(fixture, normal) {
        const fixtures = getFixtures() || [];
        const others = [];
        for (const other of fixtures) {
            if (!other || other.id === fixture.id || other.visible === false) continue;
            if (!inSameRun(fixture, other, normal)) continue;
            const object = getObject(other.id);
            if (!object) continue; // no mesh yet (async model, or not built)
            const box = new THREE.Box3().setFromObject(object);
            if (!Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)) continue;
            others.push({ fixture: other, bottom: box.min.y, top: box.max.y });
        }
        return others;
    }

    function startDrag(event) {
        if (!drag) {
            const side = getSide();
            if (!side) return;
            const camera = getCamera();
            if (!camera || !scene) return;
            const id = pickItemId(scene, camera, domElement, event);
            if (!id) return;

            const fixture = (getFixtures() || []).find((f) => f.id === id);
            const object = getObject(id);
            // Locked and hidden pieces cannot be lifted either.
            if (!fixture || !object || fixture.locked || fixture.visible === false) return;

            const axes = elevationAxes(side);
            const box = new THREE.Box3().setFromObject(object);
            if (!Number.isFinite(box.min.y)) return;
            const centre = box.getCenter(new THREE.Vector3());
            plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(axes.normal.x, 0, axes.normal.y), centre);

            const start = pointOnPlane(event);
            if (!start) return;

            const lift = fixture.elevation || 0;
            drag = {
                fixture,
                object,
                axes,
                start,
                startX: fixture.x,
                startY: fixture.y,
                startObjectY: object.position.y,
                startBottom: box.min.y,
                defaultBottom: box.min.y - lift,
                height: box.max.y - box.min.y,
                others: collectOthers(fixture, axes.normal),
                moved: false,
                bottom: box.min.y
            };
            onDraggingChange?.(true);
            onDrag?.({
                phase: 'start',
                fixture,
                bottom: drag.startBottom,
                top: drag.startBottom + drag.height,
                height: drag.height,
                lift: fixture.elevation || 0
            });
        }
    }

    function moveDrag(event) {
        if (!drag) return;
        const hit = pointOnPlane(event);
        if (!hit) return;

        const { fixture, object, axes, start } = drag;
        const view = getView ? getView() : { width: 0, height: 0 };

        // Screen-horizontal -> along the run
        const alongDelta = (hit.x - start.x) * axes.axis.x + (hit.z - start.z) * axes.axis.y;
        fixture.x = drag.startX + axes.axis.x * alongDelta * PIXELS_PER_METER;
        fixture.y = drag.startY + axes.axis.y * alongDelta * PIXELS_PER_METER;

        const runFixtures = drag.others.map((other) => other.fixture);
        const joint = runSnap(fixture, runFixtures, axes.axis, { threshold });
        if (joint.snapped) {
            fixture.x += axes.axis.x * joint.delta * PIXELS_PER_METER;
            fixture.y += axes.axis.y * joint.delta * PIXELS_PER_METER;
        }

        // A locked plan axis stays put even while the piece is lifted.
        const constrained = constrainToLocks(fixture, { x: fixture.x, y: fixture.y }, { x: drag.startX, y: drag.startY });
        fixture.x = constrained.x;
        fixture.y = constrained.y;

        // Screen-vertical -> height off the floor
        let bottom = Math.max(0, drag.startBottom + (hit.y - start.y));
        const stack = verticalSnap(
            { bottom, top: bottom + drag.height },
            drag.others,
            { threshold, floor: 0 }
        );
        bottom = Math.min(stack.bottom, Math.max(0, WALL_HEIGHT - drag.height));
        bottom = Math.max(0, bottom);

        drag.bottom = bottom;
        fixture.elevation = bottom - drag.defaultBottom;

        // Live preview of the real mesh; the engine rebuild waits for release.
        object.position.set(
            (fixture.x - view.width / 2) / PIXELS_PER_METER,
            drag.startObjectY + (bottom - drag.startBottom),
            (fixture.y - view.height / 2) / PIXELS_PER_METER
        );

        if (Math.abs(alongDelta) > 0.005 || Math.abs(hit.y - start.y) > 0.005) drag.moved = true;

        onDrag?.({
            phase: 'move',
            fixture,
            bottom,
            top: bottom + drag.height,
            height: drag.height,
            lift: fixture.elevation || 0
        });
    }

    function endDrag() {
        if (!drag) return;
        const finished = drag;
        drag = null;
        onDraggingChange?.(false);
        onDrag?.({ phase: 'end', fixture: finished.fixture });
        if (finished.moved) onCommit?.(finished.fixture);
    }

    const onPointerDown = (event) => {
        if (event.button !== 0) return;
        startDrag(event);
    };
    const onPointerMove = (event) => {
        moveDrag(event);
    };
    const onPointerUp = () => {
        endDrag();
    };
    const onPointerCancel = () => {
        endDrag();
    };

    if (domElement) {
        domElement.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
    }

    return {
        begin: startDrag,
        move: moveDrag,
        end: endDrag,
        get dragging() { return Boolean(drag); },
        dispose() {
            drag = null;
            if (!domElement) return;
            domElement.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerCancel);
        }
    };
}
