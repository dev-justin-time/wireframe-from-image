/**
 * Open-source plan symbol reader (no CDN, no model download).
 *
 * Tesseract.js already reads the WORDS on a plan. This module reads the
 * SYMBOLS: door swings, windows, fixtures, north arrows, scale bars and
 * dimension markers, straight from the pixels with thresholding + connected
 * components + shape rules. It runs on upload and alongside the word OCR, so
 * one import yields both readings.
 *
 * Coordinates are source-image pixels (x0/y0 = the location origin). The
 * editor maps them onto the plan with the background rect (see
 * `toPlanPoint`), then prints each reading/note AT its origin on the canvas
 * and in the print sheet.
 */

const MAX_DIM = 1100;
const MIN_PIXELS = 14;
const MAX_SYMBOLS = 60;

let nextId = 0;
const rid = (prefix) => `${prefix}_${Date.now().toString(36)}_${(nextId += 1)}`;

function loadImage(source) {
    return new Promise((resolve, reject) => {
        if (source instanceof HTMLImageElement) {
            if (source.complete && source.naturalWidth) return resolve(source);
            source.onload = () => resolve(source);
            source.onerror = reject;
            return;
        }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode the plan image'));
        img.src = source;
    });
}

function toGray(img) {
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1));
    const w = Math.max(2, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(2, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0; i < w * h; i += 1) {
        gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
    }
    return { gray, w, h, scale };
}

/** Otsu threshold: ink vs paper, tuned for blueprints and scans. */
function otsu(gray) {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i += 1) hist[gray[i]] += 1;
    const total = gray.length;
    let sum = 0;
    for (let t = 0; t < 256; t += 1) sum += t * hist[t];
    let sumB = 0;
    let wB = 0;
    let best = 0;
    let threshold = 160;
    for (let t = 0; t < 256; t += 1) {
        wB += hist[t];
        if (!wB) continue;
        const wF = total - wB;
        if (!wF) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > best) {
            best = between;
            threshold = t;
        }
    }
    return Math.min(Math.max(threshold, 90), 200);
}

/** Connected ink components on a strided grid (fast on large scans). */
function components(gray, w, h, threshold, stride = 2) {
    const gw = Math.ceil(w / stride);
    const gh = Math.ceil(h / stride);
    const ink = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy += 1) {
        for (let gx = 0; gx < gw; gx += 1) {
            let dark = 0;
            let n = 0;
            for (let dy = 0; dy < stride; dy += 1) {
                for (let dx = 0; dx < stride; dx += 1) {
                    const x = gx * stride + dx;
                    const y = gy * stride + dy;
                    if (x >= w || y >= h) continue;
                    n += 1;
                    if (gray[y * w + x] < threshold) dark += 1;
                }
            }
            ink[gy * gw + gx] = dark * 2 >= n ? 1 : 0;
        }
    }
    const seen = new Int32Array(gw * gh).fill(-1);
    const boxes = [];
    const stack = [];
    for (let i = 0; i < gw * gh; i += 1) {
        if (!ink[i] || seen[i] !== -1) continue;
        const id = boxes.length;
        let x0 = gw;
        let y0 = gh;
        let x1 = -1;
        let y1 = -1;
        let pixels = 0;
        stack.push(i);
        seen[i] = id;
        while (stack.length) {
            const cur = stack.pop();
            const cx = cur % gw;
            const cy = Math.floor(cur / gw);
            pixels += 1;
            if (cx < x0) x0 = cx;
            if (cy < y0) y0 = cy;
            if (cx > x1) x1 = cx;
            if (cy > y1) y1 = cy;
            for (let oy = -1; oy <= 1; oy += 1) {
                for (let ox = -1; ox <= 1; ox += 1) {
                    if (!ox && !oy) continue;
                    const nx = cx + ox;
                    const ny = cy + oy;
                    if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
                    const ni = ny * gw + nx;
                    if (ink[ni] && seen[ni] === -1) {
                        seen[ni] = id;
                        stack.push(ni);
                    }
                }
            }
        }
        boxes.push({
            x0: x0 * stride,
            y0: y0 * stride,
            x1: Math.min((x1 + 1) * stride - 1, w - 1),
            y1: Math.min((y1 + 1) * stride - 1, h - 1),
            pixels: pixels * stride * stride
        });
    }
    return { boxes, w, h };
}

function overlap(a, b) {
    const x0 = Math.max(a.x0, b.x0);
    const y0 = Math.max(a.y0, b.y0);
    const x1 = Math.min(a.x1, b.x1);
    const y1 = Math.min(a.y1, b.y1);
    if (x1 <= x0 || y1 <= y0) return 0;
    const inter = (x1 - x0) * (y1 - y0);
    const union = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter;
    return union > 0 ? inter / union : 0;
}

function classify(box, imageArea) {
    const w = Math.max(box.x1 - box.x0, 1);
    const h = Math.max(box.y1 - box.y0, 1);
    const area = w * h;
    const aspect = Math.max(w, h) / Math.min(w, h);
    const fill = Math.min(box.pixels / Math.max(area, 1), 1);
    const rel = area / Math.max(imageArea, 1);
    if (rel > 0.25) return { kind: 'border', label: 'Sheet border', confidence: 60 };
    if (aspect >= 6 && fill >= 0.35) {
        return rel > 0.004
            ? { kind: 'wall-run', label: 'Wall run', confidence: 55 }
            : { kind: 'scale-bar', label: 'Scale bar / rule', confidence: 55 };
    }
    if (aspect >= 3.2 && fill >= 0.4 && rel < 0.02) return { kind: 'window', label: 'Window symbol', confidence: 68 };
    if (aspect < 1.7 && fill >= 0.12 && fill <= 0.55 && rel >= 0.0004 && rel <= 0.02) {
        return { kind: 'door', label: 'Door swing', confidence: 62 };
    }
    if (aspect < 2.2 && fill >= 0.55 && rel >= 0.0002 && rel <= 0.012) {
        return { kind: 'fixture', label: 'Fixture / fitting', confidence: 58 };
    }
    if (aspect < 2.5 && fill < 0.3 && rel < 0.0012) return { kind: 'marker', label: 'Dimension / grid marker', confidence: 52 };
    if (rel < 0.0006 && fill >= 0.5) return { kind: 'device', label: 'Device symbol', confidence: 50 };
    return { kind: 'symbol', label: 'Plan symbol', confidence: 45 };
}

/**
 * Detect plan symbols in a plan image. Pure JS, fully offline after load.
 * @returns {Promise<{engine:string,width:number,height:number,symbols:Array,counts:Object}>}
 */
export async function detectPlanSymbols(source) {
    const img = await loadImage(typeof source === 'string' ? source : source);
    const { gray, w, h, scale } = toGray(img);
    const threshold = otsu(gray);
    const { boxes } = components(gray, w, h, threshold);
    const imageArea = w * h;
    const kept = [];
    boxes
        .filter((b) => b.pixels >= MIN_PIXELS && (b.x1 - b.x0) * (b.y1 - b.y0) <= imageArea * 0.3)
        .sort((a, b) => b.pixels - a.pixels)
        .forEach((box) => {
            const kind = classify(box, imageArea);
            const inv = 1 / Math.max(scale, 1e-6);
            const full = {
                x0: Math.round(box.x0 * inv),
                y0: Math.round(box.y0 * inv),
                x1: Math.round(box.x1 * inv),
                y1: Math.round(box.y1 * inv)
            };
            const entry = {
                id: rid('sym'),
                kind: kind.kind,
                label: kind.label,
                confidence: kind.confidence,
                bbox: full,
                pixels: box.pixels
            };
            if (kept.some((other) => overlap(other.bbox, entry.bbox) > 0.45)) return;
            kept.push(entry);
        });
    const symbols = kept
        .slice(0, MAX_SYMBOLS)
        .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
        .map((s, i) => ({ ...s, index: i + 1 }));
    const counts = {};
    symbols.forEach((s) => {
        counts[s.kind] = (counts[s.kind] || 0) + 1;
    });
    return {
        engine: 'local-symbols-v1',
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        threshold,
        symbols,
        counts: { total: symbols.length, ...counts }
    };
}

export function symbolLabel(symbol, index) {
    const n = Number.isFinite(index) ? index : symbol.index;
    return `#${n} ${symbol.label} — ${symbol.confidence}%`;
}

export function symbolsSummary(result) {
    if (!result?.symbols?.length) return 'No symbols detected yet';
    const parts = Object.entries(result.counts || {})
        .filter(([k]) => k !== 'total')
        .map(([k, v]) => `${v} ${k}`);
    return `${result.symbols.length} symbols${parts.length ? ` (${parts.join(' · ')})` : ''}`;
}

/** Image-pixel origin → plan coordinates through the background rect. */
export function toPlanPoint(ix, iy, background, imageW, imageH) {
    if (!background || !imageW || !imageH) return null;
    // The background rect already includes the display scale
    // (width = image px × backgroundScale), so an image-pixel origin maps
    // proportionally: origin = rect origin + fraction × rect size.
    return {
        x: background.x + (ix / Math.max(imageW, 1)) * background.width,
        y: background.y + (iy / Math.max(imageH, 1)) * background.height
    };
}

/**
 * Every reading/note with its location origin, in print order
 * (top-to-bottom, left-to-right): words first, then symbols.
 */
export function readingNotesAtOrigins({ lines = [], symbols = [] } = {}) {
    const notes = [];
    lines
        .filter((l) => l?.bbox)
        .forEach((line, i) => {
            notes.push({
                id: `w${i + 1}`,
                kind: 'word',
                category: line.category || 'label',
                text: String(line.text || '').trim(),
                origin: { x0: line.bbox.x0, y0: line.bbox.y0, x1: line.bbox.x1, y1: line.bbox.y1 },
                confidence: line.confidence
            });
        });
    (symbols || [])
        .filter((s) => s?.bbox)
        .forEach((s) => {
            notes.push({
                id: `s${s.index || ''}`,
                kind: 'symbol',
                category: s.kind,
                text: s.label,
                origin: { ...s.bbox },
                confidence: s.confidence
            });
        });
    return notes.sort((a, b) => a.origin.y0 - b.origin.y0 || a.origin.x0 - b.origin.x0);
}
