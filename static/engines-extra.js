// The rest of floorplan3d's engines, behind the same thin adapter the first
// batch uses (see engines-bridge.js): kitchen runs, water features, the
// cross-suite bid, the BIM schedule, the price book and the project roll-up.
//
// The engines are vendored verbatim under static/engines/; this file only turns
// their results into the `{ cards, rows }` the studio's screens render. Stairs
// live in stairs-bridge.js because their module graph reaches `three`, which
// only the browser's import map can resolve.

import { layoutKitchenRun } from './engines/features/kitchen/engine.js';
import { KITCHEN_DEFAULTS, KITCHEN_LINES, moduleById } from './engines/features/kitchen/catalog.js';
import { designLandscape } from './engines/features/landscape/engine.js';
import {
  WATER_FEATURE_TYPES,
  WATER_FEATURE_LABELS,
  POOL_SHAPES,
  POOL_SHAPE_LABELS,
} from './engines/features/landscape/design.js';
import { buildBid, bidChecks } from './engines/features/bid/engine.js';
import { collectPriceCatalog } from './engines/features/pricing/catalog.js';
import { bimTakeoff } from './engines/features/bim/takeoff.js';
import { computeFramingDesign } from './engines/features/framing/engine.js';
import { computeDeckDesign } from './engines/features/deck/engine.js';
import { computeRoofDesign, takeoffRows as roofTakeoffRows } from './engines/features/roof/design.js';
import { computeElectricalDesign } from './engines/features/electrical/engine.js';
import { designPlumbing } from './engines/features/plumbing/engine.js';
import {
  createPlan as createPlumbingPlan,
  normalizePlan as normalizePlumbingPlan,
} from './engines/features/plumbing/plan.js';

const n = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const f = (value, digits = 2) => n(value).toFixed(digits);
const money = (value) => `$${Math.round(n(value)).toLocaleString('en-US')}`;
const verdict = (severity) => (severity === 'error' ? 'fail' : severity === 'info' ? 'note' : 'warn');

// ---- kitchen ---------------------------------------------------------------

export const kitchenCatalog = {
  lines: Object.entries(KITCHEN_LINES).map(([id, line]) => [id, line.label ?? id]),
  modules: Object.fromEntries(KITCHEN_DEFAULTS.modules.map((id) => [id, moduleById(id)?.label ?? id])),
};

/**
 * Lay the six-module default run on the wall the plan measured, with the
 * engine's clearance rules, fillers and gap checks. The engine works in metres.
 */
export function kitchenResult(plan, v = {}) {
  const walls = plan?.walls ?? [];
  const longest = walls.reduce((max, wall) => Math.max(max, n(wall.length, 0)), 0) || KITCHEN_DEFAULTS.runLength;
  const design = layoutKitchenRun({
    length: n(v.run, longest),
    aisle: n(v.aisle, KITCHEN_DEFAULTS.aisle),
    line: v.line || KITCHEN_DEFAULTS.line,
    modules: KITCHEN_DEFAULTS.modules,
  });
  const t = design.totals;
  const byKind = (design.modules ?? []).reduce((counts, module) => {
    const kind = module.kind ?? 'other';
    counts[kind] = (counts[kind] ?? 0) + 1;
    return counts;
  }, {});
  return {
    cards: [
      [t.cabinets, 'cabinets', `${f(design.length, 2)} m run`],
      [f(t.used, 2), 'm used', `${design.gaps.length} gap${design.gaps.length === 1 ? '' : 's'}`],
      [`${design.score}`, 'layout score', `${f(t.leftover, 3)} m spare`],
    ],
    rows: [
      ['Run length', f(design.length, 2), 'm'],
      ['Cabinetry', f(t.cabinetWidth, 2), 'm'],
      ['Clearance between modules', f(t.clearance, 3), 'm'],
      ['Filler', f(t.filler, 3), 'm'],
      ['Spare or overflow', f(t.leftover, 3), 'm'],
      ...Object.entries(byKind).map(([kind, count]) => [`${kind} carcasses`, count, 'ea']),
      ...(design.modules ?? []).map((module) => [
        module.label || moduleById(module.id)?.label || module.id,
        `${f(module.width, 2)} × ${f(module.depth, 2)} × ${f(module.height, 2)}`,
        'W × D × H',
      ]),
      ...(design.fillers ?? []).map((filler) => [
        `Filler${filler.side ? ` · ${filler.side}` : ''}`,
        f(filler.width, 3),
        'm',
      ]),
      ...(design.gaps ?? []).map((gap) => [
        gap.kind === 'wall' ? `Wall to ${gap.before || 'cabinet'}` : `${gap.after} to ${gap.before}`,
        f(gap.width, 2),
        'm',
      ]),
      ...(design.checks ?? []).filter((check) => check.severity !== 'ok')
        .map((check) => [check.title || check.id, check.message, verdict(check.severity)]),
    ],
  };
}

// ---- landscape -------------------------------------------------------------

export const waterCatalog = {
  types: WATER_FEATURE_TYPES.map((id) => [id, WATER_FEATURE_LABELS[id] ?? id]),
  shapes: POOL_SHAPES.map((id) => [id, POOL_SHAPE_LABELS[id] ?? id]),
};

/**
 * A water feature from the same engine the landscape suite runs: geometry,
 * gallons, the hydraulic train, the barrier and the bill of materials.
 */
export function landscapeResult(plan, v = {}) {
  const design = designLandscape({
    type: WATER_FEATURE_TYPES.includes(v.type) ? v.type : 'pool',
    shape: POOL_SHAPES.includes(v.shape) ? v.shape : 'rectangle',
    width: n(v.width, 5.2),
    length: n(v.length, 9.5),
    shallow: n(v.shallow, 1.1),
    deep: n(v.deep, 1.7),
    deck: n(v.deck, 1.22),
    turnoverHours: n(v.turnover, 6),
    barrier: v.barrier !== 'no',
  });
  const m = design.metrics;
  return {
    cards: [
      [Math.round(m.gallons).toLocaleString('en-US'), 'US gallons', `${f(m.volumeM3, 1)} m³`],
      [`${f(m.flowGpm, 0)} gpm`, 'design flow', `${f(m.pumpHp, 2)} hp pump`],
      [money(design.cost.total), 'build', `${f(m.deckArea, 1)} m² deck`],
    ],
    rows: [
      ['Feature', `${design.typeLabel} · ${design.shapeLabel}`, ''],
      ['Surface area', f(m.area, 1), 'm²'],
      ['Volume', f(m.volumeM3, 1), 'm³'],
      ['Gallons', f(m.gallons, 0), 'gal'],
      ['Turnover', f(m.turnoverHours, 2), 'h'],
      ['Design flow', f(m.flowGpm, 1), 'gpm'],
      ['Total dynamic head', f(m.headFeet, 0), 'ft'],
      ['Pump', `${f(m.pumpHp, 2)} hp`, design.filter?.label ?? ''],
      ['Filter area', f(m.filterArea, 1), `${f(m.filterRequired, 1)} sq ft required`],
      ['Skimmers', `${m.skimmers} of ${m.skimmersRequired}`, 'ea'],
      ['Returns / lights', `${m.returns} / ${m.lights}`, 'ea'],
      ['Bathers', m.bathers, 'ea'],
      ['Deck', f(m.deckArea, 1), 'm²'],
      ['Barrier', f(m.barrierPerimeter, 1), 'm'],
      ['Setback', f(m.setback, 1), 'm'],
      ...(design.bom ?? []).map((line) => [line.item, line.qty, `${line.unit} · ${money(line.total)}`]),
      ...(design.checks ?? []).filter((check) => check.severity === 'error' || check.severity === 'warning')
        .slice(0, 6).map((check) => [check.id, check.message, verdict(check.severity)]),
    ],
  };
}

// ---- bid -------------------------------------------------------------------

const planWalls = (plan) => (plan?.walls ?? [])
  .filter((wall) => [wall.x1, wall.y1, wall.x2, wall.y2].every((value) => Number.isFinite(Number(value))))
  .map((wall) => ({ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }));

const bidLine = (description, total, group = 'Materials') => ({
  group,
  code: '',
  description,
  qty: 1,
  unit: 'lot',
  unitCost: Math.round(n(total) * 100) / 100,
  total: Math.round(n(total) * 100) / 100,
  note: '',
});

const LABOUR_ROW = /labou?r|install/i;

/**
 * One engine takeoff row as a bid line. The engines agree on
 * `{ group, item, qty, unit, unitCost, cost }` except plumbing, which calls the
 * row a `label` and its money `total`; both are handled here.
 */
function toBidLine(row) {
  const qty = n(row.qty, 1) || 1;
  const total = n(row.total ?? row.cost ?? qty * n(row.unitCost));
  return {
    group: row.labour || LABOUR_ROW.test(row.group ?? '') ? 'Labour' : (row.group || 'Materials'),
    code: String(row.part ?? row.code ?? ''),
    description: row.item ?? row.label ?? row.description ?? 'Line',
    qty,
    unit: row.unit ?? 'ea',
    unitCost: Math.round(n(row.unitCost, total / qty) * 100) / 100,
    total: Math.round(total * 100) / 100,
    note: row.note ?? row.spec ?? '',
  };
}

/**
 * The priced work from every engine, as the bid engine wants it: one group per
 * suite, material split from labour so the tax base is right. A suite that
 * throws is left out rather than zeroed.
 */
function bidGroups(plan, v = {}) {
  const width = n(plan?.widthM, 9) || 9;
  const depth = n(plan?.depthM, 7) || 7;
  const area = n(plan?.takeoff?.floorArea, width * depth) || width * depth;
  const walls = planWalls(plan);
  const groups = [];
  /**
   * One group per suite, made of the engine's own takeoff rows. Labour the rows
   * do not carry is added from the engine's labour total, and any remaining gap
   * to the suite's own total is the balance line — so the bid's base equals the
   * sum of the engines' priced work rather than a second estimate.
   */
  const add = (label, rows = [], { labourTotal = 0, targetTotal = 0 } = {}) => {
    const priced = rows.map(toBidLine).filter((line) => Number.isFinite(line.total) && line.total > 0);
    const labour = priced.filter((line) => line.group === 'Labour')
      .reduce((total, line) => total + line.total, 0);
    const labourGap = Math.round((n(labourTotal) - labour) * 100) / 100;
    if (labourGap > 0.5) priced.push(bidLine(`${label} labour`, labourGap, 'Labour'));
    const balance = Math.round((n(targetTotal) - priced.reduce((total, line) => total + line.total, 0)) * 100) / 100;
    if (balance > 0.5) priced.push(bidLine(`${label} labour and balance`, balance, 'Labour'));
    if (priced.length) groups.push({ label, kind: 'suite', lines: priced });
  };
  const attempt = (build) => { try { return build(); } catch { return null; } };

  const framing = attempt(() => computeFramingDesign({
    studSpacingIn: 16,
    storeys: [{ id: 'storey-1', name: 'Ground floor', floor: true, walls }],
  }));
  if (framing?.bom) {
    add('Framing', framing.bom.rows, {
      labourTotal: framing.metrics.labour,
      targetTotal: framing.metrics.total,
    });
  }

  const deck = attempt(() => computeDeckDesign({ width, depth: n(v.deckDepth, 3), stairs: 1 }));
  if (deck?.bom) {
    add('Deck', deck.bom.rows, { labourTotal: deck.bom.labour, targetTotal: deck.bom.total });
  }

  const roof = attempt(() => computeRoofDesign({ span: width, length: depth, pitch: 6, overhang: 0.45 }));
  if (roof?.costs) {
    add('Roof', roofTakeoffRows(roof), {
      labourTotal: roof.costs.labour,
      targetTotal: roof.costs.total,
    });
  }

  const electrical = attempt(() => computeElectricalDesign({ areaM2: area, sabc: 2, laundry: 1, bathroom: 2 }));
  if (electrical?.bom) {
    add('Electrical', electrical.bom.rows, {
      labourTotal: electrical.bom.labour,
      targetTotal: electrical.bom.total,
    });
  }

  const plumbing = attempt(() => designPlumbing(normalizePlumbingPlan(createPlumbingPlan({
    width,
    depth,
    template: 'house',
    fixtures: ['toilet', 'lavatory', 'bathtub', 'kitchen-sink', 'washing-machine'],
  }))));
  if (plumbing?.takeoff) {
    add('Plumbing', plumbing.takeoff.rows, { targetTotal: plumbing.takeoff.total });
  }

  const landscape = attempt(() => designLandscape({ type: 'pool', width: 5.2, length: 9.5, deep: 1.7, deck: 1.22 }));
  if (landscape?.bom) add('Landscape', landscape.bom, { targetTotal: landscape.cost?.total });

  return groups;
}

/** A contract price from the suite totals, with the commercial structure. */
export function bidResult(plan, v = {}) {
  const groups = bidGroups(plan, v);
  const bid = buildBid({
    groups,
    project: { name: v.name || 'Residential package' },
    markup: {
      overhead: n(v.overhead, 12),
      profit: n(v.profit, 15),
      contingency: n(v.contingency, 5),
      tax: n(v.tax, 7.5),
      permit: n(v.permit, 450),
      design: n(v.design, 1200),
      discount: 0,
    },
    depositPct: n(v.deposit, 30),
  });
  const costs = bid.costs;
  const checks = bidChecks(bid);
  const floor = Math.max(n(plan?.takeoff?.floorArea, 1), 1);
  const itemized = bid.groups
    .flatMap((group) => group.lines.map((line) => ({ suite: group.label, label: line.description, total: line.total })))
    .sort((a, b) => b.total - a.total);
  return {
    cards: [
      [money(costs.total), 'contract', `${money(costs.base)} of work`],
      [money(costs.tax), 'tax', `${f(costs.margin, 1)} % margin`],
      [money(costs.preTax / floor), 'per m²', `${groups.length} suites`],
    ],
    rows: [
      ...bid.groups.map((group) => [group.label, money(group.subtotal), `${group.lines.length} lines`]),
      ['Base', money(costs.base), ''],
      ['Material / labour', `${money(costs.material)} / ${money(costs.labour)}`, ''],
      ['Overhead', money(costs.overhead), `${f(bid.config.markup.overhead, 1)} %`],
      ['Profit', money(costs.profit), `${f(bid.config.markup.profit, 1)} %`],
      ['Contingency', money(costs.contingency), `${f(bid.config.markup.contingency, 1)} %`],
      ['Permit', money(costs.permit), ''],
      ['Design fee', money(costs.design), ''],
      ['Pre-tax', money(costs.preTax), ''],
      ['Tax', money(costs.tax), `${f(bid.config.markup.tax, 1)} %`],
      ['Total', money(costs.total), ''],
      ['Combined takeoff', `${bid.counts.lines} lines`, `${groups.length} suites`],
      ...itemized.slice(0, 18).map((line) => [`${line.suite} · ${line.label}`, money(line.total), '']),
      ...bid.schedule.map((stage) => [stage.label, `${stage.pct} %`, money(stage.amount)]),
      ...checks.checks.filter((check) => check.severity !== 'ok' && check.severity !== 'info')
        .slice(0, 5).map((check) => [check.label, check.message, check.severity === 'error' ? 'fail' : 'warn']),
    ],
  };
}

/** Everything the plan prices, before the markup: the dashboard's roll-up. */
export function projectRollup(plan) {
  const groups = bidGroups(plan, {});
  const rows = groups.map((group) => {
    const subtotal = group.lines.reduce((sum, line) => sum + n(line.total), 0);
    return [group.label, money(subtotal), `${group.lines.length} lines`];
  });
  const total = groups.reduce((sum, group) => sum + group.lines.reduce((s, line) => s + n(line.total), 0), 0);
  return {
    groups: groups.map((group) => group.label),
    cards: [
      [groups.length, 'suites priced', money(total)],
      [money(total * 1.32), 'with overhead and profit', '32 % on the base'],
      [f(plan?.takeoff?.floorArea, 1), 'm² floor', `${f(plan?.takeoff?.wallLength, 1)} m of wall`],
    ],
    rows: [...rows, ['Total', money(total), '']],
  };
}

// ---- BIM schedule ----------------------------------------------------------

/**
 * Walls with their IFC class, net area and volume. The extractor's walls are
 * already in metres, so the BIM module reads them with a 1:1 pixel scale.
 */
export function scheduleResult(plan, v = {}) {
  // bimTakeoff reads canvas-style walls (start/end, pixels) and divides by the
  // scale, so the extractor's metres go in at 1:1 with a metre thickness.
  const walls = (plan?.walls ?? []).map((wall, index) => ({
    id: wall.id ?? `wall-${index + 1}`,
    name: wall.name ?? `Wall ${index + 1}`,
    start: { x: n(wall.x1), y: n(wall.y1) },
    end: { x: n(wall.x2), y: n(wall.y2) },
    height: n(wall.height, n(plan?.wallHeight, 2.7)),
    thickness: n(wall.thickness, 0.15),
  }));
  const takeoff = bimTakeoff({
    walls,
    pixelsPerMeter: 1,
    defaultHeight: n(v.height, n(plan?.wallHeight, 2.7)),
  });
  const t = takeoff.totals;
  return {
    cards: [
      [t.walls, 'walls', `${f(t.netAreaM2, 1)} m² net`],
      [`${f(t.volumeM3, 1)} m³`, 'wall volume', `${f(t.openingAreaM2, 1)} m² openings`],
      [takeoff.rows.length, 'IFC lines', `${takeoff.warnings.length} warnings`],
    ],
    rows: [
      ...takeoff.rows.slice(0, 20).map((row) => [
        row.ifcClass,
        row.name,
        row.areaM2 ? `${f(row.areaM2, 2)} m²` : row.lengthM ? `${f(row.lengthM, 2)} m` : `${row.count ?? 1} ea`,
      ]),
      ...takeoff.warnings.slice(0, 5).map((warning) => ['warning', warning, '']),
    ],
  };
}

// ---- price book ------------------------------------------------------------

/** Every material line the engines can price, with its supplier quote if set. */
export function priceBookResult() {
  let catalog = [];
  let error = '';
  try {
    catalog = collectPriceCatalog(typeof localStorage === 'undefined' ? null : localStorage);
  } catch (err) {
    error = String(err?.message ?? err);
  }
  const quoted = catalog.filter((entry) => entry.quote).length;
  const value = catalog.reduce((sum, entry) => sum + n(entry.quote?.cost ?? entry.defaultCost), 0);
  return {
    cards: [
      [catalog.length, 'lines', `${quoted} quoted`],
      [new Set(catalog.map((entry) => entry.suite)).size, 'suites', 'across the engines'],
      [money(value), 'catalog value', 'unit prices'],
    ],
    rows: [
      ...catalog.slice(0, 40).map((entry) => [
        `${entry.suiteLabel ?? entry.suite}: ${entry.item}`,
        entry.unit,
        entry.quote ? money(entry.quote.cost) : entry.defaultCost == null ? 'quote needed' : money(entry.defaultCost),
      ]),
      ...(error ? [['error', error, '']] : []),
    ],
  };
}
