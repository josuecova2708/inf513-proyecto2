<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Base de los modelos FEDER: tablas en singular (español) sin created_at/updated_at.
 */
abstract class Modelo extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];
}
