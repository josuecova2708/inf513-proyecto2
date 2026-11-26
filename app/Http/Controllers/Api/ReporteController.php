<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * CU8: reportes y estadísticas (equivalentes a REPVEN, REPINV, REPPED, REPENC, REPMET, REPING, REPPRD
 * del 1er parcial). Cada reporte devuelve columnas + filas (tabla) y una serie para graficar.
 */
class ReporteController extends Controller
{
    public const TIPOS = ['ventas', 'inventario', 'pedidos', 'encargos', 'metodos', 'ingresos', 'produccion'];

    public function generar(Request $request, string $tipo): JsonResponse
    {
        abort_unless(in_array($tipo, self::TIPOS, true), 404, 'El reporte solicitado no existe.');
        $f = $request->validate([
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date', 'after_or_equal:desde'],
        ], ['hasta.after_or_equal' => 'La fecha "hasta" no puede ser anterior a la fecha "desde".']);
        $desde = $f['desde'] ?? now()->subDays(29)->toDateString();
        $hasta = $f['hasta'] ?? now()->toDateString();
        $entre = fn ($q, $col) => $q->where($col, '>=', $desde)->whereRaw("$col < ?::date + 1", [$hasta]);

        [$titulo, $columnas, $filas, $grafico] = match ($tipo) {
            'ventas' => [
                'Ventas por producto',
                ['producto' => 'Producto', 'categoria' => 'Categoría', 'cantidad' => 'Cantidad', 'pedidos' => 'Pedidos', 'monto' => 'Monto (Bs.)'],
                $entre(DB::table('detalle_pedido as dp')->join('pedido as p', 'p.id_pedido', '=', 'dp.pedido_id')
                    ->join('producto as pr', 'pr.id_producto', '=', 'dp.producto_id')->join('categoria as c', 'c.id_categoria', '=', 'pr.categoria_id')
                    ->whereIn('p.estado', FinanzasController::VENDIDO), 'p.fecha')
                    ->groupBy('pr.nombre', 'c.nombre')->orderByDesc('monto')
                    ->get(['pr.nombre as producto', 'c.nombre as categoria', DB::raw('SUM(dp.cantidad) AS cantidad'),
                        DB::raw('COUNT(DISTINCT p.id_pedido) AS pedidos'), DB::raw('SUM(dp.subtotal) AS monto')]),
                ['tipo' => 'barras', 'x' => 'producto', 'y' => 'monto'],
            ],
            'inventario' => [
                'Inventario y disponibilidad por producto',
                ['nombre' => 'Producto', 'stock_disponible' => 'Disponible', 'stock_reservado' => 'Reservado', 'stock_minimo' => 'Mínimo',
                    'produccion_reportada' => 'Prod. reportada', 'produccion_futura' => 'Prod. futura', 'estado' => 'Estado'],
                DB::table('v_disponibilidad_producto')->orderBy('nombre')->get()->map(function ($r) {
                    $r->estado = (float) $r->stock_disponible < (float) $r->stock_minimo ? 'Bajo mínimo' : 'Normal';

                    return $r;
                }),
                ['tipo' => 'barras', 'x' => 'nombre', 'y' => 'stock_disponible', 'y2' => 'stock_minimo'],
            ],
            'pedidos' => [
                'Pedidos por estado y origen',
                ['estado' => 'Estado', 'inmediato' => 'Venta inmediata', 'encargo' => 'Encargo', 'total' => 'Total', 'monto' => 'Monto (Bs.)'],
                $entre(DB::table('pedido as p')->whereExists(fn ($q) => $q->from('entrega as en')->whereColumn('en.pedido_id', 'p.id_pedido')), 'p.fecha')
                    ->groupBy('p.estado')->orderByDesc('total')
                    ->get(['p.estado', DB::raw("COUNT(*) FILTER (WHERE p.origen = 'inmediato') AS inmediato"),
                        DB::raw("COUNT(*) FILTER (WHERE p.origen = 'encargo') AS encargo"), DB::raw('COUNT(*) AS total'), DB::raw('SUM(p.total) AS monto')]),
                ['tipo' => 'torta', 'x' => 'estado', 'y' => 'total'],
            ],
            'encargos' => [
                'Encargos: productos más encargados',
                ['producto' => 'Producto', 'encargos' => 'Encargos', 'cantidad' => 'Cantidad', 'solicitados' => 'Solicitados', 'convertidos' => 'Convertidos'],
                $entre(DB::table('detalle_encargo as de')->join('encargo as e', 'e.id_encargo', '=', 'de.encargo_id')->join('producto as p', 'p.id_producto', '=', 'de.producto_id'), 'e.fecha_solicitud')
                    ->groupBy('p.nombre')->orderByDesc('cantidad')
                    ->get(['p.nombre as producto', DB::raw('COUNT(DISTINCT e.id_encargo) AS encargos'), DB::raw('SUM(de.cantidad) AS cantidad'),
                        DB::raw("COUNT(*) FILTER (WHERE e.estado = 'solicitado') AS solicitados"), DB::raw("COUNT(*) FILTER (WHERE e.estado = 'convertido') AS convertidos")]),
                ['tipo' => 'barras', 'x' => 'producto', 'y' => 'cantidad'],
            ],
            'metodos' => [
                'Pagos por método y estado',
                ['metodo' => 'Método', 'pagado' => 'Pagados', 'pendiente' => 'Pendientes', 'rechazado' => 'Rechazados', 'monto' => 'Monto cobrado (Bs.)'],
                $entre(DB::table('pago as pa')->join('metodo_pago as mp', 'mp.id_metodo_pago', '=', 'pa.metodo_pago_id'), 'pa.fecha')
                    ->groupBy('mp.nombre')->orderByDesc('monto')
                    ->get(['mp.nombre as metodo', DB::raw("COUNT(*) FILTER (WHERE pa.estado = 'pagado') AS pagado"),
                        DB::raw("COUNT(*) FILTER (WHERE pa.estado = 'pendiente') AS pendiente"), DB::raw("COUNT(*) FILTER (WHERE pa.estado = 'rechazado') AS rechazado"),
                        DB::raw("COALESCE(SUM(pa.monto) FILTER (WHERE pa.estado = 'pagado'), 0) AS monto")]),
                ['tipo' => 'torta', 'x' => 'metodo', 'y' => 'monto'],
            ],
            'ingresos' => [
                'Ingresos cobrados por día',
                ['dia' => 'Día', 'pagos' => 'Pagos', 'monto' => 'Monto (Bs.)'],
                $entre(DB::table('pago')->where('estado', 'pagado'), 'fecha')->groupByRaw('fecha::date')->orderByRaw('fecha::date')
                    ->get([DB::raw('fecha::date AS dia'), DB::raw('COUNT(*) AS pagos'), DB::raw('SUM(monto) AS monto')]),
                ['tipo' => 'lineas', 'x' => 'dia', 'y' => 'monto'],
            ],
            'produccion' => [
                'Producción por productor y comunidad',
                ['emprendimiento' => 'Productor', 'comunidad' => 'Comunidad', 'producto' => 'Producto', 'reportada' => 'Reportada', 'validada' => 'Validada', 'en_lotes' => 'En lotes'],
                $entre(DB::table('produccion as pr')->join('emprendimiento as e', 'e.id_emprendimiento', '=', 'pr.emprendimiento_id')
                    ->join('comunidad as c', 'c.id_comunidad', '=', 'e.comunidad_id')->join('producto as p', 'p.id_producto', '=', 'pr.producto_id'), 'pr.fecha_registro')
                    ->groupBy('e.nombre', 'c.nombre', 'p.nombre')->orderBy('e.nombre')
                    ->get(['e.nombre as emprendimiento', 'c.nombre as comunidad', 'p.nombre as producto',
                        DB::raw("COALESCE(SUM(pr.cantidad) FILTER (WHERE pr.estado = 'reportada'), 0) AS reportada"),
                        DB::raw("COALESCE(SUM(pr.cantidad) FILTER (WHERE pr.estado = 'validada'), 0) AS validada"),
                        DB::raw('COALESCE(SUM((SELECT SUM(l.cantidad_inicial) FROM lote l WHERE l.produccion_id = pr.id_produccion)), 0) AS en_lotes')]),
                ['tipo' => 'barras', 'x' => 'emprendimiento', 'y' => 'validada'],
            ],
        };

        return response()->json([
            'tipo' => $tipo, 'titulo' => $titulo, 'periodo' => ['desde' => $desde, 'hasta' => $hasta],
            'columnas' => $columnas, 'filas' => $filas, 'grafico' => $grafico, 'generado' => now()->toDateTimeString(),
        ]);
    }
}
