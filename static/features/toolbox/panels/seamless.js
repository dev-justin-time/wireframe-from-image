/**
 * Tool 5 — seamless texture generator.
 *
 * The kernels live in `image.js`; this panel is the form and the two 2×2
 * previews. The source preview is tiled the same way as the result, so the seam
 * the tool removes is visible in the before/after pair rather than described in
 * prose.
 */

import { edgeSeamDelta, makeSeamless, resizeImage, tileImage } from '../image.js';
import { baseName, decodeImageFile, downloadImage, paintImage, wireDropZone } from '../io.js';

/** Preview at most 320 px per side before tiling, so a 4K source stays cheap. */
const PREVIEW_LIMIT = 320;

const tiled = (image) => {
    const scale = Math.min(1, PREVIEW_LIMIT / Math.max(image.width, image.height));
    const small = scale < 1
        ? resizeImage(image, Math.round(image.width * scale), Math.round(image.height * scale))
        : image;
    return tileImage(small, 2, 2);
};

export function mount(root) {
    root.innerHTML = `
        <div class="grid gap-3 xl:grid-cols-2">
            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Source</h2>
                <button type="button" id="seamless-drop"
                    class="mt-2 w-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-left text-[11px] leading-snug text-slate-500 hover:border-slate-300 hover:bg-slate-100">
                    <span class="font-semibold text-slate-700">Drop a photo here</span> or press to choose a PNG, JPEG or WebP.
                    Everything stays in this tab.
                </button>
                <input id="seamless-file" type="file" accept="image/png,image/jpeg,image/webp" class="hidden">
                <div class="mt-3 flex items-start gap-3">
                    <canvas id="seamless-source-view" aria-label="Source image tiled 2 by 2"></canvas>
                    <div class="min-w-0 flex-1">
                        <p id="seamless-source-note" class="text-[10px] leading-snug text-slate-500">No image loaded yet.</p>
                        <dl class="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1 font-mono text-[10px]">
                            <dt class="text-slate-500">size</dt><dd id="seamless-source-size" class="text-right">—</dd>
                            <dt class="text-slate-500">seam before</dt><dd id="seamless-seam-before" class="text-right">—</dd>
                        </dl>
                    </div>
                </div>
                <p id="seamless-error" class="mt-2 min-h-[1rem] text-[10px] text-red-600" role="alert" aria-live="polite"></p>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="flex items-baseline justify-between gap-2">
                    <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tileable result</h2>
                    <button type="button" id="seamless-download" disabled
                        class="rounded border border-slate-300 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400">
                        Download PNG
                    </button>
                </div>
                <canvas id="seamless-result-view" class="mt-2" aria-label="Seamless result tiled 2 by 2"></canvas>
                <p id="seamless-result-note" class="mt-2 text-[10px] leading-snug text-slate-500">Load an image to generate a tile.</p>
                <dl class="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1 font-mono text-[10px]">
                    <dt class="text-slate-500">seam after</dt><dd id="seamless-seam-after" class="text-right">—</dd>
                    <dt class="text-slate-500">size</dt><dd id="seamless-result-size" class="text-right">—</dd>
                </dl>

                <div class="mt-3 grid grid-cols-2 gap-2">
                    <label class="block text-[10px] text-slate-500">Seam blend (%)
                        <input id="seamless-blend" type="range" min="1" max="50" step="1" value="12" class="mt-1 w-full">
                    </label>
                    <div class="space-y-1 pt-4 text-[11px] text-slate-600">
                        <label class="flex items-center gap-1.5">
                            <input id="seamless-offset" type="checkbox" checked> Offset by half
                        </label>
                        <label class="flex items-center gap-1.5">
                            <input id="seamless-flatten" type="checkbox"> Flatten lighting
                        </label>
                    </div>
                </div>
                <p class="mt-2 text-[10px] leading-snug text-slate-500">
                    The boundary is made identical by averaging each opposite edge pair and feathering that average
                    into the interior, so the tile joins exactly. Offsetting first moves the join into the middle of
                    the photo, where a soft band is less obvious than a doubled border.
                </p>
            </section>
        </div>
    `;

    const $ = (id) => root.querySelector(`#${id}`);
    const dropTarget = $('seamless-drop');
    const fileInput = $('seamless-file');
    const blendInput = $('seamless-blend');
    const offsetInput = $('seamless-offset');
    const flattenInput = $('seamless-flatten');
    const download = $('seamless-download');

    let loaded = null;
    let result = null;

    const setError = (message) => {
        $('seamless-error').textContent = message;
        if (message) window.toolboxKit?.setStatus?.(message, 'error');
    };

    const render = () => {
        if (!loaded) return;
        const { image, name } = loaded;
        setError('');
        paintImage($('seamless-source-view'), tiled(image), { max: PREVIEW_LIMIT });
        const before = edgeSeamDelta(image);
        $('seamless-source-size').textContent = `${image.width} × ${image.height}`;
        $('seamless-seam-before').textContent = `${before.max} / 255`;

        try {
            result = makeSeamless(image, {
                blend: Number(blendInput.value) / 100,
                offset: offsetInput.checked,
                flatten: flattenInput.checked ? 1 : 0
            });
        } catch (error) {
            result = null;
            setError(error.message);
            return;
        }

        paintImage($('seamless-result-view'), tiled(result), { max: PREVIEW_LIMIT });
        const after = edgeSeamDelta(result);
        $('seamless-seam-after').textContent = `${after.max} / 255`;
        $('seamless-result-size').textContent = `${result.width} × ${result.height}`;
        $('seamless-result-note').textContent = `${name} is tileable: the opposite edges now match exactly.`;
        download.disabled = false;
    };

    wireDropZone(dropTarget, fileInput, async (files) => {
        const file = files[0];
        try {
            loaded = await decodeImageFile(file);
            $('seamless-source-note').textContent = loaded.scaled
                ? `${loaded.name} · scaled from ${loaded.sourceWidth} × ${loaded.sourceHeight} to the 4096 px working limit.`
                : loaded.name;
            download.disabled = true;
            render();
            window.toolboxKit?.setStatus?.(`Loaded ${loaded.name}.`);
        } catch (error) {
            setError(error.message);
        }
    });

    [blendInput, offsetInput, flattenInput].forEach((control) => {
        control.addEventListener('input', render);
        control.addEventListener('change', render);
    });

    download.addEventListener('click', async () => {
        if (!result || !loaded) return;
        try {
            await downloadImage(result, `${baseName(loaded.name)}_seamless.png`);
            window.toolboxKit?.setStatus?.('Saved the tileable PNG.');
        } catch (error) {
            setError(error.message);
        }
    });

    if (window.toolboxKit) {
        window.toolboxKit.panel = {
            id: 'seamless-texture',
            load: (image, name = 'test.png') => {
                loaded = { image, name };
                $('seamless-source-note').textContent = name;
                render();
                return result;
            },
            state: () => ({
                loaded: Boolean(loaded),
                width: result?.width ?? 0,
                height: result?.height ?? 0,
                seamBefore: loaded ? edgeSeamDelta(loaded.image).max : null,
                seamAfter: result ? edgeSeamDelta(result).max : null,
                blend: Number(blendInput.value) / 100,
                offset: offsetInput.checked,
                flatten: flattenInput.checked,
                downloadEnabled: !download.disabled
            })
        };
    }

    render();
}
