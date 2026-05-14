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

| Español | Inglés equivalente |
|---|---|
| `XCH` | `XS` |
| `CH` | `S` |
| `M` | `M` |
| `G` | `L` |
| `XG` | `XL` |

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

- **Playera**: ratio ~0.718 (todos los tamaños)  
- **Shorts**: ratio ~1.433 (todos los tamaños)

Las dimensiones reales por talla (en píxeles, `pixelsPerCm = 10`):

| Talla | Playera (w×h) | Shorts (w×h) |
|---|---|---|
| XCH / XS | 513×714 | 780×544 |
| CH / S | 540×752 | 821×572 |
| M | 568×791 | 863×602 |
| G / L | 599×834 | 906×632 |
| XG / XL | 629×875 | 952×664 |

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
