// A very small PDF writer: pages of text, rules and boxes, no dependencies.
//
// The studio has no build step, so the report cannot carry jsPDF the way the
// CivilGPT app did. PDF 1.4 with the base-14 Helvetica faces is enough for a
// text report: each page is a content stream of text and vector operators, the
// file is those streams plus a cross-reference table and a trailer, and every
// offset in that table is counted in bytes as the file is written.
//
// Coordinates are given in points from the top-left corner, the way a screen
// lays a report out, and flipped to PDF's bottom-up space when written.

const A4 = { width: 595.28, height: 841.89 };

// Text goes out as WinAnsi bytes, so the few characters a report uses beyond
// Latin-1 — dashes, the multiplication sign, the bullet — are mapped explicitly.
const WIN_ANSI = new Map([
  [0x2013, 0x96], [0x2014, 0x97], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2026, 0x85],
  [0x2122, 0x99], [0x2212, 0x2d], [0x2264, 0x3c], [0x2265, 0x3e],
]);

const byteFor = (code) => {
  // Tabs and line breaks are PDF structure, not text: the objects, the stream
  // bodies and the 20-byte cross-reference entries all depend on them.
  if (code === 0x09 || code === 0x0a || code === 0x0d) return code;
  if (code >= 0x20 && code <= 0x7e) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  if (code < 0x20) return 0x20;
  if (code >= 0x80 && code <= 0x9f) return WIN_ANSI.get(code) ?? 0x3f;
  return WIN_ANSI.get(code) ?? 0x3f;
};

const fmt = (value) => {
  const rounded = Math.round(Number(value) * 1000) / 1000;
  return Number.isFinite(rounded) ? String(rounded) : '0';
};

const colour = (rgb) => `${fmt(rgb[0] / 255)} ${fmt(rgb[1] / 255)} ${fmt(rgb[2] / 255)}`;

const escapeText = (text) => String(text)
  .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function encode(text) {
  const bytes = new Uint8Array(text.length);
  let at = 0;
  for (const char of text) bytes[at++] = byteFor(char.codePointAt(0));
  return bytes.subarray(0, at);
}

// Helvetica advances, near enough to lay columns and wrap lines: digits measure
// exactly, so a right-aligned column of amounts lines up.
const advance = (char) => {
  if (char >= '0' && char <= '9') return 0.556;
  if (char === '.' || char === ',' || char === ':' || char === ';' || char === ' ') return 0.278;
  if (char === '$' || char === '(' || char === ')' || char === '-' || char === '·') return 0.333;
  if (char === 'm' || char === 'w') return 0.85;
  if (char === '/') return 0.278;
  if (char >= 'A' && char <= 'Z') return 0.667;
  return 0.5;
};

export const textWidth = (text, size, bold = false) => {
  let width = 0;
  for (const char of String(text)) width += advance(char);
  return width * size * (bold ? 1.04 : 1);
};

/** Greedy word wrap to a width in points, for a paragraph or a table cell. */
export function wrap(text, size, maxWidth, { bold = false } = {}) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size, bold) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function createPdf({ width = A4.width, height = A4.height } = {}) {
  const pages = [];

  const api = (page) => ({
    text(text, x, y, { size = 10, bold = false, italic = false, color = [0, 0, 0], align = 'left' } = {}) {
      const font = bold ? 'F2' : italic ? 'F3' : 'F1';
      let left = x;
      if (align === 'right') left = x - textWidth(text, size, bold);
      else if (align === 'center') left = x - textWidth(text, size, bold) / 2;
      page.ops.push(`BT /${font} ${fmt(size)} Tf ${colour(color)} rg 1 0 0 1 ${fmt(left)} ${fmt(height - y)} Tm (${escapeText(text)}) Tj ET`);
    },

    line(x1, y1, x2, y2, { color = [0, 0, 0], width: stroke = 0.6 } = {}) {
      page.ops.push(`${colour(color)} RG ${fmt(stroke)} w ${fmt(x1)} ${fmt(height - y1)} m ${fmt(x2)} ${fmt(height - y2)} l S`);
    },

    rect(x, y, w, h, { fill = null, stroke = null, width: strokeWidth = 0.6 } = {}) {
      const ops = [];
      if (fill) ops.push(`${colour(fill)} rg`);
      if (stroke) ops.push(`${colour(stroke)} RG ${fmt(strokeWidth)} w`);
      ops.push(`${fmt(x)} ${fmt(height - y - h)} ${fmt(w)} ${fmt(h)} re`);
      ops.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
      page.ops.push(ops.join(' '));
    },
  });

  return {
    width,
    height,
    newPage() {
      const page = { ops: [] };
      pages.push(page);
      return api(page);
    },
    count: () => pages.length,
    eachPage: (visit) => pages.forEach((page, index) => visit(api(page), index)),
    bytes: () => build(pages, width, height),
  };
}

function build(pages, width, height) {
  const chunks = [];
  const offsets = [];
  let length = 0;

  const put = (data) => {
    const bytes = typeof data === 'string' ? encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id, body) => {
    offsets[id] = length;
    put(`${id} 0 obj\n${body}\nendobj\n`);
  };

  // The binary comment marks the file as binary for tools that sniff it.
  put('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  const kids = pages.map((_, index) => `${6 + index * 2} 0 R`).join(' ');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  object(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  object(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');

  pages.forEach((page, index) => {
    const pageId = 6 + index * 2;
    const contentId = pageId + 1;
    const content = encode(page.ops.join('\n'));
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(width)} ${fmt(height)}] `
      + `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`);
    offsets[contentId] = length;
    put(`${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n`);
    put(content);
    put('\nendstream\nendobj\n');
  });

  const maxId = 5 + pages.length * 2;
  const xrefAt = length;
  put(`xref\n0 ${maxId + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= maxId; id += 1) {
    put(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  put(`trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
