<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PermisoServicio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Búsqueda global del header. Resultados agrupados por tipo y filtrados según el rol:
 * público (productos, categorías, productores, comunidades) + pedidos propios/todos,
 * usuarios (staff) y opciones del menú permitidas.
 */
class BusquedaController extends Controller
{
    public function buscar(Request $request): JsonResponse
    {
        $request->validate(['q' => ['required', 'string', 'min:2', 'max:80']], [
            'q.min' => 'Escriba al menos 2 caracteres para buscar.',
        ]);
        $q = $this->like($request->string('q'));
        $usuario = auth('sanctum')->user();
        $grupos = [];

        $productos = DB::table('producto as p')->join('categoria as c', 'c.id_categoria', '=', 'p.categoria_id')
            ->where('p.estado', 'activo')
            ->where(fn ($w) => $w->where('p.nombre', 'ilike', $q)->orWhere('p.descripcion', 'ilike', $q))
            ->orderBy('p.nombre')->limit(6)->get(['p.id_producto as id', 'p.nombre', 'p.precio_venta', 'c.nombre as categoria']);
        $grupos[] = ['titulo' => 'Productos', 'items' => $productos->map(fn ($p) => [
            'id' => $p->id, 'titulo' => $p->nombre, 'subtitulo' => $p->categoria.' · Bs. '.number_format($p->precio_venta, 2), 'ruta' => "/catalogo/{$p->id}",
        ])];

        $categorias = DB::table('categoria')->where('nombre', 'ilike', $q)->limit(4)->get(['id_categoria as id', 'nombre']);
        $grupos[] = ['titulo' => 'Categorías', 'items' => $categorias->map(fn ($c) => [
            'id' => $c->id, 'titulo' => $c->nombre, 'subtitulo' => 'Ver productos de la categoría', 'ruta' => "/catalogo?categoria={$c->id}",
        ])];

        $staff = $usuario?->esStaff();
        $productores = DB::table('emprendimiento as e')->join('comunidad as co', 'co.id_comunidad', '=', 'e.comunidad_id')
            ->where('e.estado', 'activo')
            ->where(fn ($w) => $w->where('e.nombre', 'ilike', $q)->orWhere('e.responsable', 'ilike', $q)->orWhere('co.nombre', 'ilike', $q)->orWhere('co.municipio', 'ilike', $q))
            ->limit(5)->get(['e.id_emprendimiento as id', 'e.nombre', 'e.responsable', 'co.nombre as comunidad', 'co.municipio']);
        $grupos[] = ['titulo' => 'Productores y comunidades', 'items' => $productores->map(fn ($e) => [
            'id' => $e->id, 'titulo' => $e->nombre, 'subtitulo' => "{$e->comunidad} · {$e->municipio}",
            'ruta' => $staff ? "/panel/emprendimientos?q=".urlencode($e->nombre) : '/catalogo?q='.urlencode($e->nombre),
        ])];

        if ($usuario) {
            if (PermisoServicio::puede($usuario, 'pedidos')) {
                $pedidos = DB::table('pedido as pe')->join('usuario as u', 'u.id_usuario', '=', 'pe.cliente_id')
                    ->where('pe.estado', '!=', 'pendiente')
                    ->when(! $staff, fn ($w) => $w->where('pe.cliente_id', $usuario->id))
                    ->where(fn ($w) => $w->where('pe.numero', 'ilike', $q)->orWhere('u.nombre', 'ilike', $q)->orWhere('u.apellido', 'ilike', $q))
                    ->orderByDesc('pe.fecha')->limit(5)->get(['pe.id_pedido as id', 'pe.numero', 'pe.estado', 'pe.total', 'u.nombre', 'u.apellido']);
                $grupos[] = ['titulo' => 'Pedidos', 'items' => $pedidos->map(fn ($p) => [
                    'id' => $p->id, 'titulo' => $p->numero, 'subtitulo' => "{$p->nombre} {$p->apellido} · ".str_replace('_', ' ', $p->estado).' · Bs. '.number_format($p->total, 2),
                    'ruta' => "/panel/pedidos/{$p->id}",
                ])];
            }
            if ($staff && PermisoServicio::puede($usuario, 'usuarios')) {
                $usuarios = DB::table('usuario as u')->join('rol as r', 'r.id_rol', '=', 'u.rol_id')
                    ->where(fn ($w) => $w->where('u.nombre', 'ilike', $q)->orWhere('u.apellido', 'ilike', $q)->orWhere('u.email', 'ilike', $q)->orWhere('u.ci', 'ilike', $q))
                    ->limit(5)->get(['u.id_usuario as id', 'u.nombre', 'u.apellido', 'u.email', 'r.nombre as rol']);
                $grupos[] = ['titulo' => 'Usuarios', 'items' => $usuarios->map(fn ($u) => [
                    'id' => $u->id, 'titulo' => "{$u->nombre} {$u->apellido}", 'subtitulo' => "{$u->rol} · {$u->email}", 'ruta' => '/panel/usuarios?q='.urlencode($u->email),
                ])];
            }
            // Opciones del menú permitidas (navegación rápida)
            $texto = mb_strtolower(trim($request->string('q')));
            $opciones = collect(PermisoServicio::menu($usuario))
                ->flatMap(fn ($m) => $m['hijos'] ? $m['hijos'] : [$m])
                ->filter(fn ($m) => $m['ruta'] && str_contains(mb_strtolower($m['titulo']), $texto))
                ->take(5)->values();
            $grupos[] = ['titulo' => 'Ir a sección', 'items' => $opciones->map(fn ($m) => [
                'id' => $m['id'], 'titulo' => $m['titulo'], 'subtitulo' => 'Sección del sistema', 'ruta' => $m['ruta'],
            ])];
        }

        $grupos = array_values(array_filter($grupos, fn ($g) => count($g['items']) > 0));

        return response()->json(['grupos' => $grupos]);
    }
}
