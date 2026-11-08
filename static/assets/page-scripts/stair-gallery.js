        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { STAIR_MODELS, modelsByCategory, stairModelConfig, computeStairModel } from '../../features/stairs/models.js';
        import { buildStairGeometry } from '../../features/stairs/geometry.js';

        const IN = 0.0254;
        const STOREY = 2.7;
        const COLUMNS = 4;
        const stage = document.getElementById('stage');

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a);
        scene.fog = new THREE.Fog(0x0f172a, 42, 110);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 400);
        camera.position.set(0, 10, 26);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        stage.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI * 0.495;

        scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 1.15));
        const key = new THREE.DirectionalLight(0xffffff, 0.65);
        key.position.set(12, 22, 18);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x93c5fd, 0.35);
        fill.position.set(-14, 10, -12);
        scene.add(fill);

        const padGeometry = new THREE.BoxGeometry(1, 1, 1);
        const padMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95, metalness: 0.05 });
        const labelGroup = new THREE.Group();
        scene.add(labelGroup);

        function labelSprite(text, size = 0.7) {
            const canvas = document.createElement('canvas');
            const ratio = 4;
            canvas.width = 512 * ratio;
            canvas.height = 88 * ratio;
            const ctx = canvas.getContext('2d');
            ctx.scale(ratio, ratio);
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '600 28px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 256, 44);
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(size * (512 / 88), size, 1);
            return sprite;
        }

        const entries = STAIR_MODELS.map((model) => {
            const design = computeStairModel(model.key, { storeyHeight: STOREY });
            const config = stairModelConfig(model.key, { storeyHeight: STOREY });
            const item = {
                type: 'stair',
                x: 0,
                y: 0,
                rotation: 0,
                metadata: { width: design.width, depth: design.footprint.depth, height: STOREY },
                stair: config
            };
            const group = buildStairGeometry(item, { storeyHeight: STOREY });
            // Turn each flight side-on: the run reads left to right across the
            // gallery instead of pointing away from the camera.
            group.rotation.y = Math.PI / 2;
            group.updateMatrixWorld(true);
            group.userData = { ...group.userData, galleryKey: model.key };
            const box = new THREE.Box3().setFromObject(group);
            const size = new THREE.Vector3();
            box.getSize(size);
            return { model, design, config, item, group, box, size };
        });

        const cellWidth = Math.max(...entries.map((entry) => entry.size.x)) + 0.8;
        const cellDepth = Math.max(...entries.map((entry) => entry.size.z)) + 0.8;
        const rows = Math.ceil(entries.length / COLUMNS);

        entries.forEach((entry, index) => {
            const column = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);
            const cellX = (column - (COLUMNS - 1) / 2) * cellWidth;
            const cellZ = (row - (rows - 1) / 2) * cellDepth;
            const centre = new THREE.Vector3();
            entry.box.getCenter(centre);

            entry.group.position.set(cellX - centre.x, -entry.box.min.y, cellZ - centre.z);
            entry.cell = { x: cellX, z: cellZ, width: cellWidth, depth: cellDepth };
            scene.add(entry.group);

            const pad = new THREE.Mesh(padGeometry, padMaterial.clone());
            pad.scale.set(cellWidth - 0.42, 0.06, cellDepth - 0.42);
            pad.position.set(cellX, -0.03, cellZ);
            pad.receiveShadow = true;
            scene.add(pad);
            entry.pad = pad;

            const label = labelSprite(entry.model.label);
            label.position.set(cellX, entry.size.y + 0.6, cellZ);
            labelGroup.add(label);
            entry.label = label;
        });

        const gridWidth = COLUMNS * cellWidth;
        const gridDepth = rows * cellDepth;
        const grid = new THREE.GridHelper(Math.max(gridWidth, gridDepth) + 6, 48, 0x243044, 0x1a2335);
        grid.position.y = 0;
        scene.add(grid);

        // Sidebar list, grouped by family category.
        const list = document.getElementById('model-list');
        modelsByCategory().forEach((group) => {
            const heading = document.createElement('h2');
            heading.className = 'text-[10px] uppercase tracking-widest text-slate-500 font-bold';
            heading.textContent = group.category;
            list.appendChild(heading);
            const wrap = document.createElement('div');
            wrap.className = 'mt-1 space-y-1';
            group.models.forEach((model) => {
                const button = document.createElement('button');
                button.className = 'model-button block w-full text-left rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-500';
                button.dataset.key = model.key;
                button.textContent = model.label;
                button.addEventListener('click', () => select(model.key));
                wrap.appendChild(button);
            });
            list.appendChild(wrap);
        });

        const info = {
            title: document.getElementById('info-title'),
            meta: document.getElementById('info-meta'),
            size: document.getElementById('info-size'),
            code: document.getElementById('info-code'),
            checks: document.getElementById('info-checks'),
            summary: document.getElementById('info-summary')
        };

        let selectedKey = null;

        function select(key) {
            const entry = entries.find((candidate) => candidate.model.key === key);
            if (!entry) return null;
            selectedKey = key;
            document.querySelectorAll('.model-button').forEach((button) => {
                button.classList.toggle('active', button.dataset.key === key);
            });
            entries.forEach((candidate) => {
                candidate.pad.material.color.set(candidate === entry ? 0x0c4a6e : 0x1e293b);
            });

            const { model, design, size } = entry;
            info.title.textContent = model.label;
            info.meta.textContent = `${model.category} · ${(design.width / IN).toFixed(1)} in wide · ${design.risers} risers`;
            info.size.textContent = `${(design.riserHeight / IN).toFixed(2)} in riser × ${(design.treadDepth / IN).toFixed(2)} in tread`
                + ` · ${design.model?.slopeDegrees ?? 0}° slope`
                + ` · ${size.x.toFixed(2)} × ${size.z.toFixed(2)} m footprint`;
            const ref = model.refs?.[0];
            info.code.textContent = ref ? `${ref.code} ${ref.ref}` : '';
            const errors = design.errors?.length || 0;
            const warnings = design.warnings?.length || 0;
            info.checks.textContent = errors || warnings
                ? `${errors} error${errors === 1 ? '' : 's'} · ${warnings} warning${warnings === 1 ? '' : 's'}`
                : 'No code issues at this storey height';
            info.checks.className = `text-[10px] font-mono mt-1 ${errors ? 'text-rose-400' : warnings ? 'text-amber-400' : 'text-emerald-400'}`;
            info.summary.textContent = model.summary;
            [info.size, info.code, info.checks, info.summary].forEach((node) => node.classList.remove('hidden'));

            frame(entry);
            return entry;
        }

        // Frame distance from the box extents (not its diagonal, which pushes
        // the camera far enough back that the labels stop reading).
        function fitDistance(size, fill = 1.1) {
            const vFov = (camera.fov * Math.PI) / 180;
            const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
            return Math.max(
                Math.max(size.x, size.z) / (2 * Math.tan(hFov / 2)),
                size.y / (2 * Math.tan(vFov / 2))
            ) * fill;
        }

        function frame(entry) {
            // The group is offset from the origin when it is laid out, so frame
            // its world box, not the build-time local one.
            entry.group.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(entry.group);
            const centre = new THREE.Vector3();
            const size = new THREE.Vector3();
            box.getCenter(centre);
            box.getSize(size);
            const distance = fitDistance(size, 1.25);
            controls.target.copy(centre);
            camera.position.set(centre.x + distance * 0.18, centre.y + distance * 0.42, centre.z + distance * 0.92);
            controls.update();
        }

        function frameAll() {
            const box = new THREE.Box3();
            entries.forEach((entry) => box.expandByObject(entry.group));
            const size = new THREE.Vector3();
            const centre = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(centre);
            const distance = fitDistance(size, 1.08);
            controls.target.copy(centre);
            camera.position.set(centre.x + distance * 0.1, centre.y + distance * 0.3, centre.z + distance * 0.95);
            controls.update();
        }

        function clearSelection({ frame = true } = {}) {
            selectedKey = null;
            entries.forEach((entry) => entry.pad.material.color.set(0x1e293b));
            document.querySelectorAll('.model-button').forEach((button) => button.classList.remove('active'));
            info.title.textContent = '12 stair models';
            info.meta.textContent = 'Click a model in the scene or the list to frame it.';
            [info.size, info.code, info.checks, info.summary].forEach((node) => node.classList.add('hidden'));
            if (frame) frameAll();
        }

        // Click a model in the scene to select it; a drag stays an orbit.
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let pressedAt = null;

        function pickAt(clientX, clientY) {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hit = raycaster.intersectObjects(entries.map((entry) => entry.group), true)[0];
            if (!hit) return null;
            let node = hit.object;
            while (node && !node.userData.galleryKey) node = node.parent;
            return node?.userData.galleryKey || null;
        }

        renderer.domElement.addEventListener('pointerdown', (event) => {
            pressedAt = { x: event.clientX, y: event.clientY };
        });
        renderer.domElement.addEventListener('pointerup', (event) => {
            if (!pressedAt || Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > 5) return;
            const key = pickAt(event.clientX, event.clientY);
            if (key) select(key);
        });

        document.getElementById('fit-all').addEventListener('click', () => clearSelection());
        document.getElementById('toggle-labels').addEventListener('click', (event) => {
            labelGroup.visible = !labelGroup.visible;
            event.currentTarget.textContent = labelGroup.visible ? 'Labels on' : 'Labels off';
        });

        window.addEventListener('keydown', (event) => {
            if (event.key === 'f') frameAll();
            if (event.key === 'Escape') clearSelection();
        });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        frameAll();

        // Small API for the headless checks.
        window.stairGallery = {
            count: entries.length,
            labelCount: labelGroup.children.length,
            rows: modelsByCategory().map((group) => ({ category: group.category, count: group.models.length })),
            select,
            frameAll,
            clearSelection,
            pickAt,
            get selected() { return selectedKey; },
            entries: entries.map((entry) => {
                entry.group.updateMatrixWorld(true);
                const world = new THREE.Box3().setFromObject(entry.group);
                return {
                    key: entry.model.key,
                    label: entry.model.label,
                    category: entry.model.category,
                    risers: entry.design.risers,
                    cell: { x: entry.cell.x, z: entry.cell.z },
                    size: entry.size.toArray(),
                    world: { min: world.min.toArray(), max: world.max.toArray() }
                };
            })
        };

        renderer.setAnimationLoop(() => {
            controls.update();
            labelGroup.children.forEach((sprite) => sprite.quaternion.copy(camera.quaternion));
            renderer.render(scene, camera);
        });
