import { PIXELS_PER_METER } from '../core/world-space.js';

/**
 * Plan annotations that live in screen space: a north arrow and a scale bar.
 * Both are drawn against the viewport, so they stay put while the plan pans
 * and zooms.
 */

export function drawNorthArrow(ctx, { width = 0, x = width - 42, y = 42, label = 'N' } = {}) {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x - 7, y + 8);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x + 7, y + 8);
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 20);
    ctx.restore();
}

/**
 * A bar that is exactly `metres` long at the current scale, with end ticks and
 * a label, so the plan can be read without a ruler on screen.
 */
export function drawScaleBar(ctx, {
    width = 0,
    height = 0,
    scale = PIXELS_PER_METER,
    metres = 1,
    x = 20,
    y = height - 26
} = {}) {
    const barPixels = metres * scale;
    if (!Number.isFinite(barPixels) || barPixels <= 0) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + barPixels, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.moveTo(x + barPixels, y - 4);
    ctx.lineTo(x + barPixels, y + 4);
    ctx.stroke();

    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${metres} m`, x + barPixels + 6, y);
    ctx.restore();
}
