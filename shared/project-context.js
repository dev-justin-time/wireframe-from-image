/**
 * Shared live project context: every page reads the same project.
 *
 * Abilities preserved: nothing here writes over a suite's own draft keys.
 * This module only READS localStorage (suites, floorplan autosave, price
 * book, schedule, permits) and broadcasts changes via `storage` events, so
 * all pages stay interactive with each other without coupling their engines.
 *
 * Visualizations are DOM + canvas-free (bars, dots, tables) so they work in
 * every suite page without a WebGL dependency.
 */

import { stageStatus } from './project-workflow.js';

const money = (v) => `$${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function safeGet(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** Every suite draft key we know about, for status dots. */
const SUITE_KEYS = {
    floorplan: ['floorplan3d_autosave'],
    wall: ['wall-suite-draft'],
    framing: ['framing-suite-draft', 'framing-editor-draft'],
    roof: ['roof-suite-draft', 'roof-editor-draft'],
    stair: ['stair-suite-draft', 'stair-designer-draft', 'stair-editor-draft'],
    plumbing: ['plumbing-suite-plan'],
    electrical: ['electrical-suite-draft', 'electrical-editor-draft'],
    lighting: ['lighting-suite-plan'],
    kitchen: ['kitchen-editor-draft'],
    deck: ['deck-suite-draft', 'deck-editor-draft'],
    landscape: ['landscape-suite-plan', 'landscape-editor-draft'],
    foundation: ['foundation-suite-draft'],
    schedule: ['project-schedule-v1'],
    permits: ['permits-inspections-v1'],
    prices: ['supplier-price-book-v1'],
    bid: ['bid-builder-state']
};

export function suiteStarted(keys) {
    return (keys || []).some((k) => {
        try {
            const v = localStorage.getItem(k);
            return v != null && String(v).length > 2;
        } catch {
            return false;
        }
    });
}

/** Live snapshot: stage progress + per-suite started flags + floorplan info. */
export function getProjectSnapshot() {
    const stages = stageStatus();
    const started = stages.filter((s) => s.started).length;
    const suites = Object.fromEntries(
        Object.entries(SUITE_KEYS).map(([k, keys]) => [k, suiteStarted(keys)])
    );
    const plan = safeGet('floorplan3d_autosave');
    const walls = plan?.walls?.length ?? plan?.stories?.[0]?.walls?.length ?? 0;
    const book = safeGet('supplier-price-book-v1');
    const quotes = book?.entries ? Object.keys(book.entries).length : 0;
    return { stages, started, total: stages.length, suites, walls, quotes, plan: !!plan };
}

/** Priced totals per suite via the bid harvest when available; else nulls. */
export async function getPricingSnapshot() {
    try {
        const { collectBidSources } = await import('../features/bid/sources.js');
        const sources = collectBidSources(localStorage);
        const perSuite = Object.fromEntries(sources.map((s) => [s.suite, { found: s.found, priced: s.priced, subtotal: s.subtotal, lines: s.lines?.length || 0, note: s.note }]));
        const total = sources.filter((s) => s.priced).reduce((t, s) => t + (Number(s.subtotal) || 0), 0);
        return { perSuite, total };
    } catch {
        return { perSuite: {}, total: 0 };
    }
}

/** Subscribe to cross-tab project changes; returns an unsubscribe fn. */
export function onProjectChange(fn) {
    const handler = (e) => {
        if (!e.key) {
            fn(getProjectSnapshot());
            return;
        }
        if (/draft|plan|price|bid|schedule|permits|floorplan3d/i.test(e.key)) fn(getProjectSnapshot());
    };
    window.addEventListener('storage', handler);
    window.addEventListener('focus', () => fn(getProjectSnapshot()));
    return () => {
        window.removeEventListener('storage', handler);
    };
}

/** Small bar + dots visualization for stage progress (DOM only). */
export function renderProgressBar(el, snapshot) {
    if (!el || !snapshot) return;
    const pct = snapshot.total ? Math.round((snapshot.started / snapshot.total) * 100) : 0;
    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:8px;border-radius:99px;background:#e2e8f0;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${pct >= 70 ? '#16a34a' : pct >= 35 ? '#d97706' : '#0ea5e9'}"></div>
            </div>
            <b style="font:700 11px ui-monospace,monospace">${snapshot.started}/${snapshot.total} · ${pct}%</b>
        </div>
        <div style="margin-top:4px;font:400 10px system-ui;color:#64748b">${snapshot.plan ? `Floorplan: ${snapshot.walls} walls` : 'No floorplan yet — start in the Editor'} · ${snapshot.quotes} price-book quotes</div>`;
}

/** Related-suite pricing cards (status + subtotal when priced). */
export async function renderRelatedPricing(el, suiteKeys = []) {
    if (!el) return;
    el.innerHTML = `<p style="font:400 10px system-ui;color:#64748b">Loading related pricing…</p>`;
    const { perSuite, total } = await getPricingSnapshot();
    const cards = suiteKeys.map((key) => {
        const s = perSuite[key];
        const dot = s?.found ? (s.priced ? '#16a34a' : '#d97706') : '#cbd5e1';
        const val = s?.priced ? money(s.subtotal) : s?.found ? 'Unpriced' : '—';
        return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;background:#fff;min-width:110px">
            <p style="font:700 9px system-ui;letter-spacing:.06em;color:#64748b"><span style="display:inline-block;width:7px;height:7px;border-radius:99px;background:${dot};margin-right:4px"></span>${key.toUpperCase()}</p>
            <p style="font:700 13px ui-monospace,monospace">${val}</p>
            <p style="font:400 9px system-ui;color:#94a3b8">${s?.lines ? `${s.lines} lines` : (s?.note || 'No draft')}</p></div>`;
    }).join('');
    el.innerHTML = `${cards}<div style="border:1px dashed #cbd5e1;border-radius:8px;padding:6px 8px;background:#f8fafc;min-width:110px">
        <p style="font:700 9px system-ui;letter-spacing:.06em;color:#64748b">RELATED TOTAL</p>
        <p style="font:700 13px ui-monospace,monospace">${money(total)}</p>
        <p style="font:400 9px system-ui;color:#94a3b8"><a href="bid-builder.html" style="color:#0284c7">Open bid →</a></p></div>`;
}

export { money };
