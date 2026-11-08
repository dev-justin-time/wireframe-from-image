import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Lab kit - the old React lab demos, re-implemented against the editor's real
 * scene. One room, no React:
 *
 *   LabPostProcessing   -> composer with bloom, depth of field, vignette
 *   LabReactSpring      -> spring-scaled selection
 *   LabInstancing       -> one-draw-call prop field over the plan footprint
 *   LabShaker3DViewer   -> the placeable shaker catalog item, auto-rotate and scale
 *   LabShakerPhysics    -> shake simulation on placed product models
 *   LabDracoCompression -> DRACOLoader in ConversionEngine3D fits the GLB to its item
 *   LabPathfinding      -> already merged as the editor's walkthrough agent
 *   LabGLTFExport       -> already merged as the editor's export3D('gltf'|'glb'|'obj')
 *   LabUpload           -> already merged as Import Floorplan / Read Text
 *   LabShakerAR         -> already merged as the editor's Place in AR ability
 *   LabR3FWebGPUFloorplan -> the editor's own 3D plan
 *   LabWebGPUReactDemo  -> WebGPU preview overlay with a WebGL fallback message
 *
 * Everything is opt-in: with every flag off the kit adds no draw calls beyond
 * the hidden instanced mesh and does not touch the render pipeline.
 */

const MAX_INSTANCES = 300;

const VignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.05 },
        darkness: { value: 1.35 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
            float vig = clamp(1.0 - dot(uv, uv) * darkness, 0.0, 1.0);
            gl_FragColor = vec4(texel.rgb * vig, texel.a);
        }
    `
};

export function createLabKit({
    scene,
    renderer,
    camera,
    container,
    requestRender = () => {}
} = {}) {
    if (!scene || !renderer) throw new Error('lab kit needs a scene and renderer');

    const view = container || renderer.domElement?.parentElement || document.body;
    const state = {
        bloom: false,
        depthOfField: false,
        vignette: false,
        springSelection: false,
        instanceField: false,
        productAutoRotate: false,
        productShake: false
    };

    let plan = { minX: -4, maxX: 4, minZ: -4, maxZ: 4, elevation: 0 };
    let instanceCount = 40;
    let productScale = 1;
    let shakeIntensity = 0.5;
    let disposed = false;

    // --- Post-processing -------------------------------------------------
    const size = new THREE.Vector2(
        Math.max(1, view.clientWidth || renderer.domElement.clientWidth || 1),
        Math.max(1, view.clientHeight || renderer.domElement.clientHeight || 1)
    );

    const composer = new EffectComposer(renderer);
    composer.setSize(size.x, size.y);

    const renderPass = new RenderPass(scene, camera || new THREE.PerspectiveCamera());
    composer.addPass(renderPass);

    const dofPass = new BokehPass(scene, camera || renderPass.camera, {
        focus: 4.5,
        aperture: 0.00022,
        maxblur: 0.009
    });
    dofPass.enabled = false;
    composer.addPass(dofPass);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 1.05, 0.45, 0.72);
    bloomPass.enabled = false;
    composer.addPass(bloomPass);

    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.enabled = false;
    composer.addPass(vignettePass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    function setCamera(nextCamera) {
        if (!nextCamera) return;
        renderPass.camera = nextCamera;
        dofPass.camera = nextCamera;
    }

    // --- GPU instancing --------------------------------------------------
    const instanceGeometry = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const instanceMaterial = new THREE.MeshStandardMaterial({
        color: 0x13a4ec,
        roughness: 0.45,
        metalness: 0.15
    });
    const instanceMesh = new THREE.InstancedMesh(instanceGeometry, instanceMaterial, MAX_INSTANCES);
    instanceMesh.name = 'lab-instanced-props';
    instanceMesh.count = 0;
    instanceMesh.frustumCulled = false;
    instanceMesh.castShadow = true;
    instanceMesh.receiveShadow = true;
    scene.add(instanceMesh);

    const instanceDummy = new THREE.Object3D();
    let instanceTime = 0;
    let instancePlaced = false;

    function layoutInstances() {
        const count = Math.min(MAX_INSTANCES, Math.max(0, Math.round(instanceCount)));
        const width = Math.max(1.5, plan.maxX - plan.minX);
        const depth = Math.max(1.5, plan.maxZ - plan.minZ);
        const columns = Math.max(1, Math.ceil(Math.sqrt(count || 1)));
        const rows = Math.max(1, Math.ceil((count || 1) / columns));
        for (let index = 0; index < count; index++) {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = plan.minX + (width / (columns + 1)) * (column + 1);
            const z = plan.minZ + (depth / (rows + 1)) * (row + 1);
            instanceDummy.position.set(x, plan.elevation + 0.1, z);
            instanceDummy.rotation.set(0, 0, 0);
            instanceDummy.updateMatrix();
            instanceMesh.setMatrixAt(index, instanceDummy.matrix);
        }
        instanceMesh.instanceMatrix.needsUpdate = true;
        instancePlaced = true;
    }

    function syncInstances() {
        const count = Math.min(MAX_INSTANCES, Math.max(0, Math.round(instanceCount)));
        instanceMesh.visible = Boolean(state.instanceField) && count > 0;
        instanceMesh.count = instanceMesh.visible ? count : 0;
        if (instanceMesh.visible && !instancePlaced) layoutInstances();
    }

    function updateInstances(delta) {
        if (!instanceMesh.visible) return;
        instanceTime += delta;
        const count = instanceMesh.count;
        for (let index = 0; index < count; index++) {
            instanceMesh.getMatrixAt(index, instanceDummy.matrix);
            instanceDummy.matrix.decompose(instanceDummy.position, instanceDummy.quaternion, instanceDummy.scale);
            instanceDummy.rotation.set(0, instanceTime * 0.6 + index * 0.35, 0);
            instanceDummy.updateMatrix();
            instanceMesh.setMatrixAt(index, instanceDummy.matrix);
        }
        instanceMesh.instanceMatrix.needsUpdate = true;
    }

    // --- Placed product models (DRACO + physics) --------------------------
    // The shaker model is a catalog item. ConversionEngine3D loads the GLB and
    // marks its pivot, so the kit animates placed pieces and never creates a
    // fixed centre prop of its own.
    const productStates = new WeakMap();
    let activeProducts = new Set();

    function resolveProductPivot(object) {
        if (!object) return null;
        if (object.userData?.labProductPivot) return object.userData.labProductPivot;
        if (object.userData?.labProductModel) return object;
        return null;
    }

    function productStateFor(pivot) {
        let product = productStates.get(pivot);
        if (!product) {
            product = {
                basePosition: pivot.position.clone(),
                baseScale: pivot.scale.clone(),
                baseRotation: pivot.rotation.clone(),
                offset: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                spin: 0,
                shakePhase: Math.random() * Math.PI * 2
            };
            productStates.set(pivot, product);
        }
        return product;
    }

    function restoreProduct(pivot, product) {
        pivot.position.copy(product.basePosition);
        pivot.rotation.copy(product.baseRotation);
        pivot.scale.copy(product.baseScale);
        product.offset.set(0, 0, 0);
        product.velocity.set(0, 0, 0);
        product.spin = 0;
    }

    function setProducts(objects = []) {
        const next = new Set();
        (objects || []).forEach((object) => {
            const pivot = resolveProductPivot(object);
            if (pivot) next.add(pivot);
        });

        activeProducts.forEach((pivot) => {
            if (next.has(pivot)) return;
            const product = productStates.get(pivot);
            if (product) restoreProduct(pivot, product);
        });
        activeProducts = next;

        activeProducts.forEach((pivot) => {
            const product = productStateFor(pivot);
            pivot.scale.copy(product.baseScale).multiplyScalar(productScale);
        });
    }


    function updateProducts(delta) {
        if (activeProducts.size === 0) return;
        activeProducts.forEach((pivot) => {
            const product = productStateFor(pivot);

            if (state.productAutoRotate) {
                product.spin += delta * 0.7;
            } else if (Math.abs(product.spin) > 0.0001) {
                product.spin *= Math.max(0, 1 - delta * 6);
            }
            pivot.rotation.y = product.baseRotation.y + product.spin;

            if (state.productShake) {
                product.velocity.add(new THREE.Vector3(
                    (Math.random() - 0.5) * shakeIntensity,
                    (Math.random() - 0.5) * shakeIntensity,
                    (Math.random() - 0.5) * shakeIntensity
                ).multiplyScalar(delta * 2.2));
                product.offset.addScaledVector(product.velocity, delta);
                product.velocity.multiplyScalar(0.94);
                product.offset.x = THREE.MathUtils.clamp(product.offset.x, -0.3, 0.3);
                product.offset.y = THREE.MathUtils.clamp(product.offset.y, -0.12, 0.12);
                product.offset.z = THREE.MathUtils.clamp(product.offset.z, -0.3, 0.3);
                product.shakePhase += delta * 20;
                pivot.rotation.z = Math.sin(product.shakePhase) * 0.1 * shakeIntensity;
            } else {
                product.offset.lerp(new THREE.Vector3(), Math.min(1, delta * 6));
                product.velocity.multiplyScalar(0.9);
                pivot.rotation.z *= 0.9;
            }

            pivot.position.copy(product.basePosition).add(product.offset);
            pivot.scale.copy(product.baseScale).multiplyScalar(productScale);
        });
    }

    // --- Spring selection ------------------------------------------------
    let selectionObject = null;
    let selectionBaseScale = null;
    let springValue = 1;
    let springVelocity = 0;

    function clearSpring() {
        if (selectionObject && selectionBaseScale) selectionObject.scale.copy(selectionBaseScale);
        selectionObject = null;
        selectionBaseScale = null;
        springValue = 1;
        springVelocity = 0;
    }

    function setSelection(object) {
        if (object === selectionObject) return;
        clearSpring();
        selectionObject = object || null;
        if (selectionObject) {
            selectionBaseScale = selectionObject.scale.clone();
            springValue = 1;
            springVelocity = 0;
        }
    }

    function updateSpring(delta) {
        if (!state.springSelection) {
            if (selectionObject && selectionBaseScale) selectionObject.scale.copy(selectionBaseScale);
            springValue = 1;
            springVelocity = 0;
            return;
        }
        if (!selectionObject || !selectionBaseScale) return;
        const target = 1.06;
        const stiffness = 190;
        const damping = 18;
        // Fixed substeps keep the spring stable on slow frames: a single
        // 100 ms step would otherwise over-damp to zero and freeze the motion.
        let remaining = Math.min(delta, 0.1);
        while (remaining > 0) {
            const step = Math.min(remaining, 1 / 120);
            springVelocity += (target - springValue) * stiffness * step;
            springVelocity *= Math.max(0, 1 - damping * step);
            springValue += springVelocity * step;
            remaining -= step;
        }
        selectionObject.scale.set(
            selectionBaseScale.x * springValue,
            selectionBaseScale.y * springValue,
            selectionBaseScale.z * springValue
        );
    }

    // --- Ability state ---------------------------------------------------
    function apply(nextState = {}) {
        Object.assign(state, nextState);

        bloomPass.enabled = Boolean(state.bloom);
        dofPass.enabled = Boolean(state.depthOfField);
        vignettePass.enabled = Boolean(state.vignette);

        if (!state.productAutoRotate) {
            activeProducts.forEach((pivot) => {
                const product = productStates.get(pivot);
                if (!product) return;
                product.spin = 0;
                pivot.rotation.y = product.baseRotation.y;
            });
        }
        if (!state.productShake) {
            activeProducts.forEach((pivot) => {
                const product = productStates.get(pivot);
                if (!product) return;
                product.offset.set(0, 0, 0);
                product.velocity.set(0, 0, 0);
                pivot.position.copy(product.basePosition);
                pivot.rotation.z = product.baseRotation.z;
            });
        }

        if (!state.springSelection) {
            if (selectionObject && selectionBaseScale) selectionObject.scale.copy(selectionBaseScale);
            selectionObject = null;
            selectionBaseScale = null;
            springValue = 1;
            springVelocity = 0;
        }

        syncInstances();
        renderer.shadowMap.needsUpdate = true;
        requestRender();
        return stats();
    }

    function setPlan(bounds = {}, elevation = 0) {
        plan = {
            minX: Number.isFinite(bounds.minX) ? bounds.minX : -4,
            maxX: Number.isFinite(bounds.maxX) ? bounds.maxX : 4,
            minZ: Number.isFinite(bounds.minZ) ? bounds.minZ : -4,
            maxZ: Number.isFinite(bounds.maxZ) ? bounds.maxZ : 4,
            elevation: Number.isFinite(elevation) ? elevation : 0
        };
        instancePlaced = false;
        if (instanceMesh.visible) layoutInstances();
        requestRender();
    }

    function setInstances(count) {
        instanceCount = Math.min(MAX_INSTANCES, Math.max(0, Math.round(Number(count) || 0)));
        instancePlaced = false;
        syncInstances();
        if (instanceMesh.visible) layoutInstances();
        requestRender();
        return instanceCount;
    }

    function setShake(value) {
        shakeIntensity = Math.min(1, Math.max(0, Number(value) || 0));
        return shakeIntensity;
    }

    function setScale(value) {
        productScale = Math.min(2, Math.max(0.4, Number(value) || 1));
        activeProducts.forEach((pivot) => {
            const product = productStateFor(pivot);
            pivot.scale.copy(product.baseScale).multiplyScalar(productScale);
        });
        requestRender();
        return productScale;
    }

    function update(delta = 0, { camera: nextCamera, selection, products } = {}) {
        if (disposed) return;
        if (nextCamera) setCamera(nextCamera);
        setSelection(selection || null);
        setProducts(products || []);
        updateSpring(delta);
        updateInstances(delta);
        updateProducts(delta);
    }

    function showsEffects(nextCamera) {
        if (!state.bloom && !state.depthOfField && !state.vignette) return false;
        if (nextCamera && nextCamera.isOrthographicCamera) return false;
        return true;
    }

    function render(nextCamera) {
        if (!showsEffects(nextCamera)) return false;
        setCamera(nextCamera);
        composer.render();
        return true;
    }

    function needsFrame() {
        if (disposed) return false;
        if (instanceMesh.visible) return true;
        if (activeProducts.size > 0) {
            if (state.productShake || state.productAutoRotate) return true;
            for (const pivot of activeProducts) {
                const product = productStates.get(pivot);
                if (!product) continue;
                if (product.offset.length() > 0.002) return true;
                if (Math.abs(product.spin) > 0.001) return true;
                if (product.velocity.length() > 0.001) return true;
            }
        }
        if (state.springSelection && selectionObject) {
            return Math.abs(springValue - 1.06) > 0.001 || Math.abs(springVelocity) > 0.001;
        }
        return false;
    }

    function resize(width, height) {
        const w = Math.max(1, width || 1);
        const h = Math.max(1, height || 1);
        composer.setSize(w, h);
        bloomPass.setSize(w, h);
        requestRender();
    }

    // --- WebGPU preview --------------------------------------------------
    let webgpuOverlay = null;
    let webgpuStatus = 'not opened';

    async function openWebGPU() {
        if (webgpuOverlay) return webgpuStatus;

        const overlay = document.createElement('div');
        overlay.id = 'lab-webgpu-overlay';
        overlay.className = 'fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6';
        overlay.innerHTML = `
            <div class="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-white shadow-2xl">
                <div class="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div>
                        <p class="text-sm font-bold">WebGPU preview</p>
                        <p class="text-[10px] text-slate-400">Three.js WebGPURenderer · separate canvas, the editor stays on WebGL</p>
                    </div>
                    <button data-close class="rounded-md px-2 py-1 text-slate-300 hover:bg-white/10">Close</button>
                </div>
                <div data-canvas class="relative h-[420px] w-full bg-slate-950">
                    <div data-status class="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2 py-1 text-[11px]">Checking WebGPU…</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        webgpuOverlay = overlay;

        const statusNode = overlay.querySelector('[data-status]');
        const canvasHost = overlay.querySelector('[data-canvas]');
        const setStatus = (text, error = false) => {
            webgpuStatus = text;
            statusNode.textContent = text;
            statusNode.className = `absolute left-3 top-3 z-10 rounded-full px-2 py-1 text-[11px] ${error ? 'bg-red-600/80' : 'bg-black/60'}`;
        };

        let rendererGpu = null;
        let frameId = null;
        let stopped = false;
        let cleanupScene = null;

        const close = () => {
            stopped = true;
            if (frameId != null) cancelAnimationFrame(frameId);
            document.removeEventListener('keydown', onKey);
            cleanupScene?.();
            try {
                rendererGpu?.dispose?.();
                rendererGpu?.domElement?.remove?.();
            } catch (error) {
                console.warn('WebGPU preview cleanup failed', error);
            }
            overlay.remove();
            webgpuOverlay = null;
        };
        const onKey = (event) => { if (event.key === 'Escape') close(); };

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay || event.target.closest('[data-close]')) close();
        });
        document.addEventListener('keydown', onKey);

        if (!navigator.gpu) {
            setStatus('WebGPU not available in this browser · the editor keeps using WebGL', true);
            return webgpuStatus;
        }

        try {
            setStatus('WebGPU active');
            const { default: WebGPURenderer } = await import('three/addons/renderers/webgpu/WebGPURenderer.js');
            if (stopped) return webgpuStatus;

            const width = canvasHost.clientWidth || 640;
            const height = canvasHost.clientHeight || 420;

            const gpuScene = new THREE.Scene();
            gpuScene.background = new THREE.Color('#020617');

            const gpuCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            gpuCamera.position.set(3, 2.6, 3.4);
            gpuCamera.lookAt(0, 0, 0);

            const ambient = new THREE.AmbientLight(0xffffff, 1.4);
            gpuScene.add(ambient);
            const key = new THREE.DirectionalLight(0xffffff, 2.2);
            key.position.set(5, 6, 4);
            gpuScene.add(key);

            const knot = new THREE.Mesh(
                new THREE.TorusKnotGeometry(1, 0.32, 160, 32),
                new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.75, color: 0x13a4ec })
            );
            gpuScene.add(knot);

            const floor = new THREE.Mesh(
                new THREE.PlaneGeometry(12, 12),
                new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.3 })
            );
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -1.4;
            gpuScene.add(floor);

            rendererGpu = new WebGPURenderer({ antialias: true });
            rendererGpu.setPixelRatio(window.devicePixelRatio || 1);
            rendererGpu.setSize(width, height);
            canvasHost.appendChild(rendererGpu.domElement);
            if (!rendererGpu.domElement.style) rendererGpu.domElement.style = {};
            rendererGpu.domElement.style.width = '100%';
            rendererGpu.domElement.style.height = '100%';
            rendererGpu.domElement.style.display = 'block';

            const animate = () => {
                if (stopped) return;
                frameId = requestAnimationFrame(animate);
                knot.rotation.y += 0.01;
                knot.rotation.z += 0.004;
                rendererGpu.render(gpuScene, gpuCamera);
            };
            animate();

            cleanupScene = () => {
                knot.geometry.dispose();
                knot.material.dispose();
                floor.geometry.dispose();
                floor.material.dispose();
            };
        } catch (error) {
            console.warn('WebGPU preview failed', error);
            setStatus(`WebGPU unavailable: ${error?.message || error}`, true);
        }

        return webgpuStatus;
    }

    function stats() {
        const firstPivot = activeProducts.values().next().value || null;
        const firstState = firstPivot ? productStates.get(firstPivot) : null;
        let modelBounds = null;
        if (firstPivot) {
            const box = new THREE.Box3().setFromObject(firstPivot);
            if (!box.isEmpty()) {
                const size = box.getSize(new THREE.Vector3());
                modelBounds = {
                    width: Math.round(size.x * 1000) / 1000,
                    height: Math.round(size.y * 1000) / 1000,
                    depth: Math.round(size.z * 1000) / 1000
                };
            }
        }
        return {
            flags: { ...state },
            effects: {
                bloom: bloomPass.enabled,
                depthOfField: dofPass.enabled,
                vignette: vignettePass.enabled
            },
            instances: {
                enabled: instanceMesh.visible,
                count: instanceMesh.count,
                configured: instanceCount,
                capacity: MAX_INSTANCES
            },
            product: {
                placed: activeProducts.size,
                scale: productScale,
                autoRotate: Boolean(state.productAutoRotate),
                shake: Boolean(state.productShake),
                intensity: shakeIntensity,
                rotationY: firstPivot ? firstPivot.rotation.y : null,
                offset: firstState ? firstState.offset.length() : 0,
                bounds: modelBounds
            },
            spring: { enabled: Boolean(state.springSelection), attached: Boolean(selectionObject), value: springValue },
            webgpu: webgpuStatus,
            composerPasses: composer.passes.filter((pass) => pass.enabled).length
        };
    }

    function dispose() {
        disposed = true;
        clearSpring();
        scene.remove(instanceMesh);
        instanceGeometry.dispose();
        instanceMaterial.dispose();
        activeProducts.clear();
        composer.dispose?.();
        webgpuOverlay?.remove();
        webgpuOverlay = null;
    }

    function settings() {
        return {
            instances: instanceCount,
            shake: shakeIntensity,
            scale: productScale
        };
    }

    function applySettings(next = {}) {
        if (Number.isFinite(Number(next.instances))) setInstances(next.instances);
        if (Number.isFinite(Number(next.shake))) setShake(next.shake);
        if (Number.isFinite(Number(next.scale))) setScale(next.scale);
        return settings();
    }

    return {
        apply,
        setPlan,
        setInstances,
        setShake,
        setScale,
        settings,
        applySettings,
        update,
        render,
        needsFrame,
        resize,
        openWebGPU,
        stats,
        dispose,
        get state() { return { ...state }; }
    };
}
