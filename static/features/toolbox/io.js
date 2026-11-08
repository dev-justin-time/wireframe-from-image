/**
 * Browser-side plumbing for the toolbox: decode a dropped file into an
 * `{ width, height, data }` buffer, draw a buffer into a preview canvas, and
 * hand a PNG to the user's downloads.
 *
 * Only the panels import this module, and every DOM call is inside a function,
 * so `check-toolbox.mjs` can still import a panel in Node.
 *
 * Decoding goes through `createImageBitmap`, which applies the browser's colour
 * management and gives back unpremultiplied sRGB bytes — exactly the values the
 * kernels expect. Nothing is read from the network: the bitmap comes from a
 * `File` the user picked.
 */

/** Larger sources are downscaled before decoding, per the plan's 4K ceiling. */
export const MAX_SOURCE_SIZE = 4096;

/** `rock_normal.png` -> `rock_normal`. */
export function baseName(filename) {
    const text = String(filename || 'texture');
    const dot = text.lastIndexOf('.');
    return dot > 0 ? text.slice(0, dot) : text;
}

/**
 * A picked image file as an image buffer plus the facts the panels report:
 * the source size, whether it was downscaled, and the file type.
 */
export async function decodeImageFile(file, { maxSize = MAX_SOURCE_SIZE } = {}) {
    if (!file || typeof file !== 'object') throw new Error('No file was dropped.');
    if (file.type && !file.type.startsWith('image/')) {
        throw new Error(`${file.name || 'That file'} is not an image.`);
    }

    let bitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error(`Could not decode ${file.name || 'the file'}; try a PNG, JPEG or WebP.`);
    }

    let width = bitmap.width;
    let height = bitmap.height;
    const sourceWidth = width;
    const sourceHeight = height;
    let source = bitmap;
    const longest = Math.max(width, height);
    if (longest > maxSize) {
        const scale = maxSize / longest;
        try {
            source = await createImageBitmap(bitmap, {
                resizeWidth: Math.max(1, Math.round(width * scale)),
                resizeHeight: Math.max(1, Math.round(height * scale)),
                resizeQuality: 'high'
            });
            bitmap.close?.();
        } catch {
            source = bitmap;
        }
        width = source.width;
        height = source.height;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser could not open a 2D canvas.');
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    source.close?.();

    return {
        image: { width, height, data: pixels.data },
        name: file.name || 'image.png',
        type: file.type || '',
        sourceWidth,
        sourceHeight,
        scaled: width !== sourceWidth || height !== sourceHeight
    };
}

/**
 * Draw an image into a preview canvas, scaled to fit `max` pixels on its longer
 * side and sized in CSS pixels so it stays sharp on a HiDPI display without
 * holding a second 4K backing store.
 */
export function paintImage(canvas, image, { max = 360, checker = false } = {}) {
    if (!canvas || !image) return;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.backgroundImage = checker
        ? 'repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)'
        : 'none';
    canvas.style.backgroundSize = checker ? '12px 12px' : 'auto';
    canvas.className = 'rounded border border-slate-200';

    const source = document.createElement('canvas');
    source.width = image.width;
    source.height = image.height;
    const from = source.getContext('2d');
    from.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);

    const to = canvas.getContext('2d');
    to.clearRect(0, 0, width, height);
    to.imageSmoothingEnabled = scale < 1;
    to.drawImage(source, 0, 0, width, height);
}

/** The PNG bytes for an image buffer, encoded by the browser's canvas. */
export function imageToBlob(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('The browser could not encode this image as a PNG.'));
        }, 'image/png');
    });
}

/** Save a blob under `filename`, then release the object URL. */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save an image buffer as a PNG. */
export async function downloadImage(image, filename) {
    downloadBlob(await imageToBlob(image), filename);
}

/** Save any JSON-serialisable value as a `.json` file. */
export function downloadJson(value, filename) {
    downloadBlob(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' }), filename);
}

/**
 * Wire a drop target and its file input to one callback. Clicking the target
 * opens the picker; dropping works too. The input is cleared after every pick so
 * re-choosing the same file fires again.
 */
export function wireDropZone(target, input, onFiles) {
    const accept = (files) => {
        const list = Array.from(files || []);
        if (list.length) onFiles(list);
    };
    target.addEventListener('click', () => input.click());
    target.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            input.click();
        }
    });
    target.addEventListener('dragover', (event) => {
        event.preventDefault();
        target.dataset.drag = 'true';
    });
    target.addEventListener('dragleave', () => { delete target.dataset.drag; });
    target.addEventListener('drop', (event) => {
        event.preventDefault();
        delete target.dataset.drag;
        accept(event.dataTransfer?.files);
    });
    input.addEventListener('change', () => {
        accept(input.files);
        input.value = '';
    });
}
