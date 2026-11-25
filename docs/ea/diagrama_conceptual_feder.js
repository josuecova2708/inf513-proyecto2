// =============================================================================
// Diagrama Conceptual - FEDER  (script para Enterprise Architect)
// -----------------------------------------------------------------------------
// Uso: en el Project Browser selecciona el paquete donde quieres el diagrama,
// abre Specialize > Scripting, crea un script "JavaScript" (o "JScript"),
// pega este archivo y ejecútalo. Crea el subpaquete "Diagrama Conceptual - FEDER"
// con 30 clases, 33 asociaciones y 6 clases asociación (muchos a muchos).
// Para repetir: borra ese subpaquete y vuelve a ejecutar.
//
// Fuente: database/sql/feder_base.sql + migraciones web (BD real del proyecto).
// Escrito en ES5 para que funcione igual en JScript y en JavaScript de EA.
// =============================================================================

var NOMBRE = "Diagrama Conceptual - FEDER";

// ---------- Clases: [nombre, x, y, ancho, atributos] --------------------------
// "id" se convierte en id_<tabla> (ej. Notificacion -> id_notificacion).
var CLASES = [
    // Usuarios y permisos
    ["Rol",                  220,  630, 200, "id,nombre,descripcion"],
    ["Permiso",               35,  435, 200, "id,nombre,modulo,accion"],
    ["RolPermiso",           280,  290, 180, "ver,crear,editar,eliminar"],
    ["Usuario",              410,  868, 210, "id,nombre,apellido,ci,email,telefono,password_hash,direccion,estado,fecha_registro"],
    ["Menu",                  30,  170, 200, "id,titulo,ruta,icono,orden,activo"],
    ["PreferenciaUsuario",    20,  780, 200, "tema,modo,tamano_fuente,contraste"],
    ["Bitacora",              20, 1180, 200, "id,email,accion,recurso,metodo,ruta,codigo_http,ip,user_agent,detalle,fecha"],
    ["VisitaPagina",          30,   30, 200, "id,pagina,contador,ultima_visita"],
    ["QrPago",               200, 1440, 190, "id,imagen,tipo_mime,nombre_archivo,fecha,activo"],

    // Emprendimientos y catálogo
    ["Comunidad",            525,  187, 210, "id,nombre,municipio,provincia,departamento,descripcion"],
    ["Emprendimiento",       815,  317, 210, "id,nombre,rubro,responsable,ci_nit,telefono,direccion,latitud,longitud,imagen,estado"],
    ["Categoria",            690,  647, 210, "id,nombre,descripcion"],
    ["Producto",            1175,  410, 210, "id,nombre,descripcion,imagen,presentacion,unidad_medida,precio_venta,modalidad_venta,stock_minimo,estado"],
    ["EmprendimientoProducto", 1252, 187, 215, "precio_referencia,temporada"],

    // Producción e inventario
    ["Produccion",          1630,   53, 175, "id,tipo,cantidad,unidad_medida,fecha_produccion,fecha_disponible,precio_propuesto,procedencia,estado,fecha_validacion,observacion,fecha_registro"],
    ["Lote",                2075,  410, 185, "id,codigo,cantidad_inicial,stock_disponible,stock_reservado,costo_unitario,fecha_ingreso,fecha_vencimiento,estado,version"],
    ["AlertaInventario",    1697,  410, 155, "id,tipo,mensaje,fecha,estado"],
    ["MovimientoInventario", 1540, 1395, 175, "id,tipo,cantidad,fecha,motivo"],

    // Encargos y pedidos
    ["Encargo",              900, 1178, 210, "id,fecha_solicitud,fecha_requerida,estado,observacion"],
    ["DetalleEncargo",       988,  732, 145, "cantidad,precio_estimado"],
    ["Pedido",              1358,  992, 210, "id,numero,origen,fecha,estado,nit_ci,razon_social,subtotal,costo_envio,total"],
    ["DetallePedido",       1445,  657, 145, "id,cantidad,precio_unitario,subtotal"],
    ["ReservaLote",         1825,  674, 175, "id,cantidad,fecha,fecha_expiracion,estado"],
    ["Entrega",             1697,  842, 210, "id,tipo,direccion,referencia,fecha_preferida,fecha_programada,fecha_entrega,receptor,latitud,longitud,distancia_km,estado"],
    ["Notificacion",         663, 1395, 210, "id,tipo,canal,mensaje,fecha_envio,leida"],

    // Pagos
    ["MetodoPago",          1612, 1237, 210, "id,nombre,habilitado"],
    ["Pago",                1930, 1090, 170, "id,monto,fecha,estado,referencia,comprobante,codigo_transaccion"],
    ["MetodoPagoUsuario",   1900, 1300, 220, "id,alias,titular,marca,ultimos4,mes_venc,anio_venc,banco,token_simulado,predeterminado,estado,fecha_registro"],
    ["PlanPago",            2160,  780, 180, "id,nro_cuotas,frecuencia,monto_total,cuota_inicial,estado,fecha"],
    ["CuotaPago",           2160,  950, 180, "id,numero,monto,fecha_vencimiento,estado,fecha_pago"]
];

// ---------- Asociaciones: [A, multA, esteA, nombre, B, multB, esteB] ----------
var RELACIONES = [
    ["Rol",               "1",    "",              "clasifica",   "Usuario",              "0..*", ""],
    ["Comunidad",         "1",    "",              "agrupa",      "Emprendimiento",       "0..*", ""],
    ["Usuario",           "0..1", "productor",     "accede",      "Emprendimiento",       "0..1", ""],
    ["Categoria",         "1",    "",              "clasifica",   "Producto",             "0..*", ""],
    ["Emprendimiento",    "1",    "",              "reporta",     "Produccion",           "0..*", ""],
    ["Producto",          "1",    "",              "corresponde", "Produccion",           "0..*", ""],
    ["Usuario",           "0..1", "personal",      "valida",      "Produccion",           "0..*", ""],
    ["Produccion",        "1",    "",              "origina",     "Lote",                 "0..*", ""],
    ["Lote",              "1",    "",              "afecta",      "MovimientoInventario", "0..*", ""],
    ["Usuario",           "0..1", "personal",      "registra",    "MovimientoInventario", "0..*", ""],
    ["Producto",          "1",    "",              "genera",      "AlertaInventario",     "0..*", ""],
    ["Usuario",           "1",    "cliente",       "solicita",    "Encargo",              "0..*", ""],
    ["Usuario",           "1",    "cliente",       "realiza",     "Pedido",               "0..*", ""],
    ["Usuario",           "0..1", "personal",      "gestiona",    "Pedido",               "0..*", ""],
    ["Encargo",           "0..1", "",              "genera",      "Pedido",               "0..1", ""],
    ["Pedido",            "1",    "",              "recibe",      "Pago",                 "0..*", ""],
    ["MetodoPago",        "1",    "",              "usa",         "Pago",                 "0..*", ""],
    ["MetodoPagoUsuario", "0..1", "",              "debita",      "Pago",                 "0..*", ""],
    ["CuotaPago",         "0..1", "",              "cubre",       "Pago",                 "0..*", ""],
    ["Usuario",           "0..1", "personal",      "cobra",       "Pago",                 "0..*", ""],
    ["Pedido",            "1",    "",              "tiene",       "Entrega",              "0..1", ""],
    ["Usuario",           "0..1", "personal",      "despacha",    "Entrega",              "0..*", ""],
    ["Usuario",           "1",    "",              "recibe",      "Notificacion",         "0..*", ""],
    ["Pedido",            "0..1", "",              "origina",     "Notificacion",         "0..*", ""],
    ["Encargo",           "0..1", "",              "origina",     "Notificacion",         "0..*", ""],
    ["Usuario",           "0..1", "administrador", "sube",        "QrPago",               "0..*", ""],
    ["Pedido",            "1",    "",              "financia",    "PlanPago",             "0..1", ""],
    ["Usuario",           "1",    "cliente",       "contrata",    "PlanPago",             "0..*", ""],
    ["PlanPago",          "1",    "",              "programa",    "CuotaPago",            "0..*", ""],
    ["Permiso",           "0..1", "",              "habilita",    "Menu",                 "0..*", ""],
    ["Menu",              "0..1", "",              "contiene",    "Menu",                 "0..*", ""],
    ["Usuario",           "1",    "",              "configura",   "PreferenciaUsuario",   "0..1", ""],
    ["Usuario",           "0..1", "",              "audita",      "Bitacora",             "0..*", ""]
];

// ---------- Muchos a muchos: [A, esteA, B, clase asociación] ------------------
// Sin multiplicidad; la clase intermedia se une con línea punteada.
var INTERMEDIAS = [
    ["Rol",            "",        "Permiso",    "RolPermiso"],
    ["Emprendimiento", "",        "Producto",   "EmprendimientoProducto"],
    ["Encargo",        "",        "Producto",   "DetalleEncargo"],
    ["Pedido",         "",        "Producto",   "DetallePedido"],
    ["DetallePedido",  "",        "Lote",       "ReservaLote"],
    ["Usuario",        "cliente", "MetodoPago", "MetodoPagoUsuario"]
];

// =============================================================================

function salida(texto) {
    Session.Output(texto);
}

// "MovimientoInventario" -> "movimiento_inventario"
function aSnake(nombre) {
    return nombre.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function buscarPaquete(padre, nombre) {
    for (var i = 0; i < padre.Packages.Count; i++) {
        var p = padre.Packages.GetAt(i);
        if (p.Name == nombre) return p;
    }
    return null;
}

function crearClase(paquete, nombre, atributos) {
    var el = paquete.Elements.AddNew(nombre, "Class");
    el.Update();
    var lista = atributos.split(",");
    for (var i = 0; i < lista.length; i++) {
        var nom = lista[i] == "id" ? "id_" + aSnake(nombre) : lista[i];
        var at = el.Attributes.AddNew(nom, "");
        at.Visibility = "Public";
        at.Pos = i;
        at.Update();
    }
    el.Attributes.Refresh();
    el.Update();
    return el;
}

function crearAsociacion(elA, multA, esteA, nombre, elB, multB, esteB) {
    var con = elA.Connectors.AddNew(nombre, "Association");
    con.SupplierID = elB.ElementID;
    con.Direction = "Unspecified";
    con.Update();
    con.ClientEnd.Cardinality = multA;
    con.ClientEnd.Visibility = "Public";
    if (esteA != "") con.ClientEnd.Stereotype = esteA;
    con.ClientEnd.Update();
    con.SupplierEnd.Cardinality = multB;
    con.SupplierEnd.Visibility = "Public";
    if (esteB != "") con.SupplierEnd.Stereotype = esteB;
    con.SupplierEnd.Update();
    con.Update();
    elA.Connectors.Refresh();
    return con;
}

function main() {
    Repository.EnsureOutputVisible("Script");
    Repository.ClearOutput("Script");

    var padre = Repository.GetTreeSelectedPackage();
    if (padre == null) {
        salida("Selecciona primero un paquete en el Project Browser.");
        return;
    }
    if (buscarPaquete(padre, NOMBRE) != null) {
        salida("Ya existe el paquete '" + NOMBRE + "' en " + padre.Name + ". Bórralo para volver a generarlo.");
        return;
    }

    var paquete = padre.Packages.AddNew(NOMBRE, "");
    paquete.Update();
    padre.Packages.Refresh();

    // 1. Clases
    var clases = {};
    for (var i = 0; i < CLASES.length; i++) {
        var c = CLASES[i];
        clases[c[0]] = crearClase(paquete, c[0], c[4]);
    }
    paquete.Elements.Refresh();
    salida("Clases creadas: " + CLASES.length);

    // 2. Asociaciones normales
    for (var j = 0; j < RELACIONES.length; j++) {
        var r = RELACIONES[j];
        crearAsociacion(clases[r[0]], r[1], r[2], r[3], clases[r[4]], r[5], r[6]);
    }
    salida("Asociaciones creadas: " + RELACIONES.length);

    // 3. Muchos a muchos con clase asociación
    var okInter = 0;
    for (var k = 0; k < INTERMEDIAS.length; k++) {
        var m = INTERMEDIAS[k];
        var con = crearAsociacion(clases[m[0]], "", m[1], "", clases[m[2]], "", "");
        if (clases[m[3]].CreateAssociationClass(con.ConnectorID)) {
            okInter++;
        } else {
            salida("No se pudo crear la clase asociación " + m[3]);
        }
    }
    salida("Clases asociación creadas: " + okInter + " de " + INTERMEDIAS.length);

    // 4. Diagrama con la disposición del v1
    var diagrama = paquete.Diagrams.AddNew(NOMBRE, "Logical");
    diagrama.Update();
    for (var d = 0; d < CLASES.length; d++) {
        var cl = CLASES[d];
        var n = cl[4].split(",").length;
        var alto = 34 + 16 * n;
        var pos = "l=" + cl[1] + ";r=" + (cl[1] + cl[3]) + ";t=" + cl[2] + ";b=" + (cl[2] + alto) + ";";
        var obj = diagrama.DiagramObjects.AddNew(pos, "");
        obj.ElementID = clases[cl[0]].ElementID;
        obj.Update();
    }
    diagrama.DiagramObjects.Refresh();
    diagrama.Update();
    paquete.Diagrams.Refresh();

    Repository.RefreshModelView(paquete.PackageID);
    Repository.ReloadDiagram(diagrama.DiagramID);
    Repository.OpenDiagram(diagrama.DiagramID);
    salida("Listo: diagrama '" + NOMBRE + "' generado en " + padre.Name + ".");
}

main();
