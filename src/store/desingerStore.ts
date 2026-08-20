// import { create } from "zustand";
// import { devtools, persist } from "zustand/middleware";
// import type {
//   CanvasConfig,
//   CanvasElement,
//   HistoryState,
//   Project,
//   Size,
//   SizeConfig,
// } from "../types";

// interface DesignerState {
//   // Canvas configuration
//   canvasConfig: CanvasConfig;
//   setCanvasConfig: (config: Partial<CanvasConfig>) => void;

//   // Elements
//   elements: CanvasElement[];
//   selectedElementId: string | null;
//   addElement: (element: CanvasElement) => void;
//   updateElement: (id: string, updates: Partial<CanvasElement>) => void;
//   deleteElement: (id: string) => void;
//   selectElement: (id: string | null) => void;
//   duplicateElement: (id: string) => void;
//   bringToFront: (id: string) => void;
//   sendToBack: (id: string) => void;

//   // Size configurations
//   sizeConfigs: SizeConfig[];
//   updateSizeConfig: (size: Size, config: Partial<SizeConfig>) => void;

//   // History (Undo/Redo)
//   history: HistoryState[];
//   historyIndex: number;
//   saveHistory: () => void;
//   undo: () => void;
//   redo: () => void;
//   canUndo: () => boolean;
//   canRedo: () => boolean;

//   // Project management
//   currentProject: Project | null;
//   saveProject: (name: string) => void;
//   loadProject: (project: Project) => void;
//   clearProject: () => void;

//   // UI State
//   showGrid: boolean;
//   toggleGrid: () => void;
//   zoom: number;
//   setZoom: (zoom: number) => void;
// }

// const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
//   width: 100, // cm
//   height: 50, // cm
//   pixelsPerCm: 10,
// };

// const DEFAULT_SIZE_CONFIGS: SizeConfig[] = [
//   { size: "XS", width: 40, height: 50 },
//   { size: "S", width: 45, height: 55 },
//   { size: "M", width: 50, height: 60 },
//   { size: "L", width: 55, height: 65 },
//   { size: "XL", width: 60, height: 70 },
// ];

// export const useDesignerStore = create<DesignerState>()(
//   devtools(
//     persist(
//       (set, get) => ({
//         // Initial state
//         canvasConfig: DEFAULT_CANVAS_CONFIG,
//         elements: [],
//         selectedElementId: null,
//         sizeConfigs: DEFAULT_SIZE_CONFIGS,
//         history: [],
//         historyIndex: -1,
//         currentProject: null,
//         showGrid: true,
//         zoom: 1,

//         // Canvas configuration
//         setCanvasConfig: config =>
//           set(state => ({
//             canvasConfig: { ...state.canvasConfig, ...config },
//           })),

//         // Element management
//         addElement: element =>
//           set(state => {
//             const newElements = [...state.elements, element];
//             return { elements: newElements };
//           }),

//         updateElement: (id, updates) =>
//           set(state => ({
//             elements: state.elements.map(el =>
//               el.id === id ? ({ ...el, ...updates } as CanvasElement) : el
//             ),
//           })),

//         deleteElement: id =>
//           set(state => ({
//             elements: state.elements.filter(el => el.id !== id),
//             selectedElementId:
//               state.selectedElementId === id ? null : state.selectedElementId,
//           })),

//         selectElement: id =>
//           set(() => ({
//             selectedElementId: id,
//           })),

//         duplicateElement: id =>
//           set(state => {
//             const element = state.elements.find(el => el.id === id);
//             if (!element) return state;

//             const newElement: CanvasElement = {
//               ...element,
//               id: `${element.type}-${Date.now()}`,
//               position: {
//                 x: element.position.x + 20,
//                 y: element.position.y + 20,
//               },
//             };

//             return {
//               elements: [...state.elements, newElement],
//               selectedElementId: newElement.id,
//             };
//           }),

//         bringToFront: id =>
//           set(state => {
//             const maxZIndex = Math.max(...state.elements.map(el => el.zIndex));
//             return {
//               elements: state.elements.map(el =>
//                 el.id === id ? { ...el, zIndex: maxZIndex + 1 } : el
//               ),
//             };
//           }),

//         sendToBack: id =>
//           set(state => {
//             const minZIndex = Math.min(...state.elements.map(el => el.zIndex));
//             return {
//               elements: state.elements.map(el =>
//                 el.id === id ? { ...el, zIndex: minZIndex - 1 } : el
//               ),
//             };
//           }),

//         // Size configurations
//         updateSizeConfig: (size, config) =>
//           set(state => ({
//             sizeConfigs: state.sizeConfigs.map(sc =>
//               sc.size === size ? { ...sc, ...config } : sc
//             ),
//           })),

//         // History management
//         saveHistory: () =>
//           set(state => {
//             const newHistory = state.history.slice(0, state.historyIndex + 1);
//             newHistory.push({
//               elements: [...state.elements],
//               timestamp: Date.now(),
//             });

//             // Limit history to 50 states
//             if (newHistory.length > 50) {
//               newHistory.shift();
//             }

//             return {
//               history: newHistory,
//               historyIndex: newHistory.length - 1,
//             };
//           }),

//         undo: () =>
//           set(state => {
//             if (state.historyIndex <= 0) return state;

//             const newIndex = state.historyIndex - 1;
//             return {
//               elements: [...state.history[newIndex].elements],
//               historyIndex: newIndex,
//             };
//           }),

//         redo: () =>
//           set(state => {
//             if (state.historyIndex >= state.history.length - 1) return state;

//             const newIndex = state.historyIndex + 1;
//             return {
//               elements: [...state.history[newIndex].elements],
//               historyIndex: newIndex,
//             };
//           }),

//         canUndo: () => get().historyIndex > 0,
//         canRedo: () => get().historyIndex < get().history.length - 1,

//         // Project management
//         saveProject: name =>
//           set(state => {
//             const project: Project = {
//               id: `project-${Date.now()}`,
//               name,
//               canvasConfig: state.canvasConfig,
//               elements: state.elements,
//               sizeConfigs: state.sizeConfigs,
//               createdAt: new Date(),
//               updatedAt: new Date(),
//             };

//             localStorage.setItem(project.id, JSON.stringify(project));

//             return { currentProject: project };
//           }),

//         loadProject: project =>
//           set(() => ({
//             canvasConfig: project.canvasConfig,
//             elements: project.elements,
//             sizeConfigs: project.sizeConfigs,
//             currentProject: project,
//             selectedElementId: null,
//           })),

//         clearProject: () =>
//           set(() => ({
//             elements: [],
//             selectedElementId: null,
//             currentProject: null,
//             history: [],
//             historyIndex: -1,
//           })),

//         // UI State
//         toggleGrid: () =>
//           set(state => ({
//             showGrid: !state.showGrid,
//           })),

//         setZoom: zoom =>
//           set(() => ({
//             zoom: Math.max(0.1, Math.min(3, zoom)),
//           })),
//       }),
//       {
//         name: "designer-storage",
//         partialize: state => ({
//           canvasConfig: state.canvasConfig,
//           sizeConfigs: state.sizeConfigs,
//           showGrid: state.showGrid,
//         }),
//       }
//     )
//   )
// );

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type {
  CanvasConfig,
  CanvasElement,
  Gender,
  HistoryState,
  Project,
  Size,
  SizeConfig,
  SizeImages,
  TemplatePiece,
  UniformDesignConfig,
  UniformSizesConfig,
  UserFont,
} from "../types";
import { findValidPosition } from "../utils/canvas";

interface DesignerState {
  // Canvas configuration
  canvasConfig: CanvasConfig;
  setCanvasConfig: (config: Partial<CanvasConfig>) => void;

  // Multi-page support
  currentPage: number;
  pages: CanvasElement[][]; // Array de páginas, cada una con sus elementos
  setCurrentPage: (page: number) => void;
  addPage: () => void;
  deletePage: (pageIndex: number) => void;
  getTotalPages: () => number;
  getPageHeight: (pageIndex: number) => number; // Obtener altura ajustada de una página en cm

  // Elements (de la página actual)
  elements: CanvasElement[];
  selectedElementId: string | null;
  addElement: (element: CanvasElement, pageIndex?: number) => void;
  addElementsBatch: (pageElements: Map<number, CanvasElement[]>) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  duplicateElement: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Size configurations
  sizeConfigs: SizeConfig[];
  updateSizeConfig: (size: Size, config: Partial<SizeConfig>) => void;

  // Uniform sizes configuration (imágenes por talla)
  uniformSizesConfig: UniformSizesConfig; // Imágenes ORIGINALES (para PDF)
  uniformSizesConfigCompressed: UniformSizesConfig; // Imágenes COMPRIMIDAS (para canvas)
  setUniformSizeImages: (sizeKey: string, images: Partial<SizeImages>) => void; // sizeKey puede ser SizeSpanish o compound key "H-XS", "M-CH"
  getUniformSizeImages: (sizeKey: string) => SizeImages | undefined;
  getUniformSizeImagesCompressed: (sizeKey: string) => SizeImages | undefined;
  isSizeComplete: (sizeKey: string) => boolean;
  clearUniformSizesConfig: () => void;
  getSizeConfig: (size: Size, gender: Gender) => SizeConfig | undefined; // Helper para obtener config por talla y género

  // Uniform template — una sola plantilla para todas las tallas
  uniformTemplate: SizeImages | null; // Imágenes ORIGINALES del template (para PDF)
  uniformTemplateCompressed: SizeImages | null; // Imágenes COMPRIMIDAS del template (para canvas)
  setUniformTemplate: (images: Partial<SizeImages>) => void;
  isTemplateComplete: () => boolean;
  clearUniformTemplate: () => void;

  // Bytes crudos del PDF original por pieza — para embedding directo en Fase 2
  // No se persisten en localStorage (demasiado grandes y no serializables como JSON)
  uniformTemplatePdfBytes: Partial<Record<TemplatePiece, Uint8Array>> | null;
  // bytes=null elimina la entrada del slot (usado cuando se reemplaza un PDF por una imagen)
  setUniformTemplatePdfBytes: (piece: TemplatePiece, bytes: Uint8Array | null) => void;
  clearUniformTemplatePdfBytes: () => void;

  // Diseño del uniforme (posiciones de textos)
  uniformDesignConfig: UniformDesignConfig | null;
  setUniformDesignConfig: (config: UniformDesignConfig | null) => void;

  // History (Undo/Redo)
  history: HistoryState[];
  historyIndex: number;
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Project management
  currentProject: Project | null;
  saveProject: (name: string) => void;
  loadProject: (project: Project) => void;
  clearProject: () => void;

  // UI State
  showGrid: boolean;
  toggleGrid: () => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  isCanvasHidden: boolean;
  setCanvasHidden: (hidden: boolean) => void;
  isExporting: boolean; // Oculta textos de talla durante exportación
  setIsExporting: (isExporting: boolean) => void;

  // Bulk Image Upload
  bulkImageUpload: {
    jerseyFronts: File[];
    jerseyBacks: File[];
    shortsRights: File[];
    shortsLefts: File[];
  };
  setBulkImages: (type: 'jerseyFronts' | 'jerseyBacks' | 'shortsRights' | 'shortsLefts', files: File[]) => void;
  processBulkImages: () => Promise<void>;
  clearBulkImages: () => void;

  // Fuentes del usuario
  userFonts: UserFont[];
  addUserFont: (font: UserFont) => void;
  removeUserFont: (name: string) => void;
}

const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  width: 158.529, // cm - ancho máximo para impresión
  height: 490, // cm - alto máximo para impresión
  pixelsPerCm: 10,
};

// Cuello: medida única para todas las tallas y géneros — TABLA-TALLAS.xlsx (jun 2026)
const COLLAR_W = 650; // 65 cm × 10 px/cm
const COLLAR_H =  60; //  6 cm × 10 px/cm

// Configuraciones de tallas HOMBRE
//
// PROCEDENCIA DE LAS MEDIDAS — importante antes de imprimir:
//   S, M, L, XL  → oficiales, TABLA-TALLAS.xlsx (jun 2026). Verificadas al centésimo
//                  contra el trazo vectorial de ambos PDF de patronaje.
//   XS, XXL,     → playera: MEDIDAS DE TALLAS DE CABALLERO.pdf (ago 2026)
//   3XL, 4XL       shorts:  MEDIDAS TALLAS PARA CABALLERO SHORT FUTBOL.pdf (ago 2026)
//                  Ambas medidas del trazo vectorial, exactas.
//                  manga: DERIVADA, única pieza sin documento de patronaje.
//
// DERIVACIÓN de la manga en las tallas nuevas:
//   S→XL avanza en pasos constantes (+18.71/+10.90 px) y se continuó esa progresión.
//   Se eligió progresión lineal porque la playera —la prenda de la que la manga forma
//   parte— sí es lineal en las 8 tallas medidas. Ojo: el short NO lo es (su paso se
//   acelera de +31.33 a +33.88 px después de XL), así que si aparece un PDF de mangas
//   es probable que estos valores queden cortos en 3XL/4XL.
//   XS no sigue el paso de las demás: mide 0.9587× la S en playera y 0.9577× en short;
//   para la manga se usó el factor de la playera.
//   El ratio ancho/alto se conserva en todas (playera 0.7206, short 1.3755, manga 1.7171),
//   que es la condición para que Konva escale la plantilla única sin distorsión.
const SIZE_CONFIGS_HOMBRE: SizeConfig[] = [
  {
    size: "XS", gender: "Hombre",
    width: 513.61, height: 712.73,         // Playera: 51.361cm × 71.273cm — PDF caballero
    shortsWidth: 690.00, shortsHeight: 501.63, // Shorts: 69.00cm  × 50.163cm — PDF shorts
    sleeveWidth: 412.54, sleeveHeight: 240.25, // Manga:  41.254cm × 24.025cm — DERIVADO
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "S", gender: "Hombre",
    width: 535.75, height: 743.44,         // Playera: 53.575cm × 74.344cm
    shortsWidth: 720.50, shortsHeight: 523.80, // Shorts: 72.05cm × 52.38cm
    sleeveWidth: 430.32, sleeveHeight: 250.60, // Manga:  43.032cm × 25.06cm
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "M", gender: "Hombre",
    width: 559.04, height: 775.77,         // Playera: 55.904cm × 77.577cm
    shortsWidth: 751.83, shortsHeight: 546.58, // Shorts: 75.183cm × 54.658cm
    sleeveWidth: 449.03, sleeveHeight: 261.49, // Manga:  44.903cm × 26.149cm
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "L", gender: "Hombre",
    width: 582.33, height: 808.09,         // Playera: 58.233cm × 80.809cm
    shortsWidth: 783.15, shortsHeight: 569.35, // Shorts: 78.315cm × 56.935cm
    sleeveWidth: 467.74, sleeveHeight: 272.39, // Manga:  46.774cm × 27.239cm
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "XL", gender: "Hombre",
    width: 605.63, height: 840.41,         // Playera: 60.563cm × 84.041cm
    shortsWidth: 814.48, shortsHeight: 592.13, // Shorts: 81.448cm × 59.213cm
    sleeveWidth: 486.45, sleeveHeight: 283.29, // Manga:  48.645cm × 28.329cm
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "XXL", gender: "Hombre",
    width: 628.92, height: 872.74,         // Playera: 62.892cm × 87.274cm — PDF caballero
    shortsWidth: 847.06, shortsHeight: 615.81, // Shorts: 84.706cm × 61.581cm — PDF shorts
    sleeveWidth: 505.16, sleeveHeight: 294.19, // Manga:  50.516cm × 29.419cm — DERIVADO
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "3XL", gender: "Hombre",
    width: 652.21, height: 905.06,         // Playera: 65.221cm × 90.506cm — PDF caballero
    shortsWidth: 880.94, shortsHeight: 640.44, // Shorts: 88.094cm × 64.044cm — PDF shorts
    sleeveWidth: 523.87, sleeveHeight: 305.08, // Manga:  52.387cm × 30.508cm — DERIVADO
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "4XL", gender: "Hombre",
    width: 675.51, height: 937.38,         // Playera: 67.551cm × 93.738cm — PDF caballero
    shortsWidth: 914.82, shortsHeight: 665.08, // Shorts: 91.482cm × 66.508cm — PDF shorts
    sleeveWidth: 542.58, sleeveHeight: 315.98, // Manga:  54.258cm × 31.598cm — DERIVADO
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
];

// Configuraciones de tallas MUJER
//
// PROCEDENCIA: S, M, L, XL son oficiales (TABLA-TALLAS.xlsx, jun 2026).
// XS, XXL, 3XL y 4XL están COMPLETAS por derivación — no existe documento de dama
// para esas tallas. Validar con patronista antes de mandar a producción.
//
// Método por pieza:
//   shorts  → se aplicó, talla por talla, el factor de crecimiento real que el PDF
//             de caballero muestra respecto a XL (×1.0400, ×1.0816, ×1.1232) y
//             respecto a S para XS (×0.9577). No se extrapola linealmente porque el
//             short se acelera después de XL.
//   playera → progresión lineal de S→XL (+25.05/+34.59 px), que es como se comporta
//             la playera de caballero en las 8 tallas medidas; XS con factor 0.9587.
//   manga   → misma progresión lineal (+19.14/+11.29 px).
// Los ratios se conservan (playera 0.7242, shorts 1.3784, manga 1.6952).
const SIZE_CONFIGS_MUJER: SizeConfig[] = [
  {
    size: "XS", gender: "Mujer",
    width: 480.33, height: 663.22,         // Playera: 48.033cm × 66.322cm — DERIVADO
    shortsWidth: 641.37, shortsHeight: 465.32, // Shorts: 64.137cm × 46.532cm — DERIVADO
    sleeveWidth: 367.00, sleeveHeight: 216.50, // Manga:  36.70cm  × 21.65cm  — DERIVADO
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "S", gender: "Mujer",
    width: 501.03, height: 691.80,         // Playera: 50.103cm × 69.18cm
    shortsWidth: 669.72, shortsHeight: 485.89, // Shorts: 66.972cm × 48.589cm
    sleeveWidth: 382.82, sleeveHeight: 225.83, // Manga:  38.282cm × 22.583cm
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "M", gender: "Mujer",
    width: 526.08, height: 726.39,         // Playera: 52.608cm × 72.639cm
    shortsWidth: 706.93, shortsHeight: 512.88, // Shorts: 70.693cm × 51.288cm
    sleeveWidth: 401.96, sleeveHeight: 237.12, // Manga:  40.196cm × 23.712cm
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "L", gender: "Mujer",
    width: 551.13, height: 760.98,         // Playera: 55.113cm × 76.098cm
    shortsWidth: 744.14, shortsHeight: 539.88, // Shorts: 74.414cm × 53.988cm
    sleeveWidth: 421.10, sleeveHeight: 248.41, // Manga:  42.11cm  × 24.841cm
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "XL", gender: "Mujer",
    width: 576.18, height: 795.56,         // Playera: 57.618cm × 79.556cm
    shortsWidth: 781.34, shortsHeight: 566.87, // Shorts: 78.134cm × 56.687cm
    sleeveWidth: 440.24, sleeveHeight: 259.70, // Manga:  44.024cm × 25.97cm
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "XXL", gender: "Mujer",
    width: 601.23, height: 830.15,         // Playera: 60.123cm × 83.015cm — DERIVADO
    shortsWidth: 812.59, shortsHeight: 589.54, // Shorts: 81.259cm × 58.954cm — DERIVADO
    sleeveWidth: 459.38, sleeveHeight: 270.99, // Manga:  45.938cm × 27.099cm — DERIVADO
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "3XL", gender: "Mujer",
    width: 626.28, height: 864.73,         // Playera: 62.628cm × 86.473cm — DERIVADO
    shortsWidth: 845.10, shortsHeight: 613.12, // Shorts: 84.51cm  × 61.312cm — DERIVADO
    sleeveWidth: 478.52, sleeveHeight: 282.28, // Manga:  47.852cm × 28.228cm — DERIVADO
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
  {
    size: "4XL", gender: "Mujer",
    width: 651.33, height: 899.32,         // Playera: 65.133cm × 89.932cm — DERIVADO
    shortsWidth: 877.60, shortsHeight: 636.71, // Shorts: 87.76cm  × 63.671cm — DERIVADO
    sleeveWidth: 497.66, sleeveHeight: 293.57, // Manga:  49.766cm × 29.357cm — DERIVADO
    collarWidth: COLLAR_W, collarHeight: COLLAR_H,
  },
];

// Combinar todas las configuraciones
const DEFAULT_SIZE_CONFIGS: SizeConfig[] = [
  ...SIZE_CONFIGS_HOMBRE,
  ...SIZE_CONFIGS_MUJER,
];

export const useDesignerStore = create<DesignerState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        canvasConfig: DEFAULT_CANVAS_CONFIG,
        currentPage: 0,
        pages: [[]], // Iniciar con una página vacía
        elements: [], // Computed property basado en currentPage
        selectedElementId: null,
        sizeConfigs: DEFAULT_SIZE_CONFIGS,
        uniformSizesConfig: {}, // Configuración de imágenes ORIGINALES por talla
        uniformSizesConfigCompressed: {}, // Configuración de imágenes COMPRIMIDAS por talla
        uniformTemplate: null,
        uniformTemplateCompressed: null,
        uniformTemplatePdfBytes: null,
        uniformDesignConfig: null,
        history: [],
        historyIndex: -1,
        currentProject: null,
        showGrid: true,
        zoom: 1,
        isCanvasHidden: false,
        isExporting: false,

        // Fuentes del usuario
        userFonts: [],

        // Bulk Image Upload initial state
        bulkImageUpload: {

          jerseyFronts: [],
          jerseyBacks: [],
          shortsRights: [],
          shortsLefts: [],
        },

        // Canvas configuration
        setCanvasConfig: config =>
          set(state => ({
            canvasConfig: { ...state.canvasConfig, ...config },
          })),

        // Multi-page management
        setCurrentPage: (page: number) =>
          set(state => {
            const validPage = Math.max(0, Math.min(page, state.pages.length - 1));
            return {
              currentPage: validPage,
              elements: state.pages[validPage] || [],
              selectedElementId: null, // Deseleccionar al cambiar de página
            };
          }),

        addPage: () =>
          set(state => ({
            pages: [...state.pages, []],
          })),

        deletePage: (pageIndex: number) =>
          set(state => {
            if (state.pages.length <= 1) return state; // No eliminar la última página
            const newPages = state.pages.filter((_, i) => i !== pageIndex);
            const newCurrentPage = Math.min(state.currentPage, newPages.length - 1);
            return {
              pages: newPages,
              currentPage: newCurrentPage,
              elements: newPages[newCurrentPage] || [],
            };
          }),

        getTotalPages: () => get().pages.length,

        // Obtener altura ajustada para cada página
        // La altura máxima es state.canvasConfig.height (usa configuración actual, no el default)
        // TODAS las páginas se recortan al tamaño exacto de sus elementos (sin espacio en blanco)
        getPageHeight: (pageIndex: number) => {
          const state = get();
          const maxHeight = state.canvasConfig.height; // USA LA CONFIGURACIÓN ACTUAL, no DEFAULT

          // Obtener elementos de la página
          const pageElements = state.pages[pageIndex] || [];
          if (pageElements.length === 0) {
            return maxHeight; // Si está vacía, mantener altura máxima
          }

          // Encontrar el punto Y más bajo (elemento más abajo en la página)
          let maxY = 0;
          for (const element of pageElements) {
            const elementBottom = element.position.y + element.dimensions.height;
            if (elementBottom > maxY) {
              maxY = elementBottom;
            }
          }

          // Convertir de píxeles a cm (usa pixelsPerCm actual, no el default)
          const heightInCm = maxY / state.canvasConfig.pixelsPerCm;

          // Retornar la altura real usada (sin margen extra)
          // Si es mayor que maxHeight, usar maxHeight
          return Math.min(heightInCm, maxHeight);
        },

        // Element management
        addElement: (element, pageIndex) =>
          set(state => {
            const targetPage = pageIndex !== undefined ? pageIndex : state.currentPage;
            const newPages = [...state.pages];

            // Asegurar que la página existe
            while (newPages.length <= targetPage) {
              newPages.push([]);
            }

            newPages[targetPage] = [...newPages[targetPage], element];

            return {
              pages: newPages,
              elements: targetPage === state.currentPage ? newPages[targetPage] : state.elements,
            };
          }),

        // Agrega múltiples elementos distribuidos en páginas en un solo set() → un solo re-render.
        // pageElements: Map<pageIndex, elementos de esa página>
        addElementsBatch: (pageElements) =>
          set(state => {
            const newPages = [...state.pages];

            pageElements.forEach((els, pageIndex) => {
              while (newPages.length <= pageIndex) newPages.push([]);
              newPages[pageIndex] = [...newPages[pageIndex], ...els];
            });

            return {
              pages: newPages,
              elements: newPages[state.currentPage] ?? [],
            };
          }),

        updateElement: (id, updates) =>
          set(state => {
            const newPages = [...state.pages];
            newPages[state.currentPage] = state.elements.map(el =>
              el.id === id ? ({ ...el, ...updates } as CanvasElement) : el
            );
            return {
              pages: newPages,
              elements: newPages[state.currentPage],
            };
          }),

        deleteElement: id =>
          set(state => {
            const newPages = [...state.pages];
            newPages[state.currentPage] = state.elements.filter(el => el.id !== id);
            return {
              pages: newPages,
              elements: newPages[state.currentPage],
              selectedElementId:
                state.selectedElementId === id ? null : state.selectedElementId,
            };
          }),

        selectElement: id =>
          set(() => ({
            selectedElementId: id,
          })),

        duplicateElement: id =>
          set(state => {
            const element = state.elements.find(el => el.id === id);
            if (!element) return state;

            // Encontrar una posición válida para el elemento duplicado
            // Preferimos una posición cerca del original (offset de 20px)
            const preferredPosition = {
              x: element.position.x + 20,
              y: element.position.y + 20,
            };

            const validPosition = findValidPosition(
              element.dimensions,
              state.elements,
              state.canvasConfig,
              preferredPosition
            );

            const newElement: CanvasElement = {
              ...element,
              id: `${element.type}-${Date.now()}`,
              position: validPosition,
            };

            const newPages = [...state.pages];
            newPages[state.currentPage] = [...state.elements, newElement];

            return {
              pages: newPages,
              elements: newPages[state.currentPage],
              selectedElementId: newElement.id,
            };
          }),

        bringToFront: id =>
          set(state => {
            const maxZIndex = Math.max(...state.elements.map(el => el.zIndex));
            const newPages = [...state.pages];
            newPages[state.currentPage] = state.elements.map(el =>
              el.id === id ? { ...el, zIndex: maxZIndex + 1 } : el
            );
            return {
              pages: newPages,
              elements: newPages[state.currentPage],
            };
          }),

        sendToBack: id =>
          set(state => {
            const minZIndex = Math.min(...state.elements.map(el => el.zIndex));
            const newPages = [...state.pages];
            newPages[state.currentPage] = state.elements.map(el =>
              el.id === id ? { ...el, zIndex: minZIndex - 1 } : el
            );
            return {
              pages: newPages,
              elements: newPages[state.currentPage],
            };
          }),

        // Size configurations
        updateSizeConfig: (size, config) =>
          set(state => ({
            sizeConfigs: state.sizeConfigs.map(sc =>
              sc.size === size ? { ...sc, ...config } : sc
            ),
          })),

        // History management
        saveHistory: () =>
          set(state => {
            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push({
              elements: [...state.elements],
              timestamp: Date.now(),
            });

            // Limit history to 50 states
            if (newHistory.length > 50) {
              newHistory.shift();
            }

            return {
              history: newHistory,
              historyIndex: newHistory.length - 1,
            };
          }),

        undo: () =>
          set(state => {
            if (state.historyIndex <= 0) return state;

            const newIndex = state.historyIndex - 1;
            return {
              elements: [...state.history[newIndex].elements],
              historyIndex: newIndex,
            };
          }),

        redo: () =>
          set(state => {
            if (state.historyIndex >= state.history.length - 1) return state;

            const newIndex = state.historyIndex + 1;
            return {
              elements: [...state.history[newIndex].elements],
              historyIndex: newIndex,
            };
          }),

        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().history.length - 1,

        // Project management
        saveProject: name =>
          set(state => {
            const project: Project = {
              id: `project-${Date.now()}`,
              name,
              canvasConfig: state.canvasConfig,
              elements: state.elements,
              sizeConfigs: state.sizeConfigs,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            localStorage.setItem(project.id, JSON.stringify(project));

            return { currentProject: project };
          }),

        loadProject: project =>
          set(() => ({
            canvasConfig: project.canvasConfig,
            elements: project.elements,
            sizeConfigs: project.sizeConfigs,
            currentProject: project,
            selectedElementId: null,
          })),

        clearProject: () =>
          set(() => ({
            elements: [],
            selectedElementId: null,
            currentProject: null,
            history: [],
            historyIndex: -1,
          })),

        // UI State
        toggleGrid: () =>
          set(state => ({
            showGrid: !state.showGrid,
          })),

        setZoom: zoom =>
          set(() => ({
            zoom: Math.max(0.1, Math.min(3, zoom)),
          })),

        setCanvasHidden: (hidden: boolean) =>
          set(() => ({
            isCanvasHidden: hidden,
          })),

        setIsExporting: (isExporting: boolean) =>
          set(() => ({
            isExporting,
          })),

        // Uniform sizes configuration
        setUniformSizeImages: (sizeKey: string, images: Partial<SizeImages>) =>
          set(state => ({
            uniformSizesConfig: {
              ...state.uniformSizesConfig,
              [sizeKey]: {
                ...state.uniformSizesConfig[sizeKey],
                ...images,
              },
            },
          })),

        getUniformSizeImages: (sizeKey: string) => {
          return get().uniformSizesConfig[sizeKey];
        },

        getUniformSizeImagesCompressed: (sizeKey: string) => {
          return get().uniformSizesConfigCompressed[sizeKey];
        },

        isSizeComplete: (sizeKey: string) => {
          const images = get().uniformSizesConfig[sizeKey];
          return !!(images?.jerseyFront && images?.jerseyBack && images?.shortsLeft && images?.shortsRight);
        },

        clearUniformSizesConfig: () =>
          set(() => ({
            uniformSizesConfig: {},
            uniformSizesConfigCompressed: {},
          })),

        // Uniform template — plantilla única para todas las tallas
        setUniformTemplate: (images) =>
          set(state => ({
            uniformTemplate: {
              ...(state.uniformTemplate ?? {}),
              ...images,
            },
          })),

        isTemplateComplete: () => {
          const { uniformTemplate } = get();
          const hasJerseys = !!(uniformTemplate?.jerseyFront && uniformTemplate?.jerseyBack);
          const hasShorts  = !!(uniformTemplate?.shortsLeft  && uniformTemplate?.shortsRight);
          return hasJerseys || hasShorts;
        },

        clearUniformTemplate: () =>
          set(() => ({
            uniformTemplate: null,
            uniformTemplateCompressed: null,
            uniformTemplatePdfBytes: null,
            uniformDesignConfig: null,
          })),

        setUniformTemplatePdfBytes: (piece, bytes) =>
          set(state => {
            const current = { ...(state.uniformTemplatePdfBytes ?? {}) };
            if (bytes === null) {
              delete current[piece];
              return { uniformTemplatePdfBytes: Object.keys(current).length > 0 ? current : null };
            }
            return { uniformTemplatePdfBytes: { ...current, [piece]: bytes } };
          }),

        clearUniformTemplatePdfBytes: () =>
          set(() => ({ uniformTemplatePdfBytes: null })),

        setUniformDesignConfig: (config) =>
          set(() => ({ uniformDesignConfig: config })),

        // Helper para obtener configuración de talla por género
        getSizeConfig: (size: Size, gender: Gender) => {
          const configs = get().sizeConfigs;
          return configs.find(config => config.size === size && config.gender === gender);
        },

        // Bulk Image Upload functions
        setBulkImages: (type, files) =>
          set(state => ({
            bulkImageUpload: {
              ...state.bulkImageUpload,
              [type]: Array.from(files),
            },
          })),

        processBulkImages: async () => {
          const { bulkImageUpload, addElement, canvasConfig, pages, setCanvasHidden } = get();
          const { jerseyFronts, jerseyBacks, shortsRights, shortsLefts } = bulkImageUpload;

          // Validación
          if (jerseyFronts.length !== jerseyBacks.length) {
            alert(`Error: El número de frentes (${jerseyFronts.length}) debe ser igual al número de traseras (${jerseyBacks.length})`);
            return;
          }

          if (shortsRights.length !== shortsLefts.length) {
            alert(`Error: El número de shorts derechos (${shortsRights.length}) debe ser igual al número de izquierdos (${shortsLefts.length})`);
            return;
          }

          // Ocultar canvas mientras procesamos
          setCanvasHidden(true);

          try {
            const allElements: CanvasElement[] = [];
            const BATCH_SIZE = 10;

            // Función auxiliar para cargar dimensiones de una imagen
            const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
              return new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(file);

                img.onload = () => {
                  resolve({ width: img.width, height: img.height });
                  URL.revokeObjectURL(url);
                };

                img.onerror = () => {
                  URL.revokeObjectURL(url);
                  reject(new Error(`No se pudo cargar la imagen: ${file.name}`));
                };

                img.src = url;
              });
            };

            // Función auxiliar para crear un elemento uniform
            const createUniformElement = async (
              file: File,
              part: 'jersey' | 'shorts',
              side: 'front' | 'back' | 'right' | 'left',
              index: number
            ) => {
              const dimensions = await getImageDimensions(file);
              const imageUrl = URL.createObjectURL(file);

              return {
                id: `${part}-${side}-${index}-${Date.now()}`,
                type: 'uniform' as const,
                part,
                side,
                size: 'M' as Size, // Talla por defecto
                position: { x: 0, y: 0 }, // Se calculará con bin-packing
                dimensions: {
                  width: dimensions.width / canvasConfig.pixelsPerCm,
                  height: dimensions.height / canvasConfig.pixelsPerCm,
                },
                rotation: 0,
                zIndex: allElements.length,
                locked: false,
                visible: true,
                baseColor: '#ffffff',
                imageUrl,
                originalImageUrl: imageUrl, // Misma URL para original
                source: 'manual' as const, // Carga masiva de imágenes manuales
                isSvg: file.type === 'image/svg+xml',
              };
            };

            // Procesar playeras en lotes
            for (let i = 0; i < jerseyFronts.length; i += BATCH_SIZE) {
              const batch = Math.min(BATCH_SIZE, jerseyFronts.length - i);

              for (let j = 0; j < batch; j++) {
                const idx = i + j;

                // Crear frente
                const frontElement = await createUniformElement(
                  jerseyFronts[idx],
                  'jersey',
                  'front',
                  idx
                );
                allElements.push(frontElement);

                // Crear trasera
                const backElement = await createUniformElement(
                  jerseyBacks[idx],
                  'jersey',
                  'back',
                  idx
                );
                allElements.push(backElement);
              }

              // Pausa entre lotes
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Procesar shorts en lotes
            for (let i = 0; i < shortsRights.length; i += BATCH_SIZE) {
              const batch = Math.min(BATCH_SIZE, shortsRights.length - i);

              for (let j = 0; j < batch; j++) {
                const idx = i + j;

                // Crear derecho
                const rightElement = await createUniformElement(
                  shortsRights[idx],
                  'shorts',
                  'right',
                  idx
                );
                allElements.push(rightElement);

                // Crear izquierdo
                const leftElement = await createUniformElement(
                  shortsLefts[idx],
                  'shorts',
                  'left',
                  idx
                );
                allElements.push(leftElement);
              }

              // Pausa entre lotes
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Agregar todos los elementos al canvas
            // Primero, aplicar bin-packing para calcular posiciones
            const { optimizeLayoutAdvanced } = await import('../utils/binPacking');

            const result = optimizeLayoutAdvanced(
              allElements,
              canvasConfig,
              {
                elementGap: 5,
                canvasMargin: 0,
                canvasMarginV: 0,
                allowRotation: false,
                sortStrategy: 'area',
                heuristic: 'BSSF',
              }
            );

            // Crear páginas adicionales si es necesario
            const currentPages = pages.length;
            for (let i = currentPages; i < result.pagesUsed; i++) {
              get().addPage();
            }

            // Agregar elementos a sus respectivas páginas
            result.pages.forEach((pageElements, pageIndex) => {
              pageElements.forEach(element => {
                addElement(element, pageIndex);
              });
            });

            // Limpiar estado temporal
            get().clearBulkImages();

            // Mostrar canvas
            setCanvasHidden(false);

            alert(`¡Carga completada!\n\nElementos procesados: ${allElements.length}\nPáginas utilizadas: ${result.pagesUsed}\nEficiencia: ${result.efficiency.toFixed(1)}%`);

          } catch (error) {
            console.error('Error al procesar imágenes:', error);
            alert('Error al procesar las imágenes. Por favor, intenta de nuevo.');
            setCanvasHidden(false);
          }
        },

        clearBulkImages: () =>
          set(() => ({
            bulkImageUpload: {
              jerseyFronts: [],
              jerseyBacks: [],
              shortsRights: [],
              shortsLefts: [],
            },
          })),

        // Fuentes del usuario
        addUserFont: (font: UserFont) =>
          set(state => ({
            userFonts: [...state.userFonts.filter(f => f.name !== font.name), font],
          })),

        removeUserFont: (name: string) =>
          set(state => ({
            userFonts: state.userFonts.filter(f => f.name !== name),
          })),
      }),
      {
        name: "designer-storage-v8", // uniformSizesConfig NO se persiste (solo en memoria)
        partialize: state => ({
          canvasConfig: state.canvasConfig,
          // sizeConfigs: NO se persiste — es una tabla estática del código. Persistirla
          // congelaba las medidas: al agregar tallas nuevas los usuarios seguían
          // rehidratando la tabla vieja desde localStorage.
          // uniformSizesConfig: NO se guarda en localStorage para evitar problemas de espacio
          showGrid: state.showGrid,
          uniformDesignConfig: state.uniformDesignConfig,
          userFonts: state.userFonts,
        }),
        // Descarta el sizeConfigs que quedó guardado por versiones anteriores, sin
        // tirar el resto del estado (fuentes del usuario, diseño, canvas).
        merge: (persisted, current) => {
          const resto = { ...(persisted ?? {}) } as Partial<DesignerState>;
          delete resto.sizeConfigs;
          return { ...current, ...resto };
        },
      }
    )
  )
);
