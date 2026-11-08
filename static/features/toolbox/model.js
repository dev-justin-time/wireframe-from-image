/**
 * Model import for the 3D toolbox.
 *
 * Turns a picked file into plain `{ positions, uvs, indices }` buffers so the
 * pure kernels in `mesh.js` can measure it. three.js does the parsing — it is
 * already vendored for the editor — but nothing here imports it at module scope:
 * the loaders are imported inside the format branch, which keeps this file
 * importable in Node (the gate imports panels, and the panel imports this).
 *
 * Positions are transformed to world space before they leave this module. An
 * imported chair is usually scaled by a node, and texel density is meaningless
 * if the scale is skipped: the area would be in local units while the label says
 * metres.
 */

export const MODEL_EXTENSIONS = ['.glb', '.gltf', '.obj', '.stl', '.ply'];

export const MODEL_FORMATS = [
    { id: 'glb', label: 'glTF binary', extensions: ['.glb'] },
    { id: 'gltf', label: 'glTF', extensions: ['.gltf'] },
    { id: 'obj', label: 'Wavefront OBJ', extensions: ['.obj'] },
    { id: 'stl', label: 'STL', extensions: ['.stl'] },
    { id: 'ply', label: 'PLY', extensions: ['.ply'] }
];

const loaders = {
    gltf: () => import('three/addons/loaders/GLTFLoader.js'),
    obj: () => import('three/addons/loaders/OBJLoader.js'),
    stl: () => import('three/addons/loaders/STLLoader.js'),
    ply: () => import('three/addons/loaders/PLYLoader.js')
};

function extensionOf(name) {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

/**
 * Copy the first `size` channels of every vertex into a flat array. The getters
 * read through the attribute's stride, so an interleaved glTF buffer works the
 * same as a packed one.
 */
function flattenAttribute(attribute, size) {
    if (!attribute) return null;
    const out = new Float32Array(attribute.count * size);
    for (let index = 0; index < attribute.count; index += 1) {
        out[index * size] = attribute.getX(index);
        if (size > 1) out[index * size + 1] = attribute.getY(index);
        if (size > 2) out[index * size + 2] = attribute.getZ(index);
    }
    return out;
}

/** World-space positions, applying the object's matrix without three's Vector3. */
function worldPositions(object, attribute) {
    const count = attribute.count;
    const out = new Float32Array(count * 3);
    const elements = object.matrixWorld?.elements;
    if (!elements) {
        for (let index = 0; index < count; index += 1) {
            out[index * 3] = attribute.getX(index);
            out[index * 3 + 1] = attribute.getY(index);
            out[index * 3 + 2] = attribute.getZ(index);
        }
        return out;
    }
    const [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14] = elements;
    for (let index = 0; index < count; index += 1) {
        const x = attribute.getX(index);
        const y = attribute.getY(index);
        const z = attribute.getZ(index);
        out[index * 3] = m0 * x + m4 * y + m8 * z + m12;
        out[index * 3 + 1] = m1 * x + m5 * y + m9 * z + m13;
        out[index * 3 + 2] = m2 * x + m6 * y + m10 * z + m14;
    }
    return out;
}

/** One three.js geometry as a plain mesh. */
function geometryMesh(geometry, name) {
    const position = geometry.getAttribute?.('position');
    if (!position || !position.count) return null;
    const uv = geometry.getAttribute?.('uv');
    const index = geometry.getIndex?.();
    return {
        name: name || geometry.name || 'mesh',
        positions: flattenAttribute(position, 3),
        uvs: uv ? flattenAttribute(uv, 2) : null,
        indices: index ? Uint32Array.from(index.array) : null
    };
}

/** Walk a loaded scene and keep every mesh that has vertices. */
function collect(root, name, format) {
    if (!root) throw new Error(`${name} contains no scene.`);
    const meshes = [];
    root.updateMatrixWorld?.(true);
    root.traverse((object) => {
        if (!object.isMesh || !object.geometry) return;
        const position = object.geometry.getAttribute?.('position');
        if (!position || !position.count) return;
        const uv = object.geometry.getAttribute?.('uv');
        const index = object.geometry.getIndex?.();
        meshes.push({
            name: object.name || `${name} · mesh ${meshes.length + 1}`,
            positions: worldPositions(object, position),
            uvs: uv ? flattenAttribute(uv, 2) : null,
            indices: index ? Uint32Array.from(index.array) : null
        });
    });
    if (!meshes.length) throw new Error(`${name} contains no mesh with vertices.`);
    return { name, format, meshes };
}

/** Reject a .gltf that points at a sibling .bin, which this page cannot fetch. */
function assertSelfContained(json, name) {
    for (const buffer of json.buffers || []) {
        if (buffer.uri && !buffer.uri.startsWith('data:')) {
            throw new Error(`${name} references an external buffer (${buffer.uri}). Save it as a .glb, or embed the buffer as a data URI.`);
        }
    }
    for (const image of json.images || []) {
        if (image.uri && !image.uri.startsWith('data:')) {
            throw new Error(`${name} references an external image (${image.uri}). Save it as a .glb with embedded textures.`);
        }
    }
}

/**
 * Read a model file. Returns `{ name, format, meshes }`, where each mesh is
 * `{ name, positions, uvs, indices }` in metres and raw UV units.
 */
export async function loadModelFile(file) {
    if (!file) throw new Error('No model file was dropped.');
    const name = file.name || 'model';
    const extension = extensionOf(name);
    if (!MODEL_EXTENSIONS.includes(extension)) {
        throw new Error(`Unsupported format "${extension || name}"; use ${MODEL_FORMATS.map((format) => format.label).join(', ')}.`);
    }

    try {
        if (extension === '.obj') {
            const { OBJLoader } = await loaders.obj();
            const group = new OBJLoader().parse(await file.text());
            return collect(group, name, 'OBJ');
        }
        if (extension === '.stl') {
            const { STLLoader } = await loaders.stl();
            const geometry = new STLLoader().parse(await file.arrayBuffer());
            const mesh = geometryMesh(geometry, name);
            if (!mesh) throw new Error(`${name} contains no triangles.`);
            return { name, format: 'STL', meshes: [mesh] };
        }
        if (extension === '.ply') {
            const { PLYLoader } = await loaders.ply();
            const geometry = new PLYLoader().parse(await file.arrayBuffer());
            const mesh = geometryMesh(geometry, name);
            if (!mesh) throw new Error(`${name} contains no triangles.`);
            return { name, format: 'PLY', meshes: [mesh] };
        }

        const { GLTFLoader } = await loaders.gltf();
        const loader = new GLTFLoader();
        let data;
        if (extension === '.gltf') {
            const text = await file.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch {
                throw new Error(`${name} is not valid glTF JSON.`);
            }
            assertSelfContained(json, name);
            data = text;
        } else {
            data = await file.arrayBuffer();
        }
        const gltf = await new Promise((resolve, reject) => {
            try {
                loader.parse(data, '', resolve, reject);
            } catch (error) {
                reject(error);
            }
        });
        return collect(gltf.scene || gltf.scenes?.[0], name, extension === '.glb' ? 'GLB' : 'glTF');
    } catch (error) {
        const message = String(error?.message || error);
        if (/DRACOLoader/i.test(message)) {
            throw new Error(`${name} is Draco-compressed; the decoder is not bundled. Re-export it without Draco.`);
        }
        if (/KTX2Loader|KTX2/i.test(message)) {
            throw new Error(`${name} uses KTX2 textures; the transcoder is not bundled. Re-export it with PNG textures.`);
        }
        throw error instanceof Error ? error : new Error(message);
    }
}
