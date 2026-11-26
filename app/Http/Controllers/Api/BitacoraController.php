<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** CU1: consulta de la bitácora de auditoría. */
class BitacoraController extends Controller
{
    private const ACCIONES = ['login_ok', 'login_fallido', 'logout', 'registro', 'acceso', 'crear', 'editar', 'eliminar', 'acceso_denegado'];

    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'accion' => ['nullable', Rule::in(self::ACCIONES)],
            'q' => ['nullable', 'string', 'max:120'],
            'ip' => ['nullable', 'string', 'max:45'],
            'recurso' => ['nullable', 'string', 'max:80'],
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date', 'after_or_equal:desde'],
        ]);
        $q = DB::table('bitacora as b')->leftJoin('usuario as u', 'u.id_usuario', '=', 'b.usuario_id')
            ->when($f['accion'] ?? null, fn ($w, $a) => $w->where('b.accion', $a))
            ->when($f['q'] ?? null, fn ($w, $t) => $w->where(fn ($x) => $x->where('b.email', 'ilike', $this->like($t))
                ->orWhereRaw("u.nombre || ' ' || u.apellido ILIKE ?", [$this->like($t)])))
            ->when($f['ip'] ?? null, fn ($w, $ip) => $w->where('b.ip', 'like', $ip.'%'))
            ->when($f['recurso'] ?? null, fn ($w, $r) => $w->where('b.recurso', $r))
            ->when($f['desde'] ?? null, fn ($w, $d) => $w->whereDate('b.fecha', '>=', $d))
            ->when($f['hasta'] ?? null, fn ($w, $d) => $w->whereDate('b.fecha', '<=', $d))
            ->orderByDesc('b.id_bitacora')
            ->select('b.*', 'b.id_bitacora as id', DB::raw("u.nombre || ' ' || u.apellido AS usuario"));

        return $this->paginado($q->paginate($this->porPagina($request, 25)));
    }

    /** Indicadores de acceso: logins ok/fallidos, IPs con más fallos y recursos más accedidos. */
    public function resumen(Request $request): JsonResponse
    {
        $dias = max(1, min(90, $request->integer('dias', 7)));
        $desde = now()->subDays($dias - 1)->startOfDay();

        return response()->json([
            'dias' => $dias,
            'totales' => DB::table('bitacora')->where('fecha', '>=', $desde)->groupBy('accion')
                ->selectRaw('accion, COUNT(*) AS n')->pluck('n', 'accion'),
            'logins_por_dia' => DB::table('bitacora')->where('fecha', '>=', $desde)->whereIn('accion', ['login_ok', 'login_fallido'])
                ->groupByRaw('fecha::date')->orderByRaw('fecha::date')
                ->get([DB::raw('fecha::date AS dia'),
                    DB::raw("COUNT(*) FILTER (WHERE accion = 'login_ok') AS exitosos"),
                    DB::raw("COUNT(*) FILTER (WHERE accion = 'login_fallido') AS fallidos")]),
            'ips' => DB::table('bitacora')->where('fecha', '>=', $desde)->whereNotNull('ip')
                ->groupBy('ip')->orderByDesc('total')->limit(10)
                ->get(['ip', DB::raw('COUNT(*) AS total'),
                    DB::raw("COUNT(*) FILTER (WHERE accion = 'login_fallido') AS fallidos"),
                    DB::raw('MAX(fecha) AS ultima')]),
            'recursos' => DB::table('bitacora')->where('fecha', '>=', $desde)->whereNotNull('recurso')->where('recurso', '!=', 'auth')
                ->groupBy('recurso')->orderByDesc('total')->limit(10)
                ->get(['recurso', DB::raw('COUNT(*) AS total')]),
            'usuarios' => DB::table('bitacora as b')->join('usuario as u', 'u.id_usuario', '=', 'b.usuario_id')
                ->where('b.fecha', '>=', $desde)->groupBy('u.id_usuario')->orderByDesc('total')->limit(5)
                ->get([DB::raw("u.nombre || ' ' || u.apellido AS usuario"), DB::raw('COUNT(*) AS total')]),
        ]);
    }
}
