/**
 * Rules and regulations for the landscape and water-feature suite.
 *
 * The model code is the 2021 International Swimming Pool and Spa Code (ISPSC),
 * 2021 IRC Appendix G, the Virginia Graeme Baker Pool and Spa Safety Act
 * (VGB), NFPA 70 (NEC) Article 680 and the 2010 ADA Standards. Local zoning,
 * the health department and the authority having jurisdiction always win.
 *
 * The same rule register is published as landrules.csv (one row per rule) and
 * explained for designers in landrules.md.
 */

export const RULE_CATEGORIES = [
    { id: 'safety', label: 'Barrier & safety' },
    { id: 'geometry', label: 'Geometry & entry' },
    { id: 'circulation', label: 'Circulation & filtration' },
    { id: 'water', label: 'Water quality' },
    { id: 'electric', label: 'Electrical & bonding' },
    { id: 'siting', label: 'Siting & drainage' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'inspection', label: 'Inspection & handover' }
];

export const CODE_SCOPE = {
    title: 'ISPSC 2021 · IRC 2021 Appendix G · NEC 2021 Article 680 · VGB Act',
    url: 'https://codes.iccsafe.org/content/ISPSC2021P1',
    body: 'Residential pools, spas, fountains, ponds, waterfalls and water walls follow the 2021 ISPSC, mirrored for one- and two-family dwellings by IRC Appendix G. The VGB Act and CPSC 16 CFR 1450 govern anti-entrapment. NEC Article 680 covers bonding, receptacles, overhead clearances and pool luminaires, and the 2010 ADA Standards govern public pool entry. This is a design aid: confirm the edition and amendments adopted in your jurisdiction, and have the final plan reviewed by a licensed pool engineer and the local building department.'
};

export const RULES = [
    // --- Barrier & safety -------------------------------------------------
    {
        id: 'barrier-height',
        category: 'safety',
        title: 'A 48 in barrier around every pool and spa',
        code: 'ISPSC 2021 §305.2',
        level: 'required',
        summary: 'An outdoor pool or spa must be enclosed by a barrier at least 48 in (1219 mm) high, measured on the outside, with no opening that passes a 4 in (102 mm) sphere.',
        requirements: [
            'Measure 48 in above the finished grade on the side away from the pool.',
            'No opening in the barrier may allow a 4 in sphere to pass.',
            'The barrier must have no footholds or handholds that make it climbable.',
            'A dwelling wall may form part of the barrier only where its doors and operable windows are protected.',
            'Above-ground pools may use a lockable ladder or a safety cover in place of a full barrier where the code allows it.'
        ],
        checkIds: ['barrier']
    },
    {
        id: 'barrier-gate',
        category: 'safety',
        title: 'Self-closing, self-latching gates',
        code: 'ISPSC 2021 §305.3',
        level: 'required',
        summary: 'A gate through the barrier must open away from the pool, close and latch itself, and have its release at least 54 in (1372 mm) above grade.',
        requirements: [
            'The gate swings outward, away from the water.',
            'The latch release is at least 54 in above grade on the pool side.',
            'A gate that cannot be made self-latching needs an alarm or a listed safety device.',
            'Keep the latch lubricated and the spring tension set so a child cannot defeat it.'
        ],
        checkIds: ['gate', 'latch']
    },
    {
        id: 'barrier-door',
        category: 'safety',
        title: 'Doors and windows that open into the pool area',
        code: 'ISPSC 2021 §305.4',
        level: 'required',
        summary: 'A door with direct access to the pool area needs an alarm or a self-latching device at least 54 in above the floor, and an operable window needs a limitation or alarm.',
        requirements: [
            'An audible alarm must sound on the pool side when the door opens.',
            'A self-latching device must release at 54 in or higher.',
            'A window that opens into the pool area must be limited to 4 in or alarmed.',
            'Do not rely on a sliding door lock alone as the barrier.'
        ],
        checkIds: []
    },
    {
        id: 'barrier-cover',
        category: 'safety',
        title: 'Safety covers and alarms',
        code: 'ASTM F1346 · ISPSC 2021 §305.5',
        level: 'recommended',
        summary: 'A powered or manual safety cover must meet ASTM F1346 and support a 485 lb load; a pool alarm is a supplement, never a substitute for the barrier.',
        requirements: [
            'Use a cover listed to ASTM F1346 for the pool shape and size.',
            'A cover is not a walking surface; keep the barrier in place.',
            'A surface or underwater alarm is a secondary layer of protection.',
            'Inspect anchors and the cover pump each season.'
        ],
        checkIds: ['cover']
    },
    {
        id: 'spa-safety',
        category: 'safety',
        title: 'Spa temperature, shut-off and signage',
        code: 'ISPSC 2021 §307.4 · §609.4 · §609.5',
        level: 'required',
        summary: 'Spa water may not exceed 104 °F (40 °C), an emergency shut-off must be within 5 ft of the spa, and the safety signage must be posted.',
        requirements: [
            'Set the high limit at 104 °F and lock the setpoint.',
            'Provide a clearly marked emergency shut-off within 5 ft of the water.',
            'Post "No lifeguard", "Do not use alone", temperature and pregnancy warnings.',
            'Limit air-blower timers to 15 minutes.'
        ],
        checkIds: ['spa-temp', 'spa-shutoff', 'spa-signage']
    },

    // --- Geometry & entry -------------------------------------------------
    {
        id: 'pool-depth',
        category: 'geometry',
        title: 'Pool depth and the diving envelope',
        code: 'ISPSC 2021 §306.2 · §304',
        level: 'required',
        summary: 'A residential pool is at least 3 ft (914 mm) deep at the shallow end and no more than 8 ft (2438 mm) without an engineered design. A diving board needs the ISPSC diving envelope, typically 7 ft 6 in to 9 ft of water.',
        requirements: [
            'Shallow end: 3 ft minimum water depth.',
            'Deep end: 8 ft maximum without a stamped engineering design.',
            'Diving: use the ISPSC envelope; do not infer it from depth alone.',
            'Keep the transition and shallow slopes within the code so the floor reads clearly under water.'
        ],
        checkIds: ['depth', 'depth-max', 'diving']
    },
    {
        id: 'pool-slope',
        category: 'geometry',
        title: 'Floor slopes',
        code: 'ISPSC 2021 §306.3',
        level: 'required',
        summary: 'The shallow-end floor may not be steeper than 1:3, and the transition to deep water no steeper than 1:1 with a cove at the break.',
        requirements: [
            'Shallow end: maximum 1:3 slope.',
            'Transition: maximum 1:1 slope.',
            'Provide a cove or rounded break at the slope change.',
            'Keep the main drain and suction fittings clear of the slope break.'
        ],
        checkIds: ['slope']
    },
    {
        id: 'pool-entry',
        category: 'geometry',
        title: 'Steps, ladders and entry',
        code: 'ISPSC 2021 §306.4 · §306.5',
        level: 'required',
        summary: 'Every pool needs a means of entry at the shallow end, and a pool longer than 30 ft needs two means of entry.',
        requirements: [
            'Provide steps, a ladder or a sloped entry at the shallow end.',
            'Two means of entry for a pool over 30 ft long.',
            'Handrails must be securely anchored and slip resistant.',
            'Keep the entry clear of the barrier gate swing.'
        ],
        checkIds: []
    },
    {
        id: 'pool-deck',
        category: 'geometry',
        title: 'A 4 ft deck around the water',
        code: 'ISPSC 2021 §306.1 · IRC 2021 R401.3',
        level: 'required',
        summary: 'Provide an unobstructed deck at least 4 ft (1.22 m) wide around the pool, sloping about ¼ in per foot away from the water and the building.',
        requirements: [
            '4 ft minimum clear deck width on the pool perimeter.',
            'Slope ¼ in per foot (about 2%) away from the pool and building.',
            'A slip-resistant, drained walking surface.',
            'Keep the deck clear of furniture, planters and equipment at inspection.'
        ],
        checkIds: ['deck-width', 'deck-slope', 'site-drainage']
    },
    {
        id: 'pool-coping',
        category: 'geometry',
        title: 'Coping and the water edge',
        code: 'ISPSC 2021 §306.1 · good practice',
        level: 'recommended',
        summary: 'Use a rounded or bullnose coping with a 1–2 in overhang, slip resistant and securely bedded, so the edge is visible and comfortable to grip.',
        requirements: [
            'Bullnose or eased edge, 1–2 in overhang.',
            'Slip-resistant finish when wet.',
            'Bed the coping so it cannot rock or trap water.',
            'Keep the expansion joint between coping and deck.'
        ],
        checkIds: []
    },

    // --- Circulation & filtration -----------------------------------------
    {
        id: 'turnover',
        category: 'circulation',
        title: 'Turnover: 6 h pool, 30 min spa, 1 h feature',
        code: 'ISPSC 2021 §326.2 · §327',
        level: 'required',
        summary: 'Residential pool turnover is 6 hours (8 hours maximum), spa turnover 30 minutes, and a fountain or water feature about 1 hour.',
        requirements: [
            'Turnover hours = gallons ÷ (flow gpm × 60).',
            'Public pools generally need 4–6 hour turnover under the health code.',
            'A spa needs 30 minutes or faster; a fountain 1 hour.',
            'Slow turnover leaves dead spots; fast turnover wastes energy.'
        ],
        checkIds: ['turnover', 'spa-turnover', 'filtration']
    },
    {
        id: 'suction',
        category: 'circulation',
        title: 'Two suction outlets and VGB covers',
        code: 'VGB Act · CPSC 16 CFR 1450 · ISPSC 2021 §310',
        level: 'required',
        summary: 'Every pump needs at least two suction outlets at least 3 ft apart with VGB-listed anti-entrapment covers, or an equally protective system such as an SVRS.',
        requirements: [
            'Two outlets, hydraulically balanced, centre to centre at least 3 ft apart.',
            'VGB-listed cover on every suction outlet, matched to the pump flow.',
            'No single-blockable outlet; where duplication is impossible use an SVRS or vent.',
            'Keep the cover face velocity at or below 1.5 ft/s.'
        ],
        checkIds: ['suction', 'drain-velocity']
    },
    {
        id: 'filtration',
        category: 'circulation',
        title: 'Filter and pump sizing',
        code: 'ISPSC 2021 §326 · manufacturer curves',
        level: 'required',
        summary: 'Size the filter from the design flow: about 15 gpm/sq ft for sand, 2 gpm/sq ft for DE and 0.25 gpm/sq ft for cartridge. Size the pump from the flow and total dynamic head, not horsepower alone.',
        requirements: [
            'Design flow = gallons ÷ (turnover hours × 60).',
            'Filter media rate: sand 15, DE 2, cartridge 0.25 gpm/sq ft.',
            'Pump power ≈ gpm × head (ft) ÷ (3960 × efficiency).',
            'Select the pump at the middle of its curve, never at shut-off.',
            'Provide a pressure gauge, air relief and a union on the filter.'
        ],
        checkIds: ['filter']
    },
    {
        id: 'skimmers',
        category: 'circulation',
        title: 'Skimmers and surface return',
        code: 'ISPSC 2021 §327 · good practice',
        level: 'recommended',
        summary: 'Plan one skimmer per 400–500 sq ft of surface, on the prevailing wind side, and keep the skimmer flow within its rating.',
        requirements: [
            'One skimmer per 400–500 sq ft, minimum one.',
            'Place on the windward side so debris crosses the pool.',
            'A skimmer is usually rated for 30–50 gpm; do not exceed it.',
            'Provide a equaliser line or a second outlet for safety.'
        ],
        checkIds: ['skimmers']
    },
    {
        id: 'bather-load',
        category: 'circulation',
        title: 'Bather load',
        code: 'ISPSC 2021 §421 · health department',
        level: 'recommended',
        summary: 'Allow 15 sq ft of water surface per bather in water under 5 ft deep and 20 sq ft in deeper water.',
        requirements: [
            'Area per bather: 15 sq ft shallow, 20 sq ft deep.',
            'Post the bather load at a public pool.',
            'Do not count the deck or the wading area twice.',
            'A spa has its own occupancy rule in the health code.'
        ],
        checkIds: []
    },
    {
        id: 'weir',
        category: 'circulation',
        title: 'Waterfall and water-wall weir flow',
        code: 'Sharp-crested weir · manufacturer',
        level: 'recommended',
        summary: 'Design the spill with Q = 3.33 × L × H^1.5 (cfs, ft), keep the lip level within 1/8 in and allow 1–2 gpm per inch of width.',
        requirements: [
            'Size the pump for the weir flow plus the filtration flow.',
            'Keep the lip level within 1/8 in across the spill.',
            'Provide a basin sized for the splash and wind drift.',
            'Use a variable-speed pump and a bypass for a low, quiet sheet.'
        ],
        checkIds: ['weir', 'basin']
    },
    {
        id: 'pond',
        category: 'circulation',
        title: 'Ponds: depth, liner and aeration',
        code: 'ISPSC 2021 Appendix · manufacturer',
        level: 'recommended',
        summary: 'An ornamental pond at least 24 in deep for fish needs a 45 mil EPDM liner or clay seal, aeration, and 1:3 banks with coping.',
        requirements: [
            '24 in minimum depth for fish; deeper is better for temperature stability.',
            '45 mil EPDM or a bentonite/clay seal.',
            'Aeration or a pump for ponds over 18 in deep.',
            'Slope the banks 1:3 and cope the edge to prevent slumping.',
            'Provide safe access and a barrier where the pond is over 24 in deep and near a dwelling.'
        ],
        checkIds: ['pond-depth', 'aeration', 'liner']
    },

    // --- Water quality ----------------------------------------------------
    {
        id: 'water-balance',
        category: 'water',
        title: 'Water balance targets',
        code: 'ANSI/APSP/ICC-11 · Table 1',
        level: 'required',
        summary: 'Keep pH 7.2–7.8, free chlorine 1–3 ppm (spa 3–5 ppm), total alkalinity 80–120 ppm, cyanuric acid 30–50 ppm and calcium hardness 200–400 ppm.',
        requirements: [
            'pH 7.2–7.8; correct with acid or soda ash, never both at once.',
            'Free chlorine 1–3 ppm; combined chlorine ≤ 0.5 ppm.',
            'Total alkalinity 80–120 ppm; raise with bicarbonate.',
            'CYA 30–50 ppm; above 100 ppm dilute the pool.',
            'Calcium hardness 200–400 ppm; balance with LSI.'
        ],
        checkIds: ['chemistry-ph', 'chemistry-chlorine', 'chemistry-alkalinity', 'chemistry-cya', 'chemistry-calcium']
    },
    {
        id: 'fountain-basin',
        category: 'water',
        title: 'Fountain and water-wall basins',
        code: 'ISPSC 2021 Chapter 7 · manufacturer',
        level: 'required',
        summary: 'A fountain basin needs at least 6 in of water over the intake; a water-wall basin at least 6 in deep with an autofill, overflow and accessible pump.',
        requirements: [
            '6 in minimum water depth over the intake.',
            'Autofill and overflow on every decorative feature.',
            'Contain splash and wind drift inside the basin or a drained deck.',
            'Provide a pump sump and a service access.'
        ],
        checkIds: ['basin']
    },
    {
        id: 'spa-water',
        category: 'water',
        title: 'Spa water and turnover',
        code: 'ISPSC 2021 §307 · ANSI/APSP/ICC-11',
        level: 'required',
        summary: 'Spa water is limited to 104 °F, should turn over in 30 minutes, and needs two VGB-protected suction outlets and a marked emergency shut-off.',
        requirements: [
            'Maximum 104 °F with a locked high limit.',
            '30 minute turnover; separate jet pump where needed.',
            'Two suction outlets or an SVRS; no single-blockable drain.',
            'Shock and drain per the bather load, not a calendar.'
        ],
        checkIds: ['spa-temp', 'spa-turnover', 'spa-depth', 'suction']
    },

    // --- Electrical & bonding ---------------------------------------------
    {
        id: 'bonding',
        category: 'electric',
        title: 'Equipotential bonding',
        code: 'NEC 2021 §680.26',
        level: 'required',
        summary: 'Bond the pool shell, reinforcing steel, coping, deck, metal fittings, pumps, ladders, rails and water with a #8 AWG copper conductor and listed clamps.',
        requirements: [
            '#8 AWG solid copper bonding conductor.',
            'Bond within 18–24 in of the water edge on four sides.',
            'Bond metal fittings, ladders, rails, pump motors and the water.',
            'Do not rely on the equipment grounding conductor as the bonding conductor.',
            'Inspect the bonding before the deck is poured.'
        ],
        checkIds: ['bonding']
    },
    {
        id: 'gfci',
        category: 'electric',
        title: 'GFCI protection for pool equipment',
        code: 'NEC 2021 §680.21 · §680.22 · §680.23',
        level: 'required',
        summary: 'Pool pump motors, underwater luminaires, receptacles and all 125–250 V pool equipment need GFCI protection.',
        requirements: [
            'GFCI protection for the pump circuit and all pool-related receptacles.',
            'Underwater luminaires: 12 V or GFCI protected and listed for pool use.',
            'A disconnecting means within sight of the pump.',
            'Keep the bond and the ground separate and correctly terminated.'
        ],
        checkIds: ['gfci', 'luminaire']
    },
    {
        id: 'overhead',
        category: 'electric',
        title: 'Overhead conductor clearance',
        code: 'NEC 2021 §680.8',
        level: 'required',
        summary: 'Keep overhead conductors at least 25 ft horizontally from the pool edge up to 750 V, and 27 ft for 750 V–15 kV, unless the conductors are in a raceway or otherwise permitted.',
        requirements: [
            '25 ft minimum horizontal clearance from the water edge.',
            '27 ft for 750 V to 15 kV.',
            'Measure horizontally from the water edge, not the deck.',
            'Have the utility confirm the clearance before layout.'
        ],
        checkIds: ['overhead']
    },
    {
        id: 'receptacles',
        category: 'electric',
        title: 'Pool receptacles',
        code: 'NEC 2021 §680.22(A)',
        level: 'required',
        summary: 'Provide at least one receptacle within 20 ft of the pool edge, at least 6 ft from the water, GFCI protected and with an in-use cover.',
        requirements: [
            '6 ft minimum from the water edge.',
            '20 ft maximum from the water edge.',
            'GFCI protection and a weather-resistant, in-use cover.',
            'No receptacle in the pool or spa zone.'
        ],
        checkIds: ['receptacle']
    },
    {
        id: 'pool-luminaire',
        category: 'electric',
        title: 'Pool and spa luminaires',
        code: 'NEC 2021 §680.23 · §680.24',
        level: 'required',
        summary: 'A luminaire in or on the pool wall must be listed for pool use, be 12 V or GFCI protected, and have a listed junction box or transformer at the required distance.',
        requirements: [
            'Listed for pool or spa use; no wet-location household fixture.',
            '12 V or GFCI protected as the code allows.',
            'Forming shell and niche bonded and grounded.',
            'Keep the deck box at least 4 ft from the water unless listed otherwise.'
        ],
        checkIds: ['luminaire']
    },

    // --- Siting & drainage ------------------------------------------------
    {
        id: 'setbacks',
        category: 'siting',
        title: 'Property-line and easement setbacks',
        code: 'Local zoning · AHJ',
        level: 'required',
        summary: 'Pools, equipment pads and decks must respect local side, rear and front setbacks and any utility easement; typical residential setbacks are 5–10 ft.',
        requirements: [
            'Confirm the zoning setback for the pool shell, deck and equipment.',
            'Keep the equipment pad out of the easement and accessible for service.',
            'Respect the impervious-cover limit for the lot.',
            'Check the floodplain and the stormwater requirement.'
        ],
        checkIds: ['setback']
    },
    {
        id: 'drainage',
        category: 'siting',
        title: 'Deck drainage and site grading',
        code: 'IRC 2021 R401.3 · good practice',
        level: 'required',
        summary: 'Slope the deck about ¼ in per foot away from the pool and building, drain splash and overflow, and keep the finished grade falling away from the pool.',
        requirements: [
            'Deck slope about 2% away from the water and building.',
            'Provide a deck drain or a French drain at the low side.',
            'Do not drain the pool to the storm sewer without a permit.',
            'Keep the site grade falling away from the pool and the house.'
        ],
        checkIds: ['deck-slope', 'site-drainage']
    },
    {
        id: 'freeze',
        category: 'siting',
        title: 'Freeze protection and winterising',
        code: 'Manufacturer · good practice',
        level: 'recommended',
        summary: 'In a freeze climate, plan for draining or blowing out exterior lines, a freeze-protected equipment pad, and a cover.',
        requirements: [
            'Winterise or keep the pump running through frost.',
            'Blow out the lines and drain the filter and heater.',
            'Use a freeze sensor and a low-temperature lockout.',
            'Cover the water to keep debris and ice loads down.'
        ],
        checkIds: ['freeze', 'cover']
    },
    {
        id: 'equipment-access',
        category: 'siting',
        title: 'Equipment pad and service access',
        code: 'Manufacturer · NEC 2021 §110.26',
        level: 'required',
        summary: 'Provide a level pad with 30 in of clear working space at the panel and at least 3 ft in front of pumps and filters, plus a disconnect within sight.',
        requirements: [
            'Level, drained pad sized for the pump, filter, heater and blower.',
            'At least 3 ft clear in front of serviceable equipment.',
            'Working clearance at the electrical panel per NEC 110.26.',
            'Keep the pad out of the barrier gate swing and off the deck slope.'
        ],
        checkIds: ['equipment-access']
    },

    // --- Accessibility ----------------------------------------------------
    {
        id: 'ada-entry',
        category: 'accessibility',
        title: 'Accessible pool entry',
        code: 'ADA 2010 Standards §242 · §1009',
        level: 'required',
        summary: 'A public or commercial pool needs at least one accessible means of entry, typically a lift or a sloped entry, and an accessible route to it.',
        requirements: [
            'A pool lift or a sloped entry at a public pool.',
            'A spas needs a lift where the ADA applies.',
            'An accessible route from the parking and the dressing rooms.',
            'Keep the lift clear of the deck slope and the barrier gate.'
        ],
        checkIds: ['accessible']
    },

    // --- Inspection & handover --------------------------------------------
    {
        id: 'inspection',
        category: 'inspection',
        title: 'What the inspector and handover pack need',
        code: 'Plan review · start-up',
        level: 'required',
        summary: 'A dimensioned plan, the hydraulic and equipment schedule, the barrier detail, bonding evidence and the water-balance start-up sheet.',
        requirements: [
            'Dimensioned site plan with the barrier, gate, deck, equipment and setbacks.',
            'Equipment schedule with model, flow, head and electrical data.',
            'Bonding inspection before the deck pour.',
            'Barrier and gate test; VGB cover documentation.',
            'Water-balance start-up and a signed handover with the homeowner.'
        ],
        checkIds: ['setback', 'bonding', 'barrier']
    }
];

export const GLOSSARY = [
    { term: 'Turnover', category: 'Hydraulics', short: 'The time for the pump to move one full pool volume through the filter.', detail: 'A 20,000 gal pool at 6 h turnover needs 55.6 gpm. Turnover is a design target, not a guarantee of every drop filtering.' },
    { term: 'GPM', category: 'Hydraulics', short: 'US gallons per minute: the flow the pump and filter are rated for.', detail: '1 gpm = 0.0631 L/s = 3.785 L/min. Convert m³/h to gpm by multiplying by 4.403.' },
    { term: 'TDH', category: 'Hydraulics', short: 'Total dynamic head: the resistance the pump must overcome, in feet of water.', detail: 'TDH includes suction lift, pipe friction, fittings, filter, heater and the return jets. It is not the same as the static depth.' },
    { term: 'Flow rate', category: 'Hydraulics', short: 'Gallons per minute required for the chosen turnover.', detail: 'gallons ÷ (turnover hours × 60). Use the actual water volume, not the shell dimensions.' },
    { term: 'Filter media rate', category: 'Hydraulics', short: 'The flow each square foot of filter media can handle.', detail: 'Sand 15 gpm/sq ft, DE 2 gpm/sq ft, cartridge 0.25 gpm/sq ft. Higher rates mean finer media or more cleaning.' },
    { term: 'Skimmer', category: 'Equipment', short: 'A surface intake that pulls floating debris into a basket before the pump.', detail: 'One per 400–500 sq ft, on the windward side. A skimmer is usually rated 30–50 gpm.' },
    { term: 'Main drain', category: 'Equipment', short: 'The suction outlet at the deepest point, now usually a pair of VGB-listed covers.', detail: 'A single drain is a serious entrapment hazard. Two outlets 3 ft apart split the suction.' },
    { term: 'VGB Act', category: 'Safety', short: 'The Virginia Graeme Baker Pool and Spa Safety Act: federal anti-entrapment law.', detail: 'It requires VGB-listed drain covers, two suction outlets or an SVRS on public pools, and signage.' },
    { term: 'SVRS', category: 'Safety', short: 'Safety vacuum release system: it releases suction when a blockage is detected.', detail: 'Used where two outlets are not possible. It must be listed and tested, not improvised.' },
    { term: 'Entrapment', category: 'Safety', short: 'Holding a person against an outlet by suction.', detail: 'Hair, limb, body, evisceration and mechanical entrapment are distinct hazards. The barrier and the suction design address different risks.' },
    { term: 'Barrier', category: 'Safety', short: 'The fence, wall or enclosure that keeps a child away from the water when unsupervised.', detail: '48 in high, no 4 in sphere passage, not climbable, with a self-closing gate.' },
    { term: 'Bather load', category: 'Safety', short: 'The number of people the water surface is designed to hold.', detail: '15 sq ft per bather in shallow water, 20 sq ft in deep water; the health department may set a lower number.' },
    { term: 'Coping', category: 'Structure', short: 'The cap around the water edge, usually stone or concrete.', detail: 'A bullnose coping with a 1–2 in overhang is comfortable to grip and protects the shell edge.' },
    { term: 'Gunite', category: 'Structure', short: 'Sprayed concrete shell, the usual in-ground pool structure.', detail: 'Gunite is pneumatically applied and then plastered or tiled. Shotcrete is a similar wet-mix process.' },
    { term: 'Deck', category: 'Structure', short: 'The paved surround between the water and the garden.', detail: 'A 4 ft clear width, sloped about 2% away from the pool, with a slip-resistant finish.' },
    { term: 'Weir', category: 'Water feature', short: 'The level lip over which a waterfall or water wall spills.', detail: 'Sharp-crested weir flow Q = 3.33 × L × H^1.5 in cfs with L and H in feet.' },
    { term: 'Autofill', category: 'Equipment', short: 'A float valve that keeps a fountain or pool at its design level.', detail: 'Pair it with an overflow and a backflow preventer. A stuck autofill can flood a basin.' },
    { term: 'Free chlorine', category: 'Water quality', short: 'The active sanitiser measured in ppm.', detail: '1–3 ppm in a pool, 3–5 ppm in a spa. Combined chlorine above 0.5 ppm means shock the water.' },
    { term: 'CYA', category: 'Water quality', short: 'Cyanuric acid, the stabiliser that slows chlorine loss to sunlight.', detail: '30–50 ppm. Above 100 ppm chlorine is largely locked and the pool needs dilution.' },
    { term: 'Total alkalinity', category: 'Water quality', short: 'The water’s resistance to pH change, in ppm.', detail: '80–120 ppm. Low alkalinity lets pH swing; high alkalinity makes it hard to lower pH.' },
    { term: 'Calcium hardness', category: 'Water quality', short: 'Dissolved calcium, which protects plaster from dissolving.', detail: '200–400 ppm. Too low attacks the plaster; too high scales the tile and heater.' },
    { term: 'LSI', category: 'Water quality', short: 'Langelier Saturation Index: a combined score for scaling or corrosion.', detail: 'Keep it near zero. pH, temperature, calcium and alkalinity all move the index.' },
    { term: 'GFCI', category: 'Electrical', short: 'Ground-fault circuit interrupter: cuts power when current leaks to earth.', detail: 'Required for pool pump motors, underwater lights and pool receptacles.' },
    { term: 'Equipotential bonding', category: 'Electrical', short: 'Connecting all metal and water in the pool zone to one conductor.', detail: 'A #8 copper grid keeps every surface at the same voltage, preventing a shock across the water.' },
    { term: 'NEC Article 680', category: 'Electrical', short: 'The National Electrical Code article for pools, fountains and similar installations.', detail: 'Covers overhead clearance, receptacles, bonding, luminaires and pump disconnects.' },
    { term: 'ISPSC', category: 'Code', short: 'International Swimming Pool and Spa Code, the model pool code.', detail: 'Chapter 3 covers barriers, decks, depth and slopes; Chapter 10 covers suction entrapment.' },
    { term: 'IRC Appendix G', category: 'Code', short: 'The residential pool and spa appendix of the International Residential Code.', detail: 'Mirrors the ISPSC for one- and two-family dwellings and is adopted by many jurisdictions.' },
    { term: 'ADA', category: 'Accessibility', short: 'Americans with Disabilities Act Standards for accessible design.', detail: 'Sections 242 and 1009 cover accessible pool entry, lifts, sloped entries and routes.' },
    { term: 'Impervious cover', category: 'Siting', short: 'The share of the lot covered by buildings, deck and paving.', detail: 'Zoning caps it to limit stormwater runoff. A pool counts in many jurisdictions.' },
    { term: 'Setback', category: 'Siting', short: 'The minimum distance from the property line or easement.', detail: 'Typical residential pools need 5–10 ft, but the plat, zoning and utility easements govern.' }
];

export const FORMULAS = [
    { label: 'Surface area', expression: 'rectangle w × l · circular πr² · kidney 0.82 × w × l', note: 'Roman and lap pools use the drawn outline.' },
    { label: 'Volume', expression: 'area × average depth', note: 'Pool average depth is the mean of shallow and deep.' },
    { label: 'Gallons', expression: 'm³ × 264.172', note: 'US gallons. Imperial gallons differ.' },
    { label: 'Turnover flow', expression: 'gallons ÷ (turnover hours × 60)', note: 'The design flow for the pump and filter.' },
    { label: 'Pump power', expression: 'gpm × head (ft) ÷ (3960 × efficiency)', note: 'Efficiency is typically 0.65–0.75 for a residential pump.' },
    { label: 'Filter area', expression: 'flow gpm ÷ media rate', note: 'Sand 15, DE 2, cartridge 0.25 gpm/sq ft.' },
    { label: 'Weir flow', expression: '3.33 × L (ft) × H (ft)^1.5 × 448.831', note: 'Sharp-crested weir in US gpm.' },
    { label: 'Bather load', expression: 'surface area ÷ 15 sq ft shallow · 20 sq ft deep', note: 'Round down; post at a public pool.' },
    { label: 'Heater output', expression: 'gallons × 8.34 × ΔT ÷ hours', note: 'BTU/h for a chosen temperature rise and heat-up time.' }
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
