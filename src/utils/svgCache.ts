// Caché async de ParsedSvg — análogo a imageCache.ts pero para SVG vectorial.
// Soporta data URLs (data:image/svg+xml) y Blob URLs (blob:...).

import { parseSvgFromText, type ParsedSvg } from './svgParser';
export type { ParsedSvg } from './svgParser';

interface SvgCacheEntry {
  svg: ParsedSvg | null;
  status: 'loading' | 'loaded' | 'error';
  listeners: Array<(svg: ParsedSvg | null) => void>;
}

const svgCache = new Map<string, SvgCacheEntry>();

async function fetchSvgText(url: string): Promise<string> {
  if (url.startsWith('data:image/svg+xml;base64,')) {
    return atob(url.slice('data:image/svg+xml;base64,'.length));
  }
  if (url.startsWith('data:image/svg+xml,')) {
    return decodeURIComponent(url.slice('data:image/svg+xml,'.length));
  }
  // blob: URL o URL normal → fetch
  const res = await fetch(url);
  return res.text();
}

export const loadParsedSvg = (
  url: string,
  callback: (svg: ParsedSvg | null) => void,
): void => {
  if (!url) {
    callback(null);
    return;
  }

  const cached = svgCache.get(url);
  if (cached) {
    if (cached.status !== 'loading') {
      callback(cached.svg);
      return;
    }
    cached.listeners.push(callback);
    return;
  }

  const entry: SvgCacheEntry = {
    svg: null,
    status: 'loading',
    listeners: [callback],
  };
  svgCache.set(url, entry);

  fetchSvgText(url)
    .then(text => {
      const parsed = parseSvgFromText(text);
      entry.svg = parsed;
      entry.status = parsed ? 'loaded' : 'error';
    })
    .catch(() => {
      entry.status = 'error';
    })
    .finally(() => {
      entry.listeners.forEach(l => l(entry.svg));
      entry.listeners = [];
    });
};

export const clearSvgCache = (): void => {
  svgCache.clear();
};
