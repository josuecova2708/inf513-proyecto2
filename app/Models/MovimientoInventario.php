<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovimientoInventario extends Modelo
{
    protected $table = 'movimiento_inventario';

    protected $casts = ['cantidad' => 'float', 'fecha' => 'datetime'];

    public function lote(): BelongsTo
    {
        return $this->belongsTo(Lote::class, 'lote_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }
}
