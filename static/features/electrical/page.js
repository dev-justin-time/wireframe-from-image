import {
    CONDUCTOR_TYPES,
    ELECTRICAL_DEFAULTS,
    PANELS,
    SERVICE_TYPES
} from './catalog.js';
import {
    computeElectricalDesign,
    demandCsv,
    electricalSummaryText,
    electricalTakeoffCsv,
    panelScheduleCsv
} from './engine.js';
import { writeDraft } from '../../core/drafts.js';
import { applyPriceBookToDesign } from '../pricing/book.js';
import { circuitAt, createElectricalPlan, drawElectricalPlan } from './plan.js';
import { drawElectricalLayer, drawFramingLayer, drawPlumbingLayer, drawStackedLayers, readLayerSources, resolveFootprint } from '../layers/mep-layers.js';
import {
    CODE_SCOPE,
    FORMULAS,
    GLOSSARY,
    RULES,
    RULE_CATEGORIES,
    ruleStatus,
    searchRules
} from './rules.js';

/**
 * Electrical suite page controller. The demand calculation, the panel
 * schedule, the one-line drawing and the takeoff all read one design object, so
 * changing an appliance moves the service size, the breaker and the price
 * together.
 */

const DRAFT_KEY = 'electrical-suite-draft';
const EDITOR_KEY = 'electrical-editor-draft';

const $ = (id) => document.getElementById(id);
const escape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

const APPLIANCE_FIELDS = [
    ['range', 'Electric range'],
    ['dryer', 'Dryer'],
    ['waterHeater', 'Water heater'],
    ['dishwasher', 'Dishwasher'],
    ['disposal', 'Disposer'],
    ['microwave', 'Microwave'],
    ['ac', 'A/C'],
    ['heating', 'Electric heat'],
    ['ev', 'EV charger'],
    ['pool', 'Pool pump'],
    ['spa', 'Hot tub'],
    ['wellPump', 'Well pump']
];

function loadConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (saved && typeof saved === 'object') {
            return {
                ...ELECTRICAL_DEFAULTS,
                ...saved,
                appliances: { ...ELECTRICAL_DEFAULTS.appliances, ...(saved.appliances || {}) }
            };
        }
    } catch {
        // A corrupt draft falls back to the default dwelling.
    }
    return { ...ELECTRICAL_DEFAULTS, appliances: { ...ELECTRICAL_DEFAULTS.appliances } };
}

let config = loadConfig();
let design = applyPriceBookToDesign('electrical', computeElectricalDesign(config));
let plan = createElectricalPlan(config);
let activeTab = 'design';
let showAllChecks = false;
let ruleQuery = '';
let ruleCategory = 'all';
let ruleIssuesOnly = false;
let glossaryQuery = '';
let selectedCircuit = null;
let showLabels = true;
let layerShow = { framing: true, plumbing: true, electrical: true };
let saveTimer = null;
let statusTimer = null;
const openRules = new Set(['demand-standard', 'service-size', 'gfci']);

const FIELDS = [
    { id: 'e-area', key: 'areaM2', type: 'number' },
    { id: 'e-sabc', key: 'sabc', type: 'number' },
    { id: 'e-bath', key: 'bathroom', type: 'number' },
    { id: 'e-method', key: 'method', type: 'select' },
    { id: 'e-laundry', key: 'laundry', type: 'checkbox' },
    { id: 'e-outdoor', key: 'outdoorReceptacle', type: 'checkbox' },
    { id: 'e-afci', key: 'afci', type: 'checkbox' },
    { id: 'e-service', key: 'serviceType', type: 'select' },
    { id: 'e-conductor', key: 'conductor', type: 'select' },
    { id: 'e-panel', key: 'panel', type: 'select' },
    { id: 'e-feeder', key: 'feederLengthM', type: 'number' },
    { id: 'e-branch', key: 'branchLengthM', type: 'number' },
    { id: 'e-ambient', key: 'ambientC', type: 'number' },
    { id: 'e-ccc', key: 'currentCarrying', type: 'number' },
    { id: 'e-grounds', key: 'groundingElectrodes', type: 'number' }
];

function populateOptions() {
    $('e-service').innerHTML = SERVICE_TYPES.map((entry) => `<option value="${escape(entry.id)}">${escape(entry.label)}</option>`).join('');
    $('e-conductor').innerHTML = CONDUCTOR_TYPES.map((entry) => `<option value="${escape(entry.id)}">${escape(entry.label)}</option>`).join('');
    $('e-panel').innerHTML = PANELS.map((entry) => `<option value="${escape(entry.id)}">${escape(entry.label)}</option>`).join('');
    $('appliance-grid').innerHTML = APPLIANCE_FIELDS.map(([key, label]) => `
        <label>${escape(label)}
            <input type="number" min="0" max="40000" step="100" data-appliance="${escape(key)}" class="mt-0.5">
        </label>
    `).join('');
}

function syncInputs() {
    FIELDS.forEach((field) => {
        const node = $(field.id);
        if (!node) return;
        if (field.type === 'checkbox') node.checked = Boolean(config[field.key]);
        else if (field.type === 'number') node.value = String(config[field.key]);
        else node.value = String(config[field.key]);
    });
    document.querySelectorAll('[data-appliance]').forEach((node) => {
        node.value = String(Number(config.appliances[node.dataset.appliance]) || 0);
    });
    const active = APPLIANCE_FIELDS.filter(([key]) => Number(config.appliances[key]) > 0).length;
    $('appliance-note').textContent = `${active} appliance loads in the calculation · ${config.method === 'optional' ? 'optional 220.82 method' : 'standard 220.42 method'}`;
}

function setStatus(message, error = false) {
    const node = $('status');
    node.textContent = message;
    node.className = `text-[10px] min-h-[1rem] ${error ? 'text-red-600' : 'text-indigo-700'}`;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { node.textContent = ''; }, 4200);
}

function saveDraft() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
        } catch {
            setStatus('Could not save the design locally.', true);
        }
    }, 200);
}

function setField(key, value) {
    if (!(key in ELECTRICAL_DEFAULTS)) return design;
    const numeric = ['areaM2', 'sabc', 'bathroom', 'feederLengthM', 'branchLengthM', 'ambientC', 'currentCarrying', 'groundingElectrodes'];
    config = {
        ...config,
        [key]: ['laundry', 'outdoorReceptacle', 'afci'].includes(key)
            ? Boolean(value)
            : numeric.includes(key) ? Number(value) : value
    };
    refresh();
    saveDraft();
    return design;
}

function setAppliance(key, value) {
    config = {
        ...config,
        appliances: { ...config.appliances, [key]: Math.max(Number(value) || 0, 0) }
    };
    refresh();
    saveDraft();
    return design;
}

function refresh() {
    design = applyPriceBookToDesign('electrical', computeElectricalDesign(config));
    plan = createElectricalPlan(config);
    syncInputs();
    renderMetrics();
    renderChecks();
    renderSchedule();
    renderDemand();
    renderTakeoff();
    renderRules();
    if (activeTab === 'design') window.requestAnimationFrame(drawPlan);
    if (activeTab === 'layers') window.requestAnimationFrame(drawLayers);
}

function renderMetrics() {
    const d = design;
    $('m-service').textContent = `${d.serviceAmps} A`;
    $('m-demand').textContent = `${d.demandVa} VA / ${d.demandAmps} A`;
    $('m-standard').textContent = `${d.standard.va} VA`;
    $('m-optional').textContent = `${d.optional.va} VA`;
    $('m-main').textContent = `${d.mainBreaker} A`;
    $('m-feeder').textContent = `${d.feeder.size}`;
    $('m-neutral').textContent = `${d.neutral.size} (${d.neutral.amps} A)`;
    $('m-ground').textContent = `${d.gec} / ${d.egc}`;
    $('m-circuits').textContent = `${d.circuits.length}`;
    $('m-spaces').textContent = `${d.spaces.used}/${d.panel.spaces}`;
    $('m-vd').textContent = `${d.feeder.vdPercent}%`;
    $('m-conduit').textContent = `${d.conduitFill.conduit.split(',')[0]} ${d.conduitFill.fillPercent}%`;
    $('m-cost').textContent = `$${d.bom.total.toFixed(0)}`;
    $('m-cost-sub').textContent = `material $${d.bom.material.toFixed(0)} · labour $${d.bom.labour.toFixed(0)} · $${d.costPerCircuit.toFixed(0)}/circuit`;

    const summary = $('check-summary');
    summary.textContent = d.ok
        ? `All modelled checks pass${d.warnings ? ` · ${d.warnings} to review` : ''}`
        : `${d.errors} error${d.errors === 1 ? '' : 's'} · ${d.warnings} to review`;
    summary.className = `text-[10px] font-mono mt-1 ${d.ok ? 'text-emerald-700' : 'text-red-600'}`;
    $('issue-count').textContent = `${d.checks.filter((check) => check.severity !== 'ok').length} issues`;
}

function renderChecks() {
    const rows = showAllChecks ? design.checks : design.checks.filter((check) => check.severity !== 'ok');
    if (!rows.length) {
        $('checks').innerHTML = '<li class="severity-ok">✓ Every modelled check passes.</li>';
    } else {
        $('checks').innerHTML = rows.map((check) => {
            const icon = check.severity === 'error' ? '✖' : check.severity === 'warning' ? '⚠' : '·';
            return `<li class="severity-${check.severity} flex items-start gap-1.5"><span class="shrink-0 font-bold">${icon}</span><span><b>${escape(check.label)}.</b> ${escape(check.message)} <span class="text-slate-400">${escape(check.rule)}</span></span></li>`;
        }).join('');
    }
    $('show-all-checks').textContent = showAllChecks ? 'Show only issues' : 'Show all checks';
}

function table(headers, rows, aligns = []) {
    const head = headers.map((label, index) => `<th class="text-left px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500 ${aligns[index] === 'right' ? 'text-right' : ''}">${escape(label)}</th>`).join('');
    const body = rows.map((row) => `<tr class="border-t border-slate-100">${row.map((cell, index) => `<td class="px-2 py-1 text-[11px] ${aligns[index] === 'right' ? 'text-right font-mono small-num' : ''}">${cell}</td>`).join('')}</tr>`).join('');
    return `<table class="w-full border-collapse"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}" class="px-2 py-3 text-[11px] text-slate-400">No rows</td></tr>`}</tbody></table>`;
}

function renderSchedule() {
    const d = design;
    $('schedule-summary').textContent = `${d.serviceAmps} A service · ${d.panel.label} · ${d.circuits.length} circuits · ${d.spaces.spares} spare spaces`;
    $('schedule-cards').innerHTML = [
        ['Main', `${d.mainBreaker} A`],
        ['Service', `${d.feeder.size} CU`],
        ['Circuits', `${d.circuits.length}`],
        ['Balance', `${d.balance.percent}%`]
    ].map(([label, value]) => `<span class="px-2 py-1 rounded border border-slate-200"><span class="text-slate-400">${escape(label)}</span> <b>${escape(value)}</b></span>`).join('');

    let space = 1;
    const rows = d.circuits.map((circuit) => {
        const span = circuit.voltage > 150 ? 2 : 1;
        const spaceLabel = span === 2 ? `${space}-${space + 1}` : `${space}`;
        space += span;
        return [
            spaceLabel,
            escape(circuit.label),
            `${circuit.voltage} V`,
            `${circuit.va} VA`,
            `${circuit.amps} A`,
            `${circuit.breaker} A`,
            escape(circuit.conductor),
            escape(circuit.egc),
            circuit.gfci ? '✓' : '',
            circuit.afci ? '✓' : '',
            `${circuit.vdPercent}%`
        ];
    });
    $('schedule-table').innerHTML = table(
        ['Space', 'Circuit', 'Volts', 'Load', 'Amps', 'Breaker', 'Conductor', 'EGC', 'GFCI', 'AFCI', 'VD'],
        rows,
        ['left', 'left', 'right', 'right', 'right', 'right', 'left', 'left', 'left', 'left', 'right']
    );
}

function renderDemand() {
    const d = design;
    $('demand-summary').textContent = `${d.method === 'optional' ? 'Optional 220.82' : 'Standard 220.42'} method · ${d.demandVa} VA · ${d.demandAmps} A at 240 V · ${d.serviceAmps} A service`;
    const rows = [
        ['General lighting, small appliance and laundry', `${d.general.va} VA`, `${d.optional.base} VA`],
        ['Appliances', `${d.standard.applianceDemand} VA`, `${d.optional.remainder} VA`],
        ['Heating or cooling (larger)', `${d.standard.hvacDemand} VA`, `${d.optional.hvacDemand} VA`],
        ['Largest motor 25%', `${d.standard.motorDemand} VA`, `${d.optional.motorDemand} VA`],
        ['<b>Total</b>', `<b>${d.standard.va} VA</b>`, `<b>${d.optional.va} VA</b>`],
        ['Service at 240 V', `${round(d.standard.va / 240, 1)} A`, `${round(d.optional.va / 240, 1)} A`]
    ];
    $('demand-table').innerHTML = table(['Load', 'Standard method', 'Optional method'], rows, ['left', 'right', 'right']);
    $('demand-notes').innerHTML = [
        `Lighting: ${d.lightingVa} VA at 33 VA/m² (3 VA/sq ft).`,
        `General demand tiers: ${d.general.first} VA at 100%, ${d.general.second} VA at 35%.`,
        `Appliances: ${d.standard.applianceNameplate} VA connected, factor ${d.standard.applianceFactor}.`,
        `Heating ${d.config.appliances.heating} VA vs cooling ${d.config.appliances.ac} VA: only the larger counts.`,
        `Neutral: ${d.neutral.va} VA unbalanced, ${d.neutral.amps} A, ${d.neutral.size} conductor.`,
        `Service conductors ${d.feeder.size} adjusted to ${d.feeder.adjustedAmpacity} A; ${d.feeder.vdPercent}% drop over ${d.config.feederLengthM} m.`
    ].map((note) => `<li>${escape(note)}</li>`).join('');
}

function renderTakeoff() {
    const d = design;
    $('takeoff-cards').innerHTML = [
        ['Service', `${d.serviceAmps} A`],
        ['Circuits', `${d.circuits.length}`],
        ['Conductor', `${d.feeder.size}`],
        ['Total', `$${d.bom.total.toFixed(0)}`]
    ].map(([label, value]) => `<div class="rounded-lg border border-slate-200 px-3 py-2"><p class="text-[10px] uppercase tracking-wide text-slate-400">${escape(label)}</p><p class="text-sm font-mono font-semibold">${escape(value)}</p></div>`).join('');

    const rows = d.bom.rows.map((row) => [
        escape(row.group),
        escape(row.item),
        `${row.qty} ${escape(row.unit)}`,
        `$${row.unitCost.toFixed(2)}`,
        `$${row.cost.toFixed(2)}`,
        `<span class="text-slate-500">${escape(row.note)}</span>`
    ]);
    rows.push(['', '<b>Material</b>', '', '', `<b>$${d.bom.material.toFixed(2)}</b>`, '']);
    rows.push(['', '<b>Labour (85%)</b>', '', '', `<b>$${d.bom.labour.toFixed(2)}</b>`, '']);
    rows.push(['', '<b>Total</b>', '', '', `<b>$${d.bom.total.toFixed(2)}</b>`, '']);
    $('takeoff-bom').innerHTML = table(['Group', 'Item', 'Qty', 'Unit cost', 'Cost', 'Note'], rows, ['left', 'left', 'right', 'right', 'right', 'left']);
    $('takeoff-notes').innerHTML = [
        'Allowance prices in USD; swap them for the supply house quote before the bid.',
        `${d.circuits.length} branch circuits, ${d.spaces.used} spaces used of ${d.panel.spaces}.`,
        `Raceway: ${d.conduitFill.conduit}, ${d.conduitFill.fillPercent}% fill for ${d.conduitFill.count} conductors.`,
        `Grounding: ${d.groundingElectrodes} rods, ${d.gec} GEC, ${d.egc} EGC.`
    ].map((note) => `<li>${escape(note)}</li>`).join('');
}

function renderRules() {
    const rules = searchRules(ruleQuery).filter((rule) => (
        (ruleCategory === 'all' || rule.category === ruleCategory)
        && (!ruleIssuesOnly || ['error', 'warn'].includes(ruleStatus(rule, design.checks).state))
    ));
    $('rules-summary').textContent = `${rules.length} of ${RULES.length} rules · ${design.errors} failing`;
    $('rules-chips').innerHTML = [{ id: 'all', label: 'All' }, ...RULE_CATEGORIES]
        .map((category) => `<button class="chip px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-semibold ${ruleCategory === category.id ? 'active' : ''}" data-category="${escape(category.id)}">${escape(category.label)}</button>`)
        .join('');
    $('rules-list').innerHTML = rules.map((rule) => {
        const status = ruleStatus(rule, design.checks);
        const open = openRules.has(rule.id);
        const tone = status.state === 'error' ? 'severity-error' : status.state === 'warn' ? 'severity-warn' : status.state === 'ok' ? 'severity-ok' : 'severity-info';
        return `
            <article class="rule ${open ? 'open' : ''} rounded-lg border border-slate-200" data-rule="${escape(rule.id)}">
                <button class="rule-head w-full flex items-start gap-2 px-3 py-2 text-left">
                    <span class="rule-caret text-slate-400 text-[10px] mt-0.5">▶</span>
                    <span class="flex-1">
                        <span class="block text-[12px] font-semibold">${escape(rule.title)}</span>
                        <span class="block text-[10px] font-mono text-slate-400">${escape(rule.code)}</span>
                    </span>
                    <span class="text-[10px] font-bold ${tone}">${escape(status.label.toUpperCase())}</span>
                </button>
                <div class="rule-body px-3 pb-3 text-[11px] text-slate-600 leading-snug">
                    <p>${escape(rule.summary)}</p>
                    <ul class="mt-1.5 space-y-0.5 list-disc pl-4">${(rule.requirements || []).map((line) => `<li>${escape(line)}</li>`).join('')}</ul>
                </div>
            </article>
        `;
    }).join('') || '<p class="text-[11px] text-slate-400">No rule matches that search.</p>';
}

function renderGlossary() {
    const term = glossaryQuery.trim().toLowerCase();
    const terms = term
        ? GLOSSARY.filter((entry) => [entry.term, entry.short, entry.detail, entry.category].join(' ').toLowerCase().includes(term))
        : GLOSSARY;
    $('glossary-count').textContent = `${terms.length} terms`;
    $('formula-list').innerHTML = table(
        ['Quantity', 'Formula', 'Note'],
        FORMULAS.map((entry) => [`<b>${escape(entry.label)}</b>`, `<code class="font-mono">${escape(entry.expression)}</code>`, `<span class="text-slate-500">${escape(entry.note)}</span>`])
    );
    $('glossary-list').innerHTML = terms.map((entry) => `
        <article>
            <h3 class="text-[12px] font-semibold">${escape(entry.term)} <span class="text-[9px] uppercase tracking-wide text-slate-400 ml-1">${escape(entry.category)}</span></h3>
            <p class="text-[11px] text-slate-600 leading-snug">${escape(entry.short)}</p>
            <p class="text-[10px] text-slate-400 leading-snug mt-0.5">${escape(entry.detail)}</p>
        </article>
    `).join('') || '<p class="text-[11px] text-slate-400">No term matches that search.</p>';
}

// --- Panel canvas --------------------------------------------------------

function drawPlan() {
    const canvas = $('plan');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(360, Math.floor(rect.width * dpr));
    canvas.height = Math.max(260, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    drawElectricalPlan(ctx, rect.width, rect.height, design, {
        dpr,
        selected: selectedCircuit,
        labels: showLabels
    });
}

function canvasPoint(event) {
    const rect = $('plan').getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function wirePlan() {
    const canvas = $('plan');
    canvas.addEventListener('pointermove', (event) => {
        const rect = canvas.getBoundingClientRect();
        const hit = circuitAt(design, rect.width, rect.height, canvasPoint(event));
        $('hover-readout').textContent = hit
            ? `SPACE ${hit.space} · ${hit.circuit.label} · ${hit.circuit.breaker} A`
            : '';
    });
    canvas.addEventListener('pointerleave', () => { $('hover-readout').textContent = ''; });
    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const hit = circuitAt(design, rect.width, rect.height, canvasPoint(event));
        selectedCircuit = hit ? hit.circuit.id : null;
        drawPlan();
        if (hit) setStatus(`Space ${hit.space}: ${hit.circuit.label}, ${hit.circuit.breaker} A, ${hit.circuit.conductor} AWG.`);
    });
}

// --- Wiring --------------------------------------------------------------

function sizeLayerCanvas(id, minH = 200) {
    const canvas = $(id);
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(280, Math.floor(rect.width));
    const h = Math.max(minH, Math.floor(rect.height || minH));
    if (!w || !h) return null;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    return { canvas, w, h, dpr };
}

function drawLayers() {
    const sources = readLayerSources();
    const footprint = resolveFootprint(sources);
    const sourceNode = $('layers-source');
    if (sourceNode) {
        const parts = [`footprint: ${footprint.source} ${footprint.width.toFixed(1)}×${footprint.depth.toFixed(1)} m`];
        if (sources.plumbingDesign) parts.push('plumbing: live draft');
        else parts.push('plumbing: default (open Plumbing suite)');
        if (sources.framingRaw?.storeys?.length) parts.push('framing: live draft');
        else parts.push('framing: default rectangle');
        sourceNode.textContent = parts.join(' · ');
    }
    const stacked = sizeLayerCanvas('layer-stacked', 280);
    if (stacked) drawStackedLayers(stacked.canvas.getContext('2d'), stacked.w, stacked.h, sources, design, footprint, { show: layerShow, dpr: stacked.dpr });
    const elec = sizeLayerCanvas('layer-electrical', 200);
    if (elec) drawElectricalLayer(elec.canvas.getContext('2d'), elec.w, elec.h, design, footprint, { dpr: elec.dpr });
    const plumb = sizeLayerCanvas('layer-plumbing', 200);
    if (plumb) drawPlumbingLayer(plumb.canvas.getContext('2d'), plumb.w, plumb.h, sources, footprint, { dpr: plumb.dpr });
    const fram = sizeLayerCanvas('layer-framing', 200);
    if (fram) drawFramingLayer(fram.canvas.getContext('2d'), fram.w, fram.h, sources, footprint, { dpr: fram.dpr });
}

function switchTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === name);
    });
    ['design', 'layers', 'schedule', 'demand', 'takeoff', 'rules', 'glossary'].forEach((tab) => {
        const panel = $(`panel-${tab}`);
        if (!panel) return;
        panel.classList.toggle('hidden', tab !== name);
        if (tab === 'layers') panel.classList.toggle('block', tab === name);
        else panel.classList.toggle('flex', tab === name);
    });
    if (name === 'design') window.requestAnimationFrame(drawPlan);
    if (name === 'layers') window.requestAnimationFrame(drawLayers);
}

function download(filename, text) {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function resetAll() {
    config = { ...ELECTRICAL_DEFAULTS, appliances: { ...ELECTRICAL_DEFAULTS.appliances } };
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    selectedCircuit = null;
    refresh();
    setStatus('Design reset to the default 200 A dwelling.');
}

function sendToEditor() {
    const draft = {
        config,
        summary: electricalSummaryText(design).join(' · '),
        metrics: {
            serviceAmps: design.serviceAmps,
            mainBreaker: design.mainBreaker,
            demandVa: design.demandVa,
            feeder: design.feeder.size,
            circuits: design.circuits.length
        },
        circuits: design.circuits,
        lines: design.bom.rows.map((row) => ({
            code: row.item.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            description: row.item,
            qty: row.qty,
            unit: row.unit,
            unitCost: row.unitCost,
            group: row.group
        })),
        checks: design.checks.filter((check) => check.severity !== 'ok'),
        savedAt: new Date().toISOString()
    };
    try {
        if (!writeDraft(EDITOR_KEY, draft)) throw new Error('editor draft not saved');
        localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
        setStatus('Electrical draft sent to the editor. Opening it now…');
        window.setTimeout(() => { window.location.href = 'Editor.html'; }, 350);
    } catch {
        setStatus('Could not send the draft: browser storage is unavailable.', true);
    }
}

function wireEvents() {
    FIELDS.forEach((field) => {
        const node = $(field.id);
        if (!node) return;
        node.addEventListener('change', () => {
            const value = field.type === 'checkbox' ? node.checked : field.type === 'number' ? Number(node.value) : node.value;
            setField(field.key, value);
        });
        if (field.type === 'number') {
            node.addEventListener('input', () => {
                if (node.value === '') return;
                setField(field.key, Number(node.value));
            });
        }
    });

    document.querySelectorAll('[data-appliance]').forEach((node) => {
        node.addEventListener('change', () => setAppliance(node.dataset.appliance, node.value));
        node.addEventListener('input', () => {
            if (node.value === '') return;
            setAppliance(node.dataset.appliance, node.value);
        });
    });

    $('clear-appliances').addEventListener('click', () => {
        config = { ...config, appliances: Object.fromEntries(Object.keys(config.appliances).map((key) => [key, 0])) };
        refresh();
        saveDraft();
        setStatus('Every appliance load cleared: the service is now lighting and general circuits only.');
    });

    document.querySelectorAll('.tab').forEach((button) => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    $('show-labels').addEventListener('change', (event) => {
        showLabels = event.target.checked;
        drawPlan();
    });
    $('select-first').addEventListener('click', () => {
        selectedCircuit = design.circuits[0]?.id || null;
        drawPlan();
        if (selectedCircuit) setStatus(`Highlighted ${design.circuits[0].label}.`);
    });
    $('show-all-checks').addEventListener('click', () => {
        showAllChecks = !showAllChecks;
        renderChecks();
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
        const button = event.target.closest('[data-category]');
        if (!button) return;
        ruleCategory = button.dataset.category;
        renderRules();
    });
    $('rules-list').addEventListener('click', (event) => {
        const head = event.target.closest('.rule-head');
        if (!head) return;
        const card = head.closest('.rule');
        const id = card.dataset.rule;
        if (openRules.has(id)) openRules.delete(id);
        else openRules.add(id);
        card.classList.toggle('open', openRules.has(id));
    });
    $('glossary-search').addEventListener('input', (event) => {
        glossaryQuery = event.target.value;
        renderGlossary();
    });

    $('open-project-3d')?.addEventListener('click', () => {
        import('../../shared/project-viewer.js').then(({ openProjectViewer }) => openProjectViewer());
    });
    try {
        const raw = localStorage.getItem('floorplan3d_autosave');
        const walls = raw ? (JSON.parse(raw).walls?.length ?? JSON.parse(raw).stories?.[0]?.walls?.length ?? 0) : 0;
        const node = $('project-context');
        if (node) node.textContent = raw
            ? `Main floorplan found (${walls} walls). This design stacks onto it — open Project 3D to see walls + framing + plumbing + this panel together.`
            : 'No main floorplan yet. Draw walls in the Editor first, then this panel stacks onto that plan in Project 3D.';
    } catch { /* context line is advisory */ }

    $('reset').addEventListener('click', resetAll);
    $('takeoff-csv').addEventListener('click', () => {
        download('electrical-takeoff.csv', electricalTakeoffCsv(design));
        setStatus('Takeoff saved as electrical-takeoff.csv');
    });
    $('schedule-csv').addEventListener('click', () => {
        download('panel-schedule.csv', panelScheduleCsv(design));
        setStatus('Panel schedule saved as panel-schedule.csv');
    });
    $('demand-csv').addEventListener('click', () => {
        download('load-calculation.csv', demandCsv(design));
        setStatus('Load calculation saved as load-calculation.csv');
    });
    $('send-editor').addEventListener('click', sendToEditor);

    [['layer-show-framing', 'framing'], ['layer-show-plumbing', 'plumbing'], ['layer-show-electrical', 'electrical']].forEach(([id, key]) => {
        const node = $(id);
        if (!node) return;
        node.addEventListener('change', () => {
            layerShow[key] = node.checked;
            drawLayers();
        });
    });

    window.addEventListener('resize', () => {
        if (activeTab === 'design') drawPlan();
        if (activeTab === 'layers') drawLayers();
    });
    // Live stacked layers: plumbing / framing drafts (or the floorplan) saved
    // in another tab repaint here without touching this panel's own config.
    window.addEventListener('storage', (event) => {
        if (!event.key || !/draft|plan|floorplan3d/i.test(event.key)) return;
        if (activeTab === 'layers') drawLayers();
        else if (activeTab === 'design') drawPlan();
    });
    if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
            if (activeTab === 'design') drawPlan();
            if (activeTab === 'layers') drawLayers();
        });
        observer.observe($('plan').parentElement);
        if ($('panel-layers')) observer.observe($('panel-layers'));
    }
}

function init() {
    populateOptions();
    wireEvents();
    wirePlan();
    refresh();
    setStatus(`Model code: ${CODE_SCOPE.title}`);
    window.requestAnimationFrame(drawPlan);

    window.electricalSuite = {
        config: () => ({ ...config, appliances: { ...config.appliances } }),
        design: () => design,
        circuits: () => design.circuits.map((circuit) => ({ ...circuit })),
        summary: () => electricalSummaryText(design),
        csv: () => electricalTakeoffCsv(design),
        scheduleCsv: () => panelScheduleCsv(design),
        demandCsv: () => demandCsv(design),
        rules: () => RULES.map((rule) => ({ id: rule.id, category: rule.category, code: rule.code })),
        setField: (key, value) => setField(key, value),
        setAppliance: (key, value) => setAppliance(key, value),
        select: (id) => {
            selectedCircuit = id;
            drawPlan();
            return Boolean(design.circuits.find((circuit) => circuit.id === id));
        },
        redraw: () => drawPlan(),
        redrawLayers: () => drawLayers()
    };
    window.setElectricalField = (key, value) => setField(key, value);
    window.setApplianceLoad = (key, value) => setAppliance(key, value);
}

init();
