/**
 * Studio panel model for the deck system.
 *
 * The editor, the designer page and the bid builder all read the same design,
 * so the panel only reshapes `deckEditorSummary()` into the contract the
 * Systems panel renders: headline, rows, checks and actions. Keeping it here
 * (and exporting it from features/deck/index.js) means the editor imports one
 * entry point per system instead of reaching into individual modules.
 */
import { deckEditorSummary } from './panel.js';

const asCheck = (check) => ({
    severity: check.severity || 'info',
    label: check.label || check.id || 'Check',
    message: check.message || ''
});

export function deckStudioPanel({ design = null, draft = null } = {}) {
    const summary = deckEditorSummary(design);
    const checks = (summary.checks || []).map(asCheck);
    return {
        id: 'deck',
        label: 'Deck',
        suite: 'deck-designer.html',
        headline: summary.headline,
        rows: summary.rows || [],
        checks,
        ok: Boolean(summary.ok),
        empty: !design,
        detail: draft ? `Draft ${draft.key || 'received'} · ${design ? design.config.shape : 'unread'}` : 'No draft sent from the deck suite.',
        actions: [
            { id: 'open-deck', label: 'Open deck suite', kind: 'link', href: 'deck-designer.html' }
        ]
    };
}
