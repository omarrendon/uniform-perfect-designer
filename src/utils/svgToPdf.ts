// Renders SVG as hybrid vectors + embedded images into a pdf-lib page.
// Vector paths  → page.drawSvgPath() — true vectors, scale-independent.
// Embedded images → pdfDoc.embedPng()/embedJpg() + page.drawImage() — zero resampling.

import { PDFPage, PDFDocument, rgb } from 'pdf-lib';
import { parseSvgFromText } from './svgParser';
import type { Matrix2D } from './svgParser';

// ---------------------------------------------------------------------------
// CSS color parsing (needed to map fill/stroke strings to pdf-lib rgb())
// ---------------------------------------------------------------------------

interface ParsedColor { r: number; g: number; b: number; }

const CSS_NAMED_COLORS: Record<string, string> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', gray: '#808080',
  grey: '#808080', silver: '#c0c0c0', gold: '#ffd700', navy: '#000080',
  teal: '#008080', maroon: '#800000', olive: '#808000', lime: '#00ff00',
  aqua: '#00ffff', fuchsia: '#ff00ff', brown: '#a52a2a', coral: '#ff7f50',
  salmon: '#fa8072', khaki: '#f0e68c', indigo: '#4b0082', violet: '#ee82ee',
  transparent: '#00000000',
};

function parseCssColor(colorStr: string | null): ParsedColor | null {
  if (!colorStr || colorStr === 'none' || colorStr === 'transparent') return null;
  let s = colorStr.trim().toLowerCase();
  if (CSS_NAMED_COLORS[s]) s = CSS_NAMED_COLORS[s];

  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length === 8) hex = hex.slice(0, 6);
    if (hex.length === 6) {
      const n = parseInt(hex, 16);
      return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
    }
  }

  const rgbMatch = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (rgbMatch) {
    return {
      r: parseFloat(rgbMatch[1]) / 255,
      g: parseFloat(rgbMatch[2]) / 255,
      b: parseFloat(rgbMatch[3]) / 255,
    };
  }

  return { r: 0, g: 0, b: 0 };
}

// ---------------------------------------------------------------------------
// Matrix (named-field) — used by transformSvgPath
// ---------------------------------------------------------------------------

interface Matrix { a: number; b: number; c: number; d: number; e: number; f: number; }

function matrix2dToMatrix(m: Matrix2D): Matrix {
  return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] };
}

function applyMatrix2D(m: Matrix2D, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function transformPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

// ---------------------------------------------------------------------------
// SVG path tokeniser + coordinate transformer
// ---------------------------------------------------------------------------

function tokenizeSvgPath(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  let i = 0;
  while (i < d.length) {
    if (/[\s,]/.test(d[i])) { i++; continue; }
    if (/[a-zA-Z]/.test(d[i])) { tokens.push(d[i]); i++; continue; }
    const m = d.slice(i).match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (m) { tokens.push(parseFloat(m[0])); i += m[0].length; }
    else { i++; }
  }
  return tokens;
}

// Transforms a parsed SVG path from viewBox space to PDF point space.
// ctm is the element's accumulated transform matrix.
// sx/sy are the viewBox→PDF scale factors.
// rot180 flips coordinates for 180° rotation.
function transformSvgPath(
  pathD: string,
  ctm: Matrix,
  sx: number,
  sy: number,
  vbX: number,
  vbY: number,
  rot180: boolean,
  totalW: number,
  totalH: number,
): string {
  const tokens = tokenizeSvgPath(pathD);
  let out = '';
  let i = 0;

  const isCmd = (t: string | number | undefined): t is string => typeof t === 'string';

  const absXY = (svgX: number, svgY: number): [number, number] => {
    const [cx, cy] = transformPoint(ctm, svgX, svgY);
    let px = (cx - vbX) * sx;
    let py = (cy - vbY) * sy;
    if (rot180) { px = totalW - px; py = totalH - py; }
    return [px, py];
  };

  const relXY = (dvgX: number, dvgY: number): [number, number] => {
    const cx = ctm.a * dvgX + ctm.c * dvgY;
    const cy = ctm.b * dvgX + ctm.d * dvgY;
    let px = cx * sx;
    let py = cy * sy;
    if (rot180) { px = -px; py = -py; }
    return [px, py];
  };

  while (i < tokens.length) {
    const tok = tokens[i++];
    if (!isCmd(tok)) continue;

    const cmd = tok;
    const upper = cmd.toUpperCase();
    const isRel = cmd !== cmd.toUpperCase() && upper !== 'Z';

    const args: number[] = [];
    while (i < tokens.length && !isCmd(tokens[i])) args.push(tokens[i++] as number);

    let j = 0;
    const take = (): number => args[j++] ?? 0;
    const more = (): boolean => j < args.length;

    out += cmd;

    switch (upper) {
      case 'Z': break;

      case 'M': case 'L': case 'T': {
        while (more()) {
          const x = take(), y = take();
          const [px, py] = isRel ? relXY(x, y) : absXY(x, y);
          out += ` ${px.toFixed(3)} ${py.toFixed(3)}`;
        }
        break;
      }

      case 'H': {
        while (more()) {
          const x = take();
          if (isRel) {
            const dx = (ctm.a * x) * sx * (rot180 ? -1 : 1);
            out += ` ${dx.toFixed(3)}`;
          } else {
            const [cx] = transformPoint(ctm, x, 0);
            let px = (cx - vbX) * sx;
            if (rot180) px = totalW - px;
            out += ` ${px.toFixed(3)}`;
          }
        }
        break;
      }

      case 'V': {
        while (more()) {
          const y = take();
          if (isRel) {
            const dy = (ctm.d * y) * sy * (rot180 ? -1 : 1);
            out += ` ${dy.toFixed(3)}`;
          } else {
            const [, cy] = transformPoint(ctm, 0, y);
            let py = (cy - vbY) * sy;
            if (rot180) py = totalH - py;
            out += ` ${py.toFixed(3)}`;
          }
        }
        break;
      }

      case 'C': {
        while (more()) {
          const x1 = take(), y1 = take(), x2 = take(), y2 = take(), x = take(), y = take();
          const [p1x, p1y] = isRel ? relXY(x1, y1) : absXY(x1, y1);
          const [p2x, p2y] = isRel ? relXY(x2, y2) : absXY(x2, y2);
          const [px, py]   = isRel ? relXY(x, y)   : absXY(x, y);
          out += ` ${p1x.toFixed(3)} ${p1y.toFixed(3)} ${p2x.toFixed(3)} ${p2y.toFixed(3)} ${px.toFixed(3)} ${py.toFixed(3)}`;
        }
        break;
      }

      case 'S': case 'Q': {
        while (more()) {
          const x1 = take(), y1 = take(), x = take(), y = take();
          const [p1x, p1y] = isRel ? relXY(x1, y1) : absXY(x1, y1);
          const [px, py]   = isRel ? relXY(x, y)   : absXY(x, y);
          out += ` ${p1x.toFixed(3)} ${p1y.toFixed(3)} ${px.toFixed(3)} ${py.toFixed(3)}`;
        }
        break;
      }

      case 'A': {
        while (more()) {
          const rx = take(), ry = take(), xrot = take(), laf = take(), sf = take(), x = take(), y = take();
          const prx = Math.abs(rx * sx);
          const pry = Math.abs(ry * sy);
          const [px, py] = isRel ? relXY(x, y) : absXY(x, y);
          const finalSf = rot180 ? 1 - sf : sf;
          out += ` ${prx.toFixed(3)} ${pry.toFixed(3)} ${xrot} ${laf} ${finalSf} ${px.toFixed(3)} ${py.toFixed(3)}`;
        }
        break;
      }

      default: {
        for (const a of args) out += ` ${a}`;
        break;
      }
    }

    out += ' ';
  }

  return out.trim();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function renderSvgToPdfPage(
  page: PDFPage,
  pdfDoc: PDFDocument,
  svgDataUrl: string,
  xPdf: number,
  yPdfBottom: number,
  widthPts: number,
  heightPts: number,
  rotation: number,
): Promise<void> {
  // 1. Decode SVG text
  let svgText: string;
  if (svgDataUrl.startsWith('data:image/svg+xml;base64,')) {
    svgText = atob(svgDataUrl.slice('data:image/svg+xml;base64,'.length));
  } else if (svgDataUrl.startsWith('data:image/svg+xml,')) {
    svgText = decodeURIComponent(svgDataUrl.slice('data:image/svg+xml,'.length));
  } else {
    return;
  }

  // 2. Parse via hybrid parser
  const parsed = parseSvgFromText(svgText);
  if (!parsed) return;

  const { viewBox, elements } = parsed;
  const { x: vbX, y: vbY, width: vbW, height: vbH } = viewBox;

  const scaleX = widthPts / vbW;
  const scaleY = heightPts / vbH;

  // drawSvgPath(path, {x, y}) convention:
  //   SVG(px, py) → PDF(x + px, y - py)
  // So y should be the TOP edge in PDF coordinates.
  const drawX = xPdf;
  const drawY = yPdfBottom + heightPts;

  const rot180 = rotation === 180;

  // 3. Render each element in document order
  for (const el of elements) {
    if (el.kind === 'path') {
      const ctm = matrix2dToMatrix(el.ctm);
      const scaledD = transformSvgPath(el.d, ctm, scaleX, scaleY, vbX, vbY, rot180, widthPts, heightPts);

      const fillColor = parseCssColor(el.fill);
      if (fillColor) {
        try {
          page.drawSvgPath(scaledD, {
            x: drawX,
            y: drawY,
            color: rgb(fillColor.r, fillColor.g, fillColor.b),
            opacity: Math.min(1, Math.max(0, el.fillOpacity)),
            borderWidth: 0,
          });
        } catch { /* ignore malformed paths */ }
      }

      const strokeColor = parseCssColor(el.stroke);
      if (strokeColor && el.strokeWidth > 0) {
        const strokeW = el.strokeWidth * Math.min(scaleX, scaleY);
        try {
          page.drawSvgPath(scaledD, {
            x: drawX,
            y: drawY,
            borderColor: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
            borderWidth: strokeW,
            borderOpacity: Math.min(1, Math.max(0, el.strokeOpacity)),
            color: undefined,
          });
        } catch { /* ignore */ }
      }

    } else {
      // kind === 'image' — embed base64 directly, zero resampling
      const { href, x, y, width, height, ctm, opacity } = el;

      try {
        const isJpeg = href.startsWith('data:image/jpeg') || href.startsWith('data:image/jpg');
        const b64 = href.slice(href.indexOf(',') + 1);
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const embedded = isJpeg
          ? await pdfDoc.embedJpg(bytes)
          : await pdfDoc.embedPng(bytes);

        // Transform all four corners to handle non-axis-aligned CTMs
        const [x0, y0] = applyMatrix2D(ctm, x, y);
        const [x1, y1] = applyMatrix2D(ctm, x + width, y + height);

        let px0 = (x0 - vbX) * scaleX;
        let py0 = (y0 - vbY) * scaleY;
        let px1 = (x1 - vbX) * scaleX;
        let py1 = (y1 - vbY) * scaleY;

        if (rot180) {
          px0 = widthPts - px0; py0 = heightPts - py0;
          px1 = widthPts - px1; py1 = heightPts - py1;
        }

        const imgX = drawX + Math.min(px0, px1);
        const imgW = Math.abs(px1 - px0);
        const imgH = Math.abs(py1 - py0);
        const imgY = drawY - Math.max(py0, py1); // bottom-left in PDF space

        page.drawImage(embedded, {
          x: imgX,
          y: imgY,
          width: imgW,
          height: imgH,
          opacity: Math.min(1, Math.max(0, opacity)),
        });
      } catch { /* ignore bad image data */ }
    }
  }
}
