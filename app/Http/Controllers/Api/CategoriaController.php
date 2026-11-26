<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Models\Categoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU4: categorías del catálogo unificado. */
class CategoriaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(DB::table('categoria as c')
            ->leftJoin('producto as p', 'p.categoria_id', '=', 'c.id_categoria')
            ->groupBy('c.id_categoria')->orderBy('c.nombre')
            ->get(['c.*', 'c.id_categoria as id', DB::raw('COUNT(p.id_producto) AS productos')]));
    }

    private function reglas(?int $id = null): array
    {
        return [
            'nombre' => ['required', 'string', 'min:3', 'max:80', Rule::unique('categoria', 'nombre')->ignore($id, 'id_categoria')],
            'descripcion' => ['nullable', 'string', 'max:200'],
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $c = Categoria::create($request->validate($this->reglas(), ['nombre.unique' => 'Ya existe una categoría con ese nombre.']));

        return $this->mensaje('Categoría registrada.', ['categoria' => $c], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $c = Categoria::findOrFail($id);
        $c->update($request->validate($this->reglas($id), ['nombre.unique' => 'Ya existe una categoría con ese nombre.']));

        return $this->mensaje('Categoría actualizada.', ['categoria' => $c]);
    }

    public function destroy(int $id): JsonResponse
    {
        $c = Categoria::findOrFail($id);
        if ($c->productos()->exists()) {
            throw new ErrorNegocio('No se puede eliminar: la categoría tiene productos.', 409);
        }
        $c->delete();

        return $this->mensaje('Categoría eliminada.');
    }
}
