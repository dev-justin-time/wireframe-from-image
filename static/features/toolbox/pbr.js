/**
 * PBR texture maths for the 3D toolbox: normal-map convention flips and channel
 * packing.
 *
 * Both tools work on RGBA byte buffers and are pure, so the gate pins them in
 * Node. The conventions are the published ones: OpenGL normal maps store +Y up
 * in the green channel and DirectX stores +Y down, so moving between them is
 * exactly `G = 255 - G` — no renormalisation, no change to R, B or A.
 *
 * Channel packing follows the target engines' documented layouts: glTF/ORM is
 * R = ambient occlusion, G = roughness, B = metalness; Unity's HDRP mask map is
 * R = metalness, G = occlusion, B = detail, A = smoothness. A packed texture is
 * data, not colour: every value is read from the source byte with no transfer
 * function applied.
 */

import { checkImage, cloneImage, resizeImage } from './image.js';

// --- Normal conventions ---------------------------------------------------

export const NORMAL_CONVENTIONS = [
    { id: 'opengl', label: 'OpenGL (+Y up)', green: 'up' },
    { id: 'directx', label: 'DirectX (+Y down)', green: 'down' }
];

/**
 * Flip the green channel. R, B and A pass through byte-for-byte, which makes
 * the operation its own inverse — flipping twice returns the original values.
 */
export function flipNormalGreen(image) {
    checkImage(image, 'normal map');
    const out = cloneImage(image);
    for (let offset = 0; offset < out.data.length; offset += 4) {
        out.data[offset + 1] = 255 - out.data[offset + 1];
    }
    return out;
}

/** Flip a list of normal maps, one output per input. */
export function flipNormalGreenAll(images = []) {
    return images.map((image) => flipNormalGreen(image));
}

/**
 * The file name for a flipped map: an existing `_gl`/`_dx` suffix is toggled,
 * anything else gains the suffix for the target convention.
 */
export function flippedName(filename, target = 'directx') {
    const text = String(filename || 'normal');
    const dot = text.lastIndexOf('.');
    const stem = dot > 0 ? text.slice(0, dot) : text;
    const extension = dot > 0 ? text.slice(dot) : '.png';
    const suffix = target === 'opengl' ? '_gl' : '_dx';
    return `${stem.replace(/_(?:gl|dx)$/i, '')}${suffix}${extension}`;
}

// --- Channel packing ------------------------------------------------------

/** Sources a channel can be packed from, with the value used when none is loaded. */
export const PACK_SLOTS = [
    { id: 'ao', label: 'Ambient occlusion', default: 255 },
    { id: 'roughness', label: 'Roughness', default: 255 },
    { id: 'metalness', label: 'Metalness', default: 0 },
    { id: 'height', label: 'Height', default: 128 },
    { id: 'detail', label: 'Detail mask', default: 255 },
    { id: 'smoothness', label: 'Smoothness', default: 255 },
    { id: 'opacity', label: 'Opacity', default: 255 },
    { id: 'specular', label: 'Specular', default: 255 },
    { id: 'mask', label: 'Mask', default: 255 }
];

const SLOT_INDEX = new Map(PACK_SLOTS.map((slot) => [slot.id, slot]));

/** Shipped mappings. `channels` is the RGBA output order, `null` for "no source". */
export const CHANNEL_PRESETS = [
    {
        id: 'gltf-orm',
        label: 'glTF / ORM',
        channels: { r: 'ao', g: 'roughness', b: 'metalness', a: null },
        note: 'three.js lets aoMap, roughnessMap and metalnessMap share one texture, so one ORM sheet replaces three loads.'
    },
    {
        id: 'unreal',
        label: 'Unreal',
        channels: { r: 'ao', g: 'roughness', b: 'metalness', a: 'opacity' },
        note: 'Unreal reads AO, roughness and metalness from R, G and B and takes opacity from A.'
    },
    {
        id: 'unity-mask',
        label: 'Unity HDRP mask',
        channels: { r: 'metalness', g: 'ao', b: 'detail', a: 'smoothness' },
        note: 'The HDRP mask map is metalness, occlusion, detail and smoothness — note metalness first and smoothness last.'
    },
    {
        id: 'custom',
        label: 'Custom mapping',
        channels: { r: 'ao', g: 'roughness', b: 'metalness', a: null },
        note: 'Pick the source for each output channel.'
    }
];

export const CHANNEL_ORDER = ['r', 'g', 'b', 'a'];

const CHANNEL_LABELS = { r: 'Red', g: 'Green', b: 'Blue', a: 'Alpha' };

/** Resolve a preset by id; throws on an unknown one. */
export function channelPreset(id) {
    const preset = CHANNEL_PRESETS.find((entry) => entry.id === String(id));
    if (!preset) throw new Error(`Unknown channel preset "${id}".`);
    return preset;
}

function normaliseChannels(channels = CHANNEL_PRESETS[0].channels) {
    const mapping = {};
    for (const channel of CHANNEL_ORDER) {
        const slot = channels?.[channel] ?? null;
        if (slot !== null && !SLOT_INDEX.has(String(slot))) {
            throw new Error(`Unknown channel source "${slot}".`);
        }
        mapping[channel] = slot === null ? null : String(slot);
    }
    if (CHANNEL_ORDER.every((channel) => mapping[channel] === null)) {
        throw new Error('Map at least one output channel to a source map.');
    }
    return mapping;
}

/**
 * Pack up to four grey maps into one RGBA buffer.
 *
 * `sources` is keyed by output channel (`{ r, g, b, a }`); a channel with no
 * source takes its slot's default, which is recorded so the panel can say so.
 * Sources that are not the output size are box-resampled to it.
 */
export function packChannels(sources = {}, { channels, width, height } = {}) {
    const mapping = normaliseChannels(channels);

    let target = null;
    const sizes = {};
    for (const channel of CHANNEL_ORDER) {
        const image = sources[channel];
        if (!image) continue;
        checkImage(image, `${CHANNEL_LABELS[channel]} source`);
        sizes[channel] = { width: image.width, height: image.height };
        if (!target) target = { width: image.width, height: image.height };
    }
    if (width != null || height != null) {
        target = { width, height };
    }
    if (!target) throw new Error('Load at least one map to pack.');
    const w = Math.round(Number(target.width));
    const h = Math.round(Number(target.height));
    if (!Number.isInteger(w) || w < 1 || !Number.isInteger(h) || h < 1) {
        throw new Error('The packed size must be at least 1 × 1 pixel.');
    }

    const out = new Uint8ClampedArray(w * h * 4);
    const resized = [];
    const defaulted = [];

    for (const channel of CHANNEL_ORDER) {
        const index = CHANNEL_ORDER.indexOf(channel);
        const slot = mapping[channel];
        const image = sources[channel];

        if (!image) {
            const value = slot ? SLOT_INDEX.get(slot).default : 255;
            defaulted.push({ channel, slot, value });
            for (let pixel = index; pixel < out.length; pixel += 4) out[pixel] = value;
            continue;
        }

        const fitted = image.width === w && image.height === h ? image : resizeImage(image, w, h);
        if (fitted !== image) {
            resized.push({
                channel,
                from: { width: image.width, height: image.height },
                to: { width: fitted.width, height: fitted.height }
            });
        }
        for (let pixel = 0; pixel < w * h; pixel += 1) {
            const offset = pixel * 4;
            // A map is expected to be grey, in which case the weights cancel;
            // the luminance read also does the right thing for a colour mask.
            out[offset + index] = Math.round(
                0.2126 * fitted.data[offset]
                + 0.7152 * fitted.data[offset + 1]
                + 0.0722 * fitted.data[offset + 2]
            );
        }
    }

    return {
        image: { width: w, height: h, data: out },
        width: w,
        height: h,
        channels: mapping,
        defaulted,
        resized,
        sources: CHANNEL_ORDER
            .filter((channel) => sizes[channel])
            .map((channel) => ({ channel, slot: mapping[channel], size: sizes[channel] }))
    };
}

/**
 * The JSON sidecar for a packed texture: which source fed which channel, and
 * which channels fell back to a default. `files` maps a channel to the name the
 * user loaded.
 */
export function packSidecar(result, { preset = 'custom', files = {} } = {}) {
    if (!result || !result.image) throw new Error('Pack a texture before writing its sidecar.');
    const channels = {};
    for (const channel of CHANNEL_ORDER) {
        const slot = result.channels?.[channel] ?? null;
        const fallback = (result.defaulted || []).find((entry) => entry.channel === channel);
        channels[channel] = {
            slot,
            label: slot ? SLOT_INDEX.get(slot).label : null,
            file: files[channel] || null,
            value: fallback ? fallback.value : null
        };
    }
    return {
        tool: 'channel-packer',
        version: 1,
        preset,
        size: { width: result.width, height: result.height },
        channels,
        note: 'Channel maps are data, not colour: decode this texture without the sRGB transfer function.'
    };
}
