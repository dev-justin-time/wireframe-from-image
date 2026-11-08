import { WALL_HEIGHT } from '../core/world-space.js';
import { graphFromWalls } from '../core/floorplan-graph.js';
import { findRooms, polygonArea } from '../core/measurements.js';
import { wallHeightOf } from './wall-finish.js';

/**
 * Room area and volume readout.
 *
 * Area is the shoelace area of each closed face in the wall graph (the same
 * walk measurements.findRooms uses); volume is that area times the mean height
 * of the walls that enclose the plan, so horizontal walls and half walls are
 * reflected in the number.
 */
export function roomMetrics({ walls = [], view = { width: 1, height: 1 }, wallHeight = WALL_HEIGHT } = {}) {
    const heights = (walls || []).map((wall) => wallHeightOf(wall, wallHeight));
    const meanHeight = heights.length
        ? heights.reduce((total, value) => total + value, 0) / heights.length
        : wallHeight;

    const graph = graphFromWalls(walls, view, { snapPixels: 2 });
    const rooms = findRooms(graph)
        .map((room) => ({
            id: room.id,
            area: polygonArea(room.vertices),
            centroid: room.centroid,
            vertices: room.vertices
        }))
        .filter((room) => room.area >= 0.01)
        .map((room) => ({ ...room, volume: room.area * meanHeight }));

    const totalArea = rooms.reduce((total, room) => total + room.area, 0);
    const totalVolume = rooms.reduce((total, room) => total + room.volume, 0);

    return {
        rooms,
        count: rooms.length,
        totalArea,
        totalVolume,
        meanHeight
    };
}

export function formatMetrics(metrics) {
    if (!metrics || metrics.count === 0) return '—';
    return `${metrics.count} room${metrics.count === 1 ? '' : 's'} · ${metrics.totalArea.toFixed(1)} m² · ${metrics.totalVolume.toFixed(1)} m³`;
}
