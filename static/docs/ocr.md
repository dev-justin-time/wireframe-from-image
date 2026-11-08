# Floorplan OCR

Import Floorplan → **Read Text** runs OCR on the plan image and sorts what it
finds into dimensions, room names, scale notes and areas. The boxes are drawn
over the plan and the lines are listed in the **Plan text** sidebar panel, where
they can be copied out.

## Using it

1. Open `Editor.html` → **Import Floorplan** → **Read Text**, or import an image
   normally and press **Read text** in the Plan text panel.
2. The first run downloads the OCR engine, core wasm and English language data
   from a CDN (about 6-10 s on a normal connection); later runs use the cache.
3. Results appear in the panel and as coloured boxes on the plan:
   - green — room names
   - blue — dimensions (with metres alongside, e.g. `12'-6" — 3.81 m`)
   - violet — scale notes (`SCALE 1:100`, `1/4" = 1'-0"`)
   - amber — areas
4. **Copy** puts every recognized line on the clipboard; **Clear** removes the
   overlay. OCR uses the session only: it is not saved with the project,
   because the background image is not saved either.

The **AI Auto-Scan** path also runs OCR on the same image after it detects the
walls, so an auto-scanned plan gets its room names and dimensions too.

## Why Tesseract.js instead of EasyOCR

This is a static browser app served as files; there is no Python process.
EasyOCR is Python-only, so the browser equivalent is Tesseract.js. It runs in a
Web Worker, the image never leaves the machine, and no API key or server is
needed.

## What the parser understands

| Category | Examples | Notes |
| --- | --- | --- |
| Dimension | `12'-6"`, `4200 mm`, `420 cm`, `3.5 m`, `48 in`, `4200` | Feet-inches become mm internally; metres are shown on the line. A bare 3-5 digit number is read as mm (≥500) or cm. |
| Area | `120 sq ft`, `45 m²`, `480 SF` | Converted to m². |
| Scale | `SCALE 1:100`, `1/4" = 1'-0"`, `1 in = 4 ft` | Ratio is reported on the result; it does not calibrate pixels. |
| Room | `KITCHEN`, `MASTER BEDROOM`, `BATH`, `W.I.C.` variants in the room word list | Matched on whole words. |
| Label | `WASHER/DRYER`, notes | Anything else with at least two letters. |

Words are grouped into visual lines by vertical overlap and horizontal gap;
low-confidence words under 30% are dropped. Duplicate words (Tesseract reports
the same word in both the flat list and the block tree) are counted once.

## API

`window.planOcr` is available in the editor for debugging and tests:

```js
await window.planOcr.run(dataUrlOrFile, { recognize }); // OCR now
await window.planOcr.runCurrent();                      // OCR the imported plan
window.planOcr.result();                                // parsed payload
window.planOcr.summary();                               // "Found 2 rooms · 1 dimension"
window.planOcr.parse({ words: [...] });                 // parser only
window.planOcr.setResult(result);                       // drive the panel/overlay
window.planOcr.copy();
window.planOcr.clear();
window.planOcr.debug();   // image size, scale, line and box counts
```

`recognize` is an injectable function `(source, { lang, onProgress }) =>
tesseractData`, so the UI and parser can be tested without downloading the
model. `features/ocr.js` exports the same parser (`parsePlanText`,
`classifyLine`, `parseDimension`, `parseArea`, `parseScaleNote`).

## Limits

Rotated or curved text, very low-resolution scans and heavily hatched drawings
reduce accuracy; upscaling the image improves it. The OCR does not set the
drawing scale or create walls, and results are not persisted with the project.
Prices and geometry elsewhere in the app are unaffected.

## Tests

```bash
node .check-ocr.js      # 56 parser, grouping and injected-recognizer checks
node .browser-check.mjs # panel, overlay, counts and clearing in the editor
```
