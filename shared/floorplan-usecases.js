/**
 * Floorplan use cases: one registry for every plan type in the drawing set.
 *
 * The Southern Farmhouse ships as a SketchUp set — Site, Farmhouse,
 * Interiors, RCPs (reflected ceiling plans), Sections, Site context and an
 * Extended Design folder. The `.skp` files are authoring sources, not web
 * data, so each use case below names its source file, the web page that owns
 * the live equivalent, the localStorage keys proving it exists, the layers it
 * draws, and the logical action that moves it forward. The plan-studio hub
 * renders cards, pass/fail checks and live canvas visuals from this file, so
 * adding a use case here adds it everywhere with no other edits.
 *
 * Everything exported here is UI-framework-free and DOM-free except
 * `collectUseCaseInputs` / `useCaseStatus`, which read localStorage. The
 * check + summarize functions are pure (data in, results out) so they can
 * run headless in node against the demo JSON.
 */

export const FLOORPLAN_USE_CASES = [
    {
        id: 'site', step: 'A', label: 'Site', skp: 'Site.skp',
        page: 'site-plan.html', keys: ['site-plan-draft'],
        blurb: 'Lot, setbacks, coverage and driveway — the house placed inside the law.',
        action: 'Drag the house inside the buildable area until setbacks + coverage pass.',
        layers: ['lot', 'setbacks', 'coverage', 'driveway', 'north arrow']
    },
    {
        id: 'farmhouse', step: 'B', label: 'Farmhouse plan', skp: 'Farmhouse.skp',
        page: 'Editor.html', keys: ['floorplan3d_autosave'],
        blurb: 'Walls, openings, rooms and fixtures — the single source every plan stacks on.',
        action: 'Draw walls, cut openings, place fixtures; every suite reads this plan.',
        layers: ['walls', 'openings', 'rooms', 'fixtures']
    },
    {
        id: 'interiors', step: 'C', label: 'Interiors', skp: 'Interiors.skp',
        page: 'kitchen-designer.html', keys: ['kitchen-editor-draft', 'wall-suite-draft', 'wall-editor-draft'],
        also: ['wall-designer.html', 'lighting-designer.html', 'Editor.html'],
        blurb: 'Fit-out per room — cabinetry runs, finishes, furniture and clearances.',
        action: 'Finish a kitchen run, paint the walls, then furnish rooms in the Editor.',
        layers: ['cabinetry', 'finishes', 'furniture', 'clearances']
    },
    {
        id: 'rcp', step: 'D', label: 'Reflected ceiling', skp: 'RCPs.skp',
        page: 'lighting-designer.html', keys: ['lighting-suite-plan'],
        blurb: 'Ceiling grid, luminaires, switches and circuits seen from above.',
        action: 'Auto-place lights per room, then check switching + circuits.',
        layers: ['ceiling grid', 'luminaires', 'switches', 'circuits']
    },
    {
        id: 'sections', step: 'E', label: 'Sections', skp: 'Sections.skp',
        page: 'Editor.html', keys: ['floorplan3d_autosave', 'roof-suite-draft', 'roof-editor-draft'],
        blurb: 'Cross-section through wall heights and roof — headroom made visible.',
        action: 'Confirm storey heights, then design the roof that closes the section.',
        layers: ['ground line', 'wall heights', 'floor depth', 'roof mass']
    },
    {
        id: 'extended', step: 'F', label: 'Extended design', skp: 'Extended Design/',
        page: 'landscape-designer.html', keys: ['landscape-suite-plan', 'landscape-editor-draft', 'deck-suite-draft', 'deck-editor-draft'],
        also: ['deck-designer.html'],
        blurb: 'Beyond the walls — porch, deck, planting and water within the site.',
        action: 'Place the deck and landscape, then clash-check against the house.',
        layers: ['deck', 'planting', 'water', 'setbacks']
    }
];

function hasAnyKey(keys) {
    try {
        return (keys || []).some((k) => {
            const v = localStorage.getItem(k) || localStorage.getItem(`floorplan3d_${k}`);
            return v != null && String(v).length > 2;
        });
    } catch {
        return false;
    }
}

function readJsonKey(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/** Started/not-started per use case, for status dots. */
export function useCaseStatus() {
    return FLOORPLAN_USE_CASES.map((u) => ({ ...u, started: hasAnyKey(u.keys) }));
}

/** Gather every input the checks need. Browser-only (localStorage). */
export function collectUseCaseInputs() {
    const autosave = readJsonKey('floorplan3d_autosave') || readJsonKey('floorplan3d_floorplan3d_autosave');
    const site = readJsonKey('site-plan-draft');
    const lighting = readJsonKey('lighting-suite-plan');
    const kitchen = readJsonKey('kitchen-editor-draft');
    const wall = readJsonKey('wall-suite-draft') || readJsonKey('wall-editor-draft');
    const roof = readJsonKey('roof-suite-draft') || readJsonKey('roof-editor-draft');
    const landscape = readJsonKey('landscape-suite-plan') || readJsonKey('landscape-editor-draft');
    const deck = readJsonKey('deck-suite-draft') || readJsonKey('deck-editor-draft');
    return { autosave, site, lighting, kitchen, wall, roof, landscape, deck };
}

const PX_PER_M = 30;

function wallPoints(walls) {
    const pts = [];
    (walls || []).forEach((w) => {
        const a = w.start || { x: w.x1 ?? 0, y: w.z1 ?? w.y1 ?? 0 };
        const b = w.end || { x: w.x2 ?? 0, y: w.z2 ?? w.y2 ?? 0 };
        pts.push(a, b);
    });
    return pts;
}

/**
 * Pure summary of an Editor autosave for the section + interiors visuals.
 * Walls are canvas pixels at 30 px/m; heights are storey metres.
 */
export function summarizeAutosave(autosave) {
    const story = autosave?.stories?.[0] || {};
    const walls = Array.isArray(autosave?.walls) && autosave.walls.length
        ? autosave.walls
        : (Array.isArray(story.walls) ? story.walls : []);
    const fixtures = Array.isArray(autosave?.fixtures) && autosave.fixtures.length
        ? autosave.fixtures
        : (Array.isArray(story.fixtures) ? story.fixtures : []);
    if (!walls.length) return null;
    const pts = wallPoints(walls);
    const xs = pts.map((p) => Number(p.x) || 0);
    const ys = pts.map((p) => Number(p.y) || 0);
    const widthM = (Math.max(...xs) - Math.min(...xs)) / PX_PER_M;
    const depthM = (Math.max(...ys) - Math.min(...ys)) / PX_PER_M;
    const wallHeight = Number(story.wallHeight) || 2.7;
    const floorDepth = Number(story.floorDepth) || 0.25;
    const heights = walls.map((w) => (typeof w.height === 'number' ? w.height : null));
    const explicit = heights.filter((h) => h !== null);
    const roofConfig = (autosave && typeof autosave.roofConfig === 'object' && autosave.roofConfig) || {};
    return { walls, fixtures, widthM, depthM, wallHeight, floorDepth, explicitHeights: explicit, roofConfig };
}

/** Pure reader for a lighting-suite-plan draft for the RCP visual. */
export function summarizeLighting(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const width = Math.min(Math.max(Number(raw.width) || 0, 0), 60);
    const depth = Math.min(Math.max(Number(raw.depth) || 0, 0), 60);
    if (!(width > 0 && depth > 0)) return null;
    const devices = Array.isArray(raw.devices) ? raw.devices : [];
    const clampTo = (v, max) => Math.min(Math.max(Number(v) || 0, 0), max);
    return {
        width, depth,
        height: Math.min(Math.max(Number(raw.height) || 2.7, 2.2), 6),
        mountingHeight: Number(raw.mountingHeight) || 2.4,
        roomType: raw.roomType || 'living',
        luminaires: devices.filter((d) => d.kind === 'luminaire').map((d) => ({ x: clampTo(d.x, width), y: clampTo(d.y, depth), label: d.label || d.typeId || 'light' })),
        switches: devices.filter((d) => d.kind === 'switch').map((d) => ({ x: clampTo(d.x, width), y: clampTo(d.y, depth) })),
        circuits: Array.isArray(raw.circuits) ? raw.circuits.length : 0
    };
}

const ok = (label, detail = '') => ({ label, status: 'pass', detail });
const warn = (label, detail = '') => ({ label, status: 'warn', detail });
const todo = (label, detail = '') => ({ label, status: 'todo', detail });

/**
 * Pure logic checks per use case. `ctx` is `collectUseCaseInputs()` (or a
 * test double with the same shape). Returns [{ label, status, detail }].
 */
export function checkUseCase(id, ctx = {}) {
    const { autosave, site, lighting, kitchen, wall, roof, landscape, deck } = ctx;
    const summary = summarizeAutosave(autosave);
    const rcp = summarizeLighting(lighting);
    switch (id) {
        case 'site': {
            if (!site) return [todo('No site plan yet', 'Open the Site plan and place the house.')];
            const lotA = (Number(site.lotW) || 0) * (Number(site.lotD) || 0);
            const houseA = (Number(site.houseW) || 0) * (Number(site.houseD) || 0);
            const cov = lotA ? (houseA / lotA) * 100 : 0;
            const inX = (site.houseX ?? 0) >= (site.side ?? 0) && (site.houseX + site.houseW) <= (site.lotW - site.side);
            const inY = (site.houseY ?? 0) >= (site.front ?? 0) && (site.houseY + site.houseD) <= (site.lotD - site.rear);
            return [
                (inX && inY) ? ok('Setbacks', 'House sits inside the buildable area.') : warn('Setbacks', 'House crosses a setback line — drag it inside.'),
                cov <= (site.maxcov ?? 40) ? ok('Coverage', `${cov.toFixed(1)}% of ${(site.maxcov ?? 40)}% allowed.`) : warn('Coverage', `${cov.toFixed(1)}% exceeds ${(site.maxcov ?? 40)}% allowed.`)
            ];
        }
        case 'farmhouse': {
            if (!summary) return [todo('No floorplan yet', 'Draw walls in the Editor.')];
            const types = new Set(summary.fixtures.map((f) => f.type));
            return [
                ok('Shell', `${summary.walls.length} walls · ${summary.widthM.toFixed(1)} × ${summary.depthM.toFixed(1)} m.`),
                types.has('door') ? ok('Openings', 'Doors placed; add windows per room.') : warn('Openings', 'No doors placed yet.'),
                summary.fixtures.length >= 10 ? ok('Furnished', `${summary.fixtures.length} fixtures placed.`) : warn('Sparse', `Only ${summary.fixtures.length} fixtures — furnish each room.`)
            ];
        }
        case 'interiors': {
            const checks = [];
            checks.push(kitchen ? ok('Kitchen run', 'Cabinetry run dimensioned in the suite.') : todo('Kitchen run', 'Lay out the cabinetry run.'));
            checks.push(wall ? ok('Finishes', 'Wall coverings chosen.') : todo('Finishes', 'Pick paint / tile / panel finishes.'));
            const furn = (summary?.fixtures || []).length;
            checks.push(furn >= 10 ? ok('Furniture', `${furn} pieces placed.`) : warn('Furniture', `${furn} pieces — furnish bedrooms + living.`));
            return checks;
        }
        case 'rcp': {
            if (!rcp) return [todo('No ceiling plan yet', 'Auto-place lights in the Lighting suite.')];
            return [
                ok('Grid', `${rcp.width.toFixed(1)} × ${rcp.depth.toFixed(1)} m · ${rcp.height.toFixed(2)} m ceiling.`),
                rcp.luminaires.length ? ok('Luminaires', `${rcp.luminaires.length} fittings at ${rcp.mountingHeight.toFixed(2)} m.`) : warn('Luminaires', 'No fittings placed.'),
                rcp.switches.length ? ok('Switching', `${rcp.switches.length} switch(es), ${rcp.circuits} circuit(s).`) : warn('Switching', 'No switches placed.')
            ];
        }
        case 'sections': {
            if (!summary) return [todo('No section yet', 'A plan is needed before it can be cut.')];
            const checks = [ok('Cut', `Section through ${summary.widthM.toFixed(1)} m span · ${summary.wallHeight.toFixed(2)} m walls.`)];
            checks.push(summary.explicitHeights.length && summary.explicitHeights.some((h) => Math.abs(h - summary.wallHeight) > 0.01)
                ? warn('Heights', 'Per-wall heights differ from the storey height — confirm split levels.')
                : ok('Heights', 'Wall heights consistent with the storey.'));
            checks.push(roof ? ok('Roof', 'Roof designed — section closes at the ridge.') : todo('Roof', 'Design the roof to close the section.'));
            return checks;
        }
        case 'extended': {
            const checks = [];
            checks.push(deck ? ok('Deck', 'Deck frame sized.') : todo('Deck', 'Size the deck frame + footings.'));
            checks.push(landscape ? ok('Landscape', 'Planting / water placed.') : todo('Landscape', 'Place planting, then clash-check the house.'));
            return checks;
        }
        default:
            return [];
    }
}
