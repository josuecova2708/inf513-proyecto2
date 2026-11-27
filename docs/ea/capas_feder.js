!INC Local Scripts.EAConstants-JScript

/*
 * ===================================================================
 *  FEDER - INF513 (Proyecto 2, versión web)
 *  Diagrama de Capas - Diseño Lógico
 * -------------------------------------------------------------------
 *  Lenguaje: JScript (Enterprise Architect)
 *  Uso: selecciona en el Project Browser el paquete destino,
 *       Specialize > Scripting > nuevo script JScript, pega y ejecuta.
 *       Crea (o recrea) el paquete "Diagrama de Capas - FEDER".
 *
 *  Arquitectura de 3 capas (README):
 *   - Presentación: React 19 (SPA) en el navegador       -> resources/js
 *   - Negocio:      Laravel 13, API REST con Sanctum     -> routes/api.php, app/
 *   - Datos:        PostgreSQL 18.6 (db_grupo28sa)        -> database/
 *  Cada capa solo depende de la de abajo.
 * ===================================================================
 */

var NOMBRE_PAQUETE = "Diagrama de Capas - FEDER";

// En EA el objeto con Sequence MENOR queda encima (igual que en despliegue_feder.js)
var MENOR_ENCIMA = true;

function rgb(r, g, b) { return r + g * 256 + b * 65536; }
var COLOR_PAQUETE  = rgb(250, 238, 234);
var COLOR_ARTEFACTO = rgb(220, 239, 224);
var COLOR_BD       = rgb(248, 227, 207);

// ---- Capas (rectángulos de fondo) ---------------------------------
// [id, nombre, l, t, r, b]
var CAPAS = [
  ["pres", "Capa de Presentación (Frontend - Navegador web, React 19)",            20,  20, 880, 310],
  ["neg",  "Capa de Negocio (Backend - Laravel 13 en el servidor tecnoweb)",       20, 350, 880, 640],
  ["dat",  "Capa de Datos (Persistencia - PostgreSQL 18.6 en el servidor tecnoweb)", 20, 680, 880, 920]
];

// ---- Paquetes y sus artefactos -------------------------------------
// [id, nombre, l, t, r, b, [artefactos]]
var PAQUETES = [
  ["cliente", "Lógica del cliente", 50, 70, 420, 290, [
      "api/cliente.js (axios + token Bearer)",
      "Contextos (Auth, Carrito, Tema)",
      "Hooks (useListado, useFormulario)"
  ]],
  ["vistas", "Vistas", 480, 70, 850, 290, [
      "Páginas (.jsx)",
      "Componentes UI (Crud, ModalPago, Gráficos)",
      "Layouts (público / panel)"
  ]],
  ["control", "Enrutamiento y control", 50, 400, 420, 620, [
      "Rutas (routes/api.php)",
      "Middleware (Sanctum, permisos, bitácora)",
      "Controladores REST (Api/*Controller)"
  ]],
  ["dominio", "Lógica de dominio", 480, 400, 850, 620, [
      "Servicios (Pedido, Pago, Permiso, Notificación)",
      "Pasarelas de pago (Stripe / simulada)",
      "Modelos (Eloquent)"
  ]]
];

// ---- Base de datos -------------------------------------------------
var BD = {
  nombre: "db_grupo28sa", l: 250, t: 730, r: 650, b: 895,
  atributos: [
    "SGBD: PostgreSQL 18.6",
    "Tablas del negocio, bitácora y matriz rol_permiso",
    "Vistas: disponibilidad, saldo de pedido, trazabilidad",
    "Funciones plpgsql: reservas FEFO, ingreso de lotes, stock mínimo"
  ]
};

// ---- Dependencias --------------------------------------------------
// [origen, destino, etiqueta]
var DEPENDENCIAS = [
  ["vistas",  "cliente", "usa"],
  ["cliente", "control", "HTTP/JSON (API REST + token Bearer)"],
  ["control", "dominio", "invoca"],
  ["dominio", "bd",      "SQL (pdo_pgsql)"]
];

// ===================================================================
function log(m) { Session.Output(m); }

function borrarPaquete(padre, nombre) {
  for (var i = padre.Packages.Count - 1; i >= 0; i--) {
    if (padre.Packages.GetAt(i).Name == nombre) padre.Packages.DeleteAt(i, true);
  }
  padre.Packages.Refresh();
}

function colocar(diag, elementId, l, t, r, b, color, nivel) {
  var o = diag.DiagramObjects.AddNew("l=" + l + ";r=" + r + ";t=" + t + ";b=" + b + ";", "");
  o.ElementID = elementId;
  if (color != null) o.Style = "BCol=" + color + ";BColor=" + color + ";LCol=0;LColor=0;LWth=1;";
  var seq = MENOR_ENCIMA ? (10 - nivel) : (nivel + 1);
  o.Sequence = seq;
  o.Update();
  try {
    Repository.Execute("UPDATE t_diagramobjects SET Sequence=" + seq +
                       " WHERE Diagram_ID=" + diag.DiagramID + " AND Object_ID=" + elementId);
  } catch (eS) {}
  return o;
}

function conHideQuals(s) {
  s = (s == null) ? "" : String(s);
  if (s.indexOf("HideQuals=") >= 0) return s.replace(/HideQuals=\d/, "HideQuals=1");
  return s + "HideQuals=1;";
}

function main() {
  Repository.EnsureOutputVisible("Script");
  Repository.ClearOutput("Script");
  log("=== Diagrama de capas - FEDER ===");

  var sel = Repository.GetTreeSelectedPackage();
  if (sel == null) {
    Session.Prompt("Selecciona un paquete antes de ejecutar el script.", promptOK);
    return;
  }

  borrarPaquete(sel, NOMBRE_PAQUETE);
  var raiz = sel.Packages.AddNew(NOMBRE_PAQUETE, "");
  raiz.Update();
  sel.Packages.Refresh();

  var diag = raiz.Diagrams.AddNew("Diagrama de Capas - Diseño Lógico", "Logical");
  diag.Update();
  raiz.Diagrams.Refresh();

  // Sin la lista de contenido dentro de los paquetes (ya se ven los artefactos)
  try { diag.ShowPackageContents = false; } catch (eP) { log("  ! no se pudo ocultar el contenido de los paquetes"); }
  // Sin el prefijo "Paquete::" en los nombres de los artefactos (HideQuals vive en StyleEx)
  diag.StyleEx = conHideQuals(diag.StyleEx);
  diag.ExtendedStyle = conHideQuals(diag.ExtendedStyle);
  diag.Update();

  var el = {};   // id -> EA.Element (para las dependencias)

  // Capas: rectángulos de fondo (Boundary)
  for (var c = 0; c < CAPAS.length; c++) {
    var k = CAPAS[c];
    var capa = raiz.Elements.AddNew(k[1], "Boundary");
    capa.Update();
    raiz.Elements.Refresh();
    colocar(diag, capa.ElementID, k[2], k[3], k[4], k[5], null, 0);
  }

  // Paquetes con sus artefactos adentro
  for (var p = 0; p < PAQUETES.length; p++) {
    var d = PAQUETES[p];
    var sub = raiz.Packages.AddNew(d[1], "");
    sub.Update();
    raiz.Packages.Refresh();
    el[d[0]] = sub.Element;
    colocar(diag, sub.Element.ElementID, d[2], d[3], d[4], d[5], COLOR_PAQUETE, 1);

    var arts = d[6];
    for (var a = 0; a < arts.length; a++) {
      var art = sub.Elements.AddNew(arts[a], "Artifact");
      art.Stereotype = "artifact";
      art.Update();
      sub.Elements.Refresh();
      var top = d[3] + 40 + a * 58;
      colocar(diag, art.ElementID, d[2] + 25, top, d[4] - 25, top + 48, COLOR_ARTEFACTO, 2);
    }
  }

  // Base de datos («database» con sus características como atributos)
  var bd = raiz.Elements.AddNew(BD.nombre, "Class");
  bd.Stereotype = "database";
  bd.Update();
  for (var t = 0; t < BD.atributos.length; t++) {
    var at = bd.Attributes.AddNew(BD.atributos[t], "");
    at.Visibility = "Public";
    at.Pos = t;   // mantener el orden de la lista
    at.Update();
  }
  bd.Attributes.Refresh();
  bd.Update();
  raiz.Elements.Refresh();
  el["bd"] = bd;
  colocar(diag, bd.ElementID, BD.l, BD.t, BD.r, BD.b, COLOR_BD, 1);

  // Dependencias entre capas
  for (var n = 0; n < DEPENDENCIAS.length; n++) {
    var x = DEPENDENCIAS[n];
    var src = el[x[0]], dst = el[x[1]];
    if (src == null || dst == null) { log("  ! dependencia con elemento inexistente: " + x[0] + " -> " + x[1]); continue; }
    var cn = src.Connectors.AddNew(x[2], "Dependency");
    cn.SupplierID = dst.ElementID;
    cn.Direction = "Source -> Destination";
    cn.Update();
    src.Connectors.Refresh();
  }

  diag.Update();
  Repository.ReloadDiagram(diag.DiagramID);
  Repository.RefreshModelView(raiz.PackageID);
  Repository.OpenDiagram(diag.DiagramID);
  log("  capas: " + CAPAS.length + ", paquetes: " + PAQUETES.length + ", dependencias: " + DEPENDENCIAS.length);
  log("=== Listo ===");
}

main();
