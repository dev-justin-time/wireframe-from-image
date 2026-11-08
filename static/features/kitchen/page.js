import { KITCHEN_DEFAULTS, KITCHEN_GAPS, KITCHEN_LINES, KITCHEN_MODULES, moduleById } from './catalog.js';
import { formatGap, gapRows, layoutKitchenRun, runSummary } from './engine.js';
import { writeDraft } from '../../core/drafts.js';
import { KITCHEN_CODE_SCOPE, KITCHEN_RULES, ruleStatus, rulesByCategory } from './rules.js';

/**
 * Kitchen suite page.
 *
 * One wall run at a time: modules are added to the run, the engine lays them
 * out with the gap policy, and the canvas draws the elevation with every filler
 * and clearance dimensioned. The same layout is handed to the editor as a
 * draft, so the 3D plan receives the cabinets at the spacing checked here.
 */

const DRAFT_KEY = 'kitchen-suite-draft';
const EDITOR_KEY = 'kitchen-editor-draft';

const $ = (id) => document.getElementById(id);
const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const COLOURS = {
    base: '#e7e2d8',
    drawer: '#ded5c5',
    sink: '#cfe0ea',
    range: '#3f4650',
    fridge: '#d7dde4',
    dishwasher: '#ccd7dc',
    tall: '#e3d8c7'
};

function loadConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (saved && Array.isArray(saved.modules) && saved.modules.length) {
            return { ...KITCHEN_DEFAULTS, ...saved };
        }
    } catch {
        // Ignore a corrupt draft and fall back to the defaults.
    }
    return { ...KITCHEN_DEFAULTS, modules: [...KITCHEN_DEFAULTS.modules] };
}

let config = loadConfig();
let design = layoutKitchenRun(config);
let canvas = null;
let ctx = null;

function saveConfig() {
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
    } catch {
        // Storage full: the suite still works in this tab.
    }
}

function setStatus(message, isError = false) {
    const node = $('k-status');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('text-red-600', isError);
    node.classList.toggle('text-slate-500', !isError);
}

function shortLabel(module) {
    return module.label
        .replace(' cabinet', '')
        .replace('Refrigerator', 'Fridge')
        .replace('Dishwasher', 'DW')
        .replace('Tall pantry', 'Pantry');
}

function refresh({ redraw = true } = {}) {
    design = layoutKitchenRun(config);
    renderModuleList();
    renderTotals();
    renderGaps();
    renderChecks();
    if (redraw) draw();
    saveConfig();
}

function renderModuleList() {
    const list = $('module-list');
    if (!list) return;
    if (!design.modules.length) {
        list.innerHTML = '<p class="text-[11px] text-slate-400">No modules yet — add a cabinet to start the run.</p>';
        return;
    }
    list.innerHTML = design.modules.map((module, index) => `
        <div class="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1">
            <span class="w-4 text-[10px] font-mono text-slate-400">${index + 1}</span>
            <span class="flex-1 truncate text-[11px] font-semibold text-slate-700">${escapeHtml(module.label)}</span>
            <span class="text-[10px] font-mono text-slate-500">${Math.round(module.width * 1000)} mm</span>
            <button data-remove="${index}" class="rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove from the run">✕</button>
        </div>
    `).join('');
    list.querySelectorAll('[data-remove]').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.remove);
            config.modules.splice(index, 1);
            refresh();
        });
    });
}

function renderTotals() {
    const totals = design.totals;
    const score = $('k-score');
    if (score) {
        score.textContent = String(design.score);
        score.className = `text-2xl font-black ${design.score >= 80 ? 'text-emerald-600' : design.score >= 55 ? 'text-amber-600' : 'text-red-600'}`;
    }
    const summary = $('k-summary');
    if (summary) {
        summary.innerHTML = runSummary(design)
            .map((line) => `<p class="text-[11px] text-slate-500">${escapeHtml(line)}</p>`)
            .join('');
    }
    const stats = $('k-stats');
    if (stats) {
        stats.innerHTML = [
            ['Cabinets', `${totals.cabinets} · ${totals.cabinetWidth.toFixed(2)} m`],
            ['Gaps', `${totals.gaps} · ${totals.clearance.toFixed(3)} m air`],
            ['Fillers', `${totals.filler.toFixed(3)} m`],
            ['Wall used', `${totals.used.toFixed(2)} / ${design.length.toFixed(2)} m`]
        ].map(([label, value]) => `
            <div class="flex items-baseline justify-between gap-2">
                <span class="text-[10px] uppercase tracking-wide text-slate-400">${label}</span>
                <span class="font-mono text-[11px] text-slate-700">${escapeHtml(value)}</span>
            </div>
        `).join('');
    }
}

function renderGaps() {
    const body = $('gap-rows');
    if (!body) return;
    const rows = gapRows(design);
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="3" class="px-2 py-2 text-[11px] text-slate-400">No gaps yet.</td></tr>';
        return;
    }
    body.innerHTML = rows.map((row) => {
        const kind = row.kind === 'wall' ? 'Filler' : row.kind === 'clearance' ? 'Air gap' : 'Joint';
        const tone = row.kind === 'wall' ? 'text-sky-700' : row.kind === 'clearance' ? 'text-amber-700' : 'text-slate-500';
        return `
            <tr class="border-t border-slate-100">
                <td class="px-2 py-1 text-[10px] font-mono ${tone}">${kind}</td>
                <td class="px-2 py-1 text-[10px] text-slate-600 truncate" title="${escapeHtml(row.between)}">${escapeHtml(row.between)}</td>
                <td class="px-2 py-1 text-right font-mono text-[10px] text-slate-700">${row.widthLabel}</td>
            </tr>
        `;
    }).join('');
}

function renderChecks() {
    const list = $('check-list');
    if (!list) return;
    if (!design.checks.length) {
        list.innerHTML = '<p class="text-[11px] text-emerald-600">Every gap and landing checks out.</p>';
    } else {
        list.innerHTML = design.checks.map((check) => {
            const tone = check.severity === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : check.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600';
            return `
                <div class="rounded border px-2 py-1.5 ${tone}">
                    <p class="text-[11px] font-bold">${escapeHtml(check.title)}</p>
                    <p class="text-[10px] leading-snug">${escapeHtml(check.message)}</p>
                </div>
            `;
        }).join('');
    }

    const rules = $('rule-list');
    if (rules) {
        rules.innerHTML = rulesByCategory().map((group) => `
            <div class="mb-2">
                <p class="mb-1 text-[10px] uppercase tracking-wider font-bold text-slate-400">${escapeHtml(group.category)}</p>
                ${group.rules.map((rule) => {
                    const status = ruleStatus(rule, design.checks);
                    const mark = status.state === 'error' ? '✕' : status.state === 'warning' ? '!' : status.state === 'ok' ? '✓' : 'i';
                    const tone = status.state === 'error' ? 'text-red-600' : status.state === 'warning' ? 'text-amber-600' : status.state === 'ok' ? 'text-emerald-600' : 'text-slate-400';
                    return `
                        <div class="flex gap-1.5 py-0.5" title="${escapeHtml(rule.summary)}">
                            <span class="w-3 shrink-0 font-bold ${tone}">${mark}</span>
                            <span class="text-[10px] leading-snug text-slate-600"><strong>${escapeHtml(rule.title)}</strong> · ${escapeHtml(rule.code)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `).join('');
    }
    const scope = $('code-scope');
    if (scope) {
        scope.innerHTML = `<p class="text-[10px] font-bold text-slate-600">${escapeHtml(KITCHEN_CODE_SCOPE.title)}</p>
            <p class="text-[10px] leading-snug text-slate-500">${escapeHtml(KITCHEN_CODE_SCOPE.body)}</p>`;
    }
}

function resizeCanvas() {
    if (!canvas) return;
    const stage = canvas.parentElement;
    const width = stage?.clientWidth || 640;
    const height = stage?.clientHeight || 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
}

function draw() {
    if (!canvas || !ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const padX = 44;
    const floorY = height - 74;
    const topLimit = 54;
    const scale = Math.min(
        (width - padX * 2) / Math.max(design.length, 0.5),
        Math.max(floorY - topLimit, 40) / 2.25
    );
    const startX = (width - design.length * scale) / 2;

    // Wall and floor datum.
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX - 10, floorY);
    ctx.lineTo(startX + design.length * scale + 10, floorY);
    ctx.stroke();
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(startX, floorY + 4);
    ctx.lineTo(startX, floorY - Math.min(2.4 * scale, floorY - topLimit));
    ctx.moveTo(startX + design.length * scale, floorY + 4);
    ctx.lineTo(startX + design.length * scale, floorY - Math.min(2.4 * scale, floorY - topLimit));
    ctx.stroke();

    design.modules.forEach((module) => {
        const x = startX + module.start * scale;
        const w = Math.max(module.width * scale, 2);
        const h = module.height * scale;
        const y = floorY - h;

        ctx.fillStyle = COLOURS[module.kind] || COLOURS.base;
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = module.kind === 'range' ? '#111827' : '#b6bcc4';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

        // Front detail: doors, drawers, appliance faces.
        ctx.strokeStyle = module.kind === 'range' ? '#111827' : '#a3aab3';
        if (module.kind === 'base' || module.kind === 'drawer' || module.kind === 'dishwasher') {
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y + 10);
            ctx.lineTo(x + w / 2, floorY - 10);
            ctx.stroke();
            ctx.fillStyle = module.kind === 'dishwasher' ? '#9aa6ad' : '#8b929b';
            ctx.fillRect(x + 4, y + 6, w - 8, 4);
        }
        if (module.kind === 'sink') {
            ctx.beginPath();
            ctx.moveTo(x + 10, y + 8);
            ctx.lineTo(x + 10, floorY - 14);
            ctx.moveTo(x + w - 10, y + 8);
            ctx.lineTo(x + w - 10, floorY - 14);
            ctx.stroke();
            ctx.fillStyle = '#b9d2e0';
            ctx.fillRect(x + 12, y + 10, w - 24, h * 0.32);
            ctx.strokeStyle = '#7f9aab';
            ctx.strokeRect(x + 12.5, y + 10.5, w - 25, h * 0.32);
        }
        if (module.kind === 'range') {
            ctx.fillStyle = '#111827';
            ctx.fillRect(x + 4, y + 6, w - 8, Math.max(8, h * 0.12));
            ctx.fillStyle = '#d1d5db';
            const burners = Math.min(4, Math.max(2, Math.round(w / 22)));
            for (let i = 0; i < burners; i += 1) {
                const cx = x + w * ((i + 0.75) / (burners + 0.5));
                ctx.beginPath();
                ctx.arc(cx, y + 16, Math.max(4, w * 0.06), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#0b1120';
            ctx.fillRect(x + 6, floorY - h * 0.32, w - 12, h * 0.22);
        }
        if (module.kind === 'fridge') {
            ctx.beginPath();
            ctx.moveTo(x + 3, y + h * 0.28);
            ctx.lineTo(x + w - 3, y + h * 0.28);
            ctx.stroke();
            ctx.fillStyle = '#aab4bd';
            ctx.fillRect(x + w - 10, y + h * 0.06, 4, h * 0.16);
            ctx.fillRect(x + w - 10, y + h * 0.33, 4, h * 0.18);
        }
        if (module.kind === 'tall') {
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y + 6);
            ctx.lineTo(x + w / 2, floorY - 6);
            ctx.stroke();
        }

        // Name and width under the floor line.
        ctx.fillStyle = '#475569';
        ctx.font = '600 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const short = shortLabel(module);
        if (w > 34) ctx.fillText(short, x + w / 2, floorY + 16);
        else if (w > 16) ctx.fillText(short.slice(0, 3), x + w / 2, floorY + 16);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(`${Math.round(module.width * 1000)}`, x + w / 2, floorY + 27);
    });

    // Fillers: hatched slivers at the wall.
    design.fillers.forEach((filler) => {
        const x = filler.side === 'left'
            ? startX
            : startX + design.length * scale - filler.width * scale;
        const w = Math.max(filler.width * scale, 1);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x, floorY - 0.9 * scale, w, 0.9 * scale);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, floorY - 0.9 * scale, w, 0.9 * scale);
        ctx.clip();
        ctx.strokeStyle = '#94a3b8';
        for (let offset = 0; offset < w + 12; offset += 6) {
            ctx.beginPath();
            ctx.moveTo(x + offset, floorY);
            ctx.lineTo(x + offset - 10, floorY - 0.9 * scale);
            ctx.stroke();
        }
        ctx.restore();
    });

    // Dimension string for every non-zero gap.
    const dimY = floorY - Math.min(2.2 * scale, floorY - topLimit) - 12;
    ctx.textAlign = 'center';
    design.gaps.forEach((gap) => {
        if (gap.width <= 0.0005) return;
        const gapX = startX + (gap.at || 0) * scale;
        const gapWidth = Math.max(gap.width * scale, 2);
        ctx.strokeStyle = '#0ea5e9';
        ctx.beginPath();
        ctx.moveTo(gapX, dimY);
        ctx.lineTo(gapX + gapWidth, dimY);
        ctx.moveTo(gapX, dimY - 3);
        ctx.lineTo(gapX, dimY + 3);
        ctx.moveTo(gapX + gapWidth, dimY - 3);
        ctx.lineTo(gapX + gapWidth, dimY + 3);
        ctx.stroke();
        if (gapWidth >= 18) {
            ctx.fillStyle = '#0369a1';
            ctx.font = '600 8px ui-monospace, monospace';
            ctx.fillText(formatGap(gap.width), gapX + gapWidth / 2, dimY - 5);
        }
    });

    // Run length dimension under the floor.
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(startX, floorY + 40);
    ctx.lineTo(startX + design.length * scale, floorY + 40);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillText(`run ${design.length.toFixed(2)} m → ${design.gaps.length} gaps`, width / 2, floorY + 55);

    // Header line inside the drawing.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(`${design.lineLabel} run · ${design.aisle.toFixed(2)} m aisle`, 16, 22);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('Filler · air gap · landing — measured from the wall', 16, 36);
}

function addModule(id) {
    const module = moduleById(id);
    if (!module) return;
    config.modules.push(module.id);
    refresh();
    setStatus(`Added ${module.label} (${Math.round(module.width * 1000)} mm).`);
}

function sendToEditor() {
    const draft = {
        source: 'kitchen-suite',
        line: config.line,
        runLength: design.length,
        aisle: design.aisle,
        fillers: design.fillers,
        gaps: design.gaps,
        modules: design.modules.map((module) => ({
            itemRole: module.item,
            kind: module.kind,
            label: module.label,
            width: module.width,
            x: module.x,
            start: module.start,
            end: module.end
        })),
        checks: design.checks,
        summary: runSummary(design).join(' · '),
        savedAt: new Date().toISOString()
    };
    try {
        if (!writeDraft(EDITOR_KEY, draft)) throw new Error('editor draft not saved');
        localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
        setStatus('Run sent to the studio. Opening the editor…');
        window.setTimeout(() => { window.location.href = 'Editor.html'; }, 350);
    } catch {
        setStatus('Could not send the run: browser storage is unavailable.', true);
    }
}

function resetRun() {
    config = { ...KITCHEN_DEFAULTS, modules: [...KITCHEN_DEFAULTS.modules] };
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    refresh();
    setStatus('Run reset to the default shaker kitchen.');
}

function wire() {
    const length = $('k-length');
    const aisle = $('k-aisle');
    const line = $('k-line');

    if (length) {
        length.value = String(config.runLength);
        length.addEventListener('input', () => {
            config.runLength = Number(length.value) || KITCHEN_DEFAULTS.runLength;
            refresh();
        });
    }
    if (aisle) {
        aisle.value = String(config.aisle);
        aisle.addEventListener('input', () => {
            config.aisle = Number(aisle.value) || 0;
            refresh({ redraw: false });
        });
    }
    if (line) {
        line.innerHTML = Object.values(KITCHEN_LINES)
            .map((entry) => `<option value="${entry.id}">${escapeHtml(entry.label)}</option>`)
            .join('');
        line.value = config.line;
        line.addEventListener('change', () => {
            config.line = line.value;
            refresh();
        });
    }

    const picker = $('k-module');
    if (picker) {
        picker.innerHTML = KITCHEN_MODULES
            .map((module) => `<option value="${module.id}">${escapeHtml(module.label)} · ${Math.round(module.width * 1000)} mm</option>`)
            .join('');
    }
    $('add-module')?.addEventListener('click', () => {
        if (picker?.value) addModule(picker.value);
    });
    $('reset')?.addEventListener('click', resetRun);
    $('send-editor')?.addEventListener('click', sendToEditor);

    canvas = $('run-canvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        const stage = canvas.parentElement;
        if (stage && 'ResizeObserver' in window) {
            new ResizeObserver(() => resizeCanvas()).observe(stage);
        }
        resizeCanvas();
    }
}

function init() {
    wire();
    refresh();
    setStatus('Adjust the wall, aisle and modules — every gap is dimensioned.');

    window.kitchenKit = {
        config: () => ({ ...config, modules: [...config.modules] }),
        design: () => design,
        layout: (next) => layoutKitchenRun(next || config),
        gaps: () => gapRows(design),
        addModule,
        sendToEditor,
        rules: KITCHEN_RULES,
        gapsPolicy: KITCHEN_GAPS
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}
