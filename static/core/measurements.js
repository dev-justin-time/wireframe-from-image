/**
 * Shared dimension layer: one place that derives wall lengths and room areas
 * (in metres) from a FloorPlanGraph, so the 2D canvas and every 3D scene label
 * the same geometry with the same numbers.
 */

/** Length, midpoint and direction of every wall, in metres. */
export function wallMeasurements(graph) {
    return graph.edges.map((edge) => {
        const dx = edge.b.x - edge.a.x;
        const dz = edge.b.z - edge.a.z;
        return {
            id: edge.id,
            length: Math.hypot(dx, dz),
            midpoint: { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 },
            angle: Math.atan2(dz, dx)
        };
    });
}

/** Shoelace area of a closed polygon in metres squared. */
export function polygonArea(points) {
    return Math.abs(signedArea(points));
}

/** Shoelace sum; the sign tells the winding direction. */
export function signedArea(points) {
    if (!points || points.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        sum += a.x * b.z - b.x * a.z;
    }
    return sum / 2;
}

export function polygonCentroid(points) {
    if (!points || points.length === 0) return { x: 0, z: 0 };
    const total = points.reduce((acc, p) => ({ x: acc.x + p.x, z: acc.z + p.z }), { x: 0, z: 0 });
    return { x: total.x / points.length, z: total.z / points.length };
}

/**
 * Enumerate the closed loops (rooms) formed by the wall graph.
 *
 * Standard planar face walk: for every directed edge, hop to the next edge
 * around the arrival node, always taking the neighbour immediately clockwise
 * from the edge we came in on. Bounded faces come out with positive signed
 * area; the unbounded outer face comes out negative and is dropped.
 */
export function findRooms(graph) {
    const adjacency = new Map();
    for (const node of graph.nodes) adjacency.set(node.id, []);

    for (const edge of graph.edges) {
        adjacency.get(edge.a.id)?.push({ other: edge.b, edge });
        adjacency.get(edge.b.id)?.push({ other: edge.a, edge });
    }

    for (const list of adjacency.values()) {
        list.sort((p, q) => Math.atan2(p.other.z, p.other.x) - Math.atan2(q.other.z, q.other.x));
    }

    const visited = new Set();
    const rooms = [];

    for (const edge of graph.edges) {
        for (const [from, to] of [[edge.a, edge.b], [edge.b, edge.a]]) {
            const startKey = `${from.id}>${to.id}`;
            if (visited.has(startKey)) continue;

            const loop = [];
            let currentFrom = from;
            let currentTo = to;
            let guard = 0;

            while (guard++ < graph.edges.length * 2 + 4) {
                visited.add(`${currentFrom.id}>${currentTo.id}`);
                loop.push(currentFrom);

                const neighbours = adjacency.get(currentTo.id) || [];
                const backIndex = neighbours.findIndex((n) => n.other.id === currentFrom.id);
                if (backIndex === -1 || neighbours.length === 0) break;

                // Clockwise-most turn from the reversed edge.
                const next = neighbours[(backIndex - 1 + neighbours.length) % neighbours.length];
                currentFrom = currentTo;
                currentTo = next.other;

                if (currentFrom.id === from.id && currentTo.id === to.id) break;
            }

            if (loop.length < 3) continue;

            // The face walk yields bounded faces with one winding and the
            // unbounded outer ring with the other; only keep the bounded ones.
            const signed = signedArea(loop);
            if (signed <= 1e-6) continue;

            const area = signed;

            rooms.push({
                id: `room_${rooms.length + 1}`,
                area,
                centroid: polygonCentroid(loop),
                vertices: loop.map((node) => ({ x: node.x, z: node.z }))
            });
        }
    }

    return rooms;
}

/** Everything a view needs to label a plan: wall lengths and room areas. */
export function measurePlan(graph) {
    return {
        walls: wallMeasurements(graph),
        rooms: findRooms(graph)
    };
}

export function formatLength(metres) {
    return `${metres.toFixed(1)} m`;
}

export function formatArea(squareMetres) {
    return `${squareMetres.toFixed(1)} m²`;
}
