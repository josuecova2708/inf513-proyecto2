<!DOCTYPE html>
<html lang="es" data-tema="adultos" data-modo="dia" data-contraste="normal">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="FEDER - Productos de comunidades agrícolas de Santa Cruz, directo del productor a tu mesa.">
    <title>FEDER · Comercio de comunidades agrícolas</title>
    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    <script>
        // Configuración en tiempo de ejecución: funciona igual en local y en la subcarpeta de tecnoweb
        window.FEDER = {
            basePath: @json(rtrim(request()->getBasePath(), '/')),
            apiUrl: @json(url('/api')),
            storageUrl: @json(asset('storage')),
        };
        // Aplica el tema guardado antes de pintar, para evitar parpadeo
        (function () {
            try {
                var p = JSON.parse(localStorage.getItem('feder_tema') || 'null');
                if (!p) return;
                var h = new Date().getHours();
                var modo = p.modo === 'auto' ? (h >= 7 && h < 19 ? 'dia' : 'noche') : p.modo;
                var r = document.documentElement;
                r.setAttribute('data-tema', p.tema || 'adultos');
                r.setAttribute('data-modo', modo || 'dia');
                r.setAttribute('data-contraste', p.contraste || 'normal');
                r.style.setProperty('--tamano-base', (p.tamano_fuente || 16) + 'px');
            } catch (e) {}
        })();
    </script>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/main.jsx'])
</head>
<body>
    <noscript>Esta aplicación necesita JavaScript habilitado.</noscript>
    <div id="app"></div>
</body>
</html>
