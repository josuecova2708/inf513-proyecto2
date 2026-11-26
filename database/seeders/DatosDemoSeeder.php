<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Datos demo del dominio FEDER (basados en datos_prueba.sql del 1er parcial).
 * Clave de todos los usuarios demo: feder123
 */
class DatosDemoSeeder extends Seeder
{
    public function run(): void
    {
        $rol = DB::table('rol')->pluck('id_rol', 'nombre');
        $hash = Hash::make('feder123');

        // ---------- CU1: usuarios ----------
        $usuarios = [
            ['Administrador', 'Admin', 'FEDER', '1000001', 'feder.admin@example.com', '70000001', 'Oficina central FEDER'],
            ['Personal', 'Lucia', 'Mendez', '1000002', 'feder.personal@example.com', '70000002', 'Oficina central FEDER'],
            ['Productor', 'Pedro', 'Choque', '4567890', 'productor.pedro@example.com', '71122334', 'Comunidad Los Angeles, San Julian'],
            ['Productor', 'Rosa', 'Quispe', '5678901', 'productor.rosa@example.com', '72233445', 'Comunidad Cuevas, Samaipata'],
            ['Cliente', 'Ana', 'Rojas', '7894561', 'cliente.ana@example.com', '73344556', 'Av. Banzer 4to anillo #120'],
            ['Cliente', 'Carlos', 'Vaca', '8905672', 'cliente.carlos@example.com', '74455667', 'Calle Warnes #45'],
            ['Cliente', 'Maria', 'Suarez', '9012783', 'cliente.maria@example.com', '75566771', 'Barrio Equipetrol, calle 9 #12'],
            ['Cliente', 'Jorge', 'Paz', '9123894', 'cliente.jorge@example.com', '76677882', 'Av. Alemana 3er anillo #300'],
        ];
        foreach ($usuarios as [$r, $nombre, $apellido, $ci, $email, $tel, $dir]) {
            DB::table('usuario')->insert([
                'rol_id' => $rol[$r], 'nombre' => $nombre, 'apellido' => $apellido, 'ci' => $ci,
                'email' => $email, 'telefono' => $tel, 'password_hash' => $hash, 'direccion' => $dir,
            ]);
        }
        $u = DB::table('usuario')->pluck('id_usuario', 'email');

        // ---------- CU2: comunidades y emprendimientos ----------
        DB::table('comunidad')->insert([
            ['nombre' => 'Comunidad Los Angeles', 'municipio' => 'San Julian', 'provincia' => 'Nuflo de Chavez', 'descripcion' => 'Productores de arroz y maní'],
            ['nombre' => 'Colonia Okinawa', 'municipio' => 'Okinawa Uno', 'provincia' => 'Warnes', 'descripcion' => 'Granos y oleaginosas'],
            ['nombre' => 'Comunidad Cuevas', 'municipio' => 'Samaipata', 'provincia' => 'Florida', 'descripcion' => 'Apicultura y café de altura'],
            ['nombre' => 'Comunidad Jorochito', 'municipio' => 'El Torno', 'provincia' => 'Andres Ibañez', 'descripcion' => 'Hortalizas y frutas'],
        ]);
        $c = DB::table('comunidad')->pluck('id_comunidad', 'nombre');

        DB::table('emprendimiento')->insert([
            ['comunidad_id' => $c['Comunidad Los Angeles'], 'usuario_id' => $u['productor.pedro@example.com'], 'nombre' => 'Arrocera Los Angeles', 'rubro' => 'agricola', 'responsable' => 'Pedro Choque', 'ci_nit' => '4567890', 'telefono' => '71122334', 'direccion' => 'Km 5 carretera a San Julian', 'latitud' => -16.906, 'longitud' => -62.616],
            ['comunidad_id' => $c['Comunidad Cuevas'], 'usuario_id' => $u['productor.rosa@example.com'], 'nombre' => 'Apícola Flor del Monte', 'rubro' => 'agricola', 'responsable' => 'Rosa Quispe', 'ci_nit' => '5678901', 'telefono' => '72233445', 'direccion' => 'Camino a Cuevas s/n', 'latitud' => -18.180, 'longitud' => -63.876],
            ['comunidad_id' => $c['Comunidad Jorochito'], 'usuario_id' => null, 'nombre' => 'Huerta Jorochito', 'rubro' => 'agricola', 'responsable' => 'Juan Mamani', 'ci_nit' => '6789012', 'telefono' => '75566778', 'direccion' => 'Jorochito, El Torno', 'latitud' => -17.995, 'longitud' => -63.381],
            ['comunidad_id' => $c['Comunidad Cuevas'], 'usuario_id' => null, 'nombre' => 'Café Cuevas', 'rubro' => 'alimentos_procesados', 'responsable' => 'Elena Flores', 'ci_nit' => '7890123', 'telefono' => '76677889', 'direccion' => 'Samaipata centro', 'latitud' => null, 'longitud' => null],
            ['comunidad_id' => $c['Colonia Okinawa'], 'usuario_id' => null, 'nombre' => 'Granos Okinawa', 'rubro' => 'agricola', 'responsable' => 'Kenji Tamura', 'ci_nit' => '8901234', 'telefono' => '77788990', 'direccion' => 'Okinawa Uno, zona norte', 'latitud' => -17.217, 'longitud' => -62.885],
        ]);
        $e = DB::table('emprendimiento')->pluck('id_emprendimiento', 'nombre');

        // ---------- CU4: categorías y productos ----------
        DB::table('categoria')->insert([
            ['nombre' => 'Granos y cereales', 'descripcion' => 'Arroz, maní, maíz y otros granos'],
            ['nombre' => 'Miel y derivados', 'descripcion' => 'Miel de abeja y productos apícolas'],
            ['nombre' => 'Hortalizas', 'descripcion' => 'Verduras frescas'],
            ['nombre' => 'Frutas', 'descripcion' => 'Frutas de temporada'],
            ['nombre' => 'Café y bebidas', 'descripcion' => 'Café de altura y bebidas'],
        ]);
        $cat = DB::table('categoria')->pluck('id_categoria', 'nombre');

        $productos = [
            ['Granos y cereales', 'Arroz grano de oro', 'Arroz seleccionado de San Julián', 'Bolsa 1 kg', 'kg', 9.50, 'ambas', 50],
            ['Granos y cereales', 'Maní pelado', 'Maní pelado y seleccionado', 'Bolsa 1 kg', 'kg', 18.00, 'inmediata', 20],
            ['Miel y derivados', 'Miel de abeja pura', 'Miel multifloral de Samaipata', 'Frasco 500 g', 'frasco', 45.00, 'ambas', 10],
            ['Hortalizas', 'Tomate perita', 'Tomate fresco de El Torno', 'Por kilo', 'kg', 7.00, 'inmediata', 30],
            ['Frutas', 'Papaya', 'Papaya de temporada (solo por encargo)', 'Unidad', 'unidad', 12.00, 'encargo', 0],
            ['Café y bebidas', 'Café de Samaipata molido', 'Café de altura tostado y molido', 'Bolsa 250 g', 'bolsa', 35.00, 'ambas', 15],
            ['Hortalizas', 'Lechuga crespa', 'Lechuga hidropónica (solo por encargo)', 'Unidad', 'unidad', 4.00, 'encargo', 0],
            ['Granos y cereales', 'Soya en grano', 'Soya seleccionada de Okinawa', 'Bolsa 5 kg', 'bolsa', 38.00, 'ambas', 10],
            ['Miel y derivados', 'Polen de abeja', 'Polen natural deshidratado', 'Frasco 250 g', 'frasco', 30.00, 'inmediata', 5],
        ];
        foreach ($productos as [$categoria, $nombre, $desc, $pres, $um, $precio, $modalidad, $min]) {
            DB::table('producto')->insert([
                'categoria_id' => $cat[$categoria], 'nombre' => $nombre, 'descripcion' => $desc, 'presentacion' => $pres,
                'unidad_medida' => $um, 'precio_venta' => $precio, 'modalidad_venta' => $modalidad, 'stock_minimo' => $min,
            ]);
        }
        $p = DB::table('producto')->pluck('id_producto', 'nombre');

        $ofertas = [
            ['Arrocera Los Angeles', 'Arroz grano de oro', 6.50, 'todo el año'],
            ['Arrocera Los Angeles', 'Maní pelado', 12.00, 'abril-agosto'],
            ['Apícola Flor del Monte', 'Miel de abeja pura', 28.00, 'septiembre-diciembre'],
            ['Apícola Flor del Monte', 'Polen de abeja', 18.00, 'septiembre-diciembre'],
            ['Huerta Jorochito', 'Tomate perita', 4.00, 'todo el año'],
            ['Huerta Jorochito', 'Papaya', 7.00, 'noviembre-marzo'],
            ['Huerta Jorochito', 'Lechuga crespa', 2.50, 'todo el año'],
            ['Café Cuevas', 'Café de Samaipata molido', 22.00, 'junio-octubre'],
            ['Granos Okinawa', 'Soya en grano', 25.00, 'marzo-junio'],
        ];
        foreach ($ofertas as [$emp, $prod, $precio, $temp]) {
            DB::table('emprendimiento_producto')->insert([
                'emprendimiento_id' => $e[$emp], 'producto_id' => $p[$prod], 'precio_referencia' => $precio, 'temporada' => $temp,
            ]);
        }

        // ---------- CU3: producción validada por Personal y lotes ----------
        $personal = $u['feder.personal@example.com'];
        $producciones = [
            // emprendimiento, producto, tipo, cantidad, um, días producción, días disponible, precio, procedencia, lote, cant lote, vence en días, costo
            ['Arrocera Los Angeles', 'Arroz grano de oro', 'disponible', 600, 'kg', -60, -55, 6.50, 'Parcela norte, San Julián', 'ARR-001', 600, 300, 6.50],
            ['Arrocera Los Angeles', 'Maní pelado', 'disponible', 150, 'kg', -65, -60, 12.00, 'San Julián', 'MAN-001', 150, 180, 12.00],
            ['Apícola Flor del Monte', 'Miel de abeja pura', 'disponible', 90, 'frasco', -62, -58, 28.00, 'Apiario Cuevas', 'MIE-001', 90, 365, 28.00],
            ['Apícola Flor del Monte', 'Polen de abeja', 'disponible', 40, 'frasco', -40, -38, 18.00, 'Apiario Cuevas', 'POL-001', 40, 240, 18.00],
            ['Huerta Jorochito', 'Tomate perita', 'disponible', 200, 'kg', -5, -3, 4.00, 'Huerta Jorochito', 'TOM-001', 200, 5, 4.00],
            ['Café Cuevas', 'Café de Samaipata molido', 'disponible', 60, 'bolsa', -70, -65, 22.00, 'Finca Cuevas', 'CAF-001', 60, 200, 22.00],
            ['Granos Okinawa', 'Soya en grano', 'disponible', 80, 'bolsa', -50, -45, 25.00, 'Okinawa Uno', 'SOY-001', 80, 270, 25.00],
            ['Huerta Jorochito', 'Papaya', 'futura', 200, 'unidad', null, 30, 7.00, 'Huerta Jorochito', null, null, null, null],
        ];
        foreach ($producciones as [$emp, $prod, $tipo, $cant, $um, $dProd, $dDisp, $precio, $proc, $lote, $cantLote, $vence, $costo]) {
            $id = DB::table('produccion')->insertGetId([
                'emprendimiento_id' => $e[$emp], 'producto_id' => $p[$prod], 'validador_id' => $personal, 'tipo' => $tipo,
                'cantidad' => $cant, 'unidad_medida' => $um,
                'fecha_produccion' => $dProd === null ? null : now()->addDays($dProd)->toDateString(),
                'fecha_disponible' => now()->addDays($dDisp)->toDateString(),
                'precio_propuesto' => $precio, 'procedencia' => $proc, 'estado' => 'validada',
                'fecha_validacion' => now()->addDays(($dDisp ?? 0) - 1),
            ], 'id_produccion');
            if ($lote) {
                DB::select('SELECT fn_ingresar_lote(?, ?, ?, ?, ?, ?)', [
                    $id, $lote, $cantLote, $personal, now()->addDays($vence)->toDateString(), $costo,
                ]);
                DB::table('lote')->where('codigo', $lote)->update(['fecha_ingreso' => now()->addDays($dDisp)->toDateString()]);
            }
        }
        // Producción reportada por el productor, pendiente de validación
        DB::table('produccion')->insert([
            'emprendimiento_id' => $e['Arrocera Los Angeles'], 'producto_id' => $p['Arroz grano de oro'], 'tipo' => 'disponible',
            'cantidad' => 300, 'unidad_medida' => 'kg', 'fecha_produccion' => now()->subDays(2)->toDateString(),
            'fecha_disponible' => now()->addDays(3)->toDateString(), 'precio_propuesto' => 6.80, 'procedencia' => 'Parcela sur, San Julián',
        ]);
    }
}
