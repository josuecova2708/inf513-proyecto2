<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Soporte de Stripe para pagos con tarjeta (sin tablas nuevas):
 *  - usuario.stripe_customer_id: "Customer" de Stripe al que se adjuntan sus tarjetas
 *  - metodo_pago_usuario.proveedor + token_pasarela (pm_... de Stripe o tok_... simulado)
 *  - pago.pasarela y estado 'devuelto' (reembolso al cancelar un pedido pagado con Stripe)
 * pago.estado no cambia de tipo: la vista v_saldo_pedido depende de esa columna.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(40) UNIQUE;

ALTER TABLE metodo_pago_usuario RENAME COLUMN token_simulado TO token_pasarela;
ALTER TABLE metodo_pago_usuario
    ADD COLUMN proveedor VARCHAR(10) NOT NULL DEFAULT 'simulada' CHECK (proveedor IN ('simulada', 'stripe'));

ALTER TABLE pago ADD COLUMN pasarela VARCHAR(10) NOT NULL DEFAULT 'simulada' CHECK (pasarela IN ('simulada', 'stripe'));
ALTER TABLE pago ALTER COLUMN codigo_transaccion TYPE VARCHAR(60);
ALTER TABLE pago DROP CONSTRAINT pago_estado_check;
ALTER TABLE pago ADD CONSTRAINT pago_estado_check
    CHECK (estado IN ('pendiente', 'pagado', 'rechazado', 'anulado', 'devuelto'));
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
UPDATE pago SET estado = 'anulado' WHERE estado = 'devuelto';
ALTER TABLE pago DROP CONSTRAINT pago_estado_check;
ALTER TABLE pago ADD CONSTRAINT pago_estado_check CHECK (estado IN ('pendiente', 'pagado', 'rechazado', 'anulado'));
ALTER TABLE pago DROP COLUMN pasarela;
ALTER TABLE metodo_pago_usuario DROP COLUMN proveedor;
ALTER TABLE metodo_pago_usuario RENAME COLUMN token_pasarela TO token_simulado;
ALTER TABLE usuario DROP COLUMN stripe_customer_id;
SQL);
    }
};
