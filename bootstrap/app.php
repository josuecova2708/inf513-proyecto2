<?php

use App\Http\Middleware\RegistrarBitacora;
use App\Http\Middleware\VerificarPermiso;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['permiso' => VerificarPermiso::class]);
        $middleware->appendToGroup('api', RegistrarBitacora::class);
        // La API usa tokens Bearer: nunca redirigir a una ruta "login" de Blade
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $esApi = fn (Request $request) => $request->is('api/*') || $request->expectsJson();
        $exceptions->shouldRenderJsonWhen($esApi);

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($esApi) {
            if ($esApi($request)) {
                return response()->json(['message' => 'Su sesión no es válida o expiró. Inicie sesión nuevamente.'], 401);
            }
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) use ($esApi) {
            if ($esApi($request)) {
                $seg = $e->getHeaders()['Retry-After'] ?? 60;

                return response()->json(['message' => "Demasiados intentos. Espere {$seg} segundos e intente de nuevo."], 429);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($esApi) {
            if ($esApi($request)) {
                $msg = $e->getPrevious() instanceof ModelNotFoundException
                    ? 'El registro solicitado no existe.'
                    : 'El recurso solicitado no existe.';

                return response()->json(['message' => $msg], 404);
            }
        });

        $exceptions->render(function (MethodNotAllowedHttpException $e, Request $request) use ($esApi) {
            if ($esApi($request)) {
                return response()->json(['message' => 'Operación no permitida sobre este recurso.'], 405);
            }
        });

        // Errores de PostgreSQL -> mensajes en español para el usuario
        $exceptions->render(function (QueryException $e, Request $request) use ($esApi) {
            if (! $esApi($request)) {
                return null;
            }
            $estado = $e->errorInfo[0] ?? $e->getCode();
            $detalle = $e->errorInfo[2] ?? '';

            return match ((string) $estado) {
                // RAISE EXCEPTION de las funciones plpgsql (stock insuficiente, producción no validada...)
                'P0001' => response()->json(['message' => trim(preg_replace('/^ERROR:\s*|\s*CONTEXT:.*$/s', '', $detalle))], 409),
                '23505' => response()->json(['message' => 'Ya existe un registro con esos datos (valor duplicado).'], 422),
                '23503' => response()->json(['message' => 'No se puede completar la operación: el registro está relacionado con otros datos.'], 409),
                '23514' => response()->json(['message' => 'Los datos no cumplen las reglas del sistema (valor fuera de rango o estado inválido).'], 422),
                '40001', '40P01' => response()->json(['message' => 'Otro usuario modificó estos datos al mismo tiempo. Intente nuevamente.'], 409),
                default => null,
            };
        });
    })->create();
