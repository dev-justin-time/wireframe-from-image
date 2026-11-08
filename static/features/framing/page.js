import {
    FRAMING_DEFAULTS,
    PRECUT_STUDS,
    SHEATHING,
    SPECIES,
    STUD_SIZES,
    STUD_SPACINGS_IN,
    SUBFLOOR
} from './catalog.js';
import {
    CALCULATOR_BY_ID,
    CALCULATORS,
    calculatorsByGroup,
    computeCalculator,
    defaultValues,
    searchCalculators
} from './calculators.js';
import {
    computeFramingDesign,
    frameWall,
    ftIn,
    framingCutListCsv,
    framingScheduleCsv,
    framingTakeoffCsv,
    wallLengthM
} from './engine.js';
import { writeDraft } from '../../core/drafts.js';
import { applyPriceBookToDesign } from '../pricing/book.js';
import {
    drawFramingPlan,
    drawWallElevation,
    planTransform,
    snapPlanPoint,
    wallAt
} from './plan.js';
import {
    BUILD_SEQUENCE,
    CODE_SCOPE,
    FORMULAS,
    FRAMING_SYSTEMS,
    GLOSSARY,
    GRADE_TABLE,
    RULE_CATEGORIES,
    RULES,
    ruleStatus,
    searchRules
} from './rules.js';

/**
 * Framing suite page controller.
 *
 * One config drives everything: the plan, the wall elevation, the schedule, the
 * cut list, the takeoff and the code checks all read the same design object, so
 * moving a stud spacing changes the drawing, the quantity and the price in the
 * same frame. Storeys are independent wall sets, which is what lets the suite
 * frame a two- or three-storey plan and hand the stack to the editor.
 */

const DRAFT_KEY = 'framing-suite-draft';
const EDITOR_KEY = 'framing-editor-draft';
const FT = 0.3048;

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(idCounter += 1)}`;

let statusTimer = null;
let saveTimer = null;

function setStatus(message, error = false) {
    const node = $('status');
    if (!node) return;
    node.textContent = message;
    node.className = `text-[10px] min-h-[1rem] ${error ? 'text-red-600' : 'text-amber-700'}`;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { node.textContent = ''; }, 4200);
}

function newWall(x1, z1, x2, z2, exterior = false, name = null, openings = []) {
    return {
        id: nextId('wall'),
        name: name || 'Wall',
        x1, z1, x2, z2,
        exterior,
        openings
    };
}

function newOpening(type = 'window', patch = {}) {
    return {
        id: nextId('opening'),
        type,
        widthM: type === 'door' ? 0.9144 : 1.2192,
        heightM: type === 'door' ? 2.032 : 1.2192,
        sillM: type === 'door' ? 0 : 0.9144,
        offsetM: 1.5,
        ...patch
    };
}

function rectangleWalls(widthFt, depthFt, prefix = 'Ground', openings = true) {
    const W = Math.max(4, Number(widthFt) || 32) * FT;
    const D = Math.max(4, Number(depthFt) || 24) * FT;
    const front = newWall(0, 0, W, 0, true, `${prefix} front`, openings
        ? [newOpening('door', { widthM: 0.9144, heightM: 2.032, offsetM: Math.min(W - 1.5, 2.4) }),
           newOpening('window', { widthM: 1.8, heightM: 1.2, sillM: 0.9, offsetM: W * 0.55 })]
        : []);
    const right = newWall(W, 0, W, D, true, `${prefix} right`, openings
        ? [newOpening('window', { widthM: 1.2192, heightM: 1.2, sillM: 0.9, offsetM: D / 2 })]
        : []);
    const back = newWall(W, D, 0, D, true, `${prefix} back`, openings
        ? [newOpening('window', { widthM: 1.8, heightM: 1.2, sillM: 0.9, offsetM: W * 0.35 })]
        : []);
    const left = newWall(0, D, 0, 0, true, `${prefix} left`, openings
        ? [newOpening('window', { widthM: 1.2192, heightM: 1.2, sillM: 0.9, offsetM: D / 2 })]
        : []);
    const partition = newWall(W / 2, 0, W / 2, D, false, `${prefix} partition`,
        openings ? [newOpening('door', { widthM: 0.9144, heightM: 2.032, offsetM: D / 2 })] : []);
    return [front, right, back, left, partition];
}

function defaultConfig() {
    const ground = rectangleWalls(32, 24, 'Ground');
    return {
        ...FRAMING_DEFAULTS,
        footprintFt: { width: 32, depth: 24 },
        storeys: [
            { id: 'storey-ground', name: 'Ground floor', studLengthIn: 92.5, topPlates: 2, walls: ground },
            {
                id: 'storey-first',
                name: 'First floor',
                studLengthIn: 92.5,
                topPlates: 2,
                walls: rectangleWalls(32, 24, 'First').map((wall, index) => ({
                    ...wall,
                    id: `first-${index + 1}`,
                    openings: wall.openings.map((opening) => ({
                        ...opening,
                        id: `first-opening-${index + 1}-${opening.type}`,
                        // The upper storey gets a window where the door is below.
                        ...(opening.type === 'door' ? { type: 'window', sillM: 0.9, heightM: 1.2 } : {})
                    }))
                }))
            }
        ]
    };
}

function loadConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (saved && Array.isArray(saved.storeys) && saved.storeys.length) {
            return {
                ...FRAMING_DEFAULTS,
                ...saved,
                footprintFt: saved.footprintFt || { width: 32, depth: 24 },
                storeys: saved.storeys.map((storey, index) => ({
                    ...storey,
                    id: storey.id || `storey-${index + 1}`,
                    name: storey.name || `Floor ${index + 1}`,
                    studLengthIn: Number(storey.studLengthIn) || 92.5,
                    topPlates: Number(storey.topPlates) || 2,
                    walls: (storey.walls || []).map((wall) => ({
                        ...wall,
                        id: wall.id || nextId('wall'),
                        openings: (wall.openings || []).map((opening) => ({
                            ...opening,
                            id: opening.id || nextId('opening')
                        }))
                    }))
                }))
            };
        }
    } catch {
        // A corrupt draft falls back to the default two-storey plan.
    }
    return defaultConfig();
}

let config = loadConfig();
let design = applyPriceBookToDesign('framing', computeFramingDesign(config));
let storeyIndex = 0;
let selectedWallId = design.storeys[0]?.walls?.[0]?.id || null;
let selectedOpeningId = null;
let activeTab = 'plan';
let tool = 'select';
let view = { zoom: 1 };
let showAllChecks = false;
let ruleQuery = '';
let ruleCategory = 'all';
let ruleIssuesOnly = false;
let glossaryQuery = '';
let activeCalculator = 'lumber-span';
let calcValues = defaultValues(activeCalculator);
let calcQuery = '';
const openRules = new Set(['stud-size-height', 'header-span', 'rough-opening']);

const NUMERIC_CONFIG = ['studSpacingIn', 'studLengthIn', 'topPlates', 'blockingRows', 'waste', 'floorSpanFt', 'anchorSpacingFt', 'labourRate'];

function refresh({ save = true } = {}) {
    design = applyPriceBookToDesign('framing', computeFramingDesign(config));
    const active = design.storeys[Math.min(storeyIndex, design.storeys.length - 1)];
    // An explicit deselection stays deselected; only a wall that disappeared
    // (deleted, or replaced by the rectangle builder) clears the selection.
    if (selectedWallId && !active?.walls.some((wall) => wall.id === selectedWallId)) {
        selectedWallId = null;
    }
    if (selectedOpeningId && !active?.walls.some((wall) => wall.openings.some((opening) => opening.id === selectedOpeningId))) {
        selectedOpeningId = null;
    }
    renderStoreys();
    renderMetrics();
    renderInspector();
    renderChecks();
    renderSchedule();
    renderCutList();
    renderTakeoff();
    renderRules();
    syncInputs();
    if (activeTab === 'plan') window.requestAnimationFrame(draw);
    if (save) queueSave();
}

function queueSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
        } catch {
            setStatus('Could not save the design locally.', true);
        }
    }, 200);
}

function syncInputs() {
    const set = (id, value) => {
        const node = $(id);
        if (node) node.value = String(value);
    };
    set('fp-width', config.footprintFt?.width ?? 32);
    set('fp-depth', config.footprintFt?.depth ?? 24);
    set('f-stud', config.studSize);
    set('f-spacing', config.studSpacingIn);
    set('f-length', config.studLengthIn);
    set('f-plates', config.topPlates);
    set('f-species', config.species);
    set('f-sheathing', config.sheathing);
    set('f-subfloor', config.subfloor);
    set('f-blocking', config.blockingRows);
    set('f-waste', Math.round(config.waste * 100));
    set('f-floor-span', config.floorSpanFt);
    const checked = (id, value) => { const node = $(id); if (node) node.checked = Boolean(value); };
    checked('f-ext-sheath', config.exteriorSheathing);
    checked('f-int-sheath', config.interiorSheathing);
    checked('f-balloon', config.balloon);
    checked('f-wrap', config.houseWrap);
    checked('f-treated', config.bottomTreated);
    checked('f-anchors', config.anchorBolts);
    const activeStorey = config.storeys[storeyIndex];
    set('storey-name', activeStorey?.name || '');
    set('storey-height', activeStorey?.studLengthIn ?? 92.5);
    set('f-length', activeStorey?.studLengthIn ?? config.studLengthIn);
    $('plan-note').textContent = `${config.studSize} studs @ ${config.studSpacingIn} in on center · ${config.studLengthIn} in precut · ${config.topPlates === 2 ? 'double' : 'single'} top plate · ${ftIn(design.storeys[storeyIndex]?.heightM || 0)} wall`;
}

// ---------------------------------------------------------------------------
// Storeys
// ---------------------------------------------------------------------------

function renderStoreys() {
    const list = $('storey-list');
    if (!list) return;
    list.innerHTML = design.storeys.map((storey, index) => `
        <button data-storey="${index}" class="flex-1 min-w-[86px] rounded border px-2 py-1 text-left ${index === storeyIndex ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:bg-slate-50'}">
            <span class="block text-[11px] font-semibold truncate">${escapeHtml(storey.name)}</span>
            <span class="block text-[9px] font-mono ${index === storeyIndex ? 'text-slate-300' : 'text-slate-400'}">${storey.walls.length} walls · ${storey.studs} studs · ${ftIn(storey.heightM)}</span>
        </button>
    `).join('');
    $('remove-storey').disabled = design.storeys.length <= 1;
    $('copy-storey').disabled = storeyIndex === 0;
}

function setStoreyField(key, value) {
    const storey = config.storeys[storeyIndex];
    if (!storey) return;
    config = {
        ...config,
        storeys: config.storeys.map((entry, index) => (
            index === storeyIndex ? { ...entry, [key]: value } : entry
        ))
    };
    refresh();
}

// ---------------------------------------------------------------------------
// Inspector
// ---------------------------------------------------------------------------

function selectedWall() {
    return design.storeys[storeyIndex]?.walls.find((wall) => wall.id === selectedWallId) || null;
}

function renderInspector() {
    const wall = selectedWall();
    const panel = $('wall-inspector');
    if (!panel) return;
    if (!wall) {
        panel.innerHTML = '<p class="text-[11px] text-slate-400">Select a wall on the plan, or drag on an empty area to draw one.</p>';
        $('add-door').disabled = true;
        $('add-window').disabled = true;
        $('delete-wall').disabled = true;
        return;
    }
    $('add-door').disabled = false;
    $('add-window').disabled = false;
    $('delete-wall').disabled = false;
    const source = config.storeys[storeyIndex].walls.find((entry) => entry.id === wall.id);
    panel.innerHTML = `
        <div class="flex items-center gap-2">
            <input id="sel-name" value="${escapeHtml(source?.name || wall.name)}" class="flex-1 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-semibold">
            <label class="flex items-center gap-1 text-[10px] text-slate-500"><input id="sel-exterior" type="checkbox" ${wall.exterior ? 'checked' : ''}> exterior</label>
        </div>
        <p class="text-[10px] font-mono text-slate-500 mt-1">${ftIn(wall.lengthM)} long · ${ftIn(wall.heightM)} high · ${wall.counts.studs} studs · ${wall.counts.kings} kings · ${wall.counts.jacks} jacks · ${wall.counts.cripples} cripples${wall.sheathed ? ` · ${wall.sheathing.sheets} sheets` : ''}</p>
        <div class="mt-2">
            <p class="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-1">Openings</p>
            <div id="openings-list" class="space-y-1.5">
                ${wall.openings.length ? wall.openings.map((opening) => openingRow(opening)).join('') : '<p class="text-[10px] text-slate-400">No openings on this wall.</p>'}
            </div>
        </div>
        ${wall.openings.length ? `<p class="text-[10px] text-slate-400 mt-2 leading-snug">Headers: ${wall.openings.map((opening) => `${ftIn(opening.widthM)} → ${opening.header.size === 'LVL' ? 'engineered LVL' : `${opening.header.plies} ply ${opening.header.size}`}`).join(' · ')}</p>` : ''}
    `;
}

function openingRow(opening) {
    const unit = (value) => round(value / FT, 2);
    return `
        <div class="rounded border border-slate-200 px-1.5 py-1 ${opening.id === selectedOpeningId ? 'ring-1 ring-amber-500' : ''}" data-opening="${escapeHtml(opening.id)}">
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold ${opening.type === 'door' ? 'text-amber-700' : 'text-slate-600'}">${opening.type.toUpperCase()} ${ftIn(opening.widthM)} × ${ftIn(opening.heightM)}</span>
                <button data-remove-opening="${escapeHtml(opening.id)}" class="text-[10px] text-red-600 hover:underline">remove</button>
            </div>
            <div class="grid grid-cols-4 gap-1 mt-1">
                <label class="text-[9px] text-slate-400">w ft<input data-opening-field="widthFt" value="${unit(opening.widthM)}" type="number" min="0.5" step="0.1" class="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] font-mono"></label>
                <label class="text-[9px] text-slate-400">h ft<input data-opening-field="heightFt" value="${unit(opening.heightM)}" type="number" min="0.5" step="0.1" class="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] font-mono"></label>
                <label class="text-[9px] text-slate-400">sill ft<input data-opening-field="sillFt" value="${unit(opening.sillM)}" type="number" min="0" step="0.1" class="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] font-mono"></label>
                <label class="text-[9px] text-slate-400">pos ft<input data-opening-field="offsetFt" value="${round(opening.centreM / FT, 2)}" type="number" min="0" step="0.1" class="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] font-mono"></label>
            </div>
            <p class="text-[9px] text-slate-400 mt-0.5 leading-snug">${escapeHtml(opening.header.note)}</p>
        </div>
    `;
}

function patchWall(wallId, patch) {
    config = {
        ...config,
        storeys: config.storeys.map((storey, index) => (
            index !== storeyIndex ? storey : {
                ...storey,
                walls: storey.walls.map((wall) => (wall.id === wallId ? { ...wall, ...patch } : wall))
            }
        ))
    };
    refresh();
}

function patchOpening(wallId, openingId, patch) {
    config = {
        ...config,
        storeys: config.storeys.map((storey, index) => (
            index !== storeyIndex ? storey : {
                ...storey,
                walls: storey.walls.map((wall) => (
                    wall.id !== wallId ? wall : {
                        ...wall,
                        openings: wall.openings.map((opening) => (
                            opening.id === openingId ? { ...opening, ...patch } : opening
                        ))
                    }
                ))
            }
        ))
    };
    refresh();
}

function addOpening(type) {
    const wall = selectedWall();
    if (!wall) return;
    const source = config.storeys[storeyIndex].walls.find((entry) => entry.id === wall.id);
    const count = source.openings.length;
    const offset = Math.min(
        Math.max(wall.lengthM - 1.5, 1.5),
        wall.lengthM / 2 + (count % 2 === 0 ? 0 : 0.9) - (count > 1 ? 0.9 : 0)
    );
    const opening = newOpening(type, {
        offsetM: Math.max(1.2, Math.min(offset, wall.lengthM - 0.8)),
        ...(type === 'window' ? { sillM: 0.9144 } : { sillM: 0, heightM: 2.032 })
    });
    config = {
        ...config,
        storeys: config.storeys.map((storey, index) => (
            index !== storeyIndex ? storey : {
                ...storey,
                walls: storey.walls.map((wallEntry) => (
                    wallEntry.id === wall.id ? { ...wallEntry, openings: [...wallEntry.openings, opening] } : wallEntry
                ))
            }
        ))
    };
    selectedOpeningId = opening.id;
    refresh();
}

function removeSelectedWall() {
    const wall = selectedWall();
    if (!wall) return;
    config = {
        ...config,
        storeys: config.storeys.map((storey, index) => (
            index !== storeyIndex ? storey : { ...storey, walls: storey.walls.filter((entry) => entry.id !== wall.id) }
        ))
    };
    selectedWallId = null;
    refresh();
}

// ---------------------------------------------------------------------------
// Metrics and checks
// ---------------------------------------------------------------------------

function renderMetrics() {
    $('m-walls').textContent = `${design.metrics.walls}`;
    $('m-studs').textContent = `${design.metrics.studs}`;
    $('m-sheets').textContent = `${design.metrics.sheets}`;
    $('m-floor').textContent = `${design.metrics.floorAreaM2} m²`;
    $('m-material').textContent = `$${design.metrics.material.toFixed(0)}`;
    $('m-total').textContent = `$${design.metrics.total.toFixed(0)}`;
    $('metric-sub').textContent = `${design.metrics.linearM} m of wall · ${design.metrics.boardFeet} bf · ${design.metrics.labour ? `$${design.metrics.labour.toFixed(0)} labour` : ''}`;
    const summary = $('check-summary');
    summary.textContent = design.ok
        ? `All modelled checks pass${design.warnings ? ` · ${design.warnings} to review` : ''}`
        : `${design.errors} error${design.errors === 1 ? '' : 's'} · ${design.warnings} to review`;
    summary.className = `text-[10px] font-mono mt-1 ${design.ok ? 'text-emerald-700' : 'text-red-600'}`;
}

function checkRows() {
    const flagged = design.checks.filter((check) => check.severity !== 'ok' && check.severity !== 'info');
    if (showAllChecks) return design.checks;
    return flagged.length ? flagged : design.checks.filter((check) => check.severity === 'ok');
}

function renderChecks() {
    const rows = checkRows();
    $('checks').innerHTML = rows.length ? rows.map((check) => {
        const icon = check.severity === 'error' ? '✖' : check.severity === 'warn' ? '⚠' : check.severity === 'ok' ? '✓' : '·';
        return `<li class="severity-${check.severity} flex items-start gap-1.5"><span class="shrink-0 font-bold">${icon}</span><span><b>${escapeHtml(check.label)}.</b> ${escapeHtml(check.message)} <span class="text-slate-400">${escapeHtml(check.rule)}</span></span></li>`;
    }).join('') : '<li class="severity-ok">✓ Every modelled check passes.</li>';
    $('show-all-checks').textContent = showAllChecks ? 'Show only issues' : 'Show all checks';
    $('issue-count').textContent = `${design.checks.filter((check) => check.severity === 'error' || check.severity === 'warn').length} issues`;
}

// ---------------------------------------------------------------------------
// Tables and exports
// ---------------------------------------------------------------------------

function table(headers, rows, aligns = []) {
    const head = headers.map((label, index) => `<th class="text-left px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500 ${aligns[index] === 'right' ? 'text-right' : ''}">${escapeHtml(label)}</th>`).join('');
    const body = rows.map((row) => `<tr class="border-t border-slate-100">${row.map((cell, index) => `<td class="px-2 py-1 text-[11px] ${aligns[index] === 'right' ? 'text-right font-mono' : ''}">${cell}</td>`).join('')}</tr>`).join('');
    return `<table class="w-full border-collapse"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}" class="px-2 py-3 text-[11px] text-slate-400">No rows</td></tr>`}</tbody></table>`;
}

function renderSchedule() {
    $('schedule-summary').textContent = `${design.storeys.length} storeys · ${design.metrics.walls} walls · ${design.metrics.linearM} m · ${design.studSize || design.config.studSize} @ ${design.config.studSpacingIn} in`;
    const rows = design.storeys.flatMap((storey) => storey.walls.map((wall) => {
        const worst = wall.openings.reduce((entry, opening) => (
            !entry || opening.header.utilisation > entry.header.utilisation ? opening : entry
        ), null);
        return [
            escapeHtml(storey.name),
            escapeHtml(wall.name),
            wall.exterior ? 'exterior' : 'partition',
            round(wall.lengthM / FT, 1),
            wall.counts.studs,
            wall.counts.kings,
            wall.counts.jacks,
            wall.counts.cripples,
            worst ? escapeHtml(worst.header.size === 'LVL' ? 'LVL' : `${worst.header.plies}-${worst.header.size}`) : '—',
            wall.sheathing.sheets
        ];
    }));
    $('schedule-body').innerHTML = table(
        ['Storey', 'Wall', 'Type', 'Length ft', 'Studs', 'Kings', 'Jacks', 'Cripples', 'Header', 'Sheets'],
        rows,
        ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'left', 'right']
    );
}

function renderCutList() {
    $('cutlist-summary').textContent = `${design.cutRows.length} member types · ${design.cutRows.reduce((sum, row) => sum + row.count, 0)} pieces · ${config.studLengthIn} in precut studs`;
    const rows = design.cutRows.map((row) => [
        escapeHtml(row.label),
        escapeHtml(row.size),
        `${row.lengthIn}"`,
        round(row.lengthM, 2),
        row.count,
        `<span class="text-slate-500">${escapeHtml(row.note)}</span>`
    ]);
    $('cutlist-body').innerHTML = table(['Member', 'Size', 'Length in', 'Length m', 'Qty', 'Note'], rows, ['left', 'left', 'right', 'right', 'right', 'left']);
}

function renderTakeoff() {
    $('takeoff-cards').innerHTML = [
        ['Storeys', `${design.storeys.length}`],
        ['Wall length', `${design.metrics.linearM} m`],
        ['Studs', `${design.metrics.studs}`],
        ['Sheathing', `${design.metrics.sheets} sheets`],
        ['Floor', `${design.metrics.floorAreaM2} m²`],
        ['Total', `$${design.bom.total.toFixed(0)}`]
    ].map(([label, value]) => `<div class="rounded-lg border border-slate-200 px-3 py-2"><p class="text-[10px] uppercase tracking-wide text-slate-400">${escapeHtml(label)}</p><p class="text-sm font-mono font-semibold">${escapeHtml(value)}</p></div>`).join('');

    const rows = design.bom.rows.map((row) => [
        escapeHtml(row.group),
        escapeHtml(row.item),
        `${row.qty} ${escapeHtml(row.unit)}`,
        `$${row.unitCost.toFixed(2)}`,
        `$${row.cost.toFixed(2)}`,
        `<span class="text-slate-500">${escapeHtml(row.note)}</span>`
    ]);
    rows.push(['', '<b>Material</b>', '', '', `<b>$${design.bom.material.toFixed(2)}</b>`, '']);
    rows.push(['', '<b>Labour</b>', `${design.bom.hours} hr`, '', `<b>$${design.bom.labour.toFixed(2)}</b>`, '']);
    rows.push(['', '<b>Total</b>', '', '', `<b>$${design.bom.total.toFixed(2)}</b>`, '']);
    $('takeoff-bom').innerHTML = table(['Group', 'Item', 'Qty', 'Unit cost', 'Cost', 'Note'], rows, ['left', 'left', 'right', 'right', 'right', 'left']);

    $('takeoff-notes').innerHTML = [
        `Prices are planning allowances in USD, priced by cut length and stock; replace them with the supplier quote before the bid.`,
        `${design.metrics.studs} studs, kings, jacks and cripples across ${design.metrics.linearM} m of wall.`,
        `${design.metrics.sheets} sheets of sheathing and subfloor; add 8% cut waste by default.`,
        'The floor joists assume a mid-span girder once a single sawn joist runs out; add posts and footings below it.',
        'Treated sole plate, sill seal and anchor bolts are included; the foundation itself is not.'
    ].map((note) => `<li>${escapeHtml(note)}</li>`).join('');
}

// ---------------------------------------------------------------------------
// Rules and reference
// ---------------------------------------------------------------------------

function renderRules() {
    const rules = searchRules(ruleQuery).filter((rule) => {
        const status = ruleStatus(rule, design.checks);
        return (ruleCategory === 'all' || rule.category === ruleCategory)
            && (!ruleIssuesOnly || status.state === 'error' || status.state === 'warn');
    });
    $('rules-summary').textContent = `${rules.length} of ${RULES.length} rules · ${design.errors} failing`;
    $('rules-chips').innerHTML = [{ id: 'all', label: 'All' }, ...RULE_CATEGORIES]
        .map((category) => `<button class="chip px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-semibold ${ruleCategory === category.id ? 'active' : ''}" data-category="${escapeHtml(category.id)}">${escapeHtml(category.label)}</button>`)
        .join('');
    $('rules-list').innerHTML = rules.map((rule) => {
        const status = ruleStatus(rule, design.checks);
        const open = openRules.has(rule.id);
        const tone = status.state === 'error' ? 'severity-error' : status.state === 'warn' ? 'severity-warn' : status.state === 'ok' ? 'severity-ok' : 'severity-info';
        return `
            <article class="rule ${open ? 'open' : ''} rounded-lg border border-slate-200" data-rule="${escapeHtml(rule.id)}">
                <button class="rule-head w-full flex items-start gap-2 px-3 py-2 text-left">
                    <span class="rule-caret text-slate-400 text-[10px] mt-0.5">▶</span>
                    <span class="flex-1">
                        <span class="block text-[12px] font-semibold">${escapeHtml(rule.title)}</span>
                        <span class="block text-[10px] font-mono text-slate-400">${escapeHtml(rule.code)}</span>
                    </span>
                    <span class="text-[10px] font-bold ${tone}">${escapeHtml(status.label.toUpperCase())}</span>
                </button>
                <div class="rule-body px-3 pb-3 text-[11px] text-slate-600 leading-snug">
                    <p>${escapeHtml(rule.summary)}</p>
                    <ul class="mt-1.5 space-y-0.5 list-disc pl-4">${(rule.requirements || []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
                </div>
            </article>
        `;
    }).join('') || '<p class="text-[11px] text-slate-400">No rule matches that search.</p>';
}

function renderReference() {
    $('sequence-list').innerHTML = BUILD_SEQUENCE.map((step) => `
        <article class="flex gap-2">
            <span class="shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">${escapeHtml(step.step)}</span>
            <div><h3 class="text-[12px] font-semibold">${escapeHtml(step.title)}</h3><p class="text-[11px] text-slate-600 leading-snug">${escapeHtml(step.detail)}</p></div>
        </article>
    `).join('');
    $('systems-list').innerHTML = FRAMING_SYSTEMS.map((system) => `
        <article class="rounded-lg border border-slate-200 p-2.5">
            <div class="flex items-center justify-between">
                <h3 class="text-[12px] font-semibold">${escapeHtml(system.label)}</h3>
                <span class="text-[9px] font-bold uppercase tracking-wide ${system.default ? 'text-emerald-700' : 'text-slate-400'}">${system.default ? 'default' : 'historic'}</span>
            </div>
            <p class="text-[11px] text-slate-600 leading-snug mt-1">${escapeHtml(system.summary)}</p>
            <ul class="text-[10px] text-slate-500 leading-snug mt-1.5 list-disc pl-4">${system.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
            <p class="text-[10px] text-amber-700 leading-snug mt-1.5"><b>Watch:</b> ${system.watch.map(escapeHtml).join(' ')}</p>
        </article>
    `).join('');
    $('grade-body').innerHTML = table(['Grade', 'Typical use', 'Fb', 'E'], GRADE_TABLE.map((row) => [
        `<b>${escapeHtml(row.grade)}</b>`, escapeHtml(row.use), escapeHtml(row.fb), escapeHtml(row.e)
    ]));
    $('formula-list').innerHTML = table(['Quantity', 'Formula', 'Note'], FORMULAS.map((entry) => [
        `<b>${escapeHtml(entry.label)}</b>`,
        `<code class="font-mono text-[10px]">${escapeHtml(entry.expression)}</code>`,
        `<span class="text-slate-500">${escapeHtml(entry.note)}</span>`
    ]));
    renderGlossary();
    $('code-scope').textContent = CODE_SCOPE.body;
    $('code-title').textContent = CODE_SCOPE.title;
}

function renderGlossary() {
    const term = glossaryQuery.trim().toLowerCase();
    const terms = term
        ? GLOSSARY.filter((entry) => [entry.term, entry.short, entry.detail, entry.category].join(' ').toLowerCase().includes(term))
        : GLOSSARY;
    $('glossary-count').textContent = `${terms.length} terms`;
    $('glossary-list').innerHTML = terms.map((entry) => `
        <article class="border-b border-slate-100 pb-1.5">
            <h3 class="text-[12px] font-semibold">${escapeHtml(entry.term)} <span class="text-[9px] uppercase tracking-wide text-slate-400 ml-1">${escapeHtml(entry.category)}</span></h3>
            <p class="text-[11px] text-slate-600 leading-snug">${escapeHtml(entry.short)}</p>
            <p class="text-[10px] text-slate-400 leading-snug">${escapeHtml(entry.detail)}</p>
        </article>
    `).join('') || '<p class="text-[11px] text-slate-400">No term matches that search.</p>';
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function canvasPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function draw() {
    drawPlan();
    drawElevation();
}

function drawPlan() {
    const canvas = $('plan');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    canvas.height = Math.max(260, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFramingPlan(ctx, rect.width, rect.height, design, {
        storeyIndex,
        selectedWallId,
        view,
        show: { studs: true, openings: true, dimensions: true, labels: true }
    });
    drawDragPreview(ctx, rect.width, rect.height);
}

function drawElevation() {
    const canvas = $('elevation');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(260, Math.floor(rect.width * dpr));
    canvas.height = Math.max(180, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const frame = selectedWall() || design.storeys[storeyIndex]?.walls[0] || null;
    drawWallElevation(ctx, rect.width, rect.height, frame, { selectedOpeningId });
}

let drag = null;
let drawStart = null;

function drawDragPreview(ctx, width, height) {
    if (!drag || !drawStart || tool !== 'draw') return;
    const transform = planTransform(width, height, design.storeys[storeyIndex]?.walls || [], view);
    const a = transform.toScreen(drawStart.x, drawStart.z);
    const b = transform.toScreen(drag.x, drag.z);
    ctx.save();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b45309';
    ctx.font = '10px ui-monospace, monospace';
    const length = Math.hypot(drag.x - drawStart.x, drag.z - drawStart.z);
    ctx.fillText(ftIn(length), (a.x + b.x) / 2 + 6, (a.y + b.y) / 2 - 6);
    ctx.restore();
}

function wirePlan() {
    const canvas = $('plan');
    if (!canvas) return;

    canvas.addEventListener('pointerdown', (event) => {
        const point = canvasPoint(event, canvas);
        const transform = planTransform(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height, design.storeys[storeyIndex]?.walls || [], view);
        const world = transform.toWorld(point.x, point.y);
        if (tool === 'draw') {
            canvas.setPointerCapture(event.pointerId);
            drawStart = snapPlanPoint(world, design.storeys[storeyIndex]?.walls || []);
            drag = { ...drawStart };
            draw();
            return;
        }
        const hit = wallAt(design.storeys[storeyIndex]?.walls || [], world);
        selectedWallId = hit?.id || null;
        selectedOpeningId = null;
        refresh({ save: false });
    });

    canvas.addEventListener('pointermove', (event) => {
        if (!drag) return;
        const point = canvasPoint(event, canvas);
        const rect = canvas.getBoundingClientRect();
        const transform = planTransform(rect.width, rect.height, design.storeys[storeyIndex]?.walls || [], view);
        const world = transform.toWorld(point.x, point.y);
        drag = snapPlanPoint(world, design.storeys[storeyIndex]?.walls || []);
        draw();
    });

    const finish = (event) => {
        if (!drag) return;
        const start = drawStart;
        const end = drag;
        drag = null;
        drawStart = null;
        if (tool === 'draw' && start && Math.hypot(end.x - start.x, end.z - start.z) > 0.45) {
            const wall = newWall(start.x, start.z, end.x, end.z, false, `Wall ${(design.storeys[storeyIndex]?.walls.length || 0) + 1}`);
            config = {
                ...config,
                storeys: config.storeys.map((storey, index) => (
                    index !== storeyIndex ? storey : { ...storey, walls: [...storey.walls, wall] }
                ))
            };
            selectedWallId = wall.id;
            refresh();
        } else {
            draw();
        }
        if (event?.pointerId != null && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);

    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        view = { zoom: Math.min(2.6, Math.max(0.5, view.zoom * (event.deltaY < 0 ? 1.1 : 0.9))) };
        draw();
    }, { passive: false });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function download(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function wireSidebar() {
    $('storey-list').addEventListener('click', (event) => {
        const button = event.target.closest('[data-storey]');
        if (!button) return;
        storeyIndex = Number(button.dataset.storey);
        selectedWallId = design.storeys[storeyIndex]?.walls?.[0]?.id || null;
        selectedOpeningId = null;
        refresh({ save: false });
    });

    $('add-storey').addEventListener('click', () => {
        const previous = config.storeys[config.storeys.length - 1];
        const walls = previous.walls.map((wall) => ({
            ...wall,
            id: nextId('wall'),
            name: wall.name.replace(/^.*?(front|back|left|right|partition)/i, `Floor ${config.storeys.length + 1} $1`),
            openings: wall.openings.map((opening) => ({ ...opening, id: nextId('opening') }))
        }));
        config = {
            ...config,
            storeys: [...config.storeys, {
                id: nextId('storey'),
                name: `Floor ${config.storeys.length + 1}`,
                studLengthIn: config.studLengthIn,
                topPlates: config.topPlates,
                walls
            }]
        };
        storeyIndex = config.storeys.length - 1;
        selectedWallId = config.storeys[storeyIndex].walls[0]?.id || null;
        refresh();
        setStatus(`Added ${config.storeys[storeyIndex].name}.`);
    });

    $('copy-storey').addEventListener('click', () => {
        const source = config.storeys[storeyIndex - 1];
        if (!source) return;
        config = {
            ...config,
            storeys: config.storeys.map((storey, index) => (
                index !== storeyIndex ? storey : {
                    ...storey,
                    walls: source.walls.map((wall) => ({
                        ...wall,
                        id: nextId('wall'),
                        openings: wall.openings.map((opening) => ({ ...opening, id: nextId('opening') }))
                    }))
                }
            ))
        };
        selectedWallId = null;
        refresh();
        setStatus('Copied the walls from the storey below.');
    });

    $('remove-storey').addEventListener('click', () => {
        if (config.storeys.length <= 1) return;
        config = {
            ...config,
            storeys: config.storeys.filter((_, index) => index !== storeyIndex)
        };
        storeyIndex = Math.min(storeyIndex, config.storeys.length - 1);
        selectedWallId = null;
        refresh();
    });

    $('rebuild-rect').addEventListener('click', () => {
        const widthFt = Number($('fp-width').value) || 32;
        const depthFt = Number($('fp-depth').value) || 24;
        config = {
            ...config,
            footprintFt: { width: widthFt, depth: depthFt },
            storeys: config.storeys.map((storey, index) => (
                index !== storeyIndex ? storey : { ...storey, walls: rectangleWalls(widthFt, depthFt, storey.name.split(' ')[0]) }
            ))
        };
        selectedWallId = null;
        refresh();
        setStatus(`Rebuilt ${config.storeys[storeyIndex].name} from a ${widthFt} × ${depthFt} ft footprint.`);
    });

    const configFields = [
        ['f-stud', 'studSize', 'text'],
        ['f-spacing', 'studSpacingIn', 'number'],
        ['f-length', 'studLengthIn', 'number'],
        ['f-plates', 'topPlates', 'number'],
        ['f-species', 'species', 'text'],
        ['f-sheathing', 'sheathing', 'text'],
        ['f-subfloor', 'subfloor', 'text'],
        ['f-blocking', 'blockingRows', 'number'],
        ['f-floor-span', 'floorSpanFt', 'number'],
        ['f-waste', 'waste', 'percent']
    ];
    configFields.forEach(([id, key, type]) => {
        const node = $(id);
        if (!node) return;
        node.addEventListener('change', () => {
            const raw = type === 'percent' ? Number(node.value) / 100 : type === 'number' ? Number(node.value) : node.value;
            const value = NUMERIC_CONFIG.includes(key) ? Number(raw) : raw;
            // The precut length belongs to the storey as well as the building,
            // so changing it here re-cuts every wall in the stack.
            if (key === 'studLengthIn') {
                config = {
                    ...config,
                    studLengthIn: value,
                    storeys: config.storeys.map((storey) => ({ ...storey, studLengthIn: value }))
                };
            } else {
                config = { ...config, [key]: value };
            }
            refresh();
        });
    });
    [['f-ext-sheath', 'exteriorSheathing'], ['f-int-sheath', 'interiorSheathing'], ['f-wrap', 'houseWrap'],
        ['f-treated', 'bottomTreated'], ['f-anchors', 'anchorBolts'], ['f-balloon', 'balloon']].forEach(([id, key]) => {
        $(id)?.addEventListener('change', () => {
            config = { ...config, [key]: Boolean($(id).checked) };
            refresh();
        });
    });

    $('wall-inspector').addEventListener('change', (event) => {
        const wall = selectedWall();
        if (!wall) return;
        if (event.target.id === 'sel-name') {
            patchWall(wall.id, { name: event.target.value.trim() || wall.name });
        }
        if (event.target.id === 'sel-exterior') {
            patchWall(wall.id, { exterior: event.target.checked });
        }
        const field = event.target.dataset.openingField;
        if (field) {
            const row = event.target.closest('[data-opening]');
            const opening = wall.openings.find((entry) => entry.id === row.dataset.opening);
            if (opening) patchOpening(wall.id, opening.id, { [`${field.replace('Ft', '')}M`]: Number(event.target.value) * FT });
        }
    });

    $('wall-inspector').addEventListener('click', (event) => {
        const wall = selectedWall();
        if (!wall) return;
        const remove = event.target.closest('[data-remove-opening]');
        if (remove) {
            config = {
                ...config,
                storeys: config.storeys.map((storey, index) => (
                    index !== storeyIndex ? storey : {
                        ...storey,
                        walls: storey.walls.map((entry) => (
                            entry.id === wall.id
                                ? { ...entry, openings: entry.openings.filter((opening) => opening.id !== remove.dataset.removeOpening) }
                                : entry
                        ))
                    }
                ))
            };
            selectedOpeningId = null;
            refresh();
            return;
        }
        const row = event.target.closest('[data-opening]');
        if (row) {
            selectedOpeningId = row.dataset.opening;
            renderInspector();
            drawElevation();
        }
    });

    $('add-door').addEventListener('click', () => addOpening('door'));
    $('add-window').addEventListener('click', () => addOpening('window'));
    $('delete-wall').addEventListener('click', removeSelectedWall);

    $('storey-height')?.addEventListener('change', () => {
        setStoreyField('studLengthIn', Number($('storey-height').value) || 92.5);
    });
    $('storey-name')?.addEventListener('change', () => {
        setStoreyField('name', $('storey-name').value.trim() || `Floor ${storeyIndex + 1}`);
    });

    $('show-all-checks').addEventListener('click', () => {
        showAllChecks = !showAllChecks;
        renderChecks();
    });

    document.querySelectorAll('[data-tool]').forEach((button) => {
        button.addEventListener('click', () => {
            tool = button.dataset.tool;
            document.querySelectorAll('[data-tool]').forEach((node) => {
                node.classList.toggle('bg-slate-900', node.dataset.tool === tool);
                node.classList.toggle('text-white', node.dataset.tool === tool);
                node.classList.toggle('border-slate-900', node.dataset.tool === tool);
            });
        });
    });
    $('zoom-in').addEventListener('click', () => { view = { zoom: Math.min(2.6, view.zoom * 1.15) }; draw(); });
    $('zoom-out').addEventListener('click', () => { view = { zoom: Math.max(0.5, view.zoom / 1.15) }; draw(); });
    $('zoom-reset').addEventListener('click', () => { view = { zoom: 1 }; draw(); });
}

// ---------------------------------------------------------------------------
// Calculators
// ---------------------------------------------------------------------------

function renderCalculators() {
    const list = $('calc-list');
    if (!list) return;
    const matches = new Set(searchCalculators(calcQuery).map((entry) => entry.id));
    list.innerHTML = calculatorsByGroup().map((group) => {
        const items = group.calculators.filter((entry) => matches.has(entry.id));
        if (!items.length) return '';
        return `
            <p class="px-2 pt-2 pb-1 text-[9px] uppercase tracking-wider font-bold text-slate-400">${escapeHtml(group.label)}</p>
            ${items.map((entry) => `
                <button data-calculator="${escapeHtml(entry.id)}" class="w-full text-left px-2 py-1.5 rounded border ${entry.id === activeCalculator ? 'bg-slate-900 text-white border-slate-900' : 'border-transparent hover:bg-slate-50'}">
                    <span class="block text-[11px] font-semibold leading-tight">${escapeHtml(entry.label)}</span>
                </button>
            `).join('')}
        `;
    }).join('') || '<p class="px-2 py-3 text-[11px] text-slate-400">No calculator matches that search.</p>';
    renderCalculator();
}

function renderCalculator() {
    const definition = CALCULATOR_BY_ID[activeCalculator];
    if (!definition) return;
    $('calc-title').textContent = definition.label;
    $('calc-intro').textContent = definition.blurb;
    $('calc-form').innerHTML = definition.fields.map((field) => fieldControl(field)).join('');
    renderCalcResult();
}

function fieldControl(field) {
    const value = calcValues[field.key] ?? field.default;
    const label = escapeHtml(field.label);
    if (field.type === 'select') {
        return `<label class="block text-[10px] text-slate-500">${label}
            <select data-calc-field="${escapeHtml(field.key)}" class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px]">
                ${field.options.map(([option, text]) => `<option value="${escapeHtml(option)}" ${String(option) === String(value) ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}
            </select>
        </label>`;
    }
    if (field.type === 'checkbox') {
        return `<label class="flex items-center gap-1.5 mt-4 text-[10px] text-slate-600"><input data-calc-field="${escapeHtml(field.key)}" type="checkbox" ${value ? 'checked' : ''}> ${label}</label>`;
    }
    return `<label class="block text-[10px] text-slate-500">${label}
        <span class="flex items-center gap-1">
            <input data-calc-field="${escapeHtml(field.key)}" type="number" value="${escapeHtml(value)}" min="${field.min ?? ''}" max="${field.max ?? ''}" step="${field.step ?? 'any'}" class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px] font-mono">
            ${field.unit ? `<span class="text-[10px] text-slate-400 shrink-0">${escapeHtml(field.unit)}</span>` : ''}
        </span>
    </label>`;
}

function renderCalcResult() {
    const node = $('calc-result');
    if (!node) return;
    const out = computeCalculator(activeCalculator, calcValues);
    if (!out) {
        node.innerHTML = '';
        return;
    }
    node.innerHTML = `
        <div class="rounded-xl border border-slate-200 bg-white p-4">
            <p class="text-[10px] uppercase tracking-wider font-bold text-slate-400">${escapeHtml(out.primary.label)}</p>
            <p class="text-3xl font-mono font-bold mt-1 ${out.primary.value === 'engineered' ? 'text-amber-700' : 'text-slate-900'}">${escapeHtml(out.primary.value)}</p>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
                ${out.rows.map((row) => `<div class="flex justify-between gap-2 border-b border-slate-100 pb-0.5"><span class="text-[10px] text-slate-400">${escapeHtml(row.label)}</span><span class="text-[11px] font-mono text-right">${escapeHtml(row.value)}</span></div>`).join('')}
            </div>
            <ul class="mt-3 text-[10px] text-slate-500 leading-snug list-disc pl-4 space-y-0.5">
                ${out.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
            </ul>
            <div class="mt-3 rounded bg-slate-50 border border-slate-100 px-2 py-1.5">
                ${out.formula ? `<p class="text-[10px] font-mono text-slate-600">${escapeHtml(out.formula)}</p>` : ''}
                ${out.code ? `<p class="text-[9px] text-slate-400 mt-0.5">${escapeHtml(out.code)}</p>` : ''}
            </div>
        </div>
    `;
}

function updateCalculatorValue(event) {
    const field = event.target.closest('[data-calc-field]');
    if (!field) return;
    const key = field.dataset.calcField;
    calcValues = {
        ...calcValues,
        [key]: field.type === 'checkbox' ? field.checked : field.type === 'number' ? Number(field.value) : field.value
    };
    renderCalcResult();
}

function wireCalculators() {
    $('calc-list').addEventListener('click', (event) => {
        const button = event.target.closest('[data-calculator]');
        if (!button) return;
        activeCalculator = button.dataset.calculator;
        calcValues = defaultValues(activeCalculator);
        renderCalculators();
    });
    $('calc-search').addEventListener('input', (event) => {
        calcQuery = event.target.value;
        renderCalculators();
    });
    $('calc-form').addEventListener('input', (event) => {
        if (event.target.type !== 'checkbox' && event.target.tagName !== 'SELECT') updateCalculatorValue(event);
    });
    $('calc-form').addEventListener('change', (event) => {
        if (event.target.type === 'checkbox' || event.target.tagName === 'SELECT') updateCalculatorValue(event);
    });
    $('calc-reset').addEventListener('click', () => {
        calcValues = defaultValues(activeCalculator);
        renderCalculator();
    });
}

function wireTabs() {
    document.querySelectorAll('[data-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            activeTab = button.dataset.tab;
            document.querySelectorAll('[data-tab]').forEach((node) => {
                node.classList.toggle('active', node.dataset.tab === activeTab);
            });
            document.querySelectorAll('[data-pane]').forEach((pane) => {
                pane.classList.toggle('hidden', pane.dataset.pane !== activeTab);
            });
            if (activeTab === 'plan') window.requestAnimationFrame(draw);
            if (activeTab === 'calculators') renderCalculators();
        });
    });
}

function wireHeader() {
    $('reset').addEventListener('click', () => {
        config = defaultConfig();
        storeyIndex = 0;
        selectedWallId = null;
        selectedOpeningId = null;
        view = { zoom: 1 };
        refresh();
        setStatus('Reset to the two-storey sample plan.');
    });
    $('schedule-csv').addEventListener('click', () => download('framing-schedule.csv', framingScheduleCsv(design)));
    $('cutlist-csv').addEventListener('click', () => download('framing-cut-list.csv', framingCutListCsv(design)));
    $('takeoff-csv').addEventListener('click', () => download('framing-takeoff.csv', framingTakeoffCsv(design)));
    $('send-editor').addEventListener('click', () => {
        const drawn = selectedWall() || design.storeys[storeyIndex]?.walls[0];
        if (!drawn) {
            setStatus('Draw a wall first, then send the frame to the editor.', true);
            return;
        }
        const draft = {
            config,
            storeyIndex,
            selectedWallId: drawn.id,
            summary: design.summary,
            metrics: design.metrics,
            checks: design.checks.filter((check) => check.severity === 'error' || check.severity === 'warn'),
            design: {
                storeys: design.storeys.map((storey) => ({
                    name: storey.name,
                    elevationM: storey.elevationM,
                    heightM: storey.heightM,
                    walls: storey.walls.map((wall) => ({
                        id: wall.id,
                        name: wall.name,
                        start: wall.start,
                        end: wall.end,
                        lengthM: wall.lengthM,
                        heightM: wall.heightM,
                        exterior: wall.exterior,
                        studs: wall.counts.studs,
                        openings: wall.openings.length,
                        header: wall.openings[0]?.header.note || null
                    }))
                }))
            },
            sentAt: new Date().toISOString()
        };
        try {
            if (!writeDraft(EDITOR_KEY, draft)) throw new Error('editor draft not saved');
            localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
            setStatus('Framing draft sent. Opening the editor…');
            window.setTimeout(() => { window.location.href = 'Editor.html'; }, 350);
        } catch {
            setStatus('Could not send the draft: browser storage is unavailable.', true);
        }
    });

    $('rules-search')?.addEventListener('input', (event) => {
        ruleQuery = event.target.value;
        renderRules();
    });
    $('rules-issues')?.addEventListener('change', (event) => {
        ruleIssuesOnly = event.target.checked;
        renderRules();
    });
    $('rules-chips')?.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-category]');
        if (!chip) return;
        ruleCategory = chip.dataset.category;
        renderRules();
    });
    $('rules-list')?.addEventListener('click', (event) => {
        const head = event.target.closest('.rule-head');
        if (!head) return;
        const rule = head.closest('[data-rule]');
        const id = rule.dataset.rule;
        if (openRules.has(id)) openRules.delete(id);
        else openRules.add(id);
        rule.classList.toggle('open');
    });
    $('glossary-search')?.addEventListener('input', (event) => {
        glossaryQuery = event.target.value;
        renderGlossary();
    });

    document.addEventListener('keydown', (event) => {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (selectedWall()) {
                event.preventDefault();
                removeSelectedWall();
            }
        }
        if (event.key === 'Escape') {
            selectedWallId = null;
            selectedOpeningId = null;
            refresh({ save: false });
        }
    });
}

function populateOptions() {
    const fill = (id, entries) => {
        const node = $(id);
        if (!node) return;
        node.innerHTML = entries.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
    };
    fill('f-stud', STUD_SIZES.map((size) => [size, `${size} stud`]));
    fill('f-spacing', STUD_SPACINGS_IN.map((value) => [value, `${value} in on center`]));
    fill('f-length', PRECUT_STUDS.map((entry) => [entry.id, entry.label]));
    fill('f-plates', [[1, 'Single top plate'], [2, 'Double top plate'], [3, 'Triple top plate']]);
    fill('f-species', SPECIES.map((entry) => [entry.id, entry.label]));
    fill('f-sheathing', SHEATHING.map((entry) => [entry.id, entry.label]));
    fill('f-subfloor', SUBFLOOR.map((entry) => [entry.id, entry.label]));
}

function init() {
    populateOptions();
    wireTabs();
    wireSidebar();
    wireHeader();
    wirePlan();
    wireCalculators();
    renderReference();
    refresh({ save: false });
    renderCalculators();
    window.addEventListener('resize', () => { if (activeTab === 'plan') draw(); });
    window.framingSuite = {
        config: () => config,
        design: () => design,
        setStudSpacing: (inches) => {
            config = { ...config, studSpacingIn: Number(inches) };
            refresh();
            return design;
        },
        addOpening,
        calculators: () => CALCULATORS.map((entry) => ({ id: entry.id, label: entry.label, group: entry.group, blurb: entry.blurb })),
        runCalculator: (id, values) => computeCalculator(id, values),
        calculatorDefaults: (id) => defaultValues(id),
        selectWall: (index = 0) => {
            const wall = design.storeys[storeyIndex]?.walls?.[index];
            selectedWallId = wall?.id || null;
            selectedOpeningId = null;
            refresh({ save: false });
            return selectedWallId;
        },
        setStorey: (index) => {
            storeyIndex = Math.min(Math.max(Number(index) || 0, 0), design.storeys.length - 1);
            selectedWallId = design.storeys[storeyIndex]?.walls?.[0]?.id || null;
            refresh({ save: false });
        },
        draw,
        frameWall,
        csv: () => ({
            schedule: framingScheduleCsv(design),
            cut: framingCutListCsv(design),
            takeoff: framingTakeoffCsv(design)
        })
    };
}

init();
