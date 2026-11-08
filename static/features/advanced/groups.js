import { PIXELS_PER_METER } from '../../core/world-space.js';

/**
 * Advanced feature 25 - item groups / assemblies.
 *
 * A group id on the items is enough: the editor captures the members' offsets
 * when a drag starts and applies the same delta to each of them, so a run moves
 * as one without a scene-graph group (which would fight the per-item meshes and
 * the CSG rebuild).
 */

const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

let groupCounter = 0;

export function newGroupId() {
    groupCounter += 1;
    return `group_${Date.now()}_${groupCounter}`;
}

export function groupIdOf(item) {
    return item?.groupId ?? null;
}

export function groupMembers(items = [], groupId) {
    if (!groupId) return [];
    return items.filter((item) => item && item.groupId === groupId);
}

/**
 * Group the seed with the pieces chained to it along the same run: same
 * rotation (within ~17 degrees) and no gap larger than `maxGap`.
 */
export function groupRun(items = [], seed, { maxGap = 0.8 * PIXELS_PER_METER } = {}) {
    if (!seed) return [];
    const candidates = (items || []).filter((item) => item
        && item.id !== seed.id
        && item.visible !== false
        && Math.abs(wrapAngle((item.rotation || 0) - (seed.rotation || 0))) < 0.3);

    const members = [seed];
    let changed = true;

    while (changed) {
        changed = false;
        candidates.forEach((candidate) => {
            if (members.includes(candidate)) return;
            const touches = members.some((member) => Math.hypot(member.x - candidate.x, member.y - candidate.y) <= maxGap);
            if (touches) {
                members.push(candidate);
                changed = true;
            }
        });
    }

    const groupId = newGroupId();
    members.forEach((member) => { member.groupId = groupId; });
    return members;
}

export function assignGroup(items = [], ids = [], groupId = newGroupId()) {
    const set = new Set(ids);
    const members = (items || []).filter((item) => item && set.has(item.id));
    members.forEach((member) => { member.groupId = groupId; });
    return members;
}

export function ungroup(items = [], groupId) {
    const members = groupMembers(items, groupId);
    members.forEach((member) => { member.groupId = null; });
    return members;
}

/** Snapshot member offsets so a drag can fan the same delta out to all of them. */
export function captureGroupOffsets(items = [], member) {
    if (!member?.groupId) return [];
    return groupMembers(items, member.groupId)
        .filter((other) => other !== member)
        .map((other) => ({
            item: other,
            dx: other.x - member.x,
            dy: other.y - member.y
        }));
}

/** Move the captured members by the dragged piece's delta. */
export function applyGroupDelta(offsets = [], member, { skipLocked = true } = {}) {
    offsets.forEach(({ item, dx, dy }) => {
        if (!item) return;
        if (skipLocked && (item.locked || item.lockedAxes?.x || item.lockedAxes?.z)) return;
        item.x = member.x + dx;
        item.y = member.y + dy;
    });
}
