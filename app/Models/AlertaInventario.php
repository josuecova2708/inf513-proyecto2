<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AlertaInventario extends Modelo
{
    protected $table = 'alerta_inventario';

    protected $casts = ['fecha' => 'datetime'];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }
}
