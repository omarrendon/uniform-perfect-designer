const sharp = require('sharp');
const path = require('path');

async function removeBackground() {
  // Usar el backup como fuente (imagen original)
  const inputPath = path.join(__dirname, '../public/moldes/M CAB ESPALDA_backup.png');
  const outputPath = path.join(__dirname, '../public/moldes/M CAB ESPALDA.png');

  try {
    // Leer la imagen original desde el backup
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log('Dimensiones originales:', metadata.width, 'x', metadata.height);
    console.log('Formato:', metadata.format);

    // Obtener los datos raw de la imagen
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels;

    // Crear un nuevo buffer con canal alpha
    const pixels = new Uint8Array(width * height * 4);

    // Copiar todos los píxeles inicialmente como opacos
    for (let i = 0; i < width * height; i++) {
      pixels[i * 4] = data[i * channels];
      pixels[i * 4 + 1] = data[i * channels + 1];
      pixels[i * 4 + 2] = data[i * channels + 2];
      pixels[i * 4 + 3] = 255; // Opaco por defecto
    }

    // Función para verificar si un píxel es parte del fondo (blanco/gris claro/líneas grises)
    const isBackgroundColor = (r, g, b) => {
      // Calcular si es un gris (los tres canales similares)
      const isGray = Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30;

      return (
        // Blanco o gris claro (incluye las líneas del patrón de fondo)
        (r > 170 && g > 170 && b > 170 && isGray)
      );
    };

    // Función para obtener índice del píxel
    const getIndex = (x, y) => y * width + x;

    // Array para marcar píxeles visitados
    const visited = new Uint8Array(width * height);

    // Flood fill desde los bordes de la imagen usando stack (más eficiente)
    const stack = [];

    // Agregar todos los píxeles de los bordes al stack
    // Borde superior e inferior
    for (let x = 0; x < width; x++) {
      stack.push(x + 0 * width); // y = 0
      stack.push(x + (height - 1) * width); // y = height - 1
    }
    // Borde izquierdo y derecho
    for (let y = 0; y < height; y++) {
      stack.push(0 + y * width); // x = 0
      stack.push((width - 1) + y * width); // x = width - 1
    }

    // Solo eliminar el fondo exterior que rodea la playera
    // No agregar puntos semilla interiores - solo desde los bordes

    console.log('Iniciando flood fill desde los bordes...');

    // Procesar el stack (flood fill) - usar índices planos para mayor eficiencia
    while (stack.length > 0) {
      const idx = stack.pop();

      // Si ya fue visitado, saltar
      if (visited[idx]) continue;
      visited[idx] = 1;

      // Obtener color del píxel
      const r = data[idx * channels];
      const g = data[idx * channels + 1];
      const b = data[idx * channels + 2];

      // Si es color de fondo, hacerlo transparente y expandir
      if (isBackgroundColor(r, g, b)) {
        pixels[idx * 4 + 3] = 0; // Hacer transparente

        const x = idx % width;
        const y = Math.floor(idx / width);

        // Agregar vecinos al stack (8-conectividad)
        if (x + 1 < width) stack.push(idx + 1);
        if (x - 1 >= 0) stack.push(idx - 1);
        if (y + 1 < height) stack.push(idx + width);
        if (y - 1 >= 0) stack.push(idx - width);
        // Diagonales
        if (x + 1 < width && y + 1 < height) stack.push(idx + 1 + width);
        if (x + 1 < width && y - 1 >= 0) stack.push(idx + 1 - width);
        if (x - 1 >= 0 && y + 1 < height) stack.push(idx - 1 + width);
        if (x - 1 >= 0 && y - 1 >= 0) stack.push(idx - 1 - width);
      }
    }

    console.log('Flood fill completado.');

    // Guardar la imagen con fondo transparente
    await sharp(pixels, {
      raw: {
        width: width,
        height: height,
        channels: 4
      }
    })
    .png()
    .toFile(outputPath);

    console.log('Imagen procesada exitosamente!');
    console.log('Guardada en:', outputPath);

    // Verificar dimensiones finales
    const finalMetadata = await sharp(outputPath).metadata();
    console.log('Dimensiones finales:', finalMetadata.width, 'x', finalMetadata.height);

  } catch (error) {
    console.error('Error al procesar la imagen:', error);
    process.exit(1);
  }
}

removeBackground();
