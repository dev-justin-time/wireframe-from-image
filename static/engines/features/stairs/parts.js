import * as THREE from 'three';
import { toWireframe } from '../../engine/wireframe.js';

/**
 * Stair parts library.
 *
 * Every component the suite draws is described once, here: its nominal US
 * dimension (in metres, from the dressed size in inches), its material, and the
 * primitives that make it. `buildPart` turns that into a solid group and
 * `buildPartWireframe` turns the same group into edges, so the gallery, the
 * scene and the takeoff cannot disagree about a 2x10 stringer.
 *
 * Dressed lumber sizes are used, not nominal: a 2x10 is 1½ x 9¼ in.
 */

import { IN, FT, LUMBER } from '../lumber.js';
export { IN, FT, LUMBER } from '../lumber.js';

const DEFAULTS = {
    width: 36 * IN,
    tread: 10 * IN,
    riser: 7.5 * IN,
    run: 10 * FT,
    rail: 36 * IN,
    guard: 42 * IN,
    landing: 48 * IN,
    slab: 4 * IN,
    depth: 42 * IN,
    height: 42 * IN,
    opening: 37.5 * IN,
    mat: 32 * IN,
    shaft: 7 * FT
};

const box = (w, h, d, x = 0, y = 0, z = 0, rot = null) => ({
    kind: 'box', w, h, d, x, y, z, rot
});
const cyl = (radius, height, x = 0, y = 0, z = 0, rot = null) => ({
    kind: 'cylinder', radius, height, x, y, z, rot
});
const torus = (radius, tube, x = 0, y = 0, z = 0, rot = null) => ({
    kind: 'torus', radius, tube, x, y, z, rot
});

const param = (options, key) => {
    const value = Number(options?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
    return DEFAULTS[key] ?? 1;
};

/** A sloping stringer runs from (0,0,0) up to (0,rise,run). */
function slopedBoard(width, thickness, length, rise) {
    const pitch = Math.atan2(rise, length);
    const trueLength = Math.hypot(length, rise);
    return box(width, thickness, trueLength, 0, rise / 2, 0, { x: -pitch, y: 0, z: 0 });
}

export const PART_LIBRARY = [
    // --- Framing ------------------------------------------------------
    {
        key: 'stringer-2x12',
        label: 'Cut stringer, 2x12',
        category: 'Framing',
        material: 'Pressure-treated 2x12',
        code: 'IRC R311.7 / R317.3',
        summary: 'Sawn stringer carrying the treads; 2x12 is the minimum for a 7½ in riser at 10 ft of run.',
        defaults: { run: 10 * FT, rise: 1.19, width: 36 * IN },
        size: (o) => ({ length: Math.hypot(param(o, 'run'), Number(o?.rise) || 1.19), width: 1.5 * IN, height: 11.25 * IN }),
        pieces: (o) => {
            const run = param(o, 'run');
            const rise = Number(o?.rise) || 1.19;
            const board = slopedBoard(LUMBER['2x12'].thickness, LUMBER['2x12'].width, run, rise);
            return [board, box(LUMBER['2x12'].thickness, 0.09, 0.06, 0, 0.045, -run / 2 + 0.05)];
        }
    },
    {
        key: 'stringer-steel-channel',
        label: 'Steel channel stringer',
        category: 'Framing',
        material: 'Galvanised C-channel 250PFC',
        code: 'IBC 1011.7 / AISC',
        summary: 'Fabricated steel stringer for exterior egress and apartment stairs.',
        defaults: { run: 10 * FT, rise: 2.1 },
        size: (o) => ({ length: Math.hypot(param(o, 'run'), Number(o?.rise) || 2.1), width: 0.075, height: 0.25 }),
        pieces: (o) => {
            const run = param(o, 'run');
            const rise = Number(o?.rise) || 2.1;
            const pitch = Math.atan2(rise, run);
            const length = Math.hypot(run, rise);
            return [box(0.075, 0.25, length, 0, rise / 2, 0, { x: -pitch, y: 0, z: 0 })];
        }
    },
    {
        key: 'stringer-bracket',
        label: 'Stringer hanger bracket',
        category: 'Framing',
        material: '18 ga galvanised steel',
        code: 'IRC R317.3',
        summary: 'Simpson-style hanger tying a stringer to the header or rim.',
        size: () => ({ length: 0.14, width: 0.09, height: 0.16 }),
        pieces: () => [
            box(0.09, 0.16, 0.0025, 0, 0.08, 0),
            box(0.09, 0.0025, 0.14, 0, 0.16, 0.07),
            box(0.0025, 0.13, 0.09, 0.046, 0.085, 0.045),
            box(0.0025, 0.13, 0.09, -0.046, 0.085, 0.045)
        ]
    },
    {
        key: 'joist-hanger',
        label: 'Joist hanger',
        category: 'Framing',
        material: 'Galvanised steel',
        code: 'IRC R502.5',
        summary: 'Header hanger for the landing joists.',
        size: () => ({ length: 0.08, width: 0.05, height: 0.2 }),
        pieces: () => [
            box(0.05, 0.2, 0.0025, 0, 0.1, 0),
            box(0.0025, 0.2, 0.08, 0.025, 0.1, 0.04),
            box(0.0025, 0.2, 0.08, -0.025, 0.1, 0.04)
        ]
    },
    {
        key: 'ledger-board',
        label: 'Ledger board, 2x10',
        category: 'Framing',
        material: 'Pressure-treated 2x10',
        code: 'IRC R507.9',
        summary: 'Ledger bolted to the house with flashing; carries the deck stringers.',
        defaults: { width: 36 * IN },
        size: (o) => ({ length: param(o, 'width'), width: 1.5 * IN, height: 9.25 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            return [
                box(width, LUMBER['2x10'].width, LUMBER['2x10'].thickness, 0, LUMBER['2x10'].width / 2, 0),
                cyl(0.008, 0.08, -width / 3, LUMBER['2x10'].width / 2, 0, { x: Math.PI / 2, y: 0, z: 0 }),
                cyl(0.008, 0.08, width / 3, LUMBER['2x10'].width / 2, 0, { x: Math.PI / 2, y: 0, z: 0 })
            ];
        }
    },

    // --- Treads and risers -------------------------------------------
    {
        key: 'tread-deck',
        label: 'Deck tread, two 5/4x6 boards',
        category: 'Treads',
        material: 'Pressure-treated 5/4x6 decking',
        code: 'IRC R311.7.5',
        summary: 'Two deck boards per tread give 11 in of depth, with a 1/8 in gap for drainage.',
        defaults: { width: 36 * IN },
        size: (o) => ({ length: param(o, 'width'), width: 11 * IN, height: 1 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            const board = LUMBER['5/4x6'];
            return [
                box(width, board.thickness, board.width, 0, board.thickness / 2, -board.width / 2 - 0.0016),
                box(width, board.thickness, board.width, 0, board.thickness / 2, board.width / 2 + 0.0016)
            ];
        }
    },
    {
        key: 'tread-2x10',
        label: 'Tread, 2x10',
        category: 'Treads',
        material: 'Southern yellow pine 2x10',
        code: 'IRC R311.7.5',
        summary: 'Solid interior tread, 9¼ in plus a ¾ in nosing gives the 10 in minimum.',
        defaults: { width: 36 * IN, tread: 9.25 * IN },
        size: (o) => ({ length: param(o, 'width'), width: param(o, 'tread'), height: 1.5 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            return [box(width, LUMBER['2x10'].thickness, LUMBER['2x10'].width, 0, LUMBER['2x10'].thickness / 2, 0)];
        }
    },
    {
        key: 'tread-concrete',
        label: 'Precast concrete tread',
        category: 'Treads',
        material: '4000 psi precast concrete',
        code: 'IBC 1011.5 / ACI 318',
        summary: 'Cast step with an integral nosing and a broom finish for exterior slip resistance.',
        defaults: { width: 48 * IN },
        size: (o) => ({ length: param(o, 'width'), width: 12 * IN, height: 7 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            return [
                box(width, 0.178, 0.305, 0, 0.089, 0),
                box(width, 0.012, 0.05, 0, 0.184, -0.145),
                box(width, 0.05, 0.03, 0, 0.155, -0.165)
            ];
        }
    },
    {
        key: 'nosing',
        label: 'Tread nosing',
        category: 'Treads',
        material: 'Aluminium safety nosing with abrasive insert',
        code: 'IRC R311.7.5.2 / IBC 1011.5.5',
        summary: '¾–1¼ in projection with a non-slip insert; not required where treads are 11 in.',
        defaults: { width: 36 * IN },
        size: (o) => ({ length: param(o, 'width'), width: 0.04, height: 0.02 }),
        pieces: (o) => {
            const width = param(o, 'width');
            return [
                box(width, 0.02, 0.04, 0, 0.01, 0),
                box(width, 0.004, 0.03, 0, 0.022, 0)
            ];
        }
    },
    {
        key: 'riser-1x8',
        label: 'Riser, 1x8',
        category: 'Treads',
        material: 'Primed pine or composite 1x8',
        code: 'IRC R311.7.5.1',
        summary: 'Closes the riser; open risers must reject a 4 in sphere.',
        defaults: { width: 36 * IN, riser: 7.5 * IN },
        size: (o) => ({ length: param(o, 'width'), width: 0.75 * IN, height: param(o, 'riser') }),
        pieces: (o) => {
            const width = param(o, 'width');
            const height = param(o, 'riser');
            return [box(width, height, 0.75 * IN, 0, height / 2, 0)];
        }
    },
    {
        key: 'toe-board',
        label: 'Open-riser toe board',
        category: 'Treads',
        material: '2x2 pressure-treated',
        code: 'IRC R311.7.5.1',
        summary: 'Narrower than 4 in so the open-riser sphere test still fails through the gap it leaves.',
        defaults: { width: 36 * IN },
        size: (o) => ({ length: param(o, 'width'), width: 1.5 * IN, height: 1.5 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            return [box(width, LUMBER['2x2'].width, LUMBER['2x2'].thickness, 0, 0.019, 0)];
        }
    },

    // --- Landings -----------------------------------------------------
    {
        key: 'landing-frame',
        label: 'Landing frame, 2x8',
        category: 'Landings',
        material: 'Pressure-treated 2x8',
        code: 'IRC R502 / IBC 1011.6',
        summary: 'Two rim joists and intermediate joists at 16 in on centre under the landing deck.',
        defaults: { width: 48 * IN, landing: 48 * IN },
        size: (o) => ({ length: param(o, 'width'), width: param(o, 'landing'), height: 7.25 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            const depth = param(o, 'landing');
            const joist = LUMBER['2x8'];
            const pieces = [
                box(width, joist.width, joist.thickness, 0, joist.width / 2, -depth / 2 + joist.thickness / 2),
                box(width, joist.width, joist.thickness, 0, joist.width / 2, depth / 2 - joist.thickness / 2)
            ];
            const count = Math.max(2, Math.round(width / (16 * IN)));
            for (let i = 1; i < count; i++) {
                const x = -width / 2 + (i / count) * width;
                pieces.push(box(joist.thickness, joist.width, depth, x, joist.width / 2, 0));
            }
            return pieces;
        }
    },
    {
        key: 'landing-deck',
        label: 'Landing decking',
        category: 'Landings',
        material: '5/4x6 decking',
        code: 'IRC R311.7.6',
        summary: 'Deck boards run perpendicular to the joists with a 1/8 in drainage gap.',
        defaults: { width: 48 * IN, landing: 48 * IN },
        size: (o) => ({ length: param(o, 'width'), width: param(o, 'landing'), height: 1 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            const depth = param(o, 'landing');
            const board = LUMBER['5/4x6'];
            const gap = 0.0032;
            const pitch = board.width + gap;
            const count = Math.max(1, Math.floor(depth / pitch));
            return Array.from({ length: count }, (_, i) =>
                box(width, board.thickness, board.width, 0, board.thickness / 2, -depth / 2 + board.width / 2 + i * pitch));
        }
    },
    {
        key: 'landing-concrete',
        label: 'Concrete landing slab',
        category: 'Landings',
        material: '4000 psi concrete, #4 rebar each way',
        code: 'IBC 1011.6 / ACI 318',
        summary: '4 in slab on a compacted base, sloped 1/4 in per foot to drain away from the building.',
        defaults: { width: 60 * IN, landing: 60 * IN },
        size: (o) => ({ length: param(o, 'width'), width: param(o, 'landing'), height: 4 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            const depth = param(o, 'landing');
            return [
                box(width, 4 * IN, depth, 0, 2 * IN, 0),
                cyl(0.00635, width * 0.92, 0, 2 * IN, -depth / 4, { x: 0, y: 0, z: Math.PI / 2 }),
                cyl(0.00635, width * 0.92, 0, 2 * IN, depth / 4, { x: 0, y: 0, z: Math.PI / 2 }),
                cyl(0.00635, depth * 0.92, -width / 4, 2 * IN, 0, { x: Math.PI / 2, y: 0, z: 0 }),
                cyl(0.00635, depth * 0.92, width / 4, 2 * IN, 0, { x: Math.PI / 2, y: 0, z: 0 })
            ];
        }
    },

    // --- Posts and footings -------------------------------------------
    {
        key: 'post-4x4',
        label: 'Guard post, 4x4',
        category: 'Posts',
        material: 'Pressure-treated 4x4, UC4A ground contact',
        code: 'IRC R312.1.3',
        summary: 'Notched guard post; the code load case is 200 lb applied 36 in above the floor.',
        defaults: { height: 42 * IN },
        size: (o) => ({ length: 3.5 * IN, width: 3.5 * IN, height: param(o, 'height') }),
        pieces: (o) => {
            const height = param(o, 'height');
            return [box(LUMBER['4x4'].thickness, height, LUMBER['4x4'].width, 0, height / 2, 0)];
        }
    },
    {
        key: 'post-6x6',
        label: 'Structural post, 6x6',
        category: 'Posts',
        material: 'Pressure-treated 6x6, UC4B',
        code: 'IRC R407 / NDS',
        summary: 'Built-up pier post for elevated decks and apartment landings.',
        defaults: { height: 8 * FT },
        size: (o) => ({ length: 5.5 * IN, width: 5.5 * IN, height: param(o, 'height') }),
        pieces: (o) => {
            const height = param(o, 'height');
            return [box(LUMBER['6x6'].thickness, height, LUMBER['6x6'].width, 0, height / 2, 0)];
        }
    },
    {
        key: 'pier-footing',
        label: 'Concrete pier footing',
        category: 'Posts',
        material: '3000 psi concrete in a 12 in form tube',
        code: 'IRC R403.1.4 — below the frost line',
        summary: '12 in diameter pier; 42 in deep in most of the northern US, deeper where frost goes lower.',
        defaults: { depth: 42 * IN },
        size: (o) => ({ length: 12 * IN, width: 12 * IN, height: param(o, 'depth') }),
        pieces: (o) => {
            const depth = param(o, 'depth');
            return [
                cyl(0.1524, depth, 0, depth / 2, 0),
                box(16 * IN, 8 * IN, 16 * IN, 0, 4 * IN, 0),
                cyl(0.011, depth * 0.9, 0, depth * 0.45, 0)
            ];
        }
    },
    {
        key: 'post-anchor',
        label: 'Post base anchor',
        category: 'Posts',
        material: 'Galvanised steel, 5/8 in anchors',
        code: 'IRC R317.3',
        summary: 'Stand-off base keeps the post end out of the concrete and the water.',
        size: () => ({ length: 0.14, width: 0.14, height: 0.15 }),
        pieces: () => [
            box(0.14, 0.006, 0.14, 0, 0.003, 0),
            box(0.11, 0.14, 0.003, 0, 0.07, -0.05),
            box(0.11, 0.14, 0.003, 0, 0.07, 0.05),
            box(0.003, 0.14, 0.11, -0.05, 0.07, 0),
            box(0.003, 0.14, 0.11, 0.05, 0.07, 0),
            cyl(0.008, 0.1, 0.045, 0.05, 0.045),
            cyl(0.008, 0.1, -0.045, 0.05, 0.045)
        ]
    },

    // --- Rails and guards ---------------------------------------------
    {
        key: 'handrail-round',
        label: 'Round handrail, 1½ in',
        category: 'Rails',
        material: 'Aluminium or hardwood, 1½ in diameter',
        code: 'IRC R311.7.8 / IBC 1012.3 — graspable, 34–38 in',
        summary: 'Graspable profile with a 1½ in clearance from the wall and returns at both ends.',
        defaults: { run: 10 * FT, rail: 36 * IN },
        size: (o) => ({ length: param(o, 'run'), width: 0.038, height: 0.038 }),
        pieces: (o) => {
            const run = param(o, 'run');
            const rail = param(o, 'rail');
            return [
                cyl(0.019, run, 0, rail, 0, { x: Math.PI / 2, y: 0, z: 0 }),
                cyl(0.019, 0.08, 0, rail - 0.04, -run / 2, null),
                cyl(0.019, 0.08, 0, rail - 0.04, run / 2, null),
                cyl(0.016, 0.09, 0, rail - 0.07, -run / 3),
                cyl(0.016, 0.09, 0, rail - 0.07, run / 3)
            ];
        }
    },
    {
        key: 'handrail-wall',
        label: 'Wall-mounted handrail',
        category: 'Rails',
        material: '1½ in round rail with return brackets',
        code: 'IBC 1012.4 / IRC R311.7.9',
        summary: 'Continuous rail on the wall side with 1½ in stand-off brackets at 48 in on centre.',
        defaults: { run: 8 * FT, rail: 36 * IN },
        size: (o) => ({ length: param(o, 'run'), width: 0.038, height: 0.038 }),
        pieces: (o) => {
            const run = param(o, 'run');
            const rail = param(o, 'rail');
            const pieces = [cyl(0.019, run, 0, rail, 0, { x: Math.PI / 2, y: 0, z: 0 })];
            const brackets = Math.max(2, Math.round(run / (48 * IN)) + 1);
            for (let i = 0; i < brackets; i++) {
                const z = -run / 2 + (i / (brackets - 1)) * run;
                pieces.push(box(0.038, 0.038, 0.006, 0, rail, z));
                pieces.push(box(0.006, 0.006, 0.05, 0, rail - 0.03, z));
            }
            return pieces;
        }
    },
    {
        key: 'guard-top-2x4',
        label: 'Guard top rail, 2x4',
        category: 'Rails',
        material: 'Pressure-treated 2x4',
        code: 'IRC R312.1 / IBC 1015.2 — 36 in residential, 42 in commercial',
        summary: 'Top rail at the guard height; the whole assembly takes a 200 lb concentrated load.',
        defaults: { run: 6 * FT, guard: 42 * IN },
        size: (o) => ({ length: param(o, 'run'), width: 1.5 * IN, height: 3.5 * IN }),
        pieces: (o) => {
            const run = param(o, 'run');
            const guard = param(o, 'guard');
            return [box(run, LUMBER['2x4'].width, LUMBER['2x4'].thickness, 0, guard, 0)];
        }
    },
    {
        key: 'guard-bottom-2x4',
        label: 'Guard bottom rail, 2x4',
        category: 'Rails',
        material: 'Pressure-treated 2x4',
        code: 'IRC R312.1.2 — 4 in sphere',
        summary: 'Bottom rail set so no gap admits a 4 in sphere.',
        defaults: { run: 6 * FT },
        size: (o) => ({ length: param(o, 'run'), width: 1.5 * IN, height: 3.5 * IN }),
        pieces: (o) => {
            const run = param(o, 'run');
            return [box(run, LUMBER['2x4'].width, LUMBER['2x4'].thickness, 0, 0.09, 0)];
        }
    },
    {
        key: 'baluster-2x2',
        label: 'Baluster, 2x2',
        category: 'Rails',
        material: 'Pressure-treated 2x2',
        code: 'IRC R312.1.2 — 4 in max clear',
        summary: 'Spaced at 3½ in clear so the 4 in sphere cannot pass.',
        defaults: { height: 36 * IN },
        size: (o) => ({ length: 1.5 * IN, width: 1.5 * IN, height: param(o, 'height') }),
        pieces: (o) => {
            const height = param(o, 'height');
            return [box(LUMBER['2x2'].thickness, height, LUMBER['2x2'].width, 0, height / 2, 0)];
        }
    },
    {
        key: 'glass-panel',
        label: 'Tempered glass infill',
        category: 'Rails',
        material: '3/8 in tempered laminated glass',
        code: 'IBC 2407 / ASTM E2353',
        summary: 'Frameless panel in a shoe rail; must resist the 200 lb guard load.',
        defaults: { width: 4 * FT, height: 36 * IN },
        size: (o) => ({ length: param(o, 'width'), width: 0.01, height: param(o, 'height') }),
        pieces: (o) => {
            const width = param(o, 'width');
            const height = param(o, 'height');
            return [
                box(width, height, 0.01, 0, height / 2, 0),
                box(width + 0.04, 0.05, 0.06, 0, 0.025, 0)
            ];
        }
    },
    {
        key: 'cable-rail',
        label: 'Cable infill',
        category: 'Rails',
        material: '3/16 in 316 stainless cable',
        code: 'IBC 1015.3 — 4 in sphere',
        summary: 'Horizontal cables at 3 in centres; the 4 in sphere test still governs the spacing.',
        defaults: { run: 6 * FT, guard: 42 * IN },
        size: (o) => ({ length: param(o, 'run'), width: 0.02, height: param(o, 'guard') }),
        pieces: (o) => {
            const run = param(o, 'run');
            const guard = param(o, 'guard');
            const pieces = [
                box(0.04, guard, 0.04, -run / 2, guard / 2, 0),
                box(0.04, guard, 0.04, run / 2, guard / 2, 0)
            ];
            const count = Math.floor(guard / (3 * IN));
            for (let i = 0; i <= count; i++) {
                pieces.push(cyl(0.0024, run, 0, 0.04 + i * (3 * IN), 0, { x: Math.PI / 2, y: 0, z: 0 }));
            }
            return pieces;
        }
    },
    {
        key: 'newel-4x4',
        label: 'Newel post, 4x4',
        category: 'Rails',
        material: 'Pressure-treated 4x4 with cap',
        code: 'IRC R311.7.7',
        summary: 'Heavy newel at the bottom and at landings; the rail is let into it.',
        defaults: { height: 42 * IN },
        size: (o) => ({ length: 3.5 * IN, width: 3.5 * IN, height: param(o, 'height') }),
        pieces: (o) => {
            const height = param(o, 'height');
            return [
                box(LUMBER['4x4'].thickness, height, LUMBER['4x4'].width, 0, height / 2, 0),
                box(0.13, 0.03, 0.13, 0, height + 0.015, 0)
            ];
        }
    },
    {
        key: 'handrail-bracket',
        label: 'Handrail bracket',
        category: 'Rails',
        material: 'Cast aluminium',
        code: 'IRC R311.7.8',
        summary: 'Stand-off bracket producing the 1½ in graspable clearance.',
        size: () => ({ length: 0.06, width: 0.03, height: 0.06 }),
        pieces: () => [
            box(0.06, 0.006, 0.03, 0, 0.003, 0),
            cyl(0.012, 0.03, 0.02, 0.02, 0),
            box(0.02, 0.04, 0.02, 0.045, 0.02, 0)
        ]
    },
    {
        key: 'stair-gate',
        label: 'Self-closing stair gate',
        category: 'Rails',
        material: 'Aluminium frame, self-closing hinge',
        code: 'IRC R311.7.11 / ISPSC 305.3',
        summary: 'Required at the top of stairs where a 4 in sphere can pass the guard; also a pool barrier gate.',
        defaults: { width: 36 * IN, guard: 42 * IN },
        size: (o) => ({ length: param(o, 'width'), width: 0.04, height: param(o, 'guard') }),
        pieces: (o) => {
            const width = param(o, 'width');
            const height = param(o, 'guard');
            const pieces = [
                box(width, 0.05, 0.04, 0, height, 0),
                box(width, 0.05, 0.04, 0, 0.05, 0),
                box(0.05, height, 0.04, -width / 2, height / 2, 0),
                box(0.05, height, 0.04, width / 2, height / 2, 0)
            ];
            const bars = Math.max(2, Math.round(width / 0.12));
            for (let i = 1; i < bars; i++) {
                pieces.push(box(0.014, height - 0.1, 0.02, -width / 2 + (i / bars) * width, height / 2, 0));
            }
            return pieces;
        }
    },

    // --- Concrete systems --------------------------------------------
    {
        key: 'concrete-flight',
        label: 'Cast-in-place concrete flight',
        category: 'Concrete',
        material: '4000 psi concrete on graded base',
        code: 'IBC 1011 / ACI 318 / ACI 301',
        summary: 'One-piece flight with #4 bars each way and a 2 in cover; slip-resistant finish.',
        defaults: { width: 48 * IN, rise: 2.1, run: 5.5 },
        size: (o) => ({ length: param(o, 'width'), width: param(o, 'run'), height: Number(o?.rise) || 2.1 }),
        pieces: (o) => {
            const width = param(o, 'width');
            const run = param(o, 'run');
            const rise = Number(o?.rise) || 2.1;
            const risers = Math.max(3, Math.ceil(rise / (7 * IN)));
            const riser = rise / risers;
            const tread = run / (risers - 1);
            const pieces = [box(width, 0.15, Math.hypot(run, rise), 0, rise / 2 - 0.09, 0, { x: -Math.atan2(rise, run), y: 0, z: 0 })];
            for (let i = 0; i < risers - 1; i++) {
                pieces.push(box(width, riser, tread, 0, (i + 1) * riser - riser / 2, -run / 2 + (i + 0.5) * tread));
            }
            return pieces;
        }
    },
    {
        key: 'concrete-step',
        label: 'Precast step unit',
        category: 'Concrete',
        material: 'Precast concrete step, 4 in walls',
        code: 'ASTM C936',
        summary: '48 x 12 x 7 in precast step, hollow or solid, bedded on a compacted base.',
        defaults: { width: 48 * IN },
        size: (o) => ({ length: param(o, 'width'), width: 12 * IN, height: 7 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            return [
                box(width, 0.178, 0.305, 0, 0.089, 0),
                box(width, 0.06, 0.06, 0, 0.03, -0.12),
                box(width, 0.06, 0.06, 0, 0.03, 0.12)
            ];
        }
    },
    {
        key: 'rebar',
        label: 'Rebar, #4',
        category: 'Concrete',
        material: 'Grade 60 deformed bar, ½ in',
        code: 'ACI 318',
        summary: '½ in bar at 12 in on centre each way in slabs and flights.',
        defaults: { run: 4 * FT },
        size: (o) => ({ length: param(o, 'run'), width: 0.0127, height: 0.0127 }),
        pieces: (o) => {
            const run = param(o, 'run');
            return [cyl(0.00635, run, 0, 0.00635, 0, { x: Math.PI / 2, y: 0, z: 0 })];
        }
    },
    {
        key: 'form-board',
        label: 'Form board',
        category: 'Concrete',
        material: '3/4 in plywood form',
        code: 'ACI 347',
        summary: 'Edge form for a cast flight or landing; stripped after 7 days.',
        defaults: { run: 4 * FT, height: 8 * IN },
        size: (o) => ({ length: param(o, 'run'), width: 0.019, height: param(o, 'height') }),
        pieces: (o) => {
            const run = param(o, 'run');
            const height = param(o, 'height');
            return [box(run, height, 0.019, 0, height / 2, 0)];
        }
    },
    {
        key: 'gravel-base',
        label: 'Compacted gravel base',
        category: 'Concrete',
        material: '3/4 in crushed stone, 4 in compacted',
        code: 'IBC 1804 / ACI 301',
        summary: '4 in of compacted base under slabs, landings and precast steps.',
        defaults: { width: 60 * IN, landing: 60 * IN },
        size: (o) => ({ length: param(o, 'width'), width: param(o, 'landing'), height: 4 * IN }),
        pieces: (o) => {
            const width = param(o, 'width');
            const depth = param(o, 'landing');
            return [box(width, 4 * IN, depth, 0, 2 * IN, 0)];
        }
    },

    // --- Spiral and fire pole ----------------------------------------
    {
        key: 'spiral-column',
        label: 'Spiral centre column',
        category: 'Spiral',
        material: '4 in schedule 40 steel pipe',
        code: 'IRC R311.7.10.1 / IBC 1011.10',
        summary: 'Centre column carrying the treads; clear width is measured from it to the outer edge.',
        defaults: { height: 2.7 },
        size: (o) => ({ length: 0.114, width: 0.114, height: Number(o?.height) || 2.7 }),
        pieces: (o) => {
            const height = Number(o?.height) || 2.7;
            return [
                cyl(0.057, height, 0, height / 2, 0),
                cyl(0.1, 0.02, 0, 0.01, 0),
                cyl(0.1, 0.02, 0, height - 0.01, 0)
            ];
        }
    },
    {
        key: 'spiral-tread',
        label: 'Spiral tread',
        category: 'Spiral',
        material: '3/16 in steel plate or 2 in hardwood',
        code: 'IRC R311.7.10.1 — 7½ in at 12 in walkline',
        summary: 'Wedge tread with a 26 in clear width and a 7½ in depth at the walkline.',
        defaults: { width: 26 * IN },
        size: (o) => ({ length: 26 * IN, width: 26 * IN, height: 0.048 }),
        pieces: (o) => {
            const radius = param(o, 'width') / 2;
            const shape = new THREE.Shape();
            shape.moveTo(0.05, 0);
            shape.absarc(0, 0, radius, -0.12, 0.62, false);
            shape.lineTo(0.05, 0);
            return [{ kind: 'shape', shape, depth: 0.048, x: 0, y: 0, z: 0 }];
        }
    },
    {
        key: 'pole-shaft',
        label: 'Fire pole shaft',
        category: 'Fire pole',
        material: '2½ in brass or stainless steel',
        code: 'NFPA 1500 / OSHA 1910.28 (not an egress stair)',
        summary: '2½ in pole with 36 in above the upper floor and a 32 in landing mat below.',
        defaults: { shaft: 7 * FT },
        size: (o) => ({ length: 0.064, width: 0.064, height: Number(o?.shaft) || 7 * FT }),
        pieces: (o) => {
            const height = Number(o?.shaft) || 7 * FT;
            return [
                cyl(0.0318, height, 0, height / 2, 0),
                cyl(0.045, 0.06, 0, height - 0.03, 0),
                box(0.06, 0.08, 0.06, 0, height + 0.04, 0)
            ];
        }
    },
    {
        key: 'pole-flange',
        label: 'Pole floor flange',
        category: 'Fire pole',
        material: 'Cast bronze flange with 4 anchors',
        code: 'Manufacturer listing',
        summary: 'Bolt-down flange at the lower floor; the pole is held plumb and free to flex.',
        size: () => ({ length: 0.3, width: 0.3, height: 0.02 }),
        pieces: () => [
            cyl(0.15, 0.02, 0, 0.01, 0),
            cyl(0.04, 0.05, 0, 0.03, 0),
            cyl(0.008, 0.04, 0.11, 0.02, 0.11),
            cyl(0.008, 0.04, -0.11, 0.02, 0.11),
            cyl(0.008, 0.04, 0.11, 0.02, -0.11),
            cyl(0.008, 0.04, -0.11, 0.02, -0.11)
        ]
    },
    {
        key: 'pole-guard',
        label: 'Pole opening guard',
        category: 'Fire pole',
        material: '42 in steel guard with self-closing gate',
        code: 'IRC R312 / OSHA 1910.29',
        summary: 'Guards the floor opening; a 42 in rail and gate in every jurisdiction.',
        defaults: { opening: 37.5 * IN, guard: 42 * IN },
        size: (o) => ({ length: param(o, 'opening'), width: param(o, 'opening'), height: param(o, 'guard') }),
        pieces: (o) => {
            const opening = param(o, 'opening');
            const guard = param(o, 'guard');
            const pieces = [];
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                pieces.push(box(0.025, guard, 0.025, Math.cos(a) * opening / 2, guard / 2, Math.sin(a) * opening / 2));
            }
            pieces.push(torus(opening / 2, 0.022, 0, guard, 0, { x: Math.PI / 2, y: 0, z: 0 }));
            pieces.push(torus(opening / 2, 0.02, 0, 0.05, 0, { x: Math.PI / 2, y: 0, z: 0 }));
            return pieces;
        }
    },
    {
        key: 'pole-mat',
        label: 'Pole landing mat',
        category: 'Fire pole',
        material: '32 in anti-skid rubber mat',
        code: 'Manufacturer recommendation',
        summary: 'Cushions the landing and marks the drop zone.',
        defaults: { mat: 32 * IN },
        size: (o) => ({ length: param(o, 'mat'), width: param(o, 'mat'), height: 0.012 }),
        pieces: (o) => {
            const mat = param(o, 'mat');
            return [cyl(mat / 2, 0.012, 0, 0.006, 0)];
        }
    }
];

const byKey = new Map(PART_LIBRARY.map((part) => [part.key, part]));

export function getPart(key) {
    return byKey.get(key) || null;
}

export function partsByCategory() {
    const groups = new Map();
    PART_LIBRARY.forEach((part) => {
        if (!groups.has(part.category)) groups.set(part.category, []);
        groups.get(part.category).push(part);
    });
    return [...groups.entries()].map(([category, parts]) => ({ category, parts }));
}

/** Nominal size of a part in metres, for the takeoff and the gallery caption. */
export function partSize(key, options = {}) {
    const part = getPart(key);
    if (!part) return null;
    const size = part.size(options) || {};
    return {
        length: Number(size.length) || 0,
        width: Number(size.width) || 0,
        height: Number(size.height) || 0
    };
}

function applyTransform(object, piece) {
    object.position.set(piece.x || 0, piece.y || 0, piece.z || 0);
    if (piece.rot) object.rotation.set(piece.rot.x || 0, piece.rot.y || 0, piece.rot.z || 0);
    return object;
}

function pieceGeometry(piece) {
    if (piece.kind === 'box') return new THREE.BoxGeometry(piece.w, piece.h, piece.d);
    if (piece.kind === 'cylinder') return new THREE.CylinderGeometry(piece.radius, piece.radius, piece.height, 20);
    if (piece.kind === 'torus') return new THREE.TorusGeometry(piece.radius, piece.tube, 8, 28);
    if (piece.kind === 'shape') {
        return new THREE.ExtrudeGeometry(piece.shape, { depth: piece.depth, bevelEnabled: false, curveSegments: 16 });
    }
    return null;
}

/**
 * Build a part as solid meshes, sized from its nominal dimensions.
 * The part sits on y = 0 and is centred on x/z unless its pieces say otherwise.
 */
export function buildPart(THREE_NS, key, options = {}) {
    const part = getPart(key);
    if (!part) return null;
    const NS = THREE_NS || THREE;
    const material = new NS.MeshStandardMaterial({
        color: options.color ?? 0x94a3b8,
        roughness: 0.7,
        metalness: 0.1
    });
    const group = new NS.Group();
    group.name = `part-${key}`;
    (part.pieces(options) || []).forEach((piece) => {
        const geometry = pieceGeometry(piece);
        if (!geometry) return;
        const mesh = new NS.Mesh(geometry, material);
        applyTransform(mesh, piece);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    });
    group.userData = {
        part: key,
        label: part.label,
        category: part.category,
        material: part.material,
        code: part.code,
        size: partSize(key, options)
    };
    return group;
}

/** The same part as line edges — the gallery and the 3D previews use this. */
export function buildPartWireframe(THREE_NS, key, options = {}) {
    const solid = buildPart(THREE_NS, key, options);
    if (!solid) return null;
    const wire = toWireframe(solid, {
        color: options.color ?? 0x1e293b,
        thresholdAngle: options.thresholdAngle ?? 20,
        opacity: options.opacity ?? 1
    });
    solid.traverse?.((child) => {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
    });
    wire.userData = { ...wire.userData, ...solid.userData, wireframe: true };
    return wire;
}

/** Bill of materials for one or more part calls. */
export function takeoff(lines = []) {
    return lines.map(({ key, qty = 1, options = {}, note = '' }) => {
        const part = getPart(key);
        return {
            key,
            label: part?.label || key,
            material: part?.material || '',
            qty,
            size: partSize(key, options),
            note
        };
    });
}
