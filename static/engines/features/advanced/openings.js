import { PIXELS_PER_METER, WINDOW_SILL_HEIGHT } from '../../core/world-space.js';

/**
 * Advanced feature 23 - openings per wall with cut validation.
 *
 * ConversionEngine3D already subtracts one brush per opening, but it trusted
 * the fixture position and metadata blindly: a door dragged past the end of its
 * wall, or two windows stacked on the same spot, produced holes hanging off the
 * wall or a single over-broad cut. These helpers clamp each opening to the wall
 * and separate overlapping openings before the CSG runs, and report what was
 * changed.
 */

export const MIN_OPENING_GAP = 0.05; // metres between two openings

export const OPENING_TYPES = ['window', 'round_window', 'door'];

export function isOpening(fixture) {
    return Boolean(fixture) && OPENING_TYPES.includes(fixture.type);
}

export function wallFrame(wall) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lengthPixels = Math.hypot(dx, dy) || 1;
    return {
        dir: { x: dx / lengthPixels, y: dy / lengthPixels },
        lengthPixels,
        lengthMetres: lengthPixels / PIXELS_PER_METER
    };
}

/**
 * Openings on one wall, clamped so each fits and none overlaps its neighbour.
 * Returns entries in wall order with the plan position of each centre, so the
 * engine can build the hole brush straight from them.
 */
export function openingsForWall(wall, fixtures = [], { gap = MIN_OPENING_GAP } = {}) {
    if (!wall?.start || !wall?.end) return [];

    const frame = wallFrame(wall);
    const entries = [];

    (fixtures || []).forEach((fixture) => {
        if (!fixture || !isOpening(fixture)) return;
        if (fixture.boundToWallId !== wall.id) return;

        const width = Math.max(0.1, fixture.metadata?.width ?? 1);
        const height = Math.max(0.1, fixture.metadata?.height ?? 1);
        const alongPixels = (fixture.x - wall.start.x) * frame.dir.x
            + (fixture.y - wall.start.y) * frame.dir.y;

        entries.push({
            fixture,
            width,
            height,
            sill: fixture.type === 'door' ? 0 : (fixture.metadata?.sillHeight ?? fixture.metadata?.altitude ?? WINDOW_SILL_HEIGHT),
            shape: fixture.metadata?.shape === 'circle' ? 'circle' : 'rect',
            alongMetres: alongPixels / PIXELS_PER_METER,
            clamped: false
        });
    });

    if (entries.length === 0) return [];

    entries.sort((a, b) => a.alongMetres - b.alongMetres);

    // Clamp to the wall, then push later openings far enough right that they
    // never share a cut. The whole set is finally shifted back inside the wall.
    entries.forEach((entry) => {
        const min = entry.width / 2;
        const max = Math.max(min, frame.lengthMetres - entry.width / 2);
        const clamped = Math.min(max, Math.max(min, entry.alongMetres));
        if (clamped !== entry.alongMetres) entry.clamped = true;
        entry.alongMetres = clamped;
    });

    for (let i = 1; i < entries.length; i++) {
        const previous = entries[i - 1];
        // Edge-to-edge: half of each opening plus the gap between them.
        const minimum = previous.alongMetres + previous.width / 2 + entries[i].width / 2 + gap;
        if (entries[i].alongMetres < minimum) {
            entries[i].alongMetres = minimum;
            entries[i].clamped = true;
        }
    }

    const last = entries[entries.length - 1];
    const overflow = last.alongMetres + last.width / 2 - frame.lengthMetres;
    if (overflow > 0) {
        entries.forEach((entry) => {
            entry.alongMetres -= overflow;
            entry.clamped = true;
        });
    }

    return entries.map((entry) => ({
        ...entry,
        plan: {
            x: wall.start.x + frame.dir.x * entry.alongMetres * PIXELS_PER_METER,
            y: wall.start.y + frame.dir.y * entry.alongMetres * PIXELS_PER_METER
        },
        rotation: Math.atan2(frame.dir.y, frame.dir.x)
    }));
}

/** True when this wall's openings had to be moved to stay valid. */
export function openingReport(wall, fixtures) {
    const entries = openingsForWall(wall, fixtures);
    return {
        wallId: wall.id,
        count: entries.length,
        clamped: entries.filter((entry) => entry.clamped).map((entry) => entry.fixture.id)
    };
}

/** Every clamped opening on the plan, for the warning panel. */
export function clampedOpenings(walls = [], fixtures = []) {
    const report = [];
    walls.forEach((wall) => {
        const entries = openingsForWall(wall, fixtures);
        entries.forEach((entry) => {
            if (entry.clamped) report.push({ wallId: wall.id, fixtureId: entry.fixture.id });
        });
    });
    return report;
}
