<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Flujo de pedido en 4 pasos: pendiente → confirmado → listo_entrega (entrega programada) → entregado.
 * Se elimina "en_preparacion": la salida de inventario ocurre al programar la entrega.
 * La entrega guarda la fecha preferida del cliente, la ubicación (mapa) y la distancia a FEDER.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
UPDATE pedido SET estado = 'listo_entrega' WHERE estado = 'en_preparacion';
ALTER TABLE pedido DROP CONSTRAINT pedido_estado_check;
ALTER TABLE pedido ADD CONSTRAINT pedido_estado_check
    CHECK (estado IN ('pendiente', 'confirmado', 'listo_entrega', 'entregado', 'cancelado'));

-- Igual que antes, pero ya no cambia el estado del pedido (lo decide PedidoServicio)
CREATE OR REPLACE FUNCTION fn_confirmar_reservas(p_pedido_id INT, p_usuario_id INT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT rl.id_reserva_lote AS id, rl.lote_id, rl.cantidad, dp.producto_id
        FROM reserva_lote rl JOIN detalle_pedido dp ON dp.id_detalle_pedido = rl.detalle_pedido_id
        WHERE dp.pedido_id = p_pedido_id AND rl.estado = 'reservada'
        FOR UPDATE OF rl
    LOOP
        UPDATE lote SET stock_reservado = stock_reservado - r.cantidad, version = version + 1
         WHERE id_lote = r.lote_id;
        UPDATE reserva_lote SET estado = 'confirmada' WHERE id_reserva_lote = r.id;
        INSERT INTO movimiento_inventario (lote_id, usuario_id, tipo, cantidad, motivo)
        VALUES (r.lote_id, p_usuario_id, 'salida', r.cantidad, 'Pedido ' || p_pedido_id);
        PERFORM fn_revisar_stock_minimo(r.producto_id);
    END LOOP;
END $$;

ALTER TABLE entrega
    ADD COLUMN fecha_preferida DATE,
    ADD COLUMN latitud         NUMERIC(9, 6) CHECK (latitud BETWEEN -90 AND 90),
    ADD COLUMN longitud        NUMERIC(9, 6) CHECK (longitud BETWEEN -180 AND 180),
    ADD COLUMN distancia_km    NUMERIC(6, 2) CHECK (distancia_km >= 0);
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE entrega DROP COLUMN fecha_preferida, DROP COLUMN latitud, DROP COLUMN longitud, DROP COLUMN distancia_km;
ALTER TABLE pedido DROP CONSTRAINT pedido_estado_check;
ALTER TABLE pedido ADD CONSTRAINT pedido_estado_check
    CHECK (estado IN ('pendiente', 'confirmado', 'en_preparacion', 'listo_entrega', 'entregado', 'cancelado'));
SQL);
    }
};
