use image::DynamicImage;

pub struct Line {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

pub fn extract_lines(
    img: &DynamicImage
) -> Vec<Line> {

    let gray = img.to_luma8();

    let mut lines = Vec::new();

    for y in 0..gray.height() {

        let mut run = None;

        for x in 0..gray.width() {

            let p = gray.get_pixel(x, y)[0];

            if p < 100 {

                if run.is_none() {
                    run = Some(x);
                }

            } else if let Some(start) = run {

                if x - start > 10 {

                    lines.push(Line {
                        x1: start as f32,
                        y1: y as f32,
                        x2: x as f32,
                        y2: y as f32,
                    });
                }

                run = None;
            }
        }
    }

    lines
}







