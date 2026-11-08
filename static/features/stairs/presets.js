import { getStairModel } from './models.js';

/**
 * Saved stair presets.
 *
 * A preset is the stair config of a placed stair (model family, system, code,
 * width, run, landings, support, pinned risers/going …) stored in
 * localStorage and listed in the item palette as "My stairs". Clicking one arms
 * the stair tool with that config, so the next plan click places it.
 *
 * Only the fields the design engine reads are kept, values are type-checked and
 * the list is capped, so a malformed or stale entry cannot break the editor.
 */

export const STAIR_PRESET_KEY = 'stair-presets';
export const STAIR_PRESET_LIMIT = 24;

// Everything `computeStairDesign` / `buildStairAssembly` read from item.stair.
const CONFIG_KEYS = [
    'model', 'system', 'type', 'code',
    'width', 'availableRun', 'availableWidth', 'turnDegrees',
    'risers', 'treadDepth', 'columnRadius',
    'poleDiameter', 'poleOpening', 'poleMat',
    'guard', 'mat', 'structure', 'support', 'material',
    'openRisers', 'guardHeight', 'nosing', 'nosingEnabled', 'landings'
];

const storageFor = (storage) => (storage && typeof storage.getItem === 'function' ? storage : null);

function sanitiseConfig(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const config = {};
    CONFIG_KEYS.forEach((key) => {
        const value = input[key];
        if (value === undefined || value === null) return;
        if (typeof value === 'number') {
            if (Number.isFinite(value)) config[key] = value;
        } else if (typeof value === 'boolean') {
            config[key] = value;
        } else if (typeof value === 'string') {
            config[key] = value.slice(0, 40);
        } else if (typeof value === 'object') {
            try {
                config[key] = JSON.parse(JSON.stringify(value));
            } catch {
                // Skip anything that will not round-trip.
            }
        }
    });
    return Object.keys(config).length ? config : null;
}

const signatureFor = (config) => JSON.stringify(
    Object.keys(config).sort().reduce((sorted, key) => {
        sorted[key] = config[key];
        return sorted;
    }, {})
);

function readRaw(storage) {
    const store = storageFor(storage);
    if (!store) return [];
    try {
        const raw = JSON.parse(store.getItem(STAIR_PRESET_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw;
    } catch {
        return [];
    }
}

function writeRaw(presets, storage) {
    const store = storageFor(storage);
    if (!store) return false;
    try {
        store.setItem(STAIR_PRESET_KEY, JSON.stringify(presets));
        return true;
    } catch {
        return false;
    }
}

/** Saved presets, newest first, with malformed entries dropped. */
export function loadStairPresets(storage = globalThis.localStorage) {
    return readRaw(storage)
        .filter((preset) => preset && typeof preset.id === 'string' && preset.stair)
        .map((preset) => {
            const stair = sanitiseConfig(preset.stair);
            if (!stair) return null;
            return {
                id: preset.id,
                name: String(preset.name || presetNameFor(stair)).slice(0, 60),
                itemType: typeof preset.itemType === 'string' ? preset.itemType : 'stair',
                label: preset.label ? String(preset.label).slice(0, 40) : null,
                color: preset.color ? String(preset.color).slice(0, 20) : null,
                stair,
                signature: signatureFor(stair),
                createdAt: typeof preset.createdAt === 'string' ? preset.createdAt : null
            };
        })
        .filter(Boolean)
        .slice(0, STAIR_PRESET_LIMIT);
}

export function getStairPreset(id, storage = globalThis.localStorage) {
    return loadStairPresets(storage).find((preset) => preset.id === id) || null;
}

/**
 * Save (or rename) a preset. Saving a config that is already stored updates
 * that entry instead of adding a duplicate.
 */
export function saveStairPreset({ name, stair, itemType = 'stair', label = null, color = null } = {}, storage = globalThis.localStorage) {
    const config = sanitiseConfig(stair);
    if (!config) return null;
    const presets = loadStairPresets(storage);
    const signature = signatureFor(config);
    const existing = presets.find((preset) => preset.signature === signature);
    const preset = {
        id: existing?.id || `stair-preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: String(name || '').trim().slice(0, 60) || presetNameFor(config),
        itemType: typeof itemType === 'string' ? itemType : 'stair',
        label: label ? String(label).slice(0, 40) : null,
        color: typeof color === 'string' ? color.slice(0, 20) : null,
        stair: config,
        signature,
        createdAt: new Date().toISOString()
    };
    const next = [preset, ...presets.filter((entry) => entry.id !== preset.id)].slice(0, STAIR_PRESET_LIMIT);
    writeRaw(next, storage);
    return preset;
}

export function removeStairPreset(id, storage = globalThis.localStorage) {
    const presets = loadStairPresets(storage);
    const next = presets.filter((preset) => preset.id !== id);
    if (next.length === presets.length) return false;
    writeRaw(next, storage);
    return true;
}

export function clearStairPresets(storage = globalThis.localStorage) {
    const store = storageFor(storage);
    if (!store) return false;
    try {
        store.removeItem(STAIR_PRESET_KEY);
        return true;
    } catch {
        return false;
    }
}

/** Best default name for a stair config. */
export function presetNameFor(stair = {}) {
    const model = stair.model ? getStairModel(stair.model) : null;
    if (model) return model.label;
    if (stair.system) {
        const label = String(stair.system);
        return `${label.charAt(0).toUpperCase()}${label.slice(1)} stair`;
    }
    if (stair.type === 'fire-pole') return 'Fire pole';
    if (stair.type === 'spiral') return 'Spiral stair';
    if (stair.type === 'curve-right' || stair.type === 'curve-left') return 'Turned stair';
    return 'Straight stair';
}

/** One-line spec for the palette tooltip. */
export function presetSummary(preset) {
    const config = preset?.stair || {};
    const parts = [];
    if (config.risers) parts.push(`${config.risers} risers`);
    if (config.width) parts.push(`${Math.round(config.width * 1000)} mm wide`);
    if (config.code) parts.push(config.code);
    if (config.model) {
        const model = getStairModel(config.model);
        if (model) parts.push(model.category);
    }
    return parts.join(' · ') || 'Stair preset';
}
