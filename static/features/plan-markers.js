import { PIXELS_PER_METER, WALL_THICKNESS } from '../core/world-space.js';
import { itemDimensions } from '../core/items.js';
import { wallNormal, extentAlong } from '../core/wall-snap.js';

/**
 * Plan markers for two things the plan could not show before:
 *
 *   lift marker   a piece lifted above the floor (its `elevation`) gets a
 *                 dashed outline where its footprint would sit on the floor,
 *                 with leader lines and the height, so a wall cabinet is not
 *                 mistaken for a floor cabinet in plan.
 *   snap guide    while a piece is flush against a wall, short guide lines mark
 *                 the edge that snapped - the seat line plus two ticks back to
 *                 the wall face.
 *
 * Everything here is plan-space canvas pixels, the space the editor draws in.
 */

const HALF_WALL_PX = (WALL_THICKNESS * PIXELS_PER_METER) / 2;

/** Dashed outline under a lifted piece, plus the height it is lifted by. */
export function drawLiftMarker(ctx, fixture, { scale = PIXELS_PER_METER, gap = 10 } = {}) {
    const lift = fixture?.elevation || 0;
    if (!fixture || Math.abs(lift) < 0.005) return;

    const { width, depth } = itemDimensions(fixture);
    const w = width * scale;
    const d = depth * scale;
    const offset = Math.abs(lift) * scale + gap;

    ctx.save();
    ctx.translate(fixture.x, fixture.y);
    ctx.rotate(fixture.rotation || 0);

    // Footprint where the piece would be on the floor, then its lifted self.
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
    ctx.lineWidth = 1.25;
    ctx.strokeRect(-w / 2, -d / 2 - offset, w, d);

    ctx.beginPath();
    ctx.moveTo(-w / 2, -d / 2);
    ctx.lineTo(-w / 2, -d / 2 - offset + d);
    ctx.moveTo(w / 2, -d / 2);
    ctx.lineTo(w / 2, -d / 2 - offset + d);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.rotate(-(fixture.rotation || 0));
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(3, 105, 161, 0.95)';
    ctx.fillText(`+${Math.abs(lift).toFixed(2)} m`, 0, -d / 2 - offset - 4);
    ctx.restore();
}

/**
 * Guide lines for a fixture snapped to a wall: the seat along the wall face and
 * two ticks from the fixture's near corners to the wall it is flush with.
 */
export function snapGuidesFor(fixture, wall, {
    scale = PIXELS_PER_METER,
    halfWallThickness = HALF_WALL_PX,
    length = 14
} = {}) {
    if (!fixture || !wall?.start || !wall?.end) return null;

    const { dir, normal } = wallNormal(wall);
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lenSq = dx * dx + dy * dy;
    if (!lenSq) return null;

    const t = Math.max(0, Math.min(1,
        ((fixture.x - wall.start.x) * dx + (fixture.y - wall.start.y) * dy) / lenSq));
    const point = { x: wall.start.x + dx * t, y: wall.start.y + dy * t };

    const side = (fixture.x - point.x) * normal.x + (fixture.y - point.y) * normal.y >= 0 ? 1 : -1;
    const outward = { x: normal.x * side, y: normal.y * side };

    const extent = extentAlong(fixture, outward);
    const halfAlong = extentAlong(fixture, dir);
    const contactDistance = halfWallThickness + extent;

    const contact = {
        x: point.x + outward.x * contactDistance,
        y: point.y + outward.y * contactDistance
    };

    const alongA = { x: contact.x - dir.x * halfAlong, y: contact.y - dir.y * halfAlong };
    const alongB = { x: contact.x + dir.x * halfAlong, y: contact.y + dir.y * halfAlong };
    const wallA = { x: point.x - dir.x * halfAlong, y: point.y - dir.y * halfAlong };
    const wallB = { x: point.x + dir.x * halfAlong, y: point.y + dir.y * halfAlong };

    return {
        contact,
        wall,
        distance: Math.hypot(fixture.x - contact.x, fixture.y - contact.y),
        segments: [
            { from: alongA, to: alongB, kind: 'seat' },
            { from: alongA, to: { x: alongA.x - outward.x * length, y: alongA.y - outward.y * length }, kind: 'tick' },
            { from: alongB, to: { x: alongB.x - outward.x * length, y: alongB.y - outward.y * length }, kind: 'tick' }
        ],
        wallLine: { from: wallA, to: wallB }
    };
}

export function drawSnapGuides(ctx, guides) {
    if (!guides) return;

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(20, 184, 166, 0.9)';
    ctx.setLineDash([5, 3]);
    guides.segments.forEach((segment) => {
        ctx.beginPath();
        ctx.moveTo(segment.from.x, segment.from.y);
        ctx.lineTo(segment.to.x, segment.to.y);
        ctx.stroke();
    });

    // The wall face itself, so the gap the guide closes is readable.
    if (guides.wallLine) {
        ctx.strokeStyle = 'rgba(20, 184, 166, 0.45)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(guides.wallLine.from.x, guides.wallLine.from.y);
        ctx.lineTo(guides.wallLine.to.x, guides.wallLine.to.y);
        ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(13, 148, 136, 0.95)';
    ctx.beginPath();
    ctx.arc(guides.contact.x, guides.contact.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
