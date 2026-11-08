/**
 * Advanced feature 29 - autosave throttling and dirty-only writes.
 *
 * The editor called StorageManager.saveProject on every mutation, including
 * every pointer-move driven save. This wrapper debounces the write, skips it
 * when the serialized project is identical to the last one written, and can be
 * flushed synchronously when the page is about to close.
 */

export const AUTOSAVE_DELAY = 600;

const defaultSignature = (data) => {
    try {
        return JSON.stringify(data);
    } catch {
        return String(Math.random());
    }
};

export function createAutosave({ save, delay = AUTOSAVE_DELAY, signature = defaultSignature } = {}) {
    if (typeof save !== 'function') throw new Error('autosave needs a save function');

    let timer = null;
    let pending = null;
    let last = null;
    let writes = 0;
    let skips = 0;

    const write = () => {
        if (pending == null) return;
        last = signature(pending);
        const payload = pending;
        pending = null;
        writes += 1;
        save(payload);
    };

    return {
        schedule(data) {
            const signatureNow = signature(data);
            if (signatureNow === last && !timer) {
                skips += 1;
                return { skipped: true };
            }

            pending = data;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => { timer = null; write(); }, delay);
            return { skipped: false, scheduled: true };
        },
        flush() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            write();
        },
        dispose() {
            if (timer) clearTimeout(timer);
            timer = null;
            pending = null;
        },
        get dirty() {
            return Boolean(timer) || pending != null;
        },
        get stats() {
            return { writes, skips, last };
        }
    };
}
