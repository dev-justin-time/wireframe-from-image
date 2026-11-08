import { PIXELS_PER_METER, WALL_HEIGHT } from '../../core/world-space.js';
import { isStairItem, stairDesignForItem, stairSurfaceAt } from './design.js';
import { storeyStack } from '../studio/storeys.js';

/**
 * Walkable stairs.
 *
 * `createStairHeightField` turns a plan into a height function: the floor of the
 * storey you are on, lifted onto the stair surface when you step onto a run and
 * onto its top landing when you reach the next floor. `createStairWalker` drives
 * a first-person camera over that field with WASD and pointer-look, so walking
 * up a flight actually moves you to the storey above.
 *
 * Plan points are canvas pixels (the editor's coordinate space); heights are
 * metres above the ground floor.
 */

export const WALKER = {
    eyeHeight: 1.6,
    radius: 0.25,
    speed: 1.7,
    runSpeed: 2.6,
    lookSpeed: 0.0022,
    minPitch: -1.35,
    maxPitch: 1.35
};

/** Every stair on every storey, with its design and floor elevation. */
export function collectStairs(state) {
    const stories = state?.stories?.length
        ? state.stories
        : [{ walls: state?.walls || [], fixtures: state?.fixtures || [], height: WALL_HEIGHT }];
    const stack = storeyStack(stories);
    const stairs = [];
    stories.forEach((story, index) => {
        const entry = stack[index];
        (story.fixtures || []).forEach((item) => {
            if (!isStairItem(item) || item.visible === false) return;
            const design = stairDesignForItem(item, entry?.height || story.height || WALL_HEIGHT);
            if (design.type === 'fire-pole' || !design.path) return;
            stairs.push({
                item,
                design,
                storeyIndex: index,
                elevation: entry?.elevation || 0,
                storeyHeight: entry?.height || story.height || WALL_HEIGHT
            });
        });
    });
    return stairs;
}

function pointInPolygon(point, vertices = []) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x;
        const zi = vertices[i].z;
        const xj = vertices[j].x;
        const zj = vertices[j].z;
        const intersects = ((zi > point.z) !== (zj > point.z))
            && (point.x < ((xj - xi) * (point.z - zi)) / (zj - zi || 1e-9) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
}

/**
 * Height of a stair's top landing, given a stair-local point.
 * A landing extends past the exit in the direction of travel.
 */
function landingHeight(design, local) {
    const landing = design.landingDepth || 0;
    if (landing <= 0 || !design.exit || !design.path) return null;
    const tangent = design.path.tangentAt(1);
    const dx = local.x - design.exit.x;
    const dz = local.z - design.exit.z;
    const along = dx * tangent.x + dz * tangent.z;
    const across = Math.abs(dx * -tangent.z + dz * tangent.x);
    if (along < -1e-6 || along > landing + 1e-6) return null;
    if (across > design.width / 2 + 1e-6) return null;
    return design.rise;
}

/**
 * Build the height field.
 *
 * Returns { heightAt(planPoint), sample(planPoint), stairs, floors }.
 * `floors` is the room floor list used for the non-stair area, if rooms exist.
 */
export function createStairHeightField(state) {
    const stairs = collectStairs(state);
    const stories = state?.stories?.length ? state.stories : [];
    const stack = storeyStack(stories.length ? stories : [{ height: WALL_HEIGHT }]);
    const floors = [];

    // Room floors from the active storey (and any storey that carries rooms).
    const activeIndex = state?.currentStoryIndex || 0;
    const rooms = state?.rooms || [];
    rooms.forEach((room) => {
        const vertices = room.vertices || room.points;
        if (!vertices?.length) return;
        floors.push({
            vertices,
            elevation: stack[activeIndex]?.elevation || 0,
            storeyIndex: activeIndex
        });
    });

    // A storey's stair opening is a hole in its own floor, but the stair from the
    // storey below covers it, so the stair surface wins by being sampled last.

    function sample(planPoint) {
        let height = null;
        let source = null;
        let storeyIndex = 0;

        floors.forEach((floor) => {
            if (pointInPolygon(planPoint, floor.vertices)) {
                if (height == null || floor.elevation > height) {
                    height = floor.elevation;
                    source = 'floor';
                    storeyIndex = floor.storeyIndex;
                }
            }
        });

        stairs.forEach((stair) => {
            const surface = stairSurfaceAt(stair.item, stair.design, planPoint);
            if (!surface) {
                const local = stairLocal(stair.item, planPoint);
                const landing = landingHeight(stair.design, local);
                if (landing != null && stair.elevation + landing > (height ?? -Infinity)) {
                    height = stair.elevation + landing;
                    source = 'stair-top';
                    storeyIndex = stair.storeyIndex + 1;
                }
                return;
            }
            const value = stair.elevation + surface.height;
            if (height == null || value >= height - 1e-6) {
                height = value;
                source = 'stair';
                // The last tread is the upper floor, not the storey the stair
                // model lives on.
                storeyIndex = surface.height >= stair.design.rise - 0.02
                    ? stair.storeyIndex + 1
                    : stair.storeyIndex;
            }
        });

        if (height == null) height = 0;
        return {
            height,
            source: source || 'ground',
            storeyIndex,
            storeys: stack.length
        };
    }

    return {
        stairs,
        floors,
        stack,
        heightAt: (planPoint) => sample(planPoint).height,
        sample
    };
}

/** Stair-local metres from a plan point (no design needed). */
export function stairLocal(item, planPoint) {
    const dx = (planPoint.x - item.x) / PIXELS_PER_METER;
    const dz = (planPoint.y - item.y) / PIXELS_PER_METER;
    const cos = Math.cos(item.rotation || 0);
    const sin = Math.sin(item.rotation || 0);
    return { x: dx * cos + dz * sin, z: -dx * sin + dz * cos };
}

function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dz) / lengthSq));
    return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dz * t));
}

/** True when a plan point is clear of the walls on the storey. */
function isClear(point, walls, radiusPixels) {
    return !walls.some((wall) => distanceToSegment(point, wall.start, wall.end) < radiusPixels + (wall.thickness || 0) / 2);
}

/**
 * First-person walker over the stair height field.
 *
 *   const walker = createStairWalker({ camera, domElement, getState, getView });
 *   walker.start({ x, y });   // plan pixels
 *   walker.update(delta);     // from the render loop or a rAF
 *   walker.stop();
 */
export function createStairWalker({
    camera,
    domElement,
    getState = () => ({}),
    getView = () => ({ width: 1, height: 1 }),
    eyeHeight = WALKER.eyeHeight,
    speed = WALKER.speed,
    onExit
} = {}) {
    if (!camera) return null;

    const keys = new Set();
    let active = false;
    let yaw = 0;
    let pitch = 0;
    let field = null;
    let lastPoint = null;
    let shift = false;

    const toWorld = (point) => {
        const view = getView();
        return {
            x: (point.x - view.width / 2) / PIXELS_PER_METER,
            z: (point.y - view.height / 2) / PIXELS_PER_METER
        };
    };

    const toPlan = (world) => {
        const view = getView();
        return {
            x: world.x * PIXELS_PER_METER + view.width / 2,
            y: world.z * PIXELS_PER_METER + view.height / 2
        };
    };

    function refreshField() {
        field = createStairHeightField(getState());
        return field;
    }

    function applyCamera() {
        if (!lastPoint) return;
        const world = toWorld(lastPoint);
        const info = field.sample(lastPoint);
        camera.position.set(world.x, info.height + eyeHeight, world.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.set(pitch, yaw, 0);
    }

    function onKeyDown(event) {
        if (!active) return;
        const key = event.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'escape'].includes(key)) {
            event.preventDefault();
        }
        if (key === 'escape') {
            stop();
            return;
        }
        if (key === 'shift') shift = true;
        keys.add(key);
    }

    function onKeyUp(event) {
        const key = event.key.toLowerCase();
        if (key === 'shift') shift = false;
        keys.delete(key);
    }

    function onPointerMove(event) {
        if (!active || document.pointerLockElement !== domElement) return;
        yaw -= event.movementX * WALKER.lookSpeed;
        pitch -= event.movementY * WALKER.lookSpeed;
        pitch = Math.max(WALKER.minPitch, Math.min(WALKER.maxPitch, pitch));
    }

    function onPointerLockChange() {
        if (active && document.pointerLockElement !== domElement) stop();
    }

    function start(planStart) {
        if (active) return false;
        active = true;
        refreshField();
        const state = getState();
        const view = getView();
        const startPoint = planStart || {
            x: view.width / 2,
            y: view.height / 2
        };
        const walls = state.walls || [];
        const radiusPixels = (WALKER.radius * PIXELS_PER_METER);
        let point = startPoint;
        if (!isClear(point, walls, radiusPixels)) {
            // Nudge to the nearest clear spot so walking can start next to a wall.
            for (let step = 1; step <= 60 && !isClear(point, walls, radiusPixels); step++) {
                point = { x: startPoint.x + step * 2, y: startPoint.y };
            }
        }
        lastPoint = point;
        // Face along the first stair when starting on one, otherwise face -z.
        const sample = field.sample(point);
        const world = toWorld(point);
        const stair = field.stairs.find((entry) => stairSurfaceAt(entry.item, entry.design, point));
        if (stair) {
            const local = stairLocal(stair.item, point);
            const surface = stairSurfaceAt(stair.item, stair.design, point);
            const tangent = stair.design.path.tangentAt(surface.s);
            yaw = Math.atan2(-tangent.x, -tangent.z);
        } else {
            yaw = Math.atan2(-world.x, -world.z) || Math.PI;
        }
        // Prefer to look level, then follow the stair pitch a little.
        pitch = stair ? -Math.atan2(stair.design.rise, stair.design.pathLength || stair.design.rise) * 0.6 : 0;

        camera.rotation.order = 'YXZ';
        applyCamera();
        domElement?.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerlockchange', onPointerLockChange);
        domElement?.requestPointerLock?.();
        return { sample, point };
    }

    function onPointerDown() {
        if (active && document.pointerLockElement !== domElement) domElement?.requestPointerLock?.();
    }

    function stop() {
        if (!active) return;
        active = false;
        keys.clear();
        shift = false;
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerlockchange', onPointerLockChange);
        domElement?.removeEventListener('pointerdown', onPointerDown);
        if (document.pointerLockElement === domElement) document.exitPointerLock?.();
        onExit?.({ point: lastPoint ? { ...lastPoint } : null });
    }

    function update(delta = 0.016) {
        if (!active || !lastPoint) return null;
        refreshField();

        const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
        const strafe = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
        const state = getState();
        const walls = state.walls || [];

        if (forward || strafe) {
            const step = (shift ? WALKER.runSpeed : speed) * Math.min(delta, 0.1);
            const sin = Math.sin(yaw);
            const cos = Math.cos(yaw);
            // Camera looks down -z at yaw 0.
            const moveX = (-sin * forward + cos * strafe) * step;
            const moveZ = (-cos * forward - sin * strafe) * step;
            const view = getView();
            const edge = 0.3 * PIXELS_PER_METER;
            const tryPoint = (x, y) => {
                const point = { x, y };
                if (point.x < edge || point.y < edge || point.x > view.width - edge || point.y > view.height - edge) return false;
                return isClear(point, walls, WALKER.radius * PIXELS_PER_METER);
            };
            const nextX = lastPoint.x + moveX * PIXELS_PER_METER;
            const nextY = lastPoint.y + moveZ * PIXELS_PER_METER;
            if (tryPoint(nextX, nextY)) {
                lastPoint = { x: nextX, y: nextY };
            } else if (tryPoint(nextX, lastPoint.y)) {
                lastPoint = { x: nextX, y: lastPoint.y };
            } else if (tryPoint(lastPoint.x, nextY)) {
                lastPoint = { x: lastPoint.x, y: nextY };
            }
        }

        applyCamera();
        const info = field.sample(lastPoint);
        const stair = field.stairs.find((entry) => stairSurfaceAt(entry.item, entry.design, lastPoint));
        return {
            point: { ...lastPoint },
            ...info,
            onStair: Boolean(stair),
            stairType: stair?.design?.type || null
        };
    }

    return {
        get active() { return active; },
        get field() { return field || refreshField(); },
        get point() { return lastPoint ? { ...lastPoint } : null; },
        start,
        stop,
        update,
        heightAt: (planPoint) => (field || refreshField()).heightAt(planPoint)
    };
}

/** Convenience: the storey a plan point lands on. */
export function storeyAt(state, planPoint) {
    const field = createStairHeightField(state);
    const sample = field.sample(planPoint);
    const stack = field.stack;
    let index = 0;
    stack.forEach((entry, i) => {
        if (sample.height >= entry.elevation - 1e-6) index = i;
    });
    return { index, ...sample, storey: stack[index] || null };
}
