import {
    DECK_DEFAULTS,
    computeDeckDesign,
    deckCutListCsv,
    deckScheduleCsv,
    deckSummaryText,
    deckTakeoffCsv
} from './engine.js';
import { writeDraft } from '../../core/drafts.js';
import { applyPriceBookToDesign } from '../pricing/book.js';
import { createDeckPlan, drawDeckAxonometric, drawDeckFootingDetail, drawDeckPlan, drawDeckSection, postAt, stairAt } from './plan.js';
import {
    BEAM_PLIES,
    BEAM_SIZES,
    BOARD_PATTERNS,
    COVER_TYPES,
    DECKING,
    DECK_SHAPES,
    DECK_SHAPE_LABELS,
    FROST_DEPTH_IN,
    JOIST_SIZES,
    JOIST_SPACINGS_IN,
    POST_SIZES,
    RAILING_SYSTEMS,
    SOIL_BEARING_PSF,
    SPECIES,
} from './materials.js';
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
 * Deck suite page controller: the framing plan, the schedule, the takeoff and
 * the code register on one model. The plan, the checks and the BOM all read the
 * design returned by computeDeckDesign, so a change to the joist size moves the
 * drawing, the span check and the price together.
 */

const DRAFT_KEY = 'deck-suite-draft';
const EDITOR_KEY = 'deck-editor-draft';

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

function loadConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (saved && typeof saved === 'object') return { ...DECK_DEFAULTS, ...saved };
    } catch {
        // A corrupt draft falls back to the default deck.
    }
    return { ...DECK_DEFAULTS };
}

let config = loadConfig();
let view = { zoom: 1, panX: 0, panY: 0 };
let design = applyPriceBookToDesign('deck', computeDeckDesign(config));
let plan = createDeckPlan(config);
let activeTab = 'design';
let showAllChecks = false;
let ruleQuery = '';
let ruleCategory = 'all';
let ruleIssuesOnly = false;
let glossaryQuery = '';
let saveTimer = null;
let statusTimer = null;
const openRules = new Set(['joist-span', 'beam-span', 'guard-required']);
const show = { decking: true, joists: true, posts: true, footings: true, guard: true, stairs: true, hardware: true, labels: true, dimensions: true };

const FIELDS = [
    { id: 'd-shape', key: 'shape', type: 'select', options: DECK_SHAPES.map((key) => [key, DECK_SHAPE_LABELS[key]]) },
    { id: 'd-ledger', key: 'ledger', type: 'select', options: [['house', 'House ledger'], ['freestanding', 'Freestanding frame']] },
    { id: 'd-width', key: 'width', type: 'number' },
    { id: 'd-depth', key: 'depth', type: 'number' },
    { id: 'd-height', key: 'height', type: 'number' },
    { id: 'd-species', key: 'species', type: 'select', options: SPECIES.map((entry) => [entry.id, entry.label]) },
    { id: 'd-joist', key: 'joistSize', type: 'select', options: JOIST_SIZES.map((key) => [key, key]) },
    { id: 'd-spacing', key: 'joistSpacingIn', type: 'select', options: JOIST_SPACINGS_IN.map((key) => [key, `${key} in`]) },
    { id: 'd-beam', key: 'beamSize', type: 'select', options: BEAM_SIZES.map((key) => [key, key]) },
    { id: 'd-plies', key: 'beamPlies', type: 'select', options: BEAM_PLIES.map((key) => [key, `${key} plies`]) },
    { id: 'd-post', key: 'postSize', type: 'select', options: POST_SIZES.map((key) => [key, key]) },
    { id: 'd-post-spacing', key: 'postSpacingM', type: 'number' },
    { id: 'd-cantilever', key: 'cantileverM', type: 'number' },
    { id: 'd-footing', key: 'footingDiameterIn', type: 'number' },
    { id: 'd-frost', key: 'frost', type: 'select', options: FROST_DEPTH_IN.map((entry) => [entry.id, entry.label]) },
    { id: 'd-soil', key: 'soil', type: 'select', options: SOIL_BEARING_PSF.map((entry) => [entry.id, entry.label]) },
    { id: 'd-decking', key: 'decking', type: 'select', options: DECKING.map((entry) => [entry.id, entry.label]) },
    { id: 'd-pattern', key: 'pattern', type: 'select', options: BOARD_PATTERNS.map((entry) => [entry.id, entry.label]) },
    { id: 'd-guard', key: 'guard', type: 'select', options: [['none', 'No guard'], ...RAILING_SYSTEMS.map((entry) => [entry.id, entry.label])] },
    { id: 'd-guard-height', key: 'guardHeightIn', type: 'number' },
    { id: 'd-waste', key: 'waste', type: 'number' },
    { id: 'd-cover', key: 'cover', type: 'select', options: COVER_TYPES.map((entry) => [entry.id, entry.label]) },
    { id: 'd-stair-width', key: 'stairWidthM', type: 'number' },
    { id: 'd-cover-pitch', key: 'coverPitch', type: 'number' },
    { id: 'd-stairs', key: 'stairs', type: 'checkbox' }
];

function populateOptions() {
    FIELDS.forEach((field) => {
        const node = $(field.id);
        if (!node || field.type === 'number' || field.type === 'checkbox') return;
        node.innerHTML = field.options
            .map(([value, label]) => `<option value="${escape(value)}">${escape(label)}</option>`)
            .join('');
    });
}

function syncInputs() {
    FIELDS.forEach((field) => {
        const node = $(field.id);
        if (!node) return;
        if (field.type === 'checkbox') node.checked = Boolean(config[field.key]);
        else if (field.type === 'number') {
            const value = config[field.key];
            node.value = value === null || value === undefined || Number.isNaN(Number(value)) ? '' : String(value);
        } else node.value = String(config[field.key]);
    });
    $('deck-note').textContent = `${DECK_SHAPE_LABELS[config.shape]} ${round(config.width, 1)} × ${round(config.depth, 1)} m · ${round(config.height, 2)} m above grade · ${config.ledger === 'house' ? 'ledger attached to the house' : 'freestanding frame'}`;
}

function setStatus(message, error = false) {
    const node = $('status');
    node.textContent = message;
    node.className = `text-[10px] min-h-[1rem] ${error ? 'text-red-600' : 'text-amber-700'}`;
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
    if (!(key in DECK_DEFAULTS)) return design;
    const numeric = ['width', 'depth', 'height', 'joistSpacingIn', 'beamPlies', 'postSpacingM', 'cantileverM', 'footingDiameterIn', 'guardHeightIn', 'stairWidthM', 'coverPitch', 'waste'];
    config = {
        ...config,
        [key]: key === 'stairs' ? Boolean(value) : numeric.includes(key) ? (value === '' ? null : Number(value)) : value
    };
    refresh();
    saveDraft();
    return design;
}

function refresh() {
    design = applyPriceBookToDesign('deck', computeDeckDesign(config));
    plan = createDeckPlan(config);
    syncInputs();
    renderMetrics();
    renderChecks();
    renderSchedule();
    renderTakeoff();
    renderCutList();
    renderRules();
    if (activeTab === 'design') window.requestAnimationFrame(drawPlan);
}

function renderMetrics() {
    const d = design;
    $('m-area').textContent = `${round(d.areas.deckM2, 1)} m²`;
    $('m-joist').textContent = `${d.joist.count} × ${d.joist.size}`;
    $('m-span').textContent = `${round(d.joist.spanM, 2)} / ${round(d.joist.capacityM, 2)} m`;
    $('m-beam').textContent = `${d.config.beamPlies} × ${d.config.beamSize}`;
    $('m-post').textContent = `${d.post.count} × ${d.config.postSize}`;
    $('m-footing').textContent = `${d.footing.count} × ${d.footing.diameterIn} in`;
    $('m-guard').textContent = d.guard.lengthM > 0 ? `${round(d.guard.lengthM, 1)} m` : '—';
    $('m-stair').textContent = d.stair.risers ? `${d.stair.risers} risers` : '—';
    $('m-decking').textContent = `${round(d.decking.areaM2, 1)} m²`;
    $('m-concrete').textContent = `${d.footing.bags} bags`;
    $('m-cost').textContent = `$${d.bom.total.toFixed(0)}`;
    $('m-cost-sub').textContent = `material $${d.bom.material.toFixed(0)} · labour $${d.bom.labour.toFixed(0)} · $${d.costPerSqm.toFixed(0)}/m²`;

    const summary = $('check-summary');
    summary.textContent = d.ok
        ? `All modelled checks pass${d.warnings ? ` · ${d.warnings} to review` : ''}`
        : `${d.errors} error${d.errors === 1 ? '' : 's'} · ${d.warnings} to review`;
    summary.className = `text-[10px] font-mono mt-1 ${d.ok ? 'text-emerald-700' : 'text-red-600'}`;

    $('issue-count').textContent = `${d.checks.filter((check) => check.severity !== 'ok').length} issues`;
}

function checkRows() {
    const flagged = design.checks.filter((check) => check.severity !== 'ok');
    if (!showAllChecks) return flagged;
    return design.checks;
}

function renderChecks() {
    const rows = checkRows();
    const list = $('checks');
    if (!rows.length) {
        list.innerHTML = '<li class="severity-ok">✓ Every modelled check passes.</li>';
        return;
    }
    list.innerHTML = rows.map((check) => {
        const icon = check.severity === 'error' ? '✖' : check.severity === 'warning' ? '⚠' : '·';
        return `<li class="severity-${check.severity} flex items-start gap-1.5"><span class="shrink-0 font-bold">${icon}</span><span><b>${escape(check.label)}.</b> ${escape(check.message)} <span class="text-slate-400">${escape(check.rule)}</span></span></li>`;
    }).join('');
    $('show-all-checks').textContent = showAllChecks ? 'Show only issues' : 'Show all checks';
}

function table(headers, rows, aligns = []) {
    const head = headers.map((label, index) => `<th class="text-left px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500 ${aligns[index] === 'right' ? 'text-right' : ''}">${escape(label)}</th>`).join('');
    const body = rows.map((row) => `<tr class="border-t border-slate-100">${row.map((cell, index) => `<td class="px-2 py-1 text-[11px] ${aligns[index] === 'right' ? 'text-right font-mono small-num' : ''}">${cell}</td>`).join('')}</tr>`).join('');
    return `<table class="w-full border-collapse"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}" class="px-2 py-3 text-[11px] text-slate-400">No rows</td></tr>`}</tbody></table>`;
}

function renderSchedule() {
    const d = design;
    $('schedule-summary').textContent = `${round(d.areas.deckM2, 1)} m² ${DECK_SHAPE_LABELS[d.config.shape].toLowerCase()} deck · ${round(d.config.height, 2)} m high · ${d.species.label}`;
    $('schedule-cards').innerHTML = [
        ['Joist', `${d.joist.size} @ ${d.config.joistSpacingIn} in`],
        ['Beam', `${d.config.beamPlies} × ${d.config.beamSize}`],
        ['Post', `${d.post.count} × ${d.config.postSize}`],
        ['Footing', `${d.footing.diameterIn} in × ${round(d.footing.depthM, 2)} m`]
    ].map(([label, value]) => `<span class="px-2 py-1 rounded border border-slate-200"><span class="text-slate-400">${escape(label)}</span> <b>${escape(value)}</b></span>`).join('');

    const rows = [
        ['Joist', d.joist.size, `${d.config.joistSpacingIn} in`, `${round(d.joist.spanM, 2)} m`, `${round(d.joist.capacityM, 2)} m`, `${round((d.joist.spanM / Math.max(d.joist.capacityM, 0.01)) * 100, 0)}%`, d.joist.governing],
        ['Beam', `${d.config.beamPlies} × ${d.config.beamSize}`, `${round(d.config.postSpacingM, 2)} m posts`, `${round(d.beam.spanM, 2)} m`, `${round(d.beam.capacityM, 2)} m`, `${round((d.beam.spanM / Math.max(d.beam.capacityM, 0.01)) * 100, 0)}%`, d.beam.governing],
        ['Post', d.config.postSize, `${d.post.count} posts`, `${round(d.post.heightM, 2)} m`, `${Math.round(d.post.allowableLb)} lb`, `${round(d.post.utilization * 100, 0)}%`, 'NDS column'],
        ['Footing', `${d.footing.diameterIn} in`, `${d.footing.count} pads`, `${round(d.footing.depthM, 2)} m`, `${d.footing.allowablePsf} psf`, `${round((d.footing.bearingPsf / d.footing.allowablePsf) * 100, 0)}%`, 'soil bearing'],
        ['Guard', d.guard.system.label, `${round(d.guard.postSpacingM, 2)} m`, `${round(d.guard.lengthM, 2)} m`, `${d.guard.heightIn} in`, `${d.guard.openingIn} in gaps`, 'R312'],
        ['Stair', `2x12 × ${d.stair.stringers}`, `${round(d.config.stairWidthM * 1000, 0)} mm wide`, `${round(d.stair.runM, 2)} m run`, `${Math.round(d.stair.riserMm)} mm riser`, `${d.stair.treads} treads`, 'R311.7']
    ];
    $('schedule-table').innerHTML = table(
        ['Member', 'Size', 'Spacing / count', 'Used', 'Capacity', 'Utilisation', 'Governs'],
        rows,
        ['left', 'left', 'left', 'right', 'right', 'right', 'left']
    );
}

function renderTakeoff() {
    const d = design;
    $('takeoff-cards').innerHTML = [
        ['Deck', `${round(d.areas.deckM2, 1)} m²`],
        ['Framing', `${round(d.areas.framingLinearM, 0)} m`],
        ['Decking', `${d.decking.boards} boards`],
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
    rows.push(['', '<b>Labour (60%)</b>', '', '', `<b>$${d.bom.labour.toFixed(2)}</b>`, '']);
    rows.push(['', '<b>Total</b>', '', '', `<b>$${d.bom.total.toFixed(2)}</b>`, '']);
    $('takeoff-bom').innerHTML = table(['Group', 'Item', 'Qty', 'Unit cost', 'Cost', 'Note'], rows, ['left', 'left', 'right', 'right', 'right', 'left']);

    $('takeoff-notes').innerHTML = [
        `Allowance prices in USD; swap them for the supplier’s quote before the bid.`,
        `Joists at ${d.config.joistSpacingIn} in, ${d.joist.count} pieces of ${round(d.joist.lengthM, 2)} m.`,
        `${d.footing.bags} bags of concrete for ${d.footing.count} footings at ${d.footing.diameterIn} in × ${round(d.footing.depthM, 2)} m.`,
        d.cover.type === 'none' ? 'No cover: add one with the roof suite if the deck is to be roofed.' : `Cover: ${d.cover.note}.`
    ].map((note) => `<li>${escape(note)}</li>`).join('');
}

function renderCutList() {
    const d = design;
    $('cutlist-summary').textContent = `${d.cutRows.length} member types · ${d.cutRows.reduce((total, row) => total + row.count, 0)} pieces · dressed sizes`;
    const rows = d.cutRows.map((row) => [
        escape(row.label),
        escape(row.size),
        `${row.lengthM.toFixed(2)}`,
        `${row.count}`,
        `<span class="text-slate-500">${escape(row.note)}</span>`
    ]);
    $('cutlist-body').innerHTML = table(['Member', 'Size', 'Length (m)', 'Qty', 'Note'], rows, ['left', 'left', 'right', 'right', 'left']);
}

function renderRules() {
    const rules = searchRules(ruleQuery).filter((rule) => (
        (ruleCategory === 'all' || rule.category === ruleCategory)
        && (!ruleIssuesOnly || ruleStatus(rule, design.checks).state === 'error' || ruleStatus(rule, design.checks).state === 'warn')
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

// --- Plan canvas ---------------------------------------------------------

function sizeCanvas(id, minH = 200) {
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

function drawPlan() {
    const sized = sizeCanvas('plan', 240);
    if (!sized) return;
    drawDeckPlan(sized.canvas.getContext('2d'), sized.w, sized.h, plan, design, { view, show, dpr: sized.dpr });
    const section = sizeCanvas('view-section', 200);
    if (section) drawDeckSection(section.canvas.getContext('2d'), section.w, section.h, plan, design, { show, dpr: section.dpr });
    const footing = sizeCanvas('view-footing', 200);
    if (footing) drawDeckFootingDetail(footing.canvas.getContext('2d'), footing.w, footing.h, plan, design, { show, dpr: footing.dpr });
    const axono = sizeCanvas('view-axonometric', 200);
    if (axono) drawDeckAxonometric(axono.canvas.getContext('2d'), axono.w, axono.h, plan, design, { show, dpr: axono.dpr });
}

function planPoint(event) {
    // The renderer takes CSS pixels and scales the context itself, so pointer
    // positions need no devicePixelRatio correction.
    const rect = $('plan').getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function wirePlan() {
    const canvas = $('plan');
    let drag = null;

    canvas.addEventListener('pointerdown', (event) => {
        canvas.setPointerCapture(event.pointerId);
        drag = { x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY, moved: false };
        canvas.classList.add('dragging');
    });

    canvas.addEventListener('pointermove', (event) => {
        const point = planPoint(event);
        if (drag) {
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
            view = { ...view, panX: drag.panX + dx, panY: drag.panY + dy };
            drawPlan();
            return;
        }
        const world = screenToWorld(point);
        const post = postAt(plan, design, world);
        const onStair = stairAt(plan, world);
        $('hover-readout').textContent = post
            ? `POST · ${post.beam}`
            : onStair
                ? `STAIR · ${design.stair.risers} risers`
                : '';
    });

    const end = () => {
        drag = null;
        canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        view = { ...view, zoom: Math.min(Math.max(view.zoom * factor, 0.4), 5) };
        drawPlan();
    }, { passive: false });

    canvas.addEventListener('pointerleave', () => { $('hover-readout').textContent = ''; });
}

function screenToWorld(point) {
    const canvas = $('plan');
    const rect = canvas.getBoundingClientRect();
    const bounds = plan.outline.reduce((acc, entry) => ({
        minX: Math.min(acc.minX, entry.x),
        maxX: Math.max(acc.maxX, entry.x),
        minY: Math.min(acc.minY, entry.y),
        maxY: Math.max(acc.maxY, entry.y)
    }), { minX: 0, maxX: config.width, minY: 0, maxY: config.depth });
    const padding = 70;
    const scale = Math.min(
        (rect.width - padding * 2) / Math.max(bounds.maxX - bounds.minX, 1),
        (rect.height - padding * 2) / Math.max(bounds.maxY - bounds.minY, 1)
    ) * view.zoom;
    const originX = rect.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale + view.panX;
    const originY = rect.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale + view.panY;
    return { x: (point.x - originX) / scale, y: (point.y - originY) / scale };
}

// --- Wiring --------------------------------------------------------------

function switchTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === name);
    });
    ['design', 'framing', 'takeoff', 'cutlist', 'rules', 'glossary'].forEach((tab) => {
        const panel = $(`panel-${tab}`);
        if (!panel) return;
        panel.classList.toggle('hidden', tab !== name);
        if (tab === 'design') panel.classList.toggle('block', tab === name);
        else panel.classList.toggle('flex', tab === name);
    });
    if (name === 'design') window.requestAnimationFrame(drawPlan);
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
    config = { ...DECK_DEFAULTS };
    view = { zoom: 1, panX: 0, panY: 0 };
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    refresh();
    setStatus('Design reset to the default treated deck.');
}

function sendToEditor() {
    const draft = {
        config,
        summary: deckSummaryText(design).join(' · '),
        metrics: {
            areaM2: round(design.areas.deckM2, 2),
            joists: `${design.joist.count} × ${design.joist.size}`,
            beam: `${config.beamPlies} × ${config.beamSize}`,
            posts: design.post.count,
            footings: design.footing.count,
            total: design.bom.total
        },
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
        setStatus('Deck draft sent to the editor. Opening it now…');
        window.setTimeout(() => { window.location.href = 'Editor.html'; }, 350);
    } catch {
        setStatus('Could not send the draft: browser storage is unavailable.', true);
    }
}

function wireEvents() {
    FIELDS.forEach((field) => {
        const node = $(field.id);
        if (!node) return;
        const event = field.type === 'number' ? 'change' : 'change';
        node.addEventListener(event, () => {
            const value = field.type === 'checkbox' ? node.checked : field.type === 'number' ? (node.value === '' ? null : Number(node.value)) : node.value;
            setField(field.key, value);
        });
        if (field.type === 'number') {
            node.addEventListener('input', () => {
                if (node.value === '') return;
                setField(field.key, Number(node.value));
            });
        }
    });

    document.querySelectorAll('.tab').forEach((button) => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    ['decking', 'joists', 'posts', 'footings', 'guard', 'stairs', 'hardware', 'dimensions'].forEach((key) => {
        const node = $(`show-${key}`);
        if (!node) return;
        node.addEventListener('change', () => {
            show[key] = node.checked;
            drawPlan();
        });
    });

    $('fit-plan').addEventListener('click', () => {
        view = { zoom: 1, panX: 0, panY: 0 };
        drawPlan();
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

    $('reset').addEventListener('click', resetAll);
    $('takeoff-csv').addEventListener('click', () => {
        download('deck-takeoff.csv', deckTakeoffCsv(design));
        setStatus('Takeoff saved as deck-takeoff.csv');
    });
    $('cutlist-csv').addEventListener('click', () => {
        download('deck-cut-list.csv', deckCutListCsv(design));
        setStatus('Cut list saved as deck-cut-list.csv');
    });
    $('schedule-csv').addEventListener('click', () => {
        download('deck-schedule.csv', deckScheduleCsv(design));
        setStatus('Framing schedule saved as deck-schedule.csv');
    });
    $('send-editor').addEventListener('click', sendToEditor);

    window.addEventListener('resize', () => { if (activeTab === 'design') drawPlan(); });
    if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => { if (activeTab === 'design') drawPlan(); });
        if ($('panel-design')) observer.observe($('panel-design'));
        else if ($('plan')) observer.observe($('plan').parentElement);
    }
}

function init() {
    populateOptions();
    wireEvents();
    wirePlan();
    refresh();
    setStatus(`Model code: ${CODE_SCOPE.title}`);
    window.requestAnimationFrame(drawPlan);

    window.deckSuite = {
        config: () => ({ ...config }),
        plan: () => ({ outline: plan.outline.map((point) => ({ ...point })), config: { ...plan.config } }),
        design: () => design,
        summary: () => deckSummaryText(design),
        csv: () => deckTakeoffCsv(design),
        cutCsv: () => deckCutListCsv(design),
        scheduleCsv: () => deckScheduleCsv(design),
        rules: () => RULES.map((rule) => ({ id: rule.id, category: rule.category, code: rule.code })),
        setField: (key, value) => setField(key, value),
        redraw: () => drawPlan()
    };
    window.setDeckField = (key, value) => setField(key, value);
}

init();
