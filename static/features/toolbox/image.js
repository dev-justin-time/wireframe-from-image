/**
 * Image kernels for the 3D toolbox.
 *
 * Everything here takes `{ width, height, data }` — RGBA bytes, row-major, the
 * same layout `ImageData` uses — and returns a new buffer of the same shape.
 * No canvas, no DOM, so the gate can pin the maths in Node and the panels stay
 * thin.
 *
 * The seamless tool is the interesting one. Two properties make a tile seamless:
 * the left column must equal the right column and the top row must equal the
 * bottom row. Rather than relying on a blur to hide the difference, the seam
 * pass writes the *average* of each opposite pair onto both sides and feathers
 * that average into the interior. The boundary is then identical by
 * construction — `edgeSeamDelta` on the result is exactly 0 — and the cost is a
 * soft band at the join, which is why the source is shifted by half first: the
 * band lands in the middle of the photo instead of on top of its own border.
 */

/** Largest image a single pass will work on; the panels report the downscale. */
export const MAX_WORKING_SIZE = 4096;

const mod = (value, period) => ((value % period) + period) % period;

const isPositiveInteger = (value) => Number.isInteger(value) && value >= 1;

function size(value, label) {
    const number = Number(value);
    if (!isPositiveInteger(number)) throw new Error(`The ${label} must be a whole number of pixels, at least 1.`);
    return number;
}

/** Check an image buffer and return it, so callers can validate in one line. */
export function checkImage(image, label = 'image') {
    if (!image || typeof image !== 'object') throw new Error(`The ${label} is missing.`);
    const { width, height, data } = image;
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) {
        throw new Error(`The ${label} needs a positive integer width and height.`);
    }
    if (!data || typeof data.length !== 'number' || data.length !== width * height * 4) {
        throw new Error(`The ${label} must hold width × height × 4 bytes.`);
    }
    return image;
}

/** A new opaque-black buffer. Alpha defaults to fully transparent. */
export function createImage(width, height, fill = [0, 0, 0, 0]) {
    const w = size(width, 'width');
    const h = size(height, 'height');
    const data = new Uint8ClampedArray(w * h * 4);
    if (fill && fill.some((value) => value !== 0)) {
        for (let offset = 0; offset < data.length; offset += 4) {
            data[offset] = fill[0];
            data[offset + 1] = fill[1];
            data[offset + 2] = fill[2];
            data[offset + 3] = fill[3] ?? 255;
        }
    }
    return { width: w, height: h, data };
}

/** Wrap an existing byte array as an image; the length is checked. */
export function imageFromData(data, width, height) {
    const w = size(width, 'width');
    const h = size(height, 'height');
    const bytes = data instanceof Uint8ClampedArray ? data : Uint8ClampedArray.from(data || []);
    const image = { width: w, height: h, data: bytes };
    return checkImage(image, 'image data');
}

/** A copy, so a kernel can write into it without touching the source. */
export function cloneImage(image) {
    checkImage(image);
    return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
}

/**
 * Resample to a new size.
 *
 * `box` is an exact area average: each target pixel is the weighted mean of the
 * source rectangle it covers, which is the right filter for masks and for
 * halving. `nearest` samples the source pixel under the target centre and is
 * what a pixel-art or UV preview wants.
 */
export function resizeImage(image, width, height, { mode = 'box' } = {}) {
    checkImage(image);
    const w = size(width, 'width');
    const h = size(height, 'height');
    if (mode !== 'box' && mode !== 'nearest') throw new Error(`Unknown resize mode "${mode}".`);

    const { width: srcW, height: srcH, data } = image;
    const out = new Uint8ClampedArray(w * h * 4);

    if (mode === 'nearest') {
        for (let y = 0; y < h; y += 1) {
            const sy = Math.min(srcH - 1, Math.floor(((y + 0.5) * srcH) / h));
            for (let x = 0; x < w; x += 1) {
                const sx = Math.min(srcW - 1, Math.floor(((x + 0.5) * srcW) / w));
                const from = (sy * srcW + sx) * 4;
                const to = (y * w + x) * 4;
                out[to] = data[from];
                out[to + 1] = data[from + 1];
                out[to + 2] = data[from + 2];
                out[to + 3] = data[from + 3];
            }
        }
        return { width: w, height: h, data: out };
    }

    for (let y = 0; y < h; y += 1) {
        const sy0 = (y * srcH) / h;
        const sy1 = ((y + 1) * srcH) / h;
        const iy0 = Math.floor(sy0);
        const iy1 = Math.ceil(sy1);
        for (let x = 0; x < w; x += 1) {
            const sx0 = (x * srcW) / w;
            const sx1 = ((x + 1) * srcW) / w;
            const ix0 = Math.floor(sx0);
            const ix1 = Math.ceil(sx1);
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;
            let total = 0;
            for (let sy = iy0; sy < iy1; sy += 1) {
                const wy = Math.min(sy1, sy + 1) - Math.max(sy0, sy);
                if (wy <= 0) continue;
                const row = Math.min(srcH - 1, sy) * srcW;
                for (let sx = ix0; sx < ix1; sx += 1) {
                    const wx = Math.min(sx1, sx + 1) - Math.max(sx0, sx);
                    if (wx <= 0) continue;
                    const offset = (row + Math.min(srcW - 1, sx)) * 4;
                    const weight = wx * wy;
                    r += data[offset] * weight;
                    g += data[offset + 1] * weight;
                    b += data[offset + 2] * weight;
                    a += data[offset + 3] * weight;
                    total += weight;
                }
            }
            const to = (y * w + x) * 4;
            out[to] = r / total;
            out[to + 1] = g / total;
            out[to + 2] = b / total;
            out[to + 3] = a / total;
        }
    }
    return { width: w, height: h, data: out };
}

/** Repeat an image into a `columns × rows` grid, which is how a seam is judged. */
export function tileImage(image, columns = 2, rows = 2) {
    checkImage(image);
    const across = size(columns, 'column count');
    const down = size(rows, 'row count');
    const { width: w, height: h } = image;
    const out = new Uint8ClampedArray(w * across * h * down * 4);
    const stride = w * across * 4;
    for (let row = 0; row < down; row += 1) {
        for (let column = 0; column < across; column += 1) {
            for (let y = 0; y < h; y += 1) {
                const from = y * w * 4;
                const to = row * h * stride + y * stride + column * w * 4;
                out.set(image.data.subarray(from, from + w * 4), to);
            }
        }
    }
    return { width: w * across, height: h * down, data: out };
}

/** Move the image by `dx, dy` with wrap-around; the border becomes interior. */
export function wrapShift(image, dx = 0, dy = 0) {
    checkImage(image);
    const { width: w, height: h, data } = image;
    const shiftX = mod(Math.round(Number(dx) || 0), w);
    const shiftY = mod(Math.round(Number(dy) || 0), h);
    if (shiftX === 0 && shiftY === 0) return cloneImage(image);
    const out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < h; y += 1) {
        const fromRow = ((y + shiftY) % h) * w;
        const toRow = y * w;
        for (let x = 0; x < w; x += 1) {
            const from = (fromRow + ((x + shiftX) % w)) * 4;
            const to = (toRow + x) * 4;
            out[to] = data[from];
            out[to + 1] = data[from + 1];
            out[to + 2] = data[from + 2];
            out[to + 3] = data[from + 3];
        }
    }
    return { width: w, height: h, data: out };
}

/**
 * The largest per-channel difference (0–255) between the opposite edges: the
 * left and right columns, then the top and bottom rows. RGB only — alpha is a
 * mask, not part of the visible seam.
 */
export function edgeSeamDelta(image) {
    checkImage(image);
    const { width: w, height: h, data } = image;
    let leftRight = 0;
    let topBottom = 0;
    for (let y = 0; y < h; y += 1) {
        const left = y * w * 4;
        const right = (y * w + w - 1) * 4;
        for (let c = 0; c < 3; c += 1) {
            leftRight = Math.max(leftRight, Math.abs(data[left + c] - data[right + c]));
        }
    }
    for (let x = 0; x < w; x += 1) {
        const top = x * 4;
        const bottom = ((h - 1) * w + x) * 4;
        for (let c = 0; c < 3; c += 1) {
            topBottom = Math.max(topBottom, Math.abs(data[top + c] - data[bottom + c]));
        }
    }
    return {
        leftRight,
        topBottom,
        max: Math.max(leftRight, topBottom),
        normalised: Math.max(leftRight, topBottom) / 255
    };
}

/**
 * Remove low-frequency lighting while keeping texture: subtract a wrapped box
 * blur and add the image mean back, so the result has the same brightness but
 * no gradient that the seam band would otherwise smear.
 */
export function flattenLighting(image, { radius = 8 } = {}) {
    checkImage(image);
    const r = Math.round(Number(radius));
    if (!Number.isInteger(r) || r < 1) throw new Error('The flatten radius must be at least 1 pixel.');

    const { width: w, height: h, data } = image;
    const mean = [0, 0, 0];
    for (let offset = 0; offset < data.length; offset += 4) {
        mean[0] += data[offset];
        mean[1] += data[offset + 1];
        mean[2] += data[offset + 2];
    }
    const pixels = w * h;
    mean[0] /= pixels;
    mean[1] /= pixels;
    mean[2] /= pixels;

    // The source rows are RGBA; the blurred copy is three floats per pixel, so
    // the two strides are kept apart here rather than shared.
    const horizontal = new Float32Array(w * h * 3);
    const span = 2 * r + 1;
    for (let y = 0; y < h; y += 1) {
        const sourceRow = y * w * 4;
        const targetRow = y * w * 3;
        let a = 0;
        let b = 0;
        let c = 0;
        for (let k = -r; k <= r; k += 1) {
            const offset = sourceRow + mod(k, w) * 4;
            a += data[offset];
            b += data[offset + 1];
            c += data[offset + 2];
        }
        for (let x = 0; x < w; x += 1) {
            const to = targetRow + x * 3;
            horizontal[to] = a / span;
            horizontal[to + 1] = b / span;
            horizontal[to + 2] = c / span;
            const add = sourceRow + mod(x + r + 1, w) * 4;
            const remove = sourceRow + mod(x - r, w) * 4;
            a += data[add] - data[remove];
            b += data[add + 1] - data[remove + 1];
            c += data[add + 2] - data[remove + 2];
        }
    }

    const out = new Uint8ClampedArray(data.length);
    for (let x = 0; x < w; x += 1) {
        let a = 0;
        let b = 0;
        let c = 0;
        for (let k = -r; k <= r; k += 1) {
            const offset = (mod(k, h) * w + x) * 3;
            a += horizontal[offset];
            b += horizontal[offset + 1];
            c += horizontal[offset + 2];
        }
        for (let y = 0; y < h; y += 1) {
            const pixel = (y * w + x) * 4;
            out[pixel] = data[pixel] - a / span + mean[0];
            out[pixel + 1] = data[pixel + 1] - b / span + mean[1];
            out[pixel + 2] = data[pixel + 2] - c / span + mean[2];
            out[pixel + 3] = data[pixel + 3];
            const add = (mod(y + r + 1, h) * w + x) * 3;
            const remove = (mod(y - r, h) * w + x) * 3;
            a += horizontal[add] - horizontal[remove];
            b += horizontal[add + 1] - horizontal[remove + 1];
            c += horizontal[add + 2] - horizontal[remove + 2];
        }
    }
    return { width: w, height: h, data: out };
}

/** Linear mix of two same-sized images, `t = 0` for A and `1` for B. */
export function mixImages(a, b, t = 0.5) {
    checkImage(a, 'first image');
    checkImage(b, 'second image');
    if (a.width !== b.width || a.height !== b.height) {
        throw new Error('Both images must be the same size to mix.');
    }
    const share = Math.min(1, Math.max(0, Number(t) || 0));
    const out = new Uint8ClampedArray(a.data.length);
    for (let offset = 0; offset < out.length; offset += 1) {
        out[offset] = a.data[offset] * (1 - share) + b.data[offset] * share;
    }
    return { width: a.width, height: a.height, data: out };
}

/**
 * Make the boundary identical: average each opposite edge pair and feather that
 * average into the interior over a band. Runs horizontally, then vertically;
 * the vertical pass keeps the columns equal because both edge columns already
 * hold the same profile.
 */
function seamBlend(image, share) {
    const { width: w, height: h, data } = image;
    const bandX = Math.min(Math.floor(w / 2), Math.max(1, Math.round(w * share)));
    const bandY = Math.min(Math.floor(h / 2), Math.max(1, Math.round(h * share)));
    const out = new Uint8ClampedArray(data);
    const seam = [0, 0, 0, 0];

    if (w >= 2) {
        for (let y = 0; y < h; y += 1) {
            const row = y * w * 4;
            for (let c = 0; c < 4; c += 1) seam[c] = (data[row + c] + data[row + (w - 1) * 4 + c]) / 2;
            for (let x = 0; x < bandX; x += 1) {
                // Both edges take the same weight, so column 0 and column w-1
                // receive the identical seam value at x = 0.
                const weight = 1 - x / bandX;
                for (let c = 0; c < 4; c += 1) {
                    out[row + x * 4 + c] = data[row + x * 4 + c] * (1 - weight) + seam[c] * weight;
                    out[row + (w - 1 - x) * 4 + c] = data[row + (w - 1 - x) * 4 + c] * (1 - weight) + seam[c] * weight;
                }
            }
        }
    }

    if (h >= 2) {
        for (let x = 0; x < w; x += 1) {
            for (let c = 0; c < 4; c += 1) seam[c] = (out[x * 4 + c] + out[((h - 1) * w + x) * 4 + c]) / 2;
            for (let y = 0; y < bandY; y += 1) {
                const weight = 1 - y / bandY;
                for (let c = 0; c < 4; c += 1) {
                    const upper = (y * w + x) * 4 + c;
                    const lower = ((h - 1 - y) * w + x) * 4 + c;
                    out[upper] = out[upper] * (1 - weight) + seam[c] * weight;
                    out[lower] = out[lower] * (1 - weight) + seam[c] * weight;
                }
            }
        }
    }

    return { width: w, height: h, data: out };
}

/**
 * Turn a photograph into a tile.
 *
 * `blend` is the share of the shorter side used for the seam band (0–0.5);
 * `offset` shifts the image by half first so the original border stops being
 * the join; `flatten` (0–1) mixes in the high-passed image before the seam pass.
 * The output is tileable by construction for any positive `blend`.
 */
export function makeSeamless(image, { blend = 0.12, offset = true, flatten = 0 } = {}) {
    checkImage(image);
    const share = Number(blend);
    if (!Number.isFinite(share) || share <= 0 || share > 0.5) {
        throw new Error('The seam blend must be greater than 0 and at most 0.5 of the shorter side.');
    }
    const amount = Number(flatten);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
        throw new Error('The flatten amount must be between 0 and 1.');
    }

    let work = offset ? wrapShift(image, Math.floor(image.width / 2), Math.floor(image.height / 2)) : cloneImage(image);
    if (amount > 0) {
        // A quarter of the shorter side is deliberately coarse: the point is to
        // flatten the lighting gradient across the whole photo, not its texture.
        const flat = flattenLighting(work, { radius: Math.max(1, Math.round(Math.min(work.width, work.height) / 4)) });
        work = mixImages(work, flat, amount);
    }
    return seamBlend(work, share);
}
