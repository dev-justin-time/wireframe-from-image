import { SUITES } from '../bid/sources.js';
import { collectPriceCatalog } from './catalog.js';
import { emptyPriceBook, loadPriceBook, priceKey, savePriceBook } from './book.js';

/**
 * Supplier price-book editor.
 *
 * Each row is a material line the suites can produce. A quoted unit cost,
 * supplier and quote reference are stored once and applied by every suite and
 * by the bid builder, so the drawing, the takeoff and the contract cannot drift
 * onto different prices.
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

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

let book = loadPriceBook();
let items = [];
let query = '';
let suiteFilter = 'all';
let statusTimer = null;

function setStatus(message, error = false) {
    const node = $('price-status');
    node.textContent = message;
    node.className = `mt-2 min-h-[1rem] text-[10px] ${error ? 'text-red-600' : 'text-emerald-700'}`;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { node.textContent = ''; }, 4200);
}

function persist(message) {
    if (!savePriceBook(book)) {
        setStatus('Could not save the price book in this browser.', true);
        return false;
    }
    refresh(message);
    return true;
}

function refresh(message) {
    book = loadPriceBook();
    items = collectPriceCatalog();
    render();
    if (message) setStatus(message);
}

function filteredItems() {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
        if (suiteFilter !== 'all' && item.suite !== suiteFilter) return false;
        if (!needle) return true;
        return `${item.suiteLabel} ${item.item} ${item.unit}`.toLowerCase().includes(needle);
    });
}

function renderSummary() {
    const quotes = Object.values(book.entries || {});
    const suppliers = new Set(quotes.map((entry) => entry.supplier).filter(Boolean));
    $('metric-quotes').textContent = String(quotes.length);
    $('metric-items').textContent = String(items.length);
    $('metric-suppliers').textContent = String(suppliers.size);
    $('metric-coverage').textContent = items.length
        ? `${Math.round((quotes.length / items.length) * 100)}%`
        : '0%';
    const updated = quotes.map((entry) => entry.updatedAt).filter(Boolean).sort().pop();
    $('price-updated').textContent = updated
        ? `Last quote ${new Date(updated).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
        : 'No quotes entered yet';
}

function renderTable() {
    const rows = filteredItems();
    $('row-count').textContent = `${rows.length} of ${items.length} items`;
    $('price-rows').innerHTML = rows.map((item) => {
        const quote = item.quote;
        const quoted = Boolean(quote);
        return `
            <tr data-key="${escape(item.key)}" class="border-t border-slate-100 ${quoted ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}">
                <td class="px-2 py-1.5 text-[10px] text-slate-500 whitespace-nowrap">${escape(item.suiteLabel)}</td>
                <td class="px-2 py-1.5 text-[11px] text-slate-700">
                    ${escape(item.item)}
                    ${quoted ? '<span class="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-700">QUOTED</span>' : ''}
                </td>
                <td class="px-2 py-1.5 font-mono text-[10px] text-slate-500">${escape(item.unit)}</td>
                <td class="px-2 py-1.5 text-right font-mono text-[10px] text-slate-400">${item.defaultCost === null ? '—' : money(item.defaultCost)}</td>
                <td class="px-2 py-1.5">
                    <input data-price type="number" min="0" step="0.01" value="${quoted ? escape(quote.cost) : ''}" placeholder="${item.defaultCost === null ? '0.00' : escape(item.defaultCost)}" aria-label="Quoted unit cost for ${escape(item.item)}" class="w-24 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] focus:border-emerald-500 focus:outline-none">
                </td>
                <td class="px-2 py-1.5">
                    <input data-supplier type="text" value="${escape(quote?.supplier || '')}" placeholder="Supplier" aria-label="Supplier for ${escape(item.item)}" class="w-36 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] focus:border-emerald-500 focus:outline-none">
                </td>
                <td class="px-2 py-1.5">
                    <input data-ref type="text" value="${escape(quote?.quoteRef || '')}" placeholder="Quote ref" aria-label="Quote reference for ${escape(item.item)}" class="w-28 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] focus:border-emerald-500 focus:outline-none">
                </td>
                <td class="px-2 py-1.5 text-right">
                    <button data-clear class="rounded px-1.5 py-0.5 text-[10px] font-semibold ${quoted ? 'text-red-600 hover:bg-red-50' : 'text-slate-300'}" ${quoted ? '' : 'disabled'}>Clear</button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="8" class="px-3 py-8 text-center text-[11px] text-slate-400">No material lines match that filter.</td></tr>';
}

function render() {
    renderSummary();
    renderTable();
}

function itemForKey(key) {
    return items.find((item) => item.key === key) || null;
}

function writeQuote(key, { cost, supplier, quoteRef }) {
    const item = itemForKey(key);
    if (!item) return false;
    const numeric = cost === '' || cost === null || cost === undefined ? null : Number(cost);
    if (numeric === null || !Number.isFinite(numeric) || numeric < 0) {
        delete book.entries[key];
    } else {
        book.entries[key] = {
            suite: item.suite,
            item: item.item,
            unit: item.unit,
            cost: round(numeric),
            supplier: String(supplier || ''),
            quoteRef: String(quoteRef || ''),
            updatedAt: new Date().toISOString()
        };
    }
    return persist(numeric === null ? 'Quote cleared. Suites will use the allowance again.' : 'Quote saved.');
}

function setFromRow(row, target) {
    if (!row) return;
    const key = row.dataset.key;
    const item = itemForKey(key);
    if (!item) return;
    const priceInput = row.querySelector('[data-price]');
    const supplierInput = row.querySelector('[data-supplier]');
    const refInput = row.querySelector('[data-ref]');
    const hasCost = priceInput.value.trim() !== '';
    const existing = book.entries[key];

    if (!existing && !hasCost && target.matches('[data-supplier], [data-ref]')) {
        setStatus('Enter a quoted unit cost first, then the supplier and reference.', true);
        return;
    }
    if (!existing && !hasCost) return;
    writeQuote(key, {
        cost: priceInput.value,
        supplier: supplierInput.value,
        quoteRef: refInput.value
    });
}

function addCustomItem() {
    const suite = $('new-suite').value;
    const item = $('new-item').value.trim();
    const unit = $('new-unit').value.trim() || 'ea';
    const cost = Number($('new-cost').value);
    if (!SUITES.some((entry) => entry.key === suite) || !item) {
        setStatus('Choose a suite and name the material line.', true);
        return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
        setStatus('Enter a quoted unit cost of zero or more.', true);
        return;
    }
    const key = priceKey(suite, item, unit);
    book.entries[key] = {
        suite,
        item,
        unit,
        cost: round(cost),
        supplier: $('new-supplier').value.trim(),
        quoteRef: $('new-ref').value.trim(),
        updatedAt: new Date().toISOString()
    };
    if (persist(`Added a quote for ${item}.`)) {
        ['new-item', 'new-unit', 'new-cost', 'new-supplier', 'new-ref'].forEach((id) => { $(id).value = ''; });
        $('new-unit').value = 'ea';
        $('add-panel').classList.add('hidden');
    }
}

function wire() {
    ['all', ...SUITES.map((suite) => suite.key)].forEach((key) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key === 'all' ? 'All suites' : SUITES.find((suite) => suite.key === key).label;
        $('suite-filter').appendChild(option);
    });
    SUITES.forEach((suite) => {
        const option = document.createElement('option');
        option.value = suite.key;
        option.textContent = suite.label;
        $('new-suite').appendChild(option);
    });

    $('price-search').addEventListener('input', (event) => {
        query = event.target.value;
        renderTable();
    });
    $('suite-filter').addEventListener('change', (event) => {
        suiteFilter = event.target.value;
        renderTable();
    });
    $('refresh-prices').addEventListener('click', () => refresh('Price book reloaded.'));
    $('toggle-add').addEventListener('click', () => $('add-panel').classList.toggle('hidden'));
    $('add-price').addEventListener('click', addCustomItem);
    $('reset-prices').addEventListener('click', () => {
        if (!window.confirm('Remove every quoted price? The suites will fall back to their planning allowances.')) return;
        book = emptyPriceBook();
        persist('All quotes cleared.');
    });

    $('price-rows').addEventListener('change', (event) => {
        const row = event.target.closest('tr[data-key]');
        if (!row) return;
        if (!event.target.matches('[data-price], [data-supplier], [data-ref]')) return;
        setFromRow(row, event.target);
    });
    $('price-rows').addEventListener('click', (event) => {
        const button = event.target.closest('[data-clear]');
        if (!button) return;
        const row = button.closest('tr[data-key]');
        if (!row) return;
        delete book.entries[row.dataset.key];
        persist('Quote cleared. Suites will use the allowance again.');
    });
}

function init() {
    wire();
    refresh();

    window.priceBook = {
        book: () => JSON.parse(JSON.stringify(book)),
        items: () => items,
        catalog: () => collectPriceCatalog(),
        setQuote: (entry) => {
            const key = priceKey(entry.suite, entry.item, entry.unit || 'ea');
            const item = { suite: entry.suite, item: entry.item, unit: entry.unit || 'ea' };
            if (!itemForKey(key)) items.push({ ...item, key, suiteLabel: entry.suite, defaultCost: null, quote: null, source: 'custom' });
            book.entries[key] = {
                suite: item.suite,
                item: item.item,
                unit: item.unit,
                cost: round(entry.cost),
                supplier: entry.supplier || '',
                quoteRef: entry.quoteRef || '',
                updatedAt: new Date().toISOString()
            };
            persist('Quote saved.');
            return book.entries[key];
        },
        clearQuote: (key) => {
            delete book.entries[key];
            persist('Quote cleared.');
        },
        refresh: () => refresh()
    };
}

init();
