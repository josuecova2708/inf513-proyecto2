<?php

namespace App\Http\Middleware;

use App\Services\BitacoraServicio;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Registra en la bitácora cada petición a la API (después de responder, en terminate()).
 * Así "recursos con mayor índice de acceso" se calcula con datos reales y completos.
 * Los inicios de sesión se registran aparte en AuthController.
 */
class RegistrarBitacora
{
    /** Rutas muy frecuentes o ya registradas por su controlador */
    private const OMITIR = ['api/visitas', 'api/notificaciones/no-leidas', 'api/auth/login', 'api/auth/registro', 'api/auth/logout', 'api/buscar'];

    private const ACCION = ['GET' => 'acceso', 'POST' => 'crear', 'PUT' => 'editar', 'PATCH' => 'editar', 'DELETE' => 'eliminar'];

    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        if ($request->isMethod('OPTIONS') || in_array($request->path(), self::OMITIR, true)) {
            return;
        }

        $codigo = $response->getStatusCode();
        $usuario = $request->user() ?? auth('sanctum')->user();
        $accion = $codigo === 403 ? 'acceso_denegado' : (self::ACCION[$request->method()] ?? 'acceso');

        // recurso = primer segmento después de /api (ej. api/productos/5 -> productos)
        $segmentos = explode('/', $request->path());
        $recurso = $segmentos[1] ?? 'api';

        $detalle = null;
        if ($codigo >= 400) {
            $json = json_decode((string) $response->getContent(), true);
            $msg = $json['detalle_tecnico'] ?? $json['message'] ?? null;
            $cod = $json['codigo_error'] ?? null;
            $detalle = 'HTTP '.$codigo.($cod ? " [{$cod}]" : '').($msg ? ': '.$msg : '');
        }

        BitacoraServicio::registrar(
            $accion,
            $usuario?->id,
            $recurso,
            $detalle,
            $request,
            $codigo,
            $usuario?->email,
        );
    }
}
