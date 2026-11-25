<?php

namespace App\Providers;

use App\Services\Pagos\PasarelaPago;
use App\Services\Pagos\PasarelaSimulada;
use App\Services\Pagos\PasarelaStripe;
use App\Services\StripeServicio;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Pasarela de pagos intercambiable desde el .env: PAGOS_PASARELA=stripe | simulada
        $this->app->bind(PasarelaPago::class, fn ($app) => StripeServicio::activo()
            ? $app->make(PasarelaStripe::class)
            : $app->make(PasarelaSimulada::class));
        $this->app->singleton(StripeServicio::class);
    }

    public function boot(): void
    {
        //
    }
}
