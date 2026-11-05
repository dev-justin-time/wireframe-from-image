import {
    luminaireById,
    switchById,
    socketById,
    roomPresetById,
    circuitTypeById
} from './catalog.js';
import { spacingFor, lumenMethod } from './photometry.js';

/**
 * The interactive plan model.
 *
 * Devices live in room metres: x runs left to right, y runs from the top wall
 * to the bottom wall. Walls are at x = 0 / width and y = 0 / depth, so a switch
 * or socket on a wall is exactly on the boundary and carries its wall name.
 * Luminaires sit inside the room at the mounting height.
 */

export const WALLS = ['north', 'south', 'east', 'west'];

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function nextId(plan, prefix) {
    plan.seq = (plan.seq || 0) + 1;
    return `${prefix}_${plan.seq}`;
}

export function createPlan({
    roomType = 'living',
    width = 5,
    depth = 4.2,
    height = 2.7,
    mountingHeight = 2.4,
    insulation = true,
    fireRatedCeiling = false,
    neutralAtSwitch = true
} = {}) {
    const preset = roomPresetById(roomType);
    const w = clamp(Number(width) || 5, 2, 30);
    const d = clamp(Number(depth) || 4.2, 2, 30);
    const h = clamp(Number(height) || 2.7, 2.2, 6);
    return {
        id: `lighting_plan_${Date.now()}`,
        roomType: preset.id,
        width: round(w),
        depth: round(d),
        height: round(h),
        mountingHeight: round(clamp(Number(mountingHeight) || h - 0.3, 1.8, h - 0.1)),
        cct: preset.cct,
        entry: { x: round(w * 0.42), y: round(d) },
        panel: { x: 0.35, y: round(d - 0.35) },
        socketSpacing: preset.socketSpacing,
        socketHeight: preset.socketHeight,
        switchHeight: preset.switchHeight,
        insulation: Boolean(insulation),
        fireRatedCeiling: Boolean(fireRatedCeiling),
        neutralAtSwitch: Boolean(neutralAtSwitch),
        devices: [],
        circuits: [],
        seq: 0
    };
}

/** A saved or imported plan gets every missing field filled in. */
export function normalizePlan(raw) {
    const base = createPlan({ roomType: raw?.roomType, width: raw?.width, depth: raw?.depth });
    if (!raw || typeof raw !== 'object') return base;
    const plan = {
        ...base,
        ...raw,
        entry: { ...base.entry, ...(raw.entry || {}) },
        panel: { ...base.panel, ...(raw.panel || {}) },
        devices: Array.isArray(raw.devices) ? raw.devices : [],
        circuits: Array.isArray(raw.circuits) ? raw.circuits : [],
        seq: Math.max(Number(raw.seq) || 0, (raw.devices || []).length, (raw.circuits || []).length)
    };
    plan.width = clamp(Number(plan.width) || 5, 2, 30);
    plan.depth = clamp(Number(plan.depth) || 4.2, 2, 30);
    plan.height = clamp(Number(plan.height) || 2.7, 2.2, 6);
    plan.mountingHeight = clamp(Number(plan.mountingHeight) || plan.height - 0.3, 1.8, plan.height - 0.1);
    plan.cct = clamp(Number(plan.cct) || roomPresetById(plan.roomType).cct, 2200, 6500);
    plan.entry = { x: clamp(Number(plan.entry.x) || plan.width * 0.42, 0, plan.width), y: clamp(Number(plan.entry.y) || plan.depth, 0, plan.depth) };
    plan.panel = { x: clamp(Number(plan.panel.x) || 0.35, 0, plan.width), y: clamp(Number(plan.panel.y) || plan.depth - 0.35, 0, plan.depth) };
    plan.socketSpacing = clamp(Number(plan.socketSpacing) || 3.66, 1.2, 6);
    plan.devices = plan.devices
        .filter((device) => device && device.kind && device.typeId)
        .map((device) => ({
            ...device,
            x: clamp(Number(device.x) || 0, 0, plan.width),
            y: clamp(Number(device.y) || 0, 0, plan.depth),
            on: device.on !== false,
            controls: Array.isArray(device.controls) ? device.controls : []
        }));
    return plan;
}

export function devicesOf(plan, kind) {
    return (plan?.devices || []).filter((device) => device.kind === kind);
}

export function deviceById(plan, id) {
    return (plan?.devices || []).find((device) => device.id === id) || null;
}

export function circuitById(plan, id) {
    return (plan?.circuits || []).find((circuit) => circuit.id === id) || null;
}

/** The nearest wall, its name and the along-wall coordinate. */
export function nearestWall(plan, x, y) {
    const distances = [
        { wall: 'north', distance: Math.abs(y), along: x },
        { wall: 'south', distance: Math.abs(plan.depth - y), along: x },
        { wall: 'west', distance: Math.abs(x), along: y },
        { wall: 'east', distance: Math.abs(plan.width - x), along: y }
    ];
    return distances.sort((a, b) => a.distance - b.distance)[0];
}

function wallPoint(plan, wall, along) {
    if (wall === 'north') return { x: clamp(along, 0, plan.width), y: 0 };
    if (wall === 'south') return { x: clamp(along, 0, plan.width), y: plan.depth };
    if (wall === 'west') return { x: 0, y: clamp(along, 0, plan.depth) };
    return { x: plan.width, y: clamp(along, 0, plan.depth) };
}

/** Put a wall device exactly on its wall and record which wall it is on. */
export function snapToWall(plan, kind, x, y) {
    const nearest = nearestWall(plan, x, y);
    const point = wallPoint(plan, nearest.wall, nearest.along);
    return {
        ...point,
        wall: nearest.wall,
        along: round(nearest.along),
        mountHeight: kind === 'switch' ? plan.switchHeight : plan.socketHeight
    };
}

export function addDevice(plan, { kind, typeId, x = plan.width / 2, y = plan.depth / 2, circuitId = null, on = true } = {}) {
    if (!['luminaire', 'switch', 'socket'].includes(kind)) return null;
    const type = kind === 'luminaire' ? luminaireById(typeId) : kind === 'switch' ? switchById(typeId) : socketById(typeId);
    const device = {
        id: nextId(plan, kind),
        kind,
        typeId: type.id,
        label: type.label,
        on: on !== false,
        dim: 100,
        circuitId,
        controls: []
    };
    const hasX = Number.isFinite(Number(x));
    const hasY = Number.isFinite(Number(y));
    if (kind === 'luminaire') {
        if (type.mount === 'wall') {
            Object.assign(device, snapToWall(plan, 'socket',
                hasX ? Number(x) : plan.width / 2,
                hasY ? Number(y) : plan.depth / 2));
            device.mountHeight = 1.8;
        } else {
            device.x = round(clamp(hasX ? Number(x) : plan.width / 2, 0.05, plan.width - 0.05));
            device.y = round(clamp(hasY ? Number(y) : plan.depth / 2, 0.05, plan.depth - 0.05));
            device.wall = null;
            device.mountHeight = plan.mountingHeight;
        }
        device.cct = plan.cct;
    } else {
        Object.assign(device, snapToWall(plan, kind,
            hasX ? Number(x) : plan.width / 2,
            hasY ? Number(y) : plan.depth / 2));
        device.on = true;
    }
    plan.devices.push(device);
    return device;
}

export function removeDevice(plan, id) {
    const index = plan.devices.findIndex((device) => device.id === id);
    if (index < 0) return false;
    plan.devices.splice(index, 1);
    plan.devices.forEach((device) => {
        if (Array.isArray(device.controls)) device.controls = device.controls.filter((controlled) => controlled !== id);
    });
    return true;
}

/** Move a device; wall devices snap to the nearest wall, lights stay inside. */
export function moveDevice(plan, id, x, y) {
    const device = deviceById(plan, id);
    if (!device) return null;
    if (device.kind === 'luminaire') {
        const type = luminaireById(device.typeId);
        if (type.mount === 'wall') {
            Object.assign(device, snapToWall(plan, 'socket',
                Number.isFinite(Number(x)) ? Number(x) : device.x,
                Number.isFinite(Number(y)) ? Number(y) : device.y));
            device.mountHeight = 1.8;
        } else {
            device.x = round(clamp(Number.isFinite(Number(x)) ? Number(x) : device.x, 0.05, plan.width - 0.05));
            device.y = round(clamp(Number.isFinite(Number(y)) ? Number(y) : device.y, 0.05, plan.depth - 0.05));
            device.mountHeight = plan.mountingHeight;
        }
    } else {
        Object.assign(device, snapToWall(plan, device.kind,
            Number.isFinite(Number(x)) ? Number(x) : device.x,
            Number.isFinite(Number(y)) ? Number(y) : device.y));
    }
    return device;
}

/**
 * Grid layout across the room. Spacing is the luminaire's published spacing
 * ratio times the mounting height, softened by 10% so a normal room gets the
 * four-to-six fittings its average illuminance needs.
 */
export function autoLights(plan, { typeId, replace = true, count = null } = {}) {
    if (replace) {
        plan.devices = plan.devices.filter((device) => device.kind !== 'luminaire');
    }
    const type = luminaireById(typeId);
    const mounting = Math.max(plan.mountingHeight - 0.1, 1.2);
    const spacing = Math.max(spacingFor(type, mounting) * 0.9, 0.8);
    const preset = roomPresetById(plan.roomType);
    const area = plan.width * plan.depth;
    const lockedCount = Number.isFinite(count) && count > 0;
    // Enough fittings for the room's target average, then enough to keep the
    // fittings within their spacing ratio. Whichever needs more wins.
    const targetCount = Math.max(1, Math.ceil((preset.targetLux * area) / Math.max(type.lumens * 0.48, 1)));
    const layoutCount = Math.max(1, Math.round(plan.width / spacing)) * Math.max(1, Math.round(plan.depth / spacing));
    let wanted = lockedCount
        ? Math.round(count)
        : plan.roomType === 'dining' ? 1 : Math.max(targetCount, layoutCount);
    let cols = wanted === 1 ? 1 : Math.max(1, Math.round(Math.sqrt(wanted * plan.width / Math.max(plan.depth, 0.1))));
    let rows = Math.max(1, Math.ceil(wanted / cols));

    // The first pass uses a mid-range CU; the real room shape can need another
    // row. Step the count until the suite's photometry reaches 95% of target.
    if (!lockedCount && plan.roomType !== 'dining') {
        for (let candidate = wanted; candidate <= 40; candidate += 1) {
            cols = candidate === 1 ? 1 : Math.max(1, Math.round(Math.sqrt(candidate * plan.width / Math.max(plan.depth, 0.1))));
            rows = Math.max(1, Math.ceil(candidate / cols));
            const countNow = cols * rows;
            const average = lumenMethod({
                totalLumens: countNow * type.lumens,
                width: plan.width,
                depth: plan.depth,
                mountingHeight: plan.mountingHeight
            }).averageLux;
            wanted = candidate;
            if (average >= preset.targetLux * 0.9) break;
        }
    }
    const made = [];
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            made.push(addDevice(plan, {
                kind: 'luminaire',
                typeId: type.id,
                x: (col + 0.5) * (plan.width / cols),
                y: (row + 0.5) * (plan.depth / rows)
            }));
        }
    }
    return made;
}

/** Perimeter sockets, spaced so no wall point is far from one. */
export function autoSockets(plan, { typeId, minCount = 0, spacing = plan.socketSpacing, replace = true } = {}) {
    if (replace) plan.devices = plan.devices.filter((device) => device.kind !== 'socket');
    const type = socketById(typeId);
    const made = [];
    const walls = [
        { wall: 'north', length: plan.width },
        { wall: 'south', length: plan.width },
        { wall: 'east', length: plan.depth },
        { wall: 'west', length: plan.depth }
    ];
    walls.forEach(({ wall, length }) => {
        const n = Math.max(1, Math.ceil(length / Math.max(spacing, 0.8)));
        for (let i = 0; i < n; i += 1) {
            const along = ((i + 0.5) / n) * length;
            const point = wallPoint(plan, wall, along);
            made.push(addDevice(plan, { kind: 'socket', typeId: type.id, ...point }));
        }
    });
    while (made.length < Math.max(Number(minCount) || 0, 0)) {
        made.push(addDevice(plan, {
            kind: 'socket',
            typeId: type.id,
            x: clamp((made.length + 0.5) * (plan.width / (Math.max(Number(minCount) || 0, 1) + 1)), 0.2, plan.width - 0.2),
            y: plan.depth
        }));
    }
    return made;
}

/** One switch at the entry, or a pair at each end of a stair or long hall. */
export function autoSwitches(plan, { typeId, count = null, replace = true } = {}) {
    if (replace) plan.devices = plan.devices.filter((device) => device.kind !== 'switch');
    const twoWay = plan.roomType === 'stairs' || (plan.roomType === 'hallway' && plan.width >= 4)
        || (Number.isFinite(count) && count >= 2);
    const countWanted = Math.max(1, Number.isFinite(count) ? Math.round(count) : (twoWay ? 2 : 1));
    const preset = roomPresetById(plan.roomType);
    // Title 24, Part 6: dimming is the default in habitable rooms, while
    // bathrooms, garages, laundry rooms and walk-in closets need automatic-off.
    const preferredType = preset.autoOff ? 'vacancy-sensor'
        : preset.dimmer ? 'dimmer-led'
            : preset.switchType;
    const wantedType = !twoWay && (!typeId || typeId === preset.switchType)
        ? preferredType
        : (typeId || preset.switchType);
    const type = switchById(twoWay ? 'three-way' : wantedType);
    const made = [];
    for (let i = 0; i < countWanted; i += 1) {
        const atFarEnd = i === 1;
        const x = atFarEnd ? plan.width * 0.72 : plan.width * 0.42;
        const y = atFarEnd ? 0 : plan.depth;
        made.push(addDevice(plan, {
            kind: 'switch',
            typeId: type.id,
            x,
            y
        }));
    }
    const lights = devicesOf(plan, 'luminaire').map((device) => device.id);
    made.forEach((device) => { device.controls = [...lights]; });

    // Title 24, Part 6 §150.0(k)2G: under-cabinet lighting must switch
    // separately from the ceiling lighting, so split it onto its own control.
    const taskLights = devicesOf(plan, 'luminaire')
        .filter((device) => luminaireById(device.typeId).id === 'undercabinet-strip')
        .map((device) => device.id);
    if (plan.roomType === 'kitchen' && made.length === 1 && taskLights.length) {
        const ceilingLights = lights.filter((id) => !taskLights.includes(id));
        made[0].controls = ceilingLights;
        const taskSwitch = addDevice(plan, {
            kind: 'switch',
            typeId: type.id,
            x: plan.width * 0.72,
            y: plan.depth
        });
        taskSwitch.controls = taskLights;
        made.push(taskSwitch);
    }
    return made;
}

export function bindSwitch(plan, switchId, luminaireId, bind = true) {
    const device = deviceById(plan, switchId);
    if (!device || device.kind !== 'switch') return null;
    const light = deviceById(plan, luminaireId);
    if (!light || light.kind !== 'luminaire') return null;
    const set = new Set(device.controls || []);
    if (bind) set.add(light.id);
    else set.delete(light.id);
    device.controls = [...set];
    return device;
}

export function bindAllLights(plan, switchId) {
    const device = deviceById(plan, switchId);
    if (!device || device.kind !== 'switch') return null;
    device.controls = devicesOf(plan, 'luminaire').map((light) => light.id);
    return device;
}

export function controlsFor(plan, switchId) {
    const device = deviceById(plan, switchId);
    if (!device || device.kind !== 'switch') return [];
    return (device.controls || [])
        .map((id) => deviceById(plan, id))
        .filter((light) => light && light.kind === 'luminaire');
}

/** Flip every light the switch controls. */
export function toggleSwitch(plan, switchId) {
    const lights = controlsFor(plan, switchId);
    if (!lights.length) return [];
    const next = !lights.every((light) => light.on !== false);
    lights.forEach((light) => { light.on = next; });
    return lights;
}

export function setMaster(plan, on) {
    devicesOf(plan, 'luminaire').forEach((light) => { light.on = Boolean(on); });
    return plan;
}

export function toggleLuminaire(plan, id) {
    const light = deviceById(plan, id);
    if (!light || light.kind !== 'luminaire') return null;
    light.on = light.on === false;
    return light;
}

export function circuitDevices(plan, circuitId) {
    return (plan.devices || []).filter((device) => device.circuitId === circuitId);
}

/** Connected load on one circuit. General sockets count 180 VA each. */
export function circuitLoad(plan, circuitId) {
    const circuit = circuitById(plan, circuitId);
    const devices = circuitDevices(plan, circuitId);
    const voltage = circuit?.voltage || 120;
    let va = 0;
    devices.forEach((device) => {
        if (device.kind === 'luminaire') {
            const type = luminaireById(device.typeId);
            va += type.watts;
        } else if (device.kind === 'socket') {
            const type = socketById(device.typeId);
            va += type.dedicated ? type.ratingA * type.voltage : 180;
        }
    });
    const amps = voltage > 0 ? va / voltage : 0;
    return {
        va: round(va, 1),
        amps: round(amps, 2),
        breakerA: circuit?.breakerA || 15,
        percent: circuit?.breakerA ? round((amps / circuit.breakerA) * 100, 1) : 0,
        devices: devices.length
    };
}

function makeCircuit(plan, typeId, label, breakerA, voltage, wire) {
    const type = circuitTypeById(typeId);
    const circuit = {
        id: nextId(plan, 'circuit'),
        name: label,
        type: type.id,
        colour: type.colour,
        breakerA,
        voltage,
        wire,
        // CEC 210.12(A): 120 V, 15/20 A dwelling-unit branch circuits need
        // combination-type AFCI protection. The takeoff selects an AFCI breaker.
        afci: voltage === 120 && breakerA <= 20
    };
    plan.circuits.push(circuit);
    return circuit;
}

/**
 * Rebuild the circuit list from the devices: a lighting circuit, the kitchen
 * small-appliance pair, and one circuit per special room or dedicated load.
 */
export function autoCircuits(plan) {
    plan.circuits = [];
    (plan.devices || []).forEach((device) => { device.circuitId = null; });

    const lights = devicesOf(plan, 'luminaire');
    const switches = devicesOf(plan, 'switch');
    const sockets = devicesOf(plan, 'socket');
    const lightingBreaker = 15;
    const lightingCurrent = lights.reduce((sum, device) => sum + luminaireById(device.typeId).watts, 0) / 120;
    const lightingCircuits = lightingCurrent > 12 ? 2 : 1;
    const lighting = [];
    for (let i = 0; i < lightingCircuits; i += 1) {
        lighting.push(makeCircuit(plan, 'lighting', `L${i + 1} · lighting`, lightingBreaker, 120, '14-2'));
    }
    lights.forEach((device, index) => { device.circuitId = lighting[index % lighting.length].id; });
    switches.forEach((device) => { device.circuitId = lighting[0].id; });

    const dedicated = sockets.filter((device) => socketById(device.typeId).dedicated);
    const general = sockets.filter((device) => !socketById(device.typeId).dedicated);

    const roomCircuits = [];
    if (plan.roomType === 'kitchen' && general.length) {
        roomCircuits.push(makeCircuit(plan, 'kitchen', 'K1 · small appliance', 20, 120, '12-2'));
        roomCircuits.push(makeCircuit(plan, 'kitchen', 'K2 · small appliance', 20, 120, '12-2'));
    } else if (general.length) {
        const type = plan.roomType === 'bathroom' ? 'bathroom'
            : plan.roomType === 'laundry' ? 'laundry'
                : plan.roomType === 'garage' ? 'garage'
                    : plan.roomType === 'outdoor' ? 'outdoor' : 'general';
        const prefix = type === 'general' ? 'G' : type.charAt(0).toUpperCase();
        const count = general.length > 9 && type === 'general' ? 2 : 1;
        for (let i = 0; i < count; i += 1) {
            roomCircuits.push(makeCircuit(plan, type, `${prefix}${i + 1} · ${circuitTypeById(type).label}`, 20, 120, '12-2'));
        }
    }

    general.forEach((device, index) => {
        device.circuitId = roomCircuits[index % Math.max(roomCircuits.length, 1)]?.id || null;
    });

    const dedicatedCircuits = new Map();
    dedicated.forEach((device) => {
        const type = socketById(device.typeId);
        const key = `${type.ratingA}`;
        if (!dedicatedCircuits.has(key)) {
            const circuit = makeCircuit(plan, 'dedicated', `D${dedicatedCircuits.size + 1} · ${type.label}`,
                type.ratingA, type.voltage, type.ratingA >= 50 ? '6-3' : type.ratingA >= 30 ? '10-3' : '12-2');
            dedicatedCircuits.set(key, circuit);
        }
        device.circuitId = dedicatedCircuits.get(key).id;
    });

    return plan.circuits;
}

/** Assign one device to a circuit, or clear it with null. */
export function assignCircuit(plan, deviceId, circuitId) {
    const device = deviceById(plan, deviceId);
    if (!device) return null;
    if (circuitId && !circuitById(plan, circuitId)) return null;
    device.circuitId = circuitId;
    return device;
}

function wallDevices(plan, wall) {
    return devicesOf(plan, 'socket').filter((device) => device.wall === wall);
}

function wallLength(plan, wall) {
    return wall === 'north' || wall === 'south' ? plan.width : plan.depth;
}

/**
 * Spatial checks: switch control, entry switch, socket spacing, spacing
 * uniformity, wet/IC ratings and circuit assignment.
 */
export function validateLayout(plan) {
    const checks = [];
    const push = (severity, id, label, detail = '') => checks.push({ severity, id, label, detail });
    const lights = devicesOf(plan, 'luminaire');
    const switches = devicesOf(plan, 'switch');
    const sockets = devicesOf(plan, 'socket');
    const preset = roomPresetById(plan.roomType);

    if (!lights.length) {
        push('error', 'lighting-outlet', 'No lighting outlet in the room.', 'CEC 210.70(A)(1) requires at least one lighting outlet controlled by a listed wall-mounted control device in a habitable room, kitchen or bathroom.');
    } else {
        push('ok', 'lighting-outlet', `${lights.length} lighting outlet${lights.length === 1 ? '' : 's'} placed.`);
    }

    const controlled = new Set(switches.flatMap((device) => device.controls || []));
    const uncontrolled = lights.filter((light) => !controlled.has(light.id));
    if (uncontrolled.length) {
        push('error', 'switch-control', `${uncontrolled.length} light${uncontrolled.length === 1 ? '' : 's'} not controlled by a switch.`, 'Bind every luminaire to a listed wall-mounted control, sensor or smart control (CEC 210.70(A)(1)).');
    } else if (lights.length) {
        push('ok', 'switch-control', 'Every luminaire is controlled by a switch.');
    }

    if (!switches.length) {
        push('error', 'switch-missing', 'No switch in the plan.', 'Every habitable room needs a wall-mounted control near the entry (CEC 210.70(A)(1)).');
    } else {
        const nearest = switches.reduce((best, device) => {
            const distance = Math.hypot(device.x - plan.entry.x, device.y - plan.entry.y);
            return distance < best.distance ? { distance, device } : best;
        }, { distance: Infinity, device: null });
        if (nearest.distance > 1.6) {
            push('warn', 'switch-entry', `Nearest switch is ${nearest.distance.toFixed(2)} m from the entry.`, 'Put the switch within about 1.5 m of the door, on the latch side.');
        } else {
            push('ok', 'switch-entry', `Entry switch ${nearest.distance.toFixed(2)} m from the door.`);
        }
    }

    if (plan.roomType === 'stairs' && switches.length < 2) {
        push('error', 'stair-switch', 'A stairway needs a switch at each floor level.', 'CEC 210.70(A)(2)(3): a stairway with six or more risers needs a listed wall-mounted control at each floor level and landing level with an entryway.');
    } else if (plan.roomType === 'stairs') {
        push('ok', 'stair-switch', 'Switches at both ends of the stair.');
    }

    WALLS.forEach((wall) => {
        const length = wallLength(plan, wall);
        const devices = wallDevices(plan, wall).slice().sort((a, b) => (a.along ?? 0) - (b.along ?? 0));
        if (!devices.length) {
            if (length >= 1.8 && preset.minSockets > 0) {
                push('error', 'socket-spacing', `No socket on the ${wall} wall.`, `CEC 210.52(A)(1): any wall space 2 ft or wider needs a receptacle within 6 ft; this wall is ${length.toFixed(2)} m.`);
            }
            return;
        }
        const first = devices[0].along ?? 0;
        const last = devices[devices.length - 1].along ?? length;
        const gap = Math.max(first, length - last);
        let largest = gap;
        for (let i = 1; i < devices.length; i += 1) {
            largest = Math.max(largest, (devices[i].along ?? 0) - (devices[i - 1].along ?? 0));
        }
        const allowedGap = plan.socketSpacing + 0.05;
        const allowedEnd = allowedGap / 2 + 0.05;
        if (largest > allowedGap + 0.05 || gap > allowedEnd) {
            push('warn', 'socket-spacing', `Socket spacing on the ${wall} wall leaves a ${largest.toFixed(2)} m gap.`, `Aim for no more than ${(plan.socketSpacing / 2 + 0.05).toFixed(2)} m from a corner and ${plan.socketSpacing.toFixed(2)} m between sockets.`);
        }
    });
    if (sockets.length < preset.minSockets) {
        push('warn', 'socket-count', `${sockets.length} sockets; ${preset.label.toLowerCase()} usually needs ${preset.minSockets}.`, 'Add sockets before the drywall goes up; retrofitting is far more expensive.');
    } else if (sockets.length) {
        push('ok', 'socket-count', `${sockets.length} sockets placed.`);
    }

    const tooClose = [];
    for (let i = 0; i < lights.length; i += 1) {
        for (let j = i + 1; j < lights.length; j += 1) {
            const distance = Math.hypot(lights[i].x - lights[j].x, lights[i].y - lights[j].y);
            if (distance < 0.25) tooClose.push([lights[i], lights[j]]);
        }
    }
    if (tooClose.length) {
        push('warn', 'light-overlap', `${tooClose.length} pair(s) of luminaires are closer than 250 mm.`, 'Overlapping pools waste light and create hot spots.');
    }

    if (lights.length) {
        const type = luminaireById(lights[0].typeId);
        const targetSpacing = spacingFor(type, plan.mountingHeight);
        const nearest = lights.reduce((best, light) => {
            const distance = lights
                .filter((other) => other.id !== light.id)
                .reduce((min, other) => Math.min(min, Math.hypot(light.x - other.x, light.y - other.y)), Infinity);
            return Math.min(best, distance);
        }, Infinity);
        if (Number.isFinite(nearest) && nearest > targetSpacing * 1.35) {
            push('warn', 'light-spacing', `Nearest luminaire spacing is ${nearest.toFixed(2)} m; the fitting's ratio allows ${targetSpacing.toFixed(2)} m.`, 'Spread wider than this leaves dark bands between pools of light.');
        }
    }

    (plan.devices || []).forEach((device) => {
        if (device.kind === 'luminaire') return;
        const nearest = nearestWall(plan, device.x, device.y);
        if (nearest.distance > 0.08) {
            push('warn', 'wall-device', `${device.label} is ${nearest.distance.toFixed(2)} m off the wall.`, 'Switches and sockets mount on a wall or in a floor box, not in mid-air.');
        }
    });

    const unassigned = (plan.devices || []).filter((device) => !device.circuitId);
    if (unassigned.length) {
        push('warn', 'circuit-missing', `${unassigned.length} device${unassigned.length === 1 ? '' : 's'} not on a circuit.`, 'Assign every outlet to a branch circuit before pricing cable.');
    }

    if (plan.roomType === 'bathroom') {
        const wet = lights.filter((light) => !luminaireById(light.typeId).damp);
        if (wet.length) {
            push('error', 'wet-luminaire', `${wet.length} bathroom luminaire(s) are not damp rated.`, 'A bathroom is a damp location; use a listed damp or wet fixture.');
        }
    }
    if (plan.roomType === 'outdoor') {
        const wet = lights.filter((light) => !luminaireById(light.typeId).wet);
        if (wet.length) {
            push('error', 'wet-luminaire', `${wet.length} outdoor luminaire(s) are not wet rated.`, 'Use a wet-location fixture, gasketed box and in-use cover outdoors.');
        }
    }
    if (plan.insulation) {
        const notIc = lights.filter((light) => {
            const type = luminaireById(light.typeId);
            return type.mount === 'recessed' && !type.ic;
        });
        if (notIc.length) {
            push('warn', 'ic-rating', `${notIc.length} recessed luminaire(s) are not IC rated.`, 'A non-IC can must keep insulation clear; use an IC-rated, airtight fixture in an insulated ceiling.');
        }
    }
    if (plan.fireRatedCeiling) {
        const notRated = lights.filter((light) => {
            const type = luminaireById(light.typeId);
            return type.mount === 'recessed' && !type.fireRated;
        });
        if (notRated.length) {
            push('warn', 'fire-rating', `${notRated.length} recessed luminaire(s) are not fire rated.`, 'A fire-resistance-rated ceiling needs a listed fire-rated luminaire or a protected ceiling membrane.');
        }
    }
    if (!plan.neutralAtSwitch) {
        const smart = switches.filter((device) => switchById(device.typeId).requiresNeutral);
        if (smart.length) {
            push('warn', 'switch-neutral', `${smart.length} switch(es) need a neutral at the box.`, 'Smart dimmers and sensors usually need a neutral; confirm before the cable is pulled.');
        }
    }

    return checks;
}

/** Hit test for the plan canvas: nearest device within a metre tolerance. */
export function deviceAt(plan, point, tolerance = 0.18) {
    let best = null;
    let bestDistance = tolerance;
    (plan?.devices || []).forEach((device) => {
        const distance = Math.hypot(device.x - point.x, device.y - point.y);
        if (distance <= bestDistance) {
            best = device;
            bestDistance = distance;
        }
    });
    return best;
}

/** Compact plan summary for the editor hand-off and the CSV. */
export function planSummary(plan) {
    const lights = devicesOf(plan, 'luminaire');
    const switches = devicesOf(plan, 'switch');
    const sockets = devicesOf(plan, 'socket');
    const watts = lights.reduce((sum, device) => sum + luminaireById(device.typeId).watts, 0);
    return {
        roomType: plan.roomType,
        width: plan.width,
        depth: plan.depth,
        area: round(plan.width * plan.depth, 2),
        luminaires: lights.length,
        switches: switches.length,
        sockets: sockets.length,
        circuits: plan.circuits.length,
        connectedW: round(watts, 1),
        lit: lights.filter((light) => light.on !== false).length
    };
}
