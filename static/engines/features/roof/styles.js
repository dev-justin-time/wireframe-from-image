/**
 * Roof styles - the ten truss families in the roof suite.
 *
 * Every style is described twice: by the planes that cover it (quads in a local
 * frame where x runs across the span, z runs along the ridge and y = 0 is the
 * wall top), and by the truss member lines that support those planes. The
 * designer, the takeoff and the 3D scene all read the same geometry, so the
 * numbers and the model cannot drift apart.
 */

const toRad = (value) => (value * Math.PI) / 180;

export const ROOF_STYLES = [
    {
        key: 'gable-king',
        name: 'Gable · king post',
        family: 'gable',
        truss: 'king-post',
        planes: 'gable',
        minPitch: 3,
        summary: 'Two sloping planes meeting at a central ridge, braced by a king post and four webs.',
        bestFor: 'Simple houses, garages and additions; the cheapest truss to build.'
    },
    {
        key: 'gable-fink',
        name: 'Gable · Fink',
        family: 'gable',
        truss: 'fink',
        planes: 'gable',
        minPitch: 3,
        summary: 'The standard W-web truss: light, economical and the most common residential profile.',
        bestFor: 'Production housing with spans up to about 12 m at 24 in o.c.'
    },
    {
        key: 'gable-howe',
        name: 'Gable · Howe',
        family: 'gable',
        truss: 'howe',
        planes: 'gable',
        minPitch: 3,
        summary: 'Vertical webs with diagonal compression members - stiff under heavy roof loads.',
        bestFor: 'Tile, slate and other heavy coverings; longer spans.'
    },
    {
        key: 'gable-scissor',
        name: 'Gable · scissor',
        family: 'gable',
        truss: 'scissor',
        planes: 'gable',
        minPitch: 4,
        summary: 'Crossing bottom chords raise the ceiling line into a shallow vault without a ridge beam.',
        bestFor: 'Vaulted living rooms and open-plan spaces.'
    },
    {
        key: 'gable-attic',
        name: 'Gable · attic (room in roof)',
        family: 'gable',
        truss: 'attic',
        planes: 'gable',
        minPitch: 5,
        summary: 'A raised tie creates a usable room between the bottom chord and the collar.',
        bestFor: 'Houses that need storage or a habitable attic without a second storey.'
    },
    {
        key: 'gambrel',
        name: 'Gambrel',
        family: 'gambrel',
        truss: 'gambrel',
        planes: 'gambrel',
        minPitch: 5,
        summary: 'Two pitches per side: a steep lower plane and a shallower upper plane to the ridge.',
        bestFor: 'Barn-style volumes and full-height second floors.'
    },
    {
        key: 'hip',
        name: 'Hip',
        family: 'hip',
        truss: 'hip',
        planes: 'hip',
        minPitch: 3,
        summary: 'Four sloping planes on every wall, so the roof is self-bracing and wind-resistant.',
        bestFor: 'High-wind and cold climates; a lower profile than a gable.'
    },
    {
        key: 'cross-gable',
        name: 'Cross gable',
        family: 'cross',
        truss: 'cross',
        planes: 'cross',
        minPitch: 3,
        summary: 'Two gables that intersect, forming two valleys and a more articulated street face.',
        bestFor: 'L- and T-shaped plans, porches and additions.'    },
    {
        key: 'shed',
        name: 'Shed · mono-pitch',
        family: 'shed',
        truss: 'shed',
        planes: 'shed',
        minPitch: 3,
        summary: 'A single plane falling from a high wall to a low wall - one plane, one eave, one rake.',
        bestFor: 'Modern additions, outbuildings, porches and lean-tos.'
    },
    {
        key: 'saltbox',
        name: 'Saltbox',
        family: 'saltbox',
        truss: 'saltbox',
        planes: 'saltbox',
        minPitch: 3,
        summary: 'An asymmetric gable: a short steep side and a long shallow side share one ridge.',
        bestFor: 'New England-style houses that need more plan depth on one side.'
    }
];

export const ROOF_STYLE_COUNT = ROOF_STYLES.length;

export function roofStyle(key) {
    return ROOF_STYLES.find((style) => style.key === key) || ROOF_STYLES[0];
}

const triArea = (a, b, c) => {
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const vz = c.z - a.z;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    return Math.hypot(cx, cy, cz) / 2;
};

export function quadArea(points = []) {
    let area = 0;
    for (let i = 1; i < points.length - 1; i += 1) area += triArea(points[0], points[i], points[i + 1]);
    return area;
}

const plane = (id, points, extra = {}) => ({ id, points, area: quadArea(points), ...extra });

/** Four corners of a slope plane running from the ridge to one eave. */
function gablePlane(id, { ridgeX = 0, ridgeY, eaveX, eaveY, z1, z2 }) {
    return plane(id, [
        { x: ridgeX, y: ridgeY, z: z1 },
        { x: eaveX, y: eaveY, z: z1 },
        { x: eaveX, y: eaveY, z: z2 },
        { x: ridgeX, y: ridgeY, z: z2 }
    ]);
}

/**
 * Roof geometry for one style. All inputs are metres, except `pitch`, which is
 * the rise per 12 of run (a 6:12 roof passes 6).
 */
export function roofGeometry({
    style,
    span = 10,
    length = 14,
    pitch = 6,
    overhang = 0.5
} = {}) {
    const definition = roofStyle(style);
    const safeSpan = Math.max(span, 1.2);
    const safeLength = Math.max(length, 1.2);
    const safePitch = Math.max(pitch, 0.1);
    const run = safePitch / 12;
    const half = safeSpan / 2;
    const over = Math.max(overhang, 0);
    const z1 = -safeLength / 2 - over;
    const z2 = safeLength / 2 + over;
    const eaveY = -over * run;
    const rise = definition.family === 'shed' ? safeSpan * run : half * run;
    const planes = [];
    let ridgeX = 0;
    let crossRise = 0;
    let ridgeLength = safeLength;
    let valleyLength = 0;
    let hipLength = 0;

    if (definition.family === 'gable') {
        planes.push(
            gablePlane('right', { ridgeY: rise, eaveX: half + over, eaveY, z1, z2 }),
            gablePlane('left', { ridgeY: rise, eaveX: -half - over, eaveY, z1, z2 })
        );
        ridgeLength = safeLength + 2 * over;
    } else if (definition.family === 'saltbox') {
        // Ridge offset toward one side: a short steep run and a long shallow one.
        const leftRun = safeSpan * 0.38;
        const rightRun = safeSpan * 0.62;
        ridgeX = -half + leftRun;
        const leftSlope = rise / leftRun;
        const rightSlope = rise / rightRun;
        planes.push(
            gablePlane('right', {
                ridgeX, ridgeY: rise, eaveX: half + over, eaveY: -over * rightSlope, z1, z2
            }),
            gablePlane('left', {
                ridgeX, ridgeY: rise, eaveX: -half - over, eaveY: -over * leftSlope, z1, z2
            })
        );
        ridgeLength = safeLength + 2 * over;
    } else if (definition.family === 'gambrel') {
        // Two planes per side: 45% of the rise below the break, 55% above.
        const breakX = half * 0.55;
        const lowerRise = rise * 0.45;
        const upperRise = rise - lowerRise;
        const lowerSlope = lowerRise / (half - breakX);
        const lowerEaveY = -over * lowerSlope;
        [1, -1].forEach((side) => {
            const sign = side;
            planes.push(
                plane(`lower-${side > 0 ? 'right' : 'left'}`, [
                    { x: sign * breakX, y: lowerRise, z: z1 },
                    { x: sign * (half + over), y: lowerEaveY, z: z1 },
                    { x: sign * (half + over), y: lowerEaveY, z: z2 },
                    { x: sign * breakX, y: lowerRise, z: z2 }
                ]),
                plane(`upper-${side > 0 ? 'right' : 'left'}`, [
                    { x: 0, y: rise, z: z1 },
                    { x: sign * breakX, y: lowerRise, z: z1 },
                    { x: sign * breakX, y: lowerRise, z: z2 },
                    { x: 0, y: rise, z: z2 }
                ])
            );
        });
        ridgeLength = safeLength + 2 * over;
    } else if (definition.family === 'hip') {
        ridgeLength = Math.max(safeLength - safeSpan, 0.4);
        const ridgeZ = ridgeLength / 2;
        const eaveX = half + over;
        const eaveZ = safeLength / 2 + over;
        // Hips follow the slope, so add the fall from ridge to eave to the plan run.
        hipLength = 4 * Math.hypot(Math.hypot(eaveX, eaveZ - ridgeZ), rise - eaveY);
        planes.push(
            gablePlane('right', { ridgeY: rise, eaveX, eaveY, z1: -ridgeZ, z2: ridgeZ }),
            gablePlane('left', { ridgeY: rise, eaveX: -eaveX, eaveY, z1: -ridgeZ, z2: ridgeZ }),
            plane('front', [
                { x: 0, y: rise, z: -ridgeZ },
                { x: -eaveX, y: eaveY, z: -eaveZ },
                { x: eaveX, y: eaveY, z: -eaveZ }
            ]),
            plane('back', [
                { x: 0, y: rise, z: ridgeZ },
                { x: eaveX, y: eaveY, z: eaveZ },
                { x: -eaveX, y: eaveY, z: eaveZ }
            ])
        );
        // A square plan turns the hip into a pyramid; the ridge is nominal only.
        ridgeLength = Math.max(ridgeLength, 0);
        valleyLength = 0;
    } else if (definition.family === 'cross') {
        crossRise = rise * 0.85;
        const crossHalf = safeLength * 0.28;
        const crossEaveY = -over * (crossRise / crossHalf);
        const x1 = -half - over;
        const x2 = half + over;
        // Main gable, plus a perpendicular gable that dies into it.
        planes.push(
            gablePlane('right', { ridgeY: rise, eaveX: half + over, eaveY, z1, z2 }),
            gablePlane('left', { ridgeY: rise, eaveX: -half - over, eaveY, z1, z2 }),
            plane('cross-front', [
                { x: x1, y: crossRise, z: 0 },
                { x: x2, y: crossRise, z: 0 },
                { x: x2, y: crossEaveY, z: crossHalf + over },
                { x: x1, y: crossEaveY, z: crossHalf + over }
            ]),
            plane('cross-back', [
                { x: x2, y: crossRise, z: 0 },
                { x: x1, y: crossRise, z: 0 },
                { x: x1, y: crossEaveY, z: -crossHalf - over },
                { x: x2, y: crossEaveY, z: -crossHalf - over }
            ])
        );
        ridgeLength = safeLength + safeSpan * 0.9;
        valleyLength = 4 * Math.hypot(safeSpan * 0.22, rise * 0.35);
    } else if (definition.family === 'shed') {
        const highY = rise;
        const highOverhangY = rise + over * run;
        const lowOverhangY = -over * run;
        planes.push(plane('slope', [
            { x: -half - over, y: highOverhangY, z: z1 },
            { x: half + over, y: lowOverhangY, z: z1 },
            { x: half + over, y: lowOverhangY, z: z2 },
            { x: -half - over, y: highOverhangY, z: z2 }
        ]));
        ridgeLength = 0;
    }

    const roofArea = planes.reduce((total, entry) => total + entry.area, 0);
    const footprintArea = safeSpan * safeLength;

    // Rake (gable-end) length, summed over every plane that ends in a gable.
    const slopeLengthOf = (runX, riseY, overX, overY) => Math.hypot(runX + overX, riseY + overY);
    let rakeLength = 0;
    if (definition.family === 'hip') {
        rakeLength = 0;
    } else if (definition.family === 'shed') {
        rakeLength = 2 * slopeLengthOf(safeSpan, rise, over, over * run);
    } else if (definition.family === 'gambrel') {
        const breakX = half * 0.55;
        const lowerRise = rise * 0.45;
        const lowerSlope = lowerRise / (half - breakX);
        rakeLength = 4 * Math.hypot(half - breakX + over, lowerRise + over * lowerSlope)
            + 4 * Math.hypot(breakX, rise - lowerRise);
    } else if (definition.family === 'saltbox') {
        const leftRun = half + ridgeX;
        const rightRun = half - ridgeX;
        rakeLength = 2 * slopeLengthOf(leftRun, rise, over, over * (rise / leftRun))
            + 2 * slopeLengthOf(rightRun, rise, over, over * (rise / rightRun));
    } else if (definition.family === 'cross') {
        const mainSlope = slopeLengthOf(half, rise, over, over * run);
        const crossHalf = safeLength * 0.28;
        const crossSlope = slopeLengthOf(crossHalf, crossRise, over, 0);
        rakeLength = 4 * mainSlope + 4 * crossSlope;
    } else {
        rakeLength = 4 * slopeLengthOf(half, rise, over, over * run);
    }

    const eaveLength = definition.family === 'hip'
        ? 2 * (safeLength + 2 * over) + 2 * (safeSpan + 2 * over)
        : definition.family === 'shed'
            ? safeLength + 2 * over
            : definition.family === 'cross'
                ? 2 * (safeLength + 2 * over) + 2 * (safeSpan + 2 * over)
                : 2 * (safeLength + 2 * over);

    return {
        style: definition.key,
        family: definition.family,
        pitch: safePitch,
        angle: (Math.atan(run) * 180) / Math.PI,
        span: safeSpan,
        length: safeLength,
        overhang: over,
        half,
        rise,
        ridgeX,
        crossRise,
        ridgeLength,
        hipLength,
        valleyLength,
        eaveLength,
        rakeLength,
        roofArea,
        footprintArea,
        slopeLength: Math.hypot(half, rise),
        planes
    };
}

/**
 * Truss member lines for one style, in truss-local metres: x runs from -half to
 * +half, y from the bottom chord (0) up to the ridge. Members are returned as
 * line segments so the 3D builder can extrude them and the takeoff can measure
 * them without knowing the style.
 */
export function trussMembers(styleKey, geometry) {
    const definition = roofStyle(styleKey);
    const { half, rise } = geometry;
    const members = [];
    const add = (x1, y1, x2, y2, kind) => members.push({ x1, y1, x2, y2, kind });
    const bottom = () => add(-half, 0, half, 0, 'chord-bottom');
    const topChords = (ridgeY = rise, atX = 0) => {
        add(-half, 0, atX, ridgeY, 'chord-top');
        add(half, 0, atX, ridgeY, 'chord-top');
    };

    if (definition.truss === 'king-post') {
        bottom();
        topChords();
        add(0, 0, 0, rise, 'king');
        [0.5, 0.75].forEach((fraction) => {
            [1, -1].forEach((side) => {
                add(side * half * fraction, 0, (side * half * fraction) / 2, rise * (1 - fraction / 2), 'web');
            });
        });
    } else if (definition.truss === 'fink') {
        bottom();
        topChords();
        add(-half * 0.5, 0, -half * 0.25, rise * 0.5, 'web');
        add(-half * 0.25, rise * 0.5, 0, 0, 'web');
        add(half * 0.25, rise * 0.5, 0, 0, 'web');
        add(half * 0.5, 0, half * 0.25, rise * 0.5, 'web');
    } else if (definition.truss === 'howe') {
        bottom();
        topChords();
        [1, -1].forEach((side) => {
            add(side * half * 0.5, 0, side * half * 0.5, rise * 0.5, 'web');
            add(0, 0, side * half * 0.5, rise * 0.5, 'web');
        });
    } else if (definition.truss === 'scissor') {
        topChords();
        add(-half, rise * 0.12, half * 0.55, rise * 0.82, 'chord-bottom');
        add(half, rise * 0.12, -half * 0.55, rise * 0.82, 'chord-bottom');
        add(0, rise * 0.28, 0, rise * 0.9, 'king');
    } else if (definition.truss === 'attic') {
        bottom();
        topChords();
        const tie = rise * 0.52;
        add(-half * 0.78, tie, half * 0.78, tie, 'tie');
        [1, -1].forEach((side) => add(side * half * 0.78, 0, side * half * 0.78, tie, 'web'));
        add(0, tie, 0, rise, 'king');
    } else if (definition.truss === 'gambrel') {
        bottom();
        const breakX = half * 0.55;
        const lowerRise = rise * 0.45;
        [1, -1].forEach((side) => {
            add(side * half, 0, side * breakX, lowerRise, 'chord-top');
            add(side * breakX, lowerRise, 0, rise, 'chord-top');
            add(side * breakX, 0, side * breakX, lowerRise, 'web');
        });
        add(0, 0, 0, rise, 'king');
    } else if (definition.truss === 'saltbox') {
        bottom();
        add(-half, 0, geometry.ridgeX, rise, 'chord-top');
        add(half, 0, geometry.ridgeX, rise, 'chord-top');
        add(geometry.ridgeX, 0, geometry.ridgeX, rise, 'king');
        [1, -1].forEach((side) => {
            add(side * half * 0.5, 0, side * half * 0.25, rise * 0.45, 'web');
        });
    } else if (definition.truss === 'shed') {
        add(-half, 0, half, 0, 'chord-bottom');
        add(-half, rise, half, 0, 'chord-top');
        add(-half, 0, -half, rise, 'web');
        add(0, 0, 0, rise * 0.5, 'web');
    } else {
        // Hip and cross trusses reuse the king-post profile at full span.
        bottom();
        topChords();
        add(0, 0, 0, rise, 'king');
        [0.5, 0.75].forEach((fraction) => {
            [1, -1].forEach((side) => {
                add(side * half * fraction, 0, (side * half * fraction) / 2, rise * (1 - fraction / 2), 'web');
            });
        });
    }

    return members;
}

/**
 * Eave segments for gutters, fascia and soffits. Each segment is a run in plan
 * coordinates at the eave line, so the geometry builder can extrude a gutter
 * along it and the takeoff can count its length.
 */
export function eaveSegments(geometry) {
    const { family, half, length, overhang, rise, pitch } = geometry;
    const over = overhang;
    const run = pitch / 12;
    const eaveY = -over * run;
    const x = half + over;
    const z = length / 2 + over;
    if (family === 'hip') {
        return [
            { id: 'right', x1: x, z1: -z, x2: x, z2: z, y: eaveY },
            { id: 'left', x1: -x, z1: z, x2: -x, z2: -z, y: eaveY },
            { id: 'front', x1: -x, z1: -z, x2: x, z2: -z, y: eaveY },
            { id: 'back', x1: x, z1: z, x2: -x, z2: z, y: eaveY }
        ];
    }
    if (family === 'shed') {
        return [{ id: 'low', x1: -x, z1: -z, x2: x, z2: -z, y: eaveY }];
    }
    if (family === 'cross') {
        const crossHalf = length * 0.28;
        const crossRise = rise * 0.85;
        const crossEaveY = -over * (crossRise / crossHalf);
        return [
            { id: 'right', x1: x, z1: -z, x2: x, z2: z, y: eaveY },
            { id: 'left', x1: -x, z1: z, x2: -x, z2: -z, y: eaveY },
            { id: 'cross-front', x1: x, z1: crossHalf + over, x2: -x, z2: crossHalf + over, y: crossEaveY },
            { id: 'cross-back', x1: -x, z1: -crossHalf - over, x2: x, z2: -crossHalf - over, y: crossEaveY }
        ];
    }
    if (family === 'saltbox') {
        const leftRun = half + geometry.ridgeX;
        const rightRun = half - geometry.ridgeX;
        return [
            { id: 'right', x1: x, z1: -z, x2: x, z2: z, y: -over * (rise / rightRun) },
            { id: 'left', x1: -x, z1: z, x2: -x, z2: -z, y: -over * (rise / leftRun) }
        ];
    }
    // Gable and gambrel: two long eaves, one each side.
    return [
        { id: 'right', x1: x, z1: -z, x2: x, z2: z, y: eaveY },
        { id: 'left', x1: -x, z1: z, x2: -x, z2: -z, y: eaveY }
    ];
}

/** Ridge and hip lines, for ridge caps and vent strips. */
export function ridgeSegments(geometry) {
    const { family, rise, length, span, overhang, ridgeX = 0, crossRise = 0 } = geometry;
    const over = overhang;
    if (family === 'hip') {
        const ridgeLength = geometry.ridgeLength;
        return [{ id: 'ridge', x1: 0, y: rise, z1: -ridgeLength / 2, z2: ridgeLength / 2 }];
    }
    if (family === 'shed') return [];
    if (family === 'cross') {
        return [
            { id: 'main', x1: ridgeX, y: rise, z1: -(length / 2 + over), z2: length / 2 + over },
            { id: 'cross', x1: -span / 2 - over, y: crossRise, z1: 0, x2: span / 2 + over, z2: 0 }
        ];
    }
    return [{ id: 'ridge', x1: ridgeX, y: rise, z1: -(length / 2 + over), z2: length / 2 + over }];
}

/** The four hip runs, used for hip/ridge caps and the takeoff. */
export function hipSegments(geometry) {
    if (geometry.family !== 'hip') return [];
    const { half, length, rise, overhang } = geometry;
    const over = overhang;
    const ridgeZ = geometry.ridgeLength / 2;
    const x = half + over;
    const z = length / 2 + over;
    const eaveY = -over * (geometry.pitch / 12);
    return [
        { id: 'hip-ne', x1: 0, y: rise, z1: ridgeZ, x2: x, z2: z, y2: eaveY },
        { id: 'hip-nw', x1: 0, y: rise, z1: ridgeZ, x2: -x, z2: z, y2: eaveY },
        { id: 'hip-se', x1: 0, y: rise, z1: -ridgeZ, x2: x, z2: -z, y2: eaveY },
        { id: 'hip-sw', x1: 0, y: rise, z1: -ridgeZ, x2: -x, z2: -z, y2: eaveY }
    ];
}

export { toRad };
