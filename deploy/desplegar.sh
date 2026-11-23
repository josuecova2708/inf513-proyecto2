#!/usr/bin/env bash
# =============================================================================
#  Despliegue de FEDER en tecnoweb.org.bo  (ejecutar en el servidor, vía Cockpit)
#
#  Estructura esperada:
#    /home/grupo28sa/proyecto2/                 <- URL /inf513/grupo28sa/proyecto2
#    /home/grupo28sa/proyecto2/inf513-proyecto2 <- este repositorio (git clone)
#
#  Uso (desde la carpeta del repositorio):
#    bash deploy/desplegar.sh                  # despliegue / actualización normal
#    bash deploy/desplegar.sh --reiniciar-datos   # BORRA la BD y la recrea con datos demo
# =============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$(dirname "$APP_DIR")"
APP_NAME="$(basename "$APP_DIR")"
cd "$APP_DIR"

paso() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

paso "Proyecto: $APP_DIR  |  Carpeta web: $WEB_DIR"

if [ -d .git ]; then
    paso "Actualizando código (git pull)"
    git pull --ff-only
fi

if [ ! -f .env ]; then
    cp .env.production.example .env
    paso "Se creó .env desde .env.production.example"
    composer install --no-dev --optimize-autoloader --no-interaction
    php artisan key:generate --force
    echo "Complete DB_PASSWORD en $APP_DIR/.env y vuelva a ejecutar este script."
    exit 1
fi

paso "Dependencias PHP (composer)"
composer install --no-dev --optimize-autoloader --no-interaction

paso "Compilando el frontend React (npm run build)"
npm ci --no-audit --no-fund
npm run build

paso ".htaccess de producción"
cp deploy/htaccess.produccion public/.htaccess

if [ "${1:-}" = "--reiniciar-datos" ]; then
    read -r -p "Esto BORRA todos los datos de la BD y carga los datos demo. Escriba SI para continuar: " r
    [ "$r" = "SI" ] || { echo "Cancelado."; exit 1; }
    paso "Recreando la base de datos con datos demo"
    php artisan db:wipe --drop-views --force
    php artisan migrate --seed --force
else
    paso "Migraciones (solo las pendientes)"
    php artisan migrate --force
fi

paso "Enlace de almacenamiento (imágenes de productos)"
php artisan storage:link 2>/dev/null || true

paso "Permisos de escritura (Apache corre con otro usuario)"
chmod -R 777 storage bootstrap/cache

paso "Enlaces simbólicos en $WEB_DIR"
cd "$WEB_DIR"
for f in index.php .htaccess build storage favicon.svg favicon.ico robots.txt; do
    if [ -e "$APP_NAME/public/$f" ] || [ -L "$APP_NAME/public/$f" ]; then
        ln -sfn "$APP_NAME/public/$f" "$f"
    fi
done
ls -la "$WEB_DIR" | grep -- '->' || true
cd "$APP_DIR"

paso "Optimizando caché de configuración, rutas y vistas"
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

paso "Listo: https://www.tecnoweb.org.bo/inf513/grupo28sa/proyecto2"
