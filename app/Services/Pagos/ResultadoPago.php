<?php

namespace App\Services\Pagos;

final class ResultadoPago
{
    /** @param 'pagado'|'pendiente'|'rechazado' $estado */
    public function __construct(
        public readonly string $estado,
        public readonly string $codigoTransaccion,
        public readonly string $mensaje,
    ) {}

    public function aprobado(): bool
    {
        return $this->estado === 'pagado';
    }
}
