import { graphFromWalls } from '../../core/floorplan-graph.js';
import { findRooms, polygonCentroid } from '../../core/measurements.js';
import { itemDimensions } from '../../core/items.js';

/**
 * Advanced feature 33 - item count and cost summary per room.
 *
 * Reuses the room polygons from the wall graph and the cut-list's grouping idea
 * (type + size), but keeps each piece in the room that contains its centre and
 * prices it: per-type override first, then the line's base price.
 */

export const UNIT_PRICES = {
    merlot_base_cabinet: 320,
    merlot_drawer_base: 340,
    merlot_sink_base: 360,
    merlot_corner_base: 380,
    merlot_wall_cabinet: 240,
    merlot_wall_cabinet_double: 280,
    merlot_tall_pantry: 720,
    merlot_oven_tower: 760,
    merlot_island: 1180,
    shaker_base_cabinet: 290,
    shaker_drawer_base: 310,
    shaker_sink_base: 330,
    shaker_wall_cabinet: 220,
    shaker_wall_cabinet_double: 250,
    shaker_tall_pantry: 660,
    shaker_island: 1090,
    kitchen_cabinet: 180,
    kitchen_island: 640,
    fridge: 900,
    stove: 700,
    sofa: 850,
    bed_queen: 700,
    desk: 260,
    dining_table: 420
};

export const LINE_PRICES = {
    merlot: 300,
    shaker: 270
};

export const DEFAULT_UNIT_PRICE = 120;

export function priceOf(item) {
    if (!item) return 0;
    if (typeof item.metadata?.price === 'number') return item.metadata.price;
    if (typeof UNIT_PRICES[item.type] === 'number') return UNIT_PRICES[item.type];
    if (item.metadata?.line && typeof LINE_PRICES[item.metadata.line] === 'number') return LINE_PRICES[item.metadata.line];
    return DEFAULT_UNIT_PRICE;
}

/** Ray-casting point-in-polygon over plan metres. */
export function pointInPolygon(point, polygon = []) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        if ((a.z > point.z) !== (b.z > point.z)) {
            const x = ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z || 1e-9) + a.x;
            if (point.x < x) inside = !inside;
        }
    }
    return inside;
}

export function roomsOf(walls = [], view = { width: 1, height: 1 }) {
    if (!walls || walls.length < 3) return [];
    const graph = graphFromWalls(walls, view, { snapPixels: 2 });
    return findRooms(graph)
        .filter((room) => room.area >= 0.5)
        .map((room, index) => ({
            id: room.id || `room_${index + 1}`,
            label: `Room ${index + 1}`,
            area: room.area,
            centroid: polygonCentroid(room.vertices),
            vertices: room.vertices
        }));
}

/**
 * Count and cost per room. `pixelsPerMetre` converts a fixture's plan pixels to
 * the metres the room polygons use.
 */
export function summarizeByRoom({ fixtures = [], walls = [], view = { width: 1, height: 1 }, pixelsPerMetre = 30 } = {}) {
    const rooms = roomsOf(walls, view).map((room) => ({
        ...room,
        count: 0,
        cost: 0,
        types: {}
    }));

    const unassigned = { id: 'unassigned', label: 'Outside any room', count: 0, cost: 0, types: {} };

    (fixtures || []).forEach((fixture) => {
        if (!fixture || fixture.visible === false) return;

        const plan = {
            x: (fixture.x - view.width / 2) / pixelsPerMetre,
            z: (fixture.y - view.height / 2) / pixelsPerMetre
        };
        const room = rooms.find((candidate) => pointInPolygon(plan, candidate.vertices));
        const bucket = room || unassigned;
        const price = priceOf(fixture);

        bucket.count += 1;
        bucket.cost += price;
        bucket.types[fixture.type] = (bucket.types[fixture.type] || 0) + 1;
    });

    if (unassigned.count > 0) rooms.push(unassigned);

    return {
        rooms,
        totals: {
            count: rooms.reduce((total, room) => total + room.count, 0),
            cost: rooms.reduce((total, room) => total + room.cost, 0),
            volume: rooms.reduce((total, room) => total + (room.area || 0), 0)
        }
    };
}

/** One line per room, e.g. "Room 1 · 6 items · $2,140". */
export function formatSummary(summary) {
    if (!summary?.rooms?.length) return [];
    const money = (value) => `$${Math.round(value).toLocaleString('en-US')}`;
    return summary.rooms.map((room) => `${room.label} · ${room.count} item${room.count === 1 ? '' : 's'} · ${money(room.cost)}`);
}

export function itemSizesOf(fixtures = []) {
    const sizes = new Map();
    fixtures.forEach((fixture) => {
        const dims = itemDimensions(fixture);
        sizes.set(fixture.id, dims);
    });
    return sizes;
}
