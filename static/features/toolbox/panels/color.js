/**
 * Tool 1 — colour space converter.
 *
 * Two independent directions: a hex/8-bit sRGB colour shown in every space, and
 * a linear triple encoded back to display sRGB. The panel only formats the
 * result of `colorReport`/`linearToSrgbColor`; all the maths is in units.js.
 */

import { colorReport, formatNumber, linearToSrgbColor } from '../units.js';

const joinChannels = (values, digits = 4) => values.map((value) => formatNumber(value, digits)).join(', ');

export function mount(root) {
    root.innerHTML = `
        <div class="grid gap-3 xl:grid-cols-2">
            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">sRGB in</h2>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                    <input id="color-hex" type="text" value="#3b82f6" spellcheck="false" autocomplete="off"
                        aria-label="Hex or rgb() colour"
                        class="w-36 rounded border border-slate-200 px-2 py-1 font-mono text-[12px]">
                    <span id="color-swatch" class="h-8 w-8 rounded border border-slate-300" style="background:#3b82f6"></span>
                    <input id="color-picker" type="color" value="#3b82f6" aria-label="Pick a colour"
                        class="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5">
                </div>
                <p id="color-error" class="mt-1 min-h-[1rem] text-[10px] text-red-600"></p>
                <dl class="mt-1 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 font-mono text-[11px]">
                    <dt class="text-slate-500">8-bit sRGB</dt><dd id="color-rgb255" class="text-right">—</dd>
                    <dt class="text-slate-500">sRGB 0–1</dt><dd id="color-srgb" class="text-right">—</dd>
                    <dt class="text-slate-500">linear 0–1</dt><dd id="color-linear" class="text-right">—</dd>
                    <dt class="text-slate-500">linear ×255</dt><dd id="color-linear255" class="text-right">—</dd>
                    <dt class="text-slate-500">relative luminance</dt><dd id="color-luminance" class="text-right">—</dd>
                </dl>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Linear in → display sRGB</h2>
                <div class="mt-2 grid grid-cols-3 gap-2">
                    <label class="block text-[10px] text-slate-500">R linear
                        <input id="color-lr" type="number" step="0.001" value="0.214"
                            class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                    </label>
                    <label class="block text-[10px] text-slate-500">G linear
                        <input id="color-lg" type="number" step="0.001" value="0.214"
                            class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                    </label>
                    <label class="block text-[10px] text-slate-500">B linear
                        <input id="color-lb" type="number" step="0.001" value="0.214"
                            class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                    </label>
                </div>
                <dl class="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 font-mono text-[11px]">
                    <dt class="text-slate-500">sRGB 0–1</dt><dd id="color-reverse-srgb" class="text-right">—</dd>
                    <dt class="text-slate-500">8-bit</dt><dd id="color-reverse-rgb255" class="text-right">—</dd>
                    <dt class="text-slate-500">hex</dt><dd class="flex items-center justify-end gap-2"><span id="color-reverse-hex">—</span><span id="color-reverse-swatch" class="h-4 w-4 rounded border border-slate-300"></span></dd>
                </dl>
                <p id="color-reverse-warn" class="mt-2 min-h-[1rem] text-[10px] leading-snug text-amber-600"></p>
            </section>
        </div>

        <section class="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">What the shader sees</h2>
            <p class="mt-1 max-w-3xl text-[11px] leading-snug text-slate-600">
                A texture tagged <code class="rounded bg-slate-100 px-1">SRGBColorSpace</code> is decoded to linear
                light before it reaches a material; a value typed into a material colour is already linear. The
                conversion is the IEC 61966-2-1 curve, not <code class="rounded bg-slate-100 px-1">pow(c, 2.2)</code>:
                the two disagree by up to 0.003 in mid-tones, which is visible on a large wall.
            </p>
            <p class="mt-2 font-mono text-[10px] leading-relaxed text-slate-500">
                linear = c ≤ 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055)^2.4<br>
                srgb&nbsp;&nbsp; = l ≤ 0.0031308 ? l × 12.92 : 1.055 × l^(1/2.4) − 0.055
            </p>
        </section>
    `;

    const $ = (id) => root.querySelector(`#${id}`);
    const hexInput = $('color-hex');
    const picker = $('color-picker');
    const swatch = $('color-swatch');
    const error = $('color-error');

    const paintForward = () => {
        const report = colorReport(hexInput.value);
        if (report.error) {
            error.textContent = report.error;
            swatch.style.background = '#e2e8f0';
            ['rgb255', 'srgb', 'linear', 'linear255', 'luminance'].forEach((key) => {
                $(`color-${key}`).textContent = '—';
            });
            return;
        }
        error.textContent = '';
        swatch.style.background = report.hex;
        picker.value = report.hex;
        $('color-rgb255').textContent = joinChannels([report.rgb255.r, report.rgb255.g, report.rgb255.b], 0);
        $('color-srgb').textContent = joinChannels([report.srgb.r, report.srgb.g, report.srgb.b]);
        $('color-linear').textContent = joinChannels([report.linear.r, report.linear.g, report.linear.b]);
        $('color-linear255').textContent = joinChannels(
            [report.linear255.r, report.linear255.g, report.linear255.b],
            0
        );
        $('color-luminance').textContent = formatNumber(report.luminance);
    };

    const paintReverse = () => {
        const result = linearToSrgbColor({
            r: $('color-lr').value,
            g: $('color-lg').value,
            b: $('color-lb').value
        });
        $('color-reverse-srgb').textContent = joinChannels([result.srgb.r, result.srgb.g, result.srgb.b]);
        $('color-reverse-rgb255').textContent = joinChannels(
            [result.rgb255.r, result.rgb255.g, result.rgb255.b],
            0
        );
        $('color-reverse-hex').textContent = result.hex;
        $('color-reverse-swatch').style.background = result.hex;
        $('color-reverse-warn').textContent = result.warnings.join(' ');
    };

    hexInput.addEventListener('input', paintForward);
    picker.addEventListener('input', () => {
        hexInput.value = picker.value;
        paintForward();
    });
    ['color-lr', 'color-lg', 'color-lb'].forEach((id) => $(id).addEventListener('input', paintReverse));

    paintForward();
    paintReverse();
}
