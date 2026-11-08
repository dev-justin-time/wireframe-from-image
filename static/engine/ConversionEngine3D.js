import * as THREE from 'three';
import { TEXTURES, GLOBAL_CONFIG, textureUrlFor } from '../core/metadata.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Import the refactored factory pattern
import { FurnitureFactory, buildDefaultBox } from './furnitureBuilders.js';
import { toWireframe } from './wireframe.js';
import { formatLength } from '../core/measurements.js';
import { createRoomLabelSprite } from '../features/room-labels.js';
import { resolveItemStyle } from '../features/advanced/materials.js';
import { defaultBottomOf } from '../features/advanced/cabinet-base.js';
import {
    WallBuilder,
    roomSurfacesFromWalls,
    stairOpenings,
    openingCorners,
    openingsForRoom,
    pointInRoom,
    floorTextureUrl,
    buildParametricCabinet,
    storeyConstruction,
    openingToWorld,
    buildTrussRoof,
    createInstancedBoxes,
    exteriorWallIds
} from '../features/studio/index.js';
import { buildStairGeometry, isStairItem } from '../features/stairs/index.js';
import { buildWaterFeature, isWaterFeature } from '../features/landscape/index.js';

const SCALE = GLOBAL_CONFIG.pixelsPerMeter;
const ROOM_HEIGHT = GLOBAL_CONFIG.wallHeight;
const WALL_THICKNESS = GLOBAL_CONFIG.wallThickness;

// FIX 1: Pass loadingManager to TextureLoader
const loadingManager = new THREE.LoadingManager();
loadingManager.onLoad = () => console.log('All textures loaded');
const textureLoader = new THREE.TextureLoader(loadingManager);
const loadedTextures = {};

// A texture that failed to load samples black. Swapping the image for a 1x1
// white canvas keeps the material's base colour instead.
let whitePixelCanvas = null;
function getWhitePixelImage() {
    if (whitePixelCanvas) return whitePixelCanvas;
    whitePixelCanvas = document.createElement('canvas');
    whitePixelCanvas.width = 1;
    whitePixelCanvas.height = 1;
    const ctx = whitePixelCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1, 1);
    return whitePixelCanvas;
}

function loadTexture(url) {
    if (!url) return null;
    if (loadedTextures[url]) return loadedTextures[url];

    const texture = textureLoader.load(
        url,
        (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(2, 2);
            tex.colorSpace = THREE.SRGBColorSpace;
            loadedTextures[url] = tex;
        },
        undefined,
        () => {
            console.warn(`Failed to load texture ${url}, using flat colour`);
            // Materials already reference this texture, so fixing its image is
            // enough to turn every one of them into its plain base colour.
            texture.image = getWhitePixelImage();
            texture.needsUpdate = true;
        }
    );
    return texture;
}

/** Canvas-textured sprite used for metre labels in 3D. */
function createLabelSprite(text) {
    const fontSize = 64;
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    measureCtx.font = `bold ${fontSize}px sans-serif`;

    const padding = 28;
    const width = Math.ceil(measureCtx.measureText(text).width) + padding * 2;
    const height = Math.ceil(fontSize * 1.6);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(17, 24, 39, 0.82)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
    }));

    const spriteHeight = 0.34;
    sprite.scale.set(spriteHeight * (width / height), spriteHeight, 1);
    return sprite;
}

export class ConversionEngine3D {
    constructor(scene) {
        this.scene = scene;
        this.meshes = [];
        
        // Track pending async loads to prevent ghost meshes on rapid deletion
        this.pendingLoads = new Set();
        // Optional host hook: the editor asks for a frame when a GLB lands.
        this.onModelLoaded = null;

        this.gltfLoader = new GLTFLoader();
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        this.gltfLoader.setDRACOLoader(this.dracoLoader);
        this.loadedModels = new Map();

        // Studio feature 39: walls live in their own root. A rebuild replaces
        // floors, items and labels, but the wall builder keeps the CSG meshes of
        // walls whose signature did not change.
        this.root = new THREE.Group();
        this.root.name = 'engine-root';
        this.content = new THREE.Group();
        this.content.name = 'engine-content';
        this.wallRoot = new THREE.Group();
        this.wallRoot.name = 'engine-walls';
        this.root.add(this.content, this.wallRoot);
        this.scene.add(this.root);

        this.wallBuilder = new WallBuilder({ scene: this.wallRoot, loadTexture });
        this.wallMaterial = null;
        this.wallTextureKey = undefined;
        this.lastConvert = null;
    }

    // FIX 4: Recursive disposal to prevent massive memory leaks
    clear() {
        this.clearContent();
        this.wallBuilder?.clearAll();
        this.lastConvert = null;
    }

    /** Remove the non-wall half of the scene; cached wall meshes survive. */
    clearContent() {
        // Abort pending loads to prevent callbacks firing on disposed scenes
        this.pendingLoads.clear();

        [...this.content.children].forEach(child => {
            this.content.remove(child);
            this.disposeObject(child);
        });
        this.meshes = [];
    }

    disposeObject(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
        // Recursively dispose children (crucial for Groups, BoxHelpers, etc.)
        if (obj.children) {
            obj.children.forEach(child => this.disposeObject(child));
        }
    }

    convert(appState, canvasWidth, canvasHeight) {
        const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.clearContent();
        this.addLighting();
        
        const stories = Array.isArray(appState.stories) && appState.stories.length
            ? appState.stories
            : [{ walls: appState.walls, fixtures: appState.fixtures, height: ROOM_HEIGHT, id: 'default', visible: true }];
        const view = { width: canvasWidth, height: canvasHeight };
        const roomMaterials = appState.roomMaterials || {};
        const roomFloors = appState.roomFloors !== false;

        // A default-texture change is a signature change for every wall, so a
        // fresh base material is safe (and the old one is released below).
        const wallTextureKey = String(appState.defaultWallTexture || '');
        const previousWallMaterial = this.wallMaterial;
        if (!this.wallMaterial || this.wallTextureKey !== wallTextureKey) {
            this.wallMaterial = this.createWallMaterial(appState.defaultWallTexture);
            this.wallTextureKey = wallTextureKey;
        }

        let currentElevation = 0;
        let roomCount = 0;
        let openingCount = 0;
        let roofStats = null;
        const wallStats = { built: 0, reused: 0, removed: 0 };

        stories.forEach((story, index) => {
            const isTopStory = index === stories.length - 1;
            const construction = storeyConstruction(story);
            const storyHeight = construction.pitch;
            const wallHeight = construction.wallHeight;
            const floorDepth = construction.floorDepth;
            const visible = story.visible !== false;
            
            const storyGroup = new THREE.Group();
            storyGroup.name = `story-${index}`;
            storyGroup.position.y = currentElevation;
            storyGroup.visible = visible;
            this.content.add(storyGroup);
            this.meshes.push(storyGroup);

            // Feature 38/41: one floor surface per room, with the stair from
            // the storey below cut out of the storey above it.
            const floorStats = this.addFloorsToGroup(storyGroup, story, {
                view,
                defaultFloorTexture: appState.defaultFloorTexture,
                roomMaterials,
                roomFloors,
                storeyIndex: index,
                stories,
                manualOpenings: story.openings || []
            });
            roomCount += floorStats.rooms;
            openingCount += floorStats.openings;
            
            // The ceiling sits at the wall top: the 8 in above it is the floor
            // structure of the storey above.
            if (appState.showCeiling || !isTopStory) {
                this.addCeilingToGroup(storyGroup, wallHeight);
            }

            // The 8 in floor structure between this storey and the one above is
            // a rim band around the shell, visible from outside.
            if (index > 0) {
                this.addFloorBand(storyGroup, story.walls || [], canvasWidth, canvasHeight, floorDepth);
            }

            // Feature 39: dirty walls only.
            const stats = this.wallBuilder.update(index, {
                walls: story.walls || [],
                fixtures: story.fixtures || [],
                canvasWidth,
                canvasHeight,
                wallHeight,
                wallStyles: appState.fixtureStyles,
                defaultTexture: appState.defaultWallTexture,
                selectedWallId: appState.selectedWallId,
                baseMaterial: this.wallMaterial,
                elevation: currentElevation,
                visible
            });
            wallStats.built += stats.built;
            wallStats.reused += stats.reused;
            wallStats.removed += stats.removed;

            this.addItemsToGroup(storyGroup, story.fixtures, appState.fixtureStyles, canvasWidth, canvasHeight, appState.selectedFixture?.id, storyHeight);

            // Labels only on the ground floor, from the same measurement data
            // the 2D canvas draws, so both views quote identical numbers.
            if (index === 0 && appState.showMeasurements && appState.measurements) {
                this.addMeasurementsToGroup(storyGroup, appState.measurements, storyHeight);
            }

            // Room labels own the area/volume chips; the wall lengths above stay
            // with the dimensions toggle.
            if (index === 0 && appState.showRoomLabels !== false && appState.roomLabels?.length) {
                this.addRoomLabels(storyGroup, appState.roomLabels);
            }

            if (isTopStory && appState.showRoof) {
                // Last storey: 8 in ceiling/joist space, then the truss roof.
                roofStats = this.addRoof(
                    story.walls,
                    currentElevation + wallHeight,
                    canvasWidth,
                    canvasHeight,
                    floorDepth,
                    appState.roofConfig
                ) || null;
            }

            currentElevation += construction.pitch;
        });

        this.wallBuilder.prune(stories.length);

        if (previousWallMaterial && previousWallMaterial !== this.wallMaterial) {
            // The signature includes the default texture, so every wall was
            // rebuilt above and no mesh still references the old material.
            previousWallMaterial.dispose();
        }

        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.lastConvert = {
            stories: stories.length,
            rooms: roomCount,
            openings: openingCount,
            walls: wallStats,
            roof: roofStats,
            ms: Math.round((finishedAt - startedAt) * 10) / 10
        };
        return this.lastConvert;
    }

    /** Shared base wall material for the current default texture. */
    createWallMaterial(textureId) {
        const url = textureUrlFor(textureId, 'walls');
        const texture = url ? loadTexture(url) : null;
        return new THREE.MeshStandardMaterial({
            color: 0xe0e0e0,
            roughness: 0.7,
            metalness: 0.1,
            map: texture
        });
    }

    /**
     * Last storey: an 8 in ceiling/joist band, trusses at 24 in o.c. and the
     * roof planes, all generated from the wall footprint (studio feature 41).
     */
    addRoof(walls, elevation, canvasWidth, canvasHeight, floorDepth, roofConfig = {}) {
        if (!walls || walls.length === 0) return null;
        const view = { width: canvasWidth, height: canvasHeight };
        // The roof follows the exterior shell: interior partitions would
        // otherwise pull the ridge and the truss span off the footprint.
        const shellIds = exteriorWallIds(walls, view);
        const shell = walls.filter((wall) => !shellIds.size || shellIds.has(wall.id));
        if (!shell.length) return null;

        const roof = buildTrussRoof(THREE, {
            walls: shell,
            view,
            joistDepth: floorDepth,
            overhang: Number(roofConfig?.overhang) || GLOBAL_CONFIG.roofOverhang || 0.5,
            style: roofConfig?.style,
            pitch: roofConfig?.pitch,
            covering: roofConfig?.covering,
            gutter: roofConfig?.gutter,
            gutters: roofConfig?.gutters,
            ridgeVent: roofConfig?.ridgeVent
        });
        roof.position.y = elevation;
        this.content.add(roof);
        this.meshes.push(roof);
        return { ...roof.userData };
    }

    addLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.content.add(ambient); this.meshes.push(ambient);

        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemi.position.set(0, 20, 0);
        this.content.add(hemi); this.meshes.push(hemi);

        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(10, 15, 10);
        dir.castShadow = true;
        dir.shadow.mapSize.set(2048, 2048);
        // The floor is 40 m across: with the default +/-5 shadow box everything
        // outside it samples the map edge and renders as if fully shadowed.
        dir.shadow.camera.left = -22;
        dir.shadow.camera.right = 22;
        dir.shadow.camera.top = 22;
        dir.shadow.camera.bottom = -22;
        dir.shadow.camera.near = 1;
        dir.shadow.camera.far = 70;
        dir.shadow.camera.updateProjectionMatrix();
        dir.shadow.bias = -0.0005;
        dir.shadow.normalBias = 0.02;
        this.content.add(dir); this.meshes.push(dir);
    }

    /**
     * Floors for one storey (studio features 38 + 41): a surface per closed
     * room with its own material, and stair openings cut out of the storey
     * above. A plan with no closed room still gets the old slab so an empty
     * canvas renders a ground plane.
     */
    addFloorsToGroup(group, story, { view, defaultFloorTexture, roomMaterials, roomFloors, storeyIndex, stories, manualOpenings = [] }) {
        // Room ids repeat per storey, so finishes are keyed "storey:room".
        // Unprefixed keys stay valid for a single-storey plan.
        const scopedMaterials = {};
        Object.entries(roomMaterials || {}).forEach(([key, value]) => {
            const separator = key.indexOf(':');
            if (separator === -1) {
                if (storeyIndex === 0) scopedMaterials[key] = value;
            } else if (Number(key.slice(0, separator)) === storeyIndex) {
                scopedMaterials[key.slice(separator + 1)] = value;
            }
        });

        const rooms = roomFloors
            ? roomSurfacesFromWalls(story.walls || [], view, {
                materials: scopedMaterials,
                defaultTexture: defaultFloorTexture
            })
            : [];
        const openings = roomFloors && storeyIndex > 0
            ? stairOpenings(stories[storeyIndex - 1]?.fixtures || [], view)
            : [];
        // The cutout tool writes world polygons in plan pixels on this storey.
        const cutouts = manualOpenings
            .map((opening) => openingToWorld(opening, view))
            .filter((polygon) => polygon.length >= 3)
            .map((polygon) => polygon.map((point) => ({ x: point.x, z: point.z })));

        if (rooms.length === 0) {
            this.addFloorToGroup(group, defaultFloorTexture, cutouts);
            return { rooms: 0, openings: cutouts.length };
        }

        let cut = 0;
        rooms.forEach(room => {
            const roomHoles = openingsForRoom(room, openings).map((opening) => openingCorners(opening));
            cutouts.forEach((polygon) => {
                if (polygon.some((point) => pointInRoom(point, room.vertices))) roomHoles.push(polygon);
            });
            cut += roomHoles.length;
            group.add(this.createRoomFloor(room, roomHoles));
        });
        return { rooms: rooms.length, openings: cut };
    }

    /** One room's floor surface, with stair holes in world-space rectangles. */
    createRoomFloor(room, openings = []) {
        const shape = new THREE.Shape();
        room.vertices.forEach((point, index) => {
            if (index === 0) shape.moveTo(point.x, point.z);
            else shape.lineTo(point.x, point.z);
        });
        shape.closePath();

        // Each opening is already a polygon of world x/z points.
        openings.forEach(points => {
            const hole = new THREE.Path();
            points.forEach((corner, index) => {
                if (index === 0) hole.moveTo(corner.x, corner.z);
                else hole.lineTo(corner.x, corner.z);
            });
            hole.closePath();
            shape.holes.push(hole);
        });

        const geometry = new THREE.ShapeGeometry(shape);
        // Shape points are (x, z); laying the shape flat maps them to world x/z.
        geometry.rotateX(Math.PI / 2);

        const textureUrl = floorTextureUrl(room.texture);
        const material = new THREE.MeshStandardMaterial({
            color: room.color || 0xf5f5f5,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.2,
            map: textureUrl ? loadTexture(textureUrl) : null
        });

        const floor = new THREE.Mesh(geometry, material);
        floor.receiveShadow = true;
        floor.userData = { type: 'floor-room', roomId: room.id, texture: room.texture, area: room.area };
        return floor;
    }

    addFloorToGroup(group, textureId, holes = []) {
        let geometry;
        if (holes.length) {
            const shape = new THREE.Shape();
            shape.moveTo(-20, -20);
            shape.lineTo(20, -20);
            shape.lineTo(20, 20);
            shape.lineTo(-20, 20);
            shape.closePath();
            holes.forEach((points) => {
                const hole = new THREE.Path();
                points.forEach((corner, index) => {
                    if (index === 0) hole.moveTo(corner.x, corner.z);
                    else hole.lineTo(corner.x, corner.z);
                });
                hole.closePath();
                shape.holes.push(hole);
            });
            geometry = new THREE.ShapeGeometry(shape);
            geometry.rotateX(Math.PI / 2);
        } else {
            geometry = new THREE.PlaneGeometry(40, 40);
            geometry.rotateX(-Math.PI / 2);
        }
        const textureUrl = textureUrlFor(textureId, 'floors');
        const texture = textureUrl ? loadTexture(textureUrl) : null;
        const material = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.2, map: texture });
        const floor = new THREE.Mesh(geometry, material);
        floor.receiveShadow = true;
        floor.userData = { type: 'floor-slab' };
        group.add(floor);
    }

    /** 8 in rim/joist band around a storey floor, below the floor surface. */
    addFloorBand(group, walls, canvasWidth, canvasHeight, floorDepth) {
        if (!walls?.length || !(floorDepth > 0)) return;
        const material = new THREE.MeshStandardMaterial({ color: 0x8f6b45, roughness: 0.9 });
        const bands = [];

        walls.forEach((wall) => {
            if (!wall?.start || !wall?.end) return;
            const x1 = (wall.start.x - canvasWidth / 2) / SCALE;
            const z1 = (wall.start.y - canvasHeight / 2) / SCALE;
            const x2 = (wall.end.x - canvasWidth / 2) / SCALE;
            const z2 = (wall.end.y - canvasHeight / 2) / SCALE;
            const length = Math.hypot(x2 - x1, z2 - z1);
            if (length < 0.05) return;
            bands.push({
                x: (x1 + x2) / 2,
                y: -floorDepth / 2,
                z: (z1 + z2) / 2,
                width: length,
                height: floorDepth,
                depth: 0.06,
                rotationY: -Math.atan2(z2 - z1, x2 - x1)
            });
        });

        // One draw call for the whole rim instead of one mesh per wall.
        const bandMesh = createInstancedBoxes(bands, {
            material,
            name: 'floor-joist-bands'
        });
        if (bandMesh) group.add(bandMesh);
    }

    addCeilingToGroup(group, height) {
        const geometry = new THREE.PlaneGeometry(40, 40);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 1.0 });
        const ceiling = new THREE.Mesh(geometry, material);
        ceiling.rotation.x = Math.PI / 2;
        // A hair below the storey top so the next storey's floor wins the
        // depth test instead of z-fighting with it.
        ceiling.position.y = height - 0.005;
        ceiling.receiveShadow = true;
        group.add(ceiling);
    }

    addItemsToGroup(group, fixtures, fixtureStyles, canvasWidth, canvasHeight, selectedId, storeyHeight = ROOM_HEIGHT) {
        if (!fixtures) return;
        fixtures.forEach(fixture => {
            // Hidden pieces stay in the model so they can be brought back, but
            // they are not built into the scene.
            if (fixture.visible === false) return;
            // Per-item style wins, then the product line's palette (feature 30),
            // then the item metadata colour.
            const style = resolveItemStyle(fixture, fixtureStyles);
            // A resized item overrides the type's dimensions, so every builder
            // (and the GLB path) sees the effective size.
            const sized = fixture.size
                ? { ...fixture, metadata: { ...fixture.metadata, ...fixture.size } }
                : fixture;
            const mesh = this.createItemMesh(sized, style, storeyHeight);
            if (mesh) {
                const x = (fixture.x - canvasWidth / 2) / SCALE;
                const z = (fixture.y - canvasHeight / 2) / SCALE;
                // Builders place a piece at its default height (floor-standing or
                // mounted); `elevation` is the extra lift set by elevation-view
                // dragging, so it is added on top without touching the builders.
                const lift = fixture.elevation || 0;
                // The builder bakes the metadata mount height into position.y;
                // swap in the effective default bottom (feature 24) so a
                // per-item base override moves the whole piece.
                const metadataBottom = typeof fixture.metadata?.mountHeight === 'number' ? fixture.metadata.mountHeight : 0;
                const baseOffset = defaultBottomOf(fixture) - metadataBottom;
                mesh.position.set(x, mesh.position.y + lift + baseOffset, z);
                mesh.rotation.y = -fixture.rotation;
                // A flipped piece is mirrored about its own centre so its
                // handles/doors face the other way without moving in plan.
                if (fixture.flipped?.x) mesh.scale.x *= -1;
                if (fixture.flipped?.z) mesh.scale.z *= -1;
                
                mesh.userData.id = fixture.id;
                mesh.userData.type = 'item';
                
                mesh.traverse((child) => {
                    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
                });
                
                if (fixture.id === selectedId) {
                    const box = new THREE.BoxHelper(mesh, 0xffff00);
                    box.material.depthTest = false;
                    box.material.transparent = true;
                    group.add(box);
                }
                group.add(mesh);
            }
        });
    }

    // --- Legacy single-story adapters -------------------------------------
    // Kept so older callers that used the pre story-group API keep working;
    // they now go through the same content root and wall builder.
    addFloor(textureId) {
        const group = new THREE.Group();
        this.content.add(group);
        this.meshes.push(group);
        this.addFloorToGroup(group, textureId);
    }

    addCeiling(height = ROOM_HEIGHT) {
        const group = new THREE.Group();
        this.content.add(group);
        this.meshes.push(group);
        this.addCeilingToGroup(group, height);
    }

    addWalls(walls, textureId, canvasWidth, canvasHeight, fixtures = []) {
        this.wallBuilder.update(0, {
            walls,
            fixtures,
            canvasWidth,
            canvasHeight,
            wallHeight: ROOM_HEIGHT,
            defaultTexture: textureId,
            baseMaterial: this.wallMaterial || this.createWallMaterial(textureId)
        });
    }

    /**
     * Metre labels for walls and room areas. Both views read these from
     * measurements.js, so 2D and 3D always agree.
     */
    addMeasurementsToGroup(group, measurements, wallHeight) {
        if (!measurements) return;

        (measurements.walls || []).forEach((wall) => {
            if (!wall.midpoint || wall.length < 0.6) return;
            const sprite = createLabelSprite(formatLength(wall.length));
            sprite.position.set(wall.midpoint.x, wallHeight + 0.2, wall.midpoint.z);
            group.add(sprite);
        });

    }

    /**
     * Room labels at the polygon centroid, built by features/room-labels.js from
     * the wall graph. Position is planToWorld(centroid) from world-space.js.
     */
    addRoomLabels(group, labels = []) {
        (labels || []).forEach((label) => {
            if (!label?.world || !(label.area >= 0.5)) return;
            const sprite = createRoomLabelSprite(THREE, label);
            sprite.position.set(label.world.x, label.world.y, label.world.z);
            group.add(sprite);
        });
    }

    // FIX 3 Applied: Guard async loads
    async loadModel(url, id) {
        if (this.loadedModels.has(url)) return this.loadedModels.get(url).clone();

        try {
            const gltf = await this.gltfLoader.loadAsync(url);
            gltf.scene.traverse(child => {
                if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            });
            this.loadedModels.set(url, gltf.scene);
            return gltf.scene.clone();
        } catch (error) {
            console.error('Failed to load model:', url, error);
            return null;
        }
    }

    // FIX 6 Applied: Factory Pattern replacing 400+ line switch statement
    createItemMesh(fixture, style = {}, storeyHeight = ROOM_HEIGHT) {
        const color = style.color || fixture.metadata?.color || 0xffffff;
        const materialParams = { color: new THREE.Color(color) };

        const itemTexture = textureUrlFor(style.texture, 'floors');
        if (itemTexture) {
            materialParams.map = loadTexture(itemTexture);
        }

        if (style.material === 'metal') {
            materialParams.metalness = 0.9; materialParams.roughness = 0.1;
        } else if (style.material === 'gloss') {
            materialParams.metalness = 0.1; materialParams.roughness = 0.2;
        } else {
            materialParams.metalness = 0; materialParams.roughness = 0.9;
        }

        const material = new THREE.MeshStandardMaterial(materialParams);
        const width = fixture.metadata?.width || 0.5;
        const depth = fixture.metadata?.depth || 0.5;
        const height = fixture.metadata?.height || 0.5;

        if (fixture.modelUrl || fixture.metadata?.modelUrl) {
            const modelUrl = fixture.modelUrl || fixture.metadata.modelUrl;
            const placeholder = new THREE.Group();
            placeholder.userData = { id: fixture.id, type: 'item' };

            // A plain box stands in until the GLB arrives, and stays if the
            // model cannot be fetched, so the piece is never invisible.
            const proxy = buildDefaultBox(width, height, depth, material, fixture);
            placeholder.add(proxy);

            const loadPromise = this.loadModel(modelUrl, fixture.id).then(model => {
                this.pendingLoads.delete(loadPromise);
                if (!model || !placeholder.parent) return;

                placeholder.remove(proxy);
                this.disposeObject(proxy);

                // Fit the model inside the item's real footprint, keeping its
                // aspect ratio and resting its base on the floor. The holder is
                // the pivot the lab animation controls rotate and shake around.
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const centre = box.getCenter(new THREE.Vector3());
                const fit = Math.min(
                    width / Math.max(size.x, 1e-6),
                    height / Math.max(size.y, 1e-6),
                    depth / Math.max(size.z, 1e-6)
                ) * (fixture.metadata?.scale || 1);
                model.scale.setScalar(fit);
                model.position.set(-centre.x * fit, -box.min.y * fit, -centre.z * fit);

                const holder = new THREE.Group();
                holder.name = 'lab-product-model';
                holder.userData = { labProductModel: true };
                holder.add(model);
                placeholder.add(holder);
                placeholder.userData.labProductPivot = holder;
                this.onModelLoaded?.(fixture.id);
            });
            this.pendingLoads.add(loadPromise);
            return placeholder;
        }

        // A configured cabinet (studio feature 44) is built from its parts
        // model instead of the line's fixed builder, so doors, drawers and
        // shelves follow the inspector.
        let mesh;
        if (isStairItem(fixture)) {
            // The stair suite owns the geometry: code-sized run, automatic
            // landings, and the outdoor system's structure.
            mesh = buildStairGeometry(fixture, { storeyHeight, color });
            mesh.userData = { ...mesh.userData, type: 'item', id: fixture.id };
        } else if (isWaterFeature(fixture)) {
            // Pools and water features sit on the grade plane with their coping
            // at floor level, so no lift is applied unless the user sets one.
            mesh = buildWaterFeature(fixture);
            mesh.userData = { ...mesh.userData, type: 'item', id: fixture.id };
        } else if (fixture.config) {
            mesh = buildParametricCabinet({
                THREE,
                width,
                height,
                depth,
                material,
                config: fixture.config,
                fixture
            });
            // The parts model sits on y = 0; a wall cabinet keeps its mount.
            mesh.position.y = fixture.metadata?.mountHeight || 0;
            mesh.userData = { type: 'item', id: fixture.id, config: { ...fixture.config } };
        } else {
            // Delegate to the factory registry, fallback to default box builder
            const builder = FurnitureFactory[fixture.type] || buildDefaultBox;
            mesh = builder(width, height, depth, material, fixture);
        }

        // Lines-only lines (e.g. the shaker cabinetry) keep the built geometry
        // but render it as edges, so the construction stays readable.
        if (mesh && fixture.metadata?.wireframe) {
            const wire = toWireframe(mesh, {
                color: style.wireframeColor || fixture.metadata.wireframeColor || style.color || 0x334155
            });
            this.disposeObject(mesh); // the solid source is never rendered
            return wire;
        }

        return mesh;
    }
}