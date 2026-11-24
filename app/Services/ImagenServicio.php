<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Guarda las imágenes subidas (productos, emprendimientos) en storage/app/public,
 * redimensionadas y comprimidas en WEBP para que la carpeta crezca poco (≈100 KB por foto).
 * La carpeta está fuera de git y se publica con el enlace public/storage (php artisan storage:link).
 */
class ImagenServicio
{
    public const LADO_MAXIMO = 1000;

    public const CALIDAD_WEBP = 80;

    /** Devuelve la ruta relativa en el disco public (ej. "productos/abc.webp"). */
    public static function guardar(UploadedFile $archivo, string $carpeta, int $lado = self::LADO_MAXIMO): string
    {
        $imagen = function_exists('imagewebp') ? self::cargar($archivo->getRealPath(), (string) $archivo->getMimeType()) : null;
        if (! $imagen) {
            // Sin GD (o formato no soportado): se guarda el archivo tal cual
            return $archivo->store($carpeta, 'public');
        }

        $imagen = self::redimensionar(self::orientar($imagen, $archivo->getRealPath()), $lado);
        ob_start();
        imagewebp($imagen, null, self::CALIDAD_WEBP);
        $bytes = ob_get_clean();
        imagedestroy($imagen);

        $ruta = trim($carpeta, '/').'/'.Str::uuid()->toString().'.webp';
        Storage::disk('public')->put($ruta, $bytes);

        return $ruta;
    }

    public static function eliminar(?string $ruta): void
    {
        if ($ruta) {
            Storage::disk('public')->delete($ruta);
        }
    }

    private static function cargar(string $ruta, string $mime): ?\GdImage
    {
        $img = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($ruta),
            'image/png' => @imagecreatefrompng($ruta),
            'image/webp' => @imagecreatefromwebp($ruta),
            default => false,
        };
        if (! $img) {
            return null;
        }
        if (! imageistruecolor($img)) {
            imagepalettetotruecolor($img);
        }
        imagealphablending($img, true);
        imagesavealpha($img, true);

        return $img;
    }

    /** Las fotos de celular guardan la rotación en EXIF: se aplica para que no queden de lado. */
    private static function orientar(\GdImage $img, string $ruta): \GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $img;
        }
        $orientacion = @exif_read_data($ruta)['Orientation'] ?? 1;
        $angulo = [3 => 180, 6 => -90, 8 => 90][$orientacion] ?? 0;

        return $angulo ? (imagerotate($img, $angulo, 0) ?: $img) : $img;
    }

    private static function redimensionar(\GdImage $img, int $lado): \GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        if (max($w, $h) <= $lado) {
            return $img;
        }
        $escala = $lado / max($w, $h);
        $nueva = imagescale($img, (int) round($w * $escala), (int) round($h * $escala), IMG_BICUBIC);
        imagedestroy($img);

        return $nueva;
    }
}
