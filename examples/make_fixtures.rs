//! Generates the blueprint fixtures used to compare line-detection results.
//!
//! Run with `cargo run --example make_fixtures`, then compare detector output with
//! `cargo run -- fixtures/floor_plan.png`.

use image::{GrayImage, Luma};

fn main() {
    std::fs::create_dir_all("fixtures").expect("create fixtures dir");

    floor_plan().save("fixtures/floor_plan.png").expect("save floor_plan");
    angled_plan().save("fixtures/angled_plan.png").expect("save angled_plan");

    println!("wrote fixtures/floor_plan.png and fixtures/angled_plan.png");
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
