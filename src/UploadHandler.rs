pub async fn upload_file(
    mut multipart: Multipart,
) -> Result<String, String> {

    let field = multipart
        .next_field()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("missing file")?;

    let bytes = field
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let image =
        image::load_from_memory(&bytes)
            .map_err(|e| e.to_string())?;

    let lines =
        extract_lines(&image);

    let mesh =
        extrude(&lines, 5.0);

    let obj =
        mesh_to_obj(&mesh);

    let id =
        uuid::Uuid::new_v4();

    let path =
        format!("outputs/{}.obj", id);

    std::fs::create_dir_all("outputs")
        .map_err(|e| e.to_string())?;

    std::fs::write(&path, obj)
        .map_err(|e| e.to_string())?;

    Ok(path)
}