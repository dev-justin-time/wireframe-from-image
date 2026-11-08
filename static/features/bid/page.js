import { BID_DEFAULTS, bidChecks, bidCsv, buildBid, proposalText } from './engine.js';
import { collectBidSources, mergeSources } from './sources.js';
import { FORMULAS, GLOSSARY, RULES } from './rules.js';

/**
 * Bid builder controller: harvests each suite's saved takeoff, prices the
 * package and writes the proposal. The screen, the CSV and the printable
 * proposal all come from one buildBid() result.
 */

const STATE_KEY = 'bid-suite-state';

const $ = (id) => document.getElementById(id);
const escape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const slug = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
        if (saved && typeof saved === 'object') {
            return {
                project: { ...BID_DEFAULTS.project, ...(saved.project || {}) },
                markup: { ...BID_DEFAULTS.markup, ...(saved.markup || {}) },
                taxLabour: Boolean(saved.taxLabour),
                depositPct: Number(saved.depositPct ?? BID_DEFAULTS.depositPct),
                manual: Array.isArray(saved.manual) ? saved.manual : [],
                alternates: Array.isArray(saved.alternates) ? saved.alternates : []
            };
        }
    } catch {
        // A corrupt state falls back to the defaults.
    }
    return {
        project: { ...BID_DEFAULTS.project },
        markup: { ...BID_DEFAULTS.markup },
        taxLabour: false,
        depositPct: BID_DEFAULTS.depositPct,
        manual: [],
        alternates: []
    };
}

let state = loadState();
let sources = collectBidSources();
let bid = null;
let checks = null;
let activeTab = 'summary';
let saveTimer = null;
let statusTimer = null;
let nextManualId = Date.now();

function setStatus(message, error = false) {
    const node = $('status');
    node.textContent = message;
    node.className = `text-[10px] min-h-[1rem] ${error ? 'text-red-600' : 'text-emerald-700'}`;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { node.textContent = ''; }, 4200);
}

function saveState() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch {
            setStatus('Could not save the bid locally.', true);
        }
    }, 200);
}

function rebuild() {
    const merged = mergeSources(sources, state.manual, state.alternates);
    bid = buildBid({
        groups: merged.groups,
        alternateLines: merged.alternateLines,
        project: state.project,
        markup: state.markup,
        taxLabour: state.taxLabour,
        depositPct: state.depositPct,
        billing: BID_DEFAULTS.billing
    });
    checks = bidChecks(bid);
    render();
}

function syncInputs() {
    $('b-name').value = state.project.name || '';
    $('b-client').value = state.project.client || '';
    $('b-address').value = state.project.address || '';
    $('b-date').value = state.project.date || '';
    $('b-ref').value = state.project.reference || '';
    $('b-validity').value = String(state.project.validityDays);
    $('b-scope').value = state.project.scope || '';
    $('b-overhead').value = String(state.markup.overhead);
    $('b-profit').value = String(state.markup.profit);
    $('b-contingency').value = String(state.markup.contingency);
    $('b-permit').value = String(state.markup.permit);
    $('b-design').value = String(state.markup.design);
    $('b-discount').value = String(state.markup.discount);
    $('b-tax').value = String(state.markup.tax);
    $('b-deposit').value = String(state.depositPct);
    $('b-tax-labour').checked = Boolean(state.taxLabour);
}

function table(headers, rows, aligns = []) {
    const head = headers.map((label, index) => `<th class="text-left px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500 ${aligns[index] === 'right' ? 'text-right' : ''}">${escape(label)}</th>`).join('');
    const body = rows.map((row) => `<tr class="border-t border-slate-100">${row.map((cell, index) => `<td class="px-2 py-1 text-[11px] ${aligns[index] === 'right' ? 'text-right font-mono' : ''}">${cell}</td>`).join('')}</tr>`).join('');
    return `<table class="w-full border-collapse"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}" class="px-2 py-3 text-[11px] text-slate-400">Nothing yet</td></tr>`}</tbody></table>`;
}

function renderTotals() {
    const costs = bid.costs;
    $('m-base').textContent = money(costs.base);
    $('m-overhead').textContent = money(costs.overhead);
    $('m-profit').textContent = money(costs.profit);
    $('m-contingency').textContent = money(costs.contingency);
    $('m-fees').textContent = money(costs.permit + costs.design);
    $('m-pretax').textContent = money(costs.preTax);
    $('m-tax').textContent = money(costs.tax);
    $('m-margin').textContent = `${costs.margin}%`;
    $('m-total').textContent = money(costs.total);
    $('m-sub').textContent = `${bid.counts.suites} suites · ${bid.counts.lines} lines · alternates ${money(bid.alternateTotal)} · deposit ${money(bid.schedule[0].amount)}`;
    $('m-sources').textContent = `${sources.filter((source) => source.found).length} of ${sources.length} suites found a saved design`;
    $('issue-count').textContent = `${checks.checks.filter((check) => check.severity !== 'ok').length} notes`;

    const summary = $('check-summary');
    summary.textContent = checks.ok
        ? `Ready to issue${checks.warnings ? ` · ${checks.warnings} to review` : ''}`
        : `${checks.errors} blocking · ${checks.warnings} to review`;
    summary.className = `text-[10px] font-mono mt-1 ${checks.ok ? 'text-emerald-700' : 'text-red-600'}`;
    $('checks').innerHTML = checks.checks.filter((check) => check.severity !== 'ok').map((check) => {
        const icon = check.severity === 'error' ? '✖' : check.severity === 'warning' ? '⚠' : '·';
        return `<li class="severity-${check.severity} flex items-start gap-1.5"><span class="shrink-0 font-bold">${icon}</span><span><b>${escape(check.label)}.</b> ${escape(check.message)}</span></li>`;
    }).join('') || '<li class="severity-ok">✓ The package is complete.</li>';
}

function renderSummary() {
    const found = sources.filter((source) => source.found && source.lines.length);
    $('source-cards').innerHTML = [
        ['Suites', `${found.length}/${sources.length}`],
        ['Lines', `${bid.counts.lines}`],
        ['Base', money(bid.costs.base)],
        ['Contract', money(bid.costs.total)]
    ].map(([label, value]) => `<div class="rounded-lg border border-slate-200 px-3 py-2"><p class="text-[10px] uppercase tracking-wide text-slate-400">${escape(label)}</p><p class="text-sm font-mono font-semibold">${escape(value)}</p></div>`).join('');

    $('source-table').innerHTML = table(
        ['Suite', 'Lines', 'Subtotal'],
        bid.groups.map((group) => [
            escape(group.label) + (group.kind === 'manual' ? ' <span class="text-[9px] text-slate-400">manual</span>' : ''),
            `${group.lines.length}`,
            money(group.subtotal)
        ]),
        ['left', 'right', 'right']
    );

    $('billing-table').innerHTML = table(
        ['Stage', '%', 'Amount'],
        bid.schedule.map((stage) => [escape(stage.label), `${stage.pct}%`, money(stage.amount)]),
        ['left', 'right', 'right']
    );

    $('source-status').innerHTML = sources.map((source) => {
        const tone = source.found && source.lines.length ? 'severity-ok' : 'severity-warn';
        const value = source.found && source.lines.length ? `${source.lines.length} lines · ${money(source.subtotal)}` : source.note;
        return `<li class="flex items-start gap-1.5 ${tone}"><span class="shrink-0 font-bold">${source.found && source.lines.length ? '✓' : '·'}</span><span><b>${escape(source.label)}</b> — ${escape(value)}</span></li>`;
    }).join('');
}

function renderLines() {
    $('lines-summary').textContent = `${bid.counts.lines} priced lines across ${bid.groups.length} groups · base ${money(bid.costs.base)}`;
    const rows = [];
    bid.groups.forEach((group) => {
        rows.push([`<b>${escape(group.label)}</b>`, '', '', '', '', `<b>${money(group.subtotal)}</b>`, '']);
        group.lines.forEach((line) => {
            const remove = line.suite === 'manual'
                ? ` <button data-remove-manual="${escape(line.code)}" class="text-[10px] text-red-600 underline">remove</button>`
                : '';
            rows.push([
                `<span class="text-slate-400">${escape(group.label)}</span>`,
                escape(line.description) + remove,
                `${line.qty} ${escape(line.unit)}`,
                money(line.unitCost),
                money(line.total),
                '',
                `<span class="text-slate-500">${escape(line.note)}</span>`
            ]);
        });
    });
    $('lines-table').innerHTML = table(
        ['Group', 'Description', 'Qty', 'Unit cost', 'Total', 'Subtotal', 'Note'],
        rows,
        ['left', 'left', 'right', 'right', 'right', 'right', 'left']
    );
}

function renderProposal() {
    $('proposal-text').textContent = proposalText(bid);
}

function renderAlternates() {
    $('alternates-summary').textContent = bid.alternates.length
        ? `${bid.alternates.length} alternates · ${money(bid.alternateTotal)} before tax · excluded from the contract total`
        : 'No alternates priced.';
    const rows = bid.alternates.map((line) => [
        escape(line.description),
        `${line.qty} ${escape(line.unit)}`,
        money(line.unitCost),
        money(line.total),
        `<button data-remove-alternate="${escape(line.code)}" class="text-[10px] text-red-600 underline">remove</button>`
    ]);
    $('alternates-table').innerHTML = table(['Description', 'Qty', 'Unit cost', 'Total', ''], rows, ['left', 'right', 'right', 'right', 'left']);
}

function renderGuide() {
    $('guide-rules').innerHTML = RULES.map((rule) => `
        <article class="rounded-lg border border-slate-200 px-3 py-2">
            <h3 class="text-[12px] font-semibold">${escape(rule.title)} <span class="text-[9px] uppercase tracking-wide text-slate-400 ml-1">${escape(rule.category)}</span></h3>
            <p class="text-[11px] text-slate-600 leading-snug mt-0.5">${escape(rule.summary)}</p>
            <ul class="mt-1 space-y-0.5 text-[10px] text-slate-500 leading-snug list-disc pl-4">${(rule.requirements || []).map((line) => `<li>${escape(line)}</li>`).join('')}</ul>
        </article>
    `).join('');
    $('guide-formulas').innerHTML = table(
        ['Quantity', 'Formula', 'Note'],
        FORMULAS.map((entry) => [`<b>${escape(entry.label)}</b>`, `<code class="font-mono">${escape(entry.expression)}</code>`, `<span class="text-slate-500">${escape(entry.note)}</span>`])
    );
    $('guide-glossary').innerHTML = GLOSSARY.map((entry) => `
        <article>
            <h4 class="text-[11px] font-semibold">${escape(entry.term)}</h4>
            <p class="text-[10px] text-slate-600 leading-snug">${escape(entry.short)}</p>
            <p class="text-[10px] text-slate-400 leading-snug mt-0.5">${escape(entry.detail)}</p>
        </article>
    `).join('');
}

function render() {
    renderTotals();
    renderSummary();
    renderLines();
    renderProposal();
    renderAlternates();
}

function switchTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === name);
    });
    ['summary', 'lines', 'proposal', 'alternates', 'guide'].forEach((tab) => {
        const panel = $(`panel-${tab}`);
        if (!panel) return;
        panel.classList.toggle('hidden', tab !== name);
        panel.classList.toggle('flex', tab === name);
    });
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

function addManual(entry) {
    const description = String(entry.description || '').trim();
    const unitCost = Number(entry.unitCost) || 0;
    if (!description || unitCost <= 0) {
        setStatus('A manual line needs a description and a unit price.', true);
        return null;
    }
    const line = {
        id: `manual-${nextManualId += 1}`,
        code: slug(description),
        description,
        qty: Math.max(Number(entry.qty) || 1, 0),
        unit: entry.unit || 'ea',
        unitCost,
        group: entry.group || 'Manual',
        total: round(Math.max(Number(entry.qty) || 1, 0) * unitCost, 2)
    };
    state.manual = [...state.manual, line];
    rebuild();
    saveState();
    setStatus(`Added ${description}.`);
    return line;
}

function addAlternate(entry) {
    const description = String(entry.description || '').trim();
    const unitCost = Number(entry.unitCost) || 0;
    if (!description || unitCost <= 0) {
        setStatus('An alternate needs a description and a unit price.', true);
        return null;
    }
    const line = {
        id: `alternate-${nextManualId += 1}`,
        code: slug(description),
        description,
        qty: Math.max(Number(entry.qty) || 1, 0),
        unit: entry.unit || 'ea',
        unitCost,
        group: 'Alternates',
        total: round(Math.max(Number(entry.qty) || 1, 0) * unitCost, 2)
    };
    state.alternates = [...state.alternates, line];
    rebuild();
    saveState();
    setStatus(`Added alternate ${description}.`);
    return line;
}

function removeManual(code) {
    const before = state.manual.length;
    state.manual = state.manual.filter((line) => line.code !== code && line.id !== code && slug(line.description) !== code);
    rebuild();
    saveState();
    return state.manual.length < before;
}

function removeAlternate(code) {
    const before = state.alternates.length;
    state.alternates = state.alternates.filter((line) => line.code !== code && line.id !== code && slug(line.description) !== code);
    rebuild();
    saveState();
    return state.alternates.length < before;
}

function refreshSources() {
    sources = collectBidSources();
    rebuild();
    const found = sources.filter((source) => source.found && source.lines.length).length;
    setStatus(`Harvested ${found} of ${sources.length} suites.`);
    return sources;
}

function setMarkup(key, value) {
    if (!(key in BID_DEFAULTS.markup)) return bid;
    state.markup = { ...state.markup, [key]: Number(value) };
    rebuild();
    saveState();
    return bid;
}

function setProject(key, value) {
    if (!(key in BID_DEFAULTS.project)) return bid;
    state.project = { ...state.project, [key]: value };
    rebuild();
    saveState();
    return bid;
}

function setOption(key, value) {
    if (key === 'taxLabour') state.taxLabour = Boolean(value);
    if (key === 'depositPct') state.depositPct = Number(value);
    rebuild();
    saveState();
    return bid;
}

function wireEvents() {
    const projectFields = [
        ['b-name', 'name'], ['b-client', 'client'], ['b-address', 'address'],
        ['b-date', 'date'], ['b-ref', 'reference'], ['b-scope', 'scope']
    ];
    projectFields.forEach(([id, key]) => {
        $(id).addEventListener('input', () => setProject(key, $(id).value));
    });
    $('b-validity').addEventListener('change', () => setProject('validityDays', Number($('b-validity').value)));

    const markupFields = [
        ['b-overhead', 'overhead'], ['b-profit', 'profit'], ['b-contingency', 'contingency'],
        ['b-permit', 'permit'], ['b-design', 'design'], ['b-discount', 'discount'], ['b-tax', 'tax']
    ];
    markupFields.forEach(([id, key]) => {
        $(id).addEventListener('input', () => setMarkup(key, $(id).value));
    });
    $('b-deposit').addEventListener('input', () => setOption('depositPct', $('b-deposit').value));
    $('b-tax-labour').addEventListener('change', () => setOption('taxLabour', $('b-tax-labour').checked));

    document.querySelectorAll('.tab').forEach((button) => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    $('refresh-sources').addEventListener('click', refreshSources);
    $('export-csv').addEventListener('click', () => {
        download('bid-package.csv', bidCsv(bid));
        setStatus('Bid CSV saved as bid-package.csv');
    });
    $('copy-proposal').addEventListener('click', async () => {
        const text = proposalText(bid);
        try {
            await navigator.clipboard.writeText(text);
            setStatus('Proposal copied to the clipboard.');
        } catch {
            const area = document.createElement('textarea');
            area.value = text;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            area.remove();
            setStatus('Proposal copied.');
        }
    });
    $('print-proposal').addEventListener('click', () => {
        switchTab('proposal');
        window.setTimeout(() => window.print(), 120);
    });

    $('add-manual').addEventListener('click', () => {
        const line = addManual({
            description: $('manual-desc').value,
            qty: $('manual-qty').value,
            unit: $('manual-unit').value,
            unitCost: $('manual-cost').value
        });
        if (line) {
            $('manual-desc').value = '';
            $('manual-cost').value = '';
            $('manual-qty').value = '1';
        }
    });
    $('add-alternate').addEventListener('click', () => {
        const line = addAlternate({
            description: $('alternate-desc').value,
            qty: $('alternate-qty').value,
            unitCost: $('alternate-cost').value
        });
        if (line) {
            $('alternate-desc').value = '';
            $('alternate-cost').value = '';
            $('alternate-qty').value = '1';
        }
    });

    $('lines-table').addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-manual]');
        if (!button) return;
        removeManual(button.dataset.removeManual);
        setStatus('Manual line removed.');
    });
    $('alternates-table').addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-alternate]');
        if (!button) return;
        removeAlternate(button.dataset.removeAlternate);
        setStatus('Alternate removed.');
    });

    $('reset').addEventListener('click', () => {
        state = {
            project: { ...BID_DEFAULTS.project },
            markup: { ...BID_DEFAULTS.markup },
            taxLabour: false,
            depositPct: BID_DEFAULTS.depositPct,
            manual: [],
            alternates: []
        };
        try { localStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
        syncInputs();
        rebuild();
        saveState();
        setStatus('Bid reset. Saved suite designs are untouched.');
    });
}

function init() {
    syncInputs();
    renderGuide();
    wireEvents();
    rebuild();
    setStatus('Harvested the saved designs from every suite.');
    switchTab('summary');

    window.bidSuite = {
        bid: () => bid,
        sources: () => sources,
        totals: () => ({ ...bid.costs, total: bid.costs.total }),
        checks: () => checks,
        csv: () => bidCsv(bid),
        proposal: () => proposalText(bid),
        refresh: () => refreshSources(),
        setMarkup: (key, value) => setMarkup(key, value),
        setProject: (key, value) => setProject(key, value),
        setOption: (key, value) => setOption(key, value),
        addManual: (entry) => addManual(entry),
        addAlternate: (entry) => addAlternate(entry),
        removeManual: (code) => removeManual(code),
        removeAlternate: (code) => removeAlternate(code),
        state: () => JSON.parse(JSON.stringify(state))
    };
    window.addBidLine = (entry) => addManual(entry);
}

init();
