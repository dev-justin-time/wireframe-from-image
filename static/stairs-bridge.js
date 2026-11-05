// The stair engines, behind the studio's designer format.
//
// These three modules (`design`, `models`, `designer`) are copied verbatim from
// floorplan3d and reach `three` for their geometry helpers, so they are kept
// apart from engines-extra.js: the browser's import map resolves `three` to the
// vendored build, while the Node smoke test only loads the DOM-free modules.

import { computeStraightDesigner, toStairConfig } from './engines/features/stairs/designer.js';
import { computeStairDesign, defaultStairConfig } from './engines/features/stairs/design.js';
import { buildStairAssembly } from './engines/features/stairs/assembly.js';
import { getPart } from './engines/features/stairs/parts.js';
import { computeStairModel } from './engines/features/stairs/models.js';

const n = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const f = (value, digits = 2) => n(value).toFixed(digits);
const mm = (metres) => Math.round(n(metres) * 1000);
// The designer engine works in millimetres end to end; only the stair design
// engine (winder, spiral, model) reports metres.
const verdict = (severity) => (severity === 'error' ? '<span class="err">fail</span>'
  : severity === 'warning' ? '<span class="warn">warn</span>'
    : severity === 'info' ? 'note' : '<span class="ok">pass</span>');

/**
 * The member takeoff: the assembly's run, support and landing sub-types as rows,
 * with the catalogue part names for the tread and riser blanks. Issues the design
 * already reported are not repeated.
 */
function assemblyRows(assembly) {
  const design = assembly.design ?? {};
  const run = assembly.subTypes?.run ?? {};
  const landing = assembly.subTypes?.landing ?? {};
  const support = assembly.subTypes?.support ?? {};
  const treadPart = getPart(run.treadPart);
  const riserPart = getPart(run.riserPart);
  const span = n(support.span, 0);
  const known = new Set((design.issues ?? []).map((issue) => issue.code));
  return [
    ['Treads', n(run.treads, 0), `${mm(run.treadDepth)} × ${mm(run.width)} mm`],
    ['Tread blanks', n(run.treads, 0), treadPart?.label ?? run.treadPart ?? ''],
    ['Riser blanks', run.materials === 'concrete' ? 0 : n(run.risers, 0), riserPart?.label ?? run.riserPart ?? ''],
    ['Stringers', n(support.qty, 0), `${support.label ?? ''} · ${f(span, 2)} m`],
    ['Stringer length', Math.round(Math.hypot(span, n(design.rise, 0)) * 1000), 'mm'],
    ['Support span', f(span, 2), `${f(support.maxSpan, 2)} m max`],
    ['Top landing', landing.top?.enabled ? mm(landing.top.depth) : 0, `${mm(landing.top?.width)} mm wide`],
    ['Bottom landing', landing.bottom?.enabled ? mm(landing.bottom.depth) : 0, `${mm(landing.bottom?.width)} mm wide`],
    ['Intermediate landings', (landing.intermediate ?? []).length, 'ea'],
    ['Nosing', run.nosings ?? '', ''],
    ['Run material', run.materials ?? '', ''],
    ...(assembly.issues ?? [])
      .filter((issue) => issue.severity !== 'info' && !known.has(issue.code))
      .map((issue) => [issue.code, issue.message, verdict(issue.severity)]),
  ];
}

/** The straight-run designer: mm in, steps, going, headroom and checks out. */
export function straightStairResult(v = {}) {
  const result = computeStraightDesigner({
    height: n(v.rise, 2.85) * 1000,
    width: n(v.width, 1) * 1000,
    length: n(v.run, 4.2) * 1000,
    steps: n(v.steps, 0),
  });
  // A residential run sits on wood carriages, not steel stringers.
  const assembly = buildStairAssembly({ ...toStairConfig(result), support: 'carriage' });
  return {
    cards: [
      [`${result.steps} + 1`, 'treads / risers', `${Math.round(result.stepHeight)} mm riser`],
      [`${Math.round(result.totalRun)}`, 'mm run', `${Math.round(result.going)} mm going`],
      [`${result.comfort} %`, 'comfort', `G + 2H ${Math.round(result.blondel)} mm`],
    ],
    rows: [
      ['Steps', result.steps, 'ea'],
      ['Risers', result.risers, 'ea'],
      ['Riser height', Math.round(result.stepHeight), 'mm'],
      ['Going', Math.round(result.going), 'mm'],
      ['Step depth', Math.round(result.stepDepth), 'mm'],
      ['Total run', Math.round(result.totalRun), 'mm'],
      ['Pitch', f(result.angle, 1), '°'],
      ['G + 2H', Math.round(result.blondel), 'mm'],
      ['Headroom', Math.round(result.headroom), 'mm'],
      ['Floor opening', `${Math.round(result.opening.length)} × ${Math.round(result.opening.width || n(v.width, 1) * 1000)}`, 'mm'],
      ...assemblyRows(assembly),
      ...result.checks.map((check) => [check.label, check.message, verdict(check.severity)]),
    ],
  };
}

/** A quarter- or half-turn stair: `kind` is 'l' (90°) or 'u' (180°). */
export function turnStairResult(kind, v = {}) {
  const storeyHeight = n(v.rise, 2.85);
  const input = {
    ...defaultStairConfig('curve-left', { storeyHeight }),
    width: n(v.width, 1),
    availableRun: n(v.run, 4.2),
    availableWidth: 3.6,
    turnDegrees: kind === 'u' ? 180 : 90,
    support: 'carriage',
  };
  const design = computeStairDesign(input);
  const assembly = buildStairAssembly(input);
  const issues = design.issues ?? [];
  return {
    cards: [
      [design.risers, 'risers', `${mm(design.riserHeight)} mm`],
      [`${mm(design.treadDepthWalkline)} mm`, 'walkline tread', `${f(design.runUsed, 2)} m used`],
      [design.compliant ? 'pass' : `${design.errors.length} fail`, 'code check', `${issues.length} notes`],
    ],
    rows: [
      ['Type', kind === 'u' ? 'Half turn, 180° winder' : 'Quarter turn, 90° winder', ''],
      ['Risers', design.risers, 'ea'],
      ['Treads', design.treads, 'ea'],
      ['Riser height', mm(design.riserHeight), 'mm'],
      ['Walkline tread', mm(design.treadDepthWalkline), 'mm'],
      ['Run used', f(design.runUsed, 2), 'm'],
      ['Available run', f(design.availableRun, 2), 'm'],
      ['Inner / outer radius', `${f(design.innerRadius, 2)} / ${f(design.outerRadius, 2)}`, 'm'],
      ['Footprint', `${f(design.footprint?.width, 2)} × ${f(design.footprint?.depth, 2)}`, 'm'],
      ...assemblyRows(assembly),
      ...issues.map((issue) => [issue.code, issue.message, verdict(issue.severity)]),
    ],
  };
}

/** A helical stair: the walkline tread, the diameter and the clear width. */
export function spiralStairResult(v = {}) {
  const storeyHeight = n(v.rise, 2.85);
  const diameter = n(v.diameter, 1.6);
  const input = {
    ...defaultStairConfig('spiral', { storeyHeight }),
    availableWidth: diameter,
  };
  const design = computeStairDesign(input);
  const assembly = buildStairAssembly(input);
  const issues = design.issues ?? [];
  return {
    cards: [
      [design.risers, 'risers', `${mm(design.riserHeight)} mm`],
      [`${f(diameter, 2)} m`, 'diameter', `${mm(design.treadDepthWalkline)} mm walkline`],
      [design.compliant ? 'pass' : `${design.errors.length} fail`, 'code check', `${f(design.anglePerTread * 180 / Math.PI, 1)}° per tread`],
    ],
    rows: [
      ['Risers', design.risers, 'ea'],
      ['Treads', design.treads, 'ea'],
      ['Riser height', mm(design.riserHeight), 'mm'],
      ['Walkline tread', mm(design.treadDepthWalkline), 'mm'],
      ['Diameter', f(diameter, 2), 'm'],
      ['Clear width', f(design.minDiameter ? diameter - design.minDiameter * 0 + (design.width ?? 0) : design.width, 2), 'm'],
      ['Run used', f(design.runUsed, 2), 'm'],
      ['Footprint', `${f(design.footprint?.width, 2)} × ${f(design.footprint?.depth, 2)}`, 'm'],
      ['Minimum diameter', n(design.minDiameter) ? f(design.minDiameter, 2) : '—', 'm'],
      ...assemblyRows(assembly),
      ...issues.map((issue) => [issue.code, issue.message, verdict(issue.severity)]),
    ],
  };
}

/** A steep access stair from the model catalogue (ship's ladder). */
export function steepStairResult(v = {}) {
  const design = computeStairModel('ships-ladder', {
    storeyHeight: n(v.rise, 2.85),
    width: n(v.width, 0.6),
  });
  const assembly = buildStairAssembly({ design });
  const model = design.model ?? {};
  const issues = design.issues ?? [];
  return {
    cards: [
      [design.risers, 'risers', `${mm(design.riserHeight)} mm`],
      [`${f(model.slopeDegrees, 1)}°`, 'slope', `${mm(design.treadDepth)} mm tread`],
      [design.compliant === false ? `${design.errors.length} fail` : 'pass', 'code check', model.label ?? ''],
    ],
    rows: [
      ['Model', model.label ?? 'Ship’s ladder', model.category ?? ''],
      ['Risers', design.risers, 'ea'],
      ['Riser height', mm(design.riserHeight), 'mm'],
      ['Tread depth', mm(design.treadDepth), 'mm'],
      ['Slope', f(model.slopeDegrees, 1), '°'],
      ['Run used', f(design.runUsed, 2), 'm'],
      ['Width', f(design.width, 2), 'm'],
      ['Guard height', model.guardHeight ? `${Math.round(model.guardHeight / 0.0254)}` : '', 'in'],
      ['Material', model.material ?? '', ''],
      ...assemblyRows(assembly),
      ...issues.filter((issue) => issue.severity !== 'info')
        .map((issue) => [issue.code, issue.message, verdict(issue.severity)]),
    ],
  };
}
