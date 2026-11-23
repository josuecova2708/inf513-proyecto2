<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PreferenciaUsuario;
use App\Models\Rol;
use App\Models\Usuario;
use App\Services\BitacoraServicio;
use App\Services\PermisoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const MAX_INTENTOS = 5;

    public function login(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'email' => ['required', 'email', 'max:120'],
            'password' => ['required', 'string', 'max:100'],
        ]);
        $email = Str::lower(trim($datos['email']));
        $clave = 'login:'.$email.'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($clave, self::MAX_INTENTOS)) {
            $seg = RateLimiter::availableIn($clave);
            BitacoraServicio::registrar('login_fallido', null, 'auth', 'Bloqueado por demasiados intentos', $request, 429, $email);

            return response()->json(['message' => "Demasiados intentos fallidos. Intente de nuevo en {$seg} segundos."], 429);
        }

        $usuario = Usuario::with('rol')->whereRaw('lower(email) = ?', [$email])->first();

        if (! $usuario || ! Hash::check($datos['password'], $usuario->password_hash)) {
            RateLimiter::hit($clave, 60);
            BitacoraServicio::registrar('login_fallido', $usuario?->id, 'auth',
                $usuario ? 'Contraseña incorrecta' : 'Correo no registrado', $request, 422, $email);

            throw ValidationException::withMessages(['email' => 'El correo o la contraseña son incorrectos.']);
        }

        if ($usuario->estado !== 'activo') {
            BitacoraServicio::registrar('login_fallido', $usuario->id, 'auth', 'Cuenta inactiva', $request, 403, $email);

            return response()->json(['message' => 'Su cuenta está inactiva. Comuníquese con el administrador de FEDER.'], 403);
        }

        RateLimiter::clear($clave);
        if (Hash::needsRehash($usuario->password_hash)) {
            DB::table('usuario')->where('id', $usuario->id)->update(['password_hash' => Hash::make($datos['password'])]);
        }

        $token = $usuario->createToken('web')->plainTextToken;
        BitacoraServicio::registrar('login_ok', $usuario->id, 'auth', null, $request, 200, $usuario->email);

        return response()->json(['token' => $token] + $this->sesion($usuario));
    }

    public function registro(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'min:2', 'max:80', 'regex:/^[\pL\s\'.-]+$/u'],
            'apellido' => ['required', 'string', 'min:2', 'max:80', 'regex:/^[\pL\s\'.-]+$/u'],
            'ci' => ['nullable', 'string', 'regex:/^\d{5,10}(-?[A-Za-z0-9]{1,3})?$/', 'unique:usuario,ci'],
            'email' => ['required', 'email', 'max:120', 'unique:usuario,email'],
            'telefono' => ['nullable', 'regex:/^[67]\d{7}$/'],
            'direccion' => ['nullable', 'string', 'max:200'],
            'password' => ['required', 'string', 'min:8', 'max:100', 'regex:/[A-Za-z]/', 'regex:/\d/', 'confirmed'],
        ], [
            'nombre.regex' => 'El nombre solo puede contener letras y espacios.',
            'apellido.regex' => 'El apellido solo puede contener letras y espacios.',
            'ci.regex' => 'El carnet debe tener entre 5 y 10 dígitos (con complemento opcional, ej. 1234567-1A).',
            'telefono.regex' => 'El teléfono debe tener 8 dígitos y comenzar con 6 o 7.',
            'password.regex' => 'La contraseña debe contener letras y números.',
            'email.unique' => 'Ya existe una cuenta con ese correo electrónico.',
            'ci.unique' => 'Ya existe una cuenta con ese carnet de identidad.',
        ]);

        $usuario = new Usuario(collect($datos)->except('password')->all());
        $usuario->email = Str::lower($datos['email']);
        $usuario->rol_id = Rol::where('nombre', Usuario::CLIENTE)->value('id');
        $usuario->password_hash = Hash::make($datos['password']);
        $usuario->save();
        $usuario->load('rol');

        BitacoraServicio::registrar('registro', $usuario->id, 'auth', 'Registro de cliente', $request, 201, $usuario->email);
        $token = $usuario->createToken('web')->plainTextToken;

        return response()->json(['token' => $token] + $this->sesion($usuario), 201);
    }

    public function logout(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $usuario->currentAccessToken()?->delete();
        BitacoraServicio::registrar('logout', $usuario->id, 'auth', null, $request, 200, $usuario->email);

        return response()->json(['message' => 'Sesión cerrada correctamente.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->sesion($request->user()->load('rol')));
    }

    public function actualizarPerfil(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'min:2', 'max:80', 'regex:/^[\pL\s\'.-]+$/u'],
            'apellido' => ['required', 'string', 'min:2', 'max:80', 'regex:/^[\pL\s\'.-]+$/u'],
            'telefono' => ['nullable', 'regex:/^[67]\d{7}$/'],
            'direccion' => ['nullable', 'string', 'max:200'],
            'email' => ['required', 'email', 'max:120', Rule::unique('usuario', 'email')->ignore($usuario->id)],
            'password_actual' => ['nullable', 'required_with:password', 'string'],
            'password' => ['nullable', 'string', 'min:8', 'max:100', 'regex:/[A-Za-z]/', 'regex:/\d/', 'confirmed'],
        ], [
            'nombre.regex' => 'El nombre solo puede contener letras y espacios.',
            'apellido.regex' => 'El apellido solo puede contener letras y espacios.',
            'telefono.regex' => 'El teléfono debe tener 8 dígitos y comenzar con 6 o 7.',
            'password.regex' => 'La contraseña debe contener letras y números.',
        ]);

        if (! empty($datos['password'])) {
            if (! Hash::check($datos['password_actual'] ?? '', $usuario->password_hash)) {
                throw ValidationException::withMessages(['password_actual' => 'La contraseña actual es incorrecta.']);
            }
            $usuario->password_hash = Hash::make($datos['password']);
        }
        $usuario->fill(collect($datos)->only(['nombre', 'apellido', 'telefono', 'direccion'])->all());
        $usuario->email = Str::lower($datos['email']);
        $usuario->save();

        return response()->json(['message' => 'Perfil actualizado correctamente.'] + $this->sesion($usuario->load('rol')));
    }

    public function guardarPreferencias(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'tema' => ['required', Rule::in(['ninos', 'jovenes', 'adultos'])],
            'modo' => ['required', Rule::in(['dia', 'noche', 'auto'])],
            'tamano_fuente' => ['required', 'integer', 'between:12,26'],
            'contraste' => ['required', Rule::in(['normal', 'alto'])],
        ]);
        PreferenciaUsuario::updateOrCreate(['usuario_id' => $request->user()->id], $datos);

        return response()->json(['message' => 'Preferencias guardadas.', 'preferencias' => $datos]);
    }

    /** Datos de sesión: usuario, rol, permisos, menú dinámico y preferencias. */
    private function sesion(Usuario $usuario): array
    {
        $pref = PreferenciaUsuario::find($usuario->id);

        return [
            'usuario' => [
                'id' => $usuario->id,
                'nombre' => $usuario->nombre,
                'apellido' => $usuario->apellido,
                'nombre_completo' => $usuario->nombre_completo,
                'email' => $usuario->email,
                'ci' => $usuario->ci,
                'telefono' => $usuario->telefono,
                'direccion' => $usuario->direccion,
                'rol' => $usuario->nombreRol(),
                'rol_id' => $usuario->rol_id,
                'es_staff' => $usuario->esStaff(),
                'emprendimiento_id' => $usuario->esProductor() ? $usuario->emprendimiento?->id : null,
            ],
            'permisos' => PermisoServicio::permisosRol((int) $usuario->rol_id),
            'menu' => PermisoServicio::menu($usuario),
            'preferencias' => $pref ? $pref->only(['tema', 'modo', 'tamano_fuente', 'contraste']) : null,
        ];
    }
}
