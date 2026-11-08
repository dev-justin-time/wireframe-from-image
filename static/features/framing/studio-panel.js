/**
 * Studio panel model for the framing system.
 *
 * `framingEditorSummary()` already reports the frame the editor built from the
 * plan on screen; this wrapper adds the overlay state and the toggle action so
 * the Systems panel can turn the studs on and off without hunting for the
 * header switch.
 */
import { framingEditorSummary } from './panel.js';

const asCheck = (check) => ({
    severity: check.severity || 'info',
    label: check.label || check.id || 'Check',
    message: check.message || ''
});

export function framingStudioPanel({ design = null, draft = null, enabled = false } = {}) {
    const summary = framingEditorSummary(design);
    const checks = (summary.checks || []).map(asCheck);
    return {
        id: 'framing',
        label: 'Framing',
        suite: 'framing-designer.html',
        headline: summary.headline,
        rows: summary.rows || [],
        checks,
        ok: Boolean(summary.ok),
        empty: !design,
        detail: enabled ? 'Stud overlay is on, replacing the finished walls.' : 'Stud overlay is off; the finished walls are shown.',
        actions: [
            { id: 'framing-toggle', label: enabled ? 'Hide studs' : 'Show studs', kind: 'action' },
            { id: 'open-framing', label: 'Open framing suite', kind: 'link', href: 'framing-designer.html' }
        ],
        draft: draft || null
    };
}
