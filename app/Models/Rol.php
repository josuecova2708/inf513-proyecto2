<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Rol extends Modelo
{
    protected $table = 'rol';

    public function permisos(): HasMany
    {
        return $this->hasMany(RolPermiso::class, 'rol_id');
    }

    public function usuarios(): HasMany
    {
        return $this->hasMany(Usuario::class, 'rol_id');
    }
}
