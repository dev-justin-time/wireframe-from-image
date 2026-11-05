import { PIXELS_PER_METER } from '../../core/world-space.js';
import {
    LITRE_PER_GALLON,
    coveringById,
    coveringOptions,
    sheenById,
    colourById,
    substrateById,
    defaultCoveringFor,
    paintCoveringForSheen,
    buildColourScheme,
    lrvOf
} from './materials.js';

/**
 * Wall design engine.
 *
 * One call turns a wall run, a covering and a substrate into areas, coats,
 * paint litres or pack counts, a costed bill, the preparation the job needs and
 * the code-style checks the suite reports. The designer page, the editor's
 * finishes panel and the tests all consume this object, so the picture, the
 * quantities and the price agree.
 */

export const WALL_DEFAULTS = {
    exposure: 'interior',
    covering: 'paint-eggshell',
    colour: 'cotton-white',
    harmony: 'monochrome',
    sheen: null,
    length: 12,
    height: 2.7,
    openingsArea: 3.2,
    area: null,
    perimeter: 18,
    substrate: 'gypsum-painted',
    condition: 'repaint',
    coats: null,
    primer: true,
    waste: null,
    climateZone: 4,
    wetArea: false,
    fireRating: 'none',
    occupancy: 'residential',
    buildingYear: 2005,
    ageDays: 365,
    moisturePercent: 12,
    temperatureC: 20,
    rainExpected: false,
    wrb: true,
    rainScreen: true,
    flashing: true,
    gradeClearanceMm: 152,
    windMph: 90,
    deflection: 480,
    acclimated: true,
    trim: true
};

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const ceil = (value) => Math.ceil(Math.max(value, 0) - 1e-9);

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const PREP_TASKS = {
    new: [
        { task: 'Fill and tape joints', rate: 0.06, note: 'Three coats of compound, sanded between passes.' },
        { task: 'Sand and dust the surface', rate: 0.04, note: 'Bright light across the wall shows every ridge.' }
    ],
    repaint: [
        { task: 'Wash and degloss', rate: 0.05, note: 'Glossy or greasy films stop the new coat bonding.' },
        { task: 'Scrape and spot-prime bare patches', rate: 0.04, note: 'Feather every edge; bare timber and filler need primer.' },
        { task: 'Fill cracks and caulk joints', rate: 0.03, note: 'Use a flexible sealant at trim and a filler in the field.' }
    ],
    wallpaper: [
        { task: 'Strip the old covering', rate: 0.12, note: 'Score, soak and scrape; never paper over paper.' },
        { task: 'Wash off paste residue', rate: 0.05, note: 'Residue stops the sizing and adhesive bonding.' },
        { task: 'Size and prime the wall', rate: 0.03, note: 'Sizing lets the paper slide and protects the substrate.' }
    ],
    damaged: [
        { task: 'Cut out and patch damaged board', rate: 0.18, note: 'Water stains and soft board are a moisture problem first.' },
        { task: 'Prime the repair', rate: 0.03, note: 'A repair that is not primed flashes through the finish.' }
    ]
};

const PREP_RATE = 55;

function prepFor(config, covering) {
    const base = PREP_TASKS[config.condition] || PREP_TASKS.repaint;
    const tasks = base.map((entry) => ({ ...entry }));
    if (config.exposure === 'exterior') {
        tasks.push({ task: 'Wash and treat mildew', rate: 0.06, note: 'Wet the wall, wash with a mildewcide, rinse and let it dry.' });
        tasks.push({ task: 'Prime bare and chalky areas', rate: 0.04, note: 'Exterior paint needs a sound, sealed surface to hold.' });
    }
    if (covering.family === 'tile') {
        tasks.push({ task: 'Set out and level the backer', rate: 0.08, note: 'Flat within 3 mm over 2 m; layout from the centre.' });
    }
    if (covering.family === 'panel' || covering.family === 'siding') {
        tasks.push({ task: 'Acclimate and cut the boards', rate: 0.05, note: '48–72 hours in the room or on site before fixing.' });
    }
    return tasks.map((task) => ({
        ...task,
        hours: round(config.netArea * task.rate, 2),
        cost: round(config.netArea * task.rate * PREP_RATE, 2)
    }));
}

/** Whether a covering may sit on a surface, by id. */
export function coveringFitsSubstrate(covering, substrateId) {
    return Boolean(covering?.substrates?.includes(substrateId));
}

/**
 * Net wall area from a plan. Walls carry canvas-pixel endpoints and an optional
 * per-wall height; openings carry their own area or width/height in metres.
 */
export function wallAreaFromPlan(walls = [], { wallHeight = 2.7, openings = [] } = {}) {
    let gross = 0;
    let length = 0;
    (walls || []).forEach((wall) => {
        if (!wall?.start || !wall?.end) return;
        const dx = (wall.end.x - wall.start.x) / PIXELS_PER_METER;
        const dy = (wall.end.y - wall.start.y) / PIXELS_PER_METER;
        const run = Math.hypot(dx, dy);
        const height = typeof wall.height === 'number' && wall.height > 0 ? wall.height : wallHeight;
        length += run;
        gross += run * height;
    });
    const openingArea = (openings || []).reduce((sum, opening) => {
        if (!opening) return sum;
        if (Number.isFinite(opening.area)) return sum + opening.area;
        return sum + Math.max(number(opening.width), 0) * Math.max(number(opening.height), 0);
    }, 0);
    return {
        gross: round(gross, 2),
        openings: round(openingArea, 2),
        net: round(Math.max(gross - openingArea, 0), 2),
        length: round(length, 2),
        height: round(wallHeight, 2)
    };
}

export function computeWallDesign(options = {}) {
    const raw = { ...WALL_DEFAULTS, ...options };
    const exposure = raw.exposure === 'exterior' ? 'exterior' : 'interior';

    // A covering from the other side of the house falls back to the first one
    // that belongs on this side, so switching Interior/Exterior stays coherent.
    const allowed = coveringOptions({ exposure });
    let covering = coveringById(raw.covering);
    if (!allowed.some((entry) => entry.id === covering.id)) covering = defaultCoveringFor(exposure);

    // A sheen is a separate choice in the suite, but it is a different product
    // in the catalogue. Switching sheen moves to that product so coverage,
    // cost, VOC and warranty follow the finish rather than the old defaults.
    const sheenProduct = raw.sheen ? paintCoveringForSheen(raw.sheen) : null;
    if (covering.family === 'paint' && sheenProduct
        && allowed.some((entry) => entry.id === sheenProduct)) {
        covering = coveringById(sheenProduct);
    }

    const substrate = substrateById(raw.substrate);
    // The product now carries the sheen, so a stale sheen from the other side
    // of the envelope cannot survive an exposure switch.
    const sheen = sheenById(covering.sheen || raw.sheen);
    const colour = colourById(raw.colour) || colourById(covering.defaultColour) || colourById('cotton-white');
    const scheme = buildColourScheme(colour.id, raw.harmony);

    const length = clamp(number(raw.length, WALL_DEFAULTS.length), 0.1, 500);
    const height = clamp(number(raw.height, WALL_DEFAULTS.height), 0.1, 20);
    const gross = round(length * height, 2);
    const openings = clamp(number(raw.openingsArea, 0), 0, gross * 0.95);
    const suppliedArea = raw.area != null && Number.isFinite(Number(raw.area)) ? Number(raw.area) : null;
    const net = round(Math.max(suppliedArea != null ? suppliedArea : gross - openings, 0.1), 2);
    const perimeter = clamp(number(raw.perimeter, length), 0, 2000);
    const coats = clamp(Math.round(raw.coats || covering.coats), 1, 5);
    const waste = clamp(raw.waste != null && Number.isFinite(Number(raw.waste)) ? Number(raw.waste) : covering.waste, 0, 0.4);
    const primer = raw.primer !== false && covering.primer !== 'none';

    const config = {
        ...raw,
        exposure,
        covering: covering.id,
        colour: colour.id,
        substrate: substrate.id,
        length,
        height,
        grossArea: gross,
        openingsArea: openings,
        netArea: net,
        perimeter,
        coats,
        waste,
        primer,
        climateZone: clamp(Math.round(number(raw.climateZone, 4)), 1, 8),
        gradeClearanceMm: clamp(number(raw.gradeClearanceMm, 152), 0, 1200),
        windMph: clamp(number(raw.windMph, 90), 0, 250),
        temperatureC: number(raw.temperatureC, 20),
        moisturePercent: number(raw.moisturePercent, 12),
        ageDays: clamp(number(raw.ageDays, 365), 0, 36500),
        buildingYear: clamp(Math.round(number(raw.buildingYear, 2005)), 1800, 2100),
        deflection: clamp(number(raw.deflection, 480), 0, 2000)
    };

    const rows = [];
    covering.components.forEach((component) => {
        if (component.primer && !primer) return;
        const basis = component.basis === 'perimeter' ? perimeter : net;
        const passes = component.perCoat ? coats : 1;
        const need = basis * (1 + waste) * passes;
        const packs = ceil(need / component.coveragePerPack);
        rows.push({
            group: component.group || 'Finish',
            item: component.item,
            qty: packs,
            unit: component.unit,
            packLabel: component.packLabel || component.unit,
            need: round(need, 2),
            cost: round(packs * component.costPerPack, 2),
            basis: component.basis === 'perimeter' ? 'perimeter' : 'area',
            perCoat: Boolean(component.perCoat),
            coveragePerPack: component.coveragePerPack,
            coverageRate: component.coverageRate || null
        });
    });
    (covering.perimeterComponents || []).forEach((component) => {
        const need = perimeter * (1 + waste);
        const packs = ceil(need / component.coveragePerPack);
        rows.push({
            group: component.group || 'Accessories',
            item: component.item,
            qty: packs,
            unit: component.unit,
            packLabel: component.packLabel || component.unit,
            need: round(need, 2),
            cost: round(packs * component.costPerPack, 2),
            basis: 'perimeter',
            perCoat: false,
            coveragePerPack: component.coveragePerPack,
            coverageRate: null
        });
    });

    const material = round(rows.reduce((sum, row) => sum + row.cost, 0), 2);
    const finishComponent = covering.components.find((component) => component.perCoat);
    const primerComponent = covering.components.find((component) => component.primer);
    const paint = covering.family === 'paint' && finishComponent
        ? {
            litres: round((net * (1 + waste) * coats) / finishComponent.coverageRate, 1),
            gallons: round((net * (1 + waste) * coats) / finishComponent.coverageRate / LITRE_PER_GALLON, 1),
            cans: ceil((net * (1 + waste) * coats) / finishComponent.coveragePerPack),
            primerLitres: primer && primerComponent
                ? round((net * (1 + waste)) / primerComponent.coverageRate, 1)
                : 0,
            primerCans: primer && primerComponent
                ? ceil((net * (1 + waste)) / primerComponent.coveragePerPack)
                : 0,
            coverageRate: finishComponent.coverageRate
        }
        : null;

    const prep = prepFor(config, covering);
    const prepHours = round(prep.reduce((sum, task) => sum + task.hours, 0), 2);
    const prepCost = round(prep.reduce((sum, task) => sum + task.cost, 0), 2);
    const install = round(net * covering.labourPerM2, 2);
    const labour = round(install + prepCost, 2);
    const total = round(material + labour, 2);
    const costs = {
        material,
        install,
        prep: prepCost,
        labour,
        total,
        perM2: round(total / net, 2),
        rows
    };

    // --- Checks -----------------------------------------------------
    const checks = [];
    const push = (severity, id, label, detail = '') => checks.push({ severity, id, label, detail });
    const interior = exposure === 'interior';

    if (!coveringFitsSubstrate(covering, substrate.id)) {
        push('error', 'substrate', `${covering.label} is not specified over ${substrate.label}.`, 'Choose a covering whose data sheet lists this substrate, or change the substrate.');
    } else {
        push('ok', 'substrate', `${covering.label} is approved over ${substrate.label}.`);
    }

    if (covering.exposure !== 'both' && covering.exposure !== exposure) {
        push('error', 'exposure', `${covering.label} is rated ${covering.exposure} only.`);
    }

    if (coats < covering.coats) {
        push('warn', 'coats', `${coats} coat${coats === 1 ? '' : 's'} specified; the product needs ${covering.coats}.`, 'Cutting coats short voids most warranties and shows the substrate.');
    } else {
        push('ok', 'coats', `${coats} coats specified, covering needs ${covering.coats}.`);
    }

    if (covering.primer === 'required' && !primer) {
        push('error', 'primer', `${covering.label} requires a primer.`, 'Bare or porous surfaces pull the finish in and leave a patchy film.');
    } else if (covering.primer === 'recommended' && !primer) {
        push('warn', 'primer', 'A primer is recommended but switched off.', 'Priming improves hiding, adhesion and the true colour.');
    } else {
        push('ok', 'primer', primer ? 'Primer included.' : 'No primer is needed.');
    }

    if (config.wetArea && !covering.wetAreaOk) {
        push('error', 'wet-area', `${covering.label} is not a wet-area finish.`, 'Use tile, a satin or semi-gloss paint, or a vinyl covering.');
    }
    if (interior && config.wetArea && covering.family === 'paint' && ['matte', 'dead-flat'].includes(sheen.id)) {
        push('error', 'sheen-wet', `${sheen.label} paint in a wet area will burnish and mould.`, 'Step up to satin or semi-gloss for kitchens, bathrooms and laundry rooms.');
    }

    if (interior) {
        if (config.climateZone >= 5 && covering.vapourClass === 'I') {
            push('warn', 'vapour', `A Class I interior finish in climate zone ${config.climateZone} can trap moisture.`, 'A vinyl covering is a vapour retarder; use a Class III paint or a vented assembly (IRC R702.7).');
        } else if (covering.vapourClass) {
            push('info', 'vapour', `Class ${covering.vapourClass} vapour retarder on the interior face.`, `Climate zone ${config.climateZone}: IRC Table R702.7(2) sets the class allowed.`);
        }
    }

    if (config.fireRating !== 'none') {
        if (covering.fireClass === 'A') {
            push('ok', 'fire', `Class A flame spread suits a ${config.fireRating} separation.`);
        } else {
            push('warn', 'fire', `${covering.label} is Class ${covering.fireClass}; a ${config.fireRating} separation needs a tested assembly.`, 'Combustible finishes must be part of the rated wall assembly (IRC R302.9).');
        }
    }

    const vocLimit = interior ? 50 : 100;
    if (covering.vocGL > vocLimit) {
        push('warn', 'voc', `${covering.vocGL} g/L VOC exceeds the ${interior ? 'interior' : 'exterior'} ${vocLimit} g/L guide.`, 'Check the regional air-quality rule before specifying; low-VOC products are widely available.');
    } else {
        push('ok', 'voc', `${covering.vocGL} g/L VOC, within the ${vocLimit} g/L guide.`);
    }

    const cureDays = substrate.cureDays || 0;
    if (cureDays && config.condition === 'new' && config.ageDays < cureDays) {
        push('warn', 'cure', `${substrate.label} is ${config.ageDays} days old; allow ${cureDays} days.`, 'New concrete, plaster and stucco release water and alkalis that attack the finish.');
    }

    if (['wood-bare', 'wood-primed', 'fiber-cement'].includes(substrate.id)) {
        const limit = substrate.moistureMax || 19;
        if (config.moisturePercent > limit) {
            push('error', 'moisture', `Wood moisture is ${config.moisturePercent}%; the limit is ${limit}%.`, 'Coating damp timber traps water and blisters the film.');
        } else {
            push('ok', 'moisture', `Wood moisture ${config.moisturePercent}% is within ${limit}%.`);
        }
    }

    if (config.temperatureC < covering.minTempC) {
        push('error', 'temperature', `${config.temperatureC}°C is below the ${covering.minTempC}°C product minimum.`, 'Film formation, adhesion and cure all fail in the cold.');
    } else if (config.temperatureC > 35) {
        push('warn', 'temperature', `${config.temperatureC}°C is above the 35°C working limit.`, 'Add a retarder or work early; the film will skin before it levels.');
    } else {
        push('ok', 'temperature', `${config.temperatureC}°C is within the ${covering.minTempC}–35°C window.`);
    }

    if (config.buildingYear < 1978 && ['repaint', 'wallpaper', 'damaged'].includes(config.condition) && ['paint', 'wallpaper', 'plaster'].includes(covering.family)) {
        push('warn', 'lead', `Pre-1978 building: assume lead paint before sanding or stripping.`, 'Use an EPA Lead-Safe certified firm and RRP containment (40 CFR 745).');
    }
    if (config.buildingYear < 1980 && config.condition === 'repaint' && ['plaster-new', 'plaster-painted'].includes(substrate.id)) {
        push('info', 'asbestos', 'Pre-1980 plaster or texture may contain asbestos.', 'Test before sanding or demolition; work to OSHA 1926.1101 if it is present.');
    }

    const minimumWaste = covering.family === 'paint' ? 0.05 : 0.1;
    if (waste < minimumWaste) {
        push('info', 'waste', `${Math.round(waste * 100)}% waste is tight for ${covering.family}.`, `Use at least ${Math.round(minimumWaste * 100)}% for offcuts, touch-ups and pattern matching.`);
    }

    if (covering.family === 'tile') {
        const wetBackers = ['gypsum-wet', 'fiber-cement'];
        if (config.wetArea && !wetBackers.includes(substrate.id)) {
            push('error', 'tile-backer', 'Wall tile in a wet area needs a water-resistant or cement backer.', 'IRC R702.3.7 and Table R702.4.2: gypsum board is not a shower backer.');
        }
        if (config.deflection < 360) {
            push('warn', 'tile-deflection', `Deflection L/${config.deflection} is below L/360.`, 'Tile and grout crack when the backing flexes; stiffen the wall first.');
        }
    }

    if (covering.family === 'wallpaper' && config.condition === 'wallpaper') {
        push('warn', 'wallpaper-strip', 'Strip the existing covering before hanging new paper.', 'Paper over paper traps old paste and fails at the seams.');
    }

    if (['panel', 'siding'].includes(covering.family) && !config.acclimated) {
        push('info', 'acclimation', 'Acclimate the boards before fixing.', '48–72 hours in the room or on site; timber moves after it is fixed.');
    }

    if (!interior) {
        if (covering.requiresWrb && !config.wrb) {
            push('error', 'wrb', 'A water-resistive barrier is required behind exterior cladding.', 'IRC R703.2: one continuous layer over studs or sheathing, lapped and flashed.');
        } else if (covering.requiresWrb) {
            push('ok', 'wrb', 'Water-resistive barrier included behind the cladding.');
        }
        if (covering.requiresDrainage && !config.rainScreen) {
            push('warn', 'drainage', 'No drainage cavity behind the cladding.', 'IRC R703.1.1 requires a means to drain water that gets behind the cladding; a rainscreen does that.');
        }
        if (config.gradeClearanceMm < (covering.minGradeClearanceMm || 0)) {
            push('error', 'grade', `Cladding starts ${config.gradeClearanceMm} mm above grade; ${covering.minGradeClearanceMm} mm is required.`, 'Keep siding and stucco clear of soil, splash and snow; a weep screed drains the cavity.');
        } else if (covering.minGradeClearanceMm) {
            push('ok', 'grade', `${config.gradeClearanceMm} mm above grade meets the ${covering.minGradeClearanceMm} mm minimum.`);
        }
        if (!config.flashing) {
            push('warn', 'flashing', 'Flashing is switched off at openings and wall bases.', 'IRC R703.4: flash every opening, intersection and the wall base.');
        } else {
            push('ok', 'flashing', 'Flashing at openings, corners and the base.');
        }
        if (covering.id === 'vinyl-siding' && config.windMph > 110) {
            push('warn', 'wind', `${config.windMph} mph design wind exceeds typical vinyl siding ratings.`, 'IRC R703.1.2 requires the assembly to resist the design wind load (ASTM E330); check the manufacturer’s pressure rating.');
        }
        if (config.rainExpected) {
            push('warn', 'rain', 'Rain is expected during the application window.', 'Cover the wall or reschedule; wet substrate and rain on fresh film ruin the finish.');
        }
        if (covering.family === 'paint' && lrvOf(colour.hex) < 20) {
            push('info', 'dark-colour', `${colour.label} has an LRV of ${lrvOf(colour.hex)}.`, 'Dark exterior colours absorb heat and move more; check the siding manufacturer’s colour limits.');
        }
    }

    if (covering.family === 'paint' && config.trim) {
        if (scheme.contrast.trim < 25) {
            push('info', 'trim-contrast', `Trim and wall are only ${round(scheme.contrast.trim, 1)} LRV apart.`, 'A 25-point gap reads as a deliberate trim line; below that the trim disappears.');
        } else {
            push('ok', 'trim-contrast', `Trim is ${round(scheme.contrast.trim, 1)} LRV lighter than the wall.`);
        }
        if (scheme.contrast.accent < 10) {
            push('info', 'accent-contrast', 'The accent is close in value to the wall.', 'Use the accent on one plane or in a deeper tone so it reads.');
        }
    }

    push('info', 'life', `Expected service life ${covering.lifeYears} years; plan maintenance in ${covering.maintenanceYears}.`, `${covering.maintenanceYears}-year repaint cycle keeps the substrate dry.`);

    const summary = [
        `${net.toFixed(1)} m² net (${gross.toFixed(1)} gross − ${openings.toFixed(1)} openings)`,
        `${covering.label} · ${coats} coat${coats === 1 ? '' : 's'} · ${substrate.label}`,
        paint
            ? `${paint.litres} L finish + ${paint.primerLitres} L primer · ${paint.cans} finish cans`
            : `${rows.reduce((sum, row) => sum + row.qty, 0)} packs · ${rows.length} material lines`,
        `$${material.toFixed(0)} material + $${labour.toFixed(0)} labour = $${total.toFixed(0)}`,
        `${checks.filter((check) => check.severity === 'error').length} errors · ${checks.filter((check) => check.severity === 'warn').length} warnings`,
        `${covering.lifeYears}-year life · ${covering.maintenanceYears}-year maintenance`,
        `${colour.label} wall · ${scheme.trim.label} trim · ${scheme.accent.label} accent`
    ];

    return {
        config,
        covering,
        substrate,
        sheen,
        colour,
        scheme,
        areas: {
            gross,
            openings,
            net,
            perimeter,
            length,
            height,
            coats,
            waste,
            wasteArea: round(net * waste, 2),
            netWithWaste: round(net * (1 + waste), 2)
        },
        paint,
        rows,
        prep,
        prepHours,
        drying: {
            recoatHours: covering.recoatHours,
            cureDays: covering.cureDays,
            readyDays: Math.max(covering.cureDays, Math.ceil(covering.recoatHours / 24))
        },
        costs,
        checks,
        summary
    };
}

/** Rows for the on-page takeoff table. */
export function takeoffRows(design) {
    return design?.rows || [];
}

export function wallSummary(design) {
    return design?.summary || [];
}

export function wallTakeoffCsv(design) {
    if (!design) return '';
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [['group', 'item', 'qty', 'unit', 'cost'].map(quote).join(',')];
    design.rows.forEach((row) => {
        lines.push([row.group, row.item, row.qty, row.packLabel || row.unit, row.cost].map(quote).join(','));
    });
    lines.push('');
    lines.push(['Summary', 'Covering', design.covering.label, '', ''].map(quote).join(','));
    lines.push(['Summary', 'Net area', design.areas.net, 'm²', ''].map(quote).join(','));
    lines.push(['Summary', 'Coats', design.areas.coats, '', ''].map(quote).join(','));
    lines.push(['Summary', 'Material', design.costs.material, 'USD', ''].map(quote).join(','));
    lines.push(['Summary', 'Labour', design.costs.labour, 'USD', ''].map(quote).join(','));
    lines.push(['Summary', 'Total', design.costs.total, 'USD', ''].map(quote).join(','));
    return lines.join('\n');
}
