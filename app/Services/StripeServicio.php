<?php

namespace App\Services;

use App\Exceptions\ErrorNegocio;
use App\Models\Usuario;
use Illuminate\Support\Facades\DB;
use Stripe\Exception\ApiErrorException;
use Stripe\PaymentIntent;
use Stripe\StripeClient;

/**
 * Acceso a la API de Stripe (modo prueba). El número de tarjeta nunca pasa por nuestro servidor:
 * Stripe Elements lo captura en el navegador y aquí solo se manejan identificadores (cus_, pm_, pi_).
 */
class StripeServicio
{
    private ?StripeClient $cliente = null;

    /**
     * Las versiones nuevas de la API ya no aceptan payment_method_types: los métodos se gestionan desde el panel.
     * Se piden solo métodos sin redirección (tarjeta); el 3D Secure se resuelve en la misma página con Stripe.js.
     */
    private const SOLO_SIN_REDIRECCION = ['automatic_payment_methods' => ['enabled' => true, 'allow_redirects' => 'never']];

    public static function activo(): bool
    {
        return config('pagos.pasarela') === 'stripe' && filled(config('pagos.stripe.secret'));
    }

    public function api(): StripeClient
    {
        if (! self::activo()) {
            throw new ErrorNegocio('Los pagos con Stripe no están habilitados en este servidor.');
        }

        return $this->cliente ??= new StripeClient(config('pagos.stripe.secret'));
    }

    /** Customer de Stripe del usuario (se crea la primera vez). */
    public function clientePara(Usuario|int $usuario): string
    {
        $u = $usuario instanceof Usuario ? $usuario : Usuario::findOrFail($usuario);
        if ($u->stripe_customer_id) {
            return $u->stripe_customer_id;
        }
        $c = $this->llamar(fn () => $this->api()->customers->create([
            'email' => $u->email, 'name' => trim("{$u->nombre} {$u->apellido}"), 'metadata' => ['usuario_id' => $u->id],
        ]));
        DB::table('usuario')->where('id_usuario', $u->id)->update(['stripe_customer_id' => $c->id]);
        $u->stripe_customer_id = $c->id;

        return $c->id;
    }

    /** SetupIntent para registrar una tarjeta sin cobrar (el navegador lo confirma con Stripe.js). */
    public function setupIntent(Usuario $u): string
    {
        return $this->llamar(fn () => $this->api()->setupIntents->create([
            'customer' => $this->clientePara($u), 'usage' => 'on_session', ...self::SOLO_SIN_REDIRECCION,
        ]))->client_secret;
    }

    /** Datos de una tarjeta ya adjuntada al Customer del usuario (se leen de Stripe, no del navegador). */
    public function datosTarjeta(Usuario $u, string $paymentMethodId): array
    {
        $pm = $this->llamar(fn () => $this->api()->paymentMethods->retrieve($paymentMethodId));
        if ($pm->type !== 'card' || $pm->customer !== $this->clientePara($u)) {
            throw new ErrorNegocio('La tarjeta no pertenece a su cuenta.');
        }

        return [
            'marca' => ucfirst($pm->card->brand === 'amex' ? 'American Express' : $pm->card->brand),
            'ultimos4' => $pm->card->last4, 'mes_venc' => $pm->card->exp_month, 'anio_venc' => $pm->card->exp_year,
        ];
    }

    public function separarTarjeta(string $paymentMethodId): void
    {
        try {
            $this->api()->paymentMethods->detach($paymentMethodId);
        } catch (ApiErrorException) {
            // ya estaba separada o no existe: no impide borrarla de FEDER
        }
    }

    /** Cobro en centavos con la tarjeta guardada. Lanza CardException si el banco la rechaza. */
    public function cobrar(string $customer, string $paymentMethod, float $monto, string $descripcion, array $metadata): PaymentIntent
    {
        return $this->api()->paymentIntents->create([
            'amount' => (int) round($monto * 100), 'currency' => config('pagos.moneda'),
            'customer' => $customer, 'payment_method' => $paymentMethod, ...self::SOLO_SIN_REDIRECCION,
            'confirm' => true, 'description' => $descripcion, 'metadata' => $metadata,
        ]);
    }

    public function consultar(string $paymentIntentId): PaymentIntent
    {
        return $this->llamar(fn () => $this->api()->paymentIntents->retrieve($paymentIntentId));
    }

    public function cancelar(string $paymentIntentId): void
    {
        try {
            $this->api()->paymentIntents->cancel($paymentIntentId);
        } catch (ApiErrorException) {
            // ya cancelado o finalizado
        }
    }

    public function reembolsar(string $paymentIntentId): void
    {
        $this->llamar(fn () => $this->api()->refunds->create(['payment_intent' => $paymentIntentId]));
    }

    /** Mensaje en español para los rechazos de Stripe. */
    public static function mensajeRechazo(?string $declineCode, ?string $code): string
    {
        return match ($declineCode ?? $code) {
            'insufficient_funds' => 'Pago rechazado por el banco emisor: fondos insuficientes.',
            'lost_card', 'stolen_card' => 'Pago rechazado: la tarjeta está reportada como perdida o robada.',
            'expired_card' => 'Pago rechazado: la tarjeta está vencida.',
            'incorrect_cvc', 'invalid_cvc' => 'Pago rechazado: el código de seguridad (CVC) es incorrecto.',
            'processing_error' => 'Ocurrió un error al procesar la tarjeta. Intente nuevamente.',
            'card_velocity_exceeded', 'withdrawal_count_limit_exceeded' => 'Pago rechazado: se superó el límite de la tarjeta.',
            'authentication_required' => 'El banco exige autenticación (3D Secure). Intente nuevamente.',
            default => 'Pago rechazado por el banco emisor. Pruebe con otra tarjeta.',
        };
    }

    /** Ejecuta una llamada a Stripe y traduce los errores de conexión o configuración. */
    private function llamar(callable $fn): mixed
    {
        try {
            return $fn();
        } catch (\Stripe\Exception\AuthenticationException) {
            throw new ErrorNegocio('La clave de Stripe no es válida. Revise STRIPE_SECRET en el .env.', 500);
        } catch (\Stripe\Exception\ApiConnectionException) {
            throw new ErrorNegocio('No se pudo conectar con Stripe. Intente nuevamente en unos minutos.', 503);
        } catch (\Stripe\Exception\InvalidRequestException $e) {
            throw new ErrorNegocio('Stripe rechazó la solicitud: '.$e->getMessage());
        }
    }
}
