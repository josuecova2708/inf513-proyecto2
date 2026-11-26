-- FEDER: esquema base heredado del 1er parcial (proyecto_grupo28/db/schema.sql)
-- Sin DROP SCHEMA ni datos iniciales: los datos se cargan con los seeders de Laravel.

-- =============================================================================
-- 1. TABLAS
-- =============================================================================

-- ---------- CU1: Usuarios y permisos -----------------------------------------

CREATE TABLE rol (
    id_rol     SERIAL PRIMARY KEY,
    nombre       VARCHAR(50)  NOT NULL UNIQUE,      -- Administrador, Personal, Productor, Cliente
    descripcion  VARCHAR(200)
);

CREATE TABLE permiso (
    id_permiso SERIAL PRIMARY KEY,
    nombre  VARCHAR(80)  NOT NULL,
    modulo  VARCHAR(50)  NOT NULL,                  -- p. ej. pedidos, inventario, reportes
    accion  VARCHAR(50)  NOT NULL,
    UNIQUE (modulo, accion)
);

-- Clase intermedia Rol - Permiso (muchos a muchos)
CREATE TABLE rol_permiso (
    rol_id      INT NOT NULL REFERENCES rol(id_rol)     ON DELETE CASCADE,
    permiso_id  INT NOT NULL REFERENCES permiso(id_permiso) ON DELETE CASCADE,
    ver         BOOLEAN NOT NULL DEFAULT TRUE,
    crear       BOOLEAN NOT NULL DEFAULT FALSE,
    editar      BOOLEAN NOT NULL DEFAULT FALSE,
    eliminar    BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE usuario (
    id_usuario    SERIAL PRIMARY KEY,
    rol_id          INT          NOT NULL REFERENCES rol(id_rol),
    nombre          VARCHAR(80)  NOT NULL,
    apellido        VARCHAR(80)  NOT NULL,
    ci              VARCHAR(20)  UNIQUE,
    email           VARCHAR(120) NOT NULL UNIQUE,
    telefono        VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,
    direccion       VARCHAR(200),
    estado          VARCHAR(10)  NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo', 'inactivo')),
    fecha_registro  TIMESTAMP    NOT NULL DEFAULT now()
);

-- ---------- CU2: Emprendimientos y comunidades -------------------------------

CREATE TABLE comunidad (
    id_comunidad SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    municipio     VARCHAR(80)  NOT NULL,
    provincia     VARCHAR(80),
    departamento  VARCHAR(50)  NOT NULL DEFAULT 'Santa Cruz',
    descripcion   TEXT,
    UNIQUE (nombre, municipio)
);

CREATE TABLE emprendimiento (
    id_emprendimiento SERIAL PRIMARY KEY,
    comunidad_id  INT          NOT NULL REFERENCES comunidad(id_comunidad),
    usuario_id    INT          UNIQUE REFERENCES usuario(id_usuario) ON DELETE SET NULL,
                  -- 0..1 - 0..1: NULL si no tiene cuenta; UNIQUE = una cuenta por emprendimiento
    nombre        VARCHAR(120) NOT NULL,
    rubro         VARCHAR(30)  NOT NULL
                  CHECK (rubro IN ('agricola', 'artesania', 'alimentos_procesados', 'textil', 'otro')),
    responsable   VARCHAR(120) NOT NULL,
    ci_nit        VARCHAR(20),
    telefono      VARCHAR(20),
    direccion     VARCHAR(200),
    latitud       NUMERIC(9, 6) CHECK (latitud  BETWEEN -90  AND 90),
    longitud      NUMERIC(9, 6) CHECK (longitud BETWEEN -180 AND 180),
    estado        VARCHAR(10)  NOT NULL DEFAULT 'activo'
                  CHECK (estado IN ('activo', 'inactivo'))
);

-- ---------- CU3 / CU4: Catalogo, produccion, lotes e inventario --------------

CREATE TABLE categoria (
    id_categoria SERIAL PRIMARY KEY,
    nombre       VARCHAR(80) NOT NULL UNIQUE,
    descripcion  VARCHAR(200)
);

CREATE TABLE producto (
    id_producto    SERIAL PRIMARY KEY,
    categoria_id     INT            NOT NULL REFERENCES categoria(id_categoria),
    nombre           VARCHAR(120)   NOT NULL,
    descripcion      TEXT,
    imagen           VARCHAR(255),                  -- ruta o URL
    presentacion     VARCHAR(80),                   -- p. ej. bolsa 1 kg, frasco 500 g
    unidad_medida    VARCHAR(20)    NOT NULL,       -- kg, unidad, litro...
    precio_venta     NUMERIC(10, 2) NOT NULL CHECK (precio_venta >= 0),
    modalidad_venta  VARCHAR(10)    NOT NULL DEFAULT 'ambas'
                     CHECK (modalidad_venta IN ('inmediata', 'encargo', 'ambas')),
    stock_minimo     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    estado           VARCHAR(10)    NOT NULL DEFAULT 'activo'
                     CHECK (estado IN ('activo', 'inactivo'))
);

-- Clase intermedia Emprendimiento - Producto (lo que ofrece cada emprendimiento)
CREATE TABLE emprendimiento_producto (
    emprendimiento_id  INT NOT NULL REFERENCES emprendimiento(id_emprendimiento) ON DELETE CASCADE,
    producto_id        INT NOT NULL REFERENCES producto(id_producto)       ON DELETE CASCADE,
    precio_referencia  NUMERIC(10, 2) CHECK (precio_referencia >= 0),
    temporada          VARCHAR(50),                 -- p. ej. "marzo-junio", "todo el ano"
    PRIMARY KEY (emprendimiento_id, producto_id)
);

CREATE TABLE produccion (
    id_produccion    SERIAL PRIMARY KEY,
    emprendimiento_id  INT            NOT NULL REFERENCES emprendimiento(id_emprendimiento),
    producto_id        INT            NOT NULL REFERENCES producto(id_producto),
    validador_id       INT            REFERENCES usuario(id_usuario),   -- «personal», NULL hasta validar
    tipo               VARCHAR(10)    NOT NULL DEFAULT 'disponible'
                       CHECK (tipo IN ('disponible', 'futura')),
    cantidad           NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
    unidad_medida      VARCHAR(20)    NOT NULL,
    fecha_produccion   DATE,                        -- cosecha o elaboracion
    fecha_disponible   DATE,
    precio_propuesto   NUMERIC(10, 2) CHECK (precio_propuesto >= 0),
    procedencia        VARCHAR(200),
    estado             VARCHAR(10)    NOT NULL DEFAULT 'reportada'
                       CHECK (estado IN ('reportada', 'validada', 'rechazada')),
    fecha_validacion   TIMESTAMP,
    observacion        TEXT,
    fecha_registro     TIMESTAMP      NOT NULL DEFAULT now(),
    CHECK (estado = 'reportada' OR (validador_id IS NOT NULL AND fecha_validacion IS NOT NULL))
);

CREATE TABLE lote (
    id_lote          SERIAL PRIMARY KEY,
    produccion_id      INT            NOT NULL REFERENCES produccion(id_produccion),
    codigo             VARCHAR(30)    NOT NULL UNIQUE,
    cantidad_inicial   NUMERIC(12, 2) NOT NULL CHECK (cantidad_inicial > 0),
    stock_disponible   NUMERIC(12, 2) NOT NULL CHECK (stock_disponible >= 0),   -- ultima defensa RF10
    stock_reservado    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (stock_reservado >= 0),
    costo_unitario     NUMERIC(10, 2) CHECK (costo_unitario >= 0),
    fecha_ingreso      DATE           NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento  DATE,
    estado             VARCHAR(10)    NOT NULL DEFAULT 'disponible'
                       CHECK (estado IN ('disponible', 'agotado', 'vencido')),
    version            INT            NOT NULL DEFAULT 0,   -- control de concurrencia optimista
    CHECK (fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_ingreso)
);

CREATE TABLE movimiento_inventario (
    id_movimiento_inventario SERIAL PRIMARY KEY,
    lote_id     INT            NOT NULL REFERENCES lote(id_lote),
    usuario_id  INT            REFERENCES usuario(id_usuario),  -- «personal»; NULL si lo registra el sistema
    tipo        VARCHAR(12)    NOT NULL
                CHECK (tipo IN ('entrada', 'salida', 'devolucion', 'ajuste')),
    cantidad    NUMERIC(12, 2) NOT NULL CHECK (cantidad <> 0),  -- ajuste puede ser negativo
    fecha       TIMESTAMP      NOT NULL DEFAULT now(),
    motivo      VARCHAR(200)
);

CREATE TABLE alerta_inventario (
    id_alerta_inventario SERIAL PRIMARY KEY,
    producto_id  INT          NOT NULL REFERENCES producto(id_producto),
    tipo         VARCHAR(15)  NOT NULL CHECK (tipo IN ('stock_bajo', 'vencimiento')),
    mensaje      VARCHAR(255) NOT NULL,
    fecha        TIMESTAMP    NOT NULL DEFAULT now(),
    estado       VARCHAR(10)  NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'atendida'))
);

-- ---------- CU5: Encargos ----------------------------------------------------

CREATE TABLE encargo (
    id_encargo     SERIAL PRIMARY KEY,
    cliente_id       INT         NOT NULL REFERENCES usuario(id_usuario),   -- «cliente»
    fecha_solicitud  TIMESTAMP   NOT NULL DEFAULT now(),
    fecha_requerida  DATE,
    estado           VARCHAR(12) NOT NULL DEFAULT 'solicitado'
                     CHECK (estado IN ('solicitado', 'aceptado', 'rechazado',
                                       'disponible', 'convertido', 'cancelado')),
    observacion      TEXT
);

-- Clase intermedia Encargo - Producto
CREATE TABLE detalle_encargo (
    encargo_id       INT            NOT NULL REFERENCES encargo(id_encargo) ON DELETE CASCADE,
    producto_id      INT            NOT NULL REFERENCES producto(id_producto),
    cantidad         NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
    precio_estimado  NUMERIC(10, 2) CHECK (precio_estimado >= 0),
    PRIMARY KEY (encargo_id, producto_id)
);

-- ---------- CU6: Pedidos, pagos, entregas y notificaciones -------------------

CREATE TABLE pedido (
    id_pedido     SERIAL PRIMARY KEY,
    numero          VARCHAR(20)    NOT NULL UNIQUE,
    cliente_id      INT            NOT NULL REFERENCES usuario(id_usuario),   -- «cliente» realiza
    personal_id  INT            REFERENCES usuario(id_usuario),            -- «personal» gestiona
    encargo_id      INT            UNIQUE REFERENCES encargo(id_encargo),     -- encargo que lo genera (0..1 - 0..1)
    origen          VARCHAR(10)    NOT NULL DEFAULT 'inmediato'
                    CHECK (origen IN ('inmediato', 'encargo')),
    fecha           TIMESTAMP      NOT NULL DEFAULT now(),
    estado          VARCHAR(15)    NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'confirmado', 'en_preparacion',
                                      'listo_entrega', 'entregado', 'cancelado')),
    nit_ci          VARCHAR(20),
    razon_social    VARCHAR(120),
    subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    costo_envio     NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (costo_envio >= 0),
    total           NUMERIC(12, 2) GENERATED ALWAYS AS (subtotal + costo_envio) STORED,
    CHECK ((origen = 'encargo') = (encargo_id IS NOT NULL))
);

-- Clase intermedia Pedido - Producto
CREATE TABLE detalle_pedido (
    id_detalle_pedido SERIAL PRIMARY KEY,         -- tiene id porque ReservaLote lo referencia
    pedido_id        INT            NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
    producto_id      INT            NOT NULL REFERENCES producto(id_producto),
    cantidad         NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
    precio_unitario  NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0),  -- precio al momento de comprar
    subtotal         NUMERIC(12, 2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    UNIQUE (pedido_id, producto_id)
);

-- Clase intermedia DetallePedido - Lote (trazabilidad + concurrencia)
CREATE TABLE reserva_lote (
    id_reserva_lote  SERIAL PRIMARY KEY,
    detalle_pedido_id  INT            NOT NULL REFERENCES detalle_pedido(id_detalle_pedido) ON DELETE CASCADE,
    lote_id            INT            NOT NULL REFERENCES lote(id_lote),
    cantidad           NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
    fecha              TIMESTAMP      NOT NULL DEFAULT now(),
    fecha_expiracion   TIMESTAMP,
    estado             VARCHAR(10)    NOT NULL DEFAULT 'reservada'
                       CHECK (estado IN ('reservada', 'confirmada', 'liberada'))
);

CREATE TABLE metodo_pago (
    id_metodo_pago SERIAL PRIMARY KEY,
    nombre      VARCHAR(30) NOT NULL UNIQUE,      -- QR, Efectivo, Tarjeta
    habilitado  BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE pago (
    id_pago       SERIAL PRIMARY KEY,
    pedido_id       INT            NOT NULL REFERENCES pedido(id_pedido),
    metodo_pago_id  INT            NOT NULL REFERENCES metodo_pago(id_metodo_pago),
    monto           NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    fecha           TIMESTAMP      NOT NULL DEFAULT now(),
    estado          VARCHAR(10)    NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'pagado', 'rechazado', 'anulado')),
    referencia      VARCHAR(100),                 -- id de transaccion del banco / pasarela
    comprobante     VARCHAR(255)                  -- ruta de la imagen o PDF
);

-- QR de cobro de FEDER (lo sube el Administrador con SUBQR; se envia al cliente que paga por QR)
CREATE TABLE qr_pago (
    id_qr_pago    SERIAL PRIMARY KEY,
    imagen          BYTEA        NOT NULL,
    tipo_mime       VARCHAR(50)  NOT NULL DEFAULT 'image/png',
    nombre_archivo  VARCHAR(120),
    usuario_id      INT          REFERENCES usuario(id_usuario),
    fecha           TIMESTAMP    NOT NULL DEFAULT now(),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE   -- solo uno activo; los anteriores quedan de historial
);

CREATE TABLE entrega (
    id_entrega      SERIAL PRIMARY KEY,
    pedido_id         INT          NOT NULL UNIQUE REFERENCES pedido(id_pedido) ON DELETE CASCADE,  -- 1 - 0..1
    personal_id    INT          REFERENCES usuario(id_usuario),   -- «personal» despacha
    tipo              VARCHAR(10)  NOT NULL CHECK (tipo IN ('recojo', 'envio')),
    direccion         VARCHAR(200),
    referencia        VARCHAR(200),
    fecha_programada  TIMESTAMP,
    fecha_entrega     TIMESTAMP,
    receptor          VARCHAR(120),
    estado            VARCHAR(12)  NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'en_camino', 'entregada', 'fallida')),
    CHECK (tipo = 'recojo' OR direccion IS NOT NULL),          -- envio exige direccion
    CHECK (estado <> 'entregada' OR fecha_entrega IS NOT NULL)
);

CREATE TABLE notificacion (
    id_notificacion SERIAL PRIMARY KEY,
    usuario_id   INT          NOT NULL REFERENCES usuario(id_usuario),
    pedido_id    INT          REFERENCES pedido(id_pedido)  ON DELETE CASCADE,
    encargo_id   INT          REFERENCES encargo(id_encargo) ON DELETE CASCADE,
    tipo         VARCHAR(20)  NOT NULL
                 CHECK (tipo IN ('pedido_confirmado', 'pago_confirmado',
                                 'encargo_disponible', 'pedido_listo')),
    canal        VARCHAR(10)  NOT NULL DEFAULT 'email' CHECK (canal IN ('email', 'sistema')),
    mensaje      VARCHAR(500) NOT NULL,
    fecha_envio  TIMESTAMP    NOT NULL DEFAULT now(),
    leida        BOOLEAN      NOT NULL DEFAULT FALSE
);

-- =============================================================================
-- 2. INDICES (llaves foraneas y busquedas frecuentes)
-- =============================================================================
CREATE INDEX ix_usuario_rol            ON usuario(rol_id);
CREATE INDEX ix_emprendimiento_com     ON emprendimiento(comunidad_id);
CREATE INDEX ix_producto_categoria     ON producto(categoria_id);
CREATE INDEX ix_produccion_emp         ON produccion(emprendimiento_id);
CREATE INDEX ix_produccion_producto    ON produccion(producto_id, estado);
CREATE INDEX ix_lote_produccion        ON lote(produccion_id);
CREATE INDEX ix_lote_vencimiento       ON lote(fecha_vencimiento) WHERE estado = 'disponible';
CREATE INDEX ix_movimiento_lote        ON movimiento_inventario(lote_id, fecha);
CREATE INDEX ix_pedido_cliente         ON pedido(cliente_id, fecha);
CREATE INDEX ix_pedido_estado          ON pedido(estado);
CREATE INDEX ix_detalle_pedido_prod    ON detalle_pedido(producto_id);
CREATE INDEX ix_reserva_detalle        ON reserva_lote(detalle_pedido_id);
CREATE INDEX ix_reserva_lote           ON reserva_lote(lote_id, estado);
CREATE INDEX ix_pago_pedido            ON pago(pedido_id, estado);
CREATE INDEX ix_encargo_cliente        ON encargo(cliente_id, estado);
CREATE INDEX ix_notificacion_usuario   ON notificacion(usuario_id, leida);

-- =============================================================================
-- 3. VISTAS
-- =============================================================================

-- Disponibilidad por producto (RF07): stock propio + produccion reportada + futura
CREATE OR REPLACE VIEW v_disponibilidad_producto AS
SELECT p.id_producto AS producto_id,
       p.nombre,
       p.stock_minimo,
       COALESCE((SELECT SUM(l.stock_disponible) FROM lote l
                  JOIN produccion pr ON pr.id_produccion = l.produccion_id
                 WHERE pr.producto_id = p.id_producto AND l.estado = 'disponible'), 0) AS stock_disponible,
       COALESCE((SELECT SUM(l.stock_reservado) FROM lote l
                  JOIN produccion pr ON pr.id_produccion = l.produccion_id
                 WHERE pr.producto_id = p.id_producto), 0)                             AS stock_reservado,
       COALESCE((SELECT SUM(pr.cantidad) FROM produccion pr
                 WHERE pr.producto_id = p.id_producto AND pr.estado = 'reportada'), 0) AS produccion_reportada,
       COALESCE((SELECT SUM(pr.cantidad) FROM produccion pr
                 WHERE pr.producto_id = p.id_producto AND pr.estado = 'validada'
                   AND pr.tipo = 'futura'), 0)                                AS produccion_futura
FROM producto p;

-- Cobros y saldo por pedido (CU7)
CREATE OR REPLACE VIEW v_saldo_pedido AS
SELECT pe.id_pedido AS pedido_id,
       pe.numero,
       pe.total,
       COALESCE(SUM(pa.monto) FILTER (WHERE pa.estado = 'pagado'), 0)            AS cobrado,
       pe.total - COALESCE(SUM(pa.monto) FILTER (WHERE pa.estado = 'pagado'), 0) AS saldo_pendiente
FROM pedido pe
LEFT JOIN pago pa ON pa.pedido_id = pe.id_pedido
GROUP BY pe.id_pedido;

-- Trazabilidad (RF06): de cada unidad vendida hasta su emprendimiento y comunidad
CREATE OR REPLACE VIEW v_trazabilidad AS
SELECT pe.numero          AS pedido,
       pr2.nombre         AS producto,
       rl.cantidad,
       rl.estado          AS estado_reserva,
       l.codigo           AS lote,
       em.nombre          AS emprendimiento,
       co.nombre          AS comunidad,
       pr.fecha_produccion
FROM reserva_lote rl
JOIN detalle_pedido dp ON dp.id_detalle_pedido = rl.detalle_pedido_id
JOIN pedido pe         ON pe.id_pedido = dp.pedido_id
JOIN producto pr2      ON pr2.id_producto = dp.producto_id
JOIN lote l            ON l.id_lote = rl.lote_id
JOIN produccion pr     ON pr.id_produccion = l.produccion_id
JOIN emprendimiento em ON em.id_emprendimiento = pr.emprendimiento_id
JOIN comunidad co      ON co.id_comunidad = em.comunidad_id;

-- =============================================================================
-- 4. FUNCIONES DE INVENTARIO (concurrencia RF10 / RF16)
-- =============================================================================

-- Entrada: crea el lote de una produccion validada y registra el movimiento
CREATE OR REPLACE FUNCTION fn_ingresar_lote(p_produccion_id INT, p_codigo VARCHAR, p_cantidad NUMERIC,
                                 p_usuario_id INT, p_vencimiento DATE DEFAULT NULL,
                                 p_costo NUMERIC DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_lote INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM produccion WHERE id_produccion = p_produccion_id AND estado = 'validada') THEN
        RAISE EXCEPTION 'La produccion % no esta validada', p_produccion_id;
    END IF;
    INSERT INTO lote (produccion_id, codigo, cantidad_inicial, stock_disponible,
                      costo_unitario, fecha_vencimiento)
    VALUES (p_produccion_id, p_codigo, p_cantidad, p_cantidad, p_costo, p_vencimiento)
    RETURNING id_lote INTO v_lote;
    INSERT INTO movimiento_inventario (lote_id, usuario_id, tipo, cantidad, motivo)
    VALUES (v_lote, p_usuario_id, 'entrada', p_cantidad, 'Ingreso de produccion ' || p_produccion_id);
    RETURN v_lote;
END $$;

-- Reserva: toma unidades de los lotes del producto, primero el que vence antes (FEFO).
-- FOR UPDATE bloquea los lotes elegidos: si dos clientes compran a la vez, el segundo
-- espera y ve el stock ya descontado. Si no alcanza, lanza error y se deshace todo.
CREATE OR REPLACE FUNCTION fn_reservar_detalle(p_detalle_pedido_id INT, p_minutos INT DEFAULT 30)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_producto  INT;
    v_falta     NUMERIC;
    v_toma      NUMERIC;
    r           RECORD;
BEGIN
    SELECT producto_id, cantidad INTO v_producto, v_falta
    FROM detalle_pedido WHERE id_detalle_pedido = p_detalle_pedido_id;

    FOR r IN
        SELECT l.id_lote AS id, l.stock_disponible
        FROM lote l JOIN produccion pr ON pr.id_produccion = l.produccion_id
        WHERE pr.producto_id = v_producto AND l.estado = 'disponible' AND l.stock_disponible > 0
          AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
        ORDER BY l.fecha_vencimiento NULLS LAST, l.fecha_ingreso, l.id_lote
        FOR UPDATE OF l
    LOOP
        EXIT WHEN v_falta <= 0;
        v_toma := LEAST(r.stock_disponible, v_falta);
        UPDATE lote
           SET stock_disponible = stock_disponible - v_toma,
               stock_reservado  = stock_reservado  + v_toma,
               estado  = CASE WHEN stock_disponible - v_toma = 0 THEN 'agotado' ELSE estado END,
               version = version + 1
         WHERE id_lote = r.id;
        INSERT INTO reserva_lote (detalle_pedido_id, lote_id, cantidad, fecha_expiracion)
        VALUES (p_detalle_pedido_id, r.id, v_toma, now() + make_interval(mins => p_minutos));
        v_falta := v_falta - v_toma;
    END LOOP;

    IF v_falta > 0 THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto % (faltan %)', v_producto, v_falta
              USING ERRCODE = 'P0001';
    END IF;
END $$;

-- Reserva todas las lineas de un pedido (en una sola transaccion)
CREATE OR REPLACE FUNCTION fn_reservar_pedido(p_pedido_id INT, p_minutos INT DEFAULT 30)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE d RECORD;
BEGIN
    FOR d IN SELECT id_detalle_pedido AS id FROM detalle_pedido WHERE pedido_id = p_pedido_id ORDER BY producto_id LOOP
        PERFORM fn_reservar_detalle(d.id, p_minutos);
    END LOOP;
END $$;

-- Salida: al pasar a "en_preparacion" las reservas se confirman y se descuenta lo reservado
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
    UPDATE pedido SET estado = 'en_preparacion' WHERE id_pedido = p_pedido_id;
END $$;

-- Cancelacion o reserva vencida: devuelve lo reservado a disponible
CREATE OR REPLACE FUNCTION fn_liberar_reservas(p_pedido_id INT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT rl.id_reserva_lote AS id, rl.lote_id, rl.cantidad
        FROM reserva_lote rl JOIN detalle_pedido dp ON dp.id_detalle_pedido = rl.detalle_pedido_id
        WHERE dp.pedido_id = p_pedido_id AND rl.estado = 'reservada'
        FOR UPDATE OF rl
    LOOP
        UPDATE lote
           SET stock_disponible = stock_disponible + r.cantidad,
               stock_reservado  = stock_reservado  - r.cantidad,
               estado  = CASE WHEN estado = 'agotado' THEN 'disponible' ELSE estado END,
               version = version + 1
         WHERE id_lote = r.lote_id;
        UPDATE reserva_lote SET estado = 'liberada' WHERE id_reserva_lote = r.id;
    END LOOP;
END $$;

-- Libera las reservas vencidas de pedidos pendientes (llamar cada pocos minutos)
CREATE OR REPLACE FUNCTION fn_liberar_reservas_vencidas()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE p RECORD; n INT := 0;
BEGIN
    FOR p IN
        SELECT DISTINCT dp.pedido_id
        FROM reserva_lote rl JOIN detalle_pedido dp ON dp.id_detalle_pedido = rl.detalle_pedido_id
        JOIN pedido pe ON pe.id_pedido = dp.pedido_id
        WHERE rl.estado = 'reservada' AND rl.fecha_expiracion < now() AND pe.estado = 'pendiente'
    LOOP
        PERFORM fn_liberar_reservas(p.pedido_id);
        UPDATE pedido SET estado = 'cancelado' WHERE id_pedido = p.pedido_id;
        n := n + 1;
    END LOOP;
    RETURN n;
END $$;

-- Alerta de stock bajo (RF16): una sola alerta activa por producto
CREATE OR REPLACE FUNCTION fn_revisar_stock_minimo(p_producto_id INT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_stock NUMERIC; v_min NUMERIC; v_nombre VARCHAR;
BEGIN
    SELECT stock_disponible, stock_minimo, nombre INTO v_stock, v_min, v_nombre
    FROM v_disponibilidad_producto WHERE producto_id = p_producto_id;
    IF v_stock < v_min AND NOT EXISTS (
        SELECT 1 FROM alerta_inventario
        WHERE producto_id = p_producto_id AND tipo = 'stock_bajo' AND estado = 'activa') THEN
        INSERT INTO alerta_inventario (producto_id, tipo, mensaje)
        VALUES (p_producto_id, 'stock_bajo',
                format('Stock bajo de %s: quedan %s (minimo %s)', v_nombre, v_stock, v_min));
    END IF;
END $$;
