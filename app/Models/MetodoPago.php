<?php

namespace App\Models;

class MetodoPago extends Modelo
{
    protected $table = 'metodo_pago';

    protected $casts = ['habilitado' => 'boolean'];
}
