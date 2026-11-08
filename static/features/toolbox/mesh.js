/**
 * UV and texel statistics for an imported mesh.
 *
 * The question the texel-density tool answers for a model is not "how big is
 * this texture" but "how many texels does one metre get *here*". For a triangle
 * with 3D area A and UV area U (in sheet fractions), the sheet gives it
 * U × W × H texels, so its local density is `sqrt(U × W × H / A)` pixels per
 * metre. Summing the two areas over a UV shell before dividing is what makes the
 * number stable: a shell made of many small triangles reports the density the
 * user actually sees, not an average of noisy per-triangle ratios.
 *
 * Shells (islands) are the connected components of triangles that share a UV
 * vertex. Vertices are welded by quantised coordinate, because OBJ and glTF
 * files routinely duplicate a position per face and a shared edge must not read
 * as a seam between two shells.
 *
 * Pure data in, pure data out: no three.js, no DOM, so `check-toolbox.mjs` can
 * pin every number in Node.
 */

const EPSILON = 1e-12;
const OVERSIZE = 1e-6;

const positive = (value, label) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be a positive number.`);
    return number;
};

function positionsOf(mesh) {
    const positions = mesh?.positions;
    const label = mesh?.name ? `"${mesh.name}"` : 'the mesh';
    if (!positions || !positions.length) throw new Error(`${label} has no vertices.`);
    if (positions.length % 3 !== 0) throw new Error(`${label} positions must be x, y, z triples.`);
    return { positions, label, vertexCount: positions.length / 3 };
}

function indexList(mesh, vertexCount, label) {
    const indices = mesh?.indices;
    if (!indices || !indices.length) return null;
    if (indices.length % 3 !== 0) throw new Error(`${label} indices are not a whole number of triangles.`);
    for (let i = 0; i < indices.length; i += 1) {
        if (indices[i] < 0 || indices[i] >= vertexCount) {
            throw new Error(`${label} has an index past its ${vertexCount} vertices.`);
        }
    }
    return indices;
}

/** Union-find over triangle indices, used to collect UV shells. */
function makeSets(count) {
    const parent = new Uint32Array(count);
    for (let i = 0; i < count; i += 1) parent[i] = i;
    const find = (value) => {
        let root = value;
        while (parent[root] !== root) root = parent[root];
        while (parent[value] !== root) {
            const next = parent[value];
            parent[value] = root;
            value = next;
        }
        return root;
    };
    const union = (a, b) => {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB) parent[rootB] = rootA;
    };
    return { find, union };
}

/**
 * Texel density and UV shells for one mesh.
 *
 * `positions` are metres, `uvs` raw (0–1 is one sheet, values outside it are
 * reported, not clamped). Degenerate triangles are excluded from the density and
 * counted, so a badly exported mesh explains its own low number.
 */
export function meshTexelReport(mesh, { texturePixels = 1024, textureWidth, textureHeight, uvTolerance = 1e-5 } = {}) {
    const { positions, label, vertexCount } = positionsOf(mesh);
    const indices = indexList(mesh, vertexCount, label);
    const triangleCount = indices ? indices.length / 3 : Math.floor(vertexCount / 3);
    if (!triangleCount) throw new Error(`${label} has no triangles.`);

    const width = textureWidth == null ? positive(texturePixels, 'Texture width') : positive(textureWidth, 'Texture width');
    const height = textureHeight == null ? width : positive(textureHeight, 'Texture height');
    const tolerance = Number(uvTolerance);
    if (!Number.isFinite(tolerance) || tolerance <= 0) throw new Error('The UV weld tolerance must be positive.');

    const uvs = mesh.uvs && mesh.uvs.length >= vertexCount * 2 ? mesh.uvs : null;
    const corner = (triangle, cornerIndex) => (indices ? indices[triangle * 3 + cornerIndex] : triangle * 3 + cornerIndex);

    const areas3d = new Float64Array(triangleCount);
    const uvAreas = new Float64Array(triangleCount);
    const signedUv = new Float64Array(triangleCount);
    const shellIds = new Uint32Array(triangleCount * 3);
    const weld = new Map();
    const sets = makeSets(triangleCount);
    const owner = new Map();

    const u = new Float64Array(3);
    const v = new Float64Array(3);
    const points = new Float64Array(9);
    let collapsed = 0;
    let uvDegenerate = 0;

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        for (let c = 0; c < 3; c += 1) {
            const vertex = corner(triangle, c);
            const offset = vertex * 3;
            points[c * 3] = positions[offset];
            points[c * 3 + 1] = positions[offset + 1];
            points[c * 3 + 2] = positions[offset + 2];
        }

        const ax = points[3] - points[0];
        const ay = points[4] - points[1];
        const az = points[5] - points[2];
        const bx = points[6] - points[0];
        const by = points[7] - points[1];
        const bz = points[8] - points[2];
        const cx = ay * bz - az * by;
        const cy = az * bx - ax * bz;
        const cz = ax * by - ay * bx;
        areas3d[triangle] = Math.hypot(cx, cy, cz) / 2;

        if (uvs) {
            for (let c = 0; c < 3; c += 1) {
                const vertex = corner(triangle, c);
                const tu = uvs[vertex * 2];
                const tv = uvs[vertex * 2 + 1];
                u[c] = tu;
                v[c] = tv;
                const key = `${Math.round(tu / tolerance)},${Math.round(tv / tolerance)}`;
                let id = weld.get(key);
                if (id === undefined) {
                    id = weld.size;
                    weld.set(key, id);
                }
                shellIds[triangle * 3 + c] = id;
                const first = owner.get(id);
                if (first === undefined) owner.set(id, triangle);
                else sets.union(first, triangle);
            }
            const cross = (u[1] - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (v[1] - v[0]);
            signedUv[triangle] = cross / 2;
            uvAreas[triangle] = Math.abs(cross) / 2;
        }

        if (areas3d[triangle] <= EPSILON) collapsed += 1;
        else if (uvs && uvAreas[triangle] <= EPSILON) uvDegenerate += 1;
    }

    if (!uvs) {
        return {
            name: mesh.name || 'mesh',
            hasUVs: false,
            vertexCount,
            triangleCount,
            collapsed,
            uvDegenerate: 0,
            area3d: areas3d.reduce((sum, area) => sum + area, 0),
            uvArea: 0,
            density: null,
            islands: [],
            mirrored: false,
            outside: false,
            mixed: false
        };
    }

    const shellMap = new Map();
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const root = sets.find(triangle);
        let shell = shellMap.get(root);
        if (!shell) {
            shell = {
                triangles: 0,
                area3d: 0,
                uvArea: 0,
                signedUv: 0,
                minU: Infinity,
                maxU: -Infinity,
                minV: Infinity,
                maxV: -Infinity
            };
            shellMap.set(root, shell);
        }
        shell.triangles += 1;
        shell.area3d += areas3d[triangle];
        shell.uvArea += uvAreas[triangle];
        shell.signedUv += signedUv[triangle];
        for (let c = 0; c < 3; c += 1) {
            const vertex = corner(triangle, c);
            const tu = uvs[vertex * 2];
            const tv = uvs[vertex * 2 + 1];
            if (tu < shell.minU) shell.minU = tu;
            if (tu > shell.maxU) shell.maxU = tu;
            if (tv < shell.minV) shell.minV = tv;
            if (tv > shell.maxV) shell.maxV = tv;
        }
    }

    const islands = [...shellMap.values()]
        .sort((a, b) => b.area3d - a.area3d)
        .map((shell, index) => ({
            shell: index + 1,
            triangles: shell.triangles,
            area3d: shell.area3d,
            uvArea: shell.uvArea,
            density: shell.area3d > EPSILON ? Math.sqrt((shell.uvArea * width * height) / shell.area3d) : null,
            mirrored: shell.signedUv < 0,
            bounds: { minU: shell.minU, maxU: shell.maxU, minV: shell.minV, maxV: shell.maxV },
            outside: shell.minU < -OVERSIZE || shell.minV < -OVERSIZE || shell.maxU > 1 + OVERSIZE || shell.maxV > 1 + OVERSIZE
        }));

    const area3d = islands.reduce((sum, island) => sum + island.area3d, 0);
    const uvArea = islands.reduce((sum, island) => sum + island.uvArea, 0);
    const mirrored = islands.some((island) => island.mirrored);
    const mixed = mirrored && islands.some((island) => !island.mirrored);
    const outside = islands.some((island) => island.outside);

    return {
        name: mesh.name || 'mesh',
        hasUVs: true,
        vertexCount,
        triangleCount,
        collapsed,
        uvDegenerate,
        area3d,
        uvArea,
        density: area3d > EPSILON && uvArea > EPSILON ? Math.sqrt((uvArea * width * height) / area3d) : null,
        islands,
        mirrored,
        outside,
        mixed
    };
}

/**
 * One report for a whole model: the per-mesh rows, every UV shell flattened for
 * the table, and the model totals. The overall density is area-weighted, so a
 * small dense prop cannot dominate a large wall.
 */
export function modelTexelReport(meshes, { texturePixels = 1024, textureWidth, textureHeight, uvTolerance } = {}) {
    const list = Array.isArray(meshes) ? meshes : [];
    if (!list.length) throw new Error('Load a model to measure.');
    const width = textureWidth == null ? positive(texturePixels, 'Texture width') : positive(textureWidth, 'Texture width');
    const height = textureHeight == null ? width : positive(textureHeight, 'Texture height');

    const reports = list.map((mesh) => meshTexelReport(mesh, { textureWidth: width, textureHeight: height, uvTolerance }));
    const islands = reports.flatMap((report) => report.islands.map((island) => ({ ...island, mesh: report.name })));
    islands.sort((a, b) => b.area3d - a.area3d);
    islands.forEach((island, index) => { island.index = index + 1; });

    const area3d = reports.reduce((sum, report) => sum + report.area3d, 0);
    const uvArea = reports.reduce((sum, report) => sum + report.uvArea, 0);
    const triangleCount = reports.reduce((sum, report) => sum + report.triangleCount, 0);
    let minDensity = null;
    let maxDensity = null;
    islands.forEach((island) => {
        if (island.density == null || island.area3d <= EPSILON) return;
        if (minDensity === null || island.density < minDensity) minDensity = island.density;
        if (maxDensity === null || island.density > maxDensity) maxDensity = island.density;
    });

    return {
        textureWidth: width,
        textureHeight: height,
        meshes: reports,
        islands,
        totals: {
            meshes: reports.length,
            triangleCount,
            islandCount: islands.length,
            area3d,
            uvArea,
            density: area3d > EPSILON && uvArea > EPSILON ? Math.sqrt((uvArea * width * height) / area3d) : null,
            minDensity,
            maxDensity,
            spread: minDensity && maxDensity ? maxDensity / minDensity : null,
            withoutUVs: reports.filter((report) => !report.hasUVs).length,
            collapsed: reports.reduce((sum, report) => sum + report.collapsed, 0),
            uvDegenerate: reports.reduce((sum, report) => sum + report.uvDegenerate, 0),
            mirrored: reports.some((report) => report.mirrored),
            mixed: reports.some((report) => report.mixed),
            outside: reports.some((report) => report.outside)
        }
    };
}
