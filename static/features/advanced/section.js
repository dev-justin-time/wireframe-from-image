import * as THREE from 'three';

/**
 * Advanced feature 32 - section box / clipping plane.
 *
 * One horizontal clipping plane on the engine's renderer: everything above the
 * cut height disappears, which turns the 3D view into a walk-through section
 * looking down at the plan without moving the camera. The plane is applied to
 * the renderer rather than to materials, so rebuilt meshes are clipped too.
 */

export const SECTION_HEIGHT = 1.4;

export function createSectionBox({ renderer, height = SECTION_HEIGHT } = {}) {
    if (!renderer) return null;

    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), height);
    let enabled = false;
    let cutHeight = height;

    const apply = () => {
        renderer.localClippingEnabled = true;
        renderer.clippingPlanes = enabled ? [plane] : [];
        plane.constant = cutHeight;
    };

    return {
        get enabled() {
            return enabled;
        },
        get height() {
            return cutHeight;
        },
        get plane() {
            return plane;
        },
        setEnabled(value) {
            enabled = Boolean(value);
            apply();
        },
        toggle() {
            this.setEnabled(!enabled);
            return enabled;
        },
        setHeight(metres) {
            const value = Number(metres);
            if (Number.isFinite(value) && value > 0.2) cutHeight = value;
            apply();
        },
        dispose() {
            enabled = false;
            apply();
        }
    };
}
