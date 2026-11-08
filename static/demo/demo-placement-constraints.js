import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { WALL_HEIGHT, WALL_THICKNESS } from '../core/world-space.js';

export class PlacementConstraintsDemo {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('PlacementConstraintsDemo: Container not found');
      return;
    }
    
    this.walls = [
      { start: new THREE.Vector3(-5, 0, -5), end: new THREE.Vector3(5, 0, -5) },
      { start: new THREE.Vector3(5, 0, -5), end: new THREE.Vector3(5, 0, 5) },
      { start: new THREE.Vector3(5, 0, 5), end: new THREE.Vector3(-5, 0, 5) },
      { start: new THREE.Vector3(-5, 0, 5), end: new THREE.Vector3(-5, 0, -5) }
    ];
    
    this.objects = [];
    this.draggedObject = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Initialize model loaders
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    
    this.init();
  }
  
  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(8, 8, 8);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 10, 5);
    dirLight.castShadow = true;
    this.scene.add(dirLight);
    
    // Floor
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floor = floor;
    
    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 });
    this.walls.forEach(wall => {
      const length = wall.start.distanceTo(wall.end);
      const wallGeo = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      
      const midpoint = new THREE.Vector3().addVectors(wall.start, wall.end).multiplyScalar(0.5);
      wallMesh.position.copy(midpoint);
      wallMesh.position.y = WALL_HEIGHT / 2;
      
      const angle = Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x);
      wallMesh.rotation.y = angle;
      
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.scene.add(wallMesh);
    });
    
    // Add draggable objects
    this.addObject(new THREE.Vector3(0, 0.5, 0), 0x3b82f6);
    this.addObject(new THREE.Vector3(2, 0.5, 2), 0x10b981);
    
    // Grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
    this.scene.add(gridHelper);
    
    this.setupInteraction();
    this.animate();
  }
  
  addObject(position, color) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.interactive = true;
    this.scene.add(mesh);
    this.objects.push(mesh);
    return mesh;
  }
  
  async loadAndAddModel(position, modelUrl, color) {
    try {
      const gltf = await this.gltfLoader.loadAsync(modelUrl);
      const model = gltf.scene;
      
      model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (color) {
            child.material = child.material.clone();
            child.material.color.setHex(color);
          }
        }
      });
      
      model.position.copy(position);
      model.userData.interactive = true;
      model.userData.originalColor = color;
      
      this.scene.add(model);
      this.objects.push(model);
      return model;
    } catch (error) {
      console.error('Failed to load model:', modelUrl, error);
      // Fallback to box
      return this.addObject(position, color);
    }
  }
  
  setupInteraction() {
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.renderer.domElement.addEventListener('pointerup', () => this.onPointerUp());
  }
  
  onPointerDown(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.objects);
    
    if (intersects.length > 0) {
      this.draggedObject = intersects[0].object;
      this.controls.enabled = false;
      this.draggedObject.material.emissive.setHex(0x666666);
    }
  }
  
  onPointerMove(event) {
    if (!this.draggedObject) return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.floor);
    
    if (intersects.length > 0) {
      let newPos = intersects[0].point.clone();
      newPos.y = this.draggedObject.position.y;
      
      // Snap to grid
      newPos.x = Math.round(newPos.x);
      newPos.z = Math.round(newPos.z);
      
      // Check constraints
      if (this.isValidPosition(newPos)) {
        this.draggedObject.position.copy(newPos);
        this.draggedObject.material.color.setHex(0x10b981); // Green (valid)
      } else {
        this.draggedObject.material.color.setHex(0xef4444); // Red (invalid)
      }
    }
  }
  
  onPointerUp() {
    if (this.draggedObject) {
      this.draggedObject.material.emissive.setHex(0x000000);
      
      if (!this.isValidPosition(this.draggedObject.position)) {
        // Reset color on invalid placement
        this.draggedObject.material.color.setHex(0x3b82f6);
      } else {
        this.draggedObject.material.color.setHex(this.draggedObject.userData.originalColor || 0x3b82f6);
      }
      
      this.draggedObject = null;
      this.controls.enabled = true;
    }
  }
  
  isValidPosition(position) {
    // Check wall collision (minimum distance 0.6)
    for (let wall of this.walls) {
      const dist = this.distanceToSegment(position, wall.start, wall.end);
      if (dist < 0.6) return false;
    }
    
    // Check object collision
    for (let obj of this.objects) {
      if (obj === this.draggedObject) continue;
      const dist = position.distanceTo(obj.position);
      if (dist < 1.5) return false;
    }
    
    // Check bounds
    if (Math.abs(position.x) > 4.5 || Math.abs(position.z) > 4.5) return false;
    
    return true;
  }
  
  distanceToSegment(point, start, end) {
    const line = new THREE.Vector3().subVectors(end, start);
    const lineLen = line.length();
    line.normalize();
    
    const v = new THREE.Vector3().subVectors(point, start);
    const d = v.dot(line);
    
    const clampedD = Math.max(0, Math.min(lineLen, d));
    const closest = new THREE.Vector3().copy(start).add(line.multiplyScalar(clampedD));
    
    return point.distanceTo(closest);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}


