# Posicionamiento Vertical de Elementos

## 📋 Cambios Implementados

Se ha modificado el algoritmo de posicionamiento para que los elementos (jerseys, shorts, texto) se coloquen de manera **vertical** en el canvas.

## 🎯 Comportamiento Anterior vs Nuevo

### Anterior (Horizontal)
Los elementos se posicionaban de izquierda a derecha, luego siguiente fila:
```
Elemento1  Elemento2  Elemento3
Elemento4  Elemento5  Elemento6
```

### Nuevo (Vertical)
Los elementos se posicionan de arriba hacia abajo, luego siguiente columna:
```
Elemento1  Elemento4
Elemento2  Elemento5
Elemento3  Elemento6
```

## ⚙️ Archivos Modificados

### `src/utils/canvas.ts`

#### 1. Función `findValidPosition` (líneas 252-271)
**Cambio**: Se invirtió el orden de los bucles for

**Antes**:
```typescript
for (let y = margin; y <= maxY; y += spacing) {
  for (let x = margin; x <= maxX; x += spacing) {
    // Busca horizontalmente primero
  }
}
```

**Ahora**:
```typescript
for (let x = margin; x <= maxX; x += spacing) {
  for (let y = margin; y <= maxY; y += spacing) {
    // Busca verticalmente primero
  }
}
```

#### 2. Función `hasSpaceForElement` (líneas 336-343)
**Cambio**: Misma inversión para mantener consistencia

**Resultado**: La validación de espacio disponible también busca verticalmente

## ✅ Validaciones Mantenidas

Todas las validaciones existentes se mantienen intactas:

✅ **No encimado**: Los elementos siguen detectando colisiones correctamente
✅ **Respeto de márgenes**: Se mantiene el margen de 1cm en todos los lados
✅ **Validación de espacio**: Los botones se deshabilitan cuando no hay espacio
✅ **Detección de colisiones**: Sistema completo funcionando
✅ **Moldes reales**: Se siguen usando las imágenes de moldes

## 🔍 Cómo Funciona

### Estrategia de Búsqueda

1. **Posición preferida**: Intenta primero la posición inicial (margen + 50px)

2. **Búsqueda con espaciado de 20px**:
   - Empieza en la esquina superior izquierda (margin, margin)
   - Busca de arriba hacia abajo en la primera columna
   - Si no encuentra espacio, pasa a la siguiente columna
   - Continúa hasta encontrar una posición válida

3. **Búsqueda fina con espaciado de 10px**:
   - Si no encontró espacio con 20px, busca con 10px
   - Misma lógica vertical

4. **Fallback**: Si no hay espacio, ajusta a los límites del canvas

### Ejemplo Visual

Cuando agregas elementos, se posicionarán así:

```
┌────────────────────────────┐
│  [Jersey1]  [Jersey4]      │
│  [Shorts1]  [Shorts4]      │
│                            │
│  [Jersey2]  [Jersey5]      │
│  [Shorts2]  [Shorts5]      │
│                            │
│  [Jersey3]  [Jersey6]      │
│  [Shorts3]  [Shorts6]      │
│                            │
└────────────────────────────┘
```

## 📊 Aplicación en Carga Masiva

Cuando cargas un archivo Excel con múltiples nombres:
- Cada juego (jersey + shorts) se posiciona verticalmente
- El jersey se coloca primero
- El short se coloca inmediatamente debajo (si hay espacio)
- Si no hay espacio en esa columna, pasa a la siguiente

## 💡 Ventajas del Posicionamiento Vertical

1. **Mejor visualización**: Los uniformes se agrupan verticalmente
2. **Orden lógico**: Jersey arriba, shorts abajo
3. **Aprovechamiento del espacio**: Mejor uso del canvas en altura
4. **Facilita revisión**: Más fácil revisar los uniformes columna por columna

## 🎮 Probando la Funcionalidad

### Prueba Manual
1. Ejecuta `npm run dev`
2. Haz clic en "Agregar Playera" varias veces
3. Observa que se posicionan de arriba hacia abajo en la primera columna
4. Cuando llena la columna, empieza en la siguiente

### Prueba con Excel
1. Carga un archivo Excel con 10+ nombres
2. Observa cómo se distribuyen verticalmente
3. Verifica que respeten todas las validaciones

## 🔧 Ajustes Disponibles

Si deseas modificar el comportamiento:

### Cambiar espaciado entre elementos
En `src/utils/canvas.ts`:
- Línea 248: `const spacing = 20;` (espaciado grueso)
- Línea 263: `const fineSpacing = 10;` (espaciado fino)

### Cambiar posición inicial
En `src/utils/canvas.ts`:
- Líneas 207-208: Ajusta `startX` y `startY`

### Volver a posicionamiento horizontal
Simplemente invierte el orden de los bucles de nuevo:
```typescript
for (let y = margin; y <= maxY; y += spacing) {
  for (let x = margin; x <= maxX; x += spacing) {
    // ...
  }
}
```

## 📝 Notas Importantes

- El posicionamiento vertical se aplica a **todos los elementos**: jerseys, shorts y texto
- Las validaciones se ejecutan en cada posición antes de colocar el elemento
- Si no hay espacio disponible, el sistema lo detecta y bloquea los botones
- La carga desde Excel respeta el mismo posicionamiento vertical
