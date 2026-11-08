// The bridge between this studio and floorplan_3d's calculation engines.
//
// The engines are vendored verbatim under static/engines/ (same relative layout as
// their source tree, so not one import had to be rewritten): framing with real
// span and height tables, the deck engine with NDS bending and deflection, the
// roof designer, the NEC demand engine, the fixture-unit plumbing engine, the
// photometry module and the wall covering catalogue. Each screen used to
// approximate its system in a dozen lines; it now computes with these.
//
// Every function takes the plan the extractor built (metres) plus the screen's
// inputs, and returns the `{ cards, rows }` the studio renders.

import { computeFramingDesign } from './engines/features/framing/engine.js';
import { STUD_SIZES, STUD_SPACINGS_IN } from './engines/features/framing/catalog.js';
import { computeDeckDesign } from './engines/features/deck/engine.js';
import { DECK_DEFAULTS } from './engines/features/deck/engine.js';
import { computeRoofDesign, takeoffRows as roofTakeoffRows } from './engines/features/roof/design.js';
import { computeElectricalDesign } from './engines/features/electrical/engine.js';
import { ELECTRICAL_DEFAULTS } from './engines/features/electrical/catalog.js';
import { designPlumbing } from './engines/features/plumbing/engine.js';
import { createPlan as createPlumbingPlan, normalizePlan as normalizePlumbingPlan } from './engines/features/plumbing/plan.js';
import { FIXTURE_TYPES } from './engines/features/plumbing/catalog.js';
import {
  roomIndex,
  coefficientOfUtilization,
  spacingFor,
  DEFAULT_LLF,
} from './engines/features/lighting/photometry.js';
import {
  LUMINAIRES,
  luminaireById,
  roomPresetById,
  ROOM_PRESETS,
} from './engines/features/lighting/catalog.js';
import {
  WALL_COVERINGS,
  coveringById,
  coveringOptions,
  defaultCoveringFor,
  PAINT_SHEENS,
} from './engines/features/wall/materials.js';
import { RULES as FRAMING_RULES, searchRules as searchFramingRules } from './engines/features/framing/rules.js';
import { RULES as DECK_RULES, searchRules as searchDeckRules } from './engines/features/deck/rules.js';
import { RULES as LIGHTING_RULES, searchRules as searchLightingRules } from './engines/features/lighting/rules.js';
import { RULES as PLUMBING_RULES, searchRules as searchPlumbingRules } from './engines/features/plumbing/rules.js';
import { RULES as ELECTRICAL_RULES, searchRules as searchElectricalRules } from './engines/features/electrical/rules.js';
import { KITCHEN_RULES } from './engines/features/kitchen/rules.js';
import { RULES as LANDSCAPE_RULES, searchRules as searchLandscapeRules } from './engines/features/landscape/rules.js';

const f = (value, digits = 2) => (Number.isFinite(Number(value)) ? Number(value) : 0).toFixed(digits);
const n = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const money = (value) => `$${Math.round(n(value)).toLocaleString('en-US')}`;
// An engine merges its config over its defaults, so an explicit `undefined`
// overwrites a default with nothing. Only pass what the screen really set.
const defined = (config) => Object.fromEntries(
  Object.entries(config).filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, typeof value === 'number' && Number.isNaN(value) ? undefined : value])
    .filter(([, value]) => value !== undefined),
);
const count = (value) => (Array.isArray(value) ? value.length : text(value));
const text = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return value.size ?? value.label ?? value.id ?? '';
  return String(value);
};
const issues = (checks = []) =>
  checks.filter((check) => check.severity === 'error' || check.severity === 'warn');

/** The detected walls, as the engines want them: metres, centre lines. */
function planWalls(plan) {
  return (plan?.walls ?? [])
    .filter((wall) => [wall.x1, wall.y1, wall.x2, wall.y2].every((v) => Number.isFinite(Number(v))))
    .map((wall) => ({ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }));
}

const footprint = (plan) => ({
  width: n(plan?.widthM, 9) || 9,
  depth: n(plan?.depthM, 7) || 7,
});

// ---- framing ---------------------------------------------------------------

export const framingCatalog = { studSizes: STUD_SIZES, spacingsIn: STUD_SPACINGS_IN };

/**
 * Frame the detected plan: every wall run is framed member by member, with kings,
 * jacks, a sized header and cripples at each opening, then priced.
 */
export function framingResult(plan, v = {}) {
  const walls = planWalls(plan);
  const design = computeFramingDesign(defined({
    species: v.species,
    studSize: v.studSize,
    studSpacingIn: n(v.spacingIn, 16),
    storeys: [{ id: 'storey-1', name: 'Ground floor', floor: true, walls }],
  }));
  const m = design.metrics;
  const flagged = issues(design.checks);
  const bomRows = (design.bom?.rows ?? []).slice(0, 8);
  return {
    cards: [
      [m.studs, 'studs', `${f(m.linearM, 1)} m of wall`],
      [m.sheets, 'sheets', 'sheathing and subfloor'],
      [money(m.total), 'framed', `${money(m.material)} material`],
    ],
    rows: [
      ['Walls framed', m.walls, 'ea'],
      ['Wall length', f(m.linearM, 2), 'm'],
      ['Studs, kings, jacks, cripples', m.studs, 'ea'],
      ['Sheathing and subfloor', m.sheets, 'sheets'],
      ['Floor platform', f(m.floorAreaM2, 2), 'm²'],
      ['Board feet', m.boardFeet, 'bf'],
      ['Material', money(m.material), ''],
      ['Labour', money(m.labour), ''],
      ['Total', money(m.total), ''],
      ...bomRows.map((row) => [row.item, row.qty, row.unit]),
      ...flagged.slice(0, 6).map((check) => [check.label, check.message || check.detail || '', check.severity]),
    ],
  };
}

// ---- deck ------------------------------------------------------------------

export const deckDefaults = DECK_DEFAULTS;

/** Size and price a deck: joists, beam, posts and footings by NDS and IRC R507. */
export function deckResult(plan, v = {}) {
  const { width, depth } = footprint(plan);
  const design = computeDeckDesign(defined({
    shape: v.shape,
    width: n(v.width, width),
    depth: n(v.depth, depth),
    joistSize: v.joistSize,
    joistSpacingIn: n(v.spacingIn, 16),
    species: v.species,
    decking: v.decking,
    guard: v.guard,
    stairs: n(v.stairs, 0),
    cover: v.cover,
    waste: n(v.waste, 8) / 100,
  }));
  const a = design.areas;
  const flagged = issues(design.checks);
  const bom = design.bom ?? {};
  return {
    cards: [
      [`${f(a.deckM2, 1)} m²`, 'deck', `${f(a.perimeterM, 1)} m perimeter`],
      [`${text(design.joist.size)} @ ${design.joist.spacingIn} in`, 'joists', `${f(design.joist.spanM, 2)} m span`],
      [money(bom.total), 'cost', `${money(design.costPerSqm)}/m²`],
    ],
    rows: [
      ['Deck area', f(a.deckM2), 'm²'],
      ['Perimeter', f(a.perimeterM), 'm'],
      ['Guard length', f(a.guardLengthM), 'm'],
      ['Joists', `${design.joist.count} × ${text(design.joist.size)}`, `${f(design.joist.lengthM, 2)} m`],
      ['Joist span', f(design.joist.spanM), `${text(design.joist.governing) || 'bending'} governed`],
      ['Beam', `${count(design.beam.lines)} × ${design.beam.plies} ply ${text(design.beam.size)}`, ''],
      ['Posts', `${design.post.count} × ${text(design.post.size)}`, `${f(design.post.heightM, 2)} m`],
      ['Footings', `${design.footing.count} × ${design.footing.diameterIn} in`, `${f(design.footing.volumeM3, 2)} m³`],
      ['Decking boards', design.decking.boards, 'ea'],
      ['Guard system', text(design.guard.system?.label ?? design.guard.system), `${f(design.guard.heightIn, 0)} in`],
      ['Stair risers', design.stair?.risers ?? 0, 'ea'],
      ['Material', money(bom.material), ''],
      ['Labour', money(bom.labour), ''],
      ['Total', money(bom.total), ''],
      ...flagged.slice(0, 6).map((check) => [check.label, check.message || '', check.severity]),
    ],
  };
}

// ---- roof ------------------------------------------------------------------

/** Roof geometry, every layer's takeoff and the rain-gutter package. */
export function roofResult(plan, v = {}) {
  const { width, depth } = footprint(plan);
  const design = computeRoofDesign(defined({
    style: v.style,
    span: n(v.span, width),
    length: n(v.length, depth),
    pitch: n(v.pitch, 6),
    overhang: n(v.overhang, 0.45),
    covering: v.covering,
    gutter: v.gutter,
    waste: n(v.waste, 10) / 100,
  }));
  const summary = design.summary ?? {};
  const costs = design.costs ?? {};
  const flagged = issues(design.checks);
  return {
    cards: [
      [`${f(summary.squares, 1)} squares`, 'roof', `${f(design.areas?.roof, 1)} m²`],
      [summary.sheets, 'deck sheets', `${summary.underlayRolls} rolls underlay`],
      [money(summary.totalCost), 'roofed', `${money(costs.perSquare)}/square`],
    ],
    rows: [
      ['Style', summary.styleName || design.style, ''],
      ['Roof area', f(design.areas?.roof), 'm²'],
      ['Plan area', f(design.areas?.plan), 'm²'],
      ['Squares (with waste)', f(design.areas?.squaresWithWaste), 'sq'],
      ['Deck sheets', design.layers?.sheets ?? 0, 'sheet'],
      ['Underlayment', design.layers?.underlayRolls ?? 0, 'roll'],
      ['Covering', `${design.layers?.coveringUnits ?? 0} ${design.layers?.coveringUnit || 'unit'}`, ''],
      ['Ridge cap', f(design.layers?.ridgeCapLf), 'lf'],
      ['Drip edge', f(design.layers?.dripEdgeM), 'm'],
      ['Gutter', f(design.gutterPackage?.gutterLf), 'lf'],
      ['Downspouts', design.gutterPackage?.downspouts ?? 0, 'ea'],
      ['Ridge vent', f(design.ventilation?.ridgeVentM), 'm'],
      ['Material', money(costs.material), ''],
      ['Labour', money(costs.labour), ''],
      ['Total', money(costs.total), ''],
      ...roofTakeoffRows(design).slice(0, 6).map((row) => [row.item, row.qty, row.unit]),
      ...flagged.slice(0, 6).map((check) => [check.label, check.detail || check.message || '', check.severity]),
    ],
  };
}

// ---- electrical ------------------------------------------------------------

export const electricalDefaults = ELECTRICAL_DEFAULTS;

/** NEC 220 demand, service size, feeder, circuit list and panel bill. */
export function electricalResult(plan, v = {}) {
  const area = n(v.area, n(plan?.takeoff?.floorArea, ELECTRICAL_DEFAULTS.areaM2)) || ELECTRICAL_DEFAULTS.areaM2;
  const design = computeElectricalDesign(defined({
    areaM2: area,
    sabc: n(v.sabc, 2),
    laundry: n(v.laundry, 1),
    bathroom: n(v.bathroom, 2),
    method: v.method,
    ambientC: n(v.ambientC, 30),
  }));
  const general = design.general ?? {};
  const optional = design.optional ?? {};
  const bom = design.bom ?? {};
  const flagged = issues(design.checks);
  const circuits = design.circuits ?? [];
  return {
    cards: [
      [`${f(design.demandVa / 1000, 1)} kVA`, 'demand', `${f(design.demandAmps, 0)} A at 240 V`],
      [`${design.serviceAmps} A`, 'service', `${text(design.method)} method`],
      [`${circuits.length}`, 'circuits', typeof design.spaces === 'object' && design.spaces !== null
        ? `${design.spaces.used ?? ''}/${design.spaces.total ?? ''} spaces`
        : `${design.spaces ?? 0} spaces`],
    ],
    rows: [
      ['General lighting (3 VA/ft²)', general.va ?? 0, 'VA'],
      ['220.42 tiers', `${general.first ?? 0} + ${general.second ?? 0} + ${general.third ?? 0}`, 'VA'],
      ['Optional method (220.82)', optional.va ?? 0, 'VA'],
      ['Demand load', design.demandVa, 'VA'],
      ['Demand amps at 240 V', f(design.demandAmps, 0), 'A'],
      ['Service', `${design.serviceAmps} A`, `${design.mainBreaker} A main`],
      ['Panel', text(design.panel?.label), `${design.panel?.amps ?? 0} A`],
      ['Feeder', `${text(design.feeder?.size)} AWG`, `${f(design.feeder?.vdPercent, 2)} % drop`],
      ['Neutral', text(design.neutral), ''],
      ['Grounding electrode', text(design.gec), ''],
      ['Equipment ground', text(design.egc), ''],
      ['Circuit balance', `${f(design.balance?.percent, 1)} %`, ''],
      ['Material', money(bom.material), ''],
      ['Labour', money(bom.labour), ''],
      ['Total', money(bom.total), ''],
      ...circuits.slice(0, 6).map((circuit) => [`${circuit.label}`, `${circuit.breaker} A · ${circuit.conductor} AWG`, f(circuit.va, 0)]),
      ...flagged.slice(0, 6).map((check) => [check.label, check.message || '', check.severity]),
    ],
  };
}

// ---- plumbing --------------------------------------------------------------

export const plumbingFixtures = FIXTURE_TYPES;

/** Fixture units, water sizing, DWV sizing, gas load and the rough-in bill. */
export function plumbingResult(plan, v = {}) {
  const counts = {
    toilet: n(v.wc, 0),
    lavatory: n(v.lav, 0),
    bathtub: n(v.tub, 0),
    'kitchen-sink': n(v.sink, 0),
    dishwasher: n(v.dish, 0),
    'washing-machine': n(v.washer, 0),
    'hose-bib': n(v.bib, 0),
  };
  // The engine wants a laid-out plan, not loose fixtures: createPlan takes the
  // fixture type ids, places them in their zones and derives the hookups.
  const typeIds = [];
  for (const [type, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) typeIds.push(type);
  }
  const { width, depth } = footprint(plan);
  const layout = normalizePlumbingPlan(createPlumbingPlan({ width, depth, template: 'house', fixtures: typeIds }));
  const design = designPlumbing(layout);
  const summary = design.summary ?? {};
  const water = design.water ?? {};
  const drain = design.drain ?? {};
  const gas = design.gas ?? {};
  const takeoff = design.takeoff ?? {};
  const flagged = issues(design.checks);
  return {
    cards: [
      [`${f(summary.totalWsfu, 1)} WSFU`, 'supply', `${f(summary.demandGpm, 1)} gpm`],
      [`${summary.totalDfu ?? 0} DFU`, 'drainage', `${drain.mainSize ?? ''} in main`],
      [money(summary.total), 'rough-in', `${money(summary.rough)} rough`],
    ],
    rows: [
      ['Fixtures', summary.fixtureCount ?? 0, 'ea'],
      ['Cold / hot WSFU', `${f(water.coldWsfu, 1)} / ${f(water.hotWsfu, 1)}`, ''],
      ['Demand', f(water.demandGpm, 1), 'gpm'],
      ['Service size', `${water.serviceSize ?? ''} in`, `${f(water.serviceVelocity, 2)} fps`],
      ['Static at fixture', f(water.staticAtFixture, 1), 'psi'],
      ['Worst residual', f(water.residual, 1), 'psi'],
      ['Drainage units', summary.totalDfu ?? 0, 'DFU'],
      ['Building drain', `${drain.mainSize ?? ''} in`, `${f(drain.slope, 2)} in/ft`],
      ['Vents', drain.ventCount ?? 0, 'ea'],
      ['Gas load', `${f(gas.totalCfh, 0)} CFH`, `${gas.mainSize ?? ''} in`],
      ['Rough', money(summary.rough), ''],
      ['Finish', money(summary.finish), ''],
      ['Total', money(summary.total), ''],
      ...(takeoff.rows ?? []).slice(0, 6).map((row) => [row.label, row.qty, row.unit]),
      ...flagged.slice(0, 6).map((check) => [check.label, check.detail || '', check.severity]),
    ],
  };
}

// ---- lighting --------------------------------------------------------------

export const lightingCatalog = { luminaires: LUMINAIRES, presets: ROOM_PRESETS };

/**
 * The lumen method over the ported catalogue: room index and utilization from
 * the room's shape, then the fittings a target illuminance needs, their spacing
 * and the power density.
 */
export function lightingResult(v = {}) {
  const width = n(v.width, 5.5);
  const depth = n(v.depth, 4.2);
  const mount = n(v.mount, 2.4);
  const preset = roomPresetById(v.room);
  const luminaire = luminaireById(v.luminaire) ?? LUMINAIRES[0];
  const target = n(v.target, 0) > 0 ? n(v.target) : (preset?.targetLux ?? 200);
  const area = Math.max(width * depth, 0.1);
  const index = roomIndex(width, depth, mount);
  const cu = coefficientOfUtilization(index);
  const llf = n(v.llf, DEFAULT_LLF);
  const perFitting = luminaire.lumens * cu * llf;
  const required = perFitting > 0 ? Math.ceil((target * area) / perFitting) : 0;
  const achieved = required > 0 ? (required * perFitting) / area : 0;
  const watts = required * n(luminaire.watts, 0);
  const spacing = spacingFor(luminaire, mount);
  return {
    cards: [
      [required, 'fittings', `${luminaire.label}`],
      [`${f(achieved, 0)} lx`, 'achieved', `target ${f(target, 0)} lx`],
      [`${f(watts / area, 2)} W/m²`, 'power density', `${f(luminaire.efficacy, 0)} lm/W`],
    ],
    rows: [
      ['Room type', preset?.label ?? v.room ?? '', ''],
      ['Area', f(area), 'm²'],
      ['Room index', f(index), ''],
      ['Coefficient of utilization', f(cu), ''],
      ['Light loss factor', f(llf), ''],
      ['Target illuminance', f(target, 0), 'lx'],
      ['Luminaire', `${luminaire.label}`, `${luminaire.lumens} lm`],
      ['Required fittings', required, 'ea'],
      ['Achieved illuminance', f(achieved, 1), 'lx'],
      ['Maximum spacing', f(spacing, 2), 'm'],
      ['Connected load', f(watts, 0), 'W'],
      ['Efficacy', f(luminaire.efficacy, 1), 'lm/W'],
      ['Correlated colour temperature', `${luminaire.cct ?? preset?.cct ?? ''}`, 'K'],
    ],
  };
}

// ---- wall finishes ---------------------------------------------------------

export const finishCatalog = {
  coverings: WALL_COVERINGS,
  sheens: PAINT_SHEENS,
  interior: coveringOptions({ exposure: 'interior' }),
  exterior: coveringOptions({ exposure: 'exterior' }),
};

/** Covering quantities for a wall area: units, material, labour and coverage. */
export function finishResult(plan, v = {}) {
  const height = n(v.height, n(plan?.wallHeight, 2.7)) || 2.7;
  const length = n(v.length, n(plan?.takeoff?.wallLength, 40)) || 40;
  const openings = n(v.openings, 0) * 2.1;
  const area = Math.max(length * height - openings, 0);
  const covering = coveringById(v.covering) ?? defaultCoveringFor(v.exposure);
  const coverage = n(covering.coverage, 10) || 10;
  const waste = n(covering.waste, 0.1);
  const units = Math.ceil((area / coverage) * (1 + waste));
  const material = units * n(covering.costPerUnit, 0);
  const labour = area * n(covering.labourPerM2, 0);
  return {
    cards: [
      [f(area, 1), 'm² to finish', `${covering.label}`],
      [units, covering.unit, `${f(coverage, 1)} m² each`],
      [money(material + labour), 'finish', `${money(material)} material`],
    ],
    rows: [
      ['Covering', covering.label, ''],
      ['Family', covering.family ?? '', ''],
      ['Exposure', covering.exposure ?? '', ''],
      ['Sheen', covering.sheen ?? '', ''],
      ['Coats', covering.coats ?? 1, ''],
      ['Substrate', (covering.substrates ?? []).join(', '), ''],
      ['Net wall area', f(area), 'm²'],
      ['Coverage per unit', f(coverage), 'm²'],
      ['Units (with waste)', units, covering.unit],
      ['Material', money(material), ''],
      ['Labour', money(labour), ''],
      ['Total', money(material + labour), ''],
      ['Fire class', covering.fireClass ?? '', ''],
      ['Vapour class', covering.vapourClass ?? '', ''],
      ['Life', covering.lifeYears ?? '', 'years'],
      ['VOC', covering.vocGL ?? '', 'g/L'],
    ],
  };
}

// ---- code rules ------------------------------------------------------------

// The kitchen register ships without a search helper, so match the same fields
// the other libraries' searchRules does: the clause, the guideline and the
// engine checks the rule points at.
function searchKitchenRules(query = '') {
  const term = String(query).trim().toLowerCase();
  if (!term) return KITCHEN_RULES;
  return KITCHEN_RULES.filter((rule) => [
    rule.title, rule.code, rule.summary, rule.category, ...(rule.checkIds || []),
  ].join(' ').toLowerCase().includes(term));
}

const LIBRARIES = [
  { id: 'framing', label: 'Framing', rules: FRAMING_RULES, search: searchFramingRules },
  { id: 'deck', label: 'Deck', rules: DECK_RULES, search: searchDeckRules },
  { id: 'lighting', label: 'Lighting', rules: LIGHTING_RULES, search: searchLightingRules },
  { id: 'plumbing', label: 'Plumbing', rules: PLUMBING_RULES, search: searchPlumbingRules },
  { id: 'electrical', label: 'Electrical', rules: ELECTRICAL_RULES, search: searchElectricalRules },
  { id: 'kitchen', label: 'Kitchen', rules: KITCHEN_RULES, search: searchKitchenRules },
  { id: 'landscape', label: 'Landscape & water', rules: LANDSCAPE_RULES, search: searchLandscapeRules },
];

export const ruleLibraries = LIBRARIES.map(({ id, label, rules }) => ({ id, label, count: rules.length }));

/** The rule rows for one library, optionally narrowed by a search phrase. */
export function rulesFor(id, query = '') {
  const library = LIBRARIES.find((entry) => entry.id === id) ?? LIBRARIES[0];
  const found = query ? library.search(query) : library.rules;
  return found.slice(0, 80).map((rule) => ({
    id: rule.id,
    title: rule.title || rule.label || rule.name || rule.id,
    body: rule.summary || rule.detail || rule.text || rule.message || '',
    code: rule.code || rule.reference || rule.source || '',
    level: rule.level || rule.severity || rule.category || '',
  }));
}

export function ruleCount() {
  return LIBRARIES.reduce((total, library) => total + library.rules.length, 0);
}
