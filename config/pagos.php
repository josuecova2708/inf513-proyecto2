<?php

/*
 * Pasarela de pagos con tarjeta.
 *  - simulada: reglas locales (sin internet), útil para pruebas y si el servidor no puede salir a internet.
 *  - stripe:   Stripe en modo prueba (claves pk_test / sk_test). QR, transferencia y efectivo siguen igual.
 */
return [
    'pasarela' => env('PAGOS_PASARELA', 'simulada'),

    'moneda' => env('PAGOS_MONEDA', 'bob'),

    'stripe' => [
        'key' => env('STRIPE_KEY'),        // publicable: se envía al navegador
        'secret' => env('STRIPE_SECRET'),  // secreta: solo en el servidor
    ],
];
