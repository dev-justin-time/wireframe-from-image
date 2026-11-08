/**
 * Ceiling / roof toggles.
 *
 * The 3D engine already accepts `showCeiling` and `showRoof`; these helpers are
 * the editor-side switch for them, including keeping the header checkboxes in
 * step with the state after a project is restored.
 */

export function setCeiling(state, enabled) {
    if (!state) return false;
    state.showCeiling = Boolean(enabled);
    return state.showCeiling;
}

export function setRoof(state, enabled) {
    if (!state) return false;
    state.showRoof = Boolean(enabled);
    return state.showRoof;
}

export function toggleCeiling(state) {
    return setCeiling(state, !state?.showCeiling);
}

export function toggleRoof(state) {
    return setRoof(state, !state?.showRoof);
}

export function shellState(state) {
    return {
        showCeiling: Boolean(state?.showCeiling),
        showRoof: Boolean(state?.showRoof)
    };
}

/** Mirror the state into the header switches. */
export function syncShellToggles(root, state) {
    if (!root || !state) return;
    const ceiling = root.getElementById ? root.getElementById('ceiling-toggle') : root.querySelector('#ceiling-toggle');
    const roof = root.getElementById ? root.getElementById('roof-toggle') : root.querySelector('#roof-toggle');
    if (ceiling) ceiling.checked = Boolean(state.showCeiling);
    if (roof) roof.checked = Boolean(state.showRoof);
}
