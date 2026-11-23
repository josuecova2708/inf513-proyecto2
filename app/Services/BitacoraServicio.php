<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Registro persistente de auditoría: inicios de sesión (exitosos y fallidos),
 * IP, user agent y accesos a recursos de la API.
 */
class BitacoraServicio
{
    public static function registrar(
        string $accion,
        ?int $usuarioId = null,
        ?string $recurso = null,
        ?string $detalle = null,
        ?Request $request = null,
        ?int $codigoHttp = null,
        ?string $email = null,
    ): void {
        $request ??= request();
        try {
            DB::table('bitacora')->insert([
                'usuario_id' => $usuarioId,
                'email' => $email ? mb_substr($email, 0, 120) : null,
                'accion' => $accion,
                'recurso' => $recurso ? mb_substr($recurso, 0, 80) : null,
                'metodo' => $request->method(),
                'ruta' => mb_substr('/'.ltrim($request->path(), '/'), 0, 255),
                'codigo_http' => $codigoHttp,
                'ip' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
                'detalle' => $detalle ? mb_substr($detalle, 0, 255) : null,
                'fecha' => now(),
            ]);
        } catch (Throwable $e) {
            // La auditoría nunca debe romper la petición del usuario
            report($e);
        }
    }
}
