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

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum OpeningKind {
    Door,
    Window,
}

impl OpeningKind {
    pub fn name(&self) -> &'static str {
        match self {
            OpeningKind::Door => "door",
            OpeningKind::Window => "window",
        }
    }
}

/// A gap the wall graph leaves between two collinear wall ends: a doorway
/// between two rooms, or an opening in the envelope.
#[derive(Clone, Copy, Debug)]
pub struct Opening {
    /// The gap, measured along the wall centre line.
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub kind: OpeningKind,
    pub width: f32,
    /// The height band the opening leaves open, in metres.
    pub sill: f32,
    pub head: f32,
    /// The wall the gap starts in, and how far along it the gap begins.
    pub wall: usize,
    pub offset: f32,
}

impl Opening {
    /// Wall area the opening removes: floor to head for a door, sill to head for
    /// a window. The header over a door and the apron under a window stay in the
    /// takeoff, which is why the band is subtracted and not the whole wall.
    pub fn area(&self) -> f32 {
        self.width * (self.head - self.sill).max(0.0)
    }
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
    /// Gaps between collinear wall ends in this range are openings. Below the
    /// minimum a gap is a break in the stroke; above the maximum the two walls
    /// are unrelated pieces of the drawing.
    pub min_opening_m: f32,
    pub max_opening_m: f32,
    /// The height band each kind of opening leaves open. A door runs from the
    /// floor to its head; a window from its sill to its head.
    pub door_head_m: f32,
    pub window_sill_m: f32,
    pub window_head_m: f32,
    /// Two walls are read as one line when their directions differ by less than
    /// this and their ends sit on that line.
    pub opening_angle_deg: f32,
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
            // A 500 mm gap is already narrower than any door or window, so a
            // break in the ink is not mistaken for one.
            min_opening_m: 0.5,
            max_opening_m: 4.0,
            // Standard residential: a 2.1 m door head, a 900 mm window sill.
            door_head_m: 2.1,
            window_sill_m: 0.9,
            window_head_m: 2.1,
            opening_angle_deg: 3.0,
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
    /// Wall area the classified openings remove, and what is left of it.
    pub opening_area: f32,
    pub wall_net_area: f32,
    pub doors: i64,
    pub windows: i64,
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
    pub openings: Vec<Opening>,
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
        // Drywall and paint skip the holes the openings leave, so both are
        // measured on the walls as built, not as if the plan were solid.
        let opening_area: f32 = self.openings.iter().map(Opening::area).sum();
        let wall_net_area = (wall_gross_area - opening_area).max(0.0);
        let covered = wall_net_area + floor_area;
        let studs = self
            .walls
            .iter()
            .map(|wall| (wall.length * 1000.0 / self.stud_spacing_mm).floor() as i64 + 1)
            .sum();

        Takeoff {
            wall_length,
            wall_gross_area,
            opening_area,
            wall_net_area,
            doors: self.openings.iter().filter(|opening| opening.kind == OpeningKind::Door).count() as i64,
            windows: self.openings.iter().filter(|opening| opening.kind == OpeningKind::Window).count() as i64,
            floor_area,
            volume: floor_area * self.wall_height,
            drywall_sheets: if covered > 0.0 { (covered / SHEET_M2 - 1e-6).ceil() as i64 } else { 0 },
            paint_litres: if covered > 0.0 { ((covered * 2.0) / 10.0 - 1e-6).ceil() as i64 } else { 0 },
            flooring_m2: floor_area * 1.1,
            baseboard_m: self.rooms.iter().map(|room| room.perimeter).sum(),
            studs,
            plates_m: wall_length * 3.0,
            sheathing_panels: if wall_net_area > 0.0 {
                (wall_net_area / SHEET_M2 - 1e-6).ceil() as i64
            } else {
                0
            },
        }
    }

    /// The plan JSON the ports read: metres, walls carrying the openings that sit
    /// in them, and one polygon per closed room.
    pub fn to_json(&self, project: &str) -> Value {
        let walls: Vec<Value> = self
            .walls
            .iter()
            .enumerate()
            .map(|(index, wall)| {
                let openings: Vec<Value> = self
                    .openings
                    .iter()
                    .filter(|opening| opening.wall == index)
                    .map(|opening| {
                        json!({
                            "kind": opening.kind.name(),
                            "width": round3(opening.width),
                            "offset": round3(opening.offset),
                            "sill": round2(opening.sill),
                            "head": round2(opening.head)
                        })
                    })
                    .collect();
                json!({
                    "x1": round3(wall.x1),
                    "y1": round3(wall.y1),
                    "x2": round3(wall.x2),
                    "y2": round3(wall.y2),
                    "openings": openings
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
            "walls": walls,
            "openings": self
                .openings
                .iter()
                .map(|opening| {
                    json!({
                        "kind": opening.kind.name(),
                        "x1": round3(opening.x1),
                        "y1": round3(opening.y1),
                        "x2": round3(opening.x2),
                        "y2": round3(opening.y2),
                        "width": round3(opening.width),
                        "sill": round2(opening.sill),
                        "head": round2(opening.head),
                        "area": round3(opening.area())
                    })
                })
                .collect::<Vec<Value>>()
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

/// The drawing's ink, with the pixel grid it sits on. Only a raster has one: the
/// symbols drawn inside an opening — a swing arc, a run of glazing — are what
/// tell a window from a door, and they are pixels rather than wall centre lines.
#[derive(Clone, Copy)]
pub struct Ink<'a> {
    pub mask: &'a [bool],
    pub width: u32,
    pub height: u32,
    /// Millimetres of building per pixel of *this* raster. The plan's own scale
    /// describes its line coordinates, which for a PDF are points; a page
    /// rendered to read its symbols has a scale of its own.
    pub mm_per_px: f32,
    /// Whether thin strokes can be told from walls and dropped. The comparison is
    /// against the drawing's own median stroke, so a plan drawn entirely in
    /// hairlines keeps every wall either way.
    pub filter_walls: bool,
}

impl Ink<'_> {
    /// How wide the stroke under a segment is: `(lower quartile, widest)`. The
    /// segment is in the plan's line units and the mask in its own pixels, so
    /// `scale` is how many of those pixels one line unit covers.
    fn widths(&self, line: &Line, scale: f32) -> (f32, f32) {
        let scaled = Line {
            x1: line.x1 * scale,
            y1: line.y1 * scale,
            x2: line.x2 * scale,
            y2: line.y2 * scale,
        };
        crate::detect::stroke_width(
            self.mask,
            self.width as usize,
            self.height as usize,
            &scaled,
        )
    }
}

/// Walls are at least this thick in the building, so a stroke thinner than it is
/// drawn rather than built.
const MIN_WALL_STROKE_M: f32 = 0.05;

/// Scale the detected segments into metres and close them into rooms.
pub fn build_plan(lines: &[Line], options: PlanOptions) -> Plan {
    build_plan_inked(lines, options, None)
}

/// As [`build_plan`], reading the drawing's ink as well: hairline strokes across
/// an opening are glazing, not walls, and the swing arcs and glazing lines drawn
/// in a gap decide whether it is a door or a window.
pub fn build_plan_inked(lines: &[Line], options: PlanOptions, ink: Option<Ink<'_>>) -> Plan {
    let m_per_px = options.mm_per_px.max(0.1) / 1000.0;

    let kept: Vec<Line> = match ink {
        Some(ink) if ink.filter_walls => {
            keep_walls(lines, &ink, options.mm_per_px / ink.mm_per_px.max(1e-6))
        }
        _ => lines.to_vec(),
    };

    let walls: Vec<Wall> = kept
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
    // The symbols are read at the raster's scale, not the plan's: they are
    // pixels, and a rendered page's pixels are not the same size as a PDF point.
    let ink_scale = ink.map(|ink| ink.mm_per_px).unwrap_or(options.mm_per_px);
    let openings = find_openings(&walls, &rooms, &options, ink.as_ref(), ink_scale);

    Plan {
        scale_mm_per_px: options.mm_per_px,
        wall_height: options.wall_height,
        stud_spacing_mm: options.stud_spacing_mm,
        width_m: options.image_width as f32 * m_per_px,
        depth_m: options.image_height as f32 * m_per_px,
        walls,
        rooms,
        openings,
    }
}

/// Keep the strokes that are built and drop the ones that are drawn. Glazing
/// across a window is a few pixels wide where the wall is many, and keeping it as
/// a wall would both add a wall and close the opening it sits in. The comparison
/// is against the median stroke of the same drawing, so a plan drawn entirely in
/// hairlines keeps every wall: there is no thickness there to tell them apart.
fn keep_walls(lines: &[Line], ink: &Ink<'_>, scale: f32) -> Vec<Line> {
    if lines.len() < 3 {
        return lines.to_vec();
    }

    let mut widths: Vec<f32> = lines.iter().map(|line| ink.widths(line, scale).0).collect();
    widths.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median = widths[widths.len() / 2];

    // No stroke in this drawing is thick enough to be a wall: leave it alone.
    let hairline = (MIN_WALL_STROKE_M / ink.mm_per_px.max(1e-6)).clamp(1.5, 3.0);
    if median < hairline {
        return lines.to_vec();
    }

    let cut = (median * 0.5).max(1.5);
    let mut lengths: Vec<f32> = lines.iter().map(|line| line.length()).collect();
    lengths.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let long_enough = lengths[lengths.len() / 2] * 0.5;

    lines
        .iter()
        .copied()
        .filter(|line| {
            let (thin_end, widest) = ink.widths(line, scale);
            if thin_end >= cut {
                return true;
            }
            // A wall that tapers to a hairline at one end is thick at the other
            // and runs the length of the drawing; a symbol is thin throughout
            // and short.
            widest >= cut && line.length() >= long_enough
        })
        .collect()
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

struct Gap {
    /// The wall the gap opens from, and how far along it the gap starts.
    wall: usize,
    offset: f32,
    from: Pt,
    to: Pt,
    width: f32,
}

fn endpoints(wall: &Wall) -> (Pt, Pt) {
    (
        Pt { x: wall.x1, y: wall.y1 },
        Pt { x: wall.x2, y: wall.y2 },
    )
}

/// Two walls on one line: same direction, and both ends of `b` within
/// `offset_tol` of the infinite line through `a`.
fn on_same_line(a: &Wall, b: &Wall, angle_tol: f32, offset_tol: f32) -> bool {
    let (adx, ady) = (a.x2 - a.x1, a.y2 - a.y1);
    let (bdx, bdy) = (b.x2 - b.x1, b.y2 - b.y1);
    let alen = (adx * adx + ady * ady).sqrt();
    let blen = (bdx * bdx + bdy * bdy).sqrt();
    if alen < 1e-6 || blen < 1e-6 {
        return false;
    }
    let cross = ((adx / alen) * (bdy / blen) - (ady / alen) * (bdx / blen)).abs();
    if cross > angle_tol.sin() {
        return false;
    }
    let (ux, uy) = (adx / alen, ady / alen);
    [(b.x1, b.y1), (b.x2, b.y2)]
        .iter()
        .all(|(x, y)| ((x - a.x1) * uy - (y - a.y1) * ux).abs() <= offset_tol)
}

/// True when the wall ends at the given end and does not continue towards
/// `towards` — so the wall body lies on the far side of its own end point.
fn ends_at(wall: &Wall, end: bool, towards: Pt) -> bool {
    let (start, finish) = endpoints(wall);
    let at = if end { finish } else { start };
    let other = if end { start } else { finish };
    (other.x - at.x) * (towards.x - at.x) + (other.y - at.y) * (towards.y - at.y) < 0.0
}

/// Proper intersection of a wall with the gap, sharing an end point excluded:
/// a wall crossing the opening means there is no opening there.
fn crosses_gap(wall: &Wall, from: Pt, to: Pt) -> bool {
    let (rx, ry) = (to.x - from.x, to.y - from.y);
    let (sx, sy) = (wall.x2 - wall.x1, wall.y2 - wall.y1);
    let denom = rx * sy - ry * sx;
    if denom.abs() < 1e-9 {
        return false;
    }
    let (qx, qy) = (wall.x1 - from.x, wall.y1 - from.y);
    let t = (qx * sy - qy * sx) / denom;
    let u = (qx * ry - qy * rx) / denom;
    t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95
}

/// Gaps between collinear wall ends: a doorway leaves the wall broken, and the
/// detector keeps the two pieces as two walls, so the hole is geometry rather
/// than a symbol that has to be recognised.
fn find_gaps(walls: &[Wall], options: &PlanOptions) -> Vec<Gap> {
    let angle_tol = options.opening_angle_deg.max(0.1).to_radians();
    let offset_tol = (options.snap_m * 1.5).max(0.03);
    let mut gaps: Vec<Gap> = Vec::new();

    for i in 0..walls.len() {
        for j in 0..walls.len() {
            if i == j || !on_same_line(&walls[i], &walls[j], angle_tol, offset_tol) {
                continue;
            }
            for (i_end, j_end) in [(true, false), (false, true), (true, true), (false, false)] {
                let (start, finish) = endpoints(&walls[i]);
                let from = if i_end { finish } else { start };
                let (j_start, j_finish) = endpoints(&walls[j]);
                let to = if j_end { j_finish } else { j_start };

                let width = ((to.x - from.x).powi(2) + (to.y - from.y).powi(2)).sqrt();
                if width < options.min_opening_m || width > options.max_opening_m {
                    continue;
                }
                if !ends_at(&walls[i], i_end, to) || !ends_at(&walls[j], j_end, from) {
                    continue;
                }
                if walls
                    .iter()
                    .enumerate()
                    .any(|(k, wall)| k != i && k != j && crosses_gap(wall, from, to))
                {
                    continue;
                }

                // One gap can be found from both walls that bound it.
                let mid = Pt { x: (from.x + to.x) / 2.0, y: (from.y + to.y) / 2.0 };
                let duplicate = gaps.iter().any(|gap| {
                    let gx = (gap.from.x + gap.to.x) / 2.0;
                    let gy = (gap.from.y + gap.to.y) / 2.0;
                    (gx - mid.x).powi(2) + (gy - mid.y).powi(2) < 0.0025
                });
                if duplicate {
                    continue;
                }

                gaps.push(Gap {
                    wall: i,
                    offset: if i_end { walls[i].length } else { 0.0 },
                    from,
                    to,
                    width,
                });
            }
        }
    }

    gaps
}

/// Classify each gap by what it opens between. A gap with a room on both sides
/// is a door through a partition; a gap with a room on one side is an opening in
/// the envelope, which a plan draws the same way whether it is a window or an
/// entrance. The rooms are read from the graph with the gaps closed, so an
/// opening in the shell does not merge the interior with the outside.
fn find_openings(
    walls: &[Wall],
    rooms: &[Room],
    options: &PlanOptions,
    ink: Option<&Ink<'_>>,
    m_per_px: f32,
) -> Vec<Opening> {
    let gaps = find_gaps(walls, options);
    if gaps.is_empty() {
        return Vec::new();
    }

    let mut closed = walls.to_vec();
    for gap in &gaps {
        closed.push(Wall {
            x1: gap.from.x,
            y1: gap.from.y,
            x2: gap.to.x,
            y2: gap.to.y,
            length: gap.width,
        });
    }
    let bridged = find_rooms(&closed, options);
    let sides: &[Room] = if bridged.is_empty() { rooms } else { &bridged };

    let mut openings: Vec<Opening> = Vec::new();
    for gap in gaps {
        let mid = Pt {
            x: (gap.from.x + gap.to.x) / 2.0,
            y: (gap.from.y + gap.to.y) / 2.0,
        };
        let length = gap.width.max(1e-6);
        let nx = -(gap.to.y - gap.from.y) / length;
        let ny = (gap.to.x - gap.from.x) / length;
        let probe = 0.25;
        let a = Pt { x: mid.x + nx * probe, y: mid.y + ny * probe };
        let b = Pt { x: mid.x - nx * probe, y: mid.y - ny * probe };
        let inside = |point: Pt| sides.iter().any(|room| point_in_polygon(point, &room.polygon));

        let topology = match (inside(a), inside(b)) {
            (true, true) => OpeningKind::Door,
            (true, false) | (false, true) => OpeningKind::Window,
            // Open to the outside on both sides: not an opening in a wall.
            _ => continue,
        };
        // The drawing settles it when there is ink to read: a swing arc says
        // door, glazing lines across the opening say window.
        let kind = match ink {
            Some(ink) => classify_by_symbol(gap.from, gap.to, ink, m_per_px, topology),
            None => topology,
        };
        let (sill, head) = opening_heights(kind, options);

        openings.push(Opening {
            x1: gap.from.x,
            y1: gap.from.y,
            x2: gap.to.x,
            y2: gap.to.y,
            kind,
            width: gap.width,
            sill,
            head,
            wall: gap.wall,
            offset: gap.offset,
        });
    }

    openings
}

/// What the drawing's own symbols say a gap is, falling back to what it opens
/// between. A swing arc is a door, glazing across the opening is a window, and a
/// plan that draws neither keeps the topology answer.
fn classify_by_symbol(
    from: Pt,
    to: Pt,
    ink: &Ink<'_>,
    m_per_px: f32,
    topology: OpeningKind,
) -> OpeningKind {
    let evidence = gap_evidence(ink, from, to, m_per_px);
    if evidence.swing >= SWING_COVERAGE {
        OpeningKind::Door
    } else if evidence.glazing >= 1 {
        OpeningKind::Window
    } else {
        topology
    }
}

/// A swing arc covers most of the quarter circle it describes, so a gap this
/// well filled by one is a door.
const SWING_COVERAGE: f32 = 0.55;

/// A line across the opening this continuous was drawn there deliberately.
const STROKE_COVERAGE: f32 = 0.75;

/// How many doors or windows the drawing shows inside a gap.
#[derive(Clone, Copy, Debug, Default)]
struct Evidence {
    /// Thin strokes running the width of the gap: glazing.
    glazing: u32,
    /// The best-filled quarter circle at the gap's own radius: a door swing.
    swing: f32,
}

fn gap_evidence(ink: &Ink<'_>, from: Pt, to: Pt, m_per_px: f32) -> Evidence {
    let (width, height) = (ink.width as usize, ink.height as usize);
    if width == 0 || height == 0 || m_per_px <= 0.0 {
        return Evidence::default();
    }

    let per_px = 1.0 / m_per_px;
    let (ax, ay) = (from.x * per_px, from.y * per_px);
    let (bx, by) = (to.x * per_px, to.y * per_px);
    let length = ((bx - ax).powi(2) + (by - ay).powi(2)).sqrt();
    if length < 8.0 {
        return Evidence::default();
    }
    let (ux, uy) = ((bx - ax) / length, (by - ay) / length);
    let (nx, ny) = (-uy, ux);
    // A one-pixel tolerance: a hairline can fall on either side of a sampled
    // coordinate, and a symbol drawn 1 px off is still drawn.
    let ink_at = |x: f32, y: f32| -> bool {
        let (xi, yi) = (x.round() as i32, y.round() as i32);
        (-1..=1).any(|dy| {
            (-1..=1).any(|dx| {
                let (px, py) = (xi + dx, yi + dy);
                px >= 0
                    && py >= 0
                    && (px as usize) < width
                    && (py as usize) < height
                    && ink.mask[py as usize * width + px as usize]
            })
        })
    };

    // How much of a line parallel to the gap is ink. The ends are held clear so
    // the strokes that stop at the opening cannot be counted as glazing.
    let coverage = |offset: f32| -> f32 {
        let (ox, oy) = (ax + nx * offset, ay + ny * offset);
        let (mut hits, mut total) = (0u32, 0u32);
        let mut s = length * 0.15;
        while s <= length * 0.85 {
            if ink_at(ox + ux * s, oy + uy * s) {
                hits += 1;
            }
            total += 1;
            s += 1.0;
        }
        if total == 0 {
            0.0
        } else {
            hits as f32 / total as f32
        }
    };

    // Glazing: each run of adjacent offsets is one stroke, and the run's length
    // is that stroke's width in pixels. A band wider than a few pixels is a wall
    // or a filled opening, not a window.
    let mut glazing = 0u32;
    let mut run = 0u32;
    const BAND: i32 = 6;
    for offset in -BAND..=BAND {
        if coverage(offset as f32) >= STROKE_COVERAGE {
            run += 1;
        } else {
            if (1..=3).contains(&run) {
                glazing += 1;
            }
            run = 0;
        }
    }
    if (1..=3).contains(&run) {
        glazing += 1;
    }

    // A door swing: a quarter circle of the gap's own radius, hinged at either
    // end and sweeping into a room. Only the middle angles are sampled, so the
    // leaf drawn along the wall does not count as an arc.
    let mut swing: f32 = 0.0;
    for hinge in [0.0f32, 1.0] {
        let (hx, hy) = (ax + (bx - ax) * hinge, ay + (by - ay) * hinge);
        let (dx, dy) = if hinge == 0.0 { (ux, uy) } else { (-ux, -uy) };
        for side in [-1.0f32, 1.0] {
            let (mut hits, mut total) = (0u32, 0u32);
            let mut degrees = 12.0f32;
            while degrees <= 78.0 {
                let (sin, cos) = degrees.to_radians().sin_cos();
                let hit = [0.97f32, 1.0, 1.03].iter().any(|factor| {
                    let radius = length * factor;
                    ink_at(
                        hx + (dx * cos + nx * side * sin) * radius,
                        hy + (dy * cos + ny * side * sin) * radius,
                    )
                });
                if hit {
                    hits += 1;
                }
                total += 1;
                degrees += 4.0;
            }
            swing = swing.max(hits as f32 / total.max(1) as f32);
        }
    }

    Evidence { glazing, swing }
}

fn opening_heights(kind: OpeningKind, options: &PlanOptions) -> (f32, f32) {
    let wall = options.wall_height.max(0.0);
    match kind {
        OpeningKind::Door => (0.0, options.door_head_m.clamp(0.0, wall)),
        OpeningKind::Window => {
            let head = options.window_head_m.clamp(0.0, wall);
            let sill = options.window_sill_m.clamp(0.0, head * 0.8);
            (sill, head)
        }
    }
}

fn point_in_polygon(point: Pt, polygon: &[Pt]) -> bool {
    if polygon.len() < 3 {
        return false;
    }
    let mut inside = false;
    let mut previous = polygon.len() - 1;
    for current in 0..polygon.len() {
        let (a, b) = (polygon[current], polygon[previous]);
        if (a.y > point.y) != (b.y > point.y) {
            let x = a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y);
            if point.x < x {
                inside = !inside;
            }
        }
        previous = current;
    }
    inside
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

    /// A 1.0 m gap in the shell is a window, a 1.0 m gap in the partition is a
    /// door, and neither is charged for drywall.
    #[test]
    fn gaps_are_classified_and_netted_out_of_the_wall_area() {
        let lines = vec![
            // Envelope with a 1.0 m break in the top wall.
            Line { x1: 0.0, y1: 0.0, x2: 200.0, y2: 0.0 },
            Line { x1: 300.0, y1: 0.0, x2: 800.0, y2: 0.0 },
            Line { x1: 800.0, y1: 0.0, x2: 800.0, y2: 600.0 },
            Line { x1: 800.0, y1: 600.0, x2: 0.0, y2: 600.0 },
            Line { x1: 0.0, y1: 600.0, x2: 0.0, y2: 0.0 },
            // Partition with a 1.0 m doorway in the middle.
            Line { x1: 400.0, y1: 0.0, x2: 400.0, y2: 250.0 },
            Line { x1: 400.0, y1: 350.0, x2: 400.0, y2: 600.0 },
        ];
        let plan = build_plan(&lines, PlanOptions::default());

        let kinds: Vec<&str> = plan.openings.iter().map(|opening| opening.kind.name()).collect();
        assert_eq!(plan.openings.len(), 2, "openings: {kinds:?}");
        let door = plan
            .openings
            .iter()
            .find(|opening| opening.kind == OpeningKind::Door)
            .expect("door");
        assert!((door.width - 1.0).abs() < 0.05, "door width {}", door.width);
        assert!((door.sill - 0.0).abs() < 1e-6 && (door.head - 2.1).abs() < 1e-6);

        let window = plan
            .openings
            .iter()
            .find(|opening| opening.kind == OpeningKind::Window)
            .expect("window");
        assert!((window.width - 1.0).abs() < 0.05, "window width {}", window.width);
        assert!((window.sill - 0.9).abs() < 1e-6 && (window.head - 2.1).abs() < 1e-6);

        let takeoff = plan.takeoff();
        assert_eq!(takeoff.doors, 1);
        assert_eq!(takeoff.windows, 1);
        // 1.0 m x 2.1 m door plus 1.0 m x 1.2 m window.
        assert!(
            (takeoff.opening_area - 3.3).abs() < 0.1,
            "opening area {}",
            takeoff.opening_area
        );
        assert!(
            (takeoff.wall_net_area - (takeoff.wall_gross_area - takeoff.opening_area)).abs() < 1e-3
        );
        assert!(takeoff.wall_net_area < takeoff.wall_gross_area);
        let sheets = ((takeoff.wall_net_area + takeoff.floor_area) / 2.88 - 1e-6).ceil() as i64;
        assert_eq!(takeoff.drywall_sheets, sheets);
    }

    fn paint(img: &mut image::GrayImage, x0: i32, y0: i32, x1: i32, y1: i32, thickness: u32) {
            let (dx, dy) = ((x1 - x0).abs(), -(y1 - y0).abs());
            let (sx, sy) = (if x0 < x1 { 1 } else { -1 }, if y0 < y1 { 1 } else { -1 });
            let (mut x, mut y, mut err) = (x0, y0, dx + dy);
            loop {
                for oy in 0..thickness as i32 {
                    for ox in 0..thickness as i32 {
                        let (px, py) = (x + ox, y + oy);
                        if px >= 0 && py >= 0 && (px as u32) < img.width() && (py as u32) < img.height() {
                            img.put_pixel(px as u32, py as u32, image::Luma([0]));
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

    /// A plan drawn with thick walls, hairline glazing across a window and a swing
    /// arc in a doorway: 800 x 600 at 10 mm/px, so 1 m is 100 px.
    fn symbol_plan() -> image::GrayImage {
        // 800 x 600 at 10 mm/px, so 1 m is 100 px: thick walls, hairline symbols.
        let mut img = image::GrayImage::from_pixel(800, 600, image::Luma([255]));
        let wall = 6;
        // Shell, with a 1.0 m window gap in the top wall.
        paint(&mut img, 60, 60, 500, 60, wall);
        paint(&mut img, 600, 60, 760, 60, wall);
        paint(&mut img, 760, 60, 760, 540, wall);
        paint(&mut img, 760, 540, 60, 540, wall);
        paint(&mut img, 60, 540, 60, 60, wall);
        // Glazing across the window: two hairlines, clear of both wall ends.
        paint(&mut img, 512, 57, 588, 57, 1);
        paint(&mut img, 512, 68, 588, 68, 1);
        // Partition with a 1.0 m doorway, and the swing arc a plan draws.
        paint(&mut img, 400, 60, 400, 250, wall);
        paint(&mut img, 400, 350, 400, 540, wall);
        // Hinged on the doorway's own end, at its own width.
        let mut previous = (402.5f32, 250.0f32);
        for degrees in 0..=90 {
            let radians = (degrees as f32).to_radians();
            let point = (402.5 + 100.0 * radians.cos(), 250.0 + 100.0 * radians.sin());
            paint(&mut img, previous.0 as i32, previous.1 as i32, point.0 as i32, point.1 as i32, 1);
            previous = point;
        }
        img
    }

    /// A window is drawn with glazing lines and a door with a swing arc. Reading
    /// those symbols is what tells the two apart, in the shell as well as in a
    /// partition, and neither symbol may survive as a wall.
    #[test]
    fn glazing_and_a_swing_are_read_as_a_window_and_a_door() {
        let img = symbol_plan();

        // The segments the detector hands over, plus the two glazing lines it
        // would draw: this test is about reading the ink, not about Hough.
        let lines = vec![
            Line { x1: 60.0, y1: 62.5, x2: 500.0, y2: 62.5 },
            Line { x1: 600.0, y1: 62.5, x2: 760.0, y2: 62.5 },
            Line { x1: 760.0, y1: 62.5, x2: 760.0, y2: 540.0 },
            Line { x1: 760.0, y1: 540.0, x2: 60.0, y2: 540.0 },
            Line { x1: 60.0, y1: 540.0, x2: 60.0, y2: 62.5 },
            Line { x1: 402.5, y1: 62.5, x2: 402.5, y2: 250.0 },
            Line { x1: 402.5, y1: 350.0, x2: 402.5, y2: 540.0 },
            Line { x1: 512.0, y1: 57.0, x2: 588.0, y2: 57.0 },
            Line { x1: 512.0, y1: 68.0, x2: 588.0, y2: 68.0 },
        ];
        let mask = crate::detect::ink_mask(&img);
        let mut options = PlanOptions::default();
        options.image_width = img.width();
        options.image_height = img.height();
        let plan = build_plan_inked(
            &lines,
            options,
            Some(Ink {
                mask: &mask,
                width: img.width(),
                height: img.height(),
                mm_per_px: options.mm_per_px,
                filter_walls: true,
            }),
        );

        let kinds: Vec<(String, f32)> = plan
            .openings
            .iter()
            .map(|opening| (opening.kind.name().to_string(), opening.width))
            .collect();
        let window = plan.openings.iter().find(|opening| opening.kind == OpeningKind::Window);
        let door = plan.openings.iter().find(|opening| opening.kind == OpeningKind::Door);
        assert!(window.is_some(), "no window read from the glazing: {kinds:?}");
        assert!(door.is_some(), "no door read from the swing: {kinds:?}");
        assert!((window.unwrap().width - 1.0).abs() < 0.12, "{:?}", window.unwrap().width);
        assert!((door.unwrap().width - 1.0).abs() < 0.12, "{:?}", door.unwrap().width);
        assert!((window.unwrap().sill - 0.9).abs() < 1e-6);

        // The symbols are drawn, not built: the walls are the shell and the
        // partition only, and every one of them is long.
        let lengths: Vec<f32> = plan.walls.iter().map(|wall| wall.length).collect();
        assert_eq!(plan.walls.len(), 7, "{lengths:?}");
        assert!(plan.walls.iter().all(|wall| wall.length > 0.4), "{lengths:?}");
    }

    /// A wall that tapers to a hairline at one end is still a wall; a short thin
    /// stroke is a symbol. The drop rule has to tell the two apart.
    #[test]
    fn a_tapered_wall_is_kept_but_a_hairline_symbol_is_not() {
        let mut img = image::GrayImage::from_pixel(700, 200, image::Luma([255]));
        for x in [60, 160, 460, 560] {
            paint(&mut img, x, 20, x, 180, 6);
        }
        // 660 px long, 6 px thick at one end and 2 px at the other.
        paint(&mut img, 20, 100, 349, 100, 6);
        paint(&mut img, 350, 100, 680, 100, 2);
        // 40 px of hairline: a dimension tick or a symbol, not a wall.
        paint(&mut img, 620, 150, 660, 150, 1);

        let lines = vec![
            Line { x1: 60.0, y1: 20.0, x2: 60.0, y2: 180.0 },
            Line { x1: 160.0, y1: 20.0, x2: 160.0, y2: 180.0 },
            Line { x1: 460.0, y1: 20.0, x2: 460.0, y2: 180.0 },
            Line { x1: 560.0, y1: 20.0, x2: 560.0, y2: 180.0 },
            Line { x1: 20.0, y1: 100.0, x2: 680.0, y2: 100.0 },
            Line { x1: 620.0, y1: 150.0, x2: 660.0, y2: 150.0 },
        ];
        let mask = crate::detect::ink_mask(&img);
        let ink = Ink {
            mask: &mask,
            width: img.width(),
            height: img.height(),
            mm_per_px: 10.0,
            filter_walls: true,
        };

        let kept = keep_walls(&lines, &ink, 1.0);
        assert_eq!(kept.len(), 5, "kept {kept:?}");
        assert!(kept.iter().any(|line| line.length() > 600.0), "the tapered wall was dropped");
        assert!(
            !kept.iter().any(|line| (line.length() - 40.0).abs() < 1.0),
            "the hairline was kept as a wall"
        );
    }

    /// The same drawing, read end to end: the detector keeps both pieces of the
    /// walls it breaks, and the symbols in the gaps decide the kinds.
    #[test]
    fn a_drawn_plan_with_symbols_is_classified_end_to_end() {
        let img = symbol_plan();
        let lines = detect_lines(&img, DetectOptions::default());
        let mask = crate::detect::ink_mask(&img);

        let mut options = PlanOptions::default();
        options.image_width = img.width();
        options.image_height = img.height();
        let plan = build_plan_inked(
            &lines,
            options,
            Some(Ink {
                mask: &mask,
                width: img.width(),
                height: img.height(),
                mm_per_px: options.mm_per_px,
                filter_walls: true,
            }),
        );

        let kinds: Vec<(&str, f32)> = plan
            .openings
            .iter()
            .map(|opening| (opening.kind.name(), opening.width))
            .collect();
        assert_eq!(plan.openings.len(), 2, "openings: {kinds:?}");
        assert!(
            kinds.iter().any(|(kind, width)| *kind == "window" && (*width - 1.0).abs() < 0.15),
            "{kinds:?}"
        );
        assert!(
            kinds.iter().any(|(kind, width)| *kind == "door" && (*width - 1.0).abs() < 0.15),
            "{kinds:?}"
        );

        let lengths: Vec<f32> = plan.walls.iter().map(|wall| wall.length).collect();
        assert_eq!(plan.walls.len(), 7, "{lengths:?}");
    }

    /// The committed fixture, which draws the symbols the way a plan does: a
    /// 1.2 m window with glazing and a 0.9 m doorway with a swing.
    #[test]
    fn the_symbol_fixture_reads_a_window_and_a_door() {
        let image = image::open("fixtures/symbol_plan.png").expect("symbol fixture");
        let luma = image.to_luma8();
        let lines = detect_lines(&luma, DetectOptions::default());
        let mask = crate::detect::ink_mask(&luma);
        let mut options = PlanOptions::default();
        options.image_width = luma.width();
        options.image_height = luma.height();
        let plan = build_plan_inked(
            &lines,
            options,
            Some(Ink {
                mask: &mask,
                width: luma.width(),
                height: luma.height(),
                mm_per_px: 10.0,
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
}
