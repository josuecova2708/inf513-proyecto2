<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** CU7: indicadores financieros (portado de IndicadorHandler del 1er parcial + planes de pago). */
class FinanzasController extends Controller
{
    public const VENDIDO = ['confirmado', 'listo_entrega', 'entregado'];

    public function indicadores(Request $request): JsonResponse
    {
        $f = $request->validate([
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date', 'after_or_equal:desde'],
        ], ['hasta.after_or_equal' => 'La fecha "hasta" no puede ser anterior a la fecha "desde".']);
        $desde = $f['desde'] ?? now()->subDays(29)->toDateString();
        $hasta = $f['hasta'] ?? now()->toDateString();
        $rango = fn ($q, $col = 'fecha') => $q->where($col, '>=', $desde)->whereRaw("$col < ?::date + 1", [$hasta]);

        $ventas = $rango(DB::table('pedido')->whereIn('estado', self::VENDIDO))
            ->selectRaw('COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS ventas, COALESCE(ROUND(AVG(total), 2), 0) AS ticket')->first();
        $cancelados = $rango(DB::table('pedido')->where('estado', 'cancelado'))->count();
        $cobrado = (float) $rango(DB::table('pago')->where('estado', 'pagado'))->sum('monto');
        $porCobrar = (float) DB::table('v_saldo_pedido as s')->join('pedido as p', 'p.id', '=', 's.pedido_id')
            ->where('p.estado', '!=', 'cancelado')->where('s.saldo_pendiente', '>', 0)
            ->whereExists(fn ($q) => $q->from('entrega as en')->whereColumn('en.pedido_id', 'p.id'))->sum('s.saldo_pendiente');

        // Margen bruto: ingreso de lo vendido vs costo del lote de origen (reservas confirmadas)
        $m = DB::table('reserva_lote as rl')->join('detalle_pedido as dp', 'dp.id', '=', 'rl.detalle_pedido_id')
            ->join('pedido as p', 'p.id', '=', 'dp.pedido_id')->join('lote as l', 'l.id', '=', 'rl.lote_id')
            ->where('rl.estado', 'confirmada')->where('p.fecha', '>=', $desde)->whereRaw('p.fecha < ?::date + 1', [$hasta])
            ->selectRaw('COALESCE(SUM(rl.cantidad * dp.precio_unitario), 0) AS ingreso, COALESCE(SUM(rl.cantidad * COALESCE(l.costo_unitario, 0)), 0) AS costo')->first();
        $inventario = DB::table('lote as l')->join('produccion as pr', 'pr.id', '=', 'l.produccion_id')->join('producto as p', 'p.id', '=', 'pr.producto_id')
            ->where('l.estado', '!=', 'vencido')
            ->selectRaw('COALESCE(SUM((l.stock_disponible + l.stock_reservado) * COALESCE(l.costo_unitario, 0)), 0) AS costo,
                         COALESCE(SUM((l.stock_disponible + l.stock_reservado) * p.precio_venta), 0) AS venta')->first();

        $cuotas = DB::table('cuota_pago as c')->join('plan_pago as pl', 'pl.id', '=', 'c.plan_pago_id')->where('pl.estado', 'vigente')
            ->selectRaw("COALESCE(SUM(c.monto) FILTER (WHERE c.estado = 'pendiente'), 0) AS pendiente,
                         COALESCE(SUM(c.monto) FILTER (WHERE c.estado = 'vencida'), 0) AS vencida,
                         COUNT(*) FILTER (WHERE c.estado = 'vencida') AS cuotas_vencidas,
                         COUNT(DISTINCT pl.id) AS planes_vigentes")->first();

        $ingreso = (float) $m->ingreso;
        $costo = (float) $m->costo;

        return response()->json([
            'periodo' => ['desde' => $desde, 'hasta' => $hasta],
            'kpi' => [
                'pedidos' => (int) $ventas->pedidos,
                'cancelados' => $cancelados,
                'ventas' => (float) $ventas->ventas,
                'ticket_promedio' => (float) $ventas->ticket,
                'cobrado' => $cobrado,
                'por_cobrar' => $porCobrar,
                'ingreso_vendido' => $ingreso,
                'costo_vendido' => $costo,
                'margen_bruto' => round($ingreso - $costo, 2),
                'margen_porcentaje' => $ingreso > 0 ? round(($ingreso - $costo) * 100 / $ingreso, 1) : null,
                'inventario_costo' => (float) $inventario->costo,
                'inventario_venta' => (float) $inventario->venta,
                'cuotas_pendientes' => (float) $cuotas->pendiente,
                'cuotas_vencidas_monto' => (float) $cuotas->vencida,
                'cuotas_vencidas' => (int) $cuotas->cuotas_vencidas,
                'planes_vigentes' => (int) $cuotas->planes_vigentes,
            ],
            'ingresos_por_dia' => $rango(DB::table('pago')->where('estado', 'pagado'))
                ->groupByRaw('fecha::date')->orderByRaw('fecha::date')
                ->get([DB::raw('fecha::date AS dia'), DB::raw('SUM(monto) AS monto')]),
            'por_metodo' => $rango(DB::table('pago as pa')->join('metodo_pago as mp', 'mp.id', '=', 'pa.metodo_pago_id')->where('pa.estado', 'pagado'), 'pa.fecha')
                ->groupBy('mp.nombre')->orderByDesc('monto')
                ->get(['mp.nombre as metodo', DB::raw('COUNT(pa.id) AS pagos'), DB::raw('SUM(pa.monto) AS monto')]),
            'margen_por_producto' => DB::table('reserva_lote as rl')->join('detalle_pedido as dp', 'dp.id', '=', 'rl.detalle_pedido_id')
                ->join('pedido as p', 'p.id', '=', 'dp.pedido_id')->join('lote as l', 'l.id', '=', 'rl.lote_id')
                ->join('producto as pr', 'pr.id', '=', 'dp.producto_id')
                ->where('rl.estado', 'confirmada')->where('p.fecha', '>=', $desde)->whereRaw('p.fecha < ?::date + 1', [$hasta])
                ->groupBy('pr.nombre')->orderByDesc('ingreso')
                ->get(['pr.nombre as producto', DB::raw('SUM(rl.cantidad * dp.precio_unitario) AS ingreso'),
                    DB::raw('SUM(rl.cantidad * COALESCE(l.costo_unitario, 0)) AS costo')]),
            'cuentas_por_cobrar' => DB::table('v_saldo_pedido as s')->join('pedido as p', 'p.id', '=', 's.pedido_id')
                ->join('usuario as u', 'u.id', '=', 'p.cliente_id')->leftJoin('plan_pago as pl', 'pl.pedido_id', '=', 'p.id')
                ->where('p.estado', '!=', 'cancelado')->where('s.saldo_pendiente', '>', 0)
                ->whereExists(fn ($q) => $q->from('entrega as en')->whereColumn('en.pedido_id', 'p.id'))
                ->orderBy('p.fecha')->limit(50)
                ->get(['p.id', 'p.numero', 'p.fecha', 'p.estado', 's.total', 's.cobrado', 's.saldo_pendiente', 'pl.id as plan_id',
                    DB::raw("u.nombre || ' ' || u.apellido AS cliente")]),
        ]);
    }
}
