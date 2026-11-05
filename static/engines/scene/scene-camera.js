import { DEFAULT_ROOM_SIZE, WALL_HEIGHT } from '../core/world-space.js';

/**
 * Shared camera framing for every 3D scene, so the plan sits in view the same
 * way in the demo preview, the Editor preview and the sync demo.
 *
 * The camera always looks at the plan centre from the same orbit direction and
 * backs off just far enough for the whole footprint to fit the viewport.
 */

export const SCENE_VIEW = {
    azimuth: Math.PI / 4,        // 45 deg, looking in from the +x/+z corner
    elevation: 0.62,             // ~35 deg above the floor
    padding: 1.25
};

/** World-space bounds (metres) of a plan graph. */
export function graphBounds(graph) {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
        const half = DEFAULT_ROOM_SIZE / 2;
        return { minX: -half, maxX: half, minZ: -half, maxZ: half };
    }
    const { minX, minZ, maxX, maxZ } = graph.wallsBounds();
    return { minX, minZ, maxX, maxZ };
}

export function boundsCenter(bounds, height = WALL_HEIGHT / 2) {
    return {
        x: (bounds.minX + bounds.maxX) / 2,
        y: height,
        z: (bounds.minZ + bounds.maxZ) / 2
    };
}

/**
 * Distance at which a sphere of `radius` fills the viewport for this camera.
 * Uses the tighter of the horizontal and vertical field of view.
 */
export function distanceToFit(radius, camera, padding = SCENE_VIEW.padding) {
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (camera.aspect || 1));
    const fov = Math.min(vFov, hFov);
    return (radius * padding) / Math.sin(fov / 2);
}

export function viewDirection(azimuth = SCENE_VIEW.azimuth, elevation = SCENE_VIEW.elevation) {
    return {
        x: Math.cos(elevation) * Math.cos(azimuth),
        y: Math.sin(elevation),
        z: Math.cos(elevation) * Math.sin(azimuth)
    };
}

/**
 * Frame `bounds` in `camera` and point `controls` at the plan centre.
 * Returns the distance used, or 0 when there is nothing to frame.
 */
export function fitCameraToBounds(camera, controls, bounds, options = {}) {
    if (!camera || !bounds) return 0;

    const padding = options.padding ?? SCENE_VIEW.padding;
    const targetHeight = options.targetHeight ?? WALL_HEIGHT / 2;

    const target = boundsCenter(bounds, targetHeight);
    const width = Math.max(bounds.maxX - bounds.minX, 1);
    const depth = Math.max(bounds.maxZ - bounds.minZ, 1);
    const height = options.height ?? WALL_HEIGHT;
    // Bounding sphere of the whole volume, not just the footprint: wall height
    // matters on small plans, and the near corners sit closer than the centre.
    const radius = Math.hypot(width / 2, depth / 2, height / 2);

    const distance = distanceToFit(radius, camera, padding);
    const dir = viewDirection(options.azimuth, options.elevation);

    camera.position.set(
        target.x + dir.x * distance,
        target.y + dir.y * distance,
        target.z + dir.z * distance
    );

    if (controls) {
        controls.target.set(target.x, target.y, target.z);
        controls.update?.();
    } else {
        camera.lookAt(target.x, target.y, target.z);
    }

    // Keep the depth range proportionate to the view distance so large plans
    // keep their depth precision.
    if (camera.isPerspectiveCamera) {
        camera.near = Math.max(distance / 1000, 0.05);
        camera.far = Math.max(distance * 6, 100);
        camera.updateProjectionMatrix();
    }

    return distance;
}

/** Same framing, but from a FloorPlanGraph. */
export function fitCameraToGraph(camera, controls, graph, options = {}) {
    return fitCameraToBounds(camera, controls, graphBounds(graph), options);
}
