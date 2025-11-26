/**
 * Cache global de imágenes para evitar cargar la misma imagen múltiples veces
 * Esto previene problemas de memoria cuando se usan imágenes base64 grandes
 */

interface ImageCacheEntry {
  image: HTMLImageElement;
  status: 'loading' | 'loaded' | 'error';
  listeners: Array<(img: HTMLImageElement | null) => void>;
}

const imageCache = new Map<string, ImageCacheEntry>();

/**
 * Carga una imagen y la mantiene en caché
 * Si la imagen ya está en caché, retorna la instancia existente
 */
export const loadImage = (
  url: string,
  callback: (img: HTMLImageElement | null) => void
): void => {
  // Si la URL está vacía, retornar null inmediatamente
  if (!url) {
    callback(null);
    return;
  }

  // Verificar si la imagen ya está en caché
  const cached = imageCache.get(url);

  if (cached) {
    // Si ya está cargada, llamar al callback inmediatamente
    if (cached.status === 'loaded') {
      callback(cached.image);
      return;
    }

    // Si está en error, retornar null
    if (cached.status === 'error') {
      callback(null);
      return;
    }

    // Si está cargando, agregar el callback a la lista de listeners
    cached.listeners.push(callback);
    return;
  }

  // Crear nueva entrada en caché
  const image = new Image();
  const entry: ImageCacheEntry = {
    image,
    status: 'loading',
    listeners: [callback],
  };

  imageCache.set(url, entry);

  // Configurar handlers
  image.onload = () => {
    entry.status = 'loaded';
    // Notificar a todos los listeners
    entry.listeners.forEach(listener => listener(image));
    // Limpiar listeners
    entry.listeners = [];
  };

  image.onerror = () => {
    entry.status = 'error';
    // Notificar a todos los listeners
    entry.listeners.forEach(listener => listener(null));
    // Limpiar listeners
    entry.listeners = [];
  };

  // Iniciar carga
  image.src = url;
};

/**
 * Limpia el caché de imágenes
 * Útil cuando se necesita liberar memoria
 */
export const clearImageCache = (): void => {
  imageCache.clear();
};

/**
 * Obtiene estadísticas del caché
 */
export const getImageCacheStats = () => {
  let loaded = 0;
  let loading = 0;
  let error = 0;

  imageCache.forEach(entry => {
    if (entry.status === 'loaded') loaded++;
    else if (entry.status === 'loading') loading++;
    else if (entry.status === 'error') error++;
  });

  return {
    total: imageCache.size,
    loaded,
    loading,
    error,
  };
};
