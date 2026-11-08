import * as THREE from 'three';
import { PIXELS_PER_METER } from '../../core/world-space.js';

/**
 * Plan walk mode - the first-person walk the legacy `app.html` toolbar had.
 *
 * The camera drops to eye height on the active storey and moves with WASD or
 * the arrow keys, with pointer-lock mouse look (drag to look when the browser
 * refuses the lock, so it still works on touch and in headless runs). Steps
 * closer than a body radius to a wall centreline are rejected, per axis, so the
 * walker slides along walls instead of passing through them.
 */

export const WALK = {
    eyeHeight: 1.6,
    walkSpeed: 2.2,
    runSpeed: 3.6,
    lookSpeed: 0.0022,
    radius: 0.32,
    minPitch: -1.35,
    maxPitch: 1.35
};

const MOVEMENT_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ShiftLeft', 'ShiftRight'
]);

const distanceToSegment = (point, wall) => {
    const ax = wall.start.x;
    const ay = wall.start.y;
    const bx = wall.end.x;
    const by = wall.end.y;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq
        ? Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / lengthSq))
        : 0;
    return Math.hypot(point.x - (ax + t * dx), point.y - (ay + t * dy));
};

/**
 * Metres between a plan point and the nearest wall centreline. Walls are
 * stored in plan pixels, so the caller passes canvas-space points.
 */
export function clearanceToWalls(point, walls = []) {
    let nearest = Infinity;
    (walls || []).forEach((wall) => {
        if (!wall?.start || !wall?.end) return;
        nearest = Math.min(nearest, distanceToSegment(point, wall));
    });
    return nearest / PIXELS_PER_METER;
}

/** Centre of the wall footprint in plan pixels, or the canvas centre. */
export function walkStartPoint(walls = [], view = { width: 1, height: 1 }) {
    if (!walls?.length) return { x: view.width / 2, y: view.height / 2 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    walls.forEach((wall) => {
        [wall.start, wall.end].forEach((point) => {
            if (!point) return;
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
    });
    if (!Number.isFinite(minX)) return { x: view.width / 2, y: view.height / 2 };
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function canvasToWorld(point, view = { width: 1, height: 1 }, elevation = 0) {
    return new THREE.Vector3(
        (point.x - view.width / 2) / PIXELS_PER_METER,
        elevation,
        (point.y - view.height / 2) / PIXELS_PER_METER
    );
}

export function worldToCanvas(point, view = { width: 1, height: 1 }) {
    return {
        x: point.x * PIXELS_PER_METER + view.width / 2,
        y: point.z * PIXELS_PER_METER + view.height / 2
    };
}

/**
 * Create the walk controller. `onChange(active)` lets the host disable orbit
 * controls and show its HUD; everything else is owned here.
 */
export function createWalkMode({
    camera,
    domElement,
    getWalls = () => [],
    getView = () => ({ width: 1, height: 1 }),
    getElevation = () => 0,
    onChange
} = {}) {
    if (!camera || !domElement) return null;

    let active = false;
    let lockedOnce = false;
    let dragging = false;
    let yaw = 0;
    let pitch = 0;
    let saved = null;
    let last = { x: 0, z: 0 };
    const keys = new Set();

    function standingAt(x, z) {
        const plan = worldToCanvas({ x, z }, getView());
        return clearanceToWalls(plan, getWalls()) >= WALK.radius;
    }

    function applyLook() {
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
        camera.rotation.z = 0;
    }

    function onKeyDown(event) {
        if (!active) return;
        if (event.code === 'Escape') {
            exit();
            return;
        }
        if (!MOVEMENT_KEYS.has(event.code)) return;
        keys.add(event.code);
        event.preventDefault();
    }

    function onKeyUp(event) {
        keys.delete(event.code);
    }

    function onMouseMove(event) {
        if (!active) return;
        const locked = document.pointerLockElement === domElement;
        if (!locked && !dragging) return;
        yaw -= (event.movementX || 0) * WALK.lookSpeed;
        pitch = Math.max(WALK.minPitch, Math.min(WALK.maxPitch, pitch - (event.movementY || 0) * WALK.lookSpeed));
        applyLook();
        onChange?.(active, 'look');
    }

    function onPointerDown(event) {
        if (!active || event.button !== 0) return;
        dragging = true;
        domElement.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
    }

    function onPointerUp(event) {
        if (!dragging) return;
        dragging = false;
        domElement.releasePointerCapture?.(event.pointerId);
    }

    function onPointerLockChange() {
        if (document.pointerLockElement === domElement) {
            lockedOnce = true;
            return;
        }
        // Losing a lock the walker actually had means Esc or a browser prompt:
        // leave the mode instead of stranding the camera.
        if (active && lockedOnce) exit();
    }

    function bind() {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('pointerlockchange', onPointerLockChange);
        domElement.addEventListener('pointerdown', onPointerDown, true);
        domElement.addEventListener('pointerup', onPointerUp, true);
    }

    function unbind() {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('pointerlockchange', onPointerLockChange);
        domElement.removeEventListener('pointerdown', onPointerDown, true);
        domElement.removeEventListener('pointerup', onPointerUp, true);
    }

    function enter() {
        if (active) return true;
        saved = {
            position: camera.position.clone(),
            quaternion: camera.quaternion.clone(),
            fov: camera.fov
        };

        const view = getView();
        const start = walkStartPoint(getWalls(), view);
        const elevation = Number(getElevation()) || 0;
        const eye = canvasToWorld(start, view, elevation + WALK.eyeHeight);
        camera.position.set(eye.x, eye.y, eye.z);
        last = { x: eye.x, z: eye.z };

        // Start level, looking down the plan's -z axis; mouse or drag turns.
        yaw = 0;
        pitch = -0.08;
        applyLook();

        active = true;
        lockedOnce = false;
        keys.clear();
        bind();
        try {
            // Pointer lock is optional: drag-to-look covers touch and any
            // browser that refuses the request.
            const requested = domElement.requestPointerLock?.();
            if (requested?.catch) requested.catch(() => {});
        } catch {
            /* locked refused - drag still looks around */
        }
        onChange?.(true);
        return true;
    }

    function exit() {
        if (!active) return false;
        active = false;
        dragging = false;
        keys.clear();
        unbind();
        if (document.pointerLockElement === domElement) document.exitPointerLock?.();
        if (saved) {
            camera.position.copy(saved.position);
            camera.quaternion.copy(saved.quaternion);
            if (saved.fov) camera.fov = saved.fov;
            camera.updateProjectionMatrix();
            saved = null;
        }
        onChange?.(false);
        return true;
    }

    function update(delta) {
        if (!active) return null;
        // The walker follows real elapsed time, not frame count. A slow or
        // headless renderer that reports one frame a second must still cover
        // the same distance as a 60 fps one. Delta is capped so a tab that was
        // asleep cannot teleport through a wall.
        const elapsed = Math.min(Math.max(delta || 0, 0), 0.5);
        if (elapsed <= 0) return { x: camera.position.x, z: camera.position.z, moved: false };

        const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
        const speed = running ? WALK.runSpeed : WALK.walkSpeed;

        let forward = 0;
        let strafe = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
        if (keys.has('KeyD')) strafe += 1;
        if (keys.has('KeyA')) strafe -= 1;
        // Arrow left/right turn instead of strafing, like the legacy walker.
        if (keys.has('ArrowLeft')) yaw += speed * 0.5 * elapsed;
        if (keys.has('ArrowRight')) yaw -= speed * 0.5 * elapsed;
        if (!forward && !strafe) {
            if (keys.has('ArrowLeft') || keys.has('ArrowRight')) applyLook();
            return { x: camera.position.x, z: camera.position.z, moved: false };
        }

        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        const fromX = last.x;
        const fromZ = last.z;
        let remaining = elapsed;

        // Substep long frames so a low frame rate cannot tunnel through a
        // wall; each 50 ms step uses the same clearance check as before.
        while (remaining > 1e-6) {
            const step = Math.min(remaining, 0.05);
            remaining -= step;
            const dx = (-sin * forward + cos * strafe) * speed * step;
            const dz = (-cos * forward - sin * strafe) * speed * step;

            let nextX = last.x + dx;
            let nextZ = last.z + dz;
            // Slide along whichever axis is still clear.
            if (!standingAt(nextX, nextZ)) {
                if (standingAt(nextX, last.z)) {
                    nextZ = last.z;
                } else if (standingAt(last.x, nextZ)) {
                    nextX = last.x;
                } else {
                    nextX = last.x;
                    nextZ = last.z;
                }
            }
            last = { x: nextX, z: nextZ };
        }

        camera.position.x = last.x;
        camera.position.z = last.z;
        applyLook();
        return { x: last.x, z: last.z, moved: Math.hypot(last.x - fromX, last.z - fromZ) > 1e-6 };
    }

    function toggle() {
        return active ? exit() : enter();
    }

    return {
        enter,
        exit,
        toggle,
        update,
        get active() {
            return active;
        },
        get status() {
            return {
                active,
                eyeHeight: WALK.eyeHeight,
                position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                yaw,
                pitch,
                radius: WALK.radius
            };
        }
    };
}
