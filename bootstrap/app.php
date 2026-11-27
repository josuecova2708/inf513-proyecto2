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
use Illuminate\Support\Facades\Log;
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

        // Errores de PostgreSQL -> log de auditoría en servidor/consola + mensajes en español para el usuario
        $exceptions->render(function (QueryException $e, Request $request) use ($esApi) {
            if (! $esApi($request)) {
                return null;
            }
            $estado = (string) ($e->errorInfo[0] ?? $e->getCode());
            $detalle = $e->errorInfo[2] ?? $e->getMessage();
            $usuario = $request->user() ?? auth('sanctum')->user();

            Log::error('[AUDITORIA-BD] Fallo en consulta PostgreSQL', [
                'sqlstate' => $estado,
                'detalle_pg' => $detalle,
                'sql' => $e->getSql(),
                'bindings' => $e->getBindings(),
                'metodo' => $request->method(),
                'ruta' => '/'.ltrim($request->path(), '/'),
                'usuario_id' => $usuario?->id,
                'email' => $usuario?->email,
                'ip' => $request->ip(),
            ]);

            $codigoDiag = "PG-{$estado}";
            $limpio = trim(preg_replace('/^ERROR:\s*|\s*CONTEXT:.*$/s', '', $detalle));

            return match ($estado) {
                // RAISE EXCEPTION de las funciones plpgsql (stock insuficiente, producción no validada...)
                'P0001' => response()->json(['message' => $limpio, 'codigo_error' => $codigoDiag, 'detalle_tecnico' => $limpio], 409),
                '23505' => response()->json(['message' => 'Ya existe un registro con esos datos (valor duplicado).', 'codigo_error' => $codigoDiag, 'detalle_tecnico' => $limpio], 422),
                '23503' => response()->json(['message' => 'No se puede completar la operación: el registro está relacionado con otros datos.', 'codigo_error' => $codigoDiag, 'detalle_tecnico' => $limpio], 409),
                '23514' => response()->json(['message' => 'Los datos no cumplen las reglas del sistema (valor fuera de rango o estado inválido).', 'codigo_error' => $codigoDiag, 'detalle_tecnico' => $limpio], 422),
                '40001', '40P01' => response()->json(['message' => 'Otro usuario modificó estos datos al mismo tiempo. Intente nuevamente.', 'codigo_error' => $codigoDiag, 'detalle_tecnico' => $limpio], 409),
                default => response()->json([
                    'message' => 'Error de base de datos al procesar la solicitud.',
                    'codigo_error' => $codigoDiag,
                    'detalle_tecnico' => config('app.debug') ? $limpio : 'Consulte la bitácora o los logs del servidor.',
                ], 500),
            };
        });

        // Cualquier otro error no controlado (PDOException de conexión caída, errores 500...)
        $exceptions->report(function (Throwable $e) {
            $req = request();
            $usuario = $req?->user() ?? auth('sanctum')->user();
            Log::error('[AUDITORIA-SERVIDOR] Excepción en el servidor: '.$e->getMessage(), [
                'excepcion' => get_class($e),
                'archivo' => $e->getFile().':'.$e->getLine(),
                'metodo' => $req?->method(),
                'ruta' => $req ? '/'.ltrim($req->path(), '/') : null,
                'usuario_id' => $usuario?->id,
                'email' => $usuario?->email,
                'ip' => $req?->ip(),
            ]);
        });
    })->create();
