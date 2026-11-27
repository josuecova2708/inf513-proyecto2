#!/usr/bin/env bash
# =============================================================================
#  Despliegue de FEDER en tecnoweb.org.bo  (ejecutar en el servidor, por SSH)
#
#  Acceso:  ssh grupo28sa@www.tecnoweb.org.bo   (desde PowerShell)
#
#  Estructura esperada:
#    /home/grupo28sa/proyecto2/                 <- URL /inf513/grupo28sa/proyecto2
#    /home/grupo28sa/proyecto2/inf513-proyecto2 <- este repositorio (git clone)
#
#  OJO: Apache publica TODO /home/grupo28sa (alias /inf513/grupo28sa), así que la
#  carpeta del repositorio también es accesible por URL. Este script la bloquea
#  (.htaccess "Require all denied") y deja el .env legible solo por el dueño.
#
#  Uso (desde la carpeta del repositorio):
#    bash deploy/desplegar.sh                     # despliegue / actualización normal
#    bash deploy/desplegar.sh --reiniciar-datos   # BORRA la BD y la recrea con datos demo
# =============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$(dirname "$APP_DIR")"
APP_NAME="$(basename "$APP_DIR")"
URL="https://www.tecnoweb.org.bo/inf513/grupo28sa/proyecto2"
cd "$APP_DIR"

paso() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

paso "Proyecto: $APP_DIR  |  Carpeta web: $WEB_DIR"

# Lo primero: que Apache no sirva nada de la carpeta del repositorio (.env, storage/logs, código).
# PHP-FPM lo sigue leyendo por el sistema de archivos; build/, storage/ e img/ se sirven por los
# enlaces simbólicos de $WEB_DIR, que no pasan por esta carpeta.
paso "Bloqueando el acceso web a la carpeta del repositorio"
printf 'Require all denied\n' > "$APP_DIR/.htaccess"

if [ -d .git ]; then
    paso "Actualizando código (git pull)"
    git pull --ff-only
fi

if [ ! -f .env ]; then
    cp .env.production.example .env
    chmod 600 .env
    paso "Se creó .env desde .env.production.example"
    composer install --no-dev --optimize-autoloader --no-interaction
    php artisan key:generate --force
    echo "Complete DB_PASSWORD en $APP_DIR/.env (y, si usa Stripe, PAGOS_PASARELA=stripe con"
    echo "las claves pk_test/sk_test) y vuelva a ejecutar este script."
    exit 1
fi

paso "Dependencias PHP (composer)"
composer install --no-dev --optimize-autoloader --no-interaction

paso "Compilando el frontend React (npm run build)"
npm ci --no-audit --no-fund
npm run build

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
mkdir -p storage/app/public/productos storage/app/public/emprendimientos
php artisan storage:link 2>/dev/null || true

paso "Permisos de escritura (PHP-FPM corre como apache)"
chmod -R 777 storage bootstrap/cache
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
    paso "SELinux en Enforcing: habilitando escritura de Apache en storage y bootstrap/cache"
    chcon -R -t httpd_sys_rw_content_t storage bootstrap/cache
fi

paso "Carpeta web $WEB_DIR: .htaccess de producción y enlaces simbólicos"
# Se copia (no se enlaza) para no modificar public/.htaccess, que está versionado:
# así el próximo git pull no choca con cambios locales.
cp deploy/htaccess.produccion "$WEB_DIR/.htaccess"
cd "$WEB_DIR"
for f in index.php build storage img favicon.png favicon.svg favicon.ico robots.txt; do
    if [ -e "$APP_NAME/public/$f" ] || [ -L "$APP_NAME/public/$f" ]; then
        ln -sfn "$APP_NAME/public/$f" "$f"
    fi
done
ls -la "$WEB_DIR" | grep -E -- '->|\.htaccess' || true
cd "$APP_DIR"

paso "Optimizando caché de configuración, rutas y vistas"
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Con la configuración en caché, Laravel ya no lee .env en cada petición: solo el dueño
# (artisan, este script) necesita leerlo. Apache recibe 403 aunque no aplicara el .htaccess.
chmod 600 .env

paso "Listo: $URL"
cat <<EOF
Compruébelo DESDE SU PC (el servidor no responde a su propio dominio), en PowerShell:
  curl.exe -sI $URL/                                  -> 200
  curl.exe -sI $URL/catalogo                          -> 200 (si da 404, Apache no aplica .htaccess)
  curl.exe -sI $URL/build/manifest.json               -> 200
  curl.exe -sI $URL/$APP_NAME/.env                    -> 403 (o 404), NUNCA 200
EOF
