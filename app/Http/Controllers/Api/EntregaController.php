<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Services\NotificacionServicio;
use App\Services\PedidoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU6: gestión de entregas (programar, en camino, entregada, fallida). */
class EntregaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'estado' => ['nullable', Rule::in(['pendiente', 'en_camino', 'entregada', 'fallida'])],
            'tipo' => ['nullable', Rule::in(['recojo', 'envio'])],
        ]);
        $u = $request->user();
        $q = DB::table('entrega as en')
            ->join('pedido as p', 'p.id_pedido', '=', 'en.pedido_id')
            ->join('usuario as u', 'u.id_usuario', '=', 'p.cliente_id')
            ->leftJoin('usuario as d', 'd.id_usuario', '=', 'en.personal_id')
            ->where('p.estado', '!=', 'pendiente')
            ->when(! $u->esStaff(), fn ($w) => $w->where('p.cliente_id', $u->id))
            ->when($f['estado'] ?? null, fn ($w, $e) => $w->where('en.estado', $e))
            ->when($f['tipo'] ?? null, fn ($w, $t) => $w->where('en.tipo', $t))
            ->orderByRaw("CASE en.estado WHEN 'pendiente' THEN 0 WHEN 'en_camino' THEN 1 ELSE 2 END")
            ->orderByDesc('en.id_entrega')
            ->select('en.*', 'en.id_entrega as id', 'p.numero', 'p.estado as estado_pedido', 'u.telefono',
                DB::raw("u.nombre || ' ' || u.apellido AS cliente"), DB::raw("d.nombre || ' ' || d.apellido AS despachador"));

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $d = $request->validate([
            'estado' => ['required', Rule::in(['pendiente', 'en_camino', 'entregada', 'fallida'])],
            'fecha_programada' => ['nullable', 'date', 'after:now'],
            'receptor' => ['nullable', 'required_if:estado,entregada', 'string', 'min:3', 'max:120'],
            'referencia' => ['nullable', 'string', 'max:200'],
        ], [
            'receptor.required_if' => 'Indique el nombre de quien recibió el pedido.',
            'fecha_programada.after' => 'La nueva fecha y hora de entrega deben ser posteriores a este momento.',
        ]);
        $gestor = $request->user();

        $msg = DB::transaction(function () use ($d, $id, $gestor) {
            $en = DB::table('entrega')->where('id_entrega', $id)->lockForUpdate()->first(['*', 'id_entrega as id']) ?? throw new ErrorNegocio('La entrega no existe.', 404);
            $p = PedidoServicio::pedidoPara($en->pedido_id, $gestor);
            if ($en->estado === 'entregada') {
                throw new ErrorNegocio('La entrega ya fue completada y no puede modificarse.');
            }
            if (in_array($d['estado'], ['en_camino', 'entregada'], true) && ! in_array($p->estado, ['listo_entrega', 'entregado'], true)) {
                throw new ErrorNegocio("El pedido {$p->numero} está ".PedidoServicio::etiqueta($p->estado).'; primero hay que programar la entrega.');
            }
            $reprogramada = ! empty($d['fecha_programada']) && $p->estado === 'listo_entrega'
                && $d['fecha_programada'] !== substr((string) $en->fecha_programada, 0, 16);
            if ($d['estado'] === 'en_camino' && $en->tipo === 'recojo') {
                throw new ErrorNegocio('Las entregas por recojo en oficina no pasan por "en camino".');
            }
            DB::table('entrega')->where('id_entrega', $id)->update(array_filter([
                'estado' => $d['estado'],
                'fecha_programada' => $d['fecha_programada'] ?? null,
                'receptor' => $d['receptor'] ?? null,
                'referencia' => $d['referencia'] ?? null,
                'personal_id' => $gestor->id,
                'fecha_entrega' => $d['estado'] === 'entregada' ? now() : null,
            ], fn ($v) => $v !== null));

            if ($reprogramada) {
                PedidoServicio::notificarProgramacion($p, $d['fecha_programada'], true);

                return "Entrega del pedido {$p->numero} reprogramada para el ".PedidoServicio::fechaAmigable($d['fecha_programada']).'. Se notificó al cliente.';
            }
            if ($d['estado'] === 'en_camino') {
                NotificacionServicio::notificar($p->cliente_id, 'entrega_en_camino', "Tu pedido {$p->numero} está EN CAMINO a: {$en->direccion}.", $p->id);
            }
            if ($d['estado'] === 'entregada' && $p->estado === 'listo_entrega') {
                PedidoServicio::cambiarEstado($p, 'entregado', $gestor);
            }

            return "Entrega del pedido {$p->numero} actualizada a ".PedidoServicio::etiqueta($d['estado']).'.';
        });

        return $this->mensaje($msg);
    }
}
