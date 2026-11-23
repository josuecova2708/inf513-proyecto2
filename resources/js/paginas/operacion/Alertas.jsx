import { CheckCheck } from 'lucide-react';
import api from '../../api/cliente';
import { FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { Alerta, Encabezado, Estado, Insignia } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { fechaHora } from '../../utils/formato';

/** CU4: alertas de inventario (stock bajo el mínimo y vencimiento próximo de lotes). */
export default function Alertas() {
    const { puede } = useAuth();
    const listado = useListado('/alertas', { estado: 'activa', tipo: '' });
    const aviso = useAviso();

    const atender = async (a) => {
        try {
            const { data } = await api.put(`/alertas/${a.id}/atender`);
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
    };

    return (
        <>
            <Encabezado titulo="Alertas de inventario" descripcion="CU4 · Se generan automáticamente por stock bajo el mínimo y lotes que vencen en 7 días" />
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <div className="flex flex-wrap gap-3 border-b border-borde p-3">
                    <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={[{ value: 'activa', label: 'Activas' }, { value: 'atendida', label: 'Atendidas' }]} todos="Todas" />
                    <FiltroSelect etiqueta="Tipo" valor={listado.filtros.tipo} onChange={(v) => listado.setFiltro('tipo', v)} opciones={[{ value: 'stock_bajo', label: 'Stock bajo' }, { value: 'vencimiento', label: 'Vencimiento' }]} />
                </div>
                <TablaDatos listado={listado} vacio="No hay alertas. ¡El inventario está en orden!" columnas={[
                    { titulo: 'Fecha', render: (a) => fechaHora(a.fecha) },
                    { titulo: 'Tipo', render: (a) => <Insignia color={a.tipo === 'stock_bajo' ? 'peligro' : 'aviso'}>{a.tipo === 'stock_bajo' ? 'Stock bajo' : 'Vencimiento'}</Insignia> },
                    { titulo: 'Producto', campo: 'producto' },
                    { titulo: 'Mensaje', campo: 'mensaje' },
                    { titulo: 'Estado', render: (a) => <Estado valor={a.estado} /> },
                    { titulo: 'Acciones', className: 'text-right', render: (a) => a.estado === 'activa' && puede('inventario', 'editar') && (
                        <button type="button" className="btn-secundario btn-sm" onClick={() => atender(a)}><CheckCheck className="size-4" /> Atendida</button>
                    ) },
                ]} />
            </section>
        </>
    );
}
