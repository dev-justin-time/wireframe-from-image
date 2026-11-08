import { BUILD_STAGES, stageStatus } from '../../shared/project-workflow.js';
const KEY = 'project-schedule-v1';
const DEFAULT_DAYS = { plan: 5, walls: 4, framing: 8, roof: 6, stairs: 3, plumbing: 6, electrical: 5, lighting: 3, kitchen: 5, outdoor: 6, costs: 3 };
let days = { ...DEFAULT_DAYS };
try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw?.days) days = { ...DEFAULT_DAYS, ...raw.days }; } catch {}
const $ = (id) => document.getElementById(id);
function gates() { try { return JSON.parse(localStorage.getItem('permits-inspections-v1') || '{}'); } catch { return {}; } }
function render() {
    const stages = stageStatus();
    const g = gates();
    let start = 0; let doneCount = 0;
    const rows = stages.map((s) => {
        const d = Math.max(1, Number(days[s.id]) || 3);
        const blocked = ['framing', 'roof', 'stairs', 'plumbing', 'electrical'].includes(s.id) && g[`inspect-${s.id}`] === false;
        const state = s.started ? 'done' : (doneCount === stages.filter((x) => x.started).length && !blocked ? 'active' : 'todo');
        if (s.started) doneCount++;
        const row = { ...s, days: d, start, state, blocked };
        start += d;
        return row;
    });
    $('summary').textContent = `${doneCount}/${stages.length} phases with drafts · ${start} working days planned`;
    $('phase-list').innerHTML = rows.map((r) => `
        <div class="flex flex-wrap items-center gap-2 rounded-lg border ${r.state === 'done' ? 'border-emerald-200 bg-emerald-50/40' : r.blocked ? 'border-red-200 bg-red-50/40' : 'border-slate-200'} px-3 py-2">
            <span class="font-mono text-[10px] text-slate-400 w-7">${r.step}</span>
            <b class="text-[12px] w-36">${r.label}</b>
            <span class="text-[10px] text-slate-500 flex-1 min-w-[140px]">Day ${r.start + 1}–${r.start + r.days}${r.blocked ? ' · ⛔ inspection hold' : ''} · ${r.state}</span>
            <label class="text-[10px] text-slate-500">Days <input type="number" min="1" max="60" value="${r.days}" data-days="${r.id}" class="w-14 rounded border border-slate-200 px-1 py-0.5 font-mono text-[11px]"></label>
            <a href="${r.page}" class="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold hover:bg-slate-50">${r.started ? 'Open' : 'Start'} →</a>
        </div>`).join('');
    const total = Math.max(start, 1);
    $('gantt').innerHTML = rows.map((r) => `
        <div class="flex items-center gap-2">
            <span class="w-32 truncate text-[10px] font-bold text-slate-600">${r.step} ${r.label}</span>
            <div class="flex-1 h-[18px] rounded bg-slate-100 relative overflow-hidden">
                <div class="gantt-bar absolute top-0" style="left:${(r.start / total * 100).toFixed(1)}%;width:${(r.days / total * 100).toFixed(1)}%;background:${r.state === 'done' ? '#16a34a' : r.blocked ? '#dc2626' : r.state === 'active' ? '#d97706' : '#cbd5e1'}"></div>
            </div>
            <span class="w-14 text-right font-mono text-[10px] text-slate-400">${r.days}d</span>
        </div>`).join('');
}
document.getElementById('phase-list').addEventListener('change', (e) => {
    const id = e.target.dataset?.days;
    if (!id) return;
    days[id] = Math.max(1, Math.min(60, Number(e.target.value) || 3));
    try { localStorage.setItem(KEY, JSON.stringify({ days })); } catch {}
    render();
});
document.getElementById('reset').addEventListener('click', () => { days = { ...DEFAULT_DAYS }; try { localStorage.removeItem(KEY); } catch {} render(); });
window.addEventListener('storage', render);
window.addEventListener('focus', render);
render();
