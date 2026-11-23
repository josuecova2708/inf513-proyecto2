<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Producto extends Modelo
{
    protected $table = 'producto';

    protected $casts = ['precio_venta' => 'float', 'stock_minimo' => 'float'];

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class, 'categoria_id');
    }

    public function emprendimientos(): BelongsToMany
    {
        return $this->belongsToMany(Emprendimiento::class, 'emprendimiento_producto', 'producto_id', 'emprendimiento_id')
            ->withPivot('precio_referencia', 'temporada');
    }
}
