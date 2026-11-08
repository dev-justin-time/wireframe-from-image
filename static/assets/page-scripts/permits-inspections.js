const KEY = 'permits-inspections-v1';
const GATES = [
    { id: 'permit-building', label: 'Building permit', phase: 'plan', kind: 'permit', detail: 'Plans + site + structural' },
    { id: 'inspect-foundation', label: 'Footing inspection', phase: 'framing', kind: 'inspection', detail: 'Before concrete pour' },
    { id: 'inspect-framing', label: 'Framing inspection', phase: 'framing', kind: 'inspection', detail: 'Studs, headers, ties' },
    { id: 'inspect-roof', label: 'Roof dry-in', phase: 'roof', kind: 'inspection', detail: 'Underlay + flashing' },
    { id: 'inspect-plumbing', label: 'Plumbing rough + test', phase: 'plumbing', kind: 'inspection', detail: 'Water, DWV, gas' },
    { id: 'inspect-electrical', label: 'Electrical rough', phase: 'electrical', kind: 'inspection', detail: 'Before insulation' },
    { id: 'permit-occupancy', label: 'Final / occupancy', phase: 'costs', kind: 'permit', detail: 'All sign-offs' }
];
let state = {};
try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { state = {}; }
const $ = (id) => document.getElementById(id);
const PHASE_PAGE = { plan: 'Editor.html', framing: 'framing-designer.html', roof: 'roof-designer.html', plumbing: 'plumbing-designer.html', electrical: 'electrical-designer.html', costs: 'bid-builder.html' };
function render() {
    const done = GATES.filter((g) => state[g.id] === 'pass' || state[g.id] === 'granted').length;
    $('summary').textContent = `${done}/${GATES.length} signed off`;
    $('gate-list').innerHTML = GATES.map((g) => {
        const v = state[g.id] || 'todo';
        const tone = v === 'pass' || v === 'granted' ? 'background:#dcfce7;color:#166534' : v === 'fail' || v === 'denied' ? 'background:#fee2e2;color:#991b1b' : v === 'applied' || v === 'scheduled' ? 'background:#fef3c7;color:#92400e' : 'background:#f1f5f9;color:#64748b';
        return `<div class="rounded-lg border border-slate-200 p-3 bg-white">
            <div class="flex items-center justify-between gap-2">
                <b class="text-[12px]">${g.label}</b><span class="pill" style="${tone}">${v.toUpperCase()}</span>
            </div>
            <p class="text-[10px] text-slate-500 mt-0.5">${g.kind} · phase ${g.phase} · ${g.detail}</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
                ${g.kind === 'permit'
                    ? ['todo', 'applied', 'granted', 'denied'].map((o) => `<button data-gate="${g.id}" data-val="${o}" class="rounded border px-2 py-0.5 text-[10px] font-bold ${v === o ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:bg-slate-50'}">${o}</button>`).join('')
                    : ['todo', 'scheduled', 'pass', 'fail'].map((o) => `<button data-gate="${g.id}" data-val="${o}" class="rounded border px-2 py-0.5 text-[10px] font-bold ${v === o ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:bg-slate-50'}">${o}</button>`).join('')}
                <a href="${PHASE_PAGE[g.phase] || 'project-schedule.html'}" class="ml-auto text-[10px] underline text-sky-700">Phase page →</a>
            </div>
        </div>`;
    }).join('');
}
document.getElementById('gate-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-gate]');
    if (!b) return;
    state[b.dataset.gate] = b.dataset.val;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    render();
});
document.getElementById('reset').addEventListener('click', () => { state = {}; try { localStorage.removeItem(KEY); } catch {} render(); });
window.addEventListener('storage', render);
render();
