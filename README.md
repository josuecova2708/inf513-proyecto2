# FEDER · Sistema web de comercio de comunidades agrícolas

INF513 Tecnología Web · Proyecto 2 · Grupo 28sa (UAGRM – FICCT)

Arquitectura de 3 capas:

| Capa | Tecnología | Dónde está |
|---|---|---|
| Presentación | React 19 (SPA) + Vite + Tailwind, axios | `resources/js` |
| Lógica de negocio | Laravel 13, API RESTful con tokens Sanctum | `app/`, `routes/api.php` |
| Datos | PostgreSQL (esquema del 1er parcial + tablas web) | `database/` |

---

## Requisitos

- **PHP 8.3 o superior** con las extensiones `pdo_pgsql` y `pgsql` activadas.
- **Composer 2**.
- **Node.js 20 o superior** (con npm).
- **PostgreSQL 15 o superior**. Tiene que ser PostgreSQL: el esquema usa funciones plpgsql, así que no funciona con MySQL ni SQLite.

> **Con Laragon:** activa las extensiones en *Menú → PHP → Extensions → `pdo_pgsql` y `pgsql`*. Laragon no trae PostgreSQL, así que hay que instalarlo aparte (instalador oficial). Después, en Windows, abre *Servicios* y verifica que el servicio `postgresql-x64-NN` esté **iniciado**.

---

## Instalación local (primera vez)

```bash
# 1. Clonar
git clone https://github.com/<cuenta>/inf513-proyecto2.git
cd inf513-proyecto2

# 2. Dependencias
composer install
npm install

# 3. Configuración
cp .env.example .env          # en PowerShell: copy .env.example .env
php artisan key:generate
```

**4. Crear la base de datos local.** Hazlo con pgAdmin, HeidiSQL o psql:

```sql
CREATE DATABASE feder_local ENCODING 'UTF8' TEMPLATE template0;
```

**5. Credenciales.** Abre el `.env` y completa los datos de **tu** PostgreSQL:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=feder_local
DB_USERNAME=postgres
DB_PASSWORD=tu_contraseña
```

**6. Crear las tablas y cargar los datos demo:**

```bash
php artisan migrate:fresh --seed
php artisan storage:link
```

---

## Correr el proyecto

Abre **dos terminales** en la carpeta del proyecto:

```bash
# Terminal 1: API Laravel
php artisan serve

# Terminal 2: React con recarga en caliente
npm run dev
```

Luego entra a **http://localhost:8000**.

> Si no vas a tocar el frontend, puedes compilarlo una sola vez con `npm run build` y usar solo `php artisan serve`.

### Usuarios demo

La contraseña de todos es `feder123`. En la pantalla de login también hay botones para rellenarlos.

| Rol | Correo |
|---|---|
| Administrador | `feder.admin@example.com` |
| Personal de FEDER | `feder.personal@example.com` |
| Productor | `productor.pedro@example.com` · `productor.rosa@example.com` |
| Cliente | `cliente.ana@example.com` · `cliente.carlos@example.com` |

**Tarjetas de prueba** (pasarela simulada):

| Número | Resultado |
|---|---|
| `4111 1111 1111 1111` | aprobada |
| `4000 0000 0000 0002` | rechazada por fondos insuficientes |

Usa cualquier CVV y una fecha de vencimiento futura.

### Comandos útiles

| Comando | Para qué |
|---|---|
| `php artisan migrate:fresh --seed` | Reinicia la BD local con los datos demo |
| `php artisan test` | Pruebas automáticas. Requieren una BD `feder_test` vacía, creada igual que `feder_local` |
| `php artisan route:list --path=api` | Lista los endpoints de la API |
| `npm run build` | Compila el frontend para producción |

---

## Problemas frecuentes

| Error | Solución |
|---|---|
| `could not find driver` | Falta activar `pdo_pgsql` en el `php.ini` (o en Laragon) |
| `Connection refused … 5432` | El servicio de PostgreSQL está detenido: inícialo en *Servicios* |
| `password authentication failed` | Revisa `DB_USERNAME` y `DB_PASSWORD` en `.env` |
| `No application encryption key` | Ejecuta `php artisan key:generate` |
| La página carga en blanco | Asegúrate de tener `npm run dev` corriendo, o ejecuta `npm run build` |
| `Vite manifest not found` | Ejecuta `npm run build`, o deja corriendo `npm run dev` |

---

## Estructura

```
app/Http/Controllers/Api/   Controladores REST (uno por recurso)
app/Http/Middleware/        VerificarPermiso (RBAC) y RegistrarBitacora (auditoría)
app/Services/               Reglas de negocio (pedidos, pagos, permisos, mantenimiento)
app/Services/Pagos/         Pasarela de pago (simulada, intercambiable por PagoFácil)
database/sql/feder_base.sql Esquema heredado del 1er parcial (tablas, vistas y funciones)
database/migrations/        Esquema base + tablas web (bitácora, visitas, menú, pagos…)
database/seeders/           Roles, matriz de permisos, menú dinámico y datos demo
resources/js/               SPA React: páginas, layouts, contextos (sesión, tema, carrito)
deploy/                     .htaccess de producción y script de despliegue en tecnoweb
docs/                       Matriz de acceso y catálogo de endpoints
```

## Despliegue en tecnoweb

Se despliega en la terminal de Cockpit del servidor, dentro de `/home/grupo28sa/proyecto2/`:

```bash
git clone https://github.com/<cuenta>/inf513-proyecto2.git
cd inf513-proyecto2
bash deploy/desplegar.sh   # la primera vez crea el .env: completa DB_PASSWORD y vuelve a ejecutarlo
```

El script hace todo el resto:

- instala las dependencias y compila React;
- ejecuta las migraciones;
- crea los enlaces simbólicos de `public/`;
- deja la web en **https://www.tecnoweb.org.bo/inf513/grupo28sa/proyecto2**.
