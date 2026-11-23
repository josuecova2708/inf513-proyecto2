<?php

namespace App\Services\Pagos;

/**
 * Contrato de la pasarela de pagos. Hoy se usa PasarelaSimulada; cuando se habiliten
 * las credenciales de PagoFácil basta con crear PasarelaPagoFacil e intercambiarla en
 * AppServiceProvider (config/pagos.php -> 'pasarela').
 */
interface PasarelaPago
{
    /**
     * @param  array{metodo: string, monto: float, pedido: string, cliente_id: int, staff: bool,
     *               tarjeta?: object|null, referencia?: string|null}  $datos
     */
    public function cobrar(array $datos): ResultadoPago;

    public function nombre(): string;
}
