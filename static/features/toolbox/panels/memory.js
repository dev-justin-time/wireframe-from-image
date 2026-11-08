/**
 * Tool 4 — texture memory calculator.
 *
 * Worst-case GPU cost per format for one texture, with the mip chain. The table
 * below the form is the point: switching a 4K albedo from RGBA8 to BC1 is the
 * difference between 64 MiB and 8 MiB, and the same numbers feed the material
 * report in the model tools.
 */

import { formatNumber } from '../units.js';
import {
    BYTES_PER_MIB,
    TEXTURE_FORMATS,
    potReduction,
    sceneTextureMemory,
    textureMemory
} from '../texture.js';

const SIZE_PRESETS = [512, 1024, 2048, 4096];

const bytesLabel = (bytes) => (bytes >= BYTES_PER_MIB
    ? `${formatNumber(bytes / BYTES_PER_MIB, 3)} MiB`
    : `${formatNumber(bytes / 1024, 1)} KiB`);

export function mount(root) {
    root.innerHTML = `
        <div class="grid gap-3 xl:grid-cols-2">
            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">One texture</h2>
                <div class="mt-2 grid grid-cols-2 gap-2">
                    <label class="block text-[10px] text-slate-500">Width (px)
                        <input id="mem-width" type="number" min="1" step="1" value="2048"
                            class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                    </label>
                    <label class="block text-[10px] text-slate-500">Height (px)
                        <input id="mem-height" type="number" min="1" step="1" value="2048"
                            class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                    </label>
                    <label class="block text-[10px] text-slate-500">Format
                        <select id="mem-format" class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px]"></select>
                    </label>
                    <label class="block text-[10px] text-slate-500">Square preset
                        <select id="mem-preset" class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]"></select>
                    </label>
                </div>
                <label class="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input id="mem-mips" type="checkbox" checked> Full mip chain (down to 1 × 1)
                </label>
                <dl class="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 font-mono text-[11px]">
                    <dt class="text-slate-500">total</dt><dd id="mem-total" class="text-right text-base font-semibold">—</dd>
                    <dt class="text-slate-500">largest level</dt><dd id="mem-base" class="text-right">—</dd>
                    <dt class="text-slate-500">levels</dt><dd id="mem-levels" class="text-right">—</dd>
                    <dt class="text-slate-500">blocks</dt><dd id="mem-blocks" class="text-right">—</dd>
                    <dt class="text-slate-500">previous POT</dt><dd id="mem-pot" class="text-right">—</dd>
                </dl>
                <p id="mem-error" class="mt-1 min-h-[1rem] text-[10px] text-red-600"></p>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="flex items-baseline justify-between gap-2">
                    <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Every format</h2>
                    <span id="mem-scene" class="font-mono text-[10px] text-slate-400"></span>
                </div>
                <div class="mt-2 overflow-x-auto">
                    <table class="w-full text-[11px]">
                        <thead>
                            <tr class="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
                                <th class="py-1 pr-2">Format</th>
                                <th class="py-1 pr-2 text-right">bpp</th>
                                <th class="py-1 text-right">MiB</th>
                            </tr>
                        </thead>
                        <tbody id="mem-table" class="font-mono"></tbody>
                    </table>
                </div>
            </section>
        </div>
    `;

    const $ = (id) => root.querySelector(`#${id}`);
    const widthInput = $('mem-width');
    const heightInput = $('mem-height');
    const formatSelect = $('mem-format');
    const presetSelect = $('mem-preset');
    const mipsInput = $('mem-mips');

    TEXTURE_FORMATS.forEach((format) => {
        const option = document.createElement('option');
        option.value = format.id;
        option.textContent = format.label;
        if (format.id === 'rgba8') option.selected = true;
        formatSelect.appendChild(option);
    });

    const none = document.createElement('option');
    none.value = '';
    none.textContent = '—';
    presetSelect.appendChild(none);
    SIZE_PRESETS.forEach((size) => {
        const option = document.createElement('option');
        option.value = String(size);
        option.textContent = `${size} × ${size}`;
        presetSelect.appendChild(option);
    });

    const perPixelBits = (format) => {
        if (format.bitsPerPixel) return format.bitsPerPixel;
        const pixelsPerBlock = format.block.width * format.block.height;
        return (format.block.bytes * 8) / pixelsPerBlock;
    };

    const paint = () => {
        const width = Number(widthInput.value);
        const height = Number(heightInput.value);
        const mips = mipsInput.checked;

        try {
            const memory = textureMemory({ width, height, format: formatSelect.value, mips });
            $('mem-total').textContent = bytesLabel(memory.bytes);
            $('mem-base').textContent = bytesLabel(memory.levels[0].bytes);
            $('mem-levels').textContent = String(memory.levelCount);
            $('mem-blocks').textContent = memory.blocks
                ? `${memory.blocks.across} × ${memory.blocks.down}`
                : 'uncompressed';
            const reduction = potReduction({ width, height, format: formatSelect.value, mips });
            $('mem-pot').textContent = reduction
                ? `${reduction.width} × ${reduction.height} saves ${bytesLabel(reduction.savedBytes)}`
                : 'already a power of two';
            $('mem-error').textContent = '';

            $('mem-table').innerHTML = TEXTURE_FORMATS.map((format) => {
                const row = textureMemory({ width, height, format: format.id, mips });
                return `<tr class="border-b border-slate-100">
                    <td class="py-0.5 pr-2">${format.label}</td>
                    <td class="py-0.5 pr-2 text-right text-slate-500">${formatNumber(perPixelBits(format), 2)}</td>
                    <td class="py-0.5 text-right ${format.id === formatSelect.value ? 'font-semibold text-slate-900' : ''}">${formatNumber(row.mib, 3)}</td>
                </tr>`;
            }).join('');
        } catch (error) {
            $('mem-total').textContent = '—';
            $('mem-error').textContent = error.message;
            $('mem-table').innerHTML = '';
        }

        const scene = sceneTextureMemory();
        $('mem-scene').textContent = `${scene.materials} × ${scene.width}² RGBA8 = ${bytesLabel(scene.bytes)}`;
    };

    [widthInput, heightInput, formatSelect, mipsInput].forEach((control) => {
        control.addEventListener('input', paint);
        control.addEventListener('change', paint);
    });
    presetSelect.addEventListener('change', () => {
        if (!presetSelect.value) return;
        widthInput.value = presetSelect.value;
        heightInput.value = presetSelect.value;
        paint();
    });

    paint();
}
