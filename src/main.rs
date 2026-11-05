mod detect;
mod gltf;
mod pdf;
mod plan;

use axum::{
    extract::Multipart,
    http::StatusCode,
    routing::post,
    Json,
    Router,
};
use detect::{detect_lines, DetectOptions, Line};
use image::DynamicImage;
use plan::{build_plan, Plan, PlanOptions};
use tower_http::services::ServeDir;
use uuid::Uuid;

#[derive(Clone, Debug)]
struct Mesh {
    vertices: Vec<[f32; 3]>,
    edges: Vec<[usize; 2]>,
}

fn extrude(lines: &[Line], depth: f32) -> Mesh {
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

    Mesh { vertices, edges }
}

fn mesh_to_obj(mesh: &Mesh) -> String {
    let mut out = String::new();

    for v in &mesh.vertices {
        out.push_str(&format!(
            "v {} {} {}\n",
            v[0], v[1], v[2]
        ));
    }

    for edge in &mesh.edges {
        out.push_str(&format!(
            "l {} {}\n",
            edge[0] + 1,
            edge[1] + 1
        ));
    }

    out
}

fn extract_lines(img: &DynamicImage) -> Vec<Line> {
    detect_lines(&img.to_luma8(), DetectOptions::default())
}

struct Cli {
    path: String,
    mm_per_px: f32,
    mm_per_pt: f32,
    page: usize,
    wall_height: f32,
    stud_spacing_mm: f32,
    json: bool,
    write_plan: Option<String>,
    gltf: Option<String>,
}

fn usage() -> &'static str {
    "usage:
  blueprint3d <image|plan.pdf> [--mm-per-px <mm>] [--mm-per-pt <mm>] [--page <n>]
                               [--wall-height <m>] [--stud-spacing <mm>]
                               [--gltf <model.gltf>] [--write-plan <plan.json>] [--json]
  blueprint3d                 start the web server on http://127.0.0.1:3000

  A PDF is read from its vector paths instead of its pixels; --mm-per-pt is
  millimetres of building per PDF point, 35.28 for a 1:100 plan."
}

/// `None` means "no image given": start the server.
fn parse_args(args: &[String]) -> Option<Cli> {
    let mut cli = Cli {
        path: String::new(),
        mm_per_px: 10.0,
        mm_per_pt: 35.28,
        page: 0,
        wall_height: 2.7,
        stud_spacing_mm: 406.0,
        json: false,
        write_plan: None,
        gltf: None,
    };

    let mut index = 0;
    while index < args.len() {
        let arg = args[index].as_str();
        match arg {
            "--mm-per-px" | "--mm-per-pt" | "--page" | "--wall-height" | "--stud-spacing"
            | "--write-plan" | "--gltf" => {
                index += 1;
                let value = match args.get(index) {
                    Some(value) => value.clone(),
                    None => {
                        eprintln!("{arg} needs a value\n\n{}", usage());
                        std::process::exit(2);
                    }
                };
                match arg {
                    "--mm-per-px" => cli.mm_per_px = value.parse().unwrap_or(cli.mm_per_px),
                    "--mm-per-pt" => cli.mm_per_pt = value.parse().unwrap_or(cli.mm_per_pt),
                    "--page" => cli.page = value.parse().unwrap_or(cli.page),
                    "--wall-height" => cli.wall_height = value.parse().unwrap_or(cli.wall_height),
                    "--stud-spacing" => {
                        cli.stud_spacing_mm = value.parse().unwrap_or(cli.stud_spacing_mm)
                    }
                    "--gltf" => cli.gltf = Some(value),
                    _ => cli.write_plan = Some(value),
                }
            }
            "--json" => cli.json = true,
            "--help" | "-h" => {
                println!("{}", usage());
                std::process::exit(0);
            }
            other if !other.starts_with('-') && cli.path.is_empty() => cli.path = other.to_string(),
            other => {
                eprintln!("unknown argument: {other}\n\n{}", usage());
                std::process::exit(2);
            }
        }
        index += 1;
    }

    if cli.path.is_empty() {
        None
    } else {
        Some(cli)
    }
}

fn print_plan(plan: &Plan) {
    let takeoff = plan.takeoff();

    println!(
        "\nplan {:.2} × {:.2} m at {:.1} mm/px, walls {:.2} m tall",
        plan.width_m, plan.depth_m, plan.scale_mm_per_px, plan.wall_height
    );
    println!(
        "walls: {} · {:.2} m total · {:.2} m² gross",
        plan.walls.len(),
        takeoff.wall_length,
        takeoff.wall_gross_area
    );

    println!("rooms: {}", plan.rooms.len());
    for room in &plan.rooms {
        println!(
            "  {:<8} {:>7.2} m²  perimeter {:>6.2} m  centre ({:.2}, {:.2})",
            room.name, room.area, room.perimeter, room.centroid.x, room.centroid.y
        );
    }

    println!(
        "floor {:.2} m² · volume {:.2} m³",
        takeoff.floor_area, takeoff.volume
    );
    println!(
        "finishes: {} drywall sheets · {} L paint · {:.2} m² flooring · {:.2} m baseboard",
        takeoff.drywall_sheets, takeoff.paint_litres, takeoff.flooring_m2, takeoff.baseboard_m
    );
    println!(
        "framing: {} studs at {:.0} mm · {:.2} m plates · {} sheathing panels",
        takeoff.studs, plan.stud_spacing_mm, takeoff.plates_m, takeoff.sheathing_panels
    );
}

/// Where the geometry came from. A PDF carries its own vectors; a raster has
/// to be read for ink.
enum Source {
    Image(DynamicImage),
    Pdf(pdf::PdfGeometry),
}

/// Read one drawing, report the plan, write the OBJ and glTF and (optionally)
/// the feature-suite plan JSON. A PDF is read from its vector paths, an image
/// from its ink; everything downstream is the same.
fn inspect(cli: Cli) {
    let is_pdf = cli.path.to_ascii_lowercase().ends_with(".pdf");

    let source = if is_pdf {
        let options = pdf::PdfOptions {
            page: cli.page,
            mm_per_pt: cli.mm_per_pt,
            ..Default::default()
        };
        match pdf::extract(&cli.path, options) {
            Ok(geometry) => Source::Pdf(geometry),
            Err(err) => {
                eprintln!("{err}");
                std::process::exit(1);
            }
        }
    } else {
        match image::open(&cli.path) {
            Ok(img) => Source::Image(img),
            Err(err) => {
                eprintln!("cannot read {}: {err}", cli.path);
                std::process::exit(1);
            }
        }
    };

    let (lines, width, height, mm_per_px) = match &source {
        Source::Image(img) => (
            extract_lines(img),
            img.width() as f32,
            img.height() as f32,
            cli.mm_per_px,
        ),
        Source::Pdf(geometry) => (
            geometry.lines.clone(),
            geometry.width_pt,
            geometry.height_pt,
            geometry.mm_per_pt,
        ),
    };

    let options = PlanOptions {
        mm_per_px,
        wall_height: cli.wall_height,
        stud_spacing_mm: cli.stud_spacing_mm,
        image_width: width.round() as u32,
        image_height: height.round() as u32,
        ..PlanOptions::default()
    };
    let plan = build_plan(&lines, options);

    println!("{}: {} segments", cli.path, lines.len());
    if let Source::Pdf(geometry) = &source {
        println!(
            "pdf: page {} of {} · {:.0} × {:.0} pt at {:.2} mm/pt · {} vector paths · {} curves",
            geometry.page_index + 1,
            geometry.pages,
            geometry.width_pt,
            geometry.height_pt,
            geometry.mm_per_pt,
            geometry.paths,
            geometry.curves
        );
    }
    for line in &lines {
        println!(
            "  ({:.1}, {:.1}) -> ({:.1}, {:.1})  len={:.1}",
            line.x1,
            line.y1,
            line.x2,
            line.y2,
            line.length()
        );
    }

    print_plan(&plan);

    let project = std::path::Path::new(&cli.path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("plan")
        .to_string();

    if let Some(path) = &cli.write_plan {
        if let Some(parent) = std::path::Path::new(path).parent() {
            if !parent.as_os_str().is_empty() {
                if let Err(err) = std::fs::create_dir_all(parent) {
                    eprintln!("cannot create {}: {err}", parent.display());
                }
            }
        }
        let json = serde_json::to_string_pretty(&plan.to_json(&project)).unwrap_or_default();
        match std::fs::write(path, json) {
            Ok(()) => println!("\nwrote {path} (plan JSON for the feature suites)"),
            Err(err) => eprintln!("cannot write {path}: {err}"),
        }
    }

    if cli.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&plan.to_json(&project)).unwrap_or_default()
        );
    }

    let mesh = extrude(&lines, 10.0);

    if let Err(err) = std::fs::create_dir_all("outputs") {
        eprintln!("cannot create outputs dir: {err}");
        return;
    }
    let out = format!("outputs/{}.obj", Uuid::new_v4());
    match std::fs::write(&out, mesh_to_obj(&mesh)) {
        Ok(()) => println!("wrote {out}"),
        Err(err) => eprintln!("cannot write {out}: {err}"),
    }

    let gltf_path = cli
        .gltf
        .clone()
        .unwrap_or_else(|| out.trim_end_matches(".obj").to_string() + ".gltf");
    match std::fs::write(&gltf_path, gltf::mesh_to_gltf(&mesh, &project)) {
        Ok(()) => {
            let summary = gltf::summary(&mesh);
            println!(
                "wrote {gltf_path} (glTF LINES: {} vertices, {} edges)",
                summary["vertices"], summary["edges"]
            );
        }
        Err(err) => eprintln!("cannot write {gltf_path}: {err}"),
    }
}

async fn upload_file(
    mut multipart: Multipart,
) -> Result<String, String> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No file uploaded")?;

    let bytes = field
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let image = image::load_from_memory(&bytes)
        .map_err(|e| e.to_string())?;

    let lines = extract_lines(&image);

    let mesh = extrude(&lines, 10.0);

    let obj = mesh_to_obj(&mesh);

    std::fs::create_dir_all("outputs")
        .map_err(|e| e.to_string())?;

    let filename = format!(
        "outputs/{}.obj",
        Uuid::new_v4()
    );

    std::fs::write(&filename, obj)
        .map_err(|e| e.to_string())?;

    Ok(format!("/{}", filename))
}

/// Upload one image and get back everything the studio draws: the plan the
/// extractor built, the takeoff that follows from it, and the OBJ to view.
/// Optional text fields `mmPerPx`, `wallHeight` and `studSpacing` override the
/// CLI defaults.
async fn api_plan(multipart: Multipart) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // `Result<_, String>` renders as 200 with the message as the body, which the
    // studio would read as success; a rejected upload has to fail as a status.
    plan_json(multipart)
        .await
        .map(Json)
        .map_err(|message| (StatusCode::BAD_REQUEST, message))
}

async fn plan_json(mut multipart: Multipart) -> Result<serde_json::Value, String> {
    let mut bytes: Option<axum::body::Bytes> = None;
    let mut name = String::from("plan");
    let mut mm_per_px = 10.0f32;
    let mut mm_per_pt = 35.28f32;
    let mut wall_height = 2.7f32;
    let mut stud_spacing = 406.0f32;

    while let Some(field) = multipart.next_field().await.map_err(|e| e.to_string())? {
        let field_name = field.name().unwrap_or("").to_string();
        if field.file_name().is_some() || field_name == "file" {
            name = field.file_name().unwrap_or("plan").to_string();
            bytes = Some(field.bytes().await.map_err(|e| e.to_string())?);
        } else {
            let text = field.text().await.map_err(|e| e.to_string())?;
            match field_name.as_str() {
                "mmPerPx" => mm_per_px = text.parse().unwrap_or(mm_per_px),
                "mmPerPt" => mm_per_pt = text.parse().unwrap_or(mm_per_pt),
                "wallHeight" => wall_height = text.parse().unwrap_or(wall_height),
                "studSpacing" => stud_spacing = text.parse().unwrap_or(stud_spacing),
                _ => {}
            }
        }
    }

    let bytes = bytes.ok_or("No file uploaded")?;
    // A PDF is read from its vector paths; note that this needs the pdfium
    // library at runtime, which the raster path never touches.
    let is_pdf = name.to_ascii_lowercase().ends_with(".pdf") || bytes.starts_with(b"%PDF");
    let (lines, width, height, mm_per_px) = if is_pdf {
        let temp = std::env::temp_dir().join(format!("blueprint3d-{}.pdf", Uuid::new_v4()));
        std::fs::write(&temp, &bytes).map_err(|e| e.to_string())?;
        let extracted = pdf::extract(
            &temp.to_string_lossy(),
            pdf::PdfOptions {
                mm_per_pt: mm_per_pt,
                ..Default::default()
            },
        );
        let _ = std::fs::remove_file(&temp);
        let geometry = extracted?;
        (geometry.lines, geometry.width_pt, geometry.height_pt, mm_per_pt)
    } else {
        let image = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
        let lines = extract_lines(&image);
        (
            lines,
            image.width() as f32,
            image.height() as f32,
            mm_per_px,
        )
    };

    let options = PlanOptions {
        mm_per_px,
        wall_height,
        stud_spacing_mm: stud_spacing,
        image_width: width.round() as u32,
        image_height: height.round() as u32,
        ..PlanOptions::default()
    };
    let plan = build_plan(&lines, options);
    let project = std::path::Path::new(&name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("plan")
        .to_string();

    let mesh = extrude(&lines, 10.0);
    std::fs::create_dir_all("outputs").map_err(|e| e.to_string())?;
    let filename = format!("outputs/{}.obj", Uuid::new_v4());
    std::fs::write(&filename, mesh_to_obj(&mesh)).map_err(|e| e.to_string())?;
    let gltf_filename = format!("outputs/{}.gltf", Uuid::new_v4());
    std::fs::write(&gltf_filename, gltf::mesh_to_gltf(&mesh, &project))
        .map_err(|e| e.to_string())?;

    let takeoff = plan.takeoff();
    let wall_rows: Vec<serde_json::Value> = plan
        .walls
        .iter()
        .map(|wall| {
            serde_json::json!({
                "x1": wall.x1, "y1": wall.y1, "x2": wall.x2, "y2": wall.y2, "length": wall.length
            })
        })
        .collect();
    let room_rows: Vec<serde_json::Value> = plan
        .rooms
        .iter()
        .map(|room| {
            serde_json::json!({
                "name": room.name,
                "area": room.area,
                "perimeter": room.perimeter,
                "centroid": [room.centroid.x, room.centroid.y],
                "polygon": room.polygon.iter().map(|point| serde_json::json!([point.x, point.y])).collect::<Vec<_>>()
            })
        })
        .collect();

    Ok(serde_json::json!({
        "project": project,
        "image": name,
        "mmPerPx": mm_per_px,
        "wallHeight": wall_height,
        "studSpacingMm": stud_spacing,
        "widthM": plan.width_m,
        "depthM": plan.depth_m,
        "segments": lines.len(),
        "obj": format!("/{filename}"),
        "gltf": format!("/{gltf_filename}"),
        "source": if is_pdf { "pdf" } else { "raster" },
        "plan": plan.to_json(&project),
        "walls": wall_rows,
        "rooms": room_rows,
        "takeoff": {
            "wallLength": takeoff.wall_length,
            "wallGrossArea": takeoff.wall_gross_area,
            "floorArea": takeoff.floor_area,
            "volume": takeoff.volume,
            "drywallSheets": takeoff.drywall_sheets,
            "paintLitres": takeoff.paint_litres,
            "flooringM2": takeoff.flooring_m2,
            "baseboardM": takeoff.baseboard_m,
            "studs": takeoff.studs,
            "platesM": takeoff.plates_m,
            "sheathingPanels": takeoff.sheathing_panels
        }
    }))
}

/// The routes, so the tests can drive the same app the server serves.
/// Nested at `/`, the static dir panics in axum 0.8, so it is the fallback.
fn app() -> Router {
    Router::new()
        .route("/upload", post(upload_file))
        .route("/api/plan", post(api_plan))
        .nest_service("/outputs", ServeDir::new("outputs"))
        .fallback_service(ServeDir::new("static"))
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    match parse_args(&args) {
        Some(cli) => {
            inspect(cli);
            return;
        }
        None if !args.is_empty() => {
            eprintln!("no image given\n\n{}", usage());
            std::process::exit(2);
        }
        None => {}
    }

    tracing_subscriber::fmt::init();

    std::fs::create_dir_all("outputs")
        .expect("Failed to create outputs dir");

    let app = app();

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(3000);

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .unwrap();

    println!("Running on http://127.0.0.1:{port}");

    axum::serve(listener, app)
        .await
        .unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{header, Request, StatusCode};
    use serde_json::Value;
    use tower::ServiceExt;

    const BOUNDARY: &str = "blueprint3d-test-boundary";

    /// A multipart body the way the studio's FormData posts it: one image file
    /// plus the three numeric overrides.
    fn multipart(file_name: &str, bytes: &[u8], texts: &[(&str, &str)]) -> Vec<u8> {
        let mut body = Vec::new();
        body.extend_from_slice(
            format!(
                "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; \
                 filename=\"{file_name}\"\r\nContent-Type: image/png\r\n\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(bytes);
        body.extend_from_slice(b"\r\n");
        for (key, value) in texts {
            body.extend_from_slice(
                format!(
                    "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n"
                )
                .as_bytes(),
            );
        }
        body.extend_from_slice(format!("--{BOUNDARY}--\r\n").as_bytes());
        body
    }

    async fn post_plan(fixture: &str) -> (StatusCode, Value) {
        let bytes = std::fs::read(fixture).unwrap_or_else(|err| panic!("read {fixture}: {err}"));
        let name = std::path::Path::new(fixture)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("plan.png");
        let body = multipart(
            name,
            &bytes,
            &[("mmPerPx", "10"), ("wallHeight", "2.7"), ("studSpacing", "406")],
        );

        let request = Request::builder()
            .method("POST")
            .uri("/api/plan")
            .header(
                header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={BOUNDARY}"),
            )
            .body(Body::from(body))
            .expect("build request");

        let response = app().oneshot(request).await.expect("router call");
        let status = response.status();
        let raw = axum::body::to_bytes(response.into_body(), 8 * 1024 * 1024)
            .await
            .expect("read body");
        let json = serde_json::from_slice(&raw).unwrap_or_else(|err| {
            panic!(
                "{fixture}: /api/plan did not return JSON ({err}): {}",
                String::from_utf8_lossy(&raw)
            )
        });
        (status, json)
    }

    /// POST a fixture, assert the whole contract the studio relies on, and hand
    /// back the JSON. The OBJ it wrote is deleted again so the repo stays clean.
    async fn checked_plan(fixture: &str) -> Value {
        let (status, json) = post_plan(fixture).await;
        assert_eq!(status, StatusCode::OK, "{fixture}: {json}");

        // The overrides are f32 on the server, so compare with a tolerance
        // rather than against f64 literals (2.7f32, not exactly 2.7).
        let near = |key: &str, want: f64| {
            let value = json[key].as_f64().unwrap_or(f64::NAN);
            assert!(
                (value - want).abs() < 1e-4,
                "{fixture}: {key} was {value}, wanted {want}"
            );
        };
        near("mmPerPx", 10.0);
        near("wallHeight", 2.7);
        near("studSpacingMm", 406.0);
        assert!(json["segments"].as_u64().unwrap_or(0) > 0, "{fixture}: no segments");
        assert!(json["widthM"].as_f64().unwrap_or(0.0) > 0.0, "{fixture}: widthM");
        assert!(json["depthM"].as_f64().unwrap_or(0.0) > 0.0, "{fixture}: depthM");

        let walls = json["walls"].as_array().expect("walls array");
        let rooms = json["rooms"].as_array().expect("rooms array");
        assert!(!walls.is_empty(), "{fixture}: no walls detected");
        assert!(!rooms.is_empty(), "{fixture}: no rooms closed");

        for wall in walls {
            assert!(wall["length"].as_f64().unwrap_or(0.0) > 0.0, "{fixture}: zero wall");
        }
        for room in rooms {
            assert!(room["area"].as_f64().unwrap_or(0.0) > 0.0, "{fixture}: zero room");
            assert!(
                room["polygon"].as_array().map(Vec::len).unwrap_or(0) >= 3,
                "{fixture}: room polygon under 3 points"
            );
        }

        // The takeoff has to follow the geometry it is derived from.
        let takeoff = &json["takeoff"];
        let wall_length = takeoff["wallLength"].as_f64().expect("wallLength");
        let wall_sum: f64 = walls
            .iter()
            .map(|wall| wall["length"].as_f64().unwrap())
            .sum();
        assert!(
            (wall_length - wall_sum).abs() < 1e-3,
            "{fixture}: wallLength {wall_length} != sum of walls {wall_sum}"
        );
        let floor = takeoff["floorArea"].as_f64().expect("floorArea");
        let room_sum: f64 = rooms
            .iter()
            .map(|room| room["area"].as_f64().unwrap())
            .sum();
        assert!(
            (floor - room_sum).abs() < 1e-3,
            "{fixture}: floorArea {floor} != sum of rooms {room_sum}"
        );
        assert!(
            (takeoff["volume"].as_f64().unwrap() - floor * 2.7).abs() < 5e-2,
            "{fixture}: volume"
        );

        // The plan JSON the ports read, and the OBJ the canvas draws.
        let plan_walls = json["plan"]["walls"].as_array().expect("plan.walls");
        let plan_rooms = json["plan"]["rooms"].as_array().expect("plan.rooms");
        assert_eq!(plan_walls.len(), walls.len(), "{fixture}: plan vs walls");
        assert_eq!(plan_rooms.len(), rooms.len(), "{fixture}: plan vs rooms");

        let obj = json["obj"].as_str().expect("obj");
        assert!(obj.starts_with("/outputs/"), "{fixture}: obj path {obj}");
        let path = obj.trim_start_matches('/');
        let text = std::fs::read_to_string(path)
            .unwrap_or_else(|err| panic!("{fixture}: read {path}: {err}"));
        assert!(
            text.starts_with("v "),
            "{fixture}: {path} is not an OBJ"
        );
        let vertices = text.lines().filter(|line| line.starts_with("v ")).count();
        let edges = text.lines().filter(|line| line.starts_with("l ")).count();
        assert_eq!(
            edges,
            walls.len() * 4,
            "{fixture}: {path} should have 4 edges per wall"
        );
        let _ = std::fs::remove_file(path);

        // The glTF the studio offers must describe the same line set.
        assert_eq!(json["source"], "raster", "{fixture}: source");
        let gltf = json["gltf"].as_str().expect("gltf");
        assert!(gltf.starts_with("/outputs/"), "{fixture}: gltf path {gltf}");
        let gltf_path = gltf.trim_start_matches('/');
        let document: Value = serde_json::from_str(
            &std::fs::read_to_string(gltf_path)
                .unwrap_or_else(|err| panic!("{fixture}: read {gltf_path}: {err}")),
        )
        .unwrap_or_else(|err| panic!("{fixture}: {gltf_path} is not JSON: {err}"));

        assert_eq!(document["asset"]["version"], "2.0");
        assert_eq!(document["meshes"][0]["primitives"][0]["mode"], 1);
        assert_eq!(document["accessors"][0]["count"], vertices);
        assert_eq!(document["accessors"][1]["count"], edges * 2);
        assert_eq!(
            document["buffers"][0]["byteLength"],
            vertices * 12 + edges * 8,
            "{fixture}: glTF buffer size"
        );
        let _ = std::fs::remove_file(gltf_path);

        json
    }

    #[tokio::test]
    async fn api_plan_reads_the_floor_fixture() {
        let json = checked_plan("fixtures/floor_plan.png").await;
        assert_eq!(json["project"], "floor_plan");
        assert_eq!(json["walls"].as_array().unwrap().len(), 7, "walls");
        assert_eq!(json["rooms"].as_array().unwrap().len(), 2, "rooms");
        let floor = json["takeoff"]["floorArea"].as_f64().unwrap();
        assert!((floor - 32.99).abs() < 0.05, "floorArea {floor}");
    }

    #[tokio::test]
    async fn api_plan_reads_the_angled_fixture() {
        let json = checked_plan("fixtures/angled_plan.png").await;
        assert_eq!(json["project"], "angled_plan");
        assert!(
            json["walls"].as_array().unwrap().len() >= 5,
            "angled plan should keep its diagonal walls: {}",
            json["walls"]
        );
        let diagonal = json["walls"].as_array().unwrap().iter().any(|wall| {
            let dx = wall["x2"].as_f64().unwrap() - wall["x1"].as_f64().unwrap();
            let dy = wall["y2"].as_f64().unwrap() - wall["y1"].as_f64().unwrap();
            dx.abs() > 0.05 && dy.abs() > 0.05
        });
        assert!(diagonal, "angled plan lost its diagonal wall: {}", json["walls"]);
    }
}
