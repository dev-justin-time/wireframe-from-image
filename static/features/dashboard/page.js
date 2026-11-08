import { dashboardState, describeDesign } from './model.js';

/**
 * Project dashboard controller.
 *
 * Every designer already writes its working design to localStorage, and the
 * bid builder already knows how to rebuild each one's takeoff. This page reads
 * the same sources, so the dashboard is a true index of the project rather than
 * a separate set of numbers.
 */

const $ = (id) => document.getElementById(id);
const escape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (value) => `$${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
})}`;

let state = null;

function suiteCard(suite) {
    const status = suite.priced
        ? '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Open</span>'
        : suite.open
            ? '<span class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Unpriced</span>'
            : '<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Not started</span>';
    const total = suite.priced ? money(suite.total) : suite.open ? 'Unpriced' : '—';
    const detail = suite.detail;
    const note = suite.open && !suite.priced && suite.note ? suite.note : '';
    const action = suite.open ? 'Open design' : 'Start design';
    const tone = suite.priced ? 'border-emerald-200' : suite.open ? 'border-amber-200' : 'border-slate-200';
    const totalTone = suite.priced ? 'text-slate-900' : 'text-slate-400';

    return `
        <article data-suite="${escape(suite.key)}" class="flex flex-col rounded-xl border ${tone} bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-[10px] uppercase tracking-wider font-bold text-slate-400">Suite</p>
                    <h2 class="text-sm font-bold leading-tight text-slate-900">${escape(suite.label)}</h2>
                </div>
                ${status}
            </div>
            <div class="mt-3 min-h-[3.25rem]">
                <p class="text-[10px] uppercase tracking-wider font-bold text-slate-400">${suite.open ? 'Open design' : 'Design'}</p>
                <p class="text-[11px] leading-snug text-slate-600">${escape(detail)}</p>
            </div>
            <div class="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                <div>
                    <p class="text-[9px] uppercase tracking-wider font-bold text-slate-400">Takeoff</p>
                    <p class="text-xl font-mono font-semibold ${totalTone}">${escape(total)}</p>
                    <p class="text-[10px] text-slate-400">${suite.priced ? `${suite.lines} priced line${suite.lines === 1 ? '' : 's'}` : escape(note || (suite.open ? 'No priced takeoff' : 'No saved design'))}</p>
                </div>
                <a href="${escape(suite.page)}" class="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${suite.open ? 'bg-slate-900 text-white hover:bg-slate-700' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}">${action}</a>
            </div>
        </article>
    `;
}

function render() {
    const totals = state.totals;
    $('dashboard-total').textContent = money(totals.takeoff);
    $('dashboard-open').textContent = `${totals.open}/${totals.suites}`;
    $('dashboard-lines').textContent = String(totals.lines);
    $('dashboard-unpriced').textContent = String(totals.unpriced);
    $('dashboard-generated').textContent = `Read ${new Date(state.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    $('dashboard-progress').textContent = totals.open
        ? `${totals.open} of ${totals.suites} suite designs open · ${totals.priced} priced`
        : 'No suite designs saved in this browser yet.';
    $('suite-grid').innerHTML = state.suites.map(suiteCard).join('');
}

function refresh(message = 'Sources refreshed from every suite.') {
    try {
        state = dashboardState();
        render();
        $('dashboard-status').textContent = message;
        $('dashboard-status').className = 'text-[10px] text-emerald-700';
    } catch (error) {
        $('dashboard-status').textContent = `Could not read the project: ${error.message}`;
        $('dashboard-status').className = 'text-[10px] text-red-600';
    }
    return state;
}

function init() {
    $('refresh-dashboard').addEventListener('click', () => refresh());

    // Designs are saved in other tabs, so coming back to this tab should show
    // the current project without an explicit refresh.
    window.addEventListener('focus', () => refresh('Dashboard refreshed.'));
    window.addEventListener('storage', () => refresh('A suite design changed. Dashboard refreshed.'));

    refresh('Reading the saved designs from every suite.');
    window.projectDashboard = {
        state: () => state,
        refresh: () => refresh(),
        describeDesign: (key, draft) => describeDesign(key, draft)
    };
}

init();
