<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Entrega extends Modelo
{
    protected $table = 'entrega';

    protected $casts = ['fecha_programada' => 'datetime', 'fecha_entrega' => 'datetime'];

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    public function despachador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'despachado_por');
    }
}
