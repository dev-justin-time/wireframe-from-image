import {
    canvasToPlan,
    planToCanvas,
    planToWorld,
    worldToPlan,
    distanceInMetres,
    PIXELS_PER_METER,
    WALL_THICKNESS
} from './world-space.js';

/**
 * FloorPlanGraph is the single source of truth for a plan's geometry.
 *
 * Coordinate contract (shared by the 2D canvas and the 3D scene):
 *   plan  : { x, z } in metres, origin at the centre of the drawing surface,
 *           +x to the right, +z away from the viewer
 *   canvas: { x, y } in CSS pixels, origin top-left (y grows downwards), so
 *           y = height/2 - z * scale
 *   world : { x, y, z } in metres, y is height above the floor
 *
 * Nodes are shared corners (welded within a tolerance) and edges are walls, so
 * moving a node moves every wall and every 3D mesh attached to it.
 */
export class FloorPlanGraph {
    constructor({ pixelsPerMeter = PIXELS_PER_METER, snapPixels = 10 } = {}) {
        this.pixelsPerMeter = pixelsPerMeter;
        this.snapPixels = snapPixels;
        this.nodes = [];
        this.edges = [];
        this._nextNodeId = 1;
        this._nextEdgeId = 1;
    }

    // --- canvas <-> plan -------------------------------------------------
    fromCanvas(point, view) {
        return canvasToPlan(point, view);
    }

    toCanvas(point, view) {
        return planToCanvas(point, view);
    }

    // --- plan <-> world --------------------------------------------------
    toWorld(point, y = 0) {
        return planToWorld(point, y);
    }

    toPlan(worldPoint) {
        return worldToPlan(worldPoint);
    }

    // --- graph -----------------------------------------------------------
    nodeAt(point, tolerancePixels = this.snapPixels) {
        const tolerance = tolerancePixels / this.pixelsPerMeter;
        let nearest = null;
        let nearestDistance = tolerance;

        for (const node of this.nodes) {
            const distance = Math.hypot(node.x - point.x, node.z - point.z);
            if (distance <= nearestDistance) {
                nearest = node;
                nearestDistance = distance;
            }
        }
        if (nearest) return nearest;

        const node = { id: `n${this._nextNodeId++}`, x: point.x, z: point.z };
        this.nodes.push(node);
        return node;
    }

    addEdge(a, b, { thickness = WALL_THICKNESS, id } = {}) {
        if (!a || !b) return null;
        if (a === b || (a.x === b.x && a.z === b.z)) return null;

        const edge = { id: id ?? `e${this._nextEdgeId}`, a, b, thickness };
        this._nextEdgeId++;
        this.edges.push(edge);
        return edge;
    }

    /** Add a wall from two canvas-space points; endpoints snap onto shared nodes. */
    addWall(fromCanvasPoint, toCanvasPoint, view) {
        const a = this.nodeAt(this.fromCanvas(fromCanvasPoint, view));
        const b = this.nodeAt(this.fromCanvas(toCanvasPoint, view));
        return this.addEdge(a, b);
    }

    edgeLength(edge) {
        return distanceInMetres(edge.a, edge.b);
    }

    wallsBounds() {
        if (!this.nodes.length) return { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
        const xs = this.nodes.map((node) => node.x);
        const zs = this.nodes.map((node) => node.z);
        return {
            minX: Math.min(...xs),
            minZ: Math.min(...zs),
            maxX: Math.max(...xs),
            maxZ: Math.max(...zs)
        };
    }

    center() {
        const { minX, minZ, maxX, maxZ } = this.wallsBounds();
        return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    }

    clear() {
        this.nodes = [];
        this.edges = [];
    }

    /**
     * Walls in canvas pixels, which is the space ConversionEngine3D expects:
     * it re-centres on the canvas and divides by pixelsPerMeter, landing back on
     * the same world coordinates the graph holds.
     */
    toCanvasWalls(view) {
        return this.edges.map((edge) => ({
            id: edge.id,
            start: this.toCanvas(edge.a, view),
            end: this.toCanvas(edge.b, view),
            thickness: edge.thickness,
            // Per-wall height rides through the graph so the 3D wall builder
            // still sees half walls and gables.
            height: edge.height ?? null
        }));
    }
}

/**
 * Build a graph from plain canvas-space walls (the shape editors keep in state),
 * preserving wall ids so fixtures bound to a wall still find it.
 */
export function graphFromWalls(walls, view, options = {}) {
    const graph = new FloorPlanGraph(options);
    for (const wall of walls || []) {
        if (!wall?.start || !wall?.end) continue;
        const edge = graph.addWall(wall.start, wall.end, view);
        if (edge) {
            if (wall.id != null) edge.id = wall.id;
            if (typeof wall.height === 'number') edge.height = wall.height;
        }
    }
    return graph;
}
