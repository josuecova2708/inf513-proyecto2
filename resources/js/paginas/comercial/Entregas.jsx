import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Map as IconoMapa, Truck, XCircle } from 'lucide-react';
import api, { mensajeError } from '../../api/cliente';
import { FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { Alerta, Cargando, Encabezado, Estado, Modal } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { capitalizar, fecha, fechaEntrega, fechaHora, numero } from '../../utils/formato';
import { ModalProgramar } from './PedidoDetalle';

const MapaUbicacion = lazy(() => import('../../componentes/Mapa').then((m) => ({ default: m.MapaUbicacion })));

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

/** CU6: entregas (recojo en oficina o envío a domicilio), con fecha/hora programada por el personal. */
export default function Entregas() {
    const { esStaff, puede } = useAuth();
    const listado = useListado('/entregas', { estado: '', tipo: '' });
    const aviso = useAviso();
    const [cambio, setCambio] = useState(null);
    const [reprogramar, setReprogramar] = useState(null);
    const [mapa, setMapa] = useState(null);
    const listo = (m) => { setCambio(null); setReprogramar(null); aviso.ok(m); listado.recargar(); };
    const gestiona = (e) => esStaff && puede('entregas', 'editar') && e.estado_pedido === 'listo_entrega' && ['pendiente', 'en_camino'].includes(e.estado);

    return (
        <>
            <Encabezado titulo={esStaff ? 'Entregas' : 'Mis entregas'} descripcion="CU6 · Entregas programadas: reprogramar, en camino → entregada (se notifica al cliente)" />
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
                    { titulo: 'Dirección', render: (e) => (
                        <div className="flex items-start gap-2 text-sm">
                            <span>{e.direccion ?? 'Oficinas FEDER'}{e.referencia ? ` · ${e.referencia}` : ''}{e.distancia_km && <span className="block text-xs text-suave">{numero(e.distancia_km)} km</span>}</span>
                            {e.latitud && <button type="button" className="btn-fantasma btn-sm shrink-0" onClick={() => setMapa(e)} aria-label={`Ver en el mapa la ubicación del pedido ${e.numero}`}><IconoMapa className="size-4" /></button>}
                        </div>
                    ) },
                    { titulo: 'Programada', render: (e) => (e.fecha_programada
                        ? <span className="whitespace-nowrap font-medium">{fechaEntrega(e.fecha_programada)}</span>
                        : <span className="text-sm text-suave">Por programar{e.fecha_preferida ? <span className="block text-xs">Prefiere {fecha(e.fecha_preferida)}</span> : ''}</span>) },
                    { titulo: 'Estado del pedido', render: (e) => <Estado valor={e.estado_pedido} /> },
                    { titulo: 'Entrega', render: (e) => <><Estado valor={e.estado} />{e.fecha_entrega && <p className="text-xs text-suave">{fechaHora(e.fecha_entrega)} · {e.receptor}</p>}</> },
                    { titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (e) => gestiona(e) && (
                        <div className="flex justify-end gap-1">
                            {e.estado === 'pendiente' && <button type="button" className="btn-secundario btn-sm" onClick={() => setReprogramar(e)} title="Reprogramar fecha y hora" aria-label={`Reprogramar la entrega del pedido ${e.numero}`}><CalendarClock className="size-4" /></button>}
                            {e.tipo === 'envio' && e.estado === 'pendiente' && <button type="button" className="btn-secundario btn-sm" onClick={() => setCambio({ e, estado: 'en_camino' })}><Truck className="size-4" /> En camino</button>}
                            <button type="button" className="btn-primario btn-sm" onClick={() => setCambio({ e, estado: 'entregada' })}><CheckCircle2 className="size-4" /> Entregada</button>
                            <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label="Marcar entrega fallida" onClick={() => setCambio({ e, estado: 'fallida' })}><XCircle className="size-4" /></button>
                        </div>
                    ) },
                ]} />
            </section>
            {cambio && <ModalEntrega entrega={cambio.e} estado={cambio.estado} onCerrar={() => setCambio(null)} onListo={listo} />}
            {reprogramar && (
                <ModalProgramar titulo={`Reprogramar entrega · ${reprogramar.numero}`} entrega={reprogramar} onCerrar={() => setReprogramar(null)}
                    onGuardar={async (f) => listo((await api.put(`/entregas/${reprogramar.id}`, { estado: reprogramar.estado, fecha_programada: f })).data.message)} />
            )}
            {mapa && (
                <Modal abierto titulo={`Ubicación de entrega · ${mapa.numero}`} onCerrar={() => setMapa(null)}>
                    <p className="mb-2 text-sm">{mapa.cliente} · {mapa.direccion}{mapa.referencia ? ` (${mapa.referencia})` : ''}</p>
                    <Suspense fallback={<Cargando texto="Cargando mapa…" />}><MapaUbicacion lat={mapa.latitud} lng={mapa.longitud} alto="h-80" /></Suspense>
                </Modal>
            )}
        </>
    );
}
