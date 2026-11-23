<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notificacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** CU6: notificaciones web al usuario. */
class NotificacionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Notificacion::where('usuario_id', $request->user()->id)
            ->when($request->filled('leida'), fn ($w) => $w->where('leida', $request->boolean('leida')))
            ->orderByDesc('fecha_envio');

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function noLeidas(Request $request): JsonResponse
    {
        $id = $request->user()->id;

        return response()->json([
            'no_leidas' => Notificacion::where('usuario_id', $id)->where('leida', false)->count(),
            'recientes' => Notificacion::where('usuario_id', $id)->orderByDesc('fecha_envio')->limit(6)->get(),
        ]);
    }

    public function leer(Request $request, int $id): JsonResponse
    {
        $n = Notificacion::where('usuario_id', $request->user()->id)->findOrFail($id);
        $n->update(['leida' => true]);

        return $this->mensaje('Notificación marcada como leída.');
    }

    public function leerTodas(Request $request): JsonResponse
    {
        Notificacion::where('usuario_id', $request->user()->id)->where('leida', false)->update(['leida' => true]);

        return $this->mensaje('Todas las notificaciones fueron marcadas como leídas.');
    }
}
