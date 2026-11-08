/**
 * Subcategories + related pages for every designer page.
 *
 * Subcategories map to in-page tabs/sections where they exist
 * (`subtab` matches `.tab[data-tab]`); otherwise they deep-link to the
 * section anchor. Related pages explain WHY the systems interact, so each
 * page teaches the construction flow instead of standing alone.
 *
 * Pricing relevance lists the bid suites whose totals matter on that page.
 */

export const PAGE_SUBS = {
    'Editor.html': [
        { id: 'plan', label: 'Floorplan', subtab: null, detail: 'Walls, rooms, openings' },
        { id: 'levels', label: 'Storeys', subtab: null, detail: 'Stack + heights' },
        { id: 'finishes', label: 'Finishes', subtab: null, detail: 'Floors + walls' }
    ],
    'wall-designer.html': [
        { id: 'design', label: 'Coverings', subtab: 'design', detail: 'Paint, tile, panels' },
        { id: 'takeoff', label: 'Takeoff', subtab: 'takeoff', detail: 'Areas + waste' },
        { id: 'rules', label: 'Rules', subtab: 'rules', detail: 'Moisture + fire' }
    ],
    'framing-designer.html': [
        { id: 'plan', label: 'Plan', subtab: 'plan', detail: 'Walls + studs' },
        { id: 'elevation', label: 'Elevation', subtab: 'elevation', detail: 'Headers + kings' },
        { id: 'cutlist', label: 'Cut list', subtab: 'cutlist', detail: 'Member sizes' }
    ],
    'roof-designer.html': [
        { id: 'design', label: 'Roof form', subtab: 'design', detail: 'Style + pitch' },
        { id: 'takeoff', label: 'Takeoff', subtab: 'takeoff', detail: 'Cover + gutters' },
        { id: 'rules', label: 'Rules', subtab: 'rules', detail: 'Loads + venting' }
    ],
    'stair-designer.html': [
        { id: 'design', label: 'Straight', subtab: null, detail: 'Risers + going' },
        { id: 'l', label: 'L · quarter', subtab: null, detail: '90° winders' },
        { id: 'u', label: 'U · half', subtab: null, detail: '180° switchback' },
        { id: 'spiral', label: 'Spiral', subtab: null, detail: 'Walkline + dia' },
        { id: 'steep', label: 'Steep', subtab: null, detail: 'Alt tread + ships' }
    ],
    'stair-l-designer.html': [
        { id: 'turn', label: 'Turn', subtab: null, detail: '90° winders' },
        { id: 'plan', label: 'Plan', subtab: null, detail: 'Walkline + inside' },
        { id: 'takeoff', label: 'Takeoff', subtab: null, detail: 'CSV + add to plan' }
    ],
    'stair-u-designer.html': [
        { id: 'turn', label: 'Turn', subtab: null, detail: '180° or landing' },
        { id: 'plan', label: 'Plan', subtab: null, detail: 'Well + walkline' },
        { id: 'takeoff', label: 'Takeoff', subtab: null, detail: 'CSV + add to plan' }
    ],
    'stair-spiral-designer.html': [
        { id: 'diameter', label: 'Diameter', subtab: null, detail: 'Walkline tread' },
        { id: 'plan', label: 'Plan', subtab: null, detail: 'D × D circle' },
        { id: 'takeoff', label: 'Takeoff', subtab: null, detail: 'Column + rail' }
    ],
    'stair-steep-designer.html': [
        { id: 'device', label: 'Device', subtab: null, detail: 'Alt / ships / OSHA' },
        { id: 'plan', label: 'Plan', subtab: null, detail: 'Half-tread symbol' },
        { id: 'takeoff', label: 'Takeoff', subtab: null, detail: 'Rails both sides' }
    ],
    'plumbing-designer.html': [
        { id: 'rough', label: 'Rough-in', subtab: 'rough', detail: 'Water, DWV, gas' },
        { id: 'finish', label: 'Finish', subtab: 'finish', detail: 'Fixtures + trim' },
        { id: 'takeoff', label: 'Takeoff', subtab: 'takeoff', detail: 'Pipe + fittings' }
    ],
    'electrical-designer.html': [
        { id: 'design', label: 'Panel', subtab: 'design', detail: 'Service + main' },
        { id: 'layers', label: 'Layers', subtab: 'layers', detail: 'MEP overlay' },
        { id: 'schedule', label: 'Schedule', subtab: 'schedule', detail: 'Circuits' },
        { id: 'demand', label: 'Load calc', subtab: 'demand', detail: 'Article 220' }
    ],
    'lighting-designer.html': [
        { id: 'design', label: 'Layout', subtab: 'design', detail: 'Lights + zones' },
        { id: 'levels', label: 'Levels', subtab: 'levels', detail: 'Lux + controls' },
        { id: 'takeoff', label: 'Takeoff', subtab: 'takeoff', detail: 'Fixtures + wire' }
    ],
    'kitchen-designer.html': [
        { id: 'runs', label: 'Runs', subtab: null, detail: 'Base + tall' },
        { id: 'clearances', label: 'Clearances', subtab: null, detail: 'Work triangle' }
    ],
    'deck-designer.html': [
        { id: 'design', label: 'Framing plan', subtab: 'design', detail: 'Joists + beams' },
        { id: 'framing', label: 'Schedule', subtab: 'framing', detail: 'Members' },
        { id: 'takeoff', label: 'Takeoff', subtab: 'takeoff', detail: 'Boards + hardware' }
    ],
    'landscape-designer.html': [
        { id: 'design', label: 'Site', subtab: null, detail: 'Grading + planting' },
        { id: 'water', label: 'Water', subtab: null, detail: 'Pool, spa, runoff' }
    ],
    'foundation-designer.html': [
        { id: 'footings', label: 'Footings', subtab: 'footings', detail: 'Pads + strips' },
        { id: 'slab', label: 'Slab', subtab: 'slab', detail: 'Thickness + mesh' },
        { id: 'takeoff', label: 'Takeoff', subtab: 'takeoff', detail: 'Concrete + rebar' }
    ],
    'project-schedule.html': [
        { id: 'phases', label: 'Phases', subtab: null, detail: 'Order + durations' },
        { id: 'gantt', label: 'Timeline', subtab: null, detail: 'Bars + progress' }
    ],
    'permits-inspections.html': [
        { id: 'permits', label: 'Permits', subtab: null, detail: 'Applications' },
        { id: 'inspections', label: 'Inspections', subtab: null, detail: 'Sign-offs' }
    ],
    'price-book.html': [
        { id: 'quotes', label: 'Quotes', subtab: null, detail: 'Supplier lines' },
        { id: 'coverage', label: 'Coverage', subtab: null, detail: '% priced' }
    ],
    'bid-builder.html': [
        { id: 'lines', label: 'Lines', subtab: null, detail: 'Suite totals' },
        { id: 'proposal', label: 'Proposal', subtab: null, detail: 'Client text' }
    ],
    'project-dashboard.html': [
        { id: 'suites', label: 'Suites', subtab: null, detail: 'Status cards' },
        { id: 'flow', label: 'Flow', subtab: null, detail: 'Next stage' }
    ],
    'site-plan.html': [
        { id: 'lot', label: 'Lot', subtab: null, detail: 'Size + setbacks' },
        { id: 'house', label: 'House', subtab: null, detail: 'Drag to place' },
        { id: 'checks', label: 'Checks', subtab: null, detail: 'Coverage + CSV' }
    ],
    'plan-studio.html': [
        { id: 'create', label: 'Create', subtab: null, detail: 'Every plan card' },
        { id: 'visuals', label: 'Visuals', subtab: null, detail: 'Plan + overlay' },
        { id: 'logic', label: 'Logic', subtab: null, detail: 'Next actions' }
    ]
};

export const RELATED = {
    'Editor.html': [
        { page: 'wall-designer.html', reason: 'Cover the walls you draw' },
        { page: 'framing-designer.html', reason: 'Frame the same footprint' },
        { page: 'project-schedule.html', reason: 'Phase what you planned' }
    ],
    'wall-designer.html': [
        { page: 'framing-designer.html', reason: 'Finish follows structure' },
        { page: 'plumbing-designer.html', reason: 'Wet walls need backing' },
        { page: 'price-book.html', reason: 'Covering $/m² lives here' }
    ],
    'framing-designer.html': [
        { page: 'Editor.html', reason: 'Same footprint as plan' },
        { page: 'electrical-designer.html', reason: 'Route cable before close-up' },
        { page: 'plumbing-designer.html', reason: 'Coordinate stud bores' }
    ],
    'roof-designer.html': [
        { page: 'framing-designer.html', reason: 'Top plate + loads' },
        { page: 'foundation-designer.html', reason: 'Roof load → footings' },
        { page: 'permits-inspections.html', reason: 'Framing + roofing sign-off' }
    ],
    'stair-designer.html': [
        { page: 'stair-l-designer.html', reason: 'Quarter-turn when the run will not fit straight' },
        { page: 'stair-u-designer.html', reason: 'Switchback for tight wells' },
        { page: 'stair-spiral-designer.html', reason: 'Spiral for the smallest footprint' },
        { page: 'stair-steep-designer.html', reason: 'Steep access for lofts + plant' },
        { page: 'framing-designer.html', reason: 'Openings in the floor' },
        { page: 'permits-inspections.html', reason: 'Rise/run + rail inspection' }
    ],
    'stair-l-designer.html': [
        { page: 'stair-designer.html', reason: 'Straight baseline + Blondel comfort' },
        { page: 'stair-u-designer.html', reason: 'Need a full reversal instead' },
        { page: 'framing-designer.html', reason: 'L opening in the floor' }
    ],
    'stair-u-designer.html': [
        { page: 'stair-l-designer.html', reason: 'Only one 90° turn needed' },
        { page: 'stair-designer.html', reason: 'Straight baseline + Blondel comfort' },
        { page: 'framing-designer.html', reason: 'U opening + landing trimmer' }
    ],
    'stair-spiral-designer.html': [
        { page: 'stair-gallery.html', reason: 'Compare manufactured spiral models' },
        { page: 'stair-designer.html', reason: 'Straight baseline when space allows' },
        { page: 'permits-inspections.html', reason: 'Spiral egress limits' }
    ],
    'stair-steep-designer.html': [
        { page: 'stair-gallery.html', reason: 'Alternating + ships models in 3D' },
        { page: 'stair-designer.html', reason: 'Full-comfort stair when space allows' },
        { page: 'permits-inspections.html', reason: 'Steep devices are not egress' }
    ],
    'plumbing-designer.html': [
        { page: 'electrical-designer.html', reason: 'Avoid pipe + cable clashes' },
        { page: 'foundation-designer.html', reason: 'Underslab + invert levels' },
        { page: 'permits-inspections.html', reason: 'Rough + top-out inspection' }
    ],
    'electrical-designer.html': [
        { page: 'lighting-designer.html', reason: 'Circuits feed lights' },
        { page: 'framing-designer.html', reason: 'Bore + notch limits' },
        { page: 'bid-builder.html', reason: '$/circuit rolls into bid' }
    ],
    'lighting-designer.html': [
        { page: 'electrical-designer.html', reason: 'Shares panel + circuits' },
        { page: 'kitchen-designer.html', reason: 'Task lighting zones' }
    ],
    'kitchen-designer.html': [
        { page: 'plumbing-designer.html', reason: 'Sink + DWV rough-in' },
        { page: 'electrical-designer.html', reason: 'SABC + GFCI circuits' },
        { page: 'lighting-designer.html', reason: 'Under-cabinet + pendants' }
    ],
    'deck-designer.html': [
        { page: 'foundation-designer.html', reason: 'Shared footing logic' },
        { page: 'landscape-designer.html', reason: 'Grade + drainage' },
        { page: 'permits-inspections.html', reason: 'Ledger + guard inspection' }
    ],
    'landscape-designer.html': [
        { page: 'deck-designer.html', reason: 'Outdoor levels + access' },
        { page: 'plumbing-designer.html', reason: 'Hose bibs + drainage' }
    ],
    'foundation-designer.html': [
        { page: 'framing-designer.html', reason: 'Sill + anchor layout' },
        { page: 'plumbing-designer.html', reason: 'Underslab services' },
        { page: 'permits-inspections.html', reason: 'Footing inspection first' }
    ],
    'project-schedule.html': [
        { page: 'permits-inspections.html', reason: 'Hold points gate phases' },
        { page: 'bid-builder.html', reason: 'Cost-load the timeline' }
    ],
    'permits-inspections.html': [
        { page: 'project-schedule.html', reason: 'Inspections gate the plan' },
        { page: 'project-dashboard.html', reason: 'Readiness overview' }
    ],
    'price-book.html': [
        { page: 'bid-builder.html', reason: 'Quotes price the bid' },
        { page: 'project-dashboard.html', reason: 'Coverage at a glance' }
    ],
    'bid-builder.html': [
        { page: 'price-book.html', reason: 'Quoted $ beats allowances' },
        { page: 'project-schedule.html', reason: 'Bill against progress' }
    ],
    'project-dashboard.html': [
        { page: 'bid-builder.html', reason: 'Price the open designs' },
        { page: 'project-schedule.html', reason: 'When, not just what' }
    ],
    'site-plan.html': [
        { page: 'plan-studio.html', reason: 'Hub for every plan' },
        { page: 'foundation-designer.html', reason: 'Footings follow the siting' },
        { page: 'permits-inspections.html', reason: 'Setbacks gate approval' }
    ],
    'plan-studio.html': [
        { page: 'Editor.html', reason: 'Source floorplan' },
        { page: 'site-plan.html', reason: 'Start with the lot' },
        { page: 'bid-builder.html', reason: 'Price every plan' }
    ]
};

/** Bid suites whose totals are most relevant on a given page. */
export const PRICING_RELEVANCE = {
    'electrical-designer.html': ['electrical', 'lighting'],
    'plumbing-designer.html': ['plumbing'],
    'framing-designer.html': ['framing', 'wall'],
    'roof-designer.html': ['roof', 'framing'],
    'wall-designer.html': ['wall'],
    'deck-designer.html': ['deck'],
    'landscape-designer.html': ['landscape'],
    'lighting-designer.html': ['lighting', 'electrical'],
    'kitchen-designer.html': ['wall', 'plumbing', 'electrical'],
    'foundation-designer.html': ['framing', 'plumbing'],
    'stair-designer.html': ['stair', 'framing'],
    'stair-l-designer.html': ['stair', 'framing'],
    'stair-u-designer.html': ['stair', 'framing'],
    'stair-spiral-designer.html': ['stair', 'framing'],
    'stair-steep-designer.html': ['stair', 'framing'],
    'bid-builder.html': ['deck', 'electrical', 'framing', 'plumbing', 'roof', 'wall', 'lighting', 'landscape'],
    'project-dashboard.html': ['deck', 'electrical', 'framing', 'plumbing', 'roof', 'wall', 'lighting', 'landscape']
};

export function subsFor(page) {
    return PAGE_SUBS[page] || [];
}

export function relatedFor(page) {
    return RELATED[page] || [];
}
