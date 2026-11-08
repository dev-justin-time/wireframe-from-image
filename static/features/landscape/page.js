import {
    WATER_FEATURE_TYPES,
    WATER_FEATURE_LABELS,
    POOL_SHAPES,
    POOL_SHAPE_LABELS,
    defaultWaterConfig,
    FT,
    IN
} from './design.js';
import {
    defaultSite,
    designLandscape,
    landscapeScheduleCsv,
    landscapeTakeoffCsv
} from './engine.js';
import { writeDraft } from '../../core/drafts.js';
import { applyPriceBookToDesign } from '../pricing/book.js';
import {
    normalizeLandscapePlan,
    clampFeatureToSite,
    featureAt,
    drawLandscapePlan
} from './plan.js';
import {
    RULES,
    RULE_CATEGORIES,
    RULE_LEVEL_LABEL,
    CODE_SCOPE,
    GLOSSARY,
    FORMULAS,
    ruleStatus,
    searchRules
} from './rules.js';

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = 'landscape-suite-plan';
const EDITOR_KEY = 'landscape-editor-draft';
const money = (value) => Number(value || 0).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const num = (value, digits = 2) => Number(value || 0).toFixed(digits);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

let plan = loadPlan();
let design = applyPriceBookToDesign('landscape', designLandscape(plan.feature, plan.site));
let view = { zoom: 1, panX: 0, panY: 0 };
let show = { dimensions: true, barrier: true, equipment: true, setback: true };
let activeTab = 'design';
let drag = null;
let frame = null;
let saveTimer = null;
let statusTimer = null;
let transform = null;
let showAllChecks = false;
let ruleQuery = '';
let ruleCategory = 'all';
let ruleIssuesOnly = false;
let glossaryQuery = '';
const openRules = new Set(['barrier-height', 'turnover']);
const openGlossary = new Set();

function defaultPlan() {
    const feature = { ...defaultWaterConfig('pool') };
    return normalizeLandscapePlan({ feature, site: defaultSite(feature) });
}

function loadPlan() {
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (saved?.feature) {
            return normalizeLandscapePlan({
                feature: saved.feature,
                site: { ...defaultSite(saved.feature), ...(saved.site || {}) }
            });
        }
    } catch {
        // A corrupt draft falls back to the default pool.
    }
    return defaultPlan();
}

function saveDraft() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
        } catch {
            setStatus('Could not save the design locally.', true);
        }
    }, 200);
}

function setStatus(message, error = false) {
    const node = $('status');
    node.textContent = message;
    node.className = `text-[10px] min-h-[1rem] ${error ? 'text-red-600' : 'text-sky-700'}`;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { node.textContent = ''; }, 4200);
}

function scheduleRefresh() {
    window.clearTimeout(frame);
    frame = window.setTimeout(() => {
        frame = null;
        refresh();
    }, 30);
}

function setInput(id, value) {
    const node = $(id);
    if (!node) return;
    if (node.type === 'checkbox') node.checked = Boolean(value);
    else node.value = value;
}

// --- Render ---------------------------------------------------------------

function renderMetrics() {
    const m = design.metrics;
    $('m-area').textContent = `${num(m.area, 1)} m²`;
    $('m-volume').textContent = `${m.gallons.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal`;
    $('m-volume-sub').textContent = `${num(m.volumeM3, 1)} m³`;
    $('m-flow').textContent = `${m.flowGpm.toFixed(0)} gpm`;
    $('m-turnover').textContent = `${num(m.turnoverHours, 2)} h`;
    $('m-hp').textContent = `${m.pumpHp} hp`;
    $('m-filter').textContent = `${m.filterArea.toFixed(0)} sq ft`;
    $('m-skimmers').textContent = `${m.skimmers} / ${m.skimmersRequired}`;
    $('m-bathers').textContent = String(m.bathers);
    $('m-setback').textContent = `${num(m.setback, 2)} m`;
    $('m-barrier').textContent = `${(design.barrier.height / IN).toFixed(0)} in`;
    $('m-deck').textContent = `${m.deckArea.toFixed(0)} m²`;
    $('m-cost').textContent = money(design.cost.total);
    $('m-cost-sub').textContent = `${design.schedule.length} equipment lines`;

    const errors = design.errors.length;
    const warnings = design.warnings.length;
    $('check-summary').textContent = errors
        ? `${errors} error${errors === 1 ? '' : 's'} · ${warnings} warning${warnings === 1 ? '' : 's'}`
        : warnings
            ? `No errors · ${warnings} warning${warnings === 1 ? '' : 's'}`
            : 'All modelled checks pass';
    $('check-summary').className = `text-[10px] font-mono mt-1 ${errors ? 'text-red-600' : warnings ? 'text-amber-700' : 'text-emerald-700'}`;

    const worst = design.checks.length;
    $('issue-count').textContent = `${errors + warnings} of ${worst}`;
}

function renderChecks() {
    const checks = [...design.checks].sort((a, b) => {
        const rank = { error: 0, warning: 1, info: 2 };
        return rank[a.severity] - rank[b.severity];
    });
    const visible = showAllChecks ? checks : checks.slice(0, 8);
    $('checks').innerHTML = visible.length
        ? visible.map((check) => {
            const tone = check.severity === 'error' ? 'text-red-600' : check.severity === 'warning' ? 'text-amber-700' : 'text-slate-500';
            const mark = check.severity === 'error' ? '✖' : check.severity === 'warning' ? '⚠' : 'ℹ';
            return `<li class="${tone}"><b class="font-mono">${mark}</b> ${esc(check.message)}</li>`;
        }).join('')
        : '<li class="text-emerald-700">All modelled checks pass.</li>';
    const toggle = $('show-all-checks');
    toggle.textContent = showAllChecks ? 'Show fewer checks' : `Show all checks (${checks.length})`;
    toggle.classList.toggle('hidden', checks.length <= 8);
}

function renderSchedule() {
    $('schedule-summary').textContent = `${design.schedule.length} lines · ${design.typeLabel} · ${design.filter?.label || 'filter'} · ${design.pumpHp} hp`;
    $('schedule-stats').innerHTML = [
        `<span class="px-1.5 py-0.5 rounded bg-slate-100">${design.metrics.flowGpm.toFixed(0)} gpm</span>`,
        `<span class="px-1.5 py-0.5 rounded bg-slate-100">${design.metrics.headFeet.toFixed(0)} ft TDH</span>`,
        `<span class="px-1.5 py-0.5 rounded bg-slate-100">${design.metrics.skimmers} skimmer(s)</span>`
    ].join('');
    $('schedule-table').innerHTML = `
        <table class="w-full text-[11px] border-collapse">
            <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                <th class="py-1 pr-2">Tag</th><th class="py-1 pr-2">Kind</th><th class="py-1 pr-2">Item</th>
                <th class="py-1 pr-2">Specification</th><th class="py-1 pr-2">Qty</th><th class="py-1 pr-2">Unit</th><th class="py-1">Note</th>
            </tr></thead>
            <tbody>${design.schedule.map((row) => `
                <tr class="border-b border-slate-100">
                    <td class="py-1 pr-2 font-mono">${esc(row.tag)}</td>
                    <td class="py-1 pr-2">${esc(row.kind)}</td>
                    <td class="py-1 pr-2">${esc(row.item)}</td>
                    <td class="py-1 pr-2 text-slate-500">${esc(row.spec)}</td>
                    <td class="py-1 pr-2 font-mono">${row.qty}</td>
                    <td class="py-1 pr-2">${esc(row.unit)}</td>
                    <td class="py-1 text-slate-500">${esc(row.note)}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

function renderTakeoff() {
    const m = design.metrics;
    const cards = [
        ['Estimate', money(design.cost.total), `${design.bom.length} lines`],
        ['Water', `${m.gallons.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal`, `${num(m.volumeM3, 1)} m³`],
        ['Deck', `${m.deckArea.toFixed(0)} m²`, `${m.deckPerimeter.toFixed(1)} m edge`],
        ['Barrier', `${m.barrierPerimeter.toFixed(1)} m`, `${(design.barrier.height / IN).toFixed(0)} in high`]
    ];
    $('takeoff-cards').innerHTML = cards.map(([label, value, sub]) => `
        <div class="rounded-lg border border-slate-200 p-2">
            <p class="text-[9px] uppercase tracking-wide text-slate-400">${esc(label)}</p>
            <p class="text-sm font-mono font-bold text-slate-800">${esc(value)}</p>
            <p class="text-[9px] text-slate-400">${esc(sub)}</p>
        </div>`).join('');

    $('takeoff-bom').innerHTML = `
        <table class="w-full text-[11px] border-collapse">
            <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                <th class="py-1 pr-2">Item</th><th class="py-1 pr-2">Specification</th>
                <th class="py-1 pr-2 text-right">Qty</th><th class="py-1 pr-2">Unit</th>
                <th class="py-1 pr-2 text-right">Rate</th><th class="py-1 text-right">Total</th>
            </tr></thead>
            <tbody>${design.bom.map((line) => `
                <tr class="border-b border-slate-100">
                    <td class="py-1 pr-2">${esc(line.item)}</td>
                    <td class="py-1 pr-2 text-slate-500">${esc(line.spec)}</td>
                    <td class="py-1 pr-2 text-right font-mono">${line.qty.toFixed(1)}</td>
                    <td class="py-1 pr-2">${esc(line.unit)}</td>
                    <td class="py-1 pr-2 text-right font-mono">${money(line.unitCost)}</td>
                    <td class="py-1 text-right font-mono">${money(line.total)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot><tr><td colspan="5" class="py-2 text-right font-bold">Planning estimate</td>
                <td class="py-2 text-right font-mono font-bold">${money(design.cost.total)}</td></tr></tfoot>
        </table>`;
    $('takeoff-notes').innerHTML = [
        'Planning allowances only — get three contractor quotes before committing.',
        `Excavation and shell are estimated from ${design.area.toFixed(1)} m² of water and ${design.avgDepth.toFixed(2)} m average depth.`,
        'Deck, barrier and equipment quantities follow the plan; local pricing varies widely.',
        'The estimate excludes permits, engineering, utilities, landscaping and lighting not scheduled here.'
    ].map((note) => `<li>${esc(note)}</li>`).join('');
}

function renderRules() {
    const results = searchRules(ruleQuery)
        .filter((rule) => ruleCategory === 'all' || rule.category === ruleCategory)
        .filter((rule) => !ruleIssuesOnly || ['error', 'warn'].includes(ruleStatus(rule, design.checks).state));
    $('rules-summary').textContent = `${results.length} of ${RULES.length} rules`;
    $('rules-chips').innerHTML = [
        `<button class="chip px-1.5 py-0.5 rounded border text-[10px] ${ruleCategory === 'all' ? 'active' : 'bg-white'}" data-category="all">All</button>`,
        ...RULE_CATEGORIES.map((category) => `<button class="chip px-1.5 py-0.5 rounded border text-[10px] ${ruleCategory === category.id ? 'active' : 'bg-white'}" data-category="${category.id}">${esc(category.label)}</button>`)
    ].join('');

    $('rules-list').innerHTML = results.length ? results.map((rule) => {
        const status = ruleStatus(rule, design.checks);
        const open = openRules.has(rule.id);
        const tone = { ok: 'severity-ok', warn: 'severity-warn', error: 'severity-error', info: 'severity-info' }[status.state];
        return `<article class="rule rounded-lg border border-slate-200 ${open ? 'open' : ''}" data-rule="${esc(rule.id)}">
            <button class="rule-head w-full flex items-start gap-2 px-3 py-2 text-left" data-toggle-rule="${esc(rule.id)}">
                <span class="rule-caret mt-0.5 text-slate-400">▶</span>
                <span class="flex-1">
                    <span class="block text-[11px] font-bold">${esc(rule.title)}</span>
                    <span class="block text-[10px] text-slate-400 font-mono">${esc(rule.code)}</span>
                </span>
                <span class="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 ${tone}">${status.label}</span>
            </button>
            <div class="rule-body px-3 pb-3 text-[11px] leading-snug">
                <p class="text-slate-600">${esc(rule.summary)}</p>
                <ul class="mt-1.5 space-y-0.5 list-disc pl-4 text-slate-500">
                    ${(rule.requirements || []).map((line) => `<li>${esc(line)}</li>`).join('')}
                </ul>
                <p class="mt-1.5 text-[10px] text-slate-400">${esc(RULE_LEVEL_LABEL[rule.level] || rule.level)} · ${rule.checkIds?.length ? rule.checkIds.join(' · ') : 'review only'}</p>
            </div>
        </article>`;
    }).join('') : '<p class="text-[11px] text-slate-400">No rules match that search.</p>';
}

function renderGlossary() {
    const term = glossaryQuery.trim().toLowerCase();
    const entries = GLOSSARY.filter((entry) => !term || [entry.term, entry.category, entry.short, entry.detail].join(' ').toLowerCase().includes(term));
    $('glossary-count').textContent = `${entries.length} terms`;
    const groups = [...new Set(entries.map((entry) => entry.category))];
    $('glossary-list').innerHTML = groups.length ? groups.map((category) => `
        <section>
            <h3 class="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">${esc(category)}</h3>
            <div class="space-y-1">${entries.filter((entry) => entry.category === category).map((entry) => {
                const open = openGlossary.has(entry.term);
                return `<article class="rounded border border-slate-200 ${open ? 'open' : ''}">
                    <button class="w-full px-2.5 py-1.5 text-left flex items-baseline gap-2" data-toggle-glossary="${esc(entry.term)}">
                        <span class="text-[11px] font-bold">${esc(entry.term)}</span>
                        <span class="text-[10px] text-slate-500 flex-1">${esc(entry.short)}</span>
                    </button>
                    ${open ? `<p class="px-2.5 pb-2 text-[10px] text-slate-500 leading-snug">${esc(entry.detail)}</p>` : ''}
                </article>`;
            }).join('')}</div>
        </section>`).join('') : '<p class="text-[11px] text-slate-400">No terms match that search.</p>';

    const formulaNode = $('formula-list');
    if (formulaNode) {
        formulaNode.innerHTML = FORMULAS.map((formula) => `
            <div class="flex items-baseline justify-between gap-2 py-1 border-b border-slate-100">
                <span class="text-[11px] font-bold">${esc(formula.label)}</span>
                <span class="text-[10px] font-mono text-sky-700 text-right">${esc(formula.expression)}</span>
            </div>
            <p class="text-[9px] text-slate-400 pb-1">${esc(formula.note)}</p>`).join('');
    }
}

function syncInputs() {
    const f = plan.feature;
    const s = plan.site;
    setInput('feature-type', f.type);
    setInput('feature-shape', f.shape);
    setInput('feature-code', f.code || 'ISPSC2021');
    setInput('f-width', num(f.width));
    setInput('f-length', num(f.length));
    setInput('f-shallow', num(f.shallow));
    setInput('f-deep', num(f.deep));
    setInput('f-deck', num(f.deck));
    setInput('f-turnover', num(f.turnoverHours, 2));
    setInput('f-temp', String(f.waterTempF || 102));
    setInput('f-jets', String(f.jets || 0));
    setInput('f-weir', num(f.weirLength || f.width));
    setInput('f-drop', num(f.drop));
    setInput('f-head', num(f.head ?? 40, 0));
    setInput('f-barrier', f.barrier !== false);
    setInput('f-gate', f.gateSelfClosing !== false);
    setInput('f-latch', num((f.gateLatchHeight || 54 * IN) / IN, 0));
    setInput('f-diving', Boolean(f.diving));
    setInput('f-liner', Boolean(f.liner));
    setInput('f-aeration', Boolean(f.aeration));

    setInput('s-width', num(s.width));
    setInput('s-depth', num(s.depth));
    setInput('s-slope', num(s.deckSlopePercent, 1));
    setInput('s-overhead', num(s.overheadClearance / FT, 1));
    setInput('s-receptacle', num(s.receptacleDistance / FT, 1));
    setInput('s-clearance', num(s.equipmentClearance / FT, 1));
    setInput('s-media', s.filterMedia);
    setInput('s-skimmers', String(s.skimmers));
    setInput('s-heater', Boolean(s.heater));
    setInput('s-bonded', s.bonded);
    setInput('s-gfci', s.gfci);
    setInput('s-listed', s.luminairesListed);
    setInput('s-shutoff', s.emergencyShutoff);
    setInput('s-signage', s.signage);
    setInput('s-public', s.publicPool);
    setInput('s-accessible', s.accessibleEntry);
    setInput('s-freeze', s.freezeClimate);
    setInput('s-winterized', s.winterized);
    setInput('s-cover', s.safetyCover);
    setInput('c-ph', num(s.ph, 1));
    setInput('c-chlorine', num(s.freeChlorine, 1));
    setInput('c-alk', String(s.alkalinity));
    setInput('c-cya', String(s.cya));
    setInput('c-calcium', String(s.calcium));

    $('feature-note').textContent = f.type === 'pond'
        ? 'Ponds use the deep depth for the water volume and the liner/aeration flags for the checks.'
        : f.type === 'spa'
            ? 'Spa turnover should be 30 minutes; the 104 °F limit and emergency shut-off are checked.'
            : f.type === 'water-wall'
                ? 'Water walls use the drop and weir length for the spill; the basin is checked for 6 in.'
                : 'Turnover sizes the pump and filter; the deck and barrier follow the site.';
}

function refresh() {
    design = applyPriceBookToDesign('landscape', designLandscape(plan.feature, plan.site));
    syncInputs();
    renderMetrics();
    renderChecks();
    renderSchedule();
    renderTakeoff();
    renderRules();
    renderGlossary();
    drawPlan();
}

// --- Plan ----------------------------------------------------------------

function drawPlan() {
    const canvas = $('plan');
    if (!canvas || !canvas.clientWidth) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const result = drawLandscapePlan(ctx, width, height, plan, design, { view, show });
    transform = result.transform;
}

function onPointerDown(event) {
    const point = transform?.toWorld(event.offsetX, event.offsetY);
    if (!point) return;
    if (featureAt(plan, point, true)) {
        drag = {
            type: 'feature',
            dx: point.x - plan.site.featureX,
            dz: point.z - plan.site.featureZ
        };
    } else {
        drag = {
            type: 'pan',
            x: event.offsetX,
            y: event.offsetY,
            panX: view.panX,
            panY: view.panY
        };
    }
    event.target.setPointerCapture?.(event.pointerId);
    event.target.style.cursor = 'grabbing';
}

function onPointerMove(event) {
    const point = transform?.toWorld(event.offsetX, event.offsetY);
    if (point) {
        $('hover-readout').textContent = `${point.x.toFixed(2)}, ${point.z.toFixed(2)} m`;
    }
    if (!drag) {
        const over = point && featureAt(plan, point, true);
        $('plan').style.cursor = over ? 'grab' : 'default';
        return;
    }
    if (drag.type === 'feature' && point) {
        plan.site.featureX = point.x - drag.dx;
        plan.site.featureZ = point.z - drag.dz;
        clampFeatureToSite(plan);
        saveDraft();
        scheduleRefresh();
    } else if (drag.type === 'pan') {
        view.panX = drag.panX + event.offsetX - drag.x;
        view.panY = drag.panY + event.offsetY - drag.y;
        drawPlan();
    }
}

function onPointerUp() {
    if (drag?.type === 'feature') refresh();
    drag = null;
    $('plan').style.cursor = 'default';
}

function fitPlan() {
    view = { zoom: 1, panX: 0, panY: 0 };
    drawPlan();
}

// --- Editing -------------------------------------------------------------

const NUMBER_FIELDS = ['width', 'length', 'shallow', 'deep', 'deck', 'turnoverHours', 'waterTempF', 'jets', 'weirLength', 'drop', 'head'];

function setFeatureField(key, value) {
    if (NUMBER_FIELDS.includes(key)) plan.feature[key] = Number(value);
    else if (key === 'barrier') plan.feature.barrier = Boolean(value);
    else if (key === 'gateSelfClosing') plan.feature.gateSelfClosing = Boolean(value);
    else if (key === 'gateLatchHeight') plan.feature.gateLatchHeight = Number(value) * IN;
    else if (['diving', 'liner', 'aeration'].includes(key)) plan.feature[key] = Boolean(value);
    else plan.feature[key] = value;

    if (key === 'type') {
        // Switching family starts from that family's defaults: a spa should not
        // inherit a pool's 6 h turnover or a water wall's drop.
        plan.feature = defaultWaterConfig(value);
    }
    if (['width', 'length', 'shallow', 'deep', 'deck', 'type', 'shape'].includes(key)) clampFeatureToSite(plan);
    saveDraft();
    refresh();
}

function setSiteField(key, value) {
    const numeric = ['width', 'depth', 'deckSlopePercent', 'skimmers', 'ph', 'freeChlorine', 'alkalinity', 'cya', 'calcium'];
    if (key === 'overheadClearance') plan.site[key] = Number(value) * FT;
    else if (key === 'receptacleDistance') plan.site[key] = Number(value) * FT;
    else if (key === 'equipmentClearance') plan.site[key] = Number(value) * FT;
    else if (numeric.includes(key)) plan.site[key] = Number(value);
    else plan.site[key] = Boolean(value);
    if (key === 'width' || key === 'depth') clampFeatureToSite(plan);
    saveDraft();
    refresh();
}

// --- Wiring --------------------------------------------------------------

function populateSelects() {
    $('feature-type').innerHTML = WATER_FEATURE_TYPES.map((type) =>
        `<option value="${esc(type)}">${esc(WATER_FEATURE_LABELS[type])}</option>`).join('');
    $('feature-shape').innerHTML = POOL_SHAPES.map((shape) =>
        `<option value="${esc(shape)}">${esc(POOL_SHAPE_LABELS[shape])}</option>`).join('');
    $('feature-code').innerHTML = [
        ['ISPSC2021', 'ISPSC 2021'],
        ['IRC2021', 'IRC 2021 Appendix G']
    ].map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
    $('s-media').innerHTML = Object.entries({ sand: 'Sand (15 gpm/sq ft)', de: 'DE (2 gpm/sq ft)', cartridge: 'Cartridge (0.25 gpm/sq ft)' })
        .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
}

function wireEvents() {
    $('feature-type').addEventListener('change', (event) => setFeatureField('type', event.target.value));
    $('feature-shape').addEventListener('change', (event) => setFeatureField('shape', event.target.value));
    $('feature-code').addEventListener('change', (event) => setFeatureField('code', event.target.value));
    const featureMap = {
        'f-width': ['width', false], 'f-length': ['length', false], 'f-shallow': ['shallow', false],
        'f-deep': ['deep', false], 'f-deck': ['deck', false], 'f-turnover': ['turnoverHours', false],
        'f-temp': ['waterTempF', false], 'f-jets': ['jets', false], 'f-weir': ['weirLength', false],
        'f-drop': ['drop', false], 'f-head': ['head', false], 'f-barrier': ['barrier', true],
        'f-gate': ['gateSelfClosing', true],
        'f-latch': ['gateLatchHeight', false], 'f-diving': ['diving', true], 'f-liner': ['liner', true],
        'f-aeration': ['aeration', true]
    };
    Object.entries(featureMap).forEach(([id, [key, checked]]) => {
        $(id).addEventListener('change', (event) => {
            setFeatureField(key, checked ? event.target.checked : event.target.value);
        });
    });

    const siteMap = {
        's-width': 'width', 's-depth': 'depth', 's-slope': 'deckSlopePercent',
        's-overhead': 'overheadClearance', 's-receptacle': 'receptacleDistance',
        's-clearance': 'equipmentClearance', 's-media': 'filterMedia', 's-skimmers': 'skimmers',
        's-heater': 'heater', 's-bonded': 'bonded', 's-gfci': 'gfci', 's-listed': 'luminairesListed',
        's-shutoff': 'emergencyShutoff', 's-signage': 'signage', 's-public': 'publicPool',
        's-accessible': 'accessibleEntry', 's-freeze': 'freezeClimate', 's-winterized': 'winterized',
        's-cover': 'safetyCover', 'c-ph': 'ph', 'c-chlorine': 'freeChlorine',
        'c-alk': 'alkalinity', 'c-cya': 'cya', 'c-calcium': 'calcium'
    };
    Object.entries(siteMap).forEach(([id, key]) => {
        const node = $(id);
        node.addEventListener('change', (event) => {
            setSiteField(key, event.target.type === 'checkbox' ? event.target.checked : event.target.value);
        });
    });

    document.querySelectorAll('[data-tab]').forEach((button) => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    ['dimensions', 'barrier', 'equipment', 'setback'].forEach((key) => {
        const id = `show-${key}`;
        $(id).addEventListener('change', (event) => {
            show[key] = event.target.checked;
            drawPlan();
        });
    });
    $('fit-plan').addEventListener('click', fitPlan);
    $('reset').addEventListener('click', resetAll);
    $('schedule-csv').addEventListener('click', () => downloadCsv('landscape-equipment-schedule.csv', landscapeScheduleCsv(design)));
    $('takeoff-csv').addEventListener('click', () => downloadCsv('landscape-takeoff.csv', landscapeTakeoffCsv(design)));
    $('send-editor').addEventListener('click', sendToEditor);
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
        const chip = event.target.closest('[data-category]');
        if (!chip) return;
        ruleCategory = chip.dataset.category;
        renderRules();
    });
    $('rules-list').addEventListener('click', (event) => {
        const head = event.target.closest('[data-toggle-rule]');
        if (!head) return;
        const id = head.dataset.toggleRule;
        if (openRules.has(id)) openRules.delete(id);
        else openRules.add(id);
        renderRules();
    });
    $('glossary-search').addEventListener('input', (event) => {
        glossaryQuery = event.target.value;
        renderGlossary();
    });
    $('glossary-list').addEventListener('click', (event) => {
        const button = event.target.closest('[data-toggle-glossary]');
        if (!button) return;
        const term = button.dataset.toggleGlossary;
        if (openGlossary.has(term)) openGlossary.delete(term);
        else openGlossary.add(term);
        renderGlossary();
    });

    const canvas = $('plan');
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', () => { $('hover-readout').textContent = ''; });
    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        const before = transform?.toWorld(event.offsetX, event.offsetY);
        view.zoom = Math.min(4, Math.max(0.4, view.zoom * (event.deltaY < 0 ? 1.1 : 0.9)));
        drawPlan();
        const after = transform?.toWorld(event.offsetX, event.offsetY);
        if (before && after) {
            view.panX += (after.x - before.x) * (transform?.scale || 0);
            view.panY += (after.z - before.z) * (transform?.scale || 0);
            drawPlan();
        }
    }, { passive: false });
    window.addEventListener('resize', drawPlan);
    if (window.ResizeObserver) new ResizeObserver(drawPlan).observe(canvas.parentElement);
}

function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('[data-tab]').forEach((button) => {
        const active = button.dataset.tab === tab;
        button.classList.toggle('active', active);
        button.classList.toggle('bg-white', !active);
    });
    ['design', 'schedule', 'takeoff', 'rules', 'glossary'].forEach((name) => {
        $(`panel-${name}`).classList.toggle('hidden', name !== tab);
        $(`panel-${name}`).classList.toggle('flex', name === tab);
    });
    if (tab === 'design') window.requestAnimationFrame(drawPlan);
}

function downloadCsv(filename, text) {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function resetAll() {
    plan = defaultPlan();
    view = { zoom: 1, panX: 0, panY: 0 };
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    refresh();
    setStatus('Design reset to the default pool.');
}

function sendToEditor() {
    const draft = {
        feature: plan.feature,
        site: plan.site,
        summary: `${design.typeLabel} · ${design.gallons.toFixed(0)} gal · ${design.metrics.flowGpm.toFixed(0)} gpm`
    };
    try {
        if (!writeDraft(EDITOR_KEY, draft)) throw new Error('editor draft not saved');
        localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
        setStatus('Landscape draft sent to the editor. Opening it now…');
        window.setTimeout(() => { window.location.href = 'Editor.html'; }, 350);
    } catch {
        setStatus('Could not send the draft: browser storage is unavailable.', true);
    }
}

function init() {
    populateSelects();
    wireEvents();
    refresh();
    setStatus(`Model code: ${CODE_SCOPE.title}`);
}

init();
