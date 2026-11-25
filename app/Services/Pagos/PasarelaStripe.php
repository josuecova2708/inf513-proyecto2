<?php

namespace App\Services\Pagos;

use App\Services\StripeServicio;
use Stripe\Exception\CardException;

/**
 * Pasarela con Stripe (modo prueba) para las tarjetas registradas con Stripe.
 * QR, transferencia, efectivo y las tarjetas simuladas antiguas siguen en PasarelaSimulada.
 *
 * Tarjetas de prueba: 4242 4242 4242 4242 (aprobada), 4000 0000 0000 0341 (cobro rechazado),
 * 4000 0025 0000 3155 (pide 3D Secure).
 */
class PasarelaStripe implements PasarelaPago
{
    public function __construct(private StripeServicio $stripe, private PasarelaSimulada $simulada) {}

    public function nombre(): string
    {
        return 'Stripe (modo prueba)';
    }

    public function cobrar(array $datos): ResultadoPago
    {
        $t = $datos['tarjeta'] ?? null;
        if ($datos['metodo'] !== 'Tarjeta' || ! $t || ($t->proveedor ?? 'simulada') !== 'stripe') {
            return $this->simulada->cobrar($datos);
        }

        try {
            $pi = $this->stripe->cobrar(
                $this->stripe->clientePara((int) $datos['cliente_id']),
                $t->token_pasarela,
                (float) $datos['monto'],
                "FEDER · Pedido {$datos['pedido']}",
                ['pedido' => $datos['pedido'], 'cliente_id' => $datos['cliente_id']],
            );
        } catch (CardException $e) {
            $err = $e->getError();

            return new ResultadoPago('rechazado', $err->payment_intent->id ?? 'stripe-rechazo',
                StripeServicio::mensajeRechazo($err->decline_code ?? null, $err->code ?? null), null, 'stripe');
        }

        return match ($pi->status) {
            'succeeded' => new ResultadoPago('pagado', $pi->id, "Pago aprobado con {$t->marca} •••• {$t->ultimos4} (Stripe).", null, 'stripe'),
            'requires_action' => new ResultadoPago('pendiente', $pi->id, 'Su banco pide confirmar el pago (3D Secure).', $pi->client_secret, 'stripe'),
            'processing' => new ResultadoPago('pendiente', $pi->id, 'El pago se está procesando. Le avisaremos cuando se confirme.', null, 'stripe'),
            default => new ResultadoPago('rechazado', $pi->id, 'Pago rechazado por el banco emisor. Pruebe con otra tarjeta.', null, 'stripe'),
        };
    }
}
