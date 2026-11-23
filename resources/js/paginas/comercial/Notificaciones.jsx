import { Link } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import api from '../../api/cliente';
import { FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { Alerta, Encabezado, Insignia } from '../../componentes/ui';
import useListado, { useAviso } from '../../hooks/useListado';
import { capitalizar, fechaHora } from '../../utils/formato';

/** CU6: notificaciones al cliente dentro del sistema. */
export default function Notificaciones() {
    const listado = useListado('/notificaciones', { leida: '' });
    const aviso = useAviso();

    const leer = async (n) => {
        if (n.leida) return;
        await api.put(`/notificaciones/${n.id}/leer`).catch(() => {});
        listado.recargar();
    };
    const leerTodas = async () => {
        const { data } = await api.put('/notificaciones/leer-todas');
        aviso.ok(data.message);
        listado.recargar();
    };

    return (
        <>
            <Encabezado titulo="Notificaciones" descripcion="Avisos sobre tus pedidos, pagos, encargos y entregas">
                <button type="button" className="btn-secundario" onClick={leerTodas}><CheckCheck className="size-4" /> Marcar todas como leídas</button>
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <div className="border-b border-borde p-3">
                    <FiltroSelect etiqueta="Mostrar" valor={listado.filtros.leida} onChange={(v) => listado.setFiltro('leida', v)} opciones={[{ value: '0', label: 'No leídas' }, { value: '1', label: 'Leídas' }]} todos="Todas" />
                </div>
                <TablaDatos listado={listado} vacio="No tienes notificaciones." columnas={[
                    { titulo: '', render: (n) => (!n.leida ? <span className="inline-block size-2.5 rounded-full bg-primario" aria-label="Sin leer" /> : null) },
                    { titulo: 'Fecha', render: (n) => <span className="whitespace-nowrap">{fechaHora(n.fecha_envio)}</span> },
                    { titulo: 'Tipo', render: (n) => <Insignia color="info">{capitalizar(n.tipo)}</Insignia> },
                    { titulo: 'Mensaje', render: (n) => <button type="button" className={`text-left ${n.leida ? 'text-suave' : 'font-medium'}`} onClick={() => leer(n)}>{n.mensaje}</button> },
                    { titulo: '', className: 'text-right', render: (n) => n.pedido_id && <Link to={`/panel/pedidos/${n.pedido_id}`} onClick={() => leer(n)} className="btn-fantasma btn-sm">Ver pedido</Link> },
                ]} />
            </section>
        </>
    );
}
