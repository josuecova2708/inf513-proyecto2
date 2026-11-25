<?php

namespace App\Services;

use App\Exceptions\ErrorNegocio;
use App\Models\Pedido;
use App\Models\Usuario;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Lógica de pedidos portada del 1er parcial (PedidoServicio.java / PedidoHandler.java).
 *
 * CARRITO sin tabla extra: es el pedido del cliente en estado "pendiente", origen "inmediato",
 * que todavía NO tiene entrega. Al confirmar la compra se reserva el stock por lotes
 * (fn_reservar_pedido: FEFO con FOR UPDATE) y se registra la entrega: desde ahí es un pedido real.
 */
class PedidoServicio
{
    public const MINUTOS_RESERVA = 1440;

    /** Transiciones de estado permitidas: nuevo => estado actual requerido */
    public const TRANSICIONES = [
        'confirmado' => 'pendiente',
        'listo_entrega' => 'confirmado',
        'entregado' => 'listo_entrega',
    ];

    /** Reglas de validación de los datos de entrega (carrito y conversión de encargos). */
    public static function reglasEntrega(): array
    {
        return [
            'reglas' => [
                'tipo_entrega' => ['required', 'in:recojo,envio'],
                'direccion' => ['nullable', 'required_if:tipo_entrega,envio', 'string', 'min:5', 'max:200'],
                'referencia' => ['nullable', 'string', 'max:200'],
                'fecha_preferida' => ['nullable', 'date', 'after_or_equal:today'],
                'latitud' => ['nullable', 'required_if:tipo_entrega,envio', 'numeric', 'between:-23,-9'],
                'longitud' => ['nullable', 'required_if:tipo_entrega,envio', 'numeric', 'between:-70,-57'],
            ],
            'mensajes' => [
                'direccion.required_if' => 'Para envío a domicilio indique la dirección de entrega.',
                'fecha_preferida.after_or_equal' => 'La fecha preferida no puede ser anterior a hoy.',
                'latitud.required_if' => 'Marque su ubicación en el mapa.',
                'longitud.required_if' => 'Marque su ubicación en el mapa.',
                'latitud.between' => 'La ubicación debe estar dentro de Bolivia.',
                'longitud.between' => 'La ubicación debe estar dentro de Bolivia.',
            ],
        ];
    }

    public static function nuevoPedido(int $clienteId, string $origen = 'inmediato', ?int $encargoId = null): int
    {
        return (int) DB::selectOne(
            "WITH s AS (SELECT nextval(pg_get_serial_sequence('pedido', 'id'))::int AS id)
             INSERT INTO pedido (id, numero, cliente_id, origen, encargo_id)
             SELECT id, 'PED-' || lpad(id::text, 6, '0'), ?, ?, ? FROM s RETURNING id",
            [$clienteId, $origen, $encargoId]
        )->id;
    }

    /** Id del carrito del cliente (bloqueado FOR UPDATE) o null. */
    public static function carritoId(int $clienteId, bool $crear = false): ?int
    {
        $id = DB::selectOne(
            "SELECT p.id FROM pedido p WHERE p.cliente_id = ? AND p.estado = 'pendiente' AND p.origen = 'inmediato'
               AND NOT EXISTS (SELECT 1 FROM entrega en WHERE en.pedido_id = p.id)
             ORDER BY p.id LIMIT 1 FOR UPDATE",
            [$clienteId]
        )?->id;

        return $id ? (int) $id : ($crear ? self::nuevoPedido($clienteId) : null);
    }

    public static function recalcular(int $pedidoId): void
    {
        DB::update('UPDATE pedido SET subtotal = COALESCE((SELECT SUM(dp.subtotal) FROM detalle_pedido dp WHERE dp.pedido_id = ?), 0) WHERE id = ?', [$pedidoId, $pedidoId]);
    }

    /** Carrito con detalle y disponibilidad actual de cada producto. */
    public static function carrito(int $clienteId): array
    {
        $id = DB::table('pedido as p')->where('p.cliente_id', $clienteId)->where('p.estado', 'pendiente')->where('p.origen', 'inmediato')
            ->whereNotExists(fn ($q) => $q->from('entrega as en')->whereColumn('en.pedido_id', 'p.id'))
            ->orderBy('p.id')->value('p.id');
        if (! $id) {
            return ['id' => null, 'detalles' => [], 'subtotal' => 0, 'tarifa_envio' => EnvioServicio::tarifa()];
        }
        $pedido = DB::table('pedido')->where('id', $id)->first(['id', 'numero', 'subtotal']);
        $detalles = DB::table('detalle_pedido as dp')
            ->join('producto as pr', 'pr.id', '=', 'dp.producto_id')
            ->join('categoria as c', 'c.id', '=', 'pr.categoria_id')
            ->join('v_disponibilidad_producto as d', 'd.producto_id', '=', 'dp.producto_id')
            ->where('dp.pedido_id', $id)->orderBy('pr.nombre')
            ->get(['dp.producto_id', 'pr.nombre', 'pr.imagen', 'pr.presentacion', 'pr.unidad_medida', 'pr.estado', 'c.nombre as categoria',
                'dp.cantidad', 'dp.precio_unitario', 'dp.subtotal', 'd.stock_disponible']);

        return ['id' => $pedido->id, 'numero' => $pedido->numero, 'detalles' => $detalles, 'subtotal' => (float) $pedido->subtotal, 'tarifa_envio' => EnvioServicio::tarifa()];
    }

    public static function validarProductoVendible(int $productoId): object
    {
        $p = DB::table('producto as p')->join('v_disponibilidad_producto as d', 'd.producto_id', '=', 'p.id')
            ->where('p.id', $productoId)->first(['p.id', 'p.nombre', 'p.estado', 'p.modalidad_venta', 'p.precio_venta', 'p.unidad_medida', 'd.stock_disponible']);
        if (! $p || $p->estado !== 'activo') {
            throw new ErrorNegocio('El producto no existe o ya no está a la venta.');
        }
        if ($p->modalidad_venta === 'encargo') {
            throw new ErrorNegocio("“{$p->nombre}” solo se vende por encargo. Solicítelo desde la ficha del producto.");
        }

        return $p;
    }

    /**
     * Reserva el stock y registra la entrega. Primero verifica la disponibilidad para dar un mensaje claro;
     * fn_reservar_pedido (FOR UPDATE) es la defensa final ante compras simultáneas.
     * En envíos el costo se calcula con la distancia de la ubicación marcada en el mapa.
     *
     * @param  array  $e  tipo_entrega, direccion, referencia, fecha_preferida, latitud, longitud
     */
    public static function reservarYEntregar(int $pedidoId, array $e): void
    {
        $faltantes = [];
        $filas = DB::select(
            'SELECT pr.nombre, dp.cantidad, d.stock_disponible, pr.unidad_medida, pr.estado
               FROM detalle_pedido dp JOIN producto pr ON pr.id = dp.producto_id
               JOIN v_disponibilidad_producto d ON d.producto_id = dp.producto_id WHERE dp.pedido_id = ?',
            [$pedidoId]
        );
        if (! $filas) {
            throw new ErrorNegocio('El carrito está vacío.');
        }
        foreach ($filas as $f) {
            if ($f->estado !== 'activo') {
                $faltantes[] = "{$f->nombre}: ya no está a la venta";
            } elseif ((float) $f->cantidad > (float) $f->stock_disponible) {
                $faltantes[] = "{$f->nombre}: pidió ".self::num($f->cantidad).', hay '.self::num($f->stock_disponible)." {$f->unidad_medida}";
            }
        }
        if ($faltantes) {
            throw new ErrorNegocio('No hay stock suficiente para confirmar: '.implode('; ', $faltantes).'. Ajuste las cantidades o haga un encargo.');
        }

        $entrega = [
            'pedido_id' => $pedidoId, 'tipo' => $e['tipo_entrega'], 'referencia' => $e['referencia'] ?? null,
            'fecha_preferida' => $e['fecha_preferida'] ?? null,
        ];
        if ($e['tipo_entrega'] === 'envio') {
            if (! isset($e['latitud'], $e['longitud'])) {
                throw new ErrorNegocio('Para envío a domicilio marque su ubicación en el mapa.');
            }
            $km = EnvioServicio::distanciaKm((float) $e['latitud'], (float) $e['longitud']);
            $costo = EnvioServicio::costo($km);
            $direccion = ($e['direccion'] ?? null) ?: DB::table('pedido as p')->join('usuario as u', 'u.id', '=', 'p.cliente_id')->where('p.id', $pedidoId)->value('u.direccion');
            if (! $direccion) {
                throw new ErrorNegocio('Para envío a domicilio indique la dirección de entrega.');
            }
            DB::table('pedido')->where('id', $pedidoId)->update(['costo_envio' => $costo]);
            $entrega += ['direccion' => $direccion, 'latitud' => $e['latitud'], 'longitud' => $e['longitud'], 'distancia_km' => $km];
        }

        DB::select('SELECT fn_reservar_pedido(?, ?)', [$pedidoId, self::MINUTOS_RESERVA]);
        DB::table('entrega')->insert($entrega);
    }

    /** Si el saldo llegó a 0 y el pedido estaba pendiente: pasa a CONFIRMADO y se notifica. */
    public static function revisarPagoCompleto(int $pedidoId, ?int $gestor = null): bool
    {
        $f = DB::selectOne('SELECT p.estado, p.cliente_id, p.numero, s.saldo_pendiente FROM pedido p
                              JOIN v_saldo_pedido s ON s.pedido_id = p.id WHERE p.id = ?', [$pedidoId]);
        if (! $f || (float) $f->saldo_pendiente > 0.004 || $f->estado !== 'pendiente') {
            return false;
        }
        DB::update('UPDATE pedido SET estado = \'confirmado\', gestionado_por = COALESCE(gestionado_por, ?) WHERE id = ?', [$gestor, $pedidoId]);
        NotificacionServicio::notificar((int) $f->cliente_id, 'pedido_confirmado',
            "Tu pedido {$f->numero} fue CONFIRMADO: el pago está completo. Te avisaremos la fecha y hora de entrega.", $pedidoId);
        // El plan de pagos (si existe) queda pagado
        DB::table('plan_pago')->where('pedido_id', $pedidoId)->update(['estado' => 'pagado']);

        return true;
    }

    /** Pedido real (con entrega) bloqueado, verificando propiedad. */
    public static function pedidoPara(int $pedidoId, Usuario $usuario, bool $bloquear = true): Pedido
    {
        $q = Pedido::whereKey($pedidoId)->whereHas('entrega');
        $p = $bloquear ? $q->lockForUpdate()->first() : $q->first();
        if (! $p) {
            throw new ErrorNegocio('El pedido no existe.', 404);
        }
        if (! $usuario->esStaff() && $p->cliente_id !== $usuario->id) {
            throw new ErrorNegocio('El pedido no le pertenece.', 403);
        }

        return $p;
    }

    public static function cambiarEstado(Pedido $p, string $nuevo, Usuario $gestor, ?string $fechaProgramada = null): string
    {
        $esperado = self::TRANSICIONES[$nuevo] ?? null;
        if ($p->estado !== $esperado) {
            throw new ErrorNegocio("El pedido {$p->numero} está ".self::etiqueta($p->estado).'; solo puede pasar a '.self::etiqueta($nuevo).' desde '.self::etiqueta($esperado ?? '-').'.');
        }
        DB::table('pedido')->where('id', $p->id)->update(['gestionado_por' => $gestor->id]);
        $extra = '';
        switch ($nuevo) {
            case 'confirmado':
                DB::table('pedido')->where('id', $p->id)->update(['estado' => 'confirmado']);
                NotificacionServicio::notificar($p->cliente_id, 'pedido_confirmado', "Tu pedido {$p->numero} fue CONFIRMADO por FEDER.", $p->id);
                $saldo = (float) DB::table('v_saldo_pedido')->where('pedido_id', $p->id)->value('saldo_pendiente');
                $extra = $saldo > 0 ? ' Atención: aún tiene saldo pendiente de Bs. '.number_format($saldo, 2).' (pago contra entrega).' : '';
                break;
            case 'listo_entrega':
                // Programar la entrega: las reservas pasan a salidas de inventario por lote (y se revisa el stock mínimo)
                if (! $fechaProgramada) {
                    throw new ErrorNegocio('Indique la fecha y hora aproximada de la entrega.');
                }
                DB::select('SELECT fn_confirmar_reservas(?, ?)', [$p->id, $gestor->id]);
                DB::table('pedido')->where('id', $p->id)->update(['estado' => 'listo_entrega']);
                DB::table('entrega')->where('pedido_id', $p->id)->update(['fecha_programada' => $fechaProgramada]);
                self::notificarProgramacion($p, $fechaProgramada);
                $extra = ' Se registraron las salidas de inventario y se notificó al cliente.';
                break;
            case 'entregado':
                DB::table('pedido')->where('id', $p->id)->update(['estado' => 'entregado']);
                DB::update("UPDATE entrega SET estado = 'entregada', fecha_entrega = COALESCE(fecha_entrega, now()),
                            despachado_por = COALESCE(despachado_por, ?) WHERE pedido_id = ?", [$gestor->id, $p->id]);
                NotificacionServicio::notificar($p->cliente_id, 'pedido_entregado', "Tu pedido {$p->numero} fue ENTREGADO. ¡Gracias por tu compra!", $p->id);
                break;
        }

        return "Pedido {$p->numero}: ".self::etiqueta($nuevo).'.'.$extra;
    }

    public static function cancelar(Pedido $p, Usuario $usuario): string
    {
        $permitido = $usuario->esStaff() ? in_array($p->estado, ['pendiente', 'confirmado'], true) : $p->estado === 'pendiente';
        if (! $permitido) {
            throw new ErrorNegocio("El pedido está ".self::etiqueta($p->estado).' y no puede cancelarse'.($usuario->esStaff() ? '.' : '; comuníquese con FEDER.'));
        }
        DB::select('SELECT fn_liberar_reservas(?)', [$p->id]);
        DB::table('pedido')->where('id', $p->id)->update(['estado' => 'cancelado']);
        $devuelto = self::reembolsarStripe($p->id);
        DB::table('pago')->where('pedido_id', $p->id)->where('estado', 'pendiente')->update(['estado' => 'anulado']);
        DB::table('plan_pago')->where('pedido_id', $p->id)->update(['estado' => 'cancelado']);
        DB::table('entrega')->where('pedido_id', $p->id)->where('estado', '!=', 'entregada')->update(['estado' => 'fallida']);
        NotificacionServicio::notificar($p->cliente_id, 'pedido_cancelado', "Tu pedido {$p->numero} fue CANCELADO. El stock reservado fue liberado.", $p->id);
        $cobrado = (float) DB::table('v_saldo_pedido')->where('pedido_id', $p->id)->value('cobrado');

        return "Pedido {$p->numero} cancelado. El stock reservado volvió a estar disponible."
            .($devuelto > 0 ? ' Se reembolsaron Bs. '.number_format($devuelto, 2).' a la tarjeta del cliente (Stripe).' : '')
            .($cobrado > 0 ? ' Atención: tenía pagos confirmados por Bs. '.number_format($cobrado, 2).' que deben devolverse.' : '');
    }

    /** Al cancelar: los cobros con Stripe se reembolsan y los 3D Secure a medias se cancelan. Devuelve el monto devuelto. */
    private static function reembolsarStripe(int $pedidoId): float
    {
        $pagos = DB::table('pago')->where('pedido_id', $pedidoId)->where('pasarela', 'stripe')->whereIn('estado', ['pagado', 'pendiente'])->get();
        if ($pagos->isEmpty() || ! StripeServicio::activo()) {
            return 0;
        }
        // Primero se registra en la BD y AL FINAL se llama a Stripe: si Stripe falla, la transacción
        // se deshace; si la BD fallara, Stripe nunca habría devuelto el dinero (no quedan descuadres).
        $pagados = $pagos->where('estado', 'pagado');
        DB::table('pago')->whereIn('id', $pagados->pluck('id'))->update(['estado' => 'devuelto']);
        $stripe = app(StripeServicio::class);
        foreach ($pagos->where('estado', 'pendiente') as $pago) {
            $stripe->cancelar($pago->codigo_transaccion);
        }
        foreach ($pagados as $pago) {
            $stripe->reembolsar($pago->codigo_transaccion);
        }

        return (float) $pagados->sum('monto');
    }

    /** Avisa al cliente cuándo (fecha y hora aproximada) se entrega o puede recoger su pedido. */
    public static function notificarProgramacion(Pedido $p, string $fechaProgramada, bool $reprogramada = false): void
    {
        $en = DB::table('entrega')->where('pedido_id', $p->id)->first();
        $cuando = self::fechaAmigable($fechaProgramada);
        $texto = $en->tipo === 'recojo'
            ? "Tu pedido {$p->numero} estará listo para recoger en las oficinas de FEDER desde el {$cuando}."
            : "Tu pedido {$p->numero} se entregará el {$cuando} en: {$en->direccion}.";
        NotificacionServicio::notificar($p->cliente_id, 'pedido_listo', ($reprogramada ? 'Entrega REPROGRAMADA. ' : '').$texto, $p->id);
    }

    /** "jue 26/11 aprox. a las 15:00" */
    public static function fechaAmigable(string $fecha): string
    {
        $f = Carbon::parse($fecha);
        $dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

        return $dias[$f->dayOfWeek].' '.$f->format('d/m').' aprox. a las '.$f->format('H:i');
    }

    public static function etiqueta(string $estado): string
    {
        return [
            'pendiente' => 'PENDIENTE DE PAGO', 'confirmado' => 'CONFIRMADO', 'listo_entrega' => 'ENTREGA PROGRAMADA',
            'entregado' => 'ENTREGADO', 'cancelado' => 'CANCELADO',
        ][$estado] ?? mb_strtoupper(str_replace('_', ' ', $estado));
    }

    private static function num($v): string
    {
        return rtrim(rtrim(number_format((float) $v, 2, '.', ''), '0'), '.');
    }
}
