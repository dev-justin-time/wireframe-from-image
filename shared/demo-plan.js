/**
 * Shared default-plan loader: the Southern Farmhouse demo is the plan every
 * page starts from. The Editor autosave (`floorplan3d_autosave`) is the single
 * source of truth, so seeding it once makes the demo visible in the Editor,
 * the demo page, and every suite that reads the main floorplan.
 */

export const DEMO_PLAN_URL = '../assets/southern-farmhouse-plan.json';
export const AUTOSAVE_KEY = 'floorplan3d_autosave';

export async function fetchDemoPlan(url = DEMO_PLAN_URL) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`demo plan fetch failed: ${res.status}`);
    return res.json();
}

export function readAutosave() {
    try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function hasUsablePlan(data = readAutosave()) {
    const walls = data?.walls || data?.stories?.[0]?.walls || [];
    return Array.isArray(walls) && walls.length > 0;
}

export function writeAutosave(plan) {
    try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(plan));
        return true;
    } catch {
        return false;
    }
}

/** Seed the autosave with the farmhouse demo when nothing usable is stored. */
export async function ensureSeededAutosave(url = DEMO_PLAN_URL) {
    if (hasUsablePlan()) return { seeded: false };
    const plan = await fetchDemoPlan(url);
    if (!writeAutosave(plan)) throw new Error('demo plan could not be saved (storage blocked)');
    return { seeded: true, plan };
}

/** Force-load the farmhouse demo, replacing whatever plan is stored. */
export async function loadDemoPlan(url = DEMO_PLAN_URL) {
    const plan = await fetchDemoPlan(url);
    if (!writeAutosave(plan)) throw new Error('demo plan could not be saved (storage blocked)');
    return plan;
}

/** Start blank: an empty versioned project that the Editor restores cleanly. */
export function createNewPlan() {
    const blank = {
        name: 'Untitled plan',
        version: 2,
        gridSize: 30,
        showCeiling: false,
        showRoof: false,
        currentStoryIndex: 0,
        fixtureStyles: {},
        roomMaterials: {},
        roofConfig: {},
        walls: [],
        fixtures: [],
        stories: [
            {
                id: 'storey_ground',
                name: 'Ground floor',
                wallHeight: 2.7,
                floorDepth: 0.25,
                height: 1.5,
                visible: true,
                walls: [],
                fixtures: [],
                openings: []
            }
        ]
    };
    if (!writeAutosave(blank)) throw new Error('new plan could not be saved (storage blocked)');
    return blank;
}
