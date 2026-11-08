    import {
        WALL_DEFAULTS,
        computeWallDesign,
        wallTakeoffCsv
    } from '../../features/wall/design.js';
    import { applyPriceBookToDesign } from '../../features/pricing/book.js';
    import { clearDraft, writeDraft } from '../../core/drafts.js';
    import {
        WALL_COVERINGS,
        PAINT_COLOURS,
        PAINT_SHEENS,
        HARMONIES,
        SUBSTRATES,
        coveringById,
        coveringOptions,
        coveringsByFamily,
        defaultCoveringFor,
        defaultSubstrateFor,
        paintCoveringForSheen,
        colourById,
        lrvOf
    } from '../../features/wall/materials.js';
    import {
        WALL_GLOSSARY,
        WALL_FORMULAS,
        wallGlossaryByCategory,
        searchWallGlossary
    } from '../../features/wall/glossary.js';
    import { createWallViewer, drawWallElevation } from '../../features/wall/preview.js';

    const $ = (id) => document.getElementById(id);
    const DRAFT_KEY = 'wall-suite-draft';
    const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    const num = (value, digits = 2) => Number(value || 0).toFixed(digits);

    const FAMILY_LABEL = {
        paint: 'Paint',
        plaster: 'Plaster',
        texture: 'Texture',
        wallpaper: 'Wallpaper',
        panel: 'Panels and boards',
        tile: 'Tile',
        stone: 'Stone',
        masonry: 'Masonry',
        siding: 'Siding',
        stucco: 'Stucco and render',
        eifs: 'EIFS',
        metal: 'Metal'
    };

    let state = {
        ...WALL_DEFAULTS,
        exposure: 'interior',
        covering: 'paint-eggshell',
        colour: 'cotton-white',
        substrate: 'gypsum-painted'
    };
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (saved && typeof saved === 'object') state = { ...state, ...saved };
    } catch (error) { /* a broken draft falls back to the defaults */ }

    let design = null;
    const viewer = createWallViewer($('stage'));

    function currentOptions() {
        return coveringOptions({ exposure: state.exposure });
    }

    function fillCoveringSelect() {
        const select = $('covering');
        const groups = coveringsByFamily({ exposure: state.exposure });
        select.innerHTML = groups.map((group) => `
            <optgroup label="${FAMILY_LABEL[group.family] || group.family}">
                ${group.entries.map((entry) => `<option value="${entry.id}">${entry.label}</option>`).join('')}
            </optgroup>
        `).join('');
        const options = currentOptions();
        if (!options.some((entry) => entry.id === state.covering)) state.covering = defaultCoveringFor(state.exposure).id;
        select.value = state.covering;
        $('covering-count').textContent = `${options.length} of ${WALL_COVERINGS.length}`;
    }

    function fillSubstrateSelect() {
        const select = $('substrate');
        const covering = coveringById(state.covering);
        const ordered = [...SUBSTRATES].sort((a, b) => {
            const aFit = covering.substrates.includes(a.id) ? 0 : 1;
            const bFit = covering.substrates.includes(b.id) ? 0 : 1;
            return aFit - bFit;
        });
        select.innerHTML = ordered.map((entry) => `
            <option value="${entry.id}">${entry.label}${covering.substrates.includes(entry.id) ? '' : ' · not listed'}</option>
        `).join('');
        if (!covering.substrates.includes(state.substrate)) {
            state.substrate = defaultSubstrateFor(covering, state.exposure);
        }
        select.value = state.substrate;
    }

    function fillPaintSelects() {
        const sheenSelect = $('sheen');
        if (!sheenSelect.options.length) {
            sheenSelect.innerHTML = PAINT_SHEENS.map((entry) => `<option value="${entry.id}">${entry.label} · ${entry.glossUnits} GU</option>`).join('');
        }
        const covering = coveringById(state.covering);
        if (covering.family === 'paint') {
            if (!state.sheen) state.sheen = covering.sheen;
            sheenSelect.value = state.sheen;
        }
        $('harmony').innerHTML = HARMONIES.map((entry) => `<option value="${entry.id}">${entry.label}</option>`).join('');
        $('harmony').value = state.harmony;
        $('colour-grid').innerHTML = PAINT_COLOURS.map((entry) => `
            <button type="button" class="colour-button w-5 h-5 rounded border border-slate-300" data-colour="${entry.id}"
                style="background:${entry.hex}" title="${entry.label} · ${entry.hex}"></button>
        `).join('');
        $('colour-count').textContent = `${PAINT_COLOURS.length} colours`;
    }

    // --- Inputs ------------------------------------------------------
    function bindNumber(id, key, transform = Number) {
        const element = $(id);
        element.addEventListener('input', () => {
            const value = transform(element.value);
            if (Number.isFinite(value)) {
                state[key] = value;
                render();
            }
        });
        if (element.type === 'number') element.value = String(state[key] ?? element.value);
    }

    function bindSelect(id, key, cast = String) {
        const element = $(id);
        element.addEventListener('change', () => {
            state[key] = cast(element.value);
            render();
        });
        if (state[key] != null) element.value = String(state[key]);
    }

    function bindToggle(id, key) {
        const element = $(id);
        element.checked = Boolean(state[key]);
        element.addEventListener('change', () => {
            state[key] = element.checked;
            render();
        });
    }

    ['length', 'height', 'openings', 'perimeter', 'coats'].forEach((key) => {
        const id = key === 'openings' ? 'openings' : key;
        const element = $(id);
        element.value = String(state[key] ?? element.value);
        element.addEventListener('input', () => {
            const value = Number(element.value);
            if (Number.isFinite(value) && value >= 0) {
                state[key] = value;
                render();
            }
        });
    });
    bindNumber('building-year', 'buildingYear');
    bindNumber('temperature', 'temperatureC');
    bindNumber('grade', 'gradeClearanceMm');
    bindNumber('wind', 'windMph');
    bindNumber('waste', 'waste', (value) => Number(value) / 100);

    bindSelect('condition', 'condition');
    bindSelect('fire-rating', 'fireRating');
    bindSelect('climate', 'climateZone', Number);
    bindSelect('harmony', 'harmony');

    bindToggle('wet-area', 'wetArea');
    bindToggle('primer', 'primer');
    bindToggle('trim', 'trim');
    bindToggle('wrb', 'wrb');
    bindToggle('rain-screen', 'rainScreen');
    bindToggle('flashing', 'flashing');
    bindToggle('rain', 'rainExpected');

    $('covering').addEventListener('change', () => {
        state.covering = $('covering').value;
        state.coats = null;
        state.waste = null;
        state.sheen = null;
        const covering = coveringById(state.covering);
        if (covering.exposure !== 'both') state.exposure = covering.exposure;
        if (!covering.substrates.includes(state.substrate)) {
            state.substrate = defaultSubstrateFor(covering, state.exposure);
        }
        fillSubstrateSelect();
        fillPaintSelects();
        syncExposureButtons();
        render();
    });

    $('substrate').addEventListener('change', () => {
        state.substrate = $('substrate').value;
        render();
    });

    $('sheen').addEventListener('change', () => {
        state.sheen = $('sheen').value;
        render();
    });

    $('colour-grid').addEventListener('click', (event) => {
        const button = event.target.closest('[data-colour]');
        if (!button) return;
        state.colour = button.dataset.colour;
        render();
    });

    document.querySelectorAll('.exposure').forEach((button) => {
        button.addEventListener('click', () => {
            state.exposure = button.dataset.exposure;
            state.covering = defaultCoveringFor(state.exposure).id;
            const covering = coveringById(state.covering);
            state.substrate = defaultSubstrateFor(covering, state.exposure);
            state.coats = null;
            state.waste = null;
            state.sheen = null;
            fillCoveringSelect();
            fillSubstrateSelect();
            fillPaintSelects();
            syncExposureButtons();
            render();
        });
    });

    function syncExposureButtons() {
        document.querySelectorAll('.exposure').forEach((button) => {
            const active = button.dataset.exposure === state.exposure;
            button.classList.toggle('active', active);
            button.classList.toggle('text-slate-500', !active);
        });
        $('exterior-options').classList.toggle('hidden', state.exposure !== 'exterior');
    }

    // --- Render ------------------------------------------------------
    function checkClass(severity) {
        return severity === 'error' ? 'severity-error'
            : severity === 'warn' ? 'severity-warn'
                : severity === 'ok' ? 'severity-ok' : 'severity-info';
    }

    function renderTakeoff() {
        $('takeoff-body').innerHTML = design.rows.map((row) => `
            <tr class="border-t border-slate-100">
                <td class="px-2 py-1">
                    <span class="text-[9px] uppercase tracking-wide text-slate-400 block">${row.group}</span>
                    ${row.item}
                </td>
                <td class="px-2 py-1 text-right font-mono">${row.qty}</td>
                <td class="px-2 py-1 text-slate-500">${row.packLabel || row.unit}</td>
                <td class="px-2 py-1 text-right font-mono">${money(row.cost)}</td>
            </tr>
        `).join('');
        $('takeoff-area').textContent = `${num(design.areas.net)} m²`;
        $('takeoff-finish').textContent = design.paint
            ? `${num(design.paint.litres, 1)} L`
            : `${design.rows.reduce((sum, row) => sum + row.qty, 0)} packs`;
        $('takeoff-material').textContent = money(design.costs.material);
        $('takeoff-total').textContent = money(design.costs.total);
        $('takeoff-labour').textContent = money(design.costs.labour);
        $('takeoff-note').textContent = design.paint
            ? `${design.paint.cans} finish cans + ${design.paint.primerCans} primer cans at ${design.paint.coverageRate} m²/L.`
            : `${design.rows.length} material lines for ${design.covering.unit}s, with ${Math.round(design.areas.waste * 100)}% waste.`;

        $('prep-list').innerHTML = design.prep.map((task) => `
            <li>
                <b class="font-semibold">${task.task}</b>
                <span class="text-[10px] text-slate-500"> · ${task.hours.toFixed(2)} h</span>
                <span class="block text-[10px] text-slate-400">${task.note}</span>
            </li>
        `).join('');
        $('prep-hours').textContent = `${num(design.prepHours, 2)} h`;

        $('checks').innerHTML = design.checks.map((check) => `
            <li class="${checkClass(check.severity)}">
                <b class="uppercase text-[9px] tracking-wide mr-1">${check.severity}</b>${check.label}
                ${check.detail ? `<span class="block text-[10px] text-slate-500">${check.detail}</span>` : ''}
            </li>
        `).join('');
        const errors = design.checks.filter((check) => check.severity === 'error').length;
        const warnings = design.checks.filter((check) => check.severity === 'warn').length;
        $('check-counts').textContent = `${errors} errors · ${warnings} warnings`;
        $('check-summary').textContent = `${errors} errors · ${warnings} warnings`;
        $('check-summary').className = `text-[10px] font-mono mt-1 ${errors ? 'severity-error' : warnings ? 'severity-warn' : 'severity-ok'}`;

        $('drying').innerHTML = `
            <span class="text-slate-500">Recoat</span><b class="text-right">${design.drying.recoatHours} h</b>
            <span class="text-slate-500">Cure</span><b class="text-right">${design.drying.cureDays} days</b>
            <span class="text-slate-500">Service life</span><b class="text-right">${design.covering.lifeYears} years</b>
            <span class="text-slate-500">Maintenance</span><b class="text-right">${design.covering.maintenanceYears} years</b>
            <span class="text-slate-500">VOC</span><b class="text-right">${design.covering.vocGL} g/L</b>
            <span class="text-slate-500">Fire class</span><b class="text-right">${design.covering.fireClass}</b>
        `;
    }

    function renderScheme() {
        const scheme = design.scheme;
        $('scheme-swatches').innerHTML = [
            ['Wall', scheme.wall],
            ['Trim', scheme.trim],
            ['Accent', scheme.accent],
            ['Ceiling', scheme.ceiling]
        ].map(([label, entry]) => `
            <div class="rounded border border-slate-200 overflow-hidden">
                <div class="h-6" style="background:${entry.hex}"></div>
                <p class="text-[8px] font-bold px-1 pt-0.5 truncate">${label}</p>
                <p class="text-[8px] font-mono text-slate-400 px-1 pb-0.5">LRV ${Math.round(entry.lrv)}</p>
            </div>
        `).join('');
        $('scheme-note').textContent = `${scheme.harmony} · trim +${num(scheme.contrast.trim, 1)} LRV · accent ${num(scheme.contrast.accent, 1)} · ceiling +${num(scheme.contrast.ceiling, 1)}`;
    }

    function renderReference(filter = '') {
        const groups = filter
            ? [{ category: 'Search results', terms: searchWallGlossary(filter) }]
            : wallGlossaryByCategory();
        $('glossary').innerHTML = groups.map((group) => `
            <section>
                <h3 class="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">${group.category} · ${group.terms.length}</h3>
                <dl class="space-y-1.5">
                    ${group.terms.map((entry) => `
                        <div class="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
                            <dt class="text-[11px] font-bold">${entry.term}${entry.aka ? `<span class="font-normal text-slate-400"> · ${entry.aka}</span>` : ''}</dt>
                            <dd class="text-[10px] text-slate-600 leading-snug">${entry.definition}</dd>
                            ${entry.detail ? `<dd class="text-[10px] text-slate-400 leading-snug mt-0.5">${entry.detail}</dd>` : ''}
                        </div>
                    `).join('')}
                </dl>
            </section>
        `).join('');
        $('glossary-count').textContent = `${WALL_GLOSSARY.length} terms`;
    }

    function render() {
        design = applyPriceBookToDesign('wall', computeWallDesign(state));
        state.covering = design.covering.id;
        state.colour = design.colour.id;
        state.substrate = design.substrate.id;
        if (design.covering.family === 'paint') state.sheen = design.sheen.id;

        $('covering').value = design.covering.id;
        $('substrate').value = design.substrate.id;
        $('covering-note').textContent = `${design.covering.note} ${design.covering.lifeYears}-year life · Class ${design.covering.fireClass}${design.covering.vapourClass ? ` · Class ${design.covering.vapourClass} vapour retarder` : ''}.`;

        const paint = design.covering.family === 'paint';
        $('paint-options').classList.toggle('hidden', !paint);
        if (paint) {
            $('sheen').value = design.sheen.id;
            $('sheen-note').textContent = `${design.sheen.bestFor}. ${design.sheen.note}`;
            document.querySelectorAll('#colour-grid [data-colour]').forEach((button) => {
                button.classList.toggle('selected', button.dataset.colour === design.colour.id);
            });
            renderScheme();
        }

        // Coats and waste follow the product until the user sets them.
        if (state.coats == null) $('coats').value = String(design.areas.coats);
        if (state.waste == null) $('waste').value = String(Math.round(design.areas.waste * 100));
        $('area-note').textContent = `${num(design.areas.gross)} gross − ${num(design.areas.openings)} openings = ${num(design.areas.net)} m² · ${num(design.areas.netWithWaste)} m² with waste`;
        $('net-area').textContent = `${num(design.areas.net)} m²`;
        $('finish-qty').textContent = design.paint ? `${num(design.paint.litres, 1)} L` : `${design.rows.reduce((sum, row) => sum + row.qty, 0)} packs`;
        $('primer-qty').textContent = design.paint
            ? `${num(design.paint.primerLitres, 1)} L`
            : (design.config.primer ? 'included' : 'off');
        $('pack-qty').textContent = String(design.rows.reduce((sum, row) => sum + row.qty, 0));
        $('material-cost').textContent = money(design.costs.material);
        $('labour-cost').textContent = money(design.costs.labour);
        $('total-cost').textContent = money(design.costs.total);
        $('cost-note').textContent = `${money(design.costs.perM2)}/m² · ${design.prepHours} prep h`;

        renderTakeoff();
        drawWallElevation($('elevation'), design);
        viewer.update(design);

        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
        } catch (error) { /* private mode: the page still works without a draft */ }
    }

    // --- Tabs --------------------------------------------------------
    const panels = { design: $('panel-design'), takeoff: $('panel-takeoff'), reference: $('panel-reference') };
    const notes = {
        design: 'elevation and 3D share the design',
        takeoff: 'quantities, preparation, checks and the illustrative bill',
        reference: 'every term, the formulas and the palette'
    };
    function selectTab(name) {
        Object.entries(panels).forEach(([key, panel]) => {
            panel.classList.toggle('hidden', key !== name);
            panel.classList.toggle('flex', key === name);
        });
        document.querySelectorAll('.tab').forEach((tab) => {
            const active = tab.dataset.tab === name;
            tab.classList.toggle('active', active);
            tab.classList.toggle('bg-white', !active);
            tab.classList.toggle('hover:bg-slate-50', !active);
        });
        $('tab-note').textContent = notes[name] || '';
        if (name === 'design') {
            requestAnimationFrame(() => {
                drawWallElevation($('elevation'), design);
                window.dispatchEvent(new Event('resize'));
            });
        }
    }
    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    });
    ['glossary-link', 'rules-link'].forEach((id) => {
        $(id).addEventListener('click', (event) => {
            event.preventDefault();
            selectTab('reference');
        });
    });

    $('glossary-search').addEventListener('input', (event) => {
        renderReference(event.target.value);
    });

    // --- Actions -----------------------------------------------------
    function download(name, text, type = 'text/csv') {
        const blob = new Blob([text], { type });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    $('download-csv').addEventListener('click', () => {
        const name = `wall-takeoff-${design.covering.id}-${design.areas.net.toFixed(1)}m2.csv`;
        download(name, wallTakeoffCsv(design));
        $('status').textContent = `Saved ${name}`;
    });

    $('send-editor').addEventListener('click', () => {
        // Paint is one product per sheen in the editor, so hand over the
        // product that matches the selected sheen rather than the base entry.
        const sheenCovering = design.covering.family === 'paint' ? paintCoveringForSheen(design.sheen.id) : null;
        const draft = {
            covering: sheenCovering || design.covering.id,
            colour: design.colour.id,
            sheen: design.sheen.id,
            exposure: design.config.exposure,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
        if (!writeDraft('wall-editor-draft', draft)) throw new Error('editor draft not saved');
        $('status').textContent = 'Covering sent to the editor — open Editor.html and check the Finishes panel.';
        window.location.href = 'Editor.html';
    });

    $('reset').addEventListener('click', () => {
        state = {
            ...WALL_DEFAULTS,
            exposure: 'interior',
            covering: 'paint-eggshell',
            colour: 'cotton-white',
            substrate: 'gypsum-painted'
        };
        localStorage.removeItem(DRAFT_KEY);
        clearDraft('wall-editor-draft');
        window.location.reload();
    });

    // --- Boot --------------------------------------------------------
    fillCoveringSelect();
    fillSubstrateSelect();
    fillPaintSelects();
    syncExposureButtons();
    renderReference('');
    $('formulas').innerHTML = WALL_FORMULAS.map((entry) => `
        <tr class="border-t border-slate-100">
            <td class="px-2 py-1 font-semibold">${entry.label}</td>
            <td class="px-2 py-1 font-mono text-[10px]">${entry.formula}</td>
            <td class="px-2 py-1 text-slate-500">${entry.note}</td>
        </tr>
    `).join('');
    $('palette-table').innerHTML = `
        <table class="w-full text-[11px]">
            <thead><tr class="text-left text-slate-400"><th class="px-2 py-1">Colour</th><th class="px-2 py-1">Hex</th><th class="px-2 py-1">Family</th><th class="px-2 py-1 text-right">LRV</th></tr></thead>
            <tbody>
                ${PAINT_COLOURS.map((entry) => `
                    <tr class="border-t border-slate-100">
                        <td class="px-2 py-1"><span class="inline-block w-3 h-3 rounded border border-slate-200 mr-1 align-middle" style="background:${entry.hex}"></span>${entry.label}</td>
                        <td class="px-2 py-1 font-mono text-[10px] text-slate-500">${entry.hex}</td>
                        <td class="px-2 py-1 text-slate-500">${entry.family} · ${entry.undertone}</td>
                        <td class="px-2 py-1 text-right font-mono">${Math.round(lrvOf(entry.hex))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    render();
    selectTab('design');

    window.addEventListener('resize', () => drawWallElevation($('elevation'), design));
    window.wallSuite = {
        get design() { return design; },
        get state() { return { ...state }; },
        setOption(key, value) {
            state[key] = value;
            if (key === 'exposure') {
                state.covering = defaultCoveringFor(state.exposure).id;
                state.substrate = defaultSubstrateFor(coveringById(state.covering), state.exposure);
                fillCoveringSelect();
                fillSubstrateSelect();
            }
            render();
        },
        csv: () => wallTakeoffCsv(design)
    };
