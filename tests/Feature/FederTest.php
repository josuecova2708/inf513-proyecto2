<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Services\Pagos\PasarelaPago;
use App\Services\Pagos\ResultadoPago;
use App\Services\StripeServicio;
use Illuminate\Http\UploadedFile;
use Stripe\PaymentIntent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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

    public function test_pago_con_3d_secure_se_confirma_consultando_a_stripe(): void
    {
        // Pasarela falsa: el banco pide 3D Secure (como haría Stripe con 4000 0025 0000 3155)
        $this->app->bind(PasarelaPago::class, fn () => new class implements PasarelaPago
        {
            public function cobrar(array $datos): ResultadoPago
            {
                return new ResultadoPago('pendiente', 'pi_prueba_3ds', 'Su banco pide confirmar el pago (3D Secure).', 'pi_prueba_3ds_secret_x', 'stripe');
            }

            public function nombre(): string
            {
                return 'Falsa';
            }
        });
        $this->mock(StripeServicio::class, fn ($m) => $m->shouldReceive('consultar')->with('pi_prueba_3ds')
            ->andReturn(PaymentIntent::constructFrom(['id' => 'pi_prueba_3ds', 'status' => 'succeeded'])));

        $this->como('cliente.carlos@example.com');
        $tarjetaMetodo = DB::table('metodo_pago')->where('nombre', 'Tarjeta')->value('id');
        $tarjeta = $this->postJson('/api/mis-metodos-pago', [
            'metodo_pago_id' => $tarjetaMetodo, 'alias' => 'Visa', 'titular' => 'Carlos Vaca', 'numero_tarjeta' => '4111111111111111',
            'mes_venc' => 12, 'anio_venc' => now()->year + 2, 'cvv' => '123',
        ])->assertCreated()->json('metodo.id');
        $miel = DB::table('producto')->where('nombre', 'Miel de abeja pura')->value('id');
        $this->postJson('/api/carrito/items', ['producto_id' => $miel, 'cantidad' => 1])->assertOk();
        $pedido = $this->postJson('/api/carrito/confirmar', ['tipo_entrega' => 'recojo'])->json('pedido_id');

        $r = $this->postJson("/api/pedidos/{$pedido}/pagar", ['metodo_pago_id' => $tarjetaMetodo, 'metodo_pago_usuario_id' => $tarjeta])
            ->assertCreated()->assertJson(['estado' => 'pendiente', 'requiere_accion' => true, 'client_secret' => 'pi_prueba_3ds_secret_x']);
        $this->assertSame('pendiente', DB::table('pedido')->where('id', $pedido)->value('estado'));
        $this->assertDatabaseHas('pago', ['id' => $r->json('pago_id'), 'pasarela' => 'stripe', 'codigo_transaccion' => 'pi_prueba_3ds']);

        // Tras el 3D Secure, el servidor consulta a Stripe (no confía en el navegador)
        $this->postJson("/api/pagos/{$r->json('pago_id')}/confirmar")->assertOk()->assertJson(['estado' => 'pagado']);
        $this->assertSame('confirmado', DB::table('pedido')->where('id', $pedido)->value('estado'));

        // Otro cliente no puede confirmar pagos ajenos
        $this->como('cliente.ana@example.com')->postJson("/api/pagos/{$r->json('pago_id')}/confirmar")->assertForbidden();
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
        // Programar la entrega exige fecha y hora
        $this->putJson("/api/pedidos/{$pedido}/estado", ['estado' => 'listo_entrega'])
            ->assertStatus(422)->assertJsonPath('errors.fecha_programada.0', 'Indique la fecha y hora aproximada de la entrega.');
        $cuando = now()->addDay()->setTime(15, 0)->format('Y-m-d H:i');
        $this->putJson("/api/pedidos/{$pedido}/estado", ['estado' => 'listo_entrega', 'fecha_programada' => $cuando])->assertOk();
        $this->assertSame('listo_entrega', DB::table('pedido')->where('id', $pedido)->value('estado'));
        $this->assertDatabaseHas('movimiento_inventario', ['tipo' => 'salida', 'motivo' => "Pedido {$pedido}"]);
        $this->assertStringStartsWith($cuando, (string) DB::table('entrega')->where('pedido_id', $pedido)->value('fecha_programada'));
        $this->assertStringContainsString('aprox. a las 15:00', DB::table('notificacion')->where('pedido_id', $pedido)->orderByDesc('id')->value('mensaje'));
    }

    public function test_imagen_de_producto_se_comprime_y_reemplaza(): void
    {
        Storage::fake('public');
        $this->como('feder.personal@example.com');
        $p = DB::table('producto')->where('nombre', 'Miel de abeja pura')->first();
        $datos = (array) collect($p)->only(['categoria_id', 'nombre', 'descripcion', 'presentacion', 'unidad_medida', 'precio_venta', 'modalidad_venta', 'stock_minimo', 'estado'])->all();

        $this->post("/api/productos/{$p->id}", $datos + ['imagen' => UploadedFile::fake()->image('miel.jpg', 3000, 2000)], ['Accept' => 'application/json'])->assertOk();
        $primera = DB::table('producto')->where('id', $p->id)->value('imagen');
        $this->assertStringEndsWith('.webp', $primera);
        Storage::disk('public')->assertExists($primera);
        [$ancho, $alto] = getimagesizefromstring(Storage::disk('public')->get($primera));
        $this->assertSame([1000, 667], [$ancho, $alto]);

        // Reemplazar borra la anterior
        $this->post("/api/productos/{$p->id}", $datos + ['imagen' => UploadedFile::fake()->image('otra.png', 800, 800)], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('public')->assertMissing($primera);

        // Un PDF no es una imagen
        $this->post("/api/productos/{$p->id}", $datos + ['imagen' => UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.imagen.0', 'La imagen debe ser JPG, PNG o WEBP.');
    }

    public function test_productor_solo_cambia_la_foto_de_su_emprendimiento(): void
    {
        Storage::fake('public');
        $suyo = DB::table('emprendimiento')->where('nombre', 'Arrocera Los Angeles')->value('id');
        $ajeno = DB::table('emprendimiento')->where('nombre', 'Apícola Flor del Monte')->value('id');
        $this->como('productor.pedro@example.com');

        $this->post("/api/emprendimientos/{$suyo}/imagen", ['imagen' => UploadedFile::fake()->image('campo.jpg', 1200, 900)], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('public')->assertExists(DB::table('emprendimiento')->where('id', $suyo)->value('imagen'));
        $this->post("/api/emprendimientos/{$ajeno}/imagen", ['imagen' => UploadedFile::fake()->image('x.jpg')], ['Accept' => 'application/json'])->assertForbidden();

        // La foto se ve en la ficha pública del producto
        $arroz = DB::table('producto')->where('nombre', 'Arroz grano de oro')->value('id');
        $this->assertNotNull(collect($this->getJson("/api/catalogo/{$arroz}")->json('productores'))->firstWhere('id', $suyo)['imagen']);
    }

    public function test_envio_exige_ubicacion_y_cobra_segun_distancia(): void
    {
        $this->como('cliente.carlos@example.com');
        $miel = DB::table('producto')->where('nombre', 'Miel de abeja pura')->value('id');
        $base = ['tipo_entrega' => 'envio', 'direccion' => 'Av. Banzer 4to anillo'];

        $this->postJson('/api/carrito/items', ['producto_id' => $miel, 'cantidad' => 1])->assertOk();
        $this->postJson('/api/carrito/confirmar', $base)
            ->assertStatus(422)->assertJsonPath('errors.latitud.0', 'Marque su ubicación en el mapa.');
        // A ~60 km: fuera de la zona de envío
        $this->postJson('/api/carrito/confirmar', $base + ['latitud' => -17.30, 'longitud' => -63.16])
            ->assertStatus(422)->assertJsonFragment(['message' => 'La ubicación está fuera de la zona de envío (máx. 40 km de FEDER; la suya está a 69,4 km). Elija recojo en FEDER.']);

        // Junto a FEDER: tarifa base
        $cerca = $this->postJson('/api/carrito/confirmar', $base + ['latitud' => -17.7800, 'longitud' => -63.1640])->assertCreated()->json('pedido_id');
        $this->assertEquals(10.0, (float) DB::table('pedido')->where('id', $cerca)->value('costo_envio'));
        $this->assertDatabaseHas('entrega', ['pedido_id' => $cerca, 'latitud' => -17.78, 'longitud' => -63.164]);

        // A unos 6 km en línea recta: cuesta más
        $this->postJson('/api/carrito/items', ['producto_id' => $miel, 'cantidad' => 1])->assertOk();
        $lejos = $this->postJson('/api/carrito/confirmar', $base + ['latitud' => -17.7260, 'longitud' => -63.1640])->assertCreated()->json('pedido_id');
        $en = DB::table('entrega')->where('pedido_id', $lejos)->first();
        $this->assertEqualsWithDelta(7.8, (float) $en->distancia_km, 0.2);
        $this->assertEquals(24.5, (float) DB::table('pedido')->where('id', $lejos)->value('costo_envio'));
    }
}
