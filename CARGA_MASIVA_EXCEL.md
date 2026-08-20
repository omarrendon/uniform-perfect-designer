# Carga Masiva de Uniformes desde Excel

## Descripción

Permite crear múltiples juegos de uniformes (jersey frente + espalda + short izquierdo + derecho) automáticamente desde un archivo Excel. Por cada fila válida se genera el juego completo escalado a la talla indicada.

---

## Antes de usar: cargar la plantilla

El sistema usa **una sola plantilla de 4 imágenes** que se escala a todas las tallas automáticamente. Debes cargarla antes de procesar cualquier Excel.

### Paso 1 — Abrir el modal de configuración
En la barra de herramientas, haz clic en el botón de configuración de uniforme (ícono de ajustes).

### Paso 2 — Subir las 4 imágenes del uniforme

| Imagen | Descripción |
|---|---|
| **Playera Delantera** | Vista frontal de la camiseta |
| **Playera Trasera** | Vista trasera de la camiseta |
| **Short Izquierdo** | Short vista izquierda |
| **Short Derecho** | Short vista derecha |

Hasta que las 4 estén cargadas, el botón "Procesar" estará deshabilitado.

> Las imágenes se guardan en memoria durante la sesión. Al refrescar la página se deben cargar de nuevo.

---

## Formato del archivo Excel

### Columnas requeridas

| Columna | Tipo | Descripción |
|---|---|---|
| `nombre` | Texto | **Obligatorio.** Nombre del jugador (aparece en espalda del jersey) |
| `talla` | Texto | **Obligatorio.** Talla del uniforme |

### Valores válidos para `talla`

Acepta formato español o inglés, en mayúsculas o minúsculas:

| Español | Inglés equivalente | Otros alias aceptados |
|---|---|---|
| `XCH` | `XS` | — |
| `CH` | `S` | — |
| `M` | `M` | — |
| `G` | `L` | — |
| `XG` | `XL` | — |
| `2XG` | `XXL` | `2XL`, `XXG` |
| `3XG` | `3XL` | `XXXL` |
| `4XG` | `4XL` | — |

Si el valor no corresponde a ninguna talla conocida, la fila usa la configuración
por defecto (M Hombre) en lugar de fallar.

### Columnas opcionales

| Columna | Tipo | Descripción | Default |
|---|---|---|---|
| `genero` | Texto | `Hombre`, `Mujer`, `M`, `F`, `Femenino` | `Hombre` |
| `numero` | Número | Número del jugador (frente, espalda y short) | Sin número |
| `fuente` | Texto | Nombre de Google Font para el texto | `Arial` |
| `color` | Texto (hex) | Color de todos los textos del uniforme. Ej: `#FF0000` | `#000000` |
| `tamano_numero_frente` | Número ≥8 | Tamaño de fuente del número en el pecho | Predefinido por talla |
| `tamano_numero_espalda` | Número ≥8 | Tamaño de fuente del número grande trasero | Predefinido por talla |
| `tamano_nombre_espalda` | Número ≥8 | Tamaño de fuente del nombre en la espalda | Predefinido por talla |
| `tamano_numero_short` | Número ≥8 | **Activa y define** el número en el short | Sin número en short |

> **Nota sobre `tamano_numero_short`:** Si el campo existe y tiene un valor, se dibuja el número en el short. Si está vacío o ausente, el short no lleva número.

---

## Cómo funciona el escalado

La plantilla se carga una sola vez y Konva escala la imagen a las dimensiones exactas de cada talla. Esto es posible porque todas las tallas mantienen la misma proporción:

- **Playera**: ratio 0.7206 en Hombre, 0.7242 en Mujer (constante en las 8 tallas)
- **Shorts**: ratio 1.3755 en Hombre, 1.3784 en Mujer (constante en las 8 tallas)

Las dimensiones reales por talla (en píxeles, `pixelsPerCm = 10`). Fuente de verdad:
`SIZE_CONFIGS_HOMBRE` / `SIZE_CONFIGS_MUJER` en `src/store/desingerStore.ts`.

**Hombre**

| Talla | Playera (w×h) | Shorts (w×h) | Manga (w×h) |
|---|---|---|---|
| XCH / XS | 513.61×712.73 | 690.00×501.63 | 412.54×240.25 |
| CH / S | 535.75×743.44 | 720.50×523.80 | 430.32×250.60 |
| M | 559.04×775.77 | 751.83×546.58 | 449.03×261.49 |
| G / L | 582.33×808.09 | 783.15×569.35 | 467.74×272.39 |
| XG / XL | 605.63×840.41 | 814.48×592.13 | 486.45×283.29 |
| 2XG / XXL | 628.92×872.74 | 847.06×615.81 | 505.16×294.19 |
| 3XG / 3XL | 652.21×905.06 | 880.94×640.44 | 523.87×305.08 |
| 4XG / 4XL | 675.51×937.38 | 914.82×665.08 | 542.58×315.98 |

**Mujer**

| Talla | Playera (w×h) | Shorts (w×h) | Manga (w×h) |
|---|---|---|---|
| XCH / XS | 480.33×663.22 | 641.37×465.32 | 367.00×216.50 |
| CH / S | 501.03×691.80 | 669.72×485.89 | 382.82×225.83 |
| M | 526.08×726.39 | 706.93×512.88 | 401.96×237.12 |
| G / L | 551.13×760.98 | 744.14×539.88 | 421.10×248.41 |
| XG / XL | 576.18×795.56 | 781.34×566.87 | 440.24×259.70 |
| 2XG / XXL | 601.23×830.15 | 812.59×589.54 | 459.38×270.99 |
| 3XG / 3XL | 626.28×864.73 | 845.10×613.12 | 478.52×282.28 |
| 4XG / 4XL | 651.33×899.32 | 877.60×636.71 | 497.66×293.57 |

> ⚠️ **Medidas derivadas.** En Hombre, playera y short de XS/XXL/3XL/4XL vienen de
> documentos de patronaje (`MEDIDAS DE TALLAS DE CABALLERO.pdf` y
> `MEDIDAS TALLAS PARA CABALLERO SHORT FUTBOL.pdf`, ago 2026) y son exactos.
> Siguen derivados: la **manga** de Hombre en esas 4 tallas y **toda la columna de
> Mujer**. Validar con patronista antes de mandar a producción.

---

## Ejemplo de archivo Excel

```
| nombre      | talla | genero | numero | fuente     | color   | tamano_numero_frente | tamano_numero_espalda | tamano_nombre_espalda | tamano_numero_short |
|-------------|-------|--------|--------|------------|---------|----------------------|-----------------------|-----------------------|---------------------|
| García      | M     | Hombre | 10     | Bebas Neue | #FF0000 |                      |                       |                       | 30                  |
| López       | G     | Mujer  | 7      | Arial      | #0000FF | 24                   | 40                    | 16                    |                     |
| Martínez    | XG    | Hombre | 23     | Impact     | #000000 |                      |                       |                       | 25                  |
```

- **García**: número en rojo, Bebas Neue, con número en short (tam. 30), talla M Hombre
- **López**: número en azul, Arial, tamaños personalizados, **sin** número en short, talla G Mujer
- **Martínez**: texto negro, Impact, con número en short (tam. 25), talla XG Hombre

---

## Solución de problemas

### "Plantilla no configurada"
Las 4 imágenes del uniforme no están cargadas. Ve al modal de configuración y sube las imágenes faltantes antes de procesar.

### "El archivo Excel está vacío"
El archivo no tiene filas de datos (solo encabezado o completamente vacío).

### "El archivo debe contener una columna llamada 'nombre'"
El encabezado `nombre` no se encontró. Los nombres de columna se normalizan a minúsculas automáticamente, pero la columna debe existir.

### "No hay espacio suficiente"
El canvas está lleno. Opciones:
1. Aumentar el tamaño del canvas
2. Eliminar elementos existentes
3. Procesar menos uniformes por lote

---

## Ubicación de archivos

| Archivo | Contenido |
|---|---|
| `src/utils/excelReader.ts` | Lectura y normalización del archivo Excel |
| `src/utils/excelProcessor.ts` | Procesamiento completo con layout y texto |
| `src/modules/Toolbar.tsx` | Flujo de carga desde pestaña "Agregar" |
| `src/components/UniformSizesModal.tsx` | Modal de plantilla y upload del Excel |
| `src/store/desingerStore.ts` | `uniformTemplate`, `uniformTemplateCompressed` |
