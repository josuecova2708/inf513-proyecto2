<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;

/** Regla de negocio incumplida: se responde al usuario con un mensaje claro en español. */
class ErrorNegocio extends Exception
{
    public function __construct(string $mensaje, private int $codigo = 422)
    {
        parent::__construct($mensaje);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->codigo);
    }
}
