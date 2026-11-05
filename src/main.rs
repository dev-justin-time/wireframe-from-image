mod detect;
mod gltf;
mod pdf;
mod plan;

use axum::{
    extract::{DefaultBodyLimit, Multipart, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json,
    Router,
};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tower_http::trace::{DefaultMakeSpan, DefaultOnFailure, DefaultOnResponse, TraceLayer};
use tracing::Level;
use detect::{detect_lines, DetectOptions, Line};
use image::DynamicImage;
use plan::{build_plan, build_plan_inked, Ink, OpeningKind, Plan, PlanOptions};
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
    mm_per_pt_given: bool,
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

  A PDF is read from its vector paths instead of its pixels. Without --mm-per-pt
  the scale is read from the drawing's own dimension strings, and falls back to
  35.28 mm/pt (a 1:100 plan) when the page has none."
}

/// `None` means "no image given": start the server.
fn parse_args(args: &[String]) -> Option<Cli> {
    let mut cli = Cli {
        path: String::new(),
        mm_per_px: 10.0,
        mm_per_pt: 35.28,
        mm_per_pt_given: false,
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
                    "--mm-per-pt" => {
                        cli.mm_per_pt = value.parse().unwrap_or(cli.mm_per_pt);
                        cli.mm_per_pt_given = true;
                    }
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

    let doors = plan
        .openings
        .iter()
        .filter(|opening| opening.kind == OpeningKind::Door)
        .count();
    let windows = plan.openings.len() - doors;
    println!(
        "openings: {doors} doors · {windows} windows · net wall area {:.2} m² of {:.2} m² gross",
        takeoff.wall_net_area, takeoff.wall_gross_area
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

    let mut source = if is_pdf {
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

    // A PDF may write its scale on the sheet: read it off the dimension strings
    // unless the caller pinned one.
    if !cli.mm_per_pt_given {
        if let Source::Pdf(geometry) = &mut source {
            let options = pdf::PdfOptions {
                page: cli.page,
                mm_per_pt: cli.mm_per_pt,
                ..Default::default()
            };
            if let Some(guess) = pdf::scale_from_dimensions(&cli.path, options, geometry) {
                geometry.mm_per_pt = guess.mm_per_pt;
                println!(
                    "pdf: scale {:.2} mm/pt from {} dimension strings (e.g. {:?})",
                    guess.mm_per_pt, guess.samples, guess.text
                );
            }
        }
    }

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
    // A raster carries the symbols drawn in each opening; a PDF's are only in a
    // rendering of the page, which costs a little and is skipped if it fails.
    let mm_per_line = options.mm_per_px;
    let plan = match &source {
        Source::Image(img) => {
            let luma = img.to_luma8();
            let mask = detect::ink_mask(&luma);
            build_plan_inked(
                &lines,
                options,
                Some(Ink {
                    mask: &mask,
                    width: luma.width(),
                    height: luma.height(),
                    mm_per_px: mm_per_line,
                    filter_walls: true,
                }),
            )
        }
        Source::Pdf(_) => {
            let rendered = pdf::ink(
                &cli.path,
                pdf::PdfOptions {
                    page: cli.page,
                    mm_per_pt: mm_per_px,
                    ..Default::default()
                },
                PDF_INK_WIDTH,
            )
            .map(|ink| (ink.mask, ink.width, ink.height, ink.mm_per_px));
            match rendered {
                Some((mask, width, height, scale)) => build_plan_inked(
                    &lines,
                    options,
                    Some(Ink {
                        mask: &mask,
                        width,
                        height,
                        mm_per_px: scale,
                        // A PDF's lines are read from its vectors, so its ink is
                        // only asked which strokes are thinner than its walls.
                        filter_walls: true,
                    }),
                ),
                None => build_plan(&lines, options),
            }
        }
    };

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

/// Width a PDF page is rendered to when its ink is read for the opening symbols.
/// Fine enough for a 0.9 m window to be about a hundred pixels; the render caps
/// the scale factor so a large sheet stays a few megapixels.
const PDF_INK_WIDTH: f32 = 2000.0;

/// Largest upload accepted for one drawing. A 600 dpi A0 scan is around 20 MB
/// and a multi-sheet PDF set passes 40 MB, so the cap is generous. Axum's body
/// limit enforces it before a request is buffered; the handler checks the
/// decoded length as well, so a disabled or raised limit cannot slip a giant
/// file into memory unnoticed.
const DEFAULT_MAX_UPLOAD_MB: usize = 48;

/// Blocking extraction slots. Detection is CPU-bound, so a burst of uploads
/// queues here instead of starving the async runtime.
const MIN_EXTRACTION_SLOTS: usize = 2;

/// How long one drawing may take before the client is given up on. The blocking
/// task is not cancelled (interrupting PDFium mid-parse is not safe); it simply
/// stops holding the request.
const EXTRACTION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(120);

#[derive(Clone)]
struct AppState {
    /// Permits for the blocking extraction work.
    extraction: Arc<Semaphore>,
    /// Bytes accepted for one upload.
    max_upload_bytes: usize,
}

impl AppState {
    fn new() -> Self {
        let megabytes = std::env::var("MAX_UPLOAD_MB")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .filter(|megabytes| *megabytes > 0)
            .unwrap_or(DEFAULT_MAX_UPLOAD_MB);
        let slots = std::env::var("EXTRACTION_CONCURRENCY")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .filter(|slots| *slots > 0)
            .unwrap_or_else(|| {
                std::thread::available_parallelism()
                    .map(|count| count.get())
                    .unwrap_or(MIN_EXTRACTION_SLOTS)
                    .max(MIN_EXTRACTION_SLOTS)
            });
        AppState::with_limits(megabytes.saturating_mul(1024 * 1024), slots)
    }

    fn with_limits(max_upload_bytes: usize, slots: usize) -> Self {
        AppState {
            extraction: Arc::new(Semaphore::new(slots.max(1))),
            max_upload_bytes,
        }
    }
}

/// A failed request, with the status the client should see.
///
/// `Result<_, String>` renders as 200 with the message as the body, which a
/// client reads as success — every handler failure goes through this instead, so
/// a rejected drawing cannot be mistaken for a converted one.
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self { status, message: message.into() }
    }

    fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    fn unprocessable(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNPROCESSABLE_ENTITY, message)
    }

    fn unsupported(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNSUPPORTED_MEDIA_TYPE, message)
    }

    fn too_large(limit: usize) -> Self {
        Self::new(
            StatusCode::PAYLOAD_TOO_LARGE,
            format!(
                "the upload is larger than the {limit} byte limit; raise MAX_UPLOAD_MB \
                 or send one drawing at a time"
            ),
        )
    }

    fn unavailable(message: impl Into<String>) -> Self {
        Self::new(StatusCode::SERVICE_UNAVAILABLE, message)
    }

    fn internal(message: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        tracing::warn!(status = self.status.as_u16(), reason = %self.message, "request failed");
        (self.status, self.message).into_response()
    }
}

/// A multipart read that failed: a body over the limit is 413, anything else is
/// a malformed request. Axum reports the overrun as a parse failure, so the
/// status is read from the error rather than guessed from its message.
fn multipart_failure(err: axum::extract::multipart::MultipartError) -> ApiError {
    let message = err.to_string();
    if err.status() == StatusCode::PAYLOAD_TOO_LARGE {
        ApiError::new(
            StatusCode::PAYLOAD_TOO_LARGE,
            format!("the upload exceeds the server's size limit: {message}"),
        )
    } else {
        ApiError::bad_request(format!("cannot read the upload: {message}"))
    }
}

/// The size a request declares before its body is read, when it declares one.
fn declared_length(headers: &HeaderMap) -> Option<usize> {
    headers
        .get(header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<usize>().ok())
}

/// Reject an upload the server will not accept, before buffering any of it.
fn check_declared_length(headers: &HeaderMap, limit: usize) -> Result<(), ApiError> {
    match declared_length(headers) {
        Some(length) if length > limit => Err(ApiError::too_large(limit)),
        _ => Ok(()),
    }
}

/// Run CPU-bound work (decode, detect, build, export) on the blocking pool, with
/// a permit and a deadline.
///
/// Hough accumulation over a 600 dpi page takes longer than a millisecond, and
/// awaiting it on the async runtime blocks every other request for the duration:
/// the whole point of the split is that the executor stays free while a drawing
/// is read.
async fn run_blocking<T, F>(state: &AppState, work: F) -> Result<T, ApiError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, ApiError> + Send + 'static,
{
    let permit = state
        .extraction
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| ApiError::internal("the extraction pool is closed"))?;

    let task = tokio::task::spawn_blocking(move || {
        let result = work();
        drop(permit);
        result
    });

    match tokio::time::timeout(EXTRACTION_TIMEOUT, task).await {
        Err(_) => Err(ApiError::new(
            StatusCode::GATEWAY_TIMEOUT,
            "reading the drawing took longer than the server allows",
        )),
        Ok(Err(err)) => Err(ApiError::internal(format!("the extraction task failed: {err}"))),
        Ok(Ok(result)) => result,
    }
}

fn number_field(text: &str, field: &str, default: f32) -> Result<f32, ApiError> {
    let text = text.trim();
    if text.is_empty() {
        return Ok(default);
    }
    let value: f32 = text
        .parse()
        .map_err(|_| ApiError::unprocessable(format!("{field} must be a number, got {text:?}")))?;
    if !value.is_finite() || value <= 0.0 {
        return Err(ApiError::unprocessable(format!(
            "{field} must be greater than zero, got {text:?}"
        )));
    }
    Ok(value)
}

/// Upload one image and get back the path of the generated OBJ under /outputs/,
/// the workflow the readme documents with `curl -F file=@plan.png`. A PDF is not
/// an image: it goes to /api/plan, which reads its vector paths.
async fn upload_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<String, ApiError> {
    check_declared_length(&headers, state.max_upload_bytes)?;
    let field = multipart
        .next_field()
        .await
        .map_err(multipart_failure)?
        .ok_or_else(|| ApiError::unprocessable("no file in the multipart body"))?;
    let name = field.file_name().unwrap_or("plan.png").to_string();
    let bytes = field.bytes().await.map_err(multipart_failure)?;

    if bytes.len() > state.max_upload_bytes {
        return Err(ApiError::too_large(state.max_upload_bytes));
    }
    if bytes.starts_with(b"%PDF") {
        return Err(ApiError::unsupported(
            "this endpoint reads images; send a PDF to /api/plan",
        ));
    }

    let path = run_blocking(&state, move || {
        let image = image::load_from_memory(&bytes)
            .map_err(|err| ApiError::unsupported(format!("cannot read {name} as an image: {err}")))?;
        let lines = extract_lines(&image);
        let obj = mesh_to_obj(&extrude(&lines, 10.0));

        std::fs::create_dir_all("outputs")
            .map_err(|err| ApiError::internal(format!("cannot create outputs: {err}")))?;
        let filename = format!("outputs/{}.obj", Uuid::new_v4());
        std::fs::write(&filename, obj)
            .map_err(|err| ApiError::internal(format!("cannot write {filename}: {err}")))?;
        Ok(format!("/{filename}"))
    })
    .await?;

    Ok(path)
}

/// One upload, read off the multipart body.
struct Upload {
    bytes: axum::body::Bytes,
    name: String,
    mm_per_px: f32,
    mm_per_pt: f32,
    /// The caller sent `mmPerPt=auto`: take the scale from the drawing itself.
    mm_per_pt_auto: bool,
    /// The caller pinned `mmPerPt` themselves, rather than leaving the default.
    mm_per_pt_given: bool,
    wall_height: f32,
    stud_spacing: f32,
}

async fn read_upload(
    mut multipart: Multipart,
    headers: &HeaderMap,
    max_upload_bytes: usize,
) -> Result<Upload, ApiError> {
    check_declared_length(headers, max_upload_bytes)?;
    let mut bytes: Option<axum::body::Bytes> = None;
    let mut name = String::from("plan");
    let mut mm_per_px = 10.0f32;
    let mut mm_per_pt = 35.28f32;
    let mut mm_per_pt_auto = false;
    let mut mm_per_pt_given = false;
    let mut wall_height = 2.7f32;
    let mut stud_spacing = 406.0f32;

    while let Some(field) = multipart.next_field().await.map_err(multipart_failure)? {
        let field_name = field.name().unwrap_or("").to_string();
        if field.file_name().is_some() || field_name == "file" {
            name = field.file_name().unwrap_or("plan").to_string();
            let data = field.bytes().await.map_err(multipart_failure)?;
            if data.len() > max_upload_bytes {
                return Err(ApiError::too_large(max_upload_bytes));
            }
            bytes = Some(data);
        } else {
            let text = field.text().await.map_err(multipart_failure)?;
            match field_name.as_str() {
                "mmPerPx" => mm_per_px = number_field(&text, "mmPerPx", mm_per_px)?,
                "mmPerPt" => {
                    if text.trim().eq_ignore_ascii_case("auto") {
                        mm_per_pt_auto = true;
                    } else {
                        mm_per_pt = number_field(&text, "mmPerPt", mm_per_pt)?;
                        mm_per_pt_given = true;
                    }
                }
                "wallHeight" => wall_height = number_field(&text, "wallHeight", wall_height)?,
                "studSpacing" => stud_spacing = number_field(&text, "studSpacing", stud_spacing)?,
                _ => {}
            }
        }
    }

    let bytes = bytes.ok_or_else(|| ApiError::unprocessable("no file in the multipart body"))?;
    Ok(Upload {
        bytes,
        name,
        mm_per_px,
        mm_per_pt,
        mm_per_pt_auto,
        mm_per_pt_given,
        wall_height,
        stud_spacing,
    })
}

/// Upload one drawing and get back everything the studio draws: the plan the
/// extractor built (openings included), the takeoff that follows from it, and
/// the OBJ and glTF to draw. A PDF is read from its vector paths, an image from
/// its ink; everything downstream is the same.
async fn api_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Json<serde_json::Value>, ApiError> {
    let upload = read_upload(multipart, &headers, state.max_upload_bytes).await?;
    let report = run_blocking(&state, move || plan_report(upload)).await?;
    Ok(Json(report))
}

/// The extraction itself: blocking, filesystem-touching, and independent of the
/// request so it can run off the async runtime.
fn plan_report(upload: Upload) -> Result<serde_json::Value, ApiError> {
    let Upload {
        bytes,
        name,
        mm_per_px,
        mm_per_pt,
        mm_per_pt_auto,
        mm_per_pt_given,
        wall_height,
        stud_spacing,
    } = upload;

    // A PDF is read from its vector paths; note that this needs the pdfium
    // library at runtime, which the raster path never touches.
    let is_pdf = name.to_ascii_lowercase().ends_with(".pdf") || bytes.starts_with(b"%PDF");
    // Where the scale came from, so the report can say so.
    let mut scale_source = if mm_per_pt_given { "given" } else { "default" };
    let (lines, width, height, mm_per_px, raster) = if is_pdf {
        let temp = std::env::temp_dir().join(format!("blueprint3d-{}.pdf", Uuid::new_v4()));
        std::fs::write(&temp, &bytes)
            .map_err(|err| ApiError::internal(format!("cannot stage the upload: {err}")))?;
        let path = temp.to_string_lossy().to_string();
        let options = pdf::PdfOptions {
            mm_per_pt,
            ..Default::default()
        };
        let extracted = pdf::extract(&path, options);
        let mut geometry = extracted.map_err(|err| {
            let _ = std::fs::remove_file(&temp);
            if err.contains("pdfium is not available") {
                ApiError::unavailable(err)
            } else {
                ApiError::bad_request(err)
            }
        })?;
        // Unless the caller pinned a scale, read it off the sheet's own
        // dimension strings; the default is only the fallback.
        if mm_per_pt_auto {
            scale_source = "default";
            if let Some(guess) = pdf::scale_from_dimensions(&path, options, &geometry) {
                geometry.mm_per_pt = guess.mm_per_pt;
                scale_source = "dimension";
                tracing::info!(
                    mm_per_pt = guess.mm_per_pt,
                    samples = guess.samples,
                    text = %guess.text,
                    "scale read from the drawing's dimension strings"
                );
            } else {
                tracing::info!("no dimension strings to read a scale from; using the default");
            }
        }
        let mm_per_pt = geometry.mm_per_pt;
        // Its paths do not carry stroke widths; a rendering does.
        let raster = pdf::ink(&path, pdf::PdfOptions { mm_per_pt, ..Default::default() }, PDF_INK_WIDTH)
            .map(|ink| (ink.mask, ink.width, ink.height, ink.mm_per_px));
        let _ = std::fs::remove_file(&temp);
        (geometry.lines, geometry.width_pt, geometry.height_pt, mm_per_pt, raster)
    } else {
        let image = image::load_from_memory(&bytes).map_err(|err| {
            ApiError::unsupported(format!("cannot read {name} as an image: {err}"))
        })?;
        // The same ink the detector read, kept for the plan builder: the swing
        // arcs and glazing lines in an opening are only in the pixels.
        let luma = image.to_luma8();
        let mask = detect::ink_mask(&luma);
        let lines = extract_lines(&image);
        (
            lines,
            image.width() as f32,
            image.height() as f32,
            mm_per_px,
            Some((mask, luma.width(), luma.height(), mm_per_px)),
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
    let plan = match &raster {
        Some((mask, ink_width, ink_height, ink_scale)) => build_plan_inked(
            &lines,
            options,
            Some(Ink {
                mask,
                width: *ink_width,
                height: *ink_height,
                mm_per_px: *ink_scale,
                // The ink also says which strokes are drawn rather than built,
                // in a rendering as in a raster: glazing, a leaf, a dimension.
                filter_walls: true,
            }),
        ),
        None => build_plan(&lines, options),
    };
    let project = std::path::Path::new(&name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("plan")
        .to_string();

    let mesh = extrude(&lines, 10.0);
    std::fs::create_dir_all("outputs")
        .map_err(|err| ApiError::internal(format!("cannot create outputs: {err}")))?;
    let filename = format!("outputs/{}.obj", Uuid::new_v4());
    std::fs::write(&filename, mesh_to_obj(&mesh))
        .map_err(|err| ApiError::internal(format!("cannot write {filename}: {err}")))?;
    let gltf_filename = format!("outputs/{}.gltf", Uuid::new_v4());
    std::fs::write(&gltf_filename, gltf::mesh_to_gltf(&mesh, &project))
        .map_err(|err| ApiError::internal(format!("cannot write {gltf_filename}: {err}")))?;

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
    let opening_rows: Vec<serde_json::Value> = plan
        .openings
        .iter()
        .map(|opening| {
            serde_json::json!({
                "kind": opening.kind.name(),
                "x1": opening.x1, "y1": opening.y1, "x2": opening.x2, "y2": opening.y2,
                "width": opening.width,
                "sill": opening.sill,
                "head": opening.head,
                "area": opening.area()
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
        "scaleSource": scale_source,
        "plan": plan.to_json(&project),
        "walls": wall_rows,
        "rooms": room_rows,
        "openings": opening_rows,
        "takeoff": {
            "wallLength": takeoff.wall_length,
            "wallGrossArea": takeoff.wall_gross_area,
            "openingArea": takeoff.opening_area,
            "wallNetArea": takeoff.wall_net_area,
            "doors": takeoff.doors,
            "windows": takeoff.windows,
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

/// What the server can actually do, so a deployment can be checked before it is
/// trusted with a drawing: PDF reading depends on a runtime library that may not
/// be installed.
async fn health(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "raster": true,
        "pdf": pdf::available(),
        "maxUploadBytes": state.max_upload_bytes,
        "extractionSlots": state.extraction.available_permits()
    }))
}

/// Ctrl-C on every platform, and SIGTERM where it exists, so a supervisor can
/// drain in-flight requests instead of killing them.
async fn shutdown_signal() {
    let interrupt = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut signal) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            signal.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = interrupt => {}
        _ = terminate => {}
    }
    tracing::info!("shutdown signal received, finishing in-flight requests");
}

/// The routes, so the tests can drive the same app the server serves.
/// Nested at `/`, the static dir panics in axum 0.8, so it is the fallback.
/// The server as `main` runs it. Only the request tests call this directly; the
/// binary builds it through `app_with`, which is why it is test-only.
#[cfg(test)]
fn app() -> Router {
    app_with(AppState::new())
}

fn app_with(state: AppState) -> Router {
    let body_limit = state.max_upload_bytes;
    Router::new()
        .route("/healthz", get(health))
        .route("/upload", post(upload_file))
        .route("/api/plan", post(api_plan))
        .nest_service("/outputs", ServeDir::new("outputs"))
        .fallback_service(ServeDir::new("static"))
        .with_state(state)
        .layer(DefaultBodyLimit::max(body_limit))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO))
                .on_failure(DefaultOnFailure::new().level(Level::ERROR)),
        )
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

    if let Err(err) = std::fs::create_dir_all("outputs") {
        eprintln!("cannot create outputs dir: {err}");
        std::process::exit(1);
    }

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port: u16 = match std::env::var("PORT") {
        Ok(value) => match value.parse() {
            Ok(port) => port,
            Err(_) => {
                eprintln!("PORT must be a number, got {value:?}");
                std::process::exit(2);
            }
        },
        Err(_) => 3000,
    };

    let state = AppState::new();
    let listener = match tokio::net::TcpListener::bind((host.as_str(), port)).await {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!("cannot listen on {host}:{port}: {err}");
            std::process::exit(1);
        }
    };

    tracing::info!(
        %host,
        port,
        pdf = pdf::available(),
        slots = state.extraction.available_permits(),
        max_upload_bytes = state.max_upload_bytes,
        "blueprint3d studio"
    );
    println!("Running on http://{host}:{port}");

    if let Err(err) = axum::serve(listener, app_with(state))
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        eprintln!("server stopped: {err}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    /// The PDF fixture, read the way the server reads one: the walls from the
    /// vector paths, the symbols from a rendering of the page, and the scale
    /// from the dimension strings written on the sheet.
    #[test]
    fn the_pdf_fixture_reads_its_symbols_and_its_scale() {
        if !pdf::available() {
            eprintln!("skipped: pdfium is not installed, so no page can be read");
            return;
        }
        let path = "fixtures/symbol_plan.pdf";
        let options = pdf::PdfOptions::default();
        let geometry = pdf::extract(path, options).expect("read the pdf fixture");
        let guess =
            pdf::scale_from_dimensions(path, options, &geometry).expect("a scale from the dimension strings");
        assert!(
            (guess.mm_per_pt - 13.333).abs() < 0.2,
            "10 mm/px printed at 96 dpi is 13.333 mm/pt, read {:.2} from {} strings ({})",
            guess.mm_per_pt,
            guess.samples,
            guess.text
        );

        let ink = pdf::ink(
            path,
            pdf::PdfOptions { mm_per_pt: guess.mm_per_pt, ..options },
            PDF_INK_WIDTH,
        )
        .expect("render the page");
        let plan = build_plan_inked(
            &geometry.lines,
            PlanOptions {
                mm_per_px: guess.mm_per_pt,
                image_width: geometry.width_pt.round() as u32,
                image_height: geometry.height_pt.round() as u32,
                ..PlanOptions::default()
            },
            Some(Ink {
                mask: &ink.mask,
                width: ink.width,
                height: ink.height,
                mm_per_px: ink.mm_per_px,
                filter_walls: true,
            }),
        );

        let kinds: Vec<(&str, f32)> = plan
            .openings
            .iter()
            .map(|opening| (opening.kind.name(), opening.width))
            .collect();
        assert!(
            kinds.iter().any(|(kind, width)| *kind == "window" && (*width - 1.2).abs() < 0.2),
            "no 1.2 m window: {kinds:?}"
        );
        assert!(
            kinds.iter().any(|(kind, width)| *kind == "door" && (*width - 0.9).abs() < 0.2),
            "no 0.9 m door: {kinds:?}"
        );
    }

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

    async fn call(app: Router, uri: &str, body: Vec<u8>) -> (StatusCode, String) {
        let request = Request::builder()
            .method("POST")
            .uri(uri)
            .header(
                header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={BOUNDARY}"),
            )
            .body(Body::from(body))
            .expect("build request");
        let response = app.oneshot(request).await.expect("router call");
        let status = response.status();
        let raw = axum::body::to_bytes(response.into_body(), 8 * 1024 * 1024)
            .await
            .expect("read body");
        (status, String::from_utf8_lossy(&raw).to_string())
    }

    fn text_only(texts: &[(&str, &str)]) -> Vec<u8> {
        let mut body = Vec::new();
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

    /// A rejected drawing has to fail as a status. `Result<_, String>` would
    /// answer 200 with the complaint in the body, which a client reads as a
    /// successful conversion.
    #[tokio::test]
    async fn a_file_that_is_not_an_image_is_rejected() {
        let body = multipart("junk.png", b"definitely not a png", &[]);
        let (status, text) = call(app(), "/upload", body).await;
        assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE, "body: {text}");
    }

    #[tokio::test]
    async fn an_oversized_upload_is_rejected_with_413() {
        let app = app_with(AppState::with_limits(1024, 1));
        let body = multipart("plan.png", &[b'x'; 4096], &[]);
        let (status, text) = call(app, "/upload", body).await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE, "body: {text}");
    }

    #[tokio::test]
    async fn an_upload_without_a_file_is_422() {
        let body = text_only(&[("mmPerPx", "10")]);
        let (status, text) = call(app(), "/api/plan", body).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "body: {text}");
        assert!(text.contains("no file"), "body: {text}");
    }

    #[tokio::test]
    async fn a_scale_that_is_not_a_number_is_422() {
        let bytes = std::fs::read("fixtures/floor_plan.png").expect("fixture");
        let body = multipart("floor_plan.png", &bytes, &[("mmPerPx", "wide")]);
        let (status, text) = call(app(), "/api/plan", body).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "body: {text}");
    }

    #[tokio::test]
    async fn healthz_reports_what_the_server_can_read() {
        let request = Request::builder()
            .uri("/healthz")
            .body(Body::empty())
            .expect("build request");
        let response = app().oneshot(request).await.expect("router call");
        assert_eq!(response.status(), StatusCode::OK);
        let raw = axum::body::to_bytes(response.into_body(), 1024 * 64)
            .await
            .expect("read body");
        let json: Value = serde_json::from_slice(&raw).expect("health json");
        assert_eq!(json["status"], "ok");
        assert!(json["pdf"].is_boolean());
        assert!(json["maxUploadBytes"].as_u64().unwrap_or(0) >= 1024);
        assert!(json["extractionSlots"].as_u64().unwrap_or(0) >= 1);
    }

    /// The fixture's partition is drawn with a door gap, so the takeoff has to
    /// net it out of the area it charges drywall and paint for.
    #[tokio::test]
    async fn the_fixture_doorway_is_an_opening_and_the_takeoff_nets_it() {
        let json = checked_plan("fixtures/floor_plan.png").await;
        let takeoff = &json["takeoff"];
        let gross = takeoff["wallGrossArea"].as_f64().expect("wallGrossArea");
        let net = takeoff["wallNetArea"].as_f64().expect("wallNetArea");
        let opening = takeoff["openingArea"].as_f64().expect("openingArea");
        assert!(opening > 0.0, "the fixture has a doorway: {json}");
        assert!(
            (gross - net - opening).abs() < 1e-3,
            "net {net} gross {gross} opening {opening}"
        );

        let openings = json["openings"].as_array().expect("openings");
        assert_eq!(openings.len(), 1, "openings: {openings:?}");
        assert_eq!(openings[0]["kind"], "door");
        let width = openings[0]["width"].as_f64().expect("width");
        assert!((width - 0.6).abs() < 0.1, "door width {width}");
        assert_eq!(takeoff["doors"].as_u64(), Some(1));
        assert_eq!(takeoff["windows"].as_u64(), Some(0));

        // Drywall follows the net wall area, so the opening must be deducted.
        let floor = takeoff["floorArea"].as_f64().unwrap();
        let sheets = ((net + floor) / 2.88 - 1e-6).ceil();
        assert_eq!(takeoff["drywallSheets"].as_f64().unwrap(), sheets);
    }
}
