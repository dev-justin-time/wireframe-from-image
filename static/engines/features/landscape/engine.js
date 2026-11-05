import {
    IN,
    FT,
    computeWaterFeature,
    planOutline
} from './design.js';

/**
 * Landscape design engine.
 *
 * `computeWaterFeature` sizes the water body. This module adds the things a
 * landscape designer has to answer for around it: property-line setbacks, the
 * deck and drainage, the barrier, electrical clearances, the hydraulic train
 * (filter, skimmers, heater), a costed bill of materials and the rule checks.
 *
 * Every dimension is in metres, volumes in m³ with US gallons alongside, flows
 * in US gpm and heads in feet of water.
 */

export const DEFAULT_SITE = {
    width: 12,
    depth: 16,
    featureX: 6,
    featureZ: 8,
    deckSlopePercent: 2.0,
    overheadClearance: 7.62,
    receptacleDistance: 3.0,
    equipmentClearance: 1.2,
    bonded: true,
    gfci: true,
    luminairesListed: true,
    emergencyShutoff: true,
    signage: true,
    publicPool: false,
    accessibleEntry: false,
    freezeClimate: false,
    winterized: false,
    safetyCover: false,
    heater: true,
    filterMedia: 'cartridge',
    skimmers: 1,
    ph: 7.4,
    freeChlorine: 2,
    alkalinity: 100,
    cya: 40,
    calcium: 300
};

export const FILTERS = [
    { id: 'cart-100', label: 'Cartridge 100 sq ft', media: 'cartridge', areaSqFt: 100, gpm: 25, cost: 780 },
    { id: 'cart-150', label: 'Cartridge 150 sq ft', media: 'cartridge', areaSqFt: 150, gpm: 37, cost: 980 },
    { id: 'cart-200', label: 'Cartridge 200 sq ft', media: 'cartridge', areaSqFt: 200, gpm: 50, cost: 1180 },
    { id: 'cart-300', label: 'Cartridge 300 sq ft', media: 'cartridge', areaSqFt: 300, gpm: 75, cost: 1580 },
    { id: 'de-36', label: 'DE 36 sq ft', media: 'de', areaSqFt: 36, gpm: 72, cost: 1050 },
    { id: 'de-48', label: 'DE 48 sq ft', media: 'de', areaSqFt: 48, gpm: 96, cost: 1280 },
    { id: 'sand-24', label: 'Sand 24 in tank', media: 'sand', areaSqFt: 3.14, gpm: 47, cost: 720 },
    { id: 'sand-30', label: 'Sand 30 in tank', media: 'sand', areaSqFt: 4.91, gpm: 73, cost: 940 }
];

export const FILTER_MEDIA_RATE = { sand: 15, de: 2, cartridge: 0.25 };

export const PUMP_SIZES = [0.75, 1, 1.5, 2, 2.5, 3];

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function defaultSite(feature = {}) {
    const width = Math.max(6, number(feature.width, 4) + 4);
    const depth = Math.max(8, number(feature.length, 9) + 5);
    return {
        ...DEFAULT_SITE,
        width,
        depth,
        featureX: width / 2,
        featureZ: depth / 2
    };
}

/** Distance from the water edge to each property line, in metres. */
export function siteClearances(feature, site) {
    const halfWidth = number(feature.width, 4) / 2;
    const halfLength = number(feature.length, 9) / 2;
    const width = number(site.width, DEFAULT_SITE.width);
    const depth = number(site.depth, DEFAULT_SITE.depth);
    const x = clamp(number(site.featureX, width / 2), halfWidth, width - halfWidth);
    const z = clamp(number(site.featureZ, depth / 2), halfLength, depth - halfLength);
    return {
        left: x - halfWidth,
        right: width - x - halfWidth,
        front: z - halfLength,
        back: depth - z - halfLength,
        minimum: Math.min(x - halfWidth, width - x - halfWidth, z - halfLength, depth - z - halfLength)
    };
}

/** Plan perimeter of the water body, in metres. */
export function waterPerimeter(feature) {
    const points = planOutline(feature.shape, number(feature.width, 4), number(feature.length, 9));
    let length = 0;
    points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        length += Math.hypot(next.x - point.x, next.z - point.z);
    });
    return length;
}

function standardPumpHp(horsepower) {
    return PUMP_SIZES.find((size) => size >= horsepower) || PUMP_SIZES[PUMP_SIZES.length - 1];
}

/**
 * Full landscape design: water body + site + hydraulic train + checks + costs.
 */
export function designLandscape(feature = {}, siteInput = {}) {
    const base = computeWaterFeature(feature);
    const site = { ...defaultSite(base), ...siteInput };
    const clearances = siteClearances(base, site);
    const checks = base.issues.map((issue) => ({
        id: issue.code,
        severity: issue.severity,
        message: issue.message
    }));
    const add = (severity, id, message) => checks.push({ id, severity, message });

    const isWaterBody = base.type === 'pool' || base.type === 'spa';
    const isSpout = base.type === 'fountain' || base.type === 'waterfall' || base.type === 'water-wall';

    // --- Siting and the deck ------------------------------------------------
    const setback = clearances.minimum;
    if (setback < 3 * FT - 1e-6) {
        add('error', 'setback', `Water is ${(setback / FT).toFixed(1)} ft from a property line; 3 ft is the practical minimum and local zoning usually asks for 5–10 ft`);
    } else if (setback < 5 * FT - 1e-6) {
        add('warning', 'setback', `Water is ${(setback / FT).toFixed(1)} ft from a property line; confirm the 5 ft setback or the local amendment`);
    }

    const waterArea = base.area;
    const deckArea = Math.max(0, (base.width + base.deck * 2) * (base.length + base.deck * 2) - waterArea);
    if (isWaterBody && base.deck < 4 * FT - 1e-6) {
        add('error', 'deck-width', `Deck is ${(base.deck / FT).toFixed(1)} ft wide; a pool or spa needs 4 ft clear`);
    }
    if (base.deck > 0 && site.deckSlopePercent < 1) {
        add('error', 'deck-slope', `Deck slope ${site.deckSlopePercent.toFixed(1)}% falls below the 1% minimum; use about 2% (1/4 in per foot)`);
    } else if (base.deck > 0 && site.deckSlopePercent < 2) {
        add('warning', 'deck-slope', `Deck slope ${site.deckSlopePercent.toFixed(1)}% is under the 2% recommendation`);
    }
    if (isWaterBody && site.deckSlopePercent < 2) {
        add('warning', 'site-drainage', 'Deck and site should fall away from the water and the building at about 2%');
    }

    // --- Electrical and safety ---------------------------------------------
    if (!site.bonded) add('error', 'bonding', 'Equipotential bonding is required around the water (NEC 680.26)');
    if (!site.gfci) add('error', 'gfci', 'GFCI protection is required for the pump and pool receptacles (NEC 680.21–680.23)');
    if (site.overheadClearance < 25 * FT - 1e-6) {
        add('error', 'overhead', `Overhead clearance ${(site.overheadClearance / FT).toFixed(0)} ft is under the 25 ft NEC 680.8 minimum`);
    }
    if (site.receptacleDistance < 6 * FT - 1e-6 || site.receptacleDistance > 20 * FT + 1e-6) {
        add('error', 'receptacle', `Receptacle at ${(site.receptacleDistance / FT).toFixed(0)} ft must sit between 6 ft and 20 ft from the water`);
    }
    if (!site.luminairesListed) add('error', 'luminaire', 'Pool and spa luminaires must be listed for pool use (NEC 680.23)');
    if (site.equipmentClearance < 3 * FT - 1e-6) {
        add('warning', 'equipment-access', `Equipment clearance ${(site.equipmentClearance / FT).toFixed(1)} ft is under the 3 ft service recommendation`);
    }
    if (site.publicPool && !site.accessibleEntry) {
        add('error', 'accessible', 'A public pool needs an accessible lift or sloped entry (ADA 242/1009)');
    }
    if (site.freezeClimate && !site.winterized) {
        add('warning', 'freeze', 'Freeze climate: plan to drain and blow out the lines or keep the pump running through frost');
    }
    if (site.freezeClimate && !site.safetyCover) {
        add('info', 'cover', 'A freeze climate benefits from a listed safety cover (ASTM F1346)');
    }
    if (base.type === 'spa' && !site.emergencyShutoff) {
        add('error', 'spa-shutoff', 'A spa needs an emergency shut-off within 5 ft of the water');
    }
    if (base.type === 'spa' && !site.signage) {
        add('error', 'spa-signage', 'Post the spa safety, temperature and pregnancy signage');
    }

    // --- Geometry and water ------------------------------------------------
    if (isSpout && base.deep < 6 * IN - 1e-6) {
        add('warning', 'basin', `Basin is ${(base.deep / IN).toFixed(0)} in deep; a fountain or water wall needs about 6 in over the intake`);
    }

    // --- Hydraulic train ----------------------------------------------------
    const media = FILTER_MEDIA_RATE[site.filterMedia] ? site.filterMedia : 'cartridge';
    const mediaRate = FILTER_MEDIA_RATE[media];
    const requiredFilterArea = base.flowGpm / mediaRate;
    const filter = FILTERS
        .filter((entry) => entry.media === media && entry.gpm >= base.flowGpm)
        .sort((a, b) => a.areaSqFt - b.areaSqFt)[0]
        || FILTERS.filter((entry) => entry.media === media).sort((a, b) => b.areaSqFt - a.areaSqFt)[0];
    if (!filter || filter.gpm < base.flowGpm) {
        add('warning', 'filter', `Design flow ${base.flowGpm.toFixed(0)} gpm exceeds the largest ${media} filter; add a second filter or slow the turnover`);
    }
    const skimmersRequired = Math.max(1, Math.ceil(base.areaSqFt / 500));
    if (isWaterBody && site.skimmers < skimmersRequired) {
        add('warning', 'skimmers', `${skimmersRequired} skimmer(s) recommended for ${Math.round(base.areaSqFt)} sq ft; the design shows ${site.skimmers}`);
    }
    const drainVelocity = base.suctionOutlets > 0
        ? (base.flowGpm * 0.002228) / (base.suctionOutlets * 0.09)
        : 0;
    if (isWaterBody && drainVelocity > 1.5) {
        add('warning', 'drain-velocity', `Cover face velocity ${drainVelocity.toFixed(1)} ft/s is over the 1.5 ft/s limit; add an outlet or lower the flow`);
    }
    const returns = Math.max(2, Math.ceil(base.areaSqFt / 120));
    const lights = isWaterBody ? Math.max(1, Math.ceil(base.areaSqFt / 100)) : 0;
    const pumpHp = standardPumpHp(base.pumpHp);
    const heaterBtu = site.heater
        ? Math.ceil((base.gallons * 8.34 * 20 / 24) / 10000) * 10000
        : 0;

    // --- Water quality (start-up plan) -------------------------------------
    if (site.ph < 7.2 - 1e-6 || site.ph > 7.8 + 1e-6) add('warning', 'chemistry-ph', `pH ${site.ph} is outside 7.2–7.8`);
    if (site.freeChlorine < 1 - 1e-6 || site.freeChlorine > 5 + 1e-6) add('warning', 'chemistry-chlorine', `Free chlorine ${site.freeChlorine} ppm is outside 1–5 ppm (1–3 ppm pool)`);
    if (site.alkalinity < 80 - 1e-6 || site.alkalinity > 120 + 1e-6) add('warning', 'chemistry-alkalinity', `Alkalinity ${site.alkalinity} ppm is outside 80–120 ppm`);
    if (site.cya < 30 - 1e-6 || site.cya > 100 + 1e-6) add('warning', 'chemistry-cya', `Cyanuric acid ${site.cya} ppm is outside 30–50 ppm (100 ppm maximum)`);
    if (site.calcium < 200 - 1e-6 || site.calcium > 400 + 1e-6) add('warning', 'chemistry-calcium', `Calcium hardness ${site.calcium} ppm is outside 200–400 ppm`);

    // --- Costs --------------------------------------------------------------
    const perimeter = waterPerimeter(base);
    const deckPerimeter = perimeter + base.deck * 8;
    const barrierPerimeter = perimeter + base.deck * 8 + 3;
    const shellArea = base.area + perimeter * (base.avgDepth + 0.25);
    const excavation = base.area * (base.avgDepth + 0.35);
    const bom = [
        { id: 'excavation', item: 'Excavation and spoil', spec: 'Shell and overdig', qty: excavation, unit: 'm³', unitCost: 65 },
        { id: 'shell', item: 'Shell and waterproofing', spec: base.type === 'pond' ? 'EPDM liner and underlay' : 'Gunite, plaster and tile', qty: shellArea, unit: 'm²', unitCost: base.type === 'pond' ? 55 : 145 },
        { id: 'coping', item: 'Coping', spec: 'Bullnose, bedded', qty: perimeter, unit: 'm', unitCost: 65 },
        { id: 'deck', item: 'Deck paving', spec: 'Slip-resistant, drained', qty: deckArea, unit: 'm²', unitCost: 120 },
        { id: 'water', item: 'Water and start-up chemicals', spec: 'Fill and balance', qty: base.volumeM3, unit: 'm³', unitCost: 4.5 },
        { id: 'pump', item: 'Pump', spec: `${pumpHp} hp variable speed`, qty: 1, unit: 'ea', unitCost: 650 + pumpHp * 520 },
        { id: 'filter', item: 'Filter', spec: filter?.label || `${media} filter`, qty: filter?.qty || 1, unit: 'ea', unitCost: filter?.cost || 1000 },
        { id: 'heater', item: 'Heater', spec: `${Math.round(heaterBtu / 1000)} kBTU gas`, qty: site.heater ? 1 : 0, unit: 'ea', unitCost: 2200 },
        { id: 'skimmers', item: 'Skimmer', spec: 'With equaliser', qty: isWaterBody ? site.skimmers : 0, unit: 'ea', unitCost: 360 },
        { id: 'covers', item: 'Suction covers', spec: 'VGB listed', qty: isWaterBody ? Math.max(2, base.suctionOutlets) : 0, unit: 'ea', unitCost: 95 },
        { id: 'returns', item: 'Return inlets', spec: 'Directional', qty: returns, unit: 'ea', unitCost: 45 },
        { id: 'lights', item: 'Pool luminaire', spec: '12 V LED, listed', qty: lights, unit: 'ea', unitCost: 650 },
        { id: 'barrier', item: 'Barrier and gate', spec: '48 in, self-closing gate', qty: barrierPerimeter, unit: 'm', unitCost: 95 },
        { id: 'cover', item: 'Safety cover', spec: 'ASTM F1346', qty: site.safetyCover ? 1 : 0, unit: 'ea', unitCost: Math.round((base.width + 0.6) * (base.length + 0.6) * 80) },
        { id: 'controls', item: 'Controls and bonding', spec: 'Controller, GFCI, bond kit', qty: 1, unit: 'lot', unitCost: 900 }
    ].filter((line) => line.qty > 0).map((line) => ({
        ...line,
        total: Math.round(line.qty * line.unitCost)
    }));
    const total = bom.reduce((sum, line) => sum + line.total, 0);

    // --- Schedule -----------------------------------------------------------
    const schedule = [
        { tag: 'P-1', kind: 'Pump', item: 'Variable-speed pump', spec: `${pumpHp} hp · ${base.flowGpm.toFixed(0)} gpm @ ${base.headFeet.toFixed(0)} ft`, qty: 1, unit: 'ea', note: 'Disconnect within sight' },
        { tag: 'F-1', kind: 'Filter', item: filter?.label || `${media} filter`, spec: `${base.flowGpm.toFixed(0)} gpm · ${requiredFilterArea.toFixed(1)} sq ft required`, qty: filter?.qty || 1, unit: 'ea', note: 'Pressure gauge and air relief' },
        ...(site.heater ? [{ tag: 'H-1', kind: 'Heater', item: 'Gas heater', spec: `${Math.round(heaterBtu / 1000)} kBTU/h`, qty: 1, unit: 'ea', note: 'Bypass and check valve' }] : []),
        ...(isWaterBody ? [
            { tag: 'S-1', kind: 'Skimmer', item: 'Skimmer with equaliser', spec: `${site.skimmers} on the windward side`, qty: site.skimmers, unit: 'ea', note: 'Keep within 30–50 gpm' },
            { tag: 'D-1', kind: 'Suction', item: 'VGB suction outlets', spec: `${Math.max(2, base.suctionOutlets)} outlets, 3 ft apart`, qty: Math.max(2, base.suctionOutlets), unit: 'ea', note: 'VGB-listed covers' },
            { tag: 'R-1', kind: 'Return', item: 'Directional return inlets', spec: `${returns} around the perimeter`, qty: returns, unit: 'ea', note: 'Balance the surface flow' },
            { tag: 'L-1', kind: 'Light', item: '12 V LED pool luminaire', spec: `${lights} listed fittings`, qty: lights, unit: 'ea', note: 'GFCI protected' }
        ] : []),
        { tag: 'B-1', kind: 'Barrier', item: 'Barrier and self-closing gate', spec: '48 in high, 4 in sphere', qty: barrierPerimeter, unit: 'm', note: 'Latch at 54 in' },
        { tag: 'E-1', kind: 'Electrical', item: 'Bonding and GFCI kit', spec: '#8 AWG copper', qty: 1, unit: 'lot', note: 'Inspect before deck pour' },
        ...(site.safetyCover ? [{ tag: 'C-1', kind: 'Cover', item: 'Safety cover', spec: 'ASTM F1346', qty: 1, unit: 'ea', note: 'Anchors inspected yearly' }] : [])
    ];

    const errors = checks.filter((check) => check.severity === 'error');
    const warnings = checks.filter((check) => check.severity === 'warning');

    return {
        ...base,
        site,
        clearances,
        checks,
        errors,
        warnings,
        metrics: {
            area: base.area,
            areaSqFt: base.areaSqFt,
            gallons: base.gallons,
            volumeM3: base.volumeM3,
            flowGpm: base.flowGpm,
            turnoverHours: base.turnoverHours,
            pumpHp,
            headFeet: base.headFeet,
            bathers: base.bathers,
            perimeter,
            deckArea,
            deckPerimeter,
            barrierPerimeter,
            setback: clearances.minimum,
            filterArea: filter?.areaSqFt || 0,
            filterRequired: requiredFilterArea,
            skimmers: isWaterBody ? site.skimmers : 0,
            skimmersRequired,
            returns,
            lights,
            drainVelocity,
            heaterBtu
        },
        filter,
        pumpHp,
        heaterBtu,
        schedule,
        bom,
        cost: { lines: bom, total }
    };
}

function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function landscapeScheduleCsv(design) {
    const lines = [
        ['Tag', 'Kind', 'Item', 'Specification', 'Qty', 'Unit', 'Note'],
        ...design.schedule.map((row) => [row.tag, row.kind, row.item, row.spec, row.qty, row.unit, row.note])
    ];
    return lines.map((line) => line.map(csvCell).join(',')).join('\n');
}

export function landscapeTakeoffCsv(design) {
    const lines = [
        ['Id', 'Item', 'Specification', 'Qty', 'Unit', 'Unit cost', 'Total'],
        ...design.bom.map((line) => [line.id, line.item, line.spec, line.qty.toFixed(2), line.unit, line.unitCost.toFixed(2), line.total.toFixed(2)]),
        ['', '', '', '', '', 'Total', design.cost.total.toFixed(2)]
    ];
    return lines.map((line) => line.map(csvCell).join(',')).join('\n');
}

export function landscapeSummaryText(design) {
    return [
        `${design.typeLabel} · ${design.shapeLabel}`,
        `${design.gallons.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal · ${design.flowGpm.toFixed(0)} gpm · ${design.pumpHp.toFixed(1)} hp`,
        `${design.site.skimmers} skimmer(s) · setback ${(design.clearances.minimum / FT).toFixed(1)} ft`,
        `${design.errors.length} error(s) · ${design.warnings.length} warning(s)`
    ].join(' · ');
}
