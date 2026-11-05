/**
 * Rules and regulations for the electrical panel and circuits suite.
 *
 * The model code is NFPA 70 (NEC) 2021: Article 210 branch circuits, Article
 * 220 calculations, Article 230 services, Article 250 grounding, Article 310
 * conductors, Article 314 boxes, Article 408 switchboards and panelboards and
 * Articles 430, 625 and 680 for motors, EV charging and pools. Local amendments
 * and the electrical inspector always govern.
 *
 * The same register is published as elecrules.csv (one row per rule) and
 * explained for electricians in elecrules.md.
 */

export const RULE_CATEGORIES = [
    { id: 'calculation', label: 'Load calculation' },
    { id: 'service', label: 'Service & panel' },
    { id: 'conductor', label: 'Conductors & raceways' },
    { id: 'branch', label: 'Branch circuits' },
    { id: 'protection', label: 'GFCI & AFCI' },
    { id: 'grounding', label: 'Grounding & bonding' },
    { id: 'special', label: 'Motors, EV & pools' },
    { id: 'inspection', label: 'Inspection & handover' }
];

export const CODE_SCOPE = {
    title: 'NFPA 70 (NEC) 2021 · Articles 210, 220, 230, 250, 310, 314, 408',
    url: 'https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70',
    body: 'Dwelling service and feeder calculations follow NEC Article 220: 3 VA/sq ft lighting, 1,500 VA small-appliance and laundry circuits, the 220.42 demand tiers, the 220.53 appliance factor and the 220.82 optional method. Service and feeder conductors come from Table 310.16, grounding from 250.66 and 250.122, raceway fill from Chapter 9, box fill from 314.16, and branch-circuit requirements from Article 210. This is a design aid: confirm the edition and local amendments, and have the service and feeder reviewed by a licensed electrician or engineer.'
};

export const RULES = [
    // --- Load calculation -------------------------------------------------
    {
        id: 'demand-standard',
        category: 'calculation',
        title: 'Standard method demand load',
        code: 'NEC 2021 §220.42 · §220.53 · §220.60',
        level: 'required',
        summary: 'General lighting starts at 3 VA/sq ft (33 VA/m²) and takes the 220.42 demand tiers: first 3,000 VA at 100%, the next 117,000 VA at 35%, the remainder at 25%. Four or more appliance loads may take 75%, and heating and cooling are taken at the larger, not both.',
        requirements: [
            'Lighting load 3 VA per square foot of occupied area.',
            '1,500 VA for each small-appliance circuit and for the laundry.',
            'Apply the 220.42 tiers before adding the appliance load.',
            'Take the larger of heating or cooling under 220.60.',
            'Add 25% of the largest motor (430.24).'
        ],
        checkIds: ['demand-load']
    },
    {
        id: 'demand-optional',
        category: 'calculation',
        title: 'Optional method for a dwelling',
        code: 'NEC 2021 §220.82',
        level: 'recommended',
        summary: 'For a dwelling unit the optional method takes 100% of the first 10 kVA and 40% of the rest of the general and appliance load, then adds the 220.82(C) heating, cooling, range and dryer loads at their listed percentages.',
        requirements: [
            'Use the optional method only for a dwelling unit.',
            '100% of the first 10 kVA, 40% of the remainder.',
            'Heating and cooling at 100% (65% for a heat pump with supplemental heat).',
            'Range and dryer at their 220.55 and 220.54 values.'
        ],
        checkIds: ['demand-load']
    },

    // --- Service & panel --------------------------------------------------
    {
        id: 'service-size',
        category: 'service',
        title: 'Service rating from the calculated load',
        code: 'NEC 2021 §230.42 · §230.79',
        level: 'required',
        summary: 'The service rating must carry the calculated load, and a single-family dwelling service may not be smaller than 100 A (3-wire, 120/240 V).',
        requirements: [
            'Service amps = calculated volt-amperes ÷ 240 for a single-phase service.',
            'Round up to a standard rating: 100, 125, 150, 200, 225, 320 or 400 A.',
            'The service conductors and the main breaker must both carry the load.',
            'A dwelling service is at least 100 A.'
        ],
        checkIds: ['service-size', 'main-breaker']
    },
    {
        id: 'service-disconnect',
        category: 'service',
        title: 'Service disconnecting means',
        code: 'NEC 2021 §230.70 · §230.71',
        level: 'required',
        summary: 'The service needs a disconnecting means at a readily accessible point nearest the entry of the conductors, marked as the service disconnect, with no more than six service disconnects in one enclosure.',
        requirements: [
            'Locate the disconnect nearest the point where the service conductors enter.',
            'Mark it “Service Disconnect”.',
            'No more than six service disconnects in a single enclosure.',
            'Keep the working space clear in front of it (110.26).'
        ],
        checkIds: ['service-disconnect']
    },
    {
        id: 'panel-spaces',
        category: 'service',
        title: 'Panelboard spaces and directory',
        code: 'NEC 2021 §408.4 · §408.54',
        level: 'required',
        summary: 'Every circuit needs a permanent directory, and the panelboard must have enough spaces for the circuits plus the spare capacity the code and good practice expect.',
        requirements: [
            'A directory at the panel listing every circuit and its load.',
            'Spaces for every breaker, with spares for future circuits.',
            'Breakers may not be paralleled in one space.',
            'Label the panel with the service rating and the main size.'
        ],
        checkIds: ['panel-spaces', 'directory']
    },
    {
        id: 'working-clearance',
        category: 'service',
        title: 'Working space at the panel',
        code: 'NEC 2021 §110.26',
        level: 'required',
        summary: 'Provide at least 30 in of width, 36 in of depth and 6 ft 6 in of height of clear working space in front of the panel, with the panel door able to open 90°.',
        requirements: [
            '30 in wide, or the width of the equipment if wider.',
            '36 in deep from the front face.',
            '6 ft 6 in of headroom.',
            'No pipes, ducts or storage in the working space.'
        ],
        checkIds: ['working-clearance']
    },

    // --- Conductors & raceways -------------------------------------------
    {
        id: 'conductor-ampacity',
        category: 'conductor',
        title: 'Conductor ampacity and the 60 °C limit',
        code: 'NEC 2021 §310.16 · §334.80',
        level: 'required',
        summary: 'Conductors are sized from Table 310.16 for the termination temperature, and NM-B cable is limited to the 60 °C column.',
        requirements: [
            'Use the 75 °C column only where the terminations are rated 75 °C.',
            'NM-B takes the 60 °C column (334.80).',
            'Aluminium is two sizes larger than the equivalent copper ampacity.',
            'The overcurrent device may not exceed the conductor ampacity.'
        ],
        checkIds: ['service-conductor', 'egc', 'branch-conductor']
    },
    {
        id: 'ambient-adjustment',
        category: 'conductor',
        title: 'Ambient and conductor-count adjustment',
        code: 'NEC 2021 §310.15(C)(1) · Table 310.15(B)(1)',
        level: 'required',
        summary: 'Ampacity is adjusted for ambient temperature and for more than three current-carrying conductors in a raceway: 80% for 4–6, 70% for 7–9 and 50% for 10–20.',
        requirements: [
            'Adjust for the ambient temperature at the installation.',
            '80% for 4–6 current-carrying conductors, 70% for 7–9.',
            'Count only current-carrying conductors, not grounds.',
            'Apply the adjustment before selecting the breaker.'
        ],
        checkIds: ['ambient-derate']
    },
    {
        id: 'conduit-fill',
        category: 'conductor',
        title: 'Raceway fill',
        code: 'NEC 2021 Chapter 9, Table 1',
        level: 'required',
        summary: 'One conductor may fill 53% of a raceway, two 31%, and three or more 40% of the interior cross-sectional area.',
        requirements: [
            '40% fill for three or more conductors.',
            'Use Table 4 for the raceway area and Table 5 for the conductor area.',
            'Count the equipment grounding conductor toward the fill.',
            'Upsize the raceway rather than overfill it.'
        ],
        checkIds: ['conduit-fill']
    },
    {
        id: 'box-fill',
        category: 'conductor',
        title: 'Box fill',
        code: 'NEC 2021 §314.16',
        level: 'required',
        summary: 'Each box must have enough volume for its conductors, devices, clamps and grounds: 2.0 in³ per 14 AWG, 2.25 per 12 AWG, 2.5 per 10 AWG, plus two allowances per device and one for the grounds.',
        requirements: [
            'Count each conductor that enters the box.',
            'One allowance for all grounds (or four if a device is on the ground).',
            'Two allowances per yoke or device.',
            'Add one allowance for internal clamps.'
        ],
        checkIds: ['box-fill']
    },
    {
        id: 'voltage-drop',
        category: 'conductor',
        title: 'Voltage drop',
        code: 'NEC 2021 §210.19(A) informational · §215.2(A)(1)',
        level: 'recommended',
        summary: 'Keep the branch-circuit drop under 3% and the total feeder plus branch drop under 5% at the calculated load.',
        requirements: [
            '3% maximum on a branch circuit.',
            '5% maximum feeder plus branch.',
            'Upsize the conductor, not the breaker, to fix a drop.',
            'Long runs to outbuildings are the usual culprits.'
        ],
        checkIds: ['feeder-vd', 'branch-vd']
    },

    // --- Branch circuits --------------------------------------------------
    {
        id: 'sabc',
        category: 'branch',
        title: 'Two small-appliance circuits',
        code: 'NEC 2021 §210.11(C)(1)',
        level: 'required',
        summary: 'A kitchen needs at least two 20 A small-appliance branch circuits for the counter receptacles, and they may not feed anything else.',
        requirements: [
            'Two 20 A circuits minimum for the kitchen counter.',
            'No lighting or other outlets on the small-appliance circuits.',
            'GFCI protection for the counter receptacles.',
            'Receptacles spaced so no point is over 24 in from one.'
        ],
        checkIds: ['sabc']
    },
    {
        id: 'laundry-bath',
        category: 'branch',
        title: 'Laundry and bathroom circuits',
        code: 'NEC 2021 §210.11(C)(2) · (C)(3)',
        level: 'required',
        summary: 'A laundry needs its own 20 A circuit, and a bathroom receptacle needs a 20 A branch circuit that serves only bathroom receptacles.',
        requirements: [
            'One 20 A laundry branch circuit.',
            'One 20 A bathroom circuit per bathroom, or one shared bathroom-only circuit.',
            'GFCI protection for the bathroom receptacles.',
            'No other outlets on the bathroom circuit.'
        ],
        checkIds: ['laundry', 'bathroom']
    },
    {
        id: 'lighting-outlets',
        category: 'branch',
        title: 'Lighting outlets',
        code: 'NEC 2021 §210.70',
        level: 'required',
        summary: 'Every habitable room, hallway, stairway, garage, outdoor entrance and basement needs a wall-switch-controlled lighting outlet.',
        requirements: [
            'Switched lighting in every habitable room and hallway.',
            'Stairways need a switch at each floor level.',
            'Outdoor entrances need a switched light.',
            'Garage and basement need a lighting outlet.'
        ],
        checkIds: ['lighting-outlets']
    },
    {
        id: 'receptacle-spacing',
        category: 'branch',
        title: 'Receptacle spacing',
        code: 'NEC 2021 §210.52',
        level: 'required',
        summary: 'In a dwelling, no point along a wall may be more than 6 ft from a receptacle, so receptacles are at most 12 ft apart; kitchen counters need one within 24 in of every point.',
        requirements: [
            '6 ft from any point on a wall to a receptacle.',
            '12 ft maximum between receptacles on the same wall.',
            'Kitchen counter: one within 24 in of any point.',
            'At least one receptacle per wall space wider than 2 ft.'
        ],
        checkIds: ['receptacle-spacing']
    },
    {
        id: 'outdoor-receptacle',
        category: 'branch',
        title: 'Outdoor receptacle',
        code: 'NEC 2021 §210.64',
        level: 'required',
        summary: 'A one- and two-family dwelling needs at least one outdoor receptacle at an accessible grade level, with a weatherproof in-use cover and GFCI protection.',
        requirements: [
            'One outdoor receptacle at grade level.',
            'GFCI protection and an in-use cover.',
            'Not more than 6 ft 6 in above grade.',
            'Keep it out of the pool zone unless it meets Article 680.'
        ],
        checkIds: ['outdoor-receptacle']
    },

    // --- Protection -------------------------------------------------------
    {
        id: 'gfci',
        category: 'protection',
        title: 'GFCI protection',
        code: 'NEC 2021 §210.8(A)',
        level: 'required',
        summary: 'GFCI protection is required for dwelling receptacles in bathrooms, kitchens, garages, outdoors, crawl spaces, basements, laundry areas and within 6 ft of sinks.',
        requirements: [
            'Bathrooms, kitchens and laundry receptacles.',
            'Outdoors, garages, crawl spaces and unfinished basements.',
            'Within 6 ft of a sink or a wet bar.',
            'GFCI protection also for pool and spa equipment (Article 680).'
        ],
        checkIds: ['gfci']
    },
    {
        id: 'afci',
        category: 'protection',
        title: 'AFCI protection',
        code: 'NEC 2021 §210.12(A)',
        level: 'required',
        summary: 'Branch circuits supplying outlets in dwelling living areas, bedrooms, hallways, closets, kitchens and laundry need arc-fault protection.',
        requirements: [
            'AFCI on bedroom, living, hallway, closet and kitchen circuits.',
            'Combination AFCI where the code requires it.',
            'The device must be listed and installed per its instructions.',
            'Label the panel so the AFCI circuits are identifiable.'
        ],
        checkIds: ['afci']
    },

    // --- Grounding --------------------------------------------------------
    {
        id: 'grounding-electrode',
        category: 'grounding',
        title: 'Grounding electrode system',
        code: 'NEC 2021 §250.50 · §250.52 · §250.53',
        level: 'required',
        summary: 'All available grounding electrodes must be bonded into one grounding electrode system: a metal water pipe, a ground rod, a concrete-encased electrode and any other listed electrode.',
        requirements: [
            'Bond every available electrode together.',
            'A ground rod needs 25 ohms or a second rod.',
            'Supplement a metal water pipe with another electrode.',
            'The electrode conductor runs unspliced to the panel.'
        ],
        checkIds: ['gec', 'grounding-electrode']
    },
    {
        id: 'equipment-grounding',
        category: 'grounding',
        title: 'Equipment grounding conductors',
        code: 'NEC 2021 §250.122',
        level: 'required',
        summary: 'The equipment grounding conductor is sized from the overcurrent device: 14 AWG for 15 A, 12 for 20 A, 10 for 30–60 A, 8 for 100 A, 6 for 200 A, 4 for 300 A and 3 for 400 A.',
        requirements: [
            'Size from the breaker, not the load.',
            'Increase the EGC if the conductors are upsized for voltage drop.',
            'Bond every metal enclosure and raceway.',
            'Separate the grounded conductor from the ground after the service.'
        ],
        checkIds: ['egc']
    },
    {
        id: 'neutral',
        category: 'grounding',
        title: 'Neutral demand load',
        code: 'NEC 2021 §220.61',
        level: 'required',
        summary: 'The feeder neutral carries the maximum unbalanced load: 100% of the first 200 A of the line-to-neutral load and 70% of the remainder.',
        requirements: [
            'Compute the unbalanced load, not the total service load.',
            '100% up to 200 A, 70% above that.',
            'The neutral may not be smaller than the grounded service conductor.',
            'Keep the neutral isolated from ground after the service.'
        ],
        checkIds: ['neutral']
    },

    // --- Special loads ----------------------------------------------------
    {
        id: 'range-dryer',
        category: 'special',
        title: 'Range and dryer demand',
        code: 'NEC 2021 §220.54 · §220.55',
        level: 'required',
        summary: 'An electric range takes the Table 220.55 demand for its rating, and a dryer takes 5,000 VA or the nameplate, whichever is larger.',
        requirements: [
            'Use Table 220.55 for a single range.',
            'Dryer demand 5,000 VA minimum.',
            'A 40 A range circuit is usual for 8 kW.',
            'The neutral may be reduced for a range or dryer only where the code allows.'
        ],
        checkIds: ['range-circuit', 'dryer-circuit']
    },
    {
        id: 'motors',
        category: 'special',
        title: 'Motor loads',
        code: 'NEC 2021 §430.24 · §430.52',
        level: 'required',
        summary: 'Add 25% of the largest motor to the feeder load, and size the branch short-circuit protection from Table 430.52, which may be larger than the conductor ampacity.',
        requirements: [
            '125% of the largest motor for the feeder calculation.',
            'Branch protection from Table 430.52.',
            'Overload protection distinct from short-circuit protection.',
            'Disconnect within sight of the motor.'
        ],
        checkIds: ['motor-25']
    },
    {
        id: 'ev-charging',
        category: 'special',
        title: 'EV charging',
        code: 'NEC 2021 §625.41 · §625.42 · §625.54',
        level: 'required',
        summary: 'An EV branch circuit is sized at 125% of the charger’s maximum continuous current, needs GFCI protection, and the service calculation includes the charger at its full rating.',
        requirements: [
            '125% of the continuous charger current.',
            'GFCI protection for the receptacle or the charger.',
            'Include the load in the service calculation.',
            'Provide a disconnect where the charger is not in sight of the panel.'
        ],
        checkIds: ['ev-circuit']
    },
    {
        id: 'pool-equipment',
        category: 'special',
        title: 'Pool and spa equipment circuits',
        code: 'NEC 2021 §680.21 · §680.22 · §680.26',
        level: 'required',
        summary: 'Pool pump motors need GFCI protection, a disconnect within sight, and the equipotential bonding of Article 680.',
        requirements: [
            'GFCI protection for the pump branch circuit.',
            'A disconnecting means within sight of the pump.',
            'Bonding per 680.26, inspected before the deck.',
            'Receptacles 6–20 ft from the water.'
        ],
        checkIds: ['gfci', 'pool-circuit']
    },
    {
        id: 'subpanel',
        category: 'special',
        title: 'Feeder to a detached building',
        code: 'NEC 2021 §225.30 · §250.32',
        level: 'required',
        summary: 'A detached building takes one feeder, with a disconnecting means, a grounding electrode system and a separate ground bar at the remote panel.',
        requirements: [
            'One feeder per detached building.',
            'Disconnect at the remote building.',
            'Ground rod and grounding electrode conductor at the remote panel.',
            'Keep the neutral and ground separated in the subpanel.'
        ],
        checkIds: ['subpanel']
    },

    // --- Inspection -------------------------------------------------------
    {
        id: 'inspection',
        category: 'inspection',
        title: 'What the inspector needs',
        code: 'Plan review · inspection',
        level: 'required',
        summary: 'A load calculation, a panel schedule with the directory, the service and feeder conductor sizes, the grounding electrode detail and the AFCI/GFCI listing.',
        requirements: [
            'Article 220 load calculation with the method stated.',
            'Panel schedule and directory.',
            'Service, feeder and grounding conductor sizes.',
            'GFCI and AFCI circuit list.',
            'Grounding electrode system detail and the bond to the water pipe.'
        ],
        checkIds: ['inspection']
    }
];

export const GLOSSARY = [
    { term: 'Service', category: 'Service', short: 'The conductors and equipment that bring utility power to the building.', detail: 'The service rating must carry the Article 220 calculated load, and a dwelling service is at least 100 A.' },
    { term: 'Feeder', category: 'Service', short: 'The conductors between the service equipment and a panelboard or subpanel.', detail: 'Feeders are sized from the load they carry plus 25% of the largest motor, with voltage drop kept under 3%.' },
    { term: 'Branch circuit', category: 'Circuits', short: 'The final circuit from the breaker to the outlets.', detail: 'Branch conductors must carry the load and be protected by a breaker that does not exceed their ampacity.' },
    { term: 'Demand factor', category: 'Calculation', short: 'The share of a connected load the code assumes is on at once.', detail: '220.42 uses 100/35/25% tiers for lighting; 220.53 allows 75% of four or more appliances.' },
    { term: 'Connected load', category: 'Calculation', short: 'The sum of every load at its nameplate rating.', detail: 'Connected load is not the service size: the demand factors reduce it before the service is chosen.' },
    { term: 'Optional method', category: 'Calculation', short: 'The 220.82 dwelling calculation: 100% of the first 10 kVA plus 40% of the rest.', detail: 'Often smaller than the standard method for a house with gas appliances, larger for all-electric homes.' },
    { term: 'SABC', category: 'Circuits', short: 'Small-appliance branch circuit: the 20 A kitchen counter circuits.', detail: 'Two are required, they serve only counter receptacles, and they need GFCI protection.' },
    { term: 'AFCI', category: 'Protection', short: 'Arc-fault circuit interrupter: trips on a dangerous series or parallel arc.', detail: 'Required in dwelling living areas, bedrooms, hallways, closets, kitchens and laundry.' },
    { term: 'GFCI', category: 'Protection', short: 'Ground-fault circuit interrupter: trips when current leaks to earth.', detail: 'Required in bathrooms, kitchens, garages, outdoors, basements and near sinks.' },
    { term: 'Working space', category: 'Service', short: 'The clear zone in front of electrical equipment.', detail: '30 in wide, 36 in deep and 6 ft 6 in high, kept clear of storage and piping (110.26).' },
    { term: 'GEC', category: 'Grounding', short: 'Grounding electrode conductor: the conductor to the earth electrode.', detail: 'Sized from Table 250.66 by the service conductor, run unspliced to the electrode.' },
    { term: 'EGC', category: 'Grounding', short: 'Equipment grounding conductor: the safety ground to every enclosure.', detail: 'Sized from Table 250.122 by the overcurrent device, not by the load.' },
    { term: 'Grounded conductor', category: 'Grounding', short: 'The neutral, which carries the unbalanced current.', detail: 'Bonded to ground only at the service; separated at every subpanel.' },
    { term: 'Bonding', category: 'Grounding', short: 'Connecting metal parts so they stay at the same voltage.', detail: 'Bonding jumpers at the water pipe, gas pipe and structural steel, plus the pool bonding grid.' },
    { term: 'Ampacity', category: 'Conductors', short: 'The current a conductor can carry continuously without damage.', detail: 'Table 310.16 gives the value, then ambient and conductor-count adjustments apply.' },
    { term: 'NM-B', category: 'Conductors', short: 'Non-metallic sheathed cable, the usual residential wiring method.', detail: '334.80 limits NM-B to the 60 °C ampacity column even where the terminals are 75 °C.' },
    { term: 'Raceway fill', category: 'Conductors', short: 'The share of a conduit’s area taken by conductors.', detail: '40% for three or more conductors, 31% for two and 53% for one (Chapter 9).' },
    { term: 'Box fill', category: 'Conductors', short: 'The volume allowance a box needs for its conductors and devices.', detail: '2.25 in³ per 12 AWG conductor, plus two allowances per device and one for the grounds.' },
    { term: 'Voltage drop', category: 'Conductors', short: 'The voltage lost along a conductor at load.', detail: 'Keep the branch under 3% and the total under 5%; fix it by upsizing the conductor.' },
    { term: 'Main breaker', category: 'Service', short: 'The service disconnecting means that kills the whole panel.', detail: 'Its rating must not exceed the panel bus rating or the service conductor ampacity.' },
    { term: 'Panel schedule', category: 'Service', short: 'The circuit-by-circuit list on the panel door.', detail: 'Every space is numbered; the directory names the room or load each breaker serves.' },
    { term: 'Load calculation', category: 'Calculation', short: 'The Article 220 arithmetic that sizes the service.', detail: 'Lighting, small appliance, laundry, appliances, heating or cooling, and 25% of the largest motor.' },
    { term: 'Continuous load', category: 'Calculation', short: 'A load that runs three hours or more.', detail: 'Continuous loads take 125% for conductor and breaker sizing (210.19, 210.20).' },
    { term: 'Service lateral', category: 'Service', short: 'The underground service conductors from the utility.', detail: 'Uses PVC or direct-burial cable with the utility’s minimum cover, often 18–24 in.' }
];

export const FORMULAS = [
    { label: 'Lighting load', expression: '3 VA/sq ft × area', note: '33 VA/m² for a dwelling (220.12).' },
    { label: 'General demand', expression: '100% of 3 kVA + 35% of next 117 kVA + 25% above', note: '220.42 tiers.' },
    { label: 'Appliance demand', expression: '75% of four or more appliance loads', note: '220.53, before the 220.60 noncoincident rule.' },
    { label: 'Heating / cooling', expression: 'max(heat, cool)', note: '220.60: only the larger is taken.' },
    { label: 'Service amps', expression: 'VA ÷ 240', note: 'Single-phase 120/240 V service.' },
    { label: 'Optional method', expression: '10 kVA + 40% of the remainder', note: '220.82(B) for a dwelling.' },
    { label: 'Neutral', expression: '100% to 200 A + 70% of the remainder', note: '220.61 maximum unbalanced load.' },
    { label: 'Voltage drop', expression: '2 × L × I × R ÷ 1000', note: 'Single phase; R from Chapter 9 Table 8, ohms per 1,000 ft.' },
    { label: 'Conduit fill', expression: 'Σ conductor area ÷ raceway area ≤ 0.40', note: 'Chapter 9 Table 1 for three or more conductors.' },
    { label: 'Box fill', expression: 'Σ conductor allowances ≤ box volume', note: '314.16(B), cubic inches.' }
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
        rule.title, rule.code, rule.summary,
        ...(rule.requirements || [])
    ].join(' ').toLowerCase().includes(term));
}

export function ruleStatus(rule, checks = []) {
    if (!rule.checkIds?.length) return { state: 'info', label: 'Review' };
    const related = checks.filter((check) => rule.checkIds.includes(check.id));
    if (!related.length) return { state: 'info', label: 'Not modelled' };
    if (related.some((check) => check.severity === 'error')) return { state: 'error', label: 'Fix' };
    if (related.some((check) => check.severity === 'warning')) return { state: 'warn', label: 'Review' };
    return { state: 'ok', label: 'Pass' };
}

export const RULE_LEVEL_LABEL = {
    required: 'Required',
    recommended: 'Recommended',
    energy: 'Energy code'
};
