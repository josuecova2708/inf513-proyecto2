<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Tablas nuevas del Proyecto 2 (web): bitácora, contador de visitas, menú dinámico,
 * preferencias de tema/accesibilidad, métodos de pago por usuario y planes de pago.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
-- Bitácora de auditoría: logins, intentos fallidos, IPs y accesos a recursos
CREATE TABLE bitacora (
    id_bitacora BIGSERIAL PRIMARY KEY,
    usuario_id  INT          REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    email       VARCHAR(120),
    accion      VARCHAR(20)  NOT NULL
                CHECK (accion IN ('login_ok', 'login_fallido', 'logout', 'registro',
                                  'acceso', 'crear', 'editar', 'eliminar', 'acceso_denegado')),
    recurso     VARCHAR(80),
    metodo      VARCHAR(10),
    ruta        VARCHAR(255),
    codigo_http SMALLINT,
    ip          VARCHAR(45),
    user_agent  VARCHAR(255),
    detalle     VARCHAR(255),
    fecha       TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_bitacora_accion_fecha ON bitacora(accion, fecha);
CREATE INDEX ix_bitacora_recurso      ON bitacora(recurso);
CREATE INDEX ix_bitacora_usuario      ON bitacora(usuario_id, fecha);

-- Contador de visitas persistente por página (se muestra en el footer)
CREATE TABLE visita_pagina (
    id_visita_pagina SERIAL PRIMARY KEY,
    pagina        VARCHAR(150) NOT NULL UNIQUE,
    contador      BIGINT       NOT NULL DEFAULT 0 CHECK (contador >= 0),
    ultima_visita TIMESTAMP    NOT NULL DEFAULT now()
);

-- Menú dinámico: cada opción depende de un permiso (módulo); se muestra si el rol tiene "ver"
CREATE TABLE menu (
    id_menu   SERIAL PRIMARY KEY,
    menu_padre_id    INT          REFERENCES menu(id_menu) ON DELETE CASCADE,
    permiso_id  INT          REFERENCES permiso(id_permiso) ON DELETE CASCADE,
    titulo      VARCHAR(60)  NOT NULL,
    ruta        VARCHAR(120),
    icono       VARCHAR(40),
    orden       INT          NOT NULL DEFAULT 0,
    activo      BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX ix_menu_padre ON menu(menu_padre_id, orden);

-- Preferencias visuales del usuario (tema por segmento, día/noche, accesibilidad)
CREATE TABLE preferencia_usuario (
    usuario_id    INT         PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    tema          VARCHAR(10) NOT NULL DEFAULT 'adultos' CHECK (tema IN ('ninos', 'jovenes', 'adultos')),
    modo          VARCHAR(5)  NOT NULL DEFAULT 'auto'    CHECK (modo IN ('dia', 'noche', 'auto')),
    tamano_fuente SMALLINT    NOT NULL DEFAULT 16        CHECK (tamano_fuente BETWEEN 12 AND 26),
    contraste     VARCHAR(6)  NOT NULL DEFAULT 'normal'  CHECK (contraste IN ('normal', 'alto'))
);

-- Métodos de pago registrados por el usuario (tarjetas simuladas / cuentas)
-- Nunca se guarda el número completo ni el CVV: solo marca, últimos 4 dígitos y un token simulado.
CREATE TABLE metodo_pago_usuario (
    id_metodo_pago_usuario SERIAL PRIMARY KEY,
    usuario_id      INT          NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    metodo_pago_id  INT          NOT NULL REFERENCES metodo_pago(id_metodo_pago),
    alias           VARCHAR(50)  NOT NULL,
    titular         VARCHAR(120) NOT NULL,
    marca           VARCHAR(20),
    ultimos4        CHAR(4),
    mes_venc        SMALLINT     CHECK (mes_venc BETWEEN 1 AND 12),
    anio_venc       SMALLINT     CHECK (anio_venc BETWEEN 2000 AND 2100),
    banco           VARCHAR(80),
    token_simulado  VARCHAR(64)  NOT NULL UNIQUE,
    predeterminado  BOOLEAN      NOT NULL DEFAULT FALSE,
    estado          VARCHAR(10)  NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    fecha_registro  TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX ix_mpu_usuario ON metodo_pago_usuario(usuario_id, estado);

-- Plan de pagos (crédito en cuotas) de un pedido
CREATE TABLE plan_pago (
    id_plan_pago SERIAL PRIMARY KEY,
    pedido_id      INT           NOT NULL UNIQUE REFERENCES pedido(id_pedido) ON DELETE CASCADE,
    usuario_id     INT           NOT NULL REFERENCES usuario(id_usuario),
    nro_cuotas     SMALLINT      NOT NULL CHECK (nro_cuotas BETWEEN 2 AND 12),
    frecuencia     VARCHAR(10)   NOT NULL DEFAULT 'mensual' CHECK (frecuencia IN ('semanal', 'quincenal', 'mensual')),
    monto_total    NUMERIC(12,2) NOT NULL CHECK (monto_total > 0),
    cuota_inicial  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cuota_inicial >= 0),
    estado         VARCHAR(10)   NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'pagado', 'cancelado')),
    fecha          TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE TABLE cuota_pago (
    id_cuota_pago   SERIAL PRIMARY KEY,
    plan_pago_id      INT           NOT NULL REFERENCES plan_pago(id_plan_pago) ON DELETE CASCADE,
    numero            SMALLINT      NOT NULL CHECK (numero >= 1),
    monto             NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha_vencimiento DATE          NOT NULL,
    estado            VARCHAR(10)   NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'vencida')),
    fecha_pago        TIMESTAMP,
    UNIQUE (plan_pago_id, numero)
);
CREATE INDEX ix_cuota_estado ON cuota_pago(estado, fecha_vencimiento);

-- Pagos: enlazar con el método del usuario, la cuota y el código de transacción de la pasarela
ALTER TABLE pago
    ADD COLUMN metodo_pago_usuario_id INT REFERENCES metodo_pago_usuario(id_metodo_pago_usuario) ON DELETE SET NULL,
    ADD COLUMN cuota_pago_id          INT REFERENCES cuota_pago(id_cuota_pago) ON DELETE SET NULL,
    ADD COLUMN codigo_transaccion     VARCHAR(40),
    ADD COLUMN usuario_id         INT REFERENCES usuario(id_usuario);
CREATE INDEX ix_pago_cuota ON pago(cuota_pago_id);

-- Notificaciones web: más tipos
ALTER TABLE notificacion DROP CONSTRAINT IF EXISTS notificacion_tipo_check;
ALTER TABLE notificacion ALTER COLUMN tipo TYPE VARCHAR(25);
ALTER TABLE notificacion ADD CONSTRAINT notificacion_tipo_check CHECK (tipo IN (
    'pedido_confirmado', 'pago_confirmado', 'encargo_disponible', 'pedido_listo',
    'pedido_cancelado', 'entrega_en_camino', 'pedido_entregado', 'pago_rechazado',
    'cuota_vencida', 'encargo_actualizado', 'produccion_validada'));
ALTER TABLE notificacion ALTER COLUMN canal SET DEFAULT 'sistema';
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE pago DROP COLUMN IF EXISTS metodo_pago_usuario_id, DROP COLUMN IF EXISTS cuota_pago_id,
                 DROP COLUMN IF EXISTS codigo_transaccion, DROP COLUMN IF EXISTS usuario_id;
DROP TABLE IF EXISTS cuota_pago, plan_pago, metodo_pago_usuario, preferencia_usuario, menu, visita_pagina, bitacora CASCADE;
SQL);
    }
};
