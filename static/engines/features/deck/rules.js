/**
 * Rules and regulations for the deck and framing suite.
 *
 * The model code is the 2021 International Residential Code: §R507 for decks,
 * §R312 for guards, §R311.7 for stairways, §R401.4 and §R403.1 for soil and
 * footings, and §R301 for the live and dead loads. Structural capacities come
 * from the AWC National Design Specification; decking and rail spans come from
 * the product listing. Local amendments and the authority having jurisdiction
 * always govern.
 *
 * The same register is published as deckrules.csv (one row per rule) and
 * explained for builders in deckrules.md.
 */

export const RULE_CATEGORIES = [
    { id: 'footing', label: 'Footings & soil' },
    { id: 'framing', label: 'Posts, beams & joists' },
    { id: 'ledger', label: 'Ledger & attachment' },
    { id: 'decking', label: 'Decking' },
    { id: 'guard', label: 'Guards & openings' },
    { id: 'stairs', label: 'Stairs & handrails' },
    { id: 'siting', label: 'Siting, decay & drainage' },
    { id: 'inspection', label: 'Inspection & handover' }
];

export const CODE_SCOPE = {
    title: 'IRC 2021 §R507 decks · §R312 guards · §R311.7 stairs · AWC NDS',
    url: 'https://up.codes/s/decks',
    body: 'Residential decks follow IRC 2021 §R507 for footings, posts, beams, joists, ledgers and decking, §R312 for guards and §R311.7 for stairways and handrails. Member capacities are checked with the AWC National Design Specification using 40 psf live and 10 psf dead load. Decking and railing spans are limited by the product listing. This is a design aid: confirm the edition and amendments adopted in your jurisdiction, and have the framing plan reviewed by a licensed engineer where the code requires it.'
};

export const RULES = [
    // --- Footings & soil ---------------------------------------------------
    {
        id: 'footing-depth',
        category: 'footing',
        title: 'Footings below the frost line',
        code: 'IRC 2021 §R403.1.4',
        level: 'required',
        summary: 'Every deck footing must extend below the local frost depth, and not less than 12 in below undisturbed grade, so frost heave cannot lift the deck.',
        requirements: [
            'Set the footing base below the frost depth for the site.',
            'Keep at least 12 in of cover below undisturbed grade.',
            'Belling or a wider pad is needed where the soil bearing is low.',
            'Do not bear on fill, organic soil or a slab edge.'
        ],
        checkIds: ['footing-depth']
    },
    {
        id: 'footing-size',
        category: 'footing',
        title: 'Footing size from the post load',
        code: 'IRC 2021 §R403.1.1 · Table R403.1(1)',
        level: 'required',
        summary: 'A deck footing is at least 12 in in diameter and large enough that the post load divided by the soil bearing capacity stays inside the pad.',
        requirements: [
            'Minimum 12 in diameter, or a square pad of equal area.',
            'Area = post load ÷ allowable soil bearing pressure.',
            'Use the tributary area of the post, not the whole deck.',
            'Keep the pad centred under the post and the post base clear of soil.'
        ],
        checkIds: ['footing-size', 'footing-bearing']
    },
    {
        id: 'soil-bearing',
        category: 'footing',
        title: 'Allowable soil bearing',
        code: 'IRC 2021 §R401.4.1',
        level: 'required',
        summary: 'Use an allowable bearing pressure from a soil test or the code table: 2,000 psf is the usual assumed default, 1,500 psf for clay and 3,000 psf for compact sand or gravel.',
        requirements: [
            'Assume 2,000 psf only where no test or local table applies.',
            'Drop to 1,500 psf for soft clay or silt.',
            'A geotechnical report overrides the table.',
            'Footings on a slope need a level bench, not a wedge of fill.'
        ],
        checkIds: ['footing-bearing']
    },

    // --- Posts, beams & joists --------------------------------------------
    {
        id: 'joist-span',
        category: 'framing',
        title: 'Joist size and span',
        code: 'IRC 2021 §R507.5 · Table R507.5(1)',
        level: 'required',
        summary: 'Deck joists are sized from the span and spacing: 40 psf live load, L/360 live deflection, and the species and grade stamped on the lumber.',
        requirements: [
            'Check bending and both deflection limits for the actual span.',
            'Tighter spacing carries the same load over a longer span.',
            'Joists may cantilever no more than one quarter of the back span.',
            'Joists bearing on a beam need a positive connection, not toe nails alone.'
        ],
        checkIds: ['joist-span', 'joist-cantilever']
    },
    {
        id: 'joist-spacing',
        category: 'framing',
        title: 'Joist spacing matched to the decking',
        code: 'IRC 2021 §R507.10 · manufacturer listing',
        level: 'required',
        summary: 'Joist spacing may not exceed the decking’s listed span: typically 16 in for 5/4 boards, 24 in for 2x6, and often 12 in for composite laid diagonally.',
        requirements: [
            'Set spacing from the decking span table, not from habit.',
            'Diagonal boards need one size closer spacing.',
            'Add blocking at board ends and mid-span for parallel layouts.',
            'Keep the first and last joist inside the rim so the edge board is supported.'
        ],
        checkIds: ['joist-spacing']
    },
    {
        id: 'beam-span',
        category: 'framing',
        title: 'Built-up beam spans',
        code: 'IRC 2021 §R507.6 · Table R507.6',
        level: 'required',
        summary: 'A deck beam carries half of each joist span and is sized from the post spacing; plies are nailed or bolted together so they act as one member.',
        requirements: [
            'Beam load = 50 psf × half the joist span.',
            'Two or three plies are fastened with the code nailing pattern.',
            'Beam ends bear at least 1½ in on the post or sit in a notch or cap.',
            'Post spacing is the beam span: check it, do not assume 6 ft.'
        ],
        checkIds: ['beam-span', 'beam-attachment']
    },
    {
        id: 'deck-post',
        category: 'framing',
        title: 'Post size and height',
        code: 'IRC 2021 §R507.4',
        level: 'required',
        summary: 'Deck posts are sized for the load and height: 6x6 for beam posts on most decks, with 4x4 limited to low, lightly loaded decks and bracing added as height grows.',
        requirements: [
            '6x6 posts are the practical minimum under a beam.',
            'Check the post axially with the NDS column formula.',
            'Tall posts need knee bracing or a designed frame.',
            'Post grain runs continuous; do not splice a post in the height.'
        ],
        checkIds: ['post-size', 'post-height']
    },
    {
        id: 'post-connection',
        category: 'framing',
        title: 'Post bases and caps',
        code: 'IRC 2021 §R507.3 · §R317.1',
        level: 'required',
        summary: 'A post must be connected to its footing and to the beam so uplift and lateral load cannot separate them, and it must be held above the concrete to shed water.',
        requirements: [
            'Use a standoff post base with an anchor into the footing.',
            'Connect the beam to the post with a cap, notch or through-bolts.',
            'Keep the end grain at least 1 in above the concrete.',
            'Provide a continuous load path from the deck to the footing.'
        ],
        checkIds: ['post-connection']
    },

    // --- Ledger & attachment ----------------------------------------------
    {
        id: 'ledger-attachment',
        category: 'ledger',
        title: 'Attaching the ledger to the house',
        code: 'IRC 2021 §R507.9.1.3 · Table R507.9.1.3(1)',
        level: 'required',
        summary: 'A ledger is attached with 1/2 in lag screws or bolts in two rows, staggered, spaced per the table for the joist span, with the band joist checked for the added load.',
        requirements: [
            'Two rows of 1/2 in fasteners, staggered, at the table spacing.',
            'Fasterners engage the band joist or a stud, never just siding.',
            '1/2 in lag screws need a 1/2 in clearance hole in the ledger.',
            'Through-bolts need washers at both faces.',
            'The band joist must be able to carry the deck load: verify before drilling.'
        ],
        checkIds: ['ledger-attachment']
    },
    {
        id: 'ledger-flashing',
        category: 'ledger',
        title: 'Ledger flashing and water management',
        code: 'IRC 2021 §R507.9.1.6 · §R703.4',
        level: 'required',
        summary: 'The ledger needs flashed top and bottom, with a water-resistive barrier lapped over the flashing and a gap or spacer so water cannot sit against the house.',
        requirements: [
            'Z-flashing over the ledger, lapped behind the siding.',
            'Bottom flashing or a spacer to drain the wall.',
            'Joist tape over the ledger top edge before the joists go on.',
            'Never rely on caulk as the only flashing.'
        ],
        checkIds: ['ledger-flashing']
    },
    {
        id: 'lateral-restraint',
        category: 'ledger',
        title: 'Lateral restraint for the deck',
        code: 'IRC 2021 §R507.9.2',
        level: 'required',
        summary: 'A ledger-attached deck needs lateral ties or an equivalent connection so the deck cannot pull away from the house: at least two tension ties, or a designed frame.',
        requirements: [
            'Two tension ties minimum, one near each end, or a designed alternative.',
            'Tie from the joist to a wall stud or the band joist with the listed fastener.',
            'A freestanding deck braced to the ground needs no tension ties.',
            'Check the ties are reachable for inspection before the decking goes down.'
        ],
        checkIds: ['lateral-tie']
    },

    // --- Decking ----------------------------------------------------------
    {
        id: 'decking-span',
        category: 'decking',
        title: 'Board span and layout',
        code: 'IRC 2021 §R507.10 · product listing',
        level: 'required',
        summary: 'Decking boards span no further than the manufacturer allows between joists, and the layout accounts for the gap, the end joints and the pattern.',
        requirements: [
            'Standard 5/4 board: 16 in on center perpendicular.',
            '2x6 board: 24 in on center; composite is usually 16 in.',
            'Diagonal layouts need closer joists and 15–20% more board.',
            'Stagger end joints and land every end on a joist.'
        ],
        checkIds: ['decking-span']
    },
    {
        id: 'decking-gap',
        category: 'decking',
        title: 'Board gaps and drainage',
        code: 'IRC 2021 §R507.10 · good practice',
        level: 'required',
        summary: 'Leave a gap between boards so water drains and debris cannot trap moisture: about 1/8–1/4 in for wood, and the manufacturer’s gap for composite and PVC.',
        requirements: [
            '1/8–1/4 in gap between boards for drainage and expansion.',
            'Composite and PVC need end gaps as well as edge gaps.',
            'Keep the gap uniform with spacers during installation.',
            'Never butt boards tight: they will cup or buckle.'
        ],
        checkIds: ['decking-gap']
    },
    {
        id: 'decking-fastener',
        category: 'decking',
        title: 'Fasteners and corrosion',
        code: 'IRC 2021 §R317.3 · manufacturer',
        level: 'required',
        summary: 'Use two fasteners per board at every joist, in stainless or coated steel compatible with the treatment, and hidden clips where the board calls for them.',
        requirements: [
            'Two fasteners per joist, set back from the board edge.',
            'Stainless or hot-dip galvanised in treated and coastal conditions.',
            'Hidden clips need one clip at every joist crossing.',
            'Pre-drill hardwood and PVC to avoid splitting.'
        ],
        checkIds: ['decking-fastener']
    },

    // --- Guards -----------------------------------------------------------
    {
        id: 'guard-required',
        category: 'guard',
        title: 'When a guard is required',
        code: 'IRC 2021 §R312.1.1',
        level: 'required',
        summary: 'A deck more than 30 in above the grade or floor below needs a guard on every open side, including the stair opening.',
        requirements: [
            'Guard required above 30 in of height.',
            'Guard every open side, not just the outer edge.',
            'The stair opening needs a guard on both sides and at the landing.',
            'A screen or open railing still counts as a guard if it meets the loads.'
        ],
        checkIds: ['guard-required']
    },
    {
        id: 'guard-height',
        category: 'guard',
        title: 'Guard height 36 in',
        code: 'IRC 2021 §R312.1.2',
        level: 'required',
        summary: 'The guard is at least 36 in high measured vertically from the deck surface, on the open sides of a one- and two-family dwelling.',
        requirements: [
            '36 in minimum above the finished deck surface.',
            'Measure at the deck, not at the top of the rim.',
            'The guard must resist a 200 lb concentrated load in any direction.',
            'A stair guard follows the slope at 34–38 in above the tread line.'
        ],
        checkIds: ['guard-height', 'guard-load']
    },
    {
        id: 'guard-opening',
        category: 'guard',
        title: 'The 4 in sphere rule',
        code: 'IRC 2021 §R312.1.3',
        level: 'required',
        summary: 'No opening in a guard may pass a 4 in sphere, and the triangle formed by the stair tread, riser and guard may not pass a 6 in sphere.',
        requirements: [
            'No opening larger than 4 in at any point in the guard.',
            'The stair triangle is limited to a 6 in sphere.',
            'Balusters, cables and glass gaps all count as openings.',
            'Check the gap at the post and at the deck edge, not just mid-span.'
        ],
        checkIds: ['guard-opening']
    },
    {
        id: 'guard-post',
        category: 'guard',
        title: 'Guard posts and their connection',
        code: 'IRC 2021 §R312.1.2 · manufacturer',
        level: 'recommended',
        summary: 'Guard posts are spaced no more than about 6 ft on center and are bolted or through-bolted to the rim or blocked framing, so a 200 lb push does not lever them loose.',
        requirements: [
            'Posts at 6 ft maximum, closer for cable and glass.',
            'Through-bolt or use a listed post base; lag screws alone loosen.',
            'Block between joists behind every post.',
            'Design the post for the 200 lb guard load at the rail height.'
        ],
        checkIds: ['guard-post']
    },

    // --- Stairs -----------------------------------------------------------
    {
        id: 'stair-riser',
        category: 'stairs',
        title: 'Riser height 7¾ in maximum',
        code: 'IRC 2021 §R311.7.5',
        level: 'required',
        summary: 'Every riser is 7¾ in (196 mm) or less, and all risers in a flight are within 3/8 in of each other.',
        requirements: [
            'Maximum riser 7¾ in (196 mm).',
            'Maximum variation between risers 3/8 in (9.5 mm).',
            'Measure from the finished deck to the finished grade.',
            'The first and last riser count with the rest.'
        ],
        checkIds: ['stair-riser', 'stair-variation']
    },
    {
        id: 'stair-tread',
        category: 'stairs',
        title: 'Tread depth 10 in minimum',
        code: 'IRC 2021 §R311.7.5.2',
        level: 'required',
        summary: 'Treads are at least 10 in (254 mm) deep, with a nosing of ¾–1¼ in where the tread does not project over the riser.',
        requirements: [
            '10 in minimum tread depth (254 mm).',
            'Nosing ¾–1¼ in, uniform across the flight.',
            'Treads must be level and slip resistant outdoors.',
            'Open risers are limited to a 4 in sphere where a guard is required.'
        ],
        checkIds: ['stair-tread']
    },
    {
        id: 'stair-width',
        category: 'stairs',
        title: 'Stair width and headroom',
        code: 'IRC 2021 §R311.7.1 · §R311.7.2',
        level: 'required',
        summary: 'A stair is at least 36 in (914 mm) clear width above the handrail height, with 6 ft 8 in (2032 mm) of headroom measured vertically.',
        requirements: [
            '36 in minimum clear width.',
            '6 ft 8 in minimum headroom.',
            'Landing at the bottom and top at least as wide as the stair.',
            'Keep the stair clear of the guard and the door swing.'
        ],
        checkIds: ['stair-width', 'stair-headroom', 'stair-landing']
    },
    {
        id: 'stair-handrail',
        category: 'stairs',
        title: 'Handrails 34–38 in',
        code: 'IRC 2021 §R311.7.8',
        level: 'required',
        summary: 'A stair of four or more risers needs a graspable handrail 34–38 in above the tread nosing, continuous for the flight, with 1½ in clearance from the wall.',
        requirements: [
            '34–38 in above the tread nosing.',
            'Graspable profile, 1¼–2 in across.',
            '1½ in clear of the wall or guard.',
            'Continuous for the whole flight and returned at the ends.'
        ],
        checkIds: ['stair-handrail']
    },
    {
        id: 'stair-stringer',
        category: 'stairs',
        title: 'Stringers and their bearing',
        code: 'IRC 2021 §R311.7 · §R507.5',
        level: 'required',
        summary: 'Outdoor stairs use 2x12 stringers, not more than 36 in apart, bearing on a footing or the deck frame and connected at both ends.',
        requirements: [
            '2x12 stringers for a full-height outdoor stair.',
            'Stringers at 16–36 in on center depending on tread material.',
            'Bearing at the top to the deck rim and at the bottom to a footing.',
            'Add a mid-span support for long flights.'
        ],
        checkIds: ['stair-stringer']
    },

    // --- Siting, decay & drainage ----------------------------------------
    {
        id: 'decay-protection',
        category: 'siting',
        title: 'Decay-resistant framing near grade',
        code: 'IRC 2021 §R317.1 · AWPA U1',
        level: 'required',
        summary: 'Wood within 6 in of grade, in contact with concrete, or exposed to weather must be naturally durable or pressure treated for ground contact and cut ends field-treated.',
        requirements: [
            'Ground-contact treatment for posts and anything within 6 in of grade.',
            'Field-treat every cut end and drilled hole.',
            'Use stainless or hot-dip galvanised connectors with treated wood.',
            'Keep the deck at least 18 in above grade for ventilation where possible.'
        ],
        checkIds: ['decay-protection']
    },
    {
        id: 'deck-drainage',
        category: 'siting',
        title: 'Drainage and grade below the deck',
        code: 'IRC 2021 §R401.3',
        level: 'required',
        summary: 'The ground below the deck falls away from the house, and the deck surface sheds water through the board gaps or a drainage system.',
        requirements: [
            'Grade below the deck falls away from the house.',
            'Do not pond water under the deck against the foundation.',
            'Boards run with the fall where the deck is covered.',
            'Keep downspouts from discharging under the deck.'
        ],
        checkIds: ['deck-drainage']
    },
    {
        id: 'ventilation',
        category: 'siting',
        title: 'Airflow under the deck',
        code: 'Good practice · manufacturer',
        level: 'recommended',
        summary: 'Leave 18 in or more of clear space under the joists for airflow, or ventilate a skirted deck, so the framing can dry after rain.',
        requirements: [
            '18 in clear under the joists where the deck is low.',
            'Vent a skirted deck at both ends.',
            'Never trap soil against the joists or the ledger.',
            'Keep plants and mulch below the framing line.'
        ],
        checkIds: ['ventilation']
    },
    {
        id: 'setback',
        category: 'siting',
        title: 'Setbacks and lot coverage',
        code: 'Local zoning · AHJ',
        level: 'required',
        summary: 'Decks, stairs and footings must respect the side, rear and front setbacks, easements and the lot’s impervious-cover limit.',
        requirements: [
            'Confirm the zoning setback for the deck and the stair run.',
            'Keep the footings out of utility easements.',
            'Check the impervious-cover limit and any height limit.',
            'A deck over 30 in may trigger a building permit and a plan review.'
        ],
        checkIds: ['setback']
    },

    // --- Inspection & handover -------------------------------------------
    {
        id: 'inspection',
        category: 'inspection',
        title: 'What the inspector needs',
        code: 'Plan review · inspection',
        level: 'required',
        summary: 'A dimensioned framing plan, the footing and post schedule, the ledger attachment detail, the guard and stair details, and the fastener and connector listing.',
        requirements: [
            'Dimensioned plan with joist direction, spacing and beam lines.',
            'Footing size, depth and soil assumption.',
            'Ledger fasteners, flashing and lateral ties detailed.',
            'Guard and stair details including the sphere test.',
            'Connector and fastener schedule with the manufacturer’s values.'
        ],
        checkIds: ['inspection']
    }
];

export const GLOSSARY = [
    { term: 'Ledger', category: 'Framing', short: 'The board bolted to the house that carries the house-side end of the joists.', detail: 'A ledger needs two rows of 1/2 in fasteners, flashing top and bottom, and lateral ties so the deck cannot pull away from the wall.' },
    { term: 'Rim joist', category: 'Framing', short: 'The outer joist that closes the frame and carries the guard and decking edge.', detail: 'Rim joists are doubled where a guard post lands, so the 200 lb guard load has somewhere to go.' },
    { term: 'Beam', category: 'Framing', short: 'The built-up member that carries the joists and lands on the posts.', detail: 'Two or three plies nailed together act as one beam. Beam span is the post spacing, and it carries half of each joist span.' },
    { term: 'Joist', category: 'Framing', short: 'The repeated member that carries the decking between the ledger and the beam.', detail: 'Joist capacity comes from bending stress (Fb, S) and deflection (E, I). L/360 live and L/240 total are the usual limits.' },
    { term: 'Tributary area', category: 'Structure', short: 'The floor area whose load lands on one member.', detail: 'A post’s tributary area is its spacing along the beam times half the joist span. That load sizes the post and the footing.' },
    { term: 'Cantilever', category: 'Framing', short: 'The part of a joist that projects past its beam.', detail: 'Limit a cantilever to one quarter of the back span, and keep the back span properly connected so it does not tip.' },
    { term: 'Post base', category: 'Hardware', short: 'The standoff connector between a post and its footing.', detail: 'It anchors the post, resists uplift, and holds the end grain above the concrete so water cannot wick into the post.' },
    { term: 'Footing', category: 'Structure', short: 'The concrete pad that spreads the post load into the soil.', detail: 'Minimum 12 in diameter, below frost depth, sized so the bearing pressure stays under the allowable soil value.' },
    { term: 'Frost depth', category: 'Structure', short: 'How deep the ground freezes in winter at the site.', detail: 'Footings must bear below it, or frost heave will lift and rack the deck. Ask the local building department for the number.' },
    { term: 'Soil bearing capacity', category: 'Structure', short: 'The pressure the soil can carry without settling, in psf.', detail: '2,000 psf is the usual assumed default; clay drops to about 1,500 psf, compact sand and gravel rise to 3,000 psf.' },
    { term: 'Decking span', category: 'Decking', short: 'The maximum joist spacing a deck board can cross.', detail: '5/4 boards usually span 16 in, 2x6 boards 24 in, and composite often 16 in or less. Diagonal layouts need closer joists.' },
    { term: 'Hidden clip', category: 'Decking', short: 'A fastener that joins boards from the edge so no screw shows.', detail: 'One clip per joist per board edge. Composite and PVC systems require the manufacturer’s clip and gap.' },
    { term: 'Guard', category: 'Safety', short: 'The rail that stops a fall from a deck more than 30 in high.', detail: 'At least 36 in high, no opening that passes a 4 in sphere, designed for a 200 lb concentrated load.' },
    { term: 'Four inch sphere', category: 'Safety', short: 'The code’s test ball for guard openings.', detail: 'If a 4 in sphere passes anywhere in the guard, the guard fails. The stair triangle uses a 6 in sphere.' },
    { term: 'Graspable handrail', category: 'Stairs', short: 'A rail profile a hand can close around, 1¼–2 in across.', detail: '34–38 in above the tread nosing, continuous, with 1½ in clear of the wall or guard.' },
    { term: 'Riser and tread', category: 'Stairs', short: 'The vertical and horizontal parts of one step.', detail: 'Riser ≤ 7¾ in, tread ≥ 10 in, and all risers within 3/8 in of each other so the flight does not trip people.' },
    { term: 'Stringer', category: 'Stairs', short: 'The sloping 2x12 that carries the stair treads.', detail: 'Cut stringers are notched for each tread and riser; they bear on a footing at the bottom and the deck rim at the top.' },
    { term: 'Lateral tie', category: 'Hardware', short: 'A connector that stops the deck pulling away from the house.', detail: 'Two tension ties minimum on a ledger-attached deck, taken into a stud or the band joist with the listed fastener.' },
    { term: 'Joist hanger', category: 'Hardware', short: 'The galvanised bracket that carries a joist end at a beam or ledger.', detail: 'Size the hanger to the joist and use the manufacturer’s screws, not nails, where the listing requires them.' },
    { term: 'NDS', category: 'Code', short: 'The AWC National Design Specification for Wood Construction.', detail: 'It supplies the reference design values, the load duration factor and the column stability formula the suite uses.' },
    { term: 'Load duration factor', category: 'Code', short: 'CD, the factor that lets wood carry more load briefly.', detail: 'CD = 1.0 for permanent load, 1.15 for snow, 1.25 for construction, 1.6 for wind. Decks use 1.0 here.' },
    { term: 'L/360', category: 'Code', short: 'The usual live-load deflection limit for a floor or deck.', detail: 'A 12 ft span may sag 0.4 in under live load. Total load uses L/240.' },
    { term: 'Field treatment', category: 'Durability', short: 'Preservative brushed onto a cut or drilled end on site.', detail: 'Cut ends of treated lumber are unprotected; coat them before assembly or the post rots from the inside.' },
    { term: 'Ground contact', category: 'Durability', short: 'The treatment level for wood that touches soil or stays wet.', detail: 'Use UC4A or better for posts and anything within 6 in of grade; above-ground treatment will fail early there.' }
];

export const FORMULAS = [
    { label: 'Joist load', expression: 'w = (40 live + 10 dead) psf × spacing (ft)', note: 'Pounds per lineal foot on one joist.' },
    { label: 'Bending span', expression: 'L = √(8 Fb S / w)', note: 'S = b d² / 6 for a rectangular section; w in lb/in.' },
    { label: 'Deflection span', expression: 'L = (384 E I / (5 w × limit))^(1/3)', note: 'limit 360 for live, 240 for total; I = b d³ / 12.' },
    { label: 'Beam load', expression: 'w = 50 psf × (joist span ÷ 2)', note: 'The beam picks up half of each joist span.' },
    { label: 'Post load', expression: 'P = 50 psf × post spacing × joist span ÷ 2', note: 'Add the beam and post self weight for the footing.' },
    { label: 'Column capacity', expression: 'P = Fc* A Cp', note: 'Cp from the NDS column formula with FcE = 0.822 E / (le/d)².' },
    { label: 'Footing area', expression: 'A = P ÷ soil bearing (psf)', note: 'Round up to a 12 in minimum diameter.' },
    { label: 'Stair risers', expression: 'risers = ⌈height ÷ 7.75 in⌉; treads = risers − 1', note: 'Check the riser lands at or below 196 mm.' },
    { label: 'Stringer length', expression: '√(rise² + run²)', note: 'Add for the bearing cuts at each end.' },
    { label: 'Concrete bags', expression: 'volume (m³) ÷ 0.017', note: 'One 80 lb bag yields about 0.6 cu ft.' }
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
