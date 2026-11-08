/**
 * Studio feature 40 - dirty-flag rendering.
 *
 * The 3D preview used to render on every animation frame whether anything had
 * changed or not. This loop renders only when a frame is requested (drag
 * preview, gizmo, camera, resize, rebuild) and otherwise idles, which is what
 * keeps a 3D drag at display rate without a CSG rebuild per pointer move.
 */

export function createRenderLoop({ render, isActive = () => true, continuous = () => false, autoStart = true } = {}) {
    if (typeof render !== 'function') throw new Error('render loop needs a render function');

    let running = false;
    let dirty = true;
    let frameId = null;
    let frames = 0;
    let lastTime = 0;
    let fps = 0;
    let fpsAccumulator = 0;
    let fpsFrames = 0;

    const tick = (time) => {
        if (!running) return;
        frameId = requestAnimationFrame(tick);
        // A hidden view draws nothing, so a frame requested while it is hidden
        // has to stay pending. Clearing the flag here (as this loop used to)
        // swallowed edits made on the plan *before* the 3D tab was opened, and a
        // view that never drew its first frame is a blank canvas.
        if (!isActive()) {
            // Forget the clock too, so the first visible frame does not jump a
            // walkthrough or a lab animation forward by the hidden time.
            lastTime = 0;
            return;
        }
        // `continuous` is for things that animate every frame (walkthrough,
        // turntable, "render every frame" mode); everything else waits for a
        // requestRender().
        if (!dirty && !continuous()) return;

        const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
        lastTime = time;
        dirty = false;
        frames += 1;

        render(delta);

        fpsAccumulator += delta;
        fpsFrames += 1;
        if (fpsAccumulator >= 0.5) {
            fps = Math.round(fpsFrames / fpsAccumulator);
            fpsAccumulator = 0;
            fpsFrames = 0;
        }
    };

    return {
        start() {
            if (running) return;
            running = true;
            lastTime = 0;
            frameId = requestAnimationFrame(tick);
        },
        stop() {
            running = false;
            if (frameId != null) cancelAnimationFrame(frameId);
            frameId = null;
        },
        /** Ask for one frame; consecutive calls in a frame collapse to one. */
        requestRender() {
            dirty = true;
        },
        /** Render this frame even without a request (animation tick). */
        renderNextFrame() {
            dirty = true;
        },
        /** Only render when `predicate()` is true. */
        invalidateIf(predicate) {
            if (predicate && predicate()) dirty = true;
            return dirty;
        },
        get running() {
            return running;
        },
        get stats() {
            return { frames, fps, dirty };
        }
    };
}
