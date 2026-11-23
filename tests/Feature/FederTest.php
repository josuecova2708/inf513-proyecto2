<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pruebas de los requisitos transversales y de los flujos principales de los CU.
 * Requiere la BD PostgreSQL "feder_test" (ver phpunit.xml).
 */
class FederTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function login(string $email): string
    {
        return $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'feder123'])->assertOk()->json('token');
    }

    /** Cambia de usuario: limpia el guard (Sanctum guarda en caché al usuario del token anterior). */
    private function como(string $email): self
    {
        $token = $this->login($email);
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    public function test_login_exitoso_y_fallido_quedan_en_bitacora(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'cliente.ana@example.com', 'password' => 'incorrecta'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', 'El correo o la contraseña son incorrectos.');
        $this->login('cliente.ana@example.com');

        $this->assertDatabaseHas('bitacora', ['accion' => 'login_fallido', 'email' => 'cliente.ana@example.com', 'detalle' => 'Contraseña incorrecta']);
        $this->assertDatabaseHas('bitacora', ['accion' => 'login_ok', 'email' => 'cliente.ana@example.com']);
        $this->assertNotNull(DB::table('bitacora')->where('accion', 'login_ok')->value('ip'));
    }

    public function test_login_bloqueado_tras_cinco_intentos(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'cliente.ana@example.com', 'password' => 'x'.$i]);
        }
        $this->postJson('/api/auth/login', ['email' => 'cliente.ana@example.com', 'password' => 'feder123'])
            ->assertStatus(429)->assertJsonFragment(['message' => 'Demasiados intentos fallidos. Intente de nuevo en 60 segundos.']);
    }

    public function test_menu_dinamico_depende_del_rol(): void
    {
        $titulos = fn (string $email) => collect($this->como($email)->getJson('/api/auth/me')->assertOk()->json('menu'))
            ->flatMap(fn ($m) => array_merge([$m['titulo']], array_column($m['hijos'], 'titulo')))->all();

        $admin = $titulos('feder.admin@example.com');
        $this->app['auth']->forgetGuards();
        $cliente = $titulos('cliente.ana@example.com');

        $this->assertContains('Bitácora', $admin);
        $this->assertContains('Roles y permisos', $admin);
        $this->assertNotContains('Bitácora', $cliente);
        $this->assertContains('Mi carrito', $cliente);
        $this->assertContains('Mis métodos de pago', $cliente);
    }

    public function test_matriz_de_acceso_bloquea_y_registra_acceso_denegado(): void
    {
        $this->como('cliente.ana@example.com')->getJson('/api/usuarios')
            ->assertForbidden()->assertJsonFragment(['message' => 'No tiene permiso para ver en el módulo "usuarios".']);
        $this->assertDatabaseHas('bitacora', ['accion' => 'acceso_denegado', 'recurso' => 'usuarios']);
        $this->getJson('/api/pedidos')->assertOk();
    }

    public function test_contador_de_visitas_persistente(): void
    {
        $this->postJson('/api/visitas', ['pagina' => '/catalogo'])->assertOk()->assertJson(['contador' => 1]);
        // La misma IP no suma la misma página durante 30 minutos
        $this->postJson('/api/visitas', ['pagina' => '/catalogo'])->assertJson(['contador' => 1]);
        $this->postJson('/api/visitas', ['pagina' => '/catalogo/3'])->assertJson(['contador' => 1]);
        $this->assertDatabaseHas('visita_pagina', ['pagina' => '/catalogo', 'contador' => 1]);
        $this->postJson('/api/visitas', ['pagina' => 'javascript:alert(1)'])->assertStatus(422);
    }

    public function test_validacion_en_espanol(): void
    {
        $this->postJson('/api/auth/registro', ['nombre' => 'A1', 'email' => 'no-es-correo', 'password' => 'corta'])
            ->assertStatus(422)
            ->assertJsonPath('errors.nombre.0', 'El nombre solo puede contener letras y espacios.')
            ->assertJsonPath('errors.email.0', 'El campo correo electrónico debe ser un correo electrónico válido.')
            ->assertJsonPath('errors.apellido.0', 'El campo apellido es obligatorio.');
    }

    public function test_busqueda_global(): void
    {
        $grupos = collect($this->getJson('/api/buscar?q=miel')->assertOk()->json('grupos'));
        $this->assertTrue($grupos->contains('titulo', 'Productos'));
    }

    public function test_compra_completa_con_tarjeta_confirma_el_pedido(): void
    {
        $this->como('cliente.carlos@example.com');
        $tarjeta = $this->postJson('/api/mis-metodos-pago', [
            'metodo_pago_id' => DB::table('metodo_pago')->where('nombre', 'Tarjeta')->value('id'),
            'alias' => 'Visa', 'titular' => 'Carlos Vaca', 'numero_tarjeta' => '4111111111111111', 'mes_venc' => 12, 'anio_venc' => now()->year + 2, 'cvv' => '123',
        ])->assertCreated()->json('metodo.id');
        $this->assertDatabaseMissing('metodo_pago_usuario', ['ultimos4' => '4111111111111111']);

        $miel = DB::table('producto')->where('nombre', 'Miel de abeja pura')->value('id');
        $this->postJson('/api/carrito/items', ['producto_id' => $miel, 'cantidad' => 2])->assertOk();
        $pedido = $this->postJson('/api/carrito/confirmar', ['tipo_entrega' => 'recojo'])->assertCreated()->json('pedido_id');

        $this->assertSame('pendiente', DB::table('pedido')->where('id', $pedido)->value('estado'));
        $this->assertEquals(2, DB::table('reserva_lote as r')->join('detalle_pedido as d', 'd.id', '=', 'r.detalle_pedido_id')->where('d.pedido_id', $pedido)->sum('r.cantidad'));

        $this->postJson("/api/pedidos/{$pedido}/pagar", ['metodo_pago_id' => DB::table('metodo_pago')->where('nombre', 'Tarjeta')->value('id'), 'metodo_pago_usuario_id' => $tarjeta])
            ->assertCreated()->assertJson(['estado' => 'pagado']);
        $this->assertSame('confirmado', DB::table('pedido')->where('id', $pedido)->value('estado'));
        $this->assertDatabaseHas('notificacion', ['pedido_id' => $pedido, 'tipo' => 'pedido_confirmado', 'canal' => 'sistema']);
    }

    public function test_plan_de_pagos_en_cuotas(): void
    {
        $this->como('cliente.carlos@example.com');
        $soya = DB::table('producto')->where('nombre', 'Soya en grano')->value('id');
        $this->postJson('/api/carrito/items', ['producto_id' => $soya, 'cantidad' => 3])->assertOk();
        $pedido = $this->postJson('/api/carrito/confirmar', ['tipo_entrega' => 'recojo'])->json('pedido_id');

        $this->postJson("/api/pedidos/{$pedido}/plan", ['nro_cuotas' => 3, 'frecuencia' => 'mensual'])->assertCreated();
        $cuotas = DB::table('cuota_pago as c')->join('plan_pago as p', 'p.id', '=', 'c.plan_pago_id')->where('p.pedido_id', $pedido)->orderBy('numero')->get(['c.id', 'c.monto']);
        $this->assertCount(3, $cuotas);
        $this->assertEquals(114.0, round($cuotas->sum('monto'), 2));

        $this->postJson("/api/cuotas/{$cuotas[1]->id}/pagar", ['metodo_pago_id' => 1])->assertStatus(422)->assertJsonFragment(['message' => 'Primero debe pagar la cuota 1.']);
    }

    public function test_control_de_concurrencia_optimista_en_lotes(): void
    {
        $this->como('feder.personal@example.com');
        $lote = DB::table('lote')->where('codigo', 'ARR-001')->first();
        $datos = ['version' => $lote->version, 'estado' => 'disponible', 'costo_unitario' => 6.6];

        $this->putJson("/api/lotes/{$lote->id}", $datos)->assertOk();
        $this->putJson("/api/lotes/{$lote->id}", $datos)->assertStatus(409);
    }

    public function test_stock_insuficiente_y_flujo_de_estados(): void
    {
        $this->como('cliente.ana@example.com');
        $cafe = DB::table('producto')->where('nombre', 'Café de Samaipata molido')->value('id');
        $this->postJson('/api/carrito/items', ['producto_id' => $cafe, 'cantidad' => 99999])->assertStatus(422);

        $pedido = DB::table('pedido')->where('estado', 'confirmado')->value('id');
        $this->como('feder.personal@example.com');
        $this->putJson("/api/pedidos/{$pedido}/estado", ['estado' => 'entregado'])->assertStatus(422);
        $this->putJson("/api/pedidos/{$pedido}/estado", ['estado' => 'en_preparacion'])->assertOk();
        $this->assertDatabaseHas('movimiento_inventario', ['tipo' => 'salida', 'motivo' => "Pedido {$pedido}"]);
    }
}
