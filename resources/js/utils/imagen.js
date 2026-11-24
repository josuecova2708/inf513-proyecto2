export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_MB_ORIGINAL = 10;

/** Valida tipo y peso del archivo elegido. Devuelve el mensaje de error en español o ''. */
export function validarImagen(archivo) {
    if (!TIPOS_IMAGEN.includes(archivo.type)) return 'La imagen debe ser JPG, PNG o WEBP.';
    if (archivo.size > MAX_MB_ORIGINAL * 1024 * 1024) return `La imagen no puede pesar más de ${MAX_MB_ORIGINAL} MB.`;
    return '';
}

/**
 * Reduce la foto en el navegador antes de subirla (lado máximo y JPEG 0.85):
 * una foto de celular de 5 MB queda en ~300 KB y no choca con el límite de subida de PHP del servidor.
 * El servidor la vuelve a comprimir a WEBP (ImagenServicio).
 */
export async function reducirImagen(archivo, ladoMax = 1600, calidad = 0.85) {
    try {
        const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
        const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
        if (escala === 1 && archivo.size < 1.5 * 1024 * 1024) {
            bitmap.close();
            return archivo;
        }
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(bitmap.width * escala);
        lienzo.height = Math.round(bitmap.height * escala);
        const ctx = lienzo.getContext('2d');
        ctx.fillStyle = '#ffffff'; // los PNG transparentes quedan sobre blanco
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
        bitmap.close();
        const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad));
        if (!blob) return archivo;
        return new File([blob], archivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
        return archivo; // navegador sin soporte: se envía el original
    }
}
