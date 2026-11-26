<?php

namespace App\Models;

use App\Models\Concerns\ClavePrimariaId;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Usuario extends Authenticatable
{
    use ClavePrimariaId, HasApiTokens;

    public const ADMIN = 'Administrador';

    public const PERSONAL = 'Personal';

    public const PRODUCTOR = 'Productor';

    public const CLIENTE = 'Cliente';

    protected $table = 'usuario';

    public $timestamps = false;

    protected $guarded = ['id', 'password_hash'];

    protected $hidden = ['password_hash', 'stripe_customer_id'];

    protected $casts = ['fecha_registro' => 'datetime'];

    protected $appends = ['nombre_completo'];

    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    // Sin "recordarme": la API usa tokens Bearer (Sanctum)
    public function getRememberTokenName(): string
    {
        return '';
    }

    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class, 'rol_id');
    }

    public function emprendimiento(): HasOne
    {
        return $this->hasOne(Emprendimiento::class, 'usuario_id');
    }

    public function preferencia(): HasOne
    {
        return $this->hasOne(PreferenciaUsuario::class, 'usuario_id');
    }

    public function pedidos(): HasMany
    {
        return $this->hasMany(Pedido::class, 'cliente_id');
    }

    public function nombreRol(): string
    {
        return $this->rol?->nombre ?? '';
    }

    /** Administrador o Personal de FEDER: ven y gestionan datos de todos. */
    public function esStaff(): bool
    {
        return in_array($this->nombreRol(), [self::ADMIN, self::PERSONAL], true);
    }

    public function esAdmin(): bool
    {
        return $this->nombreRol() === self::ADMIN;
    }

    public function esCliente(): bool
    {
        return $this->nombreRol() === self::CLIENTE;
    }

    public function esProductor(): bool
    {
        return $this->nombreRol() === self::PRODUCTOR;
    }

    public function getNombreCompletoAttribute(): string
    {
        return trim($this->nombre.' '.$this->apellido);
    }
}
