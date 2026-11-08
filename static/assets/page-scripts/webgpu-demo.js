    import * as THREE from 'three';
    import WebGPURenderer from 'three/addons/renderers/webgpu/WebGPURenderer.js';
    import { cos, sin, timerLocal, vec3 } from 'three/nodes';

    // WebGPURenderer.isAvailable() is not present in every three build; the
    // presence of navigator.gpu is the portable capability check.
    const webgpuAvailable = typeof navigator !== 'undefined' && Boolean(navigator.gpu);

    if ( !webgpuAvailable ) {
        document.body.innerHTML = `
            <div style="display:flex;height:100%;justify-content:center;align-items:center;flex-direction:column;text-align:center;">
                <h1>WebGPU not available</h1>
                <p>Please use a compatible browser (Chrome Canary, Edge Canary) and enable WebGPU.</p>
                <br>
                <a class="button" href="index.html" style="position:relative;bottom:auto;right:auto;">Back</a>
            </div>
        `;
        throw new Error( 'WebGPU not available' );
    }

    const container = document.getElementById('canvas-container');

    const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
    camera.position.set( 3, 3, 3 );
    camera.lookAt( 0, 0, 0 );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x101c22 );

    // Lighting
    const dirLight = new THREE.DirectionalLight( 0xffffff, 2 );
    dirLight.position.set( 5, 5, 5 );
    scene.add( dirLight );
    
    const ambientLight = new THREE.AmbientLight( 0x404040, 5 );
    scene.add( ambientLight );

    // Object with Node Material
    const geometry = new THREE.TorusKnotGeometry( 1, 0.3, 128, 32 );
    // Core materials are converted by the WebGPU backend internally; explicit
    // node materials are still unstable in this three build.
    const material = new THREE.MeshStandardMaterial( { roughness: 0.2, metalness: 0.8 } );

    const mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );

    // Floor
    const floorGeo = new THREE.PlaneGeometry( 10, 10 );
    const floorMat = new THREE.MeshStandardMaterial( { color: 0x222222, roughness: 0.1, metalness: 0.5 } );
    const floor = new THREE.Mesh( floorGeo, floorMat );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    scene.add( floor );

    let renderer;
    try {
        renderer = new WebGPURenderer( { antialias: true } );
    } catch ( error ) {
        document.body.innerHTML = `
            <div style="display:flex;height:100%;justify-content:center;align-items:center;flex-direction:column;text-align:center;">
                <h1>WebGPU renderer failed to start</h1>
                <p>${error.message}</p>
                <br>
                <a class="button" href="index.html" style="position:relative;bottom:auto;right:auto;">Back</a>
            </div>
        `;
        throw error;
    }
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setAnimationLoop( animate );
    container.appendChild( renderer.domElement );

    window.addEventListener( 'resize', onWindowResize );

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize( window.innerWidth, window.innerHeight );
    }

    function animate() {
        mesh.rotation.y += 0.01;
        mesh.rotation.z += 0.005;
        material.color.setHSL( ( performance.now() / 4000 ) % 1, 0.65, 0.55 );
        renderer.render( scene, camera );
    }
