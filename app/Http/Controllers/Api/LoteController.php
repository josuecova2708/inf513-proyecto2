<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * CU3: asignar lotes a la producción validada y controlar la trazabilidad de origen.
 * Concurrencia: los lotes tienen columna `version` (bloqueo optimista) y las funciones
 * de reserva usan SELECT ... FOR UPDATE (bloqueo pesimista).
 */
class LoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'estado' => ['nullable', Rule::in(['disponible', 'agotado', 'vencido'])],
            'producto_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:80'],
        ]);
        $u = $request->user();
        $q = DB::table('lote as l')
            ->join('produccion as pr', 'pr.id', '=', 'l.produccion_id')
            ->join('producto as p', 'p.id', '=', 'pr.producto_id')
            ->join('emprendimiento as e', 'e.id', '=', 'pr.emprendimiento_id')
            ->join('comunidad as c', 'c.id', '=', 'e.comunidad_id')
            ->when(! $u->esStaff(), fn ($w) => $w->where('e.usuario_id', $u->id))
            ->when($f['estado'] ?? null, fn ($w, $s) => $w->where('l.estado', $s))
            ->when($f['producto_id'] ?? null, fn ($w, $p) => $w->where('pr.producto_id', $p))
            ->when($f['q'] ?? null, fn ($w, $t) => $w->where(fn ($x) => $x->where('l.codigo', 'ilike', $this->like($t))
                ->orWhere('p.nombre', 'ilike', $this->like($t))->orWhere('e.nombre', 'ilike', $this->like($t))))
            ->orderByRaw("CASE l.estado WHEN 'disponible' THEN 0 ELSE 1 END")->orderBy('l.fecha_vencimiento')
            ->select('l.*', 'p.nombre as producto', 'p.unidad_medida', 'e.nombre as emprendimiento', 'c.nombre as comunidad',
                DB::raw('(l.fecha_vencimiento - CURRENT_DATE) AS dias_para_vencer'));

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    /** Ingreso de lote: usa fn_ingresar_lote (exige producción validada y registra la ENTRADA). */
    public function store(Request $request): JsonResponse
    {
        $d = $request->validate([
            'produccion_id' => ['required', 'integer', 'exists:produccion,id'],
            'codigo' => ['required', 'string', 'max:30', 'regex:/^[A-Z0-9][A-Z0-9-]{2,29}$/', 'unique:lote,codigo'],
            'cantidad' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'fecha_vencimiento' => ['nullable', 'date', 'after_or_equal:today'],
            'costo_unitario' => ['nullable', 'numeric', 'min:0', 'max:100000'],
        ], [
            'codigo.regex' => 'El código debe tener de 3 a 30 caracteres en MAYÚSCULAS, números o guiones (ej. ARR-002).',
            'codigo.unique' => 'Ya existe un lote con ese código.',
            'cantidad.gt' => 'La cantidad debe ser mayor que 0.',
            'fecha_vencimiento.after_or_equal' => 'La fecha de vencimiento no puede ser pasada.',
        ]);

        $lote = DB::transaction(function () use ($d, $request) {
            $pr = DB::table('produccion')->where('id', $d['produccion_id'])->lockForUpdate()->first();
            if ($pr->estado !== 'validada') {
                throw new ErrorNegocio('Solo se pueden ingresar lotes de producción VALIDADA.');
            }
            $yaIngresado = (float) DB::table('lote')->where('produccion_id', $pr->id)->sum('cantidad_inicial');
            if ($yaIngresado + (float) $d['cantidad'] > (float) $pr->cantidad) {
                throw new ErrorNegocio('La cantidad supera lo validado: producción '.(float) $pr->cantidad.', ya ingresado '.$yaIngresado.'.');
            }
            $id = DB::selectOne('SELECT fn_ingresar_lote(?, ?, ?, ?, ?, ?) AS id', [
                $d['produccion_id'], $d['codigo'], $d['cantidad'], $request->user()->id,
                $d['fecha_vencimiento'] ?? null, $d['costo_unitario'] ?? null,
            ])->id;
            DB::select('SELECT fn_revisar_stock_minimo(?)', [$pr->producto_id]);

            return DB::table('lote')->where('id', $id)->first();
        });

        return $this->mensaje("Lote {$lote->codigo} ingresado al inventario.", ['lote' => $lote], 201);
    }

    /** Edición con control de concurrencia optimista: exige la `version` que el usuario vio. */
    public function update(Request $request, int $id): JsonResponse
    {
        $d = $request->validate([
            'version' => ['required', 'integer', 'min:0'],
            'fecha_vencimiento' => ['nullable', 'date'],
            'costo_unitario' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'estado' => ['required', Rule::in(['disponible', 'agotado', 'vencido'])],
        ]);
        $n = DB::table('lote')->where('id', $id)->where('version', $d['version'])->update([
            'fecha_vencimiento' => $d['fecha_vencimiento'] ?? null,
            'costo_unitario' => $d['costo_unitario'] ?? null,
            'estado' => $d['estado'],
            'version' => DB::raw('version + 1'),
        ]);
        if ($n === 0) {
            abort_unless(DB::table('lote')->where('id', $id)->exists(), 404, 'El lote no existe.');
            throw new ErrorNegocio('El lote fue modificado por otro usuario mientras lo editaba. Recargue los datos e intente de nuevo.', 409);
        }

        return $this->mensaje('Lote actualizado.', ['lote' => DB::table('lote')->where('id', $id)->first()]);
    }

    /** Trazabilidad hacia atrás y adelante de un lote: origen (productor/comunidad) y pedidos donde se vendió. */
    public function trazabilidadLote(string $codigo): JsonResponse
    {
        $lote = DB::table('lote as l')
            ->join('produccion as pr', 'pr.id', '=', 'l.produccion_id')
            ->join('producto as p', 'p.id', '=', 'pr.producto_id')
            ->join('emprendimiento as e', 'e.id', '=', 'pr.emprendimiento_id')
            ->join('comunidad as c', 'c.id', '=', 'e.comunidad_id')
            ->leftJoin('usuario as v', 'v.id', '=', 'pr.validado_por')
            ->whereRaw('upper(l.codigo) = upper(?)', [$codigo])
            ->first(['l.*', 'p.nombre as producto', 'p.unidad_medida', 'pr.id as produccion_id', 'pr.fecha_produccion', 'pr.procedencia',
                'pr.fecha_validacion', 'e.nombre as emprendimiento', 'e.responsable', 'e.latitud', 'e.longitud',
                'c.nombre as comunidad', 'c.municipio', 'c.provincia', DB::raw("v.nombre || ' ' || v.apellido AS validador")]);
        if (! $lote) {
            throw new ErrorNegocio("No existe el lote {$codigo}.", 404);
        }
        $movimientos = DB::table('movimiento_inventario as m')->leftJoin('usuario as u', 'u.id', '=', 'm.usuario_id')
            ->where('m.lote_id', $lote->id)->orderBy('m.fecha')
            ->get(['m.tipo', 'm.cantidad', 'm.fecha', 'm.motivo', DB::raw("u.nombre || ' ' || u.apellido AS usuario")]);
        $pedidos = DB::table('reserva_lote as rl')
            ->join('detalle_pedido as dp', 'dp.id', '=', 'rl.detalle_pedido_id')
            ->join('pedido as pe', 'pe.id', '=', 'dp.pedido_id')
            ->join('usuario as u', 'u.id', '=', 'pe.cliente_id')
            ->where('rl.lote_id', $lote->id)->orderByDesc('pe.fecha')
            ->get(['pe.id', 'pe.numero', 'pe.fecha', 'pe.estado', 'rl.cantidad', 'rl.estado as estado_reserva', DB::raw("u.nombre || ' ' || u.apellido AS cliente")]);

        return response()->json(compact('lote', 'movimientos', 'pedidos'));
    }

    /** Trazabilidad de un pedido: de cada unidad vendida hasta su lote, productor y comunidad (v_trazabilidad). */
    public function trazabilidadPedido(Request $request, string $numero): JsonResponse
    {
        $pedido = DB::table('pedido')->whereRaw('upper(numero) = upper(?)', [$numero])->first(['id', 'numero', 'cliente_id', 'estado', 'fecha']);
        if (! $pedido || (! $request->user()->esStaff() && $pedido->cliente_id !== $request->user()->id)) {
            throw new ErrorNegocio("No existe el pedido {$numero}.", 404);
        }

        return response()->json(['pedido' => $pedido, 'detalle' => DB::table('v_trazabilidad')->where('pedido', $pedido->numero)->get()]);
    }
}
