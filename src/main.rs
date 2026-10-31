mod detect;

use axum::{
    extract::Multipart,
    routing::post,
    Router,
};
use detect::{detect_lines, DetectOptions, Line};
use image::DynamicImage;
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

/// Run detection on a single image and report the segments, so fixture results
/// can be compared without going through the browser.
fn detect_cli(path: &str) {
    let img = match image::open(path) {
        Ok(img) => img,
        Err(err) => {
            eprintln!("cannot read {path}: {err}");
            std::process::exit(1);
        }
    };

    let lines = extract_lines(&img);

    println!("{path}: {} segments", lines.len());
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

#[tokio::main]
async fn main() {
    // `cargo run -- <image>` inspects one image; no argument starts the server.
    if let Some(path) = std::env::args().nth(1) {
        detect_cli(&path);
        return;
    }

    tracing_subscriber::fmt::init();

    std::fs::create_dir_all("outputs")
        .expect("Failed to create outputs dir");

    let app = Router::new()
        .route("/upload", post(upload_file))
        .nest_service(
            "/outputs",
            ServeDir::new("outputs"),
        )
        .nest_service(
            "/",
            ServeDir::new("static"),
        );

    let listener = tokio::net::TcpListener::bind(
        "127.0.0.1:3000",
    )
    .await
    .unwrap();

    println!("Running on http://127.0.0.1:3000");

    axum::serve(listener, app)
        .await
        .unwrap();
}
