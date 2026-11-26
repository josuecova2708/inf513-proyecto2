<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Tareas periódicas del 1er parcial (Mantenimiento.java) ejecutadas de forma "perezosa":
 * como el servidor no tiene cron para Laravel, se lanzan como máximo cada 5 minutos
 * cuando alguien usa el catálogo o el carrito.
 */
class MantenimientoServicio
{
    public static function ejecutarSiCorresponde(): void
    {
        if (! Cache::add('mantenimiento_feder', true, 300)) {
            return;
        }
        try {
            self::ejecutar();
        } catch (Throwable $e) {
            report($e);
        }
    }

    public static function ejecutar(): array
    {
        // 1. Reservas vencidas de pedidos pendientes: se libera el stock y se cancela el pedido
        $liberados = (int) DB::selectOne('SELECT fn_liberar_reservas_vencidas() AS n')->n;

        // 2. Lotes vencidos
        $vencidos = DB::update("UPDATE lote SET estado = 'vencido', version = version + 1
                                 WHERE estado = 'disponible' AND fecha_vencimiento < CURRENT_DATE");

        // 3. Alertas de vencimiento próximo (7 días), una activa por producto
        DB::insert("INSERT INTO alerta_inventario (producto_id, tipo, mensaje)
            SELECT DISTINCT pr.producto_id, 'vencimiento',
                   format('El lote %s de %s vence el %s', l.codigo, p.nombre, to_char(l.fecha_vencimiento, 'DD/MM/YYYY'))
              FROM lote l
              JOIN produccion pr ON pr.id_produccion = l.produccion_id
              JOIN producto p ON p.id_producto = pr.producto_id
             WHERE l.estado = 'disponible' AND l.stock_disponible > 0
               AND l.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
               AND NOT EXISTS (SELECT 1 FROM alerta_inventario a
                                WHERE a.producto_id = pr.producto_id AND a.tipo = 'vencimiento' AND a.estado = 'activa')");

        // 4. Stock bajo el mínimo
        DB::select('SELECT fn_revisar_stock_minimo(id_producto) FROM producto WHERE estado = \'activo\'');

        // 5. Cuotas vencidas de planes de pago
        $cuotas = DB::update("UPDATE cuota_pago SET estado = 'vencida' WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE");

        return ['pedidos_liberados' => $liberados, 'lotes_vencidos' => $vencidos, 'cuotas_vencidas' => $cuotas];
    }
}
