# Rotación de Imágenes de Moldes (90 grados)

## 📋 Descripción

Se han rotado las imágenes de los moldes (jerseys y shorts) **90 grados** para que estén orientadas verticalmente, en concordancia con el posicionamiento vertical implementado.

## 🔄 Cambios Implementados

### 1. Rotación de elementos
- **Jerseys**: Rotados 90° en sentido horario
- **Shorts**: Rotados 90° en sentido horario
- **Propiedad modificada**: `rotation: 90` (antes era `rotation: 0`)

### 2. Intercambio de dimensiones
Cuando se rota 90°, el ancho se convierte en alto y viceversa:

**Antes (sin rotación)**:
```typescript
// Jersey
width: sizeConfig.width
height: sizeConfig.height

// Shorts
width: sizeConfig.width * 2.2
height: sizeConfig.height * 0.45
```

**Ahora (con rotación 90°)**:
```typescript
// Jersey - dimensiones intercambiadas
width: sizeConfig.height   // Lo que era height
height: sizeConfig.width   // Lo que era width

// Shorts - dimensiones intercambiadas
width: sizeConfig.height * 0.45   // Lo que era height
height: sizeConfig.width * 2.2    // Lo que era width
```

## 📄 Archivos Modificados

### `src/modules/Toolbar.tsx`

#### Ubicaciones de cambios:

1. **Líneas 53-62**: Dimensiones de validación intercambiadas
   - `jerseyDimensions`: width ↔ height
   - `shortsDimensions`: width ↔ height

2. **Líneas 79-104**: Función `handleAddUniform`
   - Dimensiones intercambiadas
   - `rotation: 90` aplicada

3. **Líneas 178-185**: Función `handleExcelUpload` - Dimensiones
   - Dimensiones intercambiadas para carga masiva

4. **Líneas 222 y 257**: Función `handleExcelUpload` - Rotación
   - `rotation: 90` para jerseys y shorts

## 🎯 Visualización

### Antes (Horizontal, sin rotación)
```
┌─────────────────────────┐
│  [═══════]              │  ← Jersey horizontal
│  [══════]               │  ← Shorts horizontal
└─────────────────────────┘
```

### Ahora (Vertical, con rotación 90°)
```
┌─────────────────────────┐
│  ║                      │
│  ║  ← Jersey vertical   │
│  ║                      │
│  ║                      │
│  ║                      │
│  ║  ← Shorts vertical   │
│  ║                      │
└─────────────────────────┘
```

## ✅ Validaciones Mantenidas

Todas las validaciones siguen funcionando correctamente:

✅ **No encimado**: Detección de colisiones con dimensiones rotadas
✅ **Respeto de márgenes**: Margen de 1cm respetado
✅ **Validación de espacio**: Botones deshabilitados correctamente
✅ **Posicionamiento vertical**: Los elementos se colocan de arriba hacia abajo
✅ **Carga desde Excel**: Funciona con elementos rotados

## 🔍 Cómo Funciona Técnicamente

### Estrategia de Rotación Interna

Para mantener las validaciones funcionando correctamente, NO rotamos el Group completo. En su lugar:

1. **Group sin rotación**: El Group mantiene sus dimensiones originales (ya intercambiadas)
2. **Imagen rotada internamente**: Solo la imagen (KonvaImage) tiene `rotation: 90`
3. **Dimensiones del Group**: Reflejan el espacio físico real que ocupa el elemento

Esta estrategia garantiza que:
- Las validaciones de colisión funcionan correctamente
- Los límites del canvas se respetan
- El arrastre (drag) funciona dentro de los límites
- El posicionamiento vertical es preciso

### Intercambio de Dimensiones

Cuando rotamos 90°:
- La **altura original** de la imagen se convierte en el **ancho** en el canvas
- El **ancho original** de la imagen se convierte en la **altura** en el canvas

Por eso intercambiamos `width` y `height` en las dimensiones del elemento.

### Implementación Técnica

```typescript
// En UniformShape component:
<KonvaImage
  image={image}
  x={element.rotation === 90 ? element.dimensions.width : 0}
  y={0}
  width={element.rotation === 90 ? element.dimensions.height : element.dimensions.width}
  height={element.rotation === 90 ? element.dimensions.width : element.dimensions.height}
  rotation={element.rotation}  // Solo la imagen se rota
  opacity={1}
/>

// El Group NO tiene rotation, mantiene dimensiones correctas para validaciones
<Group
  x={element.position.x}
  y={element.position.y}
  // NO rotation aquí
>
```

### Ejemplo con Números

**Sin rotación**:
- Jersey: 200px (ancho) x 300px (alto)
- Espacio ocupado: 200px horizontal, 300px vertical

**Con rotación 90°**:
- Jersey: 300px (ancho) x 200px (alto) ← intercambiado
- Espacio ocupado: 300px horizontal, 200px vertical
- La imagen se ve vertical, ocupando más alto que ancho

## 🎮 Probando la Funcionalidad

### Prueba Manual
```bash
npm run dev
```

1. Haz clic en "Agregar Playera"
2. Observa que la imagen del jersey aparece en orientación vertical
3. Haz clic en "Agregar Short"
4. Observa que los moldes de shorts aparecen verticalmente
5. Verifica que se posicionan de arriba hacia abajo

### Prueba con Excel
1. Carga un archivo Excel con 5+ nombres
2. Observa cómo todos los jerseys y shorts aparecen rotados verticalmente
3. Verifica que no se enciman y respetan todas las validaciones

## 🔧 Ajustes Opcionales

### Cambiar el ángulo de rotación

Si deseas rotar a otro ángulo, modifica en `Toolbar.tsx`:

```typescript
rotation: 90,  // Cambiar a 0, 45, 180, 270, etc.
```

**Ángulos comunes**:
- `0`: Sin rotación (horizontal)
- `90`: Vertical (orientación actual)
- `180`: Invertido
- `270`: Vertical invertido
- `-90`: Vertical al revés

### Volver a orientación horizontal

Para revertir a orientación horizontal:

1. Cambiar `rotation: 90` a `rotation: 0`
2. Intercambiar de nuevo las dimensiones:
   ```typescript
   width: sizeConfig.width,
   height: sizeConfig.height,
   ```

## 📝 Notas Importantes

- **Consistencia**: Todos los elementos (jerseys y shorts) usan la misma rotación
- **Performance**: La rotación no afecta el rendimiento
- **Exportación**: Los elementos se exportan con su rotación aplicada
- **Edición**: Los usuarios pueden rotar manualmente los elementos después de crearlos
- **Validaciones**: Las dimensiones intercambiadas + rotación interna garantizan que TODAS las validaciones funcionen correctamente
- **Rotación interna**: La imagen se rota dentro del Group, NO el Group completo
- **Límites respetados**: El dragBoundFunc funciona correctamente porque el Group mantiene dimensiones reales

## 🎨 Ventajas de la Rotación Vertical

1. **Consistencia visual**: Los moldes se ven como se posicionan
2. **Mejor aprovechamiento**: Usa mejor el espacio vertical del canvas
3. **Visualización natural**: Los uniformes se ven en su orientación natural
4. **Facilita diseño**: Más fácil agregar texto y elementos sobre los uniformes

## 📊 Comparación de Ocupación de Espacio

### Jersey (ejemplo con talla M)
- **Horizontal**: 200px (ancho) x 300px (alto)
- **Vertical**: 300px (ancho) x 200px (alto)

### Shorts (ejemplo con talla M)
- **Horizontal**: 440px (ancho) x 135px (alto)
- **Vertical**: 135px (ancho) x 440px (alto)

Con la rotación vertical, los elementos ocupan más espacio vertical y menos horizontal, lo cual es ideal para el posicionamiento en columnas.
