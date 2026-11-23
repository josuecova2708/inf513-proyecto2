<?php

namespace App\Models;

class VisitaPagina extends Modelo
{
    protected $table = 'visita_pagina';

    protected $casts = ['ultima_visita' => 'datetime'];
}
