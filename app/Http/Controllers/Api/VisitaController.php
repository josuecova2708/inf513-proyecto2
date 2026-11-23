<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Contador de visitas persistente por página (footer de cada vista).
 * Se cuenta en el servidor de forma atómica; una misma IP no suma de nuevo
 * la misma página durante 30 minutos (evita inflar el contador con recargas).
 */
class VisitaController extends Controller
{
    public function registrar(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'pagina' => ['required', 'string', 'max:150', 'regex:/^\/[A-Za-z0-9\/:_\-]*$/'],
        ], ['pagina.regex' => 'La página indicada no es válida.']);
        $pagina = $datos['pagina'];

        $clave = 'visita:'.sha1($request->ip().'|'.$pagina);
        if (Cache::add($clave, true, now()->addMinutes(30))) {
            $fila = DB::selectOne(
                'INSERT INTO visita_pagina (pagina, contador, ultima_visita) VALUES (?, 1, now())
                 ON CONFLICT (pagina) DO UPDATE SET contador = visita_pagina.contador + 1, ultima_visita = now()
                 RETURNING contador',
                [$pagina]
            );
            $contador = (int) $fila->contador;
        } else {
            $contador = (int) (DB::table('visita_pagina')->where('pagina', $pagina)->value('contador') ?? 0);
        }

        return response()->json(['pagina' => $pagina, 'contador' => $contador]);
    }
}
