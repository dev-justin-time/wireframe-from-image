/**
 * Studio feature 42 - persistent named projects.
 *
 * Autosave keys by name only (`floorplan3d_autosave`), so there was no way to
 * keep more than one scheme. Named projects get an id, an index with metadata
 * (name, item/wall counts, updatedAt, optional thumbnail) and their own storage
 * key. The index is the browser list; payloads keep the schema version written
 * by the caller.
 */

const INDEX_KEY = 'floorplan3d_projects_index';
const PROJECT_PREFIX = 'floorplan3d_project_';

const memory = new Map();

function storageOf(storage) {
    if (storage) return storage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return {
        getItem: (key) => (memory.has(key) ? memory.get(key) : null),
        setItem: (key, value) => memory.set(key, String(value)),
        removeItem: (key) => memory.delete(key)
    };
}

const slug = (text) => String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'project';

export function projectIdFor(name) {
    return `${slug(name)}-${Date.now().toString(36)}`;
}

export function listProjects({ storage } = {}) {
    const store = storageOf(storage);
    try {
        const parsed = JSON.parse(store.getItem(INDEX_KEY) || '[]');
        return Array.isArray(parsed)
            ? parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            : [];
    } catch {
        return [];
    }
}

function writeIndex(entries, store) {
    store.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function saveNamedProject(name, payload, { storage, thumbnail = null, id = null } = {}) {
    const store = storageOf(storage);
    const entries = listProjects({ storage: store });
    const existing = id
        ? entries.find((entry) => entry.id === id)
        : entries.find((entry) => entry.name === name);
    const projectId = existing?.id || id || projectIdFor(name);

    const project = {
        id: projectId,
        name,
        updatedAt: Date.now(),
        walls: payload.walls?.length || 0,
        fixtures: payload.fixtures?.length || 0,
        stories: payload.stories?.length || 1,
        thumbnail: thumbnail || existing?.thumbnail || null
    };

    store.setItem(`${PROJECT_PREFIX}${projectId}`, JSON.stringify(payload));

    const next = existing
        ? entries.map((entry) => (entry.id === projectId ? project : entry))
        : [...entries, project];
    writeIndex(next, store);

    return project;
}

export function loadNamedProject(id, { storage } = {}) {
    const store = storageOf(storage);
    const raw = store.getItem(`${PROJECT_PREFIX}${id}`);
    if (!raw) return null;
    try {
        return { project: JSON.parse(raw), meta: listProjects({ storage: store }).find((entry) => entry.id === id) || null };
    } catch {
        return null;
    }
}

export function deleteNamedProject(id, { storage } = {}) {
    const store = storageOf(storage);
    store.removeItem(`${PROJECT_PREFIX}${id}`);
    const entries = listProjects({ storage: store }).filter((entry) => entry.id !== id);
    writeIndex(entries, store);
    return entries;
}

export function renameNamedProject(id, name, { storage } = {}) {
    const store = storageOf(storage);
    const entries = listProjects({ storage: store }).map((entry) => (
        entry.id === id ? { ...entry, name, updatedAt: Date.now() } : entry
    ));
    writeIndex(entries, store);
    return entries.find((entry) => entry.id === id) || null;
}

/** Import the existing autosave into a named project. */
export function promoteAutosave(name, { storage } = {}) {
    const store = storageOf(storage);
    const raw = store.getItem('floorplan3d_autosave');
    if (!raw) return null;
    return saveNamedProject(name, JSON.parse(raw), { storage: store });
}

export function projectStats() {
    const entries = listProjects();
    return {
        count: entries.length,
        items: entries.reduce((total, entry) => total + (entry.fixtures || 0), 0),
        latest: entries[0] || null
    };
}
