import { sizeStairType, drawPlanPreview, createStagePreview, takeoffCsv, checkLi, saveTypeDraft, downloadCsv, in2, mm1 } from '../../features/stairs/stair-type-page.js';
const $ = (id) => document.getElementById(id);
const NOTES = {
    IBC_ALT: 'Alternating tread: 20 in min width, 8.5 in min tread, 9.5 in max riser, rails both sides. Occasional access, not egress.',
    IBC_SHIP: 'Ships ladder: 20 in min width, 5 in min tread, 10 in max riser, 50–70° slope. Grab rails carried 30 in above the landing.',
    OSHA_STAIR: 'OSHA 1910.25: 22 in min width, 30–50° slope, uniform risers within ¼ in, 42 in guards on open sides.'
};
let current = null; let stage = null;
createStagePreview($('stage')).then((s) => { stage = s; update(); });
function readConfig() {
    const height = ($('in-height').valueAsNumber || 2700) / 1000;
    return {
        type: 'straight', code: $('in-device').value,
        storeyHeight: height,
        width: ($('in-width').valueAsNumber || 610) / 1000,
        availableRun: $('in-run').valueAsNumber || 1.9,
        availableWidth: ($('in-width').valueAsNumber || 610) / 1000
    };
}
function update() {
    const config = readConfig();
    const { design, item, bounds } = sizeStairType(config);
    current = { design, config, model: $('in-device').value };
    $('device-note').textContent = NOTES[config.code] || '';
    drawPlanPreview($('plan'), item, config.storeyHeight);
    if (stage) stage.render(item, config.storeyHeight);
    const slope = design.riserHeight && design.treadDepth ? (Math.atan2(design.riserHeight, design.treadDepth) * 180 / Math.PI) : 0;
    $('results').innerHTML = [
        ['Device', $('in-device').selectedOptions[0].textContent.split(' (')[0]],
        ['Risers / treads', `${design.risers} / ${design.treads}`],
        ['Riser height', mm1(design.riserHeight)],
        ['Tread', mm1(design.treadDepth)],
        ['Slope', `${slope.toFixed(1)}°`],
        ['Run used', `${Number(design.runUsed || 0).toFixed(2)} m`],
        ['Footprint', `${bounds.width.toFixed(2)} × ${bounds.depth.toFixed(2)} m`],
        ['2R + T', `${in2(design.comfort?.value)} in`]
    ].map(([k, v]) => `<span class="text-slate-400">${k}</span><span class="text-right">${v}</span>`).join('');
    $('checks').innerHTML = design.issues.map(checkLi).join('') || '<li class="check-ok">✓ No issues</li>';
    window.steepStair = { design, config };
}
['in-height','in-width','in-run','in-slope'].forEach((id) => $(id).addEventListener('input', update));
$('in-device').addEventListener('change', update);
function addToPlan() {
    if (!current) return;
    saveTypeDraft(current.config, { page: 'stair-steep', model: current.model });
    $('status').textContent = 'Placing the steep stair in the editor…';
    window.location.href = 'Editor.html?fromDesigner=1';
}
$('add-to-plan').addEventListener('click', addToPlan);
$('add-to-plan-2').addEventListener('click', addToPlan);
$('takeoff').addEventListener('click', () => {
    if (!current) return;
    downloadCsv('steep-stair-takeoff.csv', takeoffCsv('steep stair', current.design, [['device', 1, current.model], ['handrails', 2, 'both sides, full length']]));
    $('status').textContent = 'Takeoff downloaded';
});
update();
window.addEventListener('resize', update);
