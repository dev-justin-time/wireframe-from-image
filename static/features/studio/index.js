import { STUDIO } from './constants.js';
import { drawComments } from './overlays.js';

/**
 * Studio feature kit (items 38-46): the architectural layer above the editing
 * features. Each module is standalone; this is the single import for the
 * editor, the engine and the tests.
 */

export * from './wall-builder.js';
export * from './room-surfaces.js';
export * from './render-loop.js';
export * from './storeys.js';
export * from './projects.js';
export * from './collaboration.js';
export * from './parametric.js';
export * from './manufacturing.js';
export * from './layout-solver.js';
export * from './construction.js';
export * from './shell.js';
export * from './openings-plan.js';
export * from './roof.js';
export * from './instancing.js';
export * from './walk-mode.js';
export { STUDIO } from './constants.js';
export { drawComments } from './overlays.js';

export const STUDIO_FEATURES = STUDIO;
export const STUDIO_FEATURE_COUNT = STUDIO.length;

/** Plan overlay hook owned by the studio kit. */
export function drawStudioOverlays(ctx, model = {}) {
    if (!model.comments?.length) return;
    drawComments(ctx, model.comments, { selectedId: model.selectedCommentId });
}
