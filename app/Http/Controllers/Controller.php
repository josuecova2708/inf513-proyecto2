<?php

namespace App\Http\Controllers;

use App\Services\PermisoServicio;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class Controller
{
    /** Respuesta paginada uniforme: { data: [...], meta: {...} } */
    protected function paginado(LengthAwarePaginator $p, ?callable $mapa = null): JsonResponse
    {
        $items = $mapa ? collect($p->items())->map($mapa)->values() : $p->items();

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $p->currentPage(),
                'last_page' => $p->lastPage(),
                'per_page' => $p->perPage(),
                'from' => $p->firstItem(),
                'to' => $p->lastItem(),
                'total' => $p->total(),
            ],
        ]);
    }

    protected function porPagina(Request $request, int $defecto = 15): int
    {
        return max(5, min(100, (int) $request->integer('por_pagina', $defecto)));
    }

    protected function puede(Request $request, string $modulo, string $accion = 'ver'): bool
    {
        return PermisoServicio::puede($request->user(), $modulo, $accion);
    }

    protected function mensaje(string $texto, array $extra = [], int $codigo = 200): JsonResponse
    {
        return response()->json(['message' => $texto] + $extra, $codigo);
    }

    /** Escapa comodines de LIKE en textos de búsqueda */
    protected function like(string $texto): string
    {
        return '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($texto)).'%';
    }
}
