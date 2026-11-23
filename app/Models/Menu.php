<?php

namespace App\Models;

class Menu extends Modelo
{
    protected $table = 'menu';

    protected $casts = ['activo' => 'boolean'];
}
