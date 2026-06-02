use axum::{
    extract::Multipart,
    response::IntoResponse,
};

use crate::{
    vectorize,
    wireframe,
    obj,
};

pub async fn upload_file(
    mut multipart: Multipart,
) -> impl IntoResponse {

    let field =
        multipart.next_field()
        .await
        .unwrap()
        .unwrap();

    let bytes =
        field.bytes()
        .await
        .unwrap();

    let image =
        image::load_from_memory(&bytes)
            .unwrap();

    let lines =
        vectorize::extract_lines(&image);

    let mesh =
        wireframe::extrude(lines, 5.0);

    let output =
        obj::write_obj(mesh);

    std::fs::create_dir_all("outputs")
        .unwrap();

    let filename =
        format!("outputs/{}.obj",
            uuid::Uuid::new_v4());

    std::fs::write(
        &filename,
        output
    ).unwrap();

    format!("/{}", filename)
}