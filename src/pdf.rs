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
//! control points, so a bezier is emitted as a chord between its endpoints. That
//! is exact for the straight polylines CAD exports put walls on, and slightly
//! short for a genuinely curved wall or a door swing arc.

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

/// Extract every straight segment on one page of a PDF.
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
    let mut paths = 0usize;
    let mut curves = 0usize;

    for object in page.objects().iter() {
        let Some(path_object) = object.as_path_object() else {
            continue;
        };
        paths += 1;

        let mut cursor: Option<(f32, f32)> = None;
        for segment in path_object.segments().iter() {
            let kind = format!("{:?}", segment.segment_type());
            // pdfium's origin is bottom-left; the detector and the plan builder
            // both want y growing down the page.
            let x = segment.x().value;
            let y = height_pt - segment.y().value;

            let Some(from) = cursor else {
                cursor = Some((x, y));
                continue;
            };

            if !kind.contains("MoveTo") {
                push_line(&mut lines, from, (x, y), options.min_length_pt);
                if kind.contains("BezierTo") {
                    curves += 1;
                }
            }

            cursor = Some((x, y));
        }
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
    fn default_scale_is_a_hundred_to_one() {
        // 1 point at 1:100 covers 0.3528 mm of paper, 35.28 mm of building.
        assert!((PdfOptions::default().mm_per_pt - 35.28).abs() < 1e-3);
    }
}
