<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Esquema base heredado del 1er parcial (23 tablas, 3 vistas, 7 funciones plpgsql).
 * El SQL vive en database/sql/feder_base.sql para que se pueda leer y documentar aparte.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(file_get_contents(database_path('sql/feder_base.sql')));
    }

    public function down(): void
    {
        DB::unprepared('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    }
};
