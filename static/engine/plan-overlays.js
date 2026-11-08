import { PIXELS_PER_METER as SCALE } from '../core/world-space.js';
import { itemDimensions } from '../core/items.js';
import { drawFeatureOverlays } from '../features/index.js';
import { drawNorthArrow, drawScaleBar } from '../features/annotations.js';
import { drawAdvancedOverlays } from '../features/advanced/index.js';

const metres = (pixels) => pixels / SCALE;
const label = (metresValue, digits = 2) => `${metresValue.toFixed(digits)} m`;

/** Axis-aligned bounds of a rotated rectangle centred on the fixture. */
function fixtureBounds(fixture) {
    const dims = itemDimensions(fixture);
    const width = dims.width * SCALE;
    const depth = dims.depth * SCALE;
    const cos = Math.abs(Math.cos(fixture.rotation || 0));
    const sin = Math.abs(Math.sin(fixture.rotation || 0));
    const halfW = (width * cos + depth * sin) / 2;
    const halfD = (width * sin + depth * cos) / 2;
    return { minX: fixture.x - halfW, maxX: fixture.x + halfW, minY: fixture.y - halfD, maxY: fixture.y + halfD };
}

function boundsIntersect(a, b) {
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Overlays drawn inside the plan transform (they follow pan/zoom).
 * Called by the editor after walls and fixtures are painted.
 */
export function drawPlanOverlays(ctx, model) {
    const {
        walls = [],
        fixtures = [],
        state = {},
        selected = null,
        selectedWallId = null,
        ruler = null,
        roomLabels = [],
        snapGuide = null,
        dragged = null
    } = model;

    // Wall hatching: a second, inset line makes thin walls read as solid.
    if (state.wallHatch) {
        ctx.save();
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
        ctx.lineWidth = 1;
        walls.forEach((wall) => {
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const length = Math.hypot(dx, dy) || 1;
            const nx = (-dy / length) * 3;
            const ny = (dx / length) * 3;
            ctx.beginPath();
            ctx.moveTo(wall.start.x + nx, wall.start.y + ny);
            ctx.lineTo(wall.end.x + nx, wall.end.y + ny);
            ctx.stroke();
        });
        ctx.restore();
    }

    // Room area from the wall bounds.
    if (state.areas && walls.length >= 2) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        walls.forEach((wall) => {
            minX = Math.min(minX, wall.start.x, wall.end.x);
            maxX = Math.max(maxX, wall.start.x, wall.end.x);
            minY = Math.min(minY, wall.start.y, wall.end.y);
            maxY = Math.max(maxY, wall.start.y, wall.end.y);
        });
        const area = metres(maxX - minX) * metres(maxY - minY);
        ctx.save();
        ctx.font = 'bold 12px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.fillText(`${area.toFixed(1)} m²`, (minX + maxX) / 2, (minY + maxY) / 2);
        ctx.restore();
    }

    // Wall handles.
    if (state.vertices) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.5;
        walls.forEach((wall) => {
            [wall.start, wall.end].forEach((point) => {
                ctx.beginPath();
                ctx.rect(point.x - 3.5, point.y - 3.5, 7, 7);
                ctx.fill();
                ctx.stroke();
            });
        });
        ctx.restore();
    }

    fixtures.forEach((fixture) => {
        const hidden = fixture.visible === false;
        if (hidden && !state.showHidden) return;

        const dims = itemDimensions(fixture);
        const width = dims.width * SCALE;
        const depth = dims.depth * SCALE;

        ctx.save();
        ctx.translate(fixture.x, fixture.y);
        ctx.rotate(fixture.rotation || 0);
        ctx.globalAlpha = hidden ? 0.5 : 1;

        // Door swing arc.
        if (state.doorArcs && fixture.type === 'door') {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(180, 83, 9, 0.6)';
            ctx.lineWidth = 1;
            ctx.arc(-width / 2, -depth / 2, width, 0, Math.PI / 2);
            ctx.stroke();
        }

        // Window glazing ticks.
        if (state.windowMarks && fixture.type === 'window') {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(30, 64, 175, 0.5)';
            ctx.lineWidth = 1;
            for (let i = -1; i <= 1; i++) {
                ctx.moveTo((i * width) / 3, -depth / 2);
                ctx.lineTo((i * width) / 3, depth / 2);
            }
            ctx.stroke();
        }

        // Item labels and sizes.
        if (state.itemLabels) {
            ctx.save();
            ctx.rotate(-(fixture.rotation || 0));
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillText(fixture.metadata?.label || fixture.type.replace(/_/g, ' '), 0, -depth / 2 - 12);
            ctx.restore();
        }
        if (state.itemDims) {
            ctx.save();
            ctx.rotate(-(fixture.rotation || 0));
            ctx.font = '9px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(71, 85, 105, 0.9)';
            ctx.fillText(`${Math.round(metres(width) * 100)}×${Math.round(metres(depth) * 100)} cm`, 0, depth / 2 + 12);
            ctx.restore();
        }
        ctx.restore();
    });

    // Selection halo.
    if (state.halo && selected) {
        const selectedDims = itemDimensions(selected);
        const radius = Math.max(selectedDims.width * SCALE, selectedDims.depth * SCALE) * 0.75;
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.arc(selected.x, selected.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Overlap warning between visible items.
    if (state.collisionWarn) {
        const visible = fixtures.filter((fixture) => fixture.visible !== false);
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 2;
        for (let i = 0; i < visible.length; i++) {
            for (let j = i + 1; j < visible.length; j++) {
                const a = fixtureBounds(visible[i]);
                const b = fixtureBounds(visible[j]);
                if (!boundsIntersect(a, b)) continue;
                ctx.strokeRect(
                    Math.max(a.minX, b.minX),
                    Math.max(a.minY, b.minY),
                    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX),
                    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
                );
            }
        }
        ctx.restore();
    }

    // Ruler: two clicked points and the distance between them.
    if (state.ruler && ruler) {
        const { start, end, cursor } = ruler;
        const tip = end || cursor;
        if (start && tip) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(tip.x, tip.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#0ea5e9';
            [start, tip].forEach((point) => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
                ctx.fill();
            });

            const distance = metres(Math.hypot(tip.x - start.x, tip.y - start.y));
            ctx.font = 'bold 11px "Space Grotesk", sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            const text = label(distance);
            const width = ctx.measureText(text).width;
            const midX = (start.x + tip.x) / 2;
            const midY = (start.y + tip.y) / 2;
            ctx.fillRect(midX - width / 2 - 4, midY - 8, width + 8, 16);
            ctx.fillStyle = '#0369a1';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, midX, midY);
            ctx.restore();
        }
    }

    // Feature kit overlays: dimension chains, room labels, lift markers and
    // snap guides. They live in features/ so the editor stays a shell.
    drawFeatureOverlays(ctx, { walls, fixtures, state, roomLabels, snapGuide });

    // Advanced kit: collision boxes around overlapping footprints.
    drawAdvancedOverlays(ctx, { fixtures, state, dragged });
}

/**
 * Overlays drawn in screen space (fixed to the viewport, unaffected by
 * pan/zoom): border, north arrow, scale bar, cursor readout, legend.
 */
export function drawScreenOverlays(ctx, model) {
    const { state = {}, view, cursor, walls = [], fixtures = [], selectedWallId = null } = model;
    const width = view.width;
    const height = view.height;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textBaseline = 'middle';

    if (state.frame) {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);
    }

    if (state.north) {
        drawNorthArrow(ctx, { width, height });
    }

    if (state.scaleBar) {
        drawScaleBar(ctx, { width, height, scale: SCALE });
    }

    if (state.coords && cursor) {
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillText(`${metres(cursor.x).toFixed(2)}, ${metres(cursor.y).toFixed(2)} m`, width - 16, height - 18);
    }

    if (state.legend) {
        const hidden = fixtures.filter((fixture) => fixture.visible === false).length;
        const locked = fixtures.filter((fixture) => fixture.locked).length;
        const lines = [
            `Walls ${walls.length}`,
            `Items ${fixtures.length}`,
            `Hidden ${hidden}`,
            `Locked ${locked}`
        ];
        const boxWidth = 96;
        const boxHeight = 18 + lines.length * 14;
        const x = width - boxWidth - 16;
        const y = height - boxHeight - 16;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, boxWidth, boxHeight, 6);
        ctx.fill();
        ctx.stroke();
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        lines.forEach((line, index) => ctx.fillText(line, x + 8, y + 14 + index * 14));
    }

    ctx.restore();
}
