<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MantenimientoServicio;
use App\Services\PermisoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Panel analítico: métricas del negocio + flujo de accesos al sitio. */
class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        MantenimientoServicio::ejecutarSiCorresponde();
        $dias = max(7, min(90, $request->integer('dias', 30)));
        $desde = now()->subDays($dias - 1)->startOfDay();
        $vendido = FinanzasController::VENDIDO;

        $kpi = DB::table('pedido')->whereIn('estado', $vendido)->where('fecha', '>=', $desde)
            ->selectRaw('COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS ventas, COALESCE(AVG(total), 0) AS ticket')->first();

        return response()->json([
            'dias' => $dias,
            'negocio' => [
                'ventas' => (float) $kpi->ventas,
                'pedidos' => (int) $kpi->pedidos,
                'ticket_promedio' => round((float) $kpi->ticket, 2),
                'cobrado' => (float) DB::table('pago')->where('estado', 'pagado')->where('fecha', '>=', $desde)->sum('monto'),
                'clientes' => DB::table('usuario as u')->join('rol as r', 'r.id', '=', 'u.rol_id')->where('r.nombre', 'Cliente')->where('u.estado', 'activo')->count(),
                'productores' => DB::table('emprendimiento')->where('estado', 'activo')->count(),
                'pedidos_por_atender' => DB::table('pedido')->whereIn('estado', ['confirmado', 'listo_entrega'])->count(),
                'pagos_por_verificar' => DB::table('pago')->where('estado', 'pendiente')->count(),
                'produccion_por_validar' => DB::table('produccion')->where('estado', 'reportada')->count(),
                'alertas_activas' => DB::table('alerta_inventario')->where('estado', 'activa')->count(),
                'encargos_nuevos' => DB::table('encargo')->where('estado', 'solicitado')->count(),
            ],
            'ventas_por_dia' => DB::table('pedido')->whereIn('estado', $vendido)->where('fecha', '>=', $desde)
                ->groupByRaw('fecha::date')->orderByRaw('fecha::date')
                ->get([DB::raw('fecha::date AS dia'), DB::raw('COUNT(*) AS pedidos'), DB::raw('SUM(total) AS ventas')]),
            'top_productos' => DB::table('detalle_pedido as dp')->join('pedido as p', 'p.id', '=', 'dp.pedido_id')
                ->join('producto as pr', 'pr.id', '=', 'dp.producto_id')
                ->whereIn('p.estado', $vendido)->where('p.fecha', '>=', $desde)
                ->groupBy('pr.nombre')->orderByDesc('monto')->limit(6)
                ->get(['pr.nombre as producto', DB::raw('SUM(dp.cantidad) AS cantidad'), DB::raw('SUM(dp.subtotal) AS monto')]),
            'pedidos_por_estado' => DB::table('pedido as p')->whereExists(fn ($q) => $q->from('entrega as en')->whereColumn('en.pedido_id', 'p.id'))
                ->groupBy('estado')->get(['estado', DB::raw('COUNT(*) AS total')]),
            'ventas_por_comunidad' => DB::table('reserva_lote as rl')->join('detalle_pedido as dp', 'dp.id', '=', 'rl.detalle_pedido_id')
                ->join('pedido as p', 'p.id', '=', 'dp.pedido_id')->join('lote as l', 'l.id', '=', 'rl.lote_id')
                ->join('produccion as pr', 'pr.id', '=', 'l.produccion_id')->join('emprendimiento as e', 'e.id', '=', 'pr.emprendimiento_id')
                ->join('comunidad as c', 'c.id', '=', 'e.comunidad_id')
                ->whereIn('p.estado', $vendido)->where('p.fecha', '>=', $desde)
                ->groupBy('c.nombre')->orderByDesc('monto')
                ->get(['c.nombre as comunidad', DB::raw('SUM(rl.cantidad * dp.precio_unitario) AS monto')]),
            'accesos' => [
                'visitas_total' => (int) DB::table('visita_pagina')->sum('contador'),
                'paginas' => DB::table('visita_pagina')->orderByDesc('contador')->limit(8)->get(['pagina', 'contador', 'ultima_visita']),
                'logins_por_dia' => DB::table('bitacora')->where('fecha', '>=', $desde)->whereIn('accion', ['login_ok', 'login_fallido'])
                    ->groupByRaw('fecha::date')->orderByRaw('fecha::date')
                    ->get([DB::raw('fecha::date AS dia'), DB::raw("COUNT(*) FILTER (WHERE accion = 'login_ok') AS exitosos"),
                        DB::raw("COUNT(*) FILTER (WHERE accion = 'login_fallido') AS fallidos")]),
                'recursos' => DB::table('bitacora')->where('fecha', '>=', $desde)->whereNotNull('recurso')->whereNotIn('recurso', ['auth'])
                    ->groupBy('recurso')->orderByDesc('total')->limit(8)->get(['recurso', DB::raw('COUNT(*) AS total')]),
                'ips' => DB::table('bitacora')->where('fecha', '>=', $desde)->groupBy('ip')->orderByDesc('total')->limit(5)
                    ->get(['ip', DB::raw('COUNT(*) AS total'), DB::raw("COUNT(*) FILTER (WHERE accion = 'login_fallido') AS fallidos")]),
                'logins_ok' => DB::table('bitacora')->where('fecha', '>=', $desde)->where('accion', 'login_ok')->count(),
                'logins_fallidos' => DB::table('bitacora')->where('fecha', '>=', $desde)->where('accion', 'login_fallido')->count(),
                'accesos_denegados' => DB::table('bitacora')->where('fecha', '>=', $desde)->where('accion', 'acceso_denegado')->count(),
            ],
        ]);
    }

    /** Resumen del panel de inicio según el rol del usuario. */
    public function resumenUsuario(Request $request): JsonResponse
    {
        $u = $request->user();
        $r = ['rol' => $u->nombreRol()];

        if ($u->esCliente()) {
            $r['pedidos_activos'] = DB::table('pedido as p')->where('cliente_id', $u->id)->whereNotIn('estado', ['entregado', 'cancelado'])
                ->whereExists(fn ($q) => $q->from('entrega as en')->whereColumn('en.pedido_id', 'p.id'))->count();
            $r['saldo_pendiente'] = (float) DB::table('v_saldo_pedido as s')->join('pedido as p', 'p.id', '=', 's.pedido_id')
                ->where('p.cliente_id', $u->id)->where('p.estado', '!=', 'cancelado')
                ->whereExists(fn ($q) => $q->from('entrega as en')->whereColumn('en.pedido_id', 'p.id'))->sum('s.saldo_pendiente');
            $r['encargos_activos'] = DB::table('encargo')->where('cliente_id', $u->id)->whereIn('estado', ['solicitado', 'aceptado', 'disponible'])->count();
            $r['cuotas_pendientes'] = DB::table('cuota_pago as c')->join('plan_pago as pl', 'pl.id', '=', 'c.plan_pago_id')
                ->where('pl.usuario_id', $u->id)->where('pl.estado', 'vigente')->whereIn('c.estado', ['pendiente', 'vencida'])->count();
            $r['ultimos_pedidos'] = DB::table('pedido as p')->join('v_saldo_pedido as s', 's.pedido_id', '=', 'p.id')
                ->where('p.cliente_id', $u->id)->whereExists(fn ($q) => $q->from('entrega as en')->whereColumn('en.pedido_id', 'p.id'))
                ->orderByDesc('p.id')->limit(5)->get(['p.id', 'p.numero', 'p.fecha', 'p.estado', 'p.total', 's.saldo_pendiente']);
        } elseif ($u->esProductor()) {
            $e = $u->emprendimiento;
            $r['emprendimiento'] = $e?->only(['id', 'nombre', 'rubro', 'estado']);
            if ($e) {
                $r['produccion'] = DB::table('produccion')->where('emprendimiento_id', $e->id)->groupBy('estado')->selectRaw('estado, COUNT(*) AS n')->pluck('n', 'estado');
                $r['stock_lotes'] = (float) DB::table('lote as l')->join('produccion as pr', 'pr.id', '=', 'l.produccion_id')
                    ->where('pr.emprendimiento_id', $e->id)->where('l.estado', 'disponible')->sum('l.stock_disponible');
                $r['vendido'] = (float) DB::table('reserva_lote as rl')->join('lote as l', 'l.id', '=', 'rl.lote_id')
                    ->join('produccion as pr', 'pr.id', '=', 'l.produccion_id')->join('detalle_pedido as dp', 'dp.id', '=', 'rl.detalle_pedido_id')
                    ->where('pr.emprendimiento_id', $e->id)->where('rl.estado', 'confirmada')->sum(DB::raw('rl.cantidad * dp.precio_unitario'));
                $r['lotes'] = DB::table('lote as l')->join('produccion as pr', 'pr.id', '=', 'l.produccion_id')->join('producto as p', 'p.id', '=', 'pr.producto_id')
                    ->where('pr.emprendimiento_id', $e->id)->orderByDesc('l.id')->limit(5)
                    ->get(['l.codigo', 'p.nombre as producto', 'l.stock_disponible', 'l.estado', 'l.fecha_vencimiento']);
            }
        } else {
            $r['pedidos_por_atender'] = DB::table('pedido')->whereIn('estado', ['confirmado', 'listo_entrega'])->count();
            $r['pagos_por_verificar'] = DB::table('pago')->where('estado', 'pendiente')->count();
            $r['produccion_por_validar'] = DB::table('produccion')->where('estado', 'reportada')->count();
            $r['alertas_activas'] = DB::table('alerta_inventario')->where('estado', 'activa')->count();
            $r['encargos_nuevos'] = DB::table('encargo')->where('estado', 'solicitado')->count();
            $r['entregas_pendientes'] = DB::table('entrega as en')->join('pedido as p', 'p.id', '=', 'en.pedido_id')
                ->whereIn('en.estado', ['pendiente', 'en_camino'])->where('p.estado', 'listo_entrega')->count();
            $r['puede_dashboard'] = PermisoServicio::puede($u, 'dashboard');
        }

        return response()->json($r);
    }
}
