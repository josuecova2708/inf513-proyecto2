<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Emprendimiento extends Modelo
{
    protected $table = 'emprendimiento';

    protected $casts = ['latitud' => 'float', 'longitud' => 'float'];

    public function comunidad(): BelongsTo
    {
        return $this->belongsTo(Comunidad::class, 'comunidad_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function producciones(): HasMany
    {
        return $this->hasMany(Produccion::class, 'emprendimiento_id');
    }

    public function productos(): BelongsToMany
    {
        return $this->belongsToMany(Producto::class, 'emprendimiento_producto', 'emprendimiento_id', 'producto_id')
            ->withPivot('precio_referencia', 'temporada');
    }
}
