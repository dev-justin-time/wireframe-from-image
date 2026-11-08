        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import {
            computeStraightDesigner,
            drawStairElevation,
            buildDesignerStair,
            designerTakeoffCsv,
            saveDesignerDraft,
            DESIGNER_DEFAULTS,
            DESIGNER_RULES
        } from '../../features/stairs/designer.js';

        const $ = (id) => document.getElementById(id);
        const FIELDS = {
            height: { min: 1200, max: 4500 },
            width: { min: 600, max: 1600 },
            blondelTarget: { min: 590, max: 650 },
            length: { min: 1500, max: 9000 },
            overlap: { min: 0, max: 80 },
            landingStep: { min: 0, max: 300 },
            stepThickness: { min: 20, max: 140 },
            openingLength: { min: 0, max: 9000 },
            floorThickness: { min: 80, max: 400 },
            leftOffset: { min: -500, max: 500 },
            rightOffset: { min: -500, max: 500 }
        };
        const idFor = (key) => key.replace(/([A-Z])/g, '-$1').toLowerCase();

        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const mm = (value) => `${Math.round(value)} mm`;

        function readInput() {
            const input = { solve: $('solve').value };
            Object.entries(FIELDS).forEach(([key, range]) => {
                const el = $(idFor(key));
                const value = Number(el?.value);
                input[key] = Number.isFinite(value) ? clamp(value, range.min, range.max) : DESIGNER_DEFAULTS[key];
            });
            const auto = $('auto-steps').checked;
            input.steps = auto ? null : clamp(Number($('steps').value) || 14, DESIGNER_RULES.steps.min, DESIGNER_RULES.steps.max);
            return input;
        }

        // --- 3D scene -------------------------------------------------
        const stage = $('stage');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8fafc);

        const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        stage.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI * 0.495;

        scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.4);
        key.position.set(6, 10, 7);
        scene.add(key);
        scene.add(new THREE.GridHelper(24, 24, 0xdbe3ee, 0xe8edf5));

        let stairGroup = null;

        function disposeStair() {
            if (!stairGroup) return;
            stairGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
            });
            scene.remove(stairGroup);
            stairGroup = null;
        }

        function frameGroup(group) {
            const box = new THREE.Box3().setFromObject(group);
            const size = new THREE.Vector3();
            const centre = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(centre);
            const radius = Math.max(size.x, size.y, size.z) * 0.75;
            const vFov = (camera.fov * Math.PI) / 180;
            const distance = (radius / Math.sin(vFov / 2)) * 1.55;
            camera.position.set(centre.x + distance * 0.75, centre.y + distance * 0.6, centre.z + distance * 0.95);
            camera.near = Math.max(distance / 500, 0.02);
            camera.far = distance * 8;
            camera.updateProjectionMatrix();
            controls.target.copy(centre);
            controls.update();
        }

        // --- elevation canvas -----------------------------------------
        const elevationCanvas = $('elevation');
        const elevationCtx = elevationCanvas.getContext('2d');

        function sizeCanvas(canvas) {
            const rect = canvas.parentElement.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio, 2);
            const width = Math.max(320, Math.floor(rect.width));
            const height = Math.max(220, Math.floor(rect.height));
            if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
            }
            return { width, height, dpr };
        }

        function drawElevation(result) {
            const { width, height, dpr } = sizeCanvas(elevationCanvas);
            elevationCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            elevationCtx.clearRect(0, 0, width, height);
            drawStairElevation(elevationCtx, result, { width, height, padding: 32 });
        }

        // --- results ---------------------------------------------------
        function renderResults(result) {
            const rows = [
                ['Steps / risers', `${result.steps} / ${result.risers}`],
                ['Step height', mm(result.stepHeight)],
                ['Going', mm(result.going)],
                ['Step depth', mm(result.stepDepth)],
                ['Landing step', result.landingStep.enabled ? mm(result.landingStep.size) : 'none'],
                ['Angle', `${result.angle.toFixed(1)}°`],
                ['G + 2H', mm(result.blondel)],
                ['Total run', mm(result.totalRun)],
                ['Headroom', mm(result.headroom)],
                ['Width', mm(result.width)]
            ];
            $('results').innerHTML = rows.map(([label, value]) =>
                `<span class="text-slate-400">${label}</span><span class="text-right">${value}</span>`
            ).join('');

            $('comfort-label').textContent = `${result.comfort}%`;
            const bar = $('comfort-bar');
            bar.style.width = `${result.comfort}%`;
            bar.className = 'h-full transition-all ' + (result.comfort >= 80 ? 'bg-emerald-500' : result.comfort >= 60 ? 'bg-amber-500' : 'bg-red-500');

            $('checks').innerHTML = result.checks.map((check) => {
                const icon = check.severity === 'error' ? '✖' : check.severity === 'warn' ? '⚠' : check.severity === 'ok' ? '✓' : 'ℹ';
                return `<li class="check-${check.severity}">${icon} ${check.message}</li>`;
            }).join('');

            $('height-label').textContent = mm(result.height);
            $('width-label').textContent = mm(result.width);
            $('blondel-label').textContent = result.solve === 'blondel' ? mm(result.blondelTarget) : mm(result.blondel);
            $('length-label').textContent = mm(result.totalRun);
            if (result.autoSteps) $('steps').value = result.steps;
        }

        function syncInputs(result) {
            const lengthMode = result.solve === 'length';
            const lengthInput = $('length');
            const lengthRange = $('length-range');
            const blondelInput = $('blondel-target');
            const blondelRange = $('blondel-target-range');
            blondelInput.disabled = lengthMode;
            blondelRange.disabled = lengthMode;
            lengthInput.readOnly = !lengthMode;
            lengthRange.disabled = !lengthMode;
            $('length-caption').textContent = lengthMode ? 'Total length' : 'Total run (computed)';
            $('blondel-label-caption').textContent = lengthMode ? 'G + 2H (computed)' : "Blondel's law";
            if (!lengthMode && document.activeElement !== lengthInput) {
                lengthInput.value = Math.round(result.totalRun);
                lengthRange.value = Math.round(result.totalRun);
            }
            if (lengthMode && document.activeElement !== blondelInput) {
                // Show the derived value even when it leaves the 590–650 band.
                blondelInput.value = Math.round(result.blondel);
                blondelRange.value = clamp(Math.round(result.blondel), 590, 650);
            }
        }

        function update() {
            const result = computeStraightDesigner(readInput());
            window.designerResult = result;

            Object.keys(FIELDS).forEach((fieldKey) => {
                const id = idFor(fieldKey);
                const range = $(`${id}-range`);
                const value = $(id);
                if (!range || !value) return;
                if (document.activeElement === range) value.value = range.value;
                else range.value = value.value;
            });

            renderResults(result);
            syncInputs(result);
            drawElevation(result);

            disposeStair();
            stairGroup = buildDesignerStair(result);
            scene.add(stairGroup);
            frameGroup(stairGroup);
            renderer.render(scene, camera);
            return result;
        }

        // --- wiring ----------------------------------------------------
        Object.keys(FIELDS).forEach((fieldKey) => {
            const id = idFor(fieldKey);
            const range = $(`${id}-range`);
            const value = $(id);
            range?.addEventListener('input', () => {
                value.value = range.value;
                update();
            });
            value?.addEventListener('input', () => {
                if (range) range.value = value.value;
                update();
            });
        });

        $('solve').addEventListener('change', () => {
            // Switching to length mode starts from the run that is on screen.
            if ($('solve').value === 'length' && window.designerResult) {
                $('length').readOnly = false;
                $('length').value = Math.round(window.designerResult.totalRun);
                $('length-range').value = $('length').value;
            }
            update();
        });
        $('auto-steps').addEventListener('change', (event) => {
            $('steps').disabled = event.target.checked;
            update();
        });
        $('steps').addEventListener('input', update);

        $('reset').addEventListener('click', () => {
            Object.entries(DESIGNER_DEFAULTS).forEach(([key, defaultValue]) => {
                if (key === 'steps' || key === 'solve') return;
                const id = idFor(key);
                const el = $(id);
                if (!el) return;
                el.value = defaultValue;
                const range = $(`${id}-range`);
                if (range) range.value = defaultValue;
            });
            $('solve').value = 'blondel';
            $('auto-steps').checked = true;
            $('steps').disabled = true;
            update();
            $('status').textContent = 'Reset to the defaults';
        });

        function addToPlan() {
            const result = window.designerResult || update();
            saveDesignerDraft(result);
            $('status').textContent = 'Placing the stair in the editor…';
            window.location.href = 'Editor.html?fromDesigner=1';
        }
        $('add-to-plan').addEventListener('click', addToPlan);
        $('add-to-plan-2').addEventListener('click', addToPlan);

        $('takeoff').addEventListener('click', () => {
            const result = window.designerResult || update();
            const blob = new Blob([designerTakeoffCsv(result)], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'straight-stair-takeoff.csv';
            link.click();
            URL.revokeObjectURL(url);
            $('status').textContent = 'Takeoff downloaded';
        });

        function resize() {
            const rect = stage.getBoundingClientRect();
            const width = Math.max(320, Math.floor(rect.width));
            const height = Math.max(200, Math.floor(rect.height));
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            if (window.designerResult) drawElevation(window.designerResult);
            renderer.render(scene, camera);
        }
        window.addEventListener('resize', resize);
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => resize());
            observer.observe(stage);
            observer.observe(elevationCanvas.parentElement);
        }

        controls.addEventListener('change', () => renderer.render(scene, camera));

        resize();
        update();
        window.stairDesigner = {
            compute: () => window.designerResult,
            update,
            redraw: () => drawElevation(window.designerResult)
        };
