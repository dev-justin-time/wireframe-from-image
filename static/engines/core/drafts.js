/**
 * The one contract for the `*-editor-draft` hand-off keys.
 *
 * Each designer writes a draft and the studio consumes it once on load. Before
 * this module the nine keys were bare JSON with no version and a silent
 * `try/no-op` around every read, so a malformed or stale draft disappeared with
 * no trace and a future payload change had no way to say so.
 *
 * Now every write is `{ version, savedAt, data }` and every read goes through
 * one function that:
 *
 * - accepts an old unwrapped payload as version 0, so drafts already on a
 *   user's disk still import;
 * - refuses a payload from a newer build instead of half-applying it;
 * - drops malformed JSON, removes the key, and reports the reason through
 *   `window.reportClientError(..., { kind: 'draft', fatal: false })`, which puts
 *   it in the support log without showing the error banner;
 * - can leave the key in place (`consume: false`) for the two keys the bid
 *   builder also reads.
 *
 * The module is pure apart from `localStorage`, which is injectable, so the gate
 * can pin every branch in Node.
 */

/** Bump when a payload changes shape in a way an old reader cannot apply. */
export const DRAFT_VERSION = 1;

/** Every editor hand-off key in the tree: the list the gate and the docs use. */
export const EDITOR_DRAFT_KEYS = [
    'floorplan-editor-draft',
    'wall-editor-draft',
    'kitchen-editor-draft',
    'lighting-editor-draft',
    'landscape-editor-draft',
    'electrical-editor-draft',
    'deck-editor-draft',
    'roof-editor-draft',
    'framing-editor-draft'
];

function resolveStorage(storage) {
    if (storage) return storage;
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        // A sandboxed frame can throw on the property itself.
        return null;
    }
}

function report(key, reason) {
    const message = `Draft "${key}" was dropped: ${reason}.`;
    if (typeof window !== 'undefined' && typeof window.reportClientError === 'function') {
        try {
            window.reportClientError(message, { kind: 'draft', fatal: false, source: 'core/drafts.js' });
            return;
        } catch {
            // Fall through to the console: reporting must never break a read.
        }
    }
    console.warn('[drafts]', message);
}

/**
 * Save a draft. Returns false (and reports) when storage is unavailable or
 * full, so a caller can show its own message instead of guessing from a throw.
 */
export function writeDraft(key, data, { storage } = {}) {
    const target = resolveStorage(storage);
    if (!target) {
        report(key, 'browser storage is unavailable');
        return false;
    }
    const payload = { version: DRAFT_VERSION, savedAt: new Date().toISOString(), data };
    try {
        target.setItem(key, JSON.stringify(payload));
        return true;
    } catch (error) {
        report(key, `it could not be saved (${error?.message || 'storage is full'})`);
        return false;
    }
}

/**
 * Read a draft once.
 *
 * Returns `null` when there is nothing stored, otherwise
 * `{ data, version, legacy, issue }`. `issue` is `'unparsable'` or `'version'`
 * when the payload was dropped; in both cases `data` is null and the key has
 * already been removed.
 */
export function readDraft(key, { storage, consume = true } = {}) {
    const target = resolveStorage(storage);
    if (!target) return null;

    let raw = null;
    try {
        raw = target.getItem(key);
    } catch {
        return null;
    }
    if (raw == null) return null;

    if (consume) {
        try {
            target.removeItem(key);
        } catch {
            // Best effort: a draft that cannot be removed must still be readable.
        }
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        report(key, 'it is not valid JSON');
        return { data: null, version: null, legacy: false, issue: 'unparsable' };
    }

    if (parsed && typeof parsed === 'object' && Number.isInteger(parsed.version)) {
        if (parsed.version > DRAFT_VERSION) {
            report(key, `it was written by a newer build (v${parsed.version})`);
            return { data: null, version: parsed.version, legacy: false, issue: 'version' };
        }
        return { data: parsed.data ?? null, version: parsed.version, legacy: false, issue: null };
    }

    // A draft written before this module existed: the object is the payload.
    return { data: parsed, version: 0, legacy: true, issue: null };
}

/** Remove a draft without reading it. Returns whether the key is gone. */
export function clearDraft(key, { storage } = {}) {
    const target = resolveStorage(storage);
    if (!target) return false;
    try {
        target.removeItem(key);
        return true;
    } catch {
        return false;
    }
}
