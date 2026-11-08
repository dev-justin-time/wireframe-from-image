import { sizeStairType, drawPlanPreview, createStagePreview, codeOptions, takeoffCsv, checkLi, saveTypeDraft, downloadCsv, in2, mm1 } from '../../features/stairs/stair-type-page.js';
const $ = (id) => document.getElementById(id);
const codeSel = $('in-code');
codeSel.innerHTML = codeOptions().map((c) => `<option value="${c.key}">${c.label}</option>`).join('');
codeSel.value = 'IRC2021';
let current = null; let stage = null;
createStagePreview($('stage')).then((s) => { stage = s; update(); });
function readConfig() {
    return {
        type: 'curve-left', code: codeSel.value,
        storeyHeight: ($('in-height').valueAsNumber || 2700) / 1000,
        width: ($('in-width').valueAsNumber || 1000) / 1000,
        availableRun: $('in-run').valueAsNumber || 5.2,
        availableWidth: $('in-depth').valueAsNumber || 2.4,
        turnDegrees: 180
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
        ['Inside tread', mm1(design.innerRadius * design.anglePerTread)],
        ['Inner radius', `${Number(design.innerRadius).toFixed(2)} m`],
        ['Landing option', `${(config.storeyHeight / 2).toFixed(2)} m + ${(config.storeyHeight / 2).toFixed(2)} m`],
        ['Footprint', `${bounds.width.toFixed(2)} × ${bounds.depth.toFixed(2)} m`],
        ['2R + T', `${in2(design.comfort?.value)} in`]
    ].map(([k, v]) => `<span class="text-slate-400">${k}</span><span class="text-right">${v}</span>`).join('');
    $('checks').innerHTML = design.issues.map(checkLi).join('') || '<li class="check-ok">✓ No issues</li>';
    window.uStair = { design, config };
}
['in-height','in-width','in-run','in-depth'].forEach((id) => $(id).addEventListener('input', update));
codeSel.addEventListener('change', update);
function addToPlan() {
    if (!current) return;
    saveTypeDraft(current.config, { page: 'stair-u' });
    $('status').textContent = 'Placing the U stair in the editor…';
    window.location.href = 'Editor.html?fromDesigner=1';
}
$('add-to-plan').addEventListener('click', addToPlan);
$('add-to-plan-2').addEventListener('click', addToPlan);
$('takeoff').addEventListener('click', () => {
    if (!current) return;
    downloadCsv('u-stair-takeoff.csv', takeoffCsv('U stair', current.design, [['turn', 1, '180° half turn, winders or landing']]));
    $('status').textContent = 'Takeoff downloaded';
});
update();
window.addEventListener('resize', update);
