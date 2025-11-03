# Carga Masiva de Uniformes desde Excel

## 📋 Descripción

Esta funcionalidad permite crear múltiples "juegos" de uniformes (jersey + shorts) automáticamente desde un archivo Excel. Por cada fila en el Excel, se generará un jersey y un short completo.

## ✅ Características implementadas

- **Carga desde Excel**: Botón para cargar archivo `.xlsx` o `.xls`
- **Generación automática**: Por cada fila válida, se crea 1 jersey + 1 short
- **Validaciones completas**: Mantiene todas las validaciones existentes:
  - ✅ No encimado (detección de colisiones)
  - ✅ Respeto de márgenes (1cm)
  - ✅ Validación de espacio disponible
  - ✅ Uso de moldes reales
- **Mensajes informativos**: Alertas si no hay espacio suficiente

## 📄 Formato del archivo Excel

### Estructura requerida

El archivo Excel debe tener **al menos una columna** llamada `nombre`:

| nombre     |
|------------|
| Jugador 1  |
| Jugador 2  |
| Jugador 3  |
| ...        |

### Reglas:
- La primera fila debe contener el encabezado `nombre`
- Cada fila subsecuente representa un juego de uniforme
- Las filas vacías o sin nombre se omiten automáticamente
- Puede haber más columnas, pero solo `nombre` es obligatoria

## 🚀 Cómo usar

### Paso 1: Preparar el archivo Excel
1. Crea un archivo Excel (.xlsx o .xls)
2. En la primera columna, escribe `nombre` en la primera fila
3. Agrega los nombres en las filas siguientes

### Paso 2: Cargar en la aplicación
1. Abre la aplicación y ve a la pestaña **"Agregar"**
2. En la sección **"Carga Masiva"**, haz clic en **"Cargar desde Excel"**
3. Selecciona tu archivo Excel
4. Espera a que se procesen todos los uniformes

### Paso 3: Verificar
- Se mostrará un mensaje indicando cuántos juegos se crearon
- Si no hay espacio, se mostrará un mensaje indicando cuántos se pudieron crear
- Todos los uniformes respetarán las validaciones de espacio

## 📊 Ejemplo de archivo Excel

Puedes usar este ejemplo:

```
| nombre          |
|-----------------|
| Juan Pérez      |
| María González  |
| Pedro López     |
| Ana Martínez    |
| Carlos Sánchez  |
```

Para cada una de estas filas, se generará:
- 1 Jersey con el molde correspondiente
- 1 Short con los moldes correspondientes
- Ambos posicionados sin encimarse en el canvas

## ⚠️ Consideraciones importantes

### Espacio en el canvas
- El canvas tiene un tamaño limitado
- Si no hay espacio suficiente, la carga se detendrá
- Se mostrará un mensaje indicando cuántos juegos se crearon antes de quedarse sin espacio

### Validaciones automáticas
- **Detección de colisiones**: Los uniformes NO se enciman
- **Búsqueda de espacio**: El sistema busca automáticamente posiciones válidas
- **Respeto de márgenes**: Se respeta el margen de 1cm en todos los bordes

### Dimensiones
- **Jersey**: Dimensiones estándar según talla M
- **Shorts**: Dimensiones extendidas (ancho x2.2, alto x0.45) para contener ambos moldes

## 🔧 Solución de problemas

### "Por favor selecciona un archivo Excel válido"
- Verifica que el archivo sea `.xlsx` o `.xls`
- Asegúrate de no estar seleccionando otro tipo de archivo

### "El archivo Excel está vacío"
- Verifica que el archivo tenga al menos una fila de datos (además del encabezado)

### "Error al procesar el archivo Excel. Verifica que tenga la columna 'nombre'"
- Asegúrate de que la primera columna se llame exactamente `nombre` (minúsculas)
- Verifica que el archivo no esté corrupto

### "No hay espacio suficiente..."
- El canvas está lleno
- Opciones:
  1. Aumenta el tamaño del canvas
  2. Elimina algunos elementos existentes
  3. Carga menos uniformes

## 💡 Consejos

- **Prueba con pocos datos primero**: Empieza con 2-3 nombres para verificar
- **Limpia el canvas**: Si vas a cargar muchos uniformes, limpia el canvas primero
- **Canvas grande**: Para muchos uniformes, considera usar un canvas más grande
- **Nombres únicos**: Aunque no es obligatorio, ayuda tener nombres descriptivos

## 📁 Ubicación de archivos

- **Utilidad de lectura**: `src/utils/excelReader.ts`
- **Lógica de generación**: `src/modules/Toolbar.tsx` (función `handleExcelUpload`)
- **Botón de carga**: Sección "Carga Masiva" en pestaña "Agregar"
