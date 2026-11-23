<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Produccion extends Modelo
{
    protected $table = 'produccion';

    protected $casts = ['cantidad' => 'float', 'precio_propuesto' => 'float', 'fecha_validacion' => 'datetime', 'fecha_registro' => 'datetime'];

    public function emprendimiento(): BelongsTo
    {
        return $this->belongsTo(Emprendimiento::class, 'emprendimiento_id');
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }

    public function validador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'validado_por');
    }

    public function lotes(): HasMany
    {
        return $this->hasMany(Lote::class, 'produccion_id');
    }
}
