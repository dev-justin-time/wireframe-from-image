//! Plan extraction: detected pixels become metres, the walls become a graph,
//! and the faces that graph encloses become rooms.
//!
//! This is the step between `detect.rs` (ink -> segments) and the feature suites
//! in `ports/` (plan -> quantities). The suites read a plan JSON with wall
//! coordinates and room polygons; `--write-plan` emits exactly that shape, so a
//! blueprint goes from image to takeoff without the plan being drawn again by
//! hand.

use crate::detect::Line;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

/// A plan-space point in metres. `y` grows down the image, like the detector's.
#[derive(Clone, Copy, Debug)]
pub struct Pt {
    pub x: f32,
    pub y: f32,
}

#[derive(Clone, Debug)]
pub struct Wall {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub length: f32,
}

#[derive(Clone, Debug)]
pub struct Room {
    pub name: String,
    pub polygon: Vec<Pt>,
    pub area: f32,
    pub perimeter: f32,
    pub centroid: Pt,
}

#[derive(Clone, Copy, Debug)]
pub struct PlanOptions {
    pub mm_per_px: f32,
    pub wall_height: f32,
    pub stud_spacing_mm: f32,
    /// Image size in pixels, used for the plan extent.
    pub image_width: u32,
    pub image_height: u32,
    /// Segments shorter than this are annotation marks, not walls.
    pub min_wall_m: f32,
    /// Faces smaller than this are gaps between double-line walls.
    pub min_room_m2: f32,
    /// Endpoint snapping distance: walls that meet are made to share a node.
    pub snap_m: f32,
}

impl Default for PlanOptions {
    fn default() -> Self {
        PlanOptions {
            mm_per_px: 10.0,
            wall_height: 2.7,
            stud_spacing_mm: 406.0,
            image_width: 0,
            image_height: 0,
            min_wall_m: 0.20,
            min_room_m2: 1.0,
            // 120 mm: enough to close a 3 px stroke drawn at 10 mm/px, small
            // enough that two walls 120 mm apart are still two walls.
            snap_m: 0.12,
        }
    }
}

/// Quantities the geometry alone can answer, using the same formulas as the
/// ports so the two agree: drywall on 2.4 × 1.2 m sheets, paint at 2 coats over
/// 10 m²/L, flooring with 10% waste, studs at the spacing plus one per wall end,
/// and three plate runs.
#[derive(Clone, Copy, Debug)]
pub struct Takeoff {
    pub wall_length: f32,
    pub wall_gross_area: f32,
    pub floor_area: f32,
    pub volume: f32,
    pub drywall_sheets: i64,
    pub paint_litres: i64,
    pub flooring_m2: f32,
    pub baseboard_m: f32,
    pub studs: i64,
    pub plates_m: f32,
    pub sheathing_panels: i64,
}

pub struct Plan {
    pub scale_mm_per_px: f32,
    pub wall_height: f32,
    pub stud_spacing_mm: f32,
    pub width_m: f32,
    pub depth_m: f32,
    pub walls: Vec<Wall>,
    pub rooms: Vec<Room>,
}

impl Plan {
    pub fn wall_length(&self) -> f32 {
        self.walls.iter().map(|wall| wall.length).sum()
    }

    pub fn floor_area(&self) -> f32 {
        self.rooms.iter().map(|room| room.area).sum()
    }

    pub fn takeoff(&self) -> Takeoff {
        const SHEET_M2: f32 = 2.4 * 1.2;
        let wall_length = self.wall_length();
        let wall_gross_area = wall_length * self.wall_height;
        let floor_area = self.floor_area();
        let covered = wall_gross_area + floor_area;
        let studs = self
            .walls
            .iter()
            .map(|wall| (wall.length * 1000.0 / self.stud_spacing_mm).floor() as i64 + 1)
            .sum();

        Takeoff {
            wall_length,
            wall_gross_area,
            floor_area,
            volume: floor_area * self.wall_height,
            drywall_sheets: if covered > 0.0 { (covered / SHEET_M2 - 1e-6).ceil() as i64 } else { 0 },
            paint_litres: if covered > 0.0 { ((covered * 2.0) / 10.0 - 1e-6).ceil() as i64 } else { 0 },
            flooring_m2: floor_area * 1.1,
            baseboard_m: self.rooms.iter().map(|room| room.perimeter).sum(),
            studs,
            plates_m: wall_length * 3.0,
            sheathing_panels: if wall_gross_area > 0.0 {
                (wall_gross_area / SHEET_M2 - 1e-6).ceil() as i64
            } else {
                0
            },
        }
    }

    /// The plan JSON the ports read: metres, walls without openings (the detector
    /// does not find doors), and one polygon per closed room.
    pub fn to_json(&self, project: &str) -> Value {
        let walls: Vec<Value> = self
            .walls
            .iter()
            .map(|wall| {
                json!({
                    "x1": round3(wall.x1),
                    "y1": round3(wall.y1),
                    "x2": round3(wall.x2),
                    "y2": round3(wall.y2),
                    "openings": []
                })
            })
            .collect();
        let rooms: Vec<Value> = self
            .rooms
            .iter()
            .map(|room| {
                json!({
                    "name": room.name,
                    "polygon": room.polygon.iter()
                        .map(|point| json!([round3(point.x), round3(point.y)]))
                        .collect::<Vec<Value>>()
                })
            })
            .collect();

        json!({
            "project": project,
            "units": "m",
            "wallHeight": round2(self.wall_height),
            "studSpacingMm": self.stud_spacing_mm,
            "rooms": rooms,
            "walls": walls
        })
    }
}

// Round in f64: an f32 result re-serialises as 3.809999942779541, and this file
// is the interface another tool reads.
fn round2(value: f32) -> f64 {
    ((value as f64) * 100.0).round() / 100.0
}

fn round3(value: f32) -> f64 {
    ((value as f64) * 1000.0).round() / 1000.0
}

/// Scale the detected segments into metres and close them into rooms.
pub fn build_plan(lines: &[Line], options: PlanOptions) -> Plan {
    let m_per_px = options.mm_per_px.max(0.1) / 1000.0;

    let walls: Vec<Wall> = lines
        .iter()
        .map(|line| {
            let (x1, y1) = (line.x1 * m_per_px, line.y1 * m_per_px);
            let (x2, y2) = (line.x2 * m_per_px, line.y2 * m_per_px);
            Wall {
                x1,
                y1,
                x2,
                y2,
                length: ((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)).sqrt(),
            }
        })
        .filter(|wall| wall.length >= options.min_wall_m)
        .collect();

    let rooms = find_rooms(&walls, &options);

    Plan {
        scale_mm_per_px: options.mm_per_px,
        wall_height: options.wall_height,
        stud_spacing_mm: options.stud_spacing_mm,
        width_m: options.image_width as f32 * m_per_px,
        depth_m: options.image_height as f32 * m_per_px,
        walls,
        rooms,
    }
}

fn angle_of(from: Pt, to: Pt) -> f32 {
    (to.y - from.y).atan2(to.x - from.x)
}

/// The node at `point`, or a new one. Greedy clustering, because a detected
/// stroke ends at the outline of the wall, not on its centre line: two walls that
/// meet in the drawing can be a few centimetres apart in their end points.
fn cluster_node(points: &mut Vec<Pt>, point: Pt, snap: f32) -> usize {
    for (id, existing) in points.iter().enumerate() {
        let (dx, dy) = (existing.x - point.x, existing.y - point.y);
        if (dx * dx + dy * dy).sqrt() <= snap {
            return id;
        }
    }
    points.push(point);
    points.len() - 1
}

/// Where `point` lands on the interior of `wall`, as a fraction along it.
/// A point at either end is an end point, not a junction, so it does not count.
fn projection_inside(wall: &Wall, point: Pt, tolerance: f32) -> Option<f32> {
    let (dx, dy) = (wall.x2 - wall.x1, wall.y2 - wall.y1);
    let length_sq = dx * dx + dy * dy;
    if length_sq < 1e-9 {
        return None;
    }
    let t = ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / length_sq;
    if t <= 0.01 || t >= 0.99 {
        return None;
    }
    let (px, py) = (wall.x1 + t * dx, wall.y1 + t * dy);
    let (ex, ey) = (point.x - px, point.y - py);
    if (ex * ex + ey * ey).sqrt() <= tolerance {
        Some(t)
    } else {
        None
    }
}

/// Faces of the wall graph, by half-edge traversal.
///
/// Every segment becomes two directed half-edges. Leaving a node along one, the
/// next is the neighbour one step round from the one we arrived on, which traces
/// each enclosed face exactly once. The single largest face is the outside of
/// the plan and is dropped; what remains is the rooms. A doorway leaves the two
/// sides connected, so they come back as one open-plan face rather than two.
fn find_rooms(walls: &[Wall], options: &PlanOptions) -> Vec<Room> {
    let snap = options.snap_m.max(0.005);

    // 1. One node per drawing junction.
    let mut points: Vec<Pt> = Vec::new();
    let mut wall_ends: Vec<(usize, usize)> = Vec::new();
    for wall in walls {
        let a = cluster_node(&mut points, Pt { x: wall.x1, y: wall.y1 }, snap);
        let b = cluster_node(&mut points, Pt { x: wall.x2, y: wall.y2 }, snap);
        wall_ends.push((a, b));
    }

    // 2. Split each wall where another wall ends on it. Without this a partition
    //    butting into a wall hangs free, the graph stays a tree, and no face
    //    closes however straight the drawing is.
    let mut edges: Vec<(usize, usize)> = Vec::new();
    let mut seen: HashSet<(usize, usize)> = HashSet::new();
    for (index, wall) in walls.iter().enumerate() {
        let (a, b) = wall_ends[index];
        let mut hits: Vec<(f32, usize)> = Vec::new();
        for (node, point) in points.iter().enumerate() {
            if node == a || node == b {
                continue;
            }
            if let Some(t) = projection_inside(wall, *point, snap) {
                hits.push((t, node));
            }
        }
        hits.sort_by(|left, right| {
            left.0
                .partial_cmp(&right.0)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let mut chain: Vec<usize> = vec![a];
        chain.extend(hits.into_iter().map(|(_, node)| node));
        chain.push(b);

        for pair in chain.windows(2) {
            let (from, to) = (pair[0], pair[1]);
            if from == to {
                continue;
            }
            let key = if from < to { (from, to) } else { (to, from) };
            if seen.insert(key) {
                edges.push(key);
            }
        }
    }

    if edges.len() < 3 {
        return Vec::new();
    }

    // Neighbours in angle order, so "one step round" is a cheap lookup.
    let mut adjacency: Vec<Vec<(usize, f32)>> = vec![Vec::new(); points.len()];
    for (a, b) in &edges {
        adjacency[*a].push((*b, angle_of(points[*a], points[*b])));
        adjacency[*b].push((*a, angle_of(points[*b], points[*a])));
    }
    for list in adjacency.iter_mut() {
        list.sort_by(|left, right| {
            left.1
                .partial_cmp(&right.1)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    let mut half_of: HashMap<(usize, usize), usize> = HashMap::new();
    for (index, (a, b)) in edges.iter().enumerate() {
        half_of.insert((*a, *b), index * 2);
        half_of.insert((*b, *a), index * 2 + 1);
    }

    let mut visited = vec![false; edges.len() * 2];
    let mut faces: Vec<(Vec<usize>, f32)> = Vec::new();

    for start in 0..edges.len() * 2 {
        if visited[start] {
            continue;
        }
        let mut cycle: Vec<usize> = Vec::new();
        let mut half = start;
        loop {
            visited[half] = true;
            let (a, b) = edges[half / 2];
            let (from, to) = if half % 2 == 0 { (a, b) } else { (b, a) };
            cycle.push(from);

            let list = &adjacency[to];
            let position = match list.iter().position(|(neighbour, _)| *neighbour == from) {
                Some(position) => position,
                None => break,
            };
            let (next_node, _) = list[(position + 1) % list.len()];
            half = match half_of.get(&(to, next_node)) {
                Some(next) => *next,
                None => break,
            };
            if half == start || cycle.len() > edges.len() * 2 {
                break;
            }
        }
        if cycle.len() >= 3 {
            let polygon: Vec<Pt> = cycle.iter().map(|id| points[*id]).collect();
            let area = polygon_area(&polygon);
            if area.abs() > 0.0 {
                faces.push((cycle, area));
            }
        }
    }

    let outer = faces
        .iter()
        .enumerate()
        .max_by(|left, right| {
            left.1 .1
                .abs()
                .partial_cmp(&right.1 .1.abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(index, _)| index);
    if let Some(index) = outer {
        faces.remove(index);
    }

    let mut rooms: Vec<Room> = faces
        .into_iter()
        .filter_map(|(cycle, area)| {
            if area.abs() < options.min_room_m2 {
                return None;
            }
            let mut polygon: Vec<Pt> = cycle.iter().map(|id| points[*id]).collect();
            // A dangling segment walks back over itself and repeats a point.
            polygon.dedup_by(|a, b| (a.x - b.x).abs() < 1e-6 && (a.y - b.y).abs() < 1e-6);
            if polygon.len() < 3 {
                return None;
            }
            Some(Room {
                name: String::new(),
                area: area.abs(),
                perimeter: polygon_perimeter(&polygon),
                centroid: polygon_centroid(&polygon),
                polygon,
            })
        })
        .collect();

    rooms.sort_by(|left, right| {
        right
            .area
            .partial_cmp(&left.area)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    for (index, room) in rooms.iter_mut().enumerate() {
        room.name = format!("Room {}", index + 1);
    }
    rooms
}

fn polygon_area(points: &[Pt]) -> f32 {
    let mut total = 0.0;
    for index in 0..points.len() {
        let a = points[index];
        let b = points[(index + 1) % points.len()];
        total += a.x * b.y - b.x * a.y;
    }
    total / 2.0
}

fn polygon_perimeter(points: &[Pt]) -> f32 {
    let mut total = 0.0;
    for index in 0..points.len() {
        let a = points[index];
        let b = points[(index + 1) % points.len()];
        let (dx, dy) = (b.x - a.x, b.y - a.y);
        total += (dx * dx + dy * dy).sqrt();
    }
    total
}

fn polygon_centroid(points: &[Pt]) -> Pt {
    let mut twice = 0.0;
    let mut cx = 0.0;
    let mut cy = 0.0;
    for index in 0..points.len() {
        let a = points[index];
        let b = points[(index + 1) % points.len()];
        let cross = a.x * b.y - b.x * a.y;
        twice += cross;
        cx += (a.x + b.x) * cross;
        cy += (a.y + b.y) * cross;
    }
    if twice.abs() < 1e-9 {
        let count = points.len().max(1) as f32;
        let sx: f32 = points.iter().map(|point| point.x).sum();
        let sy: f32 = points.iter().map(|point| point.y).sum();
        return Pt {
            x: sx / count,
            y: sy / count,
        };
    }
    Pt {
        x: cx / (3.0 * twice),
        y: cy / (3.0 * twice),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detect::{detect_lines, DetectOptions};

    fn plan_for(path: &str) -> Plan {
        let image = image::open(path).expect("fixture image");
        let lines = detect_lines(&image.to_luma8(), DetectOptions::default());
        let mut options = PlanOptions::default();
        options.image_width = image.width();
        options.image_height = image.height();
        build_plan(&lines, options)
    }

    #[test]
    fn floor_plan_closes_two_rooms() {
        let plan = plan_for("fixtures/floor_plan.png");
        // Closed right-hand half, plus the left column joined to the lower right
        // through the doorway: one open-plan face.
        assert_eq!(
            plan.rooms.len(),
            2,
            "rooms: {:?}",
            plan.rooms.iter().map(|room| (room.name.clone(), room.area)).collect::<Vec<_>>()
        );
        // 8.0 x 6.0 m outer shell at 10 mm/px, minus the three walls' thickness.
        assert!(
            (plan.floor_area() - 32.64).abs() < 0.6,
            "floor area {}",
            plan.floor_area()
        );
    }

    #[test]
    fn takeoff_is_positive_and_consistent() {
        let plan = plan_for("fixtures/floor_plan.png");
        let takeoff = plan.takeoff();
        assert!(takeoff.wall_length > 20.0, "wall length {}", takeoff.wall_length);
        assert!(takeoff.floor_area > 30.0);
        assert!(takeoff.studs >= plan.walls.len() as i64);
        assert!(takeoff.drywall_sheets > 0 && takeoff.paint_litres > 0);
        assert!((takeoff.plates_m - takeoff.wall_length * 3.0).abs() < 1e-3);
    }

    #[test]
    fn plan_json_matches_the_ports_contract() {
        let plan = plan_for("fixtures/angled_plan.png");
        let value = plan.to_json("fixture");
        assert_eq!(value["units"], "m");
        assert_eq!(
            value["walls"].as_array().map(|walls| walls.len()).unwrap_or(0),
            plan.walls.len()
        );
        assert_eq!(
            value["rooms"].as_array().map(|rooms| rooms.len()).unwrap_or(0),
            plan.rooms.len()
        );
        let first_wall = &value["walls"][0];
        assert!(first_wall["x1"].is_number() && first_wall["openings"].is_array());
        for room in value["rooms"].as_array().unwrap() {
            let polygon = room["polygon"].as_array().unwrap();
            assert!(polygon.len() >= 3);
            assert_eq!(polygon[0].as_array().unwrap().len(), 2);
        }
    }

    #[test]
    fn a_short_segment_never_becomes_a_wall() {
        let lines = vec![
            Line { x1: 0.0, y1: 0.0, x2: 400.0, y2: 0.0 },
            Line { x1: 400.0, y1: 0.0, x2: 400.0, y2: 300.0 },
            Line { x1: 400.0, y1: 300.0, x2: 0.0, y2: 300.0 },
            Line { x1: 0.0, y1: 300.0, x2: 0.0, y2: 0.0 },
            Line { x1: 10.0, y1: 10.0, x2: 14.0, y2: 10.0 },
        ];
        let plan = build_plan(&lines, PlanOptions::default());
        assert_eq!(plan.walls.len(), 4);
        assert_eq!(plan.rooms.len(), 1);
        // 400 px × 300 px at 10 mm/px is 4.0 × 3.0 m.
        assert!((plan.rooms[0].area - 12.0).abs() < 0.05, "area {}", plan.rooms[0].area);
    }

    #[test]
    fn a_wall_butting_into_another_closes_the_room() {
        // Rectangle with a partition running from the middle of one wall to the
        // middle of the opposite one: two rooms, and both ends of the partition
        // must share a node with the wall it lands on.
        let lines = vec![
            Line { x1: 0.0, y1: 0.0, x2: 600.0, y2: 0.0 },
            Line { x1: 600.0, y1: 0.0, x2: 600.0, y2: 400.0 },
            Line { x1: 600.0, y1: 400.0, x2: 0.0, y2: 400.0 },
            Line { x1: 0.0, y1: 400.0, x2: 0.0, y2: 0.0 },
            Line { x1: 300.0, y1: 0.0, x2: 300.0, y2: 400.0 },
        ];
        let plan = build_plan(&lines, PlanOptions::default());
        assert_eq!(plan.rooms.len(), 2, "areas: {:?}", plan.rooms.iter().map(|r| r.area).collect::<Vec<_>>());
        let total = plan.floor_area();
        assert!((total - 24.0).abs() < 0.3, "total {total}");
    }
}
