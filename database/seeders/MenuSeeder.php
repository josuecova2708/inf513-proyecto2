<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Menú dinámico. Cada opción apunta a un módulo (permiso); el backend solo envía
 * las opciones cuyo módulo tenga "ver" para el rol del usuario. Los grupos (padre)
 * se muestran si tienen al menos un hijo visible.
 * Iconos: nombres de lucide-react.
 */
class MenuSeeder extends Seeder
{
    public const MENU = [
        ['titulo' => 'Inicio', 'ruta' => '/panel', 'icono' => 'House', 'modulo' => null],
        ['titulo' => 'Dashboard', 'ruta' => '/panel/dashboard', 'icono' => 'LayoutDashboard', 'modulo' => 'dashboard'],
        ['titulo' => 'Administración', 'icono' => 'ShieldCheck', 'hijos' => [
            ['titulo' => 'Usuarios', 'ruta' => '/panel/usuarios', 'icono' => 'Users', 'modulo' => 'usuarios'],
            ['titulo' => 'Roles y permisos', 'ruta' => '/panel/roles', 'icono' => 'KeyRound', 'modulo' => 'roles'],
            ['titulo' => 'Bitácora', 'ruta' => '/panel/bitacora', 'icono' => 'ScrollText', 'modulo' => 'bitacora'],
        ]],
        ['titulo' => 'Operación', 'icono' => 'Sprout', 'hijos' => [
            ['titulo' => 'Comunidades', 'ruta' => '/panel/comunidades', 'icono' => 'MapPinned', 'modulo' => 'comunidades'],
            ['titulo' => 'Productores', 'ruta' => '/panel/emprendimientos', 'icono' => 'Tractor', 'modulo' => 'emprendimientos'],
            ['titulo' => 'Producción', 'ruta' => '/panel/produccion', 'icono' => 'Wheat', 'modulo' => 'produccion'],
            ['titulo' => 'Lotes', 'ruta' => '/panel/lotes', 'icono' => 'Boxes', 'modulo' => 'lotes'],
            ['titulo' => 'Trazabilidad', 'ruta' => '/panel/trazabilidad', 'icono' => 'Route', 'modulo' => 'lotes'],
        ]],
        ['titulo' => 'Catálogo e inventario', 'icono' => 'Package', 'hijos' => [
            ['titulo' => 'Categorías', 'ruta' => '/panel/categorias', 'icono' => 'Tags', 'modulo' => 'inventario'],
            ['titulo' => 'Productos', 'ruta' => '/panel/productos', 'icono' => 'Apple', 'modulo' => 'inventario'],
            ['titulo' => 'Inventario', 'ruta' => '/panel/inventario', 'icono' => 'Warehouse', 'modulo' => 'inventario'],
            ['titulo' => 'Alertas', 'ruta' => '/panel/alertas', 'icono' => 'TriangleAlert', 'modulo' => 'inventario'],
        ]],
        ['titulo' => 'Comercial', 'icono' => 'ShoppingBag', 'hijos' => [
            ['titulo' => 'Tienda', 'ruta' => '/catalogo', 'icono' => 'Store', 'modulo' => 'carrito'],
            ['titulo' => 'Mi carrito', 'ruta' => '/carrito', 'icono' => 'ShoppingCart', 'modulo' => 'carrito'],
            ['titulo' => 'Encargos', 'ruta' => '/panel/encargos', 'icono' => 'ClipboardList', 'modulo' => 'encargos'],
            ['titulo' => 'Pedidos', 'ruta' => '/panel/pedidos', 'icono' => 'Receipt', 'modulo' => 'pedidos'],
            ['titulo' => 'Entregas', 'ruta' => '/panel/entregas', 'icono' => 'Truck', 'modulo' => 'entregas'],
        ]],
        ['titulo' => 'Pagos', 'icono' => 'Wallet', 'hijos' => [
            ['titulo' => 'Pagos', 'ruta' => '/panel/pagos', 'icono' => 'Banknote', 'modulo' => 'pagos'],
            ['titulo' => 'Planes de pago', 'ruta' => '/panel/planes', 'icono' => 'CalendarClock', 'modulo' => 'planes_pago'],
            ['titulo' => 'Mis métodos de pago', 'ruta' => '/panel/metodos-pago', 'icono' => 'CreditCard', 'modulo' => 'metodos_pago'],
            ['titulo' => 'QR de cobro', 'ruta' => '/panel/qr', 'icono' => 'QrCode', 'modulo' => 'qr'],
        ]],
        ['titulo' => 'Análisis', 'icono' => 'ChartLine', 'hijos' => [
            ['titulo' => 'Indicadores financieros', 'ruta' => '/panel/finanzas', 'icono' => 'TrendingUp', 'modulo' => 'finanzas'],
            ['titulo' => 'Reportes', 'ruta' => '/panel/reportes', 'icono' => 'FileChartColumn', 'modulo' => 'reportes'],
        ]],
        ['titulo' => 'Notificaciones', 'ruta' => '/panel/notificaciones', 'icono' => 'Bell', 'modulo' => 'notificaciones'],
        ['titulo' => 'Mi perfil', 'ruta' => '/panel/perfil', 'icono' => 'CircleUser', 'modulo' => 'perfil'],
    ];

    public function run(): void
    {
        DB::table('menu')->delete();
        $permisos = DB::table('permiso')->pluck('id', 'modulo');
        $orden = 0;
        foreach (self::MENU as $item) {
            $padreId = $this->insertar($item, null, ++$orden, $permisos);
            foreach ($item['hijos'] ?? [] as $i => $hijo) {
                $this->insertar($hijo, $padreId, $i + 1, $permisos);
            }
        }
    }

    private function insertar(array $item, ?int $padreId, int $orden, $permisos): int
    {
        return DB::table('menu')->insertGetId([
            'padre_id' => $padreId,
            'permiso_id' => isset($item['modulo']) ? $permisos[$item['modulo']] : null,
            'titulo' => $item['titulo'],
            'ruta' => $item['ruta'] ?? null,
            'icono' => $item['icono'] ?? null,
            'orden' => $orden,
        ]);
    }
}
