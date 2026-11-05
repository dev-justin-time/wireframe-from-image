/**
 * Rules and regulations for the two-part plumbing plan. The model codes are the
 * 2021 International Plumbing Code (IPC), the plumbing chapters of the 2021
 * International Residential Code (IRC) and the 2021 International Fuel Gas Code
 * (IFGC). Local amendments are often stricter and always win.
 */

export const RULE_CATEGORIES = [
    { id: 'service', label: 'Service & hookups' },
    { id: 'water', label: 'Water supply' },
    { id: 'drainage', label: 'Drainage' },
    { id: 'venting', label: 'Vents & traps' },
    { id: 'fixtures', label: 'Fixtures & clearances' },
    { id: 'heater', label: 'Water heaters' },
    { id: 'gas', label: 'Fuel gas' },
    { id: 'inspection', label: 'Testing & inspection' }
];

export const CODE_SCOPE = {
    title: '2021 IPC · 2021 IRC · 2021 IFGC',
    body: 'The 2021 International Plumbing Code governs supply, drainage, venting, fixtures and water heaters; the 2021 International Residential Code repeats the residential plumbing and fuel-gas rules; the 2021 International Fuel Gas Code governs gas piping, appliances, combustion air and venting. This page is a design aid, not a permit drawing. Confirm the edition and amendments adopted in your jurisdiction and have the plan reviewed by a licensed plumber and the local authority.'
};

export const RULE_LEVEL_LABEL = {
    required: 'Required',
    recommended: 'Recommended',
    info: 'Verify locally'
};

export const RULES = [
    {
        id: 'water-service',
        category: 'service',
        title: 'Size the water service for the whole connected demand',
        code: 'IPC 2021 §604.3 · Appendix E',
        level: 'required',
        summary: 'The service and distribution piping must deliver the peak demand at the fixtures without excessive velocity or pressure loss.',
        requirements: [
            'Add the water supply fixture units for every fixture, including the water heater and outdoor hose bibs.',
            'Convert fixture units to peak demand, then choose the service and main size from the pressure-loss calculation.',
            'Keep the service velocity at or below about 8 ft/s at peak demand; 1 in is common for a whole house but a large house may need 1-1/4 in.',
            'Account for the meter loss, the building height and the longest run; a 3/4 in meter may not support a large simultaneous load.'
        ],
        checkIds: ['water-hookup', 'water-service', 'water-meter'],
        detail: 'The suite uses a Hunter-style demand curve, a Hazen-Williams friction estimate and a 1.2 m riser allowance. Change the meter or service pressure and the residual pressure at the fixtures changes with it.'
    },
    {
        id: 'water-pressure',
        category: 'water',
        title: 'Keep working pressure in the safe, usable band',
        code: 'IPC 2021 §604.8 · §608.2',
        level: 'required',
        summary: 'Fixtures need enough residual pressure to work, and the system must be protected from excessive street pressure.',
        requirements: [
            'A pressure reducing valve is typical above 80 psi static; set it to 50–60 psi.',
            'Aim for at least 8 psi residual at the worst fixture while it flows.',
            'Do not use a PRV as the only expansion control; a closed system needs an expansion tank.',
            'A private well or a booster pump needs its own pressure and drawdown check.'
        ],
        checkIds: ['water-pressure-high', 'water-pressure-low'],
        detail: 'The plan reports static pressure, meter loss, main friction and the worst fixture pressure. The 8 psi target is a planning value; some fixtures and local amendments ask for more.'
    },
    {
        id: 'backflow',
        category: 'water',
        title: 'Protect the potable supply from backflow',
        code: 'IPC 2021 §608.1 · Table 608.1',
        level: 'required',
        summary: 'The potable water system must be protected from backsiphonage and backpressure at every cross-connection.',
        requirements: [
            'A hose bib needs a vacuum breaker or a listed hose-bib backflow device.',
            'A boiler, irrigation system, swimming pool or chemical injector needs the device listed for its hazard.',
            'A dual check is common at a residential meter; a reduced-pressure zone assembly is used for a higher hazard.',
            'Testable assemblies need annual testing and a visible tag.'
        ],
        checkIds: ['backflow'],
        detail: 'The suite includes a service backflow device and a vacuum breaker on each hose bib. If you delete either, the rule reports a warning.'
    },
    {
        id: 'water-materials',
        category: 'water',
        title: 'Use listed water pipe and protect it',
        code: 'IPC 2021 §605 · §305.4',
        level: 'required',
        summary: 'Supply pipe, fittings and joints must be listed for potable water and protected from freezing, UV and physical damage.',
        requirements: [
            'PEX, copper and PEX-AL-PEX are common; use the manufacturer’s fittings and expansion or press tools.',
            'Protect PEX from UV and from nails with a steel plate where it passes through framing.',
            'Insulate hot pipe and the first 2 m of cold at the tank; support pipe at the listed interval.',
            'Do not bury a joint that the manufacturer requires to be accessible.'
        ],
        checkIds: ['water-service'],
        detail: 'The takeoff changes with the selected water material: copper costs more and needs more labour, PEX uses fewer fittings, and PEX-AL-PEX sits between them.'
    },
    {
        id: 'water-hookup',
        category: 'service',
        title: 'Set the hookups where the utility actually connects',
        code: 'IPC 2021 §603 · practice',
        level: 'required',
        summary: 'The water, sewer and gas entry points drive the whole route. Confirm the side of the building, the depth and the meter location before drawing pipe.',
        requirements: [
            'Water: confirm the meter location, service size, static pressure and any utility-owned backflow device.',
            'Sewer: confirm the lateral size, invert depth, slope and whether the connection is public sewer or septic.',
            'Gas: confirm the meter capacity, pressure (usually 7 in w.c. for natural gas) and the service size.',
            'Keep the water and gas entries out of the driveway and away from the electrical service.'
        ],
        checkIds: ['water-hookup', 'sewer-hookup', 'gas-hookup'],
        detail: 'Drag the WATER, SEWER and GAS markers on the plan or use the hookup fields. The suite measures from those points; it cannot know the actual utility invert or meter capacity.'
    },
    {
        id: 'water-heater',
        category: 'heater',
        title: 'Water heater: relief, pan, expansion and vent',
        code: 'IPC 2021 §504.4 · §504.6 · §607.3 · IRC P2801/P2803',
        level: 'required',
        summary: 'A storage water heater needs a T&P relief valve piped to safety, a drain pan where leakage would cause damage, and expansion control on a closed system.',
        requirements: [
            'The T&P valve needs a full-size discharge pipe, no cap and no reduction, terminating within 6 in of the floor or at a safe receptor.',
            'A tank in a finished space needs a pan with a drain, or a listed leak detector and shutoff.',
            'A check valve, PRV or backflow preventer creates a closed system; add an expansion tank.',
            'A gas heater needs a listed vent and combustion air; a tankless unit needs the manufacturer’s vent kit and clearances.',
            'Keep the heater accessible for service and keep combustible storage away from the flue.'
        ],
        checkIds: ['water-heater-missing', 'water-heater-relief', 'water-heater-pan', 'water-heater-expansion', 'gas-vent'],
        detail: 'The suite flags a missing heater, relief pipe, pan or expansion tank, and it warns when the stored temperature is above 120°F. It does not size the relief valve or the flue.'
    },
    {
        id: 'heater-sizing',
        category: 'heater',
        title: 'Match the heater to the morning demand',
        code: 'IPC 2021 §501.1 · manufacturer data',
        level: 'recommended',
        summary: 'A tank is sized on its first-hour rating, not only its gallon label; a tankless unit is sized on the coldest incoming water and simultaneous fixtures.',
        requirements: [
            'Count the bathrooms and the fixtures that can run at the same time.',
            'Compare the first-hour rating with the peak hour, including a tub fill and a shower.',
            'A tankless gas unit often needs a larger gas line than the tank it replaces.',
            'A heat-pump tank needs air circulation, a condensate drain and a 240 V circuit.'
        ],
        checkIds: ['water-heater-missing'],
        detail: 'The catalogue lists tank size, first-hour rating, recovery and gas input. Use those numbers against the fixture schedule; the suite does not model a hourly draw profile.'
    },
    {
        id: 'sewer-size',
        category: 'drainage',
        title: 'Size the building drain and sewer from fixture units',
        code: 'IPC 2021 §702.1 · Table 710.1(1)',
        level: 'required',
        summary: 'The building drain, building sewer and branches must be large enough for the drainage fixture units they serve, and the sewer may never be smaller than the drain.',
        requirements: [
            'Add the DFU for every fixture, including floor drains and the washing machine.',
            'Use the horizontal branch, stack and building-drain tables separately; a branch that is large enough may still be too small as a stack.',
            'A 3 in building drain is common for a small house; a larger fixture load may need 4 in.',
            'Do not reduce the pipe size in the direction of flow.'
        ],
        checkIds: ['sewer-size'],
        detail: 'The model uses conservative DFU capacities and chooses the smallest listed size that carries the load. A local amendment or a long run may require the next size up.'
    },
    {
        id: 'drain-slope',
        category: 'drainage',
        title: 'Give every horizontal drain the minimum fall',
        code: 'IPC 2021 §704.1 · Table 704.1',
        level: 'required',
        summary: 'Horizontal drainage pipe must slope at least 1/4 in per foot (2%) up to 2-1/2 in, and at least 1/8 in per foot (1%) for 3 in to 6 in pipe.',
        requirements: [
            'A 2% slope is 20 mm per metre; a 1% slope is 10 mm per metre.',
            'Keep the slope uniform; a sag or a backfall holds water and solids.',
            'The building drain must fall to the sewer invert without lifting.',
            'Long runs may need a cleanout or a vent to keep the slope practical.'
        ],
        checkIds: ['sewer-slope', 'sewer-invert'],
        detail: 'The suite defaults to 2% for the whole drain, which is conservative for 4 in pipe, and reports the required invert at the sewer connection.'
    },
    {
        id: 'sewer-invert',
        category: 'drainage',
        title: 'The sewer invert must be below the building drain',
        code: 'IPC 2021 §702 · practice',
        level: 'required',
        summary: 'Gravity cannot be negotiated: the sewer connection must be low enough for the building drain to fall to it at the required slope.',
        requirements: [
            'Measure the invert, not the top of the pipe, at the property line or septic inlet.',
            'Allow for the fall over the entire route plus the depth of the building drain below the floor.',
            'If the invert is too shallow, a lift station or a different route may be the only options.',
            'Confirm the depth before digging; utility records are often approximate.'
        ],
        checkIds: ['sewer-invert'],
        detail: 'The suite computes the required invert from the sewer main length and slope, then compares it with the hookup depth. A negative number is below the floor.'
    },
    {
        id: 'trap-arm',
        category: 'venting',
        title: 'Keep the trap arm within its length limit',
        code: 'IPC 2021 §1002.2',
        level: 'required',
        summary: 'The pipe between a fixture trap and its vent must be short enough that the trap is not siphoned.',
        requirements: [
            'The limit depends on the trap-arm size: roughly 4 ft for 1-1/2 in, 5 ft for 2 in and 6 ft for 3 in.',
            'The trap arm must slope toward the drain and may not have a vertical drop before the vent.',
            'A fixture group needs a vent connection before the last fixture joins the drain.',
            'A water closet is usually 3 in and has the longest allowance, but the vent still has to be close.'
        ],
        checkIds: ['trap-arm'],
        detail: 'The suite measures from each fixture to its group stack in plan. It is a schematic length; the actual fitting-to-fitting run can be shorter after the trap and stack fittings are made up.'
    },
    {
        id: 'venting',
        category: 'venting',
        title: 'Vent every trap and terminate the vent outside',
        code: 'IPC 2021 §901.2 · §903 · §906',
        level: 'required',
        summary: 'Each trap needs a vent, the vent must be sized for the drain it serves, and it must terminate outdoors above the roof.',
        requirements: [
            'A stack vent is the continuation of a soil or waste stack through the roof.',
            'A vent terminal is at least 6 in above the roof and clear of windows, doors and air intakes.',
            'A wet vent is allowed only for the fixtures and sizes the code lists; a water closet wet-vented by a lavatory has extra limits.',
            'A vent may not be obstructed by a frost closure; increase the size in cold climates where required.'
        ],
        checkIds: ['vent-size'],
        detail: 'The suite models one stack vent per fixture group and sizes it with the stack. That is conservative for a small group, but the wet-vent fixture order still needs a plan review.'
    },
    {
        id: 'cleanouts',
        category: 'drainage',
        title: 'Provide cleanouts at the base of stacks and at the sewer',
        code: 'IPC 2021 §708.1 · §708.3',
        level: 'required',
        summary: 'Cleanouts are required at the base of each stack, at the building sewer, and at long horizontal runs and changes of direction.',
        requirements: [
            'A cleanout at the base of a stack must be accessible.',
            'The building sewer needs a cleanout near the foundation or at the property line as the local rule requires.',
            'Add a cleanout at the upstream end of a long horizontal drain and at 135-degree or greater turns.',
            'A cleanout in a finished space needs a access panel and a tight plug.'
        ],
        checkIds: ['cleanout'],
        detail: 'The suite counts one cleanout at each stack base plus one at the sewer. Add more for a long run or a tricky bend.'
    },
    {
        id: 'fixture-clearance',
        category: 'fixtures',
        title: 'Give each fixture usable clearance',
        code: 'IPC 2021 §405.3.1 · §405.3.2',
        level: 'required',
        summary: 'A water closet, urinal, lavatory or bidet needs 15 in from its centre to a side wall and 21 in clear in front.',
        requirements: [
            'Measure centre-to-centre between two fixtures as well: 30 in is the usual minimum for a water closet and lavatory.',
            'A lavatory in a vanity still needs the side clearance to the wall or partition.',
            'A bathtub or shower needs a clear opening and a safe step; grab bars are an accessibility upgrade.',
            'Do not put a fixture behind a door swing or in a closet.'
        ],
        checkIds: ['fixture-clearance', 'fixture-spacing'],
        detail: 'The plan draws a dashed clearance envelope around the selected fixture in the finish view and warns when a side or front distance falls below the planning minimum.'
    },
    {
        id: 'fixture-count',
        category: 'fixtures',
        title: 'Provide the basic fixtures for the dwelling',
        code: 'IPC 2021 §2902 · IRC P2705',
        level: 'required',
        summary: 'A dwelling needs at least one water closet, one lavatory, one kitchen sink and one bathtub or shower; a laundry area needs a washing-machine connection.',
        requirements: [
            'A half bath counts for the water closet and lavatory but not the bathing fixture.',
            'A kitchen sink is required in a dwelling unit with cooking facilities.',
            'A washing machine needs a 2 in standpipe and trap, or a listed appliance box.',
            'Confirm the occupancy and the local fixture-count table before removing a fixture.'
        ],
        checkIds: ['fixture-count'],
        detail: 'The template check warns when the whole-house, bathroom or ADU template is missing a basic fixture. A kitchen-laundry template is checked for the kitchen sink instead.'
    },
    {
        id: 'fixture-fit',
        category: 'fixtures',
        title: 'Keep fixtures inside the room and out of each other',
        code: 'IPC 2021 §405 · practice',
        level: 'required',
        summary: 'A fixture that overlaps another or projects through a wall cannot be installed, even if the schedule looks right.',
        requirements: [
            'Check the rough opening and the finished footprint, not only the fixture centre.',
            'Allow for the tank, the supply stops and the door swing.',
            'A floor drain needs a low point and a trap primer where it can dry out.',
            'Keep the water heater access panel clear.'
        ],
        checkIds: ['fixture-outside', 'fixture-overlap'],
        detail: 'Drag a fixture on the plan; the suite snaps it to the nearest wall, nudges it past a neighbour and reports an overlap or an outside footprint.'
    },
    {
        id: 'kitchen-sink',
        category: 'fixtures',
        title: 'Kitchen sink: trap, vent and dishwasher',
        code: 'IPC 2021 §413.1 · §414.1',
        level: 'required',
        summary: 'A kitchen sink needs a 1-1/2 in trap arm, a vent, and a dishwasher drain with an air gap or high loop.',
        requirements: [
            'A 2 in drain is common for a sink with a disposer; a 1-1/2 in trap arm is typical.',
            'An island sink needs island venting or an air admittance valve where the local code allows it.',
            'The dishwasher drain needs an air gap or a high loop above the sink trap.',
            'A dedicated receptacle and a hot-water supply are typical for the dishwasher.'
        ],
        checkIds: ['dishwasher-airgap', 'trap-arm'],
        detail: 'The suite includes an air gap or high loop and a 1-1/2 in dishwasher branch. Delete the air gap and the rule warns.'
    },
    {
        id: 'laundry',
        category: 'fixtures',
        title: 'Laundry: standpipe, trap and dryer vent',
        code: 'IPC 2021 §406.1 · §406.2',
        level: 'required',
        summary: 'A washing machine needs a 2 in standpipe and trap, and a gas dryer needs a shutoff, sediment trap and a separate exhaust vent.',
        requirements: [
            'The standpipe should be at least 18 in and not more than 42 in above the floor.',
            'The trap must be accessible and protected from siphoning.',
            'A gas dryer needs a listed connector and a shutoff in the same room.',
            'The dryer exhaust is independent of the plumbing vent and must terminate outdoors.'
        ],
        checkIds: ['washer-standpipe', 'gas-sediment-trap', 'gas-shutoff'],
        detail: 'The laundry template includes a 2 in standpipe and trim. The gas dryer connection is priced separately from the appliance.'
    },
    {
        id: 'gas-sizing',
        category: 'gas',
        title: 'Size gas pipe for the connected load, not the appliance count',
        code: 'IFGC 2021 §402.4 · Table 402.4',
        level: 'required',
        summary: 'Gas pipe is sized on the total connected hourly load with all appliances at full input, using the longest equivalent length.',
        requirements: [
            'Add the input BTU/h of every appliance, including the water heater and any outdoor grill.',
            'Convert BTU/h to cubic feet per hour using the gas heating value.',
            'Use the longest run and the pressure drop allowed by the code table; a longer run needs a larger pipe.',
            'A 1/2 in branch is common for a range or dryer, but the main may need 1 in or more.',
            'Confirm the meter capacity with the utility before assuming the connected load will be supplied.'
        ],
        checkIds: ['gas-size', 'gas-meter'],
        detail: 'The suite derates the 10 ft capacity table by the square root of the run length and checks the meter capacity. It is a planning estimate; use the full IFGC table for a permit drawing.'
    },
    {
        id: 'gas-sediment',
        category: 'gas',
        title: 'Install a sediment trap and a shutoff at each appliance',
        code: 'IFGC 2021 §408.4 · §409.1',
        level: 'required',
        summary: 'Each gas appliance needs a shutoff valve and, unless the appliance includes one, a sediment trap downstream of the shutoff.',
        requirements: [
            'The shutoff must be in the same room, within reach, and identified.',
            'The sediment trap is a tee with a capped nipple at least 3 in long in the bottom run.',
            'The trap must be downstream of the shutoff and as close to the appliance as practical.',
            'A connector is not a substitute for a trap or a shutoff.'
        ],
        checkIds: ['gas-sediment-trap', 'gas-shutoff'],
        detail: 'The suite prices one sediment trap and one shutoff for every gas appliance, including the gas water heater, but not a separate shutoff for a fireplace that has its own listed valve.'
    },
    {
        id: 'gas-connector',
        category: 'gas',
        title: 'Use a listed, accessible appliance connector',
        code: 'IFGC 2021 §411.1 · §411.3',
        level: 'required',
        summary: 'The final connection to a gas appliance must be a listed connector or rigid pipe, protected from damage and not used to support the appliance.',
        requirements: [
            'Keep the connector visible and accessible; do not conceal it in a wall.',
            'Protect it from grease, heat and physical damage.',
            'Do not use a connector to move or align an appliance that should be rigidly connected.',
            'A quick-disconnect for an outdoor grill must be listed for the application.'
        ],
        checkIds: ['gas-connector'],
        detail: 'The finish takeoff includes a connector for the range, dryer and grill. A furnace or water heater may use a rigid connection; confirm the manufacturer and local practice.'
    },
    {
        id: 'gas-venting',
        category: 'gas',
        title: 'Provide combustion air and a listed vent',
        code: 'IFGC 2021 §304 · §503 · §504',
        level: 'required',
        summary: 'Gas appliances need combustion air and a vent sized for the appliance, with clearances to combustible construction.',
        requirements: [
            'A closet furnace or water heater may need high and low combustion-air openings or a direct-vent kit.',
            'A natural-draft appliance needs a vertical flue with the listed rise and termination.',
            'A tankless unit often uses PVC or stainless venting with its own clearances; follow the manufacturer.',
            'Keep the vent terminal clear of windows, doors and air intakes.'
        ],
        checkIds: ['gas-vent'],
        detail: 'The suite includes a vent kit and marks venting as a coordination item. The actual flue size and combustion-air calculation need the appliance input and the room volume.'
    },
    {
        id: 'gas-pressure',
        category: 'gas',
        title: 'Confirm the gas pressure and regulator',
        code: 'IFGC 2021 §402.2 · §410',
        level: 'required',
        summary: 'Residential natural gas is usually supplied at 7 in w.c. (about 1/4 psi); appliance ratings, regulators and the meter must match.',
        requirements: [
            'Low-pressure appliances are rated for 7 in w.c.; a 2 psi system needs a regulator at each appliance.',
            'A propane system has a different heating value and usually a different regulator.',
            'The meter and service regulator belong to the utility in many jurisdictions.',
            'Do not confuse static pressure with flowing pressure; check both at the appliance.'
        ],
        checkIds: ['gas-pressure'],
        detail: 'The suite warns when the plan pressure is not 7 in w.c. It does not select or size regulators.'
    },
    {
        id: 'testing',
        category: 'inspection',
        title: 'Test the rough-in and photograph it before closure',
        code: 'IPC 2021 §312 · §308',
        level: 'required',
        summary: 'The drainage system is water-tested and the supply system is pressure-tested before the walls are closed; the gas system is tested separately.',
        requirements: [
            'Drainage: a 10 ft head water test or an air test as the local code allows, for the required duration.',
            'Water supply: a hydrostatic test at the working pressure or the local requirement, with the meter and fixtures isolated.',
            'Gas: a pressure test at the code pressure for the required time, with the appliance valves closed.',
            'Photograph every wall before closure and keep the test record with the permit.'
        ],
        checkIds: [],
        detail: 'This is a process rule, so the plan shows it as an information card rather than a pass/fail geometry check. The inspector will ask for the test record.'
    },
    {
        id: 'pipe-support',
        category: 'inspection',
        title: 'Support and protect the pipe',
        code: 'IPC 2021 §308 · §305 · IFGC 2021 §407',
        level: 'required',
        summary: 'Pipe must be supported at the code interval, protected from freezing, and kept away from nails, heat and physical damage.',
        requirements: [
            'Support horizontal water pipe at about 1.2 m and DWV at about 1.5 m, or closer where the code requires.',
            'Use nail plates where pipe passes through framing within 1-1/2 in of the face.',
            'Insulate or heat pipe in a freeze-exposed location; a frost-proof sillcock is not a substitute for protecting the whole run.',
            'Keep gas pipe out of a concealed location where a joint would be inaccessible.'
        ],
        checkIds: [],
        detail: 'The takeoff includes hangers and support at planning intervals. The actual spacing depends on the pipe material and the local amendment.'
    },
    {
        id: 'water-quality',
        category: 'water',
        title: 'Protect the water quality after the meter',
        code: 'IPC 2021 §604.9 · §608',
        level: 'recommended',
        summary: 'A filter, a water softener or a recirculation line changes the pressure and the pipe layout; plan the space and the drain.',
        requirements: [
            'A softener needs a drain and a bypass; a carbon filter needs a backwash drain if it is automatic.',
            'A hot-water recirculation line needs a return and a pump or a gravity loop; insulate both lines.',
            'A whole-house filter should be accessible and have a shutoff on both sides.',
            'Do not create a cross-connection with a garden hose or a chemical injector.'
        ],
        checkIds: ['backflow'],
        detail: 'The suite does not size treatment equipment, but the takeoff has room for a recirculation line and the plan flags backflow at the service and hose bibs.'
    }
];

export const RULE_COUNT = RULES.length;

export const RULE_LEVELS = [
    { id: 'required', label: 'Required' },
    { id: 'recommended', label: 'Recommended' },
    { id: 'info', label: 'Verify locally' }
];

export function ruleStatus(rule, checks = []) {
    const matched = (rule.checkIds || [])
        .map((id) => checks.find((check) => check.id === id))
        .filter(Boolean);
    if (!rule.checkIds?.length || !matched.length) {
        return { state: 'info', label: 'Verify locally', errors: 0, warnings: 0, passes: 0 };
    }
    const errors = matched.filter((check) => check.severity === 'error').length;
    const warnings = matched.filter((check) => check.severity === 'warn').length;
    const passes = matched.filter((check) => check.severity === 'ok').length;
    if (errors) return { state: 'error', label: `${errors} issue${errors === 1 ? '' : 's'}`, errors, warnings, passes };
    if (warnings) return { state: 'warn', label: `${warnings} warning${warnings === 1 ? '' : 's'}`, errors, warnings, passes };
    return { state: 'ok', label: 'Plan matches', errors, warnings, passes };
}

export function rulesByCategory() {
    return RULE_CATEGORIES.map((category) => ({
        ...category,
        rules: RULES.filter((rule) => rule.category === category.id)
    })).filter((category) => category.rules.length);
}

export function searchRules(query = '') {
    const text = String(query || '').trim().toLowerCase();
    if (!text) return RULES;
    return RULES.filter((rule) => [
        rule.title, rule.code, rule.summary, rule.detail, ...(rule.requirements || [])
    ].join(' ').toLowerCase().includes(text));
}

export function rulesForCheck(checkId) {
    return RULES.filter((rule) => (rule.checkIds || []).includes(checkId));
}
