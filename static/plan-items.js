// Placed items: the plan keeps them in metres, while the vendored item, snap and
// elevation-drag helpers work in their own plan-pixel space (30 px per metre,
// centred on the plan). This module owns that mapping so the 2D editor, the 3D
// scene and the elevation drag all agree.
import { ITEM_METADATA } from './engines/core/metadata.js';
import { ItemFactory, itemDimensions } from './engines/core/items.js';
import { PIXELS_PER_METER } from './engines/core/world-space.js';

const n = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, digits = 3) => Math.round(n(value) * 10 ** digits) / 10 ** digits;
const titleCase = (type) => String(type).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

/** Floor-standing pieces only: wall-mounted ones have no run to snap to. */
export const PALETTE = [
  'sofa', 'armchair', 'coffee_table', 'dining_table', 'dining_chair', 'desk', 'office_chair',
  'bed_queen', 'wardrobe', 'nightstand', 'kitchen_cabinet', 'fridge', 'toilet', 'sink',
  'bathtub', 'potted_plant', 'floor_lamp', 'rug_large',
];

export function palette() {
  return PALETTE.map((type) => {
    const meta = ITEM_METADATA[type] || {};
    const { width, depth, height } = itemDimensions({ type, metadata: meta });
    return {
      type,
      label: meta.label || titleCase(type),
      width,
      depth,
      height,
      color: meta.color ?? 0x999999,
    };
  });
}

/**
 * The plan-pixel space the vendored helpers expect: x/z in metres become px,
 * measured from the plan's lower corner, with the view spanning the plan.
 * That makes `(px - view.width / 2) / PIXELS_PER_METER` land back on the
 * plan's centred world coordinates, which is where the 3D scene builds.
 *
 * Pass `bounds` when the caller already knows them (the 3D scene spans the room
 * polygons as well as the walls): the drag places meshes from this mapping, so
 * it has to be the same rectangle the scene centred on or a dragged piece jumps.
 */
export function itemSpace(plan, bounds = null) {
  const walls = (plan?.walls ?? [])
    .map((wall) => ({ x1: n(wall.x1), y1: n(wall.y1), x2: n(wall.x2), y2: n(wall.y2) }))
    .filter((wall) => [wall.x1, wall.y1, wall.x2, wall.y2].every(Number.isFinite));
  const xs = walls.length ? walls.flatMap((wall) => [wall.x1, wall.x2]) : [0, 1];
  const zs = walls.length ? walls.flatMap((wall) => [wall.y1, wall.y2]) : [0, 1];
  const given = bounds && ['minX', 'maxX', 'minZ', 'maxZ']
    .every((key) => Number.isFinite(Number(bounds[key]))) ? bounds : null;
  const minX = given ? Number(given.minX) : Math.min(...xs);
  const maxX = given ? Number(given.maxX) : Math.max(...xs);
  const minZ = given ? Number(given.minZ) : Math.min(...zs);
  const maxZ = given ? Number(given.maxZ) : Math.max(...zs);
  const width = Math.max(maxX - minX, 1e-3);
  const depth = Math.max(maxZ - minZ, 1e-3);
  return {
    minX,
    minZ,
    width,
    depth,
    view: { width: width * PIXELS_PER_METER, height: depth * PIXELS_PER_METER },
    toPixels: (x, z) => ({ x: (n(x) - minX) * PIXELS_PER_METER, y: (n(z) - minZ) * PIXELS_PER_METER }),
    toMetres: (px, py) => ({ x: n(px) / PIXELS_PER_METER + minX, z: n(py) / PIXELS_PER_METER + minZ }),
  };
}

/** The plan's items, normalised: metres, finite numbers, a stable id. */
export function planItems(plan) {
  return (plan?.items ?? [])
    .filter((item) => item && typeof item.type === 'string' && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.z)))
    .map((item, index) => ({
      ...item,
      id: String(item.id || `item_${index}`),
      x: n(item.x),
      z: n(item.z),
      rotation: n(item.rotation),
      elevation: n(item.elevation),
    }));
}

/** Item instances in the vendored contract (plan pixels), for snap and drag. */
export function itemObjects(plan) {
  const space = itemSpace(plan);
  return planItems(plan).map((item) => {
    const at = space.toPixels(item.x, item.z);
    const object = ItemFactory.create(item.type, at.x, at.y, item.rotation, item.id);
    object.elevation = item.elevation;
    return object;
  });
}

/** Write dragged instances back into the plan, matched by id. */
export function applyItemObjects(plan, objects = []) {
  const space = itemSpace(plan);
  const byId = new Map(objects.map((object) => [object.id, object]));
  const items = planItems(plan).map((item) => {
    const object = byId.get(item.id);
    if (!object) return item;
    const at = space.toMetres(object.x, object.y);
    return {
      ...item,
      x: round(at.x),
      z: round(at.z),
      rotation: round(object.rotation ?? item.rotation),
      elevation: round(object.elevation ?? item.elevation),
    };
  });
  return { ...plan, items };
}

export function addItem(plan, type, { x = null, z = null, rotation = 0 } = {}) {
  const meta = ITEM_METADATA[type] || {};
  const space = itemSpace(plan);
  const item = {
    id: `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    x: round(x ?? space.minX + space.width / 2),
    z: round(z ?? space.minZ + space.depth / 2),
    rotation: round(rotation),
    elevation: 0,
  };
  return { plan: { ...plan, items: [...planItems(plan), item] }, item, label: meta.label || titleCase(type) };
}

export function removeItem(plan, id) {
  return { ...plan, items: planItems(plan).filter((item) => item.id !== id) };
}

/** Geometry for drawing and building: metres, the footprint and its lift. */
export function itemBoxes(plan) {
  return planItems(plan).map((item) => {
    const meta = ITEM_METADATA[item.type] || {};
    const size = itemDimensions({ type: item.type, metadata: meta, size: item.size ?? null });
    return {
      id: item.id,
      type: item.type,
      label: meta.label || titleCase(item.type),
      x: item.x,
      z: item.z,
      rotation: item.rotation,
      elevation: item.elevation,
      width: size.width,
      depth: size.depth,
      height: size.height,
      bottom: n(meta.mountHeight) + item.elevation,
      color: meta.color ?? 0x999999,
    };
  });
}

export function itemsSummary(plan) {
  return itemBoxes(plan).map((box) => ({
    ...box,
    area: Math.round(box.width * box.depth * 100) / 100,
  }));
}
