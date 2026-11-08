        import { SharedViewer } from '../../scene/SharedViewer.js';
        import { processFloorPlan } from '../../engine/floorPlanProcessor.js';
        import { writeDraft } from '../../core/drafts.js';
        import { loadDemoPlan, createNewPlan } from '../../shared/demo-plan.js';

        document.addEventListener('DOMContentLoaded', () => {
            const uploadInput = document.getElementById('floorplan-upload');
            const processingState = document.getElementById('processing-state');
            const processingText = document.getElementById('processing-text');
            const viewerPlaceholder = document.getElementById('viewer-placeholder');
            const viewerContainer = document.getElementById('shared-viewer-container');
            const statsWalls = document.getElementById('stats-walls');
            const statsTime = document.getElementById('stats-time');
            const viewerToggle = document.getElementById('viewer-toggle');
            const editInStudio = document.getElementById('edit-in-studio');

            let viewerInstance = null;
            // Last converted plan, kept so it can be handed to the studio editor.
            let lastPlan = null;

            const showEditInStudio = (visible) => {
                editInStudio.classList.toggle('hidden', !visible);
                editInStudio.classList.toggle('flex', visible);
            };

            // The studio reads this draft on load and becomes the editable plan:
            // the same walls plus its openings, items and 3D tools.
            editInStudio.addEventListener('click', () => {
                if (!lastPlan) return;
                const handed = writeDraft('floorplan-editor-draft', {
                    source: 'floorplan-upload',
                    width: lastPlan.width,
                    height: lastPlan.height,
                    walls: lastPlan.walls.map((wall) => ({
                        start: { x: wall.start.x, y: wall.start.y },
                        end: { x: wall.end.x, y: wall.end.y }
                    })),
                    rooms: lastPlan.rooms || [],
                    createdAt: Date.now()
                });
                if (!handed) {
                    window.showToast("Could not open the studio. The browser storage is full.", "error");
                    return;
                }
                window.location.href = 'Editor.html';
            });

            // Handle Floorplan Upload
            uploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // 1. Show Processing State
                showEditInStudio(false);
                lastPlan = null;
                viewerPlaceholder.classList.add('hidden');
                viewerContainer.classList.add('hidden');
                processingState.classList.remove('hidden');
                processingState.classList.add('flex');
                processingText.textContent = "Analyzing floorplan geometry...";

                const startTime = performance.now();

                try {
                    // 2. Simulate processing steps for UX
                    await new Promise(r => setTimeout(r, 800));
                    processingText.textContent = "Running Canny edge detection...";
                    await new Promise(r => setTimeout(r, 600));
                    processingText.textContent = "Vectorizing walls and merging segments...";
                    
                    // 3. Process the floorplan using our high-value logic
                    const result = await processFloorPlan(file);
                    const duration = Math.round(performance.now() - startTime);

                    // 4. Update Stats Overlay
                    const roomCount = result.rooms?.length || 0;
                    statsWalls.textContent = `${result.walls.length} Walls${roomCount ? ` · ${roomCount} Rooms` : ''}`;
                    statsTime.textContent = `${duration}ms Processing`;

                    // 5. Show Viewer
                    processingState.classList.add('hidden');
                    processingState.classList.remove('flex');
                    viewerContainer.classList.remove('hidden');

                    // 6. Initialize SharedViewer if not already done. The viewer
                    // owns the panorama/3D toggle, so the page does not add a
                    // second listener (two listeners cancel each other out).
                    if (!viewerInstance) {
                        viewerInstance = new SharedViewer();
                        await viewerInstance.init('shared-viewer-container');
                        // Same handle the other scene pages expose, for the
                        // overlay stats and headless checks.
                        window.sharedViewer = viewerInstance;
                    }

                    // 7. Push the extracted plan into the live scene and switch
                    // to the 3D view (updateFloorplan does both).
                    const shown = viewerInstance.updateFloorplan(result);
                    if (!shown) {
                        throw new Error('No usable walls in the uploaded plan');
                    }
                    viewerToggle.checked = true;
                    lastPlan = result;
                    showEditInStudio(true);

                    window.showToast("Floorplan converted to 3D successfully!", "success");

                } catch (error) {
                    console.error("Processing failed:", error);
                    processingState.classList.add('hidden');
                    processingState.classList.remove('flex');
                    viewerContainer.classList.add('hidden');
                    viewerPlaceholder.classList.remove('hidden');
                    showEditInStudio(false);
                    window.showToast("Failed to process image. Please try a clearer blueprint.", "error");
                } finally {
                    // Let the same file be picked again after a failed attempt.
                    uploadInput.value = '';
                }
            });

            // Farmhouse demo: seed the shared autosave so EVERY page (Editor,
            // demo, suites) opens on the same default floorplan.
            const demoButtons = [document.getElementById('load-demo-plan'), document.getElementById('pipeline-demo')].filter(Boolean);
            demoButtons.forEach((btn) => btn.addEventListener('click', async () => {
                btn.disabled = true;
                try {
                    await loadDemoPlan('../assets/southern-farmhouse-plan.json');
                    window.showToast('Southern Farmhouse demo loaded — opening the Studio…', 'success');
                    setTimeout(() => { window.location.href = 'Editor.html'; }, 600);
                } catch (error) {
                    console.error('Demo load failed:', error);
                    window.showToast('Could not load the demo plan.', 'error');
                    btn.disabled = false;
                }
            }));

            // Create New: blank versioned project, then open the Studio.
            const newButtons = [document.getElementById('create-new-plan'), document.getElementById('pipeline-new')].filter(Boolean);
            newButtons.forEach((btn) => btn.addEventListener('click', () => {
                try {
                    createNewPlan();
                    window.showToast('New blank plan — opening the Studio…', 'success');
                    setTimeout(() => { window.location.href = 'Editor.html'; }, 400);
                } catch (error) {
                    console.error('Create new failed:', error);
                    window.showToast('Could not create a new plan (storage blocked).', 'error');
                }
            }));

            // Modal functionality
            const quicklinksBtn = document.getElementById('quicklinks-btn');
            const modal = document.getElementById('quicklinks-modal');
            const closeBtn = document.getElementById('close-modal');
            
            function openModal() {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
            function closeModal() {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
            
            quicklinksBtn.addEventListener('click', openModal);
            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

            // Intersection Observer for fade-in animations
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
            
            document.querySelectorAll('.flex.flex-1.gap-4, section').forEach(el => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(20px)';
                el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                observer.observe(el);
            });

            // Toast notification helper
            window.showToast = function(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl z-50 transition-all transform translate-y-0 opacity-100 text-white font-medium flex items-center gap-2 ${
                    type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'
                }`;
                toast.innerHTML = `<span class="material-symbols-outlined text-sm">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span> ${message}`;
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.transform = 'translateY(100px)';
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            };
        });
