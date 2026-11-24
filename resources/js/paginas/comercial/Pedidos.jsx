import { Link, useSearchParams } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { BarraFiltros, FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { Encabezado, Estado, Insignia } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado from '../../hooks/useListado';
import { capitalizar, etiquetaEstado, fechaHora, moneda } from '../../utils/formato';

const ESTADOS = ['pendiente', 'confirmado', 'listo_entrega', 'entregado', 'cancelado'];

/** CU6: procesar pedidos. */
export default function Pedidos() {
    const { esStaff } = useAuth();
    const [params] = useSearchParams();
    const listado = useListado('/pedidos', { q: '', estado: params.get('estado') ?? '', desde: '', hasta: '' });

    return (
        <>
            <Encabezado titulo={esStaff ? 'Pedidos' : 'Mis pedidos'} descripcion="CU6 · Flujo: pendiente de pago → confirmado → entrega programada → entregado" />
            <section className="tarjeta">
                <BarraFiltros listado={listado} placeholder={esStaff ? 'N.º de pedido o cliente' : 'N.º de pedido'}>
                    <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={ESTADOS.map((e) => ({ value: e, label: etiquetaEstado(e) }))} />
                    <div><label className="etiqueta text-xs" htmlFor="p-desde">Desde</label><input id="p-desde" type="date" className="campo" value={listado.filtros.desde} onChange={(e) => listado.setFiltro('desde', e.target.value)} /></div>
                    <div><label className="etiqueta text-xs" htmlFor="p-hasta">Hasta</label><input id="p-hasta" type="date" className="campo" min={listado.filtros.desde} value={listado.filtros.hasta} onChange={(e) => listado.setFiltro('hasta', e.target.value)} /></div>
                </BarraFiltros>
                <TablaDatos listado={listado} vacio="No hay pedidos." columnas={[
                    { titulo: 'Pedido', render: (p) => <Link to={`/panel/pedidos/${p.id}`} className="font-semibold text-primario hover:underline">{p.numero}</Link> },
                    { titulo: 'Fecha', render: (p) => <span className="whitespace-nowrap">{fechaHora(p.fecha)}</span> },
                    ...(esStaff ? [{ titulo: 'Cliente', campo: 'cliente' }] : []),
                    { titulo: 'Origen', render: (p) => <Insignia color={p.origen === 'encargo' ? 'info' : 'suave'}>{capitalizar(p.origen)}</Insignia> },
                    { titulo: 'Entrega', render: (p) => <span className="text-sm">{p.tipo_entrega === 'envio' ? 'Envío' : 'Recojo'} · <Estado valor={p.estado_entrega} /></span> },
                    { titulo: 'Total', className: 'text-right', render: (p) => moneda(p.total) },
                    { titulo: 'Saldo', className: 'text-right', render: (p) => <span className={Number(p.saldo_pendiente) > 0 ? 'font-semibold text-aviso' : 'text-exito'}>{moneda(p.saldo_pendiente)}{p.plan_id ? ' (plan)' : ''}</span> },
                    { titulo: 'Estado', render: (p) => <Estado valor={p.estado} /> },
                    { titulo: '', className: 'text-right', render: (p) => <Link to={`/panel/pedidos/${p.id}`} className="btn-fantasma btn-sm" aria-label={`Ver ${p.numero}`}><Eye className="size-4" /></Link> },
                ]} />
            </section>
        </>
    );
}
