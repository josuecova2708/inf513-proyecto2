<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Comunidad extends Modelo
{
    protected $table = 'comunidad';

    public function emprendimientos(): HasMany
    {
        return $this->hasMany(Emprendimiento::class, 'comunidad_id');
    }
}
