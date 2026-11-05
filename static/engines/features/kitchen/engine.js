import { KITCHEN_DEFAULTS, KITCHEN_GAPS, lineById, moduleById } from './catalog.js';

/**
 * Kitchen run engine.
 *
 * The engine lays a list of modules along one wall and owns the gap logic:
 *
 *   wall filler    the gap that closes the run to each end wall
 *   clearance      the air gap two appliances need between them
 *   joint          a plain butt joint between two cabinets
 *   landing        free counter kept beside the sink and the range
 *   aisle          the walkway in front of the run
 *
 * Every gap is returned with its width, so the suite can draw dimension
 * strings and the editor can place the same run with the same spacing.
 */

const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const mm = (value) => Math.round(value * 1000);

const COUNTER_KINDS = new Set(['base', 'drawer', 'sink', 'dishwasher']);

function normaliseModule(entry) {
    const meta = moduleById(typeof entry === 'string' ? entry : entry?.id);
    if (!meta) return null;
    const width = Number(entry?.width);
    return { ...meta, width: Number.isFinite(width) && width > 0 ? width : meta.width };
}

export const formatGap = (metres) => `${mm(metres)} mm`;

/**
 * Lay out a run. `modules` are catalogue ids or `{ id, width }` overrides, so a
 * custom 27 in cabinet can be modelled without a new catalogue entry.
 */
export function layoutKitchenRun({
    length,
    runLength: measuredRun = KITCHEN_DEFAULTS.runLength,
    aisle = KITCHEN_DEFAULTS.aisle,
    line = KITCHEN_DEFAULTS.line,
    modules = KITCHEN_DEFAULTS.modules
} = {}) {
    const runLength = Math.max(Number(length ?? measuredRun) || 0, 0.3);
    const aisleWidth = Math.max(Number(aisle) || 0, 0);
    const lineMeta = lineById(line);
    const items = (Array.isArray(modules) ? modules : []).map(normaliseModule).filter(Boolean);

    const checks = [];
    const add = (id, severity, title, message) => checks.push({ id, severity, title, message });
    const gaps = [];
    const placements = [];
    const fillers = [];

    if (!items.length) {
        add('empty-run', 'error', 'No cabinets in the run', 'Add at least one module to lay out the wall.');
        return {
            length: round(runLength),
            aisle: round(aisleWidth),
            line: lineMeta.id,
            modules: [],
            fillers: [],
            gaps: [],
            totals: {
                cabinets: 0, cabinetWidth: 0, clearance: 0, filler: 0, used: 0,
                leftover: round(runLength), overflow: 0, gaps: 0
            },
            checks,
            score: 0
        };
    }

    // The gap between two neighbours is the larger of their own clearances:
    // a fridge needs air at both sides, a range and cabinets butt together.
    const between = [];
    for (let i = 0; i < items.length - 1; i += 1) {
        between.push(Math.max(items[i].clearance || 0, items[i + 1].clearance || 0));
    }
    const body = items.reduce((sum, item) => sum + item.width, 0);
    const clearanceTotal = between.reduce((sum, width) => sum + width, 0);
    const leftover = runLength - body - clearanceTotal;

    if (leftover < -1e-6) {
        add(
            'run-overflow', 'error',
            'Run is longer than the wall',
            `The modules need ${(body + clearanceTotal).toFixed(2)} m but the wall is ${runLength.toFixed(2)} m — ${mm(-leftover)} mm too long. Remove a module or use narrower cabinets.`
        );
    }

    // Fillers close the run at both ends. Split the spare equally; a spare
    // narrower than two scribes becomes one filler on the right.
    let left = 0;
    let right = 0;
    if (leftover >= -1e-6) {
        if (leftover < KITCHEN_GAPS.fillerMin * 2) {
            right = Math.max(0, leftover);
        } else {
            left = leftover / 2;
            right = leftover / 2;
        }
        if (left > 1e-9) fillers.push({ side: 'left', width: round(left) });
        if (right > 1e-9) fillers.push({ side: 'right', width: round(right) });

        const widest = Math.max(left, right);
        if (widest > KITCHEN_GAPS.fillerMax) {
            add(
                'wide-filler', 'warning',
                'Wide filler at the wall',
                `${formatGap(widest)} of filler at the wall — past ${formatGap(KITCHEN_GAPS.fillerMax)} a filler cabinet or a wider unit reads better.`
            );
        } else if (widest > 0 && widest < KITCHEN_GAPS.fillerMin) {
            add(
                'tight-filler', 'warning',
                'Filler is too tight',
                `${formatGap(widest)} cannot be scribed; trim the run or pick a narrower cabinet.`
            );
        }
    }

    if (left > 0) {
        gaps.push({
            id: 'wall-left', kind: 'wall', side: 'left',
            after: null, before: items[0].label, width: round(left), at: 0
        });
    }

    let cursor = left;
    items.forEach((item, index) => {
        if (index > 0) {
            const clearance = between[index - 1];
            gaps.push({
                id: `between-${index}`,
                kind: clearance > 0 ? 'clearance' : 'joint',
                after: items[index - 1].label,
                before: item.label,
                width: round(clearance),
                at: round(cursor)
            });
            cursor += clearance;
        }
        placements.push({
            ...item,
            index,
            x: round(cursor + item.width / 2),
            start: round(cursor),
            end: round(cursor + item.width),
            line: lineMeta.id
        });
        cursor += item.width;
    });
    if (right > 0) {
        gaps.push({
            id: 'wall-right', kind: 'wall', side: 'right',
            after: items[items.length - 1].label, before: null, width: round(right),
            at: round(runLength - right)
        });
    }

    // An appliance that needs side air must get it from the end filler too.
    const first = items[0];
    const last = items[items.length - 1];
    if (first.clearance > 0 && left + 1e-9 < first.clearance) {
        add(
            'end-clearance-left', 'warning',
            `${first.label} is tight to the left wall`,
            `Needs ${formatGap(first.clearance)} of air; the wall gap is ${formatGap(left)}.`
        );
    }
    if (last.clearance > 0 && right + 1e-9 < last.clearance) {
        add(
            'end-clearance-right', 'warning',
            `${last.label} is tight to the right wall`,
            `Needs ${formatGap(last.clearance)} of air; the wall gap is ${formatGap(right)}.`
        );
    }

    const counterWidth = (entry) => (entry && COUNTER_KINDS.has(entry.kind) ? entry.width : 0);
    placements.forEach((placement, index) => {
        const need = placement.kind === 'sink'
            ? KITCHEN_GAPS.sinkLanding
            : placement.kind === 'range'
                ? KITCHEN_GAPS.rangeLanding
                : 0;
        if (!need) return;
        const sides = [
            { side: 'left', width: counterWidth(placements[index - 1]) },
            { side: 'right', width: counterWidth(placements[index + 1]) }
        ];
        const passing = sides.filter((entry) => entry.width + 1e-9 >= need);
        if (passing.length === 0) {
            add(
                `landing-${placement.kind}`, 'error',
                `No landing beside the ${placement.kind === 'sink' ? 'sink' : 'range'}`,
                `Keep ${formatGap(need)} of counter on at least one side; both neighbours are narrower.`
            );
        } else if (placement.kind === 'range' && passing.length === 1) {
            const missing = sides.find((entry) => entry.width + 1e-9 < need);
            add(
                'landing-range-one-side', 'warning',
                'Range landing on one side only',
                `The ${missing.side} side has ${formatGap(missing.width)} of counter; ${formatGap(need)} is the planning minimum.`
            );
        }
    });

    placements.forEach((placement, index) => {
        if (placement.kind !== 'dishwasher') return;
        const besideSink = [placements[index - 1], placements[index + 1]]
            .some((neighbour) => neighbour?.kind === 'sink');
        if (!besideSink) {
            add(
                'dishwasher-sink', 'info',
                'Dishwasher is away from the sink',
                'A dishwasher is usually fed and drained next to the sink base.'
            );
        }
    });

    if (aisleWidth + 1e-9 < KITCHEN_GAPS.aisleMin) {
        add(
            'aisle', 'error',
            'Aisle is too narrow',
            `${aisleWidth.toFixed(2)} m between runs; ${KITCHEN_GAPS.aisleMin.toFixed(2)} m (42 in) is the minimum clear walkway.`
        );
    } else if (aisleWidth + 1e-9 < KITCHEN_GAPS.aisleGood) {
        add(
            'aisle-tight', 'warning',
            'Aisle is below the preferred width',
            `${aisleWidth.toFixed(2)} m; ${KITCHEN_GAPS.aisleGood.toFixed(2)} m (48 in) is preferred where two people work.`
        );
    }

    const used = body + clearanceTotal + left + right;
    const errors = checks.filter((check) => check.severity === 'error').length;
    const warnings = checks.filter((check) => check.severity === 'warning').length;
    const score = Math.max(0, Math.min(100, 100 - errors * 20 - warnings * 8));

    return {
        length: round(runLength),
        aisle: round(aisleWidth),
        line: lineMeta.id,
        lineLabel: lineMeta.label,
        modules: placements,
        fillers,
        gaps,
        totals: {
            cabinets: placements.length,
            cabinetWidth: round(body),
            clearance: round(clearanceTotal),
            filler: round(left + right),
            used: round(used),
            leftover: round(Math.max(0, runLength - used)),
            overflow: round(Math.max(0, -leftover)),
            gaps: gaps.length
        },
        checks,
        score
    };
}

/** One-line summaries for the suite's status bar. */
export function runSummary(design) {
    if (!design) return [];
    const totals = design.totals;
    return [
        `${totals.cabinets} modules · ${totals.cabinetWidth.toFixed(2)} m of cabinetry`,
        `${design.gaps.length} gaps · ${totals.filler.toFixed(3)} m filler`,
        `${design.length.toFixed(2)} m wall · ${design.aisle.toFixed(2)} m aisle`,
        `score ${design.score}`
    ];
}

/** Gap rows ready for a table: label, kind and width. */
export function gapRows(design) {
    if (!design) return [];
    return design.gaps.map((gap) => ({
        id: gap.id,
        kind: gap.kind,
        width: gap.width,
        widthLabel: formatGap(gap.width),
        between: gap.kind === 'wall'
            ? `${gap.side === 'left' ? 'Wall' : (gap.after || 'Cabinet')} → ${gap.side === 'left' ? (gap.before || 'cabinet') : 'wall'}`
            : `${gap.after} → ${gap.before}`
    }));
}
