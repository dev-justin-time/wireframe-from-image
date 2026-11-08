import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TEXTURES } from '../core/metadata.js';

export class MaterialSystemDemo {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('MaterialSystemDemo: Container not found');
      return;
    }
    
    this.materials = {
      marble: { 
        name: 'Marble',
        color: 0xf5f5f5, 
        roughness: 0.3, 
        metalness: 0.1,
        texture: TEXTURES.floors.marble
      },
      wood: { 
        name: 'Wood',
        color: 0x8b4513, 
        roughness: 0.7, 
        metalness: 0.0,
        texture: TEXTURES.floors.wood
      },
      tile: { 
        name: 'Ceramic Tile',
        color: 0xe0e0e0, 
        roughness: 0.2, 
        metalness: 0.1,
        texture: TEXTURES.floors.tile
      }
    };
    
    this.currentMaterial = 'marble';
    this.textureLoader = new THREE.TextureLoader();
    
    this.init();
  }
  
  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    
    this.camera = new THREE.PerspectiveCamera(
      50,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(3, 3, 3);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    dirLight.castShadow = true;
    this.scene.add(dirLight);
    
    // Floor sample
    const floorGeo = new THREE.BoxGeometry(2, 0.1, 2);
    const initial = this.materials[this.currentMaterial];
    this.floorMat = new THREE.MeshStandardMaterial({
      color: initial.color,
      roughness: initial.roughness,
      metalness: initial.metalness
    });
    this.floor = new THREE.Mesh(floorGeo, this.floorMat);
    this.updateMaterial();
    this.floor.castShadow = true;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    
    // Base floor
    const baseGeo = new THREE.PlaneGeometry(10, 10);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2d3748 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = -Math.PI / 2;
    base.position.y = -1;
    base.receiveShadow = true;
    this.scene.add(base);
    
    this.createControls();
    this.animate();
  }
  
  createControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.style.position = 'absolute';
    controlsDiv.style.bottom = '1rem';
    controlsDiv.style.left = '1rem';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.gap = '0.5rem';
    
    Object.keys(this.materials).forEach(key => {
      const btn = document.createElement('button');
      btn.textContent = this.materials[key].name;
      btn.className = 'px-3 py-1 rounded text-xs font-medium transition-colors';
      
      const updateStyle = () => {
        if (this.currentMaterial === key) {
          btn.className = 'px-3 py-1 rounded text-xs font-medium bg-teal-500 text-white';
        } else {
          btn.className = 'px-3 py-1 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
        }
      };
      
      btn.onclick = () => {
        this.currentMaterial = key;
        this.updateMaterial();
        Array.from(controlsDiv.children).forEach(b => {
          if (b === btn) {
            b.className = 'px-3 py-1 rounded text-xs font-medium bg-teal-500 text-white';
          } else {
            b.className = 'px-3 py-1 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
          }
        });
      };
      
      updateStyle();
      controlsDiv.appendChild(btn);
    });
    
    this.container.appendChild(controlsDiv);
  }
  
  updateMaterial() {
    const mat = this.materials[this.currentMaterial];
    
    this.floorMat.color.setHex(mat.color);
    this.floorMat.roughness = mat.roughness;
    this.floorMat.metalness = mat.metalness;
    
    if (mat.texture) {
      this.textureLoader.load(mat.texture, (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        this.floorMat.map = texture;
        this.floorMat.needsUpdate = true;
      }, undefined, () => {
        // Fallback if texture fails
        this.floorMat.map = null;
        this.floorMat.needsUpdate = true;
      });
    }
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}


