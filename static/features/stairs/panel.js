import { WALL_HEIGHT } from '../../core/world-space.js';
import { STAIR_TYPE_LABELS, STAIR_CODES, stairDesignForItem, stairLocalToPlanPoint, computeStairDesign, isStairItem } from './design.js';
import { modelsByCategory, applyModelToConfig, computeStairModel, stairModelSummary, modelTakeoffCsv } from './models.js';
import { OUTDOOR_SYSTEMS, outdoorStairConfig, computeOutdoorStair, outdoorSummary, outdoorBomCsv } from './outdoor.js';
import { buildStairAssembly, assemblySummary } from './assembly.js';
import { createStairWalker } from './walk.js';
import { sizeStairItem } from './geometry.js';

/**
 * Stair suite panel controller.
 *
 * The editor owns the DOM, the item list and the 3D camera; this controller owns
 * the option bar, the takeoff export and the first-person walk. It is created
 * once with a small context object, so the panel logic lives with the stair kit
 * instead of growing editor.js.
 */

const STAIR_TYPE_BY_SYSTEM = {
    deck: 'stair_deck',
    porch: 'stair_porch',
    egress: 'stair_egress',
    apartment: 'stair_apartment',
    concrete: 'stair_concrete'
};

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

export function createStairPanel(context = {}) {
    const {
        getState = () => ({}),
        getStoreyHeight = () => WALL_HEIGHT,
        getView = () => ({ width: 1, height: 1 }),
        getCamera = () => null,
        getRenderer = () => null,
        getControls = () => null,
        getRenderLoop = () => null,
        planCenter = () => ({ x: 0, y: 0 }),
        save = () => {},
        setViewMode = () => {},
        createItem = () => null
    } = context;

    let walker = null;

    const state = () => getState();
    const selectedStair = () => {
        const fixture = state().selectedFixture;
        return isStairItem(fixture) ? fixture : null;
    };
    const config = () => ({ ...(selectedStair()?.stair || state().stairDraft || {}), storeyHeight: getStoreyHeight() });
    const design = () => {
        const current = config();
        if (current.system) return computeOutdoorStair(current);
        if (current.model) return computeStairModel(current.model, current);
        return computeStairDesign(current);
    };
    const assembly = () => buildStairAssembly({ ...config(), design: design(), baseElevation: 0 });

    function refresh() {
        const node = document.getElementById('stair-controls');
        const summaryNode = document.getElementById('stair-summary');
        if (!node || !summaryNode) return null;

        const item = selectedStair();
        const current = item?.stair || state().stairDraft || {};
        const built = assembly();
        const resolved = built.design;
        const cm = (metres) => Math.round((Number(metres) || 0) * 100);
        const topOn = current.landings?.top?.enabled !== false;
        const bottomOn = current.landings?.bottom?.enabled !== false;
        const systemOptions = [['', 'Interior / none'], ...OUTDOOR_SYSTEMS.map((system) => [system.key, system.label])];
        const modelOptions = [
            '<option value="">Custom run</option>',
            ...modelsByCategory().map((group) => `<optgroup label="${escape(group.category)}">${group.models.map((model) => {
                const selected = model.key === current.model ? 'selected' : '';
                return `<option value="${escape(model.key)}" ${selected}>${escape(model.label)}</option>`;
            }).join('')}</optgroup>`)
        ].join('');

        node.innerHTML = `
            <label class="block text-[10px] uppercase text-gray-400">Model
                <select onchange="window.setStairField('model', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] text-gray-800 dark:text-gray-100">
                    ${modelOptions}
                </select>
            </label>
            <label class="block text-[10px] uppercase text-gray-400">System
                <select onchange="window.setStairField('system', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] text-gray-800 dark:text-gray-100">
                    ${optionList(systemOptions, current.system || '')}
                </select>
            </label>
            <label class="block text-[10px] uppercase text-gray-400">Run type
                <select onchange="window.setStairField('type', this.value)" ${current.model ? 'disabled title="The model family sets the run type"' : ''} class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] text-gray-800 dark:text-gray-100 disabled:opacity-50">
                    ${optionList(Object.entries(STAIR_TYPE_LABELS), resolved.type)}
                </select>
            </label>
            <label class="block text-[10px] uppercase text-gray-400">Code
                <select onchange="window.setStairField('code', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] text-gray-800 dark:text-gray-100">
                    ${optionList(Object.entries(STAIR_CODES).map(([key, entry]) => [key, entry.label]), current.code || 'IRC2021')}
                </select>
            </label>
            <div class="grid grid-cols-2 gap-1">
                <label class="block text-[10px] uppercase text-gray-400">Width (cm)
                    <input type="number" min="60" max="300" step="1" value="${cm(resolved.width)}" onchange="window.setStairField('width', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">
                </label>
                <label class="block text-[10px] uppercase text-gray-400">Run (cm)
                    <input type="number" min="40" max="2000" step="5" value="${cm(current.availableRun)}" onchange="window.setStairField('availableRun', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">
                </label>
                <label class="block text-[10px] uppercase text-gray-400">Depth (cm)
                    <input type="number" min="60" max="1200" step="5" value="${cm(current.availableWidth)}" onchange="window.setStairField('availableWidth', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] font-mono">
                </label>
                <label class="block text-[10px] uppercase text-gray-400">Turn (deg)
                    <select onchange="window.setStairField('turnDegrees', this.value)" class="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] text-gray-800 dark:text-gray-100">
                        ${optionList([['90', '90'], ['180', '180']], String(current.turnDegrees || 90))}
                    </select>
                </label>
            </div>
            <div class="flex items-center gap-3 text-[10px] text-gray-500 pt-1">
                <label class="flex items-center gap-1"><input type="checkbox" ${topOn ? 'checked' : ''} onchange="window.setStairField('topLanding', this.checked)"> Top landing</label>
                <label class="flex items-center gap-1"><input type="checkbox" ${bottomOn ? 'checked' : ''} onchange="window.setStairField('bottomLanding', this.checked)"> Bottom</label>
            </div>
            <p class="text-[10px] text-gray-400">${item ? 'Editing ' + escape(item.metadata?.label || item.type) : 'Defaults for the next stair'}</p>
        `;

        const lines = assemblySummary(built);
        if (resolved.model) {
            lines.push('', ...stairModelSummary(resolved));
            const ref = resolved.model.refs?.[0];
            if (ref) lines.push(`${ref.code} ${ref.ref}`);
        }
        if (resolved.system) lines.push('', ...outdoorSummary(resolved));
        else {
            resolved.issues.forEach((issue) => {
                lines.push(`${issue.severity === 'error' ? '✖' : issue.severity === 'warning' ? '⚠' : 'ℹ'} ${issue.message}`);
            });
        }
        summaryNode.innerHTML = lines.map((line) => {
            const tone = line.startsWith('✖') ? 'text-red-500' : line.startsWith('⚠') ? 'text-amber-600' : '';
            return `<p class="${tone}">${escape(line)}</p>`;
        }).join('');
        return built;
    }

    function applyField(key, value) {
        const item = selectedStair();
        const target = item ? (item.stair = { ...(item.stair || {}) }) : (state().stairDraft = { ...(state().stairDraft || {}) });

        if (key === 'model') {
            if (!value) {
                delete target.model;
            } else {
                Object.assign(target, applyModelToConfig(target, value, { storeyHeight: getStoreyHeight() }));
                target.system = null;
            }
        } else if (key === 'system') {
            if (!value) target.system = null;
            else {
                // A system and a model family are alternatives: the system's
                // footings and guards replace the model's steel frame.
                delete target.model;
                const preset = outdoorStairConfig(value, { storeyHeight: getStoreyHeight() });
                Object.assign(target, {
                    system: value,
                    code: preset.code,
                    type: 'straight',
                    width: preset.width,
                    availableRun: preset.availableRun,
                    availableWidth: preset.availableWidth
                });
            }
        } else if (key === 'topLanding' || key === 'bottomLanding') {
            const end = key === 'topLanding' ? 'top' : 'bottom';
            target.landings = {
                ...(target.landings || {}),
                [end]: { ...(target.landings?.[end] || {}), enabled: Boolean(value) }
            };
        } else if (key === 'width' || key === 'availableRun' || key === 'availableWidth') {
            target[key] = Math.max(0.4, Number(value) / 100);
            // A spiral's width is its drum diameter, which the design reads
            // from availableWidth; keep the two in step.
            if (key === 'width' && target.type === 'spiral') target.availableWidth = target.width;
        } else if (key === 'turnDegrees') {
            target.turnDegrees = Number(value);
        } else {
            target[key] = value;
        }

        if (item) {
            // Size follows the drawn stair, landings included.
            sizeStairItem(item, getStoreyHeight());
            if (key === 'system' && value && item.type !== 'fire_pole') {
                item.type = STAIR_TYPE_BY_SYSTEM[value] || item.type;
            }
            save();
        }
        return refresh();
    }

    /** Place a stair from the current draft, or from a config handed in. */
    function add(overrides = null) {
        const draft = { ...(state().stairDraft || { system: 'deck', type: 'straight', code: 'IRC2021' }) };
        if (overrides) Object.assign(draft, overrides);
        state().stairDraft = { ...draft };
        const type = draft.type === 'fire-pole' ? 'fire_pole' : (STAIR_TYPE_BY_SYSTEM[draft.system] || 'stair');
        const center = planCenter();
        const item = createItem(type, center.x, center.y, 0);
        if (!item) return null;
        item.stair = { ...(item.stair || {}), ...draft };
        sizeStairItem(item, getStoreyHeight());
        state().fixtures.push(item);
        state().selectedFixture = item;
        state().selectedWallId = null;
        save();
        refresh();
        return item;
    }

    function exportTakeoff() {
        const resolved = design();
        const csv = resolved.system ? outdoorBomCsv(resolved) : (() => {
            const built = assembly();
            return [
                '"part","qty","note"',
                `"${built.subTypes.run.treadPart}",${built.subTypes.run.treads},"treads"`,
                `"${built.subTypes.support.part}",${built.subTypes.support.qty},"supports"`,
                `"top-landing",${built.subTypes.landing.top.enabled ? 1 : 0},"platform"`,
                `"bottom-landing",${built.subTypes.landing.bottom.enabled ? 1 : 0},"platform"`
            ].join('\n');
        })();
        const modelCsv = resolved.model ? `${modelTakeoffCsv(resolved)}\n` : '';
        const blob = new Blob([modelCsv + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'stair-takeoff.csv';
        link.click();
        URL.revokeObjectURL(url);
        return csv;
    }

    function toggleWalk() {
        if (walker?.active) {
            walker.stop();
            return false;
        }
        const camera = getCamera();
        const renderer = getRenderer();
        if (!camera || !renderer) return false;
        if (state().viewMode !== '3d') setViewMode('3d');

        if (!walker) {
            walker = createStairWalker({
                camera,
                domElement: renderer.domElement,
                getState: state,
                getView,
                onExit: () => {
                    state().walking = false;
                    const controls = getControls();
                    if (controls) controls.enabled = true;
                    const status = document.getElementById('stair-walk-status');
                    if (status) status.textContent = '';
                    refresh();
                    getRenderLoop()?.requestRender?.();
                }
            });
        }

        const item = selectedStair();
        let start = planCenter();
        if (item) {
            const sized = stairDesignForItem(item, getStoreyHeight());
            if (sized.entry) start = stairLocalToPlanPoint(item, sized.entry);
        }

        camera.near = 0.05;
        camera.updateProjectionMatrix?.();
        const controls = getControls();
        if (controls) controls.enabled = false;
        state().walking = true;
        walker.start(start);
        const status = document.getElementById('stair-walk-status');
        if (status) status.textContent = 'WASD to walk · drag to look · Esc to exit';
        getRenderLoop()?.requestRender?.();
        return true;
    }

    return {
        refresh,
        applyField,
        add,
        exportTakeoff,
        toggleWalk,
        design,
        assembly,
        walker: () => walker,
        get selected() { return selectedStair(); }
    };
}
