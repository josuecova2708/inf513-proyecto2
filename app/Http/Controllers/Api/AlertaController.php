<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MantenimientoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU4: alertas de inventario (stock bajo y vencimiento próximo). */
class AlertaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        MantenimientoServicio::ejecutarSiCorresponde();
        $f = $request->validate([
            'estado' => ['nullable', Rule::in(['activa', 'atendida'])],
            'tipo' => ['nullable', Rule::in(['stock_bajo', 'vencimiento'])],
        ]);
        $q = DB::table('alerta_inventario as a')->join('producto as p', 'p.id', '=', 'a.producto_id')
            ->when($f['estado'] ?? null, fn ($w, $e) => $w->where('a.estado', $e))
            ->when($f['tipo'] ?? null, fn ($w, $t) => $w->where('a.tipo', $t))
            ->orderByRaw("CASE a.estado WHEN 'activa' THEN 0 ELSE 1 END")->orderByDesc('a.fecha')
            ->select('a.*', 'p.nombre as producto');

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function atender(int $id): JsonResponse
    {
        $n = DB::table('alerta_inventario')->where('id', $id)->update(['estado' => 'atendida']);
        abort_if($n === 0, 404, 'La alerta no existe.');

        return $this->mensaje('Alerta marcada como atendida.');
    }
}
