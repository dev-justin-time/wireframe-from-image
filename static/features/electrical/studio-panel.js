/**
 * Studio panel model for the electrical system.
 *
 * Wraps `electricalEditorSummary()` — the same service, demand, panel and
 * circuit numbers the designer page and the bid builder show — into the
 * Systems panel contract.
 */
import { electricalEditorSummary } from './panel.js';

const asCheck = (check) => ({
    severity: check.severity || 'info',
    label: check.label || check.id || 'Check',
    message: check.message || ''
});

export function electricalStudioPanel({ design = null, draft = null } = {}) {
    const summary = electricalEditorSummary(design);
    const checks = (summary.checks || []).map(asCheck);
    return {
        id: 'electrical',
        label: 'Electrical',
        suite: 'electrical-designer.html',
        headline: summary.headline,
        rows: summary.rows || [],
        checks,
        ok: Boolean(summary.ok),
        empty: !design,
        detail: design
            ? `${(summary.circuits || []).length} circuits on a ${design.panel.label}.`
            : (draft ? 'Draft received, but it has no usable service config.' : 'No draft sent from the electrical suite.'),
        actions: [
            { id: 'open-electrical', label: 'Open electrical suite', kind: 'link', href: 'electrical-designer.html' }
        ]
    };
}
