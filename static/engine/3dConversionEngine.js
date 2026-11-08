import * as THREE from 'three';
import { GLOBAL_CONFIG } from '../core/metadata.js';
import { ConversionEngine3D } from './ConversionEngine3D.js';

// Legacy entry point: the class lives in ConversionEngine3D.js, but older
// modules import it from here. Re-export so both paths keep working.
export { ConversionEngine3D };

const toPoint = (point) => {
    if (!point) return null;
    if (Array.isArray(point)) return { x: point[0], y: point[1] };
    if (typeof point.x === 'number' && typeof point.y === 'number') {
        return { x: point.x, y: point.y };
    }
    return null;
};

const centroidOf = (points) => {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    const total = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: total.x / points.length, y: total.y / points.length };
};

/**
 * Turn a room's vertex list into a THREE.Shape suitable for extrusion.
 * Accepts [{x, y}] or [[x, y]] and returns null for degenerate rings.
 */
export function generateRoomShape(vertices) {
    if (!Array.isArray(vertices) || vertices.length < 3) return null;

    const points = vertices.map(toPoint).filter(Boolean);
    if (points.length < 3) return null;

    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].y);
    }
    shape.closePath();

    return shape;
}

/**
 * Normalise any supported floor plan shape into the structure the React
 * scene expects:
 *   { rooms: [{ id, name, walls, floorVertices, center }],
 *     walls: [{ start, end, length, angle, thickness, hasOpening }],
 *     dimensions: { width, height } }
 *
 * Supported inputs:
 *   - { rooms: [{ walls, floorVertices }] }   (already vectorised plans)
 *   - { width, height, walls }               (FloorPlanProcessor output, pixels)
 *   - { walls, fixtures }                    (legacy template data)
 *
 * Pixel-based plans are converted to metres using GLOBAL_CONFIG.pixelsPerMeter.
 */
export function convert2DTo3D(floorPlanData = {}, options = {}) {
    const data = floorPlanData || {};
    const roomInputs = Array.isArray(data.rooms) ? data.rooms : [];
    const topLevelWalls = Array.isArray(data.walls) ? data.walls : [];

    const wallInputs = topLevelWalls.concat(
        ...roomInputs.map((room) => (Array.isArray(room.walls) ? room.walls : []))
    );

    const rawPoints = [];
    wallInputs.forEach((wall) => {
        const start = toPoint(wall?.start);
        const end = toPoint(wall?.end);
        if (start) rawPoints.push(start);
        if (end) rawPoints.push(end);
    });
    roomInputs.forEach((room) => {
        (Array.isArray(room.floorVertices) ? room.floorVertices : []).forEach((vertex) => {
            const point = toPoint(vertex);
            if (point) rawPoints.push(point);
        });
    });

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    rawPoints.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    });

    if (!Number.isFinite(minX)) {
        minX = 0;
        minY = 0;
        maxX = Number(data.width) || 0;
        maxY = Number(data.height) || 0;
    }

    const rawWidth = maxX - minX;
    const rawHeight = maxY - minY;

    // Plans produced by the image processor are in pixels; plans authored by
    // hand (or the mock data) are already in metres.
    const scale = Number(options.scale) || Number(data.scale) ||
        (Math.max(rawWidth, rawHeight) > 50 ? 1 / GLOBAL_CONFIG.pixelsPerMeter : 1);

    const scalePoint = (point) => {
        const value = toPoint(point);
        if (!value) return null;
        return { x: (value.x - minX) * scale, y: (value.y - minY) * scale };
    };

    const wallThickness = Number(options.wallThickness) || GLOBAL_CONFIG.wallThickness;
    const wallHeight = Number(options.wallHeight) || GLOBAL_CONFIG.wallHeight;

    const normalizeWall = (wall = {}) => {
        const start = scalePoint(wall.start) || { x: 0, y: 0 };
        const end = scalePoint(wall.end) || { x: 0, y: 0 };
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        return {
            ...wall,
            id: wall.id,
            start,
            end,
            length: Math.hypot(dx, dy),
            angle: Math.atan2(dy, dx),
            thickness: typeof wall.thickness === 'number' ? wall.thickness * scale : wallThickness,
            hasOpening: Boolean(wall.hasOpening ?? wall.opening ?? wall.door ?? wall.window)
        };
    };

    const rooms = roomInputs.map((room, index) => {
        const roomWalls = (Array.isArray(room.walls) ? room.walls : []).map(normalizeWall);
        let floorVertices = (Array.isArray(room.floorVertices) ? room.floorVertices : [])
            .map(scalePoint)
            .filter(Boolean);

        if (floorVertices.length < 3 && roomWalls.length >= 3) {
            floorVertices = roomWalls.map((wall) => wall.start);
        }

        const center = scalePoint(room.center) || centroidOf(floorVertices);

        return {
            ...room,
            id: room.id ?? `room_${index}`,
            name: room.name ?? `Room ${index + 1}`,
            type: room.type ?? 'generic',
            walls: roomWalls,
            floorVertices,
            center
        };
    });

    const walls = topLevelWalls.length > 0
        ? topLevelWalls.map(normalizeWall)
        : rooms.flatMap((room) => room.walls);

    // A plan with outline walls but no room list still needs a floor to render.
    if (rooms.length === 0 && walls.length >= 3) {
        rooms.push({
            id: 'room_0',
            name: data.name || 'Floor Plan',
            type: 'generic',
            walls,
            floorVertices: walls.map((wall) => wall.start),
            center: centroidOf(walls.map((wall) => wall.start))
        });
    }

    const dimensions = {
        width: rawWidth > 0 ? Math.round(rawWidth * scale * 1000) / 1000 : Number(data.width) || 0,
        height: rawHeight > 0 ? Math.round(rawHeight * scale * 1000) / 1000 : Number(data.height) || 0
    };

    return {
        ...data,
        dimensions,
        bounds: { minX: 0, minY: 0, maxX: dimensions.width, maxY: dimensions.height },
        rooms,
        walls,
        wallHeight,
        wallThickness,
        units: scale === 1 ? 'm' : 'px'
    };
}
