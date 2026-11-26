<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Notificaciones web al cliente (canal "sistema"). */
class NotificacionServicio
{
    public static function notificar(int $usuarioId, string $tipo, string $mensaje, ?int $pedidoId = null, ?int $encargoId = null): void
    {
        DB::table('notificacion')->insert([
            'usuario_id' => $usuarioId,
            'pedido_id' => $pedidoId,
            'encargo_id' => $encargoId,
            'tipo' => $tipo,
            'canal' => 'sistema',
            'mensaje' => mb_substr($mensaje, 0, 500),
            'fecha_envio' => now(),
        ]);
    }

    /** Avisa a todo el personal de FEDER (Administrador y Personal). */
    public static function notificarStaff(string $tipo, string $mensaje, ?int $pedidoId = null, ?int $encargoId = null): void
    {
        $ids = DB::table('usuario as u')->join('rol as r', 'r.id_rol', '=', 'u.rol_id')
            ->whereIn('r.nombre', ['Administrador', 'Personal'])->where('u.estado', 'activo')->pluck('u.id_usuario as id');
        foreach ($ids as $id) {
            self::notificar($id, $tipo, $mensaje, $pedidoId, $encargoId);
        }
    }
}
