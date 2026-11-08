import { WALL_HEIGHT } from '../../core/world-space.js';
import { stairOpenings } from './room-surfaces.js';
import { constructionOptions, storeyConstruction, WALL_HEIGHT_M, JOIST_DEPTH_M } from './construction.js';

/**
 * Studio feature 41 - storeys and stair openings.
 *
 * The editor keeps the active storey in the legacy `AppState.walls/fixtures`
 * arrays (so every existing tool keeps working) and stores the others in
 * `AppState.stories`. These helpers synchronise that model, stack elevations for
 * the 3D engine, and project a storey's stairs into holes for the floor above.
 */

export const DEFAULT_STOREY_NAME = 'Ground floor';

/**
 * A storey is 96 in of clear wall plus an 8 in floor structure, so its
 * floor-to-floor pitch is 2.64 m. `height` mirrors the pitch for older callers.
 */
export function newStorey({ name = 'Floor', wallHeight = WALL_HEIGHT_M, floorDepth = JOIST_DEPTH_M } = {}) {
    return {
        id: `storey_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        ...constructionOptions({ wallHeight, floorDepth }),
        visible: true,
        walls: [],
        fixtures: [],
        openings: []
    };
}

/** Write the active arrays back into their storey slot. */
export function syncActiveStorey(state) {
    if (!state?.stories?.length) return state;
    const index = Math.min(Math.max(state.currentStoryIndex || 0, 0), state.stories.length - 1);
    const story = state.stories[index];
    if (!story) return state;
    story.walls = state.walls;
    story.fixtures = state.fixtures;
    return state;
}

/** Load a storey into the active arrays, persisting the one being left. */
export function activateStorey(state, index) {
    if (!state?.stories?.length) return state;
    syncActiveStorey(state);
    const next = Math.min(Math.max(index, 0), state.stories.length - 1);
    state.currentStoryIndex = next;
    const story = state.stories[next];
    state.walls = story.walls || [];
    state.fixtures = story.fixtures || [];
    state.selectedFixture = null;
    state.selectedWallId = null;
    state.roomLabels = [];
    return state;
}

export function addStorey(state, options = {}) {
    syncActiveStorey(state);
    const index = (state.stories?.length || 0) + 1;
    const story = newStorey({
        name: options.name || `Floor ${index}`,
        wallHeight: options.wallHeight,
        floorDepth: options.floorDepth
    });
    if (!state.stories) state.stories = [];
    state.stories.push(story);
    return story;
}

export function removeStorey(state, index) {
    if (!state?.stories || state.stories.length <= 1) return false;
    syncActiveStorey(state);
    state.stories.splice(index, 1);
    state.currentStoryIndex = Math.min(state.currentStoryIndex || 0, state.stories.length - 1);
    activateStorey(state, state.currentStoryIndex);
    return true;
}

/** Per-storey elevation and height, in stacking order. */
export function storeyStack(stories = []) {
    let elevation = 0;
    return stories.map((story, index) => {
        const construction = storeyConstruction(story);
        const entry = {
            index,
            id: story.id,
            name: story.name || `Floor ${index + 1}`,
            height: construction.pitch,
            wallHeight: construction.wallHeight,
            floorDepth: construction.floorDepth,
            elevation,
            visible: story.visible !== false,
            openings: story.openings?.length || 0
        };
        elevation += construction.pitch;
        return entry;
    });
}

/** Stories for the 3D engine, in engine shape. */
export function engineStories(state) {
    syncActiveStorey(state);
    return (state.stories || []).map((story) => {
        const construction = storeyConstruction(story);
        return {
            id: story.id,
            name: story.name,
            height: construction.pitch,
            wallHeight: construction.wallHeight,
            floorDepth: construction.floorDepth,
            visible: story.visible !== false,
            walls: story.walls || [],
            fixtures: story.fixtures || [],
            openings: story.openings || []
        };
    });
}

/**
 * Holes for the floor of `storyIndex`, taken from the stairs on the storey
 * directly below. Returns world-space rectangles (x, z in metres).
 */
export function stairOpeningsForFloor(state, storyIndex, view) {
    if (!state?.stories || storyIndex <= 0) return [];
    syncActiveStorey(state);
    const below = state.stories[storyIndex - 1];
    if (!below) return [];
    return stairOpenings(below.fixtures || [], view);
}

export function storeySummary(state) {
    syncActiveStorey(state);
    const stack = storeyStack(state.stories || []);
    return stack.map((entry) => ({
        ...entry,
        walls: state.stories[entry.index]?.walls?.length || 0,
        fixtures: state.stories[entry.index]?.fixtures?.length || 0,
        active: entry.index === (state.currentStoryIndex || 0)
    }));
}

/** Simple stair mesh factory: treads climbing one storey. */
export function buildStairObject(THREE, { width = 1, depth = 2.6, height = WALL_HEIGHT, material } = {}) {
    const group = new THREE.Group();
    const steps = Math.max(4, Math.round(height / 0.18));
    const tread = depth / steps;
    const mat = material || new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 });

    for (let i = 0; i < steps; i++) {
        const geometry = new THREE.BoxGeometry(width, 0.05, tread);
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.set(0, 0.025 + (i * height) / steps, -depth / 2 + tread / 2 + i * tread);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    }

    // Landing at the top of the run.
    const landing = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, tread * 1.5), mat);
    landing.position.set(0, height, depth / 2 - tread * 0.75);
    group.add(landing);
    return group;
}
