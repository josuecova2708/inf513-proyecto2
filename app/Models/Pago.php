<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pago extends Modelo
{
    protected $table = 'pago';

    protected $casts = ['monto' => 'float', 'fecha' => 'datetime'];

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    public function metodo(): BelongsTo
    {
        return $this->belongsTo(MetodoPago::class, 'metodo_pago_id');
    }

    public function metodoUsuario(): BelongsTo
    {
        return $this->belongsTo(MetodoPagoUsuario::class, 'metodo_pago_usuario_id');
    }

    public function cuota(): BelongsTo
    {
        return $this->belongsTo(CuotaPago::class, 'cuota_pago_id');
    }
}
