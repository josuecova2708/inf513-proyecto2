<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReservaLote extends Modelo
{
    protected $table = 'reserva_lote';

    protected $casts = ['cantidad' => 'float', 'fecha' => 'datetime', 'fecha_expiracion' => 'datetime'];

    public function lote(): BelongsTo
    {
        return $this->belongsTo(Lote::class, 'lote_id');
    }
}
