// The MEP layer drawings from floorplan3d's features/layers, fed with this
// studio's plan: the detected walls become the framing layer, a plumbing plan
// laid out inside the same footprint supplies the water/DWV/gas routes, and the
// electrical design supplies the panel and circuit blocks.
import {
  drawFramingLayer,
  drawPlumbingLayer,
  drawElectricalLayer,
  drawStackedLayers,
} from './engines/features/layers/mep-layers.js';
import { createPlan as createPlumbingPlan, normalizePlan } from './engines/features/plumbing/plan.js';
import { designPlumbing } from './engines/features/plumbing/engine.js';
import { computeElectricalDesign } from './engines/features/electrical/engine.js';

const n = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export const LAYER_OPTIONS = [
  ['stacked', 'All layers'],
  ['framing', 'Framing'],
  ['plumbing', 'Plumbing'],
  ['electrical', 'Electrical'],
];

/** Footprint, framing walls and the services designs, all inside 0..W × 0..D. */
export function layerModel(plan) {
  const walls = (plan?.walls ?? [])
    .map((wall) => ({ x1: n(wall.x1), y1: n(wall.y1), x2: n(wall.x2), y2: n(wall.y2) }))
    .filter((wall) => [wall.x1, wall.y1, wall.x2, wall.y2].every(Number.isFinite));
  if (!walls.length) return null;

  const minX = Math.min(...walls.flatMap((wall) => [wall.x1, wall.x2]));
  const minZ = Math.min(...walls.flatMap((wall) => [wall.y1, wall.y2]));
  const width = Math.max(Math.max(...walls.flatMap((wall) => [wall.x1, wall.x2])) - minX, 1);
  const depth = Math.max(Math.max(...walls.flatMap((wall) => [wall.y1, wall.y2])) - minZ, 1);

  const plumbingPlan = normalizePlan(createPlumbingPlan({
    width,
    depth,
    template: 'house',
    fixtures: ['toilet', 'lavatory', 'bathtub', 'kitchen-sink'],
  }));

  return {
    footprint: { width, depth },
    sources: {
      framingRaw: {
        storeys: [{
          walls: walls.map((wall) => ({
            x1: wall.x1 - minX,
            z1: wall.y1 - minZ,
            x2: wall.x2 - minX,
            z2: wall.y2 - minZ,
          })),
        }],
      },
      plumbingPlan,
      plumbingDesign: designPlumbing(plumbingPlan),
    },
    electrical: computeElectricalDesign({
      areaM2: Math.max(width * depth, 1),
      sabc: 2,
      laundry: 1,
      bathroom: 2,
    }),
  };
}

/** Draw one layer set into a canvas already sized w × h CSS pixels. */
export function drawLayer(ctx, width, height, kind, model, dpr = 1) {
  if (!model) return false;
  if (kind === 'framing') drawFramingLayer(ctx, width, height, model.sources, model.footprint, { dpr });
  else if (kind === 'plumbing') drawPlumbingLayer(ctx, width, height, model.sources, model.footprint, { dpr });
  else if (kind === 'electrical') drawElectricalLayer(ctx, width, height, model.electrical, model.footprint, { dpr });
  else drawStackedLayers(ctx, width, height, model.sources, model.electrical, model.footprint, { dpr });
  return true;
}
