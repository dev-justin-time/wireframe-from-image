/**
 * Roof glossary - every term the roof suite uses, grouped the way roofers,
 * inspectors and adjusters group them. The reference tab renders this data and
 * the page search matches term, alias and definition, so nothing in the list is
 * decoration: quantities in the takeoff and the checks cite these entries.
 */
export const ROOF_GLOSSARY = [
    // --- Structural -------------------------------------------------
    { term: 'Deck', aka: 'Sheathing', category: 'Structural', definition: 'The structural surface - plywood or OSB - nailed to the rafters or trusses that forms the base for every roofing layer.', detail: '7/16 in (11 mm) OSB at 24 in o.c., 15/32 in (12 mm) at 24 in o.c. with a heavier covering, 19/32 in (15 mm) where tile or a walkable surface is expected.' },
    { term: 'Rafter', aka: 'Common rafter', category: 'Structural', definition: 'A framing member running from the ridge or eave that supports the roof deck, one slope at a time.', detail: 'Cut on site; a truss replaces pairs of rafters plus a ceiling joist with one engineered frame.' },
    { term: 'Truss', aka: 'Roof truss', category: 'Structural', definition: 'A prefabricated triangular framework - top chords, bottom chord and webs - engineered to span between walls and carry the roof.', detail: 'Spacing is normally 24 in (610 mm) o.c. for shingle and 16 in (400 mm) for tile or snow country.' },
    { term: 'Ridge', aka: 'Roof ridge', category: 'Structural', definition: 'The highest horizontal line where two sloping roof planes meet.', detail: 'Covered by a ridge cap and, when vented, by a ridge vent.' },
    { term: 'Eave', aka: 'Eaves', category: 'Structural', definition: 'The lower horizontal edge of a sloped roof that overhangs the exterior wall.', detail: 'Carries the gutter, fascia, soffit, drip edge and the first course of covering.' },
    { term: 'Gable', aka: 'Gable end', category: 'Structural', definition: 'The triangular upper part of a wall that closes the end of a ridged roof; also the two-plane roof form that produces it.', detail: 'The gable wall is finished with siding and a rake trim; it is not a roof plane.' },
    { term: 'Hip', aka: 'Hip roof', category: 'Structural', definition: 'An external angle where two sloping planes meet over a corner; a hip roof has four planes and no gable ends.', detail: 'Self-bracing and wind-resistant, at the cost of four hips to flash and cap.' },
    { term: 'Rake', aka: 'Rake edge', category: 'Structural', definition: 'The sloped edge of a roof along a gable end, running from eave to ridge.', detail: 'Gets rake trim and drip edge; its length is counted separately from the eave in the takeoff.' },
    { term: 'Soffit', aka: 'Eave soffit', category: 'Structural', definition: 'The finished underside of the eaves, often perforated or fitted with vents for attic intake air.', detail: 'Vented soffit supplies roughly half the net free vent area in a balanced roof.' },
    { term: 'Fascia', aka: 'Fascia board', category: 'Structural', definition: 'The vertical board along the roof edge to which the gutter is mounted; it closes the rafter tails and gives the eave a finished line.', detail: 'Usually 1 × 6 or 2 × 6; it must be sound before a gutter hanger is fixed.' },
    { term: 'Overhang', aka: 'Eave overhang', category: 'Structural', definition: 'The part of the roof that extends beyond the exterior wall.', detail: '500 mm is typical; beyond about 900 mm the lookout or truss cantilever needs checking.' },
    { term: 'Parapet', aka: 'Parapet wall', category: 'Structural', definition: 'A low wall around the perimeter of a flat or low-slope roof, used for safety, screening and to hide the roof edge.', detail: 'Needs counter flashing into the wall and a coping cap over the top.' },
    { term: 'Valley', aka: 'Roof valley', category: 'Structural', definition: 'The internal angle formed where two sloping planes meet, which collects and directs runoff.', detail: 'The highest-volume part of the roof; lined with valley metal or a membrane before the covering.' },

    // --- Waterproofing and flashing --------------------------------
    { term: 'Flashing', aka: 'Roof flashing', category: 'Waterproofing & flashing', definition: 'Thin metal or membrane installed at joints, penetrations and intersections to stop water entering the roof assembly.', detail: 'The most common leak point is a badly lapped flashing, not the field covering.' },
    { term: 'Drip edge', aka: 'Eave trim', category: 'Waterproofing & flashing', definition: 'An L-shaped metal strip along eaves and rakes that sheds water clear of the fascia and into the gutter.', detail: 'Laps 75–100 mm, fixed every 300 mm, underlayment over the eave leg and covering over the roof leg.' },
    { term: 'Step flashing', aka: 'Wall flashing', category: 'Waterproofing & flashing', definition: 'Individual bent metal pieces interlocked with the shingle courses where a roof meets a wall or chimney side.', detail: 'One piece per course, 100 mm up the wall and 100 mm onto the roof, lapped 50 mm.' },
    { term: 'Counter flashing', aka: 'Cap flashing', category: 'Waterproofing & flashing', definition: 'Flashing embedded into a wall, parapet or chimney that laps over and protects the top edge of base flashing.', detail: 'Reglet-cut 25 mm into masonry and sealed, or surface-mounted with a sealant bead.' },
    { term: 'Apron flashing', aka: 'Chimney apron', category: 'Waterproofing & flashing', definition: 'The flashing across the low or front face of a chimney or dormer, directing water away from the roof joint.', detail: 'Works with step flashing on the sides and a cricket or backer flashing uphill.' },
    { term: 'Underlayment', aka: 'Roofing felt', category: 'Waterproofing & flashing', definition: 'A water-resistant or waterproof barrier between the deck and the covering, protecting the deck from wind-driven rain and condensation.', detail: 'Synthetic weighs far less and tears less than felt; it is the default on this suite.' },
    { term: 'Ice and water shield', aka: 'Ice dam membrane', category: 'Waterproofing & flashing', definition: 'A self-adhering waterproof membrane used at eaves, valleys and penetrations in cold climates to stop ice-dam backup.', detail: 'At least 900 mm measured up the slope from the exterior wall line, plus valleys and around penetrations.' },
    { term: 'Cricket', aka: 'Chimney cricket', category: 'Waterproofing & flashing', definition: 'A small peaked saddle built on the uphill side of a chimney or wide penetration to split water and snow around it.', detail: 'Required above roughly 750 mm chimney width, and always where snow can collect.' },
    { term: 'Gutter apron', aka: 'Gutter flashing', category: 'Waterproofing & flashing', definition: 'A metal strip under the first shingle course that turns down into the gutter, carrying water past the fascia.', detail: 'Fitted over the underlayment and under the starter strip, with the drip edge below it.' },
    { term: 'Kickout flashing', aka: 'Diverter flashing', category: 'Waterproofing & flashing', definition: 'A small angled flashing at the bottom of a roof-to-wall joint or valley that throws water clear of the wall and into the gutter.', detail: 'Missing kickouts stain and rot the wall corner below the roof line.' },

    // --- Coverings and materials -----------------------------------
    { term: 'Square', aka: 'Roofing square', category: 'Shingles & materials', definition: 'The unit of roof area: 100 square feet, about 9.29 m². Shingles, tile and labour are priced per square.', detail: 'A 10 × 14 m footprint at 6:12 is about 12.6 squares of actual roof surface.' },
    { term: 'Asphalt shingle', aka: 'Composition shingle', category: 'Shingles & materials', definition: 'A fiberglass or organic mat coated in asphalt and surfaced with granules - the most common residential covering in North America.', detail: 'Rated from 2:12 with a doubled underlayment; 4:12 and above is the normal range.' },
    { term: 'Architectural shingle', aka: 'Dimensional shingle', category: 'Shingles & materials', definition: 'A laminated, multi-layer asphalt shingle that gives a dimensional, textured look and a longer warranty than a three-tab.', detail: 'Typically 30–50 year limited warranty, 3 bundles per square, 10–15 kg/m².' },
    { term: '3-tab shingle', aka: 'Strip shingle', category: 'Shingles & materials', definition: 'A flat, single-layer asphalt shingle with cut tabs, cheaper and shorter-lived than architectural shingles.', detail: 'About 20–25 years; still the reference product for budget tear-offs.' },
    { term: 'Granules', aka: 'Mineral granules', category: 'Shingles & materials', definition: 'Small coloured mineral stones embedded in the shingle surface for UV protection, fire resistance and colour.', detail: 'Granule loss in gutters is the first sign of an ageing shingle.' },
    { term: 'Metal roofing', aka: 'Standing seam / screw-through', category: 'Shingles & materials', definition: 'Roofing made from steel, aluminium or copper, usually in panels or tiles, with long service life and low weight.', detail: 'Screw-through panels from 3:12, standing seam from 1:12; needs closure strips and gasketed fasteners.' },
    { term: 'Modified bitumen', aka: 'Mod-bit', category: 'Shingles & materials', definition: 'A rolled roofing membrane of asphalt modified with SBS or APP rubber and reinforced with polyester or fiberglass.', detail: 'Heat-welded or self-adhered, typically two plies on low-slope roofs.' },
    { term: 'Built-up roof', aka: 'BUR, tar and gravel', category: 'Shingles & materials', definition: 'A low-slope roof built from alternating layers of asphalt and reinforcing ply sheets, finished with gravel or a cap sheet.', detail: 'Three or four plies; the ply count is the layer count, not the sheet count.' },
    { term: 'Single-ply membrane', aka: 'TPO / EPDM / PVC', category: 'Shingles & materials', definition: 'A roofing system whose principal component is one synthetic sheet - TPO, EPDM or PVC - seamed and fastened over the deck.', detail: 'Light, fast and common on flat roofs; seams and penetrations carry the risk.' },
    { term: 'Roll roofing', aka: 'Rolled roofing', category: 'Shingles & materials', definition: 'A low-cost rolled asphalt product for low-slope roofs, sheds and simple structures.', detail: 'Usually one or two plies, 1:12 to 2:12, with laps sealed in asphalt cement.' },
    { term: 'Synthetic underlayment', aka: 'Synthetic felt', category: 'Shingles & materials', definition: 'An engineered woven or non-woven underlayment with higher tear strength and lower weight than traditional felt.', detail: 'Typically 10 squares per roll and slip-resistant when wet.' },
    { term: 'Felt', aka: 'Tar paper', category: 'Shingles & materials', definition: 'Asphalt-saturated paper or fiberglass underlayment, graded by weight: 15 lb or 30 lb per 100 ft².', detail: '30 lb felt is the historic standard under shingles on slopes above 4:12.' },

    // --- Installation and maintenance ------------------------------
    { term: 'Pitch', aka: 'Slope', category: 'Installation & maintenance', definition: 'The steepness of the roof, expressed as vertical rise per 12 units of horizontal run, e.g. 4:12.', detail: 'Angle = atan(pitch / 12); a 6:12 roof is 26.57° and multiplies plan area by 1.118.' },
    { term: 'Tear-off', aka: 'Strip', category: 'Installation & maintenance', definition: 'Removing old roofing down to the deck before installing new materials.', detail: 'Adds labour per square and reveals deck repairs; required by most manufacturers for a full warranty.' },
    { term: 'Overlay', aka: 'Re-cover', category: 'Installation & maintenance', definition: 'Installing new shingles directly over an existing layer without a tear-off.', detail: 'Limited to two layers in most codes and usually voids or shortens the material warranty.' },
    { term: 'Starter strip', aka: 'Starter course', category: 'Installation & maintenance', definition: 'The first course of shingles along the eave, sealing the bottom edge and resisting wind uplift.', detail: 'One bundle covers about 32 lin m; it is not counted as a field square.' },
    { term: 'Ridge cap', aka: 'Hip and ridge', category: 'Installation & maintenance', definition: 'Special shingles or metal pieces that cover the ridge and hips, sealing the joint where two planes meet.', detail: 'About 35 lin ft per bundle for shingle cap; hips use the same product.' },
    { term: 'Vent boot', aka: 'Pipe boot, vent collar', category: 'Installation & maintenance', definition: 'A rubber or metal collar placed over a vent pipe where it passes through the roof to create a watertight seal.', detail: 'The rubber collar perishes first; it is the cheapest and most neglected repair on a roof.' },
    { term: 'Racking', aka: 'Vertical installation', category: 'Installation & maintenance', definition: 'An incorrect method where shingle courses are run vertically up the roof instead of staggered horizontally.', detail: 'It leaves continuous vertical joints that water can follow; visible as a staircase pattern.' },
    { term: 'Blistering', aka: 'Shingle blister', category: 'Installation & maintenance', definition: 'Bubbles on the surface of asphalt roofing caused by trapped moisture or a manufacturing defect.', detail: 'Small blisters are cosmetic; open ones that expose the mat need replacement.' },
    { term: 'Ponding', aka: 'Standing water', category: 'Installation & maintenance', definition: 'Water that remains on a low-slope roof 48 hours after rain, adding load and shortening membrane life.', detail: 'Below 0.25:12 the membrane must be continuous and the structure designed for the extra load.' },
    { term: 'Hail damage', aka: 'Hail bruising', category: 'Installation & maintenance', definition: 'Dents or bruises on shingles from hailstones that break the granule layer and the mat beneath.', detail: 'Class 4 impact-resistant shingles may earn an insurance discount; insurers distinguish functional from cosmetic damage.' },
    { term: 'Ice dam', aka: 'Ice ridge', category: 'Installation & maintenance', definition: 'A ridge of ice at the roof edge that traps melting snow, forcing water back up under the shingles.', detail: 'Prevented by air sealing, insulation, balanced ventilation and eave ice-and-water shield.' },
    { term: 'Attic ventilation', aka: 'Roof ventilation', category: 'Installation & maintenance', definition: 'Intake and exhaust airflow that keeps the attic close to outdoor temperature and removes moisture.', detail: 'Code minimum is 1:150 of vent area to roof area, or 1:300 when intake and exhaust are balanced.' },

    // --- Financial and insurance -----------------------------------
    { term: 'ACV', aka: 'Actual cash value', category: 'Financial & insurance', definition: 'An insurance settlement paying the depreciated value of the damaged roof rather than the cost of a new one.', detail: 'ACV = RCV − depreciation; the gap is often recovered once the work is complete.' },
    { term: 'RCV', aka: 'Replacement cost value', category: 'Financial & insurance', definition: 'An insurance settlement that covers the full cost of replacing the roof with new materials of like kind and quality.', detail: 'Most policies pay ACV first and release the withheld depreciation after completion.' },
    { term: 'AOB', aka: 'Assignment of benefits', category: 'Financial & insurance', definition: 'A legal agreement transferring a homeowner’s insurance claim rights to the roofing contractor.', detail: 'Restricted or banned in several states; it changes who negotiates and who is paid.' },
    { term: 'Roofing inspection', aka: 'Roof inspection', category: 'Financial & insurance', definition: 'A documented evaluation of roof condition, often required before repair, replacement or an insurance claim.', detail: 'A useful report records slope, layers, deck condition, flashing, ventilation and photographs of damage.' },
    { term: 'Warranty', aka: 'Material and workmanship warranty', category: 'Financial & insurance', definition: 'The written promise from a manufacturer or contractor covering material defects or workmanship.', detail: 'Material warranties are pro-rated and conditional; workmanship coveralls are typically 1–10 years.' },

    // --- Additional common terms -----------------------------------
    { term: 'Dormer', aka: 'Roof dormer', category: 'Additional terms', definition: 'A windowed structure projecting from a sloped roof plane to add light, headroom or a usable floor area.', detail: 'A dormer creates two valleys, two side walls of step flashing and a small roof of its own.' },
    { term: 'Shed roof', aka: 'Mono-pitch roof', category: 'Additional terms', definition: 'A single-plane roof falling from a high wall to a low wall, common on additions, porches and outbuildings.', detail: 'One plane means one eave, two rakes and no ridge cap or ridge vent.' },
    { term: 'Low-slope roof', aka: 'Flat roof', category: 'Additional terms', definition: 'A roof below 2:12, which needs a membrane or built-up system rather than shingles.', detail: 'Between 0.25:12 and 2:12 most codes require two plies or a single-ply membrane.' },
    { term: 'Dead valley', aka: 'Blind valley', category: 'Additional terms', definition: 'A valley configuration where water cannot drain freely, so it ponds or backs up against a wall.', detail: 'Needs a widened valley, a drain or a redesigned cricket; a common cause of repeat leaks.' },
    { term: 'Exposed-nail method', aka: 'Face-nailing', category: 'Additional terms', definition: 'A roofing application where fasteners remain visible and exposed to weather, used on agricultural or low-cost buildings.', detail: 'Fastener heads must be sealed; not accepted for architectural shingles or tile.' },
    { term: 'Ply', aka: 'Layer', category: 'Additional terms', definition: 'One layer of roofing material; a two-ply membrane has two layers, a three-ply BUR three.', detail: 'Ply count drives both weight and the number of reinforcing sheets in the takeoff.' },
    { term: 'BTU', aka: 'British thermal unit', category: 'Additional terms', definition: 'The heat needed to raise one pound of water by one degree Fahrenheit; used to describe insulation and heat flow.', detail: '1 BTU ≈ 1.055 kJ. Roof insulation is usually specified by R-value rather than BTU.' },
    { term: 'R-value', aka: 'Thermal resistance', category: 'Additional terms', definition: 'A measure of resistance to heat flow; higher values insulate better.', detail: 'R-38 to R-60 is typical for a vented attic; the roof assembly must still dry to the outside.' },
    { term: 'Vapor barrier', aka: 'Vapour retarder', category: 'Additional terms', definition: 'A material that limits moisture vapour passing into the roof or attic assembly.', detail: 'In cold climates it goes on the warm side of the insulation; a vented roof often relies on air sealing instead.' },
    { term: 'Batten', aka: 'Counter batten', category: 'Additional terms', definition: 'A strip of wood or metal fixed across the rafters to support tile or metal roofing and create a drainage and ventilation gap.', detail: 'Tile needs battens at the gauge of the course; metal needs a continuous substrate or purlins.' }
];

export const GLOSSARY_CATEGORIES = [
    'Structural',
    'Waterproofing & flashing',
    'Shingles & materials',
    'Installation & maintenance',
    'Financial & insurance',
    'Additional terms'
];

export function glossaryByCategory() {
    return GLOSSARY_CATEGORIES.map((category) => ({
        category,
        terms: ROOF_GLOSSARY.filter((entry) => entry.category === category)
    }));
}

export function searchGlossary(query = '') {
    const q = String(query).trim().toLowerCase();
    if (!q) return ROOF_GLOSSARY;
    return ROOF_GLOSSARY.filter((entry) =>
        entry.term.toLowerCase().includes(q)
        || (entry.aka || '').toLowerCase().includes(q)
        || entry.definition.toLowerCase().includes(q)
    );
}

export function glossaryTerm(term) {
    const key = String(term).trim().toLowerCase();
    return ROOF_GLOSSARY.find((entry) =>
        entry.term.toLowerCase() === key || (entry.aka || '').toLowerCase() === key
    ) || null;
}

/** The formulas the designer applies, shown on the reference tab. */
export const ROOF_FORMULAS = [
    { label: 'Slope angle', formula: 'angle = atan(pitch / 12)', note: '6:12 → 26.57°. Pitch is rise per 12 of run.' },
    { label: 'Slope factor', formula: 'factor = √(1 + (pitch / 12)²)', note: '6:12 → 1.118; multiplies plan area into roof area.' },
    { label: 'Roof area', formula: 'area = plan area × slope factor', note: 'Hips, gables and gambrels are summed plane by plane, so overhangs count.' },
    { label: 'Squares', formula: 'squares = area (m²) ÷ 9.2903', note: 'One square = 100 ft² = 9.29 m².' },
    { label: 'Sheet count', formula: 'sheets = ⌈area × (1 + waste) ÷ 2.9768⌉', note: 'A 1220 × 2440 mm sheet is 2.98 m².' },
    { label: 'Truss count', formula: 'trusses = ⌈length ÷ spacing⌉ + 1', note: 'Plus the cross-gable run when the style is a cross.' },
    { label: 'Vent area', formula: 'NFVA ≥ area ÷ 300', note: '1:150 if intake and exhaust are not balanced.' },
    { label: 'Downspouts', formula: 'count = max(2, ⌈gutter run ÷ 12 m⌉, ⌈area ÷ capacity⌉)', note: 'Capacity is per downspout for the selected gutter profile.' },
    { label: 'Ice shield', formula: 'length = eave length, width = min(0.9 m, slope length)', note: 'Measured from the exterior wall line up the slope.' },
    { label: 'Dead load', formula: 'load = Σ(layer kg/m²)', note: 'Shingle ≈ 12, tile ≈ 45, BUR ≈ 25 kg/m²; trusses are designed for it.' }
];
