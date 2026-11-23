<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Encargo extends Modelo
{
    protected $table = 'encargo';

    protected $casts = ['fecha_solicitud' => 'datetime'];

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'cliente_id');
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(DetalleEncargo::class, 'encargo_id');
    }

    public function pedido(): HasOne
    {
        return $this->hasOne(Pedido::class, 'encargo_id');
    }
}
