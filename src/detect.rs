//! Blueprint line detection: Otsu binarisation + Hough transform + segment merging.
//!
//! This replaces the old row-scan detector, which walked every pixel row and kept
//! horizontal ink runs. That found horizontal walls and nothing else, so vertical
//! and diagonal walls were dropped entirely and each thick wall produced one
//! duplicated segment per row.
//!
//! The pipeline here is:
//!
//! ```text
//! grayscale -> Otsu threshold -> Hough accumulate -> peak suppression
//!           -> ink-run extent per peak -> collinear merge -> segments
//! ```

use image::GrayImage;

/// Number of Hough angle bins (1 degree per bin over `[0, 180)`).
const THETAS: usize = 180;

/// Maximum number of surviving peaks, highest vote count first.
const MAX_PEAKS: usize = 400;

/// Vote counts within this margin of each other count as a tie, broken by how
/// close the angle is to horizontal/vertical/diagonal. Blueprints are mostly
/// orthogonal, so a 90 degree wall should win over a 89 degree near-tie.
const NMS_MARGIN: u32 = 2;

/// A segment is redundant when it sits inside a longer segment this similar in angle.
const REDUNDANT_ANGLE_DEG: f32 = 30.0;

/// Blueprints are drawn on horizontal, vertical and 45 degree axes; a wall this
/// close to one is pulled onto it so the exported wireframe is exact. The tolerance
/// is generous because a snap is only kept when the ink still lies along it.
const DEFAULT_SNAP_ANGLE_DEG: f32 = 8.0;

/// How far off a wall centreline a fragment may sit and still be considered part
/// of it. Hough peaks land a few pixels off a thick stroke, so this is looser than
/// `merge_distance_px`.
const DEFAULT_REDUNDANT_OFFSET_PX: f32 = 9.0;

/// A straight segment in image pixel coordinates (y grows downwards).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Line {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

impl Line {
    pub fn length(&self) -> f32 {
        ((self.x2 - self.x1).powi(2) + (self.y2 - self.y1).powi(2)).sqrt()
    }
}

/// Tuning for [`detect_lines`].
#[derive(Clone, Copy, Debug)]
pub struct DetectOptions {
    /// Segments shorter than this (in pixels) are discarded.
    pub min_length: f32,
    /// A Hough bin needs at least this many votes to become a candidate.
    pub vote_threshold: u32,
    /// Two candidates up to this many degrees apart may be merged.
    pub merge_angle_deg: f32,
    /// Two candidates up to this many pixels apart may be merged.
    pub merge_distance_px: f32,
    /// Collinear ink separated by at most this gap is treated as one segment.
    pub merge_gap_px: f32,
    /// Segments this close to horizontal, vertical or 45 degrees are snapped onto
    /// that axis. Set to 0 to leave every segment at its detected angle.
    pub snap_angle_deg: f32,
    /// A fragment this close to a longer parallel segment, and lying over at least
    /// half of it, is dropped as a duplicate of that wall.
    pub redundant_offset_px: f32,
}

impl Default for DetectOptions {
    fn default() -> Self {
        Self {
            min_length: 24.0,
            vote_threshold: 18,
            merge_angle_deg: 4.0,
            merge_distance_px: 6.0,
            merge_gap_px: 6.0,
            snap_angle_deg: DEFAULT_SNAP_ANGLE_DEG,
            redundant_offset_px: DEFAULT_REDUNDANT_OFFSET_PX,
        }
    }
}

/// Detect straight wall segments in a blueprint image.
pub fn detect_lines(img: &GrayImage, options: DetectOptions) -> Vec<Line> {
    let w = img.width() as usize;
    let h = img.height() as usize;
    if w == 0 || h == 0 {
        return Vec::new();
    }

    let mask = ink_mask(img);
    let ink: Vec<(usize, usize)> = mask
        .iter()
        .enumerate()
        .filter(|(_, on)| **on)
        .map(|(i, _)| (i % w, i / w))
        .collect();
    if ink.is_empty() {
        return Vec::new();
    }

    let diag = ((w * w + h * h) as f64).sqrt().ceil() as i32;
    let rho_bins = (2 * diag + 1) as usize;
    let cos_t: Vec<f32> = (0..THETAS)
        .map(|t| (t as f32).to_radians().cos())
        .collect();
    let sin_t: Vec<f32> = (0..THETAS)
        .map(|t| (t as f32).to_radians().sin())
        .collect();

    // Vote every ink pixel into each angle's rho histogram.
    let mut acc = vec![0u32; THETAS * rho_bins];
    for &(x, y) in &ink {
        let (xf, yf) = (x as f32, y as f32);
        for t in 0..THETAS {
            let rho = xf * cos_t[t] + yf * sin_t[t];
            let idx = (rho.round() as i32 + diag) as usize;
            acc[t * rho_bins + idx] += 1;
        }
    }

    let mut peaks = find_peaks(&acc, rho_bins, options.vote_threshold);
    peaks.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then(a.1.cmp(&b.1))
            .then(a.2.cmp(&b.2))
    });
    peaks.truncate(MAX_PEAKS);

    // Collapse candidates that describe the same wall, keeping the strongest.
    let mut reps: Vec<(usize, f32)> = Vec::new();
    for &(_, t, r) in &peaks {
        let rho = (r as f64 - diag as f64) as f32;
        let duplicate = reps.iter().any(|&(rt, rr)| {
            peaks_collinear(rt, rr, t, rho, &options)
        });
        if !duplicate {
            reps.push((t, rho));
        }
    }

    // Walk the ink along each candidate line to recover its real extent.
    let mut segments: Vec<Line> = reps
        .into_iter()
        .filter_map(|(t, rho)| segment_from_polar(t, rho, w, h, &mask, &options))
        .collect();

    // Snap before merging: a thick stroke yields several candidates a few degrees
    // apart, and re-reading each along the axis turns them into the one full wall
    // they describe. Merging first would let that drift past the snap tolerance.
    let snapped = snap_to_axes(segments.drain(..).collect(), w, h, &mask, &options);

    let merged = merge_collinear(sort_by_length(snapped), &options);
    remove_redundant(merged, &options)
}

/// Longest first; the dedupe passes keep the strongest version of each wall.
fn sort_by_length(mut lines: Vec<Line>) -> Vec<Line> {
    lines.sort_by(|a, b| {
        b.length()
            .partial_cmp(&a.length())
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    lines
}

/// Otsu's method: the threshold that maximises between-class variance.
fn otsu_threshold(gray: &GrayImage) -> u8 {
    let mut hist = [0u32; 256];
    for p in gray.pixels() {
        hist[p[0] as usize] += 1;
    }

    let total: f64 = hist.iter().map(|&c| c as f64).sum();
    if total == 0.0 {
        return 128;
    }
    let sum: f64 = hist
        .iter()
        .enumerate()
        .map(|(i, &c)| i as f64 * c as f64)
        .sum();

    let (mut weight_bg, mut sum_bg) = (0.0f64, 0.0f64);
    let mut best_variance = -1.0f64;
    let mut best_threshold = 128u8;

    for t in 0..256 {
        weight_bg += hist[t] as f64;
        if weight_bg == 0.0 {
            continue;
        }
        let weight_fg = total - weight_bg;
        if weight_fg == 0.0 {
            break;
        }
        sum_bg += t as f64 * hist[t] as f64;
        let mean_bg = sum_bg / weight_bg;
        let mean_fg = (sum - sum_bg) / weight_fg;
        let variance = weight_bg * weight_fg * (mean_bg - mean_fg).powi(2);
        if variance > best_variance {
            best_variance = variance;
            best_threshold = t as u8;
        }
    }

    best_threshold
}

/// True where a pixel belongs to the drawing (dark ink).
fn ink_mask(gray: &GrayImage) -> Vec<bool> {
    let threshold = otsu_threshold(gray);
    gray.pixels().map(|p| p[0] <= threshold).collect()
}

/// Distance in degrees from the nearest horizontal, vertical or 45 degree axis.
fn axis_offset(theta_deg: f32) -> f32 {
    (theta_deg - (theta_deg / 45.0).round() * 45.0).abs()
}

/// Local-maximum suppression over the accumulator, in `(votes, theta, rho_bin)`.
fn find_peaks(acc: &[u32], rho_bins: usize, vote_threshold: u32) -> Vec<(u32, usize, usize)> {
    let mut peaks = Vec::new();
    let theta_window = 2i32;
    let rho_window = 4i32;

    for t in 0..THETAS {
        for r in 0..rho_bins {
            let votes = acc[t * rho_bins + r];
            if votes < vote_threshold {
                continue;
            }
            let mut is_local_max = true;
            'window: for dt in -theta_window..=theta_window {
                let tt = (t as i32 + dt).rem_euclid(THETAS as i32) as usize;
                for dr in -rho_window..=rho_window {
                    let rr = r as i32 + dr;
                    if rr < 0 || rr >= rho_bins as i32 || (dt == 0 && dr == 0) {
                        continue;
                    }
                    let rival = acc[tt * rho_bins + rr as usize];
                    let beats = rival > votes
                        || (rival + NMS_MARGIN >= votes
                            && axis_offset(tt as f32) < axis_offset(t as f32));
                    if beats {
                        is_local_max = false;
                        break 'window;
                    }
                }
            }
            if is_local_max {
                peaks.push((votes, t, r));
            }
        }
    }

    peaks
}

/// Whether two polar candidates describe the same wall.
fn peaks_collinear(
    theta_a: usize,
    rho_a: f32,
    theta_b: usize,
    rho_b: f32,
    options: &DetectOptions,
) -> bool {
    let raw = (theta_a as f32 - theta_b as f32).abs();
    let wrapped = raw > 90.0;
    let angle_gap = if wrapped { 180.0 - raw } else { raw };
    // Past 90 degrees the normal flips side, so rho changes sign.
    let rho_b = if wrapped { -rho_b } else { rho_b };
    angle_gap <= options.merge_angle_deg && (rho_a - rho_b).abs() <= options.merge_distance_px
}

/// Clamp-based extent of the ink belonging to a polar line.
fn segment_from_polar(
    theta: usize,
    rho: f32,
    w: usize,
    h: usize,
    mask: &[bool],
    options: &DetectOptions,
) -> Option<Line> {
    let rad = (theta as f32).to_radians();
    let (nx, ny) = (rad.cos(), rad.sin());
    let (tx, ty) = (-ny, nx);
    let (ox, oy) = (rho * nx, rho * ny);

    let (s_min, s_max) = image_span(ox, oy, tx, ty, w, h);
    let runs = ink_runs(
        mask,
        w,
        h,
        ox,
        oy,
        tx,
        ty,
        s_min,
        s_max,
        options.merge_gap_px,
    );
    let (s0, s1) = runs
        .into_iter()
        .max_by(|a, b| {
            (a.1 - a.0)
                .partial_cmp(&(b.1 - b.0))
                .unwrap_or(std::cmp::Ordering::Equal)
        })?;
    if s1 - s0 < options.min_length {
        return None;
    }

    Some(Line {
        x1: ox + s0 * tx,
        y1: oy + s0 * ty,
        x2: ox + s1 * tx,
        y2: oy + s1 * ty,
    })
}

/// Pull every segment that is close to an axis onto that axis, centred on the ink
/// stroke, then re-read its extent. Segments on no axis are returned untouched.
fn snap_to_axes(
    segments: Vec<Line>,
    w: usize,
    h: usize,
    mask: &[bool],
    options: &DetectOptions,
) -> Vec<Line> {
    segments
        .into_iter()
        .filter_map(|line| snap_segment(line, w, h, mask, options))
        .collect()
}

fn snap_segment(
    line: Line,
    w: usize,
    h: usize,
    mask: &[bool],
    options: &DetectOptions,
) -> Option<Line> {
    if options.snap_angle_deg <= 0.0 {
        return Some(line);
    }

    let angle = angle_deg(&line);
    let axis = [0.0f32, 45.0, 90.0, 135.0]
        .into_iter()
        .find(|&candidate| angle_gap(angle, candidate) <= options.snap_angle_deg);

    // Not on an axis: keep the detected angle and extent as they are.
    let Some(axis) = axis else {
        return Some(line);
    };

    let rad = axis.to_radians();
    let (tx, ty) = (rad.cos(), rad.sin());
    let (mut ox, mut oy) = ((line.x1 + line.x2) / 2.0, (line.y1 + line.y2) / 2.0);

    // Move onto the middle of the stroke: the Hough rho is quantised and a thick
    // wall yields peaks a couple of pixels off its centre.
    for _ in 0..2 {
        let (s_min, s_max) = image_span(ox, oy, tx, ty, w, h);
        if let Some(offset) = ink_offset(mask, w, h, ox, oy, tx, ty, s_min, s_max) {
            // A thin stroke is only a few pixels wide, so a large correction would
            // step off the wall it came from.
            let offset = offset.clamp(-2.0, 2.0);
            ox -= offset * ty;
            oy += offset * tx;
        }
    }

    let (s_min, s_max) = image_span(ox, oy, tx, ty, w, h);
    let runs = ink_runs(
        mask,
        w,
        h,
        ox,
        oy,
        tx,
        ty,
        s_min,
        s_max,
        options.merge_gap_px,
    );

    // The axis can cross several walls: a doorway splits one run into two. Keep the
    // run this segment actually covers, not the longest one on the axis, or a
    // fragment of the wall below a door would snap into the wall above it.
    let (q0, q1) = (
        (line.x1 - ox) * tx + (line.y1 - oy) * ty,
        (line.x2 - ox) * tx + (line.y2 - oy) * ty,
    );
    let (q_min, q_max) = if q0 <= q1 { (q0, q1) } else { (q1, q0) };

    // No ink along the axis at all: keep the segment as detected rather than
    // deleting a wall the detector did find.
    let Some((s0, s1)) = best_run_for(&runs, q_min, q_max) else {
        return Some(line);
    };
    let run = s1 - s0;

    // The axis does not follow the ink: the wall really is off-axis, so keep it at
    // its detected angle instead of inventing a shorter axis-aligned one.
    if run < 0.8 * line.length() {
        return Some(line);
    }
    if run < options.min_length {
        return None;
    }

    Some(Line {
        x1: ox + s0 * tx,
        y1: oy + s0 * ty,
        x2: ox + s1 * tx,
        y2: oy + s1 * ty,
    })
}

/// Parameter range over which the line `origin + s * (tx, ty)` crosses the image.
fn image_span(ox: f32, oy: f32, tx: f32, ty: f32, w: usize, h: usize) -> (f32, f32) {
    let corners = [
        (0.0f32, 0.0f32),
        (w as f32, 0.0),
        (0.0, h as f32),
        (w as f32, h as f32),
    ];
    let mut s_min = f32::MAX;
    let mut s_max = f32::MIN;
    for (cx, cy) in corners {
        let s = (cx - ox) * tx + (cy - oy) * ty;
        s_min = s_min.min(s);
        s_max = s_max.max(s);
    }
    (s_min, s_max)
}

/// Every run of ink along `origin + s * (tx, ty)`, in parameter units.
#[allow(clippy::too_many_arguments)]
fn ink_runs(
    mask: &[bool],
    w: usize,
    h: usize,
    ox: f32,
    oy: f32,
    tx: f32,
    ty: f32,
    s_min: f32,
    s_max: f32,
    merge_gap_px: f32,
) -> Vec<(f32, f32)> {
    if !(s_max > s_min) {
        return Vec::new();
    }

    let step = 0.5f32;
    let steps = ((s_max - s_min) / step).ceil() as i32;
    let mut runs = Vec::new();
    let mut run_start: Option<f32> = None;
    let mut last_ink = 0.0f32;

    for i in 0..=steps {
        let s = s_min + i as f32 * step;
        let x = ox + s * tx;
        let y = oy + s * ty;
        if is_ink(mask, w, h, x, y) {
            if run_start.is_none() {
                run_start = Some(s);
            }
            last_ink = s;
        } else if let Some(start) = run_start {
            // Bridge small gaps (antialiasing, dashed door swings) but not real ones.
            if s - last_ink > merge_gap_px {
                runs.push((start, last_ink));
                run_start = None;
            }
        }
    }
    if let Some(start) = run_start {
        runs.push((start, last_ink));
    }

    runs
}

/// The run that overlaps `[q_min, q_max]` the most, falling back to the closest
/// run when the segment's own span contains no ink.
fn best_run_for(runs: &[(f32, f32)], q_min: f32, q_max: f32) -> Option<(f32, f32)> {
    runs.iter().copied().max_by(|a, b| {
        run_score(*a, q_min, q_max)
            .partial_cmp(&run_score(*b, q_min, q_max))
            .unwrap_or(std::cmp::Ordering::Equal)
    })
}

fn run_score(run: (f32, f32), q_min: f32, q_max: f32) -> (f32, f32, f32) {
    let overlap = run.1.min(q_max) - run.0.max(q_min);
    let gap = (run.0 - q_max).max(q_min - run.1);
    (overlap.max(0.0), -gap.max(0.0), run.1 - run.0)
}

/// Median perpendicular distance from the line to the ink pixels within a few
/// pixels of it, i.e. how far the line sits from the middle of the stroke.
#[allow(clippy::too_many_arguments)]
fn ink_offset(
    mask: &[bool],
    w: usize,
    h: usize,
    ox: f32,
    oy: f32,
    tx: f32,
    ty: f32,
    s_min: f32,
    s_max: f32,
) -> Option<f32> {
    let (nx, ny) = (-ty, tx);
    let reach = DEFAULT_REDUNDANT_OFFSET_PX as i32 / 2;
    let mut offsets: Vec<f32> = Vec::new();

    let mut s = s_min;
    while s <= s_max {
        let (px, py) = (ox + s * tx, oy + s * ty);
        for o in -reach..=reach {
            let x = px + o as f32 * nx;
            let y = py + o as f32 * ny;
            let (xi, yi) = (x.round() as i32, y.round() as i32);
            if xi >= 0 && yi >= 0 && (xi as usize) < w && (yi as usize) < h {
                if mask[yi as usize * w + xi as usize] {
                    offsets.push(o as f32);
                }
            }
        }
        s += 1.0;
    }

    if offsets.is_empty() {
        return None;
    }
    offsets.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    Some(offsets[offsets.len() / 2])
}

/// Ink test with a one-pixel tolerance so thin diagonal strokes are not missed.
fn is_ink(mask: &[bool], w: usize, h: usize, x: f32, y: f32) -> bool {
    let xi = x.round() as i32;
    let yi = y.round() as i32;
    for dy in -1..=1 {
        for dx in -1..=1 {
            let (px, py) = (xi + dx, yi + dy);
            if px >= 0 && py >= 0 && (px as usize) < w && (py as usize) < h {
                if mask[py as usize * w + px as usize] {
                    return true;
                }
            }
        }
    }
    false
}

/// Undirected angle of a segment in `[0, 180)`.
fn angle_deg(line: &Line) -> f32 {
    let mut a = (line.y2 - line.y1).atan2(line.x2 - line.x1).to_degrees();
    while a < 0.0 {
        a += 180.0;
    }
    while a >= 180.0 {
        a -= 180.0;
    }
    a
}

fn angle_gap(a: f32, b: f32) -> f32 {
    let d = (a - b).abs();
    d.min(180.0 - d)
}

fn unit(line: &Line) -> (f32, f32) {
    let (dx, dy) = (line.x2 - line.x1, line.y2 - line.y1);
    let len = (dx * dx + dy * dy).sqrt();
    if len == 0.0 {
        (0.0, 0.0)
    } else {
        (dx / len, dy / len)
    }
}

/// Perpendicular distance from a point to the infinite line through `line`.
fn distance_to_line(line: &Line, x: f32, y: f32) -> f32 {
    let (dx, dy) = unit(line);
    ((x - line.x1) * dy - (y - line.y1) * dx).abs()
}

/// Merge near-collinear segments whose extents overlap or nearly touch.
fn merge_collinear(mut segments: Vec<Line>, options: &DetectOptions) -> Vec<Line> {
    let mut merged_any = true;
    while merged_any {
        merged_any = false;
        'restart: for i in 0..segments.len() {
            for j in (i + 1)..segments.len() {
                if let Some(merged) = try_merge(segments[i], segments[j], options) {
                    segments[i] = merged;
                    segments.remove(j);
                    merged_any = true;
                    break 'restart;
                }
            }
        }
    }
    segments
}

/// Drop segments that are already covered by a longer one. A thick stroke creates
/// genuine Hough peaks along its length at a slight angle; those describe the same
/// wall and should not be exported as extra geometry.
fn remove_redundant(segments: Vec<Line>, options: &DetectOptions) -> Vec<Line> {
    let mut kept: Vec<Line> = Vec::new();

    for segment in segments {
        let covered = kept
            .iter()
            .any(|longer| covers(longer, &segment, options));
        if !covered {
            kept.push(segment);
        }
    }

    kept
}

/// Whether `longer` already accounts for `segment`: near-parallel, sitting inside
/// its stroke and spanning a part of the same run.
fn covers(longer: &Line, segment: &Line, options: &DetectOptions) -> bool {
    if angle_gap(angle_deg(longer), angle_deg(segment)) > REDUNDANT_ANGLE_DEG {
        return false;
    }

    let mid = (
        (segment.x1 + segment.x2) / 2.0,
        (segment.y1 + segment.y2) / 2.0,
    );
    if distance_to_line(longer, mid.0, mid.1) > options.redundant_offset_px {
        return false;
    }

    // Contained in the longer wall's own run, so it is the same wall seen twice.
    // A wall split by a doorway is not contained and survives.
    let (dx, dy) = unit(longer);
    let project = |x: f32, y: f32| (x - longer.x1) * dx + (y - longer.y1) * dy;
    let eps = options.merge_gap_px;
    let span = (0.0 - eps, longer.length() + eps);
    [
        project(segment.x1, segment.y1),
        project(segment.x2, segment.y2),
    ]
    .iter()
    .all(|&p| p >= span.0 && p <= span.1)
}

/// Combine two segments into one spanning their full extent, if they lie on the
/// same line and their spans overlap or are within `merge_gap_px`.
fn try_merge(a: Line, b: Line, options: &DetectOptions) -> Option<Line> {
    if angle_gap(angle_deg(&a), angle_deg(&b)) > options.merge_angle_deg {
        return None;
    }

    let (axis, other) = if a.length() >= b.length() { (a, b) } else { (b, a) };
    if distance_to_line(&axis, other.x1, other.y1) > options.merge_distance_px
        || distance_to_line(&axis, other.x2, other.y2) > options.merge_distance_px
    {
        return None;
    }

    let (dx, dy) = unit(&axis);
    let project = |x: f32, y: f32| (x - axis.x1) * dx + (y - axis.y1) * dy;
    let (b0, b1) = (project(other.x1, other.y1), project(other.x2, other.y2));
    let (b_lo, b_hi) = if b0 <= b1 { (b0, b1) } else { (b1, b0) };

    let (a_lo, a_hi) = (0.0f32, axis.length());
    if b_lo > a_hi + options.merge_gap_px || b_hi < a_lo - options.merge_gap_px {
        return None;
    }

    let lo = a_lo.min(b_lo);
    let hi = a_hi.max(b_hi);
    Some(Line {
        x1: axis.x1 + dx * lo,
        y1: axis.y1 + dy * lo,
        x2: axis.x1 + dx * hi,
        y2: axis.y1 + dy * hi,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Luma;

    fn canvas(w: u32, h: u32) -> GrayImage {
        GrayImage::from_pixel(w, h, Luma([255]))
    }

    fn stroke(img: &mut GrayImage, x0: i32, y0: i32, x1: i32, y1: i32) {
        let (dx, dy) = ((x1 - x0).abs(), -(y1 - y0).abs());
        let (sx, sy) = (if x0 < x1 { 1 } else { -1 }, if y0 < y1 { 1 } else { -1 });
        let (mut x, mut y, mut err) = (x0, y0, dx + dy);
        loop {
            if x >= 0 && y >= 0 && (x as u32) < img.width() && (y as u32) < img.height() {
                img.put_pixel(x as u32, y as u32, Luma([0]));
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

    #[test]
    fn finds_horizontal_and_vertical_walls() {
        let mut img = canvas(240, 240);
        stroke(&mut img, 20, 50, 220, 50);
        stroke(&mut img, 160, 20, 160, 220);

        let lines = detect_lines(&img, DetectOptions::default());

        let horizontal = lines
            .iter()
            .find(|l| (l.y1 - l.y2).abs() < 2.0 && l.length() > 150.0);
        let vertical = lines
            .iter()
            .find(|l| (l.x1 - l.x2).abs() < 2.0 && l.length() > 150.0);

        assert!(horizontal.is_some(), "expected a horizontal wall: {lines:?}");
        assert!(vertical.is_some(), "expected a vertical wall: {lines:?}");
    }

    #[test]
    fn finds_diagonal_walls() {
        // The old row-scan detector could never return this segment.
        let mut img = canvas(240, 240);
        stroke(&mut img, 20, 20, 220, 220);

        let lines = detect_lines(&img, DetectOptions::default());

        let diagonal = lines
            .iter()
            .find(|l| (l.x2 - l.x1).abs() > 120.0 && (l.y2 - l.y1).abs() > 120.0);
        assert!(diagonal.is_some(), "expected a diagonal wall: {lines:?}");
    }

    #[test]
    fn ignores_short_specks() {
        let mut img = canvas(240, 240);
        for y in (10..230).step_by(20) {
            stroke(&mut img, 30, y, 38, y);
        }

        let lines = detect_lines(&img, DetectOptions::default());
        assert!(
            lines.is_empty(),
            "specks shorter than min_length should be dropped: {lines:?}"
        );
    }

    #[test]
    fn one_wall_yields_one_segment() {
        // A thick wall used to produce one duplicate segment per row.
        let mut img = canvas(240, 240);
        for y in 60..66 {
            stroke(&mut img, 20, y, 220, y);
        }

        let lines = detect_lines(&img, DetectOptions::default());
        let horizontal: Vec<_> = lines
            .iter()
            .filter(|l| (l.y1 - l.y2).abs() < 3.0)
            .collect();
        assert_eq!(horizontal.len(), 1, "thick wall should collapse: {lines:?}");
    }
}

#[cfg(test)]
mod fixtures {
    use super::*;

    fn segments(path: &str) -> Vec<Line> {
        let img = image::open(path)
            .unwrap_or_else(|e| panic!("cannot read {path}: {e}"))
            .to_luma8();
        let lines = detect_lines(&img, DetectOptions::default());
        for l in &lines {
            println!(
                "  ({:.1},{:.1})->({:.1},{:.1}) len={:.1} angle={:.1}",
                l.x1,
                l.y1,
                l.x2,
                l.y2,
                l.length(),
                angle_deg(l)
            );
        }
        lines
    }

    #[test]
    fn floor_plan_recovers_every_wall_once() {
        // Outer shell (4) + interior wall with doorway split in two (2) + the
        // horizontal interior wall (1); the annotation marks are not walls.
        let lines = segments("fixtures/floor_plan.png");
        assert_eq!(lines.len(), 7, "{lines:#?}");

        // Walls are drawn on exact axes in the fixture, so the result must be too.
        for l in &lines {
            let off_axis = angle_deg(l);
            assert!(
                off_axis.min(180.0 - off_axis).abs() < 0.5
                    || (off_axis - 90.0).abs() < 0.5,
                "wall {l:?} is not axis aligned"
            );
        }

        // The lower interior wall must survive as one run from the door to the
        // outer wall; it used to come out as two skewed fragments.
        let lower = lines
            .iter()
            .find(|l| (l.x1 - 381.0).abs() < 3.0 && (l.x2 - 381.0).abs() < 3.0 && l.y1 > 340.0)
            .unwrap_or_else(|| panic!("missing lower interior wall: {lines:#?}"));
        assert!((lower.length() - 180.0).abs() < 8.0, "{lower:?}");
    }

    #[test]
    fn angled_plan_recovers_every_wall_once() {
        // Outer shell (4) + diagonal (1) + vertical partition (1).
        let lines = segments("fixtures/angled_plan.png");
        assert_eq!(lines.len(), 6, "{lines:#?}");

        let diagonal = lines
            .iter()
            .find(|l| (angle_deg(l) - 45.0).abs() < 0.5)
            .unwrap_or_else(|| panic!("missing diagonal: {lines:#?}"));
        assert!(diagonal.length() > 600.0, "{diagonal:?}");
    }
}

#[cfg(test)]
mod debug_peaks {
    use super::*;

    #[test]
    fn dump_angled_peaks() {
        let img = image::open("fixtures/angled_plan.png").unwrap().to_luma8();
        let w = img.width() as usize;
        let h = img.height() as usize;
        let mask = ink_mask(&img);
        let ink: Vec<(usize, usize)> = mask.iter().enumerate()
            .filter(|(_, on)| **on).map(|(i, _)| (i % w, i / w)).collect();
        let diag = ((w * w + h * h) as f64).sqrt().ceil() as i32;
        let rho_bins = (2 * diag + 1) as usize;
        let cos_t: Vec<f32> = (0..THETAS).map(|t| (t as f32).to_radians().cos()).collect();
        let sin_t: Vec<f32> = (0..THETAS).map(|t| (t as f32).to_radians().sin()).collect();
        let mut acc = vec![0u32; THETAS * rho_bins];
        for &(x, y) in &ink {
            for t in 0..THETAS {
                let rho = x as f32 * cos_t[t] + y as f32 * sin_t[t];
                acc[t * rho_bins + (rho.round() as i32 + diag) as usize] += 1;
            }
        }
        let mut peaks = find_peaks(&acc, rho_bins, 18);
        peaks.sort_by(|a, b| b.0.cmp(&a.0));
        println!("ink={} peaks={}", ink.len(), peaks.len());
        for &(v, t, r) in peaks.iter().take(12) {
            println!("  votes={v} theta={t} rho={}", r as i32 - diag);
        }
        let reps_lines = detect_lines(&img, DetectOptions::default());
        println!("final={}", reps_lines.len());
    }
}
