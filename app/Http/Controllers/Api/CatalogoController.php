<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MantenimientoServicio;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Catálogo público (CU4/CU5): productos activos con su disponibilidad real. */
class CatalogoController extends Controller
{
    private function base(): Builder
    {
        return DB::table('producto as p')
            ->join('categoria as c', 'c.id', '=', 'p.categoria_id')
            ->join('v_disponibilidad_producto as d', 'd.producto_id', '=', 'p.id')
            ->where('p.estado', 'activo')
            ->select('p.id', 'p.nombre', 'p.descripcion', 'p.imagen', 'p.presentacion', 'p.unidad_medida', 'p.precio_venta',
                'p.modalidad_venta', 'p.categoria_id', 'c.nombre as categoria', 'd.stock_disponible', 'd.produccion_futura');
    }

    private function vendidos(): Builder
    {
        return DB::table('detalle_pedido as dp')
            ->join('pedido as pe', 'pe.id', '=', 'dp.pedido_id')
            ->whereNotIn('pe.estado', ['pendiente', 'cancelado'])
            ->groupBy('dp.producto_id')
            ->select('dp.producto_id', DB::raw('SUM(dp.cantidad) AS vendidos'));
    }

    public function index(Request $request): JsonResponse
    {
        MantenimientoServicio::ejecutarSiCorresponde();
        $f = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'categoria' => ['nullable', 'integer'],
            'modalidad' => ['nullable', Rule::in(['inmediata', 'encargo'])],
            'orden' => ['nullable', Rule::in(['nombre', 'precio_asc', 'precio_desc', 'vendidos'])],
        ]);

        $q = $this->base()->leftJoinSub($this->vendidos(), 'v', 'v.producto_id', '=', 'p.id')
            ->addSelect(DB::raw('COALESCE(v.vendidos, 0) AS vendidos'));
        if (! empty($f['q'])) {
            $q->where(fn ($w) => $w->where('p.nombre', 'ilike', $this->like($f['q']))
                ->orWhere('p.descripcion', 'ilike', $this->like($f['q']))
                ->orWhere('c.nombre', 'ilike', $this->like($f['q'])));
        }
        if (! empty($f['categoria'])) {
            $q->where('p.categoria_id', $f['categoria']);
        }
        if (($f['modalidad'] ?? null) === 'inmediata') {
            $q->whereIn('p.modalidad_venta', ['inmediata', 'ambas']);
        } elseif (($f['modalidad'] ?? null) === 'encargo') {
            $q->whereIn('p.modalidad_venta', ['encargo', 'ambas']);
        }
        match ($f['orden'] ?? 'nombre') {
            'precio_asc' => $q->orderBy('p.precio_venta'),
            'precio_desc' => $q->orderByDesc('p.precio_venta'),
            'vendidos' => $q->orderByDesc('vendidos'),
            default => $q->orderBy('p.nombre'),
        };

        return $this->paginado($q->paginate(12));
    }

    public function portada(): JsonResponse
    {
        MantenimientoServicio::ejecutarSiCorresponde();
        $destacados = $this->base()->leftJoinSub($this->vendidos(), 'v', 'v.producto_id', '=', 'p.id')
            ->orderByRaw('COALESCE(v.vendidos, 0) DESC')->limit(8)->get();
        $categorias = DB::table('categoria as c')
            ->join('producto as p', fn ($j) => $j->on('p.categoria_id', '=', 'c.id')->where('p.estado', 'activo'))
            ->groupBy('c.id', 'c.nombre')->orderBy('c.nombre')
            ->get(['c.id', 'c.nombre', DB::raw('COUNT(p.id) AS total')]);
        $comunidades = DB::table('comunidad as co')
            ->leftJoin('emprendimiento as e', fn ($j) => $j->on('e.comunidad_id', '=', 'co.id')->where('e.estado', 'activo'))
            ->groupBy('co.id')->orderBy('co.nombre')
            ->get(['co.id', 'co.nombre', 'co.municipio', 'co.departamento', 'co.descripcion', DB::raw('COUNT(e.id) AS productores')]);

        return response()->json(compact('destacados', 'categorias', 'comunidades'));
    }

    public function show(int $id): JsonResponse
    {
        $producto = $this->base()->where('p.id', $id)->first();
        abort_if(! $producto, 404, 'El producto no existe.');
        $producto->productores = DB::table('emprendimiento_producto as ep')
            ->join('emprendimiento as e', 'e.id', '=', 'ep.emprendimiento_id')
            ->join('comunidad as co', 'co.id', '=', 'e.comunidad_id')
            ->where('ep.producto_id', $id)->where('e.estado', 'activo')
            ->get(['e.id', 'e.nombre', 'co.nombre as comunidad', 'co.municipio', 'ep.temporada']);

        return response()->json($producto);
    }

    public function categorias(): JsonResponse
    {
        return response()->json(DB::table('categoria')->orderBy('nombre')->get(['id', 'nombre']));
    }
}
