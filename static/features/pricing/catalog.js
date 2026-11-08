import { computeDeckDesign } from '../deck/engine.js';
import { computeElectricalDesign } from '../electrical/engine.js';
import { computeFramingDesign } from '../framing/engine.js';
import { defaultWaterConfig } from '../landscape/design.js';
import { designLandscape, defaultSite } from '../landscape/engine.js';
import { designLighting } from '../lighting/engine.js';
import { createPlan as createLightingPlan, autoLights, autoSockets, autoSwitches, autoCircuits } from '../lighting/plan.js';
import { createPlan as createPlumbingPlan } from '../plumbing/plan.js';
import { designPlumbing } from '../plumbing/engine.js';
import { computeRoofDesign } from '../roof/design.js';
import { computeWallDesign } from '../wall/design.js';
import { collectBidSources, SUITES } from '../bid/sources.js';
import { isMaterialRow, loadPriceBook, priceKey } from './book.js';

/**
 * Price-book catalog.
 *
 * A quote needs a line to attach to. The catalog merges the material rows from
 * a representative default design of every suite with the rows of the designs
 * actually saved in this browser, so a product that only appears on the current
 * project can still be quoted. Custom entries added by hand are kept too.
 */

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

const SUITE_META = new Map(SUITES.map((suite) => [suite.key, suite]));

function sampleFramingConfig() {
    const walls = [
        { id: 'sample-north', x1: 0, z1: 0, x2: 8, z2: 0, exterior: true, openings: [{ id: 'sample-door', type: 'door', widthM: 0.9, heightM: 2.1, sillM: 0, offsetM: 2 }] },
        { id: 'sample-east', x1: 8, z1: 0, x2: 8, z2: 5, exterior: true, openings: [{ id: 'sample-window', type: 'window', widthM: 1.2, heightM: 1.2, sillM: 0.9, offsetM: 2 }] },
        { id: 'sample-south', x1: 8, z1: 5, x2: 0, z2: 5, exterior: true, openings: [] },
        { id: 'sample-west', x1: 0, z1: 5, x2: 0, z2: 0, exterior: true, openings: [] }
    ];
    return {
        studSize: '2x6',
        studSpacingIn: 16,
        topPlates: 2,
        storeys: [{ name: 'Ground floor', studLengthIn: 92.5, topPlates: 2, walls }]
    };
}

function sampleLightingDesign() {
    const plan = createLightingPlan({ roomType: 'living', width: 4.6, depth: 4.0 });
    autoLights(plan, { typeId: 'recessed-6' });
    autoSockets(plan, { typeId: 'duplex-15', minCount: 6 });
    autoSwitches(plan, { typeId: 'single-pole' });
    autoCircuits(plan);
    return designLighting(plan);
}

function samplePlumbingDesign() {
    return designPlumbing(createPlumbingPlan({ template: 'house' }));
}

function rowsFor(suite, design) {
    if (!design) return [];
    switch (suite) {
        case 'deck': return design.bom?.rows || [];
        case 'electrical': return design.bom?.rows || [];
        case 'framing': return design.bom?.rows || [];
        case 'landscape': return design.bom || [];
        case 'lighting': return design.bom?.rows || [];
        case 'plumbing': return [...(design.takeoff?.rough?.rows || []), ...(design.takeoff?.finish?.rows || [])];
        case 'roof': return design.costs?.rows || [];
        case 'wall': return design.rows || [];
        default: return [];
    }
}

function sampleDesigns() {
    const pool = defaultWaterConfig('pool');
    return {
        deck: computeDeckDesign({}),
        electrical: computeElectricalDesign({}),
        framing: computeFramingDesign(sampleFramingConfig()),
        landscape: designLandscape(pool, defaultSite(pool)),
        lighting: sampleLightingDesign(),
        plumbing: samplePlumbingDesign(),
        roof: computeRoofDesign({}),
        wall: computeWallDesign({})
    };
}

function addRow(map, suite, row, source) {
    if (!row || !isMaterialRow(row)) return;
    const item = row.item || row.description || row.label || row.name;
    if (!item) return;
    const unit = row.unit || row.packLabel || 'ea';
    const qty = Number(row.qty ?? row.quantity ?? 0) || 0;
    const total = Number(row.total ?? row.cost ?? row.amount ?? 0) || 0;
    const unitCost = Number(row.unitCost ?? (qty ? total / qty : total));
    if (!Number.isFinite(unitCost)) return;
    const key = priceKey(suite, item, unit);
    if (map.has(key)) {
        // A saved design wins over the default sample for its own variant, but
        // a default sample is enough to create the row when nothing is saved.
        if (source === 'saved') map.get(key).source = 'saved';
        return;
    }
    map.set(key, {
        key,
        suite,
        suiteLabel: SUITE_META.get(suite)?.label || suite,
        item: String(item),
        unit: String(unit || 'ea'),
        defaultCost: round(unitCost),
        source
    });
}

/** Unique material lines available to quote, with the current quote attached. */
export function collectPriceCatalog(storage = globalThis.localStorage) {
    const map = new Map();
    const defaults = sampleDesigns();
    Object.entries(defaults).forEach(([suite, design]) => {
        rowsFor(suite, design).forEach((row) => addRow(map, suite, row, 'default'));
    });
    if (storage) {
        collectBidSources(storage, { priceBook: { entries: {} } }).forEach((source) => {
            // The source lines are already normalised by the bid harvest, but
            // they retain the suite label and unit needed here.
            source.lines.forEach((line) => {
                addRow(map, source.suite, {
                    item: line.description,
                    unit: line.unit,
                    qty: line.qty,
                    unitCost: line.unitCost
                }, 'saved');
            });
        });
    }

    const book = loadPriceBook(storage);
    Object.values(book.entries).forEach((entry) => {
        if (map.has(entry.key)) return;
        map.set(entry.key, {
            key: entry.key,
            suite: entry.suite,
            suiteLabel: SUITE_META.get(entry.suite)?.label || entry.suite,
            item: entry.item,
            unit: entry.unit,
            defaultCost: null,
            source: 'custom'
        });
    });

    return [...map.values()]
        .map((item) => {
            const quote = book.entries[item.key] || null;
            return { ...item, quote };
        })
        .sort((a, b) => {
            const orderA = SUITES.findIndex((suite) => suite.key === a.suite);
            const orderB = SUITES.findIndex((suite) => suite.key === b.suite);
            return orderA - orderB || a.item.localeCompare(b.item) || a.unit.localeCompare(b.unit);
        });
}
