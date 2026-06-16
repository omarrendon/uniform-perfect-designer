# Uniform Perfect Designer

Aplicación web para diseñar y exportar uniformes deportivos de manera masiva. Permite diseño manual en canvas, carga masiva desde Excel y exportación PDF/PNG profesional con gestión de color CMYK para impresión.

**Producción:** [uniform-perfect-designer-t82k-omarrendons-projects.vercel.app](https://uniform-perfect-designer-t82k-omarrendons-projects.vercel.app)

---

## Tabla de contenidos

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Instalación local](#instalación-local)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Arquitectura de estado](#arquitectura-de-estado)
- [Sistema de imágenes](#sistema-de-imágenes)
- [Sistema de tallas](#sistema-de-tallas)
- [Exportación PDF](#exportación-pdf)
- [Carga masiva desde Excel](#carga-masiva-desde-excel)
- [Atajos de teclado](#atajos-de-teclado)
- [Deploy en Vercel](#deploy-en-vercel)

---

## Funcionalidades

- **Canvas interactivo** — diseño de uniformes con drag & drop, redimensionado y rotación
- **Carga masiva desde Excel** — genera automáticamente páginas con uniformes por talla y género
- **Tipografía deportiva** — más de 70 Google Fonts + fuentes personalizadas vía upload
- **Exportación PDF** — con conversión RGB → CMYK, perfiles ICC y marcas de corte opcionales
- **Exportación PNG** — composición directa de alta calidad
- **Multi-página** — canvas con paginación para diseños grandes
- **Historial** — undo/redo ilimitado
- **Auto-save** — guardado automático en localStorage cada 30 segundos
- **Modo dual de exportación** — local en el browser o delegado a servidor Node.js (Railway)

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 18 + TypeScript 5 |
| Build | Vite 7 + SWC |
| Estado global | Zustand 4 (devtools + persist) |
| Canvas | Konva 9 + React Konva |
| Estilos | Tailwind CSS + clsx + tailwind-merge |
| Formularios | React Hook Form + Zod |
| PDF | pdf-lib 1.17 |
| Excel | XLSX 0.18 |
| Workers | Web Workers (compresión de imágenes + CMYK) |
| Deploy | Vercel |

---

## Estructura del proyecto

```
src/
│
├── pages/
│   └── DesingerPage.tsx             # Página principal (único punto de entrada)
│
├── modules/                         # Componentes complejos específicos del diseñador
│   ├── Canvas.tsx                   # Stage de Konva, gestión de elementos y eventos
│   ├── Header.tsx                   # Barra superior: exportar, guardar, agregar elementos
│   ├── Toolbar.tsx                  # Panel lateral: propiedades del elemento seleccionado
│   ├── UniformElement.tsx           # Elemento de uniforme (imagen) en el canvas
│   └── TextElement.tsx              # Elemento de texto en el canvas
│
├── components/                      # UI reutilizable sin lógica de negocio
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Pagination.tsx
│   ├── BulkLoadingOverlay.tsx       # Overlay de progreso durante carga masiva
│   ├── ExportLoadingOverlay.tsx     # Overlay de progreso durante exportación
│   ├── LoadingModal.tsx
│   ├── ErrorModal.tsx
│   ├── FontUploadButton.tsx         # Upload de fuentes personalizadas
│   ├── UniformSizesModal.tsx        # Modal de configuración de plantillas por talla
│   └── UniformDesignPreviewModal.tsx
│
├── store/
│   └── desingerStore.ts             # Estado global Zustand — única fuente de verdad
│
├── types/
│   └── index.ts                     # Todos los tipos TypeScript del proyecto
│
├── hooks/
│   ├── useHistory.tsx               # Undo/redo sobre el estado del canvas
│   ├── useAutoSave.tsx              # Auto-save en localStorage cada 30 segundos
│   └── useKeyboardShortcuts.tsx     # Atajos de teclado globales
│
├── utils/
│   ├── export.ts                    # Pipeline de exportación PDF y PNG
│   ├── excelProcessor.ts            # Procesamiento de Excel para carga masiva
│   ├── excelReader.ts               # Parseo del archivo .xlsx
│   ├── binPacking.ts                # Algoritmo MaxRects para layout automático
│   ├── canvas.ts                    # Utilidades de canvas: colisiones, layout
│   ├── colorConversion.ts           # Conversión RGB → CMYK en el browser
│   ├── cmykConfig.ts                # Configuración global del perfil CMYK
│   ├── iccProfiles.ts               # Definición de perfiles ICC (FOGRA39, SWOP, etc.)
│   ├── fontLoader.ts                # Carga dinámica de Google Fonts
│   ├── imageCompressor.ts           # Compresión de imágenes para el canvas
│   ├── imageCompressorForCanvas.ts  # Compresión optimizada para visualización
│   ├── imageCache.ts                # Cache de imágenes para evitar reprocesamiento
│   ├── svgCache.ts                  # Cache de SVGs (data URL y blob URL)
│   ├── svgParser.ts                 # Parseo y manipulación de SVGs
│   ├── svgBitmap.ts                 # Rasterización de SVGs a bitmap
│   ├── svgToPdf.ts                  # Conversión SVG → PDF con pdf-lib
│   ├── preflight.ts                 # Validación del diseño antes de exportar
│   ├── printMarks.ts                # Marcas de corte y registro para impresión
│   ├── designMapper.ts              # Mapeo de diseño entre formatos
│   ├── workerPool.ts                # Pool de Web Workers para procesamiento paralelo
│   └── cn.ts                        # Utilidad para combinar clases Tailwind
│
└── workers/
    ├── imageCompressor.worker.ts    # Worker: compresión de imágenes en background
    └── cmykWorker.ts                # Worker: conversión CMYK en background
```

---

## Instalación local

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd uniform-perfect-designer
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores (ver sección [Variables de entorno](#variables-de-entorno)).

### 3. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en el browser.

---

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `VITE_PDF_SERVER_URL` | No | URL del servidor Node.js para exportación PDF (ej. `https://tu-servicio.up.railway.app`). Si está vacía, la exportación se hace localmente en el browser. |

> Las variables `VITE_*` se embeben en el bundle en tiempo de build. Cambiarlas en Vercel requiere un nuevo deploy para que tengan efecto.

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR en `localhost:5173` |
| `npm run build` | TypeScript check + build de producción en `dist/` |
| `npm run lint` | ESLint con reglas TypeScript |
| `npm run preview` | Preview del build de producción |

---

## Arquitectura de estado

El estado global vive en `src/store/desingerStore.ts` (Zustand) y es la única fuente de verdad.

```
desingerStore
├── pages: CanvasElement[][]          # Elementos por página
├── currentPage: number               # Página activa
├── canvasConfig: CanvasConfig        # Dimensiones y escala del canvas
├── uniformSizesConfig                # Imágenes originales por talla (para PDF)
├── uniformSizesConfigCompressed      # Imágenes comprimidas por talla (para canvas)
├── uniformTemplate                   # Plantilla única de 4 imágenes (carga masiva)
├── uniformTemplateCompressed         # Versión comprimida de la plantilla
├── sizeConfigs: SizeConfig[]         # Dimensiones físicas por talla y género
└── history                           # Array lineal para undo/redo
```

**Reglas:**
- Los componentes acceden al store directamente — no se pasa estado global por props
- `uniformTemplate` y `uniformSizesConfig` **no se persisten** en localStorage — se recargan en cada sesión
- El middleware `persist` guarda el resto del estado en localStorage automáticamente

### Tipos principales (`src/types/index.ts`)

| Tipo | Descripción |
|---|---|
| `CanvasElement` | Unión discriminada: `UniformTemplate \| TextElement \| ImageElement` |
| `UniformTemplate` | Elemento de imagen de uniforme en el canvas |
| `TextElement` | Elemento de texto en el canvas |
| `Size` | `'XS' \| 'S' \| 'M' \| 'L' \| 'XL'` |
| `UniformPart` | `'jersey' \| 'shorts'` |
| `Gender` | `'Hombre' \| 'Mujer'` |
| `CanvasConfig` | `{ width, height, pixelsPerCm }` |
| `SizeConfig` | Dimensiones físicas de una talla en píxeles |

---

## Sistema de imágenes

Las imágenes se almacenan en **dos versiones simultáneas** para equilibrar calidad y rendimiento:

| Versión | Campo en store | Uso | Calidad |
|---|---|---|---|
| Original | `uniformTemplate` / `uniformSizesConfig` | Exportación PDF | 100% |
| Comprimida | `uniformTemplateCompressed` / `uniformSizesConfigCompressed` | Visualización en canvas | 40% JPEG, 50% escala |

> Nunca usar la versión comprimida para exportar. Nunca renderizar la original en el canvas sin comprimir.

Todos los uniformes usan **imágenes SVG**. Los SVGs se pre-rasterizarán a PNG en el browser antes de enviarse al servidor PDF para evitar crashes nativos en Sharp/librsvg.

---

## Sistema de tallas

Las dimensiones están en píxeles con `pixelsPerCm = 10` (1px = 1mm).

### Hombre

| Talla | Jersey (px) | Jersey (cm) | Shorts (px) | Shorts (cm) |
|---|---|---|---|---|
| S | 535.75 × 743.44 | 53.6 × 74.3 | 720.50 × 523.80 | 72.1 × 52.4 |
| M | 559.04 × 775.77 | 55.9 × 77.6 | 751.83 × 546.58 | 75.2 × 54.7 |
| L | 582.33 × 808.09 | 58.2 × 80.8 | 783.15 × 569.35 | 78.3 × 56.9 |
| XL | 605.63 × 840.41 | 60.6 × 84.0 | 814.48 × 592.13 | 81.4 × 59.2 |

### Mujer

| Talla | Jersey (px) | Jersey (cm) | Shorts (px) | Shorts (cm) |
|---|---|---|---|---|
| S | 501.03 × 691.80 | 50.1 × 69.2 | 669.72 × 485.89 | 66.9 × 48.6 |
| M | 526.08 × 726.39 | 52.6 × 72.6 | 706.93 × 512.88 | 70.7 × 51.3 |
| L | 551.13 × 760.98 | 55.1 × 76.1 | 744.14 × 539.88 | 74.4 × 53.9 |
| XL | 576.18 × 795.56 | 57.6 × 79.6 | 781.34 × 566.87 | 78.1 × 56.7 |

Fuente: `TABLA-TALLAS.xlsx` (jun 2026).

---

## Exportación PDF

### Modo local (sin servidor)

Pipeline ejecutado íntegramente en el browser:

```
preflight.ts          — valida el diseño (elementos vacíos, fuentes faltantes, etc.)
      ↓
colorConversion.ts    — convierte RGB → CMYK con perfil ICC seleccionado
      ↓
cmykWorker.ts         — procesamiento CMYK en Web Worker (no bloquea la UI)
      ↓
pdf-lib               — genera páginas PDF con fuentes embebidas
      ↓
printMarks.ts         — añade marcas de corte, registro y barras de color (opcional)
      ↓
Descarga en el browser (client-side, sin servidor)
```

### Modo servidor (con `VITE_PDF_SERVER_URL`)

El procesamiento pesado (Sharp + CMYK) se delega al servidor Node.js:

```
export.ts — serializa el diseño:
  · SVGs pre-rasterizados a PNG 2× con Canvas API (evita crashes en el servidor)
  · Textos renderizados a PNG con Canvas API
      ↓
POST /api/export-pdf  →  cotizador-bot (Railway)
      ↓
Servidor genera PDF por página en child processes aislados
      ↓
Respuesta con PDFs en base64 → descarga en el browser
```

### Perfiles CMYK disponibles

| Perfil | Estándar | Uso recomendado |
|---|---|---|
| `FOGRA39` | ISO 12647-2 | Impresión offset Europa — **default** |
| `FOGRA51` | ISO 12647-2:2013 | Papel sin recubrimiento Europa |
| `SWOP` | CGATS TR 001 | Impresión offset EEUU |
| `JapanColor2011` | Japan Color | Mercado japonés |
| `UncoatedFOGRA29` | FOGRA29 | Papel no estucado Europa |

### Sistema de coordenadas

| Sistema | Origen | Unidad |
|---|---|---|
| Canvas (Konva) | Arriba-izquierda | Píxeles |
| PDF (pdf-lib) | Abajo-izquierda | Puntos (1pt = 1/72") |

La transformación ocurre en `src/utils/export.ts`. La constante de conversión es `pixelsPerCm = 10`.

---

## Carga masiva desde Excel

Permite generar un diseño completo de múltiples tallas desde un archivo `.xlsx`.

### Flujo

```
Usuario sube .xlsx
      ↓
excelReader.ts        — parsea el archivo y extrae filas
      ↓
excelProcessor.ts     — valida que la plantilla esté completa (4 imágenes)
                      — comprime la plantilla una sola vez para el canvas
                      — crea par jersey + shorts por fila
                      — dimensiona por talla y género (no por imagen)
      ↓
binPacking.ts         — organiza el layout con algoritmo MaxRects (BL heuristic, largest-first)
      ↓
canvas.ts             — detecta colisiones con checkOverlap()
      ↓
Elementos añadidos al canvas por página
```

### Formato del Excel

| Columna | Valores aceptados |
|---|---|
| `talla` | `S`, `M`, `L`, `XL` |
| `genero` | `Hombre`, `Mujer` |
| `numero` | Número a imprimir en el uniforme (opcional) |
| `nombre` | Nombre del jugador (opcional) |

### Plantilla única de 4 imágenes

La carga masiva usa una sola plantilla de 4 imágenes que se escala a todas las tallas:

| Campo | Imagen |
|---|---|
| `jerseyFront` | Frente de playera |
| `jerseyBack` | Espalda de playera |
| `shortsLeft` | Short izquierdo |
| `shortsRight` | Short derecho (se muestra rotado 180°) |

Las proporciones entre tallas son prácticamente idénticas (~0.720 en jerseys Hombre), por lo que Konva escala automáticamente vía `width={element.dimensions.width}`.

---

## Atajos de teclado

Implementados en `src/hooks/useKeyboardShortcuts.tsx`. Se ignoran automáticamente cuando el foco está en un input.

| Atajo | Acción |
|---|---|
| `Delete` / `Backspace` | Eliminar elemento seleccionado |
| `Ctrl/Cmd + D` | Duplicar elemento seleccionado |
| `Ctrl/Cmd + G` | Toggle grid |
| `Ctrl/Cmd + S` | Guardar proyecto |
| `Escape` | Deseleccionar elemento |

---

## Deploy en Vercel

### Variables de entorno en Vercel

| Variable | Valor en producción |
|---|---|
| `VITE_PDF_SERVER_URL` | `https://tu-servicio.up.railway.app` |

> Después de agregar o modificar variables en Vercel, es necesario hacer **Redeploy** para que el nuevo build las incluya en el bundle.

### Proceso de deploy

```bash
# Build local para verificar antes de subir
npm run build

# Vercel despliega automáticamente al hacer push a main
git push origin main
```

Vercel detecta automáticamente que es un proyecto Vite y usa:
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`
