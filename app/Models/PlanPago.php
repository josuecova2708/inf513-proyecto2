<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlanPago extends Modelo
{
    protected $table = 'plan_pago';

    protected $casts = ['monto_total' => 'float', 'cuota_inicial' => 'float', 'fecha' => 'datetime'];

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function cuotas(): HasMany
    {
        return $this->hasMany(CuotaPago::class, 'plan_pago_id')->orderBy('numero');
    }
}
