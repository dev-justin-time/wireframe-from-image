// The report's content, built once for both renderers.
//
// The screen draws it as a sheet and report-pdf.js writes it as a PDF; both read
// this model, so a number cannot say one thing on screen and another in the
// file. Rows are `[label, value, unit]` with the value already formatted.
import { bidTotals } from './engines-extra.js';

const n = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const f = (value, digits = 2) => n(value).toFixed(digits);
const money = (value) => `$${Math.round(n(value)).toLocaleString('en-US')}`;

export function reportModel(plan) {
  const t = plan.takeoff ?? {};
  const totals = bidTotals(plan, {});
  const markup = totals.bid?.config?.markup ?? {};
  const source = plan.source === 'pdf' ? 'PDF vectors'
    : plan.source === 'dxf' ? 'DXF import'
      : plan.source === 'geo' ? `${String(plan.imported?.kind ?? 'kml').toUpperCase()} import`
        : plan.source === 'editor' ? 'drawn in the editor' : 'detected from the upload';

  // A detected upload carries the sheet quantities; an edited or imported plan
  // only has what the graph can measure, so the rows it cannot fill are dropped.
  const takeoff = [
    ['Wall length', f(t.wallLength), 'm'],
    ['Wall area (gross)', t.wallGrossArea === undefined ? undefined : f(t.wallGrossArea), 'm²'],
    ['Openings', t.doors === undefined && t.windows === undefined ? undefined
      : `${t.doors ?? 0} door · ${t.windows ?? 0} window`,
    t.openingArea === undefined ? '' : `${f(t.openingArea)} m²`],
    ['Wall area (net)', t.wallNetArea !== undefined ? f(t.wallNetArea)
      : (t.wallGrossArea === undefined ? undefined : f(t.wallGrossArea)), 'm²'],
    ['Floor area', f(t.floorArea), 'm²'],
    ['Volume', t.volume === undefined ? undefined : f(t.volume), 'm³'],
    ['Drywall (2.4 × 1.2 m)', t.drywallSheets, 'sheets'],
    ['Paint (2 coats)', t.paintLitres, 'L'],
    ['Flooring (+10%)', t.flooringM2 === undefined ? undefined : f(t.flooringM2), 'm²'],
    ['Baseboard', t.baseboardM === undefined ? undefined : f(t.baseboardM), 'm'],
    ['Studs', t.studs, 'ea'],
    ['Plates', t.platesM === undefined ? undefined : f(t.platesM), 'm'],
    ['Sheathing', t.sheathingPanels, 'panels'],
  ].filter(([, value]) => value !== undefined && value !== null);

  const costs = [
    ...totals.groups.map((group) => [group.label, money(group.subtotal), `${group.lines} lines`]),
    ['Base of the work', money(totals.costs.base), ''],
    ['Overhead', money(totals.costs.overhead), `${f(markup.overhead, 1)} %`],
    ['Profit', money(totals.costs.profit), `${f(markup.profit, 1)} %`],
    ['Contingency', money(totals.costs.contingency), `${f(markup.contingency, 1)} %`],
    ['Permit', money(totals.costs.permit), ''],
    ['Design fee', money(totals.costs.design), ''],
    ['Pre-tax', money(totals.costs.preTax), ''],
    ['Sales tax', money(totals.costs.tax), `${f(markup.tax, 1)} %`],
    ['Total', money(totals.costs.total), ''],
  ];

  return {
    title: plan.project || 'Plan',
    generated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    source,
    metrics: [
      { value: plan.walls.length, label: 'walls' },
      { value: plan.rooms.length, label: 'rooms' },
      { value: f(t.floorArea, 1), label: 'm² floor' },
      { value: money(totals.costs.total), label: 'contract' },
    ],
    summary: [
      ['Source', source, ''],
      ['Scale', plan.mmPerPx ? `${f(plan.mmPerPx, 1)} ${plan.source === 'pdf' ? 'mm/pt' : 'mm/px'}` : '—', ''],
      ['Extents', `${f(plan.widthM, 1)} × ${f(plan.depthM, 1)}`, 'm'],
      ['Wall height', f(plan.wallHeight, 2), 'm'],
      ['Stud spacing', n(plan.studSpacingMm), 'mm'],
      ['Edits', plan.edited ? 'walls edited since the upload' : 'as extracted', ''],
    ],
    takeoff,
    rooms: plan.rooms.map((room) => ({
      name: room.name || 'Room',
      area: `${f(room.area, 2)} m²`,
      perimeter: `${f(room.perimeter, 2)} m`,
    })),
    costs,
    note: `${t.stale
      ? 'Areas and wall lengths are recomputed from the edited walls; the sheet quantities are from the upload the edit started from. '
      : ''}Quantities are measured on the wall centre lines and priced by the engine price book, not a supplier quote.`,
    total: n(totals.costs.total),
  };
}
