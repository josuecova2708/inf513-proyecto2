<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** CU1: gestión de usuarios (Administrador, Personal de FEDER, Productor, Cliente). */
class UsuarioController extends Controller
{
    private const MENSAJES = [
        'nombre.regex' => 'El nombre solo puede contener letras y espacios.',
        'apellido.regex' => 'El apellido solo puede contener letras y espacios.',
        'ci.regex' => 'El carnet debe tener entre 5 y 10 dígitos (complemento opcional).',
        'telefono.regex' => 'El teléfono debe tener 8 dígitos y comenzar con 6 o 7.',
        'password.regex' => 'La contraseña debe contener letras y números.',
        'email.unique' => 'Ya existe un usuario con ese correo electrónico.',
        'ci.unique' => 'Ya existe un usuario con ese carnet de identidad.',
    ];

    private function reglas(?int $id = null): array
    {
        return [
            'rol_id' => ['required', 'integer', 'exists:rol,id'],
            'nombre' => ['required', 'string', 'min:2', 'max:80', 'regex:/^[\pL\s\'.-]+$/u'],
            'apellido' => ['required', 'string', 'min:2', 'max:80', 'regex:/^[\pL\s\'.-]+$/u'],
            'ci' => ['nullable', 'string', 'regex:/^\d{5,10}(-?[A-Za-z0-9]{1,3})?$/', Rule::unique('usuario', 'ci')->ignore($id)],
            'email' => ['required', 'email', 'max:120', Rule::unique('usuario', 'email')->ignore($id)],
            'telefono' => ['nullable', 'regex:/^[67]\d{7}$/'],
            'direccion' => ['nullable', 'string', 'max:200'],
            'estado' => ['required', Rule::in(['activo', 'inactivo'])],
            'password' => [$id ? 'nullable' : 'required', 'string', 'min:8', 'max:100', 'regex:/[A-Za-z]/', 'regex:/\d/'],
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'rol_id' => ['nullable', 'integer'],
            'estado' => ['nullable', Rule::in(['activo', 'inactivo'])],
        ]);
        $q = DB::table('usuario as u')->join('rol as r', 'r.id', '=', 'u.rol_id')
            ->leftJoin('emprendimiento as e', 'e.usuario_id', '=', 'u.id')
            ->when($f['q'] ?? null, fn ($w, $t) => $w->where(fn ($x) => $x->whereRaw("u.nombre || ' ' || u.apellido ILIKE ?", [$this->like($t)])
                ->orWhere('u.email', 'ilike', $this->like($t))->orWhere('u.ci', 'ilike', $this->like($t))))
            ->when($f['rol_id'] ?? null, fn ($w, $r) => $w->where('u.rol_id', $r))
            ->when($f['estado'] ?? null, fn ($w, $e) => $w->where('u.estado', $e))
            ->orderBy('u.id')
            ->select('u.id', 'u.rol_id', 'r.nombre as rol', 'u.nombre', 'u.apellido', 'u.ci', 'u.email', 'u.telefono',
                'u.direccion', 'u.estado', 'u.fecha_registro', 'e.nombre as emprendimiento');

        return $this->paginado($q->paginate($this->porPagina($request)));
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(Usuario::with('rol')->findOrFail($id));
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate($this->reglas(), self::MENSAJES);
        $u = new Usuario(collect($d)->except('password')->all());
        $u->email = Str::lower($d['email']);
        $u->password_hash = Hash::make($d['password']);
        $u->save();

        return $this->mensaje('Usuario registrado correctamente.', ['usuario' => $u], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $u = Usuario::findOrFail($id);
        $d = $request->validate($this->reglas($id), self::MENSAJES);
        if ($u->id === $request->user()->id && ($d['estado'] !== 'activo' || (int) $d['rol_id'] !== $u->rol_id)) {
            throw new ErrorNegocio('No puede desactivarse ni cambiarse el rol a sí mismo.');
        }
        $u->fill(collect($d)->except('password')->all());
        $u->email = Str::lower($d['email']);
        if (! empty($d['password'])) {
            $u->password_hash = Hash::make($d['password']);
        }
        $u->save();
        if ($u->estado === 'inactivo') {
            $u->tokens()->delete(); // cierra sus sesiones activas
        }

        return $this->mensaje('Usuario actualizado correctamente.', ['usuario' => $u]);
    }

    /** Baja lógica (estado inactivo) para conservar el historial de pedidos y auditoría. */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $u = Usuario::findOrFail($id);
        if ($u->id === $request->user()->id) {
            throw new ErrorNegocio('No puede darse de baja a sí mismo.');
        }
        $u->update(['estado' => 'inactivo']);
        $u->tokens()->delete();

        return $this->mensaje("El usuario {$u->nombre_completo} fue dado de baja (inactivo).");
    }
}
