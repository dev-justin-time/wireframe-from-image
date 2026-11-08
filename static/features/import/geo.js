/**
 * Georeferenced import — KML, KMZ and GeoJSON.
 *
 * Written from the public formats (OGC KML 2.2, RFC 7946, ZIP/APPNOTE), not
 * ported from another codebase. The job is narrow and honest: pull the
 * geometry out of a survey or Earth export as plain lon/lat features, then
 * project it onto a local metre grid so a site plan can use it. There is no
 * CRS handling: KML and GeoJSON are WGS84 lon/lat by definition, and a
 * projected SHP/DXF needs a real reprojection library.
 */

const EARTH_METRES_PER_DEGREE_LAT = 110540;
const EARTH_METRES_PER_DEGREE_LON_EQUATOR = 111320;

/** Thin wrapper so every parser returns the same feature contract. */
function feature(name, kind, rings) {
    return {
        name: name || 'Unnamed feature',
        kind, // 'point' | 'line' | 'polygon'
        rings: rings.map((ring) => ring.map(([lon, lat]) => ({ lon, lat })))
    };
}

const parseCoordinateList = (text) => String(text || '')
    .trim()
    .split(/\s+/)
    .map((chunk) => {
        const [lon, lat] = chunk.split(',').map(Number);
        return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
    })
    .filter(Boolean);

/** Parse a KML document. Nested elements are handled without an XML dependency. */
export function parseKml(text) {
    const source = String(text || '');
    const features = [];

    for (const placemark of source.match(/<Placemark\b[\s\S]*?<\/Placemark>/gi) || []) {
        const name = (placemark.match(/<name>([\s\S]*?)<\/name>/i) || [])[1]
            ?.replace(/<!\[CDATA\[|\]\]>/g, '')
            .replace(/&amp;/g, '&')
            .trim();

        const pointBlock = placemark.match(/<Point\b[\s\S]*?<\/Point>/i);
        if (pointBlock) {
            const coords = parseCoordinateList((pointBlock[0].match(/<coordinates>([\s\S]*?)<\/coordinates>/i) || [])[1]);
            if (coords.length) features.push(feature(name, 'point', [coords.slice(0, 1)]));
        }

        const lineBlock = placemark.match(/<LineString\b[\s\S]*?<\/LineString>/i);
        if (lineBlock) {
            const coords = parseCoordinateList((lineBlock[0].match(/<coordinates>([\s\S]*?)<\/coordinates>/i) || [])[1]);
            if (coords.length > 1) features.push(feature(name, 'line', [coords]));
        }

        for (const polygon of placemark.match(/<Polygon\b[\s\S]*?<\/Polygon>/gi) || []) {
            const outer = (polygon.match(/<outerBoundaryIs\b[\s\S]*?<\/outerBoundaryIs>/i) || [])[0] || polygon;
            const ring = parseCoordinateList((outer.match(/<coordinates>([\s\S]*?)<\/coordinates>/i) || [])[1]);
            if (ring.length > 2) features.push(feature(name, 'polygon', [ring]));
        }
    }

    return features;
}

/** Parse GeoJSON (FeatureCollection, Feature, or bare geometry). */
export function parseGeoJson(input) {
    let document;
    try {
        document = typeof input === 'string' ? JSON.parse(input) : input;
    } catch {
        return [];
    }
    if (!document || typeof document !== 'object') return [];

    const features = [];
    const collect = (node, inheritedName) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'FeatureCollection' && Array.isArray(node.features)) {
            node.features.forEach((entry) => collect(entry, inheritedName));
            return;
        }
        if (node.type === 'Feature') {
            const name = node.properties?.name || inheritedName;
            collect(node.geometry, name);
            return;
        }
        if (node.type === 'GeometryCollection' && Array.isArray(node.geometries)) {
            node.geometries.forEach((entry) => collect(entry, inheritedName));
            return;
        }
        switch (node.type) {
            case 'Point': {
                const [lon, lat] = node.coordinates || [];
                if (Number.isFinite(lon) && Number.isFinite(lat)) features.push(feature(inheritedName, 'point', [[[lon, lat]]]));
                break;
            }
            case 'MultiPoint':
                for (const [lon, lat] of node.coordinates || []) {
                    if (Number.isFinite(lon) && Number.isFinite(lat)) features.push(feature(inheritedName, 'point', [[[lon, lat]]]));
                }
                break;
            case 'LineString': {
                const coords = (node.coordinates || []).filter((pair) => Array.isArray(pair) && pair.length >= 2).map(([lon, lat]) => [lon, lat]);
                if (coords.length > 1) features.push(feature(inheritedName, 'line', [coords]));
                break;
            }
            case 'MultiLineString':
                for (const line of node.coordinates || []) {
                    const coords = (line || []).filter((pair) => Array.isArray(pair) && pair.length >= 2).map(([lon, lat]) => [lon, lat]);
                    if (coords.length > 1) features.push(feature(inheritedName, 'line', [coords]));
                }
                break;
            case 'Polygon':
                for (const ring of node.coordinates || []) {
                    const coords = (ring || []).filter((pair) => Array.isArray(pair) && pair.length >= 2).map(([lon, lat]) => [lon, lat]);
                    if (coords.length > 2) features.push(feature(inheritedName, 'polygon', [coords]));
                }
                break;
            case 'MultiPolygon':
                for (const polygon of node.coordinates || []) {
                    for (const ring of polygon || []) {
                        const coords = (ring || []).filter((pair) => Array.isArray(pair) && pair.length >= 2).map(([lon, lat]) => [lon, lat]);
                        if (coords.length > 2) features.push(feature(inheritedName, 'polygon', [coords]));
                    }
                }
                break;
            default:
                break;
        }
    };
    collect(document, '');
    return features;
}

/** Read the ZIP entries of a KMZ. Returns `{ name, bytes }` for each entry. */
export function readZipEntries(bytes) {
    const view = new DataView(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength);
    const decoder = new TextDecoder('utf-8');
    const entries = [];
    // Find the end-of-central-directory record (signature 0x06054b50), scanning
    // back over the comment (max 64 KB per the ZIP spec).
    let eocd = -1;
    const stop = Math.max(0, view.byteLength - 22 - 0xffff);
    for (let offset = view.byteLength - 22; offset >= stop; offset -= 1) {
        if (view.getUint32(offset, true) === 0x06054b50) {
            eocd = offset;
            break;
        }
    }
    if (eocd < 0) throw new Error('Not a ZIP archive (no end-of-central-directory record).');

    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);

    for (let index = 0; index < count; index += 1) {
        if (view.getUint32(offset, true) !== 0x02014b50) break;
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const name = decoder.decode(new Uint8Array(bytes.buffer || bytes, (bytes.byteOffset || 0) + offset + 46, nameLength));
        entries.push({ name, method, compressedSize, localOffset });
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

/**
 * Extract the KML document from a KMZ archive.
 *
 * `inflate` must turn deflate-raw bytes into bytes. Browsers pass a
 * DecompressionStream wrapper; Node can pass `zlib.inflateRawSync`. A stored
 * (uncompressed) entry needs no inflater at all.
 */
export async function readKmzDocument(bytes, { inflate = null } = {}) {
    const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const entries = readZipEntries(buffer);
    const entry = entries.find((candidate) => /\.kml$/i.test(candidate.name));
    if (!entry) throw new Error('The KMZ archive has no .kml entry.');

    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error('Corrupt KMZ entry header.');
    const nameLength = view.getUint16(entry.localOffset + 26, true);
    const extraLength = view.getUint16(entry.localOffset + 28, true);
    const start = entry.localOffset + 30 + nameLength + extraLength;
    const raw = buffer.slice(start, start + entry.compressedSize);

    const decoder = new TextDecoder('utf-8');
    if (entry.method === 0) return decoder.decode(raw);
    if (entry.method !== 8) throw new Error(`Unsupported KMZ compression method ${entry.method}.`);
    if (!inflate) throw new Error('This KMZ entry is deflated; pass an inflate function.');
    const expanded = await inflate(raw);
    return decoder.decode(expanded instanceof Uint8Array ? expanded : new Uint8Array(expanded));
}

/** Browser inflater for deflated KMZ entries. */
export async function browserInflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') {
        throw new Error('This browser cannot inflate KMZ entries; unzip the .kml and import that.');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Project lon/lat features onto local metres.
 *
 * An equirectangular projection is accurate to a few centimetres over a site
 * and needs no dependency. `origin` is the point that becomes (0, 0); by
 * default it is the centre of the first feature.
 */
export function projectFeatures(features, { origin = null } = {}) {
    const points = features.flatMap((entry) => entry.rings.flat());
    if (!points.length) return { origin: null, features: [] };
    const centre = origin || points.reduce((acc, point) => ({
        lon: acc.lon + point.lon / points.length,
        lat: acc.lat + point.lat / points.length
    }), { lon: 0, lat: 0 });

    const metresPerLon = EARTH_METRES_PER_DEGREE_LON_EQUATOR * Math.cos((centre.lat * Math.PI) / 180);
    const project = (point) => ({
        x: (point.lon - centre.lon) * metresPerLon,
        // Local grid: y grows north, matching a map.
        y: (point.lat - centre.lat) * EARTH_METRES_PER_DEGREE_LAT
    });

    return {
        origin: centre,
        metresPerLon,
        features: features.map((entry) => ({
            ...entry,
            rings: entry.rings.map((ring) => ring.map(project))
        }))
    };
}

/** Bounds of projected (metre) features. */
export function localBounds(features) {
    const points = features.flatMap((entry) => entry.rings.flat());
    if (!points.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Fit projected features into a site rectangle in metres, centred, keeping the
 * shape's aspect. The result is in site coordinates: x across, z into depth
 * (north becomes -z, so the plan reads like a map with north up).
 *
 * `fit: false` centres the shape at its real size — a surveyed boundary is a
 * measurement, so a caller that must not distort it (the editor's plan) turns
 * fitting off and zooms the view instead.
 */
export function fitFeaturesToSite(features, { width = 20, depth = 20, margin = 1, fit = true } = {}) {
    const bounds = localBounds(features);
    if (!bounds) return { features: [], scale: 1, bounds: null };
    const usableWidth = Math.max(0.01, width - margin * 2);
    const usableDepth = Math.max(0.01, depth - margin * 2);
    const scale = fit
        ? Math.min(
            1,
            usableWidth / Math.max(bounds.width, 0.01),
            usableDepth / Math.max(bounds.height, 0.01)
        )
        : 1;
    const centreX = bounds.minX + bounds.width / 2;
    const centreY = bounds.minY + bounds.height / 2;

    return {
        scale,
        bounds,
        features: features.map((entry) => ({
            ...entry,
            rings: entry.rings.map((ring) => ring.map((point) => ({
                x: width / 2 + (point.x - centreX) * scale,
                z: depth / 2 - (point.y - centreY) * scale
            })))
        }))
    };
}

/**
 * One entry point for the three formats: given a filename and its bytes,
 * return parsed lon/lat features.
 */
export async function parseGeoFile({ name = '', text = '', bytes = null, inflate = browserInflateRaw }) {
    const lower = String(name).toLowerCase();
    if (lower.endsWith('.kmz')) {
        if (!bytes) throw new Error('KMZ needs the file bytes.');
        const kml = await readKmzDocument(bytes, { inflate });
        return parseKml(kml);
    }
    if (lower.endsWith('.kml') || /<kml\b/i.test(text)) return parseKml(text);
    if (lower.endsWith('.geojson') || lower.endsWith('.json') || /^\s*[{[]/.test(text)) return parseGeoJson(text);
    throw new Error('Unsupported file. Use .kml, .kmz or .geojson.');
}
