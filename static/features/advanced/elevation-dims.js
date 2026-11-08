import { formatLength } from '../../core/measurements.js';

/**
 * Advanced feature 31 - annotated elevation dimension strings.
 *
 * In an elevation the interesting numbers are the widths of the pieces and the
 * gaps between them. Both are read from the built meshes (so a resized piece
 * measures its real size), projected onto the view's horizontal axis, and
 * printed with measurements.formatLength - the same formatter the plan and the
 * wall labels use.
 */

/** Horizontal plan axis for each elevation side, matching scene-elevation. */
export function elevationAxisOf(side) {
    switch (side) {
        case 'back':
        case 'front':
            return 'x';
        case 'left':
        case 'right':
            return 'z';
        default:
            return 'x';
    }
}

/** Horizontal world extent of one mesh, in metres. */
function spanOf(THREE, object, axis) {
    const box = new THREE.Box3().setFromObject(object);
    if (!Number.isFinite(box.min[axis]) || !Number.isFinite(box.max[axis])) return null;
    return {
        min: box.min[axis],
        max: box.max[axis],
        top: box.max.y,
        centre: (box.min[axis] + box.max[axis]) / 2
    };
}

/**
 * Build the labels for the current run. Returns
 *   { pieces: [{ id, label, from, to, position }], gaps: [{ label, position }] }
 * with positions in world metres (y just above the pieces).
 */
export function buildElevationDimensions({ THREE, fixtures = [], getObject, side = 'front', minGap = 0.02 } = {}) {
    const axis = elevationAxisOf(side);
    const pieces = [];

    (fixtures || []).forEach((fixture) => {
        if (!fixture || fixture.visible === false) return;
        const object = getObject ? getObject(fixture.id) : null;
        if (!object) return;
        const span = spanOf(THREE, object, axis);
        if (!span) return;

        pieces.push({
            id: fixture.id,
            fixture,
            from: span.min,
            to: span.max,
            top: span.top,
            position: {
                x: axis === 'x' ? span.centre : 0,
                y: span.top + 0.12,
                z: axis === 'z' ? span.centre : 0
            }
        });
    });

    if (pieces.length === 0) return { pieces: [], gaps: [] };

    pieces.sort((a, b) => a.from - b.from);

    const gaps = [];
    for (let i = 1; i < pieces.length; i++) {
        const gap = pieces[i].from - pieces[i - 1].to;
        if (gap <= minGap) continue;
        const centre = pieces[i - 1].to + gap / 2;
        gaps.push({
            label: formatLength(gap),
            gap,
            position: {
                x: axis === 'x' ? centre : 0,
                y: Math.max(pieces[i - 1].top, pieces[i].top) + 0.02,
                z: axis === 'z' ? centre : 0
            }
        });
    }

    return {
        pieces: pieces.map((piece) => ({
            id: piece.id,
            label: formatLength(piece.to - piece.from),
            from: piece.from,
            to: piece.to,
            position: piece.position
        })),
        gaps
    };
}

function createChip(THREE, text, color = 'rgba(15, 23, 42, 0.85)') {
    const fontSize = 40;
    const padding = 18;
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = `bold ${fontSize}px sans-serif`;
    const width = Math.ceil(measure.measureText(text).width) + padding * 2;
    const height = Math.ceil(fontSize * 1.5);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false }));
    const spriteHeight = 0.17;
    sprite.scale.set(spriteHeight * (width / height), spriteHeight, 1);
    return sprite;
}

/** Build a three.js group for the dimension labels (not added to the scene). */
export function createElevationDimensionGroup({ THREE, dimensions, axis = 'x' }) {
    const group = new THREE.Group();
    group.name = 'elevation-dimensions';
    group.userData.type = 'annotation';

    if (!dimensions) return group;

    dimensions.pieces.forEach((piece) => {
        const sprite = createChip(THREE, piece.label);
        sprite.position.set(piece.position.x, piece.position.y, piece.position.z);
        group.add(sprite);
    });

    dimensions.gaps.forEach((gap) => {
        const sprite = createChip(THREE, gap.label, 'rgba(14, 116, 144, 0.9)');
        sprite.position.set(gap.position.x, gap.position.y, gap.position.z);
        group.add(sprite);
    });

    return group;
}
