/**
 * Tool 3 — texel density calculator.
 *
 * `density = texturePixels / surfaceMetres`, with the UV-coverage correction:
 * an island that covers a fraction of the sheet only gets the square root of it
 * per side. The second half inverts the question — what texture size hits a
 * target density — because that is the number a bill of materials needs.
 *
 * The third section measures a real imported model: the loader in `model.js`
 * returns plain position/UV/index buffers and `mesh.js` sums the 3D and UV areas
 * per shell, so the table shows what each part of the mesh actually gets.
 */

import { formatNumber } from '../units.js';
import { TEXEL_SURFACES, TEXEL_TEXTURE_SIZES, texelDensity, texturePixelsForDensity } from '../texture.js';
import { modelTexelReport } from '../mesh.js';
import { loadModelFile } from '../model.js';

/** Longest island table the panel will render; the rest is summarised. */
const ISLAND_ROWS = 60;

/** Mesh names come from the file, so they are escaped before reaching innerHTML. */
const escapeText = (text) => String(text).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

export function mount(root) {
    root.innerHTML = `
        <div class="grid gap-3 xl:grid-cols-2">
            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Density of a surface</h2>
                <div class="mt-2 grid grid-cols-2 gap-2">
                    <label class="block text-[10px] text-slate-500">Texture
                        <select id="texel-pixels" class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]"></select>
                    </label>
                    <label class="block text-[10px] text-slate-500">Surface (m)
                        <input id="texel-surface" type="number" min="0.01" step="0.01" value="2.7"
                            class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                    </label>
                    <label class="block text-[10px] text-slate-500">UV coverage (%)
                        <input id="texel-uv" type="number" min="1" max="100" step="1" value="100"
                            class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                    </label>
                    <label class="block text-[10px] text-slate-500">Preset surface
                        <select id="texel-preset" class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px]"></select>
                    </label>
                </div>
                <dl class="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 font-mono text-[11px]">
                    <dt class="text-slate-500">per metre</dt><dd id="texel-density" class="text-right">—</dd>
                    <dt class="text-slate-500">per centimetre</dt><dd id="texel-cm" class="text-right">—</dd>
                    <dt class="text-slate-500">per inch</dt><dd id="texel-inch" class="text-right">—</dd>
                </dl>
                <p id="texel-error" class="mt-1 min-h-[1rem] text-[10px] text-red-600" role="alert" aria-live="polite"></p>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Texture size for a target</h2>
                <label class="mt-2 block text-[10px] text-slate-500">Target density (px/m)
                    <input id="texel-target" type="number" min="1" step="1" value="512"
                        class="mt-0.5 w-32 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                </label>
                <dl class="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 font-mono text-[11px]">
                    <dt class="text-slate-500">exact</dt><dd id="texel-required" class="text-right">—</dd>
                    <dt class="text-slate-500">power of two</dt><dd id="texel-required-pot" class="text-right">—</dd>
                </dl>
                <p class="mt-3 text-[10px] leading-snug text-slate-500">
                    The 4K ceiling is a browser budget, not a format limit: a single 4096² RGBA8 texture is 64 MiB,
                    and every extra sheet is charged to the same tab.
                </p>
            </section>
        </div>

        <section class="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex flex-wrap items-end justify-between gap-2">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Model check</h2>
                <label class="text-[10px] text-slate-500">Sheet
                    <select id="texel-model-sheet" class="ml-1 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]"></select>
                </label>
            </div>
            <button type="button" id="texel-model-drop"
                class="mt-2 w-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-left text-[11px] leading-snug text-slate-500 hover:border-slate-300 hover:bg-slate-100">
                <span class="font-semibold text-slate-700">Drop a model here</span> or press to choose a .glb, .gltf,
                .obj, .stl or .ply. Positions are read in metres from the file; nothing leaves this tab.
            </button>
            <input id="texel-model-file" type="file" accept=".glb,.gltf,.obj,.stl,.ply" class="hidden">

            <p id="texel-model-note" class="mt-2 text-[10px] leading-snug text-slate-500">No model loaded yet.</p>
            <p id="texel-model-error" class="mt-1 min-h-[1rem] text-[10px] text-red-600" role="alert" aria-live="polite"></p>

            <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] sm:grid-cols-4">
                <div class="flex items-baseline justify-between gap-2"><dt class="text-slate-500">file</dt><dd id="texel-model-file-name" class="truncate text-right">—</dd></div>
                <div class="flex items-baseline justify-between gap-2"><dt class="text-slate-500">meshes</dt><dd id="texel-model-meshes" class="text-right">—</dd></div>
                <div class="flex items-baseline justify-between gap-2"><dt class="text-slate-500">triangles</dt><dd id="texel-model-triangles" class="text-right">—</dd></div>
                <div class="flex items-baseline justify-between gap-2"><dt class="text-slate-500">UV shells</dt><dd id="texel-model-shells" class="text-right">—</dd></div>
                <div class="flex items-baseline justify-between gap-2"><dt class="text-slate-500">overall</dt><dd id="texel-model-density" class="text-right font-semibold">—</dd></div>
                <div class="flex items-baseline justify-between gap-2"><dt class="text-slate-500">spread</dt><dd id="texel-model-spread" class="text-right">—</dd></div>
                <div class="flex items-baseline justify-between gap-2"><dt class="text-slate-500">surface</dt><dd id="texel-model-area" class="text-right">—</dd></div>
                <div class="flex items-baseline justify-between gap-2"><dt class="text-slate-500">UV used</dt><dd id="texel-model-uv" class="text-right">—</dd></div>
            </dl>
            <p id="texel-model-warnings" class="mt-2 min-h-[1rem] text-[10px] leading-snug text-amber-600"></p>

            <div class="mt-1 overflow-x-auto">
                <table class="w-full text-[10px]">
                    <thead>
                        <tr class="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                            <th class="py-1 pr-2 font-semibold">Mesh</th>
                            <th class="py-1 pr-2 font-semibold">Shell</th>
                            <th class="py-1 pr-2 text-right font-semibold">m²</th>
                            <th class="py-1 pr-2 text-right font-semibold">UV %</th>
                            <th class="py-1 pr-2 text-right font-semibold">px/m</th>
                            <th class="py-1 font-semibold">Flags</th>
                        </tr>
                    </thead>
                    <tbody id="texel-model-table" class="font-mono"></tbody>
                </table>
            </div>
        </section>
    `;

    const $ = (id) => root.querySelector(`#${id}`);
    const pixelsSelect = $('texel-pixels');
    const surfaceInput = $('texel-surface');
    const uvInput = $('texel-uv');
    const presetSelect = $('texel-preset');
    const targetInput = $('texel-target');
    const sheetSelect = $('texel-model-sheet');
    const fileInput = $('texel-model-file');

    TEXEL_TEXTURE_SIZES.forEach((size) => {
        const option = document.createElement('option');
        option.value = String(size);
        option.textContent = `${size} × ${size} px`;
        if (size === 1024) option.selected = true;
        pixelsSelect.appendChild(option);

        const sheet = document.createElement('option');
        sheet.value = String(size);
        sheet.textContent = `${size} × ${size}`;
        if (size === 1024) sheet.selected = true;
        sheetSelect.appendChild(sheet);
    });

    const none = document.createElement('option');
    none.value = '';
    none.textContent = '—';
    presetSelect.appendChild(none);
    TEXEL_SURFACES.forEach((preset, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = preset.label;
        presetSelect.appendChild(option);
    });

    const paint = () => {
        try {
            const report = texelDensity({
                texturePixels: pixelsSelect.value,
                surfaceMetres: surfaceInput.value,
                uvFraction: Number(uvInput.value) / 100
            });
            $('texel-density').textContent = `${formatNumber(report.pixelsPerMetre, 4)} px/m`;
            $('texel-cm').textContent = `${formatNumber(report.pixelsPerCentimetre, 4)} px/cm`;
            $('texel-inch').textContent = `${formatNumber(report.pixelsPerInch, 4)} px/in`;
            $('texel-error').textContent = '';
        } catch (error) {
            ['texel-density', 'texel-cm', 'texel-inch'].forEach((id) => { $(id).textContent = '—'; });
            $('texel-error').textContent = error.message;
        }

        try {
            const required = texturePixelsForDensity({
                density: targetInput.value,
                surfaceMetres: surfaceInput.value,
                uvFraction: Number(uvInput.value) / 100
            });
            $('texel-required').textContent = `${formatNumber(required.exact, 1)} px`;
            $('texel-required-pot').textContent = `${required.powerOfTwo} × ${required.powerOfTwo} px`;
        } catch {
            $('texel-required').textContent = '—';
            $('texel-required-pot').textContent = '—';
        }
    };

    // --- model check ------------------------------------------------------

    let model = null;
    let measured = null;

    const setModelError = (message) => {
        $('texel-model-error').textContent = message;
        if (message) window.toolboxKit?.setStatus?.(message, 'error');
    };

    const clearModel = (note) => {
        measured = null;
        ['texel-model-meshes', 'texel-model-triangles', 'texel-model-shells', 'texel-model-density',
            'texel-model-spread', 'texel-model-area', 'texel-model-uv'].forEach((id) => { $(id).textContent = '—'; });
        $('texel-model-warnings').textContent = '';
        $('texel-model-table').innerHTML = '';
        $('texel-model-note').textContent = note;
    };

    const paintModel = () => {
        if (!model) {
            clearModel('No model loaded yet.');
            return;
        }
        try {
            measured = modelTexelReport(model.meshes, { texturePixels: Number(sheetSelect.value) });
        } catch (error) {
            clearModel(`${model.name} could not be measured.`);
            setModelError(error.message);
            return;
        }
        setModelError('');

        const totals = measured.totals;
        $('texel-model-file-name').textContent = `${model.name} · ${model.format}`;
        $('texel-model-meshes').textContent = String(totals.meshes);
        $('texel-model-triangles').textContent = totals.triangleCount.toLocaleString('en-US');
        $('texel-model-shells').textContent = String(totals.islandCount);
        $('texel-model-density').textContent = totals.density == null ? 'no UVs' : `${formatNumber(totals.density, 4)} px/m`;
        $('texel-model-spread').textContent = totals.spread == null ? '—' : `${formatNumber(totals.spread, 3)}×`;
        $('texel-model-area').textContent = `${formatNumber(totals.area3d, 3)} m²`;
        $('texel-model-uv').textContent = `${formatNumber(totals.uvArea * 100, 3)} %`;

        const warnings = [];
        if (totals.withoutUVs) {
            warnings.push(`${totals.withoutUVs} mesh${totals.withoutUVs === 1 ? ' carries' : 'es carry'} no UVs and ${totals.withoutUVs === 1 ? 'is' : 'are'} left out of the density.`);
        }
        if (totals.mirrored) {
            warnings.push(totals.mixed
                ? 'Some UV shells are mirrored relative to the others.'
                : 'The UV shells are mirrored; check the winding before baking.');
        }
        if (totals.outside) warnings.push('Some UVs fall outside 0–1, so those shells tile and the sheet repeats.');
        if (totals.uvDegenerate) {
            warnings.push(`${totals.uvDegenerate} triangle${totals.uvDegenerate === 1 ? '' : 's'} have surface area but no UV area; they are excluded from the densities.`);
        }
        if (totals.collapsed) {
            warnings.push(`${totals.collapsed} degenerate triangle${totals.collapsed === 1 ? '' : 's'} with no area.`);
        }
        if (totals.spread != null && totals.spread > 1.1) {
            warnings.push(`Shell densities vary by ${formatNumber(totals.spread, 2)}×; one sheet cannot hold a single density across this model.`);
        }
        $('texel-model-warnings').textContent = warnings.join(' ');
        $('texel-model-note').textContent = measured.islands.length
            ? `${measured.islands.length} UV shell${measured.islands.length === 1 ? '' : 's'} measured at ${measured.textureWidth} × ${measured.textureHeight} px.`
            : 'No UV shells to measure.';

        const rows = measured.islands.slice(0, ISLAND_ROWS).map((island) => {
            const flags = [island.mirrored ? 'mirrored' : '', island.outside ? 'outside 0–1' : '']
                .filter(Boolean).join(', ') || '—';
            const meshName = escapeText(island.mesh);
            return `<tr class="border-b border-slate-100">
                <td class="max-w-[9rem] truncate py-0.5 pr-2" title="${meshName}">${meshName}</td>
                <td class="py-0.5 pr-2 text-slate-500">${island.shell}</td>
                <td class="py-0.5 pr-2 text-right">${formatNumber(island.area3d, 4)}</td>
                <td class="py-0.5 pr-2 text-right">${formatNumber(island.uvArea * 100, 3)}</td>
                <td class="py-0.5 pr-2 text-right">${island.density == null ? '—' : formatNumber(island.density, 1)}</td>
                <td class="py-0.5 text-slate-500">${flags}</td>
            </tr>`;
        });
        if (measured.islands.length > ISLAND_ROWS) {
            rows.push(`<tr><td colspan="6" class="py-1 text-slate-400">${measured.islands.length - ISLAND_ROWS} more shells not shown.</td></tr>`);
        }
        $('texel-model-table').innerHTML = rows.join('');
        window.toolboxKit?.setStatus?.(`Measured ${model.name}: ${totals.islandCount} UV shells.`);
    };

    const readModel = async (file) => {
        setModelError('');
        $('texel-model-note').textContent = `Reading ${file.name}…`;
        try {
            model = await loadModelFile(file);
            paintModel();
        } catch (error) {
            model = null;
            $('texel-model-file-name').textContent = '—';
            clearModel(`${file.name} could not be read.`);
            setModelError(error.message);
        }
    };

    $('texel-model-drop').addEventListener('click', () => fileInput.click());
    $('texel-model-drop').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInput.click();
        }
    });
    $('texel-model-drop').addEventListener('dragover', (event) => {
        event.preventDefault();
        $('texel-model-drop').dataset.drag = 'true';
    });
    $('texel-model-drop').addEventListener('dragleave', () => { delete $('texel-model-drop').dataset.drag; });
    $('texel-model-drop').addEventListener('drop', (event) => {
        event.preventDefault();
        delete $('texel-model-drop').dataset.drag;
        const file = event.dataTransfer?.files?.[0];
        if (file) readModel(file);
    });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (file) readModel(file);
    });
    sheetSelect.addEventListener('change', paintModel);

    [pixelsSelect, surfaceInput, uvInput, targetInput].forEach((control) => {
        control.addEventListener('input', paint);
        control.addEventListener('change', paint);
    });
    presetSelect.addEventListener('change', () => {
        const preset = TEXEL_SURFACES[Number(presetSelect.value)];
        if (!preset) return;
        surfaceInput.value = String(preset.metres);
        paint();
    });

    if (window.toolboxKit) {
        window.toolboxKit.panel = {
            id: 'texel-density',
            measure: (meshes, options = {}) => {
                model = { name: options.name || 'model', format: options.format || 'mesh', meshes };
                if (options.sheet) sheetSelect.value = String(options.sheet);
                paintModel();
                return measured;
            },
            state: () => ({
                file: model ? model.name : null,
                sheet: Number(sheetSelect.value),
                density: measured?.totals.density ?? null,
                islands: measured?.totals.islandCount ?? 0,
                meshes: measured?.totals.meshes ?? 0,
                triangles: measured?.totals.triangleCount ?? 0,
                spread: measured?.totals.spread ?? null,
                rows: root.querySelectorAll('#texel-model-table tr').length,
                warnings: $('texel-model-warnings').textContent,
                error: $('texel-model-error').textContent,
                note: $('texel-model-note').textContent
            })
        };
    }

    paint();
    clearModel('No model loaded yet.');
}
