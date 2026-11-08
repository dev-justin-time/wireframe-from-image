import { planToWorld, PIXELS_PER_METER, WALL_HEIGHT } from '../../core/world-space.js';
import { graphFromWalls } from '../../core/floorplan-graph.js';
import { findRooms, polygonCentroid } from '../../core/measurements.js';
import { TEXTURES, textureUrlFor } from '../../core/metadata.js';

/**
 * Studio feature 38 - room surfaces.
 *
 * A storey floor is no longer one 40x40 slab: every closed room becomes its own
 * surface with its own floor material, so a tiled kitchen and a carpeted living
 * room can share a storey. Vertices come from the wall graph, are converted to
 * world metres through world-space.js, and stair openings from the storey below
 * become holes in the surface.
 */

export const FLOOR_TEXTURES = Object.keys(TEXTURES.floors);

const round = (value) => Math.round(value * 1000) / 1000;

/**
 * Rooms for one storey.
 *   materials: { [roomId]: { texture, color } }
 * Returns [{ id, area, centroid, vertices (world x/z), texture, color }].
 */
export function roomSurfacesFromWalls(walls = [], view = { width: 1, height: 1 }, options = {}) {
    if (!walls || walls.length < 3) return [];

    const graph = graphFromWalls(walls, view, { snapPixels: 2 });
    const rooms = findRooms(graph).filter((room) => room.area >= 0.25);
    const materials = options.materials || {};
    const defaultTexture = options.defaultTexture ?? 'tile';

    return rooms.map((room, index) => {
        const id = room.id || `room_${index + 1}`;
        const material = materials[id] || {};
        const centroid = polygonCentroid(room.vertices);

        return {
            id,
            area: room.area,
            centroid: { x: round(centroid.x), z: round(centroid.z) },
            // Room vertices are plan metres; the floor mesh consumes world x/z.
            vertices: room.vertices.map((point) => ({ x: round(point.x), z: round(point.z) })),
            texture: material.texture ?? defaultTexture,
            color: material.color ?? null
        };
    });
}

/** Stair openings (world rectangles) that a storey's floor must cut. */
export function stairOpenings(items = [], view = { width: 1, height: 1 }) {
    return (items || [])
        .filter((item) => item?.type === 'stair' && item.visible !== false)
        .map((item) => {
            const world = planToWorld({
                x: (item.x - view.width / 2) / PIXELS_PER_METER,
                z: (item.y - view.height / 2) / PIXELS_PER_METER
            });
            return {
                x: world.x,
                z: world.z,
                width: item.size?.width ?? item.metadata?.width ?? 1,
                depth: item.size?.depth ?? item.metadata?.depth ?? 2.6,
                rotation: item.rotation || 0
            };
        });
}

/** Add or change one room's floor material. Store keyed by room id. */
export function assignRoomMaterial(materials, roomId, patch = {}) {
    if (!roomId) return null;
    materials[roomId] = { ...(materials[roomId] || {}), ...patch };
    return materials[roomId];
}

export function floorTextureUrl(textureId) {
    return textureUrlFor(textureId, 'floors');
}

/**
 * The four corners of a rotated opening in world space, for Shape holes or
 * point-in-room tests.
 */
export function openingCorners(opening) {
    const halfW = opening.width / 2;
    const halfD = opening.depth / 2;
    const cos = Math.cos(opening.rotation || 0);
    const sin = Math.sin(opening.rotation || 0);
    return [[-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD]]
        .map(([x, z]) => ({
            x: opening.x + x * cos - z * sin,
            z: opening.z + x * sin + z * cos
        }));
}

/** True when a point is inside a room polygon of world vertices. */
export function pointInRoom(point, vertices = []) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const a = vertices[i];
        const b = vertices[j];
        if ((a.z > point.z) !== (b.z > point.z)) {
            const x = ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z || 1e-9) + a.x;
            if (point.x < x) inside = !inside;
        }
    }
    return inside;
}

/** Openings whose centre belongs to a room (used to cut that room's surface). */
export function openingsForRoom(room, openings = []) {
    return openings.filter((opening) => pointInRoom({ x: opening.x, z: opening.z }, room.vertices));
}

export function totalFloorArea(rooms = []) {
    return rooms.reduce((total, room) => total + room.area, 0);
}

export function roomFloorMaterialSummary(rooms = []) {
    return rooms.map((room) => ({
        id: room.id,
        texture: room.texture,
        area: room.area
    }));
}

/** Height of a storey, falling back to the global storey height. */
export function storeyHeight(story) {
    return typeof story?.height === 'number' && story.height > 0 ? story.height : WALL_HEIGHT;
}

/** Plan point -> world point helper kept here so callers agree on the mapping. */
export function planPointToWorld(point, height = 0) {
    return planToWorld(point, height);
}
