import { boundsOf, findOverlaps } from './collision.js';

/**
 * Advanced feature kit: items 19-37 of the editor roadmap, in one folder.
 *
 * Same rules as ../index.js: each module is standalone and testable, and this
 * file is the only import the editor needs (plus a small overlay hook for the
 * plan canvas).
 */

export * from './snapping.js';
export * from './cabinet-align.js';
export * from './collision.js';
export * from './placement-rules.js';
export * from './openings.js';
export * from './cabinet-base.js';
export * from './groups.js';
export * from './clipboard.js';
export * from './history.js';
export * from './schema.js';
export * from './autosave.js';
export * from './materials.js';
export * from './elevation-dims.js';
export * from './section.js';
export * from './summary.js';
export * from './live-preview.js';
export * from './xr.js';
export * from './walkthrough.js';
export * from './exporter.js';

export const ADVANCED_FEATURES = [
    { id: 'unifiedSnapping', label: 'Unified snapping (grid + wall + run + vertical)' },
    { id: 'cabinetDepth', label: 'Cabinet depth alignment / inside corners' },
    { id: 'collisionDetect', label: 'Collision / overlap detection' },
    { id: 'placementWarnings', label: 'Wall-aware placement warnings' },
    { id: 'openings', label: 'Multiple openings per wall with cut validation' },
    { id: 'cabinetBase', label: 'Cabinet base (default bottom/top)' },
    { id: 'groups', label: 'Item groups / assemblies' },
    { id: 'clipboard', label: 'Copy / paste between stories' },
    { id: 'history', label: 'Undo granularity (tagged batches)' },
    { id: 'schema', label: 'Project schema versioning + migration' },
    { id: 'autosave', label: 'Autosave throttling / dirty-only save' },
    { id: 'lineMaterials', label: 'Material library per line' },
    { id: 'elevationDims', label: 'Elevation dimension strings' },
    { id: 'sectionBox', label: 'Section box / clipping plane' },
    { id: 'roomSummary', label: 'Item count / cost per room' },
    { id: 'livePreview', label: 'Live 3D preview while dragging' },
    { id: 'xr', label: 'WebXR / AR placement' },
    { id: 'walkthrough', label: 'Pathfinding walkthrough' },
    { id: 'exporter', label: 'Scene export (GLTF / GLB / OBJ)' }
];

export const ADVANCED_FEATURE_COUNT = ADVANCED_FEATURES.length;

/**
 * Plan overlays owned by the advanced kit: collision boxes around overlapping
 * footprints, emphasised for the piece being dragged. Drawn in plan-pixel
 * space, after the fixtures.
 */
export function drawAdvancedOverlays(ctx, { fixtures = [], state = {}, dragged = null } = {}) {
    if (state.collisionDetect === false) return;

    const overlaps = findOverlaps(fixtures).filter((pair) => (
        !dragged || pair.a === dragged || pair.b === dragged
    ));
    const dragValid = dragged ? state.dragValid : null;
    const showGhost = Boolean(dragged) && state.ghostPreview !== false && dragValid != null;

    if (overlaps.length === 0 && !showGhost) return;

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);

    if (overlaps.length) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        overlaps.forEach(({ box }) => {
            ctx.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
            ctx.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
        });
    }

    if (showGhost) {
        // Outline the whole moving footprint: green when the spatial index found
        // no intersection, red when the piece would land inside something else.
        const box = boundsOf(dragged);
        ctx.setLineDash([]);
        ctx.strokeStyle = dragValid ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)';
        ctx.fillStyle = dragValid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.14)';
        ctx.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
        ctx.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
    }

    ctx.restore();
}
