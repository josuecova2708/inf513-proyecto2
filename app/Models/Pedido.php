<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Pedido extends Modelo
{
    protected $table = 'pedido';

    protected $casts = ['fecha' => 'datetime', 'subtotal' => 'float', 'costo_envio' => 'float', 'total' => 'float'];

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'cliente_id');
    }

    public function gestor(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'personal_id');
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(DetallePedido::class, 'pedido_id');
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(Pago::class, 'pedido_id');
    }

    public function entrega(): HasOne
    {
        return $this->hasOne(Entrega::class, 'pedido_id');
    }

    public function plan(): HasOne
    {
        return $this->hasOne(PlanPago::class, 'pedido_id');
    }

    public function encargo(): BelongsTo
    {
        return $this->belongsTo(Encargo::class, 'encargo_id');
    }
}
