/**
 * Lighting and power catalogue - every luminaire, switch, socket, breaker and
 * cable the suite designs with.
 *
 * The numbers are illustrative but internally consistent: efficacy is derived
 * from lumens and watts, circuit load from the device ratings, and the spacing
 * ratio drives both the auto layout and the uniformity check.
 */

export const INCH = 0.0254;
export const FOOT = 0.3048;
export const SQ_FT_PER_M2 = 10.7639;

const luminaire = (entry) => ({
    category: 'ambient',
    mount: 'ceiling',
    cct: 3000,
    cri: 90,
    beamAngle: 90,
    spacingRatio: 1.1,
    dimmable: true,
    damp: false,
    wet: false,
    ic: false,
    fireRated: false,
    // Title 24, Part 6 treats hard-wired LED luminaires as installed and
    // requires a JA8 listing unless Table 150.0-A exempts the source.
    permanent: true,
    ja8: true,
    screwBase: false,
    airtight: false,
    lifeHours: 50000,
    weightKg: 1.2,
    ...entry,
    efficacy: Math.round((entry.lumens / entry.watts) * 10) / 10
});

export const LUMINAIRES = [
    luminaire({
        id: 'recessed-4', label: '4 in LED downlight', category: 'ambient', mount: 'recessed',
        watts: 10, lumens: 800, beamAngle: 36, spacingRatio: 1.0, ic: true, fireRated: true, damp: true, airtight: true,
        cost: 32, weightKg: 0.6,
        notes: 'The default residential downlight; IC-rated and airtight so it can touch insulation.'
    }),
    luminaire({
        id: 'recessed-6', label: '6 in LED downlight', category: 'ambient', mount: 'recessed',
        watts: 14, lumens: 1100, beamAngle: 60, spacingRatio: 1.1, ic: true, fireRated: true, damp: true, airtight: true,
        cost: 38, weightKg: 0.8,
        notes: 'Wider beam than the 4 in can; fewer fittings for the same average illuminance.'
    }),
    luminaire({
        id: 'recessed-gimbal', label: 'Adjustable gimbal downlight', category: 'accent', mount: 'recessed',
        watts: 12, lumens: 900, beamAngle: 30, spacingRatio: 0.9, ic: true, damp: true, airtight: true,
        cost: 48, weightKg: 0.7,
        notes: 'Aims at a wall or artwork; keep it away from the ceiling line to avoid scalloping.'
    }),
    luminaire({
        id: 'surface-downlight', label: 'Surface-mounted downlight', category: 'ambient', mount: 'ceiling',
        watts: 15, lumens: 1200, beamAngle: 90, spacingRatio: 1.2, damp: true,
        cost: 42, weightKg: 1.1,
        notes: 'For a ceiling that cannot be cut, such as a concrete slab or a fire-rated soffit.'
    }),
    luminaire({
        id: 'pendant-globe', label: 'Pendant globe', category: 'decor', mount: 'pendant',
        watts: 9, lumens: 800, beamAngle: 360, spacingRatio: 0.8, dimmable: true,
        cost: 95, weightKg: 1.4,
        notes: 'Hangs over a table or island; the bottom of the globe should clear the table by 750 mm.'
    }),
    luminaire({
        id: 'pendant-linear', label: 'Linear pendant', category: 'task', mount: 'pendant',
        watts: 24, lumens: 2400, beamAngle: 110, spacingRatio: 1.0,
        cost: 220, weightKg: 3.2,
        notes: 'A single long fixture over an island; centre it on the worktop, not the room.'
    }),
    luminaire({
        id: 'chandelier', label: 'Chandelier', category: 'decor', mount: 'pendant',
        watts: 40, lumens: 3200, beamAngle: 360, spacingRatio: 0.8,
        cost: 380, weightKg: 8,
        notes: 'A decorative centrepiece; pair it with ambient light so it is not the only source.'
    }),
    luminaire({
        id: 'flush-mount', label: 'Flush ceiling fixture', category: 'ambient', mount: 'ceiling',
        watts: 18, lumens: 1600, beamAngle: 120, spacingRatio: 1.3,
        cost: 55, weightKg: 1.8,
        notes: 'The simple choice for bedrooms, halls and closets; low glare and easy to clean.'
    }),
    luminaire({
        id: 'fan-light', label: 'Ceiling fan with light', category: 'ambient', mount: 'ceiling',
        watts: 30, lumens: 2200, beamAngle: 120, spacingRatio: 1.2,
        cost: 260, weightKg: 9,
        notes: 'Needs a fan-rated box and a fan speed control; the light kit is often dimmable.'
    }),
    luminaire({
        id: 'track-head', label: 'Track head', category: 'accent', mount: 'track',
        watts: 10, lumens: 800, beamAngle: 25, spacingRatio: 0.8,
        cost: 45, weightKg: 0.5,
        notes: 'Aimable and easy to add to; the track itself needs a dedicated feed and support.'
    }),
    luminaire({
        id: 'wall-sconce', label: 'Wall sconce', category: 'accent', mount: 'wall',
        watts: 8, lumens: 600, beamAngle: 120, spacingRatio: 1.0, damp: true,
        cost: 85, weightKg: 1.2,
        notes: 'Mounted at 1.7–1.8 m or centred on the wall; a sconce in a bathroom needs a damp rating.'
    }),
    luminaire({
        id: 'wall-washer', label: 'Wall washer', category: 'accent', mount: 'wall',
        watts: 12, lumens: 900, beamAngle: 60, spacingRatio: 0.9,
        cost: 110, weightKg: 1.4,
        notes: 'Grazes a textured wall; keep the fitting 150–250 mm off the surface.'
    }),
    luminaire({
        id: 'picture-light', label: 'Picture light', category: 'accent', mount: 'wall',
        watts: 6, lumens: 450, beamAngle: 45, spacingRatio: 0.8,
        cost: 95, weightKg: 0.7,
        notes: 'A narrow beam over artwork; the top of the frame should be about 1.5 m high.'
    }),
    luminaire({
        id: 'undercabinet-strip', label: 'Under-cabinet strip', category: 'task', mount: 'wall',
        watts: 8, lumens: 700, beamAngle: 100, spacingRatio: 1.0, damp: true,
        cost: 65, weightKg: 0.4, lifeHours: 40000,
        notes: 'Task light for a kitchen counter; keep it at the front of the cabinet to light the worktop.'
    }),
    luminaire({
        id: 'led-strip', label: 'LED tape (per metre)', category: 'task', mount: 'surface',
        watts: 14.4, lumens: 1200, beamAngle: 120, spacingRatio: 1.4,
        cost: 28, weightKg: 0.2, lifeHours: 30000,
        notes: 'Sold by the metre; use an aluminium channel for heat and a driver sized for the run.'
    }),
    luminaire({
        id: 'linear-suspended', label: 'Suspended linear luminaire', category: 'ambient', mount: 'pendant',
        watts: 36, lumens: 4000, beamAngle: 110, spacingRatio: 1.3,
        cost: 280, weightKg: 4.5,
        notes: 'Office, studio and dining; the long run should follow the work plane.'
    }),
    luminaire({
        id: 'vanity-bar', label: 'Vanity bar', category: 'task', mount: 'wall',
        watts: 24, lumens: 2000, beamAngle: 120, spacingRatio: 1.0, damp: true,
        cost: 120, weightKg: 2.2,
        notes: 'Light the face from both sides of the mirror rather than straight down.'
    }),
    luminaire({
        id: 'mirror-light', label: 'Mirror light', category: 'task', mount: 'wall',
        watts: 15, lumens: 1200, beamAngle: 110, spacingRatio: 0.9, damp: true,
        cost: 90, weightKg: 1.1,
        notes: 'A single fixture above the mirror; pair it with a second source to avoid shadows.'
    }),
    luminaire({
        id: 'outdoor-wall', label: 'Outdoor wall light', category: 'accent', mount: 'wall',
        watts: 12, lumens: 900, beamAngle: 90, spacingRatio: 1.0, wet: true, damp: true,
        cost: 95, weightKg: 1.3,
        notes: 'Wet-location rated and gasketed; mount it above the door and aim away from the glass.'
    }),
    luminaire({
        id: 'outdoor-post', label: 'Post or bollard light', category: 'ambient', mount: 'post',
        watts: 10, lumens: 700, beamAngle: 360, spacingRatio: 1.2, wet: true, damp: true,
        cost: 120, weightKg: 3.5,
        notes: 'Marks a path or driveway; keep the top below eye height to reduce glare.'
    }),
    luminaire({
        id: 'outdoor-flood', label: 'Outdoor floodlight', category: 'accent', mount: 'wall',
        watts: 30, lumens: 3000, beamAngle: 60, spacingRatio: 0.9, wet: true, damp: true,
        cost: 85, weightKg: 1.6,
        notes: 'Aim it away from neighbours and the street; a floodlight is not a security system.'
    }),
    luminaire({
        id: 'step-light', label: 'Step light', category: 'accent', mount: 'wall',
        watts: 3, lumens: 210, beamAngle: 60, spacingRatio: 0.8, wet: true, damp: true,
        cost: 55, weightKg: 0.4,
        notes: 'Low-level marker for stairs and paths; needs a wet-location box and gasket.'
    }),
    luminaire({
        id: 'closet-light', label: 'Closet light', category: 'ambient', mount: 'ceiling',
        watts: 12, lumens: 1000, beamAngle: 120, spacingRatio: 1.1, ic: true,
        cost: 40, weightKg: 0.7,
        notes: 'A surface fixture keeps clearance from shelving; do not put a bare lamp against stored goods.'
    }),
    luminaire({
        id: 'shop-light', label: 'Garage shop light', category: 'ambient', mount: 'pendant',
        watts: 40, lumens: 4500, beamAngle: 120, spacingRatio: 1.3,
        cost: 65, weightKg: 2.4,
        notes: 'Hangs over the workbench; chain or cable mount so it clears the garage door track.'
    }),
    luminaire({
        id: 'table-lamp', label: 'Table lamp', category: 'task', mount: 'portable',
        watts: 8, lumens: 600, beamAngle: 120, spacingRatio: 1.0, permanent: false, ja8: false,
        cost: 60, weightKg: 1.5,
        notes: 'Plug-in task light; it needs a receptacle, not a lighting outlet, and is not counted as fixed lighting.'
    })
];

export const SWITCHES = [
    {
        id: 'single-pole', label: 'Single-pole switch', type: 'single', ways: 1,
        ratingA: 15, voltage: 120, dimmable: false, requiresNeutral: false, maxLedW: 0,
        cost: 4, notes: 'One location controls the lights; the ordinary room switch.'
    },
    {
        id: 'three-way', label: 'Three-way switch', type: 'three', ways: 2,
        ratingA: 15, voltage: 120, dimmable: false, requiresNeutral: false, maxLedW: 0,
        cost: 9, notes: 'Two locations control the same lights - stairs, halls and rooms with two doors.'
    },
    {
        id: 'four-way', label: 'Four-way switch', type: 'four', ways: 3,
        ratingA: 15, voltage: 120, dimmable: false, requiresNeutral: false, maxLedW: 0,
        cost: 14, notes: 'Used between two three-way switches for a third or fourth control point.'
    },
    {
        id: 'dimmer-led', label: 'LED dimmer', type: 'dimmer', ways: 1,
        ratingA: 15, voltage: 120, dimmable: true, requiresNeutral: false, maxLedW: 150,
        cost: 28, notes: 'Match the dimmer to the driver; a 150 W LED rating is not 150 W of incandescent.'
    },
    {
        id: 'dimmer-smart', label: 'Smart dimmer', type: 'smart', ways: 1,
        ratingA: 15, voltage: 120, dimmable: true, requiresNeutral: true, maxLedW: 200,
        cost: 55, notes: 'Usually needs a neutral at the switch box; check before pulling the cable.'
    },
    {
        id: 'occupancy-sensor', label: 'Occupancy sensor', type: 'sensor', ways: 1,
        ratingA: 15, voltage: 120, dimmable: false, requiresNeutral: true, maxLedW: 150,
        cost: 48, notes: 'Turns lights on with motion; a vacancy sensor requires a manual-on press.'
    },
    {
        id: 'vacancy-sensor', label: 'Vacancy sensor', type: 'sensor', ways: 1,
        ratingA: 15, voltage: 120, dimmable: false, requiresNeutral: true, maxLedW: 150,
        cost: 52, notes: 'Manual on, automatic off; preferred where false-on is annoying.'
    },
    {
        id: 'fan-control', label: 'Fan speed control', type: 'fan', ways: 1,
        ratingA: 5, voltage: 120, dimmable: false, requiresNeutral: false, maxLedW: 0,
        cost: 35, notes: 'A fan needs a fan-rated control, not a lamp dimmer.'
    },
    {
        id: 'weatherproof', label: 'Weatherproof switch', type: 'weather', ways: 1,
        ratingA: 15, voltage: 120, dimmable: false, requiresNeutral: false, maxLedW: 0,
        cost: 18, notes: 'Gasketed cover for an exterior wall; the box must drain and be listed for the location.'
    },
    {
        id: 'outdoor-photocell', label: 'Photocell + motion switch', type: 'sensor', ways: 1,
        ratingA: 15, voltage: 120, dimmable: false, requiresNeutral: true, maxLedW: 150,
        automatic: 'photocell-motion', cost: 68,
        notes: 'Photocell plus motion sensor with a manual ON/OFF override; the override must return to automatic within 6 hours.'
    },
    {
        id: 'astronomical-timer', label: 'Astronomical time switch', type: 'timer', ways: 1,
        ratingA: 15, voltage: 120, dimmable: false, requiresNeutral: true, maxLedW: 150,
        automatic: 'astronomical', cost: 88,
        notes: 'Switches outdoor lighting at sunset and sunrise; a manual override is timed and returns to the schedule.'
    },
    {
        id: 'timer', label: 'Countdown timer', type: 'timer', ways: 1,
        ratingA: 15, voltage: 120, dimmable: false, requiresNeutral: true, maxLedW: 150,
        cost: 32, notes: 'Useful for a fan or exterior light that should not be left on.'
    }
];

export const SOCKETS = [
    {
        id: 'duplex-15', label: 'Duplex receptacle · 15 A', ratingA: 15, voltage: 125,
        gfci: false, afci: false, tamperResistant: true, weatherResistant: false,
        usb: false, floor: false, dedicated: false, cost: 4,
        notes: 'The standard general-purpose receptacle on a 15 A circuit.'
    },
    {
        id: 'duplex-20', label: 'Duplex receptacle · 20 A', ratingA: 20, voltage: 125,
        gfci: false, afci: false, tamperResistant: true, weatherResistant: false,
        usb: false, floor: false, dedicated: false, cost: 6,
        notes: 'A 20 A receptacle needs a 20 A circuit and 12 AWG copper.'
    },
    {
        id: 'gfci-20', label: 'GFCI receptacle · 20 A', ratingA: 20, voltage: 125,
        gfci: true, afci: false, tamperResistant: true, weatherResistant: false,
        usb: false, floor: false, dedicated: false, cost: 24,
        notes: 'Protects itself and downstream receptacles; required in wet and damp areas.'
    },
    {
        id: 'afci-20', label: 'AFCI receptacle · 20 A', ratingA: 20, voltage: 125,
        gfci: false, afci: true, tamperResistant: true, weatherResistant: false,
        usb: false, floor: false, dedicated: false, cost: 32,
        notes: 'A receptacle-level AFCI; most homes use an AFCI breaker instead.'
    },
    {
        id: 'usb-c', label: 'USB-C receptacle · 15 A', ratingA: 15, voltage: 125,
        gfci: false, afci: false, tamperResistant: true, weatherResistant: false,
        usb: true, floor: false, dedicated: false, cost: 35,
        notes: 'Convenient at a bedside or desk; the USB supply is not a substitute for a charger.'
    },
    {
        id: 'floor-20', label: 'Floor receptacle · 20 A', ratingA: 20, voltage: 125,
        gfci: false, afci: false, tamperResistant: true, weatherResistant: false,
        usb: false, floor: true, dedicated: false, cost: 55,
        notes: 'Needs a floor box and a listed cover; a floor outlet counts only within 18 in of the wall.'
    },
    {
        id: 'outdoor-gfci', label: 'Outdoor GFCI · 20 A', ratingA: 20, voltage: 125,
        gfci: true, afci: false, tamperResistant: true, weatherResistant: true,
        usb: false, floor: false, dedicated: false, cost: 38,
        notes: 'WR-rated with an in-use cover; required outdoors and in a wet location.'
    },
    {
        id: 'island-popup', label: 'Countertop pop-up · 20 A', ratingA: 20, voltage: 125,
        gfci: true, afci: false, tamperResistant: true, weatherResistant: false,
        usb: true, floor: false, dedicated: false, cost: 95,
        notes: 'For an island or peninsula; the mechanism must be listed and the counter cut sealed.'
    },
    {
        id: 'dryer-30', label: 'Dryer receptacle · 30 A', ratingA: 30, voltage: 240,
        gfci: false, afci: false, tamperResistant: false, weatherResistant: false,
        usb: false, floor: false, dedicated: true, cost: 18,
        notes: 'A dedicated 30 A two-pole circuit with 10 AWG copper.'
    },
    {
        id: 'range-50', label: 'Range receptacle · 50 A', ratingA: 50, voltage: 240,
        gfci: false, afci: false, tamperResistant: false, weatherResistant: false,
        usb: false, floor: false, dedicated: true, cost: 24,
        notes: 'A dedicated 50 A two-pole circuit with 6 AWG copper; confirm the nameplate rating.'
    }
];

export const BREAKERS = [
    { id: '15-standard', label: '15 A · single pole', amps: 15, poles: 1, type: 'standard', cost: 12, wire: '14-2' },
    { id: '15-afci', label: '15 A · AFCI', amps: 15, poles: 1, type: 'afci', cost: 48, wire: '14-2' },
    { id: '20-standard', label: '20 A · single pole', amps: 20, poles: 1, type: 'standard', cost: 14, wire: '12-2' },
    { id: '20-gfci', label: '20 A · GFCI', amps: 20, poles: 1, type: 'gfci', cost: 48, wire: '12-2' },
    { id: '20-afci', label: '20 A · AFCI', amps: 20, poles: 1, type: 'afci', cost: 52, wire: '12-2' },
    { id: '20-dual', label: '20 A · GFCI/AFCI', amps: 20, poles: 1, type: 'dual', cost: 62, wire: '12-2' },
    { id: '30-double', label: '30 A · two pole', amps: 30, poles: 2, type: 'standard', cost: 24, wire: '10-3' },
    { id: '50-double', label: '50 A · two pole', amps: 50, poles: 2, type: 'standard', cost: 38, wire: '6-3' }
];

export const CABLES = [
    { id: '14-2', label: '14/2 NM-B', amps: 15, conductors: 2, resistanceOhmPerM: 0.01007, costPerM: 1.35 },
    { id: '12-2', label: '12/2 NM-B', amps: 20, conductors: 2, resistanceOhmPerM: 0.00633, costPerM: 1.95 },
    { id: '12-3', label: '12/3 NM-B', amps: 20, conductors: 3, resistanceOhmPerM: 0.00633, costPerM: 2.85 },
    { id: '14-3', label: '14/3 NM-B', amps: 15, conductors: 3, resistanceOhmPerM: 0.01007, costPerM: 2.15 },
    { id: '10-2', label: '10/2 NM-B', amps: 30, conductors: 2, resistanceOhmPerM: 0.00397, costPerM: 3.4 },
    { id: '10-3', label: '10/3 NM-B', amps: 30, conductors: 3, resistanceOhmPerM: 0.00397, costPerM: 4.6 },
    { id: '6-3', label: '6/3 NM-B', amps: 55, conductors: 3, resistanceOhmPerM: 0.00161, costPerM: 9.8 }
];

export const CIRCUIT_TYPES = [
    { id: 'lighting', label: 'Lighting', colour: '#0ea5e9' },
    { id: 'general', label: 'General receptacles', colour: '#f59e0b' },
    { id: 'kitchen', label: 'Kitchen small appliance', colour: '#ef4444' },
    { id: 'bathroom', label: 'Bathroom', colour: '#8b5cf6' },
    { id: 'laundry', label: 'Laundry', colour: '#14b8a6' },
    { id: 'outdoor', label: 'Outdoor', colour: '#84cc16' },
    { id: 'garage', label: 'Garage', colour: '#64748b' },
    { id: 'dedicated', label: 'Dedicated appliance', colour: '#a855f7' }
];

export const ROOM_PRESETS = [
    {
        id: 'living', label: 'Living room', targetLux: 200, cct: 3000,
        ambient: 'recessed-6', task: null, accent: 'wall-sconce',
        switchType: 'single-pole', socketType: 'duplex-15', minSockets: 5,
        socketSpacing: 3.66, dimmer: true, occupancy: false, socketHeight: 0.3, switchHeight: 1.2,
        notes: 'Layer ambient with a reading light and a wall wash; dimming is the single biggest comfort upgrade.'
    },
    {
        id: 'bedroom', label: 'Bedroom', targetLux: 150, cct: 2700,
        ambient: 'flush-mount', task: 'table-lamp', accent: 'wall-sconce',
        switchType: 'single-pole', socketType: 'duplex-15', minSockets: 4,
        socketSpacing: 3.66, dimmer: true, occupancy: false, socketHeight: 0.3, switchHeight: 1.2,
        notes: 'Warm, low glare and switchable from the door and the bed; bedside receptacles are usually 1.1 m high.'
    },
    {
        id: 'kitchen', label: 'Kitchen', targetLux: 300, cct: 3500,
        ambient: 'recessed-6', task: 'undercabinet-strip', accent: 'pendant-globe',
        switchType: 'single-pole', socketType: 'gfci-20', minSockets: 6,
        socketSpacing: 1.2, dimmer: true, occupancy: false, socketHeight: 1.1, switchHeight: 1.2,
        notes: 'Two 20 A small-appliance circuits and counter receptacles no more than 600 mm apart along the worktop.'
    },
    {
        id: 'bathroom', label: 'Bathroom', targetLux: 250, cct: 3000,
        ambient: 'recessed-4', task: 'vanity-bar', accent: 'mirror-light',
        switchType: 'single-pole', socketType: 'gfci-20', minSockets: 1,
        socketSpacing: 3.66, dimmer: true, autoOff: true, occupancy: false, socketHeight: 1.1, switchHeight: 1.2,
        notes: 'Light the face from both sides of the mirror; every receptacle needs GFCI protection and the room needs automatic-off control.'
    },
    {
        id: 'dining', label: 'Dining room', targetLux: 200, cct: 2700,
        ambient: 'chandelier', task: null, accent: 'wall-sconce',
        switchType: 'single-pole', socketType: 'duplex-15', minSockets: 3,
        socketSpacing: 3.66, dimmer: true, occupancy: false, socketHeight: 0.3, switchHeight: 1.2,
        notes: 'Hang the fixture 750–900 mm above the table and put it on a dimmer.'
    },
    {
        id: 'hallway', label: 'Hallway', targetLux: 100, cct: 2700,
        ambient: 'recessed-4', task: null, accent: null,
        switchType: 'three-way', socketType: 'duplex-15', minSockets: 1,
        socketSpacing: 3.66, dimmer: false, occupancy: false, socketHeight: 0.3, switchHeight: 1.2,
        notes: 'A run longer than 3 m usually wants three-way switching at both ends.'
    },
    {
        id: 'stairs', label: 'Stairway', targetLux: 150, cct: 2700,
        ambient: 'recessed-4', task: null, accent: 'step-light',
        switchType: 'three-way', socketType: 'duplex-15', minSockets: 1,
        socketSpacing: 3.66, dimmer: false, occupancy: false, socketHeight: 0.3, switchHeight: 1.2,
        notes: 'A stairway with six or more risers needs a switch at each floor level.'
    },
    {
        id: 'office', label: 'Home office', targetLux: 400, cct: 4000,
        ambient: 'linear-suspended', task: 'table-lamp', accent: 'picture-light',
        switchType: 'single-pole', socketType: 'duplex-20', minSockets: 4,
        socketSpacing: 3.66, dimmer: true, occupancy: false, socketHeight: 0.3, switchHeight: 1.2,
        notes: 'Neutral CCT and a task light at the desk; put the monitor at right angles to the window.'
    },
    {
        id: 'laundry', label: 'Laundry', targetLux: 250, cct: 3500,
        ambient: 'flush-mount', task: null, accent: null,
        switchType: 'single-pole', socketType: 'gfci-20', minSockets: 2,
        socketSpacing: 3.66, dimmer: false, autoOff: true, occupancy: false, socketHeight: 1.1, switchHeight: 1.2,
        notes: 'One 20 A laundry circuit, GFCI protection, automatic-off control and a light that reaches into the appliances.'
    },
    {
        id: 'garage', label: 'Garage', targetLux: 250, cct: 4000,
        ambient: 'shop-light', task: null, accent: null,
        switchType: 'single-pole', socketType: 'gfci-20', minSockets: 2,
        socketSpacing: 3.66, dimmer: false, autoOff: true, occupancy: false, socketHeight: 1.1, switchHeight: 1.2,
        notes: 'At least one 20 A GFCI circuit, automatic-off lighting control and a switched light that is not on the door operator circuit.'
    },
    {
        id: 'closet', label: 'Closet', targetLux: 150, cct: 3000,
        ambient: 'closet-light', task: null, accent: null,
        switchType: 'single-pole', socketType: 'duplex-15', minSockets: 0,
        socketSpacing: 3.66, dimmer: false, autoOff: true, occupancy: false, socketHeight: 0.3, switchHeight: 1.2,
        notes: 'A walk-in storage space needs automatic-off lighting; keep the fixture clear of shelving and stored goods.'
    },
    {
        id: 'outdoor', label: 'Outdoor entry', targetLux: 100, cct: 3000,
        ambient: 'outdoor-wall', task: null, accent: 'step-light',
        switchType: 'outdoor-photocell', socketType: 'outdoor-gfci', minSockets: 2,
        socketSpacing: 6, dimmer: false, occupancy: false, socketHeight: 0.45, switchHeight: 1.2,
        notes: 'Wet-location fixtures, GFCI receptacles with in-use covers, and photocell plus motion or astronomical control.'
    }
];

export const LUMINAIRE_COUNT = LUMINAIRES.length;
export const SWITCH_COUNT = SWITCHES.length;
export const SOCKET_COUNT = SOCKETS.length;

export function luminaireById(id) {
    return LUMINAIRES.find((entry) => entry.id === id) || LUMINAIRES[1];
}

export function switchById(id) {
    return SWITCHES.find((entry) => entry.id === id) || SWITCHES[0];
}

export function socketById(id) {
    return SOCKETS.find((entry) => entry.id === id) || SOCKETS[0];
}

export function breakerById(id) {
    return BREAKERS.find((entry) => entry.id === id) || BREAKERS[0];
}

export function cableById(id) {
    return CABLES.find((entry) => entry.id === id) || CABLES[1];
}

export function circuitTypeById(id) {
    return CIRCUIT_TYPES.find((entry) => entry.id === id) || CIRCUIT_TYPES[0];
}

export function roomPresetById(id) {
    return ROOM_PRESETS.find((entry) => entry.id === id) || ROOM_PRESETS[0];
}

/** The default layout count for a room and a luminaire, before manual edits. */
export function defaultLuminaireCount(preset, luminaire, width, depth, mountingHeight) {
    if (preset?.ambient === luminaire.id && preset.id === 'dining') return 1;
    const spacing = Math.max(luminaire.spacingRatio * mountingHeight * 0.9, 1.2);
    const cols = Math.max(1, Math.round(width / spacing));
    const rows = Math.max(1, Math.round(depth / spacing));
    return Math.max(1, cols * rows);
}

export function defaultCircuitFor(socket, roomType) {
    if (socket.dedicated) return 'dedicated';
    if (roomType === 'kitchen') return 'kitchen';
    if (roomType === 'bathroom' || roomType === 'laundry') return roomType === 'laundry' ? 'laundry' : 'bathroom';
    if (roomType === 'garage') return 'garage';
    if (roomType === 'outdoor') return 'outdoor';
    return 'general';
}
