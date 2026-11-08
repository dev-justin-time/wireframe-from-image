import * as THREE from 'three';

/**
 * One draw call for repeated boxes.
 *
 * Floor joist bands, roof rims and ceiling joists are the same box dozens of
 * times with different lengths and positions. A unit cube scaled per instance
 * keeps the geometry and material shared, so a long plan does not add one draw
 * call per joist.
 *
 * Each box is `{ x, y, z, width, height, depth, rotationY }`.
 */
export function createInstancedBoxes(boxes = [], {
    material,
    name = 'instanced-boxes',
    castShadow = true,
    receiveShadow = true
} = {}) {
    const usable = (boxes || []).filter((box) => box
        && Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.z)
        && Number.isFinite(box.width) && Number.isFinite(box.height) && Number.isFinite(box.depth)
        && box.width > 0 && box.height > 0 && box.depth > 0);

    if (!usable.length || !material) return null;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geometry, material, usable.length);
    const dummy = new THREE.Object3D();

    usable.forEach((box, index) => {
        dummy.position.set(box.x, box.y, box.z);
        dummy.rotation.set(0, box.rotationY || 0, 0);
        dummy.scale.set(box.width, box.height, box.depth);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.name = name;
    mesh.userData = { type: 'instanced-boxes', count: usable.length };
    mesh.computeBoundingBox?.();
    mesh.computeBoundingSphere?.();
    return mesh;
}
