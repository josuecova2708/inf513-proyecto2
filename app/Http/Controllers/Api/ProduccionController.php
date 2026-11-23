<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Models\Produccion;
use App\Services\NotificacionServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU3: producción agrícola. El Productor reporta; el Personal de FEDER valida o rechaza. */
class ProduccionController extends Controller
{
    private function reglas(): array
    {
        return [
            'emprendimiento_id' => ['required', 'integer', 'exists:emprendimiento,id'],
            'producto_id' => ['required', 'integer', 'exists:producto,id'],
            'tipo' => ['required', Rule::in(['disponible', 'futura'])],
            'cantidad' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'unidad_medida' => ['required', 'string', 'max:20'],
            'fecha_produccion' => ['nullable', 'date', 'before_or_equal:today'],
            'fecha_disponible' => ['nullable', 'required_if:tipo,futura', 'date'],
            'precio_propuesto' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'procedencia' => ['nullable', 'string', 'max:200'],
            'observacion' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private const MENSAJES = [
        'cantidad.gt' => 'La cantidad debe ser mayor que 0.',
        'fecha_produccion.before_or_equal' => 'La fecha de producción no puede ser futura.',
        'fecha_disponible.required_if' => 'Para producción futura indique la fecha en que estará disponible.',
    ];

    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'estado' => ['nullable', Rule::in(['reportada', 'validada', 'rechazada'])],
            'tipo' => ['nullable', Rule::in(['disponible', 'futura'])],
            'emprendimiento_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:80'],
        ]);
        $u = $request->user();
        $q = DB::table('produccion as pr')
            ->join('emprendimiento as e', 'e.id', '=', 'pr.emprendimiento_id')
            ->join('comunidad as c', 'c.id', '=', 'e.comunidad_id')
            ->join('producto as p', 'p.id', '=', 'pr.producto_id')
            ->leftJoin('usuario as v', 'v.id', '=', 'pr.validado_por')
            ->when(! $u->esStaff(), fn ($w) => $w->where('e.usuario_id', $u->id))
            ->when($f['estado'] ?? null, fn ($w, $s) => $w->where('pr.estado', $s))
            ->when($f['tipo'] ?? null, fn ($w, $t) => $w->where('pr.tipo', $t))
            ->when($f['emprendimiento_id'] ?? null, fn ($w, $e) => $w->where('pr.emprendimiento_id', $e))
            ->when($f['q'] ?? null, fn ($w, $t) => $w->where(fn ($x) => $x->where('p.nombre', 'ilike', $this->like($t))->orWhere('e.nombre', 'ilike', $this->like($t))))
            ->orderByRaw("CASE pr.estado WHEN 'reportada' THEN 0 ELSE 1 END")->orderByDesc('pr.id')
            ->select('pr.*', 'p.nombre as producto', 'e.nombre as emprendimiento', 'c.nombre as comunidad',
                DB::raw("v.nombre || ' ' || v.apellido AS validador"),
                DB::raw('(SELECT COUNT(*) FROM lote l WHERE l.produccion_id = pr.id) AS lotes'),
                DB::raw('(SELECT COALESCE(SUM(l.cantidad_inicial), 0) FROM lote l WHERE l.produccion_id = pr.id) AS cantidad_en_lotes'));

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate($this->reglas(), self::MENSAJES);
        $u = $request->user();
        if ($u->esProductor()) {
            $propio = $u->emprendimiento?->id ?? throw new ErrorNegocio('Su cuenta no está vinculada a ningún emprendimiento.');
            $d['emprendimiento_id'] = $propio;
        }
        $p = Produccion::create($d + ['estado' => 'reportada']);
        NotificacionServicio::notificarStaff('produccion_validada', "Nueva producción reportada (#{$p->id}) pendiente de validación.");

        return $this->mensaje('Producción reportada. Queda pendiente de validación por FEDER.', ['produccion' => $p], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $p = Produccion::findOrFail($id);
        if ($p->estado !== 'reportada') {
            throw new ErrorNegocio('Solo se puede editar una producción en estado REPORTADA.');
        }
        $p->update($request->validate($this->reglas(), self::MENSAJES));

        return $this->mensaje('Producción actualizada.', ['produccion' => $p]);
    }

    public function validar(Request $request, int $id): JsonResponse
    {
        $d = $request->validate([
            'estado' => ['required', Rule::in(['validada', 'rechazada'])],
            'observacion' => ['nullable', 'required_if:estado,rechazada', 'string', 'max:1000'],
        ], ['observacion.required_if' => 'Indique el motivo del rechazo.']);
        $u = $request->user();
        if (! $u->esStaff()) {
            throw new ErrorNegocio('Solo el personal de FEDER puede validar producción.', 403);
        }

        $p = DB::transaction(function () use ($d, $id, $u) {
            $p = Produccion::lockForUpdate()->findOrFail($id);
            if ($p->estado !== 'reportada') {
                throw new ErrorNegocio('La producción ya fue '.$p->estado.'.');
            }
            $p->update([
                'estado' => $d['estado'], 'validado_por' => $u->id, 'fecha_validacion' => now(),
                'observacion' => $d['observacion'] ?? $p->observacion,
            ]);
            $dueno = DB::table('emprendimiento')->where('id', $p->emprendimiento_id)->value('usuario_id');
            if ($dueno) {
                NotificacionServicio::notificar($dueno, 'produccion_validada', "Tu producción #{$p->id} fue ".mb_strtoupper($d['estado']).'.'
                    .(! empty($d['observacion']) ? " Observación: {$d['observacion']}" : ''));
            }

            return $p;
        });

        return $this->mensaje($d['estado'] === 'validada' ? 'Producción validada: ya puede ingresarse como lote.' : 'Producción rechazada.', ['produccion' => $p]);
    }

    public function destroy(int $id): JsonResponse
    {
        $p = Produccion::findOrFail($id);
        if ($p->lotes()->exists()) {
            throw new ErrorNegocio('No se puede eliminar: la producción ya tiene lotes ingresados.', 409);
        }
        $p->delete();

        return $this->mensaje('Producción eliminada.');
    }
}
