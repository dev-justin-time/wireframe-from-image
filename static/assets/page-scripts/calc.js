// The construction calculators behind pages/calc.html.
//
// Every answer on this page used to come from a formula copy-pasted into a
// standalone script that nothing ever called: the buttons carry `data-click`
// names, but no file listened for them. This module supplies both halves — a
// dispatcher for those buttons and the arithmetic, which now comes from the
// same engines the design suites use instead of a second implementation:
//
//   * lumber span   -> solveSpan (NDS bending, shear, L/360 live deflection)
//   * stairs        -> computeStraightDesigner (riser/going/blondel/headroom)
//   * concrete      -> the deck engine's bag coverage constant
//   * roof          -> computeRoofDesign (pitch, geometry, squares)
//   * deck footings -> footingDiameterIn and postCapacity (NDS/IRC)
//
// The page keeps showing the formula and the code clause with each result, so a
// number can still be checked by hand. Nothing here is stored: these are
// one-off what-if calculators, and the design suites own the project.

import { solveSpan } from '../../engines/features/framing/calculators.js';
import {
  SPECIES,
  CONCRETE_BAG_M3,
  FT,
  IN,
  sectionProps,
} from '../../engines/features/deck/materials.js';
import { footingDiameterIn, postCapacity } from '../../engines/features/deck/engine.js';
import { autoStepCount, computeStraightDesigner } from '../../engines/features/stairs/designer.js';
import { computeRoofDesign } from '../../engines/features/roof/design.js';

const MM_PER_IN = 25.4;
const M3_PER_YD3 = 0.764554857984;
const PSF_DEAD = 10; // structural dead load under a residential floor (IRC R301.5)

const $ = (id) => document.getElementById(id);
const num = (id, fallback = 0) => {
  const value = Number($(id)?.value);
  return Number.isFinite(value) ? value : fallback;
};
const label = (id) => $(id)?.selectedOptions?.[0]?.textContent?.trim() ?? '';
const feet = (value) => `${(Number(value) || 0).toFixed(2)} ft`;
const inches = (value) => `${(Number(value) || 0).toFixed(2)} in`;

// The result boxes are fixed markup, but each answer needs one line of context
// (governing case, formula, code clause). It is added once, then rewritten, so
// the page's own markup stays untouched.
function note(containerId, text, tone = 'muted') {
  const box = $(containerId);
  if (!box) return;
  let line = box.querySelector('.calc-note');
  if (!line) {
    line = document.createElement('p');
    line.className = 'calc-note text-xs mt-3 leading-snug';
    box.append(line);
  }
  line.className = `calc-note text-xs mt-3 leading-snug ${
    tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'
  }`;
  line.textContent = text;
}

function reveal(id) {
  $(id)?.classList.remove('hidden');
}

// ---- tabs and theme --------------------------------------------------------

const TABS = ['span', 'stairs', 'concrete', 'roof', 'deck'];

function switchTab(tabName) {
  if (!TABS.includes(tabName)) return;
  document.querySelectorAll('.calc-content').forEach((el) => el.classList.add('hidden'));
  $('calc-' + tabName)?.classList.remove('hidden');

  document.querySelectorAll('.calc-tab').forEach((el) => {
    el.classList.remove('active', 'text-white');
    el.classList.add('text-gray-600', 'dark:text-gray-300');
  });
  const active = $('tab-' + tabName);
  active?.classList.add('active');
  active?.classList.remove('text-gray-600', 'dark:text-gray-300');

  // The designer pages link here with ?tab=…, so keep the URL shareable.
  const url = new URL(location.href);
  url.searchParams.set('tab', tabName);
  history.replaceState(null, '', url);
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
}

// ---- 1. lumber span -------------------------------------------------------

function calcSpan() {
  const [Fb, E] = ($('span-species')?.value ?? '').split(',').map(Number);
  const props = sectionProps(label('span-size'));
  const spacing = num('span-spacing', 16);
  const totalPsf = num('span-load', 50);
  if (!props || !Fb || !E || !(spacing > 0) || !(totalPsf > 0)) {
    note('span-result', 'Check the species, size, spacing and load before calculating.', 'warn');
    reveal('span-result');
    return;
  }

  // Bending and stiffness come from the grade picked in the page; shear comes
  // from the nearest NDS species, which is the only value the page does not
  // carry a column for.
  const species = SPECIES.find((entry) => entry.E === E) ?? SPECIES[0];
  const live = Math.max(totalPsf - PSF_DEAD, 0);
  const solved = solveSpan({
    S: props.S,
    I: props.I,
    area: props.area,
    Fb,
    Fv: species.Fv,
    E,
    livePsf: live,
    deadPsf: Math.min(totalPsf, PSF_DEAD),
    tributaryFt: spacing / 12,
    limit: 360,
  });

  $('res-span-bend').textContent = feet(solved.bendFt);
  $('res-span-def').textContent = feet(solved.deflFt);
  $('res-span-final').textContent = feet(solved.spanFt);
  note(
    'span-result',
    `Governing case: ${solved.governing} · w = ${solved.wTotal.toFixed(1)} lb/ft on a `
      + `${props.b.toFixed(2)} × ${props.d.toFixed(2)} in section · M = wL²/8, `
      + `Δ = 5wL⁴/(384EI) ≤ L/360 · IRC Table R502.3(1), AWC NDS`,
  );
  reveal('span-result');
}

// ---- 2. stairs ------------------------------------------------------------

function calcStairs() {
  const riseIn = num('stair-rise', 114);
  const goingIn = num('stair-run', 10);
  if (!(riseIn > 0) || !(goingIn > 0)) {
    note('stair-result', 'Enter a total rise and a target run greater than zero.', 'warn');
    reveal('stair-result');
    return;
  }

  const height = riseIn * MM_PER_IN;
  const steps = autoStepCount(height);
  // Hand the designer the run the page asked for as the length the stair must
  // fit in, so it keeps this going and still runs its own code checks.
  const design = computeStraightDesigner({
    height,
    length: Math.max(steps * goingIn * MM_PER_IN, 1000),
    solve: 'length',
    landingStep: 0,
    overlap: 0,
  });

  const stringerIn = Math.hypot(design.totalRun, design.height) / MM_PER_IN;
  $('res-stair-risers').textContent = design.risers;
  $('res-stair-actual-rise').textContent = inches(design.stepHeight / MM_PER_IN);
  $('res-stair-total-run').textContent = `${(design.totalRun / MM_PER_IN).toFixed(1)} in`;
  $('res-stair-stringer').textContent = `${(stringerIn / 12).toFixed(2)} ft`;

  const problems = design.checks.filter((check) => check.severity === 'error');
  const warnings = design.checks.filter((check) => check.severity === 'warn');
  const check = $('stair-code-check');
  if (check) {
    if (problems.length) {
      check.textContent = `⚠ ${problems.map((entry) => entry.message).join(' · ')}`;
      check.className = 'mt-3 text-sm font-medium text-red-600 dark:text-red-400';
    } else if (warnings.length) {
      check.textContent = `⚠ ${warnings.map((entry) => entry.message).join(' · ')}`;
      check.className = 'mt-3 text-sm font-medium text-amber-600 dark:text-amber-400';
    } else {
      check.textContent = `✅ Meets IRC R311.7 (riser ≤ ${(203 / MM_PER_IN).toFixed(1)}", `
        + `going ≥ ${(254 / MM_PER_IN).toFixed(1)}", G + 2H ${Math.round(design.blondel)} mm)`;
      check.className = 'mt-3 text-sm font-medium text-green-600 dark:text-green-400';
    }
  }
  note(
    'stair-result',
    `${design.steps} treads · ${Math.round(design.going)} mm going · `
      + `${Math.round(design.angle * 10) / 10}° · headroom ${Math.round(design.headroom)} mm · `
      + `2 stringers × ${Math.round(stringerIn * MM_PER_IN)} mm · comfort ${design.comfort}%`,
  );
  reveal('stair-result');
}

// ---- 3. concrete ----------------------------------------------------------

let concreteShape = 'rect';

const SHAPE_ACTIVE = ['border-brand-500', 'bg-brand-50', 'dark:bg-brand-900/30', 'text-brand-700', 'dark:text-brand-300', 'font-medium'];
const SHAPE_IDLE = ['border-gray-300', 'dark:border-gray-600', 'hover:bg-gray-50', 'dark:hover:bg-gray-700'];

function setConcreteShape(shape) {
  concreteShape = shape === 'round' ? 'round' : 'rect';
  [['rect', 'shape-rect'], ['round', 'shape-round']].forEach(([key, id]) => {
    const button = $(id);
    if (!button) return;
    button.classList.remove(...(key === concreteShape ? SHAPE_IDLE : SHAPE_ACTIVE));
    button.classList.add(...(key === concreteShape ? SHAPE_ACTIVE : SHAPE_IDLE));
  });
  $('concrete-rect-inputs')?.classList.toggle('hidden', concreteShape !== 'rect');
  $('concrete-round-inputs')?.classList.toggle('hidden', concreteShape !== 'round');
}

function calcConcrete() {
  let volumeM3 = 0;
  if (concreteShape === 'rect') {
    const length = num('conc-l', 0) * FT; // feet -> metres
    const width = num('conc-w', 0) * FT;
    const depth = num('conc-d', 0) * IN; // inches -> metres
    volumeM3 = Math.max(length, 0) * Math.max(width, 0) * Math.max(depth, 0);
  } else {
    const radius = (num('conc-dia', 0) * IN) / 2;
    const depth = num('conc-depth', 0) * FT;
    const quantity = Math.max(num('conc-qty', 1), 0);
    volumeM3 = Math.PI * radius * radius * Math.max(depth, 0) * quantity;
  }
  if (!(volumeM3 > 0)) {
    note('concrete-result', 'Enter positive dimensions to get a volume.', 'warn');
    reveal('concrete-result');
    return;
  }

  const yards = volumeM3 / M3_PER_YD3;
  // The same bag allowance the deck and foundation work buys against.
  const bags = Math.ceil((volumeM3 * 1.1) / CONCRETE_BAG_M3);
  $('res-concrete-yards').textContent = yards.toFixed(2);
  note(
    'concrete-result',
    `${volumeM3.toFixed(3)} m³ (${(volumeM3 * 1.1).toFixed(3)} m³ with 10% waste) · `
      + `${bags} × 60 lb bags · 1 yd³ = 0.7646 m³`,
  );
  reveal('concrete-result');
}

// ---- 4. roof pitch and rafter ---------------------------------------------

function calcRoof() {
  const runFt = num('roof-run', 12);
  const riseFt = num('roof-rise', 6);
  if (!(runFt > 0) || !(riseFt > 0)) {
    note('roof-result', 'Enter a horizontal run and a vertical rise greater than zero.', 'warn');
    reveal('roof-result');
    return;
  }

  const pitch = (riseFt / runFt) * 12;
  // A gable's span is twice the run; overhang 0 keeps the slope length equal to
  // the rafter this calculator is asked for. The rest of the takeoff is switched
  // off because the page only asks for geometry.
  const design = computeRoofDesign({
    style: 'gable-king',
    span: runFt * 2 * FT,
    length: 6,
    pitch,
    overhang: 0,
    gutters: false,
    iceShield: false,
    ridgeVent: false,
    soffitVent: false,
  });
  const geometry = design.geometry;
  const rafterFt = geometry.slopeLength / FT;

  $('res-roof-pitch').textContent = `${pitch.toFixed(1)} in 12`;
  $('res-roof-angle').textContent = `${geometry.angle.toFixed(1)}°`;
  $('res-roof-length').textContent = feet(rafterFt);
  note(
    'roof-result',
    `${design.style.name} · rafter ${feet(rafterFt)} for a ${runFt} ft run · `
      + `${design.areas.roof.toFixed(1)} m² over ${design.areas.plan.toFixed(1)} m² plan · `
      + `${design.areas.squaresWithWaste.toFixed(1)} squares with waste · `
      + `${design.trussCount} trusses at ${design.spacing} m · IRC R802`,
  );
  reveal('roof-result');
}

// ---- 5. deck footings ------------------------------------------------------

function calcDeck() {
  const load = num('deck-load', 50);
  const spacing = num('deck-spacing', 8);
  const soil = num('deck-soil', 2000);
  if (!(load > 0) || !(spacing > 0) || !(soil > 0)) {
    note('deck-result', 'Enter a positive load, post spacing and soil capacity.', 'warn');
    reveal('deck-result');
    return;
  }

  const tributaryFt2 = spacing * spacing;
  const totalLoad = load * tributaryFt2 * 1.5; // IRC footing sizing carries a 1.5 factor
  const diameterIn = footingDiameterIn(totalLoad, soil);
  // A 6x6 at a 0.9 m unbraced length is the common deck post; the capacity is
  // NDS Fc* A Cp, so the note can say whether the post or the soil governs.
  const post = postCapacity({ size: '6x6', heightM: 0.9 });
  const bearing = Math.max(totalLoad, 1) / soil;
  const postGoverns = post ? post.allowableLb < totalLoad : false;

  $('res-deck-load').textContent = `${Math.round(totalLoad).toLocaleString('en-US')} lbs`;
  $('res-deck-dia').textContent = `${diameterIn.toFixed(1)} inches`;
  note(
    'deck-result',
    `${tributaryFt2.toFixed(1)} ft² tributary at ${load} psf · ${bearing.toFixed(2)} ft² of `
      + `bearing at ${soil} psf · 6x6 post capacity ${Math.round(post?.allowableLb ?? 0).toLocaleString('en-US')} lbs`
      + ` (${postGoverns ? 'post governs, size up' : 'soil governs'}) · IRC R507.3`,
    postGoverns ? 'warn' : 'muted',
  );
  reveal('deck-result');
}

// ---- the dispatcher -------------------------------------------------------

const HANDLERS = {
  toggleTheme,
  switchTab,
  calcSpan,
  calcStairs,
  calcConcrete,
  setConcreteShape,
  calcRoof,
  calcDeck,
};

function dispatch(button) {
  const name = button.dataset.click;
  const handler = HANDLERS[name];
  if (!handler) {
    console.warn(`calc.js: no handler named ${name}`);
    return;
  }
  let args = [];
  try {
    args = JSON.parse(button.dataset.args || '[]');
  } catch {
    args = [];
  }
  try {
    handler(...(Array.isArray(args) ? args : [args]));
  } catch (error) {
    // A failed calculation must not take the rest of the page with it.
    console.error(`calc.js: ${name} failed`, error);
    const box = button.closest('.calc-content');
    box?.classList.remove('hidden');
    if (box) note(box.id + '-result', `Could not calculate: ${error.message}`, 'warn');
    if (window.blueprintErrors && typeof window.blueprintErrors.push === 'function') {
      window.blueprintErrors.push({ source: 'calc.js', handler: name, message: String(error.message) });
    }
  }
}

// The shared chrome (shared/site.js) owns `data-click` dispatch on every page.
// Publishing these handlers there rather than adding a second listener means a
// calculator button is dispatched once, and an action with no handler is
// reported the same way as everywhere else.
for (const name of Object.keys(HANDLERS)) {
  window[name] = function dispatchFromChrome() {
    const button = this instanceof Element
      ? this
      : document.querySelector(`[data-click="${name}"]`);
    if (button) return dispatch(button);
    return undefined;
  };
}

// A page opened from a designer arrives as calc.html?tab=roof; anything else
// falls back to the first tab, and the span answer is ready before the first
// click so the page never looks dead on arrival.
const requested = new URLSearchParams(location.search).get('tab');
switchTab(TABS.includes(requested) ? requested : 'span');
if ($('span-result')) calcSpan();
