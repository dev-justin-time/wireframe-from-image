//! Generates the blueprint fixtures used to compare line-detection results.
//!
//! Run with `cargo run --example make_fixtures`, then compare detector output with
//! `cargo run -- fixtures/floor_plan.png`.

use image::{GrayImage, Luma};

fn main() {
    std::fs::create_dir_all("fixtures").expect("create fixtures dir");

    floor_plan().save("fixtures/floor_plan.png").expect("save floor_plan");
    angled_plan().save("fixtures/angled_plan.png").expect("save angled_plan");
    symbol_plan().save("fixtures/symbol_plan.png").expect("save symbol_plan");
    std::fs::write("fixtures/symbol_plan.html", symbol_plan_page())
        .expect("save symbol_plan.html");

    println!(
        "wrote fixtures/floor_plan.png, angled_plan.png, symbol_plan.png and symbol_plan.html\n\
         print the PDF fixture with:\n\
         \x20 chrome --headless=new --no-pdf-header-footer \\\n\
         \x20   --print-to-pdf=fixtures/symbol_plan.pdf fixtures/symbol_plan.html"
    );
}

/// The symbol plan as a page to print: vector strokes for the walls, hairlines
/// for the glazing, an arc for the swing, and two dimension strings so that a
/// PDF made from it carries its own scale.
///
/// Printed at 800 × 600 px, 96 dpi, the page is 600 × 450 pt, so its 10 mm/px is
/// 13.33 mm/pt of building.
fn symbol_plan_page() -> String {
    let mut svg = String::from(
        "<!doctype html>\n<meta charset=\"utf-8\">\n\
         <title>Blueprint fixture: openings and dimensions</title>\n\
         <style>@page { size: 800px 600px; margin: 0 } html, body { margin: 0 }</style>\n\
         <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"600\" \
         viewBox=\"0 0 800 600\">\n",
    );

    // Shell with a 1.2 m window gap in the top wall (7000 × 5000 mm at 10 mm/px).
    svg_line(&mut svg, 50.0, 50.0, 250.0, 50.0, 6.0);
    svg_line(&mut svg, 370.0, 50.0, 750.0, 50.0, 6.0);
    svg_line(&mut svg, 750.0, 50.0, 750.0, 550.0, 6.0);
    svg_line(&mut svg, 750.0, 550.0, 50.0, 550.0, 6.0);
    svg_line(&mut svg, 50.0, 550.0, 50.0, 50.0, 6.0);

    // Glazing: three hairlines across the window, clear of both wall ends.
    for y in [47.0, 50.0, 53.0] {
        svg_line(&mut svg, 250.0, y, 370.0, y, 1.0);
    }

    // Partition with a 0.9 m doorway, its leaf and the swing arc.
    svg_line(&mut svg, 400.0, 50.0, 400.0, 300.0, 6.0);
    svg_line(&mut svg, 400.0, 390.0, 400.0, 550.0, 6.0);
    svg_line(&mut svg, 400.0, 300.0, 310.0, 300.0, 1.0);
    svg.push_str(
        "<path d=\"M 310 300 A 90 90 0 0 1 400 390\" fill=\"none\" stroke=\"#000\" \
         stroke-width=\"1\"/>\n",
    );

    // Dimension strings, off the walls they measure, with no dimension line:
    // the nearest line parallel to a string is the one it measures.
    svg_text(&mut svg, "7000", 400.0, 578.0, false);
    svg_text(&mut svg, "5000", 22.0, 300.0, true);

    svg.push_str("</svg>\n");
    svg
}

fn svg_line(svg: &mut String, x1: f32, y1: f32, x2: f32, y2: f32, width: f32) {
    svg.push_str(&format!(
        "<line x1=\"{x1}\" y1=\"{y1}\" x2=\"{x2}\" y2=\"{y2}\" stroke=\"#000\" \
         stroke-width=\"{width}\"/>\n"
    ));
}

fn svg_text(svg: &mut String, text: &str, x: f32, y: f32, turned: bool) {
    let rotate = if turned {
        format!(" transform=\"rotate(-90 {x} {y})\"")
    } else {
        String::new()
    };
    svg.push_str(&format!(
        "<text x=\"{x}\" y=\"{y}\"{rotate} font-family=\"Arial, sans-serif\" font-size=\"16\" \
         text-anchor=\"middle\" fill=\"#000\">{text}</text>\n"
    ));
}

/// Axis-aligned plan: outer shell, two interior walls with a door gap,
/// and small text-like marks that must not become walls.
fn floor_plan() -> GrayImage {
    let mut img = GrayImage::from_pixel(800, 600, Luma([255]));
    let wall = 3;

    // Outer shell.
    wall_line(&mut img, 60, 60, 740, 60, wall);
    wall_line(&mut img, 740, 60, 740, 540, wall);
    wall_line(&mut img, 740, 540, 60, 540, wall);
    wall_line(&mut img, 60, 540, 60, 60, wall);

    // Interior vertical wall with a doorway.
    wall_line(&mut img, 380, 60, 380, 300, wall);
    wall_line(&mut img, 380, 360, 380, 540, wall);

    // Interior horizontal wall.
    wall_line(&mut img, 380, 300, 740, 300, wall);

    // Annotation marks: too short to be walls, present to catch false positives.
    for row in 0..6 {
        let y = 460 + row * 10;
        for col in 0..8 {
            let x = 100 + col * 24;
            wall_line(&mut img, x, y, x + 10, y, 1);
        }
    }

    img
}

/// Off-axis plan: vertical and diagonal walls, which the row-scan detector lost.
fn angled_plan() -> GrayImage {
    let mut img = GrayImage::from_pixel(600, 600, Luma([255]));
    let wall = 3;

    wall_line(&mut img, 80, 80, 520, 80, wall);
    wall_line(&mut img, 520, 80, 520, 520, wall);
    wall_line(&mut img, 520, 520, 80, 520, wall);
    wall_line(&mut img, 80, 520, 80, 80, wall);

    // Diagonal partition.
    wall_line(&mut img, 80, 80, 520, 520, wall);

    // Vertical partition meeting the diagonal.
    wall_line(&mut img, 300, 80, 300, 300, wall);

    img
}

/// A plan that draws the two opening symbols at 10 mm/px: hairlines glazed across
/// a 1.2 m window in the shell, and a swing arc on a 0.9 m doorway.
fn symbol_plan() -> GrayImage {
    let mut img = GrayImage::from_pixel(800, 600, Luma([255]));
    let wall = 3;

    // Shell, with a 1.2 m window gap in the top wall.
    wall_line(&mut img, 60, 60, 400, 60, wall);
    wall_line(&mut img, 520, 60, 740, 60, wall);
    wall_line(&mut img, 740, 60, 740, 540, wall);
    wall_line(&mut img, 740, 540, 60, 540, wall);
    wall_line(&mut img, 60, 540, 60, 60, wall);

    // Glazing: two hairlines across the window, clear of both wall ends.
    wall_line(&mut img, 412, 56, 508, 56, 1);
    wall_line(&mut img, 412, 65, 508, 65, 1);

    // Partition with a 0.9 m doorway, and the swing arc a plan draws in it.
    wall_line(&mut img, 380, 60, 380, 280, wall);
    wall_line(&mut img, 380, 370, 380, 540, wall);
    let mut previous = (380, 280);
    for degrees in 0..=90 {
        let radians = (degrees as f32).to_radians();
        let point = (
            380 + (90.0 * radians.cos()) as i32,
            280 + (90.0 * radians.sin()) as i32,
        );
        wall_line(&mut img, previous.0, previous.1, point.0, point.1, 1);
        previous = point;
    }

    img
}

fn wall_line(img: &mut GrayImage, x0: i32, y0: i32, x1: i32, y1: i32, thickness: u32) {
    let (dx, dy) = ((x1 - x0).abs(), -(y1 - y0).abs());
    let (sx, sy) = (if x0 < x1 { 1 } else { -1 }, if y0 < y1 { 1 } else { -1 });
    let (mut x, mut y, mut err) = (x0, y0, dx + dy);

    loop {
        for oy in 0..thickness as i32 {
            for ox in 0..thickness as i32 {
                let (px, py) = (x + ox, y + oy);
                if px >= 0 && py >= 0 && (px as u32) < img.width() && (py as u32) < img.height() {
                    img.put_pixel(px as u32, py as u32, Luma([0]));
                }
            }
        }
        if x == x1 && y == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x += sx;
        }
        if e2 <= dx {
            err += dx;
            y += sy;
        }
    }
}
