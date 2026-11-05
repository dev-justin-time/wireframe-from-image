/**
 * Kitchen suite rule register.
 *
 * Each rule points at the engine checks that satisfy it, so the suite can show
 * the planning guideline, its source and whether the current run passes.
 * Sources are the NKBA kitchen planning guidelines and the IRC sections the
 * suite's clearances come from.
 */

export const KITCHEN_RULES = [
    {
        id: 'run-fit',
        category: 'Gaps & fillers',
        title: 'Fit the run to the measured wall',
        code: 'Job measure',
        summary: 'The cabinets, appliance air gaps and fillers must add up to the wall, with a scribe at each end.',
        checkIds: ['run-overflow', 'wide-filler', 'tight-filler']
    },
    {
        id: 'filler',
        category: 'Gaps & fillers',
        title: 'Close each end with a filler',
        code: 'NKBA planning guideline 4',
        summary: 'A 3–150 mm filler closes the gap to a wall or a out-of-square corner; wider gaps need a filler cabinet.',
        checkIds: ['tight-filler', 'wide-filler']
    },
    {
        id: 'landing-sink',
        category: 'Landing space',
        title: '24 in of landing beside the sink',
        code: 'NKBA planning guideline 9',
        summary: 'Keep at least 600 mm of counter on one side of the sink for prep and landing dishes.',
        checkIds: ['landing-sink']
    },
    {
        id: 'landing-range',
        category: 'Landing space',
        title: '15 in of landing beside the range',
        code: 'NKBA planning guideline 9',
        summary: 'Keep at least 380 mm of counter on each side of the range; one side is the minimum, both is preferred.',
        checkIds: ['landing-range', 'landing-range-one-side']
    },
    {
        id: 'aisle',
        category: 'Walkways',
        title: '42 in clear aisle between runs',
        code: 'NKBA planning guideline 8',
        summary: 'The walkway between opposing runs stays clear at 1.07 m; 1.2 m is preferred for two cooks.',
        checkIds: ['aisle', 'aisle-tight']
    },
    {
        id: 'appliance-air',
        category: 'Appliances',
        title: 'Air gap at the refrigerator and pantry',
        code: 'Manufacturer instructions',
        summary: 'A refrigerator needs a 25 mm air gap at each side; a tall pantry needs a scribe so its doors open clear.',
        checkIds: ['end-clearance-left', 'end-clearance-right']
    },
    {
        id: 'dishwasher',
        category: 'Appliances',
        title: 'Dishwasher beside the sink',
        code: 'NKBA planning guideline 10',
        summary: 'The dishwasher shares the sink’s supply and drain, so it belongs in the same run.',
        checkIds: ['dishwasher-sink']
    }
];

export const KITCHEN_CODE_SCOPE = {
    title: 'NKBA kitchen planning + IRC clearances',
    body: 'The suite checks the NKBA kitchen planning guidelines for landing space, aisle widths and the work triangle, and the manufacturer air gaps the IRC defers to. It is a planning aid: confirm appliance instructions, the adopted code edition and the site measure before ordering cabinets.'
};

export function rulesByCategory() {
    const groups = new Map();
    KITCHEN_RULES.forEach((rule) => {
        if (!groups.has(rule.category)) groups.set(rule.category, []);
        groups.get(rule.category).push(rule);
    });
    return [...groups].map(([category, rules]) => ({ category, rules }));
}

/** How a rule reads against the engine's checks for the current run. */
export function ruleStatus(rule, checks = []) {
    const relevant = (checks || []).filter((check) => (rule.checkIds || []).includes(check.id));
    if (relevant.some((check) => check.severity === 'error')) return { state: 'error', checks: relevant };
    if (relevant.some((check) => check.severity === 'warning')) return { state: 'warning', checks: relevant };
    if (!rule.checkIds?.length) return { state: 'info', checks: [] };
    return { state: 'ok', checks: relevant };
}
