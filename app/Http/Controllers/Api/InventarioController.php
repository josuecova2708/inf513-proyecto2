<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Services\MantenimientoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU4: inventario por producto (v_disponibilidad_producto) y movimientos por lote. */
class InventarioController extends Controller
{
    public function disponibilidad(Request $request): JsonResponse
    {
        MantenimientoServicio::ejecutarSiCorresponde();
        $request->validate(['q' => ['nullable', 'string', 'max:80']]);

        return response()->json(DB::table('v_disponibilidad_producto as d')
            ->join('producto as p', 'p.id_producto', '=', 'd.producto_id')
            ->join('categoria as c', 'c.id_categoria', '=', 'p.categoria_id')
            ->when($request->q, fn ($w, $t) => $w->where('p.nombre', 'ilike', $this->like($t)))
            ->where('p.estado', 'activo')
            ->orderByRaw('(d.stock_disponible < d.stock_minimo) DESC')->orderBy('p.nombre')
            ->get(['d.*', 'p.unidad_medida', 'p.modalidad_venta', 'c.nombre as categoria',
                DB::raw('(SELECT COUNT(*) FROM lote l JOIN produccion pr ON pr.id_produccion = l.produccion_id WHERE pr.producto_id = p.id_producto AND l.estado = \'disponible\') AS lotes_disponibles'),
                DB::raw('(d.stock_disponible < d.stock_minimo) AS bajo_minimo')]));
    }

    public function movimientos(Request $request): JsonResponse
    {
        $f = $request->validate([
            'tipo' => ['nullable', Rule::in(['entrada', 'salida', 'devolucion', 'ajuste'])],
            'lote_id' => ['nullable', 'integer'],
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date', 'after_or_equal:desde'],
        ]);
        $q = DB::table('movimiento_inventario as m')
            ->join('lote as l', 'l.id_lote', '=', 'm.lote_id')
            ->join('produccion as pr', 'pr.id_produccion', '=', 'l.produccion_id')
            ->join('producto as p', 'p.id_producto', '=', 'pr.producto_id')
            ->leftJoin('usuario as u', 'u.id_usuario', '=', 'm.usuario_id')
            ->when($f['tipo'] ?? null, fn ($w, $t) => $w->where('m.tipo', $t))
            ->when($f['lote_id'] ?? null, fn ($w, $l) => $w->where('m.lote_id', $l))
            ->when($f['desde'] ?? null, fn ($w, $d) => $w->whereDate('m.fecha', '>=', $d))
            ->when($f['hasta'] ?? null, fn ($w, $d) => $w->whereDate('m.fecha', '<=', $d))
            ->orderByDesc('m.id_movimiento_inventario')
            ->select('m.*', 'm.id_movimiento_inventario as id', 'l.codigo as lote', 'p.nombre as producto', 'p.unidad_medida', DB::raw("u.nombre || ' ' || u.apellido AS usuario"));

        return $this->paginado($q->paginate($this->porPagina($request, 20)));
    }

    /**
     * Ajuste o devolución manual sobre un lote. Bloquea el lote (FOR UPDATE) y además verifica la
     * versión que vio el usuario (bloqueo optimista) para evitar pisar cambios simultáneos.
     */
    public function registrarMovimiento(Request $request): JsonResponse
    {
        $d = $request->validate([
            'lote_id' => ['required', 'integer', 'exists:lote,id_lote'],
            'tipo' => ['required', Rule::in(['devolucion', 'ajuste'])],
            'cantidad' => ['required', 'numeric', 'not_in:0', 'min:-1000000', 'max:1000000'],
            'motivo' => ['required', 'string', 'min:5', 'max:200'],
            'version' => ['nullable', 'integer', 'min:0'],
        ], ['cantidad.not_in' => 'La cantidad no puede ser 0. Use un valor negativo para restar stock.']);

        $lote = DB::transaction(function () use ($d, $request) {
            $l = DB::table('lote')->where('id_lote', $d['lote_id'])->lockForUpdate()->first(['*', 'id_lote as id']);
            if (isset($d['version']) && (int) $d['version'] !== (int) $l->version) {
                throw new ErrorNegocio('El lote cambió mientras registraba el movimiento (otro usuario lo modificó). Recargue e intente de nuevo.', 409);
            }
            $cant = (float) $d['cantidad'];
            if ($d['tipo'] === 'devolucion' && $cant < 0) {
                throw new ErrorNegocio('Una devolución debe sumar stock (cantidad positiva).');
            }
            $nuevo = (float) $l->stock_disponible + $cant;
            if ($nuevo < 0) {
                throw new ErrorNegocio('El ajuste dejaría el stock en negativo (disponible: '.(float) $l->stock_disponible.').');
            }
            DB::table('lote')->where('id_lote', $l->id)->update([
                'stock_disponible' => $nuevo,
                'estado' => $l->estado === 'vencido' ? 'vencido' : ($nuevo > 0 ? 'disponible' : 'agotado'),
                'version' => DB::raw('version + 1'),
            ]);
            DB::table('movimiento_inventario')->insert([
                'lote_id' => $l->id, 'usuario_id' => $request->user()->id, 'tipo' => $d['tipo'],
                'cantidad' => $cant, 'motivo' => $d['motivo'], 'fecha' => now(),
            ]);
            $producto = DB::table('produccion')->where('id_produccion', $l->produccion_id)->value('producto_id');
            DB::select('SELECT fn_revisar_stock_minimo(?)', [$producto]);

            return DB::table('lote')->where('id_lote', $l->id)->first(['*', 'id_lote as id']);
        });

        return $this->mensaje("Movimiento registrado. Stock del lote {$lote->codigo}: ".(float) $lote->stock_disponible.'.', ['lote' => $lote], 201);
    }
}
