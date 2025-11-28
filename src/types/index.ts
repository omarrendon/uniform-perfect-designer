// Tipos principales de la aplicación

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL';

// Tallas en español
export type SizeSpanish = 'XCH' | 'CH' | 'M' | 'G' | 'XG' | '2XG' | '3XG';

// Mapeo de tallas español a inglés
export const SIZE_MAP: Record<SizeSpanish, Size> = {
  'XCH': 'XS',
  'CH': 'S',
  'M': 'M',
  'G': 'L',
  'XG': 'XL',
  '2XG': '2XL',
  '3XG': '3XL',
};

// Configuración de imágenes por talla
export interface SizeImages {
  jerseyFront?: string;  // URL o base64 de playera delantera
  jerseyBack?: string;   // URL o base64 de playera trasera
  shorts?: string;       // URL o base64 de short
}

export interface UniformSizesConfig {
  [key: string]: SizeImages; // Key es la talla en español (XCH, CH, M, G, XG, 2XG, 3XG)
}

export interface SizeConfig {
  size: Size;
  width: number;
  height: number;
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

export interface UniformTemplate extends UniformElement {
  type: 'uniform';
  baseColor: string;
  imageUrl?: string;
  imageMask?: string;
  originalImageUrl?: string; // URL de la imagen original para exportar en alta calidad
  side?: 'front' | 'back' | 'right' | 'left'; // Lado del uniforme
}

export interface TextElement extends UniformElement {
  type: 'text';
  content: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
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
