<?php

namespace App\Models;

class PreferenciaUsuario extends Modelo
{
    protected $table = 'preferencia_usuario';

    protected $primaryKey = 'usuario_id';

    public $incrementing = false;

    protected $guarded = [];
}
