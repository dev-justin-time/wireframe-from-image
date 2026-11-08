import * as THREE from 'three';
import { PIXELS_PER_METER } from '../../core/world-space.js';

/**
 * Advanced feature 36 - pathfinding walkthrough.
 *
 * The plan is rasterised into a walkability grid (walls inflated by a body
 * radius), an A* search finds a route, and an agent marker walks it. Clicking
 * the 3D view while the walkthrough is enabled raycasts the floor and sets the
 * destination, so no navmesh authoring is needed for an arbitrary editor plan.
 */

export const AGENT_RADIUS = 0.32; // metres
export const EYE_HEIGHT = 1.6;

const distanceToSegment = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const t = Math.max(0, Math.min(1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
    return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
};

/** Rasterise walkability: bounds of the walls plus a one-metre margin. */
export function buildWalkGrid({ walls = [], cell = 0.25, clearance = AGENT_RADIUS } = {}) {
    if (!walls.length) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    walls.forEach((wall) => {
        minX = Math.min(minX, wall.start.x, wall.end.x);
        maxX = Math.max(maxX, wall.start.x, wall.end.x);
        minY = Math.min(minY, wall.start.y, wall.end.y);
        maxY = Math.max(maxY, wall.start.y, wall.end.y);
    });

    const margin = PIXELS_PER_METER;
    minX -= margin; minY -= margin; maxX += margin; maxY += margin;

    const cellPixels = Math.max(2, cell * PIXELS_PER_METER);
    const cols = Math.ceil((maxX - minX) / cellPixels) + 1;
    const rows = Math.ceil((maxY - minY) / cellPixels) + 1;
    const clearancePixels = clearance * PIXELS_PER_METER;

    const blocked = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = minX + col * cellPixels;
            const y = minY + row * cellPixels;
            let hit = false;
            for (const wall of walls) {
                if (distanceToSegment({ x, y }, wall.start, wall.end) <= clearancePixels) {
                    hit = true;
                    break;
                }
            }
            blocked[row * cols + col] = hit ? 1 : 0;
        }
    }

    return {
        minX, minY, cellPixels, cols, rows, blocked,
        toCell(point) {
            return {
                col: Math.round((point.x - minX) / cellPixels),
                row: Math.round((point.y - minY) / cellPixels)
            };
        },
        toPoint(col, row) {
            return { x: minX + col * cellPixels, y: minY + row * cellPixels };
        },
        isBlocked(col, row) {
            if (col < 0 || row < 0 || col >= cols || row >= rows) return true;
            return blocked[row * cols + col] === 1;
        }
    };
}

const NEIGHBOURS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]
];

/** A* over the walk grid. Returns plan points (pixels) or [] when unreachable. */
export function findPath(grid, startPoint, goalPoint) {
    if (!grid) return [];

    const start = grid.toCell(startPoint);
    const goal = grid.toCell(goalPoint);
    if (grid.isBlocked(goal.col, goal.row)) {
        // Nudge the goal to the closest open cell so a click near a wall still works.
        let best = null;
        for (let radius = 1; radius <= 4 && !best; radius++) {
            for (let dc = -radius; dc <= radius && !best; dc++) {
                for (let dr = -radius; dr <= radius && !best; dr++) {
                    if (!grid.isBlocked(goal.col + dc, goal.row + dr)) best = { col: goal.col + dc, row: goal.row + dr };
                }
            }
        }
        if (!best) return [];
        goal.col = best.col;
        goal.row = best.row;
    }
    if (grid.isBlocked(start.col, start.row)) {
        let best = null;
        for (let radius = 1; radius <= 4 && !best; radius++) {
            for (let dc = -radius; dc <= radius && !best; dc++) {
                for (let dr = -radius; dr <= radius && !best; dr++) {
                    if (!grid.isBlocked(start.col + dc, start.row + dr)) best = { col: start.col + dc, row: start.row + dr };
                }
            }
        }
        if (!best) return [];
        start.col = best.col;
        start.row = best.row;
    }

    const key = (col, row) => row * grid.cols + col;
    const open = [{ col: start.col, row: start.row, g: 0, f: 0, parent: null }];
    const bestG = new Map([[key(start.col, start.row), 0]]);
    const closed = new Set();

    const heuristic = (col, row) => Math.hypot(col - goal.col, row - goal.row);

    while (open.length > 0) {
        let bestIndex = 0;
        for (let i = 1; i < open.length; i++) {
            if (open[i].f < open[bestIndex].f) bestIndex = i;
        }
        const current = open.splice(bestIndex, 1)[0];
        const currentKey = key(current.col, current.row);

        if (current.col === goal.col && current.row === goal.row) {
            const points = [];
            let node = current;
            while (node) {
                points.push(grid.toPoint(node.col, node.row));
                node = node.parent;
            }
            return points.reverse();
        }

        if (closed.has(currentKey)) continue;
        closed.add(currentKey);

        NEIGHBOURS.forEach(([dc, dr, cost]) => {
            const col = current.col + dc;
            const row = current.row + dr;
            if (!grid.isBlocked(col, row)) {
                // No cutting diagonal corners.
                if (dc !== 0 && dr !== 0 && (grid.isBlocked(current.col + dc, current.row) || grid.isBlocked(current.col, current.row + dr))) return;
            } else {
                return;
            }

            const nextKey = key(col, row);
            const g = current.g + cost;
            if (bestG.has(nextKey) && bestG.get(nextKey) <= g) return;
            bestG.set(nextKey, g);

            open.push({ col, row, g, f: g + heuristic(col, row), parent: current });
        });
    }

    return [];
}

/** Create the walkthrough state and its agent marker. */
export function createWalkthrough({
    scene,
    camera,
    domElement,
    getWalls = () => [],
    getView = () => ({ width: 1, height: 1 }),
    speed = 1.6,
    onArrive
} = {}) {
    if (!scene) return null;

    const agent = new THREE.Group();
    agent.name = 'walkthrough-agent';
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12, 0.5, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x13a4ec })
    );
    body.position.y = 0.37;
    agent.add(body);
    agent.visible = false;
    scene.add(agent);

    let enabled = false;
    let path = [];
    let index = 0;
    let grid = null;
    let active = false;

    const raycaster = new THREE.Raycaster();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    function planPointFromEvent(event) {
        if (!camera || !domElement) return null;
        const rect = domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        raycaster.setFromCamera(new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        ), camera);
        const hit = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(floor, hit)) return null;
        const view = getView();
        return {
            x: hit.x * PIXELS_PER_METER + view.width / 2,
            y: hit.z * PIXELS_PER_METER + view.height / 2
        };
    }

    function nearestOpenPlan(point) {
        const cell = grid.toCell(point);
        for (let radius = 0; radius <= 12; radius++) {
            for (let dc = -radius; dc <= radius; dc++) {
                for (let dr = -radius; dr <= radius; dr++) {
                    if (!grid.isBlocked(cell.col + dc, cell.row + dr)) {
                        return grid.toPoint(cell.col + dc, cell.row + dr);
                    }
                }
            }
        }
        return null;
    }

    function walkTo(planPoint) {
        const walls = getWalls() || [];
        if (!walls.length || !planPoint) return [];
        grid = buildWalkGrid({ walls });
        const view = getView();

        // Before the agent has moved it sits at the world origin, which may be
        // outside the plan. Start from the closest walkable point to the plan
        // centre instead, and drop the agent there.
        let start;
        if (agent.visible) {
            start = {
                x: agent.position.x * PIXELS_PER_METER + view.width / 2,
                y: agent.position.z * PIXELS_PER_METER + view.height / 2
            };
        } else {
            start = nearestOpenPlan({
                x: grid.minX + (grid.cols * grid.cellPixels) / 2,
                y: grid.minY + (grid.rows * grid.cellPixels) / 2
            });
            if (start) {
                agent.position.set(
                    (start.x - view.width / 2) / PIXELS_PER_METER,
                    agent.position.y,
                    (start.y - view.height / 2) / PIXELS_PER_METER
                );
            }
        }

        if (!start) return [];
        path = findPath(grid, start, planPoint);
        index = 0;
        active = path.length > 1;
        agent.visible = true;
        return path;
    }

    function walkToEvent(event) {
        const point = planPointFromEvent(event);
        if (!point) return false;
        walkTo(point);
        return true;
    }

    function update(delta) {
        if (!active || path.length === 0) return;
        const view = getView();
        const target = path[Math.min(index, path.length - 1)];
        const goal = {
            x: (target.x - view.width / 2) / PIXELS_PER_METER,
            z: (target.y - view.height / 2) / PIXELS_PER_METER
        };
        const dx = goal.x - agent.position.x;
        const dz = goal.z - agent.position.z;
        const distance = Math.hypot(dx, dz);
        const step = speed * delta;

        if (distance <= step || distance < 0.01) {
            agent.position.x = goal.x;
            agent.position.z = goal.z;
            index += 1;
            if (index >= path.length) {
                active = false;
                onArrive?.({ ...agent.position });
            }
            return;
        }

        agent.position.x += (dx / distance) * step;
        agent.position.z += (dz / distance) * step;
        agent.rotation.y = Math.atan2(dx, dz);
    }

    return {
        agent,
        get enabled() { return enabled; },
        get walking() { return active; },
        get path() { return path.map((point) => ({ ...point })); },
        setEnabled(value) {
            enabled = Boolean(value);
            if (!enabled) {
                active = false;
                agent.visible = false;
            }
            return enabled;
        },
        walkTo,
        walkToEvent,
        update,
        planPointFromEvent,
        dispose() {
            scene.remove(agent);
            agent.traverse((child) => {
                child.geometry?.dispose?.();
                child.material?.dispose?.();
            });
        }
    };
}
