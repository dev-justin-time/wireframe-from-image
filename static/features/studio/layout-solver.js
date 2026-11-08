import { PIXELS_PER_METER, WALL_THICKNESS } from '../../core/world-space.js';
import { itemDimensions } from '../../core/items.js';
import { KITCHEN_GAPS } from '../kitchen/catalog.js';

/**
 * Studio feature 46 - kitchen layout solver.
 *
 * The rules are the NKBA planning guidelines that apply to a plan we can
 * measure: the work triangle legs and total, a 42 inch (1.07 m) clear aisle
 * between opposing runs, and landing space beside the sink and the range. The
 * solver reports issues and can propose a base-cabinet run along the longest
 * wall for the editor to insert.
 */

// The gap minima are the kitchen suite's, not a second copy: one plan cannot
// pass the kitchen run check and fail this one on the same landing.
export const NKBA = {
    aisle: KITCHEN_GAPS.aisleMin,                 // 42 in clear floor between runs
    triangleLegMin: 1.2,                          // 4 ft
    triangleLegMax: 2.7,                          // 9 ft
    triangleTotalMin: 4.0,
    triangleTotalMax: 8.0,
    sinkLanding: KITCHEN_GAPS.sinkLanding,        // 24 in
    stoveLanding: KITCHEN_GAPS.rangeLanding,      // 15 in (36 in on one side preferred)
    counterDepth: KITCHEN_GAPS.counterDepth
};

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function classifyFixture(item) {
    const type = String(item?.type || '');
    if (type.includes('sink')) return 'sink';
    if (type === 'stove' || type.includes('range') || type.includes('oven')) return 'stove';
    if (type.includes('fridge') || type.includes('refrigerator')) return 'fridge';
    if (type.includes('cabinet') || type.includes('pantry') || type.includes('island')) return 'cabinet';
    return 'other';
}

export function layoutPoints(fixtures = [], view = { width: 1, height: 1 }) {
    return (fixtures || [])
        .filter((item) => item && item.visible !== false)
        .map((item) => ({
            item,
            role: classifyFixture(item),
            point: {
                x: (item.x - view.width / 2) / PIXELS_PER_METER,
                z: (item.y - view.height / 2) / PIXELS_PER_METER
            },
            rotation: item.rotation || 0,
            dims: itemDimensions(item)
        }));
}

function distance(a, b) {
    return Math.hypot(b.x - a.x, b.z - a.z);
}

function aisleBetween(a, b) {
    // Only opposing/parallel runs define an aisle.
    if (Math.abs(Math.abs(wrap(a.rotation - b.rotation)) - Math.PI) > 0.35) return null;
    const normal = { x: -Math.sin(a.rotation), z: Math.cos(a.rotation) };
    const gap = Math.abs((b.point.x - a.point.x) * normal.x + (b.point.z - a.point.z) * normal.z)
        - (a.dims.depth + b.dims.depth) / 2;
    return gap;
}

/**
 * Analyse a kitchen plan. Returns
 *   { score, issues, triangle: {sink, stove, fridge, legs, total}, counts }
 */
export function analyzeLayout({ fixtures = [], view = { width: 1, height: 1 } } = {}) {
    const points = layoutPoints(fixtures, view);
    const byRole = (role) => points.filter((entry) => entry.role === role);
    const sink = byRole('sink')[0] || null;
    const stove = byRole('stove')[0] || null;
    const fridge = byRole('fridge')[0] || null;
    const cabinets = byRole('cabinet');

    const issues = [];
    const add = (code, severity, message) => issues.push({ code, severity, message });

    let legs = null;
    let total = null;

    if (!sink) add('missing-sink', 'info', 'No sink placed yet.');
    if (!stove) add('missing-stove', 'info', 'No range or cooktop placed yet.');
    if (!fridge) add('missing-fridge', 'info', 'No refrigerator placed yet.');

    if (sink && stove && fridge) {
        const a = distance(sink.point, stove.point);
        const b = distance(stove.point, fridge.point);
        const c = distance(fridge.point, sink.point);
        legs = { sinkStove: a, stoveFridge: b, fridgeSink: c };
        total = a + b + c;

        [['sink–range', a], ['range–fridge', b], ['fridge–sink', c]].forEach(([label, value]) => {
            if (value < NKBA.triangleLegMin) {
                add('triangle-leg-short', 'warning', `${label} leg is ${value.toFixed(2)} m (min ${NKBA.triangleLegMin} m)`);
            } else if (value > NKBA.triangleLegMax) {
                add('triangle-leg-long', 'warning', `${label} leg is ${value.toFixed(2)} m (max ${NKBA.triangleLegMax} m)`);
            }
        });

        if (total < NKBA.triangleTotalMin) {
            add('triangle-small', 'info', `Work triangle is ${total.toFixed(2)} m (min ${NKBA.triangleTotalMin} m)`);
        } else if (total > NKBA.triangleTotalMax) {
            add('triangle-large', 'warning', `Work triangle is ${total.toFixed(2)} m (max ${NKBA.triangleTotalMax} m)`);
        }
    }

    // Aisle clearance between opposing runs.
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            if (!['cabinet', 'sink', 'stove'].includes(points[i].role)) continue;
            if (!['cabinet', 'sink', 'stove'].includes(points[j].role)) continue;
            const gap = aisleBetween(points[i], points[j]);
            if (gap == null) continue;
            if (gap < NKBA.aisle - 0.01) {
                add('aisle', 'warning', `Aisle ${gap.toFixed(2)} m (min ${NKBA.aisle} m)`);
            }
        }
    }

    // Landing space: counter beside the sink and range.
    const landings = [
        { role: 'sink', target: sink, min: NKBA.sinkLanding },
        { role: 'stove', target: stove, min: NKBA.stoveLanding }
    ];
    landings.forEach(({ target, min }) => {
        if (!target) return;
        const neighbours = cabinets
            .map((cabinet) => ({ cabinet, gap: distance(cabinet.point, target.point) }))
            .filter((entry) => entry.gap <= (entry.cabinet.dims.width + target.dims.width) / 2 + min + 0.35);

        if (neighbours.length === 0) {
            add('landing', 'warning', `No landing space beside the ${target.role}.`);
        }
    });

    const penalty = issues.reduce((sum, issue) => sum + (issue.severity === 'warning' ? 12 : 2), 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));

    return {
        score,
        issues,
        triangle: legs ? { ...legs, total } : null,
        counts: { sink: sink ? 1 : 0, stove: stove ? 1 : 0, fridge: fridge ? 1 : 0, cabinets: cabinets.length },
        measured: points.length
    };
}

/**
 * Propose a base-cabinet run along the longest wall, inset from the corner.
 * Positions are plan pixels, ready for ItemFactory.create.
 */
export function suggestRun({ walls = [], count = 5, width = 0.762, type = 'kitchen_cabinet' } = {}) {
    if (!walls?.length) return [];

    const usable = walls.filter((wall) => wall?.start && wall?.end);
    if (usable.length === 0) return [];

    const longest = usable.reduce((best, wall) => {
        const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
        return !best || length > best.length ? { wall, length } : best;
    }, null);

    const { wall, length } = longest;
    const dx = (wall.end.x - wall.start.x) / length;
    const dy = (wall.end.y - wall.start.y) / length;
    const angle = Math.atan2(dy, dx);

    // Pick the normal that points toward the rest of the plan.
    let cx = 0, cy = 0, n = 0;
    usable.forEach((entry) => {
        cx += (entry.start.x + entry.end.x) / 2;
        cy += (entry.start.y + entry.end.y) / 2;
        n += 1;
    });
    cx /= n || 1;
    cy /= n || 1;

    const normal = { x: -dy, y: dx };
    const mid = {
        x: (wall.start.x + wall.end.x) / 2,
        y: (wall.start.y + wall.end.y) / 2
    };
    if ((cx - mid.x) * normal.x + (cy - mid.y) * normal.y < 0) {
        normal.x = -normal.x;
        normal.y = -normal.y;
    }

    const depth = 0.6;
    const offset = (WALL_THICKNESS * PIXELS_PER_METER) / 2 + (depth * PIXELS_PER_METER) / 2;
    const pitch = width * PIXELS_PER_METER;
    const total = count * pitch;
    if (total > length - 2) return [];

    const start = {
        x: wall.start.x + dx * (pitch / 2 + 2) + normal.x * offset,
        y: wall.start.y + dy * (pitch / 2 + 2) + normal.y * offset
    };

    return Array.from({ length: count }, (_, index) => ({
        type,
        x: start.x + dx * pitch * index,
        y: start.y + dy * pitch * index,
        rotation: angle
    }));
}

export function formatAnalysis(report) {
    if (!report) return [];
    const lines = [`Score ${report.score}/100`];
    if (report.triangle) {
        lines.push(`Work triangle ${report.triangle.total.toFixed(2)} m`);
    }
    report.issues.forEach((issue) => lines.push(`${issue.severity === 'warning' ? '⚠' : 'ℹ'} ${issue.message}`));
    return lines;
}
