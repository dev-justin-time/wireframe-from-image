// pages/project-dashboard.html reads the saved designs through the dashboard
// model (static/engines/features/dashboard/model.js) and this script paints
// them: the four totals, one card per suite and the refresh button.
//
// The model harvests the same drafts the bid builder prices, so a suite's
// subtotal here is the bid package's subtotal, not a second calculation.
// Same file on disk and over HTTP: from /assets/page-scripts/ this resolves to
// /engines/... , which the server's root static mount serves.
import { dashboardState } from '../../engines/features/dashboard/model.js';

const money = (value) => `$${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`;

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

// The page's Tailwind stylesheet is not part of this repo, so the cards carry
// the little styling they need to read on their own.
const STYLE = `
#suite-grid { display: grid; gap: 8px; }
@media (min-width: 640px) { #suite-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1280px) { #suite-grid { grid-template-columns: 1fr 1fr 1fr; } }
#suite-grid .bd-card { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; padding: 12px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); }
#suite-grid .bd-card header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#suite-grid h3 { margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; }
#suite-grid .bd-chip { border-radius: 999px; padding: 2px 8px; background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
#suite-grid .bd-priced .bd-chip { background: #dcfce7; color: #166534; }
#suite-grid .bd-open .bd-chip { background: #fef3c7; color: #92400e; }
#suite-grid .bd-detail { margin: 6px 0 0; color: #475569; font-size: 11px; line-height: 1.35; }
#suite-grid .bd-total { margin: 8px 0 0; color: #0f172a; font-family: ui-monospace, monospace; font-size: 18px; font-weight: 600; }
#suite-grid .bd-total span { display: block; color: #94a3b8; font-family: inherit; font-size: 10px; font-weight: 400; }
#suite-grid .bd-open-link { display: inline-block; margin-top: 8px; color: #1d4ed8; font-size: 11px; font-weight: 600; text-decoration: none; }
#suite-grid .bd-open-link:hover { text-decoration: underline; }
`;

function suiteCard(suite) {
    const [chip, state] = suite.priced
        ? ['Priced', 'priced']
        : suite.open ? ['Unpriced', 'open'] : ['Not started', 'idle'];
    const total = suite.priced
        ? `<p class="bd-total">${money(suite.total)}<span>${suite.lines} priced line${suite.lines === 1 ? '' : 's'}</span></p>`
        : '';
    const link = suite.page
        ? `<a class="bd-open-link" href="${escape(suite.page)}">Open ${escape(suite.label)}</a>`
        : '';
    return `<article class="bd-card bd-${state}" data-suite="${escape(suite.key)}">
      <header><h3>${escape(suite.label)}</h3><span class="bd-chip">${chip}</span></header>
      <p class="bd-detail">${escape(suite.detail)}</p>
      ${total}
      ${link}
    </article>`;
}

/** Paint one dashboardState() snapshot into the page's existing elements. */
export function renderDashboard(doc = document, storage = globalThis.localStorage) {
    const state = dashboardState(storage);
    const { totals } = state;
    const write = (id, text) => {
        const node = doc.getElementById(id);
        if (node) node.textContent = text;
    };
    write('dashboard-total', money(totals.takeoff));
    write('dashboard-open', `${totals.open}/${totals.suites}`);
    write('dashboard-lines', String(totals.lines));
    write('dashboard-unpriced', String(totals.unpriced));
    write('dashboard-progress', totals.open
        ? `${totals.open} of ${totals.suites} suites have a saved design · ${totals.priced} priced · ${totals.unpriced} unpriced`
        : 'No suite has a saved design in this browser yet — start one from a card.');
    write('dashboard-generated', `Read ${new Date(state.generatedAt).toLocaleTimeString()}`);
    const grid = doc.getElementById('suite-grid');
    if (grid) grid.innerHTML = state.suites.map(suiteCard).join('');
    return state;
}

function ensureStyle(doc) {
    if (!doc || doc.getElementById('dashboard-page-style')) return;
    const style = doc.createElement('style');
    style.id = 'dashboard-page-style';
    style.textContent = STYLE;
    (doc.head || doc.documentElement).append(style);
}

if (typeof document !== 'undefined') {
    const start = () => {
        ensureStyle(document);
        const status = document.getElementById('dashboard-status');
        const refresh = (announce) => {
            try {
                renderDashboard(document);
                if (announce && status) status.textContent = 'Dashboard refreshed.';
            } catch (error) {
                if (status) status.textContent = `Cannot read the saved designs: ${error.message}`;
            }
        };
        refresh(false);
        document.getElementById('refresh-dashboard')?.addEventListener('click', () => refresh(true));
        // A save in another tab (the studio's suites share this origin) redraws.
        window.addEventListener('storage', () => refresh(false));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
}
