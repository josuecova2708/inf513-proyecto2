<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MetodoPagoUsuario extends Modelo
{
    protected $table = 'metodo_pago_usuario';

    protected $hidden = ['token_simulado'];

    protected $casts = ['predeterminado' => 'boolean', 'fecha_registro' => 'datetime'];

    public function metodo(): BelongsTo
    {
        return $this->belongsTo(MetodoPago::class, 'metodo_pago_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }
}
