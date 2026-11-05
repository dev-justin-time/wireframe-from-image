// The 3D scene, ported from floorplan_3d's scene/SharedViewer.js: three.js with
// an orbit camera framed to the footprint, RoomEnvironment image-based lighting,
// a shadow-casting key light, one floor plate per detected room, and a cutaway
// that hides the walls standing between the camera and the interior so orbiting
// always looks into the plan instead of at a closed box.
//
// Input is the plan this server extracts, already in metres:
//   walls: [{ x1, y1, x2, y2 }]
//   rooms: [{ name, area, polygon: [[x, y], ...] }]
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  frameElevation,
  applyElevationVisibility,
  ELEVATION_SIDES,
} from './engines/scene/scene-elevation.js';
import { itemBoxes, itemSpace } from './plan-items.js';

// Warm/cool alternates so adjacent rooms on the same plan read apart.
const ROOM_FLOOR_COLOURS = [0xe4d9c6, 0xd7e3ea, 0xe6e0d2, 0xd9e2d6, 0xe8dcdc, 0xdfe0e8];

// One orbit direction for every plan, so a screenshot of two plans compares.
const SCENE_VIEW = { azimuth: Math.PI / 4, elevation: 0.62, padding: 1.25 };

/** Distance at which a sphere of `radius` fills the viewport for this camera. */
function distanceToFit(radius, camera, padding) {
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (camera.aspect || 1));
  return (radius * padding) / Math.sin(Math.min(vFov, hFov) / 2);
}

export class PlanViewer {
  constructor(host) {
    this.host = host;
    this.plan = null;
    this.bounds = null;
    this.wallMeshes = [];
    this.roomSlabs = [];
    this.itemMeshes = new Map();
    this.itemSpace = null;
    // Teardown hooks for the listeners the scene mounts outside three.js (the
    // elevation drag binds to the window, so disposing the viewer is not enough).
    this.disposers = [];
    this.grid = null;
    this.options = { height: 2.7, thickness: 0.15, cutaway: true, plates: true };

    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeef1f4);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 400);
    this.camera.position.set(8.2, 6.2, 8.2);

    // A side elevation looks through an orthographic camera on the same scene,
    // so openings read flat instead of in perspective; null means orbit view.
    this.elevationCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.elevation = null;
    this.worldBounds = null;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.72;
    host.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 80;

    this.planGroup = new THREE.Group();
    this.scene.add(this.planGroup);

    // The ability panel's "3D axes" toggle and "hide walls" toggle both need
    // something to switch; the walls carry userData.type so the toggles can
    // find them after every rebuild.
    this.axes = new THREE.AxesHelper(2);
    this.axes.visible = false;
    this.scene.add(this.axes);
    this.hideWalls = false;

    this.setupEnvironment();
    this.setupLights();

    this.animateBound = this.animate.bind(this);
    this.frame = 0;
    this.animateBound();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(host);
  }

  /**
   * Image-based lighting from three's RoomEnvironment: it gives the white wall
   * material something to reflect, which is what makes the render read as a
   * lit interior rather than flat shaded boxes.
   */
  setupEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment(this.renderer);
    this.environmentMap = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environment = this.environmentMap;
    envScene.dispose?.();
    pmrem.dispose();
  }

  setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.08));
    this.scene.add(new THREE.HemisphereLight(0xdde9ff, 0x8d8378, 0.22));

    // Key light across the room from the default orbit direction, so the cast
    // shadows fall towards the camera instead of hiding behind the near walls.
    const key = new THREE.DirectionalLight(0xfff2e2, 1.6);
    key.position.set(-6.5, 10, -4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
    this.key = key;
    this.scene.add(key);

    // Fill from the camera side keeps the visible wall faces lit.
    const fill = new THREE.DirectionalLight(0xdbe7ff, 0.75);
    fill.position.set(7, 7, 7);
    this.scene.add(fill);
  }

  /** Replace the scene's plan and refit the camera to it. */
  setPlan(plan) {
    this.plan = plan;
    return this.rebuild(true);
  }

  /** Change the massing without moving the camera. */
  setOptions(options) {
    Object.assign(this.options, options);
    if (this.plan) this.rebuild(false);
  }

  rebuild(refit) {
    this.clearPlan();
    const plan = this.plan;
    if (!plan) return false;

    const walls = (Array.isArray(plan.walls) ? plan.walls : [])
      .map((wall) => [Number(wall.x1), Number(wall.y1), Number(wall.x2), Number(wall.y2)])
      .filter((wall) => wall.every(Number.isFinite));
    if (!walls.length) return false;

    const rooms = (Array.isArray(plan.rooms) ? plan.rooms : [])
      .map((room) => ({
        name: room.name || 'Room',
        area: Number(room.area) || 0,
        polygon: (Array.isArray(room.polygon) ? room.polygon : [])
          .map(([x, y]) => [Number(x), Number(y)])
          .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)),
      }))
      .filter((room) => room.polygon.length > 2);

    const xs = [];
    const zs = [];
    for (const [x1, y1, x2, y2] of walls) { xs.push(x1, x2); zs.push(y1, y2); }
    for (const room of rooms) for (const [x, y] of room.polygon) { xs.push(x); zs.push(y); }
    const bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    };
    const centre = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
    const toWorld = (x, y) => [x - centre.x, y - centre.z];

    const { height, thickness } = this.options;
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.02,
      envMapIntensity: 0.35,
    });
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xb08a5e,
      roughness: 0.6,
      metalness: 0.02,
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x9fd4f0,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      envMapIntensity: 0.9,
    });

    // The openings the extractor classified, in world metres. A wall is built
    // around them: solid either side, a lintel over the head, the apron under a
    // window, then glass or a door leaf in the hole that is left.
    const openings = (Array.isArray(plan.openings) ? plan.openings : [])
      .map((opening) => {
        const [ox1, oz1] = toWorld(Number(opening.x1), Number(opening.y1));
        const [ox2, oz2] = toWorld(Number(opening.x2), Number(opening.y2));
        return {
          kind: opening.kind === 'window' ? 'window' : 'door',
          x1: ox1,
          z1: oz1,
          x2: ox2,
          z2: oz2,
          sill: Number(opening.sill) || 0,
          head: Number(opening.head) || 0,
        };
      })
      .filter((opening) => [opening.x1, opening.z1, opening.x2, opening.z2].every(Number.isFinite)
        && Math.hypot(opening.x2 - opening.x1, opening.z2 - opening.z1) > 0.15);

    for (const [x1, y1, x2, y2] of walls) {
      const [wx1, wz1] = toWorld(x1, y1);
      const [wx2, wz2] = toWorld(x2, y2);
      const length = Math.hypot(wx2 - wx1, wz2 - wz1);
      if (length < 0.05) continue;
      const ux = (wx2 - wx1) / length;
      const uz = (wz2 - wz1) / length;

      /** One box along this wall, `from`..`to` metres and `y0`..`y1` high. */
      const piece = (from, to, y0, y1, material, thick = thickness) => {
        const span = to - from;
        const rise = y1 - y0;
        if (span < 0.01 || rise < 0.005) return;
        const ax = wx1 + ux * from;
        const az = wz1 + uz * from;
        const bx = wx1 + ux * to;
        const bz = wz1 + uz * to;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(span, rise, thick), material);
        mesh.position.set((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
        mesh.rotation.y = -Math.atan2(bz - az, bx - ax);
        // Glass lets the light through; everything else casts a shadow.
        mesh.castShadow = material !== glassMaterial;
        mesh.receiveShadow = true;
        // Point the cut-away normal at the plan centre so orbiting never leaves
        // the camera on the outside of a closed box.
        const inward = new THREE.Vector3(-mesh.position.x, 0, -mesh.position.z);
        if (inward.lengthSq() < 1e-6) inward.set(0, 0, 1); else inward.normalize();
        mesh.userData.inward = inward;
        mesh.userData.type = 'wall';

        this.wallMeshes.push(mesh);
        this.planGroup.add(mesh);
      };

      // Openings in this wall, as spans along it.
      const cuts = [];
      for (const opening of openings) {
        const mx = (opening.x1 + opening.x2) / 2;
        const mz = (opening.z1 + opening.z2) / 2;
        const along = (mx - wx1) * ux + (mz - wz1) * uz;
        const across = Math.abs((mx - wx1) * uz - (mz - wz1) * ux);
        if (across > 0.1 || along < -0.1 || along > length + 0.1) continue;
        const t1 = (opening.x1 - wx1) * ux + (opening.z1 - wz1) * uz;
        const t2 = (opening.x2 - wx1) * ux + (opening.z2 - wz1) * uz;
        cuts.push({
          start: Math.max(0, Math.min(t1, t2)),
          end: Math.min(length, Math.max(t1, t2)),
          opening,
        });
      }
      cuts.sort((a, b) => a.start - b.start);

      // A wall that does span an opening is cut down to the pieces beside it.
      let cursor = 0;
      for (const cut of cuts) {
        if (cut.end - cut.start < 0.05 || cut.start < cursor - 0.01) continue;
        piece(cursor, cut.start, 0, height, wallMaterial);
        cursor = Math.max(cursor, cut.end);
      }
      piece(cursor, length, 0, height, wallMaterial);
    }

    // An opening normally sits in the gap the wall graph leaves, so there is no
    // wall to cut: what it leaves is built here instead. The lintel over the
    // head and the apron under a window's sill are wall; the rest is glass or a
    // door leaf, and the hole between them is the opening.
    for (const opening of openings) {
      const length = Math.hypot(opening.x2 - opening.x1, opening.z2 - opening.z1);
      if (length < 0.05) continue;
      const head = Math.min(Math.max(opening.head, 0.3), height);
      const sill = Math.min(Math.max(opening.sill, 0), head - 0.05);
      const fill = (y0, y1, material, thick = thickness) => {
        if (y1 - y0 < 0.005) return;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, y1 - y0, thick), material);
        mesh.position.set(
          (opening.x1 + opening.x2) / 2,
          (y0 + y1) / 2,
          (opening.z1 + opening.z2) / 2
        );
        mesh.rotation.y = -Math.atan2(opening.z2 - opening.z1, opening.x2 - opening.x1);
        mesh.castShadow = material !== glassMaterial;
        mesh.receiveShadow = true;
        const inward = new THREE.Vector3(-mesh.position.x, 0, -mesh.position.z);
        if (inward.lengthSq() < 1e-6) inward.set(0, 0, 1); else inward.normalize();
        mesh.userData.inward = inward;
        mesh.userData.type = 'wall';

        this.wallMeshes.push(mesh);
        this.planGroup.add(mesh);
      };

      fill(head, height, wallMaterial);
      fill(0, sill, wallMaterial);
      if (opening.kind === 'window') {
        fill(sill, head, glassMaterial, Math.max(thickness * 0.2, 0.02));
      } else {
        fill(sill + 0.01, head - 0.01, doorMaterial, Math.max(thickness * 0.3, 0.03));
      }
    }
    if (!this.wallMeshes.length) return false;

    // Base slab under the whole footprint, then one tinted plate per room so
    // the plan reads as rooms rather than a single anonymous plane.
    const width = Math.max(bounds.maxX - bounds.minX, 0.5);
    const depth = Math.max(bounds.maxZ - bounds.minZ, 0.5);
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.4, depth + 0.4),
      new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.9, metalness: 0 })
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(0, 0.002, 0);
    slab.receiveShadow = true;
    this.planGroup.add(slab);

    if (this.options.plates) {
      rooms.forEach((room, index) => {
        const points = [];
        for (const [x, y] of room.polygon) {
          const [wx, wz] = toWorld(x, y);
          const last = points[points.length - 1];
          // Room polygons can repeat a vertex where a doorway gap is walked
          // twice; triangulation needs a clean ring.
          if (last && Math.hypot(last.x - wx, last.y + wz) < 1e-4) continue;
          points.push(new THREE.Vector2(wx, -wz));
        }
        if (points.length < 3) return;

        const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
        geometry.rotateX(-Math.PI / 2);
        const plate = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
          color: ROOM_FLOOR_COLOURS[index % ROOM_FLOOR_COLOURS.length],
          roughness: 0.88,
          metalness: 0,
        }));
        // Stagger the plates a hair so two rooms sharing an edge do not
        // z-fight along it.
        plate.position.y = 0.004 + index * 0.0004;
        plate.receiveShadow = true;
        plate.userData.room = { name: room.name, area: room.area };

        this.roomSlabs.push(plate);
        this.planGroup.add(plate);
      });
    }

    // Placed items: one box each, tagged so the elevation drag can pick it by
    // id. The plan holds the truth; the mesh is only the view of it.
    this.itemMeshes = new Map();
    // Built on the same rectangle the walls and room plates were centred on,
    // which is the mapping the elevation drag places meshes with.
    this.itemSpace = itemSpace(plan, bounds);
    for (const box of itemBoxes(plan)) {
      const height = Math.max(box.height, 0.02);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(box.width, 0.02), height, Math.max(box.depth, 0.02)),
        new THREE.MeshStandardMaterial({ color: box.color, roughness: 0.72, metalness: 0.04 })
      );
      mesh.position.set(box.x - centre.x, box.bottom + height / 2, box.z - centre.z);
      mesh.rotation.y = -(box.rotation || 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.type = 'item';
      mesh.userData.id = box.id;
      this.itemMeshes.set(box.id, mesh);
      this.planGroup.add(mesh);
    }

    this.bounds = bounds;
    // The plan is built around the origin, so the elevation helpers need the
    // bounds in that same space.
    this.worldBounds = {
      minX: bounds.minX - centre.x,
      maxX: bounds.maxX - centre.x,
      minZ: bounds.minZ - centre.z,
      maxZ: bounds.maxZ - centre.z,
    };
    this.buildGrid(Math.ceil(Math.max(width, depth)) + 4);
    if (refit) this.fit();
    if (this.elevation) this.applyElevation();
    return true;
  }

  buildGrid(size) {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry?.dispose();
      this.grid.material?.dispose();
    }
    // One line per metre, kept just under the floor: coplanar lines z-fight.
    const span = Math.max(4, size);
    this.grid = new THREE.GridHelper(span, span, 0x9aa6b2, 0xc7cfd8);
    this.grid.position.y = -0.01;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.55;
    this.scene.add(this.grid);
  }

  /** Frame the whole footprint from the shared orbit direction. */
  fit() {
    if (!this.bounds) return;
    const width = Math.max(this.bounds.maxX - this.bounds.minX, 1);
    const depth = Math.max(this.bounds.maxZ - this.bounds.minZ, 1);
    const height = this.options.height;

    // Bounding sphere of the volume, not just the footprint: wall height
    // matters on a small plan.
    const radius = Math.hypot(width / 2, depth / 2, height / 2);
    const distance = distanceToFit(radius, this.camera, SCENE_VIEW.padding);
    const direction = {
      x: Math.cos(SCENE_VIEW.elevation) * Math.cos(SCENE_VIEW.azimuth),
      y: Math.sin(SCENE_VIEW.elevation),
      z: Math.cos(SCENE_VIEW.elevation) * Math.sin(SCENE_VIEW.azimuth),
    };

    const target = new THREE.Vector3(0, height * 0.4, 0);
    this.camera.position.set(
      target.x + direction.x * distance,
      target.y + direction.y * distance,
      target.z + direction.z * distance
    );
    this.controls.target.copy(target);
    this.controls.update();
    this.controls.minDistance = Math.max(radius * 0.8, 1);
    this.controls.maxDistance = Math.max(distance * 3, 20);

    // Keep the depth range and the shadow frustum proportionate to the plan.
    this.camera.near = Math.max(distance / 1000, 0.05);
    this.camera.far = Math.max(distance * 6, 100);
    this.camera.updateProjectionMatrix();

    if (this.key) {
      const reach = Math.max(width, depth, 4);
      this.key.shadow.camera.left = -reach;
      this.key.shadow.camera.right = reach;
      this.key.shadow.camera.top = reach;
      this.key.shadow.camera.bottom = -reach;
      this.key.shadow.camera.near = 1;
      this.key.shadow.camera.far = reach * 4 + 20;
      this.key.shadow.camera.updateProjectionMatrix();
    }
  }

  /**
   * Look at the plan from one side with an orthographic camera; null returns to
   * the orbit view. The vendored visibility helper hides the walls between the
   * camera and the centre, which is what makes the elevation read as a drawing
   * of the far wall rather than the outside of a box.
   */
  setElevation(side) {
    this.elevation = ELEVATION_SIDES.includes(side) ? side : null;
    this.controls.enabled = !this.elevation;
    if (this.elevation) {
      this.applyElevation();
    } else if (this.worldBounds) {
      applyElevationVisibility(this.scene, null, this.worldBounds);
      this.handleResize();
      this.fit();
    } else {
      this.handleResize();
    }
    return this.elevation;
  }

  applyElevation() {
    if (!this.elevation || !this.worldBounds) return;
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    frameElevation(this.elevationCamera, {
      bounds: this.worldBounds,
      side: this.elevation,
      aspect: width / height,
      height: this.options.height,
    });
    applyElevationVisibility(this.scene, this.elevation, this.worldBounds);
    // The hide-walls toggle outranks the elevation's own near-wall cut.
    if (this.hideWalls) for (const wall of this.wallMeshes) wall.visible = false;
  }

  handleResize() {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.elevation) this.applyElevation();
  }

  /**
   * Cutaway: drop the walls standing between the camera and the room, so the
   * orbit always looks into the interior.
   */
  updateWallVisibility() {
    if (this.hideWalls) {
      for (const wall of this.wallMeshes) wall.visible = false;
      return;
    }
    // An elevation sets its wall visibility once, not every frame.
    if (this.elevation) return;
    if (!this.options.cutaway) {
      for (const wall of this.wallMeshes) wall.visible = true;
      return;
    }
    for (const wall of this.wallMeshes) {
      const offset = this.camera.position.clone().sub(wall.position);
      wall.visible = offset.dot(wall.userData.inward) > -0.05;
    }
  }

  animate() {
    this.frame = requestAnimationFrame(this.animateBound);
    if (!this.elevation) this.controls.update();
    this.updateWallVisibility();
    this.renderer.render(this.scene, this.elevation ? this.elevationCamera : this.camera);
  }

  clearPlan() {
    this.planGroup.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.planGroup.clear();
    this.wallMeshes = [];
    this.roomSlabs = [];
    this.itemMeshes = new Map();
    this.bounds = null;
  }

  /** Counts for the headless checks. */
  stats() {
    return {
      walls: this.wallMeshes.length,
      openings: (this.plan?.openings || []).length,
      rooms: this.roomSlabs.length,
      items: this.itemMeshes.size,
      webgl2: Boolean(this.renderer.capabilities.isWebGL2),
      drawCalls: this.renderer.info.render.calls,
    };
  }

  /** Teardown for listeners mounted outside the renderer, run on dispose. */
  addDisposer(fn) {
    if (typeof fn === 'function') this.disposers.push(fn);
  }

  /** Stop the loop and release the GL context; the router calls this on exit. */
  dispose() {
    for (const dispose of this.disposers.splice(0)) {
      try { dispose(); } catch { /* a failed teardown must not block the rest */ }
    }
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.clearPlan();
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry?.dispose();
      this.grid.material?.dispose();
      this.grid = null;
    }
    this.controls?.dispose();
    this.renderer?.dispose();
    this.environmentMap?.dispose?.();
    this.renderer?.domElement?.remove();
    this.scene.clear();
  }
}
