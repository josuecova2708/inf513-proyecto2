<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesPermisosSeeder::class,
            MenuSeeder::class,
            DatosDemoSeeder::class,
            PedidosDemoSeeder::class,
        ]);
        // Las pruebas no deben tocar las imágenes reales de storage/app/public
        if (! app()->runningUnitTests()) {
            $this->call(ImagenesDemoSeeder::class);
        }
    }
}
