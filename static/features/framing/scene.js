import * as THREE from 'three';
import { INCH, canvasToPlan } from '../../core/world-space.js';
import { readDraft } from '../../core/drafts.js';
import { openingsForWall } from '../advanced/openings.js';
import { computeFramingDesign } from './engine.js';
import { FRAMING_DEFAULTS, studDepthM } from './catalog.js';

/**
 * Editor framing overlay.
 *
 * The overlay frames the plan that is actually in the editor: every storey's
 * walls become stud boxes at the configured spacing, with king and jack studs,
 * headers, cripples, sills, blocking, a treated sole plate and a double top
 * plate. It is built from the same `frameWall` engine as the suite, so the
 * elevation drawing, the cut list and the 3D boards are the same members.
 *
 * The overlay is a plain THREE.Group under the scene root. The editor hides the
 * ordinary wall meshes while it is visible, so the studs read as the wall
 * rather than being buried inside it.
 */

export const FRAMING_DRAFT_KEY = 'framing-editor-draft';

export function readFramingDraft() {
    // The key stays for the bid builder, so the read does not consume it.
    const draft = readDraft(FRAMING_DRAFT_KEY, { consume: false })?.data;
    return draft && typeof draft === 'object' ? draft : null;
}

const FRAMING_FIELDS = [
    'species', 'studSize', 'studSpacingIn', 'topPlates', 'studLengthIn', 'bottomTreated',
    'exteriorSheathing', 'interiorSheathing', 'sheathing', 'subfloor', 'houseWrap',
    'anchorBolts', 'holdDowns', 'blockingRows', 'fireBlocking', 'balloon',
    'floorJoistSpacingIn', 'floorSpanFt', 'waste', 'labourRate'
];

/** Only the member choices travel from the suite; the plan stays the editor's. */
function draftFramingOptions(draft) {
    const config = draft?.config || {};
    return FRAMING_FIELDS.reduce((result, key) => {
        if (config[key] !== undefined) result[key] = config[key];
        return result;
    }, {});
}

function exteriorWall(wall, bounds, tolerance = 0.3) {
    const mid = { x: (wall.x1 + wall.x2) / 2, z: (wall.z1 + wall.z2) / 2 };
    return [bounds.minX, bounds.maxX].some((value) => Math.abs(mid.x - value) <= tolerance)
        || [bounds.minZ, bounds.maxZ].some((value) => Math.abs(mid.z - value) <= tolerance);
}

/**
 * Turn the editor's stores into a framing config: metres of wall, openings in
 * metres, and the member choices from the suite draft.
 */
export function framingConfigFromEditor({ stories = [], view, fixturesByStorey = [], draft = null } = {}) {
    const options = draftFramingOptions(draft);
    const wallsByStorey = stories.map((story) => {
        const fixtures = fixturesByStorey[story.index] || story.fixtures || [];
        const converted = (story.walls || []).map((wall, index) => {
            const start = canvasToPlan(wall.start, view);
            const end = canvasToPlan(wall.end, view);
            return {
                id: wall.id,
                name: `Wall ${index + 1}`,
                x1: start.x,
                z1: start.z,
                x2: end.x,
                z2: end.z,
                exterior: true,
                openings: openingsForWall(wall, fixtures).map((entry) => ({
                    id: entry.fixture?.id,
                    type: entry.fixture?.type === 'door' ? 'door' : 'window',
                    widthM: entry.width,
                    heightM: entry.height,
                    sillM: entry.sill,
                    offsetM: entry.alongMetres
                }))
            };
        }).filter((wall) => Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1) > 0.2);
        if (!converted.length) return [];
        const xs = converted.flatMap((wall) => [wall.x1, wall.x2]);
        const zs = converted.flatMap((wall) => [wall.z1, wall.z2]);
        const bounds = {
            minX: Math.min(...xs), maxX: Math.max(...xs),
            minZ: Math.min(...zs), maxZ: Math.max(...zs)
        };
        converted.forEach((wall) => {
            wall.exterior = exteriorWall(wall, bounds);
        });
        return converted;
    });

    const topPlates = Number(options.topPlates) || 2;
    return {
        ...FRAMING_DEFAULTS,
        ...options,
        storeys: stories.map((story, index) => {
            const plateIn = 1.5 * (1 + topPlates);
            const derived = ((Number(story.wallHeight) || 2.4384) / INCH) - plateIn;
            return {
                id: `editor-storey-${index}`,
                name: story.name || `Floor ${index + 1}`,
                studLengthIn: Math.max(48, Math.round(derived * 10) / 10),
                topPlates,
                walls: wallsByStorey[index] || [],
                floor: index > 0
            };
        })
    };
}

/** Compute the framing design for the editor's plan. */
export function computeEditorFraming({ stories = [], view, fixturesByStorey = [], draft = null } = {}) {
    const config = framingConfigFromEditor({ stories, view, fixturesByStorey, draft });
    const empty = !config.storeys.some((storey) => storey.walls.length);
    const design = computeFramingDesign(empty
        ? { ...config, storeys: [{ name: 'Ground floor', walls: [] }] }
        : config);
    return { config, design, draft, empty };
}

const MATERIALS = {
    'plate-bottom': new THREE.MeshStandardMaterial({ color: 0x7f9c6a, roughness: 0.85 }),
    'plate-top': new THREE.MeshStandardMaterial({ color: 0xd9c09a, roughness: 0.8 }),
    stud: new THREE.MeshStandardMaterial({ color: 0xdcc09a, roughness: 0.85 }),
    king: new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.85 }),
    jack: new THREE.MeshStandardMaterial({ color: 0xb98a4e, roughness: 0.85 }),
    cripple: new THREE.MeshStandardMaterial({ color: 0xe8d3b4, roughness: 0.85 }),
    header: new THREE.MeshStandardMaterial({ color: 0xc97b2f, roughness: 0.8 }),
    sill: new THREE.MeshStandardMaterial({ color: 0xbfc8c3, roughness: 0.8 }),
    block: new THREE.MeshStandardMaterial({ color: 0x9bb7c9, roughness: 0.8 })
};

/**
 * Build one THREE.Group with a subgroup per storey. `elevations` is the vector
 * from `storeyStack`; `visible` follows the editor's storey visibility.
 */
export function buildFramingGroup(design, { elevations = [], visible = [] } = {}) {
    const group = new THREE.Group();
    group.name = 'framing-overlay';
    if (!design) return group;
    const geometryCache = new Map();
    const geometryFor = (width, height, depth) => {
        const key = `${width.toFixed(3)}|${height.toFixed(3)}|${depth.toFixed(3)}`;
        if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(width, height, depth));
        return geometryCache.get(key);
    };

    design.storeys.forEach((storey, index) => {
        if (visible[index] === false) return;
        const storeyGroup = new THREE.Group();
        storeyGroup.name = `framing-${index}`;
        storeyGroup.position.y = Number(elevations[index]) || 0;
        const depth = studDepthM(design.config.studSize);
        storey.walls.forEach((wall) => {
            const dx = wall.end.x - wall.start.x;
            const dz = wall.end.z - wall.start.z;
            const length = Math.hypot(dx, dz) || 1;
            const dir = { x: dx / length, z: dz / length };
            const normal = { x: -dir.z, z: dir.x };
            const angle = -Math.atan2(dir.z, dir.x);
            wall.members.forEach((member) => {
                const along = Math.max(member.x1 - member.x0, 0.02);
                const height = Math.max(member.y1 - member.y0, 0.02);
                const across = Math.max(member.z1 - member.z0, 0.02);
                const centreAlong = (member.x0 + member.x1) / 2;
                const centreAcross = (member.z0 + member.z1) / 2 - depth / 2;
                const mesh = new THREE.Mesh(
                    geometryFor(along, height, across),
                    MATERIALS[member.kind] || MATERIALS.stud
                );
                mesh.position.set(
                    wall.start.x + dir.x * centreAlong + normal.x * centreAcross,
                    (member.y0 + member.y1) / 2,
                    wall.start.z + dir.z * centreAlong + normal.z * centreAcross
                );
                mesh.rotation.y = angle;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData = { framing: true, kind: member.kind, wallId: wall.id, storey: index };
                storeyGroup.add(mesh);
            });
        });
        group.add(storeyGroup);
    });

    group.userData = { framingOverlay: true, storeys: design.storeys.length };
    return group;
}

/** Release every geometry and material in the overlay before dropping it. */
export function disposeFramingGroup(group) {
    if (!group) return;
    group.traverse((object) => {
        if (object.isMesh && object.geometry) object.geometry.dispose();
    });
    group.parent?.remove(group);
}

/** Counts and bounds for the editor panel and the headless checks. */
export function framingSceneStats(group) {
    let meshes = 0;
    group?.traverse((object) => { if (object.isMesh && object.userData?.framing) meshes += 1; });
    let bounds = null;
    if (group && group.children.length) {
        const box = new THREE.Box3().setFromObject(group);
        if (!box.isEmpty()) {
            bounds = {
                minX: box.min.x, maxX: box.max.x,
                minY: box.min.y, maxY: box.max.y,
                minZ: box.min.z, maxZ: box.max.z
            };
        }
    }
    return { meshes, storeys: group?.children?.length || 0, bounds };
}
