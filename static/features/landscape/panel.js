import {
    computeWaterFeature,
    isWaterFeature,
    waterConfigForItem,
    waterDesignForItem,
    waterSummary,
    WATER_FEATURE_TYPES,
    WATER_FEATURE_LABELS,
    POOL_SHAPES,
    POOL_SHAPE_LABELS
} from './design.js';

/**
 * Landscape panel controller: the pool / water-feature option bar. Same pattern
 * as the stair panel — a context object in, DOM ids out.
 */

const escape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function optionList(entries, value) {
    return entries.map(([key, label]) => {
        const selected = String(key) === String(value) ? 'selected' : '';
        return `<option value="${escape(key)}" ${selected}>${escape(label)}</option>`;
    }).join('');
}

export function createLandscapePanel(context = {}) {
    const {
        getState = () => ({}),
        planCenter = () => ({ x: 0, y: 0 }),
        save = () => {},
        createItem = () => null
    } = context;

    const state = () => getState();
    const selectedFeature = () => {
        const fixture = state().selectedFixture;
        return isWaterFeature(fixture) ? fixture : null;
    };
    const config = () => {
        const item = selectedFeature();
        return item ? waterConfigForItem(item) : { ...(state().landscapeDraft || {}) };
    };
    const design = () => computeWaterFeature(config());

    function refresh() {
        const node = document.getElementById('landscape-controls');
        const summaryNode = document.getElementById('landscape-summary');
        if (!node || !summaryNode) return null;

        const item = selectedFeature();
        const current = config();
        const resolved = design();
        const m = (value) => Number(value || 0).toFixed(2);

        node.innerHTML = `
            <label class="block text-[10px] uppercase text-gray-400">Feature
                <select onchange="window.setLandscapeField('type', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] text-gray-800 dark:text-gray-100">
                    ${optionList(WATER_FEATURE_TYPES.map((key) => [key, WATER_FEATURE_LABELS[key]]), resolved.type)}
                </select>
            </label>
            <label class="block text-[10px] uppercase text-gray-400">Shape
                <select onchange="window.setLandscapeField('shape', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] text-gray-800 dark:text-gray-100">
                    ${optionList(POOL_SHAPES.map((key) => [key, POOL_SHAPE_LABELS[key]]), resolved.shape)}
                </select>
            </label>
            <div class="grid grid-cols-2 gap-1">
                <label class="block text-[10px] uppercase text-gray-400">Width (m)
                    <input type="number" min="0.6" max="50" step="0.1" value="${m(resolved.width)}" onchange="window.setLandscapeField('width', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">
                </label>
                <label class="block text-[10px] uppercase text-gray-400">Length (m)
                    <input type="number" min="0.6" max="60" step="0.1" value="${m(resolved.length)}" onchange="window.setLandscapeField('length', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">
                </label>
                <label class="block text-[10px] uppercase text-gray-400">Shallow (m)
                    <input type="number" min="0.15" max="4" step="0.05" value="${m(resolved.shallow)}" onchange="window.setLandscapeField('shallow', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">
                </label>
                <label class="block text-[10px] uppercase text-gray-400">Deep (m)
                    <input type="number" min="0.15" max="5" step="0.05" value="${m(resolved.deep)}" onchange="window.setLandscapeField('deep', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">
                </label>
                <label class="block text-[10px] uppercase text-gray-400">Deck (m)
                    <input type="number" min="0" max="4" step="0.05" value="${m(resolved.deck)}" onchange="window.setLandscapeField('deck', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">
                </label>
                <label class="block text-[10px] uppercase text-gray-400">Turnover (h)
                    <input type="number" min="0.25" max="24" step="0.25" value="${m(resolved.turnoverHours)}" onchange="window.setLandscapeField('turnoverHours', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">
                </label>
            </div>
            <label class="flex items-center gap-1 text-[10px] text-gray-500 pt-1"><input type="checkbox" ${resolved.barrier.required ? 'checked' : ''} onchange="window.setLandscapeField('barrier', this.checked)"> 48 in barrier and self-closing gate</label>
            <p class="text-[10px] text-gray-400">${item ? 'Editing ' + escape(item.metadata?.label || item.type) : 'Defaults for the next feature'}</p>
        `;

        summaryNode.innerHTML = waterSummary(resolved).map((line) => {
            const tone = line.startsWith('✖') ? 'text-red-500' : line.startsWith('⚠') ? 'text-amber-600' : '';
            return `<p class="${tone}">${escape(line)}</p>`;
        }).join('');
        return resolved;
    }

    function applyField(key, value) {
        const item = selectedFeature();
        const target = item
            ? (item.landscape = { ...waterConfigForItem(item) })
            : (state().landscapeDraft = { ...(state().landscapeDraft || {}) });
        const numeric = ['width', 'length', 'shallow', 'deep', 'deck', 'turnoverHours', 'suctionOutlets', 'waterTempF', 'weirLength', 'drop', 'jets'];
        if (key === 'barrier') target.barrier = Boolean(value);
        else if (numeric.includes(key)) target[key] = Number(value);
        else target[key] = value;

        if (item) {
            const resolved = waterDesignForItem(item);
            item.size = {
                width: resolved.footprint.width,
                depth: resolved.footprint.depth,
                height: Math.max(0.2, resolved.deep + (resolved.type === 'water-wall' ? resolved.drop : 0))
            };
            save();
        }
        return refresh();
    }

    function add() {
        const draft = { ...(state().landscapeDraft || {}) };
        const center = planCenter();
        const type = draft.type === 'water-wall' ? 'water_wall' : draft.type;
        const item = createItem(type, center.x, center.y, 0);
        if (!item) return null;
        item.landscape = { ...(item.landscape || {}), ...draft };
        const resolved = waterDesignForItem(item);
        item.size = {
            width: resolved.footprint.width,
            depth: resolved.footprint.depth,
            height: Math.max(0.2, resolved.deep + (resolved.type === 'water-wall' ? resolved.drop : 0))
        };
        state().fixtures.push(item);
        state().selectedFixture = item;
        state().selectedWallId = null;
        save();
        refresh();
        return item;
    }

    return {
        refresh,
        applyField,
        add,
        design,
        config,
        get selected() { return selectedFeature(); }
    };
}
