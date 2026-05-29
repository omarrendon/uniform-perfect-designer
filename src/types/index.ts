// Tipos principales de la aplicación

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL';

// Color CMYK para impresión directa (valores 0-100)
export interface CmykColor {
  c: number;
  m: number;
  y: number;
  k: number;
}

// Género del uniforme
export type Gender = 'Hombre' | 'Mujer';

// Tallas en español
export type SizeSpanish = 'XCH' | 'CH' | 'M' | 'G' | 'XG';

// Mapeo de tallas español a inglés
export const SIZE_MAP: Record<SizeSpanish, Size> = {
  'XCH': 'XS',
  'CH': 'S',
  'M': 'M',
  'G': 'L',
  'XG': 'XL',
};

// Configuración de imágenes por talla
export interface SizeImages {
  jerseyFront?: string;   // URL o base64 de playera delantera
  jerseyBack?: string;    // URL o base64 de playera trasera
  shortsLeft?: string;    // URL o base64 de short izquierdo
  shortsRight?: string;   // URL o base64 de short derecho
}

export interface UniformSizesConfig {
  [key: string]: SizeImages; // Key es la talla en español (XCH, CH, M, G, XG, 2XG, 3XG)
}

export interface SizeConfig {
  size: Size;
  gender: Gender; // Género del uniforme (Hombre/Mujer)
  width: number;  // Ancho de playera en píxeles (pixelsPerCm = 10)
  height: number; // Alto de playera en píxeles (pixelsPerCm = 10)
  shortsWidth?: number;  // Ancho de shorts en píxeles (opcional, precisión de moldes)
  shortsHeight?: number; // Alto de shorts en píxeles (opcional, precisión de moldes)
}

export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export type UniformPart = 'jersey' | 'shorts';

export interface UniformElement {
  id: string;
  type: 'uniform' | 'text' | 'image';
  part: UniformPart;
  size: Size;
  position: Position;
  dimensions: Dimensions;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
}

export type TemplatePiece = 'jerseyFront' | 'jerseyBack' | 'shortsLeft' | 'shortsRight';

export interface UniformTemplate extends UniformElement {
  type: 'uniform';
  baseColor: string;
  imageUrl?: string;
  imageMask?: string;
  originalImageUrl?: string; // URL de la imagen original (uploads manuales)
  templatePiece?: TemplatePiece; // Para carga Excel: identifica la pieza sin duplicar los datos de imagen
  side?: 'front' | 'back' | 'right' | 'left'; // Lado del uniforme
  source?: 'excel' | 'manual'; // Origen: carga masiva Excel o imágenes manuales
  isSvg?: boolean; // true cuando imageUrl apunta a un SVG (para elegir renderer vectorial)
}

export interface TextElement extends UniformElement {
  type: 'text';
  content: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;        // hex #RRGGBB — usado por Konva para preview
  fontColorCmyk?: CmykColor; // CMYK directo para PDF (cuando está presente, tiene precedencia)
  textAlign: 'left' | 'center' | 'right';
  fontWeight: 'normal' | 'bold';
  opacity: number;
  side: 'front' | 'back';
}

export interface ImageElement extends UniformElement {
  type: 'image';
  imageUrl: string;
  opacity: number;
}

export type CanvasElement = UniformTemplate | TextElement | ImageElement;

export interface CanvasConfig {
  width: number; // en cm
  height: number; // en cm
  pixelsPerCm: number; // para conversión
}

export interface Project {
  id: string;
  name: string;
  canvasConfig: CanvasConfig;
  elements: CanvasElement[];
  sizeConfigs: SizeConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoryState {
  elements: CanvasElement[];
  timestamp: number;
}

export interface ExportOptions {
  format: 'png' | 'pdf';
  backgroundColor?: string;
  transparent?: boolean;
  quality?: number;
  canvasWidth?: number; // Ancho del canvas en cm (para PDF)
  canvasHeight?: number; // Alto del canvas en cm (para PDF)
}

// Configuración de diseño para un elemento de texto en el uniforme
export interface TextDesignConfig {
  enabled: boolean;
  relativeX: number;
  relativeY: number;
  fontFamily: string;
  fontSize: number;
  fontColor: string;        // #RRGGBB — hex para Konva
  fontColorCmyk?: CmykColor; // CMYK directo para PDF
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
}

// Diseño completo del uniforme: posición y estilo de cada texto
export interface UniformDesignConfig {
  jerseyFrontNumber: TextDesignConfig;
  jerseyBackNumber: TextDesignConfig;
  jerseyBackName: TextDesignConfig;
  shortsNumber: TextDesignConfig & { side: 'left' | 'right' };
}

// Fuente cargada por el usuario (base64 persistida en localStorage)
export interface UserFont {
  name: string;
  dataUrl: string;
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
  uploadedAt: number;
}
