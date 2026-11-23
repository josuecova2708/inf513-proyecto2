<?php

namespace App\Providers;

use App\Services\Pagos\PasarelaPago;
use App\Services\Pagos\PasarelaSimulada;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Pasarela de pagos intercambiable (simulada mientras PagoFácil no esté habilitado)
        $this->app->bind(PasarelaPago::class, PasarelaSimulada::class);
    }

    public function boot(): void
    {
        //
    }
}
