<?php

namespace App\Models;

class Notificacion extends Modelo
{
    protected $table = 'notificacion';

    protected $casts = ['fecha_envio' => 'datetime', 'leida' => 'boolean'];
}
