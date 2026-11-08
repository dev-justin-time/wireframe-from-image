        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { PART_LIBRARY, partsByCategory, buildPartWireframe, partSize } from '../../features/stairs/parts.js';

        const IN = 0.0254;
        const stage = document.getElementById('stage');

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a);
        scene.fog = new THREE.Fog(0x0f172a, 26, 60);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 200);
        camera.position.set(6, 7, 9);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        stage.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI * 0.49;

        scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 0.6);
        key.position.set(8, 12, 6);
        scene.add(key);

        const grid = new THREE.GridHelper(60, 60, 0x1e293b, 0x172033);
        grid.position.y = -0.01;
        scene.add(grid);

        const labelGroup = new THREE.Group();
        scene.add(labelGroup);

        const wireColor = 0x93c5fd;
        const entries = [];
        let cursorX = 0;
        let cursorZ = 0;
        let rowDepth = 0;
        const ROW_GAP = 1.4;

        function labelSprite(text, size = 0.34) {
            const canvas = document.createElement('canvas');
            const ratio = 4;
            canvas.width = 512 * ratio;
            canvas.height = 96 * ratio;
            const ctx = canvas.getContext('2d');
            ctx.scale(ratio, ratio);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.0)';
            ctx.fillRect(0, 0, 512, 96);
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '600 30px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 256, 48);
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(size * (512 / 96), size, 1);
            return sprite;
        }

        // Lay every part out at its real size, one category per row. The cursor
        // advances by each part's own length plus a walking gap.
        partsByCategory().forEach((group, rowIndex) => {
            let x = 0;
            let deepest = 0;
            const rowParts = [];

            group.parts.forEach((part) => {
                const wire = buildPartWireframe(THREE, part.key, { color: wireColor });
                if (!wire) return;

                const box = new THREE.Box3().setFromObject(wire);
                const size = new THREE.Vector3();
                box.getSize(size);
                wire.position.set(x + size.x / 2, -box.min.y, cursorZ);
                scene.add(wire);

                const label = labelSprite(part.label);
                label.position.set(x + size.x / 2, Math.max(0.9, size.y + 0.35), cursorZ);
                labelGroup.add(label);

                rowParts.push({ part, wire, label, size, box: box.clone(), origin: wire.position.clone() });
                x += Math.max(size.x, 0.5) + 0.9;
                deepest = Math.max(deepest, size.z);
            });

            entries.push(...rowParts);
            rowDepth = Math.max(rowDepth, deepest);
            cursorZ += rowDepth + ROW_GAP;
            rowDepth = 0;
            void rowIndex;
            void cursorX;
        });

        // Sidebar list.
        const list = document.getElementById('part-list');
        let activeKey = null;
        function select(partKey) {
            const entry = entries.find((item) => item.part.key === partKey);
            if (!entry) return;
            activeKey = partKey;
            document.querySelectorAll('.part-button').forEach((button) => {
                button.classList.toggle('active', button.dataset.key === partKey);
            });
            const { part, wire, size, box } = entry;
            document.getElementById('info-title').textContent = part.label;
            document.getElementById('info-material').textContent = part.material;
            const dims = partSize(part.key, part.options);
            document.getElementById('info-size').textContent =
                `L ${(dims.length / IN).toFixed(2)} in · W ${(dims.width / IN).toFixed(2)} in · H ${(dims.height / IN).toFixed(2)} in`
                + `  (${dims.length.toFixed(2)} × ${dims.width.toFixed(2)} × ${dims.height.toFixed(2)} m)`;
            document.getElementById('info-code').textContent = part.code;
            document.getElementById('info-summary').textContent = part.summary;

            const center = wire.position.clone();
            center.y += size.y / 2;
            const radius = Math.max(size.length(), 0.4);
            const distance = radius * 3.2 + 0.9;
            controls.target.copy(center);
            camera.position.set(center.x + distance * 0.75, center.y + distance * 0.55, center.z + distance * 0.85);
            controls.update();
            wire.material = new THREE.LineBasicMaterial({ color: 0x7dd3fc });
            void box;
        }

        partsByCategory().forEach((group) => {
            const heading = document.createElement('h2');
            heading.className = 'text-[10px] uppercase tracking-widest text-slate-500 font-bold';
            heading.textContent = group.category;
            list.appendChild(heading);
            const wrap = document.createElement('div');
            wrap.className = 'mt-1 space-y-1';
            group.parts.forEach((part) => {
                const button = document.createElement('button');
                button.className = 'part-button block w-full text-left rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-500';
                button.dataset.key = part.key;
                button.textContent = part.label;
                button.addEventListener('click', () => select(part.key));
                wrap.appendChild(button);
            });
            list.appendChild(wrap);
        });

        function frameAll() {
            const box = new THREE.Box3();
            entries.forEach((entry) => box.expandByObject(entry.wire));
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const radius = Math.max(size.length(), 2);
            const fov = (camera.fov * Math.PI) / 180;
            const distance = (radius * 0.62) / Math.sin(fov / 2);
            controls.target.copy(center);
            camera.position.set(center.x + distance * 0.55, center.y + distance * 0.5, center.z + distance * 0.75);
            controls.update();
        }

        document.getElementById('fit-all').addEventListener('click', frameAll);
        document.getElementById('toggle-labels').addEventListener('click', (event) => {
            labelGroup.visible = !labelGroup.visible;
            event.currentTarget.textContent = labelGroup.visible ? 'Labels on' : 'Labels off';
        });

        window.addEventListener('keydown', (event) => {
            if (event.key === 'f') frameAll();
        });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        frameAll();
        if (entries.length) select(entries[0].part.key);

        // Small API for the headless checks.
        window.partsGallery = {
            count: entries.length,
            categories: partsByCategory().map((group) => ({ category: group.category, count: group.parts.length })),
            select,
            frameAll,
            entries: entries.map((entry) => ({
                key: entry.part.key,
                label: entry.part.label,
                size: entry.size.toArray()
            }))
        };

        renderer.setAnimationLoop(() => {
            controls.update();
            labelGroup.children.forEach((sprite) => sprite.quaternion.copy(camera.quaternion));
            renderer.render(scene, camera);
        });
