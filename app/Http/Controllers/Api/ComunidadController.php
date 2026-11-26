<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Models\Comunidad;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU2: comunidades agrícolas. */
class ComunidadController extends Controller
{
    private function reglas(?int $id = null): array
    {
        return [
            'nombre' => ['required', 'string', 'min:3', 'max:100',
                Rule::unique('comunidad', 'nombre')->where(fn ($q) => $q->where('municipio', request('municipio')))->ignore($id, 'id_comunidad')],
            'municipio' => ['required', 'string', 'min:3', 'max:80'],
            'provincia' => ['nullable', 'string', 'max:80'],
            'departamento' => ['required', 'string', 'max:50'],
            'descripcion' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private const MENSAJES = ['nombre.unique' => 'Ya existe una comunidad con ese nombre en el mismo municipio.'];

    public function index(Request $request): JsonResponse
    {
        $request->validate(['q' => ['nullable', 'string', 'max:80']]);
        $q = DB::table('comunidad as c')
            ->leftJoin('emprendimiento as e', 'e.comunidad_id', '=', 'c.id_comunidad')
            ->when($request->q, fn ($w, $t) => $w->where(fn ($x) => $x->where('c.nombre', 'ilike', $this->like($t))
                ->orWhere('c.municipio', 'ilike', $this->like($t))->orWhere('c.provincia', 'ilike', $this->like($t))))
            ->groupBy('c.id_comunidad')->orderBy('c.nombre')
            ->select('c.*', 'c.id_comunidad as id', DB::raw('COUNT(e.id_emprendimiento) AS productores'));

        if ($request->boolean('todos')) {
            return response()->json($q->get());
        }

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function store(Request $request): JsonResponse
    {
        $c = Comunidad::create($request->validate($this->reglas(), self::MENSAJES));

        return $this->mensaje('Comunidad registrada correctamente.', ['comunidad' => $c], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $c = Comunidad::findOrFail($id);
        $c->update($request->validate($this->reglas($id), self::MENSAJES));

        return $this->mensaje('Comunidad actualizada correctamente.', ['comunidad' => $c]);
    }

    public function destroy(int $id): JsonResponse
    {
        $c = Comunidad::findOrFail($id);
        if ($c->emprendimientos()->exists()) {
            throw new ErrorNegocio('No se puede eliminar: la comunidad tiene productores registrados.', 409);
        }
        $c->delete();

        return $this->mensaje('Comunidad eliminada.');
    }
}
