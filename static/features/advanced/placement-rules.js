import { PIXELS_PER_METER, WALL_THICKNESS, WINDOW_SILL_HEIGHT } from '../../core/world-space.js';
import { itemDimensions } from '../../core/items.js';
import { findOverlaps } from './collision.js';

/**
 * Advanced feature 22 - wall-aware placement warnings.
 *
 * A small rule list over ITEM_METADATA, evaluated against the plan:
 *
 *   door/window in a corner   the opening is closer to a wall end than half its
 *                             own width, so the casing would clip the corner
 *   opening with no wall      an in-wall item that lost its host wall
 *   window over a counter     a window whose sill is below a base cabinet's top
 *   overlapping items         any two footprints that intersect (feature 21)
 *
 * Warnings never block an edit; they are reported in the sidebar and cleared /
 * recomputed on every save.
 */

const NEAR_CORNER = 0.10; // metres of casing clearance

const labelOf = (fixture) => fixture?.metadata?.label || String(fixture?.type || 'item').replace(/_/g, ' ');

const isOpening = (fixture) => ['in_wall', 'in_wall_floor'].includes(fixture?.metadata?.type);

function wallEndDistances(wall, point) {
    return {
        start: Math.hypot(point.x - wall.start.x, point.y - wall.start.y) / PIXELS_PER_METER,
        end: Math.hypot(point.x - wall.end.x, point.y - wall.end.y) / PIXELS_PER_METER
    };
}

/** Project a point onto a wall, returning distance along the wall in metres. */
function alongWall(wall, point) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lengthSq = dx * dx + dy * dy || 1;
    const t = ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lengthSq;
    return { t, metres: t * Math.hypot(dx, dy) / PIXELS_PER_METER };
}

export function validatePlacements({ fixtures = [], walls = [], view = null } = {}) {
    const warnings = [];
    const wallById = new Map((walls || []).map((wall) => [wall.id, wall]));

    (fixtures || []).forEach((fixture) => {
        if (!fixture || fixture.visible === false) return;
        const dims = itemDimensions(fixture);
        const halfWidth = dims.width / 2;

        if (isOpening(fixture)) {
            const wall = wallById.get(fixture.boundToWallId) || null;
            if (!wall) {
                warnings.push({
                    fixtureId: fixture.id,
                    code: 'opening-no-wall',
                    severity: 'error',
                    message: `${labelOf(fixture)} is not attached to a wall`
                });
                return;
            }

            const ends = wallEndDistances(wall, fixture);
            const nearest = Math.min(ends.start, ends.end);
            if (nearest < halfWidth + NEAR_CORNER) {
                warnings.push({
                    fixtureId: fixture.id,
                    code: 'opening-corner',
                    severity: 'warning',
                    message: `${labelOf(fixture)} is ${(nearest * 100).toFixed(0)} cm from a wall end`
                });
            }

            // Window over a counter: the sill sits below the top of a base unit
            // standing against the same wall.
            if (fixture.type === 'window' || fixture.type === 'round_window') {
                const sill = fixture.metadata?.sillHeight ?? WINDOW_SILL_HEIGHT;
                const windowAlong = alongWall(wall, fixture);

                fixtures.forEach((other) => {
                    if (!other || other === fixture || other.visible === false) return;
                    if (other.metadata?.type !== 'floor') return;
                    if (other.boundToWallId && other.boundToWallId !== wall.id) return;

                    const top = other.metadata?.mountHeight
                        ? other.metadata.mountHeight + itemDimensions(other).height
                        : itemDimensions(other).height;
                    if (top <= sill + 0.02) return;

                    const otherAlong = alongWall(wall, other);
                    const span = (halfWidth + itemDimensions(other).width / 2);
                    if (Math.abs(otherAlong.metres - windowAlong.metres) > span) return;

                    warnings.push({
                        fixtureId: fixture.id,
                        code: 'window-over-counter',
                        severity: 'warning',
                        message: `${labelOf(fixture)} overlaps ${labelOf(other)} (${top.toFixed(2)} m top vs ${sill.toFixed(2)} m sill)`
                    });
                });
            }
        }

        // A piece dropped outside the drawn walls is almost always a mistake.
        if (view && Array.isArray(walls) && walls.length >= 3) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            walls.forEach((wall) => {
                minX = Math.min(minX, wall.start.x, wall.end.x);
                maxX = Math.max(maxX, wall.start.x, wall.end.x);
                minY = Math.min(minY, wall.start.y, wall.end.y);
                maxY = Math.max(maxY, wall.start.y, wall.end.y);
            });
            const margin = WALL_THICKNESS * PIXELS_PER_METER;
            if (fixture.x < minX - margin || fixture.x > maxX + margin
                || fixture.y < minY - margin || fixture.y > maxY + margin) {
                warnings.push({
                    fixtureId: fixture.id,
                    code: 'outside-plan',
                    severity: 'warning',
                    message: `${labelOf(fixture)} is outside the plan`
                });
            }
        }
    });

    findOverlaps(fixtures).forEach(({ a, b, box }) => {
        warnings.push({
            fixtureId: b.id,
            code: 'overlap',
            severity: 'warning',
            message: `${labelOf(a)} overlaps ${labelOf(b)}`,
            box
        });
    });

    return warnings;
}

export function warningsFor(fixture, warnings = []) {
    return warnings.filter((warning) => warning.fixtureId === fixture?.id);
}
