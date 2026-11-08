/**
 * ASCII DXF import — walls from a CAD drawing.
 *
 * Written from the public DXF entity reference, not ported from another
 * codebase. Only the parts a floor plan needs are read: HEADER units, the
 * ENTITIES section and the primitive curve entities. Blocks/INSERTs are
 * counted and skipped for now, and SPLINEs are reported as unsupported rather
 * than guessed at.
 *
 * Coordinates are read in the drawing's own units, converted to metres and
 * flipped from CAD's y-up to the plan's y-down. Nothing here touches the DOM,
 * so the parser is tested in Node and reused by the editor.
 */
import { PIXELS_PER_METER } from '../../core/world-space.js';

// $INSUNITS values (DXF header, group code 70). The full table is longer; these
// are the units drawings are actually authored in.
export const INS_UNITS = {
    0: { label: 'unitless', metres: null },
    1: { label: 'in', metres: 0.0254 },
    2: { label: 'ft', metres: 0.3048 },
    3: { label: 'mi', metres: 1609.344 },
    4: { label: 'mm', metres: 0.001 },
    5: { label: 'cm', metres: 0.01 },
    6: { label: 'm', metres: 1 },
    7: { label: 'km', metres: 1000 },
    8: { label: 'microin', metres: 0.0254e-6 },
    9: { label: 'mil', metres: 0.0254e-3 },
    10: { label: 'yd', metres: 0.9144 },
    11: { label: 'angstrom', metres: 1e-10 },
    12: { label: 'nm', metres: 1e-9 },
    13: { label: 'micron', metres: 1e-6 },
    14: { label: 'dm', metres: 0.1 },
    15: { label: 'dam', metres: 10 },
    16: { label: 'hm', metres: 100 }
};

/** Read (code, value) pairs out of the file. Blank lines are not pairs. */
function readPairs(text) {
    // DXF is a strict two-line grid. Empty lines are padding that some writers
    // emit; a line that is not an integer code is a corrupt record and is
    // dropped alone, so one bad line cannot desynchronise the rest of the file.
    const lines = String(text).split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
    const pairs = [];
    for (let index = 0; index + 1 < lines.length; index += 1) {
        const code = Number.parseInt(lines[index].trim(), 10);
        if (!/^\s*-?\d+\s*$/.test(lines[index])) continue;
        pairs.push({ code, value: lines[index + 1] });
        index += 1;
    }
    return pairs;
}

const numberAt = (entity, code, fallback = null) => {
    const pair = entity.values.find((entry) => entry.code === code);
    if (!pair) return fallback;
    const value = Number.parseFloat(pair.value);
    return Number.isFinite(value) ? value : fallback;
};

const textAt = (entity, code, fallback = '') => {
    const pair = entity.values.find((entry) => entry.code === code);
    return pair ? String(pair.value).trim() : fallback;
};

const numbersAt = (entity, code) => entity.values
    .filter((entry) => entry.code === code)
    .map((entry) => Number.parseFloat(entry.value))
    .filter((value) => Number.isFinite(value));

/**
 * Split the pair stream into HEADER variables and ENTITIES/BLOCKS records.
 * Each entity is `{ type, values }` with the 0/… record's pairs in order.
 */
export function readDxfRecords(text) {
    const pairs = readPairs(text);
    const header = {};
    const entities = [];
    const blocks = [];

    let section = null;
    let current = null;
    let headerVar = null;

    for (let index = 0; index < pairs.length; index += 1) {
        const pair = pairs[index];
        const next = pairs[index + 1];

        if (pair.code === 0 && pair.value.trim() === 'SECTION') {
            section = next && next.code === 2 ? next.value.trim() : null;
            index += 1;
            current = null;
            continue;
        }
        if (pair.code === 0 && pair.value.trim() === 'ENDSEC') {
            section = null;
            current = null;
            continue;
        }

        if (section === 'HEADER') {
            if (pair.code === 9) {
                headerVar = pair.value.trim();
                header[headerVar] = [];
            } else if (headerVar) {
                header[headerVar].push(pair);
            }
            continue;
        }

        if (section !== 'ENTITIES' && section !== 'BLOCKS') continue;

        if (pair.code === 0) {
            const type = pair.value.trim();
            if (type === 'ENDSEC') break;
            current = { type, values: [], section };
            if (section === 'BLOCKS') blocks.push(current);
            else entities.push(current);
            continue;
        }
        if (current) current.values.push(pair);
    }

    const scalar = (name) => {
        const list = header[name];
        if (!list || !list.length) return null;
        const numeric = Number.parseFloat(list[list.length - 1].value);
        return Number.isFinite(numeric) ? numeric : list[list.length - 1].value.trim();
    };

    return {
        entities,
        blocks,
        header: {
            insUnits: Number.isFinite(scalar('$INSUNITS')) ? scalar('$INSUNITS') : 0,
            measurement: Number.isFinite(scalar('$MEASUREMENT')) ? scalar('$MEASUREMENT') : null,
            // $EXTMIN/$EXTMAX are 3 codes each (x, y, z); keep the x/y pair.
            extMin: header.$EXTMIN ? header.$EXTMIN.filter((p) => p.code === 10 || p.code === 20).map((p) => Number.parseFloat(p.value)) : null,
            extMax: header.$EXTMAX ? header.$EXTMAX.filter((p) => p.code === 10 || p.code === 20).map((p) => Number.parseFloat(p.value)) : null
        }
    };
}

/** Number of chords to use so a curve reads smoothly at plan scale. */
function curveSteps(radiusMetres, sweepDegrees) {
    const sweep = Math.abs(sweepDegrees) * (Math.PI / 180);
    // One chord per ~6 degrees, at least 4, at most 64.
    const byAngle = Math.ceil(sweep / (Math.PI / 30));
    const bySize = Math.ceil((radiusMetres || 1) * 2);
    return Math.max(4, Math.min(64, Math.max(byAngle, bySize)));
}

const toRadians = (degrees) => (Number(degrees) || 0) * (Math.PI / 180);

function arcPoints({ cx, cy, radius, startDeg, endDeg }) {
    let sweep = (Number(endDeg) - Number(startDeg)) % 360;
    if (sweep <= 0) sweep += 360;
    const steps = curveSteps(radius, sweep);
    const points = [];
    for (let step = 0; step <= steps; step += 1) {
        const angle = toRadians(Number(startDeg) + (sweep * step) / steps);
        points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    return points;
}

function ellipsePoints({ cx, cy, majorX, majorY, ratio, startParam, endParam }) {
    const majorLength = Math.hypot(majorX, majorY);
    if (!majorLength) return [];
    const minorLength = majorLength * (Number(ratio) || 1);
    const rotation = Math.atan2(majorY, majorX);
    let sweep = (Number(endParam) - Number(startParam)) || Math.PI * 2;
    if (sweep <= 0) sweep += Math.PI * 2;
    const steps = Math.max(8, Math.min(64, Math.ceil((sweep / (Math.PI * 2)) * 48)));
    const points = [];
    for (let step = 0; step <= steps; step += 1) {
        const parameter = Number(startParam) + (sweep * step) / steps;
        const x = majorLength * Math.cos(parameter);
        const y = minorLength * Math.sin(parameter);
        points.push({
            x: cx + x * Math.cos(rotation) - y * Math.sin(rotation),
            y: cy + x * Math.sin(rotation) + y * Math.cos(rotation)
        });
    }
    return points;
}

const pointsToSegments = (points, closed) => {
    const segments = [];
    for (let index = 1; index < points.length; index += 1) {
        segments.push({ a: points[index - 1], b: points[index] });
    }
    if (closed && points.length > 2) {
        const first = points[0];
        const last = points[points.length - 1];
        if (Math.hypot(first.x - last.x, first.y - last.y) > 1e-9) segments.push({ a: last, b: first });
    }
    return segments;
};

/**
 * Convert the DXF entities into straight segments in the drawing's own units.
 * Returns `{ segments, stats }`; `stats` counts what was read and what was not.
 */
export function readDxfGeometry(text) {
    const { entities, header } = readDxfRecords(text);
    const segments = [];
    const stats = {
        lines: 0,
        polylines: 0,
        arcs: 0,
        circles: 0,
        ellipses: 0,
        inserts: 0,
        blocks: 0,
        unsupported: 0,
        skipped: 0
    };

    // POLYLINE keeps its VERTEX sub-entities in the same stream; consume them
    // together so a vertex is never counted as a standalone entity.
    for (let index = 0; index < entities.length; index += 1) {
        const entity = entities[index];
        switch (entity.type) {
            case 'LINE': {
                const x1 = numberAt(entity, 10, NaN);
                const y1 = numberAt(entity, 20, NaN);
                const x2 = numberAt(entity, 11, NaN);
                const y2 = numberAt(entity, 21, NaN);
                if ([x1, y1, x2, y2].some((value) => !Number.isFinite(value))) {
                    stats.skipped += 1;
                    break;
                }
                stats.lines += 1;
                segments.push({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 } });
                break;
            }
            case 'LWPOLYLINE': {
                const xs = numbersAt(entity, 10);
                const ys = numbersAt(entity, 20);
                const count = Math.min(xs.length, ys.length);
                const points = [];
                for (let vertex = 0; vertex < count; vertex += 1) points.push({ x: xs[vertex], y: ys[vertex] });
                const closed = (numberAt(entity, 70, 0) & 1) === 1;
                if (points.length < 2) {
                    stats.skipped += 1;
                    break;
                }
                stats.polylines += 1;
                segments.push(...pointsToSegments(points, closed));
                break;
            }
            case 'POLYLINE': {
                const points = [];
                let lookahead = index + 1;
                while (lookahead < entities.length && entities[lookahead].type === 'VERTEX') {
                    const x = numberAt(entities[lookahead], 10, NaN);
                    const y = numberAt(entities[lookahead], 20, NaN);
                    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
                    lookahead += 1;
                }
                if (lookahead < entities.length && entities[lookahead].type === 'SEQEND') lookahead += 1;
                index = lookahead - 1;
                const closed = (numberAt(entity, 70, 0) & 1) === 1;
                if (points.length < 2) {
                    stats.skipped += 1;
                    break;
                }
                stats.polylines += 1;
                segments.push(...pointsToSegments(points, closed));
                break;
            }
            case 'ARC': {
                const cx = numberAt(entity, 10, NaN);
                const cy = numberAt(entity, 20, NaN);
                const radius = numberAt(entity, 40, NaN);
                if ([cx, cy, radius].some((value) => !Number.isFinite(value)) || radius <= 0) {
                    stats.skipped += 1;
                    break;
                }
                stats.arcs += 1;
                const points = arcPoints({
                    cx,
                    cy,
                    radius,
                    startDeg: numberAt(entity, 50, 0),
                    endDeg: numberAt(entity, 51, 360)
                });
                segments.push(...pointsToSegments(points, false));
                break;
            }
            case 'CIRCLE': {
                const cx = numberAt(entity, 10, NaN);
                const cy = numberAt(entity, 20, NaN);
                const radius = numberAt(entity, 40, NaN);
                if ([cx, cy, radius].some((value) => !Number.isFinite(value)) || radius <= 0) {
                    stats.skipped += 1;
                    break;
                }
                stats.circles += 1;
                segments.push(...pointsToSegments(arcPoints({ cx, cy, radius, startDeg: 0, endDeg: 360 }), true));
                break;
            }
            case 'ELLIPSE': {
                const cx = numberAt(entity, 10, NaN);
                const cy = numberAt(entity, 20, NaN);
                const majorX = numberAt(entity, 11, NaN);
                const majorY = numberAt(entity, 21, NaN);
                if ([cx, cy, majorX, majorY].some((value) => !Number.isFinite(value))) {
                    stats.skipped += 1;
                    break;
                }
                stats.ellipses += 1;
                const full = numberAt(entity, 41, 0) === 0 && numberAt(entity, 42, 0) === 0;
                segments.push(...pointsToSegments(ellipsePoints({
                    cx,
                    cy,
                    majorX,
                    majorY,
                    ratio: numberAt(entity, 40, 1),
                    startParam: numberAt(entity, 41, 0),
                    endParam: numberAt(entity, 42, Math.PI * 2)
                }), full));
                break;
            }
            case 'INSERT':
            case 'MINSERT':
                // Blocks are counted, not exploded: a block's geometry is in
                // world units at an arbitrary transform, and drawing it as walls
                // would be a guess about intent.
                stats.inserts += 1;
                break;
            case 'SPLINE':
            case '3DFACE':
            case 'MESH':
            case 'HATCH':
            case 'DIMENSION':
            case 'TEXT':
            case 'MTEXT':
            case 'POINT':
            case 'VERTEX':
            case 'SEQEND':
                stats.unsupported += 1;
                break;
            default:
                stats.skipped += 1;
                break;
        }
    }

    return { segments, header, stats };
}

const cleanSegments = (segments, minLength) => {
    const kept = [];
    const seen = new Set();
    for (const segment of segments) {
        const length = Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
        if (!(length > 0) || length < minLength) continue;
        // CAD drawings often carry each wall twice; drop the exact duplicate.
        const key = [segment.a.x, segment.a.y, segment.b.x, segment.b.y]
            .map((value) => Math.round(value * 1000) / 1000)
            .join(',');
        const reverse = [segment.b.x, segment.b.y, segment.a.x, segment.a.y]
            .map((value) => Math.round(value * 1000) / 1000)
            .join(',');
        if (seen.has(key) || seen.has(reverse)) continue;
        seen.add(key);
        kept.push(segment);
    }
    return kept;
};

/**
 * Import a DXF as plan segments in metres (y still up, CAD convention).
 *
 * `unitScale` overrides the header, which is what a unitless drawing needs.
 */
export function dxfToSegments(text, { unitScale = null, minLengthMetres = 0.02 } = {}) {
    const { segments, header, stats } = readDxfGeometry(text);
    const unit = INS_UNITS[header.insUnits] || INS_UNITS[0];
    const metresPerUnit = unitScale ?? unit.metres ?? 1;
    const scaled = segments.map((segment) => ({
        a: { x: segment.a.x * metresPerUnit, y: segment.a.y * metresPerUnit },
        b: { x: segment.b.x * metresPerUnit, y: segment.b.y * metresPerUnit }
    }));
    const cleaned = cleanSegments(scaled, minLengthMetres);
    return {
        segments: cleaned,
        units: { code: header.insUnits, label: unitScale ? 'custom' : unit.label, metresPerUnit },
        stats: { ...stats, segments: segments.length, kept: cleaned.length }
    };
}

/** Axis-aligned bounds of a segment list, in the same units. */
export function segmentBounds(segments) {
    if (!segments.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const segment of segments) {
        for (const point of [segment.a, segment.b]) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
    }
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Place an imported drawing in the plan's canvas-pixel space.
 *
 * The drawing keeps its real-world size (`pixelsPerMeter`), is centred in the
 * given view, and only falls back to a fit scale when it is larger than the
 * view — an oversized CAD sheet should arrive visible, not a metre wide in the
 * corner. This is the same frame the image and AI imports use.
 */
export function dxfToPlan(text, {
    view = { width: 1200, height: 800 },
    pixelsPerMeter = PIXELS_PER_METER,
    thickness = 10,
    unitScale = null,
    fit = 0.9
} = {}) {
    const { segments, units, stats } = dxfToSegments(text, { unitScale });
    const bounds = segmentBounds(segments);

    const warnings = [];
    if (!units.metresPerUnit || units.label === 'unitless') {
        warnings.push('The drawing declares no units; assuming metres. Set the drawing units in CAD and re-export, or pass unitScale.');
    }
    if (stats.inserts) warnings.push(`${stats.inserts} block insertion(s) were skipped; explode blocks before exporting for a full trace.`);
    if (stats.unsupported) warnings.push(`${stats.unsupported} entity type(s) are not supported (splines, hatches, text, dimensions).`);

    if (!bounds) {
        return {
            walls: [],
            units,
            stats,
            bounds: null,
            scale: 1,
            warnings: [...warnings, 'The drawing has no lines, polylines or curves.']
        };
    }

    const widthPx = bounds.width * pixelsPerMeter;
    const heightPx = bounds.height * pixelsPerMeter;
    const fitScale = Math.min(
        1,
        Number(view.width) > 0 ? (Number(view.width) * fit) / Math.max(widthPx, 1) : 1,
        Number(view.height) > 0 ? (Number(view.height) * fit) / Math.max(heightPx, 1) : 1
    );
    const centreX = Number(view.width) / 2 || 0;
    const centreY = Number(view.height) / 2 || 0;
    const drawingCentreX = (bounds.minX + bounds.maxX) / 2;
    const drawingCentreY = (bounds.minY + bounds.maxY) / 2;

    const toCanvas = (point) => ({
        x: centreX + (point.x - drawingCentreX) * pixelsPerMeter * fitScale,
        // CAD y grows up, the plan's y grows down.
        y: centreY - (point.y - drawingCentreY) * pixelsPerMeter * fitScale
    });

    const walls = segments.map((segment) => {
        const a = toCanvas(segment.a);
        const b = toCanvas(segment.b);
        return {
            start: { x: Math.round(a.x * 1000) / 1000, y: Math.round(a.y * 1000) / 1000 },
            end: { x: Math.round(b.x * 1000) / 1000, y: Math.round(b.y * 1000) / 1000 },
            thickness
        };
    });

    return {
        walls,
        units,
        stats,
        bounds,
        scale: fitScale,
        metresPerPixel: 1 / (pixelsPerMeter * fitScale),
        warnings
    };
}
