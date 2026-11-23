<?php

namespace App\Services;

use App\Models\Usuario;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Matriz de acceso (RBAC): rol x módulo con acciones ver/crear/editar/eliminar,
 * y construcción del menú dinámico desde la tabla `menu`.
 */
class PermisoServicio
{
    public const ACCIONES = ['ver', 'crear', 'editar', 'eliminar'];

    private const TTL = 300;

    /** @return array<string, array{ver: bool, crear: bool, editar: bool, eliminar: bool}> */
    public static function permisosRol(int $rolId): array
    {
        return Cache::remember("permisos_rol_{$rolId}", self::TTL, function () use ($rolId) {
            return DB::table('rol_permiso as rp')
                ->join('permiso as p', 'p.id', '=', 'rp.permiso_id')
                ->where('rp.rol_id', $rolId)
                ->get(['p.modulo', 'rp.ver', 'rp.crear', 'rp.editar', 'rp.eliminar'])
                ->mapWithKeys(fn ($r) => [$r->modulo => [
                    'ver' => (bool) $r->ver, 'crear' => (bool) $r->crear,
                    'editar' => (bool) $r->editar, 'eliminar' => (bool) $r->eliminar,
                ]])->all();
        });
    }

    public static function puede(?Usuario $usuario, string $modulo, string $accion = 'ver'): bool
    {
        if (! $usuario) {
            return false;
        }

        return (bool) (self::permisosRol((int) $usuario->rol_id)[$modulo][$accion] ?? false);
    }

    /** Árbol de menú visible para el rol: hojas con permiso "ver" y grupos con al menos un hijo visible. */
    public static function menu(Usuario $usuario): array
    {
        $permisos = self::permisosRol((int) $usuario->rol_id);
        $filas = Cache::remember('menu_items', self::TTL, fn () => DB::table('menu as m')
            ->leftJoin('permiso as p', 'p.id', '=', 'm.permiso_id')
            ->where('m.activo', true)
            ->orderBy('m.orden')
            ->get(['m.id', 'm.padre_id', 'm.titulo', 'm.ruta', 'm.icono', 'p.modulo'])
            ->map(fn ($r) => (array) $r)->all());

        $visible = fn (array $f) => $f['modulo'] === null || ($permisos[$f['modulo']]['ver'] ?? false);
        $arbol = [];
        foreach ($filas as $f) {
            if ($f['padre_id'] !== null) {
                continue;
            }
            $hijos = array_values(array_filter($filas, fn ($h) => $h['padre_id'] === $f['id'] && $visible($h)));
            $hijos = array_map(fn ($h) => self::item($h), $hijos);
            if ($f['ruta'] === null && count($hijos) === 0) {
                continue;
            }
            if ($f['ruta'] !== null && ! $visible($f)) {
                continue;
            }
            $arbol[] = self::item($f) + ['hijos' => $hijos];
        }

        return $arbol;
    }

    private static function item(array $f): array
    {
        return ['id' => $f['id'], 'titulo' => $f['titulo'], 'ruta' => $f['ruta'], 'icono' => $f['icono'], 'modulo' => $f['modulo']];
    }

    public static function limpiarCache(?int $rolId = null): void
    {
        Cache::forget('menu_items');
        $ids = $rolId ? [$rolId] : DB::table('rol')->pluck('id')->all();
        foreach ($ids as $id) {
            Cache::forget("permisos_rol_{$id}");
        }
    }
}
