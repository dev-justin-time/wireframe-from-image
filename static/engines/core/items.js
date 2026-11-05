import { ITEM_METADATA } from './metadata.js';
import { PIXELS_PER_METER, WALL_HEIGHT, WALL_THICKNESS } from './world-space.js';

/**
 * Effective size of an item in metres. A per-item `size` override wins over the
 * type default in ITEM_METADATA, which is how resizing a placed piece works.
 */
export function itemDimensions(item) {
    const meta = item?.metadata || {};
    const size = item?.size || {};
    return {
        width: size.width ?? meta.width ?? 0.5,
        depth: size.depth ?? meta.depth ?? 0.5,
        height: size.height ?? meta.height ?? 0.5
    };
}

export class Item {
    constructor(type, x, y, rotation = 0, id = null) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        // Per-item dimension override ({ width, depth, height } in metres).
        this.size = null;
        this.id = id || 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.metadata = ITEM_METADATA[type] || { color: 0x999999 };
        this.selected = false;
        this.visible = true;
        // Locked pieces stay put: dragging, the 3D gizmo and elevation drags all
        // skip them, but they still render and can be selected.
        this.locked = false;
        // Per-axis position locks ({ x, z } booleans). A locked axis ignores
        // dragging in that direction while the other stays free.
        this.lockedAxes = { x: false, z: false };
        // Mirror state set by flipping the piece; the 3D builder mirrors the
        // mesh on the flipped axis so the plan and the model agree.
        this.flipped = { x: false, z: false };
        // Assemblies: pieces sharing a group id drag together.
        this.groupId = null;
        // Per-item override of the default mounting height (metres). null means
        // "use metadata.mountHeight", 0 for floor units.
        this.defaultBottom = null;
        this.modelUrl = null; // Support for custom 3D models
        // Metres the piece is lifted above its default height position (0 for
        // floor-standing pieces, which sit on the floor). Dragged up/down in
        // the elevation view.
        this.elevation = 0;
        // Parametric cabinet configuration ({ doorStyle, doors, drawers,
        // shelves, toeKick, counter }). null = use the line's fixed builder.
        this.config = null;
        // Stair design config (run type, code, available space, landings, support,
        // outdoor system). Copied from the type's metadata so a placed stair
        // starts with its preset; the stair suite reads it back.
        this.stair = this.metadata?.stair ? { ...this.metadata.stair } : null;
        // Landscape water-feature config (type, shape, depths, barrier, turnover).
        this.landscape = this.metadata?.landscape ? { ...this.metadata.landscape } : null;
    }
    
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Is this item allowed at a plan point? Called before a new piece is added
     * and before a drag commits. The item's rotated footprint is tested against
     * every wall centreline, so a cabinet can sit flush against a wall but can
     * no longer be dragged through one. In-wall pieces (doors, windows) belong
     * on the wall and skip the clearance test.
     */
    isValidPosition(x, y, { walls = [], wallThickness = WALL_THICKNESS } = {}) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const type = this.metadata?.type;
        if (type === 'in_wall' || type === 'in_wall_floor') return true;
        if (!Array.isArray(walls) || walls.length === 0) return true;

        const halfWall = (Number(wallThickness) || WALL_THICKNESS) * PIXELS_PER_METER / 2;
        const { width, depth } = itemDimensions(this);
        const halfWidth = width * PIXELS_PER_METER / 2;
        const halfDepth = depth * PIXELS_PER_METER / 2;
        const rotation = this.rotation || 0;
        const ux = Math.cos(rotation);
        const uy = Math.sin(rotation);
        const broad = Math.hypot(halfWidth, halfDepth) + halfWall;

        for (const wall of walls) {
            if (!wall?.start || !wall?.end) continue;
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const length = Math.hypot(dx, dy);
            if (length < 1e-6) continue;

            const t = Math.max(0, Math.min(1, ((x - wall.start.x) * dx + (y - wall.start.y) * dy) / (length * length)));
            const cx = wall.start.x + dx * t;
            const cy = wall.start.y + dy * t;
            const distance = Math.hypot(x - cx, y - cy);
            if (distance > broad) continue;

            // Half-extent of the rotated footprint along the wall normal
            // (the support function used by wall-snap).
            const nx = -dy / length;
            const ny = dx / length;
            const extent = Math.abs(ux * nx + uy * ny) * halfWidth
                + Math.abs(-uy * nx + ux * ny) * halfDepth;

            // Flush contact is the normal snapped position, so only a real
            // overlap counts as invalid. 0.1 px absorbs canvas rounding.
            if (distance + 0.1 < halfWall + extent) return false;
        }

        return true;
    }

    toJSON() {
        return {
            class: 'Item',
            type: this.type,
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            id: this.id,
            modelUrl: this.modelUrl, // Include in serialization
            elevation: this.elevation || 0,
            visible: this.visible !== false,
            locked: !!this.locked,
            lockedAxes: { x: Boolean(this.lockedAxes?.x), z: Boolean(this.lockedAxes?.z) },
            flipped: { x: Boolean(this.flipped?.x), z: Boolean(this.flipped?.z) },
            groupId: this.groupId || null,
            defaultBottom: typeof this.defaultBottom === 'number' ? this.defaultBottom : null,
            size: this.size || null,
            config: this.config ? { ...this.config } : null,
            stair: this.stair ? { ...this.stair } : null,
            landscape: this.landscape ? { ...this.landscape } : null
        };
    }
}

export class FloorItem extends Item {
    constructor(type, x, y, rotation, id) {
        super(type, x, y, rotation, id);
    }
}

export class InWallItem extends Item {
    constructor(type, x, y, rotation, id) {
        super(type, x, y, rotation, id);
        this.boundToWallId = null;
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    snapToWall(walls, threshold = 20) {
        let closest = null;
        let minDistance = Infinity;

        for (const wall of walls) {
            const { distance, x, y, angle } = this.calculateSnap(wall, this.x, this.y);
            if (distance < minDistance) {
                minDistance = distance;
                closest = { wall, x, y, angle };
            }
        }

        if (closest && minDistance < threshold) {
            this.x = closest.x;
            this.y = closest.y;
            this.rotation = closest.angle;
            this.boundToWallId = closest.wall.id;
            return true;
        } else {
            this.boundToWallId = null;
            return false;
        }
    }

    calculateSnap(wall, x, y) {
        const A = x - wall.start.x;
        const B = y - wall.start.y;
        const C = wall.end.x - wall.start.x;
        const D = wall.end.y - wall.start.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = lenSq !== 0 ? dot / lenSq : -1;

        param = Math.max(0, Math.min(1, param));

        const xx = wall.start.x + param * C;
        const yy = wall.start.y + param * D;

        const dx = x - xx;
        const dy = y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(D, C);

        return { distance, x: xx, y: yy, angle };
    }

    toJSON() {
        const json = super.toJSON();
        json.class = 'InWallItem';
        json.boundToWallId = this.boundToWallId;
        return json;
    }
}

export class InWallFloorItem extends InWallItem {
    constructor(type, x, y, rotation, id) {
        super(type, x, y, rotation, id);
    }
    
    toJSON() {
        const json = super.toJSON();
        json.class = 'InWallFloorItem';
        return json;
    }
}

export class Wall {
    constructor(x1, y1, x2, y2, thickness = 10, id = null, height = null) {
        this.start = { x: x1, y: y1 };
        this.end = { x: x2, y: y2 };
        this.id = id || 'wall_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.thickness = thickness; // Display thickness
        // Per-wall height in metres. null means "use the storey height", so
        // existing plans and the React scene behave exactly as before.
        this.height = typeof height === 'number' ? height : null;
    }

    get length() {
        return Math.hypot(this.end.x - this.start.x, this.end.y - this.start.y);
    }

    toJSON() {
        return {
            class: 'Wall',
            start: this.start,
            end: this.end,
            id: this.id,
            thickness: this.thickness,
            height: this.height
        };
    }

    static fromJSON(json) {
        return new Wall(json.start.x, json.start.y, json.end.x, json.end.y, json.thickness, json.id, json.height);
    }
}

/**
 * The single wall renderer's source of geometry. `Wall` is the model (plan
 * endpoints + thickness); this turns it into the box a 3D scene draws, in world
 * metres, so the React scene and any three.js scene agree on size and placement.
 *
 *   const { position, size, rotation } = wallBox(wall, { height })
 */
export function wallBox(wall, options = {}) {
    if (!wall || !wall.start || !wall.end) return null;

    const height = options.height ?? wall.height ?? WALL_HEIGHT;
    const thickness = options.thickness ?? wall.thickness ?? WALL_THICKNESS;
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.y - wall.start.y;
    const length = Math.hypot(dx, dz);

    return {
        position: [(wall.start.x + wall.end.x) / 2, height / 2, (wall.start.y + wall.end.y) / 2],
        size: [length, height, thickness],
        rotation: [0, -Math.atan2(dz, dx), 0],
        length
    };
}

export class ItemFactory {
    static create(type, x, y, rotation = 0, id = null) {
        const meta = ITEM_METADATA[type];
        if (!meta) return new Item(type, x, y, rotation, id);
        
        if (meta.type === 'in_wall') return new InWallItem(type, x, y, rotation, id);
        if (meta.type === 'in_wall_floor') return new InWallFloorItem(type, x, y, rotation, id);
        return new FloorItem(type, x, y, rotation, id);
    }

    static fromJSON(json) {
        let item;
        if (json.class === 'InWallItem') item = new InWallItem(json.type, json.x, json.y, json.rotation, json.id);
        else if (json.class === 'InWallFloorItem') item = new InWallFloorItem(json.type, json.x, json.y, json.rotation, json.id);
        else if (json.class === 'FloorItem') item = new FloorItem(json.type, json.x, json.y, json.rotation, json.id);
        else item = new Item(json.type, json.x, json.y, json.rotation, json.id);
        
        if (json.boundToWallId) item.boundToWallId = json.boundToWallId;
        if (json.modelUrl) item.modelUrl = json.modelUrl; // Restore custom model URL
        if (typeof json.elevation === 'number') item.elevation = json.elevation;
        if (typeof json.visible === 'boolean') item.visible = json.visible;
        if (typeof json.locked === 'boolean') item.locked = json.locked;
        if (json.lockedAxes && typeof json.lockedAxes === 'object') {
            item.lockedAxes = { x: Boolean(json.lockedAxes.x), z: Boolean(json.lockedAxes.z) };
        }
        if (json.flipped && typeof json.flipped === 'object') {
            item.flipped = { x: Boolean(json.flipped.x), z: Boolean(json.flipped.z) };
        }
        if (typeof json.groupId === 'string' && json.groupId) item.groupId = json.groupId;
        if (typeof json.defaultBottom === 'number') item.defaultBottom = json.defaultBottom;
        if (json.size && typeof json.size === 'object') item.size = { ...json.size };
        if (json.config && typeof json.config === 'object') item.config = { ...json.config };
        if (json.stair && typeof json.stair === 'object') item.stair = { ...json.stair };
        if (json.landscape && typeof json.landscape === 'object') item.landscape = { ...json.landscape };
        return item;
    }
}