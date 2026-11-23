<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lote extends Modelo
{
    protected $table = 'lote';

    protected $casts = ['cantidad_inicial' => 'float', 'stock_disponible' => 'float', 'stock_reservado' => 'float', 'costo_unitario' => 'float', 'version' => 'integer'];

    public function produccion(): BelongsTo
    {
        return $this->belongsTo(Produccion::class, 'produccion_id');
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(MovimientoInventario::class, 'lote_id');
    }
}
