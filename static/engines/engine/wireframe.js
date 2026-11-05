import * as THREE from 'three';

// Cabinets built as line drawings: the same geometry the solid builders make,
// reduced to its edges. Anything that passes through `toWireframe` renders as
// edges only, so a shaker door reads as its frame and recessed panel.
export const DEFAULT_WIREFRAME_COLOR = 0x334155;

const disposeEdges = (object) => {
    object.traverse((child) => {
        if (child.isLineSegments && child.geometry) child.geometry.dispose();
    });
};

/**
 * Rebuild `object` as a group of LineSegments (one per mesh).
 *
 * The returned group carries the source object's own position / rotation /
 * scale, so callers can place it exactly like the solid object it replaces.
 * Child transforms are baked into each line geometry, and every mesh is
 * sampled with EdgesGeometry so hidden interior faces stay out of the drawing.
 */
export function toWireframe(object, options = {}) {
    if (!object) return null;

    const {
        color = DEFAULT_WIREFRAME_COLOR,
        thresholdAngle = 18,
        opacity = 1
    } = options;

    const material = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1
    });

    const group = new THREE.Group();
    group.position.copy(object.position);
    group.rotation.copy(object.rotation);
    group.scale.copy(object.scale);
    group.userData = { ...object.userData, wireframe: true };

    const addEdges = (geometry, matrix) => {
        const edges = new THREE.EdgesGeometry(geometry, thresholdAngle);
        if (!edges.attributes.position || edges.attributes.position.count === 0) {
            edges.dispose();
            return;
        }
        const lines = new THREE.LineSegments(edges, material);
        lines.applyMatrix4(matrix);
        lines.userData.wireframe = true;
        group.add(lines);
    };

    const identity = new THREE.Matrix4();
    let meshCount = 0;

    // The object's own transform is carried by the group, so the walk starts
    // with an identity matrix and only bakes the transforms below it.
    if (object.isMesh && object.geometry) {
        addEdges(object.geometry, identity);
        meshCount += 1;
    }

    object.traverse((child) => {
        if (child === object) return;
        child.updateMatrix();
        const chain = [];
        let node = child;
        while (node && node !== object) {
            chain.unshift(node.matrix);
            node = node.parent;
        }
        const matrix = new THREE.Matrix4();
        chain.forEach((m) => matrix.multiply(m));

        if (child.isMesh && child.geometry) {
            addEdges(child.geometry, matrix);
            meshCount += 1;
        } else if ((child.isLine || child.isLineSegments) && child.geometry) {
            const lines = new THREE.LineSegments(child.geometry.clone(), material);
            lines.applyMatrix4(matrix);
            lines.userData.wireframe = true;
            group.add(lines);
            meshCount += 1;
        }
    });

    if (meshCount === 0) disposeEdges(group);
    return group;
}

export function isWireframe(object) {
    return Boolean(object && object.userData && object.userData.wireframe);
}
