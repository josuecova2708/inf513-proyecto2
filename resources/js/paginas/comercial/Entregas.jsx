import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Truck, XCircle } from 'lucide-react';
import api, { mensajeError } from '../../api/cliente';
import { FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { Alerta, Encabezado, Estado, Modal } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { capitalizar, fecha, fechaHora } from '../../utils/formato';

function ModalEntrega({ entrega, estado, onCerrar, onListo }) {
    const [receptor, setReceptor] = useState(estado === 'entregada' ? entrega.cliente : '');
    const [referencia, setReferencia] = useState('');
    const [error, setError] = useState('');
    const enviar = async () => {
        if (estado === 'entregada' && receptor.trim().length < 3) return setError('Indique el nombre de quien recibió el pedido (mínimo 3 caracteres).');
        try {
            const { data } = await api.put(`/entregas/${entrega.id}`, { estado, receptor: receptor || undefined, referencia: referencia || undefined });
            onListo(data.message);
        } catch (e) {
            setError(mensajeError(e));
        }
    };
    return (
        <Modal abierto titulo={`Pedido ${entrega.numero}: ${capitalizar(estado)}`} onCerrar={onCerrar} pie={
            <><button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button><button type="button" className="btn-primario" onClick={enviar}>Confirmar</button></>
        }>
            <div className="space-y-3">
                <Alerta tipo="error">{error}</Alerta>
                {estado === 'entregada' && <div><label htmlFor="e-rec" className="etiqueta">Recibido por <span className="text-peligro">*</span></label><input id="e-rec" className="campo" maxLength={120} value={receptor} onChange={(e) => setReceptor(e.target.value)} /></div>}
                <div><label htmlFor="e-ref" className="etiqueta">Nota / referencia (opcional)</label><input id="e-ref" className="campo" maxLength={200} value={referencia} onChange={(e) => setReferencia(e.target.value)} /></div>
            </div>
        </Modal>
    );
}

/** CU6: entregas (recojo en oficina o envío a domicilio). */
export default function Entregas() {
    const { esStaff, puede } = useAuth();
    const listado = useListado('/entregas', { estado: '', tipo: '' });
    const aviso = useAviso();
    const [cambio, setCambio] = useState(null);

    return (
        <>
            <Encabezado titulo={esStaff ? 'Entregas' : 'Mis entregas'} descripcion="CU6 · Despacho de pedidos listos: en camino → entregada (notifica al cliente)" />
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <div className="flex flex-wrap gap-3 border-b border-borde p-3">
                    <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={['pendiente', 'en_camino', 'entregada', 'fallida'].map((e) => ({ value: e, label: capitalizar(e) }))} />
                    <FiltroSelect etiqueta="Tipo" valor={listado.filtros.tipo} onChange={(v) => listado.setFiltro('tipo', v)} opciones={[{ value: 'recojo', label: 'Recojo' }, { value: 'envio', label: 'Envío' }]} />
                </div>
                <TablaDatos listado={listado} vacio="No hay entregas." columnas={[
                    { titulo: 'Pedido', render: (e) => <Link to={`/panel/pedidos/${e.pedido_id}`} className="font-semibold text-primario hover:underline">{e.numero}</Link> },
                    ...(esStaff ? [{ titulo: 'Cliente', render: (e) => <>{e.cliente}<p className="text-xs text-suave">{e.telefono}</p></> }] : []),
                    { titulo: 'Tipo', render: (e) => (e.tipo === 'envio' ? 'Envío' : 'Recojo') },
                    { titulo: 'Dirección', render: (e) => <span className="text-sm">{e.direccion ?? 'Oficinas FEDER'}{e.referencia ? ` · ${e.referencia}` : ''}</span> },
                    { titulo: 'Programada', render: (e) => fecha(e.fecha_programada) },
                    { titulo: 'Pedido', render: (e) => <Estado valor={e.estado_pedido} /> },
                    { titulo: 'Entrega', render: (e) => <><Estado valor={e.estado} />{e.fecha_entrega && <p className="text-xs text-suave">{fechaHora(e.fecha_entrega)} · {e.receptor}</p>}</> },
                    { titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (e) => esStaff && puede('entregas', 'editar') && e.estado_pedido === 'listo_entrega' && ['pendiente', 'en_camino'].includes(e.estado) && (
                        <div className="flex justify-end gap-1">
                            {e.tipo === 'envio' && e.estado === 'pendiente' && <button type="button" className="btn-secundario btn-sm" onClick={() => setCambio({ e, estado: 'en_camino' })}><Truck className="size-4" /> En camino</button>}
                            <button type="button" className="btn-primario btn-sm" onClick={() => setCambio({ e, estado: 'entregada' })}><CheckCircle2 className="size-4" /> Entregada</button>
                            <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label="Marcar entrega fallida" onClick={() => setCambio({ e, estado: 'fallida' })}><XCircle className="size-4" /></button>
                        </div>
                    ) },
                ]} />
            </section>
            {cambio && <ModalEntrega entrega={cambio.e} estado={cambio.estado} onCerrar={() => setCambio(null)} onListo={(m) => { setCambio(null); aviso.ok(m); listado.recargar(); }} />}
        </>
    );
}
