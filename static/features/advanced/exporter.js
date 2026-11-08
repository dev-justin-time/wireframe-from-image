import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

/**
 * Advanced feature 37 - scene export from the editor.
 *
 * Wraps the two exporters the app already ships with and adds GLB (binary
 * glTF), so the editor's export buttons all go through one place that returns
 * a { data, mime, extension } result instead of tripping over each exporter's
 * own callback API.
 */

export const EXPORT_FORMATS = ['gltf', 'glb', 'obj'];

export async function exportScene(scene, format = 'gltf', options = {}) {
    if (!scene) throw new Error('nothing to export');
    const normalized = EXPORT_FORMATS.includes(format) ? format : 'gltf';

    if (normalized === 'obj') {
        const text = new OBJExporter().parse(scene);
        return { format: 'obj', data: text, mime: 'text/plain', extension: 'obj' };
    }

    const exporter = new GLTFExporter();
    const binary = normalized === 'glb';
    const result = await exporter.parseAsync(scene, {
        binary,
        onlyVisible: true,
        ...options
    });

    if (binary) {
        return { format: 'glb', data: result, mime: 'model/gltf-binary', extension: 'glb' };
    }

    return { format: 'gltf', data: JSON.stringify(result), mime: 'model/gltf+json', extension: 'gltf' };
}

export function downloadExport(result, filename = 'project') {
    if (!result) return null;
    if (typeof document === 'undefined' || typeof URL === 'undefined') return result;

    const blob = new Blob([result.data], { type: result.mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${result.extension}`;
    link.click();
    URL.revokeObjectURL(url);
    return result;
}
