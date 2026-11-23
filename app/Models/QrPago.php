<?php

namespace App\Models;

class QrPago extends Modelo
{
    protected $table = 'qr_pago';

    protected $hidden = ['imagen'];

    protected $casts = ['activo' => 'boolean', 'fecha' => 'datetime'];
}
