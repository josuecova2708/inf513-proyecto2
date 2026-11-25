# Catálogo de endpoints de la API REST

Base: `/api` (en producción `https://www.tecnoweb.org.bo/inf513/grupo28sa/proyecto2/api`).
Autenticación: cabecera `Authorization: Bearer <token>` (Laravel Sanctum). Respuestas en JSON; los errores llegan como `{ "message": "...", "errors": { campo: [...] } }`, en español.

Columna **Permiso**: `modulo,acción` que exige el middleware `permiso` contra la matriz `rol_permiso`. *Público* = sin sesión; *Sesión* = basta con el token.

| Método | Ruta | Controlador | Permiso |
|---|---|---|---|
| GET | `/api/alertas` | AlertaController@index | `inventario,ver` |
| PUT | `/api/alertas/{id}/atender` | AlertaController@atender | `inventario,editar` |
| POST | `/api/auth/login` | AuthController@login | Público |
| POST | `/api/auth/logout` | AuthController@logout | Sesión |
| GET | `/api/auth/me` | AuthController@me | Sesión |
| PUT | `/api/auth/perfil` | AuthController@actualizarPerfil | `perfil,editar` |
| POST | `/api/auth/registro` | AuthController@registro | Público |
| GET | `/api/bitacora` | BitacoraController@index | `bitacora,ver` |
| GET | `/api/bitacora/resumen` | BitacoraController@resumen | `bitacora,ver` |
| GET | `/api/buscar` | BusquedaController@buscar | Público |
| GET | `/api/carrito` | CarritoController@ver | `carrito,ver` |
| DELETE | `/api/carrito` | CarritoController@vaciar | `carrito,ver` + `carrito,eliminar` |
| POST | `/api/carrito/confirmar` | CarritoController@confirmar | `carrito,ver` + `carrito,crear` |
| POST | `/api/carrito/items` | CarritoController@agregar | `carrito,ver` + `carrito,crear` |
| PUT | `/api/carrito/items/{productoId}` | CarritoController@actualizar | `carrito,ver` + `carrito,editar` |
| DELETE | `/api/carrito/items/{productoId}` | CarritoController@quitar | `carrito,ver` + `carrito,eliminar` |
| GET | `/api/catalogo` | CatalogoController@index | Público |
| GET | `/api/catalogo/portada` | CatalogoController@portada | Público |
| GET | `/api/catalogo/{id}` | CatalogoController@show | Público |
| GET | `/api/categorias` | CategoriaController@index | `catalogo,ver` |
| POST | `/api/categorias` | CategoriaController@store | `catalogo,crear` |
| GET | `/api/categorias/publicas` | CatalogoController@categorias | Público |
| PUT | `/api/categorias/{id}` | CategoriaController@update | `catalogo,editar` |
| DELETE | `/api/categorias/{id}` | CategoriaController@destroy | `catalogo,eliminar` |
| GET | `/api/comunidades` | ComunidadController@index | `comunidades,ver` |
| POST | `/api/comunidades` | ComunidadController@store | `comunidades,crear` |
| PUT | `/api/comunidades/{id}` | ComunidadController@update | `comunidades,editar` |
| DELETE | `/api/comunidades/{id}` | ComunidadController@destroy | `comunidades,eliminar` |
| POST | `/api/cuotas/{id}/pagar` | PlanPagoController@pagarCuota | `pagos,crear` |
| GET | `/api/dashboard` | DashboardController@index | `dashboard,ver` |
| GET | `/api/emprendimientos` | EmprendimientoController@index | `emprendimientos,ver` |
| POST | `/api/emprendimientos` | EmprendimientoController@store | `emprendimientos,crear` |
| GET | `/api/emprendimientos/{id}` | EmprendimientoController@show | `emprendimientos,ver` |
| PUT | `/api/emprendimientos/{id}` | EmprendimientoController@update | `emprendimientos,editar` |
| DELETE | `/api/emprendimientos/{id}` | EmprendimientoController@destroy | `emprendimientos,eliminar` |
| POST | `/api/emprendimientos/{id}/imagen` | EmprendimientoController@subirImagen | `emprendimientos,editar` |
| DELETE | `/api/emprendimientos/{id}/imagen` | EmprendimientoController@quitarImagen | `emprendimientos,editar` |
| POST | `/api/emprendimientos/{id}/ofertas` | EmprendimientoController@guardarOferta | `ofertas,crear` |
| DELETE | `/api/emprendimientos/{id}/ofertas/{productoId}` | EmprendimientoController@eliminarOferta | `ofertas,eliminar` |
| GET | `/api/encargos` | EncargoController@index | `encargos,ver` |
| POST | `/api/encargos` | EncargoController@store | `encargos,crear` |
| GET | `/api/encargos/{id}` | EncargoController@show | `encargos,ver` |
| POST | `/api/encargos/{id}/cancelar` | EncargoController@cancelar | `encargos,eliminar` |
| POST | `/api/encargos/{id}/convertir` | EncargoController@convertir | `encargos,ver` |
| PUT | `/api/encargos/{id}/estado` | EncargoController@cambiarEstado | `encargos,editar` |
| GET | `/api/entregas` | EntregaController@index | `entregas,ver` |
| PUT | `/api/entregas/{id}` | EntregaController@update | `entregas,editar` |
| GET | `/api/finanzas/indicadores` | FinanzasController@indicadores | `finanzas,ver` |
| GET | `/api/inventario/disponibilidad` | InventarioController@disponibilidad | `inventario,ver` |
| GET | `/api/inventario/movimientos` | InventarioController@movimientos | `inventario,ver` |
| POST | `/api/inventario/movimientos` | InventarioController@registrarMovimiento | `inventario,crear` |
| GET | `/api/lotes` | LoteController@index | `lotes,ver` |
| POST | `/api/lotes` | LoteController@store | `lotes,crear` |
| PUT | `/api/lotes/{id}` | LoteController@update | `lotes,editar` |
| GET | `/api/metodos-pago` | PagoController@metodos | Sesión |
| GET | `/api/mis-metodos-pago` | MetodoPagoUsuarioController@index | `metodos_pago,ver` |
| POST | `/api/mis-metodos-pago` | MetodoPagoUsuarioController@store | `metodos_pago,crear` |
| POST | `/api/mis-metodos-pago/setup-intent` | MetodoPagoUsuarioController@setupIntent | `metodos_pago,crear` |
| PUT | `/api/mis-metodos-pago/{id}` | MetodoPagoUsuarioController@update | `metodos_pago,editar` |
| DELETE | `/api/mis-metodos-pago/{id}` | MetodoPagoUsuarioController@destroy | `metodos_pago,eliminar` |
| GET | `/api/notificaciones` | NotificacionController@index | `notificaciones,ver` |
| PUT | `/api/notificaciones/leer-todas` | NotificacionController@leerTodas | `notificaciones,ver` |
| GET | `/api/notificaciones/no-leidas` | NotificacionController@noLeidas | `notificaciones,ver` |
| PUT | `/api/notificaciones/{id}/leer` | NotificacionController@leer | `notificaciones,ver` |
| GET | `/api/pagos` | PagoController@index | `pagos,ver` |
| POST | `/api/pagos/{id}/confirmar` | PagoController@confirmar | `pagos,crear` |
| PUT | `/api/pagos/{id}/verificar` | PagoController@verificar | `pagos,editar` |
| GET | `/api/panel/resumen` | DashboardController@resumenUsuario | Sesión |
| GET | `/api/pedidos` | PedidoController@index | `pedidos,ver` |
| GET | `/api/pedidos/{id}` | PedidoController@show | `pedidos,ver` |
| POST | `/api/pedidos/{id}/cancelar` | PedidoController@cancelar | `pedidos,eliminar` |
| PUT | `/api/pedidos/{id}/estado` | PedidoController@cambiarEstado | `pedidos,editar` |
| POST | `/api/pedidos/{id}/pagar` | PagoController@pagar | `pagos,crear` |
| POST | `/api/pedidos/{id}/plan` | PlanPagoController@store | `planes_pago,crear` |
| GET | `/api/planes` | PlanPagoController@index | `planes_pago,ver` |
| PUT | `/api/preferencias` | AuthController@guardarPreferencias | Sesión |
| GET | `/api/producciones` | ProduccionController@index | `produccion,ver` |
| POST | `/api/producciones` | ProduccionController@store | `produccion,crear` |
| PUT | `/api/producciones/{id}` | ProduccionController@update | `produccion,editar` |
| DELETE | `/api/producciones/{id}` | ProduccionController@destroy | `produccion,eliminar` |
| PUT | `/api/producciones/{id}/validar` | ProduccionController@validar | `produccion,editar` |
| GET | `/api/productos` | ProductoController@index | `catalogo,ver` |
| POST | `/api/productos` | ProductoController@store | `catalogo,crear` |
| POST | `/api/productos/{id}` | ProductoController@update | `catalogo,editar` |
| DELETE | `/api/productos/{id}` | ProductoController@destroy | `catalogo,eliminar` |
| GET | `/api/qr` | QrController@index | `qr,ver` |
| POST | `/api/qr` | QrController@store | `qr,crear` |
| GET | `/api/qr/activo/imagen` | QrController@imagen | Público |
| GET | `/api/reportes/{tipo}` | ReporteController@generar | `reportes,ver` |
| GET | `/api/roles` | RolController@index | `roles o usuarios,ver` |
| GET | `/api/roles/{id}/permisos` | RolController@permisos | `roles,ver` |
| PUT | `/api/roles/{id}/permisos` | RolController@guardarPermisos | `roles,editar` |
| GET | `/api/trazabilidad/lote/{codigo}` | LoteController@trazabilidadLote | `lotes,ver` |
| GET | `/api/trazabilidad/pedido/{numero}` | LoteController@trazabilidadPedido | `lotes,ver` |
| GET | `/api/usuarios` | UsuarioController@index | `usuarios,ver` |
| POST | `/api/usuarios` | UsuarioController@store | `usuarios,crear` |
| GET | `/api/usuarios/{id}` | UsuarioController@show | `usuarios,ver` |
| PUT | `/api/usuarios/{id}` | UsuarioController@update | `usuarios,editar` |
| DELETE | `/api/usuarios/{id}` | UsuarioController@destroy | `usuarios,eliminar` |
| POST | `/api/visitas` | VisitaController@registrar | Público |
