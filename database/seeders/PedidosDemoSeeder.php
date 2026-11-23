<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Historial demo de ventas (últimos 45 días) para que el dashboard, los indicadores
 * financieros y los reportes tengan datos. Usa las mismas funciones del esquema
 * (fn_reservar_pedido / fn_confirmar_reservas), así el stock y la trazabilidad son coherentes.
 */
class PedidosDemoSeeder extends Seeder
{
    public function run(): void
    {
        mt_srand(28);
        $clientes = DB::table('usuario')->where('email', 'like', 'cliente.%')->pluck('id')->all();
        $personal = DB::table('usuario')->where('email', 'feder.personal@example.com')->value('id');
        $metodos = DB::table('metodo_pago')->pluck('id', 'nombre');
        $productos = DB::table('producto')->whereIn('modalidad_venta', ['inmediata', 'ambas'])
            ->where('nombre', '!=', 'Tomate perita')->get(['id', 'precio_venta'])->all();

        for ($i = 0; $i < 32; $i++) {
            $fecha = Carbon::now()->subDays(45 - $i - mt_rand(0, 1))->setTime(mt_rand(8, 19), mt_rand(0, 59));
            $cliente = $clientes[array_rand($clientes)];
            $items = $this->elegir($productos, mt_rand(1, 3));
            $envio = mt_rand(0, 1) === 1;

            $pedidoId = $this->crearPedido($cliente, $items, $envio, $fecha);
            DB::select('SELECT fn_reservar_pedido(?, ?)', [$pedidoId, 1440]);

            $total = (float) DB::table('pedido')->where('id', $pedidoId)->value('total');
            $metodo = ['QR', 'Efectivo', 'Tarjeta', 'Transferencia'][mt_rand(0, 3)];
            DB::table('pago')->insert([
                'pedido_id' => $pedidoId, 'metodo_pago_id' => $metodos[$metodo], 'monto' => $total, 'fecha' => $fecha->copy()->addHours(1),
                'estado' => 'pagado', 'referencia' => 'Pago demo', 'codigo_transaccion' => 'TX-DEMO-'.str_pad((string) $pedidoId, 6, '0', STR_PAD_LEFT),
                'registrado_por' => $personal,
            ]);

            // Los más antiguos ya se entregaron; los últimos quedan en distintos estados del flujo
            $estadoFinal = $i < 26 ? 'entregado' : ['confirmado', 'en_preparacion', 'listo_entrega', 'entregado', 'en_preparacion', 'confirmado'][$i - 26];
            if ($estadoFinal === 'confirmado') {
                DB::table('pedido')->where('id', $pedidoId)->update(['estado' => 'confirmado', 'gestionado_por' => $personal]);
            } else {
                DB::select('SELECT fn_confirmar_reservas(?, ?)', [$pedidoId, $personal]);
                DB::table('pedido')->where('id', $pedidoId)->update(['estado' => $estadoFinal, 'gestionado_por' => $personal]);
            }
            if ($estadoFinal === 'entregado') {
                DB::table('entrega')->where('pedido_id', $pedidoId)->update([
                    'estado' => 'entregada', 'fecha_entrega' => $fecha->copy()->addDays(1), 'despachado_por' => $personal,
                    'receptor' => 'Titular del pedido',
                ]);
            }
        }

        // Un pedido pendiente de pago (para probar el flujo de pago) y un plan de pagos en curso
        $ana = DB::table('usuario')->where('email', 'cliente.ana@example.com')->value('id');
        $miel = DB::table('producto')->where('nombre', 'Miel de abeja pura')->first(['id', 'precio_venta']);
        $cafe = DB::table('producto')->where('nombre', 'Café de Samaipata molido')->first(['id', 'precio_venta']);

        $pendiente = $this->crearPedido($ana, [[$miel, 2]], false, Carbon::now()->subHours(3));
        DB::select('SELECT fn_reservar_pedido(?, ?)', [$pendiente, 1440 * 3]);

        $conPlan = $this->crearPedido($ana, [[$miel, 3], [$cafe, 4]], true, Carbon::now()->subDays(20));
        DB::select('SELECT fn_reservar_pedido(?, ?)', [$conPlan, 1440 * 30]);
        $total = (float) DB::table('pedido')->where('id', $conPlan)->value('total');
        $planId = DB::table('plan_pago')->insertGetId([
            'pedido_id' => $conPlan, 'usuario_id' => $ana, 'nro_cuotas' => 3, 'frecuencia' => 'mensual',
            'monto_total' => $total, 'cuota_inicial' => 0, 'fecha' => Carbon::now()->subDays(20),
        ]);
        $montoCuota = round($total / 3, 2);
        for ($n = 1; $n <= 3; $n++) {
            $monto = $n < 3 ? $montoCuota : round($total - $montoCuota * 2, 2);
            $cuotaId = DB::table('cuota_pago')->insertGetId([
                'plan_pago_id' => $planId, 'numero' => $n, 'monto' => $monto,
                'fecha_vencimiento' => Carbon::now()->subDays(20)->addMonths($n - 1)->toDateString(),
                'estado' => $n === 1 ? 'pagada' : 'pendiente', 'fecha_pago' => $n === 1 ? Carbon::now()->subDays(20) : null,
            ]);
            if ($n === 1) {
                DB::table('pago')->insert([
                    'pedido_id' => $conPlan, 'metodo_pago_id' => $metodos['Tarjeta'], 'monto' => $monto,
                    'fecha' => Carbon::now()->subDays(20), 'estado' => 'pagado', 'referencia' => 'Cuota 1/3',
                    'cuota_pago_id' => $cuotaId, 'codigo_transaccion' => 'TX-DEMO-PLAN-1',
                ]);
            }
        }

        // Encargo de producto por pedido anticipado
        $carlos = DB::table('usuario')->where('email', 'cliente.carlos@example.com')->value('id');
        $papaya = DB::table('producto')->where('nombre', 'Papaya')->first(['id', 'precio_venta']);
        $encargo = DB::table('encargo')->insertGetId([
            'cliente_id' => $carlos, 'fecha_requerida' => now()->addDays(25)->toDateString(),
            'estado' => 'solicitado', 'observacion' => 'Para evento familiar',
        ]);
        DB::table('detalle_encargo')->insert([
            'encargo_id' => $encargo, 'producto_id' => $papaya->id, 'cantidad' => 20, 'precio_estimado' => $papaya->precio_venta,
        ]);

        DB::table('notificacion')->insert([
            ['usuario_id' => $ana, 'pedido_id' => $conPlan, 'encargo_id' => null, 'tipo' => 'pago_confirmado', 'canal' => 'sistema',
             'mensaje' => 'Se registró el pago de la cuota 1 de 3 de tu plan de pagos.', 'fecha_envio' => Carbon::now()->subDays(20), 'leida' => true],
            ['usuario_id' => $ana, 'pedido_id' => $pendiente, 'encargo_id' => null, 'tipo' => 'pedido_confirmado', 'canal' => 'sistema',
             'mensaje' => 'Tu pedido fue registrado. Recuerda completar el pago para confirmarlo.', 'fecha_envio' => Carbon::now()->subHours(3), 'leida' => false],
        ]);

        DB::select('SELECT fn_revisar_stock_minimo(id) FROM producto');
    }

    /** @return array<int, array{0: object, 1: int}> */
    private function elegir(array $productos, int $n): array
    {
        $claves = (array) array_rand($productos, $n);

        return array_map(fn ($k) => [$productos[$k], mt_rand(1, 4)], $claves);
    }

    private function crearPedido(int $cliente, array $items, bool $envio, Carbon $fecha): int
    {
        $id = (int) DB::selectOne("SELECT nextval(pg_get_serial_sequence('pedido','id')) AS id")->id;
        $subtotal = array_sum(array_map(fn ($it) => $it[0]->precio_venta * $it[1], $items));
        $costoEnvio = $envio ? 15.00 : 0;

        DB::table('pedido')->insert([
            'id' => $id, 'numero' => 'PED-'.str_pad((string) $id, 6, '0', STR_PAD_LEFT), 'cliente_id' => $cliente,
            'origen' => 'inmediato', 'fecha' => $fecha, 'estado' => 'pendiente', 'subtotal' => $subtotal, 'costo_envio' => $costoEnvio,
        ]);
        foreach ($items as [$producto, $cantidad]) {
            DB::table('detalle_pedido')->insert([
                'pedido_id' => $id, 'producto_id' => $producto->id, 'cantidad' => $cantidad, 'precio_unitario' => $producto->precio_venta,
            ]);
        }
        $direccion = DB::table('usuario')->where('id', $cliente)->value('direccion');
        DB::table('entrega')->insert([
            'pedido_id' => $id, 'tipo' => $envio ? 'envio' : 'recojo', 'direccion' => $envio ? $direccion : null,
            'fecha_programada' => $fecha->copy()->addDays(1),
        ]);

        return $id;
    }
}
