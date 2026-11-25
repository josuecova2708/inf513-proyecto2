<?php

namespace App\Services\Pagos;

final class ResultadoPago
{
    /**
     * @param  'pagado'|'pendiente'|'rechazado'  $estado
     * @param  string|null  $clientSecret  Stripe: el banco pide 3D Secure; el navegador debe completarlo
     */
    public function __construct(
        public readonly string $estado,
        public readonly string $codigoTransaccion,
        public readonly string $mensaje,
        public readonly ?string $clientSecret = null,
        public readonly string $pasarela = 'simulada',
    ) {}

    public function aprobado(): bool
    {
        return $this->estado === 'pagado';
    }

    public function requiereAccion(): bool
    {
        return $this->clientSecret !== null;
    }
}
