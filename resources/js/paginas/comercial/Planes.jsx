import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/cliente';
import { FiltroSelect } from '../../componentes/Crud';
import ModalPago from '../../componentes/ModalPago';
import { Alerta, Cargando, Encabezado, Estado, Vacio } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { fecha, moneda } from '../../utils/formato';

/** Planes de pago por usuario (cuotas). */
export default function Planes() {
    const { esStaff, puede } = useAuth();
    const listado = useListado('/planes', { estado: '' }, { paginado: false });
    const aviso = useAviso();
    const [pagar, setPagar] = useState(null);

    return (
        <>
            <Encabezado titulo={esStaff ? 'Planes de pago' : 'Mis planes de pago'} descripcion="Pago de pedidos en 2, 3 o 6 cuotas. Se crean desde el detalle de un pedido pendiente." />
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <div className="mb-4 max-w-xs"><FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={[{ value: 'vigente', label: 'Vigente' }, { value: 'pagado', label: 'Pagado' }, { value: 'cancelado', label: 'Cancelado' }]} /></div>
            {listado.cargando ? <Cargando /> : !listado.datos.length ? <Vacio texto="No hay planes de pago." /> : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {listado.datos.map((pl) => {
                        const proxima = pl.cuotas.find((c) => c.estado !== 'pagada');
                        const avance = Math.round((Number(pl.pagado) / Number(pl.monto_total)) * 100);
                        return (
                            <article key={pl.id} className="tarjeta p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <h2 className="font-semibold">Pedido <Link className="text-primario hover:underline" to={`/panel/pedidos/${pl.pedido_id}`}>{pl.numero}</Link></h2>
                                        <p className="text-sm text-suave">{esStaff ? `${pl.cliente} · ` : ''}{pl.nro_cuotas} cuotas {pl.frecuencia}es · desde {fecha(pl.fecha)}</p>
                                    </div>
                                    <Estado valor={pl.estado} />
                                </div>
                                <div className="mt-3" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del plan">
                                    <div className="h-2 overflow-hidden rounded-full bg-superficie-2"><div className="h-full rounded-full bg-primario" style={{ width: `${avance}%` }} /></div>
                                    <p className="mt-1 text-xs text-suave">Pagado {moneda(pl.pagado)} de {moneda(pl.monto_total)} ({avance}%)</p>
                                </div>
                                <table className="tabla mt-3">
                                    <thead><tr><th>Cuota</th><th>Vence</th><th className="text-right">Monto</th><th>Estado</th><th /></tr></thead>
                                    <tbody>{pl.cuotas.map((c) => (
                                        <tr key={c.id}>
                                            <td>{c.numero}</td><td>{fecha(c.fecha_vencimiento)}</td><td className="text-right">{moneda(c.monto)}</td><td><Estado valor={c.estado} /></td>
                                            <td className="text-right">{pl.estado === 'vigente' && proxima?.id === c.id && puede('pagos', 'crear') && <button type="button" className="btn-primario btn-sm" onClick={() => setPagar({ plan: pl, cuota: c })}>Pagar</button>}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </article>
                        );
                    })}
                </div>
            )}
            {pagar && (
                <ModalPago titulo={`Pagar cuota ${pagar.cuota.numero} de ${pagar.plan.nro_cuotas}`} montoMaximo={Number(pagar.cuota.monto)} montoFijo numeroPedido={pagar.plan.numero}
                    onPagar={async (datos) => (await api.post(`/cuotas/${pagar.cuota.id}/pagar`, datos)).data}
                    onCerrar={(listo) => { setPagar(null); if (listo) listado.recargar(); }} />
            )}
        </>
    );
}
