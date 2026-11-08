import { PIXELS_PER_METER, WALL_HEIGHT, planToCanvas, planToWorld } from '../core/world-space.js';
import { graphFromWalls } from '../core/floorplan-graph.js';
import { findRooms, formatArea, polygonCentroid } from '../core/measurements.js';

/**
 * Room labels.
 *
 * The polygon (and therefore its centroid) comes from the wall graph, the
 * centroid is converted with world-space.js, and the 3D label is the same
 * canvas-sprite technique the measurement labels use. Nothing here talks to
 * three.js directly: the caller passes THREE in, so this module also runs in a
 * plain node process for tests.
 */

/** Rooms with a label model attached, in plan metres, canvas pixels and world metres. */
export function roomLabelsFromWalls(walls = [], view = { width: 1, height: 1 }, options = {}) {
    if (!walls || walls.length < 3) return [];

    const graph = graphFromWalls(walls, view, { snapPixels: 2 });
    const rooms = findRooms(graph).filter((room) => room.area >= 0.5);

    return rooms.map((room, index) => {
        const centroid = polygonCentroid(room.vertices);
        const height = options.wallHeight ?? WALL_HEIGHT;
        return {
            id: room.id || `room_${index + 1}`,
            name: `Room ${index + 1}`,
            area: room.area,
            volume: room.area * height,
            centroidPlan: { x: centroid.x, z: centroid.z },
            centroidCanvas: planToCanvas({ x: centroid.x, z: centroid.z }, view),
            world: planToWorld({ x: centroid.x, z: centroid.z }, options.labelHeight ?? 0.18),
            vertices: room.vertices
        };
    });
}

/** Draw the labels into the plan canvas (already in plan-pixel space). */
export function drawRoomLabels(ctx, labels = []) {
    if (!labels.length) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach((room) => {
        const point = room.centroidCanvas;
        if (!point) return;

        const title = `${formatArea(room.area)}`;
        const detail = `${room.volume.toFixed(1)} m³`;

        ctx.font = 'bold 12px "Space Grotesk", sans-serif';
        const titleWidth = ctx.measureText(title).width;
        ctx.font = '10px ui-monospace, monospace';
        const detailWidth = ctx.measureText(detail).width;

        const boxWidth = Math.max(titleWidth, detailWidth) + 14;
        const boxHeight = 32;
        const x = point.x - boxWidth / 2;
        const y = point.y - boxHeight / 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, boxWidth, boxHeight, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.font = 'bold 12px "Space Grotesk", sans-serif';
        ctx.fillText(title, point.x, point.y - 6);

        ctx.fillStyle = 'rgba(71, 85, 105, 0.9)';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(detail, point.x, point.y + 9);
    });

    ctx.restore();
}

/** Sprite for a room label in a three.js scene. */
export function createRoomLabelSprite(THREE, room) {
    const title = formatArea(room.area);
    const detail = `${room.volume.toFixed(1)} m³`;

    const fontSize = 48;
    const detailSize = 34;
    const padding = 30;

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    measureCtx.font = `bold ${fontSize}px sans-serif`;
    const titleWidth = measureCtx.measureText(title).width;
    measureCtx.font = `${detailSize}px monospace`;
    const detailWidth = measureCtx.measureText(detail).width;

    const width = Math.ceil(Math.max(titleWidth, detailWidth)) + padding * 2;
    const height = Math.ceil(fontSize * 1.4 + detailSize * 1.4) + padding;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillText(title, width / 2, padding * 0.6 + fontSize * 0.6);

    ctx.fillStyle = '#475569';
    ctx.font = `${detailSize}px monospace`;
    ctx.fillText(detail, width / 2, padding * 0.6 + fontSize * 1.2 + detailSize * 0.5);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
    }));

    const spriteHeight = 0.32;
    sprite.scale.set(spriteHeight * (width / height), spriteHeight, 1);
    return sprite;
}
