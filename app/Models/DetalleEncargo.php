<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DetalleEncargo extends Modelo
{
    protected $table = 'detalle_encargo';

    public $incrementing = false;

    protected $primaryKey = null;

    protected $casts = ['cantidad' => 'float', 'precio_estimado' => 'float'];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }
}
