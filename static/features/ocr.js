/**
 * Floorplan OCR.
 *
 * Runs Tesseract.js in the browser (the JavaScript counterpart of a Python
 * EasyOCR reader) over an imported plan image, then sorts the recognized words
 * into dimensions, room names, scale notes and areas. Nothing is uploaded: the
 * worker and language data are fetched from a CDN once and cached.
 *
 * The parser is separated from the engine so it can be tested with a fake
 * recognizer, and so a different engine can be injected later.
 */

const TESSERACT_VERSION = '5.1.1';
const TESSERACT_MODULE = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.esm.min.js`;
const TESSERACT_PATHS = {
    workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`,
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0'
};

const MIN_CONFIDENCE = 30;

const ROOM_WORDS = [
    'bedroom', 'bed room', 'master', 'guest', 'kitchen', 'kit', 'bathroom', 'bath', 'ensuite',
    'en suite', 'powder', 'wc', 'living', 'lounge', 'dining', 'family', 'great room', 'laundry',
    'closet', 'wardrobe', 'walk-in', 'hall', 'hallway', 'foyer', 'entry', 'mudroom', 'office',
    'study', 'den', 'garage', 'carport', 'porch', 'deck', 'patio', 'balcony', 'terrace', 'pantry',
    'utility', 'storage', 'basement', 'attic', 'nursery', 'gym', 'bar', 'sunroom', 'stairs',
    'stair', 'landing', 'workshop', 'shop', 'library', 'theatre', 'theater', 'conservatory'
];

const UNIT_TO_METRES = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254 };

const toNumber = (text) => {
    const value = String(text ?? '').trim();
    if (!value) return null;
    const commaDecimal = /^\d{1,3},\d{1,2}$/.test(value);
    const normal = commaDecimal ? value.replace(',', '.') : value.replace(/,/g, '');
    const number = Number(normal);
    return Number.isFinite(number) ? number : null;
};

const round = (value, digits = 2) => {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

/** Walk a Tesseract result and collect every word once, whatever the nesting. */
export function extractWords(data = {}) {
    const words = [];
    const seen = new Set();
    const push = (word) => {
        if (!word) return;
        const text = String(word.text ?? '').trim();
        if (!text) return;
        const raw = word.bbox || {};
        const bbox = {
            x0: Number(raw.x0 ?? word.x0 ?? 0),
            y0: Number(raw.y0 ?? word.y0 ?? 0),
            x1: Number(raw.x1 ?? word.x1 ?? 0),
            y1: Number(raw.y1 ?? word.y1 ?? 0)
        };
        // Tesseract 5 exposes both a flat word list and the same words under
        // blocks; key on the box and text so each word is counted once.
        const key = `${text}|${bbox.x0}|${bbox.y0}|${bbox.x1}|${bbox.y1}`;
        if (seen.has(key)) return;
        seen.add(key);
        words.push({ text, confidence: Number(word.confidence ?? 0), bbox });
    };
    const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node.words)) node.words.forEach(push);
        ['blocks', 'paragraphs', 'lines'].forEach((key) => {
            if (Array.isArray(node[key])) node[key].forEach(visit);
        });
    };
    if (Array.isArray(data.words)) data.words.forEach(push);
    visit(data);
    return words;
}

/** Group words into visual lines by vertical overlap and horizontal proximity. */
export function groupWords(words = []) {
    const usable = words
        .filter((word) => word.text && word.confidence >= MIN_CONFIDENCE)
        .map((word) => ({ ...word, height: Math.max(word.bbox.y1 - word.bbox.y0, 1) }))
        .sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));

    const lines = [];
    usable.forEach((word) => {
        const centre = (word.bbox.y0 + word.bbox.y1) / 2;
        const line = lines.find((candidate) => {
            const overlap = Math.min(candidate.bbox.y1, word.bbox.y1) - Math.max(candidate.bbox.y0, word.bbox.y0);
            // Sparse drawings put unrelated labels on the same baseline: a big
            // horizontal gap starts a new line instead of gluing them together.
            const gap = word.bbox.x0 > candidate.bbox.x1
                ? word.bbox.x0 - candidate.bbox.x1
                : (candidate.bbox.x0 > word.bbox.x1 ? candidate.bbox.x0 - word.bbox.x1 : 0);
            return overlap > Math.min(candidate.height, word.height) * 0.4
                && Math.abs(candidate.centre - centre) < Math.max(candidate.height, word.height) * 0.8
                && gap <= Math.max(candidate.height, word.height) * 3;
        });
        if (!line) {
            lines.push({
                words: [word],
                bbox: { ...word.bbox },
                height: word.height,
                centre
            });
            return;
        }
        line.words.push(word);
        line.bbox = {
            x0: Math.min(line.bbox.x0, word.bbox.x0),
            y0: Math.min(line.bbox.y0, word.bbox.y0),
            x1: Math.max(line.bbox.x1, word.bbox.x1),
            y1: Math.max(line.bbox.y1, word.bbox.y1)
        };
        line.height = Math.max(line.height, word.height);
    });

    return lines
        .map((line) => {
            const wordsInLine = line.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            return {
                text: wordsInLine.map((word) => word.text).join(' ').replace(/\s+/g, ' ').trim(),
                confidence: Math.round(wordsInLine.reduce((sum, word) => sum + word.confidence, 0) / wordsInLine.length),
                bbox: line.bbox
            };
        })
        .filter((line) => line.text)
        .sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));
}

/** Read a scale note such as "SCALE 1:100", 1/4" = 1'-0" or 1 in = 4 ft. */
export function parseScaleNote(text = '') {
    const clean = String(text).replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    const ratio = clean.match(/scale\s*[:\-]?\s*1\s*[:/]\s*(\d{1,5})/i);
    if (ratio) return { ratio: Number(ratio[1]), note: clean, metric: true };

    // 1/4" = 1'-0" means a quarter inch on paper represents twelve inches.
    const imperial = clean.match(/(\d+)\s*\/\s*(\d+)\s*["″]?\s*=\s*1\s*['′]/);
    if (imperial && Number(imperial[1]) > 0) {
        return { ratio: (12 * Number(imperial[2])) / Number(imperial[1]), note: clean, metric: false };
    }
    const inchFeet = clean.match(/1\s*(?:in|inch|")\s*=\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')/i);
    if (inchFeet) {
        return { ratio: 12 * Number(inchFeet[1]), note: clean, metric: false };
    }
    return null;
}

/** Area annotations: 120 sq ft, 45 m², 480 SF. */
export function parseArea(text = '') {
    const clean = String(text).replace(/[–—]/g, '-');
    const imperial = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:sq\.?\s*(?:ft|feet)|ft²|ft2|sf)(?![a-z])/i);
    if (imperial) {
        const value = toNumber(imperial[1]);
        if (value != null) return { value, unit: 'ft²', squareMetres: round(value * 0.092903, 2) };
    }
    const metric = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:sq\.?\s*m|m²|m2)(?![a-z])/i);
    if (metric) {
        const value = toNumber(metric[1]);
        if (value != null) return { value, unit: 'm²', squareMetres: round(value, 2) };
    }
    return null;
}

/** A length with a unit, normalized to metres where the unit is clear. */
export function parseDimension(text = '') {
    const clean = String(text).replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    const feetInches = clean.match(/(\d+(?:\.\d+)?)\s*(?:'|′|ft|feet)\s*(?:-\s*)?(\d+(?:\.\d+)?)?\s*(?:"|″|in\b|inch(?:es)?\b)?/i);
    if (feetInches) {
        const feet = toNumber(feetInches[1]) || 0;
        const inches = toNumber(feetInches[2]) || 0;
        const totalInches = feet * 12 + inches;
        return {
            value: totalInches,
            unit: 'ft-in',
            metres: totalInches > 0 ? round(totalInches * 0.0254, 3) : null
        };
    }
    const metric = clean.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)(?![a-z])/i);
    if (metric) {
        const value = toNumber(metric[1]);
        const unit = metric[2].toLowerCase();
        return { value, unit, metres: value == null ? null : round(value * UNIT_TO_METRES[unit], 3) };
    }
    const inches = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:"|″|in\b|inch(?:es)?\b)/i);
    if (inches) {
        const value = toNumber(inches[1]);
        return { value, unit: 'in', metres: value == null ? null : round(value * UNIT_TO_METRES.in, 3) };
    }
    // A bare number on its own line is a dimension: 4200 is millimetres, 420 is
    // too small for a room so it is read as centimetres.
    const bare = clean.match(/^(\d{3,5}(?:[.,]\d+)?)$/);
    if (bare) {
        const value = toNumber(bare[1]);
        const unit = value >= 500 ? 'mm' : 'cm';
        return { value, unit, metres: value == null ? null : round(value * UNIT_TO_METRES[unit], 3), inferred: true };
    }
    return null;
}

/** Interpret one line of text as a dimension, area, scale note, room or label. */
export function classifyLine(text = '') {
    const clean = String(text).replace(/\s+/g, ' ').trim();
    if (!clean) return { text: clean, category: 'empty' };

    const scale = parseScaleNote(clean);
    if (scale) return { text: clean, category: 'scale', scale };

    const area = parseArea(clean);
    if (area) return { text: clean, category: 'area', ...area };

    const dimension = parseDimension(clean);
    if (dimension) return { text: clean, category: 'dimension', ...dimension };

    const lowered = clean.toLowerCase();
    const room = ROOM_WORDS.find((word) => new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(lowered));
    if (room) return { text: clean, category: 'room', room };

    if (/[a-z]{2}/i.test(clean)) return { text: clean, category: 'label' };
    return { text: clean, category: 'other' };
}

/** Turn raw Tesseract data into the editor's plan-text payload. */
export function parsePlanText(data = {}, { width = 0, height = 0, engine = 'tesseract.js' } = {}) {
    const words = extractWords(data);
    const lines = groupWords(words).map((line) => ({ ...line, ...classifyLine(line.text) }));
    const of = (category) => lines.filter((line) => line.category === category);
    const dimensions = of('dimension');
    const rooms = of('room');
    const scales = of('scale');
    const areas = of('area');
    const labels = of('label');

    return {
        engine,
        lang: data.lang || 'eng',
        width: width || Number(data.width) || 0,
        height: height || Number(data.height) || 0,
        text: String(data.text || '').trim() || lines.map((line) => line.text).join('\n'),
        words,
        lines,
        dimensions,
        rooms,
        scales,
        areas,
        labels,
        counts: {
            words: words.length,
            lines: lines.length,
            dimensions: dimensions.length,
            rooms: rooms.length,
            scales: scales.length,
            areas: areas.length,
            labels: labels.length
        }
    };
}

export function planTextSummary(result) {
    if (!result) return 'No text read yet';
    const counts = result.counts || {};
    const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
    const parts = [];
    if (counts.rooms) parts.push(plural(counts.rooms, 'room', 'rooms'));
    if (counts.dimensions) parts.push(plural(counts.dimensions, 'dimension', 'dimensions'));
    if (counts.scales) parts.push(plural(counts.scales, 'scale note', 'scale notes'));
    if (counts.areas) parts.push(plural(counts.areas, 'area', 'areas'));
    if (counts.labels) parts.push(plural(counts.labels, 'label', 'labels'));
    if (!parts.length) return 'No text found';
    return `Found ${parts.join(' · ')}`;
}

/** One readable line for the results list, with the metric length appended. */
export function ocrLineLabel(line = {}) {
    const text = String(line.text || '').trim();
    if (Number.isFinite(line.metres)) return `${text} — ${line.metres.toFixed(2)} m`;
    if (Number.isFinite(line.squareMetres)) return `${text} — ${line.squareMetres.toFixed(1)} m²`;
    return text;
}

let workerPromise = null;

/**
 * Lazily create the shared Tesseract worker. The paths are pinned so the
 * worker, core and language data always come from the same release family.
 */
export async function getOcrWorker(onProgress) {
    if (!workerPromise) {
        workerPromise = (async () => {
            const module = await import(/* @vite-ignore */ TESSERACT_MODULE);
            const createWorker = module.createWorker || module.default?.createWorker;
            if (!createWorker) throw new Error('Tesseract.js did not expose createWorker');
            const worker = await createWorker('eng', 1, {
                ...TESSERACT_PATHS,
                logger: (message) => onProgress?.(message)
            });
            // Sparse text suits a drawing: labels sit far apart on white space.
            await worker.setParameters({
                tessedit_pageseg_mode: '11',
                preserve_interword_spaces: '1',
                user_defined_dpi: '300'
            });
            return worker;
        })().catch((error) => {
            workerPromise = null;
            throw error;
        });
    }
    return workerPromise;
}

export async function terminateOcrWorker() {
    if (!workerPromise) return;
    try {
        const worker = await workerPromise;
        await worker.terminate();
    } catch (error) {
        // A worker that failed to start has nothing to terminate.
    }
    workerPromise = null;
}

/**
 * OCR an image and classify its text.
 *
 * @param {File|Blob|string|HTMLImageElement} source
 * @param {{ recognize?: Function, onProgress?: Function, lang?: string }} options
 */
export async function recognizePlanText(source, { recognize, onProgress, lang = 'eng' } = {}) {
    let data;
    if (recognize) {
        data = await recognize(source, { lang, onProgress });
    } else {
        const worker = await getOcrWorker(onProgress);
        const result = await worker.recognize(source, {}, { text: true, blocks: true });
        data = result?.data || result;
    }
    if (!data) throw new Error('OCR returned no data');
    return parsePlanText(data, { width: data.width || 0, height: data.height || 0 });
}
