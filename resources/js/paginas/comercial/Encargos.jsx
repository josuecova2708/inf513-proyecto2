import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ban, Check, PackageCheck, Repeat, Store, Truck, X } from 'lucide-react';
import api, { mensajeError, TARIFA_ENVIO } from '../../api/cliente';
import { FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { Alerta, Cargando, Confirmar, Encabezado, Estado, Modal } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { cotizarEnvio } from '../../utils/envio';
import { capitalizar, fecha, moneda, numero } from '../../utils/formato';

const SelectorUbicacion = lazy(() => import('../../componentes/Mapa').then((m) => ({ default: m.SelectorUbicacion })));

const ESTADOS = ['solicitado', 'aceptado', 'rechazado', 'disponible', 'convertido', 'cancelado'];

function ModalEstado({ encargo, estado, onCerrar, onListo }) {
    const [obs, setObs] = useState('');
    const [error, setError] = useState('');
    const enviar = async () => {
        if (estado === 'rechazado' && obs.trim().length < 3) return setError('Indique el motivo del rechazo.');
        try {
            const { data } = await api.put(`/encargos/${encargo.id}/estado`, { estado, observacion: obs || undefined });
            onListo(data.message);
        } catch (e) {
            setError(mensajeError(e));
        }
    };
    return (
        <Modal abierto titulo={`Encargo #${encargo.id}: ${capitalizar(estado)}`} onCerrar={onCerrar} pie={
            <><button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button><button type="button" className={estado === 'rechazado' ? 'btn-peligro' : 'btn-primario'} onClick={enviar}>Confirmar</button></>
        }>
            <Alerta tipo="error">{error}</Alerta>
            <p className="mb-3 text-sm">{encargo.productos} · requerido para el {fecha(encargo.fecha_requerida)}</p>
            {estado === 'disponible' && <p className="mb-3 text-sm text-suave">Se verificará que exista stock suficiente y se notificará al cliente.</p>}
            <label htmlFor="enc-obs2" className="etiqueta">Observación {estado === 'rechazado' ? '(obligatoria)' : '(opcional)'}</label>
            <textarea id="enc-obs2" className="campo" rows={3} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Modal>
    );
}

function ModalConvertir({ encargo, onCerrar }) {
    const { usuario } = useAuth();
    const navegar = useNavigate();
    const [tipo, setTipo] = useState('recojo');
    const [direccion, setDireccion] = useState(usuario?.direccion ?? '');
    const [ubicacion, setUbicacion] = useState(null);
    const [error, setError] = useState('');
    const cotizacion = tipo === 'envio' && ubicacion && TARIFA_ENVIO ? cotizarEnvio(TARIFA_ENVIO, ubicacion.lat, ubicacion.lng) : null;
    const enviar = async () => {
        if (tipo === 'envio') {
            if (!ubicacion) return setError('Marque la ubicación de entrega en el mapa.');
            if (cotizacion?.fueraDeZona) return setError('La ubicación está fuera de la zona de envío. Elija recojo en FEDER.');
            if (direccion.trim().length < 5) return setError('Indique la dirección de entrega (mínimo 5 caracteres).');
        }
        try {
            const envio = tipo === 'envio';
            const { data } = await api.post(`/encargos/${encargo.id}/convertir`, {
                tipo_entrega: tipo, direccion: envio ? direccion : null, latitud: envio ? ubicacion.lat : null, longitud: envio ? ubicacion.lng : null,
            });
            navegar(`/panel/pedidos/${data.pedido_id}`, { state: { mensaje: data.message } });
        } catch (e) {
            setError(mensajeError(e));
        }
    };
    return (
        <Modal abierto titulo={`Convertir encargo #${encargo.id} en pedido`} onCerrar={onCerrar} pie={
            <><button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button><button type="button" className="btn-primario" onClick={enviar}><Repeat className="size-4" /> Convertir en pedido</button></>
        }>
            <div className="space-y-3">
                <Alerta tipo="error">{error}</Alerta>
                <p className="text-sm">Se usarán los precios vigentes del catálogo y se reservará el stock.</p>
                <div className="grid grid-cols-2 gap-2">
                    {[['recojo', 'Recojo en FEDER', Store], ['envio', 'Envío a domicilio', Truck]].map(([v, t, I]) => (
                        <button key={v} type="button" aria-pressed={tipo === v} onClick={() => setTipo(v)} className={`btn flex-col border py-3 ${tipo === v ? 'border-primario bg-primario/10 text-primario' : 'border-borde'}`}><I className="size-5" /> {t}</button>
                    ))}
                </div>
                {tipo === 'envio' && (
                    <>
                        <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
                            <SelectorUbicacion valor={ubicacion} onChange={setUbicacion} alto="h-60" />
                        </Suspense>
                        {cotizacion && (
                            <p className={`rounded-tema px-3 py-2 text-sm ${cotizacion.fueraDeZona ? 'bg-peligro/10 text-peligro' : 'bg-primario/10'}`}>
                                {cotizacion.fueraDeZona ? `A unos ${numero(cotizacion.km)} km: fuera de la zona de envío.` : <>Distancia aprox. <strong>{numero(cotizacion.km)} km</strong> · Envío <strong>{moneda(cotizacion.costo)}</strong></>}
                            </p>
                        )}
                        <div><label htmlFor="conv-dir" className="etiqueta">Dirección</label><input id="conv-dir" className="campo" maxLength={200} value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
                    </>
                )}
            </div>
        </Modal>
    );
}

/** CU5: encargos (pedidos anticipados). */
export default function Encargos() {
    const { esStaff, puede } = useAuth();
    const listado = useListado('/encargos', { estado: '' });
    const aviso = useAviso();
    const [cambio, setCambio] = useState(null);
    const [convertir, setConvertir] = useState(null);
    const [cancelar, setCancelar] = useState(null);

    const confirmarCancelar = async () => {
        try {
            const { data } = await api.post(`/encargos/${cancelar.id}/cancelar`);
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
        setCancelar(null);
    };
    const listo = (m) => { setCambio(null); aviso.ok(m); listado.recargar(); };

    return (
        <>
            <Encabezado titulo={esStaff ? 'Encargos' : 'Mis encargos'} descripcion="CU5 · Solicitado → aceptado → disponible → convertido en pedido">
                {!esStaff && <Link to="/catalogo?modalidad=encargo" className="btn-primario">Nuevo encargo</Link>}
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <div className="flex gap-3 border-b border-borde p-3">
                    <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={ESTADOS.map((e) => ({ value: e, label: capitalizar(e) }))} />
                </div>
                <TablaDatos listado={listado} vacio="No hay encargos." columnas={[
                    { titulo: '#', campo: 'id' },
                    ...(esStaff ? [{ titulo: 'Cliente', campo: 'cliente' }] : []),
                    { titulo: 'Productos', render: (e) => <span className="text-sm">{e.productos}</span> },
                    { titulo: 'Solicitado', render: (e) => fecha(e.fecha_solicitud) },
                    { titulo: 'Requerido', render: (e) => fecha(e.fecha_requerida) },
                    { titulo: 'Estimado', className: 'text-right', render: (e) => moneda(e.total_estimado) },
                    { titulo: 'Estado', render: (e) => <><Estado valor={e.estado} />{e.observacion && <p className="max-w-48 truncate text-xs text-suave" title={e.observacion}>{e.observacion}</p>}</> },
                    { titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (e) => (
                        <div className="flex justify-end gap-1">
                            {e.pedido_id && <Link to={`/panel/pedidos/${e.pedido_id}`} className="btn-secundario btn-sm">{e.pedido_numero}</Link>}
                            {esStaff && puede('encargos', 'editar') && e.estado === 'solicitado' && <button type="button" className="btn-secundario btn-sm" onClick={() => setCambio({ e, estado: 'aceptado' })}><Check className="size-4" /> Aceptar</button>}
                            {esStaff && puede('encargos', 'editar') && e.estado === 'aceptado' && <button type="button" className="btn-secundario btn-sm" onClick={() => setCambio({ e, estado: 'disponible' })}><PackageCheck className="size-4" /> Disponible</button>}
                            {esStaff && puede('encargos', 'editar') && ['solicitado', 'aceptado'].includes(e.estado) && <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label="Rechazar" onClick={() => setCambio({ e, estado: 'rechazado' })}><X className="size-4" /></button>}
                            {e.estado === 'disponible' && <button type="button" className="btn-primario btn-sm" onClick={() => setConvertir(e)}><Repeat className="size-4" /> Convertir en pedido</button>}
                            {puede('encargos', 'eliminar') && ['solicitado', 'aceptado', 'disponible'].includes(e.estado) && <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label="Cancelar encargo" onClick={() => setCancelar(e)}><Ban className="size-4" /></button>}
                        </div>
                    ) },
                ]} />
            </section>
            {cambio && <ModalEstado encargo={cambio.e} estado={cambio.estado} onCerrar={() => setCambio(null)} onListo={listo} />}
            {convertir && <ModalConvertir encargo={convertir} onCerrar={() => setConvertir(null)} />}
            <Confirmar abierto={!!cancelar} titulo="Cancelar encargo" mensaje={`¿Cancelar el encargo #${cancelar?.id}?`} onConfirmar={confirmarCancelar} onCerrar={() => setCancelar(null)} textoConfirmar="Sí, cancelar" />
        </>
    );
}
