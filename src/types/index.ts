// Tipos principales de la aplicación

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL';

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
