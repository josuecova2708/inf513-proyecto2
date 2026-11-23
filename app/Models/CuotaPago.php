<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CuotaPago extends Modelo
{
    protected $table = 'cuota_pago';

    protected $casts = ['monto' => 'float', 'fecha_vencimiento' => 'date', 'fecha_pago' => 'datetime'];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(PlanPago::class, 'plan_pago_id');
    }
}
