<?php

use Illuminate\Support\Facades\Route;

// Capa de presentación: un único shell HTML para la SPA de React.
// Todas las rutas (excepto /api y /storage) las resuelve React Router en el navegador.
Route::get('/{ruta?}', fn () => view('spa'))
    ->where('ruta', '^(?!api(/|$)|storage(/|$)|up$).*$')
    ->name('spa');
