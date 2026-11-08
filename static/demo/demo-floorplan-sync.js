import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConversionEngine3D } from '../engine/3dConversionEngine.js';
import { FloorPlanGraph } from '../core/floorplan-graph.js';
import { WALL_HEIGHT } from '../core/world-space.js';
import { measurePlan, formatLength, formatArea } from '../core/measurements.js';
import { fitCameraToGraph } from '../scene/scene-camera.js';

export class FloorplanSyncDemo {
  constructor(canvas2DId, container3DId, options = {}) {
    this.canvas2D = document.getElementById(canvas2DId);
    this.ctx = this.canvas2D?.getContext('2d');
    this.container3D = document.getElementById(container3DId);

    if (!this.canvas2D || !this.container3D) {
      console.error('FloorplanSyncDemo: Required elements not found');
      return;
    }

    // One geometry model for both views: metres, origin at the canvas centre.
    this.graph = new FloorPlanGraph({ pixelsPerMeter: options.pixelsPerMeter });
    this.drawing = false;
    this.startNode = null;
    this.showMeasurements = true;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.view = { width: 1, height: 1 };

    this.init3D();
    this.syncCanvasSize();
    this.setupCanvas2D();
    this.draw2D();
    this.update3D();

    this.onWindowResize = () => {
      this.syncCanvasSize();
      this.draw2D();
      this.update3D();
    };
    window.addEventListener('resize', this.onWindowResize);
  }

  /**
   * The canvas is styled with CSS, so without this its bitmap stays at the
   * 300x150 default and every drawn wall lands somewhere else than the pointer.
   */
  syncCanvasSize() {
    const rect = this.canvas2D.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas2D.width));
    const height = Math.max(1, Math.round(rect.height || this.canvas2D.height));

    this.view = { width, height };
    this.canvas2D.width = Math.round(width * this.dpr);
    this.canvas2D.height = Math.round(height * this.dpr);
    // Draw in CSS pixels, so pointer coordinates need no conversion.
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  init3D() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    this.camera = new THREE.PerspectiveCamera(
      55,
      this.container3D.clientWidth / this.container3D.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(7, 6, 7);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container3D.clientWidth, this.container3D.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container3D.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.6, 0);
    this.controls.addEventListener('start', () => { this.userMovedCamera = true; });
    this.userMovedCamera = false;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(-6, 10, -4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    dirLight.shadow.camera.updateProjectionMatrix();
    this.scene.add(dirLight);

    // Grid in metres, aligned with the same origin the 2D canvas uses.
    const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
    gridHelper.position.y = -0.01;
    this.scene.add(gridHelper);

    this.engine = new ConversionEngine3D(this.scene);

    const animate = () => {
      this.animationFrame = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  pointerToCanvas(e) {
    const rect = this.canvas2D.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  setupCanvas2D() {
    this.canvas2D.addEventListener('pointerdown', (e) => {
      const point = this.pointerToCanvas(e);
      const node = this.graph.nodeAt(this.graph.fromCanvas(point, this.view));

      if (!this.drawing) {
        this.startNode = node;
        this.drawing = true;
      } else if (this.startNode) {
        this.graph.addEdge(this.startNode, node);
        this.startNode = node;
        this.draw2D();
        this.update3D();
        return;
      }

      this.draw2D();
    });

    this.canvas2D.addEventListener('dblclick', () => {
      this.drawing = false;
      this.startNode = null;
      this.draw2D();
    });
  }

  /** Convenience for scripted use/tests: add a wall from two canvas points. */
  addWall(fromPoint, toPoint) {
    const edge = this.graph.addWall(fromPoint, toPoint, this.view);
    this.draw2D();
    this.update3D();
    return edge;
  }

  draw2D() {
    if (!this.ctx) return;
    const { width, height } = this.view;
    const scale = this.graph.pixelsPerMeter;
    const measurements = measurePlan(this.graph);

    this.ctx.fillStyle = '#f8f8f8';
    this.ctx.fillRect(0, 0, width, height);

    // 1 m grid anchored on the plan origin, so lines and world units agree.
    this.ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    this.ctx.lineWidth = 1;
    const originX = width / 2;
    const originY = height / 2;

    for (let x = originX % scale; x < width; x += scale) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
    for (let y = originY % scale; y < height; y += scale) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    // Walls come from the graph, so 2D and 3D can never drift apart.
    this.ctx.strokeStyle = '#3b82f6';
    this.ctx.lineWidth = 6;
    this.ctx.lineCap = 'round';

    this.graph.edges.forEach((edge) => {
      const start = this.graph.toCanvas(edge.a, this.view);
      const end = this.graph.toCanvas(edge.b, this.view);

      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();

      if (!this.showMeasurements) return;

      const length = measurements.walls.find((wall) => wall.id === edge.id)?.length;
      if (!length || length < 0.45) return;

      this.ctx.fillStyle = '#1f2937';
      this.ctx.font = 'bold 11px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        formatLength(length),
        (start.x + end.x) / 2,
        (start.y + end.y) / 2 - 10
      );
    });

    // Room areas, from the same measurements the 3D labels use.
    if (this.showMeasurements) {
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.textAlign = 'center';
      measurements.rooms.forEach((room) => {
        const point = this.graph.toCanvas(room.centroid, this.view);
        const text = formatArea(room.area);
        const textWidth = this.ctx.measureText(text).width;

        this.ctx.fillStyle = 'rgba(219, 234, 254, 0.9)';
        this.ctx.fillRect(point.x - textWidth / 2 - 6, point.y - 10, textWidth + 12, 20);
        this.ctx.fillStyle = '#1e3a8a';
        this.ctx.fillText(text, point.x, point.y + 4);
      });
    }

    // Nodes: shared corners, drawn so the graph structure is visible.
    this.ctx.fillStyle = '#1d4ed8';
    this.graph.nodes.forEach((node) => {
      const point = this.graph.toCanvas(node, this.view);
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });

    if (this.drawing && this.startNode) {
      const point = this.graph.toCanvas(this.startNode, this.view);
      this.ctx.fillStyle = '#60a5fa';
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  update3D() {
    const appState = {
      stories: [{
        id: 'demo_story',
        walls: this.graph.toCanvasWalls(this.view),
        fixtures: [],
        height: WALL_HEIGHT
      }],
      currentStoryIndex: 0,
      walls: this.graph.toCanvasWalls(this.view),
      fixtures: [],
      fixtureStyles: {},
      measurements: measurePlan(this.graph),
      showMeasurements: this.showMeasurements,
      showCeiling: false,
      showRoof: false,
      defaultWallTexture: null,
      defaultFloorTexture: 'tile'
    };

    this.engine.convert(appState, this.view.width, this.view.height);

    // Keep the whole plan framed while it is being drawn; stop once the user
    // takes over the camera.
    if (!this.userMovedCamera) this.fitView();
  }

  /** Frame the plan the same way every scene does. */
  fitView() {
    fitCameraToGraph(this.camera, this.controls, this.graph, { targetHeight: WALL_HEIGHT * 0.3 });
  }

  reset() {
    this.graph.clear();
    this.drawing = false;
    this.startNode = null;
    this.draw2D();
    this.update3D();
  }

  dispose() {
    window.removeEventListener('resize', this.onWindowResize);
    cancelAnimationFrame(this.animationFrame);
    this.engine?.clear();
    this.renderer?.dispose();
  }
}
