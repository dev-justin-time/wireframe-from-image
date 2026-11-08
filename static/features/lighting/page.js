import {
    LUMINAIRES,
    SWITCHES,
    SOCKETS,
    ROOM_PRESETS,
    roomPresetById,
    luminaireById,
    switchById,
    socketById,
    circuitTypeById,
    defaultCircuitFor
} from './catalog.js';
import {
    createPlan,
    normalizePlan,
    addDevice,
    removeDevice,
    moveDevice,
    autoLights,
    autoSockets,
    autoSwitches,
    autoCircuits,
    toggleSwitch,
    setMaster,
    toggleLuminaire,
    assignCircuit,
    controlsFor,
    bindAllLights,
    deviceAt,
    devicesOf,
    snapToWall
} from './plan.js';
import { designLighting, designCsv, glossaryByCategory } from './engine.js';
import { writeDraft } from '../../core/drafts.js';
import { applyPriceBookToDesign } from '../pricing/book.js';
import {
    RULES,
    RULE_CATEGORIES,
    RULE_LEVEL_LABEL,
    CODE_SCOPE,
    ruleStatus,
    searchRules
} from './rules.js';
import { luxColour } from './photometry.js';

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = 'lighting-suite-plan';
const EDITOR_KEY = 'lighting-editor-draft';
const CATEGORY_COLOUR = {
    ambient: '#f59e0b',
    task: '#0ea5e9',
    accent: '#a855f7',
    decor: '#ec4899'
};
const CATEGORY_LABEL = {
    ambient: 'Ambient',
    task: 'Task',
    accent: 'Accent',
    decor: 'Decor'
};
const ROOM_DIMENSIONS = {
    living: { width: 5.2, depth: 4.2 },
    bedroom: { width: 4.2, depth: 3.6 },
    kitchen: { width: 4.4, depth: 4.0 },
    bathroom: { width: 2.8, depth: 3.2 },
    dining: { width: 4.2, depth: 4.2 },
    hallway: { width: 5.6, depth: 2.2 },
    stairs: { width: 4.0, depth: 3.6 },
    office: { width: 4.2, depth: 3.6 },
    laundry: { width: 3.2, depth: 2.8 },
    garage: { width: 5.8, depth: 5.2 },
    closet: { width: 2.6, depth: 2.2 },
    outdoor: { width: 5.2, depth: 3.2 }
};

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const money = (value) => Number(value || 0).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const num = (value, digits = 2) => Number(value || 0).toFixed(digits);
const clampNumber = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max);

let plan = null;
let design = null;
let tool = 'select';
let selectedId = null;
let selectedLuminaire = 'recessed-6';
let showHeatmap = true;
let showCircuits = false;
let showLabels = true;
let showAllChecks = false;
let activeTab = 'design';
let camera = { zoom: 1, panX: 0, panY: 0 };
let drag = null;
let hoverPoint = null;
let frame = null;
let saveTimer = null;
let statusTimer = null;
let ruleQuery = '';
let ruleCategory = 'all';
let ruleIssuesOnly = false;
let glossaryQuery = '';
const openRules = new Set(['lighting-outlet', 'receptacle-spacing']);
const openGlossary = new Set();

plan = loadPlan();
selectedLuminaire = roomPresetById(plan.roomType).ambient;

function defaultPlan(roomType = 'living') {
    const dims = ROOM_DIMENSIONS[roomType] || ROOM_DIMENSIONS.living;
    const preset = roomPresetById(roomType);
    return createPlan({
        roomType,
        width: dims.width,
        depth: dims.depth,
        mountingHeight: 2.4
    });
}

function autoDesignPlan(target = plan) {
    const preset = roomPresetById(target.roomType);
    autoLights(target, { typeId: preset.ambient });
    autoSockets(target, { typeId: preset.socketType, minCount: preset.minSockets });
    autoSwitches(target, { typeId: preset.switchType });
    autoCircuits(target);
    selectedId = null;
    return target;
}

function loadPlan() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    } catch (error) {
        saved = null;
    }
    const loaded = normalizePlan(saved || defaultPlan('living'));
    if (!loaded.devices.length) autoDesignPlan(loaded);
    else if (!loaded.circuits.length) autoCircuits(loaded);
    return loaded;
}

// --- Selects --------------------------------------------------------------

function populateSelects() {
    const roomSelect = $('room-type');
    roomSelect.innerHTML = ROOM_PRESETS.map((preset) =>
        `<option value="${esc(preset.id)}">${esc(preset.label)}</option>`
    ).join('');
    roomSelect.value = plan.roomType;

    const lightGroups = { ambient: [], task: [], accent: [], decor: [] };
    LUMINAIRES.forEach((type) => {
        if (!lightGroups[type.category]) lightGroups[type.category] = [];
        lightGroups[type.category].push(type);
    });
    const lightSelect = $('luminaire-type');
    lightSelect.innerHTML = Object.entries(lightGroups).map(([category, entries]) =>
        `<optgroup label="${esc(CATEGORY_LABEL[category] || category)}">${entries.map((type) =>
            `<option value="${esc(type.id)}">${esc(type.label)} · ${type.watts} W · ${type.lumens} lm</option>`
        ).join('')}</optgroup>`
    ).join('');
    lightSelect.value = selectedLuminaire;

    $('switch-type').innerHTML = SWITCHES.map((type) =>
        `<option value="${esc(type.id)}">${esc(type.label)}</option>`
    ).join('');
    $('switch-type').value = roomPresetById(plan.roomType).switchType;

    $('socket-type').innerHTML = SOCKETS.map((type) =>
        `<option value="${esc(type.id)}">${esc(type.label)}</option>`
    ).join('');
    $('socket-type').value = roomPresetById(plan.roomType).socketType;
}

function syncRoomFields() {
    $('room-type').value = plan.roomType;
    $('room-width').value = plan.width.toFixed(1);
    $('room-depth').value = plan.depth.toFixed(1);
    $('ceiling-height').value = plan.height.toFixed(2);
    $('mount-height').value = plan.mountingHeight.toFixed(2);
    $('cct').value = String(plan.cct || roomPresetById(plan.roomType).cct);
    $('insulation').checked = plan.insulation;
    $('fire-ceiling').checked = plan.fireRatedCeiling;
    $('neutral').checked = plan.neutralAtSwitch;
    $('room-note').textContent = roomPresetById(plan.roomType).notes;
    const placedSwitch = plan.devices.find((device) => device.kind === 'switch');
    $('switch-type').value = placedSwitch?.typeId || roomPresetById(plan.roomType).switchType;
    $('socket-type').value = roomPresetById(plan.roomType).socketType;
}

// --- Status and persistence ----------------------------------------------

function setStatus(message, error = false) {
    const node = $('status');
    node.textContent = message;
    node.className = `text-[10px] min-h-[1rem] ${error ? 'text-red-600' : 'text-sky-700'}`;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { node.textContent = ''; }, 4200);
}

function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
        } catch (error) {
            setStatus('Could not save the plan locally.', true);
        }
    }, 220);
}

function scheduleRefresh() {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
        frame = null;
        refresh();
    });
}

// --- Metrics and checks ---------------------------------------------------

function renderMetrics() {
    const m = design.metrics;
    $('m-lux').textContent = `${Math.round(m.averageLux)} lx`;
    $('m-target').textContent = `${m.targetLux} lx`;
    $('m-uniformity').textContent = m.uniformity.toFixed(2);
    $('m-uniformity').className = `text-right metric-value ${m.uniformity >= 0.4 ? 'text-emerald-700' : 'text-amber-700'}`;
    $('m-w').textContent = `${Math.round(m.connectedW)} W`;
    $('m-lpd').textContent = `${m.wattsPerM2.toFixed(1)} W/m²`;
    $('m-count').textContent = `${m.totalCount}L · ${design.switches.length}S · ${design.sockets.length}R`;
    $('m-circuits').textContent = String(design.circuits.length);
    const worst = design.circuits.reduce((max, circuit) => Math.max(max, circuit.load.percent), 0);
    $('m-load').textContent = `${Math.round(worst)}%`;
    $('m-load').className = `text-right metric-value ${worst > 100 ? 'text-red-600' : worst > 80 ? 'text-amber-700' : 'text-slate-800'}`;
    $('m-cost').textContent = money(design.cost.total);
    $('master-state').textContent = `${m.litCount}/${m.totalCount} lit`;

    const errors = design.errors.length;
    const warnings = design.warnings.length;
    $('check-summary').textContent = errors || warnings
        ? `${errors} error${errors === 1 ? '' : 's'} · ${warnings} warning${warnings === 1 ? '' : 's'}`
        : 'No plan issues found';
    $('check-summary').className = `text-[10px] font-mono mt-1 ${errors ? 'text-red-600' : warnings ? 'text-amber-700' : 'text-emerald-700'}`;
    $('issue-count').textContent = `${errors + warnings} issue${errors + warnings === 1 ? '' : 's'}`;
}

function checkSymbol(severity) {
    return severity === 'error' ? '!' : severity === 'warn' ? '!' : severity === 'ok' ? '✓' : 'i';
}

function renderChecks() {
    const issues = design.checks.filter((check) => check.severity === 'error' || check.severity === 'warn');
    const visible = showAllChecks
        ? design.checks
        : (issues.length ? issues.slice(0, 7) : design.checks.filter((check) => check.severity === 'ok').slice(0, 4));
    const list = $('checks');
    if (!visible.length) {
        list.innerHTML = '<li class="text-slate-400">No checks yet. Place a light to begin.</li>';
        return;
    }
    list.innerHTML = visible.map((check) => {
        const detail = check.detail && check.severity !== 'ok'
            ? `<span class="block text-[10px] text-slate-500 leading-snug">${esc(check.detail)}</span>`
            : '';
        const symbol = checkSymbol(check.severity);
        return `<li class="flex gap-1.5 severity-${check.severity}">
            <span class="font-bold shrink-0">${symbol}</span>
            <span><b class="font-semibold">${esc(check.label)}</b>${detail}</span>
        </li>`;
    }).join('');
}

// --- Sidebar device controls ---------------------------------------------

function renderSwitchList() {
    const layers = design.layers;
    const layerButtons = Object.entries(layers)
        .filter(([, layer]) => layer.count > 0)
        .map(([key, layer]) => {
            const lights = design.luminaires.filter((light) => light.category === key);
            const lit = lights.some((light) => light.on);
            return `<button data-layer="${esc(key)}" class="px-1.5 py-0.5 rounded border text-[10px] font-semibold ${lit ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-200 bg-slate-100 text-slate-400'}">
                ${esc(CATEGORY_LABEL[key] || key)} ${layer.count}
            </button>`;
        }).join('');
    $('layer-toggles').innerHTML = layerButtons || '<span class="text-[10px] text-slate-400">No layers yet</span>';

    const switches = design.switches;
    if (!switches.length) {
        $('switch-list').innerHTML = '<p class="text-[10px] text-slate-400">No switch placed. Add one at the door.</p>';
        return;
    }
    $('switch-list').innerHTML = switches.map((device, index) => {
        const controls = controlsFor(plan, device.id);
        const lit = controls.some((light) => light.on);
        const type = switchById(device.typeId);
        return `<div class="flex items-center gap-1.5">
            <button data-switch-id="${esc(device.id)}" class="flex-1 flex items-center justify-between gap-2 px-2 py-1 rounded border ${lit ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'} text-[10px] hover:brightness-[0.98]">
                <span class="font-semibold truncate">S${index + 1} · ${esc(type.label)}</span>
                <span class="font-mono ${lit ? 'text-amber-700' : 'text-slate-400'}">${controls.length} light${controls.length === 1 ? '' : 's'} · ${lit ? 'on' : 'off'}</span>
            </button>
        </div>`;
    }).join('');
}

function renderInspector() {
    const node = $('inspector');
    const device = plan.devices.find((entry) => entry.id === selectedId);
    if (!device) {
        node.classList.add('hidden');
        node.innerHTML = '';
        return;
    }
    node.classList.remove('hidden');
    const type = device.kind === 'luminaire' ? luminaireById(device.typeId)
        : device.kind === 'switch' ? switchById(device.typeId) : socketById(device.typeId);
    const tagIndex = plan.devices.indexOf(device) + 1;
    const prefix = device.kind === 'luminaire' ? 'L' : device.kind === 'switch' ? 'S' : 'R';
    const circuitOptions = plan.circuits.map((circuit) =>
        `<option value="${esc(circuit.id)}" ${circuit.id === device.circuitId ? 'selected' : ''}>${esc(circuit.name)}</option>`
    ).join('');
    const wallInfo = device.kind === 'luminaire'
        ? `${num(device.mountHeight)} m above floor`
        : `${device.wall} wall · ${num(device.mountHeight)} m`;
    const controlInfo = device.kind === 'switch'
        ? `${controlsFor(plan, device.id).length} lights bound`
        : device.kind === 'socket'
            ? `${socketById(device.typeId).ratingA} A · ${socketById(device.typeId).gfci ? 'GFCI' : 'no GFCI'} · ${socketById(device.typeId).weatherResistant ? 'WR' : 'dry location'}`
            : `${type.category} · ${type.lumens} lm · ${type.watts} W · ${type.cct} K · CRI ${type.cri}`;
    node.innerHTML = `<div class="flex flex-wrap items-center gap-3">
        <div class="min-w-[150px]">
            <p class="text-[10px] uppercase tracking-wide text-slate-400">${esc(prefix)}${tagIndex} · selected</p>
            <p class="font-semibold">${esc(type.label)}</p>
            <p class="text-[10px] text-slate-500">${esc(wallInfo)} · ${esc(controlInfo)}</p>
        </div>
        <label class="text-[10px] text-slate-500">Circuit
            <select id="insp-circuit" class="mt-0.5 block rounded border border-slate-200 px-1 py-0.5 text-[10px]">
                <option value="">unassigned</option>${circuitOptions}
            </select>
        </label>
        ${device.kind === 'luminaire' ? `<label class="text-[10px] text-slate-500 min-w-[120px]">Output
            <span class="flex items-center gap-1.5">
                <input id="insp-dim" type="range" min="5" max="100" step="5" value="${device.dim ?? 100}" class="w-20">
                <b id="insp-dim-value" class="font-mono text-slate-700">${device.dim ?? 100}%</b>
            </span>
        </label>` : ''}
        <div class="flex items-center gap-1.5 ml-auto">
            ${device.kind === 'luminaire' ? `<button id="insp-toggle" class="px-2 py-1 rounded border border-slate-200 text-[10px] font-bold hover:bg-slate-50">${device.on === false ? 'Turn on' : 'Turn off'}</button>` : ''}
            ${device.kind === 'switch' ? '<button id="insp-bind" class="px-2 py-1 rounded border border-slate-200 text-[10px] font-bold hover:bg-slate-50">Bind all lights</button>' : ''}
            <button id="insp-delete" class="px-2 py-1 rounded border border-red-200 text-red-600 text-[10px] font-bold hover:bg-red-50">Delete</button>
        </div>
    </div>`;

    $('insp-circuit').addEventListener('change', (event) => {
        assignCircuit(plan, device.id, event.target.value || null);
        refresh();
    });
    if (device.kind === 'luminaire') {
        $('insp-dim').addEventListener('change', (event) => {
            device.dim = Number(event.target.value);
            refresh();
        });
        $('insp-toggle').addEventListener('click', () => {
            toggleLuminaire(plan, device.id);
            refresh();
        });
    }
    if (device.kind === 'switch') {
        $('insp-bind').addEventListener('click', () => {
            bindAllLights(plan, device.id);
            setStatus('Every luminaire is now bound to this switch.');
            refresh();
        });
    }
    $('insp-delete').addEventListener('click', () => {
        removeDevice(plan, device.id);
        selectedId = null;
        refresh();
        setStatus('Device removed.');
    });
}

// --- Schedule -------------------------------------------------------------

function renderSchedule() {
    const m = design.metrics;
    $('schedule-summary').textContent = `${design.preset.label} · ${m.area} m² · ${m.averageLux} lx average (target ${m.targetLux} lx) · ${design.schedule.length} outlets`;
    $('schedule-stats').innerHTML = [
        ['Circuits', design.circuits.length],
        ['Connected', `${Math.round(design.circuits.reduce((sum, circuit) => sum + circuit.load.va, 0))} VA`],
        ['Cable', `${design.circuits.reduce((sum, circuit) => sum + circuit.cableMetres, 0).toFixed(1)} m`]
    ].map(([label, value]) => `<span class="rounded bg-slate-50 px-2 py-1"><span class="text-slate-400">${label}</span> <b>${value}</b></span>`).join('');

    if (!design.schedule.length) {
        $('schedule-table').innerHTML = '<p class="text-[11px] text-slate-400 p-3">No devices in the plan.</p>';
        return;
    }
    $('schedule-table').innerHTML = `<table class="w-full text-[11px]">
        <thead>
            <tr class="text-left text-slate-400 border-b border-slate-100">
                <th class="px-2 py-1 font-semibold">Tag</th>
                <th class="px-2 py-1 font-semibold">Device</th>
                <th class="px-2 py-1 font-semibold">Location</th>
                <th class="px-2 py-1 font-semibold text-right">Mount</th>
                <th class="px-2 py-1 font-semibold">Circuit</th>
                <th class="px-2 py-1 font-semibold text-right">VA</th>
                <th class="px-2 py-1 font-semibold text-right">Controls</th>
            </tr>
        </thead>
        <tbody>${design.schedule.map((row) => {
            const circuit = design.circuits.find((entry) => entry.name === row.circuit);
            const colour = circuit?.colour || '#cbd5e1';
            return `<tr class="border-b border-slate-50 hover:bg-slate-50/70 cursor-pointer" data-schedule-tag="${esc(row.tag)}">
                <td class="px-2 py-1 font-mono font-bold">${esc(row.tag)}</td>
                <td class="px-2 py-1">${esc(row.label)}</td>
                <td class="px-2 py-1 capitalize text-slate-500">${esc(row.location)}</td>
                <td class="px-2 py-1 text-right font-mono">${row.mountingHeight != null ? Number(row.mountingHeight).toFixed(2) : '—'}</td>
                <td class="px-2 py-1"><span class="inline-block w-1.5 h-1.5 rounded-full mr-1" style="background:${colour}"></span>${esc(row.circuit)}</td>
                <td class="px-2 py-1 text-right font-mono">${row.va || '—'}</td>
                <td class="px-2 py-1 text-right font-mono">${row.kind === 'switch' ? row.controlled : '—'}</td>
            </tr>`;
        }).join('')}</tbody>
    </table>`;
    $('schedule-table').querySelectorAll('[data-schedule-tag]').forEach((row) => {
        row.addEventListener('click', () => {
            const tag = row.dataset.scheduleTag;
            const match = design.schedule.find((entry) => entry.tag === tag);
            if (!match) return;
            const index = design.schedule.indexOf(match);
            const device = plan.devices[index];
            if (!device) return;
            selectedId = device.id;
            setTab('design');
            refresh();
        });
    });
}

// --- Takeoff --------------------------------------------------------------

function renderTakeoff() {
    const m = design.metrics;
    const perM2 = m.area ? design.cost.total / m.area : 0;
    $('takeoff-cards').innerHTML = [
        ['Material', money(design.cost.materials), `${design.bom.rows.filter((row) => row.group !== 'Labour').length} line items`],
        ['Labour', money(design.cost.labour), `${design.luminaires.length} fixtures + devices`],
        ['Total', money(design.cost.total), `${money(perM2)}/m²`],
        ['Lighting', `${m.averageLux} lx`, `${m.uniformity.toFixed(2)} uniformity · ${m.wattsPerM2.toFixed(1)} W/m²`]
    ].map(([label, value, note]) => `<div class="rounded-lg bg-slate-50 px-3 py-2">
        <p class="text-[10px] uppercase tracking-wide text-slate-400">${label}</p>
        <p class="text-sm font-bold font-mono">${value}</p>
        <p class="text-[10px] text-slate-400">${note}</p>
    </div>`).join('');

    $('takeoff-bom').innerHTML = `<table class="w-full text-[11px]">
        <thead><tr class="text-left text-slate-400 border-b border-slate-100">
            <th class="px-2 py-1 font-semibold">Item</th>
            <th class="px-2 py-1 font-semibold text-right">Qty</th>
            <th class="px-2 py-1 font-semibold">Unit</th>
            <th class="px-2 py-1 font-semibold text-right">Unit cost</th>
            <th class="px-2 py-1 font-semibold text-right">Total</th>
            <th class="px-2 py-1 font-semibold">Note</th>
        </tr></thead>
        <tbody>${design.bom.groups.map((group) => `
            <tr class="bg-slate-50 border-b border-slate-100">
                <td colspan="5" class="px-2 py-1 font-bold uppercase tracking-wide text-slate-500 text-[10px]">${esc(group.group)}</td>
                <td class="px-2 py-1 text-right font-mono font-bold text-[10px]">${money(group.total)}</td>
            </tr>
            ${group.rows.map((row) => `<tr class="border-b border-slate-50">
                <td class="px-2 py-1">${esc(row.label)}</td>
                <td class="px-2 py-1 text-right font-mono">${row.qty}</td>
                <td class="px-2 py-1 text-slate-400">${esc(row.unit)}</td>
                <td class="px-2 py-1 text-right font-mono">${money(row.unitCost)}</td>
                <td class="px-2 py-1 text-right font-mono">${money(row.total)}</td>
                <td class="px-2 py-1 text-slate-400 text-[10px]">${esc(row.note)}</td>
            </tr>`).join('')}
        `).join('')}</tbody>
        <tfoot><tr class="border-t border-slate-200 font-bold">
            <td colspan="4" class="px-2 py-1.5 text-right">Total</td>
            <td class="px-2 py-1.5 text-right font-mono">${money(design.cost.total)}</td>
            <td></td>
        </tr></tfoot>
    </table>`;
    $('takeoff-notes').innerHTML = design.bom.assumptions.map((note) => `<li>${esc(note)}</li>`).join('');
}

// --- Rules and glossary ---------------------------------------------------

function renderRules() {
    const related = design.checks;
    const counts = { ok: 0, warn: 0, error: 0, info: 0 };
    RULES.forEach((rule) => {
        counts[ruleStatus(rule, related).state] += 1;
    });
    $('rules-summary').innerHTML = `<span class="text-emerald-700">${counts.ok} pass</span> · <span class="text-amber-700">${counts.warn} review</span> · <span class="text-red-600">${counts.error} fix</span>`;
    $('rules-summary').className = 'text-[10px] font-mono';

    const chips = [{ id: 'all', label: 'All', count: RULES.length }, ...RULE_CATEGORIES.map((category) => ({
        ...category,
        count: RULES.filter((rule) => rule.category === category.id).length
    }))];
    $('rules-chips').innerHTML = chips.map((chip) =>
        `<button data-rule-category="${esc(chip.id)}" class="chip px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-semibold ${ruleCategory === chip.id ? 'active' : 'bg-white text-slate-600'}">${esc(chip.label)} <span class="opacity-60">${chip.count}</span></button>`
    ).join('');

    const search = searchRules(ruleQuery);
    let visible = search.filter((rule) => ruleCategory === 'all' || rule.category === ruleCategory);
    if (ruleIssuesOnly) {
        visible = visible.filter((rule) => {
            const status = ruleStatus(rule, related);
            return status.state === 'warn' || status.state === 'error';
        });
    }

    $('glossary-count').textContent = `${glossaryByCategory().reduce((sum, group) => sum + group.entries.length, 0)} terms`;

    if (!visible.length) {
        $('rules-list').innerHTML = '<p class="text-[11px] text-slate-400 p-2">No rule matches that filter. Clear the search or choose another category.</p>';
        return;
    }

    $('rules-list').innerHTML = visible.map((rule) => {
        const status = ruleStatus(rule, related);
        const open = openRules.has(rule.id);
        const relatedChecks = related.filter((check) => rule.checkIds?.includes(check.id));
        const level = RULE_LEVEL_LABEL[rule.level] || rule.level;
        const statusClass = status.state === 'error' ? 'text-red-600 bg-red-50 border-red-100'
            : status.state === 'warn' ? 'text-amber-700 bg-amber-50 border-amber-100'
                : status.state === 'ok' ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                    : 'text-slate-500 bg-slate-50 border-slate-200';
        return `<article class="rule border border-slate-200 rounded-lg overflow-hidden ${open ? 'open' : ''}" data-rule-id="${esc(rule.id)}">
            <button class="rule-toggle w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-slate-50">
                <span class="rule-caret text-slate-400 mt-0.5">▸</span>
                <span class="min-w-0 flex-1">
                    <span class="flex flex-wrap items-center gap-1.5">
                        <b class="text-[12px]">${esc(rule.title)}</b>
                        <span class="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded border ${rule.level === 'required' ? 'border-sky-200 text-sky-700 bg-sky-50' : 'border-slate-200 text-slate-500 bg-white'}">${esc(level)}</span>
                    </span>
                    <span class="block text-[10px] font-mono text-slate-400 mt-0.5">${esc(rule.code)}</span>
                    <span class="block text-[11px] text-slate-600 mt-1">${esc(rule.summary)}</span>
                </span>
                <span class="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusClass}">${esc(status.label)}</span>
            </button>
            <div class="rule-body border-t border-slate-100 px-4 py-2 bg-slate-50/60">
                <ul class="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                    ${(rule.requirements || []).map((item) => `<li>${esc(item)}</li>`).join('')}
                </ul>
                <p class="text-[11px] text-slate-600 mt-2 prose-sm">${esc(rule.detail)}</p>
                ${relatedChecks.length ? `<div class="mt-2 flex flex-wrap gap-1">${relatedChecks.map((check) => `
                    <span class="text-[9px] px-1.5 py-0.5 rounded border severity-${check.severity} border-slate-200 bg-white" title="${esc(check.detail || check.label)}">${checkSymbol(check.severity)} ${esc(check.label)}</span>
                `).join('')}</div>` : ''}
                <a href="https://codes.iccsafe.org/content/IRC2021P2/chapter-39-power-and-lighting-distribution" target="_blank" rel="noopener" class="inline-block mt-2 text-[10px] text-sky-700 underline">Read IRC chapter 39</a>
            </div>
        </article>`;
    }).join('');
}

function renderGlossary() {
    const groups = glossaryByCategory();
    const term = glossaryQuery.trim().toLowerCase();
    let total = 0;
    $('glossary-list').innerHTML = groups.map((group) => {
        const entries = group.entries.filter((entry) => !term || `${entry.term} ${entry.short} ${entry.detail}`.toLowerCase().includes(term));
        if (!entries.length) return '';
        total += entries.length;
        return `<section>
            <h3 class="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">${esc(group.category)}</h3>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-1.5">
                ${entries.map((entry) => {
                    const key = entry.term;
                    const open = openGlossary.has(key);
                    return `<details class="rounded-lg border border-slate-200 bg-white px-3 py-2" data-glossary-term="${esc(key)}" ${open ? 'open' : ''}>
                        <summary class="cursor-pointer text-[12px] font-semibold">${esc(entry.term)}</summary>
                        <p class="text-[11px] text-slate-500 mt-1">${esc(entry.short)}</p>
                        <p class="text-[11px] text-slate-600 mt-1">${esc(entry.detail)}</p>
                    </details>`;
                }).join('')}
            </div>
        </section>`;
    }).join('');
    $('glossary-count').textContent = term ? `${total} matching term${total === 1 ? '' : 's'}` : `${groups.reduce((sum, group) => sum + group.entries.length, 0)} terms`;
    $('glossary-list').querySelectorAll('[data-glossary-term]').forEach((node) => {
        node.addEventListener('toggle', () => {
            if (node.open) openGlossary.add(node.dataset.glossaryTerm);
            else openGlossary.delete(node.dataset.glossaryTerm);
        });
    });
}

// --- Plan canvas ----------------------------------------------------------

const canvas = $('plan');
const ctx = canvas.getContext('2d');
let view = { scale: 1, ox: 0, oy: 0 };

function resizeCanvas() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    drawPlan();
}

function computeView() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const paddingX = Math.max(36, width * 0.07);
    const paddingY = Math.max(36, height * 0.08);
    const base = Math.min((width - paddingX * 2) / plan.width, (height - paddingY * 2) / plan.depth);
    const scale = Math.max(base * camera.zoom, 1);
    const ox = (width - plan.width * scale) / 2 + camera.panX;
    const oy = (height - plan.depth * scale) / 2 + camera.panY;
    return { width, height, scale, ox, oy };
}

const P = (point) => ({
    x: view.ox + point.x * view.scale,
    y: view.oy + point.y * view.scale
});

function screenToPlan(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left - view.ox) / view.scale,
        y: (clientY - rect.top - view.oy) / view.scale
    };
}

function tagFor(device) {
    const index = plan.devices.indexOf(device) + 1;
    const prefix = device.kind === 'luminaire' ? 'L' : device.kind === 'switch' ? 'S' : 'R';
    return `${prefix}${index}`;
}

function drawTag(text, x, y, colour = '#475569') {
    ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    const width = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(x - 1, y - 8, width + 4, 11);
    ctx.fillStyle = colour;
    ctx.fillText(text, x + 1, y);
}

function drawPlan() {
    if (!canvas.width || !canvas.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    view = computeView();

    const left = P({ x: 0, y: 0 }).x;
    const top = P({ x: 0, y: 0 }).y;
    const roomWidth = plan.width * view.scale;
    const roomDepth = plan.depth * view.scale;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(left, top, roomWidth, roomDepth, 4);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, roomWidth, roomDepth);
    ctx.clip();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(left, top, roomWidth, roomDepth);

    if (showHeatmap && design?.grid?.values?.length) {
        const steps = design.grid.steps;
        const cellW = roomWidth / steps;
        const cellH = roomDepth / steps;
        for (let row = 0; row < steps; row += 1) {
            for (let col = 0; col < steps; col += 1) {
                const value = design.grid.values[row * steps + col];
                ctx.fillStyle = luxColour(value, design.grid.max);
                ctx.fillRect(left + col * cellW, top + row * cellH, cellW + 0.5, cellH + 0.5);
            }
        }
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 1; x < plan.width; x += 1) {
        ctx.beginPath();
        ctx.moveTo(P({ x, y: 0 }).x, top);
        ctx.lineTo(P({ x, y: 0 }).x, top + roomDepth);
        ctx.stroke();
    }
    for (let y = 1; y < plan.depth; y += 1) {
        ctx.beginPath();
        ctx.moveTo(left, P({ x: 0, y }).y);
        ctx.lineTo(left + roomWidth, P({ x: 0, y }).y);
        ctx.stroke();
    }

    // Circuits are drawn under the devices, one dashed route per branch.
    if (showCircuits) {
        design.circuits.forEach((circuit) => {
            const devices = circuit.devices.slice();
            if (!devices.length) return;
            let current = { x: plan.panel.x, y: plan.panel.y };
            const remaining = devices.slice();
            const ordered = [];
            while (remaining.length) {
                let nearest = 0;
                let best = Infinity;
                remaining.forEach((device, index) => {
                    const distance = Math.hypot(device.x - current.x, device.y - current.y);
                    if (distance < best) { best = distance; nearest = index; }
                });
                const next = remaining.splice(nearest, 1)[0];
                ordered.push(next);
                current = next;
            }
            ctx.save();
            ctx.strokeStyle = circuit.colour;
            ctx.globalAlpha = 0.6;
            ctx.lineWidth = 1.6;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            const start = P({ x: plan.panel.x, y: plan.panel.y });
            ctx.moveTo(start.x, start.y);
            ordered.forEach((device) => {
                const point = P(device);
                ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.restore();
        });
    }

    ctx.restore();

    // Walls, with a door opening at the entry.
    const wallWidth = Math.max(3, Math.min(6, view.scale * 0.09));
    ctx.save();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = wallWidth;
    ctx.lineCap = 'square';
    const entryGap = Math.min(1.0, Math.max(0.65, plan.width * 0.16));
    const entryOnSouth = plan.entry.y >= plan.depth - 0.15;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + roomWidth, top);
    ctx.moveTo(left, top);
    ctx.lineTo(left, top + roomDepth);
    ctx.moveTo(left + roomWidth, top);
    ctx.lineTo(left + roomWidth, top + roomDepth);
    if (entryOnSouth) {
        const gapStart = P({ x: clampNumber(plan.entry.x - entryGap / 2, 0, plan.width), y: plan.depth }).x;
        const gapEnd = P({ x: clampNumber(plan.entry.x + entryGap / 2, 0, plan.width), y: plan.depth }).x;
        ctx.moveTo(left, top + roomDepth);
        ctx.lineTo(gapStart, top + roomDepth);
        ctx.moveTo(gapEnd, top + roomDepth);
        ctx.lineTo(left + roomWidth, top + roomDepth);
    } else {
        ctx.moveTo(left, top + roomDepth);
        ctx.lineTo(left + roomWidth, top + roomDepth);
    }
    ctx.stroke();
    ctx.restore();

    if (entryOnSouth) {
        const hinge = P({ x: clampNumber(plan.entry.x - entryGap / 2, 0, plan.width), y: plan.depth });
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hinge.x, hinge.y);
        ctx.lineTo(hinge.x, hinge.y - entryGap * view.scale);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hinge.x, hinge.y, entryGap * view.scale, -Math.PI / 2, 0);
        ctx.stroke();
        ctx.restore();
    }

    // Panel marker.
    const panel = P(plan.panel);
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(panel.x - 9, panel.y - 6, 18, 12, 2);
    ctx.fill();
    ctx.font = 'bold 7px ui-monospace, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('DB', panel.x, panel.y + 2.5);
    ctx.restore();

    const tags = new Map(plan.devices.map((device) => [device.id, tagFor(device)]));

    // Luminaires.
    design.luminaires.forEach((light) => {
        if (!plan.devices.some((device) => device.id === light.id)) return;
        const point = P(light);
        const inset = Math.min(10, view.scale * 0.12);
        if (light.wall === 'north') point.y += inset;
        if (light.wall === 'south') point.y -= inset;
        if (light.wall === 'west') point.x += inset;
        if (light.wall === 'east') point.x -= inset;
        const radius = Math.max(6, Math.min(14, view.scale * 0.16));
        const colour = CATEGORY_COLOUR[light.category] || '#f59e0b';
        const on = light.on !== false;
        if (on) {
            const glow = ctx.createRadialGradient(point.x, point.y, radius * 0.3, point.x, point.y, radius * 3.2);
            glow.addColorStop(0, `${colour}66`);
            glow.addColorStop(1, `${colour}00`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius * 3.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = on ? colour : '#cbd5e1';
        ctx.fill();
        ctx.strokeStyle = on ? '#ffffff' : '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = on ? 'rgba(255,255,255,0.9)' : '#64748b';
        ctx.fill();
        if (selectedId === light.id) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        if (showLabels) drawTag(tags.get(light.id), point.x + radius + 3, point.y - radius - 3, on ? '#475569' : '#94a3b8');
    });

    // Switches and sockets sit on the wall but draw just inside it.
    const wallDevices = plan.devices.filter((device) => device.kind === 'switch' || device.kind === 'socket');
    wallDevices.forEach((device) => {
        const point = P(device);
        const offset = 11;
        let x = point.x;
        let y = point.y;
        if (device.wall === 'north') y += offset;
        if (device.wall === 'south') y -= offset;
        if (device.wall === 'west') x += offset;
        if (device.wall === 'east') x -= offset;
        const selected = selectedId === device.id;
        ctx.save();
        ctx.translate(x, y);
        if (device.kind === 'switch') {
            ctx.fillStyle = selected ? '#0ea5e9' : '#ffffff';
            ctx.strokeStyle = selected ? '#0284c7' : '#475569';
            ctx.lineWidth = selected ? 2 : 1.5;
            ctx.beginPath();
            ctx.roundRect(-7, -7, 14, 14, 2);
            ctx.fill();
            ctx.stroke();
            ctx.font = 'bold 8px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = selected ? '#ffffff' : '#334155';
            ctx.fillText('S', 0, 0.5);
        } else {
            const horizontal = device.wall === 'north' || device.wall === 'south';
            const w = horizontal ? 16 : 11;
            const h = horizontal ? 11 : 16;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = selected ? '#0284c7' : '#475569';
            ctx.lineWidth = selected ? 2 : 1.3;
            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#475569';
            if (horizontal) {
                ctx.fillRect(-4, -2, 1.5, 4);
                ctx.fillRect(2.5, -2, 1.5, 4);
            } else {
                ctx.fillRect(-2, -4, 4, 1.5);
                ctx.fillRect(-2, 2.5, 4, 1.5);
            }
        }
        ctx.restore();
        if (showLabels) drawTag(tags.get(device.id), x + 10, y - 9, selected ? '#0284c7' : '#64748b');
    });

    // Dimension labels.
    ctx.save();
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(71, 85, 105, 0.75)';
    ctx.textAlign = 'center';
    ctx.fillText(`${plan.width.toFixed(2)} m`, left + roomWidth / 2, top - 12);
    ctx.translate(left - 14, top + roomDepth / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${plan.depth.toFixed(2)} m`, 0, 0);
    ctx.restore();

    // Scale bar in screen space.
    const metres = view.scale >= 64 ? 1 : view.scale >= 32 ? 2 : 5;
    const barWidth = metres * view.scale;
    const barX = width - barWidth - 18;
    const barY = height - 18;
    ctx.save();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + barWidth, barY);
    ctx.moveTo(barX, barY - 4);
    ctx.lineTo(barX, barY + 4);
    ctx.moveTo(barX + barWidth, barY - 4);
    ctx.lineTo(barX + barWidth, barY + 4);
    ctx.stroke();
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(71, 85, 105, 0.75)';
    ctx.textAlign = 'center';
    ctx.fillText(`${metres} m`, barX + barWidth / 2, barY - 7);
    ctx.restore();

    $('plan-hint').textContent = tool === 'select'
        ? 'drag a light · click a switch to flip its lights · drag empty space to pan · wheel to zoom'
        : tool === 'erase' ? 'click a device to remove it'
            : `click to place ${tool === 'luminaire' ? 'a light' : tool === 'switch' ? 'a switch' : 'a socket'}`;
    $('hover-readout').textContent = '';
    if (hoverPoint && hoverPoint.x >= 0 && hoverPoint.x <= plan.width && hoverPoint.y >= 0 && hoverPoint.y <= plan.depth) {
        const col = Math.min(design.grid.steps - 1, Math.max(0, Math.floor(hoverPoint.x / plan.width * design.grid.steps)));
        const row = Math.min(design.grid.steps - 1, Math.max(0, Math.floor(hoverPoint.y / plan.depth * design.grid.steps)));
        const lux = design.grid.values[row * design.grid.steps + col] || 0;
        $('hover-readout').textContent = `${hoverPoint.x.toFixed(2)}, ${hoverPoint.y.toFixed(2)} m · ${Math.round(lux)} lx`;
    }
}

// --- Editing --------------------------------------------------------------

function currentCircuit(kind, typeId) {
    if (kind === 'luminaire' || kind === 'switch') {
        return plan.circuits.find((circuit) => circuit.type === 'lighting') || null;
    }
    const socket = socketById(typeId);
    const needed = defaultCircuitFor(socket, plan.roomType);
    return plan.circuits.find((circuit) => circuit.type === needed)
        || plan.circuits.find((circuit) => circuit.type === 'general')
        || plan.circuits[0]
        || null;
}

function addAt(point) {
    if (tool === 'select' || tool === 'erase') return;
    if (point.x < 0 || point.x > plan.width || point.y < 0 || point.y > plan.depth) {
        setStatus('Place the device inside the room.', true);
        return;
    }
    if (plan.circuits.length === 0) autoCircuits(plan);
    const typeSelect = tool === 'luminaire' ? $('luminaire-type') : tool === 'switch' ? $('switch-type') : $('socket-type');
    const typeId = typeSelect.value;
    const device = addDevice(plan, { kind: tool, typeId, x: point.x, y: point.y });
    if (!device) return;
    if (tool === 'switch') {
        device.controls = devicesOf(plan, 'luminaire').map((light) => light.id);
        device.circuitId = currentCircuit('switch', typeId)?.id || null;
    } else {
        device.circuitId = currentCircuit(tool, typeId)?.id || null;
    }
    if (tool === 'luminaire') {
        // A new light joins every existing switch, so it is not left uncontrolled.
        devicesOf(plan, 'switch').forEach((deviceSwitch) => {
            deviceSwitch.controls = [...new Set([...(deviceSwitch.controls || []), device.id])];
        });
    }
    selectedId = device.id;
    refresh();
    setStatus(`${device.label} placed.`);
}

function deleteSelected() {
    if (!selectedId) return;
    const device = plan.devices.find((entry) => entry.id === selectedId);
    if (!device) return;
    removeDevice(plan, selectedId);
    selectedId = null;
    refresh();
    setStatus(`${device.label} removed.`);
}

// --- Events ---------------------------------------------------------------

function wireTabs() {
    document.querySelectorAll('.tab').forEach((button) => {
        button.addEventListener('click', () => setTab(button.dataset.tab));
    });
}

function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tab);
    });
    ['design', 'schedule', 'takeoff', 'rules', 'glossary'].forEach((name) => {
        $(`panel-${name}`).classList.toggle('hidden', name !== tab);
    });
    const notes = {
        design: 'plan and schedule share one model',
        schedule: 'one row per outlet, with circuit and load',
        takeoff: 'quantities and planning prices',
        rules: '2021 IRC and IECC, with your plan status',
        glossary: 'the words on the plan and the schedule'
    };
    $('tab-note').textContent = notes[tab] || '';
    if (tab === 'design') window.requestAnimationFrame(resizeCanvas);
    if (tab === 'rules') renderRules();
    if (tab === 'glossary') renderGlossary();
}

function wireTools() {
    document.querySelectorAll('.tool').forEach((button) => {
        button.addEventListener('click', () => {
            tool = button.dataset.tool;
            document.querySelectorAll('.tool').forEach((entry) => entry.classList.toggle('active', entry === button));
            canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
            drawPlan();
        });
    });
}

function wireCanvas() {
    canvas.addEventListener('pointerdown', (event) => {
        const point = screenToPlan(event.clientX, event.clientY);
        const tolerance = Math.max(0.3, 18 / view.scale);
        if (tool === 'erase') {
            const hit = deviceAt(plan, point, tolerance);
            if (hit) {
                removeDevice(plan, hit.id);
                if (selectedId === hit.id) selectedId = null;
                refresh();
                setStatus(`${hit.label} removed.`);
            }
            return;
        }
        if (tool !== 'select') {
            addAt(point);
            return;
        }
        const hit = deviceAt(plan, point, tolerance);
        if (hit) {
            selectedId = hit.id;
            drag = {
                type: 'device',
                id: hit.id,
                startX: event.clientX,
                startY: event.clientY,
                moved: false
            };
            canvas.setPointerCapture(event.pointerId);
            refresh();
        } else {
            selectedId = null;
            drag = {
                type: 'pan',
                startX: event.clientX,
                startY: event.clientY,
                panX: camera.panX,
                panY: camera.panY
            };
            canvas.setPointerCapture(event.pointerId);
            refresh();
        }
    });

    canvas.addEventListener('pointermove', (event) => {
        const point = screenToPlan(event.clientX, event.clientY);
        hoverPoint = point;
        if (drag?.type === 'device') {
            const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
            if (distance > 3) {
                drag.moved = true;
                moveDevice(plan, drag.id, point.x, point.y);
                scheduleRefresh();
            }
        } else if (drag?.type === 'pan') {
            camera.panX = drag.panX + (event.clientX - drag.startX);
            camera.panY = drag.panY + (event.clientY - drag.startY);
            drawPlan();
        } else {
            const hit = deviceAt(plan, point, Math.max(0.3, 18 / view.scale));
            canvas.style.cursor = hit && tool === 'select' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
            drawPlan();
        }
    });

    const finishDrag = (event) => {
        if (!drag) return;
        const wasDevice = drag.type === 'device';
        const moved = drag.moved;
        const id = drag.id;
        drag = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (wasDevice && !moved) {
            const device = plan.devices.find((entry) => entry.id === id);
            if (device?.kind === 'switch') {
                const lights = toggleSwitch(plan, id);
                setStatus(lights.length ? `${lights.length} light${lights.length === 1 ? '' : 's'} switched.` : 'Bind a light to this switch first.', lights.length === 0);
            }
        }
        refresh();
    };
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', () => { drag = null; refresh(); });
    canvas.addEventListener('pointerleave', () => {
        if (!drag) {
            hoverPoint = null;
            drawPlan();
        }
    });
    canvas.addEventListener('dblclick', (event) => {
        const point = screenToPlan(event.clientX, event.clientY);
        const hit = deviceAt(plan, point, Math.max(0.3, 18 / view.scale));
        if (hit?.kind === 'luminaire') {
            toggleLuminaire(plan, hit.id);
            refresh();
        }
    });
    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        camera.zoom = clampNumber(camera.zoom * (event.deltaY < 0 ? 1.12 : 0.9), 0.6, 4);
        drawPlan();
    }, { passive: false });

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', (event) => {
        if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            deleteSelected();
        }
        if (event.key === 'Escape') {
            selectedId = null;
            refresh();
        }
    });
}

function wireSidebar() {
    $('room-type').addEventListener('change', (event) => {
        const roomType = event.target.value;
        const dims = ROOM_DIMENSIONS[roomType] || { width: plan.width, depth: plan.depth };
        const previousHeight = plan.height;
        plan = createPlan({
            roomType,
            width: dims.width,
            depth: dims.depth,
            height: previousHeight,
            mountingHeight: Math.min(plan.mountingHeight, previousHeight - 0.2)
        });
        selectedLuminaire = roomPresetById(roomType).ambient;
        $('luminaire-type').value = selectedLuminaire;
        autoDesignPlan(plan);
        syncRoomFields();
        selectedId = null;
        camera = { zoom: 1, panX: 0, panY: 0 };
        refresh();
        setStatus(`${roomPresetById(roomType).label} plan generated.`);
    });

    const geometryFields = ['room-width', 'room-depth', 'ceiling-height', 'mount-height'];
    geometryFields.forEach((id) => {
        $(id).addEventListener('change', () => {
            plan.width = clamp($('room-width').value, 2, 30);
            plan.depth = clamp($('room-depth').value, 2, 30);
            plan.height = clamp($('ceiling-height').value, 2.2, 6);
            plan.mountingHeight = clamp($('mount-height').value, 1.8, plan.height - 0.1);
            plan.entry.x = clamp(plan.entry.x, 0, plan.width);
            plan.entry.y = clamp(plan.entry.y, 0, plan.depth);
            plan.panel.x = clamp(plan.panel.x, 0, plan.width);
            plan.panel.y = clamp(plan.panel.y, 0, plan.depth);
            plan.devices.forEach((device) => {
                if (device.kind === 'luminaire') {
                    device.x = clamp(device.x, 0.05, plan.width - 0.05);
                    device.y = clamp(device.y, 0.05, plan.depth - 0.05);
                    const type = luminaireById(device.typeId);
                    device.mountHeight = type.mount === 'wall' ? 1.8 : plan.mountingHeight;
                } else {
                    const snapped = snapToWall(plan, device.kind, device.x, device.y);
                    Object.assign(device, snapped);
                }
            });
            syncRoomFields();
            camera = { zoom: 1, panX: 0, panY: 0 };
            refresh();
        });
    });

    $('cct').addEventListener('change', (event) => {
        plan.cct = clamp(Number(event.target.value) || 3000, 2700, 4000);
        devicesOf(plan, 'luminaire').forEach((light) => { light.cct = plan.cct; });
        refresh();
    });

    ['insulation', 'fire-ceiling', 'neutral'].forEach((id) => {
        $(id).addEventListener('change', () => {
            plan.insulation = $('insulation').checked;
            plan.fireRatedCeiling = $('fire-ceiling').checked;
            plan.neutralAtSwitch = $('neutral').checked;
            refresh();
        });
    });

    $('luminaire-type').addEventListener('change', (event) => {
        selectedLuminaire = event.target.value;
    });
    $('auto-design').addEventListener('click', () => {
        autoDesignPlan(plan);
        syncRoomFields();
        camera = { zoom: 1, panX: 0, panY: 0 };
        refresh();
        setStatus('Auto design refreshed the luminaires, switches, sockets and circuits.');
    });
    $('clear-lights').addEventListener('click', () => {
        plan.devices = plan.devices.filter((device) => device.kind !== 'luminaire');
        plan.devices.forEach((device) => { if (device.kind === 'switch') device.controls = []; });
        selectedId = null;
        refresh();
        setStatus('All luminaires cleared. Add or auto-design to bring them back.', true);
    });
    $('master-on').addEventListener('click', () => { setMaster(plan, true); refresh(); });
    $('master-off').addEventListener('click', () => { setMaster(plan, false); refresh(); });
    $('dim-half').addEventListener('click', () => {
        devicesOf(plan, 'luminaire').forEach((light) => { light.dim = 50; light.on = true; });
        refresh();
        setStatus('All luminaires set to 50%.');
    });

    $('show-all-checks').addEventListener('click', () => {
        showAllChecks = !showAllChecks;
        $('show-all-checks').textContent = showAllChecks ? 'Show issues only' : 'Show all checks';
        renderChecks();
    });

    $('layer-toggles').addEventListener('click', (event) => {
        const button = event.target.closest('[data-layer]');
        if (!button) return;
        const category = button.dataset.layer;
        const lights = devicesOf(plan, 'luminaire').filter((device) => luminaireById(device.typeId).category === category);
        const next = !lights.some((light) => light.on !== false);
        lights.forEach((light) => { light.on = next; });
        refresh();
    });

    $('switch-list').addEventListener('click', (event) => {
        const button = event.target.closest('[data-switch-id]');
        if (!button) return;
        const lights = toggleSwitch(plan, button.dataset.switchId);
        setStatus(lights.length ? `${lights.length} light${lights.length === 1 ? '' : 's'} switched.` : 'Bind a light to this switch first.', lights.length === 0);
        refresh();
    });

    $('show-heatmap').addEventListener('change', (event) => { showHeatmap = event.target.checked; drawPlan(); });
    $('show-circuits').addEventListener('change', (event) => { showCircuits = event.target.checked; drawPlan(); });
    $('show-labels').addEventListener('change', (event) => { showLabels = event.target.checked; drawPlan(); });
    $('fit-plan').addEventListener('click', () => {
        camera = { zoom: 1, panX: 0, panY: 0 };
        drawPlan();
    });

    $('rules-search').addEventListener('input', (event) => {
        ruleQuery = event.target.value;
        renderRules();
    });
    $('rules-issues').addEventListener('change', (event) => {
        ruleIssuesOnly = event.target.checked;
        renderRules();
    });
    $('rules-chips').addEventListener('click', (event) => {
        const button = event.target.closest('[data-rule-category]');
        if (!button) return;
        ruleCategory = button.dataset.ruleCategory;
        renderRules();
    });
    $('rules-list').addEventListener('click', (event) => {
        const toggle = event.target.closest('.rule-toggle');
        if (!toggle) return;
        const article = toggle.closest('.rule');
        if (!article) return;
        article.classList.toggle('open');
        if (article.classList.contains('open')) openRules.add(article.dataset.ruleId);
        else openRules.delete(article.dataset.ruleId);
    });
    $('glossary-search').addEventListener('input', (event) => {
        glossaryQuery = event.target.value;
        renderGlossary();
    });

    $('reset').addEventListener('click', () => {
        localStorage.removeItem(DRAFT_KEY);
        plan = defaultPlan('living');
        selectedLuminaire = roomPresetById(plan.roomType).ambient;
        autoDesignPlan(plan);
        camera = { zoom: 1, panX: 0, panY: 0 };
        selectedId = null;
        tool = 'select';
        document.querySelectorAll('.tool').forEach((button) => button.classList.toggle('active', button.dataset.tool === 'select'));
        syncRoomFields();
        $('luminaire-type').value = selectedLuminaire;
        refresh();
        setStatus('Demo plan reset.');
    });

    $('schedule-csv').addEventListener('click', () => {
        download('lighting-schedule.csv', designCsv(design));
    });
    $('takeoff-csv').addEventListener('click', () => {
        const lines = [['Group', 'Item', 'Qty', 'Unit', 'Unit cost', 'Total', 'Note']];
        design.bom.rows.forEach((row) => {
            lines.push([row.group, row.label, row.qty, row.unit, row.unitCost, row.total, row.note]);
        });
        download('lighting-takeoff.csv', lines.map((line) => line.map((cell) => {
            const text = String(cell ?? '');
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        }).join(',')).join('\n'));
    });
    $('send-editor').addEventListener('click', () => {
        const draft = {
            plan,
            roomType: plan.roomType,
            summary: design.summary,
            metrics: design.metrics,
            checks: design.checks.filter((check) => check.severity !== 'ok'),
            sentAt: new Date().toISOString()
        };
        try {
            if (!writeDraft(EDITOR_KEY, draft)) throw new Error('editor draft not saved');
            localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
            setStatus('Lighting draft sent to the editor. Opening it now…');
            window.setTimeout(() => { window.location.href = 'Editor.html'; }, 350);
        } catch (error) {
            setStatus('Could not send the draft: browser storage is unavailable.', true);
        }
    });
}

function download(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

// --- Boot -----------------------------------------------------------------

function refresh() {
    design = applyPriceBookToDesign('lighting', designLighting(plan));
    if (selectedId && !plan.devices.some((device) => device.id === selectedId)) selectedId = null;
    renderMetrics();
    renderChecks();
    renderSwitchList();
    renderInspector();
    renderSchedule();
    renderTakeoff();
    if (activeTab === 'rules') renderRules();
    drawPlan();
    scheduleSave();
}

function boot() {
    populateSelects();
    syncRoomFields();
    $('luminaire-type').value = selectedLuminaire;
    wireTabs();
    wireTools();
    wireCanvas();
    wireSidebar();
    refresh();
    const observer = new ResizeObserver(() => {
        if (activeTab === 'design') resizeCanvas();
    });
    observer.observe(canvas.parentElement);
    window.requestAnimationFrame(resizeCanvas);
    window.addEventListener('beforeunload', () => {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(plan)); } catch (error) { /* ignore */ }
    });
    if (!$('rules-list').childElementCount) renderRules();
    if (!$('glossary-list').childElementCount) renderGlossary();
    $('glossary-count').textContent = `${glossaryByCategory().reduce((sum, group) => sum + group.entries.length, 0)} terms`;

    // A small read/write handle for tests and for other suites that want to
    // inspect the finished plan without reaching into the DOM.
    window.lightingSuite = {
        get plan() { return plan; },
        get design() { return design; },
        get tool() { return tool; },
        setRoom(roomType) {
            const current = $('room-type');
            current.value = roomType;
            current.dispatchEvent(new Event('change'));
        },
        autoDesign() { autoDesignPlan(plan); refresh(); },
        refresh,
        add(kind, typeId, x, y) {
            const previous = tool;
            tool = kind;
            const select = kind === 'luminaire' ? $('luminaire-type') : kind === 'switch' ? $('switch-type') : $('socket-type');
            if (typeId) select.value = typeId;
            addAt({ x, y });
            tool = previous;
            return plan.devices[plan.devices.length - 1];
        },
        remove(id) { removeDevice(plan, id); refresh(); },
        fit() { camera = { zoom: 1, panX: 0, panY: 0 }; drawPlan(); },
        exportCsv: () => designCsv(design),
        exportTakeoffCsv: () => design.bom.rows
    };
}

boot();
