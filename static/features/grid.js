import { PIXELS_PER_METER } from '../core/world-space.js';

/**
 * Plan grid size.
 *
 * The editor stores `gridSize` in canvas pixels; the UI offers round metric
 * sizes. These helpers are the only place that conversion happens.
 */

export const GRID_OPTIONS = [
    { cm: 0, label: 'Off' },
    { cm: 25, label: '25 cm' },
    { cm: 50, label: '50 cm' },
    { cm: 100, label: '1 m' },
    { cm: 200, label: '2 m' }
];

export const DEFAULT_GRID_CM = 100;

/** Metric grid size (cm) -> editor grid size in pixels. */
export function gridPixelsFromCm(cm, scale = PIXELS_PER_METER) {
    const value = Number(cm);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.max(1, Math.round((value / 100) * scale));
}

/** Editor grid size in pixels -> the metric option it matches. */
export function gridCmFromPixels(pixels, scale = PIXELS_PER_METER) {
    const value = Number(pixels);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round((value / scale) * 100);
}

/** Snap a plan point to the grid (0 disables snapping). */
export function snapPointToGrid(point, gridSize) {
    if (!gridSize || gridSize <= 0) return { x: point.x, y: point.y };
    return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize
    };
}
