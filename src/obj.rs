use crate::wireframe::Mesh;

pub fn write_obj(
    mesh: Mesh
) -> String {

    let mut out = String::new();

    for v in &mesh.vertices {

        out.push_str(
            &format!(
                "v {} {} {}\n",
                v[0], v[1], v[2]
            )
        );
    }

    for e in &mesh.edges {

        out.push_str(
            &format!(
                "l {} {}\n",
                e[0] + 1,
                e[1] + 1
            )
        );
    }

    out
}