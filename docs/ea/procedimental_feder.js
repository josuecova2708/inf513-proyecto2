!INC Local Scripts.EAConstants-JScript

/*
 * ===================================================================
 *  FEDER - INF513 (Proyecto 2, versión web)
 *  Diagramas procedimentales (clases reales que intervienen en cada CU)
 * -------------------------------------------------------------------
 *  Uso: selecciona en el Project Browser el paquete destino y ejecuta.
 *       Crea (o recrea) "Diagramas Procedimentales - FEDER" con una carpeta por CU.
 *
 *  Estilo (igual que el ejemplo del 1er parcial):
 *   - una caja por clase/archivo real, color beige, métodos sin parámetros;
 *   - dependencias «use» del que llama hacia el que es usado;
 *   - cuadrícula de 4 columnas x 3 filas (fila, columna) y líneas ortogonales.
 *
 *  Basado en: resources/js/paginas/*, resources/js/api/cliente.js, routes/api.php,
 *  app/Http/Middleware/*, app/Http/Controllers/Api/*, app/Services/*, app/Models/*.
 * ===================================================================
 */

var NOMBRE_RAIZ = "Diagramas Procedimentales - FEDER";
var COLOR = 15726075;          // beige claro (BGR)
var X0 = 50, Y0 = 50;          // esquina de la cuadrícula
var ANCHO = 230;               // ancho de cada caja
var PASO_X = 330;              // distancia entre columnas
var HUECO_Y = 110;             // espacio libre entre filas (para las líneas)
var ESTILO_LINEA = "Mode=3;TREE=OR;";   // ortogonal con esquinas redondeadas

// Qué CU generar (vacío = todos). Ej.: ["CU1"]
// OJO: vacío borra y recrea TODO el paquete (se pierden los acomodos a mano).
var SOLO = ["CU8"];

// ---- Casos de uso --------------------------------------------------
// clases: { id, nombre, notas, fila, col, atributos: [[nombre, tipo, visibilidad]], operaciones: [...] }
// usos:   [origen, destino]  (dependencia «use»)
var CUS = [
  // ---------------------------------------------------------------- CU1
  {
    codigo: "CU1", nombre: "Gestionar usuarios, roles y permisos",
    clases: [
      // Fila 0: front -> cliente HTTP -> rutas -> middleware de permisos
      { id: "pUsu", nombre: "Usuarios", fila: 0, col: 0,
        notas: "resources/js/paginas/administracion/Usuarios.jsx: lista, alta, edición y baja de usuarios.",
        atributos: [["roles", "array", "Private"], ["edicion", "object", "Private"], ["baja", "object", "Private"]],
        operaciones: [["guardar", "void", "Private"], ["darDeBaja", "void", "Private"]] },
      { id: "api", nombre: "ClienteApi", fila: 0, col: 1,
        notas: "resources/js/api/cliente.js: instancia axios con el token Bearer y el manejo de errores.",
        atributos: [["CLAVE_TOKEN", "string", "Private"]],
        operaciones: [["tokenGuardado", "string", "Public"], ["guardarToken", "void", "Public"],
                      ["mensajeError", "string", "Public"], ["erroresCampos", "object", "Public"]] },
      { id: "rut", nombre: "RutasApi", fila: 0, col: 2,
        notas: "routes/api.php: rutas usuarios/* y roles/* protegidas con auth:sanctum y permiso:modulo,accion.",
        atributos: [],
        operaciones: [["usuarios", "Route", "Public"], ["roles", "Route", "Public"]] },
      { id: "mid", nombre: "VerificarPermiso", fila: 0, col: 3,
        notas: "app/Http/Middleware/VerificarPermiso.php: corta con 403 si el rol no tiene el permiso.",
        atributos: [["VERBOS", "array", "Private"]],
        operaciones: [["handle", "Response", "Public"]] },

      // Fila 1: página de roles, controladores y servicio de permisos
      { id: "pRol", nombre: "Roles", fila: 1, col: 0,
        notas: "resources/js/paginas/administracion/Roles.jsx: matriz de permisos por rol.",
        atributos: [["roles", "array", "Private"], ["rolId", "int", "Private"], ["matriz", "array", "Private"],
                    ["guardando", "boolean", "Private"]],
        operaciones: [["alternar", "void", "Private"], ["guardar", "void", "Private"]] },
      { id: "cUsu", nombre: "UsuarioController", fila: 1, col: 1,
        notas: "app/Http/Controllers/Api/UsuarioController.php: CRUD de usuarios (baja lógica).",
        atributos: [["MENSAJES", "array", "Private"]],
        operaciones: [["index", "JsonResponse", "Public"], ["show", "JsonResponse", "Public"],
                      ["store", "JsonResponse", "Public"], ["update", "JsonResponse", "Public"],
                      ["destroy", "JsonResponse", "Public"], ["reglas", "array", "Private"]] },
      { id: "cRol", nombre: "RolController", fila: 1, col: 2,
        notas: "app/Http/Controllers/Api/RolController.php: roles y matriz rol x módulo.",
        atributos: [],
        operaciones: [["index", "JsonResponse", "Public"], ["permisos", "JsonResponse", "Public"],
                      ["guardarPermisos", "JsonResponse", "Public"]] },
      { id: "sPer", nombre: "PermisoServicio", fila: 1, col: 3,
        notas: "app/Services/PermisoServicio.php: permisos del rol (con caché) y menú dinámico.",
        atributos: [["ACCIONES", "array", "Public"], ["TTL", "int", "Private"]],
        operaciones: [["permisosRol", "array", "Public"], ["puede", "boolean", "Public"],
                      ["menu", "array", "Public"], ["limpiarCache", "void", "Public"]] },

      // Fila 2: errores de negocio y modelos
      { id: "err", nombre: "ErrorNegocio", fila: 2, col: 0,
        notas: "app/Exceptions/ErrorNegocio.php: error de regla de negocio que se responde como JSON.",
        atributos: [["codigo", "int", "Private"]],
        operaciones: [["render", "JsonResponse", "Public"]] },
      { id: "mUsu", nombre: "Usuario", fila: 2, col: 1,
        notas: "app/Models/Usuario.php: tabla usuario (PK id_usuario), autenticable con Sanctum.",
        atributos: [["table", "string", "Protected"], ["hidden", "array", "Protected"]],
        operaciones: [["rol", "BelongsTo", "Public"], ["nombreRol", "string", "Public"],
                      ["esStaff", "boolean", "Public"], ["esAdmin", "boolean", "Public"]] },
      { id: "mRol", nombre: "Rol", fila: 2, col: 2,
        notas: "app/Models/Rol.php: tabla rol (PK id_rol).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["permisos", "HasMany", "Public"], ["usuarios", "HasMany", "Public"]] },
      { id: "mRP", nombre: "RolPermiso", fila: 2, col: 3,
        notas: "app/Models/RolPermiso.php: tabla rol_permiso (ver, crear, editar, eliminar).",
        atributos: [["table", "string", "Protected"], ["casts", "array", "Protected"]],
        operaciones: [["permiso", "BelongsTo", "Public"]] }
    ],
    usos: [
      ["pUsu", "api"], ["pRol", "api"],
      ["api", "rut"],
      ["rut", "mid"], ["rut", "cUsu"], ["rut", "cRol"],
      ["mid", "sPer"],
      ["cRol", "sPer"],
      ["cUsu", "mUsu"], ["cUsu", "err"], ["cRol", "mRol"], ["cRol", "err"],
      ["sPer", "mRP"],
      ["mUsu", "mRol"], ["mRol", "mRP"]
    ]
  },

  // ---------------------------------------------------------------- CU2
  {
    codigo: "CU2", nombre: "Gestionar productores y comunidades",
    clases: [
      // Fila 0: front -> cliente HTTP -> rutas -> middleware de permisos
      { id: "pEmp", nombre: "Emprendimientos", fila: 0, col: 0,
        notas: "resources/js/paginas/operacion/Emprendimientos.jsx: productores, su detalle, foto y ofertas.",
        atributos: [["comunidades", "array", "Private"], ["productores", "array", "Private"],
                    ["edicion", "object", "Private"], ["detalle", "int", "Private"]],
        operaciones: [["guardar", "void", "Private"], ["eliminar", "void", "Private"],
                      ["subirFoto", "void", "Private"], ["agregarOferta", "void", "Private"]] },
      { id: "api", nombre: "ClienteApi", fila: 0, col: 1,
        notas: "resources/js/api/cliente.js: instancia axios con el token Bearer y el manejo de errores.",
        atributos: [["CLAVE_TOKEN", "string", "Private"]],
        operaciones: [["tokenGuardado", "string", "Public"], ["mensajeError", "string", "Public"],
                      ["erroresCampos", "object", "Public"], ["urlImagen", "string", "Public"]] },
      { id: "rut", nombre: "RutasApi", fila: 0, col: 2,
        notas: "routes/api.php: rutas comunidades/* y emprendimientos/* (imagen y ofertas) con permiso:modulo,accion.",
        atributos: [],
        operaciones: [["comunidades", "Route", "Public"], ["emprendimientos", "Route", "Public"]] },
      { id: "mid", nombre: "VerificarPermiso", fila: 0, col: 3,
        notas: "app/Http/Middleware/VerificarPermiso.php: corta con 403 si el rol no tiene el permiso.",
        atributos: [["VERBOS", "array", "Private"]],
        operaciones: [["handle", "Response", "Public"]] },

      // Fila 1: página de comunidades, controladores y servicio de imágenes
      { id: "pCom", nombre: "Comunidades", fila: 1, col: 0,
        notas: "resources/js/paginas/operacion/Comunidades.jsx: CRUD de comunidades agrícolas.",
        atributos: [["edicion", "object", "Private"], ["borrar", "object", "Private"]],
        operaciones: [["guardar", "void", "Private"], ["eliminar", "void", "Private"]] },
      { id: "cCom", nombre: "ComunidadController", fila: 1, col: 1,
        notas: "app/Http/Controllers/Api/ComunidadController.php: CRUD de comunidades.",
        atributos: [["MENSAJES", "array", "Private"]],
        operaciones: [["index", "JsonResponse", "Public"], ["store", "JsonResponse", "Public"],
                      ["update", "JsonResponse", "Public"], ["destroy", "JsonResponse", "Public"],
                      ["reglas", "array", "Private"]] },
      { id: "cEmp", nombre: "EmprendimientoController", fila: 1, col: 2,
        notas: "app/Http/Controllers/Api/EmprendimientoController.php: productores, foto y productos ofrecidos.",
        atributos: [["RUBROS", "array", "Private"], ["MENSAJES", "array", "Private"]],
        operaciones: [["index", "JsonResponse", "Public"], ["show", "JsonResponse", "Public"],
                      ["store", "JsonResponse", "Public"], ["update", "JsonResponse", "Public"],
                      ["destroy", "JsonResponse", "Public"], ["subirImagen", "JsonResponse", "Public"],
                      ["quitarImagen", "JsonResponse", "Public"], ["guardarOferta", "JsonResponse", "Public"],
                      ["eliminarOferta", "JsonResponse", "Public"], ["verificarAcceso", "void", "Private"]] },
      { id: "sImg", nombre: "ImagenServicio", fila: 1, col: 3,
        notas: "app/Services/ImagenServicio.php: redimensiona y guarda las fotos en WebP.",
        atributos: [["LADO_MAXIMO", "int", "Public"], ["CALIDAD_WEBP", "int", "Public"]],
        operaciones: [["guardar", "string", "Public"], ["eliminar", "void", "Public"],
                      ["redimensionar", "GdImage", "Private"]] },

      // Fila 2: errores de negocio y modelos
      { id: "err", nombre: "ErrorNegocio", fila: 2, col: 0,
        notas: "app/Exceptions/ErrorNegocio.php: error de regla de negocio que se responde como JSON.",
        atributos: [["codigo", "int", "Private"]],
        operaciones: [["render", "JsonResponse", "Public"]] },
      { id: "mCom", nombre: "Comunidad", fila: 2, col: 1,
        notas: "app/Models/Comunidad.php: tabla comunidad (PK id_comunidad).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["emprendimientos", "HasMany", "Public"]] },
      { id: "mEmp", nombre: "Emprendimiento", fila: 2, col: 2,
        notas: "app/Models/Emprendimiento.php: tabla emprendimiento (PK id_emprendimiento).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["comunidad", "BelongsTo", "Public"], ["usuario", "BelongsTo", "Public"],
                      ["producciones", "HasMany", "Public"], ["productos", "BelongsToMany", "Public"]] },
      { id: "mUsu", nombre: "Usuario", fila: 2, col: 3,
        notas: "app/Models/Usuario.php: el productor dueño del emprendimiento (rol Productor).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["emprendimiento", "HasOne", "Public"], ["esProductor", "boolean", "Public"],
                      ["esStaff", "boolean", "Public"]] }
    ],
    usos: [
      ["pEmp", "api"], ["pCom", "api"],
      ["api", "rut"],
      ["rut", "mid"], ["rut", "cCom"], ["rut", "cEmp"],
      ["cEmp", "sImg"],
      ["cCom", "mCom"], ["cCom", "err"],
      ["cEmp", "mEmp"], ["cEmp", "mUsu"], ["cEmp", "err"],
      ["mEmp", "mCom"], ["mEmp", "mUsu"]
    ]
  },

  // ---------------------------------------------------------------- CU3
  {
    codigo: "CU3", nombre: "Gestionar producción, lotes y trazabilidad",
    clases: [
      // Fila 0: front -> cliente HTTP -> rutas -> error de negocio
      { id: "pPrd", nombre: "PaginaProduccion", fila: 0, col: 0,
        notas: "resources/js/paginas/operacion/Produccion.jsx: reportar, validar y eliminar producción; crear lotes.",
        atributos: [["emprendimientos", "array", "Private"], ["productos", "array", "Private"],
                    ["validar", "object", "Private"], ["lote", "object", "Private"]],
        operaciones: [["guardar", "void", "Private"], ["decidir", "void", "Private"],
                      ["guardarLote", "void", "Private"], ["eliminar", "void", "Private"]] },
      { id: "api", nombre: "ClienteApi", fila: 0, col: 1,
        notas: "resources/js/api/cliente.js: instancia axios con el token Bearer y el manejo de errores.",
        atributos: [["CLAVE_TOKEN", "string", "Private"]],
        operaciones: [["tokenGuardado", "string", "Public"], ["mensajeError", "string", "Public"],
                      ["erroresCampos", "object", "Public"]] },
      { id: "rut", nombre: "RutasApi", fila: 0, col: 2,
        notas: "routes/api.php: rutas producciones/*, lotes/* y trazabilidad/* con permiso:modulo,accion.",
        atributos: [],
        operaciones: [["producciones", "Route", "Public"], ["lotes", "Route", "Public"],
                      ["trazabilidad", "Route", "Public"]] },
      { id: "err", nombre: "ErrorNegocio", fila: 0, col: 3,
        notas: "app/Exceptions/ErrorNegocio.php: error de regla de negocio que se responde como JSON.",
        atributos: [["codigo", "int", "Private"]],
        operaciones: [["render", "JsonResponse", "Public"]] },

      // Fila 1: página de lotes, controladores y funciones de la BD
      { id: "pLot", nombre: "Lotes", fila: 1, col: 0,
        notas: "resources/js/paginas/operacion/Lotes.jsx: editar lotes y registrar ajustes de inventario.",
        atributos: [["editar", "object", "Private"], ["mov", "object", "Private"]],
        operaciones: [["guardar", "void", "Private"], ["guardarMov", "void", "Private"]] },
      { id: "cPrd", nombre: "ProduccionController", fila: 1, col: 1,
        notas: "app/Http/Controllers/Api/ProduccionController.php: reporte y validación de la producción.",
        atributos: [["MENSAJES", "array", "Private"]],
        operaciones: [["index", "JsonResponse", "Public"], ["store", "JsonResponse", "Public"],
                      ["update", "JsonResponse", "Public"], ["validar", "JsonResponse", "Public"],
                      ["destroy", "JsonResponse", "Public"], ["reglas", "array", "Private"]] },
      { id: "cLot", nombre: "LoteController", fila: 1, col: 2,
        notas: "app/Http/Controllers/Api/LoteController.php: ingreso de lotes (bloqueo optimista) y trazabilidad.",
        atributos: [],
        operaciones: [["index", "JsonResponse", "Public"], ["store", "JsonResponse", "Public"],
                      ["update", "JsonResponse", "Public"], ["trazabilidadLote", "JsonResponse", "Public"],
                      ["trazabilidadPedido", "JsonResponse", "Public"]] },
      { id: "fBD", nombre: "FuncionesBD", fila: 1, col: 3,
        notas: "database/sql/feder_base.sql: funciones plpgsql y vista de PostgreSQL. fn_ingresar_lote crea el lote " +
               "y su movimiento de ENTRADA; v_trazabilidad une pedido, lote, productor y comunidad.",
        atributos: [],
        operaciones: [["fn_ingresar_lote", "int", "Public"], ["fn_revisar_stock_minimo", "void", "Public"],
                      ["v_trazabilidad", "view", "Public"]] },

      // Fila 2: página de trazabilidad, notificaciones y modelos
      { id: "pTra", nombre: "Trazabilidad", fila: 2, col: 0,
        notas: "resources/js/paginas/operacion/Trazabilidad.jsx: busca por código de lote o número de pedido.",
        atributos: [["codigo", "string", "Private"], ["pedido", "string", "Private"], ["res", "object", "Private"]],
        operaciones: [["buscar", "void", "Private"]] },
      { id: "sNot", nombre: "NotificacionServicio", fila: 2, col: 1,
        notas: "app/Services/NotificacionServicio.php: avisa al personal de producción nueva y al productor de su validación.",
        atributos: [],
        operaciones: [["notificar", "void", "Public"], ["notificarStaff", "void", "Public"]] },
      { id: "mPrd", nombre: "Produccion", fila: 2, col: 2,
        notas: "app/Models/Produccion.php: tabla produccion (PK id_produccion), estado reportada/validada/rechazada.",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["emprendimiento", "BelongsTo", "Public"], ["producto", "BelongsTo", "Public"],
                      ["validador", "BelongsTo", "Public"], ["lotes", "HasMany", "Public"]] },
      { id: "mLot", nombre: "Lote", fila: 2, col: 3,
        notas: "app/Models/Lote.php: tabla lote (PK id_lote) con stock y versión.",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["produccion", "BelongsTo", "Public"], ["movimientos", "HasMany", "Public"]] }
    ],
    usos: [
      ["pPrd", "api"], ["pLot", "api"], ["pTra", "api"],
      ["api", "rut"],
      ["rut", "cPrd"], ["rut", "cLot"],
      ["cPrd", "err"], ["cLot", "err"],
      ["cLot", "fBD"],
      ["cPrd", "sNot"], ["cPrd", "mPrd"],
      ["cLot", "mPrd"], ["cLot", "mLot"],
      ["fBD", "mLot"],
      ["mPrd", "mLot"]
    ]
  },

  // ---------------------------------------------------------------- CU4
  // 4 filas: la última es de modelos (no entran en 3 filas sin perder clases del CU).
  {
    codigo: "CU4", nombre: "Gestionar catálogo, inventario y alertas",
    clases: [
      // Fila 0: front -> cliente HTTP -> rutas -> error de negocio
      { id: "pPro", nombre: "Productos", fila: 0, col: 0,
        notas: "resources/js/paginas/operacion/Productos.jsx: catálogo interno (CRUD de productos con foto).",
        atributos: [["categorias", "array", "Private"], ["edicion", "object", "Private"], ["borrar", "object", "Private"]],
        operaciones: [["guardar", "void", "Private"], ["eliminar", "void", "Private"]] },
      { id: "api", nombre: "ClienteApi", fila: 0, col: 1,
        notas: "resources/js/api/cliente.js: instancia axios con el token Bearer y el manejo de errores.",
        atributos: [["CLAVE_TOKEN", "string", "Private"]],
        operaciones: [["tokenGuardado", "string", "Public"], ["mensajeError", "string", "Public"],
                      ["erroresCampos", "object", "Public"], ["urlImagen", "string", "Public"]] },
      { id: "rut", nombre: "RutasApi", fila: 0, col: 2,
        notas: "routes/api.php: rutas productos/*, inventario/* y alertas/* con permiso:modulo,accion.",
        atributos: [],
        operaciones: [["productos", "Route", "Public"], ["inventario", "Route", "Public"],
                      ["alertas", "Route", "Public"]] },
      { id: "err", nombre: "ErrorNegocio", fila: 0, col: 3,
        notas: "app/Exceptions/ErrorNegocio.php: error de regla de negocio que se responde como JSON.",
        atributos: [["codigo", "int", "Private"]],
        operaciones: [["render", "JsonResponse", "Public"]] },

      // Fila 1: página de inventario y controladores
      { id: "pInv", nombre: "Inventario", fila: 1, col: 0,
        notas: "resources/js/paginas/operacion/Inventario.jsx: disponibilidad por producto y movimientos.",
        atributos: [["disp", "array", "Private"], ["q", "string", "Private"]],
        operaciones: [["buscar", "void", "Private"]] },
      { id: "cPro", nombre: "ProductoController", fila: 1, col: 1,
        notas: "app/Http/Controllers/Api/ProductoController.php: CRUD de productos con imagen y stock disponible.",
        atributos: [["MENSAJES", "array", "Private"]],
        operaciones: [["index", "JsonResponse", "Public"], ["store", "JsonResponse", "Public"],
                      ["update", "JsonResponse", "Public"], ["destroy", "JsonResponse", "Public"],
                      ["reglas", "array", "Private"]] },
      { id: "cInv", nombre: "InventarioController", fila: 1, col: 2,
        notas: "app/Http/Controllers/Api/InventarioController.php: disponibilidad y ajustes/devoluciones por lote.",
        atributos: [],
        operaciones: [["disponibilidad", "JsonResponse", "Public"], ["movimientos", "JsonResponse", "Public"],
                      ["registrarMovimiento", "JsonResponse", "Public"]] },
      { id: "cAle", nombre: "AlertaController", fila: 1, col: 3,
        notas: "app/Http/Controllers/Api/AlertaController.php: alertas de stock bajo y vencimiento.",
        atributos: [],
        operaciones: [["index", "JsonResponse", "Public"], ["atender", "JsonResponse", "Public"]] },

      // Fila 2: página de alertas y servicios / funciones de la BD
      { id: "pAle", nombre: "Alertas", fila: 2, col: 0,
        notas: "resources/js/paginas/operacion/Alertas.jsx: lista de alertas activas y marcarlas como atendidas.",
        atributos: [],
        operaciones: [["atender", "void", "Private"]] },
      { id: "sImg", nombre: "ImagenServicio", fila: 2, col: 1,
        notas: "app/Services/ImagenServicio.php: redimensiona y guarda las fotos en WebP.",
        atributos: [["LADO_MAXIMO", "int", "Public"], ["CALIDAD_WEBP", "int", "Public"]],
        operaciones: [["guardar", "string", "Public"], ["eliminar", "void", "Public"]] },
      { id: "fBD", nombre: "FuncionesBD", fila: 2, col: 2,
        notas: "database/sql/feder_base.sql: vista de disponibilidad y funciones plpgsql de stock. " +
               "fn_revisar_stock_minimo crea la alerta de stock bajo.",
        atributos: [],
        operaciones: [["v_disponibilidad_producto", "view", "Public"], ["fn_revisar_stock_minimo", "void", "Public"],
                      ["fn_liberar_reservas_vencidas", "int", "Public"]] },
      { id: "sMan", nombre: "MantenimientoServicio", fila: 2, col: 3,
        notas: "app/Services/MantenimientoServicio.php: tareas periódicas (cada 5 min): reservas y lotes vencidos, " +
               "alertas de vencimiento y de stock mínimo.",
        atributos: [],
        operaciones: [["ejecutarSiCorresponde", "void", "Public"], ["ejecutar", "array", "Public"]] },

      // Fila 3: modelos
      { id: "mPro", nombre: "Producto", fila: 3, col: 1,
        notas: "app/Models/Producto.php: tabla producto (PK id_producto) con stock mínimo.",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["categoria", "BelongsTo", "Public"], ["emprendimientos", "BelongsToMany", "Public"]] },
      { id: "mMov", nombre: "MovimientoInventario", fila: 3, col: 2,
        notas: "app/Models/MovimientoInventario.php: tabla movimiento_inventario (entrada, salida, ajuste, devolución).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["lote", "BelongsTo", "Public"], ["usuario", "BelongsTo", "Public"]] },
      { id: "mAle", nombre: "AlertaInventario", fila: 3, col: 3,
        notas: "app/Models/AlertaInventario.php: tabla alerta_inventario (stock_bajo / vencimiento).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["producto", "BelongsTo", "Public"]] }
    ],
    usos: [
      ["pPro", "api"], ["pInv", "api"], ["pAle", "api"],
      ["api", "rut"],
      ["rut", "cPro"], ["rut", "cInv"], ["rut", "cAle"],
      ["cInv", "err"],
      ["cPro", "sImg"], ["cPro", "fBD"], ["cPro", "mPro"],
      ["cInv", "fBD"], ["cInv", "sMan"], ["cInv", "mMov"],
      ["cAle", "sMan"], ["cAle", "mAle"],
      ["sMan", "fBD"], ["sMan", "mAle"],
      ["fBD", "mAle"]
    ]
  },

  // ---------------------------------------------------------------- CU5
  // 4 filas: la última es de modelos.
  {
    codigo: "CU5", nombre: "Comprar con carrito y encargos",
    clases: [
      // Fila 0: front -> cliente HTTP -> rutas -> error de negocio
      { id: "pCar", nombre: "Carrito", fila: 0, col: 0,
        notas: "resources/js/paginas/comercial/Carrito.jsx: items del carrito y confirmación de la compra (entrega con mapa).",
        atributos: [["entrega", "object", "Private"], ["ubicacion", "object", "Private"], ["errores", "object", "Private"]],
        operaciones: [["accion", "void", "Private"], ["validar", "boolean", "Private"], ["confirmar", "void", "Private"]] },
      { id: "api", nombre: "ClienteApi", fila: 0, col: 1,
        notas: "resources/js/api/cliente.js: instancia axios con el token Bearer y el manejo de errores.",
        atributos: [["CLAVE_TOKEN", "string", "Private"]],
        operaciones: [["tokenGuardado", "string", "Public"], ["mensajeError", "string", "Public"],
                      ["erroresCampos", "object", "Public"]] },
      { id: "rut", nombre: "RutasApi", fila: 0, col: 2,
        notas: "routes/api.php: rutas carrito/* y encargos/* con permiso:modulo,accion.",
        atributos: [],
        operaciones: [["carrito", "Route", "Public"], ["encargos", "Route", "Public"]] },
      { id: "err", nombre: "ErrorNegocio", fila: 0, col: 3,
        notas: "app/Exceptions/ErrorNegocio.php: error de regla de negocio que se responde como JSON.",
        atributos: [["codigo", "int", "Private"]],
        operaciones: [["render", "JsonResponse", "Public"]] },

      // Fila 1: estado del carrito en el front, controladores y notificaciones
      { id: "ctx", nombre: "CarritoContext", fila: 1, col: 0,
        notas: "resources/js/contextos/CarritoContext.jsx: estado global del carrito (contador del encabezado).",
        atributos: [["carrito", "object", "Private"], ["habilitado", "boolean", "Private"]],
        operaciones: [["recargar", "void", "Public"], ["agregar", "void", "Public"], ["actualizar", "void", "Public"]] },
      { id: "cCar", nombre: "CarritoController", fila: 1, col: 1,
        notas: "app/Http/Controllers/Api/CarritoController.php: el carrito es un pedido en estado 'carrito'.",
        atributos: [],
        operaciones: [["ver", "JsonResponse", "Public"], ["agregar", "JsonResponse", "Public"],
                      ["actualizar", "JsonResponse", "Public"], ["quitar", "JsonResponse", "Public"],
                      ["vaciar", "JsonResponse", "Public"], ["confirmar", "JsonResponse", "Public"]] },
      { id: "cEnc", nombre: "EncargoController", fila: 1, col: 2,
        notas: "app/Http/Controllers/Api/EncargoController.php: encargos (producción a pedido) y su conversión a pedido.",
        atributos: [["TRANSICIONES", "array", "Private"]],
        operaciones: [["index", "JsonResponse", "Public"], ["show", "JsonResponse", "Public"],
                      ["store", "JsonResponse", "Public"], ["cambiarEstado", "JsonResponse", "Public"],
                      ["cancelar", "JsonResponse", "Public"], ["convertir", "JsonResponse", "Public"],
                      ["encargoPara", "Encargo", "Private"]] },
      { id: "sNot", nombre: "NotificacionServicio", fila: 1, col: 3,
        notas: "app/Services/NotificacionServicio.php: avisa al cliente y al personal de compras y encargos.",
        atributos: [],
        operaciones: [["notificar", "void", "Public"], ["notificarStaff", "void", "Public"]] },

      // Fila 2: página de encargos, servicios y funciones de la BD
      { id: "pEnc", nombre: "Encargos", fila: 2, col: 0,
        notas: "resources/js/paginas/comercial/Encargos.jsx: el cliente ve, cancela y convierte sus encargos; el personal los gestiona.",
        atributos: [["cambio", "object", "Private"], ["convertir", "object", "Private"], ["cancelar", "object", "Private"]],
        operaciones: [["confirmarCancelar", "void", "Private"], ["enviar", "void", "Private"]] },
      { id: "sPed", nombre: "PedidoServicio", fila: 2, col: 1,
        notas: "app/Services/PedidoServicio.php: reglas del pedido: carrito, reserva de stock, entrega y estados.",
        atributos: [["MINUTOS_RESERVA", "int", "Public"], ["TRANSICIONES", "array", "Public"]],
        operaciones: [["carrito", "array", "Public"], ["carritoId", "int", "Public"], ["nuevoPedido", "int", "Public"],
                      ["validarProductoVendible", "void", "Public"], ["reservarYEntregar", "void", "Public"],
                      ["recalcular", "void", "Public"], ["reglasEntrega", "array", "Public"]] },
      { id: "sEnv", nombre: "EnvioServicio", fila: 2, col: 2,
        notas: "app/Services/EnvioServicio.php: distancia desde FEDER (Haversine) y costo de envío a domicilio.",
        atributos: [],
        operaciones: [["distanciaKm", "float", "Public"], ["costo", "float", "Public"], ["tarifa", "array", "Public"]] },
      { id: "fBD", nombre: "FuncionesBD", fila: 2, col: 3,
        notas: "database/sql/feder_base.sql: fn_reservar_pedido aparta stock por lote (reserva_lote) por 24 h.",
        atributos: [],
        operaciones: [["fn_reservar_pedido", "void", "Public"], ["fn_reservar_detalle", "void", "Public"],
                      ["v_disponibilidad_producto", "view", "Public"]] },

      // Fila 3: modelos
      { id: "mDet", nombre: "DetallePedido", fila: 3, col: 0,
        notas: "app/Models/DetallePedido.php: tabla detalle_pedido (producto, cantidad, precio).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["producto", "BelongsTo", "Public"], ["pedido", "BelongsTo", "Public"],
                      ["reservas", "HasMany", "Public"]] },
      { id: "mPed", nombre: "Pedido", fila: 3, col: 1,
        notas: "app/Models/Pedido.php: tabla pedido (PK id_pedido); el carrito es un pedido en estado 'carrito'.",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["cliente", "BelongsTo", "Public"], ["detalles", "HasMany", "Public"],
                      ["entrega", "HasOne", "Public"], ["encargo", "BelongsTo", "Public"]] },
      { id: "mEnc", nombre: "Encargo", fila: 3, col: 2,
        notas: "app/Models/Encargo.php: tabla encargo (solicitado, aceptado, disponible, convertido...).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["cliente", "BelongsTo", "Public"], ["detalles", "HasMany", "Public"],
                      ["pedido", "HasOne", "Public"]] }
    ],
    usos: [
      ["pCar", "api"], ["pCar", "ctx"], ["ctx", "api"], ["pEnc", "api"],
      ["api", "rut"],
      ["rut", "cCar"], ["rut", "cEnc"],
      ["cCar", "err"], ["cEnc", "err"],
      ["cCar", "sPed"], ["cCar", "sNot"],
      ["cEnc", "sPed"], ["cEnc", "sNot"], ["cEnc", "mEnc"],
      ["sPed", "sEnv"], ["sPed", "fBD"], ["sPed", "mPed"],
      ["mPed", "mDet"], ["mEnc", "mPed"]
    ]
  },

  // ---------------------------------------------------------------- CU6
  // 5 filas: la pasarela de pago (interfaz + implementación Stripe) cuelga de la columna 3.
  {
    codigo: "CU6", nombre: "Gestionar pedidos, pagos y entregas",
    clases: [
      // Fila 0: front -> cliente HTTP -> rutas -> error de negocio
      { id: "pDet", nombre: "PedidoDetalle", fila: 0, col: 0,
        notas: "resources/js/paginas/comercial/PedidoDetalle.jsx: detalle del pedido, pagos, plan de cuotas, " +
               "avance de estado y programación de la entrega.",
        atributos: [["d", "object", "Private"], ["pagar", "object", "Private"], ["plan", "boolean", "Private"]],
        operaciones: [["programarEntrega", "void", "Private"], ["avanzar", "void", "Private"],
                      ["confirmarCancelacion", "void", "Private"], ["pagarCuota", "object", "Private"]] },
      { id: "api", nombre: "ClienteApi", fila: 0, col: 1,
        notas: "resources/js/api/cliente.js: instancia axios con el token Bearer y el manejo de errores.",
        atributos: [["CLAVE_TOKEN", "string", "Private"]],
        operaciones: [["tokenGuardado", "string", "Public"], ["mensajeError", "string", "Public"]] },
      { id: "rut", nombre: "RutasApi", fila: 0, col: 2,
        notas: "routes/api.php: rutas pedidos/*, pagos/*, cuotas/* y entregas/* con permiso:modulo,accion.",
        atributos: [],
        operaciones: [["pedidos", "Route", "Public"], ["pagos", "Route", "Public"], ["cuotas", "Route", "Public"]] },
      { id: "err", nombre: "ErrorNegocio", fila: 0, col: 3,
        notas: "app/Exceptions/ErrorNegocio.php: error de regla de negocio que se responde como JSON.",
        atributos: [["codigo", "int", "Private"]],
        operaciones: [["render", "JsonResponse", "Public"]] },

      // Fila 1: modal de pago y controladores
      { id: "mod", nombre: "ModalPago", fila: 1, col: 0,
        notas: "resources/js/componentes/ModalPago.jsx: elige método (QR, efectivo, transferencia o tarjeta) y paga.",
        atributos: [["metodos", "array", "Private"], ["tarjetas", "array", "Private"], ["monto", "string", "Private"]],
        operaciones: [["pagar", "void", "Private"], ["autenticar", "void", "Private"]] },
      { id: "cPed", nombre: "PedidoController", fila: 1, col: 1,
        notas: "app/Http/Controllers/Api/PedidoController.php: lista, detalle, cambio de estado y cancelación.",
        atributos: [],
        operaciones: [["index", "JsonResponse", "Public"], ["show", "JsonResponse", "Public"],
                      ["cambiarEstado", "JsonResponse", "Public"], ["cancelar", "JsonResponse", "Public"]] },
      { id: "cPag", nombre: "PagoController", fila: 1, col: 2,
        notas: "app/Http/Controllers/Api/PagoController.php: pagar un pedido, confirmar tras 3D Secure y verificar pagos.",
        atributos: [],
        operaciones: [["metodos", "JsonResponse", "Public"], ["index", "JsonResponse", "Public"],
                      ["pagar", "JsonResponse", "Public"], ["confirmar", "JsonResponse", "Public"],
                      ["verificar", "JsonResponse", "Public"], ["respuestaPago", "JsonResponse", "Public"]] },
      { id: "cPla", nombre: "PlanPagoController", fila: 1, col: 3,
        notas: "app/Http/Controllers/Api/PlanPagoController.php: plan de cuotas (2, 3 o 6) y pago de cada cuota.",
        atributos: [["CUOTAS_PERMITIDAS", "array", "Public"]],
        operaciones: [["index", "JsonResponse", "Public"], ["store", "JsonResponse", "Public"],
                      ["pagarCuota", "JsonResponse", "Public"]] },

      // Fila 2: Stripe.js en el front, servicios y la interfaz de pasarela
      { id: "pStj", nombre: "PagoStripe", fila: 2, col: 0,
        notas: "resources/js/componentes/PagoStripe.jsx: Stripe.js (Elements y 3D Secure); la tarjeta nunca pasa por FEDER.",
        atributos: [["promesaStripe", "Promise", "Private"]],
        operaciones: [["obtenerStripe", "Stripe", "Private"], ["completarAutenticacion", "object", "Public"]] },
      { id: "sPed", nombre: "PedidoServicio", fila: 2, col: 1,
        notas: "app/Services/PedidoServicio.php: estados del pedido, confirmación de reservas, entrega y cancelación.",
        atributos: [["TRANSICIONES", "array", "Public"]],
        operaciones: [["pedidoPara", "Pedido", "Public"], ["cambiarEstado", "void", "Public"],
                      ["revisarPagoCompleto", "void", "Public"], ["cancelar", "void", "Public"],
                      ["notificarProgramacion", "void", "Public"]] },
      { id: "sPag", nombre: "PagoServicio", fila: 2, col: 2,
        notas: "app/Services/PagoServicio.php: procesa pagos y cuotas a través de la pasarela inyectada.",
        atributos: [["pasarela", "PasarelaPago", "Private"]],
        operaciones: [["procesar", "array", "Public"], ["confirmarStripe", "array", "Public"],
                      ["despuesDePago", "void", "Public"]] },
      { id: "pas", nombre: "PasarelaPago", tipo: "Interface", fila: 2, col: 3,
        notas: "app/Services/Pagos/PasarelaPago.php: interfaz de la pasarela (Stripe en modo prueba o simulada, " +
               "según AppServiceProvider).",
        atributos: [],
        operaciones: [["cobrar", "ResultadoPago", "Public"], ["nombre", "string", "Public"]] },

      // Fila 3: modelos y la implementación con Stripe
      { id: "mEnt", nombre: "Entrega", fila: 3, col: 0,
        notas: "app/Models/Entrega.php: tabla entrega (recojo o domicilio, fecha programada, estado).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["pedido", "BelongsTo", "Public"], ["despachador", "BelongsTo", "Public"]] },
      { id: "mPed", nombre: "Pedido", fila: 3, col: 1,
        notas: "app/Models/Pedido.php: tabla pedido (PK id_pedido).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["detalles", "HasMany", "Public"], ["pagos", "HasMany", "Public"],
                      ["entrega", "HasOne", "Public"], ["plan", "HasOne", "Public"]] },
      { id: "mPag", nombre: "Pago", fila: 3, col: 2,
        notas: "app/Models/Pago.php: tabla pago (método, monto, estado, código de transacción).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["pedido", "BelongsTo", "Public"], ["metodo", "BelongsTo", "Public"],
                      ["cuota", "BelongsTo", "Public"]] },
      { id: "pStr", nombre: "PasarelaStripe", fila: 3, col: 3,
        notas: "app/Services/Pagos/PasarelaStripe.php: implementación con Stripe (PaymentIntent). " +
               "La alternativa PasarelaSimulada se usa cuando no hay claves de Stripe.",
        atributos: [],
        operaciones: [["cobrar", "ResultadoPago", "Public"], ["nombre", "string", "Public"]] },

      // Fila 4: cliente de la API de Stripe
      { id: "sStr", nombre: "StripeServicio", fila: 4, col: 3,
        notas: "app/Services/StripeServicio.php: llamadas a la API de Stripe (clientes, SetupIntent, cobros, reembolsos).",
        atributos: [],
        operaciones: [["activo", "boolean", "Public"], ["clientePara", "string", "Public"],
                      ["cobrar", "object", "Public"], ["consultar", "object", "Public"],
                      ["reembolsar", "void", "Public"]] }
    ],
    usos: [
      ["pDet", "api"], ["pDet", "mod"], ["mod", "api"], ["mod", "pStj"],
      ["api", "rut"],
      ["rut", "cPed"], ["rut", "cPag"], ["rut", "cPla"],
      ["cPag", "err"], ["cPla", "err"],
      ["cPed", "sPed"], ["cPag", "sPed"], ["cPag", "sPag"], ["cPla", "sPag"],
      ["sPag", "pas"],
      ["sPed", "mPed"], ["sPed", "mEnt"], ["sPag", "mPag"],
      ["mPag", "mPed"], ["mEnt", "mPed"],
      ["pStr", "pas", "Realization"],
      ["pStr", "sStr"]
    ]
  },

  // ---------------------------------------------------------------- CU7
  // El controlador va en la columna 2 para alcanzar los modelos de abajo sin cruces.
  {
    codigo: "CU7", nombre: "Consultar indicadores financieros",
    clases: [
      // Fila 0: front -> cliente HTTP -> rutas -> middleware de permisos
      { id: "pFin", nombre: "Finanzas", fila: 0, col: 0,
        notas: "resources/js/paginas/administracion/Finanzas.jsx: KPIs, ingresos por día, por método y margen por producto.",
        atributos: [["rango", "object", "Private"], ["d", "object", "Private"], ["error", "string", "Private"]],
        operaciones: [["useEffect", "void", "Private"]] },
      { id: "api", nombre: "ClienteApi", fila: 0, col: 1,
        notas: "resources/js/api/cliente.js: instancia axios con el token Bearer y el manejo de errores.",
        atributos: [["CLAVE_TOKEN", "string", "Private"]],
        operaciones: [["tokenGuardado", "string", "Public"], ["mensajeError", "string", "Public"]] },
      { id: "rut", nombre: "RutasApi", fila: 0, col: 2,
        notas: "routes/api.php: GET finanzas/indicadores con permiso:finanzas,ver.",
        atributos: [],
        operaciones: [["finanzas", "Route", "Public"]] },
      { id: "mid", nombre: "VerificarPermiso", fila: 0, col: 3,
        notas: "app/Http/Middleware/VerificarPermiso.php: corta con 403 si el rol no tiene el permiso.",
        atributos: [["VERBOS", "array", "Private"]],
        operaciones: [["handle", "Response", "Public"]] },

      // Fila 1: componentes del front, controlador y vista de la BD
      { id: "gra", nombre: "Graficos", fila: 1, col: 0,
        notas: "resources/js/componentes/Graficos.jsx: gráficos de barras y líneas (Recharts) con la paleta del tema.",
        atributos: [["COLORES", "object", "Public"]],
        operaciones: [["GraficoBarras", "JSX", "Public"], ["GraficoLineas", "JSX", "Public"]] },
      { id: "fmt", nombre: "Formato", fila: 1, col: 1,
        notas: "resources/js/utils/formato.js: formato de moneda (Bs.), números y fechas.",
        atributos: [],
        operaciones: [["moneda", "string", "Public"], ["numero", "string", "Public"],
                      ["fecha", "string", "Public"], ["hoyISO", "string", "Public"]] },
      { id: "cFin", nombre: "FinanzasController", fila: 1, col: 2,
        notas: "app/Http/Controllers/Api/FinanzasController.php: calcula los indicadores del periodo " +
               "(por defecto los últimos 30 días) con consultas agregadas.",
        atributos: [["VENDIDO", "array", "Public"]],
        operaciones: [["indicadores", "JsonResponse", "Public"]] },
      { id: "fBD", nombre: "FuncionesBD", fila: 1, col: 3,
        notas: "database/sql/feder_base.sql: v_saldo_pedido = total del pedido menos lo pagado (saldo por cobrar).",
        atributos: [],
        operaciones: [["v_saldo_pedido", "view", "Public"]] },

      // Fila 2: modelos / tablas que se agregan
      { id: "mPed", nombre: "Pedido", fila: 2, col: 1,
        notas: "app/Models/Pedido.php: tabla pedido (ventas, ticket promedio y cancelados).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["pagos", "HasMany", "Public"], ["plan", "HasOne", "Public"]] },
      { id: "mPag", nombre: "Pago", fila: 2, col: 2,
        notas: "app/Models/Pago.php: tabla pago (cobrado, ingresos por día y por método).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["pedido", "BelongsTo", "Public"], ["metodo", "BelongsTo", "Public"]] },
      { id: "mLot", nombre: "Lote", fila: 2, col: 3,
        notas: "app/Models/Lote.php: tabla lote (costo unitario y valor del inventario).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["produccion", "BelongsTo", "Public"]] },

      // Fila 3: tablas de apoyo (cuotas y costo de lo vendido)
      { id: "mPla", nombre: "PlanPago", fila: 3, col: 1,
        notas: "app/Models/PlanPago.php: tablas plan_pago y cuota_pago (cuotas pendientes y vencidas).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["pedido", "BelongsTo", "Public"], ["cuotas", "HasMany", "Public"]] },
      { id: "mRes", nombre: "ReservaLote", fila: 3, col: 3,
        notas: "app/Models/ReservaLote.php: tabla reserva_lote (qué lote se vendió en cada detalle: margen bruto).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["lote", "BelongsTo", "Public"]] }
    ],
    usos: [
      ["pFin", "api"], ["pFin", "gra"], ["pFin", "fmt"],
      ["api", "rut"],
      ["rut", "mid"], ["rut", "cFin"],
      ["cFin", "fBD"],
      ["cFin", "mPed"], ["cFin", "mPag"], ["cFin", "mLot"],
      ["cFin", "mPla"], ["cFin", "mRes"],
      ["mPag", "mPed"], ["mPla", "mPed"], ["mRes", "mLot"]
    ]
  },

  // ---------------------------------------------------------------- CU8
  // Igual que CU7: controlador en la columna 2 y tablas consultadas debajo.
  {
    codigo: "CU8", nombre: "Generar reportes y estadísticas",
    clases: [
      // Fila 0: front -> cliente HTTP -> rutas -> middleware de permisos
      { id: "pRep", nombre: "Reportes", fila: 0, col: 0,
        notas: "resources/js/paginas/administracion/Reportes.jsx: elige reporte y rango; tabla, gráfico, CSV e impresión.",
        atributos: [["tipo", "string", "Private"], ["rango", "object", "Private"], ["r", "object", "Private"]],
        operaciones: [["useEffect", "void", "Private"], ["exportar", "void", "Private"], ["formatear", "string", "Private"]] },
      { id: "api", nombre: "ClienteApi", fila: 0, col: 1,
        notas: "resources/js/api/cliente.js: instancia axios con el token Bearer y el manejo de errores.",
        atributos: [["CLAVE_TOKEN", "string", "Private"]],
        operaciones: [["tokenGuardado", "string", "Public"], ["mensajeError", "string", "Public"]] },
      { id: "rut", nombre: "RutasApi", fila: 0, col: 2,
        notas: "routes/api.php: GET reportes/{tipo} con permiso:reportes,ver.",
        atributos: [],
        operaciones: [["reportes", "Route", "Public"]] },
      { id: "mid", nombre: "VerificarPermiso", fila: 0, col: 3,
        notas: "app/Http/Middleware/VerificarPermiso.php: corta con 403 si el rol no tiene el permiso.",
        atributos: [["VERBOS", "array", "Private"]],
        operaciones: [["handle", "Response", "Public"]] },

      // Fila 1: componentes del front, controlador de reportes y la constante compartida
      { id: "gra", nombre: "Graficos", fila: 1, col: 0,
        notas: "resources/js/componentes/Graficos.jsx: gráficos de barras y líneas (Recharts) con la paleta del tema.",
        atributos: [["COLORES", "object", "Public"]],
        operaciones: [["GraficoBarras", "JSX", "Public"], ["GraficoLineas", "JSX", "Public"]] },
      { id: "fmt", nombre: "Formato", fila: 1, col: 1,
        notas: "resources/js/utils/formato.js: formato de moneda (Bs.), números, fechas y estados.",
        atributos: [],
        operaciones: [["moneda", "string", "Public"], ["numero", "string", "Public"],
                      ["fecha", "string", "Public"], ["etiquetaEstado", "string", "Public"]] },
      { id: "cRep", nombre: "ReporteController", fila: 1, col: 2,
        notas: "app/Http/Controllers/Api/ReporteController.php: 7 reportes (ventas, inventario, pedidos, encargos, " +
               "métodos, ingresos, producción); cada uno devuelve columnas, filas y la serie del gráfico.",
        atributos: [["TIPOS", "array", "Public"]],
        operaciones: [["generar", "JsonResponse", "Public"]] },
      { id: "cFin", nombre: "FinanzasController", fila: 1, col: 3,
        notas: "app/Http/Controllers/Api/FinanzasController.php: aquí solo se reutiliza la constante VENDIDO " +
               "(estados que cuentan como venta).",
        atributos: [["VENDIDO", "array", "Public"]],
        operaciones: [] },

      // Fila 2: vista de la BD y tablas de ventas
      { id: "fBD", nombre: "FuncionesBD", fila: 2, col: 0,
        notas: "database/sql/feder_base.sql: v_disponibilidad_producto (reporte de inventario).",
        atributos: [],
        operaciones: [["v_disponibilidad_producto", "view", "Public"]] },
      { id: "mDet", nombre: "DetallePedido", fila: 2, col: 1,
        notas: "app/Models/DetallePedido.php: tabla detalle_pedido (ventas por producto).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["producto", "BelongsTo", "Public"], ["pedido", "BelongsTo", "Public"]] },
      { id: "mPed", nombre: "Pedido", fila: 2, col: 2,
        notas: "app/Models/Pedido.php: tabla pedido (pedidos por estado).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["detalles", "HasMany", "Public"], ["pagos", "HasMany", "Public"]] },
      { id: "mPag", nombre: "Pago", fila: 2, col: 3,
        notas: "app/Models/Pago.php: tabla pago (ingresos por día y por método de pago).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["pedido", "BelongsTo", "Public"], ["metodo", "BelongsTo", "Public"]] },

      // Fila 3: producción, productos y encargos
      { id: "mPrd", nombre: "Produccion", fila: 3, col: 1,
        notas: "app/Models/Produccion.php: tabla produccion (producción por estado y productor).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["producto", "BelongsTo", "Public"], ["emprendimiento", "BelongsTo", "Public"]] },
      { id: "mPro", nombre: "Producto", fila: 3, col: 2,
        notas: "app/Models/Producto.php: tabla producto (con su categoría) usada en casi todos los reportes.",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["categoria", "BelongsTo", "Public"]] },
      { id: "mDEn", nombre: "DetalleEncargo", fila: 3, col: 3,
        notas: "app/Models/DetalleEncargo.php: tabla detalle_encargo (productos más encargados).",
        atributos: [["table", "string", "Protected"]],
        operaciones: [["producto", "BelongsTo", "Public"]] }
    ],
    usos: [
      ["pRep", "api"], ["pRep", "gra"], ["pRep", "fmt"],
      ["api", "rut"],
      ["rut", "mid"], ["rut", "cRep"],
      ["cRep", "cFin"],
      ["cRep", "fBD"], ["cRep", "mDet"], ["cRep", "mPed"], ["cRep", "mPag"],
      ["cRep", "mPrd"], ["cRep", "mPro"], ["cRep", "mDEn"],
      ["mDet", "mPed"], ["mPag", "mPed"],
      ["mDet", "mPro"], ["mPrd", "mPro"], ["mDEn", "mPro"]
    ]
  }
];

// ===================================================================
function log(m) { Session.Output(m); }

function guardar(objeto, descripcion) {
  if (!objeto.Update())
    throw new Error("No se pudo guardar " + descripcion + ": " + objeto.GetLastError());
}

function buscarPaquete(padre, nombre) {
  for (var i = 0; i < padre.Packages.Count; i++) {
    var p = padre.Packages.GetAt(i);
    if (p.Name == nombre) return p;
  }
  return null;
}
function obtenerPaquete(padre, nombre) {
  var p = buscarPaquete(padre, nombre);
  if (p == null) {
    p = padre.Packages.AddNew(nombre, "");
    p.Update();
    padre.Packages.Refresh();
  }
  return p;
}
function borrarPaquete(padre, nombre) {
  for (var i = padre.Packages.Count - 1; i >= 0; i--) {
    if (padre.Packages.GetAt(i).Name == nombre) padre.Packages.DeleteAt(i, true);
  }
  padre.Packages.Refresh();
}

// Alto de la caja según la cantidad de atributos y operaciones
function altoClase(c) {
  var na = c.atributos.length, no = c.operaciones.length;
  return 34 + (na > 0 ? 6 + 16 * na : 6) + (no > 0 ? 6 + 16 * no : 6);
}

function crearClase(paquete, c) {
  var clase = paquete.Elements.AddNew(c.nombre, c.tipo || "Class");   // tipo: "Interface" opcional
  clase.Notes = c.notas;
  guardar(clase, c.nombre);
  var i, m;
  for (i = 0; i < c.atributos.length; i++) {
    m = clase.Attributes.AddNew(c.atributos[i][0], c.atributos[i][1]);
    m.Visibility = c.atributos[i][2];
    m.Pos = i;
    guardar(m, c.nombre + "." + c.atributos[i][0]);
  }
  clase.Attributes.Refresh();
  for (i = 0; i < c.operaciones.length; i++) {
    m = clase.Methods.AddNew(c.operaciones[i][0], c.operaciones[i][1]);
    m.Visibility = c.operaciones[i][2];
    m.Pos = i;
    guardar(m, c.nombre + "." + c.operaciones[i][0]);
  }
  clase.Methods.Refresh();
  return clase;
}

function validarCU(CU) {
  var ids = {}, celdas = {};
  for (var i = 0; i < CU.clases.length; i++) {
    var c = CU.clases[i];
    if (ids[c.id]) throw new Error(CU.codigo + ": id repetido " + c.id);
    ids[c.id] = true;
    var celda = c.fila + "," + c.col;
    if (celdas[celda]) throw new Error(CU.codigo + ": dos clases en la celda " + celda);
    celdas[celda] = true;
  }
  for (var u = 0; u < CU.usos.length; u++) {
    if (!ids[CU.usos[u][0]] || !ids[CU.usos[u][1]])
      throw new Error(CU.codigo + ": la dependencia " + (u + 1) + " usa una clase inexistente");
  }
}

function generarCU(CU, raiz) {
  validarCU(CU);
  var pkg = obtenerPaquete(raiz, CU.codigo + " - " + CU.nombre);
  log("--- " + CU.codigo + " - " + CU.nombre);

  var diag = pkg.Diagrams.AddNew(CU.codigo + " - Diagrama procedimental", "Logical");
  diag.Notes = "Clases reales que intervienen en " + CU.codigo + ". Métodos sin parámetros para una vista compacta.";
  guardar(diag, "el diagrama " + CU.codigo);
  pkg.Diagrams.Refresh();

  // Alto de cada fila = la caja más alta de esa fila
  var altoFila = [], i, c;
  for (i = 0; i < CU.clases.length; i++) {
    c = CU.clases[i];
    altoFila[c.fila] = Math.max(altoFila[c.fila] || 0, altoClase(c));
  }
  var yFila = [Y0];
  for (i = 1; i < altoFila.length; i++) yFila[i] = yFila[i - 1] + (altoFila[i - 1] || 0) + HUECO_Y;

  // Clases y posiciones (cada caja centrada verticalmente en su fila)
  var el = {};
  for (i = 0; i < CU.clases.length; i++) {
    c = CU.clases[i];
    el[c.id] = crearClase(pkg, c);
    var h = altoClase(c);
    var x = X0 + c.col * PASO_X;
    var y = yFila[c.fila] + Math.round((altoFila[c.fila] - h) / 2);
    var o = diag.DiagramObjects.AddNew("l=" + x + ";r=" + (x + ANCHO) + ";t=" + y + ";b=" + (y + h) + ";", "");
    o.ElementID = el[c.id].ElementID;
    o.BackgroundColor = COLOR;
    guardar(o, "la posición de " + c.nombre);
  }
  pkg.Elements.Refresh();

  // Dependencias «use» (o "Realization" si se indica como tercer valor: clase -> interfaz)
  for (i = 0; i < CU.usos.length; i++) {
    var a = el[CU.usos[i][0]], b = el[CU.usos[i][1]];
    var tipoRel = CU.usos[i][2] || "Dependency";
    var cn = a.Connectors.AddNew("", tipoRel);
    cn.SupplierID = b.ElementID;
    if (tipoRel == "Dependency") cn.Stereotype = "use";
    guardar(cn, "la dependencia " + a.Name + " -> " + b.Name);
    a.Connectors.Refresh();
  }

  // Líneas ortogonales
  diag.DiagramLinks.Refresh();
  for (i = 0; i < diag.DiagramLinks.Count; i++) {
    var dl = diag.DiagramLinks.GetAt(i);
    dl.Style = ESTILO_LINEA;
    dl.Update();
  }
  diag.Update();
  Repository.ReloadDiagram(diag.DiagramID);
  log("  clases: " + CU.clases.length + ", dependencias: " + CU.usos.length);
  return diag;
}

function main() {
  Repository.EnsureOutputVisible("Script");
  Repository.ClearOutput("Script");
  log("=== Diagramas procedimentales - FEDER ===");

  var seleccionado = Repository.GetTreeSelectedPackage();
  if (seleccionado == null) {
    Session.Prompt("Selecciona un paquete antes de ejecutar el script.", promptOK);
    return;
  }

  try {
    for (var v = 0; v < CUS.length; v++) validarCU(CUS[v]);

    var raiz;
    if (SOLO.length == 0) {
      borrarPaquete(seleccionado, NOMBRE_RAIZ);
      raiz = obtenerPaquete(seleccionado, NOMBRE_RAIZ);
    } else {
      raiz = obtenerPaquete(seleccionado, NOMBRE_RAIZ);
    }

    var ultimo = null;
    for (var i = 0; i < CUS.length; i++) {
      if (SOLO.length > 0 && ("|" + SOLO.join("|") + "|").indexOf("|" + CUS[i].codigo + "|") < 0) continue;
      borrarPaquete(raiz, CUS[i].codigo + " - " + CUS[i].nombre);
      ultimo = generarCU(CUS[i], raiz);
    }

    Repository.RefreshModelView(raiz.PackageID);
    if (ultimo != null) Repository.OpenDiagram(ultimo.DiagramID);
    log("=== Listo ===");
  } catch (error) {
    log("Error: " + error.message);
    Session.Prompt("Error: " + error.message, promptOK);
  }
}

main();
