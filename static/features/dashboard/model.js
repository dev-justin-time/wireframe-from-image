import { collectBidSources, SUITES } from '../bid/sources.js';

/**
 * Project dashboard model.
 *
 * The dashboard is a cross-suite index, not a second calculation. It asks the
 * bid builder's source harvest to rebuild every saved design, then keeps the
 * suite's own takeoff subtotal beside a short description of the draft that
 * produced it. Prices and line counts therefore match the bid builder exactly.
 */

const SUITE_META = new Map(SUITES.map((suite) => [suite.key, suite]));

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const compact = (value) => {
    const parsed = number(value);
    if (parsed === null) return null;
    return String(round(parsed, 1)).replace(/\.0$/, '');
};

const size = (width, depth, unit = 'm') => {
    const w = compact(width);
    const d = compact(depth);
    return w && d ? `${w} × ${d} ${unit}` : null;
};

const label = (value, fallback = '') => {
    const text = String(value || fallback).replace(/[-_]+/g, ' ').trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

const join = (...parts) => parts.filter(Boolean).join(' · ');

const WATER_LABELS = {
    pool: 'Swimming pool',
    spa: 'Spa / hot tub',
    fountain: 'Fountain',
    pond: 'Ornamental pond',
    waterfall: 'Waterfall',
    'water-wall': 'Water wall'
};

/** Short human description of the saved draft behind one suite. */
export function describeDesign(suiteKey, draft = {}) {
    if (!draft || typeof draft !== 'object') return 'Saved design';
    const config = draft.config && typeof draft.config === 'object' ? draft.config : draft;

    switch (suiteKey) {
        case 'deck': {
            const height = compact(config.height);
            return join(
                label(config.shape, 'Rectangle'),
                size(config.width, config.depth),
                height ? `${height} m above grade` : null,
                String(config.ledger || 'house') === 'house' ? 'ledger attached' : 'freestanding'
            ) || 'Deck design';
        }
        case 'electrical': {
            const area = compact(config.areaM2);
            const sabc = compact(config.sabc);
            const appliances = Object.values(config.appliances || {}).filter((value) => Number(value) > 0).length;
            return join(
                area ? `${area} m² dwelling` : null,
                sabc ? `${sabc} small-appliance circuits` : null,
                appliances ? `${appliances} appliance load${appliances === 1 ? '' : 's'}` : null
            ) || 'Electrical design';
        }
        case 'framing': {
            const storeys = Array.isArray(config.storeys) ? config.storeys.length : 0;
            return join(
                storeys ? `${storeys} store${storeys === 1 ? 'y' : 'ys'}` : null,
                config.studSize ? `${config.studSize} studs` : null,
                config.studSpacingIn ? `${compact(config.studSpacingIn)} in o.c.` : null
            ) || 'Framing design';
        }
        case 'landscape': {
            const plan = draft.feature ? draft : { feature: draft };
            const feature = plan.feature || {};
            return join(
                WATER_LABELS[feature.type] || label(feature.type, 'Water feature'),
                size(feature.width, feature.length),
                label(feature.shape)
            ) || 'Landscape design';
        }
        case 'lighting': {
            const plan = draft.plan || draft;
            const devices = Array.isArray(plan.devices) ? plan.devices.length : 0;
            return join(
                label(plan.roomType, 'Room'),
                size(plan.width, plan.depth),
                devices ? `${devices} device${devices === 1 ? '' : 's'}` : null
            ) || 'Lighting design';
        }
        case 'plumbing': {
            const plan = draft.plan || draft;
            const fixtures = Array.isArray(plan.fixtures) ? plan.fixtures.length : 0;
            return join(
                label(plan.template, 'House'),
                size(plan.width, plan.depth),
                fixtures ? `${fixtures} fixture${fixtures === 1 ? '' : 's'}` : null
            ) || 'Plumbing design';
        }
        case 'roof': {
            return join(
                label(config.style, 'Roof'),
                size(config.span, config.length),
                compact(config.pitch) ? `${compact(config.pitch)}:12 pitch` : null
            ) || 'Roof design';
        }
        case 'wall': {
            const area = compact(config.area);
            return join(
                label(config.exposure, 'Interior'),
                label(config.covering),
                area ? `${area} m²` : size(config.length, config.height)
            ) || 'Wall finish design';
        }
        case 'stair': {
            const stair = draft.stair || draft;
            const width = compact(Number(stair.width) * 39.3701);
            const run = compact(stair.availableRun);
            return join(
                `${label(stair.system || stair.type, 'Straight')} stair`,
                width ? `${width} in wide` : null,
                run ? `${run} m run` : null
            ) || 'Stair design';
        }
        default:
            return 'Saved design';
    }
}

/**
 * One entry per suite, whether or not it has a saved design, plus the totals
 * the summary strip needs. Missing drafts stay in the list so the dashboard
 * always shows the complete project, not only the suites already started.
 */
export function dashboardState(storage = globalThis.localStorage) {
    const sources = collectBidSources(storage);
    const suites = sources.map((source) => {
        const meta = SUITE_META.get(source.suite) || {};
        const open = Boolean(source.saved ?? source.found);
        const priced = Boolean(open && source.found && source.priced && source.lines.length);
        return {
            key: source.suite,
            label: meta.label || source.label || source.suite,
            page: meta.page || '',
            open,
            priced,
            total: priced ? round(source.subtotal) : 0,
            lines: source.lines.length,
            note: source.note || '',
            detail: open ? describeDesign(source.suite, source.draft) : 'No saved design in this browser yet.',
            draftKey: source.draftKey || null
        };
    });

    const open = suites.filter((suite) => suite.open);
    const priced = suites.filter((suite) => suite.priced);
    return {
        suites,
        totals: {
            suites: suites.length,
            open: open.length,
            priced: priced.length,
            unpriced: open.filter((suite) => !suite.priced).length,
            lines: priced.reduce((total, suite) => total + suite.lines, 0),
            takeoff: round(priced.reduce((total, suite) => total + suite.total, 0))
        },
        generatedAt: new Date().toISOString()
    };
}
