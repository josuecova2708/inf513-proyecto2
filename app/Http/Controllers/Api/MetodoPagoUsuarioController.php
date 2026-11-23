<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ErrorNegocio;
use App\Http\Controllers\Controller;
use App\Models\MetodoPagoUsuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Métodos de pago asociados al usuario: tarjetas (simuladas) y cuentas bancarias.
 * Nunca se almacena el número completo ni el CVV: solo marca, últimos 4 dígitos y un token.
 */
class MetodoPagoUsuarioController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $u = $request->user();
        $q = DB::table('metodo_pago_usuario as m')->join('metodo_pago as mp', 'mp.id', '=', 'm.metodo_pago_id')
            ->join('usuario as u', 'u.id', '=', 'm.usuario_id')
            ->when(! $u->esStaff() || ! $request->boolean('todos'), fn ($w) => $w->where('m.usuario_id', $u->id))
            ->when($request->boolean('activos'), fn ($w) => $w->where('m.estado', 'activo'))
            ->orderByDesc('m.predeterminado')->orderByDesc('m.id')
            ->get(['m.id', 'm.usuario_id', 'm.metodo_pago_id', 'mp.nombre as tipo', 'm.alias', 'm.titular', 'm.marca', 'm.ultimos4',
                'm.mes_venc', 'm.anio_venc', 'm.banco', 'm.predeterminado', 'm.estado', 'm.fecha_registro',
                DB::raw("u.nombre || ' ' || u.apellido AS usuario")]);

        return response()->json($q);
    }

    public function store(Request $request): JsonResponse
    {
        $tarjetaId = DB::table('metodo_pago')->where('nombre', 'Tarjeta')->value('id');
        $transfId = DB::table('metodo_pago')->where('nombre', 'Transferencia')->value('id');
        $d = $request->validate([
            'metodo_pago_id' => ['required', 'integer', 'in:'.$tarjetaId.','.$transfId],
            'alias' => ['required', 'string', 'min:2', 'max:50'],
            'titular' => ['required', 'string', 'min:3', 'max:120', 'regex:/^[\pL\s\'.-]+$/u'],
            'numero_tarjeta' => ['required_if:metodo_pago_id,'.$tarjetaId, 'nullable', 'string', 'regex:/^[\d\s-]{13,23}$/'],
            'mes_venc' => ['required_if:metodo_pago_id,'.$tarjetaId, 'nullable', 'integer', 'between:1,12'],
            'anio_venc' => ['required_if:metodo_pago_id,'.$tarjetaId, 'nullable', 'integer', 'between:'.now()->year.','.(now()->year + 15)],
            'cvv' => ['required_if:metodo_pago_id,'.$tarjetaId, 'nullable', 'string', 'regex:/^\d{3,4}$/'],
            'banco' => ['required_if:metodo_pago_id,'.$transfId, 'nullable', 'string', 'max:80'],
            'numero_cuenta' => ['required_if:metodo_pago_id,'.$transfId, 'nullable', 'string', 'regex:/^\d{6,20}$/'],
            'predeterminado' => ['nullable', 'boolean'],
        ], [
            'metodo_pago_id.in' => 'Solo se pueden registrar tarjetas o cuentas bancarias.',
            'titular.regex' => 'El titular solo puede contener letras y espacios.',
            'numero_tarjeta.required_if' => 'Ingrese el número de la tarjeta.',
            'numero_tarjeta.regex' => 'El número de tarjeta debe tener entre 13 y 19 dígitos.',
            'mes_venc.required_if' => 'Indique el mes de vencimiento.',
            'anio_venc.required_if' => 'Indique el año de vencimiento.',
            'anio_venc.between' => 'El año de vencimiento no es válido.',
            'cvv.required_if' => 'Ingrese el código de seguridad (CVV).',
            'cvv.regex' => 'El CVV debe tener 3 o 4 dígitos.',
            'banco.required_if' => 'Indique el banco.',
            'numero_cuenta.required_if' => 'Ingrese el número de cuenta.',
            'numero_cuenta.regex' => 'El número de cuenta debe tener entre 6 y 20 dígitos.',
        ]);
        $u = $request->user();
        $datos = [
            'usuario_id' => $u->id, 'metodo_pago_id' => $d['metodo_pago_id'], 'alias' => $d['alias'],
            'titular' => mb_strtoupper($d['titular']), 'token_simulado' => 'tok_'.Str::random(32), 'estado' => 'activo',
        ];

        if ((int) $d['metodo_pago_id'] === (int) $tarjetaId) {
            $numero = preg_replace('/\D/', '', $d['numero_tarjeta']);
            if (! self::luhn($numero)) {
                throw new ErrorNegocio('El número de tarjeta no es válido (verificación Luhn).');
            }
            if (now()->setDate((int) $d['anio_venc'], (int) $d['mes_venc'], 1)->endOfMonth()->isPast()) {
                throw new ErrorNegocio('La tarjeta está vencida.');
            }
            $datos += ['marca' => self::marca($numero), 'ultimos4' => substr($numero, -4), 'mes_venc' => $d['mes_venc'], 'anio_venc' => $d['anio_venc']];
        } else {
            $datos += ['banco' => $d['banco'], 'marca' => 'Cuenta', 'ultimos4' => substr($d['numero_cuenta'], -4)];
        }

        $m = DB::transaction(function () use ($datos, $d, $u) {
            $primero = ! DB::table('metodo_pago_usuario')->where('usuario_id', $u->id)->where('estado', 'activo')->exists();
            $pred = $primero || ! empty($d['predeterminado']);
            if ($pred) {
                DB::table('metodo_pago_usuario')->where('usuario_id', $u->id)->update(['predeterminado' => false]);
            }

            return MetodoPagoUsuario::create($datos + ['predeterminado' => $pred]);
        });

        return $this->mensaje("Método de pago “{$m->alias}” registrado (•••• {$m->ultimos4}).", ['metodo' => $m], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $m = MetodoPagoUsuario::where('usuario_id', $request->user()->id)->findOrFail($id);
        $d = $request->validate([
            'alias' => ['required', 'string', 'min:2', 'max:50'],
            'predeterminado' => ['required', 'boolean'],
        ]);
        DB::transaction(function () use ($m, $d) {
            if ($d['predeterminado']) {
                DB::table('metodo_pago_usuario')->where('usuario_id', $m->usuario_id)->update(['predeterminado' => false]);
            }
            $m->update($d);
        });

        return $this->mensaje('Método de pago actualizado.');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $m = MetodoPagoUsuario::where('usuario_id', $request->user()->id)->findOrFail($id);
        if (DB::table('pago')->where('metodo_pago_usuario_id', $id)->exists()) {
            $m->update(['estado' => 'inactivo', 'predeterminado' => false]);

            return $this->mensaje('El método tiene pagos registrados: se desactivó para conservar el historial.');
        }
        $m->delete();

        return $this->mensaje('Método de pago eliminado.');
    }

    public static function luhn(string $n): bool
    {
        $suma = 0;
        $doble = false;
        for ($i = strlen($n) - 1; $i >= 0; $i--) {
            $d = (int) $n[$i];
            if ($doble && ($d *= 2) > 9) {
                $d -= 9;
            }
            $suma += $d;
            $doble = ! $doble;
        }

        return strlen($n) >= 13 && strlen($n) <= 19 && $suma % 10 === 0;
    }

    public static function marca(string $n): string
    {
        return match (true) {
            str_starts_with($n, '4') => 'Visa',
            (bool) preg_match('/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/', $n) => 'Mastercard',
            (bool) preg_match('/^3[47]/', $n) => 'American Express',
            default => 'Tarjeta',
        };
    }
}
