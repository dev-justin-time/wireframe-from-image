    import { computeRoofDesign, roofTakeoffCsv, ROOF_DEFAULTS } from '../../features/roof/design.js';
    import { applyPriceBookToDesign } from '../../features/pricing/book.js';
    import { ROOF_STYLES, roofStyle } from '../../features/roof/styles.js';
    import { SHEATHING, UNDERLAYMENT, COVERINGS, GUTTER_SYSTEMS } from '../../features/roof/materials.js';
    import { ROOF_GLOSSARY, ROOF_FORMULAS, glossaryByCategory, searchGlossary } from '../../features/roof/glossary.js';
    import { createRoofViewer, drawRoofElevation } from '../../features/roof/preview.js';
    import { clearDraft, writeDraft } from '../../core/drafts.js';

    const $ = (id) => document.getElementById(id);
    const DRAFT_KEY = 'roof-suite-draft';
    const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    const num = (value, digits = 2) => Number(value || 0).toFixed(digits);

    let state = { ...ROOF_DEFAULTS };
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (saved && typeof saved === 'object') state = { ...state, ...saved };
    } catch (error) { /* a broken draft falls back to the defaults */ }

    let design = null;
    const viewer = createRoofViewer($('stage'));

    // --- Style cards -------------------------------------------------
    function renderStyleCards() {
        const grid = $('roof-style-grid');
        grid.innerHTML = '';
        ROOF_STYLES.forEach((style) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.style = style.key;
            button.className = `style-card text-left rounded-lg border p-2 transition-colors hover:border-sky-400 ${style.key === state.style ? 'active' : 'border-slate-200'}`;
            button.innerHTML = `
                <span class="block text-[11px] font-bold leading-tight">${style.name}</span>
                <span class="block text-[9px] text-slate-500 mt-0.5 leading-snug">${style.truss} truss</span>
            `;
            button.title = `${style.summary} ${style.bestFor}`;
            button.addEventListener('click', () => {
                state.style = style.key;
                renderStyleCards();
                render();
            });
            grid.appendChild(button);
        });
        $('style-count').textContent = String(ROOF_STYLES.length);
        const active = roofStyle(state.style);
        $('style-note').textContent = `${active.summary} ${active.bestFor}`;
    }

    // --- Select options ----------------------------------------------
    function fillSelect(id, entries, value) {
        const select = $(id);
        select.innerHTML = entries.map((entry) =>
            `<option value="${entry.id}">${entry.label}</option>`
        ).join('');
        if (value) select.value = value;
    }
    fillSelect('covering', COVERINGS, state.covering);
    fillSelect('sheathing', SHEATHING, state.sheathing);
    fillSelect('underlayment', UNDERLAYMENT, state.underlayment);
    fillSelect('gutter', GUTTER_SYSTEMS, state.gutter);

    // --- Inputs -------------------------------------------------------
    const linked = [
        ['span', 'span-number', 'span', (value) => `${num(value)} m`],
        ['length', 'length-number', 'length', (value) => `${num(value)} m`],
        ['pitch', 'pitch-number', 'pitch', (value) => `${num(value)}:12`]
    ];
    linked.forEach(([rangeId, numberId, key, format]) => {
        const range = $(rangeId);
        const number = $(numberId);
        const label = $(`${key}-label`);
        const sync = (value, source) => {
            const numeric = Math.min(Math.max(Number(value) || 0, Number(range.min)), Number(range.max));
            state[key] = numeric;
            range.value = String(numeric);
            if (source !== 'number') number.value = String(numeric);
            label.textContent = format(numeric);
            if (key === 'pitch') {
                const angle = (Math.atan(numeric / 12) * 180) / Math.PI;
                const factor = Math.sqrt(1 + (numeric / 12) ** 2);
                $('pitch-angle').textContent = `${angle.toFixed(1)}° slope factor ${factor.toFixed(3)}`;
            }
        };
        range.addEventListener('input', () => { sync(range.value, 'range'); render(); });
        number.addEventListener('input', () => { sync(number.value, 'number'); render(); });
        sync(state[key]);
    });

    const simple = [
        ['overhang', 'overhang', Number],
        ['spacing', 'spacing', Number],
        ['covering', 'covering', String],
        ['sheathing', 'sheathing', String],
        ['underlayment', 'underlayment', String],
        ['gutter', 'gutter', String],
        ['climate', 'climate', String],
        ['waste', 'waste', (value) => Number(value) / 100],
        ['pipe-vents', 'pipeVents', Number]
    ];
    simple.forEach(([id, key, cast]) => {
        const element = $(id);
        if (!element) return;
        element.addEventListener('change', () => {
            state[key] = cast(element.value);
            render();
        });
        element.addEventListener('input', () => {
            if (element.tagName !== 'SELECT') {
                state[key] = cast(element.value);
                render();
            }
        });
        if (element.tagName === 'SELECT') element.value = String(state[key]);
        else if (key === 'waste') element.value = String(Math.round((state.waste ?? 0.1) * 100));
        else if (element.value !== '') element.value = String(state[key] ?? element.value);
    });

    const toggles = [
        ['ice-shield', 'iceShield'],
        ['gutters', 'gutters'],
        ['ridge-vent', 'ridgeVent'],
        ['soffit-vent', 'soffitVent'],
        ['chimney', 'chimney'],
        ['tear-off', 'tearOff']
    ];
    toggles.forEach(([id, key]) => {
        const element = $(id);
        element.checked = Boolean(state[key]);
        element.addEventListener('change', () => {
            state[key] = element.checked;
            render();
        });
    });

    const downspouts = $('downspouts');
    downspouts.value = state.downspouts == null ? '' : String(state.downspouts);
    downspouts.addEventListener('input', () => {
        const value = downspouts.value.trim();
        state.downspouts = value === '' ? null : Math.max(0, Math.round(Number(value) || 0));
        render();
    });

    // --- Render -------------------------------------------------------
    function checkClass(severity) {
        return severity === 'error' ? 'severity-error'
            : severity === 'warn' ? 'severity-warn'
                : severity === 'ok' ? 'severity-ok' : 'severity-info';
    }

    function renderTakeoff() {
        const body = $('roof-takeoff-body');
        body.innerHTML = design.costs.rows.map((row) => `
            <tr class="border-t border-slate-100">
                <td class="px-2 py-1">
                    <span class="text-[9px] uppercase tracking-wide text-slate-400 block">${row.group}</span>
                    ${row.item}
                </td>
                <td class="px-2 py-1 text-right font-mono">${row.qty}</td>
                <td class="px-2 py-1 text-slate-500">${row.unit}</td>
                <td class="px-2 py-1 text-right font-mono">${money(row.cost)}</td>
            </tr>
        `).join('');
        $('takeoff-area').textContent = `${num(design.areas.roof)} m²`;
        $('takeoff-squares').textContent = `${num(design.areas.squares)} (${num(design.areas.squaresWithWaste)} w/ waste)`;
        $('takeoff-material').textContent = money(design.costs.material);
        $('takeoff-total').textContent = money(design.costs.total);
        $('takeoff-labour').textContent = money(design.costs.labour);

        $('roof-checks').innerHTML = design.checks.map((check) => `
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

        $('roof-water').innerHTML = `
            <span class="text-slate-500">Roof area</span><b class="text-right">${num(design.areas.roof)} m²</b>
            <span class="text-slate-500">Free vent</span><b class="text-right">${num(design.areas.vents, 3)} / ${num(design.areas.requiredVents, 3)} m²</b>
            <span class="text-slate-500">Gutter run</span><b class="text-right">${design.gutterPackage.gutterLf} m</b>
            <span class="text-slate-500">Per downspout</span><b class="text-right">${design.gutterPackage.areaPerDownspout ?? '—'} m²</b>
            <span class="text-slate-500">Ice shield</span><b class="text-right">${design.areas.iceShield} m²</b>
            <span class="text-slate-500">Valley metal</span><b class="text-right">${design.layers.valleyM} m</b>
            <span class="text-slate-500">Step flashing</span><b class="text-right">${design.layers.stepM} m</b>
            <span class="text-slate-500">Pipe boots</span><b class="text-right">${design.layers.pipeBoots}</b>
        `;
    }

    function renderReference(filter = '') {
        const groups = filter
            ? [{ category: 'Search results', terms: searchGlossary(filter) }]
            : glossaryByCategory();
        $('roof-glossary').innerHTML = groups.map((group) => `
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
        $('glossary-count').textContent = `${ROOF_GLOSSARY.length} terms`;
    }

    function render() {
        design = applyPriceBookToDesign('roof', computeRoofDesign(state));

        $('span-label').textContent = `${num(state.span)} m`;
        $('length-label').textContent = `${num(state.length)} m`;
        $('pitch-label').textContent = `${num(state.pitch)}:12`;
        $('covering-note').textContent = `${design.covering.note} Rating ${design.covering.minPitch}–${design.covering.maxPitch}:12 · ${design.covering.weightKgM2} kg/m² · ${design.covering.warranty}.`;
        $('gutter-note').textContent = `${design.gutter.note} ${design.gutter.maxRoofAreaM2} m² per downspout.`;
        $('style-note').textContent = `${design.style.summary} ${design.style.bestFor}`;

        $('roof-area').textContent = `${num(design.areas.roof)} m²`;
        $('roof-squares').textContent = num(design.areas.squares);
        $('roof-sheets').textContent = String(design.layers.sheets);
        $('roof-rolls').textContent = String(design.layers.underlayRolls);
        $('roof-covering-qty').textContent = `${design.layers.coveringUnits} ${design.layers.coveringUnit}`;
        $('roof-cap').textContent = `${design.layers.ridgeCapLf} m`;
        $('roof-trusses').textContent = String(design.trussCount);
        $('roof-gutter').textContent = design.config.gutters ? `${design.gutterPackage.gutterLf} m` : 'off';
        $('roof-downspouts').textContent = String(design.gutterPackage.downspouts);
        $('roof-vent').textContent = `${num(design.areas.vents, 2)} m²`;
        $('roof-cost').textContent = money(design.costs.total);
        $('roof-cost-note').textContent = `${money(design.costs.perSquare)}/square · ${money(design.costs.perM2)}/m²`;

        renderTakeoff();
        renderStyleCards();
        drawRoofElevation($('elevation'), design);
        viewer.update(design);

        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
        } catch (error) { /* private mode: the page still works without a draft */ }
    }

    // --- Tabs ---------------------------------------------------------
    const panels = { design: $('panel-design'), takeoff: $('panel-takeoff'), reference: $('panel-reference') };
    const notes = {
        design: 'section and 3D share the design',
        takeoff: 'quantities, checks and the illustrative bill',
        reference: 'every term the suite uses, plus the formulas'
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
                drawRoofElevation($('elevation'), design);
                window.dispatchEvent(new Event('resize'));
            });
        }
    }
    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    });
    $('glossary-link').addEventListener('click', (event) => {
        event.preventDefault();
        selectTab('reference');
    });

    $('glossary-search').addEventListener('input', (event) => {
        renderReference(event.target.value);
    });

    // --- Actions ------------------------------------------------------
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
        const name = `roof-takeoff-${design.style.key}-${design.areas.squares.toFixed(1)}sq.csv`;
        download(name, roofTakeoffCsv(design));
        $('status').textContent = `Saved ${name}`;
    });

    $('send-editor').addEventListener('click', () => {
        const draft = {
            style: design.style.key,
            pitch: design.geometry.pitch,
            overhang: design.config.overhang,
            spacing: design.config.spacing,
            covering: design.covering.id,
            gutter: design.gutter.id,
            gutters: design.config.gutters,
            ridgeVent: design.config.ridgeVent,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
        if (!writeDraft('roof-editor-draft', draft)) throw new Error('editor draft not saved');
        $('status').textContent = 'Roof sent to the editor — open Editor.html and switch Roof on.';
        window.location.href = 'Editor.html';
    });

    $('reset').addEventListener('click', () => {
        state = { ...ROOF_DEFAULTS };
        localStorage.removeItem(DRAFT_KEY);
        clearDraft('roof-editor-draft');
        window.location.reload();
    });

    // --- Boot ---------------------------------------------------------
    renderReference('');
    $('roof-formulas').innerHTML = ROOF_FORMULAS.map((entry) => `
        <tr class="border-t border-slate-100">
            <td class="px-2 py-1 font-semibold">${entry.label}</td>
            <td class="px-2 py-1 font-mono text-[10px]">${entry.formula}</td>
            <td class="px-2 py-1 text-slate-500">${entry.note}</td>
        </tr>
    `).join('');
    render();
    selectTab('design');

    window.addEventListener('resize', () => drawRoofElevation($('elevation'), design));
    window.roofSuite = {
        get design() { return design; },
        get state() { return { ...state }; },
        setOption(key, value) {
            state[key] = value;
            render();
        },
        csv: () => roofTakeoffCsv(design)
    };
