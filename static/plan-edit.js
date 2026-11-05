// Plan editing on floorplan3d's geometry core.
//
// Walls arrive in the extractor's plan space (metres); the ported FloorPlanGraph
// welds shared corners, findRooms walks the faces, and the studio's plan shape
// is rebuilt from the result so every other screen sees the edit.
import { FloorPlanGraph } from './engines/core/floorplan-graph.js';
import { findRooms, wallMeasurements } from './engines/core/measurements.js';

const n = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, digits = 2) => Math.round(n(value) * 10 ** digits) / 10 ** digits;

export const MIN_WALL_M = 0.15;

/** A plan graph from metre walls; corners within the snap radius share a node. */
export function graphFromWalls(walls = []) {
  const graph = new FloorPlanGraph();
  for (const wall of walls) {
    const a = graph.nodeAt({ x: n(wall.x1), z: n(wall.y1) });
    const b = graph.nodeAt({ x: n(wall.x2), z: n(wall.y2) });
    graph.addEdge(a, b);
  }
  return graph;
}

const polygonPerimeter = (vertices = []) => vertices.reduce((total, vertex, index) => {
  const next = vertices[(index + 1) % vertices.length];
  return total + Math.hypot(next.x - vertex.x, next.z - vertex.z);
}, 0);

export function wallsBounds(walls = []) {
  if (!walls.length) return { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
  const xs = walls.flatMap((wall) => [n(wall.x1), n(wall.x2)]);
  const zs = walls.flatMap((wall) => [n(wall.y1), n(wall.y2)]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/**
 * Split a wall where another wall ends on it. The graph welds nodes, not points
 * on an edge, so without this a partition ending mid-span never closes a face.
 */
export function splitWallsAtJunctions(walls = [], tolerance = 0.02) {
  const ends = walls.flatMap((wall) => [
    { x: n(wall.x1), z: n(wall.y1) },
    { x: n(wall.x2), z: n(wall.y2) },
  ]);
  const out = [];
  for (const wall of walls) {
    const ax = n(wall.x1), az = n(wall.y1), bx = n(wall.x2), bz = n(wall.y2);
    const dx = bx - ax, dz = bz - az;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq < 1e-9) continue;
    const length = Math.sqrt(lengthSq);
    const cuts = [];
    for (const end of ends) {
      const t = ((end.x - ax) * dx + (end.z - az) * dz) / lengthSq;
      if (t <= tolerance / length || t >= 1 - tolerance / length) continue;
      if (Math.hypot(end.x - (ax + dx * t), end.z - (az + dz * t)) > tolerance) continue;
      if (!cuts.some((cut) => Math.abs(cut - t) < 1e-6)) cuts.push(t);
    }
    cuts.sort((left, right) => left - right);
    let from = 0;
    for (const t of cuts) {
      out.push({ x1: ax + dx * from, y1: az + dz * from, x2: ax + dx * t, y2: az + dz * t });
      from = t;
    }
    out.push({ x1: ax + dx * from, y1: az + dz * from, x2: bx, y2: bz });
  }
  return out;
}

/**
 * Rebuild the studio plan from edited walls. Rooms and areas come from the
 * graph, lengths from its measurements, extents from its nodes; the rest of the
 * previous plan (scale, openings, saved name/status) is carried over.
 */
export function planFromWalls(walls = [], previous = null) {
  const clean = walls
    .map((wall) => ({ x1: n(wall.x1), y1: n(wall.y1), x2: n(wall.x2), y2: n(wall.y2) }))
    .filter((wall) => Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) >= MIN_WALL_M);
  const split = splitWallsAtJunctions(clean);
  const graph = graphFromWalls(split);
  const lengths = wallMeasurements(graph);
  const rooms = findRooms(graph).map((room, index) => ({
    name: previous?.rooms?.[index]?.name ?? `Room ${index + 1}`,
    area: round(room.area),
    perimeter: round(polygonPerimeter(room.vertices)),
    centroid: { x: round(room.centroid.x), z: round(room.centroid.z) },
    polygon: room.vertices.map((vertex) => [round(vertex.x), round(vertex.z)]),
  }));
  const bounds = wallsBounds(split);
  const wallLength = lengths.reduce((sum, wall) => sum + wall.length, 0);
  const floorArea = rooms.reduce((sum, room) => sum + room.area, 0);
  // Sheet quantities below are the previous upload's unless recomputed here.
  const stale = Boolean(previous?.takeoff && previous.takeoff.drywallSheets !== undefined);
  return {
    ...(previous ?? {}),
    source: previous?.source ?? 'editor',
    edited: true,
    walls: split.map((wall, index) => ({
      ...wall,
      length: round(lengths[index]?.length ?? Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)),
    })),
    rooms,
    widthM: round(bounds.maxX - bounds.minX),
    depthM: round(bounds.maxZ - bounds.minZ),
    takeoff: {
      ...(previous?.takeoff ?? {}),
      wallLength: round(wallLength),
      floorArea: round(floorArea),
      wallCount: split.length,
      roomCount: rooms.length,
      ...(stale ? { stale: true } : {}),
    },
  };
}

export function addWall(walls = [], from, to) {
  if (!from || !to) return walls;
  if (Math.hypot(to.x - from.x, to.z - from.z) < MIN_WALL_M) return walls;
  return [...walls, { x1: from.x, y1: from.z, x2: to.x, y2: to.z }];
}

export function removeWall(walls = [], index) {
  return walls.filter((_, at) => at !== index);
}

/** The distinct corners of a wall set, with how many wall ends meet at each. */
export function planCorners(walls = [], tolerance = 1e-6) {
  const corners = [];
  for (const wall of walls) {
    for (const [x, z] of [[n(wall.x1), n(wall.y1)], [n(wall.x2), n(wall.y2)]]) {
      const found = corners.find((corner) => Math.hypot(corner.x - x, corner.z - z) <= tolerance);
      if (found) found.count += 1;
      else corners.push({ x, z, count: 1 });
    }
  }
  return corners;
}

/**
 * Move one corner: every wall end at `from` follows it, so a shared corner keeps
 * the room closed. Walls that collapse to nothing are dropped.
 */
export function moveCorner(walls = [], from, to, tolerance = 1e-6) {
  if (!from || !to) return walls;
  const at = (x, z) => Math.hypot(x - n(from.x), z - n(from.z)) <= tolerance;
  return walls
    .map((wall) => {
      const x1 = n(wall.x1), y1 = n(wall.y1), x2 = n(wall.x2), y2 = n(wall.y2);
      return {
        x1: at(x1, y1) ? to.x : x1,
        y1: at(x1, y1) ? to.z : y1,
        x2: at(x2, y2) ? to.x : x2,
        y2: at(x2, y2) ? to.z : y2,
      };
    })
    .filter((wall) => Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) >= MIN_WALL_M);
}

/**
 * Snap a plan point to a wall endpoint first, then to a 100 mm grid. `ignore`
 * drops one endpoint from the candidates, which is what lets a corner be dragged
 * without snapping straight back onto where it started.
 */
export function snapPoint(point, walls = [], { grid = 0.1, weld = 0.28, ignore = null } = {}) {
  let best = null;
  for (const wall of walls) {
    for (const [x, z] of [[n(wall.x1), n(wall.y1)], [n(wall.x2), n(wall.y2)]]) {
      if (ignore && Math.hypot(x - ignore.x, z - ignore.z) < 1e-6) continue;
      const distance = Math.hypot(point.x - x, point.z - z);
      if (distance <= weld && (!best || distance < best.distance)) best = { x, z, distance };
    }
  }
  if (best) return { x: round(best.x, 3), z: round(best.z, 3), snapped: 'endpoint' };
  return {
    x: round(Math.round(point.x / grid) * grid, 3),
    z: round(Math.round(point.z / grid) * grid, 3),
    snapped: 'grid',
  };
}

/** Fit plan metres into a canvas, y down, with a margin. */
export function canvasView(walls, width, height, margin = 30) {
  const bounds = wallsBounds(walls);
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1);
  const scale = Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanZ);
  const offsetX = (width - spanX * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - spanZ * scale) / 2 - bounds.minZ * scale;
  return {
    bounds,
    scale,
    toScreen: (x, z) => ({ x: offsetX + x * scale, y: offsetY + z * scale }),
    toPlan: (px, py) => ({ x: (px - offsetX) / scale, z: (py - offsetY) / scale }),
  };
}
