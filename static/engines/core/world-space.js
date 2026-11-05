/**
 * Universal world-space contract. Every 2D canvas, 3D scene and object in the
 * app measures against this module, so a metre is the same size everywhere.
 *
 *   units        1 world unit = 1 metre
 *   up axis      +y, height above the floor
 *   plan origin  world origin, on the floor plane
 *   plan x       -> world x   (+ to the right)
 *   plan y       -> world z   (canvas y grows downwards, which is +z towards the viewer)
 *
 * A 2D canvas is centred on the plan origin: its middle pixel is (0, 0) in plan
 * metres, at PIXELS_PER_METER pixels per metre.
 */

export const UNITS_PER_METER = 1;

// The single numeric source of truth for the whole app.
export const PIXELS_PER_METER = 30;
export const WALL_HEIGHT = 2.7;
export const WALL_THICKNESS = 0.15;
export const ROOF_PITCH = 1.5;
export const ROOF_OVERHANG = 0.5;

// Openings. Sill heights are measured from the floor to the bottom of the unit.
export const INCH = 0.0254;
export const WINDOW_SILL_HEIGHT = 36 * INCH; // 36 in = 0.9144 m
export const DOOR_HEIGHT = 2.1;

// Defaults for sample/placeholder scenes so they match plan dimensions.
export const DEFAULT_ROOM_SIZE = 10;
export const FLOOR_ELEVATION = 0;

export const pixelsToMetres = (pixels) => pixels / PIXELS_PER_METER;
export const metresToPixels = (metres) => metres * PIXELS_PER_METER;

/** Canvas pixel -> plan metres. `view` is { width, height } in canvas pixels. */
export function canvasToPlan(point, view) {
    return {
        x: (point.x - view.width / 2) / PIXELS_PER_METER,
        z: (point.y - view.height / 2) / PIXELS_PER_METER
    };
}

/** Plan metres -> canvas pixels. */
export function planToCanvas(point, view) {
    return {
        x: point.x * PIXELS_PER_METER + view.width / 2,
        y: point.z * PIXELS_PER_METER + view.height / 2
    };
}

/** Plan metres -> world metres. Plan z becomes world z; y is the elevation. */
export function planToWorld(point, elevation = FLOOR_ELEVATION) {
    return { x: point.x, y: elevation, z: point.z };
}

/** World metres -> plan metres (height is dropped). */
export function worldToPlan(worldPoint) {
    return { x: worldPoint.x, z: worldPoint.z };
}

export function canvasToWorld(point, view, elevation = FLOOR_ELEVATION) {
    return planToWorld(canvasToPlan(point, view), elevation);
}

export function worldToCanvas(worldPoint, view) {
    return planToCanvas(worldToPlan(worldPoint), view);
}

/** Distance in metres between two plan/world points (both use x and z). */
export function distanceInMetres(a, b) {
    return Math.hypot(b.x - a.x, b.z - a.z);
}

/** Length of a wall whose endpoints are canvas pixels. */
export function wallLengthMetres(wall, view) {
    return distanceInMetres(canvasToPlan(wall.start, view), canvasToPlan(wall.end, view));
}
