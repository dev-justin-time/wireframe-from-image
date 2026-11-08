import {
    BOARD_STOCK_FT,
    CONNECTORS,
    FASTENERS,
    FRAMING_DEFAULTS,
    HEADER_SIZES,
    STUD_LIMITS_FT,
    STUD_SIZES,
    boardFeet,
    pieceCost,
    precutById,
    sheathingById,
    speciesById,
    sectionProps,
    studDepthM,
    studThicknessM,
    subfloorById,
    wallHeightM
} from './catalog.js';

/**
 * Wall and floor framing engine.
 *
 * The engine frames real wall runs, not a generic rectangle: every stud is laid
 * out at the configured spacing, every opening gets king studs, jack studs, a
 * sized header, a rough sill and cripples, and every member is returned with
 * its local box extents so the 2D elevation, the 3D editor overlay and the
 * takeoff all draw the same board.
 *
 * Geometry is metric; member sizes, spacing and lengths are imperial. Loads are
 * 40 psf live and 10 psf dead for floors (IRC §R301.5), with NDS reference
 * values for the species and grade. Headers are checked in bending and at
 * L/360 deflection and are never smaller than a conservative prescriptive
 * minimum; a span that runs out of sawn lumber is reported as engineered.
 */

const IN = 0.0254;
const FT = 12 * IN;
const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round(((Number(value) || 0) + Number.EPSILON) * factor) / factor;
};
const ceil = (value) => Math.ceil(Math.max(Number(value) || 0, 0) - 1e-9);
const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
const inch = (metres) => (Number(metres) || 0) / IN;

/** Feet-and-inches label, e.g. 92.5 -> 7'-8 1/2". */
export function ftIn(metres) {
    const totalIn = Math.max(0, Number(metres) || 0) / IN;
    const feet = Math.floor(totalIn / 12);
    let inches = totalIn - feet * 12;
    let whole = Math.floor(inches);
    let eighths = Math.round((inches - whole) * 8);
    if (eighths === 8) {
        whole += 1;
        eighths = 0;
    }
    const fractions = { 1: '1/8', 2: '1/4', 3: '3/8', 4: '1/2', 5: '5/8', 6: '3/4', 7: '7/8' };
    const fraction = eighths ? ` ${fractions[eighths]}` : '';
    const parts = [];
    if (feet) parts.push(`${feet}'`);
    parts.push(`${whole}${fraction}"`);
    return parts.join('-').replace(/-$/, '');
}

function normalizedConfig(raw = {}) {
    return {
        ...FRAMING_DEFAULTS,
        ...raw,
        studSize: STUD_SIZES.includes(raw.studSize) ? raw.studSize : FRAMING_DEFAULTS.studSize,
        studSpacingIn: clamp(Number(raw.studSpacingIn) || FRAMING_DEFAULTS.studSpacingIn, 8, 24),
        studLengthIn: clamp(Number(raw.studLengthIn) || FRAMING_DEFAULTS.studLengthIn, 48, 192),
        topPlates: clamp(Math.round(Number(raw.topPlates) || FRAMING_DEFAULTS.topPlates), 1, 3),
        waste: clamp(raw.waste != null ? Number(raw.waste) : FRAMING_DEFAULTS.waste, 0, 0.35),
        blockingRows: clamp(Math.round(Number(raw.blockingRows ?? FRAMING_DEFAULTS.blockingRows)), 0, 3),
        floorJoistSpacingIn: clamp(Number(raw.floorJoistSpacingIn) || 16, 12, 24),
        floorSpanFt: clamp(Number(raw.floorSpanFt) || 12, 4, 40),
        snowLoadPsf: clamp(Number(raw.snowLoadPsf) || 30, 0, 120),
        anchorSpacingFt: clamp(Number(raw.anchorSpacingFt) || 6, 2, 12),
        labourRate: clamp(Number(raw.labourRate) || 68, 20, 250),
        storeys: Array.isArray(raw.storeys) && raw.storeys.length
            ? raw.storeys.map((storey, index) => normalizeStorey(storey, index, raw))
            : [normalizeStorey({ name: 'Ground floor' }, 0, raw)]
    };
}

function normalizeStorey(storey = {}, index = 0, raw = {}) {
    const fallbackLength = raw.studLengthIn != null ? Number(raw.studLengthIn) : FRAMING_DEFAULTS.studLengthIn;
    const studLengthIn = clamp(
        storey.studLengthIn != null ? Number(storey.studLengthIn) : fallbackLength,
        48,
        192
    );
    return {
        id: storey.id || `storey-${index + 1}`,
        name: storey.name || (index === 0 ? 'Ground floor' : `Floor ${index + 1}`),
        studLengthIn,
        topPlates: clamp(Math.round(Number(storey.topPlates ?? raw.topPlates ?? 2)), 1, 3),
        walls: (storey.walls || []).map((wall, wallIndex) => normalizeWall(wall, wallIndex)),
        floor: index > 0 && storey.floor !== false
    };
}

function normalizeWall(wall = {}, index = 0) {
    const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const x1 = num(wall.x1, 0);
    const z1 = num(wall.z1, 0);
    const x2 = num(wall.x2, x1);
    const z2 = num(wall.z2, z1);
    return {
        id: wall.id || `wall-${index + 1}`,
        name: wall.name || `Wall ${index + 1}`,
        x1,
        z1,
        x2,
        z2,
        exterior: wall.exterior !== false,
        openings: Array.isArray(wall.openings) ? wall.openings.map((opening, openingIndex) => ({
            id: opening.id || `${wall.id || `wall-${index + 1}`}-opening-${openingIndex + 1}`,
            type: ['door', 'window', 'opening'].includes(opening.type) ? opening.type : 'window',
            widthM: Math.max(Number(opening.widthM) || 0.9, 0.15),
            heightM: Math.max(Number(opening.heightM) || 1.2, 0.15),
            sillM: Math.max(Number(opening.sillM) || 0, 0),
            offsetM: Number(opening.offsetM) || 0
        })) : []
    };
}

export function wallLengthM(wall = {}) {
    return Math.hypot((wall.x2 ?? 0) - (wall.x1 ?? 0), (wall.z2 ?? 0) - (wall.z1 ?? 0));
}

/** Unit vector along the wall, in plan space. */
export function wallDirection(wall = {}) {
    const length = wallLengthM(wall);
    if (!length) return { x: 1, z: 0 };
    return {
        x: ((wall.x2 ?? 0) - (wall.x1 ?? 0)) / length,
        z: ((wall.z2 ?? 0) - (wall.z1 ?? 0)) / length
    };
}

/**
 * Clamp the openings to the wall and separate them so each keeps its king and
 * jack studs. Returns entries in wall order with a centre offset in metres.
 */
export function layoutOpenings(openings = [], lengthM, studThickness) {
    const edge = studThickness * 2 + 0.006;
    let entries = (openings || [])
        .filter((opening) => opening && opening.widthM > 0.1)
        .map((opening) => {
            const width = clamp(opening.widthM, 0.15, Math.max(0.2, lengthM - edge * 2));
            const centre = clamp(opening.offsetM, width / 2 + edge, Math.max(width / 2 + edge, lengthM - width / 2 - edge));
            return {
                ...opening,
                width,
                centre,
                start: centre - width / 2,
                end: centre + width / 2,
                clamped: Math.abs(centre - opening.offsetM) > 0.001 || Math.abs(width - opening.widthM) > 0.001
            };
        })
        .sort((a, b) => a.start - b.start);

    // Two openings need a stud pack between them; push the later one right.
    for (let i = 1; i < entries.length; i += 1) {
        const minimum = entries[i - 1].end + studThickness * 2;
        if (entries[i].start < minimum) {
            entries[i].start = minimum;
            entries[i].end = minimum + entries[i].width;
            entries[i].centre = (entries[i].start + entries[i].end) / 2;
            entries[i].clamped = true;
        }
    }

    const last = entries[entries.length - 1];
    const overflow = last ? last.end + edge - lengthM : 0;
    if (overflow > 0) {
        entries.forEach((entry) => {
            entry.start -= overflow;
            entry.end -= overflow;
            entry.centre -= overflow;
            entry.clamped = true;
        });
    }

    entries = entries.filter((entry) => entry.start >= 0 && entry.end <= lengthM + 1e-6);
    entries.forEach((entry) => {
        entry.sillM = entry.type === 'door' ? 0 : clamp(entry.sillM, 0, 4);
    });
    return entries;
}

/**
 * Header demand for one opening. The tributary width is the floor span the
 * header actually carries, not the opening width: a header in a bearing wall
 * picks up half the floor on each side, so the default tributary is 12 ft.
 */
export function headerDemand(spanM, options = {}) {
    const species = speciesById(options.species);
    const floorsAbove = Math.max(0, Math.round(Number(options.floorsAbove) || 0));
    const tributaryFt = clamp(Number(options.tributaryFt) || 12, 1, 40);
    const roof = Boolean(options.roof);
    const livePsf = floorsAbove * 40 + (roof ? Number(options.snowLoadPsf ?? 30) : 0);
    const deadPsf = floorsAbove * 10 + (roof ? 10 : 0) + 10;
    const wLive = livePsf * tributaryFt; // lb per linear foot
    const wTotal = (livePsf + deadPsf) * tributaryFt;
    const spanIn = Math.max(1, inch(spanM));
    const momentLbIn = (wTotal * Math.pow(spanIn / 12, 2) / 8) * 12;
    const cd = 1.15;
    return {
        species,
        floorsAbove,
        tributaryFt,
        livePsf,
        deadPsf,
        wLive,
        wTotal,
        spanIn,
        momentLbIn,
        Fb: species.Fb * cd,
        E: species.E,
        deflectionLimitIn: spanIn / 360
    };
}

/** Utilisation of one header candidate: bending and live deflection. */
export function headerUtilisation(size, plies, demand) {
    const props = sectionProps(size);
    if (!props) return { ok: false, utilisation: Infinity, governing: 'size' };
    const momentAllow = demand.Fb * props.S * plies;
    const inertia = props.I * plies;
    const wIn = demand.wLive / 12;
    const deflection = (5 * wIn * Math.pow(demand.spanIn, 4)) / (384 * demand.E * inertia);
    const bending = demand.momentLbIn / Math.max(momentAllow, 1);
    const deflect = deflection / Math.max(demand.deflectionLimitIn, 1e-6);
    return {
        size,
        plies,
        utilisation: Math.max(bending, deflect),
        bending,
        deflection,
        governing: bending >= deflect ? 'bending' : 'deflection',
        ok: bending <= 1.0001 && deflect <= 1.0001
    };
}

const PRESCRIPTIVE_HEADER = [
    { maxSpanM: 3 * FT, size: '2x6' },
    { maxSpanM: 4 * FT, size: '2x8' },
    { maxSpanM: 6 * FT, size: '2x10' },
    { maxSpanM: 8 * FT, size: '2x12' }
];

/** Conservative prescriptive minimum, before the calculated check. */
export function prescriptiveHeader(spanM) {
    const entry = PRESCRIPTIVE_HEADER.find((item) => spanM <= item.maxSpanM + 1e-6);
    return entry ? entry.size : null;
}

/**
 * Size a header for one opening. Returns the chosen size/plies, the utilisation
 * and whether the span needs an engineered member.
 */
export function sizeHeader(spanM, options = {}) {
    const demand = headerDemand(spanM, options);
    const plies = Math.max(2, Math.floor(studDepthM(options.studSize || '2x4') / (1.5 * IN) + 1e-6));
    const minimum = prescriptiveHeader(spanM);
    const minimumIndex = minimum ? HEADER_SIZES.indexOf(minimum) : HEADER_SIZES.length;
    const candidates = [];

    HEADER_SIZES.forEach((size, index) => {
        if (index < minimumIndex) return;
        const result = headerUtilisation(size, plies, demand);
        candidates.push({ ...result, prescriptive: index === minimumIndex });
    });

    const passing = candidates.filter((candidate) => candidate.ok);
    const chosen = passing[0] || candidates.sort((a, b) => a.utilisation - b.utilisation)[0] || null;
    const engineered = !chosen || !chosen.ok;
    return {
        size: engineered ? 'LVL' : chosen.size,
        plies,
        spanM,
        demand,
        utilisation: chosen ? round(chosen.utilisation, 3) : 1,
        bending: chosen ? round(chosen.bending, 3) : 1,
        deflection: chosen ? round(chosen.deflection, 3) : 1,
        governing: chosen ? chosen.governing : 'span',
        prescriptive: minimum || 'engineered',
        engineered,
        note: engineered
            ? `${ftIn(spanM)} exceeds the sawn-lumber header range; specify an engineered LVL or a designed beam.`
            : `${plies} ply ${chosen.size} header, ${Math.round(chosen.utilisation * 100)}% of capacity (${chosen.governing}).`
    };
}

/**
 * Frame one wall run.
 *
 * `wall` carries metre endpoints and openings; `options` carries the member
 * sizes and the storey context. Every returned member is a local box:
 * x runs along the wall from its start, y up from the floor, z across the wall
 * thickness. `cutLengthM` is the length to cut, which is what the cut list and
 * the price use.
 */
export function frameWall(wall = {}, options = {}) {
    const lengthM = wallLengthM(wall);
    const studSize = STUD_SIZES.includes(options.studSize) ? options.studSize : '2x4';
    const thicknessM = studThicknessM(studSize);
    const depthM = studDepthM(studSize);
    const spacingM = clamp(Number(options.studSpacingIn) || 16, 8, 24) * IN;
    const topPlates = clamp(Math.round(Number(options.topPlates) || 2), 1, 3);
    const bottomTreated = options.bottomTreated !== false;
    const plateM = 1.5 * IN;
    const heightM = Number(options.heightM) > 0
        ? Number(options.heightM)
        : wallHeightM(Number(options.studLengthIn) || 92.5, topPlates);
    const studLengthM = Math.max(0.3, heightM - plateM * (1 + topPlates));
    const plateBottomY = plateM + studLengthM;
    const topY = plateBottomY + plateM * topPlates;

    const members = [];
    const openings = layoutOpenings(wall.openings || [], lengthM, thicknessM).map((opening) => {
        const openingTop = Math.min(opening.sillM + opening.heightM, plateBottomY - 0.05);
        const header = sizeHeader(opening.width, {
            species: options.species,
            floorsAbove: options.floorsAbove,
            tributaryFt: options.tributaryFt,
            roof: options.roof,
            snowLoadPsf: options.snowLoadPsf,
            studSize
        });
        return { ...opening, openingTop, header };
    });

    const addMember = (kind, size, x0, x1, y0, y1, extra = {}) => {
        const member = {
            kind,
            size,
            x0: round(x0, 4),
            x1: round(x1, 4),
            y0: round(y0, 4),
            y1: round(y1, 4),
            z0: 0,
            z1: round(depthM, 4),
            cutLengthM: round(Math.abs(
                ['stud', 'king', 'jack', 'cripple'].includes(kind) ? y1 - y0 : x1 - x0
            ), 4),
            ...extra
        };
        members.push(member);
        return member;
    };

    // --- Sole plate, cut at doors --------------------------------------
    const doorSpans = openings.filter((opening) => opening.type === 'door' && opening.sillM <= 0.001);
    let bottomCursor = 0;
    [...doorSpans].sort((a, b) => a.start - b.start).forEach((opening) => {
        if (opening.start > bottomCursor + 1e-4) {
            addMember('plate-bottom', studSize, bottomCursor, opening.start, 0, plateM, { treated: bottomTreated });
        }
        bottomCursor = Math.max(bottomCursor, opening.end);
    });
    if (lengthM > bottomCursor + 1e-4) {
        addMember('plate-bottom', studSize, bottomCursor, lengthM, 0, plateM, { treated: bottomTreated });
    }

    // --- Top plates ----------------------------------------------------
    for (let layer = 0; layer < topPlates; layer += 1) {
        addMember('plate-top', studSize, 0, lengthM, plateBottomY + layer * plateM, plateBottomY + (layer + 1) * plateM, {
            layer: layer + 1,
            treated: false
        });
    }

    // --- Common studs ---------------------------------------------------
    const reserved = openings.map((opening) => ({ start: opening.start - thicknessM * 2, end: opening.end + thicknessM * 2 }));
    const studentPositions = [];
    const startCentre = thicknessM / 2;
    if (lengthM > thicknessM) {
        for (let centre = startCentre; centre < lengthM - thicknessM / 2 - 1e-6; centre += spacingM) {
            studentPositions.push(centre);
        }
        const endCentre = lengthM - thicknessM / 2;
        if (endCentre - studentPositions[studentPositions.length - 1] > thicknessM * 0.5) {
            studentPositions.push(endCentre);
        }
    }
    const commonStuds = studentPositions.filter((centre) => !reserved.some((span) => (
        centre > span.start - thicknessM / 2 && centre < span.end + thicknessM / 2
    )));
    commonStuds.forEach((centre) => {
        addMember('stud', studSize, centre - thicknessM / 2, centre + thicknessM / 2, plateM, plateBottomY);
    });

    // --- Openings: kings, jacks, headers, sills, cripples --------------
    openings.forEach((opening) => {
        addMember('king', studSize, opening.start - thicknessM * 2, opening.start - thicknessM, plateM, plateBottomY);
        addMember('king', studSize, opening.end + thicknessM, opening.end + thicknessM * 2, plateM, plateBottomY);

        const jackBase = opening.type === 'door' ? 0 : plateM;
        addMember('jack', studSize, opening.start, opening.start + thicknessM, jackBase, opening.openingTop);
        addMember('jack', studSize, opening.end - thicknessM, opening.end, jackBase, opening.openingTop);

        const headerSize = opening.header.engineered ? '2x10' : opening.header.size;
        const headerProps = sectionProps(headerSize) || sectionProps('2x10');
        const headerDepth = headerProps.d * IN;
        const headerTop = Math.min(plateBottomY, opening.openingTop + headerDepth);
        const availableHeader = headerTop - opening.openingTop;
        const member = addMember(
            'header',
            opening.header.engineered ? `${opening.header.plies} ply LVL` : `${opening.header.plies} ply ${headerSize}`,
            opening.start,
            opening.end,
            opening.openingTop,
            headerTop,
            {
                plies: opening.header.plies,
                engineered: opening.header.engineered,
                spanM: round(opening.width, 3)
            }
        );
        member.cutLengthM = round(opening.width + thicknessM * 2, 4);

        if (opening.type !== 'door' && opening.sillM > plateM + 0.02) {
            addMember('sill', studSize, opening.start, opening.end, opening.sillM - plateM, opening.sillM);
            // Cripples under the rough sill.
            const below = opening.sillM - plateM;
            if (below > 0.08) {
                const centres = crippleCentres(opening, thicknessM, spacingM);
                centres.forEach((centre) => {
                    if (centre > opening.start + thicknessM + 0.02 && centre < opening.end - thicknessM - 0.02) {
                        addMember('cripple', studSize, centre - thicknessM / 2, centre + thicknessM / 2, plateM, plateM + below);
                    }
                });
            }
        }

        // Cripples above the header, filling to the top plate.
        const gap = plateBottomY - (opening.openingTop + availableHeader);
        if (gap > 0.08) {
            crippleCentres(opening, thicknessM, spacingM).forEach((centre) => {
                if (centre > opening.start + thicknessM + 0.02 && centre < opening.end - thicknessM - 0.02) {
                    addMember('cripple', studSize, centre - thicknessM / 2, centre + thicknessM / 2, opening.openingTop + availableHeader, plateBottomY);
                }
            });
        }

        opening.header = {
            ...opening.header,
            installedDepthM: round(availableHeader, 4),
            topY: round(opening.openingTop + availableHeader, 4),
            fits: availableHeader >= headerDepth - 1e-3
        };
    });

    // --- Blocking -------------------------------------------------------
    const rows = clamp(Math.round(Number(options.blockingRows ?? 1)), 0, 3);
    if (rows > 0) {
        const rowHeights = rows === 1 ? [heightM * 0.5] : rows === 2 ? [heightM / 3, (heightM * 2) / 3] : [heightM * 0.25, heightM * 0.5, heightM * 0.75];
        const blockSides = [...commonStuds].sort((a, b) => a - b);
        rowHeights.forEach((y) => {
            for (let i = 1; i < blockSides.length; i += 1) {
                const left = blockSides[i - 1] + thicknessM / 2;
                const right = blockSides[i] - thicknessM / 2;
                const width = right - left;
                if (width < 0.15) continue;
                const centre = (left + right) / 2;
                if (reserved.some((span) => centre > span.start && centre < span.end)) continue;
                addMember('block', studSize, left, right, y - studDepthM(studSize) / 2, y + studDepthM(studSize) / 2, {
                    note: 'mid-height blocking'
                });
            }
        });
    }

    // --- Fire blocking at the top plate for balloon framing ------------
    if (options.balloon && options.fireBlocking !== false) {
        for (let i = 1; i < commonStuds.length; i += 1) {
            const left = commonStuds[i - 1] + thicknessM / 2;
            const right = commonStuds[i] - thicknessM / 2;
            if (right - left < 0.15) continue;
            addMember('block', studSize, left, right, plateBottomY - plateM, plateBottomY, { note: 'fire blocking at floor line' });
        }
    }

    // --- Sheathing ------------------------------------------------------
    const sheathed = Boolean(wall.exterior ? options.exteriorSheathing : options.interiorSheathing);
    const openingArea = openings.reduce((sum, opening) => sum + opening.width * opening.heightM, 0);
    const grossArea = lengthM * heightM;
    const netArea = Math.max(grossArea - openingArea, 0);
    const product = sheathingById(options.sheathing);
    const sheets = sheathed ? ceil((netArea * (1 + (Number(options.waste) || 0))) / product.sheetM2) : 0;

    const counts = {
        studs: commonStuds.length,
        kings: openings.length * 2,
        jacks: openings.length * 2,
        cripples: members.filter((member) => member.kind === 'cripple').length,
        headers: openings.length,
        blocks: members.filter((member) => member.kind === 'block').length,
        openings: openings.length
    };

    return {
        id: wall.id,
        name: wall.name,
        exterior: Boolean(wall.exterior),
        start: { x: wall.x1, z: wall.z1 },
        end: { x: wall.x2, z: wall.z2 },
        lengthM: round(lengthM, 4),
        heightM: round(heightM, 4),
        studLengthM: round(studLengthM, 4),
        studSize,
        spacingM: round(spacingM, 4),
        depthM: round(depthM, 4),
        thicknessM: round(thicknessM, 4),
        plateM,
        topPlates,
        members,
        openings: openings.map((opening) => ({
            id: opening.id,
            type: opening.type,
            centreM: round(opening.centre, 4),
            startM: round(opening.start, 4),
            endM: round(opening.end, 4),
            widthM: round(opening.width, 4),
            heightM: round(opening.heightM, 4),
            sillM: round(opening.sillM, 4),
            topM: round(opening.openingTop, 4),
            clamped: Boolean(opening.clamped),
            header: opening.header
        })),
        sheathed,
        sheathing: {
            product: product.id,
            areaM2: round(netArea, 3),
            sheets,
            nails: sheets * product.nailsPerSheet
        },
        counts
    };
}

/** Cripple centres across an opening, on the stud rhythm. */
function crippleCentres(opening, thicknessM, spacingM) {
    const centres = [];
    const usableStart = opening.start + thicknessM;
    const usableEnd = opening.end - thicknessM;
    const span = usableEnd - usableStart;
    if (span <= 0) return centres;
    const bays = Math.max(1, Math.round(span / spacingM));
    for (let i = 1; i < bays; i += 1) centres.push(usableStart + (span * i) / bays);
    return centres;
}

/**
 * Floor platform between storeys: joists across the short direction, a double
 * rim, glued and screwed subfloor, and hangers where a joist lands on a header.
 */
export function frameFloor(walls = [], options = {}) {
    if (!walls.length) return null;
    const xs = walls.flatMap((wall) => [wall.x1, wall.x2]);
    const zs = walls.flatMap((wall) => [wall.z1, wall.z2]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const widthM = Math.max(maxX - minX, 0.5);
    const depthM = Math.max(maxZ - minZ, 0.5);
    const fullSpanM = Math.min(widthM, depthM);
    const lengthM = Math.max(widthM, depthM);
    const spacingM = clamp(Number(options.floorJoistSpacingIn) || 16, 12, 24) * IN;
    const species = speciesById(options.species);
    const subfloor = subfloorById(options.subfloor);
    const areaM2 = widthM * depthM;
    const sheets = ceil((areaM2 * (1 + (Number(options.waste) || 0))) / subfloor.sheetM2);
    const perimeterM = 2 * (widthM + depthM);

    // A single sawn joist has a finite span. Past it the floor gets a mid-span
    // girder, and the joists run from the wall to the girder at half the span.
    const maxSawnM = joistCapacityM('2x12', spacingM, species, options);
    const girdered = fullSpanM > maxSawnM + 1e-6;
    const spanM = girdered ? fullSpanM / 2 : fullSpanM;
    const joistCount = ceil(lengthM / spacingM) + 1;
    const size = options.floorJoistSize && options.floorJoistSize !== 'auto'
        ? options.floorJoistSize
        : chooseJoist(spanM, spacingM, species, options);
    const capacityM = joistCapacityM(size, spacingM, species, options);
    let girder = null;
    if (girdered) {
        const posts = Math.max(2, ceil(lengthM / (10 * FT)) + 1);
        const girderSpanM = lengthM / Math.max(posts - 1, 1);
        const girderSize = options.girderSize || '2x12';
        const plies = options.girderPlies || 3;
        const girderCapacity = beamCapacityM(girderSize, plies, fullSpanM / 2, spacingM, species, options);
        girder = {
            size: girderSize,
            plies,
            posts,
            spanM: round(girderSpanM, 3),
            lengthM: round(lengthM, 3),
            capacityM: round(girderCapacity, 3),
            ok: girderSpanM <= girderCapacity + 1e-6,
            note: `${plies} ply ${girderSize} girder over ${posts} posts at ${round(girderSpanM, 2)} m, with joists hung from it.`
        };
    }

    return {
        widthM: round(widthM, 3),
        depthM: round(depthM, 3),
        areaM2: round(areaM2, 2),
        spanM: round(spanM, 3),
        fullSpanM: round(fullSpanM, 3),
        lengthM: round(lengthM, 3),
        joistSize: size,
        joistCount,
        joistLengthM: round(spanM + 0.1, 3),
        spacingIn: round(spacingM / IN, 2),
        capacityM: round(capacityM, 3),
        utilisation: round(spanM / Math.max(capacityM, 1e-6), 3),
        rimCount: 2,
        rimLengthM: round(perimeterM, 3),
        girder,
        subfloor: subfloor.id,
        sheets,
        areaSheathed: round(areaM2, 2),
        hangers: girder ? joistCount : 0,
        blocking: ceil(lengthM / 2.4384) * 2,
        ok: spanM <= capacityM + 1e-6 && (!girder || girder.ok),
        note: `${joistCount} × ${size} at ${round(spacingM / IN, 0)} in on center over ${round(spanM, 2)} m${girder ? `, on a ${girder.note.replace(/\.$/, '')}` : ''}; subfloor ${subfloor.label}.`
    };
}

/** Maximum span of a multi-ply built-up beam carrying a floor tributary. */
export function beamCapacityM(size, plies, tributaryM, spacingM, species, options = {}) {
    const props = sectionProps(size);
    if (!props) return 0;
    const livePsf = Number(options.floorLivePsf) || 40;
    const deadPsf = Number(options.floorDeadPsf) || 10;
    const tribFt = tributaryM / FT;
    const wLiveFt = livePsf * tribFt;
    const wTotalFt = (livePsf + deadPsf) * tribFt;
    const totalS = props.S * plies;
    const totalI = props.I * plies;
    const spanBendIn = Math.sqrt((8 * species.Fb * totalS) / (wTotalFt / 12));
    const spanDefIn = Math.cbrt((384 * species.E * totalI) / (5 * 360 * (wLiveFt / 12)));
    void spacingM;
    return Math.min(spanBendIn, spanDefIn) * IN;
}

/** Smallest joist that passes bending and L/360 at 40/10 psf. */
function chooseJoist(spanM, spacingM, species, options) {
    const sizes = ['2x8', '2x10', '2x12'];
    return sizes.find((size) => joistCapacityM(size, spacingM, species, options) >= spanM) || '2x12';
}

/** Maximum simple span for a floor joist, in metres. */
export function joistCapacityM(size, spacingM, species, options = {}) {
    const props = sectionProps(size);
    if (!props) return 0;
    const livePsf = Number(options.floorLivePsf) || 40;
    const deadPsf = Number(options.floorDeadPsf) || 10;
    const spacingFt = spacingM / FT;
    const wLiveFt = livePsf * spacingFt;
    const wTotalFt = (livePsf + deadPsf) * spacingFt;
    const Fb = species.Fb * 1.0;
    // Bending: M = wL²/8 (lb-in), L in inches.
    const spanBendIn = Math.sqrt((8 * Fb * props.S) / (wTotalFt / 12));
    // Deflection: 5wL⁴/(384EI) <= L/360 -> L³ <= 384EI/(5*360*w_live_per_in)
    const spanDefIn = Math.cbrt((384 * species.E * props.I) / (5 * 360 * (wLiveFt / 12)));
    const spanShearIn = (2 * species.Fv * props.area * 1.5) / wTotalFt * 12;
    return Math.min(spanBendIn, spanDefIn, spanShearIn) * IN;
}

/** Frame every storey of a building description. */
export function computeFramingDesign(rawConfig = {}) {
    const config = normalizedConfig(rawConfig);
    const species = speciesById(config.species);
    const storeys = [];
    let elevationM = 0;

    config.storeys.forEach((storey, index) => {
        const heightM = wallHeightM(storey.studLengthIn, storey.topPlates);
        const floorsAbove = config.storeys.length - index - 1;
        const wallFrames = storey.walls.map((wall) => frameWall(wall, {
            species: config.species,
            studSize: config.studSize,
            studSpacingIn: config.studSpacingIn,
            topPlates: storey.topPlates,
            studLengthIn: storey.studLengthIn,
            heightM,
            bottomTreated: config.bottomTreated,
            blockingRows: config.blockingRows,
            balloon: config.balloon,
            fireBlocking: config.fireBlocking,
            exteriorSheathing: config.exteriorSheathing,
            interiorSheathing: config.interiorSheathing,
            sheathing: config.sheathing,
            waste: config.waste,
            floorsAbove,
            tributaryFt: config.floorSpanFt,
            roof: index === config.storeys.length - 1,
            snowLoadPsf: config.snowLoadPsf
        }));
        const exteriorFrames = wallFrames.filter((wall) => wall.exterior);
        const interiorFrames = wallFrames.filter((wall) => !wall.exterior);
        const floor = storey.floor || (index > 0 && storey.floor !== false)
            ? frameFloor(storey.walls, {
                species: config.species,
                floorJoistSize: config.floorJoistSize,
                floorJoistSpacingIn: config.floorJoistSpacingIn,
                subfloor: config.subfloor,
                waste: config.waste
            })
            : null;
        storeys.push({
            index,
            id: storey.id,
            name: storey.name,
            elevationM: round(elevationM, 4),
            heightM: round(heightM, 4),
            studLengthIn: storey.studLengthIn,
            topPlates: storey.topPlates,
            walls: wallFrames,
            interiorWalls: interiorFrames,
            exteriorWalls: exteriorFrames,
            floor,
            areaM2: floor ? floor.areaM2 : 0,
            linearM: round(wallFrames.reduce((sum, wall) => sum + wall.lengthM, 0), 2),
            studs: wallFrames.reduce((sum, wall) => sum + wall.counts.studs + wall.counts.kings + wall.counts.jacks + wall.counts.cripples, 0),
            sheets: wallFrames.reduce((sum, wall) => sum + wall.sheathing.sheets, 0)
        });
        elevationM += heightM;
        if (floor) elevationM += 0.2032;
    });

    const walls = storeys.flatMap((storey) => storey.walls);
    const checks = buildChecks(config, storeys, species);
    const bom = buildBom(config, storeys, checks);
    const cutRows = buildCutList(storeys);
    const totalWallLengthM = round(walls.reduce((sum, wall) => sum + wall.lengthM, 0), 2);
    const totalSheets = storeys.reduce((sum, storey) => sum + storey.sheets + (storey.floor?.sheets || 0), 0);
    const totalStuds = storeys.reduce((sum, storey) => sum + storey.studs, 0);
    const floorAreaM2 = round(storeys.reduce((sum, storey) => sum + (storey.floor?.areaM2 || 0), 0), 1);

    const errors = checks.filter((check) => check.severity === 'error').length;
    const warnings = checks.filter((check) => check.severity === 'warn').length;

    return {
        config,
        species,
        storeys,
        walls,
        checks,
        errors,
        warnings,
        ok: errors === 0,
        bom,
        cutRows,
        metrics: {
            storeys: storeys.length,
            walls: walls.length,
            linearM: totalWallLengthM,
            studs: totalStuds,
            sheets: totalSheets,
            floorAreaM2,
            boardFeet: bom.boardFeet,
            material: bom.material,
            labour: bom.labour,
            total: bom.total
        },
        summary: [
            `${storeys.length} storey${storeys.length === 1 ? '' : 's'} · ${walls.length} framed walls · ${round(totalWallLengthM, 1)} m of wall`,
            `${config.studSize} studs at ${config.studSpacingIn} in on center · ${round(config.studLengthIn, 2)} in precut · ${config.topPlates === 2 ? 'double' : 'single'} top plate`,
            `${totalStuds} studs, kings, jacks and cripples · ${totalSheets} sheets of sheathing and subfloor`,
            `${floorAreaM2} m² of floor platform · ${bom.boardFeet} board feet`,
            `$${bom.material.toFixed(0)} material + $${bom.labour.toFixed(0)} labour = $${bom.total.toFixed(0)}`,
            `${errors} error${errors === 1 ? '' : 's'} · ${warnings} warning${warnings === 1 ? '' : 's'}`
        ],
        elevationM: round(elevationM, 3),
        precut: precutById(String(config.studLengthIn))
    };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function buildChecks(config, storeys, species) {
    const checks = [];
    const push = (severity, id, label, message, rule = '') => checks.push({ severity, id, label, message, rule });
    const heightFt = Math.max(...storeys.map((storey) => storey.heightM || 0), 2.4) / FT;
    const spacing = config.studSpacingIn;
    const limitTable = STUD_LIMITS_FT[config.studSize]?.[[12, 16, 24].includes(spacing) ? spacing : 16];
    const limit = storeys.length > 1 ? (limitTable?.floor ?? 9) : (limitTable?.roof ?? 10);
    const allHeaders = storeys.flatMap((storey) => storey.walls.flatMap((wall) => wall.openings.map((opening) => ({ opening, wall, storey }))));
    const worstHeader = allHeaders.reduce((worst, entry) => (
        !worst || entry.opening.header.utilisation > worst.opening.header.utilisation ? entry : worst
    ), null);
    const totalLinear = storeys.reduce((sum, storey) => sum + storey.linearM, 0);
    const exteriorLinear = storeys.reduce((sum, storey) => (
        sum + storey.exteriorWalls.reduce((length, wall) => length + wall.lengthM, 0)
    ), 0);
    const floors = storeys.filter((storey) => storey.floor);
    const worstJoist = floors.reduce((worst, storey) => (
        !worst || storey.floor.utilisation > worst.floor.utilisation ? storey : worst
    ), null);

    if (heightFt > limit + 1e-6) {
        push('error', 'stud-height', 'Stud height', `${round(heightFt, 2)} ft wall exceeds the ${limit} ft limit for ${config.studSize} at ${spacing} in on center.`, 'IRC Table R602.3(5)');
    } else if (heightFt > 10) {
        push('warn', 'stud-height', 'Tall wall', `${round(heightFt, 2)} ft wall is over 10 ft; confirm the bracing and engineering for a tall wall.`, 'IRC §R602.3.1');
    } else {
        push('ok', 'stud-height', 'Stud height', `${round(heightFt, 2)} ft wall is inside the ${limit} ft limit for ${config.studSize} at ${spacing} in.`, 'IRC Table R602.3(5)');
    }

    if (spacing > 24) {
        push('error', 'stud-spacing', 'Stud spacing', `${spacing} in spacing exceeds 24 in.`, 'IRC Table R602.3(5)');
    } else {
        push('ok', 'stud-spacing', 'Stud spacing', `${spacing} in on center with ${config.studSize} studs.`, 'IRC §R602.3.1');
    }

    push('ok', 'stud-grade', 'Stud grade', `${species.label} is a No. 2 or better framing grade for the modelled walls.`, 'IRC §R602.3.1');
    push('ok', 'stud-plumb', 'Plumb and crown', 'Crown every stud the same way and plumb each panel before sheathing.', 'IRC §R602.3');
    push('ok', 'stud-bearing', 'Bearing path', 'Bearing walls are checked against the walls below for line and stack.', 'IRC §R602.4');

    // Bearing alignment between storeys: an upper wall needs a wall under it.
    let unsupported = 0;
    storeys.forEach((storey, index) => {
        if (index === 0) return;
        const below = storeys[index - 1].walls;
        storey.walls.forEach((wall) => {
            const mid = {
                x: (wall.start.x + wall.end.x) / 2,
                z: (wall.start.z + wall.end.z) / 2
            };
            const near = below.some((other) => {
                const distance = pointToSegment(mid, other.start, other.end).distance;
                return distance < 1.2;
            });
            if (!near) unsupported += 1;
        });
    });
    if (unsupported > 0) {
        push('warn', 'stud-bearing', 'Bearing path', `${unsupported} upper wall${unsupported === 1 ? '' : 's'} sit more than 1.2 m off any wall below; add a beam or line the walls up.`, 'IRC §R602.4');
    }

    if (!config.bottomTreated) {
        push('error', 'bottom-plate', 'Bottom plate', 'The bottom plate is not treated; IRC §R317.1 requires decay-resistant wood in contact with concrete or masonry.', 'IRC §R317.1');
    } else {
        push('ok', 'bottom-plate', 'Bottom plate', 'Treated sole plate over the slab or sill, with a sill seal.', 'IRC §R317.1');
    }
    push('ok', 'treated-contact', 'Treated handling', 'Treated plate specified; field-treat cuts and keep untreated wood 8 in above grade.', 'IRC §R317.1.1');
    push('ok', 'fasteners', 'Fasteners', 'Hot-dip galvanised or stainless fasteners are required with the treated bottom plate.', 'IRC §R317.3');

    if (storeys.some((storey) => storey.topPlates >= 2)) {
        push('ok', 'top-plate', 'Top plates', 'Double top plate modelled at every storey, with joints to be offset at least 24 in.', 'IRC §R602.3.2');
        push('info', 'plate-splice', 'Plate splices', 'Offset upper and lower top-plate joints by at least 24 in; lap every corner and T-intersection.', 'IRC §R602.3.2');
    } else {
        push('warn', 'top-plate', 'Top plates', 'A single top plate is only allowed where the joists or trusses bear directly over the studs.', 'IRC §R602.3.3');
    }
    push('info', 'nail-schedule', 'Nailing', 'Two 16d per stud end, four 16d per header end, 8d at 6/12 in for sheathing; toe-nailing is not a substitute.', 'Table R602.3(1)');

    const clamped = allHeaders.filter((entry) => entry.opening.clamped).length;
    if (clamped) {
        push('warn', 'rough-opening', 'Rough openings', `${clamped} opening${clamped === 1 ? '' : 's'} had to be moved or narrowed to keep a stud pack on the wall.`, 'IRC §R602.6');
    } else {
        push('ok', 'rough-opening', 'Rough openings', `${allHeaders.length} opening${allHeaders.length === 1 ? '' : 's'} framed with full-height kings and trimmer studs.`, 'IRC §R602.6');
    }
    push('ok', 'king-jack', 'King and jack studs', 'Every opening has two king studs and two jack studs carrying the header.', 'IRC §R602.7');
    push('ok', 'cripple-spacing', 'Cripples', 'Cripples above the header and below the sill stay on the 16 in stud rhythm.', 'IRC §R602.6.1');
    push('info', 'sill-framing', 'Rough sills', 'Windows get a rough sill between the jacks and cripples below it; flash the sill with a sloped pan.', 'IRC §R703.4');
    push('info', 'sill-height', 'Sill height', 'Keep the exterior sill at least 8 in above grade and slope the sill out.', 'IRC §R317.1.1');

    if (worstHeader) {
        const header = worstHeader.opening.header;
        const width = worstHeader.opening.widthM;
        if (header.engineered) {
            push('error', 'header-span', 'Header span', `${ftIn(width)} opening needs an engineered header; the sawn-lumber range is exceeded.`, 'IRC Table R602.7');
        } else if (!header.fits) {
            push('error', 'header-span', 'Header span', `${ftIn(width)} opening has only ${Math.round(header.installedDepthM / IN)} in above it for a ${header.size} header.`, 'IRC §R602.7');
        } else if (header.utilisation > 0.85) {
            push('warn', 'header-span', 'Header span', `${ftIn(width)} opening: ${header.note}`, 'IRC Table R602.7');
        } else {
            push('ok', 'header-span', 'Header span', `${ftIn(width)} opening: ${header.note}`, 'IRC Table R602.7');
        }
        push('ok', 'header-bearing', 'Header bearing', 'Headers bear at least 1½ in on each jack stud.', 'IRC §R602.7');
    } else {
        push('info', 'header-span', 'Header span', 'No openings in the plan yet.', 'IRC Table R602.7');
    }

    if (config.exteriorSheathing) {
        push('ok', 'sheathing', 'Sheathing', `${sheathingById(config.sheathing).label} on the exterior walls, with the long edge across the studs.`, 'IRC §R703.1');
        push('ok', 'sheathing-fastening', 'Sheathing nails', '8d common at 6 in on supported edges and 12 in in the field.', 'Table R602.3(1)');
    } else {
        push('error', 'sheathing', 'Sheathing', 'Exterior walls are not sheathed; a braced wall method and a weather barrier are both required.', 'IRC §R703.2');
    }
    if (config.houseWrap) {
        push('ok', 'weather-barrier', 'Weather barrier', 'House wrap over the sheathing, lapped shingle-fashion and flashed at every opening.', 'IRC §R703.2');
    } else {
        push('warn', 'weather-barrier', 'Weather barrier', 'No water-resistive barrier over the sheathing.', 'IRC §R703.2');
    }

    const bounds = storeys[0]?.walls.length ? boundsOf(storeys[0].walls) : null;
    const longest = bounds ? Math.max(bounds.widthM, bounds.depthM) : 0;
    if (longest > 60 * FT) {
        push('warn', 'braced-lines', 'Braced wall lines', `The plan is ${round(longest / FT, 0)} ft long; braced wall lines are limited to 60 ft and need an interior line.`, 'IRC Table R602.10.3(1)');
    } else {
        push('ok', 'braced-lines', 'Braced wall lines', `${round(longest / FT, 0)} ft maximum plan dimension is inside the 60 ft braced-line limit.`, 'IRC §R602.10.1');
    }
    const storeyCount = storeys.length;
    const fraction = storeyCount <= 1 ? 0.12 : storeyCount === 2 ? 0.16 : 0.2;
    const requiredBrace = Math.max(4 * FT, exteriorLinear * fraction);
    if (exteriorLinear * 0.6 < requiredBrace) {
        push('warn', 'bracing-length', 'Braced length', `Provide about ${round(requiredBrace / FT, 0)} ft of braced panel; only ${round((exteriorLinear * 0.6) / FT, 0)} ft of clear exterior wall is available.`, 'IRC Table R602.10.3(1)');
    } else {
        push('ok', 'bracing-length', 'Braced length', `About ${round(requiredBrace / FT, 0)} ft of braced panel required; ${round((exteriorLinear * 0.6) / FT, 0)} ft of clear wall available.`, 'IRC Table R602.10.3(1)');
    }
    if (config.holdDowns) {
        push('ok', 'hold-downs', 'Hold-downs', 'Hold-downs at the ends of each braced wall line, with the manufacturer’s anchor and nails.', 'IRC §R602.11');
    } else {
        push('warn', 'hold-downs', 'Hold-downs', 'No hold-downs; a two-storey braced wall needs an uplift and overturning path at its ends.', 'IRC §R602.11');
    }
    push('info', 'hurricane-ties', 'Roof ties', 'Tie the top plate to every other truss or rafter with an approved connector.', 'IRC §R602.10.11');

    floors.forEach((storey) => {
        if (storey.floor.girder && !storey.floor.girder.ok) {
            push('error', 'floor-span', 'Floor girder', `${storey.name}: ${storey.floor.girder.note} gives a ${round(storey.floor.girder.spanM, 2)} m span beyond the girder capacity; add a post or an engineered girder.`, 'IRC Table R502.3(1)');
        } else if (!storey.floor.ok) {
            push('error', 'floor-span', 'Floor joist span', `${storey.name}: ${round(storey.floor.spanM, 2)} m span exceeds the ${round(storey.floor.capacityM, 2)} m capacity of a ${storey.floor.joistSize}.`, 'IRC Table R502.3(1)');
        }
    });
    if (!floors.length) {
        push('info', 'floor-span', 'Floor joists', 'A single-storey plan has no floor platform above; add a storey to size joists.', 'IRC §R502.3.1');
    } else if (floors.every((storey) => storey.floor.ok)) {
        push('ok', 'floor-span', 'Floor joist span', `${worstJoist.floor.joistSize} at ${worstJoist.floor.spacingIn} in carries ${round(worstJoist.floor.spanM, 2)} m of a ${round(worstJoist.floor.capacityM, 2)} m capacity.`, 'IRC Table R502.3(1)');
        push('ok', 'floor-deflection', 'Floor deflection', 'Joists are inside L/360 live deflection at 40 psf.', 'IRC §R502.3.1');
    }
    if (floors.length) {
        push('ok', 'rim-joist', 'Rim joist', 'Double rim closes the platform and carries the wall above to the joists.', 'IRC §R502.2');
        push('ok', 'floor-blocking', 'Joist blocking', 'Solid blocking at the bearings and mid-span bridging where the span needs it.', 'IRC §R502.7');
        push('ok', 'subfloor', 'Subfloor', 'Glued and screwed panels, long edge across the joists and joints staggered.', 'IRC §R503.2');
    }

    if (config.balloon && !config.fireBlocking) {
        push('error', 'fire-blocking', 'Fire blocking', 'Balloon framing without fire blocking leaves a continuous cavity from the foundation to the roof.', 'IRC §R602.8');
    } else if (config.balloon) {
        push('ok', 'fire-blocking', 'Fire blocking', 'Fire blocking at every floor line for the continuous studs.', 'IRC §R602.8');
    } else {
        push('ok', 'fire-blocking', 'Fire blocking', 'Platform framing: the floor platform fire-stops each storey; block the ceiling line as well.', 'IRC §R302.11');
    }

    if (config.anchorBolts) {
        if (config.anchorSpacingFt > 6) {
            push('warn', 'anchor-bolts', 'Anchor bolts', `${config.anchorSpacingFt} ft bolt spacing exceeds the 6 ft maximum.`, 'IRC §R403.1.6');
        } else {
            push('ok', 'anchor-bolts', 'Anchor bolts', `½ in bolts at ${config.anchorSpacingFt} ft, 7 in embed, within 12 in of each plate end.`, 'IRC §R403.1.6');
        }
    } else {
        push('error', 'anchor-bolts', 'Anchor bolts', 'The sill plate is not anchored to the foundation.', 'IRC §R403.1.6');
    }

    push('info', 'square', 'Square and plumb', 'Measure both diagonals of every platform and plumb each wall within ¼ in in 8 ft.', 'Good practice');
    push('info', 'framing-inspection', 'Inspection', 'Framing, sheathing and anchor inspections happen before insulation; keep the grade stamps visible.', 'IRC §R109.1');
    push('info', 'datum', 'Overall', `${storeys.length} storey${storeys.length === 1 ? '' : 's'}, ${round(totalLinear, 1)} m of framed wall, ${storeys.reduce((sum, storey) => sum + (storey.floor?.areaM2 || 0), 0).toFixed(1)} m² of platform.`, '');
    return checks;
}

function pointToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSq = dx * dx + dz * dz || 1;
    const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq, 0, 1);
    const nearest = { x: start.x + t * dx, z: start.z + t * dz };
    return { distance: Math.hypot(point.x - nearest.x, point.z - nearest.z), nearest, t };
}

function boundsOf(walls) {
    const xs = walls.flatMap((wall) => [wall.start.x, wall.end.x]);
    const zs = walls.flatMap((wall) => [wall.start.z, wall.end.z]);
    return {
        widthM: Math.max(...xs) - Math.min(...xs),
        depthM: Math.max(...zs) - Math.min(...zs),
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs)
    };
}

// ---------------------------------------------------------------------------
// Takeoff
// ---------------------------------------------------------------------------

function stockLengthM(cutM) {
    const feet = (Number(cutM) || 0) / FT;
    const stock = BOARD_STOCK_FT.find((value) => value >= feet - 1e-6);
    return (stock || 16) * FT;
}

function buildBom(config, storeys, checks) {
    const rows = [];
    const add = (group, item, qty, unit, unitCost, note = '') => {
        if (!qty || qty <= 0) return;
        rows.push({
            group,
            item,
            qty: Math.round(qty * 100) / 100,
            unit,
            unitCost: round(unitCost, 2),
            cost: round(qty * unitCost, 2),
            note
        });
    };
    const cutGroups = new Map();
    storeys.forEach((storey) => {
        storey.walls.forEach((wall) => {
            wall.members.forEach((member) => {
                if (['plate-bottom', 'plate-top'].includes(member.kind)) return;
                const lengthIn = Math.round(member.cutLengthM / IN * 2) / 2;
                const key = `${member.kind}|${member.size}|${lengthIn}|${member.treated ? 'pt' : 'kd'}`;
                const entry = cutGroups.get(key) || {
                    kind: member.kind,
                    size: member.size,
                    lengthM: member.cutLengthM,
                    lengthIn,
                    treated: Boolean(member.treated),
                    count: 0,
                    plies: 1,
                    engineered: Boolean(member.engineered)
                };
                entry.count += 1;
                // A header member is one opening; the board count is its plies.
                entry.plies = Math.max(entry.plies, Number(member.plies) || 1);
                cutGroups.set(key, entry);
            });
        });
    });

    const labels = {
        stud: 'common stud',
        king: 'king stud',
        jack: 'jack / trimmer stud',
        cripple: 'cripple stud',
        header: 'header ply',
        sill: 'rough sill',
        block: 'blocking'
    };
    const sorted = [...cutGroups.values()].sort((a, b) => (
        a.kind === b.kind ? a.lengthIn - b.lengthIn : a.kind.localeCompare(b.kind)
    ));
    sorted.forEach((entry) => {
        const isOffcut = ['cripple', 'block'].includes(entry.kind);
        const stock = isOffcut ? entry.lengthM : Math.max(entry.lengthM, 8 * FT);
        const waste = 1 + (isOffcut ? Math.max(config.waste, 0.15) : 0);
        const unitCost = pieceCost(entry.size, stock) * waste;
        add(
            entry.kind === 'header' ? 'Headers' : entry.kind === 'block' ? 'Blocking' : 'Studs',
            `${entry.size} × ${ftIn(entry.lengthM)} ${labels[entry.kind] || entry.kind}${entry.treated ? ' (PT)' : ''}`,
            entry.kind === 'header' ? entry.count * entry.plies : entry.count,
            'ea',
            unitCost,
            entry.engineered ? 'Engineered LVL: confirm with the supplier.' : isOffcut ? 'Cut from offcuts.' : `Cut from ${round(stock / FT, 0)} ft stock.`
        );
    });

    // Plates are bought as long stock; count the pieces across all walls.
    const plateTotals = { bottom: 0, top: 0 };
    storeys.forEach((storey) => {
        storey.walls.forEach((wall) => {
            wall.members.filter((member) => member.kind === 'plate-bottom').forEach((member) => {
                plateTotals.bottom += member.x1 - member.x0;
            });
            wall.members.filter((member) => member.kind === 'plate-top').forEach((member) => {
                plateTotals.top += member.x1 - member.x0;
            });
        });
    });
    const plateStockM = 16 * FT;
    if (plateTotals.bottom > 0) {
        add('Plates', `${config.studSize} × 16 ft treated sole plate`, ceil(plateTotals.bottom / plateStockM), 'ea', pieceCost(config.studSize, plateStockM), 'Cut at door openings.');
    }
    if (plateTotals.top > 0) {
        add('Plates', `${config.studSize} × 16 ft top plate`, ceil(plateTotals.top / plateStockM), 'ea', pieceCost(config.studSize, plateStockM), 'Two layers, joints offset 24 in.');
    }

    // Header plies are counted per header, not per wall member row.
    storeys.forEach((storey) => {
        storey.walls.forEach((wall) => {
            wall.openings.forEach((opening) => {
                const header = opening.header;
                if (header.engineered) {
                    add('Headers', `Engineered LVL ${ftIn(opening.widthM)}`, header.plies, 'ea', 145, 'Design by the LVL supplier; price is an allowance.');
                }
            });
        });
    });

    const wallSheets = storeys.reduce((sum, storey) => sum + storey.walls.reduce((inner, wall) => inner + wall.sheathing.sheets, 0), 0);
    const exteriorSheets = storeys.reduce((sum, storey) => sum + storey.walls.filter((wall) => wall.exterior).reduce((inner, wall) => inner + wall.sheathing.sheets, 0), 0);
    const sheathing = sheathingById(config.sheathing);
    if (wallSheets > 0) {
        add('Sheathing', `${sheathing.label} (4 × 8 ft)`, wallSheets, 'sheet', sheathing.cost, `${exteriorSheets} exterior sheets; ${sheathing.nail}.`);
    }

    const floorSheets = storeys.reduce((sum, storey) => sum + (storey.floor?.sheets || 0), 0);
    const subfloor = subfloorById(config.subfloor);
    if (floorSheets > 0) {
        add('Floor', `${subfloor.label} (4 × 8 ft)`, floorSheets, 'sheet', subfloor.cost, 'Glue and screw; stagger the joints.');
    }
    let joists = 0;
    let rimM = 0;
    let girderPlies = 0;
    let girderM = 0;
    let girderPosts = 0;
    let girderLengthM = 0;
    storeys.forEach((storey) => {
        if (!storey.floor) return;
        joists += storey.floor.joistCount;
        rimM += storey.floor.rimLengthM;
        if (storey.floor.girder) {
            girderPlies = storey.floor.girder.plies;
            girderLengthM = storey.floor.girder.lengthM;
            girderM += storey.floor.girder.lengthM * storey.floor.girder.plies;
            girderPosts += storey.floor.girder.posts;
        }
    });
    const floorWithJoists = storeys.find((storey) => storey.floor);
    if (joists > 0) {
        const joistSize = floorWithJoists?.floor.joistSize || '2x10';
        const joistLengthM = floorWithJoists?.floor.joistLengthM || 4;
        add('Floor', `${joistSize} × ${ftIn(joistLengthM)} floor joist`, joists, 'ea', pieceCost(joistSize, Math.max(joistLengthM, 8 * FT)), 'At the configured spacing, with solid blocking.');
        add('Floor', `${joistSize} × 16 ft rim joist`, ceil(rimM / plateStockM), 'ea', pieceCost(joistSize, plateStockM), 'Two rim layers; nail each joist end.');
        add('Floor', CONNECTORS.adhesive.label, ceil(joists / 4), 'tube', CONNECTORS.adhesive.cost, CONNECTORS.adhesive.use);
        add('Floor', CONNECTORS.joistHanger.label, ceil(joists * 0.1) + (girderPosts ? joists : 0), 'ea', CONNECTORS.joistHanger.cost, 'Where a joist lands on the girder or a header rather than a wall.');
    }
    if (girderM > 0) {
        const girder = floorWithJoists?.floor.girder;
        add('Floor', `${girder.size} × 16 ft girder ply`, ceil(girderM / plateStockM), 'ea', pieceCost(girder.size, plateStockM), `${girderPlies} plies, nailed and bolted per the design.`);
        add('Floor', `6x6 × ${ftIn(storeys[floorWithJoists.index]?.heightM || 2.4)} girder post`, girderPosts, 'ea', pieceCost('6x6', storeys[floorWithJoists.index]?.heightM || 2.4), 'On a footing or a wall below; add a post base.');
        void girderLengthM;
    }

    // Fasteners from the actual member counts.
    let studEnds = 0;
    let blockEnds = 0;
    let headerEnds = 0;
    let sheathingNails = 0;
    storeys.forEach((storey) => {
        storey.walls.forEach((wall) => {
            wall.members.forEach((member) => {
                if (['stud', 'king', 'jack'].includes(member.kind)) studEnds += 2;
                if (member.kind === 'cripple') studEnds += 2;
                if (member.kind === 'block') blockEnds += 2;
                if (member.kind === 'header') headerEnds += 2;
            });
            sheathingNails += wall.sheathing.nails;
        });
    });
    const nails16d = studEnds * 2 + blockEnds * 2 + headerEnds * 4;
    const lbs16 = Math.ceil((nails16d / FASTENERS['16d-common'].perLb) * 2) / 2;
    if (lbs16 > 0) add('Fasteners', FASTENERS['16d-common'].label, lbs16, 'lb', FASTENERS['16d-common'].cost, 'Studs, plates, headers and blocking.');
    const lbs8 = Math.ceil((sheathingNails / FASTENERS['8d-common'].perLb) * 2) / 2;
    if (lbs8 > 0) add('Fasteners', FASTENERS['8d-common'].label, lbs8, 'lb', FASTENERS['8d-common'].cost, 'Sheathing at 6 in edge / 12 in field.');
    if (floorSheets > 0) {
        add('Fasteners', FASTENERS['screw-subfloor'].label, ceil((floorSheets * subfloor.screwsPerSheet) / FASTENERS['screw-subfloor'].perBox), 'box', FASTENERS['screw-subfloor'].cost, 'Subfloor at 6 in edge / 12 in field.');
    }

    const groundWalls = storeys[0]?.walls || [];
    const perimeterM = groundWalls.reduce((sum, wall) => sum + wall.lengthM, 0);
    if (config.anchorBolts && perimeterM > 0) {
        const count = Math.ceil(perimeterM / (config.anchorSpacingFt * FT)) + groundWalls.length;
        add('Anchorage', CONNECTORS.anchorBolt.label, count, 'ea', CONNECTORS.anchorBolt.cost, `At ${config.anchorSpacingFt} ft and within 12 in of each plate end.`);
        const seals = Math.max(1, ceil(perimeterM / (50 * FT)));
        add('Anchorage', CONNECTORS.sillSeal.label, seals, 'roll', CONNECTORS.sillSeal.cost, CONNECTORS.sillSeal.use);
    }
    if (config.holdDowns) {
        const ends = Math.max(4, groundWalls.length * 2);
        add('Anchorage', CONNECTORS.holdDown.label, ends, 'ea', CONNECTORS.holdDown.cost, 'Wall ends and braced wall line ends.');
    }
    if (config.houseWrap) {
        const exteriorArea = storeys.reduce((sum, storey) => sum + storey.exteriorWalls.reduce((inner, wall) => inner + wall.sheathing.areaM2, 0), 0);
        const rolls = Math.max(1, ceil((exteriorArea * 1.12) / (3 * FT * 100 * FT)));
        add('Weather barrier', CONNECTORS.houseWrap.label, rolls, 'roll', CONNECTORS.houseWrap.cost, 'Lapped 6 in horizontally and vertically.');
        add('Weather barrier', CONNECTORS.seamTape.label, Math.max(1, ceil(rolls / 2)), 'roll', CONNECTORS.seamTape.cost, 'Every lap and penetration.');
    }
    if (storeys.length > 0) {
        const topPerimeter = storeys[storeys.length - 1].walls.reduce((sum, wall) => sum + wall.lengthM, 0);
        if (topPerimeter > 0) {
            add('Anchorage', CONNECTORS.hurricaneTie.label, ceil(topPerimeter / (2 * FT)), 'ea', CONNECTORS.hurricaneTie.cost, 'Top plate to truss or rafter, every other member.');
        }
    }

    const material = round(rows.reduce((sum, row) => sum + row.cost, 0), 2);
    const hours = round(
        storeys.reduce((sum, storey) => sum + storey.studs * 0.11, 0)
        + wallSheets * 0.32
        + joists * 0.16
        + floorSheets * 0.24
        + storeys.reduce((sum, storey) => sum + storey.walls.reduce((inner, wall) => inner + wall.lengthM * 0.08, 0), 0),
        1
    );
    const labour = round(hours * config.labourRate, 2);
    const boardFeetTotal = round(sorted.reduce((sum, entry) => (
        sum + boardFeet(entry.size, entry.lengthM, entry.count)
    ), 0), 1);
    if (hours > 0) {
        rows.push({
            group: 'Labour',
            item: `Framing labour · ${config.labourRate} $/hr`,
            qty: hours,
            unit: 'hr',
            unitCost: config.labourRate,
            cost: labour,
            note: 'Frame, raise, sheathe and deck; add crane or truss setting separately.'
        });
    }

    return {
        rows,
        material,
        labour,
        total: round(material + labour, 2),
        boardFeet: boardFeetTotal,
        hours
    };
}

function buildCutList(storeys) {
    const entries = new Map();
    storeys.forEach((storey) => {
        storey.walls.forEach((wall) => {
            wall.members.forEach((member) => {
                if (member.kind === 'block') return;
                const lengthIn = Math.round((member.cutLengthM / IN) * 2) / 2;
                const key = `${member.size}|${lengthIn}|${member.treated ? 'pt' : 'kd'}|${member.kind}`;
                const entry = entries.get(key) || {
                    size: member.size,
                    lengthM: round(member.cutLengthM, 3),
                    lengthIn,
                    count: 0,
                    kind: member.kind,
                    treated: Boolean(member.treated),
                    storeys: new Set()
                };
                entry.count += member.kind === 'header' ? (Number(member.plies) || 1) : 1;
                entry.storeys.add(storey.name);
                entries.set(key, entry);
            });
        });
    });
    return [...entries.values()]
        .sort((a, b) => b.lengthIn - a.lengthIn || a.size.localeCompare(b.size))
        .map((entry) => ({
            label: `${entry.size} ${entry.treated ? 'PT ' : ''}${entry.kind}`,
            size: entry.size,
            lengthM: entry.lengthM,
            lengthIn: entry.lengthIn,
            count: entry.count,
            treated: entry.treated,
            note: `${[...entry.storeys].join(', ')}${entry.treated ? ' · treated' : ''}`
        }));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function framingScheduleCsv(design) {
    const header = ['storey', 'wall', 'exterior', 'length_m', 'height_m', 'studs', 'kings', 'jacks', 'cripples', 'header', 'openings', 'sheathing_sheets'].map(quote).join(',');
    const rows = design.storeys.flatMap((storey) => storey.walls.map((wall) => {
        const worstHeader = wall.openings.reduce((worst, opening) => (
            !worst || opening.header.utilisation > worst.header.utilisation ? opening : worst
        ), null);
        return [
            storey.name,
            wall.name,
            wall.exterior ? 'exterior' : 'interior',
            round(wall.lengthM, 2),
            round(wall.heightM, 2),
            wall.counts.studs,
            wall.counts.kings,
            wall.counts.jacks,
            wall.counts.cripples,
            worstHeader ? worstHeader.header.note : '—',
            wall.openings.length,
            wall.sheathing.sheets
        ].map(quote).join(',');
    }));
    return [header, ...rows].join('\n');
}

export function framingCutListCsv(design) {
    const header = ['member', 'size', 'length_in', 'length_m', 'qty', 'treated', 'note'].map(quote).join(',');
    const rows = design.cutRows.map((row) => [
        row.label, row.size, row.lengthIn, row.lengthM, row.count, row.treated ? 'yes' : 'no', row.note
    ].map(quote).join(','));
    return [header, ...rows].join('\n');
}

export function framingTakeoffCsv(design) {
    const header = ['group', 'item', 'qty', 'unit', 'unit_cost', 'cost', 'note'].map(quote).join(',');
    const rows = design.bom.rows.map((row) => [
        row.group, row.item, row.qty, row.unit, row.unitCost, row.cost, row.note
    ].map(quote).join(','));
    const summary = [
        ['Summary', 'Material', design.bom.material, 'USD', '', '', ''],
        ['Summary', 'Labour', design.bom.labour, 'USD', '', '', ''],
        ['Summary', 'Total', design.bom.total, 'USD', '', '', ''],
        ['Summary', 'Board feet', design.bom.boardFeet, 'bf', '', '', '']
    ].map((row) => row.map(quote).join(','));
    return [header, ...rows, ...summary].join('\n');
}

export function framingSummaryText(design) {
    return (design?.summary || []).join('\n');
}

export { FT, IN };
