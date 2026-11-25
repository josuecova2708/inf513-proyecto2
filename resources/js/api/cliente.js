import axios from 'axios';

// Configuración inyectada por spa.blade.php (funciona en local y en la subcarpeta de tecnoweb)
const config = window.FEDER ?? { basePath: '', apiUrl: '/api', storageUrl: '/storage' };

export const BASE_PATH = config.basePath || '';
export const STORAGE_URL = config.storageUrl;
export const IMG_URL = config.imgUrl ?? `${BASE_PATH}/img`;
/** Oficinas de FEDER: punto de recojo y origen de los envíos (config/feder.php) */
export const UBICACION_FEDER = config.ubicacion ?? { lat: -17.77981, lng: -63.163828, direccion: 'Oficinas de FEDER' };
/** Parámetros de la tarifa de envío (vista previa; el cobro lo calcula el servidor) */
export const TARIFA_ENVIO = config.tarifaEnvio ?? null;
/** Clave publicable de Stripe (null si el servidor usa la pasarela simulada) */
export const STRIPE_KEY = config.stripeKey ?? null;
const CLAVE_TOKEN = 'feder_token';

export const tokenGuardado = () => localStorage.getItem(CLAVE_TOKEN);
export const guardarToken = (t) => (t ? localStorage.setItem(CLAVE_TOKEN, t) : localStorage.removeItem(CLAVE_TOKEN));

/** Cliente HTTP de la capa de presentación hacia la API RESTful (capa de negocio). */
const api = axios.create({
    baseURL: config.apiUrl,
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    timeout: 30000,
});

api.interceptors.request.use((cfg) => {
    const token = tokenGuardado();
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});

let alExpirarSesion = null;
export const registrarExpiracion = (fn) => (alExpirarSesion = fn);

api.interceptors.response.use(
    (r) => r,
    (error) => {
        if (error.response?.status === 401 && tokenGuardado() && !error.config?.url?.includes('auth/login')) {
            guardarToken(null);
            alExpirarSesion?.();
        }
        return Promise.reject(error);
    },
);

/** Mensaje en español para mostrar al usuario a partir de un error de axios. */
export function mensajeError(error, porDefecto = 'Ocurrió un error inesperado. Intente nuevamente.') {
    if (!error?.response) {
        return error?.code === 'ECONNABORTED'
            ? 'El servidor tardó demasiado en responder. Intente nuevamente.'
            : 'No se pudo conectar con el servidor. Verifique su conexión.';
    }
    const { status, data } = error.response;
    if (status === 422 && data?.errors) {
        const primero = Object.values(data.errors)[0];
        return Array.isArray(primero) ? primero[0] : data.message;
    }
    if (status >= 500) return 'Error interno del servidor. Intente más tarde.';
    return data?.message || porDefecto;
}

/** Errores de validación del servidor (422) como { campo: 'mensaje' } para los formularios. */
export function erroresCampos(error) {
    const errs = error?.response?.status === 422 ? error.response.data?.errors : null;
    if (!errs) return {};
    return Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

export const urlImagen = (ruta) => (ruta ? (ruta.startsWith('http') ? ruta : `${STORAGE_URL}/${ruta}`) : null);

export default api;
