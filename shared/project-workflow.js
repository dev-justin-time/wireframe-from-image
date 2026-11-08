/**
 * Shared construction-flow backbone: one stage order every page follows.
 *
 * Typical construction flow (plan creation first, details after):
 *  01 Plan creation — main floorplan in the Editor (the single source of truth)
 *  02 Walls & finishes
 *  03 Framing / structure
 *  04 Roof
 *  05 Stairs
 *  06 Plumbing rough-in + finish
 *  07 Electrical + lighting
 *  08 Kitchen
 *  09 Outdoor (deck + landscape)
 *  10 Costs (price book → bid → dashboard)
 *
 * Each stage maps to the page that owns it and the localStorage keys that
 * prove it has started. The strip renders the same stepper on every page so
 * the user always knows what comes next and what is still missing.
 */

export const BUILD_STAGES = [
    { id: 'plan', step: '01', label: 'Floorplan', detail: 'Draw walls, rooms, openings', page: 'Editor.html', keys: ['floorplan3d_autosave'] },
    { id: 'walls', step: '02', label: 'Walls & finishes', detail: 'Coverings, paint, tile', page: 'wall-designer.html', keys: ['wall-suite-draft', 'wall-editor-draft'] },
    { id: 'framing', step: '03', label: 'Framing', detail: 'Studs, headers, floors', page: 'framing-designer.html', keys: ['framing-suite-draft', 'framing-editor-draft'] },
    { id: 'roof', step: '04', label: 'Roof', detail: 'Trusses, covering, gutters', page: 'roof-designer.html', keys: ['roof-suite-draft', 'roof-editor-draft'] },
    { id: 'stairs', step: '05', label: 'Stairs', detail: 'Runs, landings, rails', page: 'stair-designer.html', keys: ['stair-suite-draft', 'stair-editor-draft'] },
    { id: 'plumbing', step: '06', label: 'Plumbing', detail: 'Water, DWV, gas, vents', page: 'plumbing-designer.html', keys: ['plumbing-suite-plan'] },
    { id: 'electrical', step: '07', label: 'Electrical', detail: 'Service, panel, circuits', page: 'electrical-designer.html', keys: ['electrical-suite-draft', 'electrical-editor-draft'] },
    { id: 'lighting', step: '08', label: 'Lighting', detail: 'Lights, switches, levels', page: 'lighting-designer.html', keys: ['lighting-suite-draft', 'lighting-editor-draft'] },
    { id: 'kitchen', step: '09', label: 'Kitchen', detail: 'Runs, clearances', page: 'kitchen-designer.html', keys: ['kitchen-editor-draft'] },
    { id: 'outdoor', step: '10', label: 'Deck & landscape', detail: 'Deck frame + planting', page: 'deck-designer.html', keys: ['deck-suite-draft', 'deck-editor-draft', 'landscape-editor-draft'] },
    { id: 'costs', step: '11', label: 'Bid & dashboard', detail: 'Price, bid, review', page: 'bid-builder.html', keys: ['bid-builder-state'] }
];

function hasAnyKey(keys) {
    try {
        return (keys || []).some((k) => {
            const v = localStorage.getItem(k) || localStorage.getItem(`floorplan3d_${k}`);
            return v != null && String(v).length > 2;
        });
    } catch {
        return false;
    }
}

export function stageStatus() {
    return BUILD_STAGES.map((s) => ({ ...s, started: hasAnyKey(s.keys) }));
}

export function nextStage() {
    const list = stageStatus();
    return list.find((s) => !s.started) || list[list.length - 1];
}

/** Read the main floorplan (Editor autosave) for every viewer. */
export function readMainFloorplan() {
    try {
        const raw = localStorage.getItem('floorplan3d_autosave');
        if (!raw) return null;
        const data = JSON.parse(raw);
        const walls = data.walls || data.stories?.[0]?.walls || [];
        const fixtures = data.fixtures || [];
        return { ...data, walls, fixtures };
    } catch {
        return null;
    }
}

const STATUS_STYLE = `
.pw-strip { display:flex; gap:6px; overflow-x:auto; padding:8px 12px; background:#fff; border-bottom:1px solid #e2e8f0; }
.pw-step { flex:1 0 118px; min-width:118px; border:1px solid #e2e8f0; border-radius:8px; padding:6px 8px; text-decoration:none; color:inherit; background:#f8fafc; }
.pw-step.current { border-color:#0f172a; background:#0f172a; color:#fff; }
.pw-step.done { border-color:#bbf7d0; background:#f0fdf4; }
.pw-step .n { font:700 9px ui-monospace,monospace; letter-spacing:.06em; opacity:.7; }
.pw-step .t { font:700 11px system-ui,sans-serif; display:block; }
.pw-step .d { font:400 9px system-ui,sans-serif; opacity:.75; display:block; }
.pw-dot { display:inline-block; width:7px; height:7px; border-radius:99px; margin-right:4px; }
.pw-dot.on { background:#16a34a; } .pw-dot.off { background:#cbd5e1; }
.pw-step.current .pw-dot.off { background:#64748b; }
`;

/** Render the stepper into `el`. `current` is a stage id or page filename. */
export function renderWorkflowStrip(el, current = '') {
    if (!el) return;
    if (!document.getElementById('pw-strip-style')) {
        const st = document.createElement('style');
        st.id = 'pw-strip-style';
        st.textContent = STATUS_STYLE;
        document.head.appendChild(st);
    }
    const here = String(current || window.location.pathname.split('/').pop());
    const stages = stageStatus();
    el.innerHTML = `<nav class="pw-strip" aria-label="Construction flow">` + stages.map((s) => {
        const isCurrent = s.id === here || s.page === here;
        const cls = isCurrent ? 'current' : s.started ? 'done' : '';
        return `<a class="pw-step ${cls}" href="${s.page}" title="${s.detail}">
            <span class="n">${s.step} <span class="pw-dot ${s.started ? 'on' : 'off'}"></span>${s.started ? 'started' : 'not started'}</span>
            <span class="t">${s.label}</span><span class="d">${s.detail}</span></a>`;
    }).join('') + `</nav>`;
    // Nudge the user toward the next missing stage.
    const next = nextStage();
    if (next && !stages.find((s) => (s.id === here || s.page === here)) && el.parentElement) {
        el.title = `Next: ${next.step} ${next.label} (${next.page})`;
    }
}
