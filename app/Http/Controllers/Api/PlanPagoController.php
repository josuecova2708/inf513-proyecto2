<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Services\NotificacionServicio;
use App\Services\PagoServicio;
use App\Services\PedidoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Planes de pago por usuario (venta a crédito en cuotas). Con la primera cuota pagada el pedido
 * queda confirmado; la reserva de stock se extiende hasta la última cuota.
 */
class PlanPagoController extends Controller
{
    public const CUOTAS_PERMITIDAS = [2, 3, 6];

    public function index(Request $request): JsonResponse
    {
        $request->validate(['estado' => ['nullable', Rule::in(['vigente', 'pagado', 'cancelado'])]]);
        $u = $request->user();
        $planes = DB::table('plan_pago as pl')
            ->join('pedido as pe', 'pe.id_pedido', '=', 'pl.pedido_id')
            ->join('usuario as u', 'u.id_usuario', '=', 'pl.usuario_id')
            ->when(! $u->esStaff(), fn ($w) => $w->where('pl.usuario_id', $u->id))
            ->when($request->estado, fn ($w, $e) => $w->where('pl.estado', $e))
            ->orderByRaw("CASE pl.estado WHEN 'vigente' THEN 0 ELSE 1 END")->orderByDesc('pl.id_plan_pago')
            ->get(['pl.*', 'pl.id_plan_pago as id', 'pe.numero', 'pe.estado as estado_pedido', DB::raw("u.nombre || ' ' || u.apellido AS cliente")]);
        $cuotas = DB::table('cuota_pago')->whereIn('plan_pago_id', $planes->pluck('id'))->orderBy('numero')->get(['*', 'id_cuota_pago as id'])->groupBy('plan_pago_id');
        foreach ($planes as $p) {
            $p->cuotas = $cuotas[$p->id] ?? [];
            $p->pagado = collect($p->cuotas)->where('estado', 'pagada')->sum('monto');
        }

        return response()->json($planes);
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $d = $request->validate([
            'nro_cuotas' => ['required', 'integer', Rule::in(self::CUOTAS_PERMITIDAS)],
            'frecuencia' => ['required', Rule::in(['semanal', 'quincenal', 'mensual'])],
            'cuota_inicial' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
        ], ['nro_cuotas.in' => 'El plan puede ser de 2, 3 o 6 cuotas.']);
        $u = $request->user();

        $plan = DB::transaction(function () use ($d, $id, $u) {
            $p = PedidoServicio::pedidoPara($id, $u);
            if ($p->estado !== 'pendiente') {
                throw new ErrorNegocio('Solo se puede crear un plan de pagos para pedidos pendientes de pago.');
            }
            if (DB::table('plan_pago')->where('pedido_id', $id)->exists()) {
                throw new ErrorNegocio('El pedido ya tiene un plan de pagos.');
            }
            if (DB::table('pago')->where('pedido_id', $id)->where('estado', 'pendiente')->exists()) {
                throw new ErrorNegocio('El pedido tiene un pago pendiente de verificación.');
            }
            $saldo = round((float) DB::table('v_saldo_pedido')->where('pedido_id', $id)->value('saldo_pendiente'), 2);
            if ($saldo < 50) {
                throw new ErrorNegocio('El plan de pagos está disponible para saldos desde Bs. 50,00.');
            }
            $inicial = round((float) ($d['cuota_inicial'] ?? 0), 2);
            if ($inicial >= $saldo) {
                throw new ErrorNegocio('La cuota inicial debe ser menor al saldo del pedido (Bs. '.number_format($saldo, 2).').');
            }

            $planId = DB::table('plan_pago')->insertGetId([
                'pedido_id' => $id, 'usuario_id' => $p->cliente_id, 'nro_cuotas' => $d['nro_cuotas'], 'frecuencia' => $d['frecuencia'],
                'monto_total' => $saldo, 'cuota_inicial' => $inicial, 'estado' => 'vigente', 'fecha' => now(),
            ], 'id_plan_pago');
            // Cuotas: la 1ra vence hoy (incluye la cuota inicial si la hay); el resto se reparte en partes iguales
            $n = (int) $d['nro_cuotas'];
            $resto = $saldo - $inicial;
            $base = $inicial > 0 ? round($resto / ($n - 1), 2) : round($saldo / $n, 2);
            $fecha = now()->startOfDay();
            $acumulado = 0;
            for ($i = 1; $i <= $n; $i++) {
                $monto = $i === 1 && $inicial > 0 ? $inicial : ($i === $n ? round($saldo - $acumulado, 2) : $base);
                $acumulado += $monto;
                DB::table('cuota_pago')->insert([
                    'plan_pago_id' => $planId, 'numero' => $i, 'monto' => $monto, 'fecha_vencimiento' => $fecha->toDateString(),
                ]);
                $fecha = match ($d['frecuencia']) {
                    'semanal' => $fecha->copy()->addWeek(),
                    'quincenal' => $fecha->copy()->addDays(15),
                    default => $fecha->copy()->addMonth(),
                };
            }
            // La reserva de stock se mantiene durante el plan
            $ultima = DB::table('cuota_pago')->where('plan_pago_id', $planId)->max('fecha_vencimiento');
            DB::update("UPDATE reserva_lote SET fecha_expiracion = ?::date + interval '3 days'
                         WHERE estado = 'reservada' AND detalle_pedido_id IN (SELECT id_detalle_pedido FROM detalle_pedido WHERE pedido_id = ?)", [$ultima, $id]);
            NotificacionServicio::notificar($p->cliente_id, 'pedido_confirmado',
                "Se creó tu plan de {$n} cuotas para el pedido {$p->numero}. Paga la primera cuota para confirmarlo.", $id);

            return DB::table('plan_pago')->where('id_plan_pago', $planId)->first(['*', 'id_plan_pago as id']);
        });

        return $this->mensaje("Plan de pagos creado: {$plan->nro_cuotas} cuotas. Pague la primera cuota para confirmar el pedido.", ['plan' => $plan], 201);
    }

    public function pagarCuota(Request $request, int $id, PagoServicio $servicio): JsonResponse
    {
        $d = $request->validate([
            'metodo_pago_id' => ['required', 'integer', 'exists:metodo_pago,id_metodo_pago'],
            'metodo_pago_usuario_id' => ['nullable', 'integer'],
            'referencia' => ['nullable', 'string', 'max:100'],
        ]);
        $u = $request->user();

        [$pagoId, $r] = DB::transaction(function () use ($d, $id, $u, $servicio) {
            $cuota = DB::table('cuota_pago')->where('id_cuota_pago', $id)->lockForUpdate()->first(['*', 'id_cuota_pago as id']) ?? throw new ErrorNegocio('La cuota no existe.', 404);
            $plan = DB::table('plan_pago')->where('id_plan_pago', $cuota->plan_pago_id)->first(['*', 'id_plan_pago as id']);
            $p = PedidoServicio::pedidoPara($plan->pedido_id, $u);
            if ($plan->estado !== 'vigente' || $p->estado === 'cancelado') {
                throw new ErrorNegocio('El plan de pagos no está vigente.');
            }
            if ($cuota->estado === 'pagada') {
                throw new ErrorNegocio('La cuota ya fue pagada.');
            }
            $anterior = DB::table('cuota_pago')->where('plan_pago_id', $plan->id)->where('numero', '<', $cuota->numero)->where('estado', '!=', 'pagada')->min('numero');
            if ($anterior) {
                throw new ErrorNegocio("Primero debe pagar la cuota {$anterior}.");
            }
            $servicio->sincronizarPendientesStripe($p->id);
            if (DB::table('pago')->where('cuota_pago_id', $id)->where('estado', 'pendiente')->exists()) {
                throw new ErrorNegocio('Esta cuota ya tiene un pago pendiente de verificación.');
            }

            return $servicio->procesar($p, $u, (int) $d['metodo_pago_id'], (float) $cuota->monto, $d['metodo_pago_usuario_id'] ?? null,
                $d['referencia'] ?? "Cuota {$cuota->numero}/{$plan->nro_cuotas}", $id);
        });

        return PagoController::respuestaPago($pagoId, $r);
    }
}
