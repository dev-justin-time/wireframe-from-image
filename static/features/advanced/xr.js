import * as THREE from 'three';

/**
 * Advanced feature 35 - AR placement of the selected cabinet.
 *
 * Thin wrapper over WebXR hit-testing: the caller gets a support check, a
 * session starter and a reticle. The selected piece is placed at the last hit
 * position through `onPlace(worldPoint)`. Everything degrades cleanly when the
 * device or browser has no immersive-ar support: `support()` reports why and
 * `start()` returns { ok: false } instead of throwing.
 */

export async function support() {
    if (typeof navigator === 'undefined' || !navigator.xr) {
        return { ar: false, vr: false, reason: 'WebXR not available in this browser' };
    }

    const check = async (mode) => {
        try {
            return await navigator.xr.isSessionSupported(mode);
        } catch {
            return false;
        }
    };

    const [ar, vr] = await Promise.all([check('immersive-ar'), check('immersive-vr')]);
    return {
        ar,
        vr,
        reason: ar ? null : 'immersive-ar is not supported on this device'
    };
}

export async function startPlacement({
    renderer,
    scene,
    onPlace,
    onEnd,
    reticleColor = 0x13a4ec
} = {}) {
    const status = await support();
    if (!status.ar) return { ok: false, ...status };
    if (!renderer || !scene) return { ok: false, ar: true, reason: 'renderer and scene are required' };

    let session;
    try {
        session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['local-floor']
        });
    } catch (error) {
        return { ok: false, ar: true, reason: error?.message || 'could not start an AR session' };
    }

    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);

    const viewer = await session.requestReferenceSpace('viewer');
    const hitTestSource = await session.requestHitTestSource({ space: viewer });
    const referenceSpace = renderer.xr.getReferenceSpace();

    const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: reticleColor, side: THREE.DoubleSide })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    reticle.name = 'ar-reticle';
    scene.add(reticle);

    let placed = null;

    const frame = (time, xrFrame) => {
        if (xrFrame && hitTestSource) {
            const results = xrFrame.getHitTestResults(hitTestSource);
            if (results.length > 0) {
                const pose = results[0].getPose(referenceSpace);
                if (pose) {
                    reticle.visible = true;
                    reticle.matrix.fromArray(pose.transform.matrix);
                }
            } else {
                reticle.visible = false;
            }
        }
        renderer.render(scene, renderer.xr.isPresenting ? renderer.xr.getCamera() : undefined);
    };

    renderer.setAnimationLoop(frame);

    const select = () => {
        if (!reticle.visible) return;
        const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        placed = point.clone();
        onPlace?.(point);
    };
    session.addEventListener('select', select);

    const end = async () => {
        session.removeEventListener('select', select);
        hitTestSource?.cancel?.();
        scene.remove(reticle);
        reticle.geometry.dispose();
        reticle.material.dispose();
        renderer.setAnimationLoop(null);
        renderer.xr.enabled = false;
        await session.end().catch(() => {});
    };

    session.addEventListener('end', () => {
        scene.remove(reticle);
        renderer.setAnimationLoop(null);
        renderer.xr.enabled = false;
        onEnd?.();
    });

    return {
        ok: true,
        ar: true,
        session,
        reticle,
        end,
        get placed() {
            return placed ? placed.clone() : null;
        }
    };
}
