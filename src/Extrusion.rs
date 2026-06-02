pub fn extrude(
    lines: &[Line],
    depth: f32,
) -> Mesh {

    let mut vertices = Vec::new();
    let mut edges = Vec::new();

    for line in lines {

        let base = vertices.len();

        vertices.push([line.x1, line.y1, 0.0]);
        vertices.push([line.x2, line.y2, 0.0]);

        vertices.push([line.x1, line.y1, depth]);
        vertices.push([line.x2, line.y2, depth]);

        edges.push([base, base + 1]);
        edges.push([base + 2, base + 3]);

        edges.push([base, base + 2]);
        edges.push([base + 1, base + 3]);
    }

    Mesh {
        vertices,
        edges,
    }
}