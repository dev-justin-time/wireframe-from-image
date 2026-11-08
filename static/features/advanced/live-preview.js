import { PIXELS_PER_METER } from '../../core/world-space.js';

/**
 * Advanced feature 34 - live 3D preview while dragging.
 *
 * The engine rebuild (CSG included) is far too heavy for a pointer-move, so a
 * drag used to show a stale 3D view until release. These helpers move the
 * already-built meshes straight to the fixture's new plan position, and the
 * rebuild still happens once, on drop. Walls keep using the throttled rebuild
 * because their meshes are produced by CSG.
 */

/** Move one built mesh to its fixture's plan position. Returns true if found. */
export function previewObject({ fixture, getObject, view }) {
    if (!fixture || !getObject || !view) return false;
    const object = getObject(fixture.id);
    if (!object) return false;

    object.position.x = (fixture.x - view.width / 2) / PIXELS_PER_METER;
    object.position.z = (fixture.y - view.height / 2) / PIXELS_PER_METER;
    object.rotation.y = -fixture.rotation;
    return true;
}

/**
 * Preview the dragged fixture plus every captured group member.
 * `members` is the output of captureGroupOffsets (see groups.js).
 */
export function previewDrag({ fixture, members = [], getObject, view }) {
    if (!fixture) return 0;
    let moved = previewObject({ fixture, getObject, view }) ? 1 : 0;
    members.forEach(({ item }) => {
        if (previewObject({ fixture: item, getObject, view })) moved += 1;
    });
    return moved;
}
