<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Foto del emprendimiento: la sube el productor y se muestra en "Producido por" del catálogo. */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE emprendimiento ADD COLUMN imagen VARCHAR(255)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE emprendimiento DROP COLUMN imagen');
    }
};
