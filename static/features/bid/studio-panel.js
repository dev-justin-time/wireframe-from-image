/**
 * Studio panel model for the bid system.
 *
 * The bid builder used to exist only on bid-builder.html. This panel assembles
 * the same package inside the Studio: it harvests every saved suite takeoff
 * (features/bid/sources.js), prices it with the bid engine and reports the
 * checks, so the drawing, the takeoff and the proposal cannot disagree.
 */
import { buildBid, bidChecks, bidSummaryLines } from './engine.js';
import { collectBidSources, mergeSources } from './sources.js';

const asCheck = (check) => ({
    severity: check.severity || 'info',
    label: check.label || check.id || 'Check',
    message: check.message || ''
});

/** Harvest, merge and price the saved suite designs in one call. */
export function buildBidSnapshot(storage = globalThis.localStorage) {
    const sources = collectBidSources(storage);
    const merged = mergeSources(sources);
    const bid = buildBid({ groups: merged.groups, alternateLines: merged.alternateLines });
    return { sources, merged, bid, checks: bidChecks(bid) };
}

export function bidStudioPanel({ storage = globalThis.localStorage } = {}) {
    const { sources, bid, checks } = buildBidSnapshot(storage);
    const harvested = sources.filter((source) => source.found);
    const missing = sources.filter((source) => !source.found);
    const summary = bidSummaryLines(bid);

    const rows = [
        { label: 'Suites', value: `${harvested.length}/${sources.length} harvested · ${bid.counts.lines} priced lines` },
        { label: 'Base', value: `$${bid.costs.base.toFixed(0)}` },
        { label: 'Overhead + profit', value: `$${(bid.costs.overhead + bid.costs.profit).toFixed(0)}` },
        { label: 'Tax', value: `$${bid.costs.tax.toFixed(0)}` },
        { label: 'Total', value: `$${bid.costs.total.toFixed(0)}` },
        { label: 'Deposit', value: `${bid.config.depositPct}% · $${bid.schedule[0].amount.toFixed(0)}` }
    ];

    return {
        id: 'bid',
        label: 'Bid',
        suite: 'bid-builder.html',
        headline: `${harvested.length ? `${harvested.length} suite${harvested.length === 1 ? '' : 's'}` : 'No suites'} · $${bid.costs.total.toFixed(0)}`,
        rows,
        checks: checks.checks.map(asCheck),
        ok: checks.ok,
        warnings: checks.warnings,
        empty: bid.counts.lines === 0,
        detail: harvested.length
            ? `Repriced ${bid.counts.lines} lines from ${harvested.map((source) => source.label).join(', ')}.`
            : 'No saved suite design found. Open a designer and save a design, then rebuild.',
        missing: missing.map((source) => source.label),
        summary,
        actions: [
            { id: 'bid-refresh', label: 'Rebuild bid', kind: 'action' },
            { id: 'bid-csv', label: 'Download CSV', kind: 'action' },
            { id: 'bid-proposal', label: 'Copy proposal', kind: 'action' },
            { id: 'open-bid', label: 'Open bid builder', kind: 'link', href: 'bid-builder.html' }
        ]
    };
}
