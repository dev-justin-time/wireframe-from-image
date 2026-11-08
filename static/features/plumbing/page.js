import {
    FIXTURE_TYPES,
    HEATER_TYPES,
    PLAN_TEMPLATES,
    WATER_MATERIALS,
    DWV_MATERIALS,
    GAS_MATERIALS,
    FINISH_GRADES,
    FAUCET_FINISHES,
    HOOKUP_SIDES,
    GROUP_LABELS,
    GROUP_COLOURS,
    fixtureById,
    heaterById,
    templateById,
    finishGradeById,
    faucetFinishById
} from './catalog.js';
import {
    createPlan,
    normalizePlan,
    applyTemplate,
    autoLayout,
    addFixture,
    removeFixture,
    moveFixture,
    moveHeater,
    setHookup,
    fixtureAt,
    heaterAt,
    hookupAt,
    positionFor,
    heaterPosition,
    hookupPoint,
    zonesFor,
    rotationForWall,
    nearestWall
} from './plan.js';
import {
    designPlumbing,
    scheduleCsv,
    takeoffCsv,
    GLOSSARY
} from './engine.js';
import { applyPriceBookToDesign } from '../pricing/book.js';
import {
    RULES,
    RULE_CATEGORIES,
    RULE_LEVEL_LABEL,
    CODE_SCOPE,
    ruleStatus,
    searchRules
} from './rules.js';

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = 'plumbing-suite-plan';

const COLOURS = {
    cold: '#0284c7',
    hot: '#dc2626',
    drain: '#475569',
    gas: '#d97706',
    vent: '#7c3aed',
    water: '#0284c7',
    sewer: '#475569',
    selected: '#0ea5e9',
    ink: '#0f172a',
    grid: '#e2e8f0'
};

const FINISH_COLOURS = {
    standard: '#e2e8f0',
    premium: '#bae6fd',
    luxury: '#fde68a'
};

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const money0 = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money2 = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (value, digits = 2) => Number(value || 0).toFixed(digits);

let plan = loadPlan();
let design = applyPriceBookToDesign('plumbing', designPlumbing(plan));
let part = 'rough';
let activeTab = 'rough';
let tool = 'select';
let selectedType = 'toilet';
let selectedId = null;
let selectedKind = null;
let drag = null;
let views = {};
let show = { cold: true, hot: true, drain: true, vent: true, gas: true, zones: true, labels: true, clearances: false };
let showAllChecks = false;
let ruleQuery = '';
let ruleCategory = 'all';
let ruleIssuesOnly = false;
let glossaryQuery = '';
let saveTimer = null;
let statusTimer = null;
const openRules = new Set(['water-service', 'sewer-size', 'trap-arm']);
const openGlossary = new Set();

function loadPlan() {
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (saved) return normalizePlan(saved);
    } catch (error) {
        // A broken draft should not stop the page opening.
    }
    return createPlan({ template: 'house' });
}

function savePlan() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
        } catch (error) {
            setStatus('Could not save the draft in this browser.');
        }
    }, 250);
}

function setStatus(text) {
    $('status').textContent = text || '';
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { $('status').textContent = ''; }, 5000);
}

function selectedFixture() {
    return selectedKind === 'fixture' ? plan.fixtures.find((entry) => entry.id === selectedId) || null : null;
}

function selectedHeater() {
    return selectedKind === 'heater' ? plan.waterHeater : null;
}

function selectedHookup() {
    return selectedKind === 'hookup' ? selectedId : null;
}

function tagMap() {
    return new Map(design.schedule.map((entry) => [entry.id, entry.tag]));
}

function populateSelects() {
    $('template').innerHTML = PLAN_TEMPLATES.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join('');
    $('water-side').innerHTML = HOOKUP_SIDES.map((side) => `<option value="${side}">${side}</option>`).join('');
    $('sewer-side').innerHTML = $('water-side').innerHTML;
    $('gas-side').innerHTML = $('water-side').innerHTML;
    $('water-material').innerHTML = WATER_MATERIALS.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join('');
    $('dwv-material').innerHTML = DWV_MATERIALS.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join('');
    $('gas-material').innerHTML = GAS_MATERIALS.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join('');
    $('heater-type').innerHTML = '<option value="">No water heater</option>' + HEATER_TYPES.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join('');
    $('fixture-grade').innerHTML = FINISH_GRADES.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join('');
    $('faucet-finish').innerHTML = FAUCET_FINISHES.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join('');
    const groups = new Map();
    FIXTURE_TYPES.forEach((entry) => {
        if (!groups.has(entry.group)) groups.set(entry.group, []);
        groups.get(entry.group).push(entry);
    });
    $('fixture-type').innerHTML = [...groups.entries()].map(([group, entries]) => (
        `<optgroup label="${esc(GROUP_LABELS[group] || group)}">${entries.map((entry) => `<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join('')}</optgroup>`
    )).join('');
}

const setValue = (id, value) => {
    const element = $(id);
    if (!element) return;
    if (document.activeElement !== element) element.value = value;
};
const setChecked = (id, value) => {
    const element = $(id);
    if (element) element.checked = Boolean(value);
};

function syncFields() {
    setValue('template', plan.template);
    setValue('width', plan.width.toFixed(1));
    setValue('depth', plan.depth.toFixed(1));
    setValue('wall-height', plan.wallHeight.toFixed(2));

    setValue('water-side', plan.water.side);
    setValue('water-along', plan.water.along.toFixed(2));
    setValue('water-pressure', plan.water.pressure);
    setValue('meter-size', plan.water.meterSize);
    setValue('sewer-side', plan.sewer.side);
    setValue('sewer-along', plan.sewer.along.toFixed(2));
    setValue('sewer-invert', plan.sewer.invert.toFixed(2));
    setValue('sewer-slope', (plan.sewer.slope * 100).toFixed(1));
    setValue('gas-side', plan.gas.side);
    setValue('gas-along', plan.gas.along.toFixed(2));
    setValue('gas-pressure', plan.gas.pressure);
    setValue('gas-type', plan.gas.type);
    setValue('gas-meter', plan.gas.meterCapacity);

    setValue('water-material', plan.water.serviceMaterial);
    setValue('dwv-material', plan.sewer.material);
    setValue('gas-material', plan.gas.material);
    setValue('backflow', plan.water.backflow);
    setChecked('water-insulation', plan.water.insulation);

    setValue('heater-type', plan.waterHeater ? plan.waterHeater.typeId : '');
    setValue('heater-temp', plan.waterHeater ? plan.waterHeater.temperature : '');
    setChecked('heater-pan', plan.waterHeater?.pan);
    setChecked('heater-expansion', plan.waterHeater?.expansionTank);
    setChecked('heater-relief', plan.waterHeater?.reliefPipe);
    setChecked('heater-insulated', plan.waterHeater?.insulated);

    setValue('fixture-grade', plan.fixtureGrade);
    setValue('faucet-finish', plan.faucetFinish);
    setChecked('finish-airgap', plan.finish.airGap);
    setChecked('finish-washer', plan.finish.washerStandpipe);
    setChecked('finish-stops', plan.finish.supplyStops);
    setValue('fixture-type', selectedType);

    const waterMaterial = WATER_MATERIALS.find((entry) => entry.id === plan.water.serviceMaterial) || WATER_MATERIALS[0];
    const dwvMaterial = DWV_MATERIALS.find((entry) => entry.id === plan.sewer.material) || DWV_MATERIALS[0];
    const gasMaterial = GAS_MATERIALS.find((entry) => entry.id === plan.gas.material) || GAS_MATERIALS[0];
    $('material-note').textContent = `${waterMaterial.label}: ${waterMaterial.note} ${dwvMaterial.label}: ${dwvMaterial.note} ${gasMaterial.label}: ${gasMaterial.note}`;
}

function renderMetrics() {
    const summary = design.summary;
    $('m-rough').textContent = money0(summary.rough);
    $('m-finish').textContent = money0(summary.finish);
    $('m-total').textContent = money0(summary.total);
    $('m-demand').textContent = `${num(summary.demandGpm, 1)} gpm`;
    $('m-pressure').textContent = `${num(summary.residual, 1)} psi`;
    $('m-dfu').textContent = `${num(summary.totalDfu, 0)} DFU`;
    $('m-gas').textContent = `${num(summary.gasCfh, 0)} CFH`;
    $('m-fixtures').textContent = `${summary.fixtureCount}`;
    $('m-main').textContent = `${design.drain.mainSize}`;
    const issueCount = $('issue-count');
    issueCount.textContent = `${summary.errors} error${summary.errors === 1 ? '' : 's'} · ${summary.warnings} warn`;
    issueCount.className = `text-[10px] font-mono ${summary.errors ? 'severity-error' : summary.warnings ? 'severity-warn' : 'severity-ok'}`;
    $('check-summary').textContent = summary.errors
        ? `${summary.errors} error${summary.errors === 1 ? '' : 's'} and ${summary.warnings} warning${summary.warnings === 1 ? '' : 's'} need attention.`
        : summary.warnings
            ? `${summary.warnings} warning${summary.warnings === 1 ? '' : 's'} · ${design.ok.length} checks pass.`
            : `All ${design.ok.length} model checks pass.`;
    $('check-summary').className = `text-[10px] font-mono mt-1 ${summary.errors ? 'severity-error' : summary.warnings ? 'severity-warn' : 'severity-ok'}`;
}

function renderChecks() {
    const all = [...design.errors, ...design.warnings, ...design.ok];
    const visible = showAllChecks ? all : all.slice(0, 9);
    $('checks').innerHTML = visible.map((check) => `
        <li class="flex gap-1.5">
            <span class="status-dot mt-1 shrink-0" style="background:${check.severity === 'error' ? '#dc2626' : check.severity === 'warn' ? '#d97706' : '#16a34a'}"></span>
            <span><b>${esc(check.label)}</b><br><span class="text-slate-500">${esc(check.detail)}</span></span>
        </li>
    `).join('');
    $('show-all-checks').textContent = showAllChecks ? 'Show fewer checks' : `Show all ${all.length} checks`;
}

function renderFinishList() {
    const tags = tagMap();
    $('finish-fixtures').innerHTML = plan.fixtures.map((entry) => {
        const type = fixtureById(entry.typeId);
        const selected = selectedKind === 'fixture' && selectedId === entry.id;
        return `
            <div class="finish-card rounded-lg border ${selected ? 'border-sky-500 bg-sky-50 selected' : 'border-slate-200'} p-2" data-id="${esc(entry.id)}">
                <button class="w-full flex items-baseline gap-2 text-left" data-select="${esc(entry.id)}">
                    <span class="font-mono text-[10px] text-sky-700">${esc(tags.get(entry.id) || '—')}</span>
                    <span class="text-[11px] font-semibold">${esc(type.label)}</span>
                    <span class="ml-auto text-[9px] text-slate-400">${esc(finishGradeById(entry.finish).label)}</span>
                </button>
                <div class="grid grid-cols-2 gap-1.5 mt-1.5">
                    <label class="block text-[9px] text-slate-400">Grade
                        <select data-finish="${esc(entry.id)}" class="mt-0.5 w-full rounded border border-slate-200 px-1 py-0.5 text-[10px]">
                            ${FINISH_GRADES.map((grade) => `<option value="${esc(grade.id)}" ${grade.id === entry.finish ? 'selected' : ''}>${esc(grade.label)}</option>`).join('')}
                        </select>
                    </label>
                    ${type.hasFaucet ? `<label class="block text-[9px] text-slate-400">Faucet
                        <select data-faucet="${esc(entry.id)}" class="mt-0.5 w-full rounded border border-slate-200 px-1 py-0.5 text-[10px]">
                            ${FAUCET_FINISHES.map((faucet) => `<option value="${esc(faucet.id)}" ${faucet.id === entry.faucet ? 'selected' : ''}>${esc(faucet.label)}</option>`).join('')}
                        </select>
                    </label>` : '<span class="text-[9px] text-slate-400 mt-3">No faucet</span>'}
                </div>
            </div>
        `;
    }).join('');
    $('finish-count').textContent = `${plan.fixtures.length} fixture${plan.fixtures.length === 1 ? '' : 's'}`;
    const premium = plan.fixtures.filter((entry) => entry.finish !== 'standard').length;
    const faucets = plan.fixtures.filter((entry) => fixtureById(entry.typeId).hasFaucet).length;
    $('finish-fixture-total').textContent = `${plan.fixtures.length}`;
    $('finish-premium').textContent = `${premium}`;
    $('finish-faucets').textContent = `${faucets}`;
    $('finish-total').textContent = money0(design.takeoff.finish.total);
}

function renderSchedule() {
    const summary = design.summary;
    $('schedule-summary').textContent = `${summary.fixtureCount} fixtures · ${summary.waterFixtures} water · ${summary.drainFixtures} drain · ${summary.gasAppliances} gas · ${summary.demandGpm} gpm peak · ${summary.totalDfu} DFU`;
    $('schedule-stats').innerHTML = `
        <span class="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">${summary.totalWsfu} WSFU</span>
        <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">${summary.totalDfu} DFU</span>
        <span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">${summary.gasCfh} CFH</span>
    `;
    const header = ['Tag', 'Fixture', 'Location', 'Cold', 'Hot', 'DFU', 'Drain', 'Supply', 'Gas BTU', 'Gas CFH', 'Finish', 'Pressure'];
    $('schedule-table').innerHTML = `
        <table class="w-full text-[10px]">
            <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                ${header.map((cell) => `<th class="px-2 py-1 font-semibold whitespace-nowrap">${cell}</th>`).join('')}
            </tr></thead>
            <tbody>
                ${design.schedule.map((entry) => `
                    <tr class="border-b border-slate-100 hover:bg-slate-50">
                        <td class="px-2 py-1 font-mono font-bold text-sky-700">${esc(entry.tag)}</td>
                        <td class="px-2 py-1 font-semibold">${esc(entry.fixture)}</td>
                        <td class="px-2 py-1 text-slate-500">${esc(entry.location)}</td>
                        <td class="px-2 py-1 font-mono text-right">${entry.coldWsfu}</td>
                        <td class="px-2 py-1 font-mono text-right">${entry.hotWsfu}</td>
                        <td class="px-2 py-1 font-mono text-right">${entry.dfu}</td>
                        <td class="px-2 py-1 font-mono">${esc(entry.drain)}</td>
                        <td class="px-2 py-1 font-mono">${esc(entry.supply)}</td>
                        <td class="px-2 py-1 font-mono text-right">${entry.gasBtu || '—'}</td>
                        <td class="px-2 py-1 font-mono text-right">${entry.gasCfh || '—'}</td>
                        <td class="px-2 py-1">${esc(entry.finish)}</td>
                        <td class="px-2 py-1 font-mono text-right">${entry.pressure === null ? '—' : `${num(entry.pressure, 1)} psi`}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function takeoffTable(section) {
    const rows = section.groups.map((group) => `
        <tr class="bg-slate-50"><td colspan="5" class="px-2 py-1 font-bold text-slate-600">${esc(group.group)}</td></tr>
        ${group.rows.map((row) => `
            <tr class="border-t border-slate-100 align-top">
                <td class="px-2 py-0.5">${esc(row.label)}<br><span class="text-[9px] text-slate-400">${esc(row.note)}</span></td>
                <td class="px-2 py-0.5 font-mono text-right">${row.qty.toLocaleString()}</td>
                <td class="px-2 py-0.5 font-mono">${esc(row.unit)}</td>
                <td class="px-2 py-0.5 font-mono text-right">${money2(row.unitCost)}</td>
                <td class="px-2 py-0.5 font-mono text-right">${money2(row.total)}</td>
            </tr>
        `).join('')}
    `).join('');
    return `
        <table class="w-full text-[10px]">
            <thead><tr class="text-left text-slate-500 border-b border-slate-200">
                <th class="px-2 py-1 font-semibold">Item</th>
                <th class="px-2 py-1 font-semibold text-right">Qty</th>
                <th class="px-2 py-1 font-semibold">Unit</th>
                <th class="px-2 py-1 font-semibold text-right">Unit $</th>
                <th class="px-2 py-1 font-semibold text-right">Total</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr class="border-t-2 border-slate-300 font-bold">
                    <td class="px-2 py-1" colspan="4">Materials + labour</td>
                    <td class="px-2 py-1 font-mono text-right">${money2(section.total)}</td>
                </tr>
            </tfoot>
        </table>
    `;
}

function renderTakeoff() {
    const rough = design.takeoff.rough;
    const finish = design.takeoff.finish;
    $('takeoff-cards').innerHTML = [
        { label: 'Part 1 · rough-in', value: money0(rough.total), note: `${money0(rough.materials)} materials + ${money0(rough.labour)} labour`, bg: '#f0f9ff', border: '#e0f2fe', ink: '#0369a1' },
        { label: 'Part 2 · finish', value: money0(finish.total), note: `${money0(finish.materials)} materials + ${money0(finish.labour)} labour`, bg: '#f0fdf4', border: '#dcfce7', ink: '#15803d' },
        { label: 'Contract total', value: money0(design.takeoff.total), note: `${money0(design.summary.total)} planning estimate`, bg: '#f8fafc', border: '#e2e8f0', ink: '#334155' },
        { label: 'Pipe measured', value: `${num(design.water.routes.reduce((sum, edge) => sum + edge.length, 0) + design.drain.routes.reduce((sum, route) => sum + route.length, 0), 0)} m`, note: 'water + DWV + vents', bg: '#fffbeb', border: '#fef3c7', ink: '#b45309' }
    ].map((card) => `
        <div class="rounded-lg border p-2" style="background:${card.bg};border-color:${card.border}">
            <div class="text-[9px] uppercase tracking-wide" style="color:${card.ink}">${esc(card.label)}</div>
            <div class="text-base font-mono font-bold">${esc(card.value)}</div>
            <div class="text-[9px] text-slate-500">${esc(card.note)}</div>
        </div>
    `).join('');
    $('rough-total').textContent = money0(rough.total);
    $('finish-total-2').textContent = money0(finish.total);
    $('takeoff-rough').innerHTML = takeoffTable(rough);
    $('takeoff-finish').innerHTML = takeoffTable(finish);
    $('takeoff-notes').innerHTML = design.takeoff.assumptions.map((note) => `<li>${esc(note)}</li>`).join('');
}

function renderRules() {
    const statuses = new Map(RULES.map((rule) => [rule.id, ruleStatus(rule, design.checks)]));
    const attention = RULES.filter((rule) => ['error', 'warn'].includes(statuses.get(rule.id).state)).length;
    $('rules-summary').textContent = `${RULES.length} rules · ${attention} need attention · ${CODE_SCOPE.title}`;
    if ($('rules-scope')) $('rules-scope').textContent = CODE_SCOPE.body;
    $('rules-chips').innerHTML = [
        `<button class="chip px-1.5 py-0.5 rounded border border-slate-200 text-[10px] ${ruleCategory === 'all' ? 'active' : ''}" data-category="all">All · ${RULES.length}</button>`,
        ...RULE_CATEGORIES.map((category) => {
            const count = RULES.filter((rule) => rule.category === category.id).length;
            return `<button class="chip px-1.5 py-0.5 rounded border border-slate-200 text-[10px] ${ruleCategory === category.id ? 'active' : ''}" data-category="${esc(category.id)}">${esc(category.label)} · ${count}</button>`;
        })
    ].join('');
    const filtered = searchRules(ruleQuery)
        .filter((rule) => ruleCategory === 'all' || rule.category === ruleCategory)
        .filter((rule) => !ruleIssuesOnly || ['error', 'warn'].includes(statuses.get(rule.id).state));
    $('rules-list').innerHTML = filtered.map((rule) => {
        const status = statuses.get(rule.id);
        const open = openRules.has(rule.id);
        const colour = status.state === 'error' ? '#dc2626' : status.state === 'warn' ? '#d97706' : status.state === 'ok' ? '#16a34a' : '#64748b';
        const checks = (rule.checkIds || []).map((id) => design.checks.find((entry) => entry.id === id)).filter(Boolean);
        return `
            <article class="rule ${open ? 'open' : ''} rounded-lg border border-slate-200" data-rule="${esc(rule.id)}">
                <button class="w-full flex items-start gap-2 p-2 text-left" data-rule-toggle="${esc(rule.id)}">
                    <span class="status-dot mt-1 shrink-0" style="background:${colour}"></span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-[11px] font-bold">${esc(rule.title)}</span>
                        <span class="block text-[10px] text-slate-500">${esc(rule.code)} · ${esc(RULE_LEVEL_LABEL[rule.level] || rule.level)} · <span style="color:${colour}">${esc(status.label)}</span></span>
                    </span>
                    <span class="rule-caret text-slate-400 text-[10px] mt-0.5">▶</span>
                </button>
                <div class="rule-body px-2 pb-2 text-[10px] text-slate-600 border-t border-slate-100">
                    <p class="mt-1.5 text-[11px] text-slate-700">${esc(rule.summary)}</p>
                    <ul class="list-disc pl-4 mt-1 space-y-0.5">${rule.requirements.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
                    <p class="mt-1.5">${esc(rule.detail)}</p>
                    <div class="mt-1.5 flex flex-wrap gap-1">
                        ${checks.length ? checks.map((check) => `<span class="px-1 py-0.5 rounded border text-[9px] ${check.severity === 'error' ? 'border-red-200 bg-red-50 text-red-700' : check.severity === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}">${esc(check.label)}</span>`).join('') : '<span class="text-slate-400">No geometry check on this rule — verify with the local authority.</span>'}
                    </div>
                </div>
            </article>
        `;
    }).join('') || '<p class="text-[11px] text-slate-400 p-4">No rules match that search.</p>';
}

function renderGlossary() {
    const query = glossaryQuery.trim().toLowerCase();
    const filtered = query
        ? GLOSSARY.filter((entry) => `${entry.term} ${entry.short} ${entry.detail}`.toLowerCase().includes(query))
        : GLOSSARY;
    const groups = new Map();
    filtered.forEach((entry) => {
        if (!groups.has(entry.category)) groups.set(entry.category, []);
        groups.get(entry.category).push(entry);
    });
    $('glossary-count').textContent = `${filtered.length} of ${GLOSSARY.length}`;
    $('glossary-list').innerHTML = [...groups.entries()].map(([category, entries]) => `
        <section>
            <h3 class="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">${esc(category)}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                ${entries.map((entry) => `
                    <article class="rounded-lg border border-slate-200 p-2" data-term="${esc(entry.term)}">
                        <button class="w-full text-left" data-term-toggle="${esc(entry.term)}">
                            <span class="text-[11px] font-bold">${esc(entry.term)}</span>
                            <span class="block text-[10px] text-slate-500 mt-0.5">${esc(entry.short)}</span>
                        </button>
                        ${openGlossary.has(entry.term) ? `<p class="text-[10px] text-slate-600 border-t border-slate-100 mt-1 pt-1">${esc(entry.detail)}</p>` : ''}
                    </article>
                `).join('')}
            </div>
        </section>
    `).join('') || '<p class="text-[11px] text-slate-400 p-4">No terms match that search.</p>';
}

/* ------------------------------------------------------------------ canvas */

function rr(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function viewFor(canvas) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return null;
    const padX = Math.max(54, width * 0.06);
    const padY = Math.max(52, height * 0.08);
    const fit = Math.min((width - padX * 2) / plan.width, (height - padY * 2) / plan.depth);
    const scale = Math.max(fit, 4);
    return {
        width,
        height,
        scale,
        ox: (width - plan.width * scale) / 2,
        oy: (height - plan.depth * scale) / 2
    };
}

const screenPoint = (view, point) => ({
    x: view.ox + point.x * view.scale,
    y: view.oy + point.y * view.scale
});

function drawCanvas(id, mode) {
    const canvas = $(id);
    if (!canvas || !canvas.clientWidth || !canvas.clientHeight) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const view = viewFor(canvas);
    if (!view) return;
    views[id] = view;
    const width = view.width;
    const height = view.height;
    const S = (point) => screenPoint(view, point);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const left = view.ox;
    const top = view.oy;
    const roomW = plan.width * view.scale;
    const roomD = plan.depth * view.scale;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.13)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#ffffff';
    rr(ctx, left, top, roomW, roomD, 4);
    ctx.fill();
    ctx.restore();

    ctx.save();
    rr(ctx, left, top, roomW, roomD, 4);
    ctx.clip();

    if (show.zones) {
        zonesFor(plan.width, plan.depth).forEach((zone) => {
            const p = S({ x: zone.x, y: zone.y });
            ctx.fillStyle = GROUP_COLOURS[zone.id] || '#f1f5f9';
            ctx.globalAlpha = mode === 'finish' ? 0.55 : 0.38;
            ctx.fillRect(p.x, p.y, zone.width * view.scale, zone.height * view.scale);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 8px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.fillText(zone.label, p.x + 5, p.y + 12);
        });
    }

    // Half-metre grid, with a darker one-metre line.
    ctx.lineWidth = 1;
    for (let x = 0; x <= plan.width + 0.001; x += 0.5) {
        const p = S({ x, y: 0 });
        ctx.strokeStyle = Math.abs(x - Math.round(x)) < 0.01 ? '#e2e8f0' : '#f1f5f9';
        ctx.beginPath();
        ctx.moveTo(p.x, top);
        ctx.lineTo(p.x, top + roomD);
        ctx.stroke();
    }
    for (let y = 0; y <= plan.depth + 0.001; y += 0.5) {
        const p = S({ x: 0, y });
        ctx.strokeStyle = Math.abs(y - Math.round(y)) < 0.01 ? '#e2e8f0' : '#f1f5f9';
        ctx.beginPath();
        ctx.moveTo(left, p.y);
        ctx.lineTo(left + roomW, p.y);
        ctx.stroke();
    }

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.strokeRect(left, top, roomW, roomD);
    ctx.restore();

    if (mode === 'rough') {
        const drainWidth = (size) => ({ '1-1/4': 3, '1-1/2': 3.5, '2': 4, '3': 5.5, '4': 7 }[size] || 4);
        const drawRoute = (route, colour, width, dash = []) => {
            if (!route.points || route.points.length < 2) return;
            ctx.save();
            ctx.strokeStyle = colour;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash(dash);
            ctx.beginPath();
            route.points.forEach((point, index) => {
                const p = S(point);
                if (index === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
            ctx.restore();
        };

        if (show.drain) {
            design.drain.routes.forEach((route) => drawRoute(route, COLOURS.drain, drainWidth(route.size)));
            // Flow chevrons on the building drain, pointed at the sewer.
            const main = design.drain.routes.find((route) => route.id === 'building_drain');
            if (main && main.points.length > 1) {
                const a = S(main.points[0]);
                const b = S(main.points[1]);
                const midX = (a.x + b.x) / 2;
                const midY = (a.y + b.y) / 2;
                const dir = b.x >= a.x ? 1 : -1;
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.beginPath();
                ctx.moveTo(midX + dir * 7, midY);
                ctx.lineTo(midX - dir * 3, midY - 4);
                ctx.lineTo(midX - dir * 3, midY + 4);
                ctx.closePath();
                ctx.fill();
            }
        }
        if (show.cold) design.water.routes.filter((route) => route.kind === 'cold').forEach((route) => drawRoute(route, COLOURS.cold, 2.3));
        if (show.hot) design.water.routes.filter((route) => route.kind === 'hot').forEach((route) => drawRoute(route, COLOURS.hot, 2.3));
        if (show.gas) design.gas.routes.forEach((route) => drawRoute(route, COLOURS.gas, 2.3));

        // Stacks and vent terminals.
        design.drain.stacks.forEach((stack) => {
            const p = S(stack);
            if (show.vent) {
                const vent = S({ x: stack.x, y: Math.max(0.12, stack.y - 0.48) });
                ctx.save();
                ctx.strokeStyle = COLOURS.vent;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(vent.x, vent.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = COLOURS.vent;
                ctx.beginPath();
                ctx.moveTo(vent.x, vent.y - 6);
                ctx.lineTo(vent.x - 6, vent.y + 3);
                ctx.lineTo(vent.x + 6, vent.y + 3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
            ctx.fillStyle = COLOURS.ink;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('S', p.x, p.y + 0.5);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        });

        if (show.labels) {
            const labelled = new Set(['building_drain', 'sewer_lateral']);
            const best = (routes, filter = () => true) => routes.filter((route) => filter(route)).sort((a, b) => b.length - a.length)[0];
            const coldBest = best(design.water.routes, (route) => route.kind === 'cold');
            const hotBest = best(design.water.routes, (route) => route.kind === 'hot');
            const gasBest = best(design.gas.routes);
            [coldBest, hotBest, gasBest].filter(Boolean).forEach((route) => labelled.add(route.id));
            [...design.water.routes, ...design.drain.routes, ...design.gas.routes].forEach((route) => {
                if (!labelled.has(route.id)) return;
                const bestSegment = route.points.reduce((bestValue, point, index) => {
                    if (index === 0) return bestValue;
                    const a = S(route.points[index - 1]);
                    const b = S(point);
                    const length = Math.hypot(b.x - a.x, b.y - a.y);
                    return length > bestValue.length ? { a, b, length } : bestValue;
                }, { a: null, b: null, length: 0 });
                if (!bestSegment.a) return;
                const x = (bestSegment.a.x + bestSegment.b.x) / 2;
                const y = (bestSegment.a.y + bestSegment.b.y) / 2;
                drawLabel(ctx, route.label, x, y, route.kind === 'hot' ? COLOURS.hot : route.service === 'gas' ? COLOURS.gas : route.service === 'drain' ? COLOURS.drain : COLOURS.cold);
            });
        }

    }

    const clearanceEntries = show.clearances
        ? plan.fixtures
        : selectedKind === 'fixture' && selectedFixture() ? [selectedFixture()] : [];
    clearanceEntries.forEach((entry) => drawClearance(ctx, entry, view, S));

    plan.fixtures.forEach((entry) => {
        drawFixture(ctx, entry, view, mode, S);
    });
    if (plan.waterHeater) drawHeater(ctx, plan.waterHeater, view, S);

    if (mode === 'rough') ['water', 'sewer', 'gas'].forEach((service) => drawHookup(ctx, service, view, S));

    // Scale bar and north arrow.
    drawScaleBar(ctx, view);
    drawNorth(ctx, view);

    const hint = id === 'plan-rough' ? `${plan.fixtures.length} fixtures · ${design.drain.stacks.length} stacks · ${design.water.serviceSize} water service` : `${plan.fixtures.length} finish pieces · drag a fixture or edit its grade in the sidebar`;
    $(id === 'plan-rough' ? 'plan-hint' : 'finish-hint').textContent = hint;
}

function drawLabel(ctx, text, x, y, colour = '#475569') {
    ctx.save();
    ctx.font = 'bold 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    const width = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    rr(ctx, x - width / 2 - 2, y - 8, width + 4, 10, 2);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.fillText(text, x - width / 2, y);
    ctx.restore();
}

function drawFixture(ctx, entry, view, mode, S) {
    const type = fixtureById(entry.typeId);
    const centre = positionFor(plan, entry, type);
    const p = S(centre);
    const w = type.width * view.scale;
    const d = type.depth * view.scale;
    const selected = selectedKind === 'fixture' && selectedId === entry.id;
    const fill = mode === 'finish' ? FINISH_COLOURS[entry.finish] || '#e2e8f0' : GROUP_COLOURS[type.group] || '#e2e8f0';
    const rotation = entry.wall === 'free' ? 0 : rotationForWall(entry.wall);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation);
    ctx.fillStyle = fill;
    ctx.strokeStyle = selected ? COLOURS.selected : '#334155';
    ctx.lineWidth = selected ? 2.4 : 1.1;
    const halfW = w / 2;
    const halfD = d / 2;
    const top = -halfD;
    const bottom = halfD;
    const left = -halfW;
    const right = halfW;
    ctx.beginPath();

    switch (type.shape) {
        case 'toilet': {
            rr(ctx, left + w * 0.14, top, w * 0.72, d * 0.3, 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, d * 0.1, w * 0.36, d * 0.31, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
        }
        case 'lavatory': {
            rr(ctx, left, top, w, d, 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, d * 0.07, w * 0.3, d * 0.28, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, top + d * 0.14, Math.max(1.2, w * 0.035), 0, Math.PI * 2);
            ctx.fillStyle = '#64748b';
            ctx.fill();
            break;
        }
        case 'sink': {
            rr(ctx, left, top, w, d, 2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeRect(left + w * 0.12, top + d * 0.24, w * 0.34, d * 0.58);
            ctx.strokeRect(left + w * 0.52, top + d * 0.24, w * 0.34, d * 0.58);
            break;
        }
        case 'tub': {
            rr(ctx, left, top, w, d, 3);
            ctx.fill();
            ctx.stroke();
            rr(ctx, left + w * 0.08, top + d * 0.12, w * 0.84, d * 0.76, 3);
            ctx.stroke();
            break;
        }
        case 'shower': {
            ctx.rect(left, top, w, d);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(left + w * 0.1, top + d * 0.1);
            ctx.lineTo(right - w * 0.1, bottom - d * 0.1);
            ctx.moveTo(right - w * 0.1, top + d * 0.1);
            ctx.lineTo(left + w * 0.1, bottom - d * 0.1);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(2, w * 0.05), 0, Math.PI * 2);
            ctx.fillStyle = '#64748b';
            ctx.fill();
            break;
        }
        case 'bidet': {
            ctx.ellipse(0, d * 0.05, w * 0.4, d * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, top + d * 0.14, Math.max(1.2, w * 0.035), 0, Math.PI * 2);
            ctx.fillStyle = '#64748b';
            ctx.fill();
            break;
        }
        case 'dishwasher': {
            ctx.rect(left, top, w, d);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 7px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('DW', 0, 0);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            break;
        }
        case 'washer':
        case 'dryer': {
            ctx.rect(left, top, w, d);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(w, d) * 0.24, 0, Math.PI * 2);
            ctx.stroke();
            if (type.shape === 'dryer') {
                ctx.fillStyle = '#d97706';
                ctx.beginPath();
                ctx.moveTo(0, -d * 0.08);
                ctx.lineTo(w * 0.08, d * 0.1);
                ctx.lineTo(-w * 0.08, d * 0.1);
                ctx.closePath();
                ctx.fill();
            }
            break;
        }
        case 'floor-drain': {
            ctx.arc(0, 0, Math.min(w, d) / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-w * 0.25, 0);
            ctx.lineTo(w * 0.25, 0);
            ctx.moveTo(0, -d * 0.25);
            ctx.lineTo(0, d * 0.25);
            ctx.stroke();
            break;
        }
        case 'hose-bib': {
            ctx.arc(0, 0, Math.max(3, w * 0.34), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(w * 0.7, 0);
            ctx.stroke();
            break;
        }
        case 'range': {
            ctx.rect(left, top, w, d);
            ctx.fill();
            ctx.stroke();
            for (const bx of [-0.22, 0.22]) {
                for (const by of [-0.2, 0.2]) {
                    ctx.beginPath();
                    ctx.arc(w * bx, d * by, Math.max(1.6, Math.min(w, d) * 0.09), 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            break;
        }
        case 'furnace': {
            ctx.rect(left, top, w, d);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#475569';
            for (let i = 1; i <= 3; i += 1) {
                ctx.beginPath();
                ctx.moveTo(left + w * 0.18, top + d * (i / 4));
                ctx.lineTo(right - w * 0.18, top + d * (i / 4));
                ctx.stroke();
            }
            break;
        }
        case 'grill': {
            ctx.arc(0, 0, Math.min(w, d) / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            for (let i = -2; i <= 2; i += 1) {
                ctx.beginPath();
                ctx.moveTo(-w * 0.32, d * i * 0.1);
                ctx.lineTo(w * 0.32, d * i * 0.1);
                ctx.stroke();
            }
            break;
        }
        case 'fireplace': {
            ctx.rect(left, top, w, d);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#d97706';
            ctx.beginPath();
            ctx.moveTo(0, -d * 0.05);
            ctx.quadraticCurveTo(w * 0.18, d * 0.06, 0, d * 0.24);
            ctx.quadraticCurveTo(-w * 0.18, d * 0.06, 0, -d * 0.05);
            ctx.fill();
            break;
        }
        default: {
            rr(ctx, left, top, w, d, 2);
            ctx.fill();
            ctx.stroke();
        }
    }
    ctx.restore();

    if (show.labels) {
        const tags = tagMap();
        drawLabel(ctx, tags.get(entry.id) || type.short, p.x, p.y + Math.max(9, d / 2 + 8), selected ? COLOURS.selected : '#334155');
    }
}

function drawHeater(ctx, heater, view, S) {
    const type = heaterById(heater.typeId);
    const centre = heaterPosition(plan, heater);
    const p = S(centre);
    const w = type.width * view.scale;
    const d = type.depth * view.scale;
    const selected = selectedKind === 'heater';
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rotationForWall(heater.wall === 'free' ? 'north' : heater.wall));
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = selected ? COLOURS.selected : '#334155';
    ctx.lineWidth = selected ? 2.4 : 1.2;
    if (type.mount === 'wall') {
        rr(ctx, -w / 2, -d / 2, w, d, 3);
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(w, 2) / 2, Math.max(d, 2) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(w, d) * 0.18, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 7px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WH', 0, 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
    if (show.labels) drawLabel(ctx, 'WH · heater', p.x, p.y + Math.max(11, d / 2 + 9), selected ? COLOURS.selected : '#334155');
}

function drawHookup(ctx, service, view, S) {
    const config = plan[service];
    if (!config) return;
    const point = hookupPoint(plan, service);
    const p = S(point);
    const colour = COLOURS[service] || '#475569';
    const selected = selectedKind === 'hookup' && selectedId === service;
    const offsets = {
        north: { x: 0, y: -27 },
        south: { x: 0, y: 27 },
        west: { x: -35, y: 0 },
        east: { x: 35, y: 0 }
    };
    const offset = offsets[config.side] || offsets.north;
    const bx = p.x + offset.x;
    const by = p.y + offset.y;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = selected ? COLOURS.selected : colour;
    ctx.lineWidth = selected ? 2.2 : 1.2;
    rr(ctx, bx - 23, by - 8, 46, 16, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colour;
    ctx.font = 'bold 7px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(service === 'water' ? 'WATER' : service === 'sewer' ? 'SEWER' : 'GAS', bx, by);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
}

function drawClearance(ctx, entry, view, S) {
    const type = fixtureById(entry.typeId);
    const centre = positionFor(plan, entry, type);
    const p = S(centre);
    const w = type.width * view.scale;
    const d = type.depth * view.scale;
    const rotation = entry.wall === 'free' ? 0 : rotationForWall(entry.wall);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(-w / 2 - 4, -d / 2 - 4, w + 8, d + 8);
    const front = type.clearFront * view.scale;
    ctx.beginPath();
    ctx.moveTo(-w / 2, d / 2 + front);
    ctx.lineTo(w / 2, d / 2 + front);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 7px ui-monospace, monospace';
    ctx.fillText(`${(type.clearFront * 1000).toFixed(0)} front`, -w / 2, d / 2 + front - 2);
    ctx.restore();
}

function drawScaleBar(ctx, view) {
    const x = view.ox + 10;
    const y = view.oy + plan.depth * view.scale + 24;
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + view.scale, y);
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x, y + 3);
    ctx.moveTo(x + view.scale, y - 3);
    ctx.lineTo(x + view.scale, y + 3);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '8px ui-monospace, monospace';
    ctx.fillText('1 m', x + view.scale / 2 - 9, y - 5);
    ctx.restore();
}

function drawNorth(ctx, view) {
    const x = view.ox + plan.width * view.scale - 18;
    const y = view.oy + 18;
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.fillStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x, y - 8);
    ctx.moveTo(x - 4, y - 3);
    ctx.lineTo(x, y - 9);
    ctx.lineTo(x + 4, y - 3);
    ctx.stroke();
    ctx.font = 'bold 8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', x, y + 18);
    ctx.textAlign = 'left';
    ctx.restore();
}

function drawAll() {
    drawCanvas('plan-rough', 'rough');
    drawCanvas('plan-finish', 'finish');
}

/* --------------------------------------------------------------- inspector */

function renderInspector() {
    const box = $('inspector');
    if (selectedKind === 'fixture' && selectedFixture()) {
        const entry = selectedFixture();
        const type = fixtureById(entry.typeId);
        const status = design.schedule.find((item) => item.id === entry.id);
        const centre = positionFor(plan, entry, type);
        const location = entry.wall === 'free'
            ? `Floor at ${centre.x.toFixed(2)}, ${centre.y.toFixed(2)} m`
            : `${entry.wall} wall at ${entry.along.toFixed(2)} m`;
        box.innerHTML = `
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                <b class="font-mono text-sky-700">${esc(status?.tag || type.short)}</b>
                <b>${esc(type.label)}</b>
                <span class="text-slate-500">${esc(location)}</span>
                <span class="text-slate-500">${type.wsfuCold}/${type.wsfuHot} WSFU · ${type.dfu} DFU · ${esc(type.drainSize || 'no drain')}</span>
                <span class="text-slate-500">${esc(finishGradeById(entry.finish).label)} · ${esc(faucetFinishById(entry.faucet).label)}</span>
                <button class="ml-auto px-2 py-0.5 rounded border border-red-200 text-red-600 text-[10px] font-bold hover:bg-red-50" data-delete="${esc(entry.id)}">Delete fixture</button>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">${esc(type.notes)}</p>
        `;
        box.classList.remove('hidden');
        return;
    }
    if (selectedKind === 'heater' && plan.waterHeater) {
        const heater = heaterById(plan.waterHeater.typeId);
        box.innerHTML = `
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                <b class="font-mono text-sky-700">WH</b>
                <b>${esc(heater.label)}</b>
                <span class="text-slate-500">${esc(heater.fuel)} · ${heater.gasBtu ? `${heater.gasBtu} BTU` : 'no gas'} · ${plan.waterHeater.temperature}°F</span>
                <span class="text-slate-500">${plan.waterHeater.pan ? 'pan' : 'no pan'} · ${plan.waterHeater.expansionTank ? 'expansion tank' : 'no expansion tank'} · ${plan.waterHeater.reliefPipe ? 'T&P piped' : 'T&P missing'}</span>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">${esc(heater.notes)}</p>
        `;
        box.classList.remove('hidden');
        return;
    }
    if (selectedKind === 'hookup' && selectedHookup()) {
        const service = selectedHookup();
        const config = plan[service];
        const detail = service === 'water' ? `${config.pressure} psi · ${config.meterSize} meter`
            : service === 'sewer' ? `${config.size} lateral · invert ${config.invert.toFixed(2)} m · ${(config.slope * 100).toFixed(1)}%`
                : `${config.pressure} in w.c. · ${config.meterCapacity} CFH meter · ${config.type}`;
        box.innerHTML = `<div class="flex flex-wrap items-center gap-x-4 gap-y-1"><b class="uppercase text-sky-700">${esc(service)} hookup</b><span class="text-slate-500">${esc(config.side)} wall at ${config.along.toFixed(2)} m</span><span class="text-slate-500">${esc(detail)}</span></div><p class="text-[10px] text-slate-400 mt-1">Drag this marker along a wall to move the service entry; the routes and the takeoff follow it.</p>`;
        box.classList.remove('hidden');
        return;
    }
    box.classList.add('hidden');
}

/* --------------------------------------------------------------- rendering */

function syncPart() {
    document.querySelectorAll('.part').forEach((button) => {
        button.classList.toggle('active', button.dataset.part === part);
    });
    $('rough-panel').classList.toggle('hidden', part !== 'rough');
    $('finish-panel').classList.toggle('hidden', part !== 'finish');
}

function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tab);
        button.classList.toggle('bg-white', button.dataset.tab !== tab);
        button.classList.toggle('hover:bg-slate-50', button.dataset.tab !== tab);
    });
    ['rough', 'finish', 'schedule', 'takeoff', 'rules', 'glossary'].forEach((name) => {
        const panel = $(`panel-${name}`);
        if (!panel) return;
        panel.classList.toggle('hidden', name !== tab);
        if (name === 'finish' || name === 'rough') panel.classList.toggle('flex', name === tab);
        if (name === 'schedule' || name === 'takeoff' || name === 'rules' || name === 'glossary') panel.classList.toggle('block', name === tab);
    });
    if (tab === 'rough' || tab === 'finish') {
        part = tab;
        syncPart();
    }
    const notes = {
        rough: 'hookups → routes → rough takeoff',
        finish: 'fixtures → trim → finish takeoff',
        schedule: 'one row per fixture, shared with both plans',
        takeoff: 'rough and finish are separate contract parts',
        rules: '2021 IPC / IRC / IFGC · local amendments win',
        glossary: 'the words on the plan and in the takeoff'
    };
    $('tab-note').textContent = notes[tab] || '';
    requestAnimationFrame(() => {
        drawAll();
        if (selectedKind) renderInspector();
    });
}

function refresh() {
    design = applyPriceBookToDesign('plumbing', designPlumbing(plan));
    syncFields();
    renderMetrics();
    renderChecks();
    renderFinishList();
    renderSchedule();
    renderTakeoff();
    renderRules();
    renderGlossary();
    renderInspector();
    drawAll();
    savePlan();
}

/* ------------------------------------------------------------------ events */

function ensureHeater(typeId) {
    if (!plan.waterHeater) {
        plan.waterHeater = {
            id: `heater_${Date.now()}`,
            typeId,
            wall: 'north',
            along: 0.62,
            finish: 'standard',
            pan: true,
            expansionTank: true,
            reliefPipe: true,
            insulated: true,
            temperature: 120
        };
    } else {
        plan.waterHeater.typeId = typeId;
    }
}

function clampHookups() {
    ['water', 'sewer', 'gas'].forEach((service) => {
        const config = plan[service];
        if (config) setHookup(plan, service, config.side, config.along);
    });
}

function bindEvents() {
    document.querySelectorAll('.tab').forEach((button) => {
        button.addEventListener('click', () => setTab(button.dataset.tab));
    });
    document.querySelectorAll('.part').forEach((button) => {
        button.addEventListener('click', () => setTab(button.dataset.part));
    });
    document.querySelectorAll('.tool').forEach((button) => {
        button.addEventListener('click', () => {
            tool = button.dataset.tool;
            document.querySelectorAll('.tool').forEach((item) => item.classList.toggle('active', item.dataset.tool === tool));
        });
    });

    $('apply-template').addEventListener('click', () => {
        const preset = templateById($('template').value);
        if (!window.confirm(`Replace the fixtures and size with the ${preset.label} template?`)) return;
        plan = applyTemplate(plan, preset.id);
        selectedId = null;
        selectedKind = null;
        refresh();
        setStatus(`${preset.label} template applied.`);
    });
    $('auto-layout').addEventListener('click', () => {
        autoLayout(plan);
        clampHookups();
        refresh();
        setStatus('Fixtures re-laid on their usual walls. Drag anything you want to keep.');
    });
    $('width').addEventListener('change', (event) => {
        plan.width = clamp(event.target.value, 3, 40);
        autoLayout(plan);
        clampHookups();
        refresh();
    });
    $('depth').addEventListener('change', (event) => {
        plan.depth = clamp(event.target.value, 3, 40);
        autoLayout(plan);
        clampHookups();
        refresh();
    });
    $('wall-height').addEventListener('change', (event) => {
        plan.wallHeight = clamp(event.target.value, 2.2, 6);
        refresh();
    });

    [['water', 'water-side', 'water-along'], ['sewer', 'sewer-side', 'sewer-along'], ['gas', 'gas-side', 'gas-along']].forEach(([service, sideId, alongId]) => {
        $(sideId).addEventListener('change', (event) => {
            setHookup(plan, service, event.target.value, plan[service].along);
            refresh();
        });
        $(alongId).addEventListener('change', (event) => {
            setHookup(plan, service, plan[service].side, event.target.value);
            refresh();
        });
    });
    $('water-pressure').addEventListener('change', (event) => {
        plan.water.pressure = clamp(event.target.value, 20, 150);
        refresh();
    });
    $('meter-size').addEventListener('change', (event) => {
        plan.water.meterSize = event.target.value;
        refresh();
    });
    $('sewer-invert').addEventListener('change', (event) => {
        plan.sewer.invert = clamp(event.target.value, -5, 0.5);
        refresh();
    });
    $('sewer-slope').addEventListener('change', (event) => {
        plan.sewer.slope = clamp(Number(event.target.value) / 100, 0.005, 0.1);
        refresh();
    });
    $('gas-pressure').addEventListener('change', (event) => {
        plan.gas.pressure = clamp(event.target.value, 3, 60);
        refresh();
    });
    $('gas-type').addEventListener('change', (event) => {
        plan.gas.type = event.target.value;
        refresh();
    });
    $('gas-meter').addEventListener('change', (event) => {
        plan.gas.meterCapacity = clamp(event.target.value, 50, 5000);
        refresh();
    });

    $('water-material').addEventListener('change', (event) => {
        plan.water.serviceMaterial = event.target.value;
        refresh();
    });
    $('dwv-material').addEventListener('change', (event) => {
        plan.sewer.material = event.target.value;
        refresh();
    });
    $('gas-material').addEventListener('change', (event) => {
        plan.gas.material = event.target.value;
        refresh();
    });
    $('backflow').addEventListener('change', (event) => {
        plan.water.backflow = event.target.value;
        refresh();
    });
    $('water-insulation').addEventListener('change', (event) => {
        plan.water.insulation = event.target.checked;
        refresh();
    });

    $('heater-type').addEventListener('change', (event) => {
        if (!event.target.value) {
            plan.waterHeater = null;
        } else {
            ensureHeater(event.target.value);
        }
        refresh();
    });
    $('heater-temp').addEventListener('change', (event) => {
        if (plan.waterHeater) plan.waterHeater.temperature = clamp(event.target.value, 100, 160);
        refresh();
    });
    [['heater-pan', 'pan'], ['heater-expansion', 'expansionTank'], ['heater-relief', 'reliefPipe'], ['heater-insulated', 'insulated']].forEach(([id, key]) => {
        $(id).addEventListener('change', (event) => {
            if (plan.waterHeater) plan.waterHeater[key] = event.target.checked;
            refresh();
        });
    });

    $('fixture-type').addEventListener('change', (event) => {
        selectedType = event.target.value;
    });
    $('fixture-grade').addEventListener('change', (event) => {
        plan.fixtureGrade = event.target.value;
        refresh();
    });
    $('faucet-finish').addEventListener('change', (event) => {
        plan.faucetFinish = event.target.value;
        refresh();
    });
    $('apply-finish').addEventListener('click', () => {
        plan.fixtures.forEach((entry) => {
            entry.finish = plan.fixtureGrade;
            entry.faucet = plan.faucetFinish;
        });
        refresh();
        setStatus('Finish grade and faucet finish applied to every fixture.');
    });
    $('finish-airgap').addEventListener('change', (event) => {
        plan.finish.airGap = event.target.checked;
        refresh();
    });
    $('finish-washer').addEventListener('change', (event) => {
        plan.finish.washerStandpipe = event.target.checked;
        refresh();
    });
    $('finish-stops').addEventListener('change', (event) => {
        plan.finish.supplyStops = event.target.checked;
        refresh();
    });

    document.querySelectorAll('[data-layer]').forEach((input) => {
        input.addEventListener('change', () => {
            show[input.dataset.layer] = input.checked;
            drawAll();
        });
    });

    $('show-all-checks').addEventListener('click', () => {
        showAllChecks = !showAllChecks;
        renderChecks();
    });
    $('reset').addEventListener('click', () => {
        if (!window.confirm('Reset the plumbing plan to the whole-house template?')) return;
        plan = createPlan({ template: 'house' });
        selectedId = null;
        selectedKind = null;
        refresh();
        setStatus('Plan reset to the whole-house template.');
    });
    $('rough-csv').addEventListener('click', () => {
        download('plumbing-rough-takeoff.csv', takeoffCsv(design, 'rough'));
        setStatus('Rough-in takeoff exported.');
    });
    $('finish-csv').addEventListener('click', () => {
        download('plumbing-finish-takeoff.csv', takeoffCsv(design, 'finish'));
        setStatus('Finish takeoff exported.');
    });
    $('fit-rough').addEventListener('click', drawAll);
    $('fit-finish').addEventListener('click', drawAll);

    $('finish-fixtures').addEventListener('click', (event) => {
        const select = event.target.closest('[data-select]');
        if (!select) return;
        selectedId = select.dataset.select;
        selectedKind = 'fixture';
        renderInspector();
        renderFinishList();
        drawAll();
    });
    $('finish-fixtures').addEventListener('change', (event) => {
        const finishId = event.target.dataset.finish;
        const faucetId = event.target.dataset.faucet;
        if (!finishId && !faucetId) return;
        const entry = plan.fixtures.find((item) => item.id === (finishId || faucetId));
        if (!entry) return;
        if (finishId) entry.finish = event.target.value;
        if (faucetId) entry.faucet = event.target.value;
        refresh();
    });

    $('inspector').addEventListener('click', (event) => {
        const button = event.target.closest('[data-delete]');
        if (!button) return;
        removeFixture(plan, button.dataset.delete);
        selectedId = null;
        selectedKind = null;
        refresh();
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
        const toggle = event.target.closest('[data-rule-toggle]');
        if (!toggle) return;
        const id = toggle.dataset.ruleToggle;
        if (openRules.has(id)) openRules.delete(id);
        else openRules.add(id);
        renderRules();
    });
    $('glossary-search').addEventListener('input', (event) => {
        glossaryQuery = event.target.value;
        renderGlossary();
    });
    $('glossary-list').addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-term-toggle]');
        if (!toggle) return;
        const term = toggle.dataset.termToggle;
        if (openGlossary.has(term)) openGlossary.delete(term);
        else openGlossary.add(term);
        renderGlossary();
    });

    const attachCanvas = (canvas) => {
        canvas.addEventListener('pointerdown', (event) => {
            const view = views[canvas.id] || viewFor(canvas);
            if (!view) return;
            const point = screenToPlan(event, view);
            if (!point) return;
            if (tool === 'add') {
                const entry = addFixture(plan, selectedType, point.x, point.y);
                selectedId = entry.id;
                selectedKind = 'fixture';
                refresh();
                return;
            }
            if (tool === 'delete') {
                const fixture = fixtureAt(plan, point.x, point.y, 0.35);
                if (fixture) {
                    removeFixture(plan, fixture.id);
                    if (selectedId === fixture.id) {
                        selectedId = null;
                        selectedKind = null;
                    }
                    refresh();
                }
                return;
            }
            const service = hookupAt(plan, point.x, point.y, 0.5);
            const heater = !service ? heaterAt(plan, point.x, point.y, 0.35) : null;
            const fixture = !service && !heater ? fixtureAt(plan, point.x, point.y, 0.35) : null;
            if (service) {
                selectedKind = 'hookup';
                selectedId = service;
                drag = { kind: 'hookup', service, moved: false };
            } else if (heater) {
                selectedKind = 'heater';
                selectedId = heater.id;
                drag = { kind: 'heater', moved: false };
            } else if (fixture) {
                selectedKind = 'fixture';
                selectedId = fixture.id;
                drag = { kind: 'fixture', id: fixture.id, moved: false };
            } else {
                selectedKind = null;
                selectedId = null;
                drag = null;
            }
            canvas.setPointerCapture?.(event.pointerId);
            drawAll();
            renderFinishList();
        });

        canvas.addEventListener('pointermove', (event) => {
            const view = views[canvas.id] || viewFor(canvas);
            if (!view) return;
            const point = screenToPlan(event, view);
            if (!point) return;
            if (!drag) {
                const hover = fixtureAt(plan, point.x, point.y, 0.25) || heaterAt(plan, point.x, point.y, 0.25);
                $('hover-readout').textContent = hover
                    ? `${fixtureById(hover.typeId).label} · ${point.x.toFixed(2)}, ${point.y.toFixed(2)} m`
                    : `${point.x.toFixed(1)}, ${point.y.toFixed(1)} m`;
                canvas.style.cursor = hover ? 'grab' : tool === 'add' ? 'crosshair' : 'default';
                return;
            }
            drag.moved = true;
            if (drag.kind === 'hookup') {
                const nearest = nearestWall(plan, point.x, point.y);
                setHookup(plan, drag.service, nearest.wall, nearest.along);
            } else if (drag.kind === 'heater') {
                moveHeater(plan, point.x, point.y);
            } else if (drag.kind === 'fixture') {
                moveFixture(plan, drag.id, point.x, point.y);
            }
            design = applyPriceBookToDesign('plumbing', designPlumbing(plan));
            drawAll();
        });

        const endDrag = () => {
            if (!drag) return;
            const moved = drag.moved;
            drag = null;
            if (moved) refresh();
            else {
                renderInspector();
                drawAll();
            }
        };
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);
        canvas.addEventListener('pointerleave', (event) => {
            if (!drag) $('hover-readout').textContent = '';
        });
    };
    attachCanvas($('plan-rough'));
    attachCanvas($('plan-finish'));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            drag = null;
            selectedId = null;
            selectedKind = null;
            drawAll();
            renderInspector();
            renderFinishList();
            return;
        }
        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedKind === 'fixture') {
            const active = document.activeElement;
            if (active && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName)) return;
            const entry = selectedFixture();
            if (!entry) return;
            event.preventDefault();
            removeFixture(plan, entry.id);
            selectedId = null;
            selectedKind = null;
            refresh();
        }
    });

    window.addEventListener('resize', drawAll);
    if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => drawAll());
        observer.observe($('plan-rough'));
        observer.observe($('plan-finish'));
    }
}

function screenToPlan(event, view) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - view.ox) / view.scale;
    const y = (event.clientY - rect.top - view.oy) / view.scale;
    if (x < -0.5 || y < -0.5 || x > plan.width + 0.5 || y > plan.depth + 0.5) return null;
    return { x, y };
}

function download(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* -------------------------------------------------------------------- boot */

populateSelects();
syncFields();
syncPart();
bindEvents();
setTab('rough');
renderMetrics();
renderChecks();
renderFinishList();
renderSchedule();
renderTakeoff();
renderRules();
renderGlossary();
renderInspector();
requestAnimationFrame(drawAll);
