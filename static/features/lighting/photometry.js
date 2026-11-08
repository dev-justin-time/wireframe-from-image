/**
 * Photometry for the lighting suite.
 *
 * The lumen method gives the maintained average illuminance the design is
 * checked against; a point-by-point grid gives the uniformity and the heatmap.
 * Both are deliberately simple, deterministic approximations - good enough to
 * compare layouts, not a substitute for a lighting calculation from a
 * manufacturer's photometric file.
 */

export const DEFAULT_REFLECTANCES = {
    ceiling: 0.8,
    wall: 0.5,
    floor: 0.2
};

export const DEFAULT_LLF = 0.8;

/** Room index: the shape factor used by the lumen method. */
export function roomIndex(width, depth, mountingHeight) {
    const w = Math.max(Number(width) || 0, 0.1);
    const d = Math.max(Number(depth) || 0, 0.1);
    const h = Math.max(Number(mountingHeight) || 0, 0.1);
    return (w * d) / (h * (w + d));
}

/**
 * Coefficient of utilization from the room index and surface reflectances.
 * The base curve is a mid-range luminaire; the reflectance terms nudge it for
 * a bright ceiling and light walls. Clamped so a strange input cannot produce
 * an impossible result.
 */
export function coefficientOfUtilization(index, reflectances = DEFAULT_REFLECTANCES) {
    const k = Math.max(Number(index) || 0, 0);
    let cu;
    if (k < 0.7) cu = 0.44;
    else if (k < 1.0) cu = 0.52;
    else if (k < 1.5) cu = 0.60;
    else if (k < 2.0) cu = 0.66;
    else if (k < 3.0) cu = 0.72;
    else if (k < 5.0) cu = 0.77;
    else cu = 0.80;
    const ceiling = Number(reflectances?.ceiling ?? DEFAULT_REFLECTANCES.ceiling);
    const wall = Number(reflectances?.wall ?? DEFAULT_REFLECTANCES.wall);
    cu += (ceiling - 0.7) * 0.08;
    cu += (wall - 0.5) * 0.06;
    return Math.min(Math.max(cu, 0.35), 0.88);
}

/** Maintained average illuminance from the lumen method. */
export function lumenMethod({
    totalLumens = 0,
    width = 0,
    depth = 0,
    mountingHeight = 2.4,
    reflectances = DEFAULT_REFLECTANCES,
    llf = DEFAULT_LLF
} = {}) {
    const area = Math.max((Number(width) || 0) * (Number(depth) || 0), 0.1);
    const index = roomIndex(width, depth, mountingHeight);
    const cu = coefficientOfUtilization(index, reflectances);
    return {
        area,
        roomIndex: index,
        cu,
        llf,
        averageLux: (Math.max(Number(totalLumens) || 0, 0) * cu * llf) / area,
        totalLumens: Math.max(Number(totalLumens) || 0, 0)
    };
}

/**
 * Illuminance at one point from a set of point sources. `intensity` is the
 * luminous intensity towards the point; a downlight is approximated as a
 * hemisphere, so its intensity is lumens / pi. Each luminaire carries its own
 * absolute mount height, and the calculation drops to the work plane (0.75 m by
 * default).
 */
export function illuminanceAt(point, luminaires = [], workPlane = 0.75) {
    let lux = 0;
    luminaires.forEach((luminaire) => {
        if (luminaire?.on === false) return;
        const dx = (point.x ?? 0) - (luminaire.x ?? 0);
        const dy = (point.y ?? 0) - (luminaire.y ?? 0);
        const h = Math.max((luminaire.mountHeight ?? 2.4) - workPlane, 0.1);
        const distanceSquared = dx * dx + dy * dy + h * h;
        const distance = Math.sqrt(distanceSquared);
        const cos = h / distance;
        const intensity = (luminaire.lumens ?? 0) / Math.PI;
        lux += (intensity * cos) / distanceSquared;
    });
    return lux;
}

/**
 * A square sample grid across the room. Values are returned row-major from the
 * top-left corner, matching the plan coordinates.
 */
export function illuminanceGrid({
    width = 5,
    depth = 4,
    mountingHeight = 2.4,
    workPlane = 0.75,
    luminaires = [],
    steps = 16
} = {}) {
    const w = Math.max(Number(width) || 0.1, 0.1);
    const d = Math.max(Number(depth) || 0.1, 0.1);
    const n = Math.min(Math.max(Math.round(steps) || 16, 4), 60);
    const values = [];
    let min = Infinity;
    let max = 0;
    let sum = 0;
    for (let row = 0; row < n; row += 1) {
        const y = ((row + 0.5) / n) * d;
        for (let col = 0; col < n; col += 1) {
            const x = ((col + 0.5) / n) * w;
            const lux = illuminanceAt({ x, y }, luminaires.map((light) => ({
                ...light,
                mountHeight: light.mountHeight ?? mountingHeight
            })), workPlane);
            values.push(lux);
            min = Math.min(min, lux);
            max = Math.max(max, lux);
            sum += lux;
        }
    }
    const average = values.length ? sum / values.length : 0;
    return {
        width: w,
        depth: d,
        steps: n,
        values,
        min: Number.isFinite(min) ? min : 0,
        max,
        average,
        uniformity: max > 0 ? min / max : 0,
        averageToMin: average > 0 ? min / average : 0
    };
}

/** Uniformity summary for a grid or a list of sample values. */
export function uniformityStats(values = []) {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) return { min: 0, max: 0, average: 0, uniformity: 0 };
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const average = finite.reduce((sum, value) => sum + value, 0) / finite.length;
    return { min, max, average, uniformity: max > 0 ? min / max : 0 };
}

/** Blue (dark) to amber (bright) for the plan heatmap. */
export function luxColour(lux, maximum = 1) {
    const ratio = Math.min(Math.max(lux / Math.max(maximum, 1e-9), 0), 1);
    const stops = [
        { at: 0, colour: [30, 58, 95] },
        { at: 0.35, colour: [14, 165, 233] },
        { at: 0.65, colour: [250, 204, 21] },
        { at: 1, colour: [249, 115, 22] }
    ];
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let i = 1; i < stops.length; i += 1) {
        if (ratio <= stops[i].at) {
            lower = stops[i - 1];
            upper = stops[i];
            break;
        }
    }
    const span = upper.at - lower.at || 1;
    const t = (ratio - lower.at) / span;
    const mix = lower.colour.map((channel, index) => Math.round(channel + (upper.colour[index] - channel) * t));
    return `rgba(${mix[0]}, ${mix[1]}, ${mix[2]}, 0.42)`;
}

/** Recommended spacing between fittings at a mounting height. */
export function spacingFor(luminaire, mountingHeight) {
    return Math.max((luminaire?.spacingRatio ?? 1.1) * Math.max(mountingHeight, 0.5), 0.6);
}
