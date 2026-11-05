/**
 * BIM quantities — IFC-classified takeoff from the plan.
 *
 * The plan already knows geometry: walls have a length, a height and a
 * thickness, fixtures have a footprint, openings have an area. This module
 * gives each element its IFC class and produces the quantities an
 * IfcElementQuantity would carry (length, area, volume), so procurement and the
 * bid can be driven by the drawing instead of by a hand-kept spreadsheet.
 *
 * It is a takeoff, not an IFC file: no GUIDs, no property sets, no STEP
 * serialiser. What ships is the quantity table a QTO export needs, plus CSV.
 */
import { PIXELS_PER_METER, WALL_HEIGHT } from '../../core/world-space.js';
import { itemDimensions } from '../../core/items.js';
import { openingsForWall, isOpening } from '../advanced/openings.js';

/** Plan type → IFC class. Unknown types fall back to IfcBuildingElementProxy. */
export const IFC_CLASS_BY_TYPE = {
    wall: 'IfcWall',
    window: 'IfcWindow',
    door: 'IfcDoor',
    stair: 'IfcStair',
    stair_deck: 'IfcStair',
    stair_outdoor: 'IfcStair',
    railing: 'IfcRailing',
    deck: 'IfcSlab',
    roof: 'IfcRoof',
    column: 'IfcColumn',
    beam: 'IfcBeam',
    kitchen_cabinet: 'IfcFurniture',
    shaker_base_cabinet: 'IfcFurniture',
    shaker_drawer_base: 'IfcFurniture',
    shaker_sink_base: 'IfcFurniture',
    shaker_tall_pantry: 'IfcFurniture',
    island: 'IfcFurniture',
    sink: 'IfcSanitaryTerminal',
    toilet: 'IfcSanitaryTerminal',
    bathtub: 'IfcSanitaryTerminal',
    shower: 'IfcSanitaryTerminal',
    range: 'IfcElectricAppliance',
    stove: 'IfcElectricAppliance',
    fridge: 'IfcElectricAppliance',
    dishwasher: 'IfcElectricAppliance',
    washer: 'IfcElectricAppliance',
    dryer: 'IfcElectricAppliance',
    ceiling_light: 'IfcLightFixture',
    wall_light: 'IfcLightFixture',
    wall_switch: 'IfcSwitchingDevice',
    wall_socket: 'IfcOutlet',
    pool: 'IfcSpace',
    spa: 'IfcSpace',
    spa_pool: 'IfcSpace'
};

const round = (value, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

/** IFC class for a plan element, honouring an explicit type first. */
export function ifcClassFor(type, fallback = 'IfcBuildingElementProxy') {
    return IFC_CLASS_BY_TYPE[type] || fallback;
}

/** Wall quantities in metres. `defaultHeight` covers walls that use the storey height. */
export function wallQuantities(wall, { pixelsPerMeter = PIXELS_PER_METER, defaultHeight = WALL_HEIGHT } = {}) {
    const lengthM = Math.hypot(
        (wall.end?.x ?? 0) - (wall.start?.x ?? 0),
        (wall.end?.y ?? 0) - (wall.start?.y ?? 0)
    ) / pixelsPerMeter;
    const heightM = Number.isFinite(wall.height) ? wall.height : defaultHeight;
    const thicknessM = (Number(wall.thickness) || 10) / pixelsPerMeter;
    const grossAreaM2 = lengthM * heightM;
    return {
        lengthM,
        heightM,
        thicknessM,
        grossAreaM2,
        volumeM3: grossAreaM2 * thicknessM
    };
}

/** Footprint area of a fixture in square metres. */
export function fixtureAreaM2(fixture) {
    const { width, depth } = itemDimensions(fixture);
    return Math.max(0, Number(width) || 0) * Math.max(0, Number(depth) || 0);
}

/**
 * Build the quantity table.
 *
 *   walls     plan walls (canvas pixels, like the editor)
 *   fixtures  plan fixtures
 *   openings  [{ wallId, areaM2, ifcClass?, name? }] — subtracted from the wall
 *             it sits in and reported as its own line
 *   warnings  returned as a list so a caller can surface odd input rather than
 *             silently producing a wrong total
 */
export function bimTakeoff({
    walls = [],
    fixtures = [],
    openings = [],
    pixelsPerMeter = PIXELS_PER_METER,
    defaultHeight = WALL_HEIGHT
} = {}) {
    const warnings = [];
    const openingAreaByWall = new Map();
    for (const opening of openings) {
        const area = Number(opening.areaM2) || 0;
        if (!(area > 0)) continue;
        const wallId = opening.wallId || null;
        if (!wallId) {
            warnings.push(`An opening (${opening.name || 'unnamed'}) is not attached to a wall; its area is not deducted.`);
            continue;
        }
        openingAreaByWall.set(wallId, (openingAreaByWall.get(wallId) || 0) + area);
    }

    const rows = [];
    const totals = {
        walls: 0,
        openings: 0,
        fixtures: 0,
        grossAreaM2: 0,
        netAreaM2: 0,
        openingAreaM2: 0,
        volumeM3: 0,
        fixtureAreaM2: 0
    };

    walls.forEach((wall, index) => {
        const quantities = wallQuantities(wall, { pixelsPerMeter, defaultHeight });
        if (!(quantities.lengthM > 0)) {
            warnings.push(`Wall ${index + 1} has no length and was skipped.`);
            return;
        }
        const openingArea = openingAreaByWall.get(wall.id) || 0;
        if (openingArea > quantities.grossAreaM2 + 1e-9) {
            warnings.push(`Openings on wall ${index + 1} (${round(openingArea, 2)} m²) exceed the wall area (${round(quantities.grossAreaM2, 2)} m²).`);
        }
        const netAreaM2 = Math.max(0, quantities.grossAreaM2 - openingArea);
        rows.push({
            ifcClass: ifcClassFor('wall'),
            name: wall.name || wall.id || `Wall ${index + 1}`,
            count: 1,
            lengthM: round(quantities.lengthM),
            areaM2: round(netAreaM2),
            volumeM3: round(netAreaM2 * quantities.thicknessM)
        });
        totals.walls += 1;
        totals.grossAreaM2 += quantities.grossAreaM2;
        totals.netAreaM2 += netAreaM2;
        totals.openingAreaM2 += openingArea;
        totals.volumeM3 += netAreaM2 * quantities.thicknessM;
    });

    for (const opening of openings) {
        const area = Number(opening.areaM2) || 0;
        if (!(area > 0)) continue;
        rows.push({
            ifcClass: opening.ifcClass || ifcClassFor(String(opening.type || 'window')),
            name: opening.name || opening.id || 'Opening',
            count: 1,
            lengthM: 0,
            areaM2: round(area),
            volumeM3: 0
        });
        totals.openings += 1;
    }

    // Fixtures aggregate by IFC class: 40 cabinets are one procurement line, not
    // 40 rows. A named override still gets its own row.
    const grouped = new Map();
    for (const fixture of fixtures) {
        const ifcClass = fixture.ifcClass || ifcClassFor(String(fixture.type || ''));
        const key = `${ifcClass}|${fixture.name || ''}`;
        const area = fixtureAreaM2(fixture);
        const entry = grouped.get(key) || { ifcClass, name: fixture.name || ifcClass, count: 0, areaM2: 0 };
        entry.count += 1;
        entry.areaM2 += area;
        grouped.set(key, entry);
    }
    for (const entry of grouped.values()) {
        rows.push({
            ifcClass: entry.ifcClass,
            name: entry.name,
            count: entry.count,
            lengthM: 0,
            areaM2: round(entry.areaM2),
            volumeM3: 0
        });
        totals.fixtures += entry.count;
        totals.fixtureAreaM2 += entry.areaM2;
    }

    const byClass = {};
    for (const row of rows) {
        const entry = byClass[row.ifcClass] || { count: 0, areaM2: 0, volumeM3: 0, lengthM: 0 };
        entry.count += row.count;
        entry.areaM2 += row.areaM2;
        entry.volumeM3 += row.volumeM3;
        entry.lengthM += row.lengthM;
        byClass[row.ifcClass] = entry;
    }
    for (const entry of Object.values(byClass)) {
        entry.areaM2 = round(entry.areaM2);
        entry.volumeM3 = round(entry.volumeM3);
        entry.lengthM = round(entry.lengthM);
    }

    return {
        rows,
        totals: {
            ...totals,
            grossAreaM2: round(totals.grossAreaM2),
            netAreaM2: round(totals.netAreaM2),
            openingAreaM2: round(totals.openingAreaM2),
            volumeM3: round(totals.volumeM3),
            fixtureAreaM2: round(totals.fixtureAreaM2)
        },
        byClass,
        warnings
    };
}

const csvCell = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Turn the doors and windows bound to walls into takeoff openings.
 * `openingsForWall` clamps each one to its wall, so a door dragged past the end
 * of the wall is deducted at the width that will actually be cut.
 */
export function openingsFromPlan(walls = [], fixtures = []) {
    const bound = fixtures.filter((fixture) => isOpening(fixture) && fixture.boundToWallId);
    return walls.flatMap((wall) => openingsForWall(wall, bound).map((entry) => ({
        wallId: wall.id,
        type: entry.fixture.type === 'door' ? 'door' : 'window',
        name: entry.fixture.name || entry.fixture.type,
        areaM2: entry.shape === 'circle'
            ? Math.PI * (entry.width / 2) * (entry.height / 2)
            : entry.width * entry.height
    })));
}

/** Quantities for one plan, with its openings derived from the plan itself. */
export function bimTakeoffSnapshot({
    walls = [],
    fixtures = [],
    openings = null,
    storeyHeight = WALL_HEIGHT
} = {}) {
    const resolved = Array.isArray(openings) ? openings : openingsFromPlan(walls, fixtures);
    return { takeoff: bimTakeoff({ walls, fixtures, openings: resolved, defaultHeight: storeyHeight }), openings: resolved };
}

/** CSV in the shape a QTO import expects: one row per IFC class/name pair. */
export function bimTakeoffCsv(rows) {
    const header = ['IfcClass', 'Name', 'Count', 'LengthM', 'AreaM2', 'VolumeM3'];
    const lines = [header.join(',')];
    for (const row of rows) {
        lines.push([
            row.ifcClass,
            row.name,
            row.count,
            row.lengthM,
            row.areaM2,
            row.volumeM3
        ].map(csvCell).join(','));
    }
    return lines.join('\n') + '\n';
}

const topClasses = (takeoff, limit = 3) => Object.entries(takeoff.byClass)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([ifcClass, entry]) => `${ifcClass} ×${entry.count}`)
    .join(', ');

/**
 * Studio panel model for the IFC takeoff, built from the drawing on screen.
 * Returns the shape features/systems.js expects: the panel cannot drift from
 * the takeoff the CSV is written from because both come from one snapshot.
 */
export function bimStudioPanel(context = {}) {
    const { takeoff, openings } = bimTakeoffSnapshot(context);
    const { totals } = takeoff;
    const empty = takeoff.rows.length === 0;

    const rows = empty
        ? []
        : [
            { label: 'Walls', value: `${totals.walls} · ${totals.netAreaM2} m² net` },
            { label: 'Gross wall area', value: `${totals.grossAreaM2} m²` },
            { label: 'Openings', value: `${totals.openings} · ${totals.openingAreaM2} m²` },
            { label: 'Wall volume', value: `${totals.volumeM3} m³` },
            { label: 'Fittings', value: `${totals.fixtures}` },
            { label: 'IFC lines', value: `${takeoff.rows.length}` }
        ];

    const checks = takeoff.warnings.length
        ? takeoff.warnings.map((message) => ({ severity: 'warn', label: 'Takeoff', message }))
        : [{ severity: 'ok', label: 'Takeoff', message: 'Every opening is bound to a wall; quantities follow the drawing.' }];

    return {
        id: 'bim',
        label: 'BIM',
        suite: 'editor.html',
        headline: empty
            ? 'No walls to classify yet'
            : `${totals.walls} wall${totals.walls === 1 ? '' : 's'} · ${totals.netAreaM2} m² · ${totals.volumeM3} m³`,
        rows,
        checks,
        ok: takeoff.warnings.length === 0,
        warnings: takeoff.warnings.length,
        empty,
        detail: empty
            ? 'Draw walls and place doors or windows; the IFC quantities follow the plan.'
            : `${topClasses(takeoff)} · ${openings.length} opening${openings.length === 1 ? '' : 's'} deducted from their wall.`,
        actions: [
            { id: 'bim-refresh', label: 'Rebuild takeoff', kind: 'action' },
            { id: 'bim-csv', label: 'Download IFC CSV', kind: 'action' }
        ]
    };
}
