import { sizeStairType, drawPlanPreview, createStagePreview, codeOptions, takeoffCsv, checkLi, saveTypeDraft, downloadCsv, in2, mm1 } from '../../features/stairs/stair-type-page.js';
const $ = (id) => document.getElementById(id);
const codeSel = $('in-code');
codeSel.innerHTML = codeOptions().map((c) => `<option value="${c.key}">${c.label}</option>`).join('');
codeSel.value = 'IRC2021';
let current = null; let stage = null;
createStagePreview($('stage')).then((s) => { stage = s; update(); });
function readConfig() {
    const dia = ($('in-dia').valueAsNumber || 1800) / 1000;
    return {
        type: 'spiral', code: codeSel.value,
        storeyHeight: ($('in-height').valueAsNumber || 2700) / 1000,
        width: dia, availableWidth: dia, availableRun: dia,
        columnRadius: ($('in-col').valueAsNumber || 160) / 2000
    };
}
function update() {
    const config = readConfig();
    const { design, item, bounds } = sizeStairType(config);
    current = { design, config };
    drawPlanPreview($('plan'), item, config.storeyHeight);
    if (stage) stage.render(item, config.storeyHeight);
    $('results').innerHTML = [
        ['Risers / treads', `${design.risers} / ${design.treads}`],
        ['Riser height', mm1(design.riserHeight)],
        ['Walkline tread', mm1(design.treadDepthWalkline)],
        ['Clear width', mm1(design.clearWidth)],
        ['Angle / tread', `${(360 / Math.max(design.treads, 1)).toFixed(1)}°`],
        ['Diameter', `${Number(config.width).toFixed(2)} m`],
        ['Footprint', `${bounds.width.toFixed(2)} × ${bounds.depth.toFixed(2)} m`],
        ['Walkline run', `${Number(design.runUsed || 0).toFixed(2)} m`]
    ].map(([k, v]) => `<span class="text-slate-400">${k}</span><span class="text-right">${v}</span>`).join('');
    $('checks').innerHTML = design.issues.map(checkLi).join('') || '<li class="check-ok">✓ No issues</li>';
    window.spiralStair = { design, config };
}
['in-height','in-dia','in-col'].forEach((id) => $(id).addEventListener('input', update));
codeSel.addEventListener('change', update);
function addToPlan() {
    if (!current) return;
    saveTypeDraft(current.config, { page: 'stair-spiral' });
    $('status').textContent = 'Placing the spiral stair in the editor…';
    window.location.href = 'Editor.html?fromDesigner=1';
}
$('add-to-plan').addEventListener('click', addToPlan);
$('add-to-plan-2').addEventListener('click', addToPlan);
$('takeoff').addEventListener('click', () => {
    if (!current) return;
    downloadCsv('spiral-stair-takeoff.csv', takeoffCsv('spiral stair', current.design, [['column', 1, `${Math.round(current.config.columnRadius * 2000)} mm centre column`], ['handrail', 1, 'continuous outer rail']]));
    $('status').textContent = 'Takeoff downloaded';
});
update();
window.addEventListener('resize', update);
