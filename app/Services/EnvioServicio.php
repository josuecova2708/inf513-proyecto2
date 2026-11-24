<?php

namespace App\Services;

use App\Exceptions\ErrorNegocio;

/**
 * Costo de envío a domicilio según la distancia a las oficinas de FEDER (config/feder.php).
 * La misma fórmula está en resources/js/utils/envio.js para la vista previa del carrito;
 * el valor que se cobra es siempre el que calcula el servidor.
 */
class EnvioServicio
{
    /** Distancia aproximada por calles (km): línea recta (haversine) × factor de ruta. */
    public static function distanciaKm(float $lat, float $lng): float
    {
        $o = config('feder.origen');
        $rad = M_PI / 180;
        $dLat = ($lat - $o['lat']) * $rad;
        $dLng = ($lng - $o['lng']) * $rad;
        $a = sin($dLat / 2) ** 2 + cos($o['lat'] * $rad) * cos($lat * $rad) * sin($dLng / 2) ** 2;
        $recta = 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($recta * config('feder.envio.factor_ruta'), 2);
    }

    /** Costo en Bs (redondeado hacia arriba a 0,50). Lanza ErrorNegocio si está fuera de la zona. */
    public static function costo(float $km): float
    {
        $t = config('feder.envio');
        if ($km > $t['max_km']) {
            throw new ErrorNegocio('La ubicación está fuera de la zona de envío (máx. '.(int) $t['max_km'].' km de FEDER; la suya está a '
                .number_format($km, 1, ',', '.').' km). Elija recojo en FEDER.');
        }
        $costo = $t['base'] + max(0, $km - $t['km_incluidos']) * $t['por_km'];

        return ceil($costo * 2) / 2;
    }

    /** Parámetros para que el frontend calcule la vista previa. */
    public static function tarifa(): array
    {
        return ['origen' => config('feder.origen')] + config('feder.envio');
    }
}
