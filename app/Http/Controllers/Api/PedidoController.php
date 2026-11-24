<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PedidoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU6: procesar pedidos (listar, ver, avanzar estado, cancelar). */
class PedidoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'estado' => ['nullable', Rule::in(['pendiente', 'confirmado', 'listo_entrega', 'entregado', 'cancelado'])],
            'q' => ['nullable', 'string', 'max:80'],
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date', 'after_or_equal:desde'],
        ]);
        $u = $request->user();
        $q = DB::table('pedido as p')
            ->join('usuario as u', 'u.id', '=', 'p.cliente_id')
            ->join('v_saldo_pedido as s', 's.pedido_id', '=', 'p.id')
            ->join('entrega as en', 'en.pedido_id', '=', 'p.id')
            ->leftJoin('plan_pago as pl', 'pl.pedido_id', '=', 'p.id')
            ->when(! $u->esStaff(), fn ($w) => $w->where('p.cliente_id', $u->id))
            ->when($f['estado'] ?? null, fn ($w, $e) => $w->where('p.estado', $e))
            ->when($f['desde'] ?? null, fn ($w, $d) => $w->whereDate('p.fecha', '>=', $d))
            ->when($f['hasta'] ?? null, fn ($w, $d) => $w->whereDate('p.fecha', '<=', $d))
            ->when($f['q'] ?? null, fn ($w, $t) => $w->where(fn ($x) => $x->where('p.numero', 'ilike', $this->like($t))
                ->orWhereRaw("u.nombre || ' ' || u.apellido ILIKE ?", [$this->like($t)])))
            ->orderByDesc('p.id')
            ->select('p.id', 'p.numero', 'p.fecha', 'p.estado', 'p.origen', 'p.total', 's.cobrado', 's.saldo_pendiente',
                'en.tipo as tipo_entrega', 'en.estado as estado_entrega', 'pl.id as plan_id',
                DB::raw("u.nombre || ' ' || u.apellido AS cliente"));

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $p = PedidoServicio::pedidoPara($id, $request->user(), false);
        $cliente = DB::table('usuario')->where('id', $p->cliente_id)->first(['id', 'nombre', 'apellido', 'email', 'telefono', 'direccion']);
        $detalles = DB::table('detalle_pedido as dp')->join('producto as pr', 'pr.id', '=', 'dp.producto_id')
            ->where('dp.pedido_id', $id)->orderBy('pr.nombre')
            ->get(['dp.id', 'dp.producto_id', 'pr.nombre', 'pr.unidad_medida', 'dp.cantidad', 'dp.precio_unitario', 'dp.subtotal']);
        $pagos = DB::table('pago as pa')->join('metodo_pago as mp', 'mp.id', '=', 'pa.metodo_pago_id')
            ->leftJoin('metodo_pago_usuario as mu', 'mu.id', '=', 'pa.metodo_pago_usuario_id')
            ->leftJoin('cuota_pago as cu', 'cu.id', '=', 'pa.cuota_pago_id')
            ->where('pa.pedido_id', $id)->orderBy('pa.id')
            ->get(['pa.id', 'mp.nombre as metodo', 'pa.monto', 'pa.estado', 'pa.fecha', 'pa.referencia', 'pa.codigo_transaccion',
                'mu.alias as metodo_guardado', 'mu.ultimos4', 'cu.numero as cuota_numero']);
        $trazabilidad = DB::table('v_trazabilidad')->where('pedido', $p->numero)->get();
        $saldo = DB::table('v_saldo_pedido')->where('pedido_id', $id)->first(['cobrado', 'saldo_pendiente']);
        $plan = DB::table('plan_pago')->where('pedido_id', $id)->first();
        if ($plan) {
            $plan->cuotas = DB::table('cuota_pago')->where('plan_pago_id', $plan->id)->orderBy('numero')->get();
        }

        return response()->json([
            'pedido' => $p->only(['id', 'numero', 'fecha', 'estado', 'origen', 'subtotal', 'costo_envio', 'total', 'nit_ci', 'razon_social', 'encargo_id']),
            'cliente' => $cliente,
            'detalles' => $detalles,
            'entrega' => DB::table('entrega')->where('pedido_id', $id)->first(),
            'pagos' => $pagos,
            'saldo' => $saldo,
            'plan' => $plan,
            'trazabilidad' => $trazabilidad,
            'gestor' => $p->gestionado_por ? DB::table('usuario')->where('id', $p->gestionado_por)->value(DB::raw("nombre || ' ' || apellido")) : null,
            'transiciones' => array_keys(array_filter(PedidoServicio::TRANSICIONES, fn ($desde) => $desde === $p->estado)),
        ]);
    }

    public function cambiarEstado(Request $request, int $id): JsonResponse
    {
        $d = $request->validate([
            'estado' => ['required', Rule::in(array_keys(PedidoServicio::TRANSICIONES))],
            'fecha_programada' => ['nullable', 'required_if:estado,listo_entrega', 'date', 'after:now'],
        ], [
            'fecha_programada.required_if' => 'Indique la fecha y hora aproximada de la entrega.',
            'fecha_programada.after' => 'La fecha y hora de entrega deben ser posteriores a este momento.',
        ]);
        $msg = DB::transaction(fn () => PedidoServicio::cambiarEstado(
            PedidoServicio::pedidoPara($id, $request->user()), $d['estado'], $request->user(), $d['fecha_programada'] ?? null));

        return $this->mensaje($msg);
    }

    public function cancelar(Request $request, int $id): JsonResponse
    {
        $msg = DB::transaction(fn () => PedidoServicio::cancelar(PedidoServicio::pedidoPara($id, $request->user()), $request->user()));

        return $this->mensaje($msg);
    }
}
