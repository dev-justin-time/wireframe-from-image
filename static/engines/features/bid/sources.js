import { readDraft as readStoredDraft } from '../../core/drafts.js';
import { computeDeckDesign } from '../deck/engine.js';
import { computeElectricalDesign } from '../electrical/engine.js';
import { computeFramingDesign } from '../framing/engine.js';
import { designLandscape } from '../landscape/engine.js';
import { designLighting } from '../lighting/engine.js';
import { designPlumbing } from '../plumbing/engine.js';
import { computeRoofDesign } from '../roof/design.js';
import { computeWallDesign } from '../wall/design.js';
import { applyPriceBookToDesign, loadPriceBook } from '../pricing/book.js';

/**
 * Cross-suite harvest for the bid builder.
 *
 * Every designer suite stores its latest design in localStorage. Rather than
 * copying a price into a second place, the bid builder re-runs each suite's own
 * engine on that stored draft and reads the bill of materials it just produced,
 * so the bid always matches the drawing, the schedule and the takeoff.
 *
 * Each adapter is defensive: a missing or stale draft yields `found: false`
 * with a reason instead of breaking the bid.
 */

export const SUITES = [
    { key: 'deck', label: 'Deck and framing', page: 'deck-designer.html', draftKeys: ['deck-editor-draft', 'deck-suite-draft'] },
    { key: 'electrical', label: 'Electrical', page: 'electrical-designer.html', draftKeys: ['electrical-editor-draft', 'electrical-suite-draft'] },
    { key: 'framing', label: 'Framing', page: 'framing-designer.html', draftKeys: ['framing-editor-draft', 'framing-suite-draft'] },
    { key: 'landscape', label: 'Landscape and water features', page: 'landscape-designer.html', draftKeys: ['landscape-suite-plan'] },
    { key: 'lighting', label: 'Lighting', page: 'lighting-designer.html', draftKeys: ['lighting-suite-plan'] },
    { key: 'plumbing', label: 'Plumbing', page: 'plumbing-designer.html', draftKeys: ['plumbing-suite-plan'] },
    { key: 'roof', label: 'Roof', page: 'roof-designer.html', draftKeys: ['roof-suite-draft'] },
    { key: 'wall', label: 'Wall finishes', page: 'wall-designer.html', draftKeys: ['wall-suite-draft'] },
    { key: 'stair', label: 'Stairs', page: 'stair-designer.html', draftKeys: ['stair-designer-draft'] }
];

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

/**
 * First readable draft among `keys`, unwrapped.
 *
 * The `*-editor-draft` keys are versioned by `core/drafts.js` (issue 10.11), so
 * the payload sits under `data`; the `*-suite-draft` keys are still bare JSON.
 * `consume: false` keeps the key for the studio, which reads it on its next load.
 */
const readDraft = (storage, keys) => {
    for (const key of keys) {
        const stored = readStoredDraft(key, { storage, consume: false });
        const value = stored?.data;
        if (value && typeof value === 'object') return { key, value };
    }
    return null;
};

/** Normalise the many BOM row shapes the suites emit into one line contract. */
export function normalizeLine(row = {}, suite = 'other', group = 'Materials') {
    const description = row.description || row.item || row.label || row.name || 'Line item';
    const qty = Number(row.qty ?? row.quantity ?? row.count ?? 1) || 0;
    const unit = row.unit || row.packLabel || row.uom || 'ea';
    const total = Number(row.total ?? row.cost ?? row.amount ?? 0) || 0;
    const unitCost = Number(row.unitCost ?? (qty ? total / qty : total)) || 0;
    return {
        suite,
        group: row.group || group,
        code: String(row.code || row.id || description).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description,
        qty: round(qty, 2),
        unit,
        unitCost: round(unitCost, 2),
        total: round(total || qty * unitCost, 2),
        note: row.note || row.spec || ''
    };
}

const withLines = (key, label, lineGroups) => {
    const lines = [];
    lineGroups.forEach(({ rows = [], group }) => {
        rows.forEach((row) => lines.push(normalizeLine(row, key, group)));
    });
    const subtotal = round(lines.reduce((total, line) => total + line.total, 0), 2);
    return { suite: key, label, found: true, saved: true, priced: true, lines, subtotal, note: `${lines.length} lines` };
};

const missing = (key, label, note) => ({ suite: key, label, found: false, saved: false, priced: false, lines: [], subtotal: 0, note });

const ADAPTERS = {
    deck: (draft, book) => {
        const config = draft.config || draft;
        const design = applyPriceBookToDesign('deck', computeDeckDesign(config), book);
        return withLines('deck', 'Deck and framing', [{ rows: design.bom.rows, group: 'Framing' }]);
    },
    electrical: (draft, book) => {
        const config = draft.config || draft;
        const design = applyPriceBookToDesign('electrical', computeElectricalDesign(config), book);
        return withLines('electrical', 'Electrical', [{ rows: design.bom.rows, group: 'Electrical' }]);
    },
    framing: (draft, book) => {
        const config = draft.config || draft;
        const design = applyPriceBookToDesign('framing', computeFramingDesign(config), book);
        // Labour is priced by the bid builder's own markup, so only material
        // rows are harvested here.
        return withLines('framing', 'Framing', [{
            rows: design.bom.rows.filter((row) => row.group !== 'Labour'),
            group: 'Framing'
        }]);
    },
    landscape: (draft, book) => {
        const plan = draft.feature ? draft : { feature: draft, site: {} };
        const design = applyPriceBookToDesign('landscape', designLandscape(plan.feature, plan.site || {}), book);
        return withLines('landscape', 'Landscape and water features', [{ rows: design.bom, group: 'Landscape' }]);
    },
    lighting: (draft, book) => {
        const design = applyPriceBookToDesign('lighting', designLighting(draft.plan || draft), book);
        return withLines('lighting', 'Lighting', [{ rows: design.bom.rows, group: 'Lighting' }]);
    },
    plumbing: (draft, book) => {
        const design = applyPriceBookToDesign('plumbing', designPlumbing(draft), book);
        return withLines('plumbing', 'Plumbing', [
            { rows: design.takeoff?.rough?.rows || [], group: 'Rough-in' },
            { rows: design.takeoff?.finish?.rows || [], group: 'Fixtures' }
        ]);
    },
    roof: (draft, book) => {
        const design = applyPriceBookToDesign('roof', computeRoofDesign(draft), book);
        return withLines('roof', 'Roof', [{ rows: design.costs?.rows || [], group: 'Roofing' }]);
    },
    wall: (draft, book) => {
        const design = applyPriceBookToDesign('wall', computeWallDesign(draft), book);
        return withLines('wall', 'Wall finishes', [{ rows: design.rows || [], group: 'Finishes' }]);
    },
    stair: (draft) => ({
        suite: 'stair',
        label: 'Stairs',
        found: true,
        saved: true,
        priced: false,
        lines: [],
        subtotal: 0,
        note: draft?.stair ? `${String(draft.stair.system || draft.stair.type || 'straight').replace(/[-_]+/g, ' ')} stair · quantities exported without prices` : 'The stair designer exports quantities but no priced takeoff.'
    })
};

/** Read every suite draft and rebuild its priced bill of materials. */
export function collectBidSources(storage = globalThis.localStorage, { priceBook = loadPriceBook(storage) } = {}) {
    if (!storage) return SUITES.map((suite) => missing(suite.key, suite.label, 'Storage unavailable in this browser.'));
    return SUITES.map((suite) => {
        const draft = readDraft(storage, suite.draftKeys);
        if (!draft) return missing(suite.key, suite.label, 'No saved design yet.');
        try {
            const result = ADAPTERS[suite.key](draft.value, priceBook);
            return { ...result, draftKey: draft.key, draft: draft.value };
        } catch (error) {
            return {
                ...missing(suite.key, suite.label, `Draft found but could not be rebuilt: ${error.message}`),
                saved: true,
                draftKey: draft.key,
                draft: draft.value
            };
        }
    });
}

/** Merge harvested suites and manual lines into one priced bill. */
export function mergeSources(sources = [], manual = [], alternates = []) {
    const groups = [];
    sources.filter((source) => source.found && source.lines.length).forEach((source) => {
        groups.push({
            key: source.suite,
            label: source.label,
            kind: 'suite',
            lines: source.lines.map((line) => ({ ...line, suite: source.suite })),
            subtotal: source.subtotal
        });
    });
    if (manual.length) {
        const lines = manual.map((row) => normalizeLine(row, 'manual', row.group || 'Manual'));
        groups.push({
            key: 'manual',
            label: 'Manual and allowances',
            kind: 'manual',
            lines,
            subtotal: round(lines.reduce((total, line) => total + line.total, 0), 2)
        });
    }
    const alternateLines = alternates.map((row) => normalizeLine(row, 'alternate', 'Alternates'));
    return { groups, alternateLines, base: round(groups.reduce((total, group) => total + group.subtotal, 0), 2) };
}

export function emptySourceStatuses() {
    return SUITES.map((suite) => missing(suite.key, suite.label, 'Not loaded.'));
}
