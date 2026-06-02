use axum::{
    extract::Multipart,
    routing::post,
    Router,
};
use image::DynamicImage;
use tower_http::services::ServeDir;
use uuid::Uuid;

#[derive(Clone, Debug)]
struct Line {
    x1: f32,
    y1: f32,
    x2: f32,
    y2: f32,
}

#[derive(Clone, Debug)]
struct Mesh {
    vertices: Vec<[f32; 3]>,
    edges: Vec<[usize; 2]>,
}

fn extract_lines(img: &DynamicImage) -> Vec<Line> {
    let gray = img.to_luma8();
    let mut lines = Vec::new();

    for y in 0..gray.height() {
        let mut start = None;

        for x in 0..gray.width() {
            let pixel = gray.get_pixel(x, y)[0];

            if pixel < 120 {
                if start.is_none() {
                    start = Some(x);
                }
            } else if let Some(s) = start {
                if x - s > 8 {
                    lines.push(Line {
                        x1: s as f32,
                        y1: y as f32,
                        x2: x as f32,
                        y2: y as f32,
                    });
                }
                start = None;
            }
        }
    }

    lines
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