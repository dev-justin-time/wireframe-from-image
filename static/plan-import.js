// DXF import: floorplan3d's parser, with the drawing turned into the same plan
// shape the extractor returns, so an imported vector plan opens in every screen.
import { dxfToSegments } from './engines/features/import/dxf.js';
import { parseGeoFile, projectFeatures, localBounds, fitFeaturesToSite } from './engines/features/import/geo.js';
import { planFromWalls } from './plan-edit.js';

export const GEO_ACCEPT = '.kml,.kmz,.geojson,.json';

/**
 * Parse a DXF and build a plan from its lines, polylines, arcs and circles.
 * CAD y grows up and the plan's y grows down, so the drawing is mirrored once
 * here; the graph's face walk is orientation-independent.
 */
export function planFromDxf(text, { unitScale = null, previous = null } = {}) {
  if (typeof text !== 'string' || !/^\s*0\s*\r?\n\s*SECTION/im.test(text)) {
    return { plan: null, error: 'That file does not look like a DXF (no 0/SECTION header).' };
  }
  const parsed = dxfToSegments(text, { unitScale });
  if (!parsed.segments.length) {
    return {
      ...parsed,
      plan: null,
      error: 'The drawing has no LINE, LWPOLYLINE, ARC or CIRCLE entities.',
    };
  }
  const walls = parsed.segments.map((segment) => ({
    x1: segment.a.x,
    y1: -segment.a.y,
    x2: segment.b.x,
    y2: -segment.b.y,
  }));
  const plan = planFromWalls(walls, previous);
  plan.source = 'dxf';
  plan.units = parsed.units;
  return { plan, units: parsed.units, stats: parsed.stats, error: '' };
}

/**
 * Walls from projected survey features: a polygon ring closes, a line stays open.
 * Rings are expected in site metres, x across and z into depth.
 */
function wallsFromFeatures(features) {
  const walls = [];
  const addEdges = (points, close) => {
    const count = close ? points.length : points.length - 1;
    for (let index = 0; index < count; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-3) continue;
      walls.push({ x1: a.x, y1: a.z, x2: b.x, y2: b.z });
    }
  };

  for (const entry of features) {
    for (const ring of entry.rings) {
      if (entry.kind === 'polygon' && ring.length > 2) {
        // Both formats repeat the first vertex to close a ring.
        const points = [...ring];
        const first = points[0];
        const last = points[points.length - 1];
        if (Math.hypot(last.x - first.x, last.z - first.z) < 1e-3) points.pop();
        addEdges(points, true);
      } else if (entry.kind === 'line' && ring.length > 1) {
        addEdges(ring, false);
      }
    }
  }
  return walls;
}

/**
 * KML, KMZ or GeoJSON to a plan. The survey keeps its real size — it is a
 * measurement, not something to fit to the viewport — and is only lifted into
 * the positive quadrant with north up (the projection's +y becomes -z).
 *
 * A file can hold more than one closed ring (a lot boundary and the house
 * footprint, say); each closed ring becomes a face, and the message the screens
 * show says how many there were.
 */
export async function planFromGeo({ name = '', text = '', bytes = null, previous = null } = {}) {
  const lower = String(name).toLowerCase();
  if (!/\.(kml|kmz|geojson|json)$/.test(lower)) {
    return { plan: null, error: 'Choose a .kml, .kmz or .geojson file.', features: [], walls: 0 };
  }

  let features;
  try {
    features = await parseGeoFile({ name: lower, text, bytes });
  } catch (err) {
    return { plan: null, error: err.message || String(err), features: [], walls: 0 };
  }

  const drawn = features.filter((entry) => (entry.kind === 'polygon'
    ? entry.rings.some((ring) => ring.length > 2)
    : entry.kind === 'line' && entry.rings.some((ring) => ring.length > 1)));
  if (!drawn.length) {
    return {
      plan: null,
      error: 'That file has no polygon or line geometry — a point placemark carries no walls.',
      features,
      walls: 0,
    };
  }

  const projected = projectFeatures(drawn);
  const bounds = localBounds(projected.features);
  const placed = fitFeaturesToSite(projected.features, {
    width: bounds.width,
    depth: bounds.height,
    margin: 0,
    fit: false,
  });
  const walls = wallsFromFeatures(placed.features);
  if (!walls.length) {
    return { plan: null, error: 'The geometry is too small to make walls (every edge under 1 mm).', features: drawn, walls: 0 };
  }

  const plan = planFromWalls(walls, previous);
  plan.source = 'geo';
  plan.imported = {
    kind: lower.endsWith('.kmz') ? 'kmz' : lower.endsWith('.kml') ? 'kml' : 'geojson',
    features: drawn.length,
    rings: drawn.reduce((sum, entry) => sum + entry.rings.length, 0),
  };
  return { plan, features: drawn, walls: walls.length, error: '' };
}
