/**
 * Tool 6 — PBR channel packer.
 *
 * Maps are loaded against a logical slot (AO, roughness, metalness, …) and the
 * mapping decides which output channel each slot lands in. Switching preset
 * therefore repacks the same maps into the new layout instead of relabelling
 * whatever happened to be in red. The packed sheet and its JSON sidecar come
 * from `pbr.js`, so the mapping the file describes is the mapping that was
 * written.
 */

import { baseName, decodeImageFile, downloadImage, downloadJson, paintImage } from '../io.js';
import {
    CHANNEL_ORDER,
    CHANNEL_PRESETS,
    PACK_SLOTS,
    channelPreset,
    packChannels,
    packSidecar
} from '../pbr.js';

export function mount(root) {
    root.innerHTML = `
        <div class="grid gap-3 xl:grid-cols-2">
            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="flex flex-wrap items-end justify-between gap-2">
                    <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sources</h2>
                    <label class="text-[10px] text-slate-500">Preset
                        <select id="pack-preset" class="ml-1 rounded border border-slate-200 px-1.5 py-1 text-[11px]"></select>
                    </label>
                </div>
                <div id="pack-rows" class="mt-2"></div>
                <p id="pack-note" class="mt-2 text-[10px] leading-snug text-slate-500"></p>
                <p id="pack-error" class="mt-1 min-h-[1rem] text-[10px] text-red-600" role="alert" aria-live="polite"></p>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="flex items-baseline justify-between gap-2">
                    <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Packed texture</h2>
                    <div class="flex gap-1">
                        <button type="button" id="pack-png" disabled
                            class="rounded border border-slate-300 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400">
                            PNG
                        </button>
                        <button type="button" id="pack-json" disabled
                            class="rounded border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700 disabled:border-slate-200 disabled:text-slate-400">
                            Mapping JSON
                        </button>
                    </div>
                </div>
                <canvas id="pack-preview" class="mt-2" aria-label="Packed texture preview"></canvas>
                <dl class="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1 font-mono text-[10px]">
                    <dt class="text-slate-500">size</dt><dd id="pack-size" class="text-right">—</dd>
                    <dt class="text-slate-500">sources</dt><dd id="pack-sources" class="text-right">—</dd>
                    <dt class="text-slate-500">resampled</dt><dd id="pack-resized" class="text-right">—</dd>
                </dl>
                <p id="pack-notes" class="mt-2 min-h-[1rem] text-[10px] leading-snug text-amber-600"></p>
                <p class="mt-2 text-[10px] leading-snug text-slate-500">
                    A channel map is data, not colour: the packer reads the source bytes with no sRGB transfer, and the
                    sidecar reminds the renderer to tag the result as linear.
                </p>
            </section>
        </div>
    `;

    const $ = (id) => root.querySelector(`#${id}`);
    const presetSelect = $('pack-preset');
    const rowsHost = $('pack-rows');
    const pngButton = $('pack-png');
    const jsonButton = $('pack-json');

    /** One entry per loaded slot: `{ image, name }`. */
    const loaded = {};
    const selects = {};
    let packed = null;
    let channelFiles = {};

    CHANNEL_PRESETS.forEach((preset) => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.label;
        presetSelect.appendChild(option);
    });

    const sourceFor = (channel) => {
        const slot = selects[channel]?.value;
        return slot ? loaded[slot] || null : null;
    };

    const refreshStatus = () => {
        CHANNEL_ORDER.forEach((channel) => {
            const source = sourceFor(channel);
            $(`pack-status-${channel}`).textContent = source
                ? `${source.image.width}² · ${source.name}`
                : '—';
        });
    };

    CHANNEL_ORDER.forEach((channel) => {
        const row = document.createElement('div');
        row.className = 'flex flex-wrap items-center gap-2 border-b border-slate-100 py-1.5';

        const letter = document.createElement('span');
        letter.className = 'w-3 font-mono text-[10px] uppercase text-slate-400';
        letter.textContent = channel;

        const select = document.createElement('select');
        select.id = `pack-slot-${channel}`;
        select.className = 'w-32 rounded border border-slate-200 px-1 py-1 text-[10px]';
        select.setAttribute('aria-label', `${channel.toUpperCase()} channel source`);
        const none = document.createElement('option');
        none.value = '';
        none.textContent = channel === 'a' ? 'Opaque (255)' : 'Not packed';
        select.appendChild(none);
        PACK_SLOTS.forEach((slot) => {
            const option = document.createElement('option');
            option.value = slot.id;
            option.textContent = slot.label;
            select.appendChild(option);
        });
        selects[channel] = select;

        const picker = document.createElement('label');
        picker.className = 'cursor-pointer rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50';
        picker.textContent = 'Choose map';
        const input = document.createElement('input');
        input.id = `pack-file-${channel}`;
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp';
        input.className = 'hidden';
        picker.appendChild(input);

        const status = document.createElement('span');
        status.id = `pack-status-${channel}`;
        status.className = 'ml-auto max-w-[9rem] truncate font-mono text-[10px] text-slate-400';
        status.textContent = '—';

        row.append(letter, select, picker, status);
        rowsHost.appendChild(row);

        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            input.value = '';
            if (!file) return;
            const slot = select.value;
            if (!slot) {
                setError(`Choose a source for the ${channel.toUpperCase()} channel before loading a map.`);
                return;
            }
            try {
                const decoded = await decodeImageFile(file);
                loaded[slot] = { image: decoded.image, name: decoded.name };
                refreshStatus();
                pick();
            } catch (error) {
                setError(error.message);
            }
        });
    });

    const currentMapping = () => Object.fromEntries(
        CHANNEL_ORDER.map((channel) => [channel, selects[channel].value || null])
    );

    const setError = (message) => {
        $('pack-error').textContent = message;
        if (message) window.toolboxKit?.setStatus?.(message, 'error');
    };

    const syncPreset = () => {
        const mapping = currentMapping();
        const match = CHANNEL_PRESETS.find((preset) => CHANNEL_ORDER
            .every((channel) => (preset.channels[channel] || null) === mapping[channel]));
        presetSelect.value = match ? match.id : 'custom';
        $('pack-note').textContent = channelPreset(presetSelect.value).note;
    };

    const clearPreview = () => {
        packed = null;
        pngButton.disabled = true;
        jsonButton.disabled = true;
        $('pack-size').textContent = '—';
        $('pack-sources').textContent = '—';
        $('pack-resized').textContent = '—';
        $('pack-notes').textContent = '';
    };

    const pick = () => {
        setError('');
        const mapping = currentMapping();
        const sources = {};
        const files = {};
        CHANNEL_ORDER.forEach((channel) => {
            const source = sourceFor(channel);
            if (!source) return;
            sources[channel] = source.image;
            files[channel] = source.name;
        });
        if (!Object.keys(sources).length) {
            clearPreview();
            return;
        }

        // Pack at the largest source, so nothing is upscaled.
        const size = Object.values(sources).reduce(
            (biggest, image) => Math.max(biggest, image.width, image.height),
            1
        );

        try {
            packed = packChannels(sources, { channels: mapping, width: size, height: size });
        } catch (error) {
            clearPreview();
            setError(error.message);
            return;
        }
        channelFiles = files;

        paintImage($('pack-preview'), packed.image, { max: 320, checker: true });
        $('pack-size').textContent = `${packed.width} × ${packed.height}`;
        $('pack-sources').textContent = String(packed.sources.length);
        $('pack-resized').textContent = packed.resized.length
            ? packed.resized.map((entry) => `${entry.channel.toUpperCase()} ${entry.from.width}²`).join(', ')
            : 'none';
        $('pack-notes').textContent = packed.defaulted.map((entry) => (entry.slot
            ? `${entry.channel.toUpperCase()} is filled with ${entry.value}: no ${entry.slot} map loaded.`
            : `${entry.channel.toUpperCase()} is constant ${entry.value}.`)).join(' ');
        pngButton.disabled = false;
        jsonButton.disabled = false;
    };

    presetSelect.addEventListener('change', () => {
        const preset = channelPreset(presetSelect.value);
        CHANNEL_ORDER.forEach((channel) => {
            selects[channel].value = preset.channels[channel] || '';
        });
        refreshStatus();
        syncPreset();
        pick();
    });

    CHANNEL_ORDER.forEach((channel) => selects[channel].addEventListener('change', () => {
        refreshStatus();
        syncPreset();
        pick();
    }));

    const stem = () => baseName(
        channelFiles.r || channelFiles.g || channelFiles.b || channelFiles.a || 'packed'
    );

    pngButton.addEventListener('click', async () => {
        if (!packed) return;
        try {
            await downloadImage(packed.image, `${stem()}_${presetSelect.value}.png`);
            window.toolboxKit?.setStatus?.('Saved the packed PNG.');
        } catch (error) {
            setError(error.message);
        }
    });

    jsonButton.addEventListener('click', () => {
        if (!packed) return;
        try {
            downloadJson(
                packSidecar(packed, { preset: presetSelect.value, files: channelFiles }),
                `${stem()}_${presetSelect.value}.json`
            );
            window.toolboxKit?.setStatus?.('Saved the channel mapping.');
        } catch (error) {
            setError(error.message);
        }
    });

    if (window.toolboxKit) {
        window.toolboxKit.panel = {
            id: 'channel-packer',
            load: (channel, image, name = `${channel}.png`) => {
                if (!CHANNEL_ORDER.includes(channel)) throw new Error(`Unknown channel "${channel}".`);
                const slot = selects[channel].value;
                if (!slot) throw new Error(`The ${channel.toUpperCase()} channel has no source slot; pick one first.`);
                loaded[slot] = { image, name };
                refreshStatus();
                pick();
                return packed;
            },
            state: () => ({
                preset: presetSelect.value,
                channels: currentMapping(),
                size: packed ? { width: packed.width, height: packed.height } : null,
                sources: packed ? packed.sources.length : 0,
                resized: packed ? packed.resized.length : 0,
                defaulted: packed ? packed.defaulted.map((entry) => entry.channel) : [],
                files: channelFiles,
                downloadEnabled: !pngButton.disabled,
                pixels: packed ? Array.from(packed.image.data.slice(0, 4)) : null
            })
        };
    }

    presetSelect.value = 'gltf-orm';
    CHANNEL_ORDER.forEach((channel) => {
        selects[channel].value = CHANNEL_PRESETS[0].channels[channel] || '';
    });
    syncPreset();
    pick();
}
