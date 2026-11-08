/**
 * Kitchen suite catalogue.
 *
 * A run is described by modules (cabinets, sink base, range, fridge, pantry)
 * whose widths come from the same cabinetry lines as the 3D editor. The gap
 * policy is the planning logic behind the suite: fillers at walls, air gaps at
 * appliances, and the landing / aisle clearances the layout is checked against.
 */

export const KITCHEN_LINES = {
    shaker: {
        id: 'shaker',
        label: 'Shaker',
        base: 'shaker_base_cabinet',
        drawer: 'shaker_drawer_base',
        sinkBase: 'shaker_sink_base',
        tall: 'shaker_tall_pantry',
        depth: 0.6
    },
    merlot: {
        id: 'merlot',
        label: 'Merlot',
        base: 'merlot_base_cabinet',
        drawer: 'merlot_drawer_base',
        sinkBase: 'merlot_sink_base',
        tall: 'merlot_tall_pantry',
        depth: 0.6
    }
};

/**
 * kind drives the gap policy and the drawing:
 *   base / drawer   counter cabinet
 *   sink            sink base, needs landing counter beside it
 *   range           slide-in range, needs landing counter beside it
 *   fridge          full-height appliance, air gap at both sides
 *   dishwasher      counter appliance, ties to the sink
 *   tall            tall pantry, small scribe gap at each side
 */
export const KITCHEN_MODULES = [
    {
        id: 'base-30', label: 'Base cabinet 30"', kind: 'base', item: 'base',
        width: 0.762, clearance: 0, depth: 0.6, height: 0.9
    },
    {
        id: 'base-24', label: 'Base cabinet 24"', kind: 'base', item: 'base',
        width: 0.61, clearance: 0, depth: 0.6, height: 0.9
    },
    {
        id: 'drawer-30', label: 'Drawer base 30"', kind: 'drawer', item: 'drawer',
        width: 0.762, clearance: 0, depth: 0.6, height: 0.9
    },
    {
        id: 'sink-36', label: 'Sink base 36"', kind: 'sink', item: 'sinkBase',
        width: 0.914, clearance: 0, depth: 0.6, height: 0.9
    },
    {
        id: 'range-30', label: 'Range 30"', kind: 'range', item: 'stove',
        width: 0.762, clearance: 0, depth: 0.66, height: 0.91
    },
    {
        id: 'fridge-36', label: 'Refrigerator 36"', kind: 'fridge', item: 'fridge',
        width: 0.914, clearance: 0.025, depth: 0.75, height: 1.8
    },
    {
        id: 'dishwasher-24', label: 'Dishwasher 24"', kind: 'dishwasher', item: 'base',
        width: 0.61, clearance: 0, depth: 0.6, height: 0.9
    },
    {
        id: 'pantry-24', label: 'Tall pantry 24"', kind: 'tall', item: 'tall',
        width: 0.61, clearance: 0.02, depth: 0.62, height: 2.13
    }
];

export const KITCHEN_GAPS = {
    fillerMin: 0.003,         // 3 mm scribe: below this the run cannot close
    fillerMax: 0.15,          // 150 mm: wider than this needs a filler cabinet
    wallGap: 0.003,           // cabinet to wall
    sinkLanding: 0.6,         // 24 in counter beside the sink
    rangeLanding: 0.38,       // 15 in counter beside the range
    aisleMin: 1.07,           // 42 in walkway between opposing runs
    aisleGood: 1.2,           // 48 in preferred
    counterDepth: 0.6,
    upperAboveCounter: 0.45,  // 18 in between counter and wall cabinets
    counterHeight: 0.9
};

export const KITCHEN_DEFAULTS = {
    runLength: 4.8,
    aisle: 1.2,
    line: 'shaker',
    modules: ['base-30', 'sink-36', 'dishwasher-24', 'range-30', 'base-24', 'fridge-36']
};

export const moduleById = (id) => KITCHEN_MODULES.find((module) => module.id === id) || null;

export const lineById = (id) => KITCHEN_LINES[id] || KITCHEN_LINES.shaker;
