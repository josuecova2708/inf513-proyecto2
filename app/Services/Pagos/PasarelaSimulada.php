<?php

namespace App\Services\Pagos;

use Illuminate\Support\Str;

/**
 * Pasarela simulada (PagoFácil no tiene credenciales habilitadas este semestre).
 *
 * Reglas de simulación (documentadas para la defensa):
 *  - Tarjeta: se aprueba al instante, salvo que esté vencida o su número termine en 0002
 *    (simula "fondos insuficientes") o en 0069 (simula "tarjeta bloqueada").
 *  - QR y Transferencia: quedan PENDIENTES hasta que el personal de FEDER verifique el abono.
 *  - Efectivo: si lo registra el personal, se aprueba; si lo elige el cliente, queda pendiente
 *    (pago contra entrega).
 */
class PasarelaSimulada implements PasarelaPago
{
    public function nombre(): string
    {
        return 'Pasarela simulada FEDER';
    }

    public function cobrar(array $datos): ResultadoPago
    {
        $codigo = 'TX-'.now()->format('ymdHis').'-'.Str::upper(Str::random(5));

        switch ($datos['metodo']) {
            case 'Tarjeta':
                $t = $datos['tarjeta'] ?? null;
                if (! $t) {
                    return new ResultadoPago('rechazado', $codigo, 'Seleccione una tarjeta registrada.');
                }
                $vence = now()->setDate((int) $t->anio_venc, (int) $t->mes_venc, 1)->endOfMonth();
                if ($vence->isPast()) {
                    return new ResultadoPago('rechazado', $codigo, 'Pago rechazado: la tarjeta está vencida.');
                }
                if ($t->ultimos4 === '0002') {
                    return new ResultadoPago('rechazado', $codigo, 'Pago rechazado por el banco emisor: fondos insuficientes.');
                }
                if ($t->ultimos4 === '0069') {
                    return new ResultadoPago('rechazado', $codigo, 'Pago rechazado: la tarjeta está bloqueada.');
                }

                return new ResultadoPago('pagado', $codigo, "Pago aprobado con {$t->marca} •••• {$t->ultimos4}.");

            case 'QR':
                return new ResultadoPago('pendiente', $codigo, 'Escanee el QR y pague el monto exacto indicando el número de pedido. FEDER verificará el abono.');

            case 'Transferencia':
                return new ResultadoPago('pendiente', $codigo, 'Transferencia registrada. FEDER verificará el comprobante.');

            case 'Efectivo':
                return $datos['staff']
                    ? new ResultadoPago('pagado', $codigo, 'Pago en efectivo registrado por FEDER.')
                    : new ResultadoPago('pendiente', $codigo, 'Pagará en efectivo al recibir o recoger su pedido.');
        }

        return new ResultadoPago('rechazado', $codigo, 'Método de pago no soportado.');
    }
}
