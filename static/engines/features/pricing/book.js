/**
 * Shared supplier price book.
 *
 * Every suite computes quantities from its own design engine, then prices the
 * bill of materials with planning allowances. This module lets a quoted unit
 * cost override that allowance without changing the quantities: the price book
 * is keyed by suite, item description and unit, and each suite re-totals its
 * own bill after the rows are repriced.
 *
 * The book is deliberately a local-first document. A quote is an input to the
 * estimate, so it carries the supplier and the supplier's reference alongside
 * the cost.
 */

export const PRICE_BOOK_KEY = 'supplier-price-book-v1';

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Stable key for a bill-of-materials line, independent of case and spacing. */
export function priceKey(suite, item, unit = 'ea') {
    return `${normalize(suite)}|${normalize(item)}|${normalize(unit || 'ea')}`;
}

export function emptyPriceBook() {
    return { version: 1, entries: {} };
}

/** Read and validate a price book; a corrupt document falls back to empty. */
export function loadPriceBook(storage = globalThis.localStorage) {
    if (!storage) return emptyPriceBook();
    try {
        const parsed = JSON.parse(storage.getItem(PRICE_BOOK_KEY) || 'null');
        if (!parsed || typeof parsed !== 'object') return emptyPriceBook();
        const entries = {};
        Object.entries(parsed.entries || {}).forEach(([key, entry]) => {
            if (!entry || typeof entry !== 'object') return;
            const cost = Number(entry.cost);
            if (!Number.isFinite(cost) || cost < 0) return;
            entries[key] = {
                suite: String(entry.suite || key.split('|')[0] || ''),
                item: String(entry.item || ''),
                unit: String(entry.unit || 'ea'),
                cost: round(cost),
                supplier: String(entry.supplier || ''),
                quoteRef: String(entry.quoteRef || ''),
                updatedAt: entry.updatedAt || null
            };
        });
        return {
            version: 1,
            supplier: String(parsed.supplier || ''),
            quoteRef: String(parsed.quoteRef || ''),
            updatedAt: parsed.updatedAt || null,
            entries
        };
    } catch {
        return emptyPriceBook();
    }
}

export function savePriceBook(book, storage = globalThis.localStorage) {
    if (!storage) return false;
    try {
        storage.setItem(PRICE_BOOK_KEY, JSON.stringify({
            version: 1,
            supplier: book?.supplier || '',
            quoteRef: book?.quoteRef || '',
            updatedAt: new Date().toISOString(),
            entries: book?.entries || {}
        }));
        return true;
    } catch {
        return false;
    }
}

export function quoteFor(book, suite, item, unit = 'ea') {
    return book?.entries?.[priceKey(suite, item, unit)] || null;
}

/** True for the priced material rows; labour is a rate, not a supplier quote. */
export function isMaterialRow(row = {}) {
    if (row.labour) return false;
    return !/^labour$/i.test(String(row.group || ''));
}

function rowLabel(row = {}) {
    return row.item || row.description || row.label || row.name || '';
}

function rowUnit(row = {}) {
    return row.unit || row.packLabel || 'ea';
}

function rowQty(row = {}) {
    return Number(row.qty ?? row.quantity ?? 0) || 0;
}

function rowTotal(row = {}) {
    return Number(row.total ?? row.cost ?? row.amount ?? 0) || 0;
}

function setRowTotal(row, total) {
    if ('total' in row || !('cost' in row)) row.total = total;
    if ('cost' in row) row.cost = total;
    if ('amount' in row) row.amount = total;
}

/** Reprice one row set in place, returning the number of quotes used. */
export function applyQuotesToRows(suite, rows = [], book = emptyPriceBook()) {
    let applied = 0;
    rows.forEach((row) => {
        if (!row || !isMaterialRow(row)) return;
        const quote = quoteFor(book, suite, rowLabel(row), rowUnit(row));
        if (!quote) return;
        if (!Number.isFinite(Number(quote.cost)) || Number(quote.cost) < 0) return;
        const qty = rowQty(row);
        const total = round(qty * Number(quote.cost), 2);
        row.unitCost = round(Number(quote.cost), 2);
        setRowTotal(row, total);
        row.quote = {
            supplier: quote.supplier || '',
            quoteRef: quote.quoteRef || '',
            updatedAt: quote.updatedAt || null
        };
        applied += 1;
    });
    return applied;
}

const sumRows = (rows) => round(rows.reduce((total, row) => total + rowTotal(row), 0), 2);

function rebuildGroups(rows) {
    const groups = new Map();
    rows.forEach((row) => {
        if (!groups.has(row.group)) groups.set(row.group, { group: row.group, rows: [], total: 0 });
        const group = groups.get(row.group);
        group.rows.push(row);
        group.total = round(group.total + rowTotal(row), 2);
    });
    return [...groups.values()];
}

function rebuildPart(rows, part) {
    const partRows = rows.filter((row) => row.part === part);
    const materials = round(partRows.filter((row) => !row.labour).reduce((total, row) => total + rowTotal(row), 0), 2);
    const labour = round(partRows.filter((row) => row.labour).reduce((total, row) => total + rowTotal(row), 0), 2);
    return {
        rows: partRows,
        groups: rebuildGroups(partRows),
        materials,
        labour,
        total: round(materials + labour, 2)
    };
}

/**
 * Apply the current quotes to a completed design and re-total it.
 *
 * The design engines stay pure: quantities are settled before this runs, so a
 * price cannot move a joist, a breaker or a pipe size. Only material rows are
 * touched; labour rates and allowances stay under their own controls.
 */
export function applyPriceBookToDesign(suite, design, book = loadPriceBook()) {
    if (!design || !book?.entries || !Object.keys(book.entries).length) return design;

    switch (suite) {
        case 'deck': {
            const rows = design.bom?.rows || [];
            applyQuotesToRows('deck', rows, book);
            const material = sumRows(rows);
            const labour = round(material * 0.6, 2);
            design.bom.material = material;
            design.bom.labour = labour;
            design.bom.total = round(material + labour, 2);
            const area = Number(design.areas?.deckM2) || 0;
            design.costPerSqm = area > 0 ? round(design.bom.total / area, 2) : 0;
            return design;
        }
        case 'electrical': {
            const rows = design.bom?.rows || [];
            applyQuotesToRows('electrical', rows, book);
            const material = sumRows(rows);
            const labour = round(material * 0.85, 2);
            design.bom.material = material;
            design.bom.labour = labour;
            design.bom.total = round(material + labour, 2);
            design.costPerCircuit = design.circuits?.length
                ? round(design.bom.total / design.circuits.length, 2)
                : 0;
            return design;
        }
        case 'framing': {
            const rows = design.bom?.rows || [];
            applyQuotesToRows('framing', rows, book);
            const material = sumRows(rows.filter((row) => !/^labour$/i.test(String(row.group || ''))));
            const labour = Number(design.bom.labour) || 0;
            design.bom.material = material;
            design.bom.total = round(material + labour, 2);
            if (design.metrics) {
                design.metrics.material = material;
                design.metrics.total = design.bom.total;
            }
            if (Array.isArray(design.summary)) {
                const costLine = `$${material.toFixed(0)} material + $${labour.toFixed(0)} labour = $${design.bom.total.toFixed(0)}`;
                const index = design.summary.findIndex((line) => /material.*labour.*=/.test(line));
                if (index >= 0) design.summary[index] = costLine;
            }
            return design;
        }
        case 'wall': {
            const rows = design.rows || [];
            applyQuotesToRows('wall', rows, book);
            const material = sumRows(rows);
            const labour = Number(design.costs?.labour) || 0;
            const total = round(material + labour, 2);
            design.costs.material = material;
            design.costs.total = total;
            const net = Number(design.areas?.net) || 0;
            design.costs.perM2 = net > 0 ? round(total / net, 2) : 0;
            const costLine = `$${material.toFixed(0)} material + $${labour.toFixed(0)} labour = $${total.toFixed(0)}`;
            if (Array.isArray(design.summary)) {
                const index = design.summary.findIndex((line) => /material.*labour.*=/.test(line));
                if (index >= 0) design.summary[index] = costLine;
            }
            return design;
        }
        case 'roof': {
            const rows = design.costs?.rows || [];
            applyQuotesToRows('roof', rows, book);
            const material = sumRows(rows);
            const labour = Number(design.costs?.labour) || 0;
            design.costs.material = material;
            design.costs.total = round(material + labour, 2);
            const squares = Number(design.areas?.squares) || 0;
            const area = Number(design.areas?.roof) || 0;
            design.costs.perSquare = squares > 0 ? round(design.costs.total / squares, 2) : 0;
            design.costs.perM2 = area > 0 ? round(design.costs.total / area, 2) : 0;
            if (design.summary && typeof design.summary === 'object') {
                design.summary.totalCost = design.costs.total;
            }
            return design;
        }
        case 'landscape': {
            const rows = design.bom || [];
            applyQuotesToRows('landscape', rows, book);
            const total = sumRows(rows);
            if (design.cost) {
                design.cost.lines = rows;
                design.cost.total = total;
            }
            return design;
        }
        case 'lighting': {
            const rows = design.bom?.rows || [];
            applyQuotesToRows('lighting', rows, book);
            const materials = round(rows.filter((row) => row.group !== 'Labour').reduce((sum, row) => sum + rowTotal(row), 0), 2);
            const labour = round(rows.filter((row) => row.group === 'Labour').reduce((sum, row) => sum + rowTotal(row), 0), 2);
            design.bom.groups = rebuildGroups(rows);
            design.bom.total = round(materials + labour, 2);
            if (design.cost) {
                design.cost.materials = materials;
                design.cost.labour = labour;
                design.cost.total = design.bom.total;
            }
            return design;
        }
        case 'plumbing': {
            const roughRows = design.takeoff?.rough?.rows || [];
            const finishRows = design.takeoff?.finish?.rows || [];
            applyQuotesToRows('plumbing', roughRows, book);
            applyQuotesToRows('plumbing', finishRows, book);
            const allRows = [...roughRows, ...finishRows];
            design.takeoff.rough = rebuildPart(allRows, 'rough');
            design.takeoff.finish = rebuildPart(allRows, 'finish');
            design.takeoff.total = round(design.takeoff.rough.total + design.takeoff.finish.total, 2);
            if (design.summary) {
                design.summary.rough = design.takeoff.rough.total;
                design.summary.finish = design.takeoff.finish.total;
                design.summary.total = design.takeoff.total;
            }
            return design;
        }
        default:
            return design;
    }
}
