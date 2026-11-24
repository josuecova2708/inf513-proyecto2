<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

/**
 * Copia las fotos demo (database/seeders/imagenes, licencias en CREDITOS.md) a storage/app/public
 * y las asigna a los productos y emprendimientos de los datos demo.
 */
class ImagenesDemoSeeder extends Seeder
{
    private const PRODUCTOS = [
        'Arroz grano de oro' => 'arroz',
        'Maní pelado' => 'mani',
        'Miel de abeja pura' => 'miel',
        'Tomate perita' => 'tomate',
        'Papaya' => 'papaya',
        'Café de Samaipata molido' => 'cafe',
        'Lechuga crespa' => 'lechuga',
        'Soya en grano' => 'soya',
        'Polen de abeja' => 'polen',
    ];

    private const EMPRENDIMIENTOS = [
        'Arrocera Los Angeles' => 'arrozal',
        'Apícola Flor del Monte' => 'apiario',
        'Huerta Jorochito' => 'huerta',
        'Café Cuevas' => 'cafetal',
        'Granos Okinawa' => 'soyal',
    ];

    public function run(): void
    {
        $this->copiar('producto', 'productos', self::PRODUCTOS);
        $this->copiar('emprendimiento', 'emprendimientos', self::EMPRENDIMIENTOS);
    }

    private function copiar(string $tabla, string $carpeta, array $mapa): void
    {
        $disco = Storage::disk('public');
        $disco->deleteDirectory($carpeta); // la BD se está recreando: se descartan las imágenes anteriores
        $disco->makeDirectory($carpeta);
        foreach ($mapa as $nombre => $archivo) {
            $origen = database_path("seeders/imagenes/{$carpeta}/{$archivo}.webp");
            if (! File::exists($origen)) {
                continue;
            }
            $ruta = "{$carpeta}/demo-{$archivo}.webp";
            $disco->put($ruta, File::get($origen));
            DB::table($tabla)->where('nombre', $nombre)->update(['imagen' => $ruta]);
        }
    }
}
