/**
 * Tool 7 — normal map channel inverter.
 *
 * Moving between OpenGL (+Y up) and DirectX (+Y down) normal maps is exactly
 * `G = 255 - G`; R, B and A are copied through, so the operation is its own
 * inverse and cannot soften the map. Batch input keeps the per-file download
 * buttons, which is predictable in every browser — a page cannot start ten
 * downloads in one click.
 */

import { flipNormalGreen, flippedName } from '../pbr.js';
import { decodeImageFile, downloadImage, paintImage, wireDropZone } from '../io.js';

const sizeLabel = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    return bytes >= 1048576
        ? `${(bytes / 1048576).toFixed(1)} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export function mount(root) {
    root.innerHTML = `
        <div class="grid gap-3 xl:grid-cols-2">
            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="flex flex-wrap items-end justify-between gap-2">
                    <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Normal maps</h2>
                    <label class="text-[10px] text-slate-500">Target convention
                        <select id="flip-target" class="ml-1 rounded border border-slate-200 px-1.5 py-1 text-[11px]">
                            <option value="directx">DirectX (+Y down)</option>
                            <option value="opengl">OpenGL (+Y up)</option>
                        </select>
                    </label>
                </div>
                <button type="button" id="flip-drop"
                    class="mt-2 w-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-left text-[11px] leading-snug text-slate-500 hover:border-slate-300 hover:bg-slate-100">
                    <span class="font-semibold text-slate-700">Drop normal maps here</span> or press to choose one or more
                    PNG, JPEG or WebP files.
                </button>
                <input id="flip-files" type="file" accept="image/png,image/jpeg,image/webp" multiple class="hidden">
                <div id="flip-list" class="mt-2"></div>
                <p id="flip-error" class="mt-1 min-h-[1rem] text-[10px] text-red-600" role="alert" aria-live="polite"></p>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Green channel, before and after</h2>
                <div class="mt-2 flex flex-wrap items-start gap-3">
                    <div>
                        <p id="flip-before-label" class="text-[10px] text-slate-500">Before</p>
                        <canvas id="flip-before" class="mt-1" aria-label="First map, unchanged"></canvas>
                    </div>
                    <div>
                        <p id="flip-after-label" class="text-[10px] text-slate-500">After</p>
                        <canvas id="flip-after" class="mt-1" aria-label="First map with the green channel inverted"></canvas>
                    </div>
                </div>
                <p id="flip-note" class="mt-2 text-[10px] leading-snug text-slate-500">Load a map to see the flip.</p>
                <p class="mt-2 text-[10px] leading-snug text-slate-500">
                    Only the green channel changes: <code class="rounded bg-slate-100 px-1">G' = 255 − G</code>. R, B and
                    A are copied byte-for-byte, so flipping twice restores the original file exactly.
                </p>
            </section>
        </div>
    `;

    const $ = (id) => root.querySelector(`#${id}`);
    const list = $('flip-list');
    const targetSelect = $('flip-target');
    const items = [];

    const setError = (message) => {
        $('flip-error').textContent = message;
        if (message) window.toolboxKit?.setStatus?.(message, 'error');
    };

    const conventions = () => {
        const target = targetSelect.value;
        const source = target === 'directx' ? 'opengl' : 'directx';
        return {
            target,
            source,
            before: target === 'directx' ? 'OpenGL (+Y up)' : 'DirectX (+Y down)',
            after: target === 'directx' ? 'DirectX (+Y down)' : 'OpenGL (+Y up)'
        };
    };

    const paintLabels = () => {
        const names = conventions();
        $('flip-before-label').textContent = `Before · ${names.before}`;
        $('flip-after-label').textContent = `After · ${names.after}`;
    };

    const paintPreview = () => {
        paintLabels();
        const first = items[0];
        if (!first) {
            $('flip-note').textContent = 'Load a map to see the flip.';
            return;
        }
        paintImage($('flip-before'), first.image, { max: 200 });
        paintImage($('flip-after'), first.flipped, { max: 200 });
        $('flip-note').textContent = `${first.name} · ${first.image.width} × ${first.image.height}, green inverted for ${conventions().after}.`;
    };

    const renderList = () => {
        list.innerHTML = '';
        items.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2 border-b border-slate-100 py-1.5 text-[10px]';

            const name = document.createElement('span');
            name.className = 'min-w-0 flex-1 truncate text-slate-700';
            name.textContent = item.name;

            const size = document.createElement('span');
            size.className = 'font-mono text-slate-400';
            size.textContent = sizeLabel(item.bytes);

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50';
            button.textContent = 'Download flipped';
            button.dataset.target = flippedName(item.name, conventions().target);
            button.addEventListener('click', async () => {
                try {
                    await downloadImage(item.flipped, button.dataset.target);
                    window.toolboxKit?.setStatus?.(`Saved ${button.dataset.target}.`);
                } catch (error) {
                    setError(error.message);
                }
            });

            row.append(name, size, button);
            list.appendChild(row);
        });
    };

    /** The suffix in a download name follows the target, so re-render it. */
    const refreshNames = () => {
        Array.from(list.querySelectorAll('button')).forEach((button, index) => {
            const item = items[index];
            if (!item) return;
            button.dataset.target = flippedName(item.name, conventions().target);
        });
    };

    const addFiles = async (files) => {
        setError('');
        for (const file of files) {
            try {
                const decoded = await decodeImageFile(file);
                items.push({
                    name: decoded.name,
                    bytes: file.size,
                    image: decoded.image,
                    flipped: flipNormalGreen(decoded.image)
                });
            } catch (error) {
                setError(error.message);
            }
        }
        renderList();
        paintPreview();
        window.toolboxKit?.setStatus?.(`${items.length} normal map${items.length === 1 ? '' : 's'} ready.`);
    };

    wireDropZone($('flip-drop'), $('flip-files'), (files) => { addFiles(files); });

    targetSelect.addEventListener('change', () => {
        refreshNames();
        paintPreview();
    });

    if (window.toolboxKit) {
        window.toolboxKit.panel = {
            id: 'normal-flip',
            load: (images) => {
                items.length = 0;
                (Array.isArray(images) ? images : [images]).forEach((entry, index) => {
                    const image = entry.image || entry;
                    const name = entry.name || `normal-${index}.png`;
                    items.push({ name, bytes: null, image, flipped: flipNormalGreen(image) });
                });
                renderList();
                paintPreview();
                return items.map((item) => item.flipped);
            },
            state: () => ({
                count: items.length,
                target: targetSelect.value,
                names: items.map((item) => flippedName(item.name, conventions().target)),
                pixels: items[0] ? Array.from(items[0].flipped.data.slice(0, 4)) : null,
                original: items[0] ? Array.from(items[0].image.data.slice(0, 4)) : null
            })
        };
    }

    paintPreview();
}
