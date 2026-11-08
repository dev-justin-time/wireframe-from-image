/**
 * Undo history as commands over the project document.
 *
 * The old implementation deep-copied every storey, wall, fixture and style on
 * every save. A command now stores only the fields that actually changed, with
 * a reverse patch for undo, so a hundred-step history costs a fraction of a
 * hundred full snapshots and the GC has no large cloning spike per keystroke.
 *
 * A command is `{ before, after, tag, at }`:
 *   before  patch that turns the current document back into its previous state
 *   after   patch that applies the edit again
 *
 * Patches are keyed collections (walls and fixtures by id) rather than whole
 * arrays, so moving one cabinet does not rewrite every other cabinet.
 */

const sameValue = (a, b) => {
    if (a === b) return true;
    if (a == null || b == null) return a == null && b == null;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
};

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

function itemIdOf(item, index) {
    return item?.id != null ? String(item.id) : `@${index}`;
}

function diffCollection(previous = [], next = []) {
    const previousMap = new Map(previous.map((item, index) => [itemIdOf(item, index), item]));
    const nextMap = new Map(next.map((item, index) => [itemIdOf(item, index), item]));

    const forward = { set: [], remove: [] };
    const backward = { set: [], remove: [] };

    nextMap.forEach((item, id) => {
        const before = previousMap.get(id);
        if (before === undefined) {
            forward.set.push(item);
            backward.remove.push(id);
            return;
        }
        if (!sameValue(before, item)) {
            forward.set.push(item);
            backward.set.push(before);
        }
    });

    previousMap.forEach((item, id) => {
        if (nextMap.has(id)) return;
        forward.remove.push(id);
        backward.set.push(item);
    });

    const previousOrder = previous.map((item, index) => itemIdOf(item, index));
    const nextOrder = next.map((item, index) => itemIdOf(item, index));
    if (previousOrder.length !== nextOrder.length
        || previousOrder.some((id, index) => id !== nextOrder[index])) {
        forward.order = nextOrder;
        backward.order = previousOrder;
    }

    const changed = forward.set.length > 0
        || forward.remove.length > 0
        || Boolean(forward.order) !== Boolean(backward.order);
    return changed ? { forward, backward } : null;
}

function diffMap(previous = {}, next = {}) {
    const forward = { set: {}, remove: [] };
    const backward = { set: {}, remove: [] };
    let changed = false;

    Object.keys(next).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(previous, key)) {
            forward.set[key] = next[key];
            backward.remove.push(key);
            changed = true;
            return;
        }
        if (!sameValue(previous[key], next[key])) {
            forward.set[key] = next[key];
            backward.set[key] = previous[key];
            changed = true;
        }
    });

    Object.keys(previous).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(next, key)) return;
        forward.remove.push(key);
        backward.set[key] = previous[key];
        changed = true;
    });

    return changed ? { forward, backward } : null;
}

function diffStories(previous = [], next = []) {
    const previousMap = new Map(previous.map((story, index) => [story.id ?? `@${index}`, story]));
    const nextMap = new Map(next.map((story, index) => [story.id ?? `@${index}`, story]));

    const forward = { added: {}, removed: [], changed: {} };
    const backward = { added: {}, removed: [], changed: {} };
    let changed = false;

    nextMap.forEach((story, id) => {
        const before = previousMap.get(id);
        if (!before) {
            forward.added[id] = story;
            backward.removed.push(id);
            changed = true;
            return;
        }

        const entryForward = {};
        const entryBackward = {};

        ['name', 'wallHeight', 'floorDepth', 'height', 'visible'].forEach((key) => {
            if (sameValue(before[key], story[key])) return;
            entryForward[key] = story[key];
            entryBackward[key] = before[key];
            changed = true;
        });

        const walls = diffCollection(before.walls || [], story.walls || []);
        if (walls) {
            entryForward.walls = walls.forward;
            entryBackward.walls = walls.backward;
            changed = true;
        }

        const fixtures = diffCollection(before.fixtures || [], story.fixtures || []);
        if (fixtures) {
            entryForward.fixtures = fixtures.forward;
            entryBackward.fixtures = fixtures.backward;
            changed = true;
        }

        // Floor openings are usually a handful of polygons; replacing the
        // array is smaller and simpler than diffing their vertices.
        if (!sameValue(before.openings || [], story.openings || [])) {
            entryForward.openings = story.openings || [];
            entryBackward.openings = before.openings || [];
            changed = true;
        }

        if (Object.keys(entryForward).length) forward.changed[id] = entryForward;
        if (Object.keys(entryBackward).length) backward.changed[id] = entryBackward;
    });

    previousMap.forEach((story, id) => {
        if (nextMap.has(id)) return;
        forward.removed.push(id);
        backward.added[id] = story;
        changed = true;
    });

    const previousOrder = previous.map((story, index) => story.id ?? `@${index}`);
    const nextOrder = next.map((story, index) => story.id ?? `@${index}`);
    if (previousOrder.length !== nextOrder.length
        || previousOrder.some((id, index) => id !== nextOrder[index])) {
        forward.order = nextOrder;
        backward.order = previousOrder;
        changed = true;
    }

    return changed ? { forward, backward } : null;
}

/** Build the forward and reverse patch between two full document snapshots. */
function diffSnapshots(previous, next) {
    const forward = {};
    const backward = {};

    ['currentStoryIndex', 'showRoof', 'showCeiling', 'gridSize'].forEach((key) => {
        if (sameValue(previous[key], next[key])) return;
        forward[key] = next[key];
        backward[key] = previous[key];
    });

    const stories = diffStories(previous.stories || [], next.stories || []);
    if (stories) {
        forward.stories = stories.forward;
        backward.stories = stories.backward;
    }

    const styles = diffMap(previous.fixtureStyles || {}, next.fixtureStyles || {});
    if (styles) {
        forward.fixtureStyles = styles.forward;
        backward.fixtureStyles = styles.backward;
    }

    const rooms = diffMap(previous.roomMaterials || {}, next.roomMaterials || {});
    if (rooms) {
        forward.roomMaterials = rooms.forward;
        backward.roomMaterials = rooms.backward;
    }

    return Object.keys(forward).length ? { forward, backward } : null;
}

function applyCollection(items = [], patch) {
    const byId = new Map(items.map((item, index) => [itemIdOf(item, index), item]));
    (patch.remove || []).forEach((id) => byId.delete(String(id)));
    (patch.set || []).forEach((item, index) => {
        byId.set(itemIdOf(item, index), item);
    });

    if (patch.order) {
        return patch.order
            .map((id) => byId.get(String(id)))
            .filter(Boolean);
    }
    return [...byId.values()];
}

function applyMap(current = {}, patch) {
    const next = { ...current };
    (patch.remove || []).forEach((key) => { delete next[key]; });
    Object.assign(next, patch.set || {});
    return next;
}

function applyPatch(snapshot, patch) {
    if (!snapshot || !patch) return snapshot;

    ['currentStoryIndex', 'showRoof', 'showCeiling', 'gridSize'].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) snapshot[key] = patch[key];
    });

    if (patch.fixtureStyles) {
        snapshot.fixtureStyles = applyMap(snapshot.fixtureStyles || {}, patch.fixtureStyles);
    }
    if (patch.roomMaterials) {
        snapshot.roomMaterials = applyMap(snapshot.roomMaterials || {}, patch.roomMaterials);
    }

    if (patch.stories && Array.isArray(snapshot.stories)) {
        const byId = new Map(snapshot.stories.map((story, index) => [story.id ?? `@${index}`, story]));

        (patch.stories.removed || []).forEach((id) => byId.delete(String(id)));

        Object.entries(patch.stories.added || {}).forEach(([id, story]) => {
            byId.set(id, story);
        });

        Object.entries(patch.stories.changed || {}).forEach(([id, entry]) => {
            const story = byId.get(id);
            if (!story) return;

            ['name', 'wallHeight', 'floorDepth', 'height', 'visible'].forEach((key) => {
                if (Object.prototype.hasOwnProperty.call(entry, key)) story[key] = entry[key];
            });
            if (entry.walls) story.walls = applyCollection(story.walls || [], entry.walls);
            if (entry.fixtures) story.fixtures = applyCollection(story.fixtures || [], entry.fixtures);
            if (entry.openings) story.openings = entry.openings;
        });

        snapshot.stories = patch.stories.order
            ? patch.stories.order.map((id) => byId.get(String(id))).filter(Boolean)
            : [...byId.values()];
    }

    return snapshot;
}

export class StateManager {
    constructor(appState, onRestore) {
        this.appState = appState;
        this.onRestore = onRestore;
        // history[0] is the initial state marker; each later entry is the
        // command that produced that state from the one before it.
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 100;
        this.isExecuting = false;
        this.committed = null;
        // Full document before the command at historyIndex, kept only while a
        // tagged burst is open so replaceTop can rewrite that one command.
        this.coalesceBase = null;
        // Metadata of the last write, used by tagged coalescing (feature 27).
        this.lastSave = { tag: null, at: 0 };
    }

    /**
     * A plain copy of everything undo has to restore. This is the one full
     * document the history keeps; each command beside it is a small patch.
     */
    buildSnapshot() {
        const app = this.appState || {};
        const rawStories = Array.isArray(app.stories) && app.stories.length
            ? app.stories
            : [{
                id: 'storey_ground',
                name: 'Ground floor',
                walls: app.walls || [],
                fixtures: app.fixtures || [],
                openings: []
            }];

        return {
            stories: rawStories.map((story, index) => ({
                id: story.id ?? `storey_${index + 1}`,
                name: story.name ?? `Floor ${index + 1}`,
                wallHeight: story.wallHeight,
                floorDepth: story.floorDepth,
                height: story.height,
                visible: story.visible !== false,
                walls: (story.walls || []).map((wall) => (wall?.toJSON ? wall.toJSON() : clone(wall))),
                fixtures: (story.fixtures || []).map((fixture) => (fixture?.toJSON ? fixture.toJSON() : clone(fixture))),
                openings: (story.openings || []).map((opening) => ({
                    id: opening.id,
                    points: (opening.points || []).map((point) => ({ x: point.x, y: point.y }))
                }))
            })),
            currentStoryIndex: app.currentStoryIndex || 0,
            fixtureStyles: clone(app.fixtureStyles || {}),
            roomMaterials: clone(app.roomMaterials || {}),
            showRoof: app.showRoof || false,
            showCeiling: app.showCeiling || false,
            // Undo should not silently change the grid size.
            gridSize: app.gridSize || 30
        };
    }

    saveState(tag = null) {
        // Don't save if we are in the middle of a restore
        if (this.isExecuting) return;

        const snapshot = this.buildSnapshot();

        if (this.history.length === 0) {
            this.committed = snapshot;
            this.history = [{ initial: true }];
            this.historyIndex = 0;
            this.coalesceBase = null;
            this.lastSave = { tag, at: Date.now() };
            return;
        }

        const patch = diffSnapshots(this.committed, snapshot);
        if (!patch) {
            // Nothing changed: keep the document current but do not create a
            // no-op undo step the user has to press twice.
            this.committed = snapshot;
            this.lastSave = { tag, at: Date.now() };
            return;
        }

        // If we undid some actions, remove the future commands.
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const base = this.committed;
        this.history.push({
            before: patch.backward,
            after: patch.forward,
            tag,
            at: Date.now()
        });
        this.historyIndex++;
        this.committed = snapshot;
        this.coalesceBase = base;
        this.lastSave = { tag, at: Date.now() };

        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Replace the command at the top of the stack with the current document.
     * `coalesceBase` is the state before that command began, so the replacement
     * keeps a single undo step for a burst of typing.
     */
    replaceTop() {
        if (this.historyIndex <= 0 || !this.coalesceBase) return;

        const snapshot = this.buildSnapshot();
        const patch = diffSnapshots(this.coalesceBase, snapshot);
        if (!patch) return;

        this.history[this.historyIndex] = {
            ...this.history[this.historyIndex],
            before: patch.backward,
            after: patch.forward,
            at: Date.now()
        };
        this.committed = snapshot;
    }

    undo() {
        if (this.historyIndex > 0) {
            const command = this.history[this.historyIndex];
            if (!command?.before) return;
            this.committed = applyPatch(this.committed || this.buildSnapshot(), command.before);
            this.historyIndex--;
            this.coalesceBase = null;
            this.lastSave = { tag: null, at: 0 };
            this.restore(this.committed);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            const command = this.history[this.historyIndex + 1];
            if (!command?.after) return;
            this.committed = applyPatch(this.committed || this.buildSnapshot(), command.after);
            this.historyIndex++;
            this.coalesceBase = null;
            this.lastSave = { tag: null, at: 0 };
            this.restore(this.committed);
        }
    }

    restore(snapshot) {
        this.isExecuting = true;
        try {
            if (this.onRestore) this.onRestore(snapshot);
        } finally {
            // A restore that throws must not leave every later save blocked.
            this.isExecuting = false;
        }
    }

    /** Debug view of the command stack without exposing the whole document. */
    get historyStats() {
        return {
            index: this.historyIndex,
            depth: this.history.length,
            commands: this.history.filter((entry) => entry && !entry.initial).length
        };
    }
}
