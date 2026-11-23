<?php

use App\Http\Controllers\Api\AlertaController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BitacoraController;
use App\Http\Controllers\Api\BusquedaController;
use App\Http\Controllers\Api\CarritoController;
use App\Http\Controllers\Api\CatalogoController;
use App\Http\Controllers\Api\CategoriaController;
use App\Http\Controllers\Api\ComunidadController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmprendimientoController;
use App\Http\Controllers\Api\EncargoController;
use App\Http\Controllers\Api\EntregaController;
use App\Http\Controllers\Api\FinanzasController;
use App\Http\Controllers\Api\InventarioController;
use App\Http\Controllers\Api\LoteController;
use App\Http\Controllers\Api\MetodoPagoUsuarioController;
use App\Http\Controllers\Api\NotificacionController;
use App\Http\Controllers\Api\PagoController;
use App\Http\Controllers\Api\PedidoController;
use App\Http\Controllers\Api\PlanPagoController;
use App\Http\Controllers\Api\ProduccionController;
use App\Http\Controllers\Api\ProductoController;
use App\Http\Controllers\Api\QrController;
use App\Http\Controllers\Api\ReporteController;
use App\Http\Controllers\Api\RolController;
use App\Http\Controllers\Api\UsuarioController;
use App\Http\Controllers\Api\VisitaController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API RESTful FEDER (capa de lógica de negocio)
|--------------------------------------------------------------------------
| Autenticación: Sanctum (token Bearer). Autorización: middleware
| "permiso:modulo,accion" contra la matriz rol_permiso. Toda petición
| queda registrada en la bitácora (middleware RegistrarBitacora).
*/

// ---------- Público ----------
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
Route::post('auth/registro', [AuthController::class, 'registro'])->middleware('throttle:10,1');
Route::post('visitas', [VisitaController::class, 'registrar'])->middleware('throttle:120,1');
Route::get('buscar', [BusquedaController::class, 'buscar'])->middleware('throttle:90,1');
Route::get('catalogo', [CatalogoController::class, 'index']);
Route::get('catalogo/portada', [CatalogoController::class, 'portada']);
Route::get('catalogo/{id}', [CatalogoController::class, 'show'])->whereNumber('id');
Route::get('categorias/publicas', [CatalogoController::class, 'categorias']);
Route::get('qr/activo/imagen', [QrController::class, 'imagen']);

// ---------- Autenticado ----------
Route::middleware('auth:sanctum')->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::put('auth/perfil', [AuthController::class, 'actualizarPerfil'])->middleware('permiso:perfil,editar');
    Route::put('preferencias', [AuthController::class, 'guardarPreferencias']);

    // ===== CU1: Usuarios, roles, permisos y bitácora =====
    Route::get('usuarios', [UsuarioController::class, 'index'])->middleware('permiso:usuarios,ver');
    Route::post('usuarios', [UsuarioController::class, 'store'])->middleware('permiso:usuarios,crear');
    Route::get('usuarios/{id}', [UsuarioController::class, 'show'])->middleware('permiso:usuarios,ver');
    Route::put('usuarios/{id}', [UsuarioController::class, 'update'])->middleware('permiso:usuarios,editar');
    Route::delete('usuarios/{id}', [UsuarioController::class, 'destroy'])->middleware('permiso:usuarios,eliminar');
    Route::get('roles', [RolController::class, 'index'])->middleware('permiso:roles|usuarios,ver');
    Route::get('roles/{id}/permisos', [RolController::class, 'permisos'])->middleware('permiso:roles,ver');
    Route::put('roles/{id}/permisos', [RolController::class, 'guardarPermisos'])->middleware('permiso:roles,editar');
    Route::get('bitacora', [BitacoraController::class, 'index'])->middleware('permiso:bitacora,ver');
    Route::get('bitacora/resumen', [BitacoraController::class, 'resumen'])->middleware('permiso:bitacora,ver');

    // ===== CU2: Productores y comunidades =====
    Route::get('comunidades', [ComunidadController::class, 'index'])->middleware('permiso:comunidades,ver');
    Route::post('comunidades', [ComunidadController::class, 'store'])->middleware('permiso:comunidades,crear');
    Route::put('comunidades/{id}', [ComunidadController::class, 'update'])->middleware('permiso:comunidades,editar');
    Route::delete('comunidades/{id}', [ComunidadController::class, 'destroy'])->middleware('permiso:comunidades,eliminar');
    Route::get('emprendimientos', [EmprendimientoController::class, 'index'])->middleware('permiso:emprendimientos,ver');
    Route::post('emprendimientos', [EmprendimientoController::class, 'store'])->middleware('permiso:emprendimientos,crear');
    Route::get('emprendimientos/{id}', [EmprendimientoController::class, 'show'])->middleware('permiso:emprendimientos,ver');
    Route::put('emprendimientos/{id}', [EmprendimientoController::class, 'update'])->middleware('permiso:emprendimientos,editar');
    Route::delete('emprendimientos/{id}', [EmprendimientoController::class, 'destroy'])->middleware('permiso:emprendimientos,eliminar');
    Route::post('emprendimientos/{id}/ofertas', [EmprendimientoController::class, 'guardarOferta'])->middleware('permiso:ofertas,crear');
    Route::delete('emprendimientos/{id}/ofertas/{productoId}', [EmprendimientoController::class, 'eliminarOferta'])->middleware('permiso:ofertas,eliminar');

    // ===== CU3: Producción, lotes y trazabilidad =====
    Route::get('producciones', [ProduccionController::class, 'index'])->middleware('permiso:produccion,ver');
    Route::post('producciones', [ProduccionController::class, 'store'])->middleware('permiso:produccion,crear');
    Route::put('producciones/{id}', [ProduccionController::class, 'update'])->middleware('permiso:produccion,editar');
    Route::put('producciones/{id}/validar', [ProduccionController::class, 'validar'])->middleware('permiso:produccion,editar');
    Route::delete('producciones/{id}', [ProduccionController::class, 'destroy'])->middleware('permiso:produccion,eliminar');
    Route::get('lotes', [LoteController::class, 'index'])->middleware('permiso:lotes,ver');
    Route::post('lotes', [LoteController::class, 'store'])->middleware('permiso:lotes,crear');
    Route::put('lotes/{id}', [LoteController::class, 'update'])->middleware('permiso:lotes,editar');
    Route::get('trazabilidad/lote/{codigo}', [LoteController::class, 'trazabilidadLote'])->middleware('permiso:lotes,ver');
    Route::get('trazabilidad/pedido/{numero}', [LoteController::class, 'trazabilidadPedido'])->middleware('permiso:lotes,ver');

    // ===== CU4: Catálogo, inventario, alertas =====
    Route::get('categorias', [CategoriaController::class, 'index'])->middleware('permiso:catalogo,ver');
    Route::post('categorias', [CategoriaController::class, 'store'])->middleware('permiso:catalogo,crear');
    Route::put('categorias/{id}', [CategoriaController::class, 'update'])->middleware('permiso:catalogo,editar');
    Route::delete('categorias/{id}', [CategoriaController::class, 'destroy'])->middleware('permiso:catalogo,eliminar');
    Route::get('productos', [ProductoController::class, 'index'])->middleware('permiso:catalogo,ver');
    Route::post('productos', [ProductoController::class, 'store'])->middleware('permiso:catalogo,crear');
    Route::post('productos/{id}', [ProductoController::class, 'update'])->middleware('permiso:catalogo,editar'); // multipart (imagen)
    Route::delete('productos/{id}', [ProductoController::class, 'destroy'])->middleware('permiso:catalogo,eliminar');
    Route::get('inventario/disponibilidad', [InventarioController::class, 'disponibilidad'])->middleware('permiso:inventario,ver');
    Route::get('inventario/movimientos', [InventarioController::class, 'movimientos'])->middleware('permiso:inventario,ver');
    Route::post('inventario/movimientos', [InventarioController::class, 'registrarMovimiento'])->middleware('permiso:inventario,crear');
    Route::get('alertas', [AlertaController::class, 'index'])->middleware('permiso:inventario,ver');
    Route::put('alertas/{id}/atender', [AlertaController::class, 'atender'])->middleware('permiso:inventario,editar');

    // ===== CU5: Carrito, ventas inmediatas y encargos =====
    Route::middleware('permiso:carrito,ver')->group(function () {
        Route::get('carrito', [CarritoController::class, 'ver']);
        Route::post('carrito/items', [CarritoController::class, 'agregar'])->middleware('permiso:carrito,crear');
        Route::put('carrito/items/{productoId}', [CarritoController::class, 'actualizar'])->middleware('permiso:carrito,editar');
        Route::delete('carrito/items/{productoId}', [CarritoController::class, 'quitar'])->middleware('permiso:carrito,eliminar');
        Route::delete('carrito', [CarritoController::class, 'vaciar'])->middleware('permiso:carrito,eliminar');
        Route::post('carrito/confirmar', [CarritoController::class, 'confirmar'])->middleware('permiso:carrito,crear');
    });
    Route::get('encargos', [EncargoController::class, 'index'])->middleware('permiso:encargos,ver');
    Route::post('encargos', [EncargoController::class, 'store'])->middleware('permiso:encargos,crear');
    Route::get('encargos/{id}', [EncargoController::class, 'show'])->middleware('permiso:encargos,ver');
    Route::put('encargos/{id}/estado', [EncargoController::class, 'cambiarEstado'])->middleware('permiso:encargos,editar');
    Route::post('encargos/{id}/cancelar', [EncargoController::class, 'cancelar'])->middleware('permiso:encargos,eliminar');
    Route::post('encargos/{id}/convertir', [EncargoController::class, 'convertir'])->middleware('permiso:encargos,ver');

    // ===== CU6: Pedidos, pagos multicanal, entregas y notificaciones =====
    Route::get('pedidos', [PedidoController::class, 'index'])->middleware('permiso:pedidos,ver');
    Route::get('pedidos/{id}', [PedidoController::class, 'show'])->middleware('permiso:pedidos,ver');
    Route::put('pedidos/{id}/estado', [PedidoController::class, 'cambiarEstado'])->middleware('permiso:pedidos,editar');
    Route::post('pedidos/{id}/cancelar', [PedidoController::class, 'cancelar'])->middleware('permiso:pedidos,eliminar');
    Route::get('metodos-pago', [PagoController::class, 'metodos']);
    Route::get('pagos', [PagoController::class, 'index'])->middleware('permiso:pagos,ver');
    Route::post('pedidos/{id}/pagar', [PagoController::class, 'pagar'])->middleware('permiso:pagos,crear');
    Route::put('pagos/{id}/verificar', [PagoController::class, 'verificar'])->middleware('permiso:pagos,editar');
    Route::get('mis-metodos-pago', [MetodoPagoUsuarioController::class, 'index'])->middleware('permiso:metodos_pago,ver');
    Route::post('mis-metodos-pago', [MetodoPagoUsuarioController::class, 'store'])->middleware('permiso:metodos_pago,crear');
    Route::put('mis-metodos-pago/{id}', [MetodoPagoUsuarioController::class, 'update'])->middleware('permiso:metodos_pago,editar');
    Route::delete('mis-metodos-pago/{id}', [MetodoPagoUsuarioController::class, 'destroy'])->middleware('permiso:metodos_pago,eliminar');
    Route::get('planes', [PlanPagoController::class, 'index'])->middleware('permiso:planes_pago,ver');
    Route::post('pedidos/{id}/plan', [PlanPagoController::class, 'store'])->middleware('permiso:planes_pago,crear');
    Route::post('cuotas/{id}/pagar', [PlanPagoController::class, 'pagarCuota'])->middleware('permiso:pagos,crear');
    Route::get('entregas', [EntregaController::class, 'index'])->middleware('permiso:entregas,ver');
    Route::put('entregas/{id}', [EntregaController::class, 'update'])->middleware('permiso:entregas,editar');
    Route::get('qr', [QrController::class, 'index'])->middleware('permiso:qr,ver');
    Route::post('qr', [QrController::class, 'store'])->middleware('permiso:qr,crear');
    Route::get('notificaciones', [NotificacionController::class, 'index'])->middleware('permiso:notificaciones,ver');
    Route::get('notificaciones/no-leidas', [NotificacionController::class, 'noLeidas'])->middleware('permiso:notificaciones,ver');
    Route::put('notificaciones/leer-todas', [NotificacionController::class, 'leerTodas'])->middleware('permiso:notificaciones,ver');
    Route::put('notificaciones/{id}/leer', [NotificacionController::class, 'leer'])->middleware('permiso:notificaciones,ver');

    // ===== CU7 y CU8: Indicadores financieros, reportes y dashboard =====
    Route::get('dashboard', [DashboardController::class, 'index'])->middleware('permiso:dashboard,ver');
    Route::get('panel/resumen', [DashboardController::class, 'resumenUsuario']);
    Route::get('finanzas/indicadores', [FinanzasController::class, 'indicadores'])->middleware('permiso:finanzas,ver');
    Route::get('reportes/{tipo}', [ReporteController::class, 'generar'])->middleware('permiso:reportes,ver');
});
