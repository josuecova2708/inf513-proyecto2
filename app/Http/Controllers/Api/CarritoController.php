<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Services\MantenimientoServicio;
use App\Services\NotificacionServicio;
use App\Services\PedidoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU5: carrito de compras y venta inmediata (confirmar compra). */
class CarritoController extends Controller
{
    public function ver(Request $request): JsonResponse
    {
        MantenimientoServicio::ejecutarSiCorresponde();

        return response()->json(PedidoServicio::carrito($request->user()->id));
    }

    public function agregar(Request $request): JsonResponse
    {
        $d = $request->validate([
            'producto_id' => ['required', 'integer', 'exists:producto,id'],
            'cantidad' => ['required', 'numeric', 'gt:0', 'max:100000'],
        ], ['cantidad.gt' => 'La cantidad debe ser mayor que 0.']);
        $cliente = $request->user()->id;

        DB::transaction(function () use ($d, $cliente) {
            $p = PedidoServicio::validarProductoVendible($d['producto_id']);
            $carrito = PedidoServicio::carritoId($cliente, true);
            $actual = (float) DB::table('detalle_pedido')->where('pedido_id', $carrito)->where('producto_id', $p->id)->value('cantidad');
            $total = $actual + (float) $d['cantidad'];
            if ($total > (float) $p->stock_disponible) {
                throw new ErrorNegocio("No hay stock suficiente de “{$p->nombre}”: disponible ".(float) $p->stock_disponible." {$p->unidad_medida}"
                    .($actual > 0 ? " y ya tiene {$actual} en el carrito." : '.'));
            }
            DB::statement('INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)
                           ON CONFLICT (pedido_id, producto_id) DO UPDATE SET cantidad = detalle_pedido.cantidad + EXCLUDED.cantidad,
                                                                               precio_unitario = EXCLUDED.precio_unitario',
                [$carrito, $p->id, $d['cantidad'], $p->precio_venta]);
            PedidoServicio::recalcular($carrito);
        });

        return response()->json(PedidoServicio::carrito($cliente));
    }

    public function actualizar(Request $request, int $productoId): JsonResponse
    {
        $d = $request->validate(['cantidad' => ['required', 'numeric', 'gt:0', 'max:100000']], ['cantidad.gt' => 'La cantidad debe ser mayor que 0.']);
        $cliente = $request->user()->id;

        DB::transaction(function () use ($d, $cliente, $productoId) {
            $carrito = PedidoServicio::carritoId($cliente) ?? throw new ErrorNegocio('Su carrito está vacío.');
            $p = PedidoServicio::validarProductoVendible($productoId);
            if ((float) $d['cantidad'] > (float) $p->stock_disponible) {
                throw new ErrorNegocio("Solo hay ".(float) $p->stock_disponible." {$p->unidad_medida} disponibles de “{$p->nombre}”.");
            }
            $n = DB::table('detalle_pedido')->where('pedido_id', $carrito)->where('producto_id', $productoId)
                ->update(['cantidad' => $d['cantidad'], 'precio_unitario' => $p->precio_venta]);
            if (! $n) {
                throw new ErrorNegocio('Ese producto no está en su carrito.', 404);
            }
            PedidoServicio::recalcular($carrito);
        });

        return response()->json(PedidoServicio::carrito($cliente));
    }

    public function quitar(Request $request, int $productoId): JsonResponse
    {
        $cliente = $request->user()->id;
        DB::transaction(function () use ($cliente, $productoId) {
            $carrito = PedidoServicio::carritoId($cliente) ?? throw new ErrorNegocio('Su carrito está vacío.');
            DB::table('detalle_pedido')->where('pedido_id', $carrito)->where('producto_id', $productoId)->delete();
            PedidoServicio::recalcular($carrito);
        });

        return response()->json(PedidoServicio::carrito($cliente));
    }

    public function vaciar(Request $request): JsonResponse
    {
        $cliente = $request->user()->id;
        DB::transaction(function () use ($cliente) {
            $carrito = PedidoServicio::carritoId($cliente);
            if ($carrito) {
                DB::table('detalle_pedido')->where('pedido_id', $carrito)->delete();
                PedidoServicio::recalcular($carrito);
            }
        });

        return response()->json(PedidoServicio::carrito($cliente));
    }

    /** Confirmar compra: reserva stock por lotes (FEFO + FOR UPDATE) y registra la entrega. */
    public function confirmar(Request $request): JsonResponse
    {
        $d = $request->validate([
            'tipo_entrega' => ['required', Rule::in(['recojo', 'envio'])],
            'direccion' => ['nullable', 'required_if:tipo_entrega,envio', 'string', 'min:5', 'max:200'],
            'referencia' => ['nullable', 'string', 'max:200'],
            'fecha_programada' => ['nullable', 'date', 'after_or_equal:today'],
            'nit_ci' => ['nullable', 'string', 'regex:/^\d{5,15}(-?[A-Za-z0-9]{1,3})?$/'],
            'razon_social' => ['nullable', 'required_with:nit_ci', 'string', 'max:120'],
        ], [
            'direccion.required_if' => 'Para envío a domicilio indique la dirección de entrega.',
            'nit_ci.regex' => 'El NIT/CI debe tener entre 5 y 15 dígitos.',
            'razon_social.required_with' => 'Indique la razón social para la factura.',
            'fecha_programada.after_or_equal' => 'La fecha programada no puede ser anterior a hoy.',
        ]);
        $usuario = $request->user();

        $pedidoId = DB::transaction(function () use ($d, $usuario) {
            $carrito = PedidoServicio::carritoId($usuario->id) ?? throw new ErrorNegocio('Su carrito está vacío.');
            DB::table('pedido')->where('id', $carrito)->update([
                'nit_ci' => $d['nit_ci'] ?? null, 'razon_social' => $d['razon_social'] ?? null, 'fecha' => now(),
            ]);
            PedidoServicio::reservarYEntregar($carrito, $d['tipo_entrega'], $d['direccion'] ?? null, $d['referencia'] ?? null, $d['fecha_programada'] ?? null);
            PedidoServicio::recalcular($carrito);
            $numero = DB::table('pedido')->where('id', $carrito)->value('numero');
            NotificacionServicio::notificar($usuario->id, 'pedido_confirmado',
                "Tu pedido {$numero} fue registrado y el stock quedó reservado por 24 horas. Completa el pago para confirmarlo.", $carrito);
            NotificacionServicio::notificarStaff('pedido_confirmado', "Nuevo pedido {$numero} de {$usuario->nombre_completo}.", $carrito);

            return $carrito;
        });

        return $this->mensaje('Pedido registrado. El stock quedó reservado: complete el pago para confirmarlo.', ['pedido_id' => $pedidoId], 201);
    }
}
