import { WALL_HEIGHT } from '../core/world-space.js';
import { isVisible } from './visibility.js';

/**
 * Elevation annotations and the live height readout.
 *
 * An elevation view has no perspective to judge height by, so every piece in
 * the run gets a dashed height line from the floor to its top and a chip with
 * that height. While a piece is dragged, a floating readout shows the bottom
 * and top it is snapping between, so the drag can be aimed at a number.
 */

/** Remove an annotation group and free its geometries/materials. */
export function disposeAnnotationGroup(group) {
    if (!group) return;
    group.parent?.remove(group);
    group.traverse((child) => {
        child.geometry?.dispose?.();
        if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((entry) => entry.dispose?.());
            else child.material.dispose?.();
        }
        child.material?.map?.dispose?.();
    });
}

function createChipSprite(THREE, text) {
    const fontSize = 44;
    const padding = 20;

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    measureCtx.font = `bold ${fontSize}px sans-serif`;
    const width = Math.ceil(measureCtx.measureText(text).width) + padding * 2;
    const height = Math.ceil(fontSize * 1.5);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(14, 116, 144, 0.9)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false
    }));
    const spriteHeight = 0.2;
    sprite.scale.set(spriteHeight * (width / height), spriteHeight, 1);
    return sprite;
}

/**
 * Build (but do not add) an annotation group for the current elevation run.
 * `getObject` maps a fixture id to its mesh, so heights come from the built
 * geometry rather than from metadata.
 */
export function buildElevationAnnotations({
    THREE,
    fixtures = [],
    getObject,
    height = WALL_HEIGHT,
    showChips = true
} = {}) {
    const group = new THREE.Group();
    group.name = 'elevation-height-annotations';
    group.userData.type = 'annotation';

    (fixtures || []).forEach((fixture) => {
        if (!fixture || !isVisible(fixture)) return;
        const object = getObject ? getObject(fixture.id) : null;
        if (!object) return;

        const box = new THREE.Box3().setFromObject(object);
        if (!Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)) return;

        const centre = box.getCenter(new THREE.Vector3());
        const top = Math.max(box.max.y, 0);

        // Dashed height line, floor to top.
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(centre.x, 0, centre.z),
            new THREE.Vector3(centre.x, top, centre.z)
        ]);
        const material = new THREE.LineDashedMaterial({
            color: 0x0e7490,
            dashSize: 0.07,
            gapSize: 0.05,
            transparent: true,
            opacity: 0.85,
            depthTest: false
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.renderOrder = 5;
        group.add(line);

        // Floor tick.
        const tick = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(centre.x - 0.08, 0, centre.z),
            new THREE.Vector3(centre.x + 0.08, 0, centre.z)
        ]);
        group.add(new THREE.Line(tick, new THREE.LineBasicMaterial({ color: 0x0e7490, depthTest: false })));

        if (showChips) {
            const chip = createChipSprite(THREE, `${top.toFixed(2)} m`);
            chip.position.set(centre.x, Math.min(top + 0.16, height + 0.2), centre.z);
            chip.renderOrder = 6;
            group.add(chip);
        }
    });

    return group;
}

/**
 * The floating readout shown while a piece is dragged in elevation.
 * `element` is any DOM node; the readout only sets its text and hidden class.
 */
export function createHeightReadout(element) {
    if (!element) return { show() {}, hide() {}, dispose() {} };

    return {
        show({ bottom = 0, top = 0, lift = 0 } = {}) {
            const parts = [
                `bottom ${bottom.toFixed(2)} m`,
                `top ${top.toFixed(2)} m`,
                `height ${Math.max(0, top - bottom).toFixed(2)} m`
            ];
            if (Math.abs(lift) > 0.005) parts.push(`lift ${lift >= 0 ? '+' : ''}${lift.toFixed(2)} m`);
            element.textContent = parts.join('  ·  ');
            element.classList.remove('hidden');
        },
        hide() {
            element.classList.add('hidden');
        },
        dispose() {
            element.classList.add('hidden');
        }
    };
}
