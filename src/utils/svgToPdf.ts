// Renderiza un SVG directamente como paths vectoriales en una página pdf-lib.
// Se evita rasterizar el SVG → el PDF resultante escala a cualquier DPI sin pérdida.
//
// Elementos soportados: path, rect, circle, ellipse, polygon, polyline, line, g.
// Gradientes se degradan a color sólido (primer stop).
// Elementos <image> embebidos se omiten (no son uniformes vectoriales).
// Transformaciones: translate, scale, rotate, matrix(a,b,c,d,e,f).

import { PDFPage, rgb, degrees } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface Matrix {
  a: number; b: number;
  c: number; d: number;
  e: number; f: number;
}

interface ParsedColor {
  r: number; g: number; b: number;
}

// ---------------------------------------------------------------------------
// Colores CSS nombrados más comunes
// ---------------------------------------------------------------------------
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

  // Resolve named colors
  if (CSS_NAMED_COLORS[s]) s = CSS_NAMED_COLORS[s];

  // #rrggbb / #rgb / #rrggbbaa
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length === 8) hex = hex.slice(0, 6); // drop alpha
    if (hex.length === 6) {
      const n = parseInt(hex, 16);
      return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
    }
  }

  // rgb() / rgba()
  const rgbMatch = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (rgbMatch) {
    return {
      r: parseFloat(rgbMatch[1]) / 255,
      g: parseFloat(rgbMatch[2]) / 255,
      b: parseFloat(rgbMatch[3]) / 255,
    };
  }

  return { r: 0, g: 0, b: 0 }; // fallback negro
}

// ---------------------------------------------------------------------------
// Matrices de transformación
// ---------------------------------------------------------------------------

const identityMatrix = (): Matrix => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

function multiplyMatrix(m1: Matrix, m2: Matrix): Matrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

function transformPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

function parseTransformAttr(transform: string | null): Matrix {
  if (!transform) return identityMatrix();

  let result = identityMatrix();
  const ops = transform.match(/\w+\([^)]*\)/g) || [];

  for (const op of ops) {
    const name = op.match(/^\w+/)?.[0] ?? '';
    const args = (op.match(/\(([^)]*)\)/)?.[1] ?? '')
      .split(/[\s,]+/)
      .map(Number);

    let m = identityMatrix();
    switch (name) {
      case 'translate':
        m = { a: 1, b: 0, c: 0, d: 1, e: args[0] ?? 0, f: args[1] ?? 0 };
        break;
      case 'scale':
        m = { a: args[0] ?? 1, b: 0, c: 0, d: args[1] ?? args[0] ?? 1, e: 0, f: 0 };
        break;
      case 'rotate': {
        const angle = ((args[0] ?? 0) * Math.PI) / 180;
        const cx = args[1] ?? 0;
        const cy = args[2] ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        m = {
          a: cos, b: sin, c: -sin, d: cos,
          e: cx - cx * cos + cy * sin,
          f: cy - cx * sin - cy * cos,
        };
        break;
      }
      case 'matrix':
        m = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
        break;
      case 'skewX': {
        const angle = ((args[0] ?? 0) * Math.PI) / 180;
        m = { a: 1, b: 0, c: Math.tan(angle), d: 1, e: 0, f: 0 };
        break;
      }
      case 'skewY': {
        const angle = ((args[0] ?? 0) * Math.PI) / 180;
        m = { a: 1, b: Math.tan(angle), c: 0, d: 1, e: 0, f: 0 };
        break;
      }
    }
    result = multiplyMatrix(result, m);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Conversión de formas primitivas a comandos path
// ---------------------------------------------------------------------------

function rectToPathD(el: Element): string {
  const x = parseFloat(el.getAttribute('x') ?? '0');
  const y = parseFloat(el.getAttribute('y') ?? '0');
  const w = parseFloat(el.getAttribute('width') ?? '0');
  const h = parseFloat(el.getAttribute('height') ?? '0');
  const rx = parseFloat(el.getAttribute('rx') ?? el.getAttribute('ry') ?? '0');
  const ry = parseFloat(el.getAttribute('ry') ?? el.getAttribute('rx') ?? '0');

  if (rx === 0 && ry === 0) {
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  // Rounded rect simplificado → aproximar con 4 arcs
  const r = Math.min(rx, ry, w / 2, h / 2);
  return (
    `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
    `H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
    `V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

function circleToPathD(el: Element): string {
  const cx = parseFloat(el.getAttribute('cx') ?? '0');
  const cy = parseFloat(el.getAttribute('cy') ?? '0');
  const r = parseFloat(el.getAttribute('r') ?? '0');
  return (
    `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} ` +
    `A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
  );
}

function ellipseToPathD(el: Element): string {
  const cx = parseFloat(el.getAttribute('cx') ?? '0');
  const cy = parseFloat(el.getAttribute('cy') ?? '0');
  const rx = parseFloat(el.getAttribute('rx') ?? '0');
  const ry = parseFloat(el.getAttribute('ry') ?? '0');
  return (
    `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} ` +
    `A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
  );
}

function polygonToPathD(el: Element, close: boolean): string {
  const pts = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
  if (pts.length < 2) return '';
  let d = `M ${pts[0]} ${pts[1]}`;
  for (let i = 2; i < pts.length - 1; i += 2) {
    d += ` L ${pts[i]} ${pts[i + 1]}`;
  }
  return close ? d + ' Z' : d;
}

function lineToPathD(el: Element): string {
  const x1 = el.getAttribute('x1') ?? '0';
  const y1 = el.getAttribute('y1') ?? '0';
  const x2 = el.getAttribute('x2') ?? '0';
  const y2 = el.getAttribute('y2') ?? '0';
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// Resolución de relleno/trazo desde element + herencia CSS
// ---------------------------------------------------------------------------

interface StyleContext {
  fill: string | null;
  stroke: string | null;
  fillOpacity: number;
  strokeOpacity: number;
  opacity: number;
  strokeWidth: number;
}

function getComputedStyle(el: Element, inherited: StyleContext): StyleContext {
  const style = el.getAttribute('style') ?? '';
  const parseProp = (prop: string): string | undefined => {
    const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
    return m?.[1]?.trim();
  };

  const attr = (name: string) => el.getAttribute(name);

  const fill        = parseProp('fill')         ?? attr('fill')          ?? null;
  const stroke      = parseProp('stroke')       ?? attr('stroke')        ?? null;
  const fillOp      = parseProp('fill-opacity') ?? attr('fill-opacity');
  const strokeOp    = parseProp('stroke-opacity') ?? attr('stroke-opacity');
  const opStr       = parseProp('opacity')      ?? attr('opacity');
  const strokeWStr  = parseProp('stroke-width') ?? attr('stroke-width');

  return {
    fill:         fill         ?? inherited.fill,
    stroke:       stroke       ?? inherited.stroke,
    fillOpacity:  fillOp   !== undefined ? parseFloat(fillOp!)   : inherited.fillOpacity,
    strokeOpacity: strokeOp !== undefined ? parseFloat(strokeOp!) : inherited.strokeOpacity,
    opacity:      opStr    !== undefined ? parseFloat(opStr!)    : inherited.opacity,
    strokeWidth:  strokeWStr !== undefined ? parseFloat(strokeWStr!) : inherited.strokeWidth,
  };
}

// ---------------------------------------------------------------------------
// Transformación de comandos path SVG (aplica matriz de transformación)
// ---------------------------------------------------------------------------

function applyMatrixToPathD(pathD: string, m: Matrix): string {
  // Transformar todos los pares de coordenadas en el path.
  // Solo soporta paths donde los arcos (A) no requieren rotación de eje (casos simples).
  return pathD.replace(
    /(-?[\d.]+(?:e[-+]?\d+)?)\s+(-?[\d.]+(?:e[-+]?\d+)?)/gi,
    (_, xs, ys) => {
      const [tx, ty] = transformPoint(m, parseFloat(xs), parseFloat(ys));
      return `${tx} ${ty}`;
    }
  );
}

// ---------------------------------------------------------------------------
// Función principal de renderizado
// ---------------------------------------------------------------------------

export async function renderSvgToPdfPage(
  page: PDFPage,
  svgDataUrl: string,
  xPdf: number,
  yPdfBottom: number,
  widthPts: number,
  heightPts: number,
  rotation: number,
): Promise<void> {
  // 1. Decodificar data URL
  let svgText: string;
  if (svgDataUrl.startsWith('data:image/svg+xml;base64,')) {
    svgText = atob(svgDataUrl.slice('data:image/svg+xml;base64,'.length));
  } else if (svgDataUrl.startsWith('data:image/svg+xml,')) {
    svgText = decodeURIComponent(svgDataUrl.slice('data:image/svg+xml,'.length));
  } else {
    return; // formato no reconocido
  }

  // 2. Parsear XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return;

  // 3. Calcular viewBox y escala
  let vbX = 0, vbY = 0, vbW: number, vbH: number;
  const vbAttr = svgEl.getAttribute('viewBox');
  if (vbAttr) {
    const parts = vbAttr.trim().split(/[\s,]+/).map(Number);
    vbX = parts[0]; vbY = parts[1]; vbW = parts[2]; vbH = parts[3];
  } else {
    vbW = parseFloat(svgEl.getAttribute('width') ?? '100');
    vbH = parseFloat(svgEl.getAttribute('height') ?? '100');
  }

  const scaleX = widthPts  / vbW;
  const scaleY = heightPts / vbH;

  // 4. Coordenada de origen en PDF (pdf-lib coloca SVG origin en (x,y))
  //    Con rotación 180° ajustamos igual que el código PNG existente.
  let originX = xPdf;
  let originY = yPdfBottom; // punto inferior-izquierdo del uniforme en PDF

  if (rotation === 180) {
    originX = xPdf + widthPts;
    originY = yPdfBottom + heightPts;
  }

  // Helper: convierte coordenada SVG (Y hacia abajo) a PDF (Y hacia arriba)
  const svgYToPdf = (svgY: number): number => {
    // SVG local → puntos → PDF Y
    return originY + heightPts - (svgY - vbY) * scaleY;
  };
  const svgXToPdf = (svgX: number): number => {
    return originX + (svgX - vbX) * scaleX;
  };

  // 5. Estado de herencia inicial
  const rootStyle: StyleContext = {
    fill: '#000000',
    stroke: null,
    fillOpacity: 1,
    strokeOpacity: 1,
    opacity: 1,
    strokeWidth: 1,
  };

  // Recopilamos los <defs> para gradientes (fallback a primer stop)
  const gradientColors = new Map<string, ParsedColor | null>();
  for (const grad of svgEl.querySelectorAll('linearGradient, radialGradient')) {
    const id = grad.getAttribute('id');
    if (!id) continue;
    const firstStop = grad.querySelector('stop');
    const stopColor = firstStop?.getAttribute('stop-color') ?? firstStop?.getAttribute('style')?.match(/stop-color:\s*([^;]+)/)?.[1];
    gradientColors.set(id, stopColor ? parseCssColor(stopColor) : null);
  }

  function resolveColor(colorRef: string | null): ParsedColor | null {
    if (!colorRef) return null;
    if (colorRef.startsWith('url(#')) {
      const id = colorRef.slice(5, -1);
      return gradientColors.get(id) ?? null;
    }
    return parseCssColor(colorRef);
  }

  // 6. Recorrido recursivo del DOM SVG
  function renderNode(node: Element, inherited: StyleContext, ctm: Matrix): void {
    const tag = node.tagName.toLowerCase().replace(/^svg:/, '');
    if (tag === 'defs' || tag === 'title' || tag === 'desc' || tag === 'metadata') return;

    const transform = parseTransformAttr(node.getAttribute('transform'));
    const localCTM = multiplyMatrix(ctm, transform);
    const style = getComputedStyle(node, inherited);

    if (tag === 'g') {
      for (const child of node.children) {
        renderNode(child, style, localCTM);
      }
      return;
    }

    // Obtener path D para el elemento
    let pathD: string | null = null;
    switch (tag) {
      case 'path':
        pathD = node.getAttribute('d');
        break;
      case 'rect':
        pathD = rectToPathD(node);
        break;
      case 'circle':
        pathD = circleToPathD(node);
        break;
      case 'ellipse':
        pathD = ellipseToPathD(node);
        break;
      case 'polygon':
        pathD = polygonToPathD(node, true);
        break;
      case 'polyline':
        pathD = polygonToPathD(node, false);
        break;
      case 'line':
        pathD = lineToPathD(node);
        break;
    }

    if (!pathD) return;

    // Aplicar transformación acumulada al path
    pathD = applyMatrixToPathD(pathD, localCTM);

    // Escalar coordenadas SVG → PDF
    // Reemplazamos los números aplicando la escala del viewBox
    const scaledD = pathD.replace(
      /(-?[\d.]+(?:e[-+]?\d+)?)\s+(-?[\d.]+(?:e[-+]?\d+)?)/gi,
      (_, xs, ys) => {
        const pdfX = svgXToPdf(parseFloat(xs));
        const pdfY = svgYToPdf(parseFloat(ys));
        return `${pdfX.toFixed(3)} ${pdfY.toFixed(3)}`;
      }
    );

    const effectiveOpacity = style.opacity;

    // Fill
    const fillColor = resolveColor(style.fill);
    if (fillColor) {
      const fillOpacity = style.fillOpacity * effectiveOpacity;
      try {
        page.drawSvgPath(scaledD, {
          x: 0,
          y: 0,
          borderWidth: 0,
          color: rgb(fillColor.r, fillColor.g, fillColor.b),
          opacity: Math.min(1, Math.max(0, fillOpacity)),
          rotate: degrees(rotation),
        });
      } catch {
        // Ignorar paths malformados
      }
    }

    // Stroke
    const strokeColor = resolveColor(style.stroke);
    if (strokeColor) {
      const strokeOpacity = style.strokeOpacity * effectiveOpacity;
      const strokeW = style.strokeWidth * Math.min(scaleX, scaleY);
      try {
        page.drawSvgPath(scaledD, {
          x: 0,
          y: 0,
          borderColor: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
          borderWidth: strokeW,
          borderOpacity: Math.min(1, Math.max(0, strokeOpacity)),
          color: undefined,
          rotate: degrees(rotation),
        });
      } catch {
        // Ignorar
      }
    }
  }

  // Renderizar todos los hijos del SVG raíz (excluir <defs>)
  for (const child of svgEl.children) {
    renderNode(child, rootStyle, identityMatrix());
  }
}
