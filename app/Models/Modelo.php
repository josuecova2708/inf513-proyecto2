<?php

namespace App\Models;

use App\Models\Concerns\ClavePrimariaId;
use Illuminate\Database\Eloquent\Model;

/**
 * Base de los modelos FEDER: tablas en singular (español) sin created_at/updated_at,
 * clave primaria id_<tabla> (ver ClavePrimariaId).
 */
abstract class Modelo extends Model
{
    use ClavePrimariaId;

    public $timestamps = false;

    protected $guarded = ['id'];
}
