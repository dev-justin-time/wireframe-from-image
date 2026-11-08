/**
 * Tool 2 — unit converter.
 *
 * One table (units.js) serves the six quantities; the panel just picks two
 * units out of a group and prints the row of every unit for the same value.
 * The second card is the part a generic converter does not have: given a
 * measured length and the length a model reports, it names the unit slip.
 */

import { UNIT_GROUPS, convertUnit, formatNumber, scaleMismatch, unitsInGroup } from '../units.js';

function fillSelect(select, units, selected) {
    select.innerHTML = '';
    units.forEach((unit) => {
        const option = document.createElement('option');
        option.value = unit.id;
        option.textContent = `${unit.label} (${unit.symbol})`;
        if (unit.id === selected) option.selected = true;
        select.appendChild(option);
    });
}

export function mount(root) {
    root.innerHTML = `
        <div class="grid gap-3 xl:grid-cols-2">
            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Convert</h2>
                <div class="mt-2 grid grid-cols-2 gap-2">
                    <label class="block text-[10px] text-slate-500">Quantity
                        <select id="unit-group" class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px]"></select>
                    </label>
                    <label class="block text-[10px] text-slate-500">Value
                        <input id="unit-value" type="number" step="any" value="1"
                            class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                    </label>
                    <label class="block text-[10px] text-slate-500">From
                        <select id="unit-from" class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px]"></select>
                    </label>
                    <label class="block text-[10px] text-slate-500">To
                        <select id="unit-to" class="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px]"></select>
                    </label>
                </div>
                <div class="mt-2 flex items-end justify-between gap-2">
                    <p id="unit-result" class="font-mono text-lg font-semibold text-slate-900">—</p>
                    <button id="unit-swap" type="button"
                        class="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Swap</button>
                </div>
                <p id="unit-error" class="mt-1 min-h-[1rem] text-[10px] text-red-600"></p>
                <p id="unit-formula" class="mt-1 font-mono text-[10px] text-slate-400"></p>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Same value, every unit</h2>
                <table class="mt-2 w-full text-[11px]">
                    <tbody id="unit-table" class="font-mono"></tbody>
                </table>
            </section>
        </div>

        <section class="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Scale mismatch</h2>
            <p class="mt-1 max-w-3xl text-[11px] leading-snug text-slate-600">
                A model that imports at the wrong size is almost always a unit slip, not a modelling error. Enter the
                length you measured on the drawing and the length the model reports (same axis, same numbers, any
                unit) and the factor is named.
            </p>
            <div class="mt-2 flex flex-wrap items-end gap-2">
                <label class="block text-[10px] text-slate-500">Measured length
                    <input id="scale-measured" type="number" step="any" value="3"
                        class="mt-0.5 w-32 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                </label>
                <label class="block text-[10px] text-slate-500">Model length
                    <input id="scale-model" type="number" step="any" value="3000"
                        class="mt-0.5 w-32 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px]">
                </label>
                <div class="pb-1 font-mono text-[12px] text-slate-700">
                    factor <b id="scale-factor">—</b>
                </div>
            </div>
            <p id="scale-hint" class="mt-2 min-h-[1rem] text-[11px] text-slate-600"></p>
            <p id="scale-error" class="mt-1 min-h-[1rem] text-[10px] text-red-600"></p>
        </section>
    `;

    const $ = (id) => root.querySelector(`#${id}`);
    const groupSelect = $('unit-group');
    const fromSelect = $('unit-from');
    const toSelect = $('unit-to');
    const valueInput = $('unit-value');

    UNIT_GROUPS.forEach((group) => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.label;
        groupSelect.appendChild(option);
    });

    const currentGroup = () => UNIT_GROUPS.find((group) => group.id === groupSelect.value) || UNIT_GROUPS[0];

    const resetUnits = () => {
        const units = unitsInGroup(currentGroup().id);
        fillSelect(fromSelect, units, units[0].id);
        fillSelect(toSelect, units, (units[1] || units[0]).id);
        paint();
    };

    function paint() {
        const group = currentGroup();
        const from = group.units.find((unit) => unit.id === fromSelect.value) || group.units[0];
        const to = group.units.find((unit) => unit.id === toSelect.value) || group.units[0];
        const raw = valueInput.value;

        try {
            const result = convertUnit(raw, from.id, to.id);
            $('unit-result').textContent = `${formatNumber(result, 6)} ${to.symbol}`;
            $('unit-formula').textContent = `${formatNumber(raw, 6)} ${from.symbol} = ${formatNumber(result, 6)} ${to.symbol}`;
            $('unit-error').textContent = '';
            const rows = group.units.map((unit) => {
                const converted = convertUnit(raw, from.id, unit.id);
                return `<tr><td class="py-0.5 pr-2 text-slate-500">${unit.label}</td>
                    <td class="py-0.5 text-right text-slate-900">${formatNumber(converted, 6)} ${unit.symbol}</td></tr>`;
            });
            $('unit-table').innerHTML = rows.join('');
        } catch (error) {
            $('unit-result').textContent = '—';
            $('unit-formula').textContent = '';
            $('unit-error').textContent = error.message;
            $('unit-table').innerHTML = '';
        }
    }

    groupSelect.addEventListener('change', resetUnits);
    [fromSelect, toSelect].forEach((select) => select.addEventListener('change', paint));
    valueInput.addEventListener('input', paint);
    $('unit-swap').addEventListener('click', () => {
        const from = fromSelect.value;
        fromSelect.value = toSelect.value;
        toSelect.value = from;
        paint();
    });

    const paintScale = () => {
        try {
            const mismatch = scaleMismatch($('scale-measured').value, $('scale-model').value);
            $('scale-factor').textContent = `×${formatNumber(mismatch.factor, 6)}`;
            $('scale-error').textContent = '';
            $('scale-hint').textContent = mismatch.hint
                ? `${mismatch.hint} — the model is ${mismatch.factor > 1 ? 'larger' : 'smaller'} by that factor.`
                : 'No common unit factor matches, so the two drawings differ for another reason: a different origin, a trimmed extent, or a non-uniform scale.';
        } catch (error) {
            $('scale-factor').textContent = '—';
            $('scale-hint').textContent = '';
            $('scale-error').textContent = error.message;
        }
    };
    ['scale-measured', 'scale-model'].forEach((id) => $(id).addEventListener('input', paintScale));

    resetUnits();
    paintScale();
}
