/**
 * Rules and regulations for the lighting and power plan, written for a
 * designer rather than a lawyer. The model code is the 2022 California
 * Electrical Code (Title 24, Part 3, based on the 2020 NEC with California
 * amendments) plus the 2022 California Energy Code (Title 24, Part 6). Local
 * amendments and the authority having jurisdiction always win.
 */

export const RULE_CATEGORIES = [
    { id: 'lighting', label: 'Lighting & switching' },
    { id: 'receptacles', label: 'Receptacles' },
    { id: 'rooms', label: 'Kitchens & wet rooms' },
    { id: 'power', label: 'Circuits & protection' },
    { id: 'energy', label: 'Energy & quality' },
    { id: 'inspection', label: 'Inspection' }
];

export const CODE_SCOPE = {
    title: '2022 California Electrical Code · 2022 Title 24, Part 6',
    url: 'https://up.codes/viewer/california/ca-electric-code-2022',
    body: 'The 2022 California Electrical Code is Title 24, Part 3 and is based on the 2020 NEC with California amendments. It covers receptacle spacing, GFCI/AFCI protection and lighting outlets. The 2022 California Energy Code (Title 24, Part 6) adds high-efficacy/JA8 luminaire and lighting-control requirements. This page is a design aid: confirm the edition and amendments adopted in your jurisdiction, and have the final plan reviewed by a licensed electrician.'
};

export const RULES = [
    {
        id: 'lighting-outlet',
        category: 'lighting',
        title: 'A switched lighting outlet in every habitable room, kitchen and bathroom',
        code: 'CEC 2022 §210.70(A)(1)',
        level: 'required',
        summary: 'At least one lighting outlet controlled by a listed wall-mounted control device is required in every habitable room, kitchen and bathroom. The control must be near a room entrance on a wall.',
        requirements: [
            'The lighting outlet is the box and circuit, not the fixture; a luminaire is installed at it later.',
            'The control must be wall mounted and listed; a pull chain or a lamp switch does not satisfy it.',
            'Exception 1 permits a switched receptacle in rooms other than kitchens and bathrooms.',
            'Exception 2 permits an occupancy sensor in addition to the wall control, or at a customary switch location with a manual override.'
        ],
        checkIds: ['lighting-outlet', 'switch-control'],
        detail: 'Place at least one luminaire, bind it to a switch, and check that the switch sits on the wall by the door. Bedrooms, living rooms, dining rooms, kitchens and bathrooms all need this; closets and storage rooms have their own requirement.'
    },
    {
        id: 'additional-locations',
        category: 'lighting',
        title: 'Hallways, stairways, garages and outdoor entrances',
        code: 'CEC 2022 §210.70(A)(2)',
        level: 'required',
        summary: 'Hallways, stairways, attached garages, detached garages with electric power and outdoor entrances need at least one lighting outlet controlled by a listed wall-mounted control device.',
        requirements: [
            'A stairway with six or more risers needs a control at each floor level and landing level with an entryway.',
            'An outdoor entrance or exit with grade-level access needs illumination on the exterior side; a vehicle door does not count as an outdoor entrance.',
            'A garage needs a switched light that is not on the door-operator circuit.'
        ],
        checkIds: ['stair-switch', 'switch-entry', 'lighting-outlet'],
        detail: 'The suite gives a stairway two three-way switches automatically. For a long hallway, two three-ways at the ends are a comfort upgrade even where one switch is code-minimum.'
    },
    {
        id: 'switch-location',
        category: 'lighting',
        title: 'Put the switch where the door opens',
        code: 'CEC 2022 §210.70(A)(1) · practice',
        level: 'recommended',
        summary: 'A wall control needs to be reachable on entry, on the latch side of the door and clear of the door swing.',
        requirements: [
            'About 1.0–1.5 m from the door opening, at 1.2 m above the floor.',
            'Latch side, so you are not reaching across the door.',
            'Never inside a closet or behind a door that opens against it.',
            'A dimmer or sensor still needs a manual control unless the code exception applies.'
        ],
        checkIds: ['switch-entry'],
        detail: 'The suite warns when the nearest switch is more than 1.6 m from the entry point. Move it to the latch side and keep 100 mm clear of the trim.'
    },
    {
        id: 'receptacle-spacing',
        category: 'receptacles',
        title: 'The 6 ft / 12 ft receptacle rule',
        code: 'CEC 2022 §210.52(A)(1)–(A)(3)',
        level: 'required',
        summary: 'No point along the floor line of a wall space may be more than 6 ft (1.83 m) from a receptacle; in practice, receptacles are no more than 12 ft (3.66 m) apart.',
        requirements: [
            'Wall spaces 2 ft (610 mm) or wider count, including the space between a door and an adjoining wall.',
            'A floor receptacle counts only if it is within 18 in (457 mm) of the wall.',
            'Fixed room dividers and sliding panels create separate wall spaces.',
            'The rule applies in living, dining, bedroom, kitchen, family and similar rooms.'
        ],
        checkIds: ['socket-spacing', 'socket-count'],
        detail: 'The suite places sockets to keep every point within half the configured spacing. The default 3.66 m spacing gives a 1.83 m maximum from a corner and 3.66 m between sockets.'
    },
    {
        id: 'countertop',
        category: 'rooms',
        title: 'Countertop receptacles: 24 in from anywhere, islands sized by area',
        code: 'CEC 2022 §210.52(C)',
        level: 'required',
        summary: 'Every wall countertop space 12 in (305 mm) or wider needs a receptacle, and no point may be more than 24 in (610 mm) from one. Islands and peninsulas follow the area formula in 210.52(C)(2).',
        requirements: [
            'Wall countertop: no point along the wall line more than 600 mm (24 in) from a receptacle.',
            'Island or peninsula: at least one receptacle for the first 9 sq ft or fraction, plus one for every additional 18 sq ft or fraction.',
            'A peninsula needs at least one receptacle within 600 mm (2 ft) of its outer end.',
            'A receptacle may be on or above the counter but not more than 500 mm (20 in) above it, in the counter, or not more than 300 mm (12 in) below it.',
            'Every countertop receptacle needs GFCI protection.'
        ],
        checkIds: ['socket-spacing', 'socket-count', 'gfci'],
        detail: 'California retains the 2020 NEC island and peninsula requirement. The kitchen preset uses 1.2 m spacing so no point is more than 600 mm from a socket; lay out the actual cabinet run and split the counter at the range, refrigerator and sink.'
    },
    {
        id: 'small-appliance',
        category: 'rooms',
        title: 'Two kitchen small-appliance circuits',
        code: 'CEC 2022 §210.11(C)(1) · §210.52(C)',
        level: 'required',
        summary: 'Kitchen countertop receptacles must be supplied by at least two 20 A small-appliance branch circuits.',
        requirements: [
            '20 A, 12 AWG copper, GFCI protected.',
            'No lighting outlets and no other general receptacles on these circuits.',
            'A dining room, breakfast room or pantry receptacle may be on either circuit.',
            'A dedicated appliance circuit (range, dishwasher, disposal) is separate.'
        ],
        checkIds: ['kitchen-circuits', 'circuit-80', 'circuit-overload'],
        detail: 'The suite creates K1 and K2 for a kitchen and splits counter receptacles between them. Keep the lighting on L1 so a tripped appliance circuit does not black out the room.'
    },
    {
        id: 'bathroom',
        category: 'rooms',
        title: 'Bathroom receptacle and light',
        code: 'CEC 2022 §210.52(D) · §210.8(A)(1) · §210.70(A)(1) · §406.9(C)',
        level: 'required',
        summary: 'A bathroom needs a GFCI-protected receptacle within 3 ft of the basin, and a switch-controlled lighting outlet.',
        requirements: [
            'At least one receptacle within 36 in (914 mm) of the outside edge of the basin.',
            'No receptacle in the tub or shower zone: 900 mm (3 ft) horizontally and 2.5 m (8 ft) above the rim or threshold.',
            'All 125–250 V bathroom receptacles need GFCI protection.',
            'The luminaire must be damp rated, and a fixture over a tub or shower must be wet rated and listed for the location.'
        ],
        checkIds: ['gfci', 'wet-luminaire', 'lighting-outlet'],
        detail: 'Put the vanity on its own 20 A circuit, GFCI at the first receptacle or at the breaker, and light the face from both sides of the mirror instead of straight down.'
    },
    {
        id: 'laundry',
        category: 'rooms',
        title: 'Laundry circuit and GFCI',
        code: 'CEC 2022 §210.11(C)(2) · §210.8(A)(10)',
        level: 'required',
        summary: 'A laundry area needs at least one 20 A receptacle circuit, and its receptacles need GFCI protection.',
        requirements: [
            'At least one 20 A laundry branch circuit for the washing machine.',
            'No other outlets on that circuit, with limited exceptions for a laundry light or exhaust fan.',
            'GFCI protection covers 125–250 V laundry receptacles, including a 240 V electric dryer receptacle.',
            'A gas dryer still needs a 120 V receptacle; an electric dryer needs a dedicated 30 A, 240 V circuit.'
        ],
        checkIds: ['gfci', 'socket-count'],
        detail: 'The suite marks a laundry with a GFCI 20 A receptacle and a B/Y circuit. Do not share the laundry circuit with the garage or outdoor receptacles.'
    },
    {
        id: 'outdoor',
        category: 'rooms',
        title: 'Outdoor receptacles and wet-location fixtures',
        code: 'CEC 2022 §210.52(E) · §210.8(A)(3), (F) · §406.9',
        level: 'required',
        summary: 'A one-family dwelling needs at least one outdoor receptacle at the front and one at the back, not more than 6.5 ft above grade, with GFCI, WR rating and an in-use cover.',
        requirements: [
            'GFCI protection for 125–250 V outdoor receptacles, and for outdoor outlets 50 A or less under 210.8(F).',
            'Weather-resistant (WR) receptacle and an in-use (bubble) cover.',
            'Wet-location luminaires with gasketed boxes; a damp-rated fixture is not enough.',
            'Keep the cover closed on an unused receptacle and drain the box.'
        ],
        checkIds: ['gfci', 'wr', 'wet-luminaire'],
        detail: 'An outdoor switch belongs inside the door; a weatherproof switch on the exterior wall is for a dedicated exterior circuit and still needs a gasketed cover.'
    },
    {
        id: 'garage',
        category: 'rooms',
        title: 'Garage receptacles and lights',
        code: 'CEC 2022 §210.52(G) · §210.8(A)(2)',
        level: 'required',
        summary: 'An attached garage needs at least one receptacle and a switched lighting outlet; garage receptacles need GFCI protection.',
        requirements: [
            'At least one 125–250 V receptacle in an attached garage, and in a detached garage with electric power.',
            'GFCI protection for garage and accessory-building receptacles.',
            'A switched light that is independent of the door operator.',
            'Keep the panel and its working clearance clear of stored goods.'
        ],
        checkIds: ['gfci', 'lighting-outlet', 'switch-entry'],
        detail: 'A garage shop light on a chain or cable clears the door track. Use a listed fixture and keep the lamp away from flammable storage.'
    },
    {
        id: 'gfci',
        category: 'power',
        title: 'Where GFCI protection is required',
        code: 'CEC 2022 §210.8(A) · §210.8(F)',
        level: 'required',
        summary: 'GFCI protection is required for 125–250 V receptacles in bathrooms, kitchens, laundry areas, garages, outdoors, crawlspaces, basements, indoor damp or wet locations and near sinks.',
        requirements: [
            'Bathrooms; kitchen countertop receptacles; laundry areas.',
            'Garages and accessory buildings; outdoors; crawlspaces; basements.',
            'Indoor damp and wet locations, and within 6 ft of a sink, bathtub or shower in other rooms.',
            'Outdoor outlets 50 A or less are also covered by 210.8(F).',
            'GFCI protection can be at the breaker or at the first receptacle; downstream receptacles are then protected.'
        ],
        checkIds: ['gfci'],
        detail: 'A GFCI does not replace the equipment ground and does not protect against a short circuit. Keep the line/load terminals correct or the downstream receptacles will not be protected.'
    },
    {
        id: 'afci',
        category: 'power',
        title: 'AFCI protection for 120 V branch circuits',
        code: 'CEC 2022 §210.12(A)',
        level: 'required',
        summary: 'All 120 V, single-phase, 15 and 20 A branch circuits supplying outlets or devices in a dwelling need combination-type AFCI protection.',
        requirements: [
            'The rule covers the whole dwelling, not a list of rooms.',
            'Use a combination-type AFCI breaker at the origin of the circuit.',
            'An outlet-branch AFCI is an alternative only where the code permits it.',
            'Label the panel clearly; an AFCI trip is a diagnostic, not a nuisance to bypass.'
        ],
        checkIds: ['afci'],
        detail: 'The suite marks every 120 V, 15/20 A circuit for AFCI and selects an AFCI breaker in the takeoff. If a circuit is imported without AFCI, the plan check warns.'
    },
    {
        id: 'circuits',
        category: 'power',
        title: 'Do not overload a branch circuit',
        code: 'CEC 2022 §210.19–210.23',
        level: 'required',
        summary: 'The connected load must stay within the branch-circuit rating; continuous loads are limited to 80% of the breaker.',
        requirements: [
            '15 A lighting circuit: 14 AWG copper, typically 12 A of continuous load.',
            '20 A receptacle circuit: 12 AWG copper, 16 A of continuous load.',
            'General receptacles count 180 VA each for the calculation.',
            'A dedicated appliance is sized from its nameplate, not a rule of thumb.'
        ],
        checkIds: ['circuit-80', 'circuit-overload', 'circuit-missing'],
        detail: 'The suite warns above 80% and fails above 100%. It does not perform a service load calculation; add the range, dryer, water heater and EV charger before sizing the service.'
    },
    {
        id: 'boxes',
        category: 'power',
        title: 'Box fill and cable support',
        code: 'CEC 2022 §314.16',
        level: 'required',
        summary: 'Every box needs enough cubic-inch capacity for its conductors, clamps, grounding and device, and cable must be supported and protected.',
        requirements: [
            'Count each current-carrying conductor, the grounded conductor and the equipment ground.',
            'Add one allowance for the device and one for internal clamps.',
            'A 2-1/8 in deep single-gang box is not automatically large enough for two 12/2 cables plus a dimmer.',
            'Support cable within 12 in of a box and every 4.5 ft; protect it where it passes through framing.',
            'Use a listed connector and never strip more sheath than needed inside the box.'
        ],
        checkIds: [],
        detail: 'The suite counts one box per device for pricing, not box fill. Check the fill calculation on a crowded switch box, especially with smart dimmers that have a large body.'
    },
    {
        id: 'ic-fire',
        category: 'power',
        title: 'IC, airtight, JA8 and fire-rated recessed luminaires',
        code: 'CEC 2022 §410.116 · Title 24 §150.0(k)1C',
        level: 'required',
        summary: 'A recessed luminaire in an insulated ceiling must be IC rated; in a fire-resistance-rated assembly it must be listed for the assembly. A ceiling recessed downlight must also be JA8, screw-base-free and airtight.',
        requirements: [
            'IC-rated and airtight for a ceiling that touches insulation.',
            'Title 24 requires less than 2.0 cfm at 75 Pa, a gasket or caulk at the ceiling, and no screw-base socket.',
            'Non-IC cans need a clearance box or the insulation kept clear; the instructions govern.',
            'A fire-rated ceiling needs a fire-rated luminaire or a listed protection of the membrane.',
            'Do not bury a driver or junction box under insulation unless it is listed for it.'
        ],
        checkIds: ['ic-rating', 'fire-rating', 'recessed-ja8'],
        detail: 'The suite flags a recessed fitting that is not IC, fire rated, JA8, screw-base-free and airtight. A surface fixture avoids the ceiling penetration entirely, at the cost of ceiling height.'
    },
    {
        id: 'damp-wet',
        category: 'power',
        title: 'Damp and wet location ratings',
        code: 'CEC 2022 §410.10',
        level: 'required',
        summary: 'Bathrooms, covered porches and other damp locations need damp-rated luminaires; exposed outdoor locations need wet-rated luminaires and boxes.',
        requirements: [
            'A damp location is protected from weather but may be wet; a wet location is exposed.',
            'Use gasketed, listed fixtures and boxes outdoors.',
            'A luminaire over a tub or shower must be wet rated and listed for the application.',
            'Keep the driver and connections inside the listed enclosure, not in the wall cavity.'
        ],
        checkIds: ['wet-luminaire'],
        detail: 'The suite treats bathrooms as damp and the outdoor entry as wet. A recessed downlight over a shower needs a wet-location listing even though the rest of the bathroom only needs damp.'
    },
    {
        id: 'energy-controls',
        category: 'energy',
        title: 'Dimmers in habitable spaces',
        code: 'Title 24 §150.0(k)2F',
        level: 'required',
        summary: 'Lighting in habitable spaces must have readily accessible wall-mounted dimming controls that allow manual adjustment up and down.',
        requirements: [
            'Applies to living rooms, dining rooms, kitchens, bedrooms and similar habitable spaces.',
            'A plain on/off switch does not satisfy the requirement.',
            'Exception: a controlled load under 20 W, or an occupancy/vacancy sensor that provides automatic-off.',
            'Forward-phase dimmers controlling LEDs must comply with NEMA SSL 7A.',
            'Commission the dimmer with the actual LED load and confirm no flicker or buzz.'
        ],
        checkIds: ['energy-controls'],
        detail: 'The suite auto-selects a dimmer where the room preset asks for one. A smart dimmer may need a neutral at the switch box; check before the cable is pulled.'
    },
    {
        id: 'auto-off',
        category: 'energy',
        title: 'Automatic-off lighting controls',
        code: 'Title 24 §150.0(k)2E',
        level: 'required',
        summary: 'Bathrooms, garages, laundry rooms, utility rooms and walk-in closets need at least one luminaire controlled by an occupancy or vacancy sensor with automatic-off.',
        requirements: [
            'The sensor may be an occupancy sensor or a manual-on vacancy sensor.',
            'It must control at least one installed luminaire, not only a fan or a receptacle.',
            'Lighting inside drawers and cabinets needs a door or drawer switch.',
            'A manual override may not bypass the automatic-off function.'
        ],
        checkIds: ['auto-off'],
        detail: 'The suite auto-selects a vacancy sensor for these rooms and warns if the plan has only a plain switch. A sensor usually needs a neutral at the box.'
    },
    {
        id: 'outdoor-controls',
        category: 'energy',
        title: 'Outdoor lighting controls',
        code: 'Title 24 §150.0(k)3',
        level: 'required',
        summary: 'Outdoor lighting permanently mounted to a dwelling needs a manual ON/OFF switch plus a photocell and motion sensor or time switch, or an astronomical time clock.',
        requirements: [
            'A manual ON/OFF control must remain available and permit the automatic action.',
            'Photocell plus motion sensor or automatic time switch, or an astronomical time clock.',
            'An override to ON must return to automatic operation within 6 hours.',
            'An energy management control system may be used if it provides the same functionality.'
        ],
        checkIds: ['outdoor-controls'],
        detail: 'The suite auto-selects a photocell plus motion switch for the outdoor entry. A plain weatherproof switch satisfies the electrical code but not the energy code.'
    },
    {
        id: 'independent-controls',
        category: 'energy',
        title: 'Separately switched task and cabinet lighting',
        code: 'Title 24 §150.0(k)2G',
        level: 'required',
        summary: 'Undercabinet, undershelf, display-cabinet and switched-outlet lighting must be controlled separately from ceiling-installed lighting.',
        requirements: [
            'One can be turned on without turning on the other.',
            'Integrated exhaust-fan lighting must be controlled independently from the fan.',
            'A dimmer or sensor on the ceiling circuit does not control the task circuit.',
            'Label the switches so the separation is clear at inspection.'
        ],
        checkIds: ['independent-controls'],
        detail: 'The suite splits an under-cabinet strip onto its own switch in a kitchen and warns when a switch controls both task and ceiling lighting.'
    },
    {
        id: 'efficacy',
        category: 'energy',
        title: 'High-efficacy, JA8 luminaires',
        code: 'Title 24 §150.0(k)1A–1C · Table 150.0-A · JA8',
        level: 'required',
        summary: 'Every installed luminaire must be high efficacy under Table 150.0-A; most interior sources must be JA8 certified. Ceiling recessed downlights must be JA8, screw-base-free and airtight.',
        requirements: [
            'Outdoor LED, decorative colored SSL, pin-based fluorescent, HID/induction and ceiling fan kits are classified high efficacy in Table 150.0-A.',
            'Screw-based luminaires must contain JA8-certified lamps.',
            'Ceiling recessed downlights: JA8, no screw-base socket, airtight below 2.0 cfm at 75 Pa, gasketed or sealed.',
            'Lamps in enclosed or recessed luminaires must meet the JA8 elevated-temperature requirements.',
            'Keep the JA8 listing numbers on the luminaire schedule for plan review.'
        ],
        checkIds: ['efficacy', 'recessed-ja8', 'lpd'],
        detail: 'The suite checks the permanent luminaires in the plan against the JA8, screw-base and airtight flags and reports installed lumens per watt as a design metric, not as the compliance threshold.'
    },
    {
        id: 'quality',
        category: 'energy',
        title: 'Design quality targets beyond the code',
        code: 'Good practice · not a code minimum',
        level: 'recommended',
        summary: 'Code sets safety, not comfort. Target 150–300 lx for living and bedrooms, 300–500 lx on a kitchen worktop, CRI 90+ and one CCT per room.',
        requirements: [
            'Average illuminance at the work plane, not at the ceiling.',
            'Uniformity of 0.40 or better; keep the max-to-average ratio under 3.',
            'CRI 90+ and R9 for wood, fabric and skin.',
            'Layer ambient, task and accent, and dim each layer separately.',
            'Keep the CCT range within 500 K across one open view.'
        ],
        checkIds: ['target', 'target-low', 'target-high', 'uniformity', 'cri', 'cct-mix', 'task-layer'],
        detail: 'The suite scores these as advisory checks. A room can pass every code check and still feel flat; use the heatmap and the layer balance to judge the design.'
    },
    {
        id: 'working-clearance',
        category: 'inspection',
        title: 'Panel and equipment working clearance',
        code: 'CEC 2022 §110.26',
        level: 'required',
        summary: 'Keep a clear working space in front of the panel and service equipment: typically 30 in wide, 36 in deep and 6 ft 6 in high.',
        requirements: [
            'The space must be clear from floor to the required height, not shelved over.',
            'Do not place the panel in a closet or behind a door swing.',
            'A panel in a garage needs protection from vehicle impact.',
            'Label every circuit clearly and keep the directory current.'
        ],
        checkIds: [],
        detail: 'This plan puts a panel marker at the lower-left corner. Move it to a real wall with clear access before construction; the suite does not model the service room.'
    },
    {
        id: 'inspection',
        category: 'inspection',
        title: 'What the inspector will want to see',
        code: 'Plan review and rough-in',
        level: 'required',
        summary: 'A clear plan, a panel schedule, box fill and cable support, and evidence that every required outlet is present.',
        requirements: [
            'Dimensioned plan with every receptacle, switch, luminaire and circuit identified.',
            'Panel schedule with breaker size, circuit type, AFCI/GFCI and connected load.',
            'Luminaire schedule with the JA8 listing number for every permanently installed fixture.',
            'Cut sheets for luminaires, dimmers and any smart control.',
            'Rough-in photos before insulation and drywall, especially at boxes and fire-rated ceilings.',
            'GFCI/AFCI test and a written dimmer compatibility check.'
        ],
        checkIds: ['circuit-missing', 'switch-control', 'lighting-outlet'],
        detail: 'Export the schedule CSV and the takeoff from this suite as the basis for the electrical plan. Have a licensed electrician review and stamp the final drawing set.'
    }
];

export function rulesByCategory() {
    return RULE_CATEGORIES.map((category) => ({
        ...category,
        rules: RULES.filter((rule) => rule.category === category.id)
    }));
}

export function searchRules(query) {
    const term = String(query || '').trim().toLowerCase();
    if (!term) return RULES;
    return RULES.filter((rule) => [
        rule.title, rule.code, rule.summary, rule.detail,
        ...(rule.requirements || [])
    ].join(' ').toLowerCase().includes(term));
}

export function ruleStatus(rule, checks = []) {
    if (!rule.checkIds?.length) return { state: 'info', label: 'Review' };
    const related = checks.filter((check) => rule.checkIds.includes(check.id));
    if (!related.length) return { state: 'info', label: 'Not modelled' };
    if (related.some((check) => check.severity === 'error')) return { state: 'error', label: 'Fix' };
    if (related.some((check) => check.severity === 'warn')) return { state: 'warn', label: 'Review' };
    if (related.every((check) => check.severity === 'info')) return { state: 'info', label: 'Note' };
    return { state: 'ok', label: 'Pass' };
}

export const RULE_LEVEL_LABEL = {
    required: 'Required',
    recommended: 'Recommended',
    energy: 'Energy code'
};
