import {
    ROOF_STYLES,
    roofStyle,
    roofGeometry,
    trussMembers,
    eaveSegments,
    ridgeSegments,
    hipSegments
} from './styles.js';
import {
    SQUARE_M2,
    SHEET_M2,
    SHEATHING,
    UNDERLAYMENT,
    COVERINGS,
    GUTTER_SYSTEMS,
    FLASHING,
    LABOUR,
    sheathingById,
    underlaymentById,
    coveringById,
    gutterById
} from './materials.js';

/**
 * Roof design engine.
 *
 * One call turns a style plus a handful of numbers into the geometry, every
 * layer's takeoff, the rain-gutter package, a costed bill and the code-style
 * checks the suite reports. The designer page, the editor roof and the tests
 * all consume this object, so the drawing, the quantities and the price agree.
 */

export const ROOF_DEFAULTS = {
    style: 'gable-king',
    span: 10,
    length: 14,
    pitch: 6,
    overhang: 0.5,
    eaveHeight: 2.7,
    spacing: 0.61,
    sheathing: 'osb-716',
    underlayment: 'synthetic',
    covering: 'asphalt-arch',
    gutter: 'k5-alum',
    gutters: true,
    iceShield: true,
    ridgeVent: true,
    soffitVent: true,
    downspouts: null,
    waste: 0.1,
    climate: 'moderate',
    chimney: false,
    pipeVents: 2,
    tearOff: false
};

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const ceil = (value) => Math.ceil(Math.max(value, 0) - 1e-9);

/** Gable, saltbox, gambrel and shed planes each end in two rake edges. */
function coveringUnitLabel(covering) {
    if (covering.family === 'shingle') return 'bundle';
    if (covering.family === 'tile') return covering.unit;
    if (covering.family === 'metal') return 'square';
    return covering.unit;
}

export function computeRoofDesign(options = {}) {
    const config = { ...ROOF_DEFAULTS, ...options };
    const definition = roofStyle(config.style);
    const geometry = roofGeometry({
        style: definition.key,
        span: config.span,
        length: config.length,
        pitch: config.pitch,
        overhang: config.overhang
    });

    const sheathing = sheathingById(config.sheathing);
    const underlayment = underlaymentById(config.underlayment);
    const covering = coveringById(config.covering);
    const gutter = gutterById(config.gutter);
    const spacing = Math.min(Math.max(Number(config.spacing) || 0.61, 0.3), 1.2);
    const waste = Math.min(Math.max(Number(config.waste) || 0, 0), 0.4);

    const area = geometry.roofArea;
    const squares = area / SQUARE_M2;
    const squaresWithWaste = squares * (1 + waste);
    const planArea = geometry.footprintArea;

    // --- Deck and underlayment -------------------------------------
    const sheets = ceil((area * (1 + waste)) / SHEET_M2);
    const underlayRolls = ceil((area * 1.05) / underlayment.rollCoverageM2);
    const iceShieldM2 = config.iceShield
        ? geometry.eaveLength * Math.min(0.9, geometry.slopeLength)
        : 0;
    const iceShieldRolls = iceShieldM2 > 0
        ? ceil(iceShieldM2 / 18.6)
        : 0;

    // --- Covering ---------------------------------------------------
    const coveringUnits = ceil(squaresWithWaste * covering.unitsPerSquare);
    const starterLf = covering.family === 'shingle' ? geometry.eaveLength : 0;
    const starterUnits = covering.starterLfPerUnit
        ? ceil(starterLf / covering.starterLfPerUnit)
        : 0;
    const ridgeCapLf = geometry.ridgeLength + geometry.hipLength;
    let ridgeCapUnits = 0;
    let ridgeCapUnit = '';
    let ridgeCapUnitCost = 0;
    if (covering.ridgeCapLfPerUnit) {
        ridgeCapUnits = ceil(ridgeCapLf / covering.ridgeCapLfPerUnit);
        ridgeCapUnit = 'bundle';
        ridgeCapUnitCost = 58;
    } else if (covering.family === 'tile') {
        ridgeCapUnits = ceil(ridgeCapLf / 0.45);
        ridgeCapUnit = 'piece';
        ridgeCapUnitCost = 13;
    } else if (covering.family === 'metal') {
        ridgeCapUnits = ridgeCapLf;
        ridgeCapUnit = 'm';
        ridgeCapUnitCost = 22;
    }

    // --- Trusses and lumber -----------------------------------------
    const members = trussMembers(definition.key, geometry);
    const memberLength = members.reduce(
        (total, member) => total + Math.hypot(member.x2 - member.x1, member.y2 - member.y1),
        0
    );
    const mainTrusses = ceil(geometry.length / spacing) + 1;
    const crossTrusses = definition.family === 'cross'
        ? ceil((geometry.span * 0.9) / spacing) + 1
        : 0;
    const trussCount = mainTrusses + crossTrusses;
    const trussLumberM = memberLength * trussCount;
    const ceilingJoists = trussCount;
    const trussUnitCost = round(38 + geometry.span * 9.5 + (definition.family === 'hip' ? 12 : 0), 2);

    // --- Gutters and rain water -------------------------------------
    const eaveRuns = eaveSegments(geometry);
    const gutterLf = config.gutters ? geometry.eaveLength : 0;
    const areaPerDownspout = gutter.maxRoofAreaM2;
    const autoDownspouts = Math.max(
        2,
        ceil(gutterLf / 12),
        ceil(area / areaPerDownspout)
    );
    const downspouts = config.downspouts == null
        ? (config.gutters ? autoDownspouts : 0)
        : Math.max(0, Math.round(Number(config.downspouts)));
    const hangers = config.gutters ? ceil(gutterLf / gutter.hangerSpacingM) : 0;
    const endCaps = config.gutters
        ? (definition.family === 'hip' ? 0 : eaveRuns.length * 2)
        : 0;
    const outlets = downspouts;
    const elbows = downspouts * 2;

    // --- Flashing and ventilation -----------------------------------
    const dripEdgeM = geometry.eaveLength + geometry.rakeLength;
    const valleyM = geometry.valleyLength;
    const stepM = config.chimney ? 4 : 0;
    const apronM = config.chimney ? 2.4 : 0;
    const counterM = config.chimney ? 2.4 : 0;
    const kickouts = definition.family === 'cross' ? 2 : 0;
    const crickets = config.chimney ? 1 : 0;
    const pipeBoots = Math.max(0, Math.round(Number(config.pipeVents) || 0));
    const gutterApronM = config.gutters ? geometry.eaveLength : 0;
    const ridgeVentM = config.ridgeVent ? geometry.ridgeLength : 0;
    const soffitVentM = config.soffitVent ? geometry.eaveLength : 0;
    const requiredNfvaM2 = area / 300;
    const providedNfvaM2 = ridgeVentM * 0.025 + soffitVentM * 0.02;

    // --- Bill -------------------------------------------------------
    const rows = [];
    const add = (group, item, qty, unit, unitCost, note = '') => {
        if (!(qty > 0)) return;
        rows.push({ group, item, qty: round(qty, 2), unit, unitCost: round(unitCost, 2), cost: round(qty * unitCost, 2), note });
    };

    add('Deck', `${sheathing.label} sheets`, sheets, 'sheet', sheathing.costPerSheet);
    add('Deck', 'Sheathing nails / clips', sheets, 'sheet', 3.2);
    add('Deck', `${underlayment.label} rolls`, underlayRolls, 'roll', underlayment.costPerRoll);
    add('Deck', 'Ice & water shield', iceShieldM2, 'm²', FLASHING.iceShieldPerM2);
    add('Deck', 'Ice & water shield rolls', iceShieldRolls, 'roll', 145);

    add('Covering', `${covering.label}`, coveringUnits, coveringUnitLabel(covering), covering.costPerSquare / (covering.unitsPerSquare || 1));
    if (starterUnits) add('Covering', 'Starter strip', starterUnits, 'bundle', 48);
    if (ridgeCapUnits) add('Covering', 'Ridge and hip cap', ridgeCapUnits, ridgeCapUnit, ridgeCapUnitCost);
    if (covering.family === 'metal') add('Covering', 'Closures and fasteners', area, 'm²', 6);
    if (config.chimney) add('Covering', 'Chimney cricket', crickets, 'each', FLASHING.cricketEach);

    add('Flashing', 'Drip edge (eave and rake)', dripEdgeM, 'm', FLASHING.dripEdgePerM);
    add('Flashing', 'Valley metal', valleyM, 'm', FLASHING.valleyPerM);
    add('Flashing', 'Step flashing', stepM, 'm', FLASHING.stepPerM);
    add('Flashing', 'Apron flashing', apronM, 'm', FLASHING.apronPerM);
    add('Flashing', 'Counter flashing', counterM, 'm', FLASHING.counterPerM);
    add('Flashing', 'Kickout flashing', kickouts, 'each', FLASHING.kickoutEach);
    add('Flashing', 'Pipe vent boots', pipeBoots, 'each', FLASHING.pipeBootEach);
    add('Flashing', 'Gutter apron', gutterApronM, 'm', FLASHING.gutterApronPerM);

    if (config.gutters) {
        add('Gutter', `${gutter.label} run`, gutterLf, 'm', gutter.costPerLf);
        add('Gutter', `Downspouts (${gutter.downspout})`, downspouts, 'each', gutter.downspoutCostEach);
        add('Gutter', 'Hangers', hangers, 'each', 1.8);
        add('Gutter', 'End caps', endCaps, 'each', 3.5);
        add('Gutter', 'Outlets', outlets, 'each', 4.5);
        add('Gutter', 'Downspout elbows', elbows, 'each', 5);
    }

    add('Structure', 'Roof trusses', trussCount, 'truss', trussUnitCost);
    add('Structure', 'Truss lumber (2 × 4 equivalent)', trussLumberM, 'm', 4.6);
    add('Structure', 'Ceiling joists', ceilingJoists, 'joist', 12);

    if (ridgeVentM) add('Ventilation', 'Ridge vent', ridgeVentM, 'm', FLASHING.ridgeVentPerM);
    if (soffitVentM) add('Ventilation', 'Soffit vent strip', soffitVentM, 'm', FLASHING.soffitVentPerM);

    const materialCost = rows.reduce((total, row) => total + row.cost, 0);
    const tearOff = config.tearOff ? squares * LABOUR.tearOffPerSquare : 0;
    const install = squaresWithWaste * LABOUR.installPerSquare;
    const gutterLabour = config.gutters ? gutterLf * LABOUR.gutterPerLf : 0;
    const flashingLabour = (dripEdgeM + valleyM + stepM + apronM + counterM) * LABOUR.flashingPerM;
    const labourCost = round(tearOff + install + gutterLabour + flashingLabour, 2);
    const totalCost = round(materialCost + labourCost, 2);

    const costs = {
        material: round(materialCost, 2),
        labour: labourCost,
        tearOff: round(tearOff, 2),
        install: round(install, 2),
        gutter: round(gutterLabour, 2),
        flashing: round(flashingLabour, 2),
        total: totalCost,
        perSquare: squares > 0 ? round(totalCost / squares, 2) : 0,
        perM2: area > 0 ? round(totalCost / area, 2) : 0,
        rows
    };

    const checks = buildChecks({
        config,
        definition,
        geometry,
        covering,
        underlayment,
        sheathing,
        gutter,
        spacing,
        area,
        downspouts,
        requiredNfvaM2,
        providedNfvaM2,
        valleyM,
        ridgeVentM,
        soffitVentM,
        iceShieldM2,
        sheets
    });

    const summary = {
        style: definition.key,
        styleName: definition.name,
        squares: round(squares, 2),
        sheets,
        underlayRolls,
        coveringUnits,
        ridgeCapLf: round(ridgeCapLf, 1),
        gutterLf: round(gutterLf, 1),
        downspouts,
        trusses: trussCount,
        totalCost,
        checks: {
            errors: checks.filter((check) => check.severity === 'error').length,
            warnings: checks.filter((check) => check.severity === 'warn').length
        }
    };

    return {
        config,
        style: definition,
        styles: ROOF_STYLES,
        geometry,
        sheathing,
        underlayment,
        covering,
        gutter,
        spacing,
        waste,
        members,
        trussCount,
        ceilingJoists,
        trussLumberM: round(trussLumberM, 1),
        eaveRuns,
        ridgeRuns: ridgeSegments(geometry),
        hipRuns: hipSegments(geometry),
        areas: {
            roof: round(area, 2),
            plan: round(planArea, 2),
            squares: round(squares, 2),
            squaresWithWaste: round(squaresWithWaste, 2),
            iceShield: round(iceShieldM2, 2),
            vents: round(providedNfvaM2, 3),
            requiredVents: round(requiredNfvaM2, 3)
        },
        layers: {
            sheets,
            underlayRolls,
            iceShieldRolls,
            coveringUnits,
            coveringUnit: coveringUnitLabel(covering),
            starterLf: round(starterLf, 1),
            starterUnits,
            ridgeCapLf: round(ridgeCapLf, 1),
            ridgeCapUnits,
            dripEdgeM: round(dripEdgeM, 1),
            valleyM: round(valleyM, 1),
            stepM,
            apronM,
            counterM,
            kickouts,
            pipeBoots
        },
        gutterPackage: {
            gutterLf: round(gutterLf, 1),
            downspouts,
            hangers,
            endCaps,
            outlets,
            elbows,
            areaPerDownspout: downspouts > 0 ? round(area / downspouts, 1) : null
        },
        ventilation: {
            ridgeVentM: round(ridgeVentM, 1),
            soffitVentM: round(soffitVentM, 1),
            providedNfvaM2: round(providedNfvaM2, 3),
            requiredNfvaM2: round(requiredNfvaM2, 3)
        },
        costs,
        checks,
        summary
    };
}

function buildChecks({
    config,
    definition,
    geometry,
    covering,
    underlayment,
    sheathing,
    gutter,
    spacing,
    area,
    downspouts,
    requiredNfvaM2,
    providedNfvaM2,
    valleyM,
    ridgeVentM,
    soffitVentM,
    iceShieldM2,
    sheets
}) {
    const checks = [];
    const push = (id, severity, label, detail = '') => checks.push({ id, severity, label, detail });

    const pitch = geometry.pitch;
    if (pitch < covering.minPitch) {
        push('pitch-covering', 'error', 'Pitch below the covering minimum',
            `${covering.label} needs at least ${covering.minPitch}:12; this roof is ${round(pitch, 2)}:12.`);
    } else if (pitch > covering.maxPitch) {
        push('pitch-max', 'warn', 'Pitch above the covering maximum',
            `${covering.label} is rated to ${covering.maxPitch}:12; consider a steeper-rated product.`);
    } else {
        push('pitch-covering', 'ok', 'Pitch suits the covering',
            `${round(pitch, 2)}:12 (${round(geometry.angle, 1)}°) is inside ${covering.minPitch}–${covering.maxPitch}:12.`);
    }

    if (pitch < definition.minPitch) {
        push('pitch-style', 'warn', 'Style prefers a steeper pitch',
            `${definition.name} is usually built at ${definition.minPitch}:12 or steeper.`);
    }

    if (pitch < 2) {
        push('low-slope', 'warn', 'Low-slope roof',
            'Below 2:12 the roof needs a low-slope system and continuous membrane detailing.');
    }
    if (pitch < 0.25) {
        push('ponding', 'error', 'Ponding risk', 'A pitch below 0.25:12 will hold water; add tapered insulation or drains.');
    }

    push('deck', 'ok', 'Deck and sheathing',
        `${sheets} sheets of ${sheathing.label} at ${sheathing.nailSpacingMm} mm nail spacing.`);

    if (covering.weightKgM2 >= 40) {
        push('dead-load', covering.weightKgM2 >= 55 ? 'warn' : 'info',
            'Heavy covering',
            `${covering.label} adds ${covering.weightKgM2} kg/m²; confirm the truss design and use battens.`);
    } else {
        push('dead-load', 'ok', 'Dead load',
            `${covering.label} adds ${covering.weightKgM2} kg/m², inside the standard truss allowance.`);
    }

    if (spacing > 0.45 && covering.family === 'tile') {
        push('truss-spacing', 'error', 'Tile needs tighter truss spacing',
            `Tile at ${Math.round(spacing * 1000)} mm o.c. over ${sheathing.label} is too flexible; use 16 in o.c. (406 mm) or a thicker deck.`);
    } else {
        push('truss-spacing', 'info', 'Truss spacing',
            `${round(spacing * 1000)} mm o.c. with ${sheathing.label} and ${covering.label}.`);
    }

    if (config.climate === 'cold' && !config.iceShield) {
        push('ice-dam', 'error', 'Ice dam protection missing',
            'Cold climates need an ice and water shield at least 900 mm up from the eave.');
    } else if (config.iceShield) {
        push('ice-dam', 'ok', 'Ice and water shield',
            `${round(iceShieldM2, 1)} m² of self-adhering membrane at the eaves.`);
    } else {
        push('ice-dam', 'info', 'No eave membrane', 'Eaves rely on the underlayment and a clean drip edge.');
    }

    if (!ridgeVentM && !soffitVentM) {
        push('ventilation', 'warn', 'No attic ventilation', 'Add soffit and ridge vents, or another balanced intake/exhaust pair.');
    } else if (!ridgeVentM || !soffitVentM) {
        push('ventilation', 'warn', 'Ventilation is one-sided', 'Balance an intake (soffit) with an exhaust (ridge or box vent).');
    } else if (providedNfvaM2 < requiredNfvaM2) {
        push('ventilation', 'warn', 'Vent area below 1:300',
            `${round(providedNfvaM2, 2)} m² provided against ${round(requiredNfvaM2, 2)} m² required.`);
    } else {
        push('ventilation', 'ok', 'Attic ventilation', `${round(providedNfvaM2, 2)} m² free area against ${round(requiredNfvaM2, 2)} m² required.`);
    }

    if (config.gutters) {
        if (downspouts > 0 && area / downspouts > gutter.maxRoofAreaM2) {
            push('gutter-capacity', 'warn', 'Downspouts under capacity',
                `${round(area / downspouts, 1)} m² per downspout; ${gutter.label} handles ${gutter.maxRoofAreaM2} m² each.`);
        } else if (downspouts > 0) {
            push('gutter-capacity', 'ok', 'Gutter capacity',
                `${downspouts} downspouts at ${round(area / downspouts, 1)} m² each, limit ${gutter.maxRoofAreaM2} m².`);
        } else {
            push('gutter-capacity', 'warn', 'No downspouts', 'A gutter run needs at least two outlets.');
        }
    } else {
        push('gutter', 'info', 'No gutter package', 'Rain water falls directly at the eave.');
    }

    if (underlayment.minPitch > pitch) {
        push('underlayment', 'warn', 'Underlayment below its slope minimum',
            `${underlayment.label} is rated from ${underlayment.minPitch}:12.`);
    } else {
        push('underlayment', 'ok', 'Underlayment suits the slope',
            `${underlayment.label} covers ${underlayment.rollCoverageM2} m² per roll from ${underlayment.minPitch}:12.`);
    }

    if (valleyM > 0) {
        push('valley', 'info', 'Valleys counted', `${round(valleyM, 1)} m of valley metal and two kickout flashings.`);
    }
    if (config.chimney) {
        push('chimney', 'info', 'Chimney flashing', 'Apron, step, counter flashing and a cricket are in the takeoff.');
    }

    if (config.climate === 'hail' && covering.family === 'shingle') {
        push('hail', 'info', 'Hail climate', 'Specify impact-resistant shingles (Class 4) and check the insurer’s RCV conditions.');
    }

    if (geometry.overhang > 0.9) {
        push('overhang', 'warn', 'Deep overhang', 'Overhangs beyond 900 mm need extra blocking or cantilevered lookouts.');
    }

    if (config.waste < 0.05) {
        push('waste', 'warn', 'Low waste allowance', 'Under 5% rarely covers hips, valleys and breakage.');
    } else if (config.waste > 0.25) {
        push('waste', 'warn', 'High waste allowance', 'Over 25% waste usually signals a plan or ordering error.');
    }

    push('warranty', 'info', 'Warranty', `${covering.warranty}; keep the manufacturer’s ventilation and fastening conditions.`);
    return checks;
}

/** Rows for the takeoff table and the CSV export. */
export function takeoffRows(design) {
    return design.costs.rows.map((row) => ({ ...row }));
}

export function roofTakeoffCsv(design) {
    const header = '"group","item","qty","unit","unit cost","cost","note"';
    const body = takeoffRows(design).map((row) => [
        row.group, row.item, row.qty, row.unit, row.unitCost, row.cost, row.note
    ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','));
    const summary = [
        `"Summary","Style","${design.style.name}","","","",""`,
        `"Summary","Roof area (m²)","${design.areas.roof}","","","",""`,
        `"Summary","Squares","${design.areas.squares}","","","",""`,
        `"Summary","Material","${design.costs.material}","","","",""`,
        `"Summary","Labour","${design.costs.labour}","","","",""`,
        `"Summary","Total","${design.costs.total}","","","",""`
    ];
    return [header, ...body, ...summary].join('\n');
}

export function roofSummary(design) {
    if (!design) return [];
    return [
        `${design.style.name} · ${round(design.geometry.pitch, 1)}:12`,
        `Roof ${round(design.areas.roof, 1)} m² · ${design.areas.squares} squares`,
        `${design.layers.coveringUnits} ${design.layers.coveringUnit}s of ${design.covering.label}`,
        `${design.layers.sheets} sheets · ${design.layers.underlayRolls} underlayment rolls`,
        `${design.trussCount} trusses · ${design.spacing * 1000} mm o.c.`,
        design.config.gutters
            ? `${design.gutterPackage.gutterLf} m gutter · ${design.gutterPackage.downspouts} downspouts`
            : 'No gutters',
        `Estimate $${design.costs.total.toFixed(0)} · $${design.costs.perSquare.toFixed(2)}/square`
    ];
}

export { ROOF_STYLES };
