<?php

namespace App\Services;

use App\Exceptions\ErrorNegocio;
use App\Models\Usuario;
use App\Services\Pagos\PasarelaPago;
use App\Services\Pagos\ResultadoPago;
use Illuminate\Support\Facades\DB;

/** Procesamiento de transacciones (pagos únicos y cuotas) a través de la pasarela. */
class PagoServicio
{
    public function __construct(private PasarelaPago $pasarela) {}

    /**
     * Registra un pago contra un pedido. Devuelve [pago_id, ResultadoPago].
     *
     * @return array{0: int, 1: ResultadoPago}
     */
    public function procesar(object $pedido, Usuario $usuario, int $metodoId, float $monto, ?int $metodoUsuarioId, ?string $referencia, ?int $cuotaId = null): array
    {
        $metodo = DB::table('metodo_pago')->where('id', $metodoId)->where('habilitado', true)->first()
            ?? throw new ErrorNegocio('El método de pago no está habilitado.');

        $tarjeta = null;
        if ($metodo->nombre === 'Tarjeta') {
            if (! $metodoUsuarioId) {
                throw new ErrorNegocio('Seleccione una de sus tarjetas registradas.');
            }
            $tarjeta = DB::table('metodo_pago_usuario')->where('id', $metodoUsuarioId)->where('estado', 'activo')->first();
            if (! $tarjeta || $tarjeta->usuario_id !== $pedido->cliente_id || $tarjeta->metodo_pago_id !== $metodo->id) {
                throw new ErrorNegocio('La tarjeta seleccionada no es válida.');
            }
        }
        if ($metodo->nombre === 'Transferencia' && ! $referencia) {
            throw new ErrorNegocio('Indique el número de comprobante de la transferencia.');
        }

        $r = $this->pasarela->cobrar([
            'metodo' => $metodo->nombre, 'monto' => $monto, 'pedido' => $pedido->numero,
            'cliente_id' => $pedido->cliente_id, 'staff' => $usuario->esStaff(), 'tarjeta' => $tarjeta, 'referencia' => $referencia,
        ]);

        $pagoId = DB::table('pago')->insertGetId([
            'pedido_id' => $pedido->id, 'metodo_pago_id' => $metodo->id, 'monto' => $monto, 'fecha' => now(),
            'estado' => $r->estado, 'referencia' => $referencia, 'codigo_transaccion' => $r->codigoTransaccion,
            'metodo_pago_usuario_id' => $tarjeta?->id, 'cuota_pago_id' => $cuotaId, 'registrado_por' => $usuario->id,
        ]);

        $this->despuesDePago($pagoId, $r->estado, $usuario->id);

        return [$pagoId, $r];
    }

    /** Efectos de un pago al quedar pagado/rechazado (también se usa al verificar pagos pendientes). */
    public function despuesDePago(int $pagoId, string $estado, ?int $gestor): void
    {
        $pago = DB::table('pago as pa')->join('pedido as pe', 'pe.id', '=', 'pa.pedido_id')
            ->where('pa.id', $pagoId)->first(['pa.*', 'pe.numero', 'pe.cliente_id', 'pe.estado as estado_pedido']);

        if ($estado === 'rechazado') {
            NotificacionServicio::notificar($pago->cliente_id, 'pago_rechazado',
                "El pago de Bs. ".number_format($pago->monto, 2)." del pedido {$pago->numero} fue RECHAZADO.", $pago->pedido_id);

            return;
        }
        if ($estado === 'pendiente') {
            NotificacionServicio::notificarStaff('pago_confirmado', "Pago pendiente de verificación: Bs. ".number_format($pago->monto, 2)." del pedido {$pago->numero}.", $pago->pedido_id);

            return;
        }
        if ($estado !== 'pagado') {
            return;
        }

        NotificacionServicio::notificar($pago->cliente_id, 'pago_confirmado',
            "Recibimos tu pago de Bs. ".number_format($pago->monto, 2)." del pedido {$pago->numero}.", $pago->pedido_id);

        if ($pago->cuota_pago_id) {
            DB::table('cuota_pago')->where('id', $pago->cuota_pago_id)->update(['estado' => 'pagada', 'fecha_pago' => now()]);
            $plan = DB::table('cuota_pago')->where('id', $pago->cuota_pago_id)->value('plan_pago_id');
            $pendientes = DB::table('cuota_pago')->where('plan_pago_id', $plan)->where('estado', '!=', 'pagada')->count();
            if ($pendientes === 0) {
                DB::table('plan_pago')->where('id', $plan)->update(['estado' => 'pagado']);
            }
            // Venta a crédito: con la primera cuota pagada el pedido queda confirmado
            if ($pago->estado_pedido === 'pendiente') {
                DB::update('UPDATE pedido SET estado = \'confirmado\', gestionado_por = COALESCE(gestionado_por, ?) WHERE id = ?', [$gestor, $pago->pedido_id]);
                NotificacionServicio::notificar($pago->cliente_id, 'pedido_confirmado',
                    "Tu pedido {$pago->numero} fue CONFIRMADO con tu plan de pagos. Recuerda pagar las siguientes cuotas a tiempo.", $pago->pedido_id);
            }

            return;
        }

        PedidoServicio::revisarPagoCompleto($pago->pedido_id, $gestor);
    }
}
