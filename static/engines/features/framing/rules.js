/**
 * Rules, codes and reference material for the framing suite.
 *
 * The model code is the 2021 International Residential Code, Chapter 6 (wood
 * wall construction, §R602) and Chapter 5 (floor framing, §R502), with §R301
 * for loads, §R317 for decay and §R403 for anchorage. Member capacities are
 * checked with the AWC National Design Specification, using the species and
 * grade the board is stamped with. Tables are summarised for design use; the
 * adopted code edition and local amendments always govern.
 *
 * The register is also published as framingrules.csv (one row per rule) and
 * framingrules.md (the review copy), and the suite renders it on its Rules tab.
 */

export const RULE_CATEGORIES = [
    { id: 'studs', label: 'Studs & wall height' },
    { id: 'plates', label: 'Plates & splices' },
    { id: 'openings', label: 'Openings & headers' },
    { id: 'sheathing', label: 'Sheathing & weather barrier' },
    { id: 'bracing', label: 'Wall bracing & anchorage' },
    { id: 'floors', label: 'Floor platforms' },
    { id: 'fire', label: 'Fire blocking' },
    { id: 'fastening', label: 'Fastening & connectors' },
    { id: 'moisture', label: 'Moisture & treated lumber' },
    { id: 'inspection', label: 'Inspection & tolerance' }
];

export const CODE_SCOPE = {
    title: 'IRC 2021 §R602 wood walls · §R502 floor framing · AWC NDS',
    url: 'https://up.codes/s/wall-construction',
    body: 'Residential wood framing follows IRC 2021 Chapter 6 (§R602) for studs, plates, headers, bracing and sheathing, and Chapter 5 (§R502-R503) for floor joists, rim joists and subfloor. Wall and floor loads come from §R301.5 and Table R301.2, decay resistance from §R317, and anchorage from §R403. Member capacities are calculated with the AWC National Design Specification, so the suite reports bending, shear and deflection instead of copying a span table for another species. This is a design aid: confirm the code edition adopted in your jurisdiction and have unusual or engineered framing reviewed by a licensed professional.'
};

export const RULES = [
    // --- Studs -----------------------------------------------------------
    {
        id: 'stud-size-height',
        category: 'studs',
        title: 'Stud size, height and spacing',
        code: 'IRC 2021 §R602.3.1 · Table R602.3(5)',
        level: 'required',
        summary: 'A stud wall must stay inside the height limit for its size, spacing and the load it carries. The suite checks the framed height against a conservative summary of the table and refuses to sign off a wall over 12 ft without an engineered design.',
        requirements: [
            '2x4 at 16 in on center: 10 ft carrying a roof and ceiling, 9 ft carrying one floor above.',
            '2x4 at 24 in on center: 9 ft roof only, 8 ft with a floor above.',
            '2x6 at 24 in on center: 10 ft for the common one- and two-storey cases.',
            'Walls taller than the table, or carrying more than the tabulated load, need an engineered design.'
        ],
        checkIds: ['stud-height', 'stud-spacing']
    },
    {
        id: 'stud-grade',
        category: 'studs',
        title: 'Stud grade and marking',
        code: 'IRC 2021 §R602.3.1 · §R602.1.1',
        level: 'required',
        summary: 'Wall studs are No. 2 grade or better, marked with species, grade and mill. Utility grade is limited to interior non-load-bearing walls at 16 in on center and cannot carry a floor.',
        requirements: [
            'No. 2 or better for bearing walls; Stud grade is acceptable for non-bearing walls.',
            'The grade stamp identifies species, grade and moisture content.',
            'Utility grade is restricted and never carries a floor.',
            'Do not substitute a lower grade without rechecking the member.'
        ],
        checkIds: ['stud-grade']
    },
    {
        id: 'stud-plumb',
        category: 'studs',
        title: 'Studs plumb, crowned and straight',
        code: 'IRC 2021 §R602.3 · good practice',
        level: 'recommended',
        summary: 'Crown every stud the same way, plumb each wall panel before sheathing, and keep the flanges of manufactured members facing the right way.',
        requirements: [
            'Crown the studs upward so the wall bows one way, not every way.',
            'Plumb and brace panels before the sheathing goes on.',
            'Keep a straight stud at every corner and opening; cut the worst boards for blocking.',
            'Do not notch a stud beyond the code limits.'
        ],
        checkIds: ['stud-plumb']
    },
    {
        id: 'stud-bearing',
        category: 'studs',
        title: 'Bearing walls and load transfer',
        code: 'IRC 2021 §R602.3.1 · §R602.4 · §R602.5',
        level: 'required',
        summary: 'Every stud under a bearing wall must be continuous from the sole plate to the top plate and aligned with the framing below. Interior non-bearing partitions may use smaller members but still need a proper top plate.',
        requirements: [
            'Stack bearing walls over beams, walls or footings below.',
            'Use a double top plate where joists or trusses cross the wall.',
            'Interior non-bearing walls still get a top plate and end nailing.',
            'Cripple walls and half-walls need their own bracing and anchorage.'
        ],
        checkIds: ['stud-bearing', 'top-plate']
    },

    // --- Plates ----------------------------------------------------------
    {
        id: 'bottom-plate-treated',
        category: 'plates',
        title: 'Treated bottom plate on masonry',
        code: 'IRC 2021 §R317.1 · §R317.1.1',
        level: 'required',
        summary: 'Wood in contact with concrete, masonry or the ground must be naturally durable or pressure-treated for the exposure. The bottom plate is the member that sits on the slab or sill, so it is treated by default.',
        requirements: [
            'Pressure-treated or naturally durable bottom plate over concrete and masonry.',
            'Use ground-contact rated material where it can stay wet.',
            'Keep untreated framing at least 8 in above grade and clear of splash.',
            'Cut ends and field cuts of treated lumber need a field treatment.'
        ],
        checkIds: ['bottom-plate', 'treated-contact']
    },
    {
        id: 'top-plate-splice',
        category: 'plates',
        title: 'Double top plate and splices',
        code: 'IRC 2021 §R602.3.2 · §R602.3.3',
        level: 'required',
        summary: 'A double top plate ties intersecting walls together. End joints in the two plates are offset at least 24 in, and each plate is lapped and nailed at corners and T-intersections.',
        requirements: [
            'Offset the joints of the upper and lower top plates by at least 24 in.',
            'Lap plates at corners and where a partition meets a wall.',
            'Nail each layer with 16d at 16 in on center, and 3 in at the laps.',
            'A single top plate is allowed only where the joists or trusses are supported directly over the studs.'
        ],
        checkIds: ['top-plate', 'plate-splice']
    },
    {
        id: 'plate-fastening',
        category: 'plates',
        title: 'Plate to stud nailing',
        code: 'IRC 2021 Table R602.3(1)',
        level: 'required',
        summary: 'Each stud gets two 16d nails at the bottom plate and two at the top plate, end-nailed through the plate. Toenailing is not a substitute for the schedule on a bearing wall.',
        requirements: [
            'Two 16d common nails per stud end, through the plate.',
            'Face-nail where the plate is not wide enough for end nailing.',
            'Header to jack: four 16d nails per end.',
            'Use the manufacturer’s fasteners and holes for connectors.'
        ],
        checkIds: ['nail-schedule']
    },

    // --- Openings --------------------------------------------------------
    {
        id: 'rough-opening',
        category: 'openings',
        title: 'Rough openings and framing',
        code: 'IRC 2021 §R602.6 · §R602.7',
        level: 'required',
        summary: 'Every window and door gets a rough opening framed with full-height king studs, trimmer (jack) studs carrying the header, a header sized for the span, and cripples above the header and below the sill.',
        requirements: [
            'Rough opening = unit width + shim and flashing allowance, usually ½ to 1 in.',
            'King studs run full height each side of the opening.',
            'Jack studs sit under the header and are cut to the opening height.',
            'Cripples fill from the header to the top plate and from the sill to the bottom plate.',
            'The header bears on the jack studs, not on the cripples.'
        ],
        checkIds: ['rough-opening', 'king-jack', 'cripple-spacing']
    },
    {
        id: 'header-span',
        category: 'openings',
        title: 'Header size and span',
        code: 'IRC 2021 §R602.7 · Tables R602.7(1)-(3) · AWC NDS',
        level: 'required',
        summary: 'A header is a beam: it is sized for the opening span, the tributary floor and roof load above, and the deflection limit. The suite calculates bending and L/360 deflection, then keeps a conservative prescriptive minimum and reports the governing case.',
        requirements: [
            'Use at least two plies for a header in a bearing wall.',
            'Check the tributary width from the floor or roof above, not just the opening width.',
            'Keep the header bearing length at least 1½ in on each jack stud.',
            'Openings wider than the tabulated span need an engineered header or an LVL.'
        ],
        checkIds: ['header-span', 'header-bearing']
    },
    {
        id: 'header-flush',
        category: 'openings',
        title: 'Header height and cripples',
        code: 'IRC 2021 §R602.6.1 · §R602.7',
        level: 'recommended',
        summary: 'Set door and window headers at the same height where the design allows, so the ceiling line and trim align, and fill the space above the header with cripples at the same spacing as the studs.',
        requirements: [
            'Standard door head height is 6 ft 8 in; standard window head aligns with it.',
            'Cripples above a header run from the header top to the top plate.',
            'Cripples below a window sill run from the sole plate to the sill.',
            'Keep cripple spacing at 16 in on center unless the sheathing is designed otherwise.'
        ],
        checkIds: ['cripple-spacing']
    },
    {
        id: 'opening-sill',
        category: 'openings',
        title: 'Window sills and rough sills',
        code: 'IRC 2021 §R602.6.1 · §R703.4',
        level: 'required',
        summary: 'A window needs a rough sill spanning between the jack studs, cripples under it, and a sloped exterior sill or flashing so water drains out rather than into the wall.',
        requirements: [
            'Rough sill at the manufacturer’s sill height, level and straight.',
            'Flash the rough sill with a sloped sill pan or membrane.',
            'Keep the sill at least 8 in above grade where the wall is exterior.',
            'Cripples under the sill carry the sill load to the sole plate.'
        ],
        checkIds: ['sill-framing', 'sill-height']
    },

    // --- Sheathing -------------------------------------------------------
    {
        id: 'wall-sheathing',
        category: 'sheathing',
        title: 'Exterior wall sheathing',
        code: 'IRC 2021 §R703.1 · §R703.2 · §R602.10',
        level: 'required',
        summary: 'Exterior walls need a sheathing or another accepted bracing method. Structural wood panels also act as the braced wall panels, so the panel grade, thickness and nailing are part of the structural system.',
        requirements: [
            'Use a rated panel where the sheathing is the braced wall panel.',
            'Install panels with the long dimension across the studs and stagger the joints.',
            'Nail 8d common at 6 in on center at supported edges and 12 in in the field.',
            'Leave a 1/8 in gap between panels and 1/4 in at the foundation.'
        ],
        checkIds: ['sheathing', 'sheathing-fastening']
    },
    {
        id: 'weather-barrier',
        category: 'sheathing',
        title: 'Water-resistive barrier and flashing',
        code: 'IRC 2021 §R703.2 · §R703.4',
        level: 'required',
        summary: 'A continuous water-resistive barrier goes over the sheathing, lapped and flashed at openings, corners and the wall base. The barrier is the second line of defence behind the cladding.',
        requirements: [
            'Lap the barrier 6 in horizontally and 6 in vertically, shingle fashion.',
            'Flash every opening head, jamb and sill, and every wall intersection.',
            'Tape the seams and seal the penetrations.',
            'Keep the wall base clear of grade and let it drain.'
        ],
        checkIds: ['weather-barrier']
    },
    {
        id: 'sheathing-fastening',
        category: 'sheathing',
        title: 'Sheathing fastening schedule',
        code: 'IRC 2021 Table R602.3(1) · §R602.10',
        level: 'required',
        summary: 'Fastening is what turns a stack of boards into a shear panel. Nail size, spacing and edge distance follow the table, and the panel edges must land on framing.',
        requirements: [
            '8d common nails, 6 in at supported panel edges and 12 in in the field.',
            'Hold nails 3/8 in from the panel edge to avoid splitting.',
            'Block unsupported panel edges used as a shear panel.',
            'Use the connector schedule where the panel is part of a braced wall design.'
        ],
        checkIds: ['sheathing-fastening']
    },

    // --- Bracing & anchorage ---------------------------------------------
    {
        id: 'braced-wall-lines',
        category: 'bracing',
        title: 'Braced wall lines',
        code: 'IRC 2021 §R602.10.1 · Table R602.10.3(1)',
        level: 'required',
        summary: 'Lateral load needs a continuous path through braced wall lines in both directions. Lines are spaced within the table limit for the wind or seismic category, and each line carries enough braced length for the storey.',
        requirements: [
            'Provide braced wall lines in both directions, roughly every 25 to 60 ft depending on the method.',
            'Each line needs braced panels at its ends or in an accepted pattern.',
            'Do not interrupt a line with a large opening without a designed transfer.',
            'Sheathing, let-in bracing and proprietary systems cannot be mixed arbitrarily.'
        ],
        checkIds: ['braced-lines', 'bracing-length']
    },
    {
        id: 'braced-panel-length',
        category: 'bracing',
        title: 'Braced panel length',
        code: 'IRC 2021 §R602.10.3 · Table R602.10.3(3)',
        level: 'required',
        summary: 'Each braced wall panel has a minimum length that depends on the method, the storey and the exposure. A continuously sheathed wood structural panel (CS-WSP) needs at least 48 in, and the total braced length is a percentage of the wall line.',
        requirements: [
            'Minimum 48 in panel for CS-WSP; wider panels are stronger and easier to hold down.',
            'Keep the required percentage of the wall line, not just one panel, for the wind exposure.',
            'Every panel gets anchorage at the base and a load path to the floor below.',
            'A braced panel interrupted by an opening is measured between the openings.'
        ],
        checkIds: ['bracing-length']
    },
    {
        id: 'anchorage',
        category: 'bracing',
        title: 'Anchor bolts and hold-downs',
        code: 'IRC 2021 §R403.1.6 · §R602.11',
        level: 'required',
        summary: 'The sill plate is anchored to the foundation with at least two ½ in bolts per plate section, 7 in embedded, spaced no more than 6 ft on center and within 12 in of each end. Braced wall lines also need hold-downs where the table requires them.',
        requirements: [
            '½ in anchor bolts, 7 in minimum embedment, 6 ft maximum spacing.',
            'One bolt within 12 in of each end of a plate section, and at least two per section.',
            'Plate washers at braced wall lines and in seismic categories.',
            'Follow the hold-down manufacturer’s anchor, edge distance and tightening.'
        ],
        checkIds: ['anchor-bolts', 'hold-downs']
    },
    {
        id: 'lateral-ties',
        category: 'bracing',
        title: 'Continuous load path',
        code: 'IRC 2021 §R602.10.11 · §R301.1.3',
        level: 'recommended',
        summary: 'Roof to wall, wall to floor and floor to foundation connections form one continuous tie from the roof to the footing. Gaps in that chain are where wind and seismic damage starts.',
        requirements: [
            'Tie the top plate to rafters or trusses at the spacing the design requires.',
            'Tie each storey’s wall to the floor platform with approved straps or hold-downs.',
            'Tie the rim joist to the sill and the sill to the foundation.',
            'Use the manufacturer’s fasteners; do not substitute a smaller nail.'
        ],
        checkIds: ['hold-downs', 'hurricane-ties']
    },

    // --- Floors ----------------------------------------------------------
    {
        id: 'floor-joist-span',
        category: 'floors',
        title: 'Floor joist span',
        code: 'IRC 2021 §R502.3.1 · Table R502.3(1) · §R301.5',
        level: 'required',
        summary: 'Floor joists carry 40 psf live load in habitable rooms and are limited by bending, shear and L/360 live deflection. The suite sizes the joist from the species and grade on site instead of copying a span for another species.',
        requirements: [
            '40 psf live and 10 psf dead for habitable floors.',
            'L/360 live deflection, L/240 total, unless a finish is more sensitive.',
            'The span is the clear distance between bearings plus the bearing length.',
            'The joist may not cantilever beyond the code limit without design.'
        ],
        checkIds: ['floor-span', 'floor-deflection']
    },
    {
        id: 'rim-joist',
        category: 'floors',
        title: 'Rim joist and blocking',
        code: 'IRC 2021 §R502.2 · §R502.7',
        level: 'required',
        summary: 'The rim joist closes the floor platform, transfers the wall above to the joists and foundation, and holds the joist ends straight. Blocking or bridging keeps the joists from rolling.',
        requirements: [
            'Rim joist at least the depth of the floor joists, nailed to each joist end.',
            'Solid blocking at bearings and at the ends of the floor.',
            'Bridging or blocking at mid-span where the span or depth requires it.',
            'Hangers where a joist cannot bear on a wall or beam.'
        ],
        checkIds: ['rim-joist', 'floor-blocking']
    },
    {
        id: 'subfloor',
        category: 'floors',
        title: 'Subfloor and panel joints',
        code: 'IRC 2021 §R503.2 · §R503.1.1',
        level: 'required',
        summary: 'Subfloor panels are glued and screwed to the joists, with the long dimension across the joists, staggered joints and a gap at the edges for movement.',
        requirements: [
            '3/4 in tongue-and-groove panels at 24 in joist spacing; 5/8 in accepted at 16 in.',
            'Glue the joists and screw at 12 in in the field and 6 in at the edges.',
            'Stagger the panel joints; do not land four corners on one joist.',
            'Leave 1/8 in between panels and 1/4 in at walls.'
        ],
        checkIds: ['subfloor']
    },

    // --- Fire ------------------------------------------------------------
    {
        id: 'fire-blocking',
        category: 'fire',
        title: 'Fire blocking',
        code: 'IRC 2021 §R302.11 · §R602.8',
        level: 'required',
        summary: 'Concealed wall cavities need fire blocking at the floor line, at the ceiling line and wherever a wall cavity could act as a chimney. Platform framing gets this from the floor platform; balloon framing needs explicit blocking.',
        requirements: [
            'Block the cavity at each floor and ceiling line.',
            'Block at the top of a wall where the ceiling is not a membrane.',
            'Use 2 in nominal lumber or an approved material, full depth of the cavity.',
            'Do not leave a vertical chase open from the basement to the attic.'
        ],
        checkIds: ['fire-blocking']
    },
    {
        id: 'draft-stopping',
        category: 'fire',
        title: 'Draft stopping at penetrations',
        code: 'IRC 2021 §R302.11.1',
        level: 'required',
        summary: 'Penetrations for pipes, ducts and cables through plates and fire blocking are sealed with an approved material so the cavity cannot carry smoke between floors.',
        requirements: [
            'Seal around plumbing, wiring and ducts where they pass a plate.',
            'Use an approved fireblocking material rated for the application.',
            'Keep the blocking tight to the penetrating item.',
            'Inspect before the wall is closed.'
        ],
        checkIds: ['fire-blocking']
    },

    // --- Fastening -------------------------------------------------------
    {
        id: 'nail-schedule',
        category: 'fastening',
        title: 'Nailing schedule',
        code: 'IRC 2021 Table R602.3(1)',
        level: 'required',
        summary: 'Every connection has a nailing schedule: studs to plates, headers to jack studs, joists to rim, sheathing to studs and blocking to studs. Nail size and count matter more than total weight.',
        requirements: [
            'Two 16d per stud end through the plate.',
            'Four 16d per header end into the king stud.',
            'Three 16d per joist end into the rim or header.',
            '8d at 6 in edge / 12 in field for sheathing; two 16d per blocking end.'
        ],
        checkIds: ['nail-schedule']
    },
    {
        id: 'connector-fastening',
        category: 'fastening',
        title: 'Connectors and corrosion resistance',
        code: 'IRC 2021 §R317.3 · §R602.3',
        level: 'required',
        summary: 'Fasteners and connectors in treated wood must resist corrosion: hot-dip galvanised, stainless or an approved coating. Electrically conductive connectors cannot be used with some treatments.',
        requirements: [
            'Use hot-dip galvanised or stainless fasteners with ACQ and copper azole lumber.',
            'Follow the manufacturer’s nail and screw schedule exactly.',
            'Do not mix connector brands or fill the holes with a larger nail.',
            'Aluminium flashing does not touch treated lumber.'
        ],
        checkIds: ['fasteners']
    },
    {
        id: 'anchor-fastening',
        category: 'fastening',
        title: 'Sill plate anchorage',
        code: 'IRC 2021 §R403.1.6 · §R403.1.3',
        level: 'required',
        summary: 'Sill plates are anchored through the sill seal into the foundation on the bolt schedule, with plate washers where the braced wall design requires them, and the sill is shimmed level before the walls are raised.',
        requirements: [
            '½ in bolts at 6 ft maximum, 7 in embed, 12 in from plate ends.',
            'Plate washers at braced wall lines and in high seismic categories.',
            'Use a sill seal gasket and keep the sill straight and level.',
            'Fill and consolidate the anchor bolt grout or epoxy per the manufacturer.'
        ],
        checkIds: ['anchor-bolts']
    },

    // --- Moisture --------------------------------------------------------
    {
        id: 'treated-fasteners',
        category: 'moisture',
        title: 'Treated lumber handling',
        code: 'IRC 2021 §R317.1 · AWPA M4',
        level: 'recommended',
        summary: 'Treated lumber is wet when it arrives, so stack it to drain, cut and drill with sharp tools, and field-treat every cut end. Do not let treated sawdust build up in a closed space.',
        requirements: [
            'Stack with stickers so air reaches every face.',
            'Field-treat cut ends, notches and drill holes.',
            'Wear the manufacturer’s recommended protection when cutting.',
            'Expect some shrinkage and checking as the board dries in service.'
        ],
        checkIds: ['treated-contact']
    },
    {
        id: 'drainage-clearance',
        category: 'moisture',
        title: 'Clearance from grade and drainage',
        code: 'IRC 2021 §R317.1.1 · §R703.1.1',
        level: 'required',
        summary: 'Keep wood framing at least 8 in above grade, slope the ground away from the wall and let the wall base drain. Wet framing is where rot and mould begin.',
        requirements: [
            '8 in minimum from the bottom plate to grade.',
            '6 in from siding to grade, 2 in for masonry veneer.',
            'Slope the finished grade away from the foundation.',
            'Do not bury a treated plate to solve a grade problem.'
        ],
        checkIds: ['treated-contact']
    },

    // --- Inspection ------------------------------------------------------
    {
        id: 'framing-inspection',
        category: 'inspection',
        title: 'Framing inspection before closing',
        code: 'IRC 2021 §R109.1 · §R602.3',
        level: 'required',
        summary: 'The framing inspection happens after the walls, floor and roof framing are complete and before insulation or sheathing closes the cavities. The inspector checks grade marks, spacing, connections, blocking, bracing and the stamp on every engineered member.',
        requirements: [
            'Have the approved plan and truss or engineered-member drawings on site.',
            'Leave the grading, bracing and anchor details visible.',
            'Fix any cut or notched member before the inspection.',
            'Do not install insulation before the framing and rough-in inspections sign off.'
        ],
        checkIds: ['framing-inspection']
    },
    {
        id: 'tolerance',
        category: 'inspection',
        title: 'Square, plumb and level tolerance',
        code: 'IRC 2021 §R602.3 · good practice',
        level: 'recommended',
        summary: 'Walls are plumb and straight within 1/4 in in 8 ft, floors level within 1/4 in in 10 ft, and the diagonals of a rectangular platform are equal before the next storey goes up.',
        requirements: [
            'Measure the diagonals of every platform before sheathing.',
            'Plumb each wall panel and brace it until the sheathing locks it.',
            'Keep the top plate straight; a dip telegraphs into the floor above.',
            'Record the as-built dimensions for the next trade.'
        ],
        checkIds: ['square']
    }
];

export const RULES_BY_ID = Object.fromEntries(RULES.map((rule) => [rule.id, rule]));

/** How a rule stands against the design's checks. */
export function ruleStatus(rule, checks = []) {
    const ids = new Set(rule?.checkIds || []);
    const hits = (checks || []).filter((check) => ids.has(check.id));
    if (hits.some((check) => check.severity === 'error')) {
        return { state: 'error', label: 'Fails', hits };
    }
    if (hits.some((check) => check.severity === 'warn')) {
        return { state: 'warn', label: 'Review', hits };
    }
    if (hits.some((check) => check.severity === 'ok')) {
        return { state: 'ok', label: 'Passes', hits };
    }
    return { state: 'info', label: 'Not checked', hits: [] };
}

export function searchRules(query = '') {
    const term = String(query || '').trim().toLowerCase();
    if (!term) return [...RULES];
    return RULES.filter((rule) => [rule.id, rule.title, rule.code, rule.summary, ...(rule.requirements || [])]
        .join(' ')
        .toLowerCase()
        .includes(term));
}

export const FORMULAS = [
    {
        label: 'Stud count',
        expression: 'N = ceil(run ÷ spacing) + 1, plus king and jack studs at each opening',
        note: 'Start the layout from one end and keep the last stud at the far end, never a narrow sliver.'
    },
    {
        label: 'Precut stud length',
        expression: 'L = wall height − bottom plate − top plates',
        note: 'A 92½ in stud + 1½ in sole + 2 × 1½ in top = 97 in (8 ft 1 in) wall.'
    },
    {
        label: 'Header bending',
        expression: 'M = wL² ÷ 8, S = bd² ÷ 6, Fb = M ÷ S ≤ Fb′',
        note: 'w is the uniform load from the floor or roof above, in lb per foot of header.'
    },
    {
        label: 'Header deflection',
        expression: 'Δ = 5wL⁴ ÷ (384EI) ≤ L ÷ 360',
        note: 'The live-load deflection limit usually governs a long header.'
    },
    {
        label: 'Floor joist demand',
        expression: 'w = (40 psf live + 10 psf dead) × spacing (ft)',
        note: 'At 16 in on center, 1.333 ft, w = 66.7 lb/ft for a habitable floor.'
    },
    {
        label: 'Joist bending span',
        expression: 'L = √(8 × Fb′ × S ÷ w)',
        note: 'Check the section modulus for the dressed size, not the nominal size.'
    },
    {
        label: 'Joist deflection span',
        expression: 'L = ∛(384 × E × I ÷ (5 × 360 × w_live))',
        note: 'Use live load only for L/360; total load for L/240.'
    },
    {
        label: 'Sheathing sheets',
        expression: 'sheets = ceil(length × height × (1 + waste) ÷ sheet area)',
        note: 'A 4 × 8 ft sheet is 32 ft²; order the next whole sheet, not the exact area.'
    },
    {
        label: 'Braced length',
        expression: 'Braced length ≥ percentage of wall line, at least one 48 in panel',
        note: 'Table R602.10.3(1) sets the percentage by method, storeys, exposure and seismic category.'
    }
];

/** The two wall systems the suite compares. */
export const FRAMING_SYSTEMS = [
    {
        id: 'platform',
        label: 'Platform (western) framing',
        default: true,
        summary: 'Each storey is a platform: the walls are framed one storey high on the floor deck, sheathed, raised, and the next floor sits on their top plates. It is the standard method for new light-frame housing.',
        points: [
            'Studs are one storey high, so standard 8 to 10 ft boards work.',
            'The floor platform is a natural fire stop at every level.',
            'Each storey has its own shear wall and diaphragm, which is easier to detail for wind and seismic.',
            'Walls are built flat on the deck, which is faster and safer than raising long studs.'
        ],
        watch: [
            'More joints, so a little more vertical shrinkage; details must allow for it.',
            'The platform must be square and level before the next storey starts.',
            'Each floor-to-wall connection needs its own tie.'
        ]
    },
    {
        id: 'balloon',
        label: 'Balloon framing',
        default: false,
        summary: 'Studs run continuously from the foundation to the roof, and each floor hangs from the studs. Historic and some tall-wall work; it needs explicit fire blocking and a designed floor-to-stud connection.',
        points: [
            'Fewer joints and less vertical shrinkage, which suits tall plaster walls.',
            'Long studs are scarce, costly and harder to raise safely.',
            'Wall cavities form a continuous chimney, so fire blocking is mandatory at every floor.',
            'Floor joists hang from the studs rather than bearing on a plate.'
        ],
        watch: [
            'Fire blocking at every floor line, full depth of the cavity.',
            'Long, slender wall segments need extra bracing and hold-downs.',
            'Modern residential code is written around platform framing; get an engineer for balloon.'
        ]
    }
];

/** The order a crew actually builds in, from the slab to dry-in. */
export const BUILD_SEQUENCE = [
    {
        step: '1',
        title: 'Verify the foundation and set out the plan',
        detail: 'Check level and square, measure both diagonals, snap the wall lines and confirm the anchor bolt layout before any lumber arrives.'
    },
    {
        step: '2',
        title: 'Sill plate and floor platform',
        detail: 'Set the treated sill on the sill seal, anchor it, rim the platform, lay the joists at 16 or 24 in, block or bridge, then glue and screw the subfloor.'
    },
    {
        step: '3',
        title: 'Frame and raise the walls',
        detail: 'Build each wall flat: sole plate, studs at 16 in, king and jack studs, headers, cripples, a double top plate. Sheathe the exterior face, tip the panel up, brace it and nail it down.'
    },
    {
        step: '4',
        title: 'Sheathe, brace and tie',
        detail: 'Complete the structural sheathing and the water-resistive barrier, install hold-downs and lateral ties, and keep the temporary bracing until the box is closed.'
    },
    {
        step: '5',
        title: 'Second-floor platform and repeat',
        detail: 'Set the next floor joists on the top plates, rim and deck them, then repeat the wall sequence. Check the diagonals at every level.'
    },
    {
        step: '6',
        title: 'Roof framing',
        detail: 'Set trusses at 24 in on center or cut stick rafters against a ridge board, add collar ties and rafter ties, then sheathe and dry in.'
    },
    {
        step: '7',
        title: 'Inspections and dry-in',
        detail: 'Framing, sheathing and anchor inspections happen before insulation. Record the as-built dimensions and photographs before the walls are closed.'
    }
];

/** Grading table used by the review sheet. */
export const GRADE_TABLE = [
    { grade: 'Select Structural', use: 'Heavy headers, exposed beams', fb: '1,500–2,000 psi', e: '1.7–2.4 × 10⁶ psi' },
    { grade: 'No. 1', use: 'Joists, rafters, headers', fb: '1,000–1,500 psi', e: '1.3–1.7 × 10⁶ psi' },
    { grade: 'No. 2', use: 'General framing (the workhorse)', fb: '725–1,100 psi', e: '1.1–1.6 × 10⁶ psi' },
    { grade: 'No. 3 / Utility', use: 'Blocking, plates, non-critical', fb: '500–750 psi', e: '0.9–1.1 × 10⁶ psi' }
];

/** Component glossary: walls, floors and roofs, as used on site. */
export const GLOSSARY = [
    { term: 'Stud', category: 'wall', short: 'A vertical 2x4 or 2x6 that carries the wall and the load above.', detail: 'Common studs run between the sole plate and the top plate; king and jack studs frame the openings.' },
    { term: 'Sole / bottom plate', category: 'wall', short: 'The horizontal member the studs stand on.', detail: 'Treated where it touches concrete or masonry. Cut away at door openings; continuous under windows.' },
    { term: 'Top plate', category: 'wall', short: 'The horizontal member at the top of the studs.', detail: 'Usually doubled so the second layer laps corners and partitions and ties the wall together.' },
    { term: 'King stud', category: 'wall', short: 'The full-height stud beside an opening.', detail: 'Runs from sole plate to top plate and is nailed to the header end and the trimmer.' },
    { term: 'Trimmer / jack stud', category: 'wall', short: 'The shorter stud that carries the header.', detail: 'Cut to the opening height, fixed to the king stud, and the header bears on it.' },
    { term: 'Cripple stud', category: 'wall', short: 'A short stud above a header or below a sill.', detail: 'Keeps the 16 in stud rhythm and carries the sheathing across the opening.' },
    { term: 'Header', category: 'wall', short: 'The beam over a door or window opening.', detail: 'Usually two or three plies of 2x lumber, sized for the span and the load above; an LVL where sawn lumber runs out.' },
    { term: 'Rough opening', category: 'wall', short: 'The framed hole the window or door fits into.', detail: 'Slightly larger than the unit for shims, flashing and squaring.' },
    { term: 'Rough sill', category: 'wall', short: 'The horizontal member at the bottom of a window opening.', detail: 'Supported by cripples and flashed with a sloped sill pan so water drains out.' },
    { term: 'Blocking', category: 'wall', short: 'Short horizontal pieces between studs.', detail: 'Provides a nailing surface, braces the studs, and acts as fire blocking at floor and ceiling lines.' },
    { term: 'Sheathing', category: 'wall', short: 'The panel skin fixed to the outside of the frame.', detail: 'OSB or plywood in 4 x 8 ft sheets; structural sheathing is also the braced wall panel.' },
    { term: 'House wrap', category: 'wall', short: 'The water-resistive barrier over the sheathing.', detail: 'Lapped shingle-fashion and flashed at every opening; it drains water that gets behind the cladding.' },
    { term: 'Hold-down', category: 'bracing', short: 'A metal tie that resists uplift and overturning at a wall end.', detail: 'Connects the stud pack to the floor or foundation; the manufacturer’s anchor and nail schedule is mandatory.' },
    { term: 'Anchor bolt', category: 'bracing', short: 'The bolt cast into the foundation that holds the sill plate.', detail: '½ in diameter, 7 in embedment, 6 ft maximum spacing and 12 in from each plate end.' },
    { term: 'Floor joist', category: 'floor', short: 'A horizontal beam that carries the floor load.', detail: 'Sized by span, spacing and species; 40 psf live and L/360 deflection for habitable rooms.' },
    { term: 'Rim / header joist', category: 'floor', short: 'The band joist around the edge of a floor.', detail: 'Closes the platform, straightens the joist ends and carries the wall above to the foundation.' },
    { term: 'Girder', category: 'floor', short: 'A large beam that carries several joists.', detail: 'Supported on posts, walls or piers, and sized as a beam rather than a joist.' },
    { term: 'Subfloor', category: 'floor', short: 'The structural panel over the joists.', detail: 'Glued and screwed, long dimension across the joists, joints staggered and edges gapped.' },
    { term: 'Bridging', category: 'floor', short: 'Cross-bracing or solid blocking between joists.', detail: 'Stops the joists rolling and spreads a point load to its neighbours.' },
    { term: 'Rafter', category: 'roof', short: 'A sloping member that forms the roof plane.', detail: 'Cut with a bird’s mouth to sit on the top plate; paired with a ridge board or a truss.' },
    { term: 'Ridge board', category: 'roof', short: 'The horizontal board at the peak.', detail: 'A alignment member, not a beam: the opposing rafters push against each other, not down on the ridge.' },
    { term: 'Bird’s mouth', category: 'roof', short: 'The V-notch where a rafter meets the wall.', detail: 'The seat cut bears on the top plate and the plumb cut sits against the outside face.' },
    { term: 'Collar tie', category: 'roof', short: 'A horizontal tie between opposing rafters.', detail: 'Raises the effective rafter span and resists spreading; not a substitute for a proper ridge or rafter tie.' },
    { term: 'Purlins', category: 'roof', short: 'Horizontal members that support rafters or roof deck.', detail: 'Common in timber framing and where a rafter span needs a mid-point support.' },
    { term: 'Truss', category: 'roof', short: 'A prefabricated triangulated roof or floor unit.', detail: 'Delivered with an engineered drawing; set at 24 in on center and braced before loading.' },
    { term: 'Load-bearing wall', category: 'structure', short: 'A wall that carries load from above.', detail: 'Requires continuous studs, a proper header at openings and a load path to the foundation.' },
    { term: 'Non-load-bearing wall', category: 'structure', short: 'A partition that carries only itself.', detail: 'Still needs a top plate and end nailing; removing one can still damage finishes and services.' },
    { term: 'Toenailing', category: 'structure', short: 'Driving a nail at an angle to join two members.', detail: 'Useful for blocking and plates, but not a substitute for the specified end nailing on a bearing connection.' },
    { term: 'Platform framing', category: 'system', short: 'One-storey studs on a floor deck at every level.', detail: 'The standard modern method: each floor is a platform, a diaphragm and a fire stop.' },
    { term: 'Balloon framing', category: 'system', short: 'Continuous studs from foundation to roof.', detail: 'Historic method; needs fire blocking at every floor and an engineered floor-to-stud connection.' },
    { term: 'Shrinkage', category: 'system', short: 'The small loss in member depth as lumber dries.', detail: 'More joints means more shrinkage; platform framing allows for it in the finished details.' },
    { term: 'Span', category: 'structure', short: 'The distance between supports.', detail: 'For a joist or header, the clear span plus bearing; the number that decides the member size.' },
    { term: 'On center (OC)', category: 'structure', short: 'The repeated spacing from the centre of one member to the next.', detail: '16 in OC is the residential default for walls and floors; 24 in OC for roofs and some floors.' },
    { term: 'SIP', category: 'system', short: 'Structural insulated panel: foam core between two skins.', detail: 'Panels replace the stud wall and sheathing; connections and fire performance follow the manufacturer and the code evaluation report.' },
    { term: 'Dry-in', category: 'sequence', short: 'The point where the roof and walls keep the weather out.', detail: 'Sheathing, underlayment, flashing and windows are complete; rough-ins can start without rain damage.' },
    { term: 'Fire blocking', category: 'fire', short: 'Material that closes a concealed cavity at a floor or ceiling line.', detail: 'Stops a wall cavity acting as a chimney; required at every floor line in balloon framing.' }
];
