//! glTF 2.0 export for an extruded wireframe.
//!
//! The mesh the extractor builds is a line set: wall centrelines at floor level
//! and at wall height, with vertical edges joining them. glTF has a LINES
//! primitive for exactly that, so nothing is triangulated or welded here — the
//! same vertices and edges the OBJ carries become one accessor pair and one
//! mode-1 primitive.
//!
//! The buffer is embedded as a `data:` URI so the result is a single portable
//! file, the way the OBJ is. Base64 is written by hand to keep the dependency
//! list unchanged.

use crate::Mesh;
use serde_json::{json, Value};

const BASE64: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn base64(bytes: &[u8]) -> String {
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(BASE64[(triple >> 18) as usize & 0x3f] as char);
        out.push(BASE64[(triple >> 12) as usize & 0x3f] as char);
        out.push(if chunk.len() > 1 {
            BASE64[(triple >> 6) as usize & 0x3f] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            BASE64[triple as usize & 0x3f] as char
        } else {
            '='
        });
    }
    out
}

/// Axis-aligned bounds, as glTF requires on a POSITION accessor.
fn bounds(mesh: &Mesh) -> ([f32; 3], [f32; 3]) {
    if mesh.vertices.is_empty() {
        return ([0.0; 3], [0.0; 3]);
    }

    let mut min = mesh.vertices[0];
    let mut max = mesh.vertices[0];
    for vertex in &mesh.vertices {
        for axis in 0..3 {
            min[axis] = min[axis].min(vertex[axis]);
            max[axis] = max[axis].max(vertex[axis]);
        }
    }
    (min, max)
}

/// A single-file glTF: one buffer, two accessors, one LINES primitive.
pub fn mesh_to_gltf(mesh: &Mesh, name: &str) -> String {
    let mut positions = Vec::with_capacity(mesh.vertices.len() * 12);
    for vertex in &mesh.vertices {
        for axis in vertex {
            positions.extend_from_slice(&axis.to_le_bytes());
        }
    }

    // glTF index buffers must start on a 4-byte boundary, and so must each
    // accessor's view; f32 positions already end on one.
    let mut indices = Vec::with_capacity(mesh.edges.len() * 8);
    for edge in &mesh.edges {
        for end in edge {
            indices.extend_from_slice(&(*end as u32).to_le_bytes());
        }
    }

    let (min, max) = bounds(mesh);
    let position_bytes = positions.len();
    let mut buffer = positions;
    buffer.extend_from_slice(&indices);

    let document = json!({
        "asset": { "version": "2.0", "generator": "blueprint3d" },
        "scene": 0,
        "scenes": [{ "name": name, "nodes": [0] }],
        "nodes": [{ "name": name, "mesh": 0 }],
        "meshes": [{
            "name": name,
            "primitives": [{
                "attributes": { "POSITION": 0 },
                "indices": 1,
                "mode": 1
            }]
        }],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": mesh.vertices.len(),
                "type": "VEC3",
                "min": [min[0], min[1], min[2]],
                "max": [max[0], max[1], max[2]]
            },
            {
                "bufferView": 1,
                "componentType": 5125,
                "count": mesh.edges.len() * 2,
                "type": "SCALAR"
            }
        ],
        "bufferViews": [
            { "buffer": 0, "byteOffset": 0, "byteLength": position_bytes, "target": 34962 },
            { "buffer": 0, "byteOffset": position_bytes, "byteLength": indices.len(), "target": 34963 }
        ],
        "buffers": [{
            "byteLength": buffer.len(),
            "uri": format!("data:application/octet-stream;base64,{}", base64(&buffer))
        }]
    });

    serde_json::to_string_pretty(&document).unwrap_or_else(|_| "{}".to_string())
}

/// The accessor counts a viewer will see, for the tests and for reporting.
pub fn summary(mesh: &Mesh) -> Value {
    json!({
        "vertices": mesh.vertices.len(),
        "edges": mesh.edges.len(),
        "indices": mesh.edges.len() * 2,
        "bytes": mesh.vertices.len() * 12 + mesh.edges.len() * 8
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Mesh {
        Mesh {
            vertices: vec![
                [0.0, 0.0, 0.0],
                [2.0, 0.0, 0.0],
                [0.0, 0.0, 2.5],
                [2.0, 0.0, 2.5],
            ],
            edges: vec![[0, 1], [2, 3], [0, 2], [1, 3]],
        }
    }

    #[test]
    fn base64_matches_known_encodings() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foob"), "Zm9vYg==");
        assert_eq!(base64(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn gltf_carries_the_wireframe_as_one_line_primitive() {
        let mesh = sample();
        let text = mesh_to_gltf(&mesh, "wall");
        let document: Value = serde_json::from_str(&text).expect("valid JSON");

        assert_eq!(document["asset"]["version"], "2.0");
        assert_eq!(document["meshes"][0]["primitives"][0]["mode"], 1);
        assert_eq!(document["meshes"][0]["primitives"][0]["attributes"]["POSITION"], 0);

        let accessors = document["accessors"].as_array().unwrap();
        assert_eq!(accessors[0]["count"], 4);
        assert_eq!(accessors[0]["type"], "VEC3");
        assert_eq!(accessors[1]["count"], 8);
        assert_eq!(accessors[1]["componentType"], 5125);

        // min/max must frame the mesh or viewers reject the file.
        assert_eq!(accessors[0]["min"], json!([0.0, 0.0, 0.0]));
        assert_eq!(accessors[0]["max"], json!([2.0, 0.0, 2.5]));

        // Positions plus indices, all present in the embedded buffer.
        let expected = 4 * 12 + 4 * 8;
        assert_eq!(document["buffers"][0]["byteLength"], expected);
        assert_eq!(document["bufferViews"][0]["byteLength"], 48);
        assert_eq!(document["bufferViews"][1]["byteLength"], 32);
        let uri = document["buffers"][0]["uri"].as_str().unwrap();
        assert!(uri.starts_with("data:application/octet-stream;base64,"));
        assert_eq!(summary(&mesh)["indices"], 8);
    }

    #[test]
    fn an_empty_mesh_still_emits_a_valid_document() {
        let mesh = Mesh { vertices: Vec::new(), edges: Vec::new() };
        let document: Value = serde_json::from_str(&mesh_to_gltf(&mesh, "empty")).expect("valid JSON");
        assert_eq!(document["accessors"][0]["count"], 0);
        assert_eq!(document["accessors"][0]["min"], json!([0.0, 0.0, 0.0]));
    }
}
