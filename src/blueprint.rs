pub fn extract_lines(
    img: &image::DynamicImage,
) -> Vec<Line> {
    let gray = img.to_luma8();

    let mut lines = Vec::new();

    for y in 0..gray.height() {

        let mut start = None;

        for x in 0..gray.width() {

            let pixel =
                gray.get_pixel(x, y)[0];

            let is_wall = pixel < 120;

            match (start, is_wall) {

                (None, true) => {
                    start = Some(x);
                }

                (Some(s), false) => {

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

                _ => {}
            }
        }
    }

    lines
}