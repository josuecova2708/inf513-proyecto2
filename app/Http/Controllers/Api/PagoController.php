<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Services\PagoServicio;
use App\Services\Pagos\ResultadoPago;
use App\Services\PedidoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU6: pagos multicanal (QR, efectivo, tarjeta, transferencia) — pagos únicos. */
class PagoController extends Controller
{
    public function metodos(): JsonResponse
    {
        return response()->json(DB::table('metodo_pago')->where('habilitado', true)->orderBy('id_metodo_pago')->get(['*', 'id_metodo_pago as id']));
    }

    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'estado' => ['nullable', Rule::in(['pendiente', 'pagado', 'rechazado', 'anulado', 'devuelto'])],
            'metodo_pago_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:80'],
        ]);
        $u = $request->user();
        $q = DB::table('pago as pa')
            ->join('pedido as pe', 'pe.id_pedido', '=', 'pa.pedido_id')
            ->join('usuario as u', 'u.id_usuario', '=', 'pe.cliente_id')
            ->join('metodo_pago as mp', 'mp.id_metodo_pago', '=', 'pa.metodo_pago_id')
            ->leftJoin('metodo_pago_usuario as mu', 'mu.id_metodo_pago_usuario', '=', 'pa.metodo_pago_usuario_id')
            ->leftJoin('cuota_pago as cu', 'cu.id_cuota_pago', '=', 'pa.cuota_pago_id')
            ->when(! $u->esStaff(), fn ($w) => $w->where('pe.cliente_id', $u->id))
            ->when($f['estado'] ?? null, fn ($w, $e) => $w->where('pa.estado', $e))
            ->when($f['metodo_pago_id'] ?? null, fn ($w, $m) => $w->where('pa.metodo_pago_id', $m))
            ->when($f['q'] ?? null, fn ($w, $t) => $w->where(fn ($x) => $x->where('pe.numero', 'ilike', $this->like($t))
                ->orWhere('pa.codigo_transaccion', 'ilike', $this->like($t))->orWhereRaw("u.nombre || ' ' || u.apellido ILIKE ?", [$this->like($t)])))
            ->orderByRaw("CASE pa.estado WHEN 'pendiente' THEN 0 ELSE 1 END")->orderByDesc('pa.id_pago')
            ->select('pa.*', 'pa.id_pago as id', 'pe.numero', 'mp.nombre as metodo', 'mu.alias as metodo_guardado', 'mu.marca', 'mu.ultimos4', 'cu.numero as cuota_numero',
                DB::raw("u.nombre || ' ' || u.apellido AS cliente"));

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    /** Pago único (total o parcial) de un pedido. */
    public function pagar(Request $request, int $id, PagoServicio $servicio): JsonResponse
    {
        $d = $request->validate([
            'metodo_pago_id' => ['required', 'integer', 'exists:metodo_pago,id_metodo_pago'],
            'monto' => ['nullable', 'numeric', 'gt:0', 'max:1000000'],
            'metodo_pago_usuario_id' => ['nullable', 'integer'],
            'referencia' => ['nullable', 'string', 'max:100'],
        ], ['monto.gt' => 'El monto debe ser mayor que 0.']);
        $u = $request->user();

        [$pagoId, $r] = DB::transaction(function () use ($d, $id, $u, $servicio) {
            $p = PedidoServicio::pedidoPara($id, $u);
            if ($p->estado === 'cancelado') {
                throw new ErrorNegocio('El pedido está cancelado: no admite pagos.');
            }
            if (DB::table('plan_pago')->where('pedido_id', $id)->where('estado', 'vigente')->exists()) {
                throw new ErrorNegocio('Este pedido tiene un plan de pagos: pague desde sus cuotas.');
            }
            $servicio->sincronizarPendientesStripe($id);
            $saldo = (float) DB::table('v_saldo_pedido')->where('pedido_id', $id)->value('saldo_pendiente');
            $pendiente = (float) DB::table('pago')->where('pedido_id', $id)->where('estado', 'pendiente')->sum('monto');
            if ($saldo - $pendiente <= 0.004) {
                throw new ErrorNegocio($pendiente > 0 ? 'Ya existe un pago pendiente de verificación por el saldo del pedido.' : 'El pedido no tiene saldo pendiente.');
            }
            $monto = round((float) ($d['monto'] ?? ($saldo - $pendiente)), 2);
            if ($monto > round($saldo - $pendiente, 2)) {
                throw new ErrorNegocio('El monto supera el saldo pendiente (Bs. '.number_format($saldo - $pendiente, 2).').');
            }

            return $servicio->procesar($p, $u, (int) $d['metodo_pago_id'], $monto, $d['metodo_pago_usuario_id'] ?? null, $d['referencia'] ?? null);
        });

        return self::respuestaPago($pagoId, $r);
    }

    /** Respuesta común de pago (pedido o cuota). Con 3D Secure incluye el client_secret para el navegador. */
    public static function respuestaPago(int $pagoId, ResultadoPago $r): JsonResponse
    {
        return response()->json(array_filter([
            'message' => $r->mensaje, 'pago_id' => $pagoId, 'estado' => $r->estado, 'codigo_transaccion' => $r->codigoTransaccion,
            'requiere_accion' => $r->requiereAccion() ?: null, 'client_secret' => $r->clientSecret,
        ], fn ($v) => $v !== null), $r->estado === 'rechazado' ? 422 : 201);
    }

    /** Después del 3D Secure: el servidor consulta a Stripe y registra el resultado real. */
    public function confirmar(Request $request, int $id, PagoServicio $servicio): JsonResponse
    {
        [$estado, $mensaje] = DB::transaction(fn () => $servicio->confirmarStripe($id, $request->user()));

        return response()->json(['message' => $mensaje, 'estado' => $estado], $estado === 'rechazado' ? 422 : 200);
    }

    /** El personal confirma (o rechaza/anula) un pago pendiente: QR, transferencia o efectivo contra entrega. */
    public function verificar(Request $request, int $id, PagoServicio $servicio): JsonResponse
    {
        $d = $request->validate(['estado' => ['required', Rule::in(['pagado', 'rechazado', 'anulado'])]]);
        if (! $request->user()->esStaff()) {
            throw new ErrorNegocio('Solo el personal de FEDER puede verificar pagos.', 403);
        }
        DB::transaction(function () use ($d, $id, $request, $servicio) {
            $pago = DB::table('pago')->where('id_pago', $id)->lockForUpdate()->first(['*', 'id_pago as id']) ?? throw new ErrorNegocio('El pago no existe.', 404);
            if ($pago->estado !== 'pendiente' && ! ($pago->estado === 'pagado' && $d['estado'] === 'anulado')) {
                throw new ErrorNegocio("El pago ya está {$pago->estado}.");
            }
            DB::table('pago')->where('id_pago', $id)->update(['estado' => $d['estado'], 'usuario_id' => $request->user()->id]);
            $servicio->despuesDePago($id, $d['estado'], $request->user()->id);
        });

        return $this->mensaje('Pago '.mb_strtoupper($d['estado']).'.');
    }
}
