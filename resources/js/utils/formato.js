const bs = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', minimumFractionDigits: 2 });
const num = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 });

export const moneda = (v) => bs.format(Number(v ?? 0)).replace('BOB', 'Bs.');
export const numero = (v) => num.format(Number(v ?? 0));

export function fecha(v, conHora = false) {
    if (!v) return '—';
    const d = new Date(typeof v === 'string' && v.length === 10 ? `${v}T00:00:00` : v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-BO', conHora
        ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const fechaHora = (v) => fecha(v, true);

/** yyyy-mm-dd (hora local, no UTC) para inputs type="date" */
export function hoyISO(dias = 0) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "jue 26/11 · 15:00" para fechas de entrega programada */
export function fechaEntrega(v) {
    if (!v) return '—';
    const d = new Date(String(v).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '—';
    const dia = d.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '');
    return `${dia} · ${d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replaceAll('_', ' ') : '');

/** Nombre visible de los estados que no se leen bien solo capitalizando */
const ETIQUETA_ESTADO = { listo_entrega: 'Entrega programada', pedido_listo: 'Entrega programada' };
export const etiquetaEstado = (s) => ETIQUETA_ESTADO[s] ?? capitalizar(s);

/** Colores de insignia por estado (pedidos, pagos, entregas, producción, etc.) */
export const COLOR_ESTADO = {
    activo: 'exito', activa: 'peligro', inactivo: 'suave', atendida: 'exito',
    pendiente: 'aviso', confirmado: 'info', listo_entrega: 'acento', entregado: 'exito', cancelado: 'peligro',
    pagado: 'exito', rechazado: 'peligro', anulado: 'suave', devuelto: 'info',
    en_camino: 'info', entregada: 'exito', fallida: 'peligro',
    reportada: 'aviso', validada: 'exito', rechazada: 'peligro',
    disponible: 'exito', agotado: 'suave', vencido: 'peligro',
    solicitado: 'aviso', aceptado: 'info', convertido: 'exito',
    reservada: 'aviso', confirmada: 'exito', liberada: 'suave',
    vigente: 'info', pagada: 'exito', vencida: 'peligro',
    login_ok: 'exito', login_fallido: 'peligro', logout: 'suave', registro: 'info', acceso: 'suave',
    crear: 'info', editar: 'aviso', eliminar: 'peligro', acceso_denegado: 'peligro',
};
