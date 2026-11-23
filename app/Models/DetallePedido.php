<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DetallePedido extends Modelo
{
    protected $table = 'detalle_pedido';

    protected $casts = ['cantidad' => 'float', 'precio_unitario' => 'float', 'subtotal' => 'float'];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    public function reservas(): HasMany
    {
        return $this->hasMany(ReservaLote::class, 'detalle_pedido_id');
    }
}
