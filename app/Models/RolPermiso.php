<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RolPermiso extends Modelo
{
    protected $table = 'rol_permiso';

    public $incrementing = false;

    protected $primaryKey = null;

    protected $casts = ['ver' => 'boolean', 'crear' => 'boolean', 'editar' => 'boolean', 'eliminar' => 'boolean'];

    public function permiso(): BelongsTo
    {
        return $this->belongsTo(Permiso::class, 'permiso_id');
    }
}
