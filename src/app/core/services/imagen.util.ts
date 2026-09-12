// Redimensiona/comprime una imagen antes de subirla a Storage: no hay que
// depender de que el límite del bucket alcance (bug real: la foto de la
// cámara superó los 5MB del bucket `fotos` en el alta de empleado).
// Reusar esto en cliente.service.ts, mesa.service.ts y producto.service.ts
// cuando suban fotos, en vez de subir el blob crudo de cámara/galería.
const LADO_MAXIMO_PX = 1280;
const CALIDAD_JPEG = 0.8;

export function redimensionarImagen(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const imagen = new Image();

    imagen.onload = () => {
      const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(imagen.width, imagen.height));
      const ancho = Math.round(imagen.width * escala);
      const alto = Math.round(imagen.height * escala);

      const canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;
      canvas.getContext('2d')!.drawImage(imagen, 0, 0, ancho, alto);

      canvas.toBlob(
        (resultado) => {
          URL.revokeObjectURL(url);
          resultado ? resolve(resultado) : reject(new Error('No se pudo procesar la imagen.'));
        },
        'image/jpeg',
        CALIDAD_JPEG,
      );
    };

    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen para procesarla.'));
    };

    imagen.src = url;
  });
}
