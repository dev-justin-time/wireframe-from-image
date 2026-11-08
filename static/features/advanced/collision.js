import { PIXELS_PER_METER } from '../../core/world-space.js';
import { itemDimensions } from '../../core/items.js';

/**
 * Advanced feature 21 - collision / overlap detection.
 *
 * Bounding boxes come from the same footprint the snapping code uses
 * (itemDimensions + rotation), so a rotated piece is tested by its real
 * axis-aligned extent. Used for the drag flag and the placement warnings.
 */

const EPSILON = 0.5; // plan pixels; touching edges are not an overlap

/** Grid cell size in plan pixels: two metres keeps queries local. */
export const COLLISION_CELL_SIZE = 2 * PIXELS_PER_METER;

export class SpatialHash {
    constructor(cellSize = COLLISION_CELL_SIZE) {
        this.cellSize = cellSize > 0 ? cellSize : COLLISION_CELL_SIZE;
        this.cells = new Map();
    }

    key(cx, cy) {
        return `${cx},${cy}`;
    }

    cellRange(box) {
        return {
            minX: Math.floor(box.minX / this.cellSize),
            maxX: Math.floor(box.maxX / this.cellSize),
            minY: Math.floor(box.minY / this.cellSize),
            maxY: Math.floor(box.maxY / this.cellSize)
        };
    }

    insert(fixture, box = boundsOf(fixture)) {
        if (!fixture) return this;
        const range = this.cellRange(box);
        for (let cx = range.minX; cx <= range.maxX; cx += 1) {
            for (let cy = range.minY; cy <= range.maxY; cy += 1) {
                const key = this.key(cx, cy);
                if (!this.cells.has(key)) this.cells.set(key, new Set());
                this.cells.get(key).add(fixture);
            }
        }
        return this;
    }

    query(box) {
        const range = this.cellRange(box);
        const found = new Set();
        for (let cx = range.minX; cx <= range.maxX; cx += 1) {
            for (let cy = range.minY; cy <= range.maxY; cy += 1) {
                const cell = this.cells.get(this.key(cx, cy));
                if (cell) cell.forEach((fixture) => found.add(fixture));
            }
        }
        return [...found];
    }
}

/** Build a reusable index once per drag instead of scanning every fixture. */
export function buildCollisionIndex(fixtures = [], { cellSize = COLLISION_CELL_SIZE } = {}) {
    const index = new SpatialHash(cellSize);
    (fixtures || []).forEach((fixture) => {
        if (!fixture || fixture.visible === false) return;
        index.insert(fixture);
    });
    return index;
}

export function boundsOf(fixture) {
    const dims = itemDimensions(fixture);
    const width = dims.width * PIXELS_PER_METER;
    const depth = dims.depth * PIXELS_PER_METER;
    const rotation = fixture.rotation || 0;
    const cos = Math.abs(Math.cos(rotation));
    const sin = Math.abs(Math.sin(rotation));

    const halfW = (width * cos + depth * sin) / 2;
    const halfD = (width * sin + depth * cos) / 2;

    return {
        minX: fixture.x - halfW,
        maxX: fixture.x + halfW,
        minY: fixture.y - halfD,
        maxY: fixture.y + halfD
    };
}

export function boxesOverlap(a, b) {
    return a.minX + EPSILON < b.maxX && a.maxX - EPSILON > b.minX
        && a.minY + EPSILON < b.maxY && a.maxY - EPSILON > b.minY;
}

export function intersectionOf(a, b) {
    return {
        minX: Math.max(a.minX, b.minX),
        minY: Math.max(a.minY, b.minY),
        maxX: Math.min(a.maxX, b.maxX),
        maxY: Math.min(a.maxY, b.maxY)
    };
}

/** All overlapping pairs among visible items. */
export function findOverlaps(fixtures = []) {
    const visible = (fixtures || []).filter((fixture) => fixture && fixture.visible !== false);
    const boxes = visible.map(boundsOf);
    const overlaps = [];

    for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
            if (!boxesOverlap(boxes[i], boxes[j])) continue;
            overlaps.push({
                a: visible[i],
                b: visible[j],
                box: intersectionOf(boxes[i], boxes[j])
            });
        }
    }
    return overlaps;
}

/** Pairs involving one fixture, so a drag can flag just the moving piece. */
export function overlapsFor(fixture, fixtures = [], { index = null } = {}) {
    if (!fixture) return [];
    const box = boundsOf(fixture);
    const candidates = index ? index.query(box) : (fixtures || []);

    return candidates
        .filter((other) => other && other !== fixture && other.visible !== false)
        .filter((other) => boxesOverlap(box, boundsOf(other)))
        .map((other) => ({ a: fixture, b: other, box: intersectionOf(box, boundsOf(other)) }));
}

/** Drag result: valid placement plus the pieces blocking it. */
export function placementValidity(fixture, fixtures = [], options = {}) {
    const overlaps = overlapsFor(fixture, fixtures, options);
    return {
        valid: overlaps.length === 0,
        overlaps,
        blockers: overlaps.map(({ b }) => b)
    };
}

/** Set of fixture ids that touch something else (for the warning summary). */
export function collisionIds(fixtures = []) {
    const ids = new Set();
    findOverlaps(fixtures).forEach(({ a, b }) => {
        ids.add(a.id);
        ids.add(b.id);
    });
    return ids;
}
