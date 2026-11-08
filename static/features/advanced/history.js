/**
 * Advanced feature 27 - undo granularity for multi-step edits.
 *
 * Typing in the inspector, nudging or resizing fires `saveAndSync` on every
 * keystroke, which used to fill the history with one-frame steps. A tag plus a
 * coalesce window turns a burst of the same kind of edit into a single undo
 * step: the newest delta replaces the command at the top of the stack until the
 * burst ends.
 */

export const COALESCE_MS = 450;

/**
 * Save one snapshot, replacing the previous one when it carries the same tag and
 * was written inside `coalesce` milliseconds.
 * Returns { coalesced, tag }.
 */
export function saveStateTagged(stateManager, tag = null, { coalesce = COALESCE_MS } = {}) {
    if (!stateManager) return { coalesced: false, tag };

    const last = stateManager.lastSave;
    const now = Date.now();

    if (tag && last && last.tag === tag && now - last.at < coalesce && stateManager.historyIndex >= 0) {
        if (typeof stateManager.replaceTop === 'function') stateManager.replaceTop();
        stateManager.lastSave = { tag, at: now };
        return { coalesced: true, tag };
    }

    stateManager.saveState(tag);
    return { coalesced: false, tag };
}

/** Number of undo steps, for the debug handle. */
export function historyDepth(stateManager) {
    return stateManager?.history?.length || 0;
}
