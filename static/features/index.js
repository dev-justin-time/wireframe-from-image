import { drawDimensionChains, buildDimensionChains } from './dimension-chains.js';
import { drawRoomLabels } from './room-labels.js';
import { drawLiftMarker, drawSnapGuides } from './plan-markers.js';
import { isVisible } from './visibility.js';

/**
 * The feature kit: one folder for the editor features added on top of the
 * original wall/fixture tools.
 *
 * Each module is independent and testable on its own; this file is the single
 * import the editor and the plan renderer need, plus the catalogue used by the
 * feature panel.
 */

export * from './wall-finish.js';
export * from './room-labels.js';
export * from './dimension-chains.js';
export * from './annotations.js';
export * from './plan-markers.js';
export * from './transforms.js';
export * from './grid.js';
export * from './room-metrics.js';
export * from './visibility.js';
export * from './shell.js';
export * from './cut-list.js';
export * from './elevation-annotations.js';

/** Every wired feature, in the order it is documented. */
export const FEATURES = [
    { id: 'wallHeight', label: 'Wall height per wall' },
    { id: 'wallFinish', label: 'Wall colour / texture per wall' },
    { id: 'roomLabels', label: 'Room labels at polygon centroid' },
    { id: 'dimensionChains', label: 'Dimension chains across a run' },
    { id: 'elevationHeights', label: 'Height annotations in elevation' },
    { id: 'elevationReadout', label: 'Height readout while dragging' },
    { id: 'liftMarkers', label: 'Lifted-piece marker in plan' },
    { id: 'snapGuides', label: 'Snap guides on the snapped edge' },
    { id: 'axisLocks', label: 'Per-item locked axes' },
    { id: 'clone', label: 'Duplicate / clone selection' },
    { id: 'linearRepeat', label: 'Array / linear repeat' },
    { id: 'flip', label: 'Item flip / mirror' },
    { id: 'gridSize', label: 'Grid size selector' },
    { id: 'roomMetrics', label: 'Room area / volume readout' },
    { id: 'planAnnotations', label: 'North arrow + scale bar' },
    { id: 'itemVisibility', label: 'Per-item visibility toggle' },
    { id: 'shell', label: 'Show ceiling / roof' },
    { id: 'cutList', label: 'Aggregated cut-list export' }
];

export const FEATURE_COUNT = FEATURES.length;

/** Ability ids owned by the feature kit (all toggles). */
export const FEATURE_TOGGLES = [
    'dimensionChains',
    'roomLabels',
    'liftMarkers',
    'snapGuides',
    'elevationHeights'
];

/**
 * Feature overlays drawn inside the plan transform, after walls and fixtures.
 * The model is supplied by the editor:
 *
 *   walls, fixtures, state (ability flags), roomLabels, snapGuide
 */
export function drawFeatureOverlays(ctx, model = {}) {
    const {
        walls = [],
        fixtures = [],
        state = {},
        roomLabels = [],
        snapGuide = null
    } = model;

    if (state.dimensionChains) {
        drawDimensionChains(ctx, buildDimensionChains(walls));
    }

    if (state.roomLabels) {
        drawRoomLabels(ctx, roomLabels);
    }

    if (state.liftMarkers !== false) {
        fixtures.forEach((fixture) => {
            if (isVisible(fixture)) drawLiftMarker(ctx, fixture);
        });
    }

    if (snapGuide && state.snapGuides !== false) {
        drawSnapGuides(ctx, snapGuide);
    }
}
