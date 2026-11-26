<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Models\Emprendimiento;
use App\Models\Usuario;
use App\Services\ImagenServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU2: productores / emprendimientos y los productos que ofrecen. El Productor solo gestiona el suyo. */
class EmprendimientoController extends Controller
{
    private const RUBROS = ['agricola', 'artesania', 'alimentos_procesados', 'textil', 'otro'];

    private function reglas(?int $id = null): array
    {
        return [
            'comunidad_id' => ['required', 'integer', 'exists:comunidad,id_comunidad'],
            'usuario_id' => ['nullable', 'integer', Rule::exists('usuario', 'id_usuario')->where(fn ($q) => $q->where('rol_id', DB::table('rol')->where('nombre', 'Productor')->value('id_rol'))),
                Rule::unique('emprendimiento', 'usuario_id')->ignore($id, 'id_emprendimiento')],
            'nombre' => ['required', 'string', 'min:3', 'max:120'],
            'rubro' => ['required', Rule::in(self::RUBROS)],
            'responsable' => ['required', 'string', 'min:3', 'max:120', 'regex:/^[\pL\s\'.-]+$/u'],
            'ci_nit' => ['nullable', 'string', 'regex:/^\d{5,15}(-?[A-Za-z0-9]{1,3})?$/'],
            'telefono' => ['nullable', 'regex:/^[67]\d{7}$/'],
            'direccion' => ['nullable', 'string', 'max:200'],
            'latitud' => ['nullable', 'numeric', 'between:-90,90'],
            'longitud' => ['nullable', 'numeric', 'between:-180,180'],
            'estado' => ['required', Rule::in(['activo', 'inactivo'])],
        ];
    }

    private const MENSAJES = [
        'usuario_id.exists' => 'La cuenta vinculada debe ser un usuario con rol Productor.',
        'usuario_id.unique' => 'Esa cuenta de productor ya está vinculada a otro emprendimiento.',
        'responsable.regex' => 'El responsable solo puede contener letras y espacios.',
        'ci_nit.regex' => 'El CI/NIT debe tener entre 5 y 15 dígitos.',
        'telefono.regex' => 'El teléfono debe tener 8 dígitos y comenzar con 6 o 7.',
    ];

    private function verificarAcceso(Usuario $u, Emprendimiento $e): void
    {
        if (! $u->esStaff() && $e->usuario_id !== $u->id) {
            throw new ErrorNegocio('Solo puede gestionar su propio emprendimiento.', 403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'comunidad_id' => ['nullable', 'integer'],
            'rubro' => ['nullable', Rule::in(self::RUBROS)],
            'estado' => ['nullable', Rule::in(['activo', 'inactivo'])],
        ]);
        $u = $request->user();
        $q = DB::table('emprendimiento as e')
            ->join('comunidad as c', 'c.id_comunidad', '=', 'e.comunidad_id')
            ->leftJoin('usuario as u', 'u.id_usuario', '=', 'e.usuario_id')
            ->when(! $u->esStaff(), fn ($w) => $w->where('e.usuario_id', $u->id))
            ->when($f['q'] ?? null, fn ($w, $t) => $w->where(fn ($x) => $x->where('e.nombre', 'ilike', $this->like($t))
                ->orWhere('e.responsable', 'ilike', $this->like($t))->orWhere('c.nombre', 'ilike', $this->like($t))))
            ->when($f['comunidad_id'] ?? null, fn ($w, $c) => $w->where('e.comunidad_id', $c))
            ->when($f['rubro'] ?? null, fn ($w, $r) => $w->where('e.rubro', $r))
            ->when($f['estado'] ?? null, fn ($w, $s) => $w->where('e.estado', $s))
            ->orderBy('e.nombre')
            ->select('e.*', 'e.id_emprendimiento as id', 'c.nombre as comunidad', 'c.municipio', 'u.email as cuenta_email',
                DB::raw('(SELECT COUNT(*) FROM emprendimiento_producto ep WHERE ep.emprendimiento_id = e.id_emprendimiento) AS productos'));

        if ($request->boolean('todos')) {
            return response()->json($q->get());
        }

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $e = Emprendimiento::with(['comunidad', 'usuario:id_usuario,nombre,apellido,email'])->findOrFail($id);
        $this->verificarAcceso($request->user(), $e);
        $ofertas = DB::table('emprendimiento_producto as ep')->join('producto as p', 'p.id_producto', '=', 'ep.producto_id')
            ->where('ep.emprendimiento_id', $id)->orderBy('p.nombre')
            ->get(['p.id_producto as producto_id', 'p.nombre', 'p.unidad_medida', 'p.precio_venta', 'ep.precio_referencia', 'ep.temporada']);
        $produccion = DB::table('produccion as pr')->join('producto as p', 'p.id_producto', '=', 'pr.producto_id')
            ->where('pr.emprendimiento_id', $id)->orderByDesc('pr.id_produccion')->limit(10)
            ->get(['pr.id_produccion as id', 'p.nombre as producto', 'pr.tipo', 'pr.cantidad', 'pr.unidad_medida', 'pr.estado', 'pr.fecha_registro']);

        return response()->json(['emprendimiento' => $e, 'ofertas' => $ofertas, 'produccion' => $produccion]);
    }

    public function store(Request $request): JsonResponse
    {
        $e = Emprendimiento::create($request->validate($this->reglas(), self::MENSAJES));

        return $this->mensaje('Productor registrado correctamente.', ['emprendimiento' => $e], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $e = Emprendimiento::findOrFail($id);
        $u = $request->user();
        $this->verificarAcceso($u, $e);
        $d = $request->validate($this->reglas($id), self::MENSAJES);
        if (! $u->esStaff()) {
            // El productor no puede reasignar su cuenta, comunidad ni estado
            $d = collect($d)->only(['nombre', 'responsable', 'ci_nit', 'telefono', 'direccion', 'latitud', 'longitud'])->all();
        }
        $e->update($d);

        return $this->mensaje('Productor actualizado correctamente.', ['emprendimiento' => $e]);
    }

    public function destroy(int $id): JsonResponse
    {
        $e = Emprendimiento::findOrFail($id);
        if ($e->producciones()->exists()) {
            $e->update(['estado' => 'inactivo']);

            return $this->mensaje('El productor tiene producción registrada: se dio de baja (inactivo) para conservar la trazabilidad.');
        }
        ImagenServicio::eliminar($e->imagen);
        $e->delete();

        return $this->mensaje('Productor eliminado.');
    }

    /** Foto del emprendimiento (la sube el propio productor o el personal). Se comprime a WEBP. */
    public function subirImagen(Request $request, int $id): JsonResponse
    {
        $request->validate(
            ['imagen' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096']],
            ['imagen.required' => 'Elija una imagen.', 'imagen.max' => 'La imagen no puede pesar más de 4 MB.', 'imagen.mimes' => 'La imagen debe ser JPG, PNG o WEBP.', 'imagen.image' => 'La imagen debe ser JPG, PNG o WEBP.']
        );
        $e = Emprendimiento::findOrFail($id);
        $this->verificarAcceso($request->user(), $e);
        $anterior = $e->imagen;
        $e->update(['imagen' => ImagenServicio::guardar($request->file('imagen'), 'emprendimientos')]);
        ImagenServicio::eliminar($anterior);

        return $this->mensaje('Foto del emprendimiento actualizada.', ['imagen' => $e->imagen]);
    }

    public function quitarImagen(Request $request, int $id): JsonResponse
    {
        $e = Emprendimiento::findOrFail($id);
        $this->verificarAcceso($request->user(), $e);
        ImagenServicio::eliminar($e->imagen);
        $e->update(['imagen' => null]);

        return $this->mensaje('Foto del emprendimiento eliminada.');
    }

    public function guardarOferta(Request $request, int $id): JsonResponse
    {
        $e = Emprendimiento::findOrFail($id);
        $this->verificarAcceso($request->user(), $e);
        $d = $request->validate([
            'producto_id' => ['required', 'integer', 'exists:producto,id_producto'],
            'precio_referencia' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'temporada' => ['nullable', 'string', 'max:50'],
        ]);
        DB::table('emprendimiento_producto')->updateOrInsert(
            ['emprendimiento_id' => $id, 'producto_id' => $d['producto_id']],
            ['precio_referencia' => $d['precio_referencia'] ?? null, 'temporada' => $d['temporada'] ?? null]
        );

        return $this->mensaje('Oferta de producto guardada.');
    }

    public function eliminarOferta(Request $request, int $id, int $productoId): JsonResponse
    {
        $e = Emprendimiento::findOrFail($id);
        $this->verificarAcceso($request->user(), $e);
        DB::table('emprendimiento_producto')->where('emprendimiento_id', $id)->where('producto_id', $productoId)->delete();

        return $this->mensaje('Oferta eliminada.');
    }
}
