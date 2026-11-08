import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { TEXTURES } from '../../core/metadata.js';
import { PIXELS_PER_METER, WALL_THICKNESS } from '../../core/world-space.js';
import { wallFinishOf } from '../wall-finish.js';
import { openingsForWall } from '../advanced/openings.js';

/**
 * Studio feature 39 - WallBuilder, the wall half of the 3D engine.
 *
 * Walls are the only CSG work in a rebuild, and they change far less often than
 * items do. The builder owns one group per storey, keeps a mesh per wall id and
 * compares a signature (endpoints, thickness, height, finish, selection and the
 * clamped openings). Only walls whose signature changed are rebuilt; unchanged
 * meshes are reused, and meshes for walls that no longer exist are disposed.
 */

const SCALE = PIXELS_PER_METER;

const round = (value) => Math.round(value * 1000) / 1000;

export function wallSignature(wall, fixtures, { wallHeight, wallStyles, defaultTexture, selectedWallId } = {}) {
    const openings = openingsForWall(wall, fixtures).map((opening) => ({
        x: round(opening.plan.x),
        y: round(opening.plan.y),
        w: round(opening.width),
        h: round(opening.height),
        sill: round(opening.sill),
        shape: opening.shape,
        rotation: round(opening.rotation)
    }));

    const finish = wallFinishOf(wall, wallStyles, defaultTexture);

    return JSON.stringify({
        a: [round(wall.start.x), round(wall.start.y)],
        b: [round(wall.end.x), round(wall.end.y)],
        thickness: round(wall.thickness ?? 0),
        height: round(typeof wall.height === 'number' ? wall.height : wallHeight),
        selected: wall.id === selectedWallId,
        color: finish.color || null,
        texture: finish.texture || null,
        openings
    });
}

export class WallBuilder {
    constructor({ scene, loadTexture } = {}) {
        this.scene = scene;
        this.loadTexture = loadTexture || (() => null);
        this.evaluator = new Evaluator();
        this.stories = new Map(); // storyIndex -> { group, walls: Map<id, {mesh, signature}> }
        this.builds = 0;
        this.reuses = 0;
    }

    storyGroup(index) {
        if (!this.stories.has(index)) {
            const group = new THREE.Group();
            group.name = `walls-story-${index}`;
            group.userData.type = 'wall-group';
            this.scene.add(group);
            this.stories.set(index, { group, walls: new Map() });
        }
        return this.stories.get(index);
    }

    materialFor(wall, { wallStyles, defaultTexture, selectedWallId, baseMaterial }) {
        const finish = wallFinishOf(wall, wallStyles, defaultTexture);
        // Every wall owns its material, so disposing one wall can never take
        // the engine's shared base material down with it.
        let material = baseMaterial.clone();
        if (finish.color || finish.textureUrl) {
            material = baseMaterial.clone();
            if (finish.color) material.color.set(finish.color);
            if (finish.textureUrl) {
                material.map = this.loadTexture(finish.textureUrl);
                material.needsUpdate = true;
            }
        }
        if (wall.id === selectedWallId) {
            material = material.clone();
            material.color.set(0xf59e0b);
        }
        return material;
    }

    buildWall(wall, fixtures, canvasWidth, canvasHeight, wallHeight, material) {
        const dx = (wall.end.x - wall.start.x) / SCALE;
        const dy = (wall.end.y - wall.start.y) / SCALE;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const height = typeof wall.height === 'number' && wall.height > 0 ? wall.height : wallHeight;

        const wallGeo = new THREE.BoxGeometry(length, height, WALL_THICKNESS);
        const cx = ((wall.start.x + wall.end.x) / 2 - canvasWidth / 2) / SCALE;
        const cz = ((wall.start.y + wall.end.y) / 2 - canvasHeight / 2) / SCALE;

        const wallBrush = new Brush(wallGeo, material);
        wallBrush.userData = { id: wall.id, type: 'wall' };
        wallBrush.position.set(cx, height / 2, cz);
        wallBrush.rotation.y = -angle;
        wallBrush.updateMatrixWorld();

        const openings = openingsForWall(wall, fixtures);

        if (openings.length === 0) {
            const mesh = new THREE.Mesh(wallGeo, material);
            mesh.userData = { id: wall.id, type: 'wall' };
            mesh.position.copy(wallBrush.position);
            mesh.rotation.copy(wallBrush.rotation);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        }

        let resultBrush = wallBrush;
        openings.forEach((opening) => {
            const w = opening.width;
            const h = opening.height;
            const thickness = WALL_THICKNESS * 1.2;

            const holeGeo = opening.shape === 'circle'
                ? new THREE.CylinderGeometry(w / 2, w / 2, thickness, 32).rotateX(Math.PI / 2)
                : new THREE.BoxGeometry(w, h, thickness);

            const holeBrush = new Brush(holeGeo);
            const hx = (opening.plan.x - canvasWidth / 2) / SCALE;
            const hz = (opening.plan.y - canvasHeight / 2) / SCALE;
            const hy = opening.sill + h / 2 + (opening.sill === 0 ? 0.01 : 0);

            holeBrush.position.set(hx, hy, hz);
            holeBrush.rotation.y = -opening.rotation;
            holeBrush.updateMatrixWorld();

            resultBrush = this.evaluator.evaluate(resultBrush, holeBrush, SUBTRACTION);
        });

        resultBrush.castShadow = true;
        resultBrush.receiveShadow = true;
        resultBrush.userData = { id: wall.id, type: 'wall' };
        return resultBrush;
    }

    /**
     * Reconcile one storey's walls. Returns { built, reused, removed }.
     * `baseMaterial` is the engine's shared default wall material.
     */
    update(index, {
        walls = [],
        fixtures = [],
        canvasWidth = 1,
        canvasHeight = 1,
        wallHeight = 2.7,
        wallStyles = null,
        defaultTexture = null,
        selectedWallId = null,
        baseMaterial,
        elevation = 0,
        visible = true
    } = {}) {
        const story = this.storyGroup(index);
        story.group.position.y = elevation;
        story.group.visible = visible !== false;

        const material = baseMaterial || new THREE.MeshStandardMaterial({
            color: 0xe0e0e0,
            roughness: 0.7,
            metalness: 0.1,
            map: defaultTexture && TEXTURES.walls[defaultTexture] ? this.loadTexture(TEXTURES.walls[defaultTexture]) : null
        });

        const seen = new Set();
        let built = 0;
        let reused = 0;

        (walls || []).forEach((wall) => {
            if (!wall?.start || !wall?.end) return;
            seen.add(wall.id);

            const signature = wallSignature(wall, fixtures, {
                wallHeight,
                wallStyles,
                defaultTexture,
                selectedWallId
            });

            const existing = story.walls.get(wall.id);
            if (existing && existing.signature === signature) {
                reused += 1;
                return;
            }

                if (existing) {
                story.group.remove(existing.mesh);
                this.dispose(existing.mesh);
            }

            const mesh = this.buildWall(
                wall,
                fixtures,
                canvasWidth,
                canvasHeight,
                wallHeight,
                this.materialFor(wall, { wallStyles, defaultTexture, selectedWallId, baseMaterial: material })
            );
            story.group.add(mesh);
            story.walls.set(wall.id, { mesh, signature });
            built += 1;
        });

        let removed = 0;
        story.walls.forEach((entry, id) => {
            if (seen.has(id)) return;
            story.group.remove(entry.mesh);
            this.dispose(entry.mesh);
            story.walls.delete(id);
            removed += 1;
        });

        this.builds += built;
        this.reuses += reused;
        return { built, reused, removed };
    }

    /** Drop storeys that no longer exist. */
    prune(count) {
        [...this.stories.keys()].forEach((index) => {
            if (index < count) return;
            const story = this.stories.get(index);
            this.scene.remove(story.group);
            story.walls.forEach((entry) => this.dispose(entry.mesh));
            this.stories.delete(index);
        });
    }

    dispose(object) {
        object.traverse?.((child) => {
            child.geometry?.dispose?.();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach((entry) => entry.dispose?.());
                else child.material.dispose?.();
            }
        });
        object.geometry?.dispose?.();
        object.material?.dispose?.();
    }

    get stats() {
        let walls = 0;
        this.stories.forEach((story) => { walls += story.walls.size; });
        return { stories: this.stories.size, walls, builds: this.builds, reuses: this.reuses };
    }

    clearAll() {
        this.stories.forEach((story) => {
            this.scene.remove(story.group);
            story.walls.forEach((entry) => this.dispose(entry.mesh));
        });
        this.stories.clear();
    }
}
