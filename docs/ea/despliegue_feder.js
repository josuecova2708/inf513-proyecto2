!INC Local Scripts.EAConstants-JScript

/*
 * ===================================================================
 *  FEDER - INF513 (Proyecto 2, versión web)
 *  Diagrama de Despliegue
 * -------------------------------------------------------------------
 *  Lenguaje: JScript (Enterprise Architect)
 *  Uso: selecciona en el Project Browser el paquete destino,
 *       Specialize > Scripting > nuevo script JScript, pega y ejecuta.
 *       Crea (o recrea) el paquete "Diagrama de Despliegue - FEDER".
 *
 *  Datos verificados por SSH en el servidor (26/11/2026):
 *   - Fedora Linux 43 (Server Edition)
 *   - Apache 2.4.69 + PHP-FPM 8.4.28 (socket /run/php-fpm/www.sock)
 *   - PostgreSQL 18.6 en el mismo servidor (127.0.0.1:5432)
 *   - Node 22.22 / npm 10.9 / Composer 2.11 (build en el servidor)
 *   - Salida HTTPS a api.stripe.com disponible
 *  Del repositorio: deploy/desplegar.sh, deploy/htaccess.produccion,
 *  .env.production.example (sesiones, caché y colas en la BD; imágenes en storage).
 *
 *  Notación: «device» = equipo físico, «executionEnvironment» = software
 *  que ejecuta artefactos, «artifact» = archivos desplegados,
 *  componentes dentro del backend, «external system» = servicios de terceros.
 * ===================================================================
 */

var NOMBRE_PAQUETE = "Diagrama de Despliegue - FEDER";
var DY = 0;    // desplazamiento vertical global (por si hay que mover todo)

// Orden de dibujo (Z-order): en EA el objeto con Sequence MENOR queda encima.
// Si las cajas internas siguen tapadas por su contenedor, pon esto en false.
var MENOR_ENCIMA = true;

function rgb(r, g, b) { return r + g * 256 + b * 65536; }
var COLOR = {
  device:    rgb(248, 227, 207),   // durazno
  entorno:   rgb(214, 228, 250),   // celeste
  artefacto: rgb(220, 239, 224),   // verde claro
  componente:rgb(246, 217, 220),   // rosado
  externo:   rgb(207, 229, 247)    // azul claro
};

// ---- Elementos -----------------------------------------------------
// [id, padre, tipo EA, estereotipo, nombre, color, l, t, r, b]
// Distribución: navegadores arriba (bajan a Apache), Stripe a la derecha
// (Stripe.js a la altura del navegador, la API a la altura de la pasarela).
var ELEMENTOS = [
  // ---- Fila superior: clientes ----
  ["est",     null,    "Node", "device", "Estación de trabajo (Administrador / Personal / Productor)", "device", 20, 20, 400, 250],
  ["estNav",  "est",   "Node", "executionEnvironment", "Navegador web moderno", "entorno", 35, 80, 385, 235],
  ["estSpa",  "estNav","Artifact", "", "Panel SPA React 19 (bundle Vite)", "artefacto", 70, 135, 350, 195],

  ["cli",     null,    "Node", "device", "Dispositivo del Cliente (PC / móvil)", "device", 440, 20, 1000, 250],
  ["cliNav",  "cli",   "Node", "executionEnvironment", "Navegador web (Chrome / Safari móvil)", "entorno", 455, 80, 985, 235],
  ["cliSpa",  "cliNav","Artifact", "", "Tienda SPA React 19 (bundle Vite)", "artefacto", 475, 135, 715, 195],
  ["cliJs",   "cliNav","Artifact", "", "Stripe.js (Elements / 3D Secure)", "artefacto", 735, 135, 965, 195],

  // ---- Servidor tecnoweb ----
  ["srv",     null,    "Node", "device", "Servidor www.tecnoweb.org.bo  (/inf513/grupo28sa/proyecto2)", "device", 300, 320, 1180, 1360],
  ["so",      "srv",   "Node", "executionEnvironment", "SO: Fedora Linux 43 (Server Edition)", "entorno", 320, 370, 1160, 1340],

  ["apache",  "so",    "Node", "executionEnvironment", "Servidor web Apache 2.4.69 (alias /inf513/grupo28sa -> /home/grupo28sa)", "entorno", 340, 415, 1140, 555],
  ["build",   "apache","Artifact", "", "public/build (React compilado con Vite)", "artefacto", 365, 475, 740, 535],
  ["htacc",   "apache","Artifact", "", ".htaccess (mod_rewrite -> index.php)", "artefacto", 770, 475, 1115, 535],

  ["fpm",     "so",    "Node", "executionEnvironment", "PHP-FPM 8.4.28", "entorno", 340, 605, 1140, 940],
  ["lar",     "fpm",   "Component", "", "Backend FEDER - API REST (Laravel 13)", "artefacto", 360, 650, 1120, 925],
  ["mid",     "lar",   "Component", "", "Middleware (Sanctum, permisos, bitácora)", "componente", 380, 700, 610, 770],
  ["ctl",     "lar",   "Component", "", "Controladores API REST", "componente", 630, 700, 860, 770],
  ["pas",     "lar",   "Component", "", "Pasarela de pago (Stripe / simulada)", "componente", 880, 700, 1100, 770],
  ["img",     "lar",   "Artifact", "", "storage (imágenes WEBP)", "artefacto", 380, 820, 610, 890],
  ["svc",     "lar",   "Component", "", "Servicios (pedidos, pagos, notificaciones)", "componente", 630, 820, 860, 890],
  ["orm",     "lar",   "Component", "", "Eloquent / Query Builder", "componente", 880, 820, 1100, 890],

  ["pg",      "so",    "Node", "executionEnvironment", "RDBMS PostgreSQL 18.6", "entorno", 340, 980, 1140, 1200],
  ["db",      "pg",    "Artifact", "", "Esquema BD 'db_grupo28sa'", "artefacto", 360, 1025, 1120, 1185],
  ["dbTab",   "db",    "Component", "", "Tablas del negocio", "componente", 375, 1075, 555, 1165],
  ["dbFn",    "db",    "Component", "", "Vistas y funciones plpgsql", "componente", 565, 1075, 745, 1165],
  ["dbSeg",   "db",    "Component", "", "Bitácora y matriz rol_permiso", "componente", 755, 1075, 935, 1165],
  ["dbSes",   "db",    "Component", "", "Sesiones y caché", "componente", 945, 1075, 1105, 1165],

  ["tools",   "so",    "Node", "executionEnvironment", "Herramientas de despliegue (Node 22.22 · npm 10.9 · Composer 2.11)", "entorno", 340, 1225, 1140, 1325],
  ["deploy",  "tools", "Artifact", "", "deploy/desplegar.sh", "artefacto", 365, 1272, 700, 1315],

  // ---- Derecha: Stripe ----
  ["stripe",  null,    "Node", "external system", "Stripe (modo prueba)", "externo", 1240, 20, 1560, 800],
  ["stJs",    "stripe","Artifact", "", "Stripe.js js.stripe.com", "artefacto", 1265, 135, 1535, 195],
  ["stApi",   "stripe","Artifact", "", "API REST api.stripe.com", "artefacto", 1265, 705, 1535, 765]
];

// ---- Conexiones ----------------------------------------------------
// [origen, destino, tipo EA, etiqueta]
var CONEXIONES = [
  ["cliNav", "apache", "CommunicationPath", "HTTPS (443)"],
  ["estNav", "apache", "CommunicationPath", "HTTPS (443)"],
  ["cliJs",  "stJs",   "Dependency",        "HTTPS (Elements, 3D Secure)"],
  ["apache", "fpm",    "CommunicationPath", "FastCGI (/run/php-fpm/www.sock)"],
  ["orm",    "db",     "Dependency",        "TCP 127.0.0.1:5432 (pdo_pgsql)"],
  ["pas",    "stApi",  "Dependency",        "HTTPS REST (PaymentIntent / SetupIntent)"]
];

var NOTA_URL = "URL: https://www.tecnoweb.org.bo/inf513/grupo28sa/proyecto2";

// ===================================================================
function log(m) { Session.Output(m); }

function borrarPaquete(padre, nombre) {
  for (var i = padre.Packages.Count - 1; i >= 0; i--) {
    if (padre.Packages.GetAt(i).Name == nombre) padre.Packages.DeleteAt(i, true);
  }
  padre.Packages.Refresh();
}

function colocar(diag, elementId, l, t, r, b, color, nivel) {
  var o = diag.DiagramObjects.AddNew("l=" + l + ";r=" + r + ";t=" + (t + DY) + ";b=" + (b + DY) + ";", "");
  o.ElementID = elementId;
  if (color != null) o.Style = "BCol=" + color + ";BColor=" + color + ";LCol=0;LColor=0;LWth=1;";
  // Los contenidos deben dibujarse encima de su contenedor
  var seq = MENOR_ENCIMA ? (10 - nivel) : (nivel + 1);
  o.Sequence = seq;
  o.Update();
  try {
    Repository.Execute("UPDATE t_diagramobjects SET Sequence=" + seq +
                       " WHERE Diagram_ID=" + diag.DiagramID + " AND Object_ID=" + elementId);
  } catch (eS) {}
  return o;
}

function nivelDe(id, mapa) {
  var n = 0, d = mapa[id];
  while (d != null && d[1] != null) { n++; d = mapa[d[1]]; }
  return n;
}

function main() {
  Repository.EnsureOutputVisible("Script");
  Repository.ClearOutput("Script");
  log("=== Diagrama de despliegue - FEDER ===");

  var sel = Repository.GetTreeSelectedPackage();
  if (sel == null) {
    Session.Prompt("Selecciona un paquete antes de ejecutar el script.", promptOK);
    return;
  }

  borrarPaquete(sel, NOMBRE_PAQUETE);
  var pkg = sel.Packages.AddNew(NOMBRE_PAQUETE, "");
  pkg.Update();
  sel.Packages.Refresh();

  var diag = pkg.Diagrams.AddNew("Diagrama de Despliegue - FEDER", "Deployment");
  diag.Orientation = "L";
  diag.Update();
  pkg.Diagrams.Refresh();

  // Elementos (los padres van antes que los hijos: quedan anidados y dibujados debajo)
  var el = {}, mapa = {};
  for (var j = 0; j < ELEMENTOS.length; j++) mapa[ELEMENTOS[j][0]] = ELEMENTOS[j];
  for (var i = 0; i < ELEMENTOS.length; i++) {
    var d = ELEMENTOS[i];
    var padre = (d[1] == null) ? null : el[d[1]];
    if (d[1] != null && padre == null) throw new Error("El padre '" + d[1] + "' de '" + d[0] + "' no existe todavía");
    var coleccion = (padre == null) ? pkg.Elements : padre.Elements;
    var e = coleccion.AddNew(d[4], d[2]);
    if (d[3] != "") { e.Stereotype = d[3]; }
    e.Update();
    coleccion.Refresh();
    el[d[0]] = e;
    colocar(diag, e.ElementID, d[6], d[7], d[8], d[9], COLOR[d[5]], nivelDe(d[0], mapa));
  }

  // Nota con la URL del despliegue, debajo de Stripe
  var nota = pkg.Elements.AddNew("", "Note");
  nota.Notes = NOTA_URL;
  nota.Update();
  pkg.Elements.Refresh();
  colocar(diag, nota.ElementID, 1240, 860, 1560, 930, null, 0);

  // Conexiones
  for (var c = 0; c < CONEXIONES.length; c++) {
    var k = CONEXIONES[c];
    var src = el[k[0]], dst = el[k[1]];
    if (src == null || dst == null) { log("  ! conexión con elemento inexistente: " + k[0] + " -> " + k[1]); continue; }
    var cn = src.Connectors.AddNew(k[3], k[2]);
    cn.SupplierID = dst.ElementID;
    if (k[2] == "Dependency") cn.Direction = "Source -> Destination";
    cn.Update();
    src.Connectors.Refresh();
  }

  diag.Update();
  Repository.ReloadDiagram(diag.DiagramID);
  Repository.RefreshModelView(pkg.PackageID);
  Repository.OpenDiagram(diag.DiagramID);
  log("  elementos: " + ELEMENTOS.length + ", conexiones: " + CONEXIONES.length);
  log("=== Listo ===");
}

main();
