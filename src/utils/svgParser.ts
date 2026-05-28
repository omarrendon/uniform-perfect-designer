// Parsea SVG text en una estructura de paths lista para renderizar con Canvas 2D / Path2D.
// No depende de DOM externo — usa DOMParser del browser.

export type Matrix2D = [number, number, number, number, number, number]; // [a, b, c, d, e, f]

export interface ParsedPath {
  d: string;
  ctm: Matrix2D;          // Accumulated transform desde el root del SVG
  fill: string;           // Color CSS o 'none'
  fillOpacity: number;    // 0–1, ya incluye el opacity del elemento
  stroke: string;         // Color CSS o 'none'
  strokeWidth: number;
  strokeOpacity: number;  // 0–1, ya incluye el opacity del elemento
  fillRule: 'nonzero' | 'evenodd';
}

export interface ParsedSvg {
  viewBox: { x: number; y: number; width: number; height: number };
  paths: ParsedPath[];
}

interface Style {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  opacity: number;
  fillRule: 'nonzero' | 'evenodd';
}

const IDENTITY: Matrix2D = [1, 0, 0, 1, 0, 0];

const DEFAULT_STYLE: Style = {
  fill: '#000000',
  fillOpacity: 1,
  stroke: 'none',
  strokeWidth: 1,
  strokeOpacity: 1,
  opacity: 1,
  fillRule: 'nonzero',
};

// Multiplicación de matrices 2D afines: resultado = m1 × m2
function multiplyMatrices(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function parseTransformAttr(transformStr: string | null): Matrix2D {
  if (!transformStr) return IDENTITY;

  let result: Matrix2D = [...IDENTITY];
  const regex = /(\w+)\s*\(([^)]*)\)/g;
  let match;

  while ((match = regex.exec(transformStr)) !== null) {
    const type = match[1];
    const nums = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    let t: Matrix2D;

    switch (type) {
      case 'translate': {
        const tx = nums[0] ?? 0;
        const ty = nums[1] ?? 0;
        t = [1, 0, 0, 1, tx, ty];
        break;
      }
      case 'scale': {
        const sx = nums[0] ?? 1;
        const sy = nums[1] ?? sx;
        t = [sx, 0, 0, sy, 0, 0];
        break;
      }
      case 'rotate': {
        const deg = nums[0] ?? 0;
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const cx = nums[1] ?? 0;
        const cy = nums[2] ?? 0;
        if (cx !== 0 || cy !== 0) {
          const tTo: Matrix2D = [1, 0, 0, 1, cx, cy];
          const rot: Matrix2D = [cos, sin, -sin, cos, 0, 0];
          const tBack: Matrix2D = [1, 0, 0, 1, -cx, -cy];
          t = multiplyMatrices(multiplyMatrices(tTo, rot), tBack);
        } else {
          t = [cos, sin, -sin, cos, 0, 0];
        }
        break;
      }
      case 'matrix':
        t = [nums[0] ?? 1, nums[1] ?? 0, nums[2] ?? 0, nums[3] ?? 1, nums[4] ?? 0, nums[5] ?? 0];
        break;
      case 'skewX': {
        const angle = ((nums[0] ?? 0) * Math.PI) / 180;
        t = [1, 0, Math.tan(angle), 1, 0, 0];
        break;
      }
      case 'skewY': {
        const angle = ((nums[0] ?? 0) * Math.PI) / 180;
        t = [1, Math.tan(angle), 0, 1, 0, 0];
        break;
      }
      default:
        continue;
    }

    result = multiplyMatrices(result, t);
  }

  return result;
}

function parseColor(color: string, currentColor: string): string {
  if (!color || color === 'inherit') return currentColor;
  if (color === 'currentColor') return currentColor;
  if (color === 'none') return 'none';
  if (color.startsWith('url(')) return 'none'; // gradientes → omitir
  return color;
}

function parseInlineStyle(styleStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const prop of styleStr.split(';')) {
    const idx = prop.indexOf(':');
    if (idx < 0) continue;
    const key = prop.slice(0, idx).trim();
    const val = prop.slice(idx + 1).trim();
    if (key && val) result[key] = val;
  }
  return result;
}

function resolveStyle(el: Element, parent: Style): Style {
  const s = { ...parent };

  // Atributos de presentación (menor prioridad)
  const fill = el.getAttribute('fill');
  if (fill !== null) s.fill = parseColor(fill, parent.fill);

  const fillOpacity = el.getAttribute('fill-opacity');
  if (fillOpacity !== null) s.fillOpacity = parseFloat(fillOpacity);

  const stroke = el.getAttribute('stroke');
  if (stroke !== null) s.stroke = parseColor(stroke, parent.stroke);

  const strokeWidth = el.getAttribute('stroke-width');
  if (strokeWidth !== null) s.strokeWidth = parseFloat(strokeWidth);

  const strokeOpacity = el.getAttribute('stroke-opacity');
  if (strokeOpacity !== null) s.strokeOpacity = parseFloat(strokeOpacity);

  const fillRule = el.getAttribute('fill-rule');
  if (fillRule === 'evenodd') s.fillRule = 'evenodd';
  else if (fillRule === 'nonzero') s.fillRule = 'nonzero';

  const opacity = el.getAttribute('opacity');
  if (opacity !== null) s.opacity = parseFloat(opacity) * parent.opacity;

  // Inline style (mayor prioridad)
  const inlineStyle = el.getAttribute('style');
  if (inlineStyle) {
    const css = parseInlineStyle(inlineStyle);
    if (css['fill']) s.fill = parseColor(css['fill'], s.fill);
    if (css['fill-opacity']) s.fillOpacity = parseFloat(css['fill-opacity']);
    if (css['stroke']) s.stroke = parseColor(css['stroke'], s.stroke);
    if (css['stroke-width']) s.strokeWidth = parseFloat(css['stroke-width']);
    if (css['stroke-opacity']) s.strokeOpacity = parseFloat(css['stroke-opacity']);
    if (css['fill-rule'] === 'evenodd') s.fillRule = 'evenodd';
    if (css['fill-rule'] === 'nonzero') s.fillRule = 'nonzero';
    if (css['opacity']) s.opacity = parseFloat(css['opacity']) * parent.opacity;
    if (css['display'] === 'none' || css['visibility'] === 'hidden') {
      s.fill = 'none';
      s.stroke = 'none';
    }
  }

  const display = el.getAttribute('display');
  const visibility = el.getAttribute('visibility');
  if (display === 'none' || visibility === 'hidden') {
    s.fill = 'none';
    s.stroke = 'none';
  }

  return s;
}

// Convierte <rect> a path d
function rectToPath(el: Element): string {
  const x = parseFloat(el.getAttribute('x') ?? '0');
  const y = parseFloat(el.getAttribute('y') ?? '0');
  const w = parseFloat(el.getAttribute('width') ?? '0');
  const h = parseFloat(el.getAttribute('height') ?? '0');
  if (w <= 0 || h <= 0) return '';

  const rxAttr = el.getAttribute('rx');
  const ryAttr = el.getAttribute('ry');
  const rx = Math.min(parseFloat(rxAttr ?? ryAttr ?? '0'), w / 2);
  const ry = Math.min(parseFloat(ryAttr ?? rxAttr ?? '0'), h / 2);

  if (rx <= 0 || ry <= 0) return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;

  return [
    `M ${x + rx} ${y}`,
    `h ${w - 2 * rx}`,
    `a ${rx} ${ry} 0 0 1 ${rx} ${ry}`,
    `v ${h - 2 * ry}`,
    `a ${rx} ${ry} 0 0 1 ${-rx} ${ry}`,
    `h ${-(w - 2 * rx)}`,
    `a ${rx} ${ry} 0 0 1 ${-rx} ${-ry}`,
    `v ${-(h - 2 * ry)}`,
    `a ${rx} ${ry} 0 0 1 ${rx} ${-ry}`,
    'Z',
  ].join(' ');
}

// Aproxima una elipse con 4 curvas cúbicas de Bézier
function ellipsePathString(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5522847498;
  const kx = k * rx;
  const ky = k * ry;
  return [
    `M ${cx} ${cy - ry}`,
    `C ${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}`,
    `C ${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}`,
    'Z',
  ].join(' ');
}

function circleToPath(el: Element): string {
  const cx = parseFloat(el.getAttribute('cx') ?? '0');
  const cy = parseFloat(el.getAttribute('cy') ?? '0');
  const r = parseFloat(el.getAttribute('r') ?? '0');
  if (r <= 0) return '';
  return ellipsePathString(cx, cy, r, r);
}

function ellipseToPath(el: Element): string {
  const cx = parseFloat(el.getAttribute('cx') ?? '0');
  const cy = parseFloat(el.getAttribute('cy') ?? '0');
  const rx = parseFloat(el.getAttribute('rx') ?? '0');
  const ry = parseFloat(el.getAttribute('ry') ?? '0');
  if (rx <= 0 || ry <= 0) return '';
  return ellipsePathString(cx, cy, rx, ry);
}

function polygonToPath(el: Element): string {
  const points = el.getAttribute('points') ?? '';
  const nums = points.trim().split(/[\s,]+/).map(Number);
  if (nums.length < 4) return '';

  const pairs: string[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pairs.push(`${nums[i]} ${nums[i + 1]}`);
  }

  const close = el.tagName.toLowerCase().replace(/^svg:/, '') === 'polygon' ? ' Z' : '';
  return `M ${pairs[0]} L ${pairs.slice(1).join(' L ')}${close}`;
}

function lineToPath(el: Element): string {
  const x1 = el.getAttribute('x1') ?? '0';
  const y1 = el.getAttribute('y1') ?? '0';
  const x2 = el.getAttribute('x2') ?? '0';
  const y2 = el.getAttribute('y2') ?? '0';
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

const SKIP_TAGS = new Set([
  'defs', 'clippath', 'mask', 'symbol', 'title', 'desc',
  'metadata', 'style', 'filter', 'lineargradient', 'radialgradient',
  'pattern', 'marker', 'text', 'tspan', 'use', 'image', 'script',
]);

function traverseElement(
  el: Element,
  parentStyle: Style,
  parentCTM: Matrix2D,
  paths: ParsedPath[],
): void {
  const tag = el.tagName.toLowerCase().replace(/^svg:/, '');
  if (SKIP_TAGS.has(tag)) return;

  const style = resolveStyle(el, parentStyle);
  const ownTransform = parseTransformAttr(el.getAttribute('transform'));
  const ctm = multiplyMatrices(parentCTM, ownTransform);

  if (tag === 'g' || tag === 'svg' || tag === 'a') {
    for (const child of Array.from(el.children)) {
      traverseElement(child, style, ctm, paths);
    }
    return;
  }

  let d = '';
  switch (tag) {
    case 'path':      d = el.getAttribute('d') ?? ''; break;
    case 'rect':      d = rectToPath(el); break;
    case 'circle':    d = circleToPath(el); break;
    case 'ellipse':   d = ellipseToPath(el); break;
    case 'polygon':
    case 'polyline':  d = polygonToPath(el); break;
    case 'line':      d = lineToPath(el); break;
    default: return;
  }

  if (!d) return;

  const hasVisibleFill = style.fill !== 'none' && style.fillOpacity > 0;
  const hasVisibleStroke = style.stroke !== 'none' && style.strokeWidth > 0 && style.strokeOpacity > 0;
  if (!hasVisibleFill && !hasVisibleStroke) return;

  paths.push({
    d,
    ctm,
    fill: style.fill,
    fillOpacity: Math.min(1, Math.max(0, style.fillOpacity * style.opacity)),
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeOpacity: Math.min(1, Math.max(0, style.strokeOpacity * style.opacity)),
    fillRule: style.fillRule,
  });
}

export function parseSvgFromText(svgText: string): ParsedSvg | null {
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return null;

    const svgEl = doc.documentElement;

    // Extraer viewBox
    let viewBox = { x: 0, y: 0, width: 100, height: 100 };
    const vbAttr = svgEl.getAttribute('viewBox');
    if (vbAttr) {
      const parts = vbAttr.trim().split(/[\s,]+/).map(Number);
      if (parts.length >= 4) {
        viewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
    } else {
      const w = parseFloat(svgEl.getAttribute('width') ?? '100');
      const h = parseFloat(svgEl.getAttribute('height') ?? '100');
      if (!isNaN(w) && !isNaN(h)) viewBox = { x: 0, y: 0, width: w, height: h };
    }

    if (viewBox.width <= 0 || viewBox.height <= 0) return null;

    const paths: ParsedPath[] = [];
    for (const child of Array.from(svgEl.children)) {
      traverseElement(child, DEFAULT_STYLE, IDENTITY, paths);
    }

    return { viewBox, paths };
  } catch {
    return null;
  }
}
