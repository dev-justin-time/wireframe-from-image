/**
 * Texture budgets for the 3D toolbox: texel density and GPU memory.
 *
 * The format table is the published block layout of each family (BC1 is a 4×4
 * block of 8 bytes, BC7 16, every ASTC block is 128 bits whatever its footprint,
 * and ETC2/EAC follows the same 4×4 grid). Sizes are the worst case: a texture
 * costs what its blocks cost, so a 100×100 BC1 image is 25×25 blocks even though
 * only 96 pixels of the last block carry data.
 *
 * Pure arithmetic — no canvas, no WebGL — so the gate can check it in Node.
 */

import { INCH } from '../../core/world-space.js';

// --- Texel density --------------------------------------------------------

/** Sizes the platform's own material set uses, plus the 4K working limit. */
export const TEXEL_TEXTURE_SIZES = [512, 1024, 2048, 4096];

/** Surfaces the design suites quote, so a density can be read off directly. */
export const TEXEL_SURFACES = [
    { label: 'Wall height 2.7 m', metres: 2.7 },
    { label: 'Wall height 96 in', metres: 96 * INCH },
    { label: 'Door height 2.1 m', metres: 2.1 },
    { label: 'Counter run 1 m', metres: 1 }
];

const positive = (value, message) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(message);
    return number;
};

/**
 * Texels per metre on a surface.
 *
 * `uvFraction` is the share of the texture's *area* the island occupies: an
 * island on half the sheet has sqrt(0.5) of the resolution per side, which is
 * why a uniform-density layout needs one sheet size for the whole model.
 */
export function texelDensity({ texturePixels, surfaceMetres, uvFraction = 1 } = {}) {
    const pixels = positive(texturePixels, 'Texture size must be a positive number of pixels.');
    const metres = positive(surfaceMetres, 'Surface size must be a positive number of metres.');
    const share = Number(uvFraction);
    if (!Number.isFinite(share) || share <= 0 || share > 1) {
        throw new Error('UV coverage must be greater than 0 and at most 1.');
    }
    const pixelsPerMetre = (pixels * Math.sqrt(share)) / metres;
    return {
        pixelsPerMetre,
        pixelsPerCentimetre: pixelsPerMetre / 100,
        pixelsPerInch: pixelsPerMetre * INCH
    };
}

/** The texture size needed to hit a target density, exactly and rounded up to a power of two. */
export function texturePixelsForDensity({ density, surfaceMetres, uvFraction = 1 } = {}) {
    const target = positive(density, 'Target density must be a positive number of pixels per metre.');
    const metres = positive(surfaceMetres, 'Surface size must be a positive number of metres.');
    const share = Number(uvFraction);
    if (!Number.isFinite(share) || share <= 0 || share > 1) {
        throw new Error('UV coverage must be greater than 0 and at most 1.');
    }
    const exact = (target * metres) / Math.sqrt(share);
    return { exact, powerOfTwo: nextPowerOfTwo(exact) };
}

// --- Texture formats ------------------------------------------------------

/**
 * GPU texture formats. `bitsPerPixel` is for uncompressed formats; compressed
 * ones declare a block footprint and its byte cost instead.
 */
export const TEXTURE_FORMATS = [
    { id: 'r8', label: 'R8', bitsPerPixel: 8 },
    { id: 'rg8', label: 'RG8', bitsPerPixel: 16 },
    { id: 'rgba8', label: 'RGBA8', bitsPerPixel: 32 },
    { id: 'rgba16f', label: 'RGBA16F', bitsPerPixel: 64 },
    { id: 'rgba32f', label: 'RGBA32F', bitsPerPixel: 128 },
    { id: 'bc1', label: 'BC1 / DXT1', block: { width: 4, height: 4, bytes: 8 } },
    { id: 'bc3', label: 'BC3 / DXT5', block: { width: 4, height: 4, bytes: 16 } },
    { id: 'bc4', label: 'BC4 (single channel)', block: { width: 4, height: 4, bytes: 8 } },
    { id: 'bc5', label: 'BC5 (two channel)', block: { width: 4, height: 4, bytes: 16 } },
    { id: 'bc6h', label: 'BC6H (HDR)', block: { width: 4, height: 4, bytes: 16 } },
    { id: 'bc7', label: 'BC7', block: { width: 4, height: 4, bytes: 16 } },
    { id: 'etc2rgb', label: 'ETC2 RGB', block: { width: 4, height: 4, bytes: 8 } },
    { id: 'etc2rgba', label: 'ETC2 RGBA / EAC', block: { width: 4, height: 4, bytes: 16 } },
    { id: 'eacr11', label: 'EAC R11', block: { width: 4, height: 4, bytes: 8 } },
    { id: 'astc4x4', label: 'ASTC 4×4', block: { width: 4, height: 4, bytes: 16 } },
    { id: 'astc5x5', label: 'ASTC 5×5', block: { width: 5, height: 5, bytes: 16 } },
    { id: 'astc6x6', label: 'ASTC 6×6', block: { width: 6, height: 6, bytes: 16 } },
    { id: 'astc8x8', label: 'ASTC 8×8', block: { width: 8, height: 8, bytes: 16 } },
    { id: 'astc10x10', label: 'ASTC 10×10', block: { width: 10, height: 10, bytes: 16 } },
    { id: 'astc12x12', label: 'ASTC 12×12', block: { width: 12, height: 12, bytes: 16 } }
];

const FORMAT_INDEX = new Map(TEXTURE_FORMATS.map((format) => [format.id, format]));

/** Resolve a format by id or object; throws on an unknown id. */
export function textureFormat(id) {
    if (id && typeof id === 'object') return id;
    const format = FORMAT_INDEX.get(String(id));
    if (!format) throw new Error(`Unknown texture format "${id}".`);
    return format;
}

/** Blocks across and down for a compressed format; `null` when uncompressed. */
export function blockGrid(width, height, format) {
    const resolved = textureFormat(format);
    if (!resolved.block) return null;
    return {
        across: Math.ceil(width / resolved.block.width),
        down: Math.ceil(height / resolved.block.height),
        bytesPerBlock: resolved.block.bytes
    };
}

/** Bytes one texture level costs. */
export function textureLevelBytes(width, height, format) {
    const resolved = textureFormat(format);
    const blocks = blockGrid(width, height, resolved);
    if (blocks) return blocks.across * blocks.down * blocks.bytesPerBlock;
    return (width * height * resolved.bitsPerPixel) / 8;
}

/**
 * Every level of a texture, largest first. `mips` is false for a single level
 * or true for the full chain down to 1×1.
 */
export function textureLevels(width, height, format, { mips = false } = {}) {
    const w = Math.floor(Number(width));
    const h = Math.floor(Number(height));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
        throw new Error('Texture width and height must be at least 1 pixel.');
    }
    const resolved = textureFormat(format);
    const levels = [];
    let levelWidth = w;
    let levelHeight = h;
    for (let level = 0; ; level += 1) {
        levels.push({
            level,
            width: levelWidth,
            height: levelHeight,
            bytes: textureLevelBytes(levelWidth, levelHeight, resolved)
        });
        if (!mips || (levelWidth === 1 && levelHeight === 1)) break;
        levelWidth = Math.max(1, levelWidth >> 1);
        levelHeight = Math.max(1, levelHeight >> 1);
    }
    return levels;
}

export const BYTES_PER_MIB = 1024 * 1024;

/**
 * GPU memory for one texture: the level table, the total, and how much a mip
 * chain adds. The plan's 4K RGBA8 row is 64 MiB, 85.3 MiB with its chain.
 */
export function textureMemory({ width, height, format, mips = false } = {}) {
    const resolved = textureFormat(format);
    const levels = textureLevels(width, height, resolved, { mips });
    const bytes = levels.reduce((sum, level) => sum + level.bytes, 0);
    return {
        format: resolved.id,
        label: resolved.label,
        width: Math.floor(Number(width)),
        height: Math.floor(Number(height)),
        levels,
        levelCount: levels.length,
        blocks: blockGrid(Math.floor(Number(width)), Math.floor(Number(height)), resolved),
        bytes,
        kib: bytes / 1024,
        mib: bytes / BYTES_PER_MIB
    };
}

/** Smallest power of two at or above `value`. */
export function nextPowerOfTwo(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 1;
    return 2 ** Math.ceil(Math.log2(number));
}

/** Largest power of two at or below `value`. */
export function previousPowerOfTwo(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 1) return 1;
    return 2 ** Math.floor(Math.log2(number));
}

/**
 * What halving to the previous power-of-two size would save. Returns null when
 * the texture is already a power of two in both directions.
 */
export function potReduction({ width, height, format, mips = false } = {}) {
    const w = Math.floor(Number(width));
    const h = Math.floor(Number(height));
    const smallerWidth = previousPowerOfTwo(w);
    const smallerHeight = previousPowerOfTwo(h);
    if (smallerWidth === w && smallerHeight === h) return null;
    const current = textureMemory({ width: w, height: h, format, mips });
    const smaller = textureMemory({ width: smallerWidth, height: smallerHeight, format, mips });
    return {
        width: smallerWidth,
        height: smallerHeight,
        bytes: smaller.bytes,
        savedBytes: current.bytes - smaller.bytes,
        savedFraction: current.bytes ? 1 - smaller.bytes / current.bytes : 0
    };
}

/** The material set the design suites ship: twelve 512² RGBA textures. */
export const PLATFORM_MATERIALS = { count: 12, size: 512, format: 'rgba8' };

/** GPU memory the platform's own material set occupies. */
export function sceneTextureMemory() {
    const single = textureMemory({
        width: PLATFORM_MATERIALS.size,
        height: PLATFORM_MATERIALS.size,
        format: PLATFORM_MATERIALS.format
    });
    return {
        ...single,
        materials: PLATFORM_MATERIALS.count,
        bytes: single.bytes * PLATFORM_MATERIALS.count,
        mib: single.mib * PLATFORM_MATERIALS.count
    };
}
