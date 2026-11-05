//! PDF vector extraction: architectural drawings read from their own geometry.
//!
//! A scanned plan has to be guessed at — Otsu, Hough, snapping — because all the
//! ink knows is where it is dark. A PDF knows better: every wall is a path object
//! with real segments. This module pulls those paths out through pdfium and hands
//! back the same `Line` segments the raster detector produces, so the plan
//! builder, the takeoff and the exporters do not care where the geometry came
//! from.
//!
//! Units: the lines come back in PDF points (1/72") with y flipped to grow down
//! the page, matching the detector's convention. Scale is therefore "millimetres
//! of building per point", typically the drawing ratio times 0.3528 — 35.28 mm/pt
//! for a 1:100 plan.
//!
//! Curves: pdfium's path API reports only a segment's end point, not a cubic's
//! control points, so a bezier cannot be reproduced — only approximated by its
//! chord. Chords are not walls, and the curves on a plan are symbols: a door
//! swing, a circle, a scale bar. They are counted and left out; a curved wall is
//! the one thing that loses by it, and the count says when a page depends on
//! them.

use crate::detect::Line;
use pdfium_render::prelude::*;

#[derive(Clone, Copy, Debug)]
pub struct PdfOptions {
    /// Page to read, zero-based; clamped to the document.
    pub page: usize,
    /// Millimetres of building per PDF point (1:100 on paper is 35.28).
    pub mm_per_pt: f32,
    /// Segments shorter than this (points) are dropped as annotation marks.
    pub min_length_pt: f32,
}

impl Default for PdfOptions {
    fn default() -> Self {
        PdfOptions {
            page: 0,
            mm_per_pt: 35.28,
            min_length_pt: 0.5,
        }
    }
}

#[derive(Debug)]
pub struct PdfGeometry {
    pub lines: Vec<Line>,
    pub width_pt: f32,
    pub height_pt: f32,
    /// Millimetres of building per point, as used; the plan builder wants this
    /// as its `mm_per_px`, since points are the PDF's pixels.
    pub mm_per_pt: f32,
    pub pages: usize,
    pub page_index: usize,
    pub paths: usize,
    pub curves: usize,
}

/// Load pdfium. The dynamic library is not vendored, so the search order is:
/// an explicit `PDFIUM_DYNAMIC_LIB_PATH`, then the system library, then the
/// platform library name in the working directory.
pub fn bind() -> Result<Pdfium, String> {
    let explicit = std::env::var("PDFIUM_DYNAMIC_LIB_PATH").ok();

    let bindings = if let Some(explicit) = explicit {
        let path = std::path::Path::new(&explicit);
        let name = if path.is_dir() {
            Pdfium::pdfium_platform_library_name_at_path(&explicit)
        } else {
            path.to_path_buf()
        };
        Pdfium::bind_to_library(name)
    } else {
        Pdfium::bind_to_system_library().or_else(|_| {
            Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path("./"))
        })
    }
    .map_err(|err| {
        format!(
            "pdfium is not available ({err}); put the pdfium library on the path \
             or set PDFIUM_DYNAMIC_LIB_PATH to it"
        )
    })?;

    Ok(Pdfium::new(bindings))
}

/// Whether this build can read a PDF at all: pdfium is loaded at runtime, so a
/// deployment without the library can say so instead of failing per upload.
/// The answer is cached: binding probes the dynamic loader once.
pub fn available() -> bool {
    static AVAILABLE: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *AVAILABLE.get_or_init(|| bind().is_ok())
}

/// Extract every straight segment on one page of a PDF.
/// A page rendered to ink: millimetres of building per pixel of the bitmap.
pub struct PdfInk {
    pub mask: Vec<bool>,
    pub width: u32,
    pub height: u32,
    pub mm_per_px: f32,
}

/// Render one page and read its ink.
///
/// A path object carries no stroke width, so the glazing across a window and the
/// arc of a door swing are invisible in the vector data. Rendering the page puts
/// them back in pixels, and the plan builder classifies a PDF's openings with
/// the same code it uses for a raster. `None` means pdfium is missing or the
/// page would not render: classification then falls back to topology, which is
/// what it did before.
pub fn ink(path: &str, options: PdfOptions, target_width: f32) -> Option<PdfInk> {
    let pdfium = bind().ok()?;
    let document = pdfium.load_pdf_from_file(path, None).ok()?;
    let pages = document.pages();
    let total = pages.len() as usize;
    if total == 0 {
        return None;
    }
    let page = pages.get(options.page.min(total - 1) as u16).ok()?;

    // Scale so the rendered page is about `target_width` pixels across: fine
    // enough for a 0.9 m window to be a hundred pixels, bounded so an A0 sheet
    // cannot ask for a gigapixel bitmap.
    let factor = (target_width / page.width().value.max(1.0)).clamp(1.0, 6.0);
    let config = PdfRenderConfig::new().scale_page_by_factor(factor);
    let image = page.render_with_config(&config).ok()?.as_image().to_luma8();
    if image.width() == 0 || image.height() == 0 {
        return None;
    }

    let mm_per_px = page.width().value * options.mm_per_pt / image.width() as f32;
    Some(PdfInk {
        mask: crate::detect::ink_mask(&image),
        width: image.width(),
        height: image.height(),
        mm_per_px,
    })
}

pub fn extract(path: &str, options: PdfOptions) -> Result<PdfGeometry, String> {
    let pdfium = bind()?;
    let document = pdfium
        .load_pdf_from_file(path, None)
        .map_err(|err| format!("cannot read {path} as a PDF: {err}"))?;

    let pages = document.pages();
    let total = pages.len() as usize;
    if total == 0 {
        return Err(format!("{path} has no pages"));
    }

    let page_index = options.page.min(total - 1);
    let page = pages
        .get(page_index as u16)
        .map_err(|err| format!("cannot read page {} of {path}: {err}", page_index + 1))?;

    let width_pt = page.width().value;
    let height_pt = page.height().value;

    let mut lines = Vec::new();
    let mut centres: Vec<[f32; 4]> = Vec::new();
    let mut paths = 0usize;
    let mut curves = 0usize;

    for object in page.objects().iter() {
        let Some(path_object) = object.as_path_object() else {
            continue;
        };
        paths += 1;

        let mut cursor: Option<(f32, f32)> = None;
        let (mut min_x, mut max_x) = (f32::MAX, f32::MIN);
        let (mut min_y, mut max_y) = (f32::MAX, f32::MIN);
        for segment in path_object.segments().iter() {
            let kind = format!("{:?}", segment.segment_type());
            // As the producer wrote it, y counting up from the bottom; the fit
            // below turns the whole drawing into page coordinates with y down.
            let x = segment.x().value;
            let y = segment.y().value;
            min_x = min_x.min(x);
            max_x = max_x.max(x);
            min_y = min_y.min(y);
            max_y = max_y.max(y);

            let Some(from) = cursor else {
                cursor = Some((x, y));
                continue;
            };

            if !kind.contains("MoveTo") {
                if kind.contains("BezierTo") {
                    // A chord is not the curve it stands in for, and the curves on
                    // a plan are symbols — a swing arc, a circle, a scale bar —
                    // not walls. They are counted but not built; the openings are
                    // read from a rendering of the page instead.
                    curves += 1;
                } else {
                    push_line(&mut lines, from, (x, y), options.min_length_pt);
                }
            }

            cursor = Some((x, y));
        }

        // Where this object's points put it, against where its resolved bounds
        // put it: the pair locates the space the points are written in.
        if min_x <= max_x {
            if let Ok(bounds) = object.bounds() {
                centres.push([
                    (min_x + max_x) / 2.0,
                    (min_y + max_y) / 2.0,
                    (bounds.left().value + bounds.right().value) / 2.0,
                    (bounds.bottom().value + bounds.top().value) / 2.0,
                ]);
            }
        }
    }

    let fit = Fit::from_objects(&centres, height_pt);
    for line in &mut lines {
        let (x1, y1) = fit.point(line.x1, line.y1);
        let (x2, y2) = fit.point(line.x2, line.y2);
        line.x1 = x1;
        line.y1 = y1;
        line.x2 = x2;
        line.y2 = y2;
    }

    Ok(PdfGeometry {
        lines,
        width_pt,
        height_pt,
        mm_per_pt: options.mm_per_pt,
        pages: total,
        page_index,
        paths,
        curves,
    })
}

/// A scale read off the drawing's own dimension strings.
#[derive(Clone, Debug)]
pub struct ScaleGuess {
    /// Millimetres of building per PDF point.
    pub mm_per_pt: f32,
    /// How many strings agreed on it.
    pub samples: usize,
    /// The middle one, to show in the report.
    pub text: String,
}

/// Read the page's dimension strings and derive the scale from the line each one
/// measures: "3600 mm" written along a line 102 pt long means 35.3 mm/pt, which
/// is a 1:100 plan.
///
/// The strings are only ever a hint, so the answer needs two of them to agree
/// within 15%; room labels and part numbers that happen to parse as lengths are
/// then outvoted rather than trusted. `None` means the page has no text at all,
/// or nothing in it agreed.
pub fn scale_from_dimensions(
    path: &str,
    options: PdfOptions,
    geometry: &PdfGeometry,
) -> Option<ScaleGuess> {
    let pdfium = bind().ok()?;
    let document = pdfium.load_pdf_from_file(path, None).ok()?;
    let pages = document.pages();
    let total = pages.len() as usize;
    if total == 0 {
        return None;
    }
    let page = pages.get(options.page.min(total - 1) as u16).ok()?;
    let tokens = length_tokens(&page, page.height().value);

    // Each token votes for a scale, through the line it sits beside.
    let mut votes: Vec<(f32, String)> = Vec::new();
    for token in &tokens {
        let Some(line) = nearest_line(&geometry.lines, token.cx, token.cy, token.axis) else {
            continue;
        };
        let ratio = token.mm / line.length();
        // A line 1 pt long cannot be a 3.6 m wall, and neither can 300 pt be 300 mm
        // of a 1:100 sheet.
        if (0.5..=400.0).contains(&ratio) {
            votes.push((ratio, token.text.clone()));
        }
    }
    if votes.len() < 2 {
        return None;
    }

    votes.sort_by(|a, b| a.0.total_cmp(&b.0));
    let median = votes[votes.len() / 2].0;
    let agreeing: Vec<&(f32, String)> = votes
        .iter()
        .filter(|(ratio, _)| (ratio - median).abs() <= median * 0.15)
        .collect();
    if agreeing.len() < 2 {
        return None;
    }
    let mm_per_pt = agreeing[agreeing.len() / 2].0;
    Some(ScaleGuess {
        mm_per_pt,
        samples: agreeing.len(),
        text: agreeing[agreeing.len() / 2].1.clone(),
    })
}

/// A length written on the page, with the box it was drawn in.
struct Token {
    mm: f32,
    text: String,
    cx: f32,
    cy: f32,
    /// Which way the string runs, so only a line parallel to it is measured.
    axis: (f32, f32),
}

/// Every word on the page that reads as a length, grouped from its characters.
fn length_tokens(page: &PdfPage, height_pt: f32) -> Vec<Token> {
    let Ok(text) = page.text() else {
        return Vec::new();
    };

    let mut chars: Vec<(String, [f32; 4])> = Vec::new();
    for character in text.chars().iter() {
        let Ok(bounds) = character.loose_bounds() else {
            continue;
        };
        let Some(symbol) = character.unicode_string() else {
            continue;
        };
        if symbol.trim().is_empty() {
            continue;
        }
        // The text boxes are already page space, and page space counts up from
        // the bottom; the detector counts down from the top.
        chars.push((
            symbol,
            [
                bounds.left().value,
                height_pt - bounds.top().value,
                bounds.right().value,
                height_pt - bounds.bottom().value,
            ],
        ));
    }
    // Group the characters into words by how they sit together, not by which
    // way they read: a dimension string is as often turned on its side as not.
    let mut words: Vec<(String, [f32; 4])> = Vec::new();
    while let Some((symbol, bounds)) = chars.pop() {
        let mut run = vec![(symbol, bounds)];
        let mut box_ = bounds;
        loop {
            let mut reached = None;
            for (index, (_, other)) in chars.iter().enumerate() {
                if next_to(&box_, other) {
                    reached = Some(index);
                    break;
                }
            }
            match reached {
                Some(index) => {
                    let (symbol, other) = chars.remove(index);
                    box_ = [
                        box_[0].min(other[0]),
                        box_[1].min(other[1]),
                        box_[2].max(other[2]),
                        box_[3].max(other[3]),
                    ];
                    run.push((symbol, other));
                }
                None => break,
            }
        }

        // Read the run in the direction it was written. A turned dimension runs
        // up the page, which in y-down page space means the first character is
        // the lowest, so a vertical run is read from the bottom.
        let horizontal = box_[2] - box_[0] >= box_[3] - box_[1];
        run.sort_by(|a, b| {
            if horizontal {
                a.1[0].total_cmp(&b.1[0])
            } else {
                b.1[1].total_cmp(&a.1[1])
            }
        });
        let word: String = run.iter().map(|(symbol, _)| symbol.as_str()).collect();
        words.push((word, box_));
    }

    words
        .into_iter()
        .filter_map(|(text, box_)| {
            let mm = parse_length(&text)?;
            let width = box_[2] - box_[0];
            let height = box_[3] - box_[1];
            Some(Token {
                mm,
                text: text.trim().to_string(),
                cx: (box_[0] + box_[2]) / 2.0,
                cy: (box_[1] + box_[3]) / 2.0,
                axis: if width >= height { (1.0, 0.0) } else { (0.0, 1.0) },
            })
        })
        .collect()
}

/// Whether two character boxes sit next to each other on one line of text,
/// whichever way that line runs.
fn next_to(a: &[f32; 4], b: &[f32; 4]) -> bool {
    let overlap_x = a[2].min(b[2]) - a[0].max(b[0]);
    let overlap_y = a[3].min(b[3]) - a[1].max(b[1]);
    let gap_x = a[0].max(b[0]) - a[2].min(b[2]);
    let gap_y = a[1].max(b[1]) - a[3].min(b[3]);
    let shorter = (a[3] - a[1]).min(b[3] - b[1]);
    let narrower = (a[2] - a[0]).min(b[2] - b[0]);
    (gap_x <= 4.0 && overlap_y >= 0.5 * shorter)
        || (gap_y <= 4.0 && overlap_x >= 0.5 * narrower)
}

/// Read a drawn length as millimetres: `3600`, `3600 mm`, `3.6 m`, `24 cm`.
///
/// A bare number is millimetres when it is at least 100 and metres when it is
/// smaller, which covers the two ways a plan writes a length without a unit.
/// Areas (`24.5 m²`), feet-and-inches and anything that is not a number are
/// rejected, not guessed at.
fn parse_length(text: &str) -> Option<f32> {
    let lower = text.trim().to_ascii_lowercase();
    let (number, unit) = if let Some(rest) = lower.strip_suffix("mm") {
        (rest, 1.0)
    } else if let Some(rest) = lower.strip_suffix("cm") {
        (rest, 10.0)
    } else if let Some(rest) = lower.strip_suffix('m') {
        (rest, 1000.0)
    } else {
        (lower.as_str(), 0.0)
    };
    let value: f32 = number.trim().replace(',', ".").parse().ok()?;
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    Some(match unit {
        0.0 if value >= 100.0 => value,
        0.0 => value * 1000.0,
        unit => value * unit,
    })
}

/// The line a dimension string measures: parallel to it, close to it, and the
/// nearest of those.
fn nearest_line<'a>(lines: &'a [Line], cx: f32, cy: f32, axis: (f32, f32)) -> Option<&'a Line> {
    let mut best: Option<(f32, &Line)> = None;
    for line in lines {
        let length = line.length();
        if length < 20.0 {
            continue;
        }
        let ux = (line.x2 - line.x1) / length;
        let uy = (line.y2 - line.y1) / length;
        if (ux * axis.0 + uy * axis.1).abs() < 0.8 {
            continue;
        }
        let distance = point_segment_distance(cx, cy, line);
        if distance > 60.0 {
            continue;
        }
        if best.map_or(true, |(closest, _)| distance < closest) {
            best = Some((distance, line));
        }
    }
    best.map(|(_, line)| line)
}

fn point_segment_distance(px: f32, py: f32, line: &Line) -> f32 {
    let dx = line.x2 - line.x1;
    let dy = line.y2 - line.y1;
    let length2 = dx * dx + dy * dy;
    if length2 <= 1e-9 {
        return ((px - line.x1).powi(2) + (py - line.y1).powi(2)).sqrt();
    }
    let t = (((px - line.x1) * dx + (py - line.y1) * dy) / length2).clamp(0.0, 1.0);
    let x = line.x1 + t * dx;
    let y = line.y1 + t * dy;
    ((px - x).powi(2) + (py - y).powi(2)).sqrt()
}

/// How the paths in a page map onto page space.
///
/// pdfium reports a path's points in the space they were written in — usually a
/// form XObject at some scale, so an 800 × 600 px drawing printed on a 600 × 450 pt
/// page comes back with points of x 0..800, y 0..600 — while `object.bounds()` and
/// the text boxes have already been resolved to the page. The two spaces are
/// reconciled through the objects' own centres, which the stroke width that
/// inflates their bounds does not move.
#[derive(Clone, Copy, Debug)]
struct Fit {
    slope_x: f32,
    slope_y: f32,
    offset_x: f32,
    offset_y: f32,
    height_pt: f32,
}

impl Fit {
    fn identity(height_pt: f32) -> Self {
        Fit { slope_x: 1.0, slope_y: 1.0, offset_x: 0.0, offset_y: 0.0, height_pt }
    }

    /// Each centre as `[raw x, raw y, page x, page y]`.
    fn from_objects(centres: &[[f32; 4]], height_pt: f32) -> Self {
        let mut fit = Fit::identity(height_pt);
        if centres.len() < 2 {
            return fit;
        }

        // A signed slope per axis: the space a drawing is written in is often
        // mirrored in y as well as scaled, since PDF counts y up the page.
        let axis = |raw: usize, page: usize| -> (f32, f32) {
            let mut low = centres[0];
            let mut high = centres[0];
            for centre in centres {
                if centre[raw] < low[raw] {
                    low = *centre;
                }
                if centre[raw] > high[raw] {
                    high = *centre;
                }
            }
            let span = high[raw] - low[raw];
            if span <= 1e-3 {
                return (1.0, low[page] - low[raw]);
            }
            let slope = (high[page] - low[page]) / span;
            (slope, low[page] - slope * low[raw])
        };

        let (slope_x, offset_x) = axis(0, 2);
        let (slope_y, offset_y) = axis(1, 3);
        // A page is scaled uniformly; anything else means the pairing was not
        // trustworthy, and the points are taken as they were written.
        let magnitude = slope_x.abs();
        if !(0.02..=50.0).contains(&magnitude) || (slope_y.abs() / magnitude - 1.0).abs() > 0.15 {
            return fit;
        }
        fit.slope_x = slope_x;
        fit.slope_y = slope_y;
        fit.offset_x = offset_x;
        fit.offset_y = offset_y;
        fit
    }

    /// A point as the paths wrote it in page coordinates with y down.
    fn point(&self, x: f32, y: f32) -> (f32, f32) {
        (
            x * self.slope_x + self.offset_x,
            self.height_pt - (y * self.slope_y + self.offset_y),
        )
    }
}

fn push_line(lines: &mut Vec<Line>, from: (f32, f32), to: (f32, f32), min_length: f32) {
    let line = Line {
        x1: from.0,
        y1: from.1,
        x2: to.0,
        y2: to.1,
    };
    if line.length() >= min_length {
        lines.push(line);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_marks_are_dropped() {
        let mut lines = Vec::new();
        push_line(&mut lines, (0.0, 0.0), (0.2, 0.0), 0.5);
        push_line(&mut lines, (0.0, 0.0), (5.0, 0.0), 0.5);
        assert_eq!(lines.len(), 1);
        assert!((lines[0].length() - 5.0).abs() < 1e-6);
    }

    #[test]
    fn content_space_points_are_reconciled_with_their_bounds() {
        // An 800 × 600 drawing written y down, resolved onto a 600 × 450 pt page
        // that counts y up: both a scale and a mirror.
        let centres = [
            [0.0, 0.0, 0.0, 450.0],
            [800.0, 600.0, 600.0, 0.0],
            [400.0, 300.0, 300.0, 225.0],
        ];
        let fit = Fit::from_objects(&centres, 450.0);
        assert_eq!(fit.point(0.0, 0.0), (0.0, 0.0));
        assert_eq!(fit.point(800.0, 600.0), (600.0, 450.0));
        assert_eq!(fit.point(400.0, 300.0), (300.0, 225.0));
    }

    #[test]
    fn paths_already_in_page_space_are_only_flipped() {
        let centres = [[50.0, 60.0, 50.0, 60.0], [550.0, 60.0, 550.0, 60.0]];
        let fit = Fit::from_objects(&centres, 450.0);
        assert_eq!(fit.point(50.0, 60.0), (50.0, 390.0));
        assert_eq!(fit.point(550.0, 60.0), (550.0, 390.0));
    }

    #[test]
    fn a_drawn_length_is_read_as_millimetres() {
        assert_eq!(parse_length("3600"), Some(3600.0));
        assert_eq!(parse_length("3600 mm"), Some(3600.0));
        assert_eq!(parse_length("3.6 m"), Some(3600.0));
        assert_eq!(parse_length("24 cm"), Some(240.0));
        assert_eq!(parse_length("2"), Some(2000.0));
        assert_eq!(parse_length("24.5 m²"), None);
        assert_eq!(parse_length("BEDROOM"), None);
        assert_eq!(parse_length("0"), None);
    }

    #[test]
    fn default_scale_is_a_hundred_to_one() {
        // 1 point at 1:100 covers 0.3528 mm of paper, 35.28 mm of building.
        assert!((PdfOptions::default().mm_per_pt - 35.28).abs() < 1e-3);
    }
}
