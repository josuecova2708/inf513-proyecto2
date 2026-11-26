<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Services\PermisoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** CU1: roles y matriz de acceso (rol x módulo x acción). */
class RolController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(DB::table('rol as r')
            ->leftJoin('usuario as u', 'u.rol_id', '=', 'r.id_rol')
            ->groupBy('r.id_rol')->orderBy('r.id_rol')
            ->get(['r.id_rol as id', 'r.nombre', 'r.descripcion', DB::raw('COUNT(u.id_usuario) AS usuarios')]));
    }

    public function permisos(int $id): JsonResponse
    {
        $rol = DB::table('rol')->where('id_rol', $id)->first(['*', 'id_rol as id']) ?? abort(404);
        $filas = DB::table('permiso as p')
            ->leftJoin('rol_permiso as rp', fn ($j) => $j->on('rp.permiso_id', '=', 'p.id_permiso')->where('rp.rol_id', $id))
            ->orderBy('p.id_permiso')
            ->get(['p.id_permiso as id', 'p.modulo', 'p.nombre',
                DB::raw('COALESCE(rp.ver, false) AS ver'), DB::raw('COALESCE(rp.crear, false) AS crear'),
                DB::raw('COALESCE(rp.editar, false) AS editar'), DB::raw('COALESCE(rp.eliminar, false) AS eliminar')]);

        return response()->json(['rol' => $rol, 'permisos' => $filas]);
    }

    public function guardarPermisos(Request $request, int $id): JsonResponse
    {
        $rol = DB::table('rol')->where('id_rol', $id)->first(['*', 'id_rol as id']) ?? abort(404);
        $d = $request->validate([
            'permisos' => ['required', 'array'],
            'permisos.*.permiso_id' => ['required', 'integer', 'exists:permiso,id_permiso'],
            'permisos.*.ver' => ['required', 'boolean'],
            'permisos.*.crear' => ['required', 'boolean'],
            'permisos.*.editar' => ['required', 'boolean'],
            'permisos.*.eliminar' => ['required', 'boolean'],
        ]);

        // Protección: el Administrador no puede perder el acceso a la matriz de permisos
        if ($rol->nombre === 'Administrador') {
            $rolesId = DB::table('permiso')->where('modulo', 'roles')->value('id_permiso');
            foreach ($d['permisos'] as $p) {
                if ((int) $p['permiso_id'] === (int) $rolesId && (! $p['ver'] || ! $p['editar'])) {
                    throw new ErrorNegocio('El Administrador debe conservar los permisos de ver y editar "Roles y permisos".');
                }
            }
        }

        DB::transaction(function () use ($d, $id) {
            foreach ($d['permisos'] as $p) {
                // "ver" es requisito de cualquier otra acción
                $ver = $p['ver'] || $p['crear'] || $p['editar'] || $p['eliminar'];
                if (! $ver) {
                    DB::table('rol_permiso')->where('rol_id', $id)->where('permiso_id', $p['permiso_id'])->delete();

                    continue;
                }
                DB::table('rol_permiso')->updateOrInsert(
                    ['rol_id' => $id, 'permiso_id' => $p['permiso_id']],
                    ['ver' => true, 'crear' => $p['crear'], 'editar' => $p['editar'], 'eliminar' => $p['eliminar']]
                );
            }
        });
        PermisoServicio::limpiarCache($id);

        return $this->mensaje("Permisos del rol {$rol->nombre} actualizados. El menú de sus usuarios cambia al recargar.");
    }
}
