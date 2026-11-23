<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/** CU4: catálogo unificado de productos (gestión interna). */
class ProductoController extends Controller
{
    private function reglas(?int $id = null): array
    {
        return [
            'categoria_id' => ['required', 'integer', 'exists:categoria,id'],
            'nombre' => ['required', 'string', 'min:3', 'max:120', Rule::unique('producto', 'nombre')->ignore($id)],
            'descripcion' => ['nullable', 'string', 'max:2000'],
            'presentacion' => ['nullable', 'string', 'max:80'],
            'unidad_medida' => ['required', 'string', 'max:20'],
            'precio_venta' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'modalidad_venta' => ['required', Rule::in(['inmediata', 'encargo', 'ambas'])],
            'stock_minimo' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'estado' => ['required', Rule::in(['activo', 'inactivo'])],
            'imagen' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'quitar_imagen' => ['nullable', 'boolean'],
        ];
    }

    private const MENSAJES = [
        'nombre.unique' => 'Ya existe un producto con ese nombre.',
        'precio_venta.gt' => 'El precio de venta debe ser mayor que 0.',
        'imagen.max' => 'La imagen no puede pesar más de 2 MB.',
    ];

    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'categoria_id' => ['nullable', 'integer'],
            'estado' => ['nullable', Rule::in(['activo', 'inactivo'])],
        ]);
        $q = DB::table('producto as p')
            ->join('categoria as c', 'c.id', '=', 'p.categoria_id')
            ->join('v_disponibilidad_producto as d', 'd.producto_id', '=', 'p.id')
            ->when($f['q'] ?? null, fn ($w, $t) => $w->where('p.nombre', 'ilike', $this->like($t)))
            ->when($f['categoria_id'] ?? null, fn ($w, $c) => $w->where('p.categoria_id', $c))
            ->when($f['estado'] ?? null, fn ($w, $e) => $w->where('p.estado', $e))
            ->orderBy('p.nombre')
            ->select('p.*', 'c.nombre as categoria', 'd.stock_disponible', 'd.stock_reservado', 'd.produccion_reportada', 'd.produccion_futura');

        if ($request->boolean('todos')) {
            return response()->json($q->get());
        }

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate($this->reglas(), self::MENSAJES);
        $d['imagen'] = $request->hasFile('imagen') ? $request->file('imagen')->store('productos', 'public') : null;
        unset($d['quitar_imagen']);
        $p = Producto::create($d);

        return $this->mensaje('Producto registrado en el catálogo.', ['producto' => $p], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $p = Producto::findOrFail($id);
        $d = $request->validate($this->reglas($id), self::MENSAJES);
        if ($request->hasFile('imagen') || $request->boolean('quitar_imagen')) {
            if ($p->imagen) {
                Storage::disk('public')->delete($p->imagen);
            }
            $d['imagen'] = $request->hasFile('imagen') ? $request->file('imagen')->store('productos', 'public') : null;
        } else {
            unset($d['imagen']);
        }
        unset($d['quitar_imagen']);
        $p->update($d);

        return $this->mensaje('Producto actualizado.', ['producto' => $p]);
    }

    /** Si el producto ya tiene historial (ventas, lotes) se desactiva en lugar de borrarse. */
    public function destroy(int $id): JsonResponse
    {
        $p = Producto::findOrFail($id);
        $usado = DB::table('detalle_pedido')->where('producto_id', $id)->exists() || DB::table('produccion')->where('producto_id', $id)->exists();
        if ($usado) {
            $p->update(['estado' => 'inactivo']);

            return $this->mensaje('El producto tiene historial de ventas o producción: se desactivó del catálogo.');
        }
        if ($p->imagen) {
            Storage::disk('public')->delete($p->imagen);
        }
        DB::table('emprendimiento_producto')->where('producto_id', $id)->delete();
        DB::table('alerta_inventario')->where('producto_id', $id)->delete();
        $p->delete();

        return $this->mensaje('Producto eliminado.');
    }
}
