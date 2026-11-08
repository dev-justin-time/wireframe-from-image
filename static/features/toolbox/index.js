/**
 * The toolbox registry: one entry per shipped tool.
 *
 * The page navigation, the shell router and `scripts/check-toolbox.mjs` all read
 * this list, so a tool cannot be half-added — an entry without a panel fails the
 * gate, and a panel without an entry is unreachable.
 *
 * Clean-room: these are our own implementations of the utilities from
 * RenderHub's 3D toolbox page (colour space, UOM, texel density, texture
 * memory, seamless tiling, channel packing, normal-map conventions). Only the
 * capability is shared; the copy, the UI and the maths come from the public
 * specs named in each module. The full roadmap for the tools that are not built
 * yet is in `toolplan.md`.
 */

export * from './units.js';
export * from './texture.js';
export * from './image.js';
export * from './pbr.js';
export * from './mesh.js';

/** Phases from `toolplan.md`; the page shows only the groups that have tools. */
export const TOOLBOX_GROUPS = [
    { id: 'a', label: 'Conversion', planned: 4 },
    { id: 'b', label: 'Single images', planned: 6 },
    { id: 'c', label: 'Image sets & environment', planned: 3 },
    { id: 'd', label: 'Model pipeline', planned: 4 }
];

export const TOOLBOX = [
    {
        id: 'color-space',
        label: 'Color space converter',
        group: 'a',
        panel: 'color.js',
        summary: 'sRGB and linear values both ways, with the exact IEC 61966-2-1 transfer curve and the loudest warning when a value cannot be displayed.'
    },
    {
        id: 'units',
        label: 'Unit converter',
        group: 'a',
        panel: 'units.js',
        summary: 'Length, area, volume, mass, angle and data size, plus the scale-mismatch helper that names the unit slip behind a wrong-sized import.'
    },
    {
        id: 'texel-density',
        label: 'Texel density',
        group: 'a',
        panel: 'texel.js',
        summary: 'Pixels per metre, centimetre and inch for a surface, the texture size a target density needs, and a real model\'s UV shells measured from an imported GLB, glTF, OBJ, STL or PLY.'
    },
    {
        id: 'texture-memory',
        label: 'Texture memory',
        group: 'a',
        panel: 'memory.js',
        summary: 'GPU cost of a texture in every shipped format, with the mip chain and the saving from the previous power of two.'
    },
    {
        id: 'seamless-texture',
        label: 'Seamless texture',
        group: 'b',
        panel: 'seamless.js',
        summary: 'A photo becomes a tile: the opposite edges are made identical by construction, with an optional half-offset and a lighting flatten, then checked and exported as PNG.'
    },
    {
        id: 'channel-packer',
        label: 'PBR channel packer',
        group: 'b',
        panel: 'pack.js',
        summary: 'Pack ambient occlusion, roughness and metalness into one glTF ORM sheet (or an Unreal or Unity mask), with a JSON sidecar that records the mapping.'
    },
    {
        id: 'normal-flip',
        label: 'Normal map flipper',
        group: 'b',
        panel: 'normal-flip.js',
        summary: 'Flip the green channel to move a normal map between OpenGL and DirectX conventions; R, B and A are untouched and flipping twice restores the file.'
    }
];

/** Tools of one group, in registry order. */
export function toolsInGroup(groupId) {
    return TOOLBOX.filter((tool) => tool.group === groupId);
}

/** One tool by id, or null. */
export function toolById(id) {
    return TOOLBOX.find((tool) => tool.id === id) || null;
}
