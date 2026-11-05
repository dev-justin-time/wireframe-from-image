// The report as an A4 PDF, written in the browser by static/pdf.js.
//
// CivilGPT's export composed a summary, a metrics grid, a compliance log, a bill
// of quantities and a grand total with jsPDF. The composition is the same here;
// the writing is the small PDF writer, so the file needs no dependency, no build
// step and no print dialog. Long tables paginate between rows: a table never
// splits a line in half, and every page carries the same footer.
import { createPdf, wrap } from './pdf.js';
import { reportModel } from './report-data.js';

const PAGE = { width: 595.28, height: 841.89 };
const M = 44;
const RIGHT = PAGE.width - M;
const INK = [17, 24, 39];
const MUTED = [71, 85, 105];
const RULE = [226, 232, 240];
const BAND = [15, 23, 42];
const ACCENT = [37, 99, 235];
const WASH = [241, 245, 249];
const BOTTOM = PAGE.height - 56;

export function reportPdf(plan) {
  const model = reportModel(plan);
  const pdf = createPdf({ width: PAGE.width, height: PAGE.height });
  let page = pdf.newPage();
  let y = 0;

  /** Start a new page rather than leave a row or a heading split by the edge. */
  const ensure = (need) => {
    if (y + need <= BOTTOM) return;
    page = pdf.newPage();
    page.text(`${model.title} · continued`, M, 34, { size: 8, color: MUTED });
    page.line(M, 42, RIGHT, 42, { color: RULE });
    y = 62;
  };

  const section = (title) => {
    ensure(42);
    y += 10;
    page.text(title, M, y + 3, { size: 10.5, bold: true, color: INK });
    y += 9;
    page.line(M, y, RIGHT, y, { color: RULE });
    y += 13;
  };

  /** A two-column row: label left, amount right-aligned, note after it. */
  const row = (label, value, note = '', { bold = false, wash = false } = {}) => {
    ensure(16);
    if (wash) page.rect(M, y - 9, RIGHT - M, 14, { fill: WASH });
    page.text(label, M, y, { size: 9.5, bold, color: INK });
    page.text(value, RIGHT - 96, y, { size: 9.5, bold, color: INK, align: 'right' });
    if (note) page.text(note, RIGHT - 88, y, { size: 8.5, color: MUTED });
    y += 13;
  };

  // 1. Header band: brand, report kind, plan and date.
  page.rect(0, 0, PAGE.width, 84, { fill: BAND });
  page.text('Blueprint Studio', M, 38, { size: 18, bold: true, color: [255, 255, 255] });
  page.text('Construction & design report', M, 54, { size: 9, color: [148, 163, 184] });
  page.text(model.title, RIGHT, 36, { size: 11, bold: true, color: [255, 255, 255], align: 'right' });
  page.text(model.generated, RIGHT, 52, { size: 9, color: [148, 163, 184], align: 'right' });
  y = 106;

  // 2. Metrics grid, one box per headline number.
  const boxWidth = (RIGHT - M - 24) / 4;
  model.metrics.forEach((metric, index) => {
    const x = M + index * (boxWidth + 8);
    page.rect(x, y, boxWidth, 40, { fill: WASH, stroke: RULE });
    page.text(String(metric.value), x + 8, y + 19, { size: 13, bold: true, color: ACCENT });
    page.text(metric.label, x + 8, y + 32, { size: 8, color: MUTED });
  });
  y += 52;

  // 3. Plan summary.
  section('1. Plan summary');
  model.summary.forEach(([label, value, unit]) => {
    row(label, String(value), unit);
  });

  // 4. Takeoff quantities.
  section('2. Takeoff');
  model.takeoff.forEach(([label, value, unit]) => {
    row(label, String(value), unit);
  });

  // 5. Rooms.
  section('3. Rooms');
  ensure(14);
  page.text('Room', M, y, { size: 8.5, color: MUTED });
  page.text('Area', RIGHT - 96, y, { size: 8.5, color: MUTED, align: 'right' });
  page.text('Perimeter', RIGHT, y, { size: 8.5, color: MUTED, align: 'right' });
  y += 8;
  page.line(M, y, RIGHT, y, { color: RULE });
  y += 11;
  model.rooms.forEach((room) => {
    ensure(14);
    const name = room.name.length > 58 ? `${room.name.slice(0, 57)}…` : room.name;
    page.text(name, M, y, { size: 9.5, color: INK });
    page.text(room.area, RIGHT - 96, y, { size: 9.5, color: INK, align: 'right' });
    page.text(room.perimeter, RIGHT, y, { size: 9.5, color: INK, align: 'right' });
    y += 12;
  });

  // 6. Priced work, with the contract total washed so it reads as the answer.
  section('4. Priced work');
  model.costs.forEach(([label, value, note]) => {
    const total = label === 'Total';
    row(label, String(value), note, { bold: total, wash: total });
  });

  // 7. The caveat the screen shows under the sheet.
  y += 6;
  wrap(model.note, 8, RIGHT - M).forEach((line) => {
    ensure(11);
    page.text(line, M, y, { size: 8, color: MUTED });
    y += 10;
  });

  // 8. Footers, once the page count is known.
  pdf.eachPage((p, index) => {
    p.line(M, PAGE.height - 40, RIGHT, PAGE.height - 40, { color: RULE });
    p.text(`Blueprint Studio · ${model.title}`, M, PAGE.height - 26, { size: 7.5, color: MUTED });
    p.text(`Page ${index + 1} of ${pdf.count()}`, RIGHT, PAGE.height - 26, { size: 7.5, color: MUTED, align: 'right' });
  });

  return pdf.bytes();
}
