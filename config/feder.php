<?php

/*
 * Parámetros de negocio de FEDER.
 */
return [
    // Ubicación de las oficinas de FEDER (punto de recojo y origen de los envíos)
    'origen' => [
        'lat' => -17.779810,
        'lng' => -63.163828,
        'direccion' => 'Oficinas de FEDER, Santa Cruz de la Sierra',
    ],

    // Tarifa de envío a domicilio según la distancia
    'envio' => [
        'base' => 10.0,          // Bs, cubre los primeros km_incluidos
        'km_incluidos' => 2.0,
        'por_km' => 2.5,         // Bs por cada km adicional
        'factor_ruta' => 1.3,    // la línea recta × 1.3 ≈ recorrido real por calles
        'max_km' => 40.0,        // fuera de esta distancia no se hacen envíos
    ],
];
