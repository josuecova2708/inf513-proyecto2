<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Models\Encargo;
use App\Services\NotificacionServicio;
use App\Services\PedidoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * CU5: encargos (pedidos anticipados / productos de temporada).
 * Flujo: solicitado -> aceptado | rechazado; aceptado -> disponible (hay stock) -> convertido en pedido.
 */
class EncargoController extends Controller
{
    private const TRANSICIONES = [
        'aceptado' => ['solicitado'],
        'rechazado' => ['solicitado', 'aceptado'],
        'disponible' => ['aceptado'],
    ];

    private function encargoPara(int $id, $usuario, bool $bloquear = false): Encargo
    {
        $q = Encargo::whereKey($id);
        $e = $bloquear ? $q->lockForUpdate()->first() : $q->first();
        if (! $e) {
            throw new ErrorNegocio('El encargo no existe.', 404);
        }
        if (! $usuario->esStaff() && $e->cliente_id !== $usuario->id) {
            throw new ErrorNegocio('El encargo no le pertenece.', 403);
        }

        return $e;
    }

    public function index(Request $request): JsonResponse
    {
        $f = $request->validate(['estado' => ['nullable', Rule::in(['solicitado', 'aceptado', 'rechazado', 'disponible', 'convertido', 'cancelado'])]]);
        $u = $request->user();
        $q = DB::table('encargo as e')->join('usuario as u', 'u.id', '=', 'e.cliente_id')
            ->leftJoin('pedido as p', 'p.encargo_id', '=', 'e.id')
            ->when(! $u->esStaff(), fn ($w) => $w->where('e.cliente_id', $u->id))
            ->when($f['estado'] ?? null, fn ($w, $s) => $w->where('e.estado', $s))
            ->orderByRaw("CASE e.estado WHEN 'solicitado' THEN 0 WHEN 'aceptado' THEN 1 WHEN 'disponible' THEN 2 ELSE 3 END")
            ->orderByDesc('e.id')
            ->select('e.*', 'p.id as pedido_id', 'p.numero as pedido_numero', DB::raw("u.nombre || ' ' || u.apellido AS cliente"),
                DB::raw('(SELECT COALESCE(SUM(de.cantidad * COALESCE(de.precio_estimado, 0)), 0) FROM detalle_encargo de WHERE de.encargo_id = e.id) AS total_estimado'),
                DB::raw("(SELECT string_agg(pr.nombre || ' x' || trim(to_char(de.cantidad, 'FM999999990.##')), ', ') FROM detalle_encargo de JOIN producto pr ON pr.id = de.producto_id WHERE de.encargo_id = e.id) AS productos"));

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $e = $this->encargoPara($id, $request->user());
        $detalles = DB::table('detalle_encargo as de')->join('producto as p', 'p.id', '=', 'de.producto_id')
            ->join('v_disponibilidad_producto as d', 'd.producto_id', '=', 'de.producto_id')
            ->where('de.encargo_id', $id)
            ->get(['de.producto_id', 'p.nombre', 'p.unidad_medida', 'de.cantidad', 'de.precio_estimado', 'd.stock_disponible', 'd.produccion_futura']);

        return response()->json(['encargo' => $e->load('cliente:id,nombre,apellido,email,telefono'), 'detalles' => $detalles]);
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate([
            'fecha_requerida' => ['required', 'date', 'after:today'],
            'observacion' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.producto_id' => ['required', 'integer', 'distinct', 'exists:producto,id'],
            'items.*.cantidad' => ['required', 'numeric', 'gt:0', 'max:100000'],
        ], [
            'fecha_requerida.after' => 'La fecha requerida debe ser posterior a hoy.',
            'items.required' => 'Agregue al menos un producto al encargo.',
            'items.*.producto_id.distinct' => 'No repita el mismo producto en el encargo.',
            'items.*.cantidad.gt' => 'La cantidad debe ser mayor que 0.',
        ]);
        $u = $request->user();
        if (! $u->esCliente()) {
            throw new ErrorNegocio('Los encargos se registran a nombre de un cliente; use una cuenta de Cliente.');
        }

        $id = DB::transaction(function () use ($d, $u) {
            $id = DB::table('encargo')->insertGetId([
                'cliente_id' => $u->id, 'fecha_requerida' => $d['fecha_requerida'], 'observacion' => $d['observacion'] ?? null,
            ]);
            foreach ($d['items'] as $it) {
                $p = DB::table('producto')->where('id', $it['producto_id'])->first();
                if ($p->estado !== 'activo') {
                    throw new ErrorNegocio("“{$p->nombre}” no está a la venta.");
                }
                if ($p->modalidad_venta === 'inmediata') {
                    throw new ErrorNegocio("“{$p->nombre}” es de venta inmediata: agréguelo al carrito.");
                }
                DB::table('detalle_encargo')->insert([
                    'encargo_id' => $id, 'producto_id' => $p->id, 'cantidad' => $it['cantidad'], 'precio_estimado' => $p->precio_venta,
                ]);
            }
            NotificacionServicio::notificarStaff('encargo_actualizado', "Nuevo encargo #{$id} de {$u->nombre_completo}.", null, $id);

            return $id;
        });

        return $this->mensaje('Encargo registrado. FEDER le notificará cuando sea aceptado.', ['encargo_id' => $id], 201);
    }

    public function cambiarEstado(Request $request, int $id): JsonResponse
    {
        $d = $request->validate([
            'estado' => ['required', Rule::in(array_keys(self::TRANSICIONES))],
            'observacion' => ['nullable', 'required_if:estado,rechazado', 'string', 'max:500'],
        ], ['observacion.required_if' => 'Indique el motivo del rechazo.']);
        $u = $request->user();
        if (! $u->esStaff()) {
            throw new ErrorNegocio('Solo el personal de FEDER puede cambiar el estado de un encargo.', 403);
        }

        $msg = DB::transaction(function () use ($d, $id, $u) {
            $e = $this->encargoPara($id, $u, true);
            if (! in_array($e->estado, self::TRANSICIONES[$d['estado']], true)) {
                throw new ErrorNegocio("No se puede pasar el encargo de {$e->estado} a {$d['estado']}.");
            }
            if ($d['estado'] === 'disponible') {
                $falta = DB::table('detalle_encargo as de')->join('producto as p', 'p.id', '=', 'de.producto_id')
                    ->join('v_disponibilidad_producto as v', 'v.producto_id', '=', 'de.producto_id')
                    ->where('de.encargo_id', $id)->whereColumn('v.stock_disponible', '<', 'de.cantidad')
                    ->get(['p.nombre', 'de.cantidad', 'v.stock_disponible']);
                if ($falta->isNotEmpty()) {
                    throw new ErrorNegocio('Aún no hay stock para este encargo: '.$falta->map(fn ($f) => "{$f->nombre} (pide ".(float) $f->cantidad.', hay '.(float) $f->stock_disponible.')')->implode('; ').'. Ingrese primero el lote.');
                }
            }
            $e->update(['estado' => $d['estado'], 'observacion' => $d['observacion'] ?? $e->observacion]);
            $tipo = $d['estado'] === 'disponible' ? 'encargo_disponible' : 'encargo_actualizado';
            $texto = match ($d['estado']) {
                'aceptado' => "Tu encargo #{$id} fue ACEPTADO por FEDER. Te avisaremos cuando esté disponible.",
                'rechazado' => "Tu encargo #{$id} fue RECHAZADO. Motivo: ".($d['observacion'] ?? '-'),
                'disponible' => "¡Tu encargo #{$id} ya está DISPONIBLE! Conviértelo en pedido desde 'Encargos' para reservarlo.",
            };
            NotificacionServicio::notificar($e->cliente_id, $tipo, $texto, null, $id);

            return "Encargo #{$id}: ".mb_strtoupper($d['estado']).'. Se notificó al cliente.';
        });

        return $this->mensaje($msg);
    }

    public function cancelar(Request $request, int $id): JsonResponse
    {
        DB::transaction(function () use ($id, $request) {
            $e = $this->encargoPara($id, $request->user(), true);
            if (in_array($e->estado, ['convertido', 'cancelado', 'rechazado'], true)) {
                throw new ErrorNegocio("El encargo está {$e->estado} y ya no se puede cancelar.");
            }
            $e->update(['estado' => 'cancelado']);
        });

        return $this->mensaje('Encargo cancelado.');
    }

    /** Convierte un encargo DISPONIBLE en pedido: precios vigentes, reserva de stock y entrega. */
    public function convertir(Request $request, int $id): JsonResponse
    {
        $reglas = PedidoServicio::reglasEntrega();
        $d = $request->validate($reglas['reglas'], $reglas['mensajes']);
        $u = $request->user();

        $pedidoId = DB::transaction(function () use ($d, $id, $u) {
            $e = $this->encargoPara($id, $u, true);
            if ($e->estado !== 'disponible') {
                throw new ErrorNegocio("El encargo está {$e->estado}; solo se convierten encargos DISPONIBLES.");
            }
            $pedido = PedidoServicio::nuevoPedido($e->cliente_id, 'encargo', $e->id);
            DB::insert('INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
                        SELECT ?, de.producto_id, de.cantidad, p.precio_venta FROM detalle_encargo de JOIN producto p ON p.id = de.producto_id
                         WHERE de.encargo_id = ?', [$pedido, $e->id]);
            PedidoServicio::recalcular($pedido);
            PedidoServicio::reservarYEntregar($pedido, $d);
            PedidoServicio::recalcular($pedido);
            if ($u->esStaff()) {
                DB::table('pedido')->where('id', $pedido)->update(['gestionado_por' => $u->id]);
            }
            $e->update(['estado' => 'convertido']);
            $numero = DB::table('pedido')->where('id', $pedido)->value('numero');
            NotificacionServicio::notificar($e->cliente_id, 'pedido_confirmado', "Tu encargo #{$e->id} se convirtió en el pedido {$numero}. Completa el pago para confirmarlo.", $pedido, $e->id);

            return $pedido;
        });

        return $this->mensaje('Encargo convertido en pedido. El stock quedó reservado.', ['pedido_id' => $pedidoId], 201);
    }
}
