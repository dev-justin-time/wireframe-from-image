/**
 * Wall glossary - the terms the wall suite uses, grouped the way painters,
 * plasterers, tilers and siding installers group them. The suite renders this
 * list, the search matches term, alias and definition, and each check cites an
 * entry so nothing here is decoration.
 */
export const WALL_GLOSSARY = [
    // --- Paint and colour -------------------------------------------
    { term: 'Paint', aka: 'Coating', category: 'Paint & colour', definition: 'A pigmented liquid that forms a thin film on a surface, protecting it and giving it colour.', detail: 'A wall paint is a binder, pigment, solvent or water, and additives; the binder decides adhesion and washability.' },
    { term: 'Primer', aka: 'Undercoat', category: 'Paint & colour', definition: 'The first coat, formulated to bond to the substrate and give the finish coat an even surface.', detail: 'Primers seal porous surfaces, block stains and improve adhesion; they are not a substitute for a finish coat.' },
    { term: 'Sealer', aka: 'Sealing coat', category: 'Paint & colour', definition: 'A coat that closes a porous surface so the finish does not sink in or dry patchy.', detail: 'Masonry, new plaster and bare timber usually need a sealer or a primer-sealer.' },
    { term: 'Topcoat', aka: 'Finish coat', category: 'Paint & colour', definition: 'The final coat that carries the colour, sheen and washability of the job.', detail: 'Two topcoats are normal; a third is common over a strong colour change or a dark base.' },
    { term: 'Sheen', aka: 'Gloss level', category: 'Paint & colour', definition: 'How much light a dried film reflects, measured in gloss units at 60°.', detail: 'Dead flat 1–3, matte 2–5, eggshell 5–10, satin 10–25, semi-gloss 25–40, gloss 40–60.' },
    { term: 'Gloss units', aka: 'GU', category: 'Paint & colour', definition: 'The numeric reading of a paint film’s specular reflection at a stated angle.', detail: 'Manufacturers quote 60° readings; a higher number means a shinier, more washable film.' },
    { term: 'LRV', aka: 'Light reflectance value', category: 'Paint & colour', definition: 'The percentage of visible light a colour reflects, from 0 (black) to 100 (white).', detail: 'LRV is the Y value of the colour; a 25-point gap between wall and trim makes the trim read.' },
    { term: 'Undertone', aka: 'Cast', category: 'Paint & colour', definition: 'The subtle hue beneath a colour’s main tone - warm, cool, green or pink.', detail: 'Undertones shift under artificial light; sample a large patch on the actual wall.' },
    { term: 'VOC', aka: 'Volatile organic compound', category: 'Paint & colour', definition: 'Organic chemicals that evaporate from a coating as it dries, contributing to indoor air pollution.', detail: 'Interior flat paints are commonly limited to 50 g/L and non-flat to 100 g/L; check the regional rule.' },
    { term: 'Hiding power', aka: 'Opacity', category: 'Paint & colour', definition: 'A paint’s ability to obscure the colour beneath it.', detail: 'Better hiding comes from pigment volume and film build; a cheap paint often needs three coats.' },
    { term: 'Coverage rate', aka: 'Spread rate', category: 'Paint & colour', definition: 'The area one litre or one pack covers at the specified film thickness.', detail: 'Wall paint is typically 10–12 m²/L; rough or porous surfaces cut that by a third.' },
    { term: 'Tint', aka: 'Colourant', category: 'Paint & colour', definition: 'The pigment dispersion added to a base paint to make a colour.', detail: 'Deep colours use a clear or deep base; tinting a light base cannot reach them.' },
    { term: 'Burnishing', aka: 'Polishing', category: 'Paint & colour', definition: 'A shiny mark left when a low-sheen film is rubbed or scrubbed.', detail: 'Matte and dead-flat paints burnish; satin and semi-gloss resist it.' },
    { term: 'Block filler', aka: 'Masonry filler', category: 'Paint & colour', definition: 'A heavy, high-solids coat that fills the pores and pits of concrete or block before painting.', detail: 'Block filler is not a finish; it is sanded or levelled and then topcoated.' },
    { term: 'Elastomeric', aka: 'Elastomeric coating', category: 'Paint & colour', definition: 'A thick, flexible masonry coating that stretches over small cracks instead of splitting.', detail: 'Typically 6–8 m²/L and applied at 10–20 wet mils; it needs a sound, cured substrate.' },
    { term: 'Alkyd', aka: 'Oil-based enamel', category: 'Paint & colour', definition: 'A solvent-borne coating bound with an alkyd resin, hard and glossy but brittle with age.', detail: 'Alkyds yellow in the dark and need mineral spirits; water-based enamels have replaced most interior trim use.' },
    { term: 'Acrylic', aka: 'Latex paint', category: 'Paint & colour', definition: 'A water-borne coating bound with acrylic or vinyl-acrylic resin.', detail: 'Acrylics dry fast, stay flexible, clean up with water and dominate interior and exterior wall paint.' },
    { term: 'Enamel', aka: 'Enamel paint', category: 'Paint & colour', definition: 'A hard, glossy coating for trim, doors and joinery; historically alkyd, now often water-borne.', detail: 'Enamel is a film property, not a binder; a water-based enamel can be as hard as an alkyd.' },
    { term: 'Limewash', aka: 'Whitewash', category: 'Paint & colour', definition: 'A thin mineral paint of slaked lime and water that cures by carbonation.', detail: 'Breathable and alkaline; it needs a mineral substrate and re-coats easily, but chalks when touched.' },
    { term: 'Distemper', aka: 'Soft distemper', category: 'Paint & colour', definition: 'A traditional water-based paint bound with glue size, used on interior plaster.', detail: 'Not washable and rarely specified today; remove it before applying modern coatings.' },
    { term: 'Paint scheme', aka: 'Colour scheme', category: 'Paint & colour', definition: 'A coordinated set of wall, trim, ceiling and accent colours.', detail: 'The suite builds monochrome, analogous, complementary and neutral schemes around a base colour.' },
    { term: 'Harmony', aka: 'Colour harmony', category: 'Paint & colour', definition: 'The relationship between colours on the wheel that makes a scheme read as deliberate.', detail: 'Analogous uses neighbours, complementary uses opposites, monochrome uses one hue.' },

    // --- Preparation and application --------------------------------
    { term: 'Substrate', aka: 'Base surface', category: 'Preparation & application', definition: 'The material a covering is applied to - gypsum board, plaster, masonry, timber or metal.', detail: 'Every product data sheet lists approved substrates; the wrong one fails at the bond line.' },
    { term: 'Porosity', aka: 'Absorbency', category: 'Preparation & application', definition: 'How readily a substrate draws liquid in.', detail: 'Porous surfaces need priming or the finish dries patchy and starves the binder.' },
    { term: 'Adhesion', aka: 'Bond', category: 'Preparation & application', definition: 'The strength with which a coating or covering sticks to its substrate.', detail: 'Dust, grease, moisture and gloss are the four common causes of adhesion failure.' },
    { term: 'Deglossing', aka: 'Sanding for tooth', category: 'Preparation & application', definition: 'Roughening a glossy surface so a new coat can key to it.', detail: 'Use a fine abrasive or a liquid deglosser, then remove the dust before priming.' },
    { term: 'Cutting in', aka: 'Cut-in', category: 'Preparation & application', definition: 'Painting the edges, corners and trim line with a brush before rolling the field.', detail: 'Cut in a room at a time so the brush line and the roller texture melt together.' },
    { term: 'Back-rolling', aka: 'Lay-off', category: 'Preparation & application', definition: 'Rolling over a sprayed or brushed area to even the texture and remove lap marks.', detail: 'One person sprays, another follows with a roller; the finish looks uniformly stippled.' },
    { term: 'Orange peel', aka: 'Spray texture', category: 'Preparation & application', definition: 'A stippled surface texture like orange skin, sprayed or rolled onto joint compound.', detail: 'Hides minor defects; a heavy texture is hard to patch invisibly.' },
    { term: 'Knockdown', aka: 'Knock-down texture', category: 'Preparation & application', definition: 'A sprayed texture flattened with a trowel while still soft, leaving soft shadows.', detail: 'Common on production ceilings; the trowel pass is what separates it from orange peel.' },
    { term: 'Surfactant leaching', aka: 'Streaking', category: 'Preparation & application', definition: 'Water-soluble ingredients running down a fresh exterior coating after rain.', detail: 'Usually cosmetic on acrylics; rinse once cured and avoid painting before rain.' },
    { term: 'Blistering', aka: 'Bubbling', category: 'Preparation & application', definition: 'Bubbles or lifts in a paint film caused by moisture, heat or solvent trapped underneath.', detail: 'Scrape back to sound film, find the moisture source and re-prime before recoating.' },
    { term: 'Peeling', aka: 'Flaking', category: 'Preparation & application', definition: 'Loss of adhesion where the film lifts from the substrate in sheets or flakes.', detail: 'Usually moisture behind the film or poor preparation; painting over it repeats the failure.' },
    { term: 'Alligatoring', aka: 'Crocodiling', category: 'Preparation & application', definition: 'A cracked, reptile-skin pattern in an old, brittle coating.', detail: 'Remove to sound edges and prime; a flexible topcoat over brittle alkyd will re-crack.' },
    { term: 'Efflorescence', aka: 'Salt bloom', category: 'Preparation & application', definition: 'White salt crystals pushed out of masonry as water evaporates.', detail: 'Dry-brush and rinse; the cause is water in the wall, not the paint.' },
    { term: 'Mildewcide', aka: 'Fungicide', category: 'Preparation & application', definition: 'An additive or wash that inhibits mould growth on a coating or surface.', detail: 'Washing off the food source matters more than the additive; fix the damp.' },
    { term: 'Caulk', aka: 'Sealant', category: 'Preparation & application', definition: 'A flexible mastic used to close joints where two materials move differently.', detail: 'Paintable acrylic for interior trim, polyurethane or silicone for exterior movement joints.' },
    { term: 'Cure', aka: 'Curing', category: 'Preparation & application', definition: 'The chemical hardening of a coating, plaster, mortar or concrete after it has dried.', detail: 'Paint cures over days to weeks; concrete and stucco need 28 days before a tight coating.' },

    // --- Plaster and texture ----------------------------------------
    { term: 'Plaster', aka: 'Gypsum or cement plaster', category: 'Plaster & texture', definition: 'A paste of gypsum or cement, sand and water trowelled onto a wall to form a hard surface.', detail: 'Gypsum plaster is interior; cement plaster (stucco) is exterior or wet-area.' },
    { term: 'Skim coat', aka: 'Skimming', category: 'Plaster & texture', definition: 'A thin coat of joint compound or plaster trowelled over a wall to smooth it.', detail: 'Usually 1–3 mm; it is a levelling coat, not a structural repair.' },
    { term: 'Veneer plaster', aka: 'Thin-coat plaster', category: 'Plaster & texture', definition: 'A one-coat gypsum plaster applied 1/16–3/16 in thick over a special gypsum base.', detail: 'IRC R702.2.1 caps a veneer coat at 3/16 in (4.76 mm).' },
    { term: 'Venetian plaster', aka: 'Polished plaster', category: 'Plaster & texture', definition: 'A multi-coat lime or marble-dust plaster burnished to a polished, mottled finish.', detail: 'Three or more coats, sealed and waxed; sample panels are essential because colour varies by batch.' },
    { term: 'Scratch coat', aka: 'First coat', category: 'Plaster & texture', definition: 'The first stucco coat, scored to give the next coat a mechanical key.', detail: 'Applied over lath, kept damp, then the brown coat follows after at least 24 hours.' },
    { term: 'Brown coat', aka: 'Second coat', category: 'Plaster & texture', definition: 'The second stucco coat that builds thickness and straightens the wall.', detail: 'The finish coat follows after at least 48 hours on three-coat work.' },
    { term: 'Weep screed', aka: 'Foundation screed', category: 'Plaster & texture', definition: 'A perforated metal base screed at the bottom of a stucco wall that lets water out of the cavity.', detail: 'Held above grade and below the finish; block it and the wall holds water.' },
    { term: 'Control joint', aka: 'Movement joint', category: 'Plaster & texture', definition: 'A deliberate break in a stucco or render field that lets the wall move without random cracking.', detail: 'Place at storey lines, changes of substrate and long runs; seal with a flexible joint sealant.' },
    { term: 'Stucco', aka: 'Portland cement plaster', category: 'Plaster & texture', definition: 'A cement-based exterior plaster applied over lath or masonry in two or three coats.', detail: 'Three coats over lath, two over masonry; 7/8 in total over lath (IRC Table R702.1(1)).' },
    { term: 'Render', aka: 'Acrylic render', category: 'Plaster & texture', definition: 'A cement, lime or acrylic coating applied to exterior masonry to give a textured, weather-tight finish.', detail: 'Modern acrylic renders are thin, coloured and flexible but need a drained substrate.' },
    { term: 'EIFS', aka: 'Exterior insulation and finish system', category: 'Plaster & texture', definition: 'An insulated facade of foam board, mesh-reinforced base coat and textured finish.', detail: 'Over wood frame it must be drained and back-vented; a barrier EIFS traps water.' },

    // --- Wall coverings and panels ----------------------------------
    { term: 'Wallpaper', aka: 'Wall covering', category: 'Wall coverings & panels', definition: 'A printed or plain paper, vinyl or fabric sheet pasted to a wall.', detail: 'Sold by the roll, commonly 0.53 m wide by 10 m long (5.3 m²), with a pattern repeat.' },
    { term: 'Pattern repeat', aka: 'Repeat', category: 'Wall coverings & panels', definition: 'The distance before a wallpaper pattern repeats vertically or horizontally.', detail: 'A large repeat wastes more paper; add one full repeat per drop when estimating.' },
    { term: 'Sizing', aka: 'Wall size', category: 'Wall coverings & panels', definition: 'A thin glue coat applied before wallpaper so the paper slides and the paste does not soak in.', detail: 'Also makes the paper easier to strip later.' },
    { term: 'Wainscot', aka: 'Wainscoting', category: 'Wall coverings & panels', definition: 'Wood or panel lining on the lower part of an interior wall, often to chair-rail height.', detail: 'Traditional wainscot is raised panels; beadboard and shiplap are common modern versions.' },
    { term: 'Beadboard', aka: 'Beaded panel', category: 'Wall coverings & panels', definition: 'Boards with a narrow groove and bead along one edge, fixed vertically or horizontally.', detail: 'The bead hides the joint and adds a shadow line; prime the grooves before hanging.' },
    { term: 'Shiplap', aka: 'Lap board', category: 'Wall coverings & panels', definition: 'Boards with a rabbeted edge that overlap to form a tight lap.', detail: 'Usually fixed horizontally with a shadow line at each lap; acclimate before fixing.' },
    { term: 'Board and batten', aka: 'Batten wall', category: 'Wall coverings & panels', definition: 'Wide boards with narrow battens fixed over the joints.', detail: 'Interior feature wall or exterior rainscreen; the battens create a drainage and service cavity.' },
    { term: 'Panelling', aka: 'Wood paneling', category: 'Wall coverings & panels', definition: 'Sheet or board lining fixed to a wall for a decorative finish.', detail: 'IRC R702.5 covers wood veneer and hardboard paneling, backing and framing spacing.' },
    { term: 'Chair rail', aka: 'Dado rail', category: 'Wall coverings & panels', definition: 'A horizontal moulding at the top of a wainscot, protecting the wall from chair backs.', detail: 'Commonly set at 900–1100 mm; it also caps the panel and hides the top fixings.' },

    // --- Tile and masonry -------------------------------------------
    { term: 'Ceramic tile', aka: 'Wall tile', category: 'Tile & masonry', definition: 'A fired clay tile with a glazed face, used on walls and light-duty floors.', detail: 'Wall tile is thin and absorbent; use porcelain or a fully vitrified tile in wet or heavy-wear areas.' },
    { term: 'Porcelain', aka: 'Porcelain tile', category: 'Tile & masonry', definition: 'A dense, low-absorption tile fired from refined clay and feldspar.', detail: 'Harder and less absorbent than ceramic; large formats need a flat substrate and levelling clips.' },
    { term: 'Thinset', aka: 'Bond coat', category: 'Tile & masonry', definition: 'A cement-based adhesive applied with a notched trowel to bond tile to a backer.', detail: 'Mix to the data sheet, trowel in one direction and back-butter large tiles.' },
    { term: 'Grout', aka: 'Tile joint filler', category: 'Tile & masonry', definition: 'A cement or epoxy paste pressed into the joints between tiles.', detail: 'Sanded grout for joints over 3 mm, unsanded for narrow joints and polished stone.' },
    { term: 'Backer board', aka: 'Tile backer', category: 'Tile & masonry', definition: 'A water-resistant sheet fixed over framing to carry tile in wet areas.', detail: 'Fiber-cement or coated gypsum board to ASTM C1288/C1325; IRC Table R702.4.2 lists the permitted backers.' },
    { term: 'Deflection', aka: 'L/360', category: 'Tile & masonry', definition: 'How far a floor or wall assembly bends under load, expressed as a fraction of its span.', detail: 'Tile needs L/360 or stiffer; a bouncy wall cracks grout and debonds tile.' },
    { term: 'Brick veneer', aka: 'Anchored veneer', category: 'Tile & masonry', definition: 'A single wythe of brick tied to the frame with a cavity behind it.', detail: 'Needs a water-resistive barrier, 1 in airspace, flashing, weep holes and corrosion-resistant ties (IRC R703.8).' },
    { term: 'Stone veneer', aka: 'Manufactured stone', category: 'Tile & masonry', definition: 'Thin natural or manufactured stone fixed over lath and mortar or a prepared backer.', detail: 'Interior veneer needs no airspace; exterior veneer follows the anchored-veneer rules.' },
    { term: 'Weep hole', aka: 'Weep vent', category: 'Tile & masonry', definition: 'A small open joint at the base of a veneer wall that lets water out of the cavity.', detail: 'Space at 24–33 in and keep them clear of mortar; without them the cavity fills.' },

    // --- Exterior envelope ------------------------------------------
    { term: 'Water-resistive barrier', aka: 'WRB, house wrap', category: 'Exterior envelope', definition: 'A sheet or coating behind exterior cladding that stops water reaching the framing.', detail: 'IRC R703.2: one continuous layer, lapped 2 in horizontally and 6 in at joints, flashed at every opening.' },
    { term: 'Drainage plane', aka: 'Drained cavity', category: 'Exterior envelope', definition: 'The gap or textured layer behind cladding that lets water drain down and out.', detail: 'Created by furring, a rainscreen mat or a profiled WRB; required by IRC R703.1.1 in principle.' },
    { term: 'Rainscreen', aka: 'Ventilated facade', category: 'Exterior envelope', definition: 'Cladding fixed over a drained and vented cavity, so the back of the cladding can dry.', detail: 'Battens at 400–600 mm, open top and bottom, insect mesh at the openings.' },
    { term: 'Flashing', aka: 'Wall flashing', category: 'Exterior envelope', definition: 'Metal or membrane that directs water out of a wall at openings, bases and intersections.', detail: 'IRC R703.4: head, sill and jamb flashing at every opening, plus a base flashing and kick-out.' },
    { term: 'Grade clearance', aka: 'Clearance above grade', category: 'Exterior envelope', definition: 'The gap between the bottom of the cladding and the soil or paving.', detail: '6 in for siding and fiber cement, 4 in for stucco and veneer; keeps splash and snow out of the wall.' },
    { term: 'Siding', aka: 'Cladding', category: 'Exterior envelope', definition: 'The exterior skin of the wall - wood, fiber cement, vinyl, metal or masonry.', detail: 'A rainscreen or lap profile sheds most water; the WRB handles what gets behind it.' },
    { term: 'Fiber cement', aka: 'Fibre cement', category: 'Exterior envelope', definition: 'A siding and panel product of cement, sand and cellulose fibre.', detail: 'Dimensionally stable and non-combustible; cut outdoors with dust control and back-prime cuts.' },
    { term: 'Vinyl siding', aka: 'PVC cladding', category: 'Exterior envelope', definition: 'Extruded PVC laps that hang from a nailed hem and move with temperature.', detail: 'IRC R703.11; nails loose, 6 in above grade, 1/2 in clearance at trim, never caulk the laps.' },
    { term: 'EIFS', aka: 'Synthetic stucco', category: 'Exterior envelope', definition: 'An insulated facade of foam board, mesh-reinforced base coat and textured finish.', detail: 'Drained EIFS is required over wood frame; barrier EIFS is limited to masonry and protected details.' },
    { term: 'Kick-out flashing', aka: 'Diverter', category: 'Exterior envelope', definition: 'A small angled flashing at the base of a roof-to-wall joint that throws water clear of the cladding.', detail: 'Missing kick-outs rot the wall corner below the roof; the most common wall leak.' },

    // --- Performance and safety -------------------------------------
    { term: 'Vapour retarder', aka: 'Vapor barrier', category: 'Performance & safety', definition: 'A material that limits water-vapour diffusion through a wall assembly.', detail: 'IRC R702.7 classes: Class I ≤ 0.1 perm, Class II 0.1–1.0, Class III 1.0–10.0.' },
    { term: 'Perm', aka: 'Permeance', category: 'Performance & safety', definition: 'A unit of water-vapour transmission through a material.', detail: 'Lower perms mean a tighter vapour retarder; paint films are usually Class III.' },
    { term: 'Fire rating', aka: 'Fire-resistance rating', category: 'Performance & safety', definition: 'The time a wall assembly resists fire, tested as a whole system.', detail: 'IRC R302.1 sets exterior wall separation; a finish cannot be added or swapped without checking the listed assembly.' },
    { term: 'Flame spread', aka: 'Class A/B/C', category: 'Performance & safety', definition: 'How far a flame travels across a material’s surface in a standard test.', detail: 'Class A 0–25, Class B 26–75, Class C 76–200; IRC R302.9 limits interior finishes.' },
    { term: 'Lead-safe', aka: 'RRP', category: 'Performance & safety', definition: 'Work practice for disturbing paint in pre-1978 housing without spreading lead dust.', detail: 'EPA Renovation, Repair and Painting rule (40 CFR 745); containment, HEPA vacuum and certified workers.' },
    { term: 'Asbestos', aka: 'ACM', category: 'Performance & safety', definition: 'A fibrous mineral once used in plaster, texture and joint compound, now a health hazard when disturbed.', detail: 'Test pre-1980 plaster and texture before sanding; OSHA 1926.1101 governs removal.' },
    { term: 'Fall protection', aka: 'Fall arrest', category: 'Performance & safety', definition: 'Equipment and planning that stop a worker falling from height.', detail: 'OSHA 1926.501 requires protection at 6 ft on construction sites; 1926.502 sets the systems.' },
    { term: 'Scaffold', aka: 'Scaffolding', category: 'Performance & safety', definition: 'A temporary working platform for reaching high walls.', detail: 'OSHA 1926.451 covers capacity, guardrails and access; never work from the top rail.' },
    { term: 'Ventilation', aka: 'Air movement', category: 'Performance & safety', definition: 'Fresh air moving through a room or wall cavity, carrying moisture and solvent away.', detail: 'Cross-ventilate while painting and keep cavities vented so the assembly can dry.' }
];

export const WALL_GLOSSARY_CATEGORIES = [
    'Paint & colour',
    'Preparation & application',
    'Plaster & texture',
    'Wall coverings & panels',
    'Tile & masonry',
    'Exterior envelope',
    'Performance & safety'
];

export function wallGlossaryByCategory() {
    return WALL_GLOSSARY_CATEGORIES.map((category) => ({
        category,
        terms: WALL_GLOSSARY.filter((entry) => entry.category === category)
    }));
}

export function searchWallGlossary(query = '') {
    const q = String(query).trim().toLowerCase();
    if (!q) return WALL_GLOSSARY;
    return WALL_GLOSSARY.filter((entry) =>
        entry.term.toLowerCase().includes(q)
        || (entry.aka || '').toLowerCase().includes(q)
        || entry.definition.toLowerCase().includes(q)
        || (entry.detail || '').toLowerCase().includes(q)
    );
}

export function wallGlossaryTerm(term) {
    const key = String(term).trim().toLowerCase();
    return WALL_GLOSSARY.find((entry) => {
        const aliases = String(entry.aka || '').split(/[,/]/).map((part) => part.trim().toLowerCase());
        return entry.term.toLowerCase() === key || aliases.includes(key);
    }) || null;
}

/** The formulas the designer applies, shown on the reference tab. */
export const WALL_FORMULAS = [
    { label: 'Gross wall area', formula: 'gross = Σ(wall run × height)', note: 'Run is measured along the wall; per-wall heights override the storey height.' },
    { label: 'Net wall area', formula: 'net = gross − openings', note: 'Doors and windows are deducted; the takeoff buys material for the net area plus waste.' },
    { label: 'Area with waste', formula: 'net × (1 + waste)', note: '5% for paint, 10–15% for tile, paper and lap siding.' },
    { label: 'Paint quantity', formula: 'litres = net × coats ÷ coverage (m²/L)', note: 'A 3.78 L can covers roughly 40 m² at 11 m²/L.' },
    { label: 'Cans to buy', formula: 'cans = ⌈net × coats ÷ (coverage × 3.785)⌉', note: 'Round up to whole cans; tinted paint cannot be topped up from another batch.' },
    { label: 'Wallpaper rolls', formula: 'rolls = ⌈net × (1 + waste) ÷ 5.3⌉', note: 'One roll is 0.53 × 10 m = 5.3 m²; add one repeat per drop for a large pattern.' },
    { label: 'Tile boxes', formula: 'boxes = ⌈net × (1 + waste) ÷ box area⌉', note: 'Box coverage is on the carton; add 10–15% for cuts and breakage.' },
    { label: 'Siding squares', formula: 'squares = net × (1 + waste) ÷ 9.2903', note: 'One square is 100 ft²; lap siding is bought by the square.' },
    { label: 'Trim length', formula: 'trim = perimeter × (1 + waste)', note: 'Baseboard, chair rail, corner trim and weep screed are perimeter items.' },
    { label: 'LRV contrast', formula: 'contrast = |LRV(trim) − LRV(wall)|', note: 'A 25-point gap makes the trim read as a deliberate line.' },
    { label: 'Labour + prep', formula: 'labour = net × rate + prep hours × 55', note: 'Rates are illustrative; preparation is priced from the condition, not the area alone.' },
    { label: 'Cost per m²', formula: 'perM2 = (material + labour) ÷ net', note: 'Use it to compare coverings on the same wall, not across different jobs.' }
];
