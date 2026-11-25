!INC Local Scripts.EAConstants-JScript

/*
 * Script Name: DiagramasNavegacion_FEDER
 * Proyecto: FEDER - INF513 (Proyecto 2, versión web)
 * Purpose: Generar los Diagramas de Navegación Web por actor en Enterprise Architect
 *          con auto-posicionamiento por capas semánticas y ruteo ortogonal multicarril
 *          100% automático (cero cruces por encima de cajas y separación de pares).
 *          Por ahora: Cliente. Después se agregan Administrador, Personal y Productor
 *          en este mismo archivo (ya no hace falta pasar coordenadas x, y manuales).
 *
 * Basado en el código real del proyecto (Laravel 12 API + SPA React):
 * - routes/api.php, resources/js/App.jsx, database/seeders/MenuSeeder.php
 * - Permisos del rol Cliente (RolesPermisosSeeder): perfil, catalogo, carrito, encargos,
 *   pedidos, pagos, metodos_pago, planes_pago, entregas, notificaciones.
 * - Pago con tarjeta según la siguiente versión con Stripe (modo prueba):
 *   tarjeta guardada con Stripe Elements + SetupIntent, cobro con PaymentIntent,
 *   3D Secure y confirmación en POST pagos/{id}/confirmar. QR, Transferencia y
 *   Efectivo siguen igual.
 *
 * Reglas de notación (estilo del docente):
 * - Actor -> Página de inicio: asociación simple, sin dirección y sin estereotipo.
 * - Páginas visibles: «client page».
 * - Formularios: «form page» (campos «Text», botones «Submit»).
 * - Backend/controladores: «Server Page» (una caja por controlador, con sus operaciones).
 * - Formularios conectados a su página mediante composición (rombo en la página).
 * - Formularios envían a Server Page mediante «submit».
 * - Server Page construye página cliente mediante «build».
 * - Server Page responde al formulario mediante «response» cuando falla validación.
 * - «redirect» para redirecciones entre páginas.
 * - Todas las cajas tienen el mismo color piel claro, una única instancia por elemento.
 *
 * Reglas del paper de Conallen (Modeling Web Application Architectures with UML) que se cumplen:
 * - Cada «client page» la construye («build») UNA sola «Server Page».
 * - Cada «form page» hace «submit» a UNA sola «Server Page» y pertenece a UNA sola página.
 * - «link» siempre sale de una «client page».
 * - Server Page -> recurso del servidor (Stripe): asociación simple, sin estereotipo.
 * - Componentes que corren en el navegador (Stripe.js): clase «JavaScript» asociada a la página.
 *
 * Adaptación de WAE a una SPA (React + API REST):
 * - «client page» = cada vista/ruta de React; «Server Page» = cada controlador de la API.
 * - «build» = el controlador que entrega los datos principales con los que se arma la vista.
 * - «link» = navegar a otra vista o una petición GET auxiliar (p. ej. llenar un combo).
 * - «redirect» = navegar(...) del front después de una acción (login -> panel, etc.).
 */

var COLOR_CAJA = 14740212;
var RECREATE_NAV_PACKAGE = true;
var NOMBRE_RAIZ = "Diagramas de Navegación Web - FEDER";

// Estilo ortogonal de líneas en EA:
// "OR" = Orthogonal - Rounded (esquinas redondeadas)
// "OS" = Orthogonal - Square  (esquinas rectas 90°)
// "CUSTOM" = Custom Line con quiebres ortogonales estrictos
var ESTILO_LINEA = "OR";

// Modo apaisado en Doble Bloque (Izquierda: Público/Compra | Derecha: Panel/Pagos)
// optimizado a proporción ~1.4:1 para entrar grande y legible en hoja Word Carta Horizontal
var MODO_HORIZONTAL_CARTA = true;

// Parámetros del motor de layout compacto por capas y ruteo ortogonal por pasillos
var LAYOUT_CFG = {
    marginX: 40,
    marginY: 40,
    gutterWidths: [75, 136, 94, 110, 94], // modo bloque simple (6 columnas)
    dualGutterWidths: [56, 108, 82, 96, 128, 116, 82, 96], // modo doble bloque horizontal (9 columnas: 0..4 | pasillo central | 5..8)
    bandGap: 36,       // separación vertical base entre módulos
    intraColGap: 26,   // separación vertical entre cajas apiladas de una misma banda
    trackSpacing: 11,  // separación entre carriles paralelos de líneas
    pairSpacing: 15,   // separación entre pares ida/vuelta (submit/response, link/build)
    boxPad: 10,        // margen de seguridad prohibido alrededor de cada caja
    portSpacing: 14    // separación mínima entre puertos de un mismo borde
};

/* ============================================================
   MAIN
   ============================================================ */

function main()
{
    Repository.EnsureOutputVisible("Script");
    Repository.ClearOutput("Script");

    var selectedPackage as EA.Package;
    selectedPackage = Repository.GetTreeSelectedPackage();

    if (selectedPackage == null)
    {
        Session.Prompt("Selecciona un paquete antes de ejecutar el script.", promptOK);
        return;
    }

    if (RECREATE_NAV_PACKAGE)
    {
        deletePackageByName(selectedPackage, NOMBRE_RAIZ);
        deletePackageByName(selectedPackage, "Diagramas de Navegacion Web - FEDER");
    }

    var rootPkg as EA.Package;
    rootPkg = selectedPackage.Packages.AddNew(NOMBRE_RAIZ, "Package");
    rootPkg.Update();
    selectedPackage.Packages.Refresh();

    crearDiagramaCliente(rootPkg);
    crearDiagramaProductor(rootPkg);
    crearDiagramaPersonal(rootPkg);
    crearDiagramaAdministrador(rootPkg);

    Repository.RefreshModelView(rootPkg.PackageID);

    Session.Output("Diagramas de navegación generados y acomodados correctamente.");
    Session.Prompt("Diagramas de navegación generados y acomodados correctamente.", promptOK);
}

/* ============================================================
   DIAGRAMA CLIENTE
   Público (PublicLayout): Inicio, Catálogo, Detalle de producto, Login, Registro, Carrito.
   Panel (PanelLayout, menú dinámico según permisos del rol Cliente):
   Mis pedidos, Encargos, Entregas, Pagos, Planes de pago, Mis métodos de pago,
   Notificaciones, Mi perfil.
   Flujos: login/registro, catálogo -> carrito -> confirmar pedido (entrega con mapa),
   encargo desde el detalle del producto y conversión a pedido, pago de pedido y de
   cuotas (QR, Transferencia, Efectivo, Tarjeta con Stripe + 3D Secure),
   tarjetas guardadas en Stripe.
   ============================================================ */

function crearDiagramaCliente(rootPkg)
{
    var pkg = crearPaquete(rootPkg, "Navegación - Cliente");
    var diagram = crearDiagrama(pkg, "Diagrama de Navegación - Cliente");
    var ctx = crearContextoDiagrama(pkg, diagram);
    var map = ctx.map;

    // Nota: x, y y w son opcionales; el motor calcula automáticamente tamaños,
    // columnas, bandas funcionales y rutas ortogonales sin cruzar cajas.
    function pagina(name, stereotype, attrs, methods, x, y, w)
    {
        var ancho = estimarAnchoCaja(name, stereotype, attrs, methods, w);
        var alto = altoCaja(stereotype, attrs, methods);
        return crearPagina(ctx, name, stereotype, attrs, methods, ancho, alto);
    }

    // ---- Base: actor + inicio + búsqueda + preferencias ----
    crearActor(ctx, "Cliente", 90, 100);

    pagina("Inicio", "client page",
        "busqueda\nproductosDestacados\ncategorias\nmenu\ncontadorVisitas",
        "buscar\nverCatalogo\nirPanel\ncerrarSesion",
        200, 330, 260);

    pagina("BusquedaController", "Server Page",
        "q",
        "buscar",
        200, 80, 240);

    pagina("frmPreferencias", "form page",
        "tema\nmodo\ntamano_fuente\ncontraste\nbotón Guardar",
        "",
        200, 700, 240);

    // ---- Login / Registro / Perfil ----
    pagina("Login", "client page",
        "email\npassword",
        "",
        560, 40, 220);

    pagina("frmLogin", "form page",
        "email\npassword\nbotón Iniciar Sesión",
        "",
        560, 160, 240);

    pagina("Registro", "client page",
        "nombre\napellido\nemail",
        "",
        560, 360, 220);

    pagina("frmRegistro", "form page",
        "nombre\napellido\nci\nemail\ntelefono\ndireccion\npassword\nconfirmarPassword\nbotón Registrarse",
        "",
        560, 490, 260);

    pagina("AuthController", "Server Page",
        "email\npassword\nnombre\napellido\nci\ntelefono\ndireccion\ntema\nmodo",
        "login\nregistro\nme\nlogout\nactualizarPerfil\nguardarPreferencias",
        900, 200, 280);

    pagina("Perfil", "client page",
        "nombre\napellido\nemail\ntelefono\ndireccion",
        "",
        900, 640, 250);

    pagina("frmPerfil", "form page",
        "nombre\napellido\nemail\ntelefono\ndireccion\npasswordActual\npassword\nconfirmarPassword\nbotón Guardar",
        "",
        900, 830, 260);

    // ---- Catálogo / Detalle / Carrito ----
    pagina("Catalogo", "client page",
        "q\ncategoria\nmodalidad\norden\nproductos",
        "buscarProducto\nfiltrarCategoria\nordenar\nverProducto",
        1300, 40, 260);

    pagina("CatalogoController", "Server Page",
        "q\ncategoria\nmodalidad\norden",
        "index\nportada\nshow\ncategorias",
        1650, 40, 260);

    pagina("ProductoDetalle", "client page",
        "nombre\nimagen\nprecio_venta\npresentacion\ndisponible\nemprendimiento",
        "agregarAlCarrito\nsolicitarEncargo",
        1300, 330, 260);

    pagina("frmAgregarCarrito", "form page",
        "cantidad\nbotón Agregar al Carrito",
        "",
        1650, 300, 260);

    pagina("frmEncargo", "form page",
        "cantidad\nfecha_requerida\nobservacion\nbotón Solicitar Encargo",
        "",
        1650, 440, 260);

    pagina("Carrito", "client page",
        "items\ncantidad\nsubtotal\ntotal",
        "cambiarCantidad\nquitarItem\nvaciar",
        1300, 680, 260);

    pagina("frmConfirmarPedido", "form page",
        "tipo_entrega\ndireccion\nreferencia\nfecha_preferida\nlatitud\nlongitud\nnit_ci\nrazon_social\nbotón Confirmar Pedido",
        "",
        1650, 640, 270);

    pagina("CarritoController", "Server Page",
        "producto_id\ncantidad\ntipo_entrega\ndireccion\nreferencia\nfecha_preferida\nlatitud\nlongitud\nnit_ci\nrazon_social",
        "ver\nagregar\nactualizar\nquitar\nvaciar\nconfirmar",
        2020, 330, 300);

    // ---- Encargos ----
    pagina("EncargoController", "Server Page",
        "fecha_requerida\nobservacion\nitems\ntipo_entrega\ndireccion\nfecha_preferida",
        "index\nshow\nstore\ncancelar\nconvertir",
        2020, 760, 300);

    pagina("Encargos", "client page",
        "encargos\nestado",
        "listarEncargo\ncancelarEncargo\nconvertirEnPedido",
        2400, 640, 280);

    pagina("frmCancelarEncargo", "form page",
        "botón Cancelar Encargo",
        "",
        2760, 600, 260);

    pagina("frmConvertirEncargo", "form page",
        "tipo_entrega\ndireccion\nreferencia\nfecha_preferida\nlatitud\nlongitud\nbotón Convertir en Pedido",
        "",
        2760, 740, 280);

    // ---- Panel del cliente ----
    pagina("PanelCliente", "client page",
        "usuario\nmenu\nMis pedidos\nEncargos\nEntregas\nPagos\nPlanes de pago\nMétodos de pago\nNotificaciones\nMi perfil\nultimosPedidos",
        "cerrarSesion",
        560, 1050, 280);

    pagina("DashboardController", "Server Page",
        "",
        "resumenUsuario",
        200, 1100, 250);

    pagina("Notificaciones", "client page",
        "notificaciones\nleida",
        "leer\nleerTodas\nverPedido",
        560, 1450, 260);

    pagina("NotificacionController", "Server Page",
        "",
        "index\nnoLeidas\nleer\nleerTodas",
        200, 1450, 260);

    // ---- Pedidos ----
    pagina("MisPedidos", "client page",
        "pedidos\nestado\nq\ndesde\nhasta",
        "buscarPedido\nlistarPedido\nverPedido",
        1300, 1000, 260);

    pagina("PedidoController", "Server Page",
        "estado\nq\ndesde\nhasta",
        "index\nshow\ncancelar",
        1650, 1000, 260);

    pagina("PedidoDetalle", "client page",
        "numero\nestado\ndetalle\nentrega\npagos\nplan\ncuotas\nsaldo",
        "imprimir\npagar\ncrearPlan\npagarCuota\ncancelarPedido",
        1300, 1260, 280);

    pagina("frmCancelarPedido", "form page",
        "botón Cancelar Pedido",
        "",
        1650, 1210, 250);

    pagina("frmPlanPago", "form page",
        "nro_cuotas\nfrecuencia\ncuota_inicial\nbotón Crear Plan",
        "",
        1650, 1330, 260);

    pagina("PlanPagoController", "Server Page",
        "nro_cuotas\nfrecuencia\ncuota_inicial\nmetodo_pago_id\nmetodo_pago_usuario_id",
        "index\nstore\npagarCuota",
        2020, 1280, 300);

    // ---- Pago (QR / Transferencia / Efectivo / Tarjeta con Stripe) ----
    // ModalPago es un solo componente de React, pero envía a dos endpoints distintos:
    // se modela como dos formularios lógicos (pedido -> PagoController, cuota -> PlanPagoController).
    pagina("frmPagoPedido", "form page",
        "metodo_pago_id\nmonto\ntarjeta_guardada\nreferencia\nbotón Pagar",
        "",
        1650, 1530, 280);

    pagina("frmPagoCuota", "form page",
        "metodo_pago_id\ntarjeta_guardada\nreferencia\nbotón Pagar Cuota",
        "",
        1650, 1530, 280);

    pagina("frmPagoCuotaPlan", "form page",
        "metodo_pago_id\ntarjeta_guardada\nreferencia\nbotón Pagar Cuota",
        "",
        1650, 1530, 280);

    pagina("PagoController", "Server Page",
        "metodo_pago_id\nmonto\nmetodo_pago_usuario_id\nreferencia\npayment_intent_id",
        "index\nmetodos\npagar\nconfirmar",
        2020, 1570, 300);

    // Servidor de Stripe (recurso externo del lado del servidor)
    pagina("StripeAPI", "Server Page",
        "customer\npayment_method_id\nclient_secret\namount\ncurrency",
        "createSetupIntent\ncreatePaymentIntent\nretrievePaymentMethod\nretrievePaymentIntent",
        2400, 1280, 300);

    // Stripe.js (corre en el navegador; la tarjeta va directo a Stripe, nunca a FEDER)
    pagina("StripeJS", "JavaScript",
        "cardElement\nclientSecret",
        "confirmCardSetup\nhandleNextAction",
        2400, 1280, 260);

    pagina("Stripe3DS", "client page",
        "banco_emisor\ncodigo_verificacion",
        "autenticar",
        2780, 1300, 260);

    pagina("PagoQR", "client page",
        "imagen_qr\nmonto\nestado",
        "",
        2400, 1640, 260);

    pagina("QrController", "Server Page",
        "",
        "imagen",
        2780, 1640, 240);

    pagina("PlanesPago", "client page",
        "planes\ncuotas\nestado",
        "listarPlan\npagarCuota",
        1300, 1620, 260);

    pagina("MisPagos", "client page",
        "pagos\nmetodo\nmonto\ncodigo_transaccion\nestado",
        "listarPago\nfiltrar\nverPedido",
        2400, 1880, 280);

    // ---- Entregas ----
    pagina("MisEntregas", "client page",
        "entregas\ntipo\ndireccion\nfecha_programada\nestado",
        "listarEntrega\nverMapa",
        1300, 1900, 280);

    pagina("EntregaController", "Server Page",
        "estado\ntipo",
        "index",
        1650, 1920, 250);

    // ---- Mis métodos de pago (tarjetas guardadas en Stripe) ----
    pagina("MisMetodosPago", "client page",
        "tarjetas\ncuentas\npredeterminado",
        "listar\nmarcarPredeterminado\neliminar",
        1300, 2180, 280);

    pagina("frmTarjetaStripe", "form page",
        "alias\ntitular\ncardElement\npredeterminado\nbotón Guardar Tarjeta",
        "",
        1650, 2140, 270);

    pagina("frmCuentaTransferencia", "form page",
        "alias\ntitular\nbanco\nnumero_cuenta\nbotón Guardar",
        "",
        1650, 2310, 270);

    pagina("MetodoPagoUsuarioController", "Server Page",
        "alias\ntitular\npayment_method_id\npredeterminado\nbanco\nnumero_cuenta",
        "index\nsetupIntent\nstore\nupdate\ndestroy",
        2020, 2180, 300);

    // ---- Relaciones Cliente ----
    asociacionActor(map, "Cliente", "Inicio");

    // Inicio
    link(map, "Inicio", "Login");
    link(map, "Inicio", "Registro");
    link(map, "Inicio", "Catalogo");
    link(map, "Inicio", "Carrito");
    link(map, "Inicio", "PanelCliente");
    link(map, "Inicio", "BusquedaController");
    build(map, "BusquedaController", "Inicio");
    composicion(map, "Inicio", "frmPreferencias");
    submit(map, "frmPreferencias", "AuthController");

    // Login y registro (el login solo devuelve el token; el front navega a /panel)
    composicion(map, "Login", "frmLogin");
    submit(map, "frmLogin", "AuthController");
    redirect(map, "AuthController", "PanelCliente");
    response(map, "AuthController", "frmLogin");

    composicion(map, "Registro", "frmRegistro");
    submit(map, "frmRegistro", "AuthController");
    redirect(map, "AuthController", "Catalogo");
    response(map, "AuthController", "frmRegistro");

    // Catálogo y detalle
    link(map, "Catalogo", "CatalogoController");
    build(map, "CatalogoController", "Catalogo");
    link(map, "Catalogo", "ProductoDetalle");
    build(map, "CatalogoController", "ProductoDetalle");

    composicion(map, "ProductoDetalle", "frmAgregarCarrito");
    submit(map, "frmAgregarCarrito", "CarritoController");
    response(map, "CarritoController", "frmAgregarCarrito");

    // El encargo se registra y la vista se queda en el detalle con un mensaje (sin redirect)
    composicion(map, "ProductoDetalle", "frmEncargo");
    submit(map, "frmEncargo", "EncargoController");
    response(map, "EncargoController", "frmEncargo");

    // Carrito -> pedido
    link(map, "Carrito", "CarritoController");
    build(map, "CarritoController", "Carrito");
    composicion(map, "Carrito", "frmConfirmarPedido");
    submit(map, "frmConfirmarPedido", "CarritoController");
    redirect(map, "CarritoController", "PedidoDetalle");
    response(map, "CarritoController", "frmConfirmarPedido");

    // Panel
    link(map, "PanelCliente", "DashboardController");
    build(map, "DashboardController", "PanelCliente");
    link(map, "PanelCliente", "MisPedidos");
    link(map, "PanelCliente", "Encargos");
    link(map, "PanelCliente", "MisEntregas");
    link(map, "PanelCliente", "MisPagos");
    link(map, "PanelCliente", "PlanesPago");
    link(map, "PanelCliente", "MisMetodosPago");
    link(map, "PanelCliente", "Notificaciones");
    link(map, "PanelCliente", "Perfil");

    // Perfil
    composicion(map, "Perfil", "frmPerfil");
    submit(map, "frmPerfil", "AuthController");
    build(map, "AuthController", "Perfil");
    response(map, "AuthController", "frmPerfil");

    // Notificaciones
    link(map, "Notificaciones", "NotificacionController");
    build(map, "NotificacionController", "Notificaciones");
    link(map, "Notificaciones", "PedidoDetalle");

    // Pedidos
    link(map, "MisPedidos", "PedidoController");
    build(map, "PedidoController", "MisPedidos");
    link(map, "MisPedidos", "PedidoDetalle");
    build(map, "PedidoController", "PedidoDetalle");
    composicion(map, "PedidoDetalle", "frmCancelarPedido");
    submit(map, "frmCancelarPedido", "PedidoController");

    // Plan de pagos (crédito en cuotas). Tras crear el plan, la vista vuelve a pedir
    // GET /pedidos/{id}: la sigue construyendo PedidoController (un solo build).
    composicion(map, "PedidoDetalle", "frmPlanPago");
    submit(map, "frmPlanPago", "PlanPagoController");
    response(map, "PlanPagoController", "frmPlanPago");

    link(map, "PlanesPago", "PlanPagoController");
    build(map, "PlanPagoController", "PlanesPago");

    // Pago de pedido y de cuotas (un form por destino). El modal llena sus combos con
    // GET /metodos-pago y GET /mis-metodos-pago: peticiones auxiliares = «link».
    composicion(map, "PedidoDetalle", "frmPagoPedido");
    submit(map, "frmPagoPedido", "PagoController");
    response(map, "PagoController", "frmPagoPedido");

    composicion(map, "PedidoDetalle", "frmPagoCuota");
    submit(map, "frmPagoCuota", "PlanPagoController");
    response(map, "PlanPagoController", "frmPagoCuota");

    composicion(map, "PlanesPago", "frmPagoCuotaPlan");
    submit(map, "frmPagoCuotaPlan", "PlanPagoController");
    response(map, "PlanPagoController", "frmPagoCuotaPlan");

    link(map, "PedidoDetalle", "PagoController");
    link(map, "PedidoDetalle", "MetodoPagoUsuarioController");
    link(map, "PlanesPago", "MetodoPagoUsuarioController");

    // Tarjeta con Stripe: el controlador crea el PaymentIntent en Stripe (servidor a servidor).
    // Si el banco pide 3D Secure, Stripe.js (handleNextAction) muestra la página del banco
    // y luego el front confirma con POST /pagos/{id}/confirmar.
    asociacion(map, "PagoController", "StripeAPI");
    asociacion(map, "PlanPagoController", "StripeAPI");
    asociacion(map, "PedidoDetalle", "StripeJS");
    build(map, "StripeAPI", "Stripe3DS");
    redirect(map, "Stripe3DS", "PagoController");

    // QR de FEDER: tras registrar un pago por QR se muestra el QR activo (imagen de QrController)
    redirect(map, "PagoController", "PagoQR");
    build(map, "QrController", "PagoQR");

    // Historial de pagos
    link(map, "MisPagos", "PagoController");
    build(map, "PagoController", "MisPagos");
    link(map, "MisPagos", "PedidoDetalle");

    // Entregas
    link(map, "MisEntregas", "EntregaController");
    build(map, "EntregaController", "MisEntregas");

    // Encargos
    link(map, "Encargos", "EncargoController");
    build(map, "EncargoController", "Encargos");
    composicion(map, "Encargos", "frmCancelarEncargo");
    submit(map, "frmCancelarEncargo", "EncargoController");
    composicion(map, "Encargos", "frmConvertirEncargo");
    submit(map, "frmConvertirEncargo", "EncargoController");
    redirect(map, "EncargoController", "PedidoDetalle");
    response(map, "EncargoController", "frmConvertirEncargo");

    // Mis métodos de pago: la tarjeta la captura Stripe.js (confirmCardSetup) y va directo
    // a Stripe; el form solo envía a FEDER el alias, el titular y el pm_... resultante.
    link(map, "MisMetodosPago", "MetodoPagoUsuarioController");
    build(map, "MetodoPagoUsuarioController", "MisMetodosPago");
    composicion(map, "MisMetodosPago", "frmTarjetaStripe");
    submit(map, "frmTarjetaStripe", "MetodoPagoUsuarioController");
    response(map, "MetodoPagoUsuarioController", "frmTarjetaStripe");
    asociacion(map, "frmTarjetaStripe", "StripeJS");
    asociacion(map, "StripeJS", "StripeAPI");
    asociacion(map, "MetodoPagoUsuarioController", "StripeAPI");
    composicion(map, "MisMetodosPago", "frmCuentaTransferencia");
    submit(map, "frmCuentaTransferencia", "MetodoPagoUsuarioController");
    response(map, "MetodoPagoUsuarioController", "frmCuentaTransferencia");

    finalizarDiagrama(ctx);
}

/* ============================================================
   DIAGRAMA PRODUCTOR
   La cuenta la crea FEDER (no hay registro público) y queda vinculada a un emprendimiento.
   Solo lo propio del rol: lo común (catálogo, búsqueda, preferencias, perfil) ya está
   en el diagrama del Cliente.
   Panel (menú dinámico según permisos del rol Productor):
   Comunidades (ver), Productores = su emprendimiento (ver/editar, foto, ofertas),
   Producción (ver/reportar), Lotes (ver), Trazabilidad (ver), Notificaciones.
   Flujos: reportar producción -> FEDER la valida (notificación "produccion_validada")
   -> FEDER crea lotes -> el productor consulta sus lotes y la trazabilidad.
   ============================================================ */

function crearDiagramaProductor(rootPkg)
{
    // Con pocos módulos el doble bloque queda muy apaisado (~2.5:1); en un solo bloque
    // vertical (~0.75:1) entra más grande en una hoja carta vertical.
    var modoAnterior = MODO_HORIZONTAL_CARTA;
    MODO_HORIZONTAL_CARTA = false;

    var pkg = crearPaquete(rootPkg, "Navegación - Productor");
    var diagram = crearDiagrama(pkg, "Diagrama de Navegación - Productor");
    var ctx = crearContextoDiagrama(pkg, diagram);
    var map = ctx.map;

    // El motor calcula tamaños, columnas, bandas y rutas; no hace falta pasar x, y.
    function pagina(name, stereotype, attrs, methods)
    {
        var ancho = estimarAnchoCaja(name, stereotype, attrs, methods, null);
        var alto = altoCaja(stereotype, attrs, methods);
        return crearPagina(ctx, name, stereotype, attrs, methods, ancho, alto);
    }

    // ---- Base: actor + inicio + login (sin registro: la cuenta la crea FEDER) ----
    // Lo común con el Cliente (catálogo, búsqueda, preferencias, perfil) ya está en su
    // diagrama y se sobreentiende; aquí solo va lo propio del Productor.
    crearActor(ctx, "Productor", 90, 100);

    pagina("Inicio", "client page",
        "menu",
        "iniciarSesion\nirPanel");

    pagina("Login", "client page",
        "email\npassword",
        "");

    pagina("frmLogin", "form page",
        "email\npassword\nbotón Iniciar Sesión",
        "");

    pagina("AuthController", "Server Page",
        "email\npassword",
        "login\nme\nlogout");

    // ---- Panel del productor ----
    pagina("PanelProductor", "client page",
        "usuario\nmenu\nComunidades\nProductores\nProducción\nLotes\nTrazabilidad\nNotificaciones\nlotesRecientes",
        "reportarProduccion\ncerrarSesion");

    pagina("DashboardController", "Server Page",
        "",
        "resumenUsuario");

    pagina("Notificaciones", "client page",
        "notificaciones\nleida",
        "leer\nleerTodas\nverProduccion");

    pagina("NotificacionController", "Server Page",
        "",
        "index\nnoLeidas\nleer\nleerTodas");

    // ---- Comunidades (solo lectura) ----
    pagina("Comunidades", "client page",
        "comunidades\nmunicipio\nprovincia\ndepartamento\nproductores",
        "buscarComunidad\nlistarComunidad");

    pagina("ComunidadController", "Server Page",
        "q",
        "index");

    // ---- Mi emprendimiento (editar datos, foto y ofertas) ----
    pagina("MisEmprendimientos", "client page",
        "emprendimientos\ncomunidad\nrubro\nproductos\nestado",
        "listarEmprendimiento\nverDetalle\neditarEmprendimiento");

    pagina("frmEmprendimiento", "form page",
        "nombre\nrubro\nresponsable\nci_nit\ntelefono\ndireccion\nlatitud\nlongitud\nbotón Guardar",
        "");

    pagina("EmprendimientoController", "Server Page",
        "nombre\nrubro\nresponsable\nci_nit\ntelefono\ndireccion\nlatitud\nlongitud\nimagen\nproducto_id\nprecio_referencia\ntemporada",
        "index\nshow\nupdate\nsubirImagen\nquitarImagen\nguardarOferta\neliminarOferta");

    pagina("EmprendimientoDetalle", "client page",
        "nombre\ncomunidad\nimagen\nofertas\nproducciones",
        "subirFoto\nquitarFoto\nagregarOferta\nquitarOferta");

    pagina("frmImagenEmprendimiento", "form page",
        "imagen\nbotón Subir Foto",
        "");

    pagina("frmOferta", "form page",
        "producto_id\nprecio_referencia\ntemporada\nbotón Agregar Oferta",
        "");

    pagina("ProductoController", "Server Page",
        "estado",
        "index");

    // ---- Producción (reportar y seguir su validación) ----
    pagina("Produccion", "client page",
        "producciones\nestado\ntipo\nq",
        "listarProduccion\nfiltrar\nreportarProduccion");

    pagina("frmProduccion", "form page",
        "producto_id\ntipo\ncantidad\nunidad_medida\nfecha_produccion\nfecha_disponible\nprecio_propuesto\nprocedencia\nobservacion\nbotón Reportar Producción",
        "");

    pagina("ProduccionController", "Server Page",
        "producto_id\ntipo\ncantidad\nunidad_medida\nfecha_produccion\nfecha_disponible\nprecio_propuesto\nprocedencia\nobservacion",
        "index\nstore");

    // ---- Lotes y trazabilidad (solo lectura) ----
    pagina("Lotes", "client page",
        "lotes\ncodigo\nproducto\nstock_disponible\nfecha_vencimiento\nestado",
        "listarLote\nfiltrar\nverTrazabilidad");

    pagina("LoteController", "Server Page",
        "estado\nproducto_id\nq\ncodigo\nnumero",
        "index\ntrazabilidadLote\ntrazabilidadPedido");

    pagina("Trazabilidad", "client page",
        "lote\nproduccion\nemprendimiento\ncomunidad\npedidos",
        "buscarLote\nbuscarPedido");

    pagina("frmTrazabilidad", "form page",
        "codigo_lote\nnumero_pedido\nbotón Buscar",
        "");

    // ---- Relaciones Productor ----
    asociacionActor(map, "Productor", "Inicio");

    // Inicio y login
    link(map, "Inicio", "Login");
    link(map, "Inicio", "PanelProductor");
    composicion(map, "Login", "frmLogin");
    submit(map, "frmLogin", "AuthController");
    redirect(map, "AuthController", "PanelProductor");
    response(map, "AuthController", "frmLogin");

    // Panel
    link(map, "PanelProductor", "DashboardController");
    build(map, "DashboardController", "PanelProductor");
    link(map, "PanelProductor", "Comunidades");
    link(map, "PanelProductor", "MisEmprendimientos");
    link(map, "PanelProductor", "Produccion");
    link(map, "PanelProductor", "Lotes");
    link(map, "PanelProductor", "Trazabilidad");
    link(map, "PanelProductor", "Notificaciones");

    // Notificaciones (p. ej. producción validada o rechazada)
    link(map, "Notificaciones", "NotificacionController");
    build(map, "NotificacionController", "Notificaciones");
    link(map, "Notificaciones", "Produccion");

    // Comunidades
    link(map, "Comunidades", "ComunidadController");
    build(map, "ComunidadController", "Comunidades");

    // Mi emprendimiento
    link(map, "MisEmprendimientos", "EmprendimientoController");
    build(map, "EmprendimientoController", "MisEmprendimientos");
    composicion(map, "MisEmprendimientos", "frmEmprendimiento");
    submit(map, "frmEmprendimiento", "EmprendimientoController");
    response(map, "EmprendimientoController", "frmEmprendimiento");
    link(map, "MisEmprendimientos", "EmprendimientoDetalle");
    build(map, "EmprendimientoController", "EmprendimientoDetalle");

    composicion(map, "EmprendimientoDetalle", "frmImagenEmprendimiento");
    submit(map, "frmImagenEmprendimiento", "EmprendimientoController");
    response(map, "EmprendimientoController", "frmImagenEmprendimiento");

    composicion(map, "EmprendimientoDetalle", "frmOferta");
    submit(map, "frmOferta", "EmprendimientoController");
    response(map, "EmprendimientoController", "frmOferta");
    link(map, "EmprendimientoDetalle", "ProductoController"); // combo de productos (GET auxiliar)

    // Producción
    link(map, "Produccion", "ProduccionController");
    build(map, "ProduccionController", "Produccion");
    composicion(map, "Produccion", "frmProduccion");
    submit(map, "frmProduccion", "ProduccionController");
    response(map, "ProduccionController", "frmProduccion");
    link(map, "Produccion", "ProductoController"); // combo de productos (GET auxiliar)

    // Lotes y trazabilidad
    link(map, "Lotes", "LoteController");
    build(map, "LoteController", "Lotes");
    link(map, "Lotes", "Trazabilidad");
    composicion(map, "Trazabilidad", "frmTrazabilidad");
    submit(map, "frmTrazabilidad", "LoteController");
    build(map, "LoteController", "Trazabilidad");
    response(map, "LoteController", "frmTrazabilidad");

    finalizarDiagrama(ctx);
    MODO_HORIZONTAL_CARTA = modoAnterior;
}

/* ============================================================
   DIAGRAMA PERSONAL
   Personal de FEDER: toda la operación del día a día.
   Solo lo propio del rol (lo común: catálogo público, búsqueda, preferencias, perfil,
   notificaciones, trazabilidad, foto/ofertas del emprendimiento y planes de pago ya
   están en los diagramas del Cliente y del Productor).
   Menú: Dashboard · Operación (Comunidades, Productores, Producción, Lotes) ·
   Catálogo e inventario (Categorías, Productos, Inventario, Alertas) ·
   Comercial (Encargos, Pedidos, Entregas) · Pagos · Análisis (Indicadores financieros, Reportes).
   Flujos: valida la producción y crea lotes, ajusta inventario, gestiona encargos,
   avanza el estado de los pedidos (programa la entrega), registra y verifica pagos
   (efectivo, QR, transferencia) y despacha entregas.
   ============================================================ */

function crearDiagramaPersonal(rootPkg)
{
    var pkg = crearPaquete(rootPkg, "Navegación - Personal");
    var diagram = crearDiagrama(pkg, "Diagrama de Navegación - Personal");
    var ctx = crearContextoDiagrama(pkg, diagram);
    var map = ctx.map;

    function pagina(name, stereotype, attrs, methods)
    {
        var ancho = estimarAnchoCaja(name, stereotype, attrs, methods, null);
        var alto = altoCaja(stereotype, attrs, methods);
        return crearPagina(ctx, name, stereotype, attrs, methods, ancho, alto);
    }

    // ---- Base: actor + inicio + login ----
    crearActor(ctx, "Personal", 90, 100);

    pagina("Inicio", "client page",
        "menu",
        "iniciarSesion\nirPanel");

    pagina("Login", "client page",
        "email\npassword",
        "");

    pagina("frmLogin", "form page",
        "email\npassword\nbotón Iniciar Sesión",
        "");

    pagina("AuthController", "Server Page",
        "email\npassword",
        "login\nme\nlogout");

    pagina("PanelPersonal", "client page",
        "usuario\nmenu\nDashboard\nComunidades\nProductores\nProducción\nLotes\nCategorías\nProductos\nInventario\nAlertas\nEncargos\nPedidos\nEntregas\nPagos\nIndicadores financieros\nReportes",
        "cerrarSesion");

    // ---- Dashboard ----
    pagina("Dashboard", "client page",
        "ventasMes\npedidosPendientes\nstockBajo\nvisitas\ngraficos",
        "verIndicadores");

    pagina("DashboardController", "Server Page",
        "",
        "index");

    // ---- Comunidades (CRUD) ----
    pagina("Comunidades", "client page",
        "comunidades\nq",
        "buscarComunidad\ncrearComunidad\neditarComunidad\neliminarComunidad");

    pagina("frmComunidad", "form page",
        "nombre\nmunicipio\nprovincia\ndepartamento\ndescripcion\nbotón Guardar",
        "");

    pagina("ComunidadController", "Server Page",
        "nombre\nmunicipio\nprovincia\ndepartamento\ndescripcion",
        "index\nstore\nupdate\ndestroy");

    // ---- Productores / emprendimientos (CRUD) ----
    pagina("Emprendimientos", "client page",
        "emprendimientos\nq\ncomunidad_id\nrubro\nestado",
        "buscarProductor\ncrearProductor\neditarProductor\neliminarProductor");

    pagina("frmEmprendimiento", "form page",
        "comunidad_id\nusuario_id\nnombre\nrubro\nresponsable\nci_nit\ntelefono\ndireccion\nlatitud\nlongitud\nestado\nbotón Guardar",
        "");

    pagina("EmprendimientoController", "Server Page",
        "comunidad_id\nusuario_id\nnombre\nrubro\nresponsable\nci_nit\ntelefono\ndireccion\nlatitud\nlongitud\nestado",
        "index\nshow\nstore\nupdate\ndestroy");

    // ---- Producción (validar) -> Lotes ----
    pagina("Produccion", "client page",
        "producciones\nestado\ntipo\nq",
        "filtrar\nvalidarProduccion\ncrearLote");

    pagina("frmValidarProduccion", "form page",
        "estado\nobservacion\nbotón Validar\nbotón Rechazar",
        "");

    pagina("frmLote", "form page",
        "codigo\ncantidad\nfecha_vencimiento\ncosto_unitario\nbotón Crear Lote",
        "");

    pagina("ProduccionController", "Server Page",
        "estado\ntipo\nq\nobservacion",
        "index\nvalidar\ndestroy");

    pagina("Lotes", "client page",
        "lotes\nestado\nproducto_id\nq",
        "filtrar\neditarLote\najustarInventario");

    pagina("frmEditarLote", "form page",
        "fecha_vencimiento\ncosto_unitario\nestado\nbotón Guardar",
        "");

    pagina("frmMovimiento", "form page",
        "tipo\ncantidad\nmotivo\nbotón Registrar Movimiento",
        "");

    pagina("LoteController", "Server Page",
        "produccion_id\ncodigo\ncantidad\nfecha_vencimiento\ncosto_unitario\nestado\nversion",
        "index\nstore\nupdate");

    // ---- Catálogo (categorías y productos) ----
    pagina("Categorias", "client page",
        "categorias\nproductos_count",
        "crearCategoria\neditarCategoria\neliminarCategoria");

    pagina("frmCategoria", "form page",
        "nombre\ndescripcion\nbotón Guardar",
        "");

    pagina("CategoriaController", "Server Page",
        "nombre\ndescripcion",
        "index\nstore\nupdate\ndestroy");

    pagina("Productos", "client page",
        "productos\nq\ncategoria_id\nestado",
        "buscarProducto\ncrearProducto\neditarProducto\neliminarProducto");

    pagina("frmProducto", "form page",
        "categoria_id\nnombre\ndescripcion\npresentacion\nunidad_medida\nprecio_venta\nmodalidad_venta\nstock_minimo\nestado\nimagen\nbotón Guardar",
        "");

    pagina("ProductoController", "Server Page",
        "categoria_id\nnombre\ndescripcion\npresentacion\nunidad_medida\nprecio_venta\nmodalidad_venta\nstock_minimo\nestado\nimagen",
        "index\nstore\nupdate\ndestroy");

    // ---- Inventario y alertas ----
    pagina("Inventario", "client page",
        "disponibilidad\nmovimientos\ntipo\ndesde\nhasta",
        "verDisponibilidad\nverMovimientos");

    pagina("InventarioController", "Server Page",
        "lote_id\ntipo\ncantidad\nmotivo\ndesde\nhasta",
        "disponibilidad\nmovimientos\nregistrarMovimiento");

    pagina("Alertas", "client page",
        "alertas\ntipo\nestado",
        "filtrar\natenderAlerta");

    pagina("frmAtenderAlerta", "form page",
        "botón Marcar Atendida",
        "");

    pagina("AlertaController", "Server Page",
        "estado\ntipo",
        "index\natender");

    // ---- Encargos ----
    pagina("Encargos", "client page",
        "encargos\ncliente\nestado",
        "filtrar\naceptar\nrechazar\nmarcarDisponible");

    pagina("frmEstadoEncargo", "form page",
        "estado\nobservacion\nbotón Guardar",
        "");

    pagina("EncargoController", "Server Page",
        "estado\nobservacion",
        "index\nshow\ncambiarEstado");

    // ---- Pedidos ----
    pagina("Pedidos", "client page",
        "pedidos\ncliente\nestado\nq\ndesde\nhasta",
        "buscarPedido\nverPedido");

    pagina("PedidoDetalle", "client page",
        "numero\ncliente\nestado\ndetalle\nentrega\npagos\nsaldo",
        "confirmar\nprogramarEntrega\nmarcarEntregado\ncancelar\nregistrarPago");

    pagina("frmEstadoPedido", "form page",
        "estado\nfecha_programada\nbotón Avanzar Estado",
        "");

    pagina("frmRegistrarPago", "form page",
        "metodo_pago_id\nmonto\nreferencia\nbotón Registrar Pago",
        "");

    pagina("PedidoController", "Server Page",
        "estado\nfecha_programada\nq\ndesde\nhasta",
        "index\nshow\ncambiarEstado\ncancelar");

    // ---- Pagos (verificar) ----
    pagina("Pagos", "client page",
        "pagos\ncliente\nmetodo\nestado\nq",
        "filtrar\nverificarPago\nrechazarPago");

    pagina("frmVerificarPago", "form page",
        "estado\nbotón Confirmar\nbotón Rechazar",
        "");

    pagina("PagoController", "Server Page",
        "metodo_pago_id\nmonto\nreferencia\nestado",
        "index\npagar\nverificar");

    // ---- Entregas ----
    pagina("Entregas", "client page",
        "entregas\ncliente\ntipo\ndireccion\nfecha_programada\nestado",
        "filtrar\nverMapa\nreprogramar\nmarcarEntregada\nmarcarFallida");

    pagina("frmEntrega", "form page",
        "estado\nfecha_programada\nreceptor\nreferencia\nbotón Guardar",
        "");

    pagina("EntregaController", "Server Page",
        "estado\ntipo\nfecha_programada\nreceptor\nreferencia",
        "index\nupdate");

    // ---- Análisis: indicadores financieros y reportes ----
    pagina("Finanzas", "client page",
        "ingresos\ncobrado\nporCobrar\nmargen\ngraficos",
        "elegirRango");

    pagina("frmRangoFechas", "form page",
        "desde\nhasta\nbotón Aplicar",
        "");

    pagina("FinanzasController", "Server Page",
        "desde\nhasta",
        "indicadores");

    pagina("Reportes", "client page",
        "tipo\ntabla\ngrafico",
        "elegirReporte\nexportarCSV\nimprimir");

    pagina("frmFiltrosReporte", "form page",
        "tipo\ndesde\nhasta\nbotón Generar\nbotón Exportar CSV\nbotón Imprimir",
        "");

    pagina("ReporteController", "Server Page",
        "tipo\ndesde\nhasta",
        "generar");

    // ---- Relaciones Personal ----
    asociacionActor(map, "Personal", "Inicio");

    link(map, "Inicio", "Login");
    link(map, "Inicio", "PanelPersonal");
    composicion(map, "Login", "frmLogin");
    submit(map, "frmLogin", "AuthController");
    redirect(map, "AuthController", "PanelPersonal");
    response(map, "AuthController", "frmLogin");

    // Menú
    link(map, "PanelPersonal", "Dashboard");
    link(map, "PanelPersonal", "Comunidades");
    link(map, "PanelPersonal", "Emprendimientos");
    link(map, "PanelPersonal", "Produccion");
    link(map, "PanelPersonal", "Lotes");
    link(map, "PanelPersonal", "Categorias");
    link(map, "PanelPersonal", "Productos");
    link(map, "PanelPersonal", "Inventario");
    link(map, "PanelPersonal", "Alertas");
    link(map, "PanelPersonal", "Encargos");
    link(map, "PanelPersonal", "Pedidos");
    link(map, "PanelPersonal", "Entregas");
    link(map, "PanelPersonal", "Pagos");
    link(map, "PanelPersonal", "Finanzas");
    link(map, "PanelPersonal", "Reportes");

    // Dashboard
    link(map, "Dashboard", "DashboardController");
    build(map, "DashboardController", "Dashboard");

    // Comunidades
    link(map, "Comunidades", "ComunidadController");
    build(map, "ComunidadController", "Comunidades");
    composicion(map, "Comunidades", "frmComunidad");
    submit(map, "frmComunidad", "ComunidadController");
    response(map, "ComunidadController", "frmComunidad");

    // Productores
    link(map, "Emprendimientos", "EmprendimientoController");
    build(map, "EmprendimientoController", "Emprendimientos");
    composicion(map, "Emprendimientos", "frmEmprendimiento");
    submit(map, "frmEmprendimiento", "EmprendimientoController");
    response(map, "EmprendimientoController", "frmEmprendimiento");

    // Producción: validar y crear lote
    link(map, "Produccion", "ProduccionController");
    build(map, "ProduccionController", "Produccion");
    composicion(map, "Produccion", "frmValidarProduccion");
    submit(map, "frmValidarProduccion", "ProduccionController");
    response(map, "ProduccionController", "frmValidarProduccion");
    // Tras crear el lote la vista de Producción solo recarga su lista (sin redirect)
    composicion(map, "Produccion", "frmLote");
    submit(map, "frmLote", "LoteController");
    response(map, "LoteController", "frmLote");

    // Lotes: editar y ajustar inventario
    link(map, "Lotes", "LoteController");
    build(map, "LoteController", "Lotes");
    composicion(map, "Lotes", "frmEditarLote");
    submit(map, "frmEditarLote", "LoteController");
    response(map, "LoteController", "frmEditarLote");
    composicion(map, "Lotes", "frmMovimiento");
    submit(map, "frmMovimiento", "InventarioController");
    response(map, "InventarioController", "frmMovimiento");

    // Categorías y productos
    link(map, "Categorias", "CategoriaController");
    build(map, "CategoriaController", "Categorias");
    composicion(map, "Categorias", "frmCategoria");
    submit(map, "frmCategoria", "CategoriaController");
    response(map, "CategoriaController", "frmCategoria");

    link(map, "Productos", "ProductoController");
    build(map, "ProductoController", "Productos");
    composicion(map, "Productos", "frmProducto");
    submit(map, "frmProducto", "ProductoController");
    response(map, "ProductoController", "frmProducto");

    // Inventario y alertas
    link(map, "Inventario", "InventarioController");
    build(map, "InventarioController", "Inventario");

    link(map, "Alertas", "AlertaController");
    build(map, "AlertaController", "Alertas");
    composicion(map, "Alertas", "frmAtenderAlerta");
    submit(map, "frmAtenderAlerta", "AlertaController");

    // Encargos
    link(map, "Encargos", "EncargoController");
    build(map, "EncargoController", "Encargos");
    composicion(map, "Encargos", "frmEstadoEncargo");
    submit(map, "frmEstadoEncargo", "EncargoController");
    response(map, "EncargoController", "frmEstadoEncargo");

    // Pedidos: avanzar estado (pendiente -> confirmado -> listo_entrega -> entregado) y cobrar
    link(map, "Pedidos", "PedidoController");
    build(map, "PedidoController", "Pedidos");
    link(map, "Pedidos", "PedidoDetalle");
    build(map, "PedidoController", "PedidoDetalle");
    composicion(map, "PedidoDetalle", "frmEstadoPedido");
    submit(map, "frmEstadoPedido", "PedidoController");
    response(map, "PedidoController", "frmEstadoPedido");
    // Tras cobrar, la vista vuelve a pedir el pedido a PedidoController (un solo build);
    // el combo de métodos sale de GET /metodos-pago (petición auxiliar = «link»).
    composicion(map, "PedidoDetalle", "frmRegistrarPago");
    submit(map, "frmRegistrarPago", "PagoController");
    response(map, "PagoController", "frmRegistrarPago");
    link(map, "PedidoDetalle", "PagoController");

    // Pagos: verificar QR / transferencia
    link(map, "Pagos", "PagoController");
    build(map, "PagoController", "Pagos");
    composicion(map, "Pagos", "frmVerificarPago");
    submit(map, "frmVerificarPago", "PagoController");
    link(map, "Pagos", "PedidoDetalle");

    // Entregas
    link(map, "Entregas", "EntregaController");
    build(map, "EntregaController", "Entregas");
    composicion(map, "Entregas", "frmEntrega");
    submit(map, "frmEntrega", "EntregaController");
    response(map, "EntregaController", "frmEntrega");
    link(map, "Entregas", "PedidoDetalle");

    // Indicadores financieros
    link(map, "Finanzas", "FinanzasController");
    build(map, "FinanzasController", "Finanzas");
    composicion(map, "Finanzas", "frmRangoFechas");
    submit(map, "frmRangoFechas", "FinanzasController");

    // Reportes
    composicion(map, "Reportes", "frmFiltrosReporte");
    submit(map, "frmFiltrosReporte", "ReporteController");
    build(map, "ReporteController", "Reportes");
    response(map, "ReporteController", "frmFiltrosReporte");

    finalizarDiagrama(ctx);
}

/* ============================================================
   DIAGRAMA ADMINISTRADOR
   Solo lo que el Personal NO tiene: gestionar usuarios, roles y matriz de permisos,
   bitácora de auditoría y subir el QR de cobro de FEDER. Todo lo operativo
   (producción, catálogo, pedidos, pagos, reportes...) lo hace igual que el Personal
   (ver su diagrama), con el permiso extra de eliminar.
   ============================================================ */

function crearDiagramaAdministrador(rootPkg)
{
    // Pocos módulos: un solo bloque vertical entra más grande en la hoja.
    var modoAnterior = MODO_HORIZONTAL_CARTA;
    MODO_HORIZONTAL_CARTA = false;

    var pkg = crearPaquete(rootPkg, "Navegación - Administrador");
    var diagram = crearDiagrama(pkg, "Diagrama de Navegación - Administrador");
    var ctx = crearContextoDiagrama(pkg, diagram);
    var map = ctx.map;

    function pagina(name, stereotype, attrs, methods)
    {
        var ancho = estimarAnchoCaja(name, stereotype, attrs, methods, null);
        var alto = altoCaja(stereotype, attrs, methods);
        return crearPagina(ctx, name, stereotype, attrs, methods, ancho, alto);
    }

    // ---- Base: actor + inicio + login ----
    crearActor(ctx, "Administrador", 90, 100);

    pagina("Inicio", "client page",
        "menu",
        "iniciarSesion\nirPanel");

    pagina("Login", "client page",
        "email\npassword",
        "");

    pagina("frmLogin", "form page",
        "email\npassword\nbotón Iniciar Sesión",
        "");

    pagina("AuthController", "Server Page",
        "email\npassword",
        "login\nme\nlogout");

    pagina("PanelAdministrador", "client page",
        "usuario\nmenu\nUsuarios\nRoles y permisos\nBitácora\nQR de cobro\nmódulos del Personal",
        "cerrarSesion");

    // ---- Usuarios (CRUD) ----
    pagina("Usuarios", "client page",
        "usuarios\nq\nrol_id\nestado",
        "buscarUsuario\ncrearUsuario\neditarUsuario\neliminarUsuario");

    pagina("frmUsuario", "form page",
        "rol_id\nnombre\napellido\nci\nemail\ntelefono\ndireccion\npassword\nestado\nbotón Guardar",
        "");

    pagina("UsuarioController", "Server Page",
        "rol_id\nnombre\napellido\nci\nemail\ntelefono\ndireccion\npassword\nestado",
        "index\nshow\nstore\nupdate\ndestroy");

    // ---- Roles y matriz de permisos ----
    pagina("Roles", "client page",
        "roles\nmodulos\nmatriz",
        "elegirRol\nverMatriz\nmarcarPermiso");

    pagina("frmMatrizPermisos", "form page",
        "permiso_id\nver\ncrear\neditar\neliminar\nbotón Guardar Permisos",
        "");

    pagina("RolController", "Server Page",
        "permisos",
        "index\npermisos\nguardarPermisos");

    // ---- Bitácora de auditoría ----
    pagina("Bitacora", "client page",
        "eventos\nresumen\npaginacion",
        "filtrarEvento\npaginar");

    pagina("frmFiltrosBitacora", "form page",
        "accion\nq\nip\nrecurso\ndesde\nhasta\nbotón Filtrar",
        "");

    pagina("BitacoraController", "Server Page",
        "accion\nq\nip\nrecurso\ndesde\nhasta",
        "index\nresumen");

    // ---- QR de cobro de FEDER ----
    pagina("QrCobro", "client page",
        "qrActivo\nhistorial",
        "subirQr");

    pagina("frmSubirQr", "form page",
        "imagen\nbotón Subir QR",
        "");

    pagina("QrController", "Server Page",
        "imagen",
        "index\nstore\nimagen");

    // ---- Relaciones Administrador ----
    asociacionActor(map, "Administrador", "Inicio");

    link(map, "Inicio", "Login");
    link(map, "Inicio", "PanelAdministrador");
    composicion(map, "Login", "frmLogin");
    submit(map, "frmLogin", "AuthController");
    redirect(map, "AuthController", "PanelAdministrador");
    response(map, "AuthController", "frmLogin");

    link(map, "PanelAdministrador", "Usuarios");
    link(map, "PanelAdministrador", "Roles");
    link(map, "PanelAdministrador", "Bitacora");
    link(map, "PanelAdministrador", "QrCobro");

    // Usuarios (el combo de roles sale de GET /roles: petición auxiliar = «link»)
    link(map, "Usuarios", "UsuarioController");
    build(map, "UsuarioController", "Usuarios");
    composicion(map, "Usuarios", "frmUsuario");
    submit(map, "frmUsuario", "UsuarioController");
    response(map, "UsuarioController", "frmUsuario");
    link(map, "Usuarios", "RolController");

    // Roles y permisos
    link(map, "Roles", "RolController");
    build(map, "RolController", "Roles");
    composicion(map, "Roles", "frmMatrizPermisos");
    submit(map, "frmMatrizPermisos", "RolController");
    response(map, "RolController", "frmMatrizPermisos");

    // Bitácora
    link(map, "Bitacora", "BitacoraController");
    build(map, "BitacoraController", "Bitacora");
    composicion(map, "Bitacora", "frmFiltrosBitacora");
    submit(map, "frmFiltrosBitacora", "BitacoraController");

    // QR de cobro
    link(map, "QrCobro", "QrController");
    build(map, "QrController", "QrCobro");
    composicion(map, "QrCobro", "frmSubirQr");
    submit(map, "frmSubirQr", "QrController");
    response(map, "QrController", "frmSubirQr");

    finalizarDiagrama(ctx);
    MODO_HORIZONTAL_CARTA = modoAnterior;
}

/* ============================================================
   CONTEXTO Y CREACIÓN DE ELEMENTOS
   ============================================================ */

function crearContextoDiagrama(pkg, diagram)
{
    var ctx = {
        pkg: pkg,
        diagram: diagram,
        map: {},
        grafo: {
            nodes: [],
            nodeMap: {},
            edges: []
        }
    };
    ctx.map.__ctx = ctx;
    return ctx;
}

function estimarAnchoCaja(name, stereotype, attrs, methods, minW)
{
    var maxLen = (name != null && name != "") ? (name.length + 4) : 12;
    if (stereotype != null && stereotype != "" && (stereotype.length + 4) > maxLen)
    {
        maxLen = stereotype.length + 4;
    }

    var i, lista;
    if (attrs != null && attrs != "")
    {
        lista = attrs.split("\n");
        for (i = 0; i < lista.length; i++)
        {
            if ((lista[i].length + 4) > maxLen) maxLen = lista[i].length + 4;
        }
    }
    if (methods != null && methods != "")
    {
        lista = methods.split("\n");
        for (i = 0; i < lista.length; i++)
        {
            if ((lista[i].length + 6) > maxLen) maxLen = lista[i].length + 6;
        }
    }

    var calc = Math.round(32 + maxLen * 6.8);
    if (minW != null && minW > calc) calc = minW;
    if (calc < 200) calc = 200;
    if (calc > 320) calc = 320;
    return calc;
}

// Alto real estimado incluyendo cabeceras «Text» y «Submit» en los «form page»
function altoCaja(stereotype, attrs, methods)
{
    var na = 0;
    var nm = 0;
    var hasText = false;
    var hasSubmit = false;
    var i, lista;

    if (attrs != null && attrs != "")
    {
        lista = attrs.split("\n");
        for (i = 0; i < lista.length; i++)
        {
            if (lista[i] != "")
            {
                na++;
                if (stereotype == "form page")
                {
                    if (
                        lista[i].indexOf("botón") >= 0 ||
                        lista[i].indexOf("Botón") >= 0 ||
                        lista[i].indexOf("boton") >= 0 ||
                        lista[i].indexOf("Boton") >= 0
                    )
                    {
                        hasSubmit = true;
                    }
                    else
                    {
                        hasText = true;
                    }
                }
            }
        }
    }

    if (methods != null && methods != "")
    {
        lista = methods.split("\n");
        for (i = 0; i < lista.length; i++)
        {
            if (lista[i] != "") nm++;
        }
    }

    var h = (stereotype != null && stereotype != "") ? 50 : 38;
    if (na > 0)
    {
        h += 8 + 15 * na;
        if (hasText) h += 16;
        if (hasSubmit) h += 16;
    }
    if (nm > 0)
    {
        h += 10 + 15 * nm;
    }
    if (na == 0 && nm == 0)
    {
        h += 10;
    }
    return h + 6;
}

function crearPaquete(parentPkg, name)
{
    var pkg as EA.Package;
    pkg = parentPkg.Packages.AddNew(name, "Package");
    pkg.Update();
    parentPkg.Packages.Refresh();
    return pkg;
}

function crearDiagrama(pkg, name)
{
    var diagram as EA.Diagram;
    diagram = pkg.Diagrams.AddNew(name, "Class");
    if (MODO_HORIZONTAL_CARTA)
    {
        diagram.Orientation = "L";
    }
    diagram.Update();
    pkg.Diagrams.Refresh();
    return diagram;
}

function registrarNodoGrafo(ctx, name, kind, stereotype, attrs, methods, w, h, el, obj)
{
    var n = {
        id: ctx.grafo.nodes.length,
        name: name,
        kind: kind,
        stereotype: stereotype != null ? stereotype : "",
        attrs: attrs != null ? attrs : "",
        methods: methods != null ? methods : "",
        w: w,
        h: h,
        x: 60,
        y: 60,
        col: 2,
        band: 0,
        el: el,
        obj: obj
    };
    ctx.grafo.nodes.push(n);
    ctx.grafo.nodeMap[name] = n;
    return n;
}

function crearActor(ctx, name, w, h)
{
    var pkg = ctx.pkg;
    var diagram = ctx.diagram;
    var ancho = (w != null) ? w : 90;
    var alto = (h != null) ? h : 100;

    var el as EA.Element;
    el = pkg.Elements.AddNew(name, "Actor");
    el.Update();
    pkg.Elements.Refresh();

    var obj as EA.DiagramObject;
    obj = diagram.DiagramObjects.AddNew(
        "l=60;r=" + (60 + ancho) + ";t=60;b=" + (60 + alto) + ";",
        ""
    );
    obj.ElementID = el.ElementID;
    obj.Update();

    ctx.map[name] = el;
    registrarNodoGrafo(ctx, name, "Actor", "", "", "", ancho, alto, el, obj);
    return el;
}

function crearPagina(ctx, name, stereotype, attrs, methods, w, h)
{
    var pkg = ctx.pkg;
    var diagram = ctx.diagram;

    var el as EA.Element;
    el = pkg.Elements.AddNew(name, "Class");

    if (stereotype != "")
    {
        el.Stereotype = stereotype;
        el.StereotypeEx = stereotype;
    }

    el.Update();
    pkg.Elements.Refresh();

    if (attrs != "" && attrs != null)
    {
        crearAtributos(el, stereotype, attrs);
    }

    if (methods != "" && methods != null)
    {
        crearMetodos(el, methods);
    }

    el.Update();
    pkg.Elements.Refresh();

    var obj as EA.DiagramObject;
    obj = diagram.DiagramObjects.AddNew(
        "l=60;r=" + (60 + w) + ";t=60;b=" + (60 + h) + ";",
        ""
    );
    obj.ElementID = el.ElementID;
    obj.Style = "BCol=" + COLOR_CAJA + ";BColor=" + COLOR_CAJA + ";LCol=0;LColor=0;LWth=1;Border=1;";
    obj.Update();

    ctx.map[name] = el;
    registrarNodoGrafo(ctx, name, "Class", stereotype, attrs, methods, w, h, el, obj);
    return el;
}

function crearAtributos(el, stereotype, attrs)
{
    var lista = attrs.split("\n");

    for (var i = 0; i < lista.length; i++)
    {
        if (lista[i] != "")
        {
            var att as EA.Attribute;
            att = el.Attributes.AddNew(lista[i], "");

            if (stereotype == "form page")
            {
                if (
                    lista[i].indexOf("botón") >= 0 ||
                    lista[i].indexOf("Botón") >= 0 ||
                    lista[i].indexOf("boton") >= 0 ||
                    lista[i].indexOf("Boton") >= 0
                )
                {
                    att.Stereotype = "Submit";
                    att.StereotypeEx = "Submit";
                }
                else
                {
                    att.Stereotype = "Text";
                    att.StereotypeEx = "Text";
                }
            }

            att.Update();
        }
    }

    el.Attributes.Refresh();
}

function crearMetodos(el, methods)
{
    var lista = methods.split("\n");

    for (var i = 0; i < lista.length; i++)
    {
        if (lista[i] != "")
        {
            var op as EA.Method;
            op = el.Methods.AddNew(lista[i], "");
            op.Update();
        }
    }

    el.Methods.Refresh();
}

/* ============================================================
   CONECTORES Y REGISTRO EN EL GRAFO
   ============================================================ */

function asociacionActor(map, src, dst)
{
    registrarConectorGrafo(map, src, dst, "Association", "", "", "Unspecified", false, "actor");
}

function link(map, src, dst)
{
    registrarConectorGrafo(map, src, dst, "Association", "link", "", "Source -> Destination", false, "link");
}

function submit(map, src, dst)
{
    registrarConectorGrafo(map, src, dst, "Association", "submit", "", "Source -> Destination", false, "submit");
}

function build(map, src, dst)
{
    registrarConectorGrafo(map, src, dst, "Association", "build", "", "Source -> Destination", false, "build");
}

function response(map, src, dst)
{
    registrarConectorGrafo(map, src, dst, "Association", "response", "", "Source -> Destination", false, "response");
}

function redirect(map, src, dst)
{
    registrarConectorGrafo(map, src, dst, "Association", "redirect", "", "Source -> Destination", false, "redirect");
}

// Asociación simple sin estereotipo (Server Page -> recurso del servidor, página -> «JavaScript»)
function asociacion(map, src, dst)
{
    registrarConectorGrafo(map, src, dst, "Association", "", "", "Unspecified", false, "asociacion");
}

function composicion(map, whole, part)
{
    registrarConectorGrafo(map, whole, part, "Aggregation", "", "", "Unspecified", true, "composicion");
}

function registrarConectorGrafo(map, srcName, dstName, type, stereotype, name, direction, compositionAtSource, relKind)
{
    var conn = crearConector(map[srcName], map[dstName], type, stereotype, name, direction, compositionAtSource);
    if (conn == null || map.__ctx == null)
    {
        return conn;
    }

    var grafo = map.__ctx.grafo;
    var sNode = grafo.nodeMap[srcName];
    var dNode = grafo.nodeMap[dstName];
    if (sNode != null && dNode != null)
    {
        grafo.edges.push({
            id: grafo.edges.length,
            src: sNode,
            dst: dNode,
            relKind: relKind,
            stereotype: stereotype,
            conn: conn,
            srcSide: 2,
            dstSide: 4,
            srcPort: { x: 0, y: 0 },
            dstPort: { x: 0, y: 0 },
            waypoints: []
        });
    }
    return conn;
}

function crearConector(src, dst, type, stereotype, name, direction, compositionAtSource)
{
    if (src == null || dst == null)
    {
        Session.Output("No se pudo crear conector. Origen o destino nulo.");
        return null;
    }

    var conn as EA.Connector;
    conn = src.Connectors.AddNew(name, type);
    conn.SupplierID = dst.ElementID;

    if (stereotype != "")
    {
        conn.Stereotype = stereotype;
        conn.StereotypeEx = stereotype;
    }

    if (direction != null && direction != "")
    {
        conn.Direction = direction;
    }

    if (compositionAtSource)
    {
        conn.ClientEnd.Aggregation = 2;
        conn.ClientEnd.Update();
    }

    conn.Update();
    src.Connectors.Refresh();

    return conn;
}

/* ============================================================
   MOTOR DE AUTO-LAYOUT POR CAPAS SEMÁNTICAS Y BANDAS FUNCIONALES
   Columnas:
     Col 0: Actor
     Col 1: Páginas Hub (Inicio / Panel) + sus auxiliares exclusivos
     Col 2: Vistas principales («client page»)
     Col 3: Formularios («form page»)
     Col 4: Controladores («Server Page»)
     Col 5: Servicios / vistas derivadas downstream (StripeAPI, 3DS, QR)
   ============================================================ */

function calcularPosicionesGrafo(grafo)
{
    var nodes = grafo.nodes;
    var edges = grafo.edges;
    var N = nodes.length;
    var i, j, e;

    var adjAll = [];
    var outLinkPages = [];
    var inFromActor = [];
    var inFromHub = [];
    var compOwner = {};
    var formsOf = [];

    for (i = 0; i < N; i++)
    {
        adjAll[i] = [];
        outLinkPages[i] = 0;
        inFromActor[i] = false;
        inFromHub[i] = false;
        formsOf[i] = [];
    }

    for (i = 0; i < edges.length; i++)
    {
        e = edges[i];
        adjAll[e.src.id].push(e);
        adjAll[e.dst.id].push(e);

        if (e.src.kind == "Actor")
        {
            inFromActor[e.dst.id] = true;
        }
        if (e.src.stereotype == "client page" && e.dst.stereotype == "client page" && e.relKind == "link")
        {
            outLinkPages[e.src.id]++;
        }
        if (e.relKind == "composicion")
        {
            if (compOwner[e.dst.id] == null)
            {
                compOwner[e.dst.id] = e.src.id;
                formsOf[e.src.id].push(e.dst.id);
            }
        }
    }

    // 1. Identificar Col 0 (Actores) y Col 1 (Hubs de navegación)
    var isHub = {};
    for (i = 0; i < N; i++)
    {
        if (nodes[i].kind == "Actor")
        {
            nodes[i].col = 0;
        }
        else if (nodes[i].stereotype == "client page" && (inFromActor[i] || outLinkPages[i] >= 4))
        {
            nodes[i].col = 1;
            isHub[i] = true;
        }
    }

    for (i = 0; i < edges.length; i++)
    {
        e = edges[i];
        if (isHub[e.src.id] && e.relKind == "link")
        {
            inFromHub[e.dst.id] = true;
        }
    }

    // 2. Auxiliares exclusivos de un Hub van en Col 1 junto a su Hub
    var hubAttachment = {};
    for (i = 0; i < N; i++)
    {
        if (nodes[i].kind == "Actor" || isHub[i]) continue;

        if (nodes[i].stereotype == "form page" && compOwner[i] != null && isHub[compOwner[i]])
        {
            nodes[i].col = 1;
            hubAttachment[i] = compOwner[i];
        }
        else if (nodes[i].stereotype == "Server Page")
        {
            var seenNb = {};
            var deg = 0;
            var singleHub = -1;
            for (j = 0; j < adjAll[i].length; j++)
            {
                var othId = (adjAll[i][j].src.id == i) ? adjAll[i][j].dst.id : adjAll[i][j].src.id;
                if (!seenNb[othId])
                {
                    seenNb[othId] = true;
                    deg++;
                    singleHub = othId;
                }
            }
            if (deg == 1 && isHub[singleHub])
            {
                nodes[i].col = 1;
                hubAttachment[i] = singleHub;
            }
        }
    }

    // 3. Clasificar client pages entre Col 2 (vistas primarias) y Col 5 (vistas auxiliares downstream)
    for (i = 0; i < N; i++)
    {
        if (nodes[i].kind == "Actor" || nodes[i].col == 1) continue;

        if (nodes[i].stereotype == "client page")
        {
            var hasInClientLink = inFromHub[i];
            var hasOutCtrlLink = false;
            for (j = 0; j < adjAll[i].length; j++)
            {
                e = adjAll[i][j];
                if (e.dst.id == i && e.src.stereotype == "client page" && e.relKind == "link")
                {
                    hasInClientLink = true;
                }
                if (e.src.id == i && e.dst.stereotype == "Server Page" && e.relKind == "link")
                {
                    hasOutCtrlLink = true;
                }
            }
            if (!hasInClientLink && !hasOutCtrlLink && formsOf[i].length == 0)
            {
                nodes[i].col = 5;
            }
            else
            {
                nodes[i].col = 2;
            }
        }
    }

    // Componentes del navegador («JavaScript», p. ej. Stripe.js) -> Col 5 junto a los servicios externos
    for (i = 0; i < N; i++)
    {
        if (nodes[i].stereotype == "JavaScript") nodes[i].col = 5;
    }

    // Formularios regulares -> Col 3
    for (i = 0; i < N; i++)
    {
        if (nodes[i].stereotype == "form page" && nodes[i].col != 1)
        {
            nodes[i].col = 3;
        }
    }

    // Controladores -> Col 4 (principales) o Col 5 (servicios externos invocados por otros controladores)
    for (i = 0; i < N; i++)
    {
        if (nodes[i].stereotype == "Server Page" && nodes[i].col != 1)
        {
            var linkedFromCtrl = 0;
            var touchesCol2 = false;
            var touchesCol5 = false;
            for (j = 0; j < adjAll[i].length; j++)
            {
                e = adjAll[i][j];
                var oth = (e.src.id == i) ? e.dst : e.src;
                if (e.dst.id == i && e.src.stereotype == "Server Page" &&
                    (e.relKind == "link" || e.relKind == "asociacion"))
                {
                    linkedFromCtrl++;
                }
                if (oth.col == 2) touchesCol2 = true;
                if (oth.col == 5) touchesCol5 = true;
            }
            if (linkedFromCtrl > 0 || (!touchesCol2 && touchesCol5))
            {
                nodes[i].col = 5;
            }
            else
            {
                nodes[i].col = 4;
            }
        }
    }

    // 4. Agrupar Bandas Funcionales alrededor de cada Controlador de Col 4
    var controllers = [];
    var ctrlIndex = {};
    for (i = 0; i < N; i++)
    {
        if (nodes[i].col == 4)
        {
            ctrlIndex[i] = controllers.length;
            controllers.push({
                ctrlId: i,
                col2: [],
                col3: [],
                tier: 1
            });
        }
    }
    if (controllers.length == 0)
    {
        controllers.push({ ctrlId: -1, col2: [], col3: [], tier: 0 });
    }

    var pageBand = {};
    for (i = 0; i < N; i++)
    {
        if (nodes[i].col != 2) continue;

        var scores = {};
        for (j = 0; j < adjAll[i].length; j++)
        {
            e = adjAll[i][j];
            var o = (e.src.id == i) ? e.dst : e.src;
            if (o.col == 4)
            {
                var wDirect = (e.relKind == "link" || e.relKind == "build") ? 12 : 3;
                scores[o.id] = (scores[o.id] != null ? scores[o.id] : 0) + wDirect;
            }
        }
        for (var fk = 0; fk < formsOf[i].length; fk++)
        {
            var fid = formsOf[i][fk];
            for (j = 0; j < adjAll[fid].length; j++)
            {
                e = adjAll[fid][j];
                var oc = (e.src.id == fid) ? e.dst : e.src;
                if (oc.col == 4)
                {
                    scores[oc.id] = (scores[oc.id] != null ? scores[oc.id] : 0) + 5;
                }
            }
        }

        var bestCtrl = controllers[0].ctrlId;
        var bestSc = -1;
        for (var cid in scores)
        {
            if (!scores.hasOwnProperty(cid)) continue;
            if (scores[cid] > bestSc)
            {
                bestSc = scores[cid];
                bestCtrl = parseInt(cid, 10);
            }
        }
        var bIdx = (ctrlIndex[bestCtrl] != null) ? ctrlIndex[bestCtrl] : 0;
        pageBand[i] = bIdx;
        controllers[bIdx].col2.push(i);
    }

    // Asignar cada formulario de Col 3 a su banda óptima
    for (i = 0; i < N; i++)
    {
        if (nodes[i].col != 3) continue;

        var compOwners = [];
        var targetCtrls = {};
        for (j = 0; j < adjAll[i].length; j++)
        {
            e = adjAll[i][j];
            if (e.relKind == "composicion" && e.dst.id == i)
            {
                compOwners.push(e.src.id);
            }
            var ot = (e.src.id == i) ? e.dst : e.src;
            if (ot.col == 4)
            {
                targetCtrls[ot.id] = (targetCtrls[ot.id] != null ? targetCtrls[ot.id] : 0) + 5;
            }
        }

        var chosenBand = 0;
        if (compOwners.length == 1 && pageBand[compOwners[0]] != null)
        {
            chosenBand = pageBand[compOwners[0]];
            if (formsOf[compOwners[0]].length >= 3)
            {
                var bestTC = -1;
                var bestTCSc = -1;
                for (var tc in targetCtrls)
                {
                    if (!targetCtrls.hasOwnProperty(tc)) continue;
                    if (targetCtrls[tc] > bestTCSc)
                    {
                        bestTCSc = targetCtrls[tc];
                        bestTC = parseInt(tc, 10);
                    }
                }
                if (bestTC != -1 && ctrlIndex[bestTC] != null && ctrlIndex[bestTC] != chosenBand)
                {
                    chosenBand = ctrlIndex[bestTC];
                }
            }
        }
        else
        {
            var bTC = -1;
            var bSc = -1;
            for (var tc2 in targetCtrls)
            {
                if (!targetCtrls.hasOwnProperty(tc2)) continue;
                if (targetCtrls[tc2] > bSc)
                {
                    bSc = targetCtrls[tc2];
                    bTC = parseInt(tc2, 10);
                }
            }
            if (bTC != -1 && ctrlIndex[bTC] != null)
            {
                chosenBand = ctrlIndex[bTC];
            }
            else if (compOwners.length > 0 && pageBand[compOwners[0]] != null)
            {
                chosenBand = pageBand[compOwners[0]];
            }
        }
        controllers[chosenBand].col3.push(i);
    }

    var nodeBand = {};
    var B = controllers.length;
    var b;
    for (b = 0; b < B; b++)
    {
        if (controllers[b].ctrlId != -1) nodeBand[controllers[b].ctrlId] = b;
        for (j = 0; j < controllers[b].col2.length; j++) nodeBand[controllers[b].col2[j]] = b;
        for (j = 0; j < controllers[b].col3.length; j++) nodeBand[controllers[b].col3[j]] = b;
    }

    // 5. Ordenar verticalmente las bandas minimizando distancia cuadrática de conexiones
    var entryHubs = {};
    var secondaryHubs = {};
    for (i = 0; i < N; i++)
    {
        if (isHub[i])
        {
            if (inFromActor[i]) entryHubs[i] = true;
            else secondaryHubs[i] = true;
        }
    }

    for (b = 0; b < B; b++)
    {
        var touchEntry = 0;
        var members = [];
        if (controllers[b].ctrlId != -1) members.push(controllers[b].ctrlId);
        members = members.concat(controllers[b].col2, controllers[b].col3);
        for (i = 0; i < members.length; i++)
        {
            var mid = members[i];
            for (j = 0; j < adjAll[mid].length; j++)
            {
                var oh = (adjAll[mid][j].src.id == mid) ? adjAll[mid][j].dst.id : adjAll[mid][j].src.id;
                if (entryHubs[oh] || (hubAttachment[oh] != null && entryHubs[hubAttachment[oh]]))
                {
                    touchEntry++;
                }
            }
        }
        controllers[b].tier = (touchEntry > 0) ? 0 : 1;
    }

    var bandW = [];
    for (i = 0; i < B; i++)
    {
        bandW[i] = [];
        for (j = 0; j < B; j++) bandW[i][j] = 0;
    }
    for (i = 0; i < edges.length; i++)
    {
        e = edges[i];
        var b1 = nodeBand[e.src.id];
        var b2 = nodeBand[e.dst.id];
        if (b1 != null && b2 != null && b1 != b2)
        {
            var wRel = (e.relKind == "composicion") ? 22 : 14;
            bandW[b1][b2] += wRel;
            bandW[b2][b1] += wRel;
        }
    }
    for (i = 0; i < N; i++)
    {
        if (nodes[i].col == 5)
        {
            var bTouch = [];
            for (j = 0; j < adjAll[i].length; j++)
            {
                var nb = nodeBand[(adjAll[i][j].src.id == i) ? adjAll[i][j].dst.id : adjAll[i][j].src.id];
                if (nb != null) bTouch.push(nb);
            }
            for (var p1 = 0; p1 < bTouch.length; p1++)
            {
                for (var p2 = p1 + 1; p2 < bTouch.length; p2++)
                {
                    if (bTouch[p1] != bTouch[p2])
                    {
                        bandW[bTouch[p1]][bTouch[p2]] += 6;
                        bandW[bTouch[p2]][bTouch[p1]] += 6;
                    }
                }
            }
        }
    }

    var order = [];
    for (b = 0; b < B; b++) if (controllers[b].tier == 0) order.push(b);
    for (b = 0; b < B; b++) if (controllers[b].tier != 0) order.push(b);

    function evaluarCostoOrden(ord)
    {
        var pos = {};
        var k, a, c2;
        var cost = 0;
        for (k = 0; k < ord.length; k++) pos[ord[k]] = k;
        for (a = 0; a < B; a++)
        {
            for (c2 = a + 1; c2 < B; c2++)
            {
                if (bandW[a][c2] > 0)
                {
                    var dist = Math.abs(pos[a] - pos[c2]);
                    cost += bandW[a][c2] * dist * dist;
                }
            }
        }
        for (k = 0; k < ord.length; k++)
        {
            if (controllers[ord[k]].tier == 0) cost += k * 35;
        }
        return cost;
    }

    var improved = true;
    var bestCost = evaluarCostoOrden(order);
    while (improved)
    {
        improved = false;
        for (i = 0; i < B; i++)
        {
            for (j = 0; j < B; j++)
            {
                if (i == j) continue;
                var cand = order.slice(0);
                var moved = cand.splice(i, 1)[0];
                cand.splice(j, 0, moved);
                var cCost = evaluarCostoOrden(cand);
                if (cCost < bestCost)
                {
                    bestCost = cCost;
                    order = cand;
                    improved = true;
                }
            }
        }
        for (i = 0; i < B; i++)
        {
            for (j = i + 1; j < B; j++)
            {
                var cand2 = order.slice(0);
                var tmp = cand2[i];
                cand2[i] = cand2[j];
                cand2[j] = tmp;
                var cCost2 = evaluarCostoOrden(cand2);
                if (cCost2 < bestCost)
                {
                    bestCost = cCost2;
                    order = cand2;
                    improved = true;
                }
            }
        }
    }

    var orderedBands = [];
    var rank;
    for (rank = 0; rank < B; rank++)
    {
        var origB = order[rank];
        orderedBands.push(controllers[origB]);
        if (controllers[origB].ctrlId != -1) nodeBand[controllers[origB].ctrlId] = rank;
        for (j = 0; j < controllers[origB].col2.length; j++) nodeBand[controllers[origB].col2[j]] = rank;
        for (j = 0; j < controllers[origB].col3.length; j++) nodeBand[controllers[origB].col3[j]] = rank;
    }

    // Ordenar internamente Col 2 y Col 3 dentro de cada banda según baricentro vecino
    for (rank = 0; rank < B; rank++)
    {
        var bnd = orderedBands[rank];
        (function(rCur) {
            bnd.col2.sort(function(u, v) {
                return baricentroVecinos(u, rCur, adjAll, nodeBand, secondaryHubs) -
                       baricentroVecinos(v, rCur, adjAll, nodeBand, secondaryHubs);
            });
            var c2Idx = {};
            for (var m = 0; m < bnd.col2.length; m++) c2Idx[bnd.col2[m]] = m;
            bnd.col3.sort(function(u, v) {
                var ou = (compOwner[u] != null && c2Idx[compOwner[u]] != null) ? c2Idx[compOwner[u]] : 0.5;
                var ov = (compOwner[v] != null && c2Idx[compOwner[v]] != null) ? c2Idx[compOwner[v]] : 0.5;
                if (ou != ov) return ou - ov;
                return baricentroVecinos(u, rCur, adjAll, nodeBand, secondaryHubs) -
                       baricentroVecinos(v, rCur, adjAll, nodeBand, secondaryHubs);
            });
        })(rank);
    }

    // 6. Modo Doble Bloque Horizontal (Word Carta ~1.4:1) vs Bloque Único
    var useDualWing = MODO_HORIZONTAL_CARTA && (B >= 5);
    var numCols = useDualWing ? 9 : 6;
    var splitRank = B;

    if (useDualWing)
    {
        // Convertir nodos downstream de Col 5 (StripeAPI, 3DS, PagoQR, QrController) en sub-bandas compactas
        // e insertarlas justo debajo de los controladores de pago con los que se conectan
        var col5Srvs = [];
        var col5Views = [];
        var usedView5 = {};
        for (i = 0; i < N; i++)
        {
            if (nodes[i].col == 5)
            {
                if (nodes[i].stereotype == "Server Page") col5Srvs.push(i);
                else col5Views.push(i);
            }
        }

        var auxBands = [];
        for (i = 0; i < col5Srvs.length; i++)
        {
            var s5Id = col5Srvs[i];
            var pairedViews = [];
            for (j = 0; j < adjAll[s5Id].length; j++)
            {
                var oth5 = (adjAll[s5Id][j].src.id == s5Id) ? adjAll[s5Id][j].dst : adjAll[s5Id][j].src;
                if (oth5.col == 5 && oth5.stereotype != "Server Page" && !usedView5[oth5.id])
                {
                    usedView5[oth5.id] = true;
                    pairedViews.push(oth5.id);
                }
            }
            auxBands.push({ ctrlId: s5Id, col2: [], col3: pairedViews, tier: 1, isAux5: true });
        }
        for (i = 0; i < col5Views.length; i++)
        {
            if (!usedView5[col5Views[i]])
            {
                auxBands.push({ ctrlId: -1, col2: [], col3: [col5Views[i]], tier: 1, isAux5: true });
            }
        }

        // Insertar sub-bandas auxiliares justo después del último controlador conectado a ellas
        if (auxBands.length > 0)
        {
            var maxConnRank = B - 1;
            var bestAnchor = -1;
            for (i = 0; i < auxBands.length; i++)
            {
                var ab = auxBands[i];
                var abMembers = (ab.ctrlId != -1) ? [ab.ctrlId].concat(ab.col3) : ab.col3.slice(0);
                for (var am = 0; am < abMembers.length; am++)
                {
                    var m5 = abMembers[am];
                    for (j = 0; j < adjAll[m5].length; j++)
                    {
                        var nb5 = (adjAll[m5][j].src.id == m5) ? adjAll[m5][j].dst.id : adjAll[m5][j].src.id;
                        if (nodeBand[nb5] != null && nodeBand[nb5] > bestAnchor)
                        {
                            bestAnchor = nodeBand[nb5];
                        }
                    }
                }
            }
            if (bestAnchor >= 0) maxConnRank = bestAnchor;

            var mergedBands = [];
            for (rank = 0; rank < B; rank++)
            {
                mergedBands.push(orderedBands[rank]);
                if (rank == maxConnRank)
                {
                    for (i = 0; i < auxBands.length; i++) mergedBands.push(auxBands[i]);
                }
            }
            orderedBands = mergedBands;
            B = orderedBands.length;
            nodeBand = {};
            for (rank = 0; rank < B; rank++)
            {
                if (orderedBands[rank].ctrlId != -1) nodeBand[orderedBands[rank].ctrlId] = rank;
                for (j = 0; j < orderedBands[rank].col2.length; j++) nodeBand[orderedBands[rank].col2[j]] = rank;
                for (j = 0; j < orderedBands[rank].col3.length; j++) nodeBand[orderedBands[rank].col3[j]] = rank;
            }

            // Reordenar internamente Col 2 y Col 3 ahora que StripeAPI / PagoQR ya tienen banda asignada
            // (evita cruces como frmTarjetaStripe vs frmCuentaTransferencia)
            for (rank = 0; rank < B; rank++)
            {
                var bnd2 = orderedBands[rank];
                (function(rCur2) {
                    bnd2.col2.sort(function(u, v) {
                        return baricentroVecinos(u, rCur2, adjAll, nodeBand, secondaryHubs) -
                               baricentroVecinos(v, rCur2, adjAll, nodeBand, secondaryHubs);
                    });
                    var c2Idx2 = {};
                    for (var m2 = 0; m2 < bnd2.col2.length; m2++) c2Idx2[bnd2.col2[m2]] = m2;
                    bnd2.col3.sort(function(u, v) {
                        var ou = (compOwner[u] != null && c2Idx2[compOwner[u]] != null) ? c2Idx2[compOwner[u]] : 0.5;
                        var ov = (compOwner[v] != null && c2Idx2[compOwner[v]] != null) ? c2Idx2[compOwner[v]] : 0.5;
                        if (ou != ov) return ou - ov;
                        return baricentroVecinos(u, rCur2, adjAll, nodeBand, secondaryHubs) -
                               baricentroVecinos(v, rCur2, adjAll, nodeBand, secondaryHubs);
                    });
                })(rank);
            }
        }

        // Balancear alturas reales de Bloque Izquierdo vs Bloque Derecho:
        // Si al final del Bloque Derecho quedan módulos autónomos sin aristas hacia otras bandas (ej. MisEntregas),
        // pasarlos al pie del Bloque Izquierdo cuando eso reduzca la altura máxima del diagrama!
        var estBandH = [];
        for (rank = 0; rank < B; rank++)
        {
            var eb = orderedBands[rank];
            var h2 = 0;
            var h3 = 0;
            var h4 = (eb.ctrlId != -1) ? nodes[eb.ctrlId].h : 0;
            for (j = 0; j < eb.col2.length; j++) h2 += nodes[eb.col2[j]].h + (j > 0 ? LAYOUT_CFG.intraColGap : 0);
            for (j = 0; j < eb.col3.length; j++) h3 += nodes[eb.col3[j]].h + (j > 0 ? LAYOUT_CFG.intraColGap : 0);
            estBandH.push(Math.max(h2, Math.max(h3, h4)) + LAYOUT_CFG.bandGap);
        }

        var bestSplitScore = 1e15;
        splitRank = Math.floor(B / 2);
        for (var sr = 2; sr <= B - 2; sr++)
        {
            var leftH = 0;
            var rightH = 0;
            for (i = 0; i < sr; i++) leftH += estBandH[i];
            for (i = sr; i < B; i++) rightH += estBandH[i];

            var cutPenalty = 0;
            for (i = 0; i < edges.length; i++)
            {
                e = edges[i];
                var rb1 = nodeBand[e.src.id];
                var rb2 = nodeBand[e.dst.id];
                if (rb1 != null && rb2 != null)
                {
                    if ((rb1 < sr && rb2 >= sr) || (rb2 < sr && rb1 >= sr))
                    {
                        cutPenalty += (e.relKind == "composicion") ? 600 : 85;
                    }
                }
            }
            var tierBonus = (orderedBands[sr - 1].tier == 0 && orderedBands[sr].tier != 0) ? -140 : 0;
            var score = Math.max(leftH, rightH) + Math.abs(leftH - rightH) * 0.35 + cutPenalty + tierBonus;
            if (score < bestSplitScore)
            {
                bestSplitScore = score;
                splitRank = sr;
            }
        }

        // Si el Bloque Derecho quedó más alto que el Izquierdo por >= 220px, mover módulos autónomos finales al pie del Bloque Izquierdo
        var sumL = 0;
        var sumR = 0;
        for (i = 0; i < splitRank; i++) sumL += estBandH[i];
        for (i = splitRank; i < B; i++) sumR += estBandH[i];

        for (rank = B - 1; rank >= splitRank + 1; rank--)
        {
            if ((sumR - sumL) < 220) break;
            var candB = orderedBands[rank];
            if (candB.isAux5) continue;

            // Verificar cuántas aristas tiene candB hacia otras bandas (excluyendo Hubs de Col 1/5)
            var interEdges = 0;
            var cMembers = (candB.ctrlId != -1) ? [candB.ctrlId].concat(candB.col2, candB.col3) : candB.col2.concat(candB.col3);
            for (var cm = 0; cm < cMembers.length; cm++)
            {
                var cmId = cMembers[cm];
                for (j = 0; j < adjAll[cmId].length; j++)
                {
                    var oId = (adjAll[cmId][j].src.id == cmId) ? adjAll[cmId][j].dst.id : adjAll[cmId][j].src.id;
                    if (nodeBand[oId] != null && nodeBand[oId] != rank) interEdges++;
                }
            }
            if (interEdges == 0)
            {
                var movedBand = orderedBands.splice(rank, 1)[0];
                var movedH = estBandH.splice(rank, 1)[0];
                orderedBands.splice(splitRank, 0, movedBand);
                estBandH.splice(splitRank, 0, movedH);
                splitRank++;
                sumL += movedH;
                sumR -= movedH;
            }
        }

        nodeBand = {};
        for (rank = 0; rank < B; rank++)
        {
            if (orderedBands[rank].ctrlId != -1) nodeBand[orderedBands[rank].ctrlId] = rank;
            for (j = 0; j < orderedBands[rank].col2.length; j++) nodeBand[orderedBands[rank].col2[j]] = rank;
            for (j = 0; j < orderedBands[rank].col3.length; j++) nodeBand[orderedBands[rank].col3[j]] = rank;
        }

        // Reasignar columnas del Bloque Derecho (Cols 5..8)
        var hasSecondaryHub = false;
        for (i = 0; i < N; i++)
        {
            if (isHub[i] && !inFromActor[i])
            {
                nodes[i].col = 5;
                hasSecondaryHub = true;
            }
        }
        for (i = 0; i < N; i++)
        {
            if (hubAttachment[i] != null && nodes[hubAttachment[i]].col == 5)
            {
                nodes[i].col = 5;
            }
        }
        for (rank = splitRank; rank < B; rank++)
        {
            var rb = orderedBands[rank];
            for (j = 0; j < rb.col2.length; j++) nodes[rb.col2[j]].col = 6;
            for (j = 0; j < rb.col3.length; j++) nodes[rb.col3[j]].col = 7;
            if (rb.ctrlId != -1) nodes[rb.ctrlId].col = 8;
        }
    }

    // Calcular coordenadas X por columna
    var colMaxW = useDualWing
        ? [80, 230, 230, 236, 256, 0, 236, 236, 260]
        : [90, 240, 240, 240, 260, 240];

    for (i = 0; i < N; i++)
    {
        if (nodes[i].w > colMaxW[nodes[i].col])
        {
            colMaxW[nodes[i].col] = nodes[i].w;
        }
    }

    var gutters = useDualWing ? LAYOUT_CFG.dualGutterWidths : LAYOUT_CFG.gutterWidths;
    var colX = [LAYOUT_CFG.marginX];
    for (var c = 1; c < numCols; c++)
    {
        if (colMaxW[c - 1] == 0)
        {
            colX[c] = colX[c - 1];
        }
        else
        {
            colX[c] = colX[c - 1] + colMaxW[c - 1] + gutters[c - 1];
        }
    }
    for (i = 0; i < N; i++)
    {
        nodes[i].x = colX[nodes[i].col];
    }

    // 7. Compactación Skyline independiente por Bloque (Izquierdo: 0..splitRank-1, Derecho: splitRank..B-1)
    var bandBounds = [];
    function apilarRangoBandas(rStart, rEnd)
    {
        var sky2 = LAYOUT_CFG.marginY - LAYOUT_CFG.bandGap;
        var sky3 = LAYOUT_CFG.marginY - LAYOUT_CFG.bandGap;
        var sky4 = LAYOUT_CFG.marginY - LAYOUT_CFG.bandGap;
        var r, m;

        for (r = rStart; r < rEnd; r++)
        {
            var ob = orderedBands[r];
            var relY2 = {};
            var acc2 = 0;
            for (m = 0; m < ob.col2.length; m++)
            {
                relY2[ob.col2[m]] = acc2;
                acc2 += nodes[ob.col2[m]].h + LAYOUT_CFG.intraColGap;
            }

            var topPageConnectsCtrl = false;
            if (ob.col3.length > 0 && ob.ctrlId != -1 && ob.col2.length > 0)
            {
                var topC2 = ob.col2[0];
                for (m = 0; m < edges.length; m++)
                {
                    var ed = edges[m];
                    if ((ed.src.id == ob.ctrlId && ed.dst.id == topC2) || (ed.dst.id == ob.ctrlId && ed.src.id == topC2))
                    {
                        topPageConnectsCtrl = true;
                        break;
                    }
                }
            }

            var relStart3 = topPageConnectsCtrl ? 42 : 0;
            if (ob.col3.length > 0)
            {
                var firstOwner = compOwner[ob.col3[0]];
                if (firstOwner != null && nodeBand[firstOwner] == r && relY2[firstOwner] != null && relY2[firstOwner] > relStart3)
                {
                    relStart3 = relY2[firstOwner];
                }
            }

            var reqStart = LAYOUT_CFG.marginY;
            if (ob.col2.length > 0 && (sky2 + LAYOUT_CFG.bandGap) > reqStart)
            {
                reqStart = sky2 + LAYOUT_CFG.bandGap;
            }
            if (ob.ctrlId != -1 && (sky4 + LAYOUT_CFG.bandGap) > reqStart)
            {
                reqStart = sky4 + LAYOUT_CFG.bandGap;
            }
            if (ob.col3.length > 0 && (sky3 + LAYOUT_CFG.bandGap - relStart3) > reqStart)
            {
                reqStart = sky3 + LAYOUT_CFG.bandGap - relStart3;
            }
            // Si la primera vista de Col 2 habla directo con su controlador en Col 4, no dejar que un form
            // largo de la banda anterior (sky3) cuelgue en medio y bloquee su línea recta horizontal!
            if (ob.col2.length > 0 && ob.ctrlId != -1 && (sky3 + 18) > reqStart)
            {
                for (m = 0; m < edges.length; m++)
                {
                    var edDirect = edges[m];
                    if ((edDirect.src.id == ob.ctrlId && edDirect.dst.id == ob.col2[0]) ||
                        (edDirect.dst.id == ob.ctrlId && edDirect.src.id == ob.col2[0]))
                    {
                        reqStart = sky3 + 18;
                        break;
                    }
                }
            }

            var curY = reqStart;
            var y2 = curY;
            for (m = 0; m < ob.col2.length; m++)
            {
                var n2 = nodes[ob.col2[m]];
                n2.y = y2;
                y2 += n2.h + LAYOUT_CFG.intraColGap;
            }
            if (ob.col2.length > 0)
            {
                y2 -= LAYOUT_CFG.intraColGap;
                if (y2 > sky2) sky2 = y2;
            }

            var y3 = curY + relStart3;
            for (m = 0; m < ob.col3.length; m++)
            {
                var n3 = nodes[ob.col3[m]];
                n3.y = y3;
                y3 += n3.h + LAYOUT_CFG.intraColGap;
            }
            if (ob.col3.length > 0)
            {
                y3 -= LAYOUT_CFG.intraColGap;
                if (y3 > sky3) sky3 = y3;
            }

            var y4 = curY;
            if (ob.ctrlId != -1)
            {
                var n4 = nodes[ob.ctrlId];
                var spanBot = Math.max(ob.col2.length > 0 ? y2 : curY, ob.col3.length > 0 ? y3 : curY);
                if (!topPageConnectsCtrl && (spanBot - curY) > (n4.h + 30))
                {
                    n4.y = Math.round(curY + (spanBot - curY - n4.h) / 2);
                    if (n4.y < (sky4 + LAYOUT_CFG.bandGap)) n4.y = sky4 + LAYOUT_CFG.bandGap;
                }
                else
                {
                    n4.y = curY;
                }
                y4 = n4.y + n4.h;
                if (y4 > sky4) sky4 = y4;
            }

            var bandBot = Math.max(y2, Math.max(y3, y4));
            bandBounds.push({ top: curY, bottom: bandBot });
        }
    }

    if (useDualWing)
    {
        apilarRangoBandas(0, splitRank);
        apilarRangoBandas(splitRank, B);
    }
    else
    {
        apilarRangoBandas(0, B);
    }

    // 8. Posicionar Col 5 solo cuando está en modo Bloque Único (en Doble Bloque ya fueron integradas en Cols 7 y 8)
    if (!useDualWing)
    {
        var col5Nodes = [];
        for (i = 0; i < N; i++)
        {
            if (nodes[i].col == 5) col5Nodes.push(nodes[i]);
        }
        var desiredY5 = {};
        for (var pass5 = 0; pass5 < 4; pass5++)
        {
            for (i = 0; i < col5Nodes.length; i++)
            {
                var n5 = col5Nodes[i];
                var sumY = 0;
                var cntY = 0;
                for (j = 0; j < adjAll[n5.id].length; j++)
                {
                    var nbNode = (adjAll[n5.id][j].src.id == n5.id) ? adjAll[n5.id][j].dst : adjAll[n5.id][j].src;
                    if (nbNode.col < 5)
                    {
                        sumY += 2 * (nbNode.y + nbNode.h / 2);
                        cntY += 2;
                    }
                    else if (desiredY5[nbNode.id] != null)
                    {
                        sumY += (desiredY5[nbNode.id] + nbNode.h / 2 + 80);
                        cntY += 1;
                    }
                }
                desiredY5[n5.id] = (cntY > 0) ? (sumY / cntY - n5.h / 2) : LAYOUT_CFG.marginY;
            }
        }
        col5Nodes.sort(function(a, b) { return desiredY5[a.id] - desiredY5[b.id]; });

        var prevBot5 = LAYOUT_CFG.marginY;
        for (i = 0; i < col5Nodes.length; i++)
        {
            var targetY5 = Math.max(prevBot5, Math.round(desiredY5[col5Nodes[i].id]));
            col5Nodes[i].y = targetY5;
            prevBot5 = targetY5 + col5Nodes[i].h + 28;
        }
    }

    // 9. Posicionar Hubs (Col 1 en Bloque Izquierdo, Col 5 en Bloque Derecho) frente a las vistas de su propio bloque
    var hubColsList = useDualWing ? [1, 5] : [1];
    for (var hcIdx = 0; hcIdx < hubColsList.length; hcIdx++)
    {
        var hCol = hubColsList[hcIdx];
        var hubGroups = [];
        for (i = 0; i < N; i++)
        {
            if (isHub[i] && nodes[i].col == hCol)
            {
                var above = [];
                var below = [];
                for (j = 0; j < N; j++)
                {
                    if (hubAttachment[j] == i)
                    {
                        if (nodes[j].stereotype == "Server Page") above.push(nodes[j]);
                        else below.push(nodes[j]);
                    }
                }
                var sy = 0;
                var cy = 0;
                for (j = 0; j < adjAll[i].length; j++)
                {
                    var oNode = (adjAll[i][j].src.id == i) ? adjAll[i][j].dst : adjAll[i][j].src;
                    var sameWing = (!useDualWing && oNode.col >= 2) ||
                                   (useDualWing && hCol == 1 && oNode.col >= 2 && oNode.col <= 4) ||
                                   (useDualWing && hCol == 5 && oNode.col >= 6 && oNode.col <= 8);
                    if (sameWing)
                    {
                        sy += oNode.y + oNode.h / 2;
                        cy++;
                    }
                }
                var hubCenterY = (cy > 0) ? (sy / cy) : 500;
                hubGroups.push({
                    hub: nodes[i],
                    above: above,
                    below: below,
                    targetCenterY: hubCenterY,
                    isEntry: inFromActor[i]
                });
            }
        }
        hubGroups.sort(function(a, b) {
            if (a.isEntry != b.isEntry) return a.isEntry ? -1 : 1;
            return a.targetCenterY - b.targetCenterY;
        });

        var prevBotH = LAYOUT_CFG.marginY;
        for (i = 0; i < hubGroups.length; i++)
        {
            var hg = hubGroups[i];
            var aboveH = 0;
            for (j = 0; j < hg.above.length; j++) aboveH += hg.above[j].h + 32;
            var idealHubTop = Math.round(hg.targetCenterY - hg.hub.h / 2);
            var groupStart = Math.max(prevBotH, idealHubTop - aboveH);
            var yCursor = groupStart;

            for (j = 0; j < hg.above.length; j++)
            {
                hg.above[j].y = yCursor;
                yCursor += hg.above[j].h + 32;
            }
            hg.hub.y = yCursor;
            yCursor += hg.hub.h + 32;
            for (j = 0; j < hg.below.length; j++)
            {
                hg.below[j].y = yCursor;
                yCursor += hg.below[j].h + 32;
            }
            prevBotH = yCursor + LAYOUT_CFG.bandGap;
        }
    }

    // 10. Posicionar Col 0 (Actores centrados frente a su Hub de inicio)
    var prevBot0 = LAYOUT_CFG.marginY;
    for (i = 0; i < N; i++)
    {
        if (nodes[i].col == 0)
        {
            var actTargetY = 300;
            for (j = 0; j < adjAll[i].length; j++)
            {
                var oh2 = (adjAll[i][j].src.id == i) ? adjAll[i][j].dst : adjAll[i][j].src;
                actTargetY = oh2.y + oh2.h / 2 - nodes[i].h / 2;
                break;
            }
            nodes[i].y = Math.max(prevBot0, Math.round(actTargetY));
            prevBot0 = nodes[i].y + nodes[i].h + 80;
        }
    }

    return {
        colX: colX,
        colMaxW: colMaxW,
        bandBounds: bandBounds,
        numCols: numCols
    };
}

function baricentroVecinos(nodeId, curRank, adjAll, nodeBand, secondaryHubs)
{
    var sum = 0;
    var cnt = 0;
    for (var i = 0; i < adjAll[nodeId].length; i++)
    {
        var e = adjAll[nodeId][i];
        var oth = (e.src.id == nodeId) ? e.dst.id : e.src.id;
        if (nodeBand[oth] != null && nodeBand[oth] != curRank)
        {
            sum += nodeBand[oth];
            cnt++;
        }
        else if (secondaryHubs[oth])
        {
            sum += curRank + 0.3;
            cnt += 0.3;
        }
    }
    return (cnt > 0) ? (sum / cnt) : curRank;
}

/* ============================================================
   MOTOR DE PUERTOS Y RUTEO ORTOGONAL MULTICARRIL (DIJKSTRA)
   Lados EA: 1 = Top, 2 = Right, 3 = Bottom, 4 = Left
   ============================================================ */

function resolverPosicionesPuertos(items, minCoord, maxCoord, minSep)
{
    var k = items.length;
    if (k == 0) return;

    var span = maxCoord - minCoord;
    var sep = minSep;
    if ((k - 1) * sep > span)
    {
        sep = span / Math.max(1, k - 1);
    }

    var pos = [];
    var i;
    for (i = 0; i < k; i++)
    {
        var d = items[i].ideal;
        if (d < minCoord) d = minCoord;
        if (d > maxCoord) d = maxCoord;
        pos.push(d);
    }

    for (var iter = 0; iter < 3; iter++)
    {
        for (i = 1; i < k; i++)
        {
            if (pos[i] < pos[i - 1] + sep) pos[i] = pos[i - 1] + sep;
        }
        if (pos[k - 1] > maxCoord) pos[k - 1] = maxCoord;
        for (i = k - 2; i >= 0; i--)
        {
            if (pos[i] > pos[i + 1] - sep) pos[i] = pos[i + 1] - sep;
        }
        if (pos[0] < minCoord) pos[0] = minCoord;
    }

    for (i = 0; i < k; i++)
    {
        items[i].resolved = Math.round(pos[i]);
    }
}

function ventanaHorizontalLibre(s, d, nodes, pad)
{
    var yTop = Math.max(s.y + 14, d.y + 14);
    var yBot = Math.min(s.y + s.h - 14, d.y + d.h - 14);
    if (yBot < yTop) return null;

    var xLeft = Math.min(s.x + s.w, d.x + d.w);
    var xRight = Math.max(s.x, d.x);
    var intervals = [{ a: yTop, b: yBot }];

    for (var i = 0; i < nodes.length; i++)
    {
        var bx = nodes[i];
        if (bx.id == s.id || bx.id == d.id) continue;
        if ((bx.x + bx.w + pad) <= xLeft || (bx.x - pad) >= xRight) continue;

        var blkA = bx.y - pad;
        var blkB = bx.y + bx.h + pad;
        var next = [];
        for (var j = 0; j < intervals.length; j++)
        {
            var iv = intervals[j];
            if (blkB <= iv.a || blkA >= iv.b)
            {
                next.push(iv);
            }
            else
            {
                if (blkA > iv.a) next.push({ a: iv.a, b: blkA });
                if (blkB < iv.b) next.push({ a: blkB, b: iv.b });
            }
        }
        intervals = next;
        if (intervals.length == 0) return null;
    }

    var best = intervals[0];
    for (i = 1; i < intervals.length; i++)
    {
        if ((intervals[i].b - intervals[i].a) > (best.b - best.a))
        {
            best = intervals[i];
        }
    }
    return best;
}

function rutearConectoresOrtogonales(grafo, meta)
{
    var nodes = grafo.nodes;
    var edges = grafo.edges;
    var i, j, e;

    // 1. Elegir lados óptimos de salida y entrada
    for (i = 0; i < edges.length; i++)
    {
        e = edges[i];
        var s = e.src;
        var d = e.dst;
        if (s.col == d.col)
        {
            var minY = Math.min(s.y + s.h, d.y + d.h);
            var maxY = Math.max(s.y, d.y);
            var blockedVert = false;
            for (j = 0; j < nodes.length; j++)
            {
                var mid = nodes[j];
                if (mid.id == s.id || mid.id == d.id) continue;
                if (mid.col == s.col && mid.y < maxY && (mid.y + mid.h) > minY)
                {
                    blockedVert = true;
                    break;
                }
            }
            if (blockedVert)
            {
                var sideGut = (s.col == 1 || s.col == 2 || s.col == 5 || s.col == 6) ? 4 : 2;
                e.srcSide = sideGut;
                e.dstSide = sideGut;
            }
            else
            {
                var goingDown = (s.y + s.h / 2) < (d.y + d.h / 2);
                e.srcSide = goingDown ? 3 : 1;
                e.dstSide = goingDown ? 1 : 3;
            }
        }
        else if (s.x < d.x)
        {
            e.srcSide = 2;
            e.dstSide = 4;
        }
        else
        {
            e.srcSide = 4;
            e.dstSide = 2;
        }
    }

    // 2. Detectar pares ida/vuelta entre las mismas dos cajas
    var pairGroup = {};
    for (i = 0; i < edges.length; i++)
    {
        e = edges[i];
        var pKey = Math.min(e.src.id, e.dst.id) + "_" + Math.max(e.src.id, e.dst.id);
        if (pairGroup[pKey] == null) pairGroup[pKey] = [];
        pairGroup[pKey].push(e);
    }

    // 3. Asignar puertos ordenados y alineados a ventanas libres directas
    var sideSlots = {};
    for (i = 0; i < nodes.length; i++)
    {
        for (var sd = 1; sd <= 4; sd++)
        {
            sideSlots[i + "_" + sd] = [];
        }
    }

    var pSpace = LAYOUT_CFG.pairSpacing;
    for (i = 0; i < edges.length; i++)
    {
        e = edges[i];
        var grp = pairGroup[Math.min(e.src.id, e.dst.id) + "_" + Math.max(e.src.id, e.dst.id)];
        var pairIdx = 0;
        if (grp.length > 1)
        {
            for (j = 0; j < grp.length; j++)
            {
                if (grp[j].id == e.id) pairIdx = j - (grp.length - 1) / 2;
            }
        }

        var sIdeal, dIdeal, sortSrc, sortDst;
        if ((e.srcSide == 2 && e.dstSide == 4) || (e.srcSide == 4 && e.dstSide == 2))
        {
            var win = ventanaHorizontalLibre(e.src, e.dst, nodes, LAYOUT_CFG.boxPad);
            if (win != null && (win.b - win.a) >= (grp.length - 1) * pSpace)
            {
                var midWin = (win.a + win.b) / 2 + pairIdx * pSpace;
                sIdeal = midWin;
                dIdeal = midWin;
                sortSrc = midWin;
                sortDst = midWin;
            }
            else
            {
                sIdeal = (e.dst.y + e.dst.h / 2) + pairIdx * pSpace;
                dIdeal = (e.src.y + e.src.h / 2) + pairIdx * pSpace;
                sortSrc = (e.dst.y + e.dst.h / 2) + pairIdx * 2;
                sortDst = (e.src.y + e.src.h / 2) + pairIdx * 2;
            }
        }
        else if (e.srcSide == 2 || e.srcSide == 4)
        {
            sIdeal = (e.dst.y + e.dst.h / 2) + pairIdx * pSpace;
            dIdeal = (e.src.y + e.src.h / 2) + pairIdx * pSpace;
            sortSrc = sIdeal;
            sortDst = dIdeal;
        }
        else
        {
            var sharedX = ((e.src.x + e.src.w / 2) + (e.dst.x + e.dst.w / 2)) / 2 + pairIdx * pSpace;
            sIdeal = sharedX;
            dIdeal = sharedX;
            sortSrc = sharedX;
            sortDst = sharedX;
        }

        sideSlots[e.src.id + "_" + e.srcSide].push({ edge: e, isSrc: true, sortVal: sortSrc, ideal: sIdeal });
        sideSlots[e.dst.id + "_" + e.dstSide].push({ edge: e, isSrc: false, sortVal: sortDst, ideal: dIdeal });
    }

    for (var sk in sideSlots)
    {
        if (!sideSlots.hasOwnProperty(sk)) continue;
        var list = sideSlots[sk];
        if (list.length == 0) continue;

        list.sort(function(p, q) { return p.sortVal - q.sortVal; });
        var parts = sk.split("_");
        var nd = nodes[parseInt(parts[0], 10)];
        var side = parseInt(parts[1], 10);

        if (side == 2 || side == 4)
        {
            resolverPosicionesPuertos(list, nd.y + 13, nd.y + nd.h - 13, LAYOUT_CFG.portSpacing);
            var bx = (side == 2) ? (nd.x + nd.w) : nd.x;
            for (j = 0; j < list.length; j++)
            {
                if (list[j].isSrc) list[j].edge.srcPort = { x: bx, y: list[j].resolved };
                else list[j].edge.dstPort = { x: bx, y: list[j].resolved };
            }
        }
        else
        {
            resolverPosicionesPuertos(list, nd.x + 15, nd.x + nd.w - 15, LAYOUT_CFG.portSpacing + 2);
            var by = (side == 3) ? (nd.y + nd.h) : nd.y;
            for (j = 0; j < list.length; j++)
            {
                if (list[j].isSrc) list[j].edge.srcPort = { x: list[j].resolved, y: by };
                else list[j].edge.dstPort = { x: list[j].resolved, y: by };
            }
        }
    }

    // 4. Construir grilla ortogonal multicarril (pasillos verticales y huecos horizontales por columna)
    var xSet = {};
    var ySet = {};
    function addX(v) { xSet[Math.round(v)] = true; }
    function addY(v) { ySet[Math.round(v)] = true; }

    var pad = LAYOUT_CFG.boxPad;
    var ts = LAYOUT_CFG.trackSpacing;
    addX(14);
    addX(26);

    var maxRight = 0;
    var maxBottom = 0;
    for (i = 0; i < nodes.length; i++)
    {
        if ((nodes[i].x + nodes[i].w) > maxRight) maxRight = nodes[i].x + nodes[i].w;
        if ((nodes[i].y + nodes[i].h) > maxBottom) maxBottom = nodes[i].y + nodes[i].h;
    }

    for (var rx = maxRight + pad + 4; rx <= maxRight + 70; rx += ts) addX(rx);

    var nCols = (meta.numCols != null) ? meta.numCols : 6;
    for (var c = 0; c < nCols - 1; c++)
    {
        if (meta.colMaxW[c] == 0) continue;
        var gLeft = meta.colX[c] + meta.colMaxW[c] + pad + 3;
        var gRight = meta.colX[c + 1] - pad - 3;
        for (var gx = gLeft; gx <= gRight; gx += ts)
        {
            addX(gx);
        }
    }
    for (i = 0; i < nodes.length; i++)
    {
        addX(nodes[i].x - pad - 3);
        addX(nodes[i].x + nodes[i].w + pad + 3);
    }

    addY(14);
    addY(26);
    for (var by2 = maxBottom + pad + 4; by2 <= maxBottom + 70; by2 += ts) addY(by2);

    // Llenar con carriles horizontales todos los huecos verticales entre cajas apiladas de cada columna
    for (var colIdx = 0; colIdx < nCols; colIdx++)
    {
        var colBoxes = [];
        for (i = 0; i < nodes.length; i++)
        {
            if (nodes[i].col == colIdx) colBoxes.push(nodes[i]);
        }
        colBoxes.sort(function(a, b) { return a.y - b.y; });
        for (i = 0; i < colBoxes.length - 1; i++)
        {
            var rawTop = colBoxes[i].y + colBoxes[i].h;
            var rawBot = colBoxes[i + 1].y;
            if ((rawBot - rawTop) > (2 * pad))
            {
                addY(Math.round((rawTop + rawBot) / 2));
            }
            var gapTop = rawTop + pad + 2;
            var gapBot = rawBot - pad - 2;
            for (var gy = gapTop; gy <= gapBot; gy += ts)
            {
                addY(gy);
            }
        }
    }
    for (i = 0; i < nodes.length; i++)
    {
        addY(nodes[i].y - pad - 3);
        addY(nodes[i].y + nodes[i].h + pad + 3);
    }

    for (i = 0; i < edges.length; i++)
    {
        e = edges[i];
        if (e.srcSide == 2 || e.srcSide == 4) addY(e.srcPort.y);
        else addX(e.srcPort.x);
        if (e.dstSide == 2 || e.dstSide == 4) addY(e.dstPort.y);
        else addX(e.dstPort.x);
    }

    var xs = [];
    var ys = [];
    for (var xk in xSet)
    {
        if (xSet.hasOwnProperty(xk)) xs.push(parseInt(xk, 10));
    }
    for (var yk in ySet)
    {
        if (ySet.hasOwnProperty(yk)) ys.push(parseInt(yk, 10));
    }
    xs.sort(function(a, b) { return a - b; });
    ys.sort(function(a, b) { return a - b; });

    var xIdx = {};
    var yIdx = {};
    for (i = 0; i < xs.length; i++) xIdx[xs[i]] = i;
    for (i = 0; i < ys.length; i++) yIdx[ys[i]] = i;

    var NX = xs.length;
    var NY = ys.length;

    // Precalcular bloqueo de obstáculos (ninguna línea puede atravesar ninguna caja + pad)
    var vBlocked = new Array(NX * NY);
    var xi, yi;
    for (xi = 0; xi < NX; xi++)
    {
        var xv = xs[xi];
        for (yi = 0; yi < NY; yi++)
        {
            var yv = ys[yi];
            var blk = false;
            for (j = 0; j < nodes.length; j++)
            {
                var bnd = nodes[j];
                if (xv > (bnd.x - pad) && xv < (bnd.x + bnd.w + pad) &&
                    yv > (bnd.y - pad) && yv < (bnd.y + bnd.h + pad))
                {
                    blk = true;
                    break;
                }
            }
            vBlocked[xi * NY + yi] = blk;
        }
    }

    var hBlocked = new Array((NX - 1) * NY);
    for (xi = 0; xi < NX - 1; xi++)
    {
        var x1 = xs[xi];
        var x2 = xs[xi + 1];
        for (yi = 0; yi < NY; yi++)
        {
            var yh = ys[yi];
            var hblk = vBlocked[xi * NY + yi] || vBlocked[(xi + 1) * NY + yi];
            if (!hblk)
            {
                for (j = 0; j < nodes.length; j++)
                {
                    var bn = nodes[j];
                    if (yh > (bn.y - pad) && yh < (bn.y + bn.h + pad) &&
                        x2 > (bn.x - pad) && x1 < (bn.x + bn.w + pad))
                    {
                        hblk = true;
                        break;
                    }
                }
            }
            hBlocked[xi * NY + yi] = hblk;
        }
    }

    var vSegBlocked = new Array(NX * (NY - 1));
    for (xi = 0; xi < NX; xi++)
    {
        var xv2 = xs[xi];
        for (yi = 0; yi < NY - 1; yi++)
        {
            var y1 = ys[yi];
            var y2 = ys[yi + 1];
            var vblk = vBlocked[xi * NY + yi] || vBlocked[xi * NY + (yi + 1)];
            if (!vblk)
            {
                for (j = 0; j < nodes.length; j++)
                {
                    var bn2 = nodes[j];
                    if (xv2 > (bn2.x - pad) && xv2 < (bn2.x + bn2.w + pad) &&
                        y2 > (bn2.y - pad) && y1 < (bn2.y + bn2.h + pad))
                    {
                        vblk = true;
                        break;
                    }
                }
            }
            vSegBlocked[xi * (NY - 1) + yi] = vblk;
        }
    }

    var hUsed = new Array((NX - 1) * NY);
    var vUsed = new Array(NX * (NY - 1));
    var hPassVert = new Array(NX * NY);
    var vPassVert = new Array(NX * NY);
    var cornerVert = new Array(NX * NY);

    for (i = 0; i < hUsed.length; i++) hUsed[i] = 0;
    for (i = 0; i < vUsed.length; i++) vUsed[i] = 0;
    for (i = 0; i < NX * NY; i++)
    {
        hPassVert[i] = 0;
        vPassVert[i] = 0;
        cornerVert[i] = 0;
    }

    function nodoEntradaGrilla(port, side)
    {
        var xi0, yi0;
        if (side == 2)
        {
            yi0 = yIdx[port.y];
            for (xi0 = 0; xi0 < NX; xi0++)
            {
                if (xs[xi0] >= (port.x + pad) && !vBlocked[xi0 * NY + yi0])
                {
                    return { xi: xi0, yi: yi0, dir: 1 };
                }
            }
        }
        else if (side == 4)
        {
            yi0 = yIdx[port.y];
            for (xi0 = NX - 1; xi0 >= 0; xi0--)
            {
                if (xs[xi0] <= (port.x - pad) && !vBlocked[xi0 * NY + yi0])
                {
                    return { xi: xi0, yi: yi0, dir: 3 };
                }
            }
        }
        else if (side == 3)
        {
            xi0 = xIdx[port.x];
            for (yi0 = 0; yi0 < NY; yi0++)
            {
                if (ys[yi0] >= (port.y + pad) && !vBlocked[xi0 * NY + yi0])
                {
                    return { xi: xi0, yi: yi0, dir: 2 };
                }
            }
        }
        else
        {
            xi0 = xIdx[port.x];
            for (yi0 = NY - 1; yi0 >= 0; yi0--)
            {
                if (ys[yi0] <= (port.y - pad) && !vBlocked[xi0 * NY + yi0])
                {
                    return { xi: xi0, yi: yi0, dir: 0 };
                }
            }
        }
        return null;
    }

    // Reservar de antemano las salidas inmediatas (stubs) de todos los puertos para que ningún cable ajeno pase pegado a ellos
    for (i = 0; i < edges.length; i++)
    {
        var ep = edges[i];
        var preS = nodoEntradaGrilla(ep.srcPort, ep.srcSide);
        var preD = nodoEntradaGrilla(ep.dstPort, ep.dstSide);
        if (preS != null) marcarStubUsado(ep.srcPort, preS, xs, ys, NX, NY, hUsed, vUsed, hPassVert, vPassVert);
        if (preD != null) marcarStubUsado(ep.dstPort, preD, xs, ys, NX, NY, hUsed, vUsed, hPassVert, vPassVert);
    }

    // Rutear primero conexiones cortas y directas, luego buses largos
    var routeOrder = edges.slice(0);
    routeOrder.sort(function(e1, e2) {
        var d1 = Math.abs(e1.srcPort.x - e1.dstPort.x) + Math.abs(e1.srcPort.y - e1.dstPort.y);
        var d2 = Math.abs(e2.srcPort.x - e2.dstPort.x) + Math.abs(e2.srcPort.y - e2.dstPort.y);
        return d1 - d2;
    });

    var oppDir = [2, 3, 0, 1];
    var dxi = [0, 1, 0, -1];
    var dyi = [-1, 0, 1, 0];
    var totalStates = NX * NY * 4;
    var dist = new Array(totalStates);
    var prev = new Array(totalStates);
    var INF = 1e15;

    for (var ei = 0; ei < routeOrder.length; ei++)
    {
        e = routeOrder[ei];
        var sEnt = nodoEntradaGrilla(e.srcPort, e.srcSide);
        var dEnt = nodoEntradaGrilla(e.dstPort, e.dstSide);
        if (sEnt == null || dEnt == null)
        {
            e.waypoints = [];
            continue;
        }
        // Liberar temporalmente el propio stub de esta arista antes de buscar su ruta
        desmarcarStubPropio(e.srcPort, sEnt, xs, ys, NX, NY, hUsed, vUsed);
        desmarcarStubPropio(e.dstPort, dEnt, xs, ys, NX, NY, hUsed, vUsed);

        for (i = 0; i < totalStates; i++)
        {
            dist[i] = INF;
            prev[i] = -1;
        }

        var heapState = [];
        var heapCost = [];
        function heapPush(st, co)
        {
            var idx = heapState.length;
            heapState.push(st);
            heapCost.push(co);
            while (idx > 0)
            {
                var par = (idx - 1) >> 1;
                if (heapCost[par] <= heapCost[idx]) break;
                var ts1 = heapState[par];
                heapState[par] = heapState[idx];
                heapState[idx] = ts1;
                var tc1 = heapCost[par];
                heapCost[par] = heapCost[idx];
                heapCost[idx] = tc1;
                idx = par;
            }
        }
        function heapPop()
        {
            var topSt = heapState[0];
            var lastSt = heapState.pop();
            var lastCo = heapCost.pop();
            if (heapState.length > 0)
            {
                heapState[0] = lastSt;
                heapCost[0] = lastCo;
                var idx = 0;
                var n = heapState.length;
                while (true)
                {
                    var l = (idx << 1) + 1;
                    var r = l + 1;
                    var sm = idx;
                    if (l < n && heapCost[l] < heapCost[sm]) sm = l;
                    if (r < n && heapCost[r] < heapCost[sm]) sm = r;
                    if (sm == idx) break;
                    var ts2 = heapState[sm];
                    heapState[sm] = heapState[idx];
                    heapState[idx] = ts2;
                    var tc2 = heapCost[sm];
                    heapCost[sm] = heapCost[idx];
                    heapCost[idx] = tc2;
                    idx = sm;
                }
            }
            return topSt;
        }

        var startSt = (sEnt.xi * NY + sEnt.yi) * 4 + sEnt.dir;
        dist[startSt] = 0;
        heapPush(startSt, 0);

        var goalBase = dEnt.xi * NY + dEnt.yi;
        var reqFinalDir = oppDir[dEnt.dir];
        var bestGoalSt = -1;
        var bestGoalTotal = INF;

        while (heapState.length > 0)
        {
            var curCost = heapCost[0];
            var uSt = heapPop();
            if (curCost > dist[uSt]) continue;
            if (curCost >= bestGoalTotal) break;

            var uDir = uSt & 3;
            var uNode = uSt >> 2;
            if (uNode == goalBase && uDir != dEnt.dir)
            {
                var finalTurn = (uDir == reqFinalDir) ? 0 : (450 + cornerVert[uNode] * 6000);
                var goalTotal = curCost + finalTurn;
                if (goalTotal < bestGoalTotal)
                {
                    bestGoalTotal = goalTotal;
                    bestGoalSt = uSt;
                }
                if (finalTurn == 0) break;
            }

            var uxi = Math.floor(uNode / NY);
            var uyi = uNode - uxi * NY;

            for (var ndir = 0; ndir < 4; ndir++)
            {
                if (ndir == oppDir[uDir]) continue;
                var nxi = uxi + dxi[ndir];
                var nyi = uyi + dyi[ndir];
                if (nxi < 0 || nxi >= NX || nyi < 0 || nyi >= NY) continue;

                var segLen = 0;
                var segUsed = 0;
                var crossPen = 0;
                var nBase = nxi * NY + nyi;

                if (ndir == 1 || ndir == 3)
                {
                    var minXi = (ndir == 1) ? uxi : nxi;
                    if (hBlocked[minXi * NY + uyi]) continue;
                    segLen = Math.abs(xs[nxi] - xs[uxi]);
                    segUsed = hUsed[minXi * NY + uyi];
                    crossPen = vPassVert[nBase] * 420 + cornerVert[nBase] * 1500;
                }
                else
                {
                    var minYi = (ndir == 2) ? uyi : nyi;
                    if (vSegBlocked[uxi * (NY - 1) + minYi]) continue;
                    segLen = Math.abs(ys[nyi] - ys[uyi]);
                    segUsed = vUsed[uxi * (NY - 1) + minYi];
                    crossPen = hPassVert[nBase] * 420 + cornerVert[nBase] * 1500;
                }

                var isTurn = (ndir != uDir);
                var turnPen = isTurn ? (450 + cornerVert[uNode] * 6000 + (hPassVert[uNode] + vPassVert[uNode]) * 1200) : 0;
                var overlapPen = segUsed * 80000;

                // Desempate de anidamiento planar para buses verticales en pasillos
                var nestBias = 0;
                if (ndir == 0 || ndir == 2)
                {
                    var totalDy = Math.abs(e.dstPort.y - e.srcPort.y);
                    var totalDx = Math.max(1, Math.abs(e.dstPort.x - e.srcPort.x));
                    var progX = Math.abs(xs[uxi] - e.srcPort.x) / totalDx;
                    var wantProg = (totalDy > 900) ? 0.18 : ((totalDy > 400) ? 0.45 : 0.78);
                    nestBias = Math.abs(progX - wantProg) * segLen * 0.08;
                }

                var nCost = curCost + segLen + nestBias + turnPen + overlapPen + crossPen;
                var nSt = nBase * 4 + ndir;
                if (nCost < dist[nSt])
                {
                    dist[nSt] = nCost;
                    prev[nSt] = uSt;
                    heapPush(nSt, nCost);
                }
            }
        }

        if (bestGoalSt == -1)
        {
            e.waypoints = [];
            continue;
        }

        var gridPts = [];
        var cur = bestGoalSt;
        while (cur != -1)
        {
            var cNode = cur >> 2;
            var cxi = Math.floor(cNode / NY);
            var cyi = cNode - cxi * NY;
            gridPts.push({ xi: cxi, yi: cyi, x: xs[cxi], y: ys[cyi] });
            cur = prev[cur];
        }
        gridPts.reverse();

        for (j = 0; j < gridPts.length - 1; j++)
        {
            var pA = gridPts[j];
            var pB = gridPts[j + 1];
            if (pA.yi == pB.yi)
            {
                marcarBandaHorizontalUsada(Math.min(pA.xi, pB.xi), pA.yi, ys, NY, hUsed, 8);
            }
            else
            {
                marcarBandaVerticalUsada(pA.xi, Math.min(pA.yi, pB.yi), xs, NX, NY, vUsed, 8);
            }
        }
        marcarStubUsado(e.srcPort, sEnt, xs, ys, NX, NY, hUsed, vUsed, hPassVert, vPassVert);
        marcarStubUsado(e.dstPort, dEnt, xs, ys, NX, NY, hUsed, vUsed, hPassVert, vPassVert);

        var extPts = [{
            xi: (xIdx[e.srcPort.x] != null) ? xIdx[e.srcPort.x] : sEnt.xi,
            yi: (yIdx[e.srcPort.y] != null) ? yIdx[e.srcPort.y] : sEnt.yi
        }].concat(gridPts).concat([{
            xi: (xIdx[e.dstPort.x] != null) ? xIdx[e.dstPort.x] : dEnt.xi,
            yi: (yIdx[e.dstPort.y] != null) ? yIdx[e.dstPort.y] : dEnt.yi
        }]);

        for (j = 1; j < extPts.length - 1; j++)
        {
            var gPrev = extPts[j - 1];
            var gCur = extPts[j];
            var gNext = extPts[j + 1];
            var vKey = gCur.xi * NY + gCur.yi;
            if (gPrev.yi == gCur.yi && gCur.yi == gNext.yi) hPassVert[vKey]++;
            else if (gPrev.xi == gCur.xi && gCur.xi == gNext.xi) vPassVert[vKey]++;
            else cornerVert[vKey]++;
        }

        // Simplificar polilínea completa dejando únicamente los quiebres de 90°
        var raw = [{ x: e.srcPort.x, y: e.srcPort.y }];
        for (j = 0; j < gridPts.length; j++)
        {
            var gp = { x: gridPts[j].x, y: gridPts[j].y };
            var last = raw[raw.length - 1];
            if (gp.x != last.x || gp.y != last.y) raw.push(gp);
        }
        if (raw[raw.length - 1].x != e.dstPort.x || raw[raw.length - 1].y != e.dstPort.y)
        {
            raw.push({ x: e.dstPort.x, y: e.dstPort.y });
        }

        var simplified = [raw[0]];
        for (j = 1; j < raw.length - 1; j++)
        {
            var prv = simplified[simplified.length - 1];
            var curP = raw[j];
            var nxt = raw[j + 1];
            if ((prv.x == curP.x && curP.x == nxt.x) || (prv.y == curP.y && curP.y == nxt.y))
            {
                continue;
            }
            simplified.push(curP);
        }
        simplified.push(raw[raw.length - 1]);

        e.waypoints = simplified.slice(1, simplified.length - 1);
        e.fullPolyline = simplified;
    }
}

function marcarBandaHorizontalUsada(segXi, yiCenter, ys, NY, hUsed, minClearance)
{
    var yRef = ys[yiCenter];
    for (var yk = 0; yk < NY; yk++)
    {
        if (Math.abs(ys[yk] - yRef) < minClearance)
        {
            hUsed[segXi * NY + yk]++;
        }
    }
}

function marcarBandaVerticalUsada(xiCenter, segYi, xs, NX, NY, vUsed, minClearance)
{
    var xRef = xs[xiCenter];
    for (var xk = 0; xk < NX; xk++)
    {
        if (Math.abs(xs[xk] - xRef) < minClearance)
        {
            vUsed[xk * (NY - 1) + segYi]++;
        }
    }
}

function desmarcarStubPropio(port, ent, xs, ys, NX, NY, hUsed, vUsed)
{
    var i, k;
    if (port.y == ys[ent.yi])
    {
        var xMin = Math.min(port.x, xs[ent.xi]);
        var xMax = Math.max(port.x, xs[ent.xi]);
        for (i = 0; i < NX - 1; i++)
        {
            if (xs[i + 1] > xMin && xs[i] < xMax)
            {
                for (k = 0; k < NY; k++)
                {
                    if (Math.abs(ys[k] - ys[ent.yi]) < 8 && hUsed[i * NY + k] > 0) hUsed[i * NY + k]--;
                }
            }
        }
    }
    else if (port.x == xs[ent.xi])
    {
        var yMin = Math.min(port.y, ys[ent.yi]);
        var yMax = Math.max(port.y, ys[ent.yi]);
        for (i = 0; i < NY - 1; i++)
        {
            if (ys[i + 1] > yMin && ys[i] < yMax)
            {
                for (k = 0; k < NX; k++)
                {
                    if (Math.abs(xs[k] - xs[ent.xi]) < 8 && vUsed[k * (NY - 1) + i] > 0) vUsed[k * (NY - 1) + i]--;
                }
            }
        }
    }
}

function marcarStubUsado(port, ent, xs, ys, NX, NY, hUsed, vUsed, hPassVert, vPassVert)
{
    var i;
    if (port.y == ys[ent.yi])
    {
        var xMin = Math.min(port.x, xs[ent.xi]);
        var xMax = Math.max(port.x, xs[ent.xi]);
        for (i = 0; i < NX - 1; i++)
        {
            if (xs[i + 1] > xMin && xs[i] < xMax)
            {
                marcarBandaHorizontalUsada(i, ent.yi, ys, NY, hUsed, 8);
            }
        }
        for (i = 0; i < NX; i++)
        {
            if (xs[i] > xMin && xs[i] < xMax) hPassVert[i * NY + ent.yi]++;
        }
    }
    else if (port.x == xs[ent.xi])
    {
        var yMin = Math.min(port.y, ys[ent.yi]);
        var yMax = Math.max(port.y, ys[ent.yi]);
        for (i = 0; i < NY - 1; i++)
        {
            if (ys[i + 1] > yMin && ys[i] < yMax)
            {
                marcarBandaVerticalUsada(ent.xi, i, xs, NX, NY, vUsed, 8);
            }
        }
        for (i = 0; i < NY; i++)
        {
            if (ys[i] > yMin && ys[i] < yMax) vPassVert[ent.xi * NY + i]++;
        }
    }
}

/* ============================================================
    APLICACIÓN DE POSICIONES Y RUTAS ORTOGONALES EN SPARX EA
   ============================================================ */

function obtenerEstiloLineaEA()
{
    if (ESTILO_LINEA == "OS")
    {
        return "Mode=3;TREE=OS;";
    }
    if (ESTILO_LINEA == "CUSTOM")
    {
        return "Mode=3;";
    }
    return "Mode=3;TREE=OR;";
}

function finalizarDiagrama(ctx)
{
    var pkg = ctx.pkg;
    var diagram = ctx.diagram;
    var grafo = ctx.grafo;
    var i;

    // Pasada 1: Refrescar y recargar diagrama para leer dimensiones mínimas reales de EA
    diagram.DiagramObjects.Refresh();
    diagram.DiagramLinks.Refresh();
    diagram.Update();
    Repository.ReloadDiagram(diagram.DiagramID);
    diagram.DiagramObjects.Refresh();

    var objByElementId = {};
    for (i = 0; i < diagram.DiagramObjects.Count; i++)
    {
        var dobj as EA.DiagramObject;
        dobj = diagram.DiagramObjects.GetAt(i);
        objByElementId[dobj.ElementID] = dobj;
    }

    for (i = 0; i < grafo.nodes.length; i++)
    {
        var nd = grafo.nodes[i];
        var realObj = objByElementId[nd.el.ElementID];
        if (realObj != null)
        {
            nd.obj = realObj;
            var eaW = Math.abs(realObj.right - realObj.left);
            var eaH = Math.abs(realObj.bottom - realObj.top);
            if (eaW > nd.w) nd.w = eaW;
            if (eaH > nd.h) nd.h = eaH;
        }
        // Asegurar dimensiones pares para que el centro exacto de cada caja sea entero en EA
        if ((nd.w % 2) != 0) nd.w += 1;
        if ((nd.h % 2) != 0) nd.h += 1;
    }

    // Pasada 2: Calcular posiciones finales sin solapes y actualizar DiagramObjects
    // (En EA, al editar propiedades directas left/right/top/bottom, Y hacia abajo es negativo)
    var meta = calcularPosicionesGrafo(grafo);

    for (i = 0; i < grafo.nodes.length; i++)
    {
        var n = grafo.nodes[i];
        if (n.obj != null)
        {
            n.obj.left = n.x;
            n.obj.right = n.x + n.w;
            n.obj.top = -n.y;
            n.obj.bottom = -(n.y + n.h);
            n.obj.Update();
        }
    }

    diagram.DiagramObjects.Refresh();
    diagram.Update();

    // Pasada 3: Calcular rutas ortogonales multicarril y escribirlas en DiagramLinks
    rutearConectoresOrtogonales(grafo, meta);

    diagram.DiagramLinks.Refresh();
    var linkByConnId = {};
    for (i = 0; i < diagram.DiagramLinks.Count; i++)
    {
        var existingDl as EA.DiagramLink;
        existingDl = diagram.DiagramLinks.GetAt(i);
        linkByConnId[existingDl.ConnectorID] = existingDl;
    }

    var baseStyle = obtenerEstiloLineaEA();

    for (i = 0; i < grafo.edges.length; i++)
    {
        var e = grafo.edges[i];
        if (e.conn == null) continue;

        var dl as EA.DiagramLink;
        dl = linkByConnId[e.conn.ConnectorID];
        if (dl == null)
        {
            dl = diagram.DiagramLinks.AddNew("", "");
            dl.ConnectorID = e.conn.ConnectorID;
        }

        // Offsets relativos al centro de cada caja en coordenadas cartesianas de EA (+Y arriba, -Y abajo)
        var scx = e.src.x + e.src.w / 2;
        var scy = e.src.y + e.src.h / 2;
        var dcx = e.dst.x + e.dst.w / 2;
        var dcy = e.dst.y + e.dst.h / 2;

        var sx = (e.srcSide == 1 || e.srcSide == 3) ? Math.round(e.srcPort.x - scx) : 0;
        var sy = (e.srcSide == 2 || e.srcSide == 4) ? Math.round(scy - e.srcPort.y) : 0;
        var ex = (e.dstSide == 1 || e.dstSide == 3) ? Math.round(e.dstPort.x - dcx) : 0;
        var ey = (e.dstSide == 2 || e.dstSide == 4) ? Math.round(dcy - e.dstPort.y) : 0;

        var pathParts = [];
        for (var k = 0; k < e.waypoints.length; k++)
        {
            var wp = e.waypoints[k];
            pathParts.push(Math.round(wp.x) + ":" + (-Math.round(wp.y)));
        }
        var pathStr = (pathParts.length > 0) ? (pathParts.join(";") + ";") : "";

        dl.Style = baseStyle;
        dl.Geometry = "EDGE=" + e.srcSide + ";SX=" + sx + ";SY=" + sy + ";EX=" + ex + ";EY=" + ey + ";";
        dl.Path = pathStr;
        dl.IsHidden = false;
        dl.Update();
    }

    diagram.DiagramLinks.Refresh();
    diagram.Update();

    // Recargar desde BD antes de abrir/guardar para que la vista en memoria no pise los cambios
    Repository.ReloadDiagram(diagram.DiagramID);
    Repository.OpenDiagram(diagram.DiagramID);
    Repository.RefreshModelView(pkg.PackageID);

    Session.Output("Layout completado: " + grafo.nodes.length + " elementos y " + grafo.edges.length + " conectores ortogonales.");
}

/* ============================================================
   SOPORTE DE PAQUETES
   ============================================================ */

function findPackageByName(parentPkg, name)
{
    for (var i = 0; i < parentPkg.Packages.Count; i++)
    {
        var pkg as EA.Package;
        pkg = parentPkg.Packages.GetAt(i);

        if (pkg.Name == name)
        {
            return pkg;
        }
    }

    return null;
}

function deletePackageByName(parentPkg, name)
{
    var existing as EA.Package;
    existing = findPackageByName(parentPkg, name);

    if (existing == null)
    {
        return;
    }

    for (var i = parentPkg.Packages.Count - 1; i >= 0; i--)
    {
        var pkg as EA.Package;
        pkg = parentPkg.Packages.GetAt(i);

        if (pkg.Name == name)
        {
            parentPkg.Packages.DeleteAt(i, true);
            parentPkg.Packages.Refresh();
            return;
        }
    }
}

main();
