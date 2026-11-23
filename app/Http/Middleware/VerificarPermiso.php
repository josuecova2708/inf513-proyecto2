<?php

namespace App\Http\Middleware;

use App\Services\PermisoServicio;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Uso en rutas: ->middleware('permiso:productos,crear')
 * Verifica la matriz rol_permiso para el usuario autenticado.
 */
class VerificarPermiso
{
    private const VERBOS = ['ver' => 'ver', 'crear' => 'crear', 'editar' => 'editar', 'eliminar' => 'eliminar'];

    public function handle(Request $request, Closure $next, string $modulo, string $accion = 'ver'): Response
    {
        $usuario = $request->user();
        if (! $usuario) {
            return response()->json(['message' => 'Debe iniciar sesión para continuar.'], 401);
        }

        // Permite "modulo1|modulo2": basta con tener permiso en uno de ellos
        foreach (explode('|', $modulo) as $m) {
            if (PermisoServicio::puede($usuario, $m, $accion)) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'No tiene permiso para '.(self::VERBOS[$accion] ?? $accion).' en el módulo "'.str_replace('_', ' ', $modulo).'".',
        ], 403);
    }
}
