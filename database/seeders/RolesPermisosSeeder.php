<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * CU1: roles, módulos (permisos) y matriz de acceso rol x módulo (ver, crear, editar, eliminar).
 * Base: datos_prueba.sql del 1er parcial + módulos nuevos de la web.
 */
class RolesPermisosSeeder extends Seeder
{
    public const MODULOS = [
        // modulo => nombre
        'dashboard'       => 'Panel analítico (dashboard)',
        'usuarios'        => 'Gestionar usuarios',
        'roles'           => 'Roles y matriz de permisos',
        'bitacora'        => 'Bitácora de auditoría',
        'perfil'          => 'Mi perfil',
        'comunidades'     => 'Comunidades agrícolas',
        'emprendimientos' => 'Productores / emprendimientos',
        'ofertas'         => 'Productos ofrecidos por productor',
        'produccion'      => 'Producción agrícola',
        'lotes'           => 'Lotes y trazabilidad',
        'catalogo'        => 'Catálogo de productos',
        'inventario'      => 'Inventario y alertas',
        'carrito'         => 'Carrito de compras',
        'encargos'        => 'Encargos',
        'pedidos'         => 'Pedidos',
        'pagos'           => 'Pagos',
        'metodos_pago'    => 'Mis métodos de pago',
        'planes_pago'     => 'Planes de pago',
        'entregas'        => 'Entregas',
        'notificaciones'  => 'Notificaciones',
        'finanzas'        => 'Indicadores financieros',
        'reportes'        => 'Reportes y estadísticas',
        'qr'              => 'QR de cobro',
    ];

    // rol => [modulo => 'VCEE' (ver, crear, editar, eliminar) con 1/0]
    public const MATRIZ = [
        'Administrador' => [
            'dashboard' => '1000', 'usuarios' => '1111', 'roles' => '1111', 'bitacora' => '1000', 'perfil' => '1010',
            'comunidades' => '1111', 'emprendimientos' => '1111', 'ofertas' => '1111', 'produccion' => '1111',
            'lotes' => '1111', 'catalogo' => '1111', 'inventario' => '1111', 'encargos' => '1111', 'pedidos' => '1111',
            'pagos' => '1111', 'metodos_pago' => '1000', 'planes_pago' => '1111', 'entregas' => '1111',
            'notificaciones' => '1000', 'finanzas' => '1000', 'reportes' => '1000', 'qr' => '1111',
        ],
        'Personal' => [
            'dashboard' => '1000', 'usuarios' => '1000', 'perfil' => '1010',
            'comunidades' => '1111', 'emprendimientos' => '1111', 'ofertas' => '1111', 'produccion' => '1111',
            'lotes' => '1111', 'catalogo' => '1111', 'inventario' => '1111', 'encargos' => '1111', 'pedidos' => '1111',
            'pagos' => '1110', 'planes_pago' => '1110', 'entregas' => '1110',
            'notificaciones' => '1000', 'finanzas' => '1000', 'reportes' => '1000', 'qr' => '1000',
        ],
        'Productor' => [
            'perfil' => '1010', 'comunidades' => '1000', 'emprendimientos' => '1010', 'ofertas' => '1101',
            'produccion' => '1100', 'lotes' => '1000', 'catalogo' => '1000', 'notificaciones' => '1000',
        ],
        'Cliente' => [
            'perfil' => '1010', 'catalogo' => '1000', 'carrito' => '1111', 'encargos' => '1101',
            'pedidos' => '1001', 'pagos' => '1100', 'metodos_pago' => '1111', 'planes_pago' => '1100',
            'entregas' => '1000', 'notificaciones' => '1000',
        ],
    ];

    public function run(): void
    {
        DB::table('rol')->insertOrIgnore([
            ['nombre' => 'Administrador', 'descripcion' => 'Gestiona usuarios, roles, auditoría y configuración'],
            ['nombre' => 'Personal',      'descripcion' => 'Personal de FEDER: valida producción, procesa pedidos, pagos y entregas'],
            ['nombre' => 'Productor',     'descripcion' => 'Productor/Agricultor: gestiona su emprendimiento y reporta producción'],
            ['nombre' => 'Cliente',       'descripcion' => 'Compra productos, solicita encargos y paga sus pedidos'],
        ]);

        DB::table('metodo_pago')->insertOrIgnore([
            ['nombre' => 'QR'], ['nombre' => 'Efectivo'], ['nombre' => 'Tarjeta'], ['nombre' => 'Transferencia'],
        ]);

        foreach (self::MODULOS as $modulo => $nombre) {
            DB::table('permiso')->updateOrInsert(
                ['modulo' => $modulo, 'accion' => 'gestionar'],
                ['nombre' => $nombre]
            );
        }

        $roles = DB::table('rol')->pluck('id', 'nombre');
        $permisos = DB::table('permiso')->pluck('id', 'modulo');

        foreach (self::MATRIZ as $rol => $modulos) {
            foreach ($modulos as $modulo => $flags) {
                DB::table('rol_permiso')->updateOrInsert(
                    ['rol_id' => $roles[$rol], 'permiso_id' => $permisos[$modulo]],
                    [
                        'ver' => $flags[0] === '1',
                        'crear' => $flags[1] === '1',
                        'editar' => $flags[2] === '1',
                        'eliminar' => $flags[3] === '1',
                    ]
                );
            }
        }
    }
}
