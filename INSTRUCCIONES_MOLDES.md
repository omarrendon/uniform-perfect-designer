# Instrucciones para completar la implementación de moldes (Jerseys y Shorts)

## ✅ Cambios implementados

He modificado el código para que tanto los jerseys como los shorts usen moldes reales en lugar de rectángulos simples. Los cambios incluyen:

### 1. **Toolbar.tsx**
- **Jerseys**: Se asigna automáticamente la imagen `/moldes/jersey-molde.png`
- **Shorts**: Se crean con dimensiones ajustadas (ancho x 2.2, altura x 0.45) para contener ambos moldes
- **Shorts**: Se asigna automáticamente la imagen `/moldes/shorts-moldes.png`

### 2. **UniformElement.tsx**
- Cuando hay una imagen, se muestra solo la imagen (sin el rectángulo de fondo)
- La opacidad de la imagen es 100% para que se vea claramente

### 3. **Dimensiones**
- Los moldes de shorts ocupan más espacio horizontal (2.2x) para acomodar ambos moldes
- Altura reducida (0.45x) para mantener proporciones reales

## 📋 PASO FINAL - Guardar las imágenes

Para completar la implementación, necesitas guardar **DOS imágenes**:

### Imagen 1: Molde de Jersey (Playera)
1. **Nombre**: `jersey-molde.png`
2. **Ruta**: `/Users/omarrendon/Desktop/uniform-perfect-designer/public/moldes/`
3. **Contenido**: La imagen del molde de playera que me proporcionaste

### Imagen 2: Moldes de Shorts
1. **Nombre**: `shorts-moldes.png`
2. **Ruta**: `/Users/omarrendon/Desktop/uniform-perfect-designer/public/moldes/`
3. **Contenido**: La imagen con los dos moldes de shorts que me proporcionaste

### Resumen de archivos a guardar:
```
/public/moldes/
  ├── jersey-molde.png   ← Molde de playera
  └── shorts-moldes.png  ← Moldes de shorts (2 piezas)
```

La carpeta `/public/moldes/` ya está creada y lista.

## 🎨 Características implementadas

✅ **Validación de colisiones**: Todos los moldes respetan las reglas de no encimarse
✅ **Validación de espacio**: Los botones se deshabilitan cuando no hay espacio para los moldes
✅ **Dimensiones ajustadas**: Cada tipo de molde se muestra con las proporciones correctas
✅ **Respeto de márgenes**: Todos los moldes respetan el margen de 1cm del canvas
✅ **Moldes reales**: Jerseys y shorts usan imágenes de moldes profesionales

## 🚀 Cómo probarlo

1. Guarda ambas imágenes en las rutas indicadas
2. Ejecuta: `npm run dev`
3. Haz clic en "Agregar Playera" - Deberías ver el molde de playera
4. Haz clic en "Agregar Short" - Deberías ver los dos moldes de shorts
5. Ambos moldes reemplazan los rectángulos de color

## 📝 Notas importantes

- **Ambas imágenes deben tener fondo transparente** para que se vean correctamente
- **Formato recomendado**: PNG con transparencia
- Si las imágenes tienen proporciones diferentes, puedes ajustar en Toolbar.tsx:
  - **Shorts** (Líneas 53-54):
    - `width: sizeConfig.width * 2.2` (ajusta el 2.2)
    - `height: sizeConfig.height * 0.45` (ajusta el 0.45)
  - **Jerseys** (Líneas 81-83):
    - Las dimensiones son `sizeConfig.width` x `sizeConfig.height`
    - Si necesitas ajustar, modifica estos valores
