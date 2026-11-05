import {
    LUMINAIRES,
    SWITCHES,
    SOCKETS,
    BREAKERS,
    CABLES,
    luminaireById,
    switchById,
    socketById,
    roomPresetById,
    cableById
} from './catalog.js';
import {
    DEFAULT_REFLECTANCES,
    DEFAULT_LLF,
    lumenMethod,
    illuminanceGrid,
    spacingFor
} from './photometry.js';
import {
    devicesOf,
    circuitLoad,
    circuitDevices,
    validateLayout,
    planSummary
} from './plan.js';

/**
 * The design engine: one call turns a room plan and its placed devices into
 * photometry, layer balance, circuit loads, a costed bill of materials, an
 * outlet schedule and the checks the page reports. The canvas, the schedule and
 * the cost all read this object, so what is drawn is what is bought.
 */

export const GLOSSARY = [
    {
        term: 'Luminaire',
        category: 'Basics',
        short: 'A complete light fitting: lamp or LED module plus housing, driver, lens and trim.',
        detail: 'The code term is "luminaire"; "light fixture" is the trade word. A replaceable lamp is not a luminaire on its own.'
    },
    {
        term: 'Lumen (lm)',
        category: 'Basics',
        short: 'The total visible light a source emits, in every direction.',
        detail: 'Lumens measure output. A 800 lm downlight and a 800 lm globe emit the same light; their beams put it in different places.'
    },
    {
        term: 'Lux (lx)',
        category: 'Basics',
        short: 'One lumen per square metre, the illuminance arriving at a surface.',
        detail: 'Lux is what you see on the worktop or floor. 1 lx = 0.0929 foot-candles; 100 lx is about 9.3 fc.'
    },
    {
        term: 'Foot-candle (fc)',
        category: 'Basics',
        short: 'One lumen per square foot. 1 fc = 10.764 lx.',
        detail: 'Still common on US drawings and in manufacturer cut sheets. Divide lux by 10.764.'
    },
    {
        term: 'Efficacy',
        category: 'Basics',
        short: 'Lumens per watt (lm/W): how much light the fixture makes per watt consumed.',
        detail: 'A good residential LED is 80–130 lm/W. Efficacy does not include driver losses unless the cut sheet says so.'
    },
    {
        term: 'CCT',
        category: 'Photometry',
        short: 'Correlated colour temperature in kelvin: warm 2700 K, neutral 3500 K, cool 4000 K.',
        detail: 'Lower kelvin reads warmer. Keep one CCT through a room and its adjoining spaces, or the difference looks dirty.'
    },
    {
        term: 'CRI',
        category: 'Photometry',
        short: 'Colour rendering index, 0–100. 90+ renders materials and skin faithfully.',
        detail: 'R9 (deep red) matters for wood and skin but is not in the standard CRI average; ask for it separately on coloured surfaces.'
    },
    {
        term: 'Beam angle',
        category: 'Photometry',
        short: 'The cone where intensity stays above half its peak value.',
        detail: 'A 24–36° beam is a spotlight; 60° is a flood; 120° is a wide wash. Narrow beams need closer spacing and leave scallops on a wall.'
    },
    {
        term: 'Spacing ratio',
        category: 'Photometry',
        short: 'Maximum spacing between fittings divided by mounting height.',
        detail: 'The multiplier drives auto layout. A 0.9 ratio at 2.4 m allows 2.16 m between centres; go wider and the pools separate.'
    },
    {
        term: 'Lumen method',
        category: 'Photometry',
        short: 'Average illuminance = total lumens × CU × LLF ÷ area.',
        detail: 'The standard room-average calculation. It ignores where the fittings are, so the point grid and uniformity check catch hot and dark spots.'
    },
    {
        term: 'Room index',
        category: 'Photometry',
        short: 'K = (L × W) ÷ (mounting height × (L + W)).',
        detail: 'A shape factor for the lumen method: a long narrow room and a square room with the same area light differently.'
    },
    {
        term: 'Coefficient of utilization (CU)',
        category: 'Photometry',
        short: 'The share of lamp lumens that reaches the work plane.',
        detail: 'Bright ceilings and light walls raise CU; dark finishes absorb light. The suite derives it from room index and reflectances.'
    },
    {
        term: 'Light loss factor (LLF)',
        category: 'Photometry',
        short: 'The fraction of initial output left after dirt, age and lamp depreciation.',
        detail: '0.80 is a fair residential maintained value. Use 0.70 for a dusty or high-temperature space.'
    },
    {
        term: 'Uniformity',
        category: 'Photometry',
        short: 'Minimum illuminance ÷ maximum (or ÷ average) across the work plane.',
        detail: 'A ratio of 0.4 or better reads even. Deep shadows and scalloping show up as low minimum values even when the average is right.'
    },
    {
        term: 'Illuminance grid',
        category: 'Photometry',
        short: 'A point-by-point calculation across the room, drawn as a heatmap.',
        detail: 'The suite samples a 20 × 20 grid at the work plane and colours each cell blue (dark) to amber (bright).'
    },
    {
        term: 'Layered lighting',
        category: 'Design',
        short: 'Ambient + task + accent + decor, each switching separately.',
        detail: 'One ceiling fixture for everything is why rooms feel flat. Layer the light, then dim the layers independently.'
    },
    {
        term: 'Ambient light',
        category: 'Design',
        short: 'The general, even fill that lets you move safely.',
        detail: 'Usually downlights, a flush mount or a linear fixture. Aim for roughly half to two-thirds of the room lumens in this layer.'
    },
    {
        term: 'Task light',
        category: 'Design',
        short: 'Directed light for reading, cooking, shaving or computer work.',
        detail: 'Under-cabinet strip, vanity bar, desk or table lamp. Put it between the eye and the work, not behind the head.'
    },
    {
        term: 'Accent light',
        category: 'Design',
        short: 'A deliberate highlight: wall wash, art light, gimbal, step light.',
        detail: 'Accent is 3–5 times the ambient level on the object. More than that and the eye adapts to the highlight and the room looks dark.'
    },
    {
        term: 'Glare',
        category: 'Design',
        short: 'Excessive brightness in the field of view, from a bare lamp or a bright ceiling.',
        detail: 'Deep regress, shields and dimming control glare. A high max-to-average ratio is a warning sign, not a measurement of UGR.'
    },
    {
        term: 'Flicker',
        category: 'Design',
        short: 'Rapid brightness modulation, often from a driver and dimmer mismatch.',
        detail: 'Look for flicker-free drivers and a dimmer listed for the LED load. Flicker is a comfort and health issue, not just a nuisance.'
    },
    {
        term: 'IC rating',
        category: 'Electrical',
        short: 'Insulation contact: a recessed luminaire listed to touch thermal insulation.',
        detail: 'A non-IC can needs a clearance box or the insulation pulled back. Use IC + airtight in an insulated ceiling.'
    },
    {
        term: 'Damp / wet location',
        category: 'Electrical',
        short: 'Listings for moisture: damp for bathrooms and covered porches, wet for exposed outdoors.',
        detail: 'A wet-location fixture needs a gasketed box and an in-use cover. A damp-rated fixture is not a substitute outdoors.'
    },
    {
        term: 'GFCI',
        category: 'Electrical',
        short: 'Ground-fault circuit interrupter: trips on a small current leak to earth.',
        detail: 'CEC 210.8(A) covers 125–250 V receptacles in bathrooms, kitchens, laundry, garages, outdoors, basements, crawlspaces and indoor damp or wet locations. It protects people, not the wiring.'
    },
    {
        term: 'AFCI',
        category: 'Electrical',
        short: 'Arc-fault circuit interrupter: trips on a dangerous parallel or series arc.',
        detail: 'CEC 210.12(A) requires combination-type AFCI protection for 120 V, 15/20 A dwelling-unit branch circuits. An AFCI breaker is the usual choice.'
    },
    {
        term: 'TR receptacle',
        category: 'Electrical',
        short: 'Tamper resistant: shutters block a single inserted object.',
        detail: 'Required in most dwelling-unit receptacles. A TR receptacle costs a few dollars more and is not optional.'
    },
    {
        term: 'WR receptacle',
        category: 'Electrical',
        short: 'Weather resistant: plated parts and UV-stable materials for a damp or wet location.',
        detail: 'Outdoor receptacles need WR plus an in-use cover, and GFCI protection.'
    },
    {
        term: 'Branch circuit',
        category: 'Electrical',
        short: 'The final overcurrent-protected circuit from the panel to the outlets.',
        detail: 'General receptacle circuits are 20 A in a modern kitchen; lighting is often 15 A. Don\'t mix lighting and receptacles if you can avoid it.'
    },
    {
        term: 'Small-appliance circuit',
        category: 'Electrical',
        short: 'The two or more 20 A kitchen counter circuits required by code.',
        detail: 'Kitchen counter receptacles must be on at least two small-appliance branch circuits; a dining or pantry receptacle can be on either.'
    },
    {
        term: 'Dedicated circuit',
        category: 'Electrical',
        short: 'One appliance on its own circuit: range, dryer, water heater, EV charger.',
        detail: 'Size the breaker and conductors from the nameplate, not a guess. A 50 A range needs 6 AWG copper and a four-wire connection.'
    },
    {
        term: 'Box fill',
        category: 'Electrical',
        short: 'The cubic-inch capacity needed for conductors, clamps and devices in a box.',
        detail: 'A crowded switch box overheats and can fail inspection. Count each current-carrying conductor, the grounds and the device.'
    },
    {
        term: 'Switch loop',
        category: 'Electrical',
        short: 'Power goes to the light first, then a two-wire loop down to the switch.',
        detail: 'A switch loop has no neutral at the switch. Smart switches may need one, so pull a three-conductor cable if you might upgrade.'
    },
    {
        term: 'Three-way switch',
        category: 'Electrical',
        short: 'A pair of switches that control one load from two locations.',
        detail: 'Stairs, halls and rooms with two doors. Two three-ways, travellers between them, and the load on the common of the far switch.'
    },
    {
        term: 'Four-way switch',
        category: 'Electrical',
        short: 'A switch placed between two three-ways to add a third control point.',
        detail: 'Only used between a pair of three-ways; it is not a stand-alone switch.'
    },
    {
        term: 'Dimmer',
        category: 'Electrical',
        short: 'A control that reduces light output, usually by phase-cut or low-voltage PWM.',
        detail: 'Match the dimmer to the driver and respect its LED watt rating; a dimmer rated for 150 W LED is not 150 W of incandescent.'
    },
    {
        term: 'Driver',
        category: 'Electrical',
        short: 'The power supply that turns mains AC into the current an LED needs.',
        detail: 'The driver sets dimming compatibility, flicker and lifetime. Keep it accessible or use a fixture with a serviceable driver.'
    },
    {
        term: 'Smart switch neutral',
        category: 'Electrical',
        short: 'A neutral conductor at the switch box to power electronics.',
        detail: 'Most smart dimmers and occupancy sensors need it. In a switch loop there is none, which is why the neutral requirement appears early.'
    },
    {
        term: 'Occupancy / vacancy sensor',
        category: 'Electrical',
        short: 'Automatic-on with motion, or manual-on and automatic-off.',
        detail: 'Vacancy control is preferred where false-on is annoying. Sensors may need a neutral and a compatible load.'
    },
    {
        term: 'Home run',
        category: 'Electrical',
        short: 'The cable from the panel to the first outlet on a branch circuit.',
        detail: 'The estimate here is a planning length: Manhattan route from the panel, daisy-chain between devices, a drop allowance and slack.'
    },
    {
        term: 'Connected load',
        category: 'Electrical',
        short: 'The sum of the ratings of everything on a circuit, in watts or volt-amperes.',
        detail: 'Lighting uses fixture watts; general receptacles count 180 VA each for the calculation, not what is actually plugged in.'
    },
    {
        term: 'Volt-ampere (VA)',
        category: 'Electrical',
        short: 'Apparent power: volts × amps. Equal to watts only for a resistive load.',
        detail: 'Circuit breakers are rated in amps; the panel schedule works in VA so motor and electronic loads are not undercounted.'
    },
    {
        term: 'Load calculation',
        category: 'Electrical',
        short: 'The check that a circuit\'s connected load stays at or below 80% of its breaker.',
        detail: 'Continuous loads are limited to 80%; the suite warns above 80% and fails above 100%.'
    },
    {
        term: 'Working clearance',
        category: 'Electrical',
        short: 'The clear space in front of a panel or service equipment.',
        detail: 'Typically 30 in wide, 36 in deep and 6 ft 6 in high, not blocked by shelving or a door swing. Check the local amendment.'
    },
    {
        term: 'CEC 210.8 / 210.52 / 210.70',
        category: 'Code',
        short: 'The California Electrical Code sections for GFCI, receptacle spacing and lighting outlets.',
        detail: 'CEC 210.52(A) is the 6 ft / 12 ft receptacle rule; 210.8 is GFCI; 210.70 is lighting outlets and switching. California amendments and the local AHJ can be stricter.'
    },
    {
        term: '6 ft / 12 ft rule',
        category: 'Code',
        short: 'Receptacles so no point on a wall is more than 6 ft from one, and none more than 12 ft apart.',
        detail: 'The practical maximum gap between receptacles is 12 ft, or 6 ft from each corner. A wall space 2 ft or wider counts.'
    },
    {
        term: 'Lighting outlet',
        category: 'Code',
        short: 'An outlet intended for a luminaire, not the luminaire itself.',
        detail: 'The required lighting outlet is the box and circuit; the fixture is chosen later. CEC 210.70(A)(1) Exception 1 still permits a switched receptacle in rooms other than kitchens and bathrooms.'
    },
    {
        term: 'LPD',
        category: 'Energy',
        short: 'Lighting power density in W/m² (or W/ft²).',
        detail: 'A design metric, not a Title 24 pass/fail limit. California regulates residential lighting through the high-efficacy luminaire and control requirements of §150.0(k).'
    },
    {
        term: 'High-efficacy lamp',
        category: 'Energy',
        short: 'A light source that meets the California high-efficacy classification, in practice a JA8 LED.',
        detail: 'Title 24 §150.0(k)1A and Table 150.0-A require every installed luminaire to be high efficacy; most interior sources must also be JA8 certified.'
    },
    {
        term: 'Color shift',
        category: 'Design',
        short: 'A visible difference in CCT between fixtures of the same nominal colour.',
        detail: 'Buy one batch and one CCT per room. Two "3000 K" products from different bins can look green beside each other.'
    },
    {
        term: 'Layering ratio',
        category: 'Design',
        short: 'The share of total installed lumens in ambient, task, accent and decor.',
        detail: 'A healthy living room is roughly 60% ambient, 20% task and 20% accent. A single layer at 100% is flat no matter how bright.'
    }
];

const round = (value, digits = 1) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

export function glossaryByCategory() {
    const groups = new Map();
    GLOSSARY.forEach((entry) => {
        if (!groups.has(entry.category)) groups.set(entry.category, []);
        groups.get(entry.category).push(entry);
    });
    return [...groups.entries()].map(([category, entries]) => ({ category, entries }));
}

function enrichLuminaire(device) {
    const type = luminaireById(device.typeId);
    return {
        ...device,
        type,
        label: type.label,
        lumens: type.lumens,
        watts: type.watts,
        efficacy: type.efficacy,
        cct: device.cct ?? type.cct,
        cri: type.cri,
        beamAngle: type.beamAngle,
        spacingRatio: type.spacingRatio,
        category: type.category,
        mount: type.mount,
        on: device.on !== false,
        dim: Number.isFinite(device.dim) ? device.dim : 100,
        effectiveLumens: (device.on === false ? 0 : type.lumens) * (Number.isFinite(device.dim) ? device.dim : 100) / 100
    };
}

function cableLengthFor(plan, circuit) {
    const devices = circuitDevices(plan, circuit.id);
    if (!devices.length) return 0;
    const remaining = devices.slice();
    let current = { ...plan.panel };
    let length = 0;
    while (remaining.length) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        remaining.forEach((device, index) => {
            const distance = Math.abs(device.x - current.x) + Math.abs(device.y - current.y);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });
        const device = remaining.splice(nearestIndex, 1)[0];
        length += Math.max(nearestDistance, 0.8) * 1.15;
        length += 1.3; // drop from ceiling or down the wall
        current = device;
    }
    return length + 2; // panel slack
}

function layerTotals(luminaires) {
    const layers = {
        ambient: { count: 0, watts: 0, lumens: 0 },
        task: { count: 0, watts: 0, lumens: 0 },
        accent: { count: 0, watts: 0, lumens: 0 },
        decor: { count: 0, watts: 0, lumens: 0 }
    };
    luminaires.forEach((light) => {
        const key = layers[light.category] ? light.category : 'ambient';
        layers[key].count += 1;
        layers[key].watts += light.watts;
        layers[key].lumens += light.lumens;
    });
    const totalLumens = Object.values(layers).reduce((sum, layer) => sum + layer.lumens, 0);
    Object.values(layers).forEach((layer) => {
        layer.share = totalLumens > 0 ? round((layer.lumens / totalLumens) * 100, 0) : 0;
    });
    return layers;
}

function cctSummary(luminaires) {
    const groups = new Map();
    luminaires.forEach((light) => {
        const key = light.cct;
        if (!groups.has(key)) groups.set(key, { cct: key, count: 0, watts: 0 });
        const group = groups.get(key);
        group.count += 1;
        group.watts += light.watts;
    });
    const entries = [...groups.values()].sort((a, b) => a.cct - b.cct);
    const range = entries.length > 1 ? entries[entries.length - 1].cct - entries[0].cct : 0;
    return {
        entries,
        range,
        mixed: range > 500,
        dominant: entries.slice().sort((a, b) => b.watts - a.watts)[0]?.cct ?? null
    };
}

function buildChecks(design, plan, preset) {
    const checks = [];
    const push = (severity, id, label, detail = '') => checks.push({ severity, id, label, detail });
    const metrics = design.metrics;

    if (!design.luminaires.length) {
        push('error', 'photometry-empty', 'No luminaires to calculate.', 'Place or auto-arrange lights to see illuminance and uniformity.');
    } else {
        const ratio = preset.targetLux > 0 ? metrics.averageLux / preset.targetLux : 1;
        if (ratio < 0.9) {
            push('error', 'target-low', `Average ${Math.round(metrics.averageLux)} lx is below the ${preset.targetLux} lx target.`, 'Add a luminaire, choose a higher-output type, or lower the mounting height. A task layer can lift the important surface without flooding the room.');
        } else if (ratio > 1.75) {
            push('warn', 'target-high', `Average ${Math.round(metrics.averageLux)} lx is ${Math.round((ratio - 1) * 100)}% over the ${preset.targetLux} lx target.`, 'Overlit rooms waste energy and look clinical. Dim, remove a fitting or use a lower-output type.');
        } else {
            push('ok', 'target', `Average ${Math.round(metrics.averageLux)} lx meets the ${preset.targetLux} lx target.`);
        }

        if (metrics.uniformity < 0.4) {
            push('warn', 'uniformity', `Uniformity is ${metrics.uniformity.toFixed(2)}; aim for 0.40 or better.`, 'Reduce the spacing between fittings, widen the beam, or add a second layer.');
        } else {
            push('ok', 'uniformity', `Uniformity ${metrics.uniformity.toFixed(2)} across the work plane.`);
        }

        if (metrics.criMin < 80) {
            push('warn', 'cri', `Lowest CRI is ${metrics.criMin}.`, 'Use 90+ CRI where people eat, work or get ready; colour will look muddy under 80.');
        }

        if (design.cct.mixed) {
            push('warn', 'cct-mix', `The plan mixes ${design.cct.range} K of colour temperature.`, 'A 2700 K lamp beside a 4000 K lamp reads yellow and blue at once. Keep one CCT per room.');
        }

        if (design.metrics.wattsPerM2 > 16) {
            push('warn', 'lpd', `${metrics.wattsPerM2.toFixed(1)} W/m² installed; residential designs usually land under 12–16 W/m².`, 'Check for duplicated layers or an oversized fixture.');
        }
    }

    if (preset.task && !design.layers.task.count) {
        push('warn', 'task-layer', `${preset.label} usually needs a task layer.`, preset.notes);
    }
    if (design.layers.ambient.share > 0 && design.layers.ambient.share > 85 && design.layers.task.count + design.layers.accent.count > 0) {
        push('info', 'layer-share', `Ambient is ${design.layers.ambient.share}% of installed lumens.`, 'A 55–70% ambient share leaves room for task and accent to read.');
    }

    design.circuits.forEach((circuit) => {
        if (circuit.load.amps > circuit.breakerA) {
            push('error', 'circuit-overload', `${circuit.name} draws ${circuit.load.amps} A on a ${circuit.breakerA} A breaker.`, 'Split the circuit or move devices to another branch before this is built.');
        } else if (circuit.load.percent > 80 && circuit.type !== 'dedicated') {
            push('warn', 'circuit-80', `${circuit.name} is at ${circuit.load.percent}% of its breaker.`, 'Continuous loads above 80% leave no headroom; split the circuit.');
        }
    });

    const sockets = design.sockets;
    const gfciRequired = ['kitchen', 'bathroom', 'laundry', 'garage', 'outdoor'].includes(plan.roomType);
    if (gfciRequired) {
        // CEC 210.8(A): 125–250 V receptacles in these locations. In a kitchen
        // the rule covers countertop receptacles, not a dedicated 240 V range.
        const scope = plan.roomType === 'kitchen'
            ? sockets.filter((socket) => !socket.dedicated)
            : sockets;
        const unprotected = scope.filter((socket) => !socket.gfci);
        if (unprotected.length) {
            push('error', 'gfci', `${unprotected.length} receptacle(s) lack GFCI protection in a ${preset.label.toLowerCase()}.`, 'CEC 210.8(A) requires GFCI for 125–250 V receptacles in kitchens, bathrooms, laundry areas, garages, outdoors, basements, crawlspaces and indoor damp or wet locations.');
        } else if (scope.length) {
            push('ok', 'gfci', 'Every required receptacle is GFCI protected.');
        }
    }

    if (plan.roomType === 'kitchen') {
        const kitchenCircuits = design.circuits.filter((circuit) => circuit.type === 'kitchen');
        if (kitchenCircuits.length < 2 && sockets.length) {
            push('error', 'kitchen-circuits', 'Kitchen counter receptacles need two small-appliance circuits.', 'CEC 210.11(C)(1): at least two 20 A small-appliance branch circuits for countertop receptacles.');
        } else if (kitchenCircuits.length >= 2) {
            push('ok', 'kitchen-circuits', 'Two kitchen small-appliance circuits.');
        }
    }

    if (plan.roomType === 'outdoor') {
        sockets.filter((socket) => !socket.weatherResistant).forEach(() => {
            push('error', 'wr', 'An outdoor receptacle is not weather resistant.', 'Use a WR-rated receptacle with an in-use cover (CEC 406.9).');
        });
    }

    const noSwitch = design.switches.filter((device) => !(device.controls || []).length);
    if (noSwitch.length) {
        push('warn', 'switch-empty', `${noSwitch.length} switch(es) control no lights.`, 'Bind each switch to at least one luminaire, or remove it from the plan.');
    }

    const installed = design.luminaires.filter((light) => light.type.permanent !== false);
    const habitable = ['living', 'bedroom', 'kitchen', 'dining', 'office'];
    const autoOffRooms = ['bathroom', 'laundry', 'garage', 'closet'];
    const controlledBy = (light, predicate) => design.switches.some((device) => {
        if (!(device.controls || []).includes(light.id)) return false;
        return predicate(switchById(device.typeId));
    });

    // Title 24, Part 6 §150.0(k)2F: dimming in habitable spaces.
    if (habitable.includes(plan.roomType) && installed.length) {
        const hasDimming = (light) => controlledBy(light, (type) => type.dimmable);
        const hasAutoOff = (light) => controlledBy(light, (type) => type.type === 'sensor');
        const unexempt = installed.filter((light) => !hasDimming(light) && !hasAutoOff(light));

        // The exemption is a *controlled load* under 20 W, so the comparison is
        // per switch load, not per fitting: nine 14 W downlights on one plain
        // switch are a 126 W load that needs a dimmer, even though no single
        // fitting draws 20 W.
        const switchesFor = (light) => design.switches.filter((device) => (device.controls || []).includes(light.id));
        const loadBySwitch = new Map();
        unexempt.forEach((light) => {
            switchesFor(light).forEach((device) => {
                loadBySwitch.set(device.id, (loadBySwitch.get(device.id) || 0) + light.watts);
            });
        });
        const missingDimming = unexempt.filter((light) => {
            const controllers = switchesFor(light);
            // A fitting with no switch at all is its own load.
            if (!controllers.length) return light.watts >= 20;
            return controllers.some((device) => (loadBySwitch.get(device.id) || 0) >= 20);
        });
        if (missingDimming.length) {
            const loads = [...loadBySwitch.values()].filter((watts) => watts >= 20);
            const heaviest = loads.length ? ` Controlled loads: ${loads.map((watts) => `${Math.round(watts)} W`).join(', ')}.` : '';
            push('warn', 'energy-controls', `${missingDimming.length} luminaire(s) have no dimmer or automatic-off control.${heaviest}`, 'Title 24 §150.0(k)2F: lighting in habitable spaces needs a wall-mounted dimmer unless the controlled load is under 20 W or an occupancy/vacancy sensor provides automatic-off.');
        } else {
            push('ok', 'energy-controls', 'Habitable-space lighting is dimmable or on an automatic-off sensor.');
        }
    }

    // Title 24, Part 6 §150.0(k)2E: automatic-off in wet, utility and storage rooms.
    if (autoOffRooms.includes(plan.roomType) && design.luminaires.length) {
        const automatic = design.switches.some((device) => {
            const type = switchById(device.typeId);
            return type.type === 'sensor' && (device.controls || []).length > 0;
        });
        if (automatic) {
            push('ok', 'auto-off', 'An occupancy or vacancy sensor provides automatic-off.');
        } else {
            push('warn', 'auto-off', 'No occupancy or vacancy sensor controls the lighting.', 'Title 24 §150.0(k)2E: bathrooms, garages, laundry rooms, utility rooms and walk-in closets need at least one luminaire on an occupancy or vacancy sensor with automatic-off.');
        }
    }

    // Title 24, Part 6 §150.0(k)3: outdoor lighting controls.
    if (plan.roomType === 'outdoor' && design.switches.length) {
        const automatic = design.switches.some((device) => Boolean(switchById(device.typeId).automatic));
        if (automatic) {
            push('ok', 'outdoor-controls', 'Outdoor lighting has an automatic control.');
        } else {
            push('warn', 'outdoor-controls', 'Outdoor lighting has no photocell or astronomical control.', 'Title 24 §150.0(k)3: outdoor lighting needs a manual ON/OFF switch plus a photocell and motion sensor or time switch, or an astronomical time clock.');
        }
    }

    // Title 24, Part 6 §150.0(k)2G: under-cabinet lighting switches separately.
    if (plan.roomType === 'kitchen') {
        const undercabinet = design.luminaires.filter((light) => light.type.id === 'undercabinet-strip');
        if (undercabinet.length) {
            const shared = design.switches.some((device) => {
                const controls = (device.controls || [])
                    .map((id) => design.luminaires.find((light) => light.id === id))
                    .filter(Boolean);
                const hasTask = controls.some((light) => light.type.id === 'undercabinet-strip');
                const hasCeiling = controls.some((light) => light.type.id !== 'undercabinet-strip');
                return hasTask && hasCeiling;
            });
            const separate = design.switches.some((device) => {
                const controls = (device.controls || [])
                    .map((id) => design.luminaires.find((light) => light.id === id))
                    .filter(Boolean);
                return controls.length > 0 && controls.every((light) => light.type.id === 'undercabinet-strip');
            });
            if (shared || !separate) {
                push('warn', 'independent-controls', 'Under-cabinet lighting shares a control with the ceiling lighting.', 'Title 24 §150.0(k)2G: under-cabinet, undershelf and display-cabinet lighting must be controlled separately from ceiling lighting.');
            } else {
                push('ok', 'independent-controls', 'Under-cabinet lighting has its own control.');
            }
        }
    }

    // CEC 210.12(A): every 120 V, 15/20 A branch circuit needs AFCI.
    const afciCircuits = design.circuits.filter((circuit) => circuit.voltage === 120 && circuit.breakerA <= 20);
    const noAfci = afciCircuits.filter((circuit) => {
        const socketAfci = design.sockets.some((socket) => socket.circuitId === circuit.id && socket.afci);
        return !circuit.afci && !socketAfci;
    });
    if (noAfci.length) {
        push('warn', 'afci', `${noAfci.length} 120 V branch circuit(s) have no AFCI protection modelled.`, 'CEC 210.12(A) requires combination-type AFCI protection for 120 V, 15/20 A dwelling-unit branch circuits. Use an AFCI breaker unless a listed exception applies.');
    } else if (afciCircuits.length) {
        push('ok', 'afci', '120 V branch circuits are on AFCI breakers.');
    }

    // Title 24, Part 6 §150.0(k)1: high-efficacy, JA8 luminaires.
    const exemptFromJa8 = (light) => plan.roomType === 'outdoor' || light.type.ja8Exempt === true;
    const notJa8 = installed.filter((light) => !exemptFromJa8(light) && light.type.ja8 !== true);
    if (notJa8.length) {
        push('error', 'efficacy', `${notJa8.length} installed luminaire(s) are not JA8 certified.`, 'Title 24 §150.0(k)1A and Table 150.0-A: all installed luminaires must be high efficacy, and most interior sources must be JA8 certified.');
    } else if (installed.length) {
        push('ok', 'efficacy', 'Installed luminaires meet the Title 24 high-efficacy/JA8 requirement.');
    }

    const recessedBad = installed.filter((light) => light.type.mount === 'recessed'
        && (light.type.ja8 !== true || light.type.screwBase === true || light.type.airtight !== true));
    if (recessedBad.length) {
        push('error', 'recessed-ja8', `${recessedBad.length} recessed downlight(s) fail the Title 24 downlight rules.`, 'Title 24 §150.0(k)1C: ceiling recessed downlights must be JA8, have no screw-base socket, and be airtight (under 2.0 cfm at 75 Pa).');
    } else if (installed.some((light) => light.type.mount === 'recessed')) {
        push('ok', 'recessed-ja8', 'Recessed downlights are JA8, screw-base-free and airtight.');
    }

    return checks;
}

function buildBom(design, plan) {
    const rows = [];
    const luminaires = new Map();
    design.luminaires.forEach((light) => {
        const key = light.typeId;
        if (!luminaires.has(key)) luminaires.set(key, { type: light.type, count: 0 });
        luminaires.get(key).count += 1;
    });
    luminaires.forEach(({ type, count }) => {
        rows.push({ group: 'Luminaires', label: type.label, qty: count, unit: 'ea', unitCost: type.cost, total: count * type.cost, note: type.watts + ' W · ' + type.lumens + ' lm' });
    });

    const switches = new Map();
    design.switches.forEach((device) => {
        const type = switchById(device.typeId);
        if (!switches.has(type.id)) switches.set(type.id, { type, count: 0 });
        switches.get(type.id).count += 1;
    });
    switches.forEach(({ type, count }) => {
        rows.push({ group: 'Controls', label: type.label, qty: count, unit: 'ea', unitCost: type.cost, total: count * type.cost, note: type.notes });
    });

    const sockets = new Map();
    design.sockets.forEach((device) => {
        const type = socketById(device.typeId);
        if (!sockets.has(type.id)) sockets.set(type.id, { type, count: 0 });
        sockets.get(type.id).count += 1;
    });
    sockets.forEach(({ type, count }) => {
        rows.push({ group: 'Receptacles', label: type.label, qty: count, unit: 'ea', unitCost: type.cost, total: count * type.cost, note: type.notes });
    });

    const cableTotals = new Map();
    design.circuits.forEach((circuit) => {
        const cable = cableById(circuit.wire);
        const key = cable.id;
        if (!cableTotals.has(key)) cableTotals.set(key, { cable, metres: 0, circuits: 0 });
        const entry = cableTotals.get(key);
        entry.metres += circuit.cableMetres;
        entry.circuits += 1;
    });
    cableTotals.forEach(({ cable, metres, circuits }) => {
        const buy = Math.ceil(metres / 30.5) * 30.5;
        rows.push({
            group: 'Cable', label: cable.label, qty: round(buy, 1), unit: 'm', unitCost: cable.costPerM,
            total: round(buy * cable.costPerM, 2), note: `${circuits} circuit(s), ${metres.toFixed(1)} m estimated run plus coil waste`
        });
    });

    const breakerCounts = new Map();
    design.circuits.forEach((circuit) => {
        const poles = circuit.voltage === 240 ? 2 : 1;
        const breakerType = circuit.afci ? 'afci' : 'standard';
        const breaker = BREAKERS.find((entry) => entry.amps === circuit.breakerA && entry.poles === poles && entry.type === breakerType)
            || BREAKERS.find((entry) => entry.amps === circuit.breakerA && entry.poles === poles)
            || BREAKERS.find((entry) => entry.amps === circuit.breakerA)
            || BREAKERS[0];
        if (!breakerCounts.has(breaker.id)) breakerCounts.set(breaker.id, { breaker, count: 0 });
        breakerCounts.get(breaker.id).count += 1;
    });
    breakerCounts.forEach(({ breaker, count }) => {
        rows.push({ group: 'Panel', label: breaker.label, qty: count, unit: 'ea', unitCost: breaker.cost, total: count * breaker.cost, note: 'One pole space per single-pole breaker' });
    });

    const boxCount = design.devices.length;
    rows.push({ group: 'Boxes', label: 'Device box · 2-1/8 in deep', qty: boxCount, unit: 'ea', unitCost: 3.2, total: round(boxCount * 3.2, 2), note: 'One box per switch, receptacle and luminaire outlet' });
    rows.push({ group: 'Boxes', label: 'Cable clamp and connector', qty: boxCount, unit: 'ea', unitCost: 1.35, total: round(boxCount * 1.35, 2), note: 'One per box entry' });
    rows.push({ group: 'Boxes', label: 'Wire nut assortment', qty: Math.max(1, Math.ceil(boxCount / 10)), unit: 'pack', unitCost: 8.5, total: Math.max(1, Math.ceil(boxCount / 10)) * 8.5, note: 'Allow one pack per ten boxes' });

    const labourHours = design.luminaires.length * 0.75 + design.switches.length * 0.4 + design.sockets.length * 0.5 + design.circuits.length * 0.9;
    rows.push({ group: 'Labour', label: 'Electrical labour', qty: round(labourHours, 1), unit: 'h', unitCost: 65, total: round(labourHours * 65, 2), note: 'Fixture, device and circuit rough-in at a planning rate' });

    const groups = new Map();
    rows.forEach((row) => {
        if (!groups.has(row.group)) groups.set(row.group, { group: row.group, rows: [], total: 0 });
        const group = groups.get(row.group);
        group.rows.push(row);
        group.total += row.total;
    });
    return {
        rows,
        groups: [...groups.values()],
        total: round(rows.reduce((sum, row) => sum + row.total, 0), 2),
        assumptions: [
            'Prices are planning allowances, not quotes; check local supplier pricing before ordering.',
            'Cable is bought in 30.5 m coils and estimated by a Manhattan route from the panel plus a drop allowance.',
            'Labour is 65/h for rough-in and trim; a finished ceiling, plaster repair or panel work adds more.',
            'Boxes, clamps, wire nuts and breakers are included; the panel itself is not.'
        ]
    };
}

/** Build every design number for one plan. */
export function designLighting(plan, {
    reflectances = DEFAULT_REFLECTANCES,
    llf = DEFAULT_LLF,
    steps = 20
} = {}) {
    const preset = roomPresetById(plan.roomType);
    const luminaires = devicesOf(plan, 'luminaire').map(enrichLuminaire);
    const switches = devicesOf(plan, 'switch');
    const sockets = devicesOf(plan, 'socket').map((device) => {
        const type = socketById(device.typeId);
        return {
            ...device,
            type,
            label: type.label,
            gfci: type.gfci,
            afci: type.afci,
            weatherResistant: type.weatherResistant,
            tamperResistant: type.tamperResistant,
            dedicated: type.dedicated,
            ratingA: type.ratingA,
            voltage: type.voltage
        };
    });
    const area = Math.max(plan.width * plan.depth, 0.1);
    const litLuminaires = luminaires.filter((light) => light.on);
    const totalLumens = luminaires.reduce((sum, light) => sum + light.lumens, 0);
    const litLumens = litLuminaires.reduce((sum, light) => sum + light.effectiveLumens, 0);
    const connectedW = luminaires.reduce((sum, light) => sum + light.watts, 0);
    const litW = litLuminaires.reduce((sum, light) => sum + light.watts * light.dim / 100, 0);
    // Photometry is the installed design at full output. The on/off state is a
    // control preview, so switching a layer off must not fail the design check.
    const method = lumenMethod({
        totalLumens,
        width: plan.width,
        depth: plan.depth,
        mountingHeight: plan.mountingHeight,
        reflectances,
        llf
    });
    const litMethod = lumenMethod({
        totalLumens: litLumens,
        width: plan.width,
        depth: plan.depth,
        mountingHeight: plan.mountingHeight,
        reflectances,
        llf
    });
    const grid = illuminanceGrid({
        width: plan.width,
        depth: plan.depth,
        mountingHeight: plan.mountingHeight,
        luminaires: luminaires.map((light) => ({
            ...light,
            lumens: light.lumens,
            mountHeight: light.mountHeight,
            on: true
        })),
        steps
    });
    const effectiveMountingHeight = Math.max(plan.mountingHeight, 0.5);
    const targetSpacing = luminaires.length ? spacingFor(luminaires[0].type, effectiveMountingHeight) : 0;

    const metrics = {
        area: round(area, 2),
        totalLumens: round(totalLumens, 0),
        litLumens: round(litLumens, 0),
        designedLux: round(method.averageLux, 1),
        averageLux: round(method.averageLux, 1),
        litLux: round(litMethod.averageLux, 1),
        targetLux: preset.targetLux,
        targetRatio: preset.targetLux ? round(method.averageLux / preset.targetLux, 2) : 0,
        roomIndex: round(method.roomIndex, 2),
        cu: round(method.cu, 2),
        llf,
        uniformity: round(grid.uniformity, 2),
        averageToMin: round(grid.averageToMin, 2),
        minLux: round(grid.min, 1),
        maxLux: round(grid.max, 1),
        connectedW: round(connectedW, 1),
        litW: round(litW, 1),
        wattsPerM2: round(connectedW / area, 2),
        lpd: round(connectedW / area, 2),
        efficacy: connectedW ? round(totalLumens / connectedW, 1) : 0,
        criMin: luminaires.length ? Math.min(...luminaires.map((light) => light.cri)) : 0,
        cctMin: luminaires.length ? Math.min(...luminaires.map((light) => light.cct)) : 0,
        cctMax: luminaires.length ? Math.max(...luminaires.map((light) => light.cct)) : 0,
        spacing: round(targetSpacing, 2),
        litCount: litLuminaires.length,
        totalCount: luminaires.length
    };

    const layers = layerTotals(luminaires);
    const cct = cctSummary(luminaires);
    const circuitRows = (plan.circuits || []).map((circuit) => {
        const load = circuitLoad(plan, circuit.id);
        const devices = circuitDevices(plan, circuit.id).map((device) => ({
            ...device,
            circuitName: circuit.name
        }));
        return {
            ...circuit,
            breakerA: circuit.breakerA,
            load,
            devices,
            cableMetres: round(cableLengthFor(plan, circuit), 1)
        };
    });
    const design = {
        plan,
        preset,
        summary: planSummary(plan),
        luminaires,
        switches,
        sockets,
        devices: plan.devices,
        metrics,
        grid,
        layers,
        cct,
        circuits: circuitRows,
        layoutChecks: validateLayout(plan)
    };
    design.checks = [...buildChecks(design, plan, preset), ...design.layoutChecks];
    design.errors = design.checks.filter((check) => check.severity === 'error');
    design.warnings = design.checks.filter((check) => check.severity === 'warn');
    design.bom = buildBom(design, plan);
    design.cost = {
        materials: round(design.bom.rows.filter((row) => row.group !== 'Labour').reduce((sum, row) => sum + row.total, 0), 2),
        labour: round(design.bom.rows.filter((row) => row.group === 'Labour').reduce((sum, row) => sum + row.total, 0), 2),
        total: design.bom.total
    };
    design.schedule = plan.devices.map((device, index) => {
        const type = device.kind === 'luminaire' ? luminaireById(device.typeId)
            : device.kind === 'switch' ? switchById(device.typeId) : socketById(device.typeId);
        return {
            tag: `${device.kind === 'luminaire' ? 'L' : device.kind === 'switch' ? 'S' : 'R'}${index + 1}`,
            kind: device.kind,
            label: type.label,
            location: device.kind === 'luminaire' ? 'Ceiling' : `${device.wall} wall`,
            mountingHeight: device.mountHeight,
            circuit: circuitRows.find((circuit) => circuit.id === device.circuitId)?.name || '—',
            controlled: (device.controls || []).length,
            va: device.kind === 'luminaire' ? type.watts : device.kind === 'socket' ? (type.dedicated ? type.ratingA * type.voltage : 180) : 0
        };
    });
    return design;
}

function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Outlet schedule as CSV, one row per device. */
export function designCsv(design) {
    const lines = [
        ['Tag', 'Kind', 'Type', 'Room', 'Location', 'Mount (m)', 'Circuit', 'Watts or VA', 'Controlled lights'],
        ...design.schedule.map((row) => [
            row.tag, row.kind, row.label, design.preset.label, row.location,
            row.mountingHeight?.toFixed(2) ?? '', row.circuit, row.va, row.controlled
        ])
    ];
    return lines.map((line) => line.map(csvCell).join(',')).join('\n');
}

/** Human-readable summary for the sidebar hand-off. */
export function designSummaryText(design) {
    const m = design.metrics;
    const parts = [
        `${design.preset.label} · ${m.area} m²`,
        `${m.averageLux} lx average (target ${m.targetLux} lx)`,
        `${m.uniformity.toFixed(2)} uniformity`,
        `${design.luminaires.length} luminaires · ${design.switches.length} switches · ${design.sockets.length} sockets`,
        `${design.circuits.length} circuits · ${design.cost.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
    ];
    return parts.join(' · ');
}

export const CATALOG_COUNTS = {
    luminaires: LUMINAIRES.length,
    switches: SWITCHES.length,
    sockets: SOCKETS.length,
    cables: CABLES.length
};
