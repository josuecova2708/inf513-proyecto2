# Matriz de acceso (RBAC)

Generada desde `database/seeders/RolesPermisosSeeder.php` (estado inicial: el Administrador puede editarla en *Roles y permisos*).
Letras: **V**er, **C**rear, **E**ditar, **B**orrar. Un guion indica sin acceso, y entonces el módulo tampoco aparece en el menú.

Además de la matriz, los Services limitan al **Productor** y al **Cliente** a sus propios datos (sus pedidos, su emprendimiento, su producción).

| Módulo | Administrador | Personal | Productor | Cliente |
|---|---|---|---|---|
| Panel analítico (dashboard) (`dashboard`) | V | V | — | — |
| Gestionar usuarios (`usuarios`) | VCEB | V | — | — |
| Roles y matriz de permisos (`roles`) | VCEB | — | — | — |
| Bitácora de auditoría (`bitacora`) | V | — | — | — |
| Mi perfil (`perfil`) | VE | VE | VE | VE |
| Comunidades agrícolas (`comunidades`) | VCEB | VCEB | V | — |
| Productores / emprendimientos (`emprendimientos`) | VCEB | VCEB | VE | — |
| Productos ofrecidos por productor (`ofertas`) | VCEB | VCEB | VCB | — |
| Producción agrícola (`produccion`) | VCEB | VCEB | VC | — |
| Lotes y trazabilidad (`lotes`) | VCEB | VCEB | V | — |
| Catálogo de productos (`catalogo`) | VCEB | VCEB | V | V |
| Inventario y alertas (`inventario`) | VCEB | VCEB | — | — |
| Carrito de compras (`carrito`) | — | — | — | VCEB |
| Encargos (`encargos`) | VCEB | VCEB | — | VCB |
| Pedidos (`pedidos`) | VCEB | VCEB | — | VB |
| Pagos (`pagos`) | VCEB | VCE | — | VC |
| Mis métodos de pago (`metodos_pago`) | V | — | — | VCEB |
| Planes de pago (`planes_pago`) | VCEB | VCE | — | VC |
| Entregas (`entregas`) | VCEB | VCE | — | V |
| Notificaciones (`notificaciones`) | V | V | V | V |
| Indicadores financieros (`finanzas`) | V | V | — | — |
| Reportes y estadísticas (`reportes`) | V | V | — | — |
| QR de cobro (`qr`) | VCEB | V | — | — |

## Menú dinámico

La tabla `menu` define cada opción (título, ruta, ícono, orden y padre) y el módulo que la habilita. `GET /api/auth/me` devuelve solo las opciones cuyo módulo tiene permiso **ver** para el rol del usuario; los grupos sin hijos visibles se omiten. El frontend dibuja el árbol tal como llega (`resources/js/layouts/PanelLayout.jsx`).

| Opción | Ruta | Módulo |
|---|---|---|
| **Inicio** | /panel | siempre visible |
| **Dashboard** | /panel/dashboard | dashboard |
| **Administración** | — | grupo |
| ↳ Usuarios | /panel/usuarios | usuarios |
| ↳ Roles y permisos | /panel/roles | roles |
| ↳ Bitácora | /panel/bitacora | bitacora |
| **Operación** | — | grupo |
| ↳ Comunidades | /panel/comunidades | comunidades |
| ↳ Productores | /panel/emprendimientos | emprendimientos |
| ↳ Producción | /panel/produccion | produccion |
| ↳ Lotes | /panel/lotes | lotes |
| ↳ Trazabilidad | /panel/trazabilidad | lotes |
| **Catálogo e inventario** | — | grupo |
| ↳ Categorías | /panel/categorias | inventario |
| ↳ Productos | /panel/productos | inventario |
| ↳ Inventario | /panel/inventario | inventario |
| ↳ Alertas | /panel/alertas | inventario |
| **Comercial** | — | grupo |
| ↳ Tienda | /catalogo | carrito |
| ↳ Mi carrito | /carrito | carrito |
| ↳ Encargos | /panel/encargos | encargos |
| ↳ Pedidos | /panel/pedidos | pedidos |
| ↳ Entregas | /panel/entregas | entregas |
| **Pagos** | — | grupo |
| ↳ Pagos | /panel/pagos | pagos |
| ↳ Planes de pago | /panel/planes | planes_pago |
| ↳ Mis métodos de pago | /panel/metodos-pago | metodos_pago |
| ↳ QR de cobro | /panel/qr | qr |
| **Análisis** | — | grupo |
| ↳ Indicadores financieros | /panel/finanzas | finanzas |
| ↳ Reportes | /panel/reportes | reportes |
| **Notificaciones** | /panel/notificaciones | notificaciones |
| **Mi perfil** | /panel/perfil | perfil |
