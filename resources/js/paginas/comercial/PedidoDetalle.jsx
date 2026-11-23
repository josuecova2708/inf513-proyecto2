import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ban, CalendarClock, CreditCard, LoaderCircle, MapPin, Printer, Route } from 'lucide-react';
import api, { mensajeError } from '../../api/cliente';
import ModalPago from '../../componentes/ModalPago';
import { Alerta, Cargando, Confirmar, Encabezado, Estado, Modal, Tarjeta, Vacio } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import { useAviso } from '../../hooks/useListado';
import { capitalizar, fecha, fechaHora, moneda, numero } from '../../utils/formato';

const PASOS = ['pendiente', 'confirmado', 'en_preparacion', 'listo_entrega', 'entregado'];
const ETIQUETA = { confirmado: 'Confirmar pedido', en_preparacion: 'Pasar a preparación', listo_entrega: 'Marcar listo para entrega', entregado: 'Marcar entregado' };

function ModalPlan({ pedido, saldo, onCerrar, onCreado }) {
    const [d, setD] = useState({ nro_cuotas: '3', frecuencia: 'mensual', cuota_inicial: '' });
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);
    const inicial = Number(d.cuota_inicial || 0);
    const n = Number(d.nro_cuotas);
    const resto = inicial > 0 ? (saldo - inicial) / (n - 1) : saldo / n;

    const crear = async () => {
        if (Number.isNaN(inicial) || inicial < 0) return setError('La cuota inicial debe ser un número mayor o igual a 0.');
        if (inicial >= saldo) return setError(`La cuota inicial debe ser menor al saldo (${moneda(saldo)}).`);
        setEnviando(true);
        try {
            const { data } = await api.post(`/pedidos/${pedido.id}/plan`, { ...d, cuota_inicial: inicial || null });
            onCreado(data.message);
        } catch (e) {
            setError(mensajeError(e));
            setEnviando(false);
        }
    };

    return (
        <Modal abierto titulo={`Plan de pagos · ${pedido.numero}`} onCerrar={onCerrar} pie={
            <><button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
                <button type="button" className="btn-primario" onClick={crear} disabled={enviando}>{enviando && <LoaderCircle className="size-4 animate-spin" />} Crear plan</button></>
        }>
            <div className="space-y-4">
                <Alerta tipo="error">{error}</Alerta>
                <p className="text-sm text-suave">Paga tu pedido de {moneda(saldo)} en cuotas sin interés. Con la primera cuota pagada el pedido queda confirmado.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                    <div><label htmlFor="pl-n" className="etiqueta">Cuotas</label><select id="pl-n" className="campo" value={d.nro_cuotas} onChange={(e) => setD({ ...d, nro_cuotas: e.target.value })}>{[2, 3, 6].map((x) => <option key={x} value={x}>{x} cuotas</option>)}</select></div>
                    <div><label htmlFor="pl-f" className="etiqueta">Frecuencia</label><select id="pl-f" className="campo" value={d.frecuencia} onChange={(e) => setD({ ...d, frecuencia: e.target.value })}><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option></select></div>
                    <div><label htmlFor="pl-i" className="etiqueta">Cuota inicial (opcional)</label><input id="pl-i" type="number" min="0" step="0.01" className="campo" value={d.cuota_inicial} onChange={(e) => setD({ ...d, cuota_inicial: e.target.value })} /></div>
                </div>
                <div className="rounded-tema bg-superficie-2 p-3 text-sm">
                    {inicial > 0 ? <>Cuota 1 (hoy): <strong>{moneda(inicial)}</strong> · luego {n - 1} cuota(s) de <strong>{moneda(resto)}</strong></> : <>{n} cuotas de <strong>{moneda(resto)}</strong> (la primera vence hoy)</>}
                </div>
            </div>
        </Modal>
    );
}

/** CU6: detalle del pedido con pagos, plan de cuotas, entrega, trazabilidad y cambio de estado. */
export default function PedidoDetalle() {
    const { id } = useParams();
    const { state } = useLocation();
    const { esStaff, puede } = useAuth();
    const [d, setD] = useState(null);
    const [error, setError] = useState('');
    const aviso = useAviso();
    const [pagar, setPagar] = useState(null);
    const [plan, setPlan] = useState(false);
    const [cancelar, setCancelar] = useState(false);
    const [ocupado, setOcupado] = useState(false);

    const cargar = useCallback(() => api.get(`/pedidos/${id}`).then(({ data }) => setD(data)).catch((e) => setError(mensajeError(e))), [id]);
    useEffect(() => {
        cargar();
        if (state?.mensaje) aviso.ok(state.mensaje);
    }, [cargar]); // eslint-disable-line react-hooks/exhaustive-deps

    if (error) return <Vacio texto={error}><Link to="/panel/pedidos" className="btn-secundario btn-sm">Volver a pedidos</Link></Vacio>;
    if (!d) return <Cargando />;

    const { pedido: p, saldo } = d;
    const saldoPend = Number(saldo.saldo_pendiente);
    const pagosPendientes = d.pagos.filter((x) => x.estado === 'pendiente').reduce((s, x) => s + Number(x.monto), 0);
    const porPagar = Math.max(0, saldoPend - pagosPendientes);
    const planVigente = d.plan?.estado === 'vigente';
    const puedeCancelar = puede('pedidos', 'eliminar') && (esStaff ? ['pendiente', 'confirmado'].includes(p.estado) : p.estado === 'pendiente');

    const avanzar = async (estado) => {
        setOcupado(true);
        try {
            const { data } = await api.put(`/pedidos/${id}/estado`, { estado });
            aviso.ok(data.message);
            cargar();
        } catch (e) {
            aviso.error(e);
        } finally {
            setOcupado(false);
        }
    };
    const confirmarCancelacion = async () => {
        setOcupado(true);
        try {
            const { data } = await api.post(`/pedidos/${id}/cancelar`);
            aviso.ok(data.message);
            cargar();
        } catch (e) {
            aviso.error(e);
        } finally {
            setOcupado(false);
            setCancelar(false);
        }
    };
    const pagarCuota = async (c, datos) => (await api.post(`/cuotas/${c.id}/pagar`, datos)).data;
    const proximaCuota = d.plan?.cuotas?.find((c) => c.estado !== 'pagada');

    return (
        <>
            <Link to="/panel/pedidos" className="mb-3 inline-flex items-center gap-1 text-sm text-primario hover:underline print:hidden"><ArrowLeft className="size-4" /> Pedidos</Link>
            <Encabezado titulo={`Pedido ${p.numero}`} descripcion={`${fechaHora(p.fecha)} · ${capitalizar(p.origen)}${d.gestor ? ` · Gestionado por ${d.gestor}` : ''}`}>
                <button type="button" className="btn-secundario print:hidden" onClick={() => window.print()}><Printer className="size-4" /> Imprimir</button>
                {puedeCancelar && <button type="button" className="btn-peligro print:hidden" onClick={() => setCancelar(true)}><Ban className="size-4" /> Cancelar pedido</button>}
            </Encabezado>
            <div className="mb-4 print:hidden"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>

            {/* Línea de estado */}
            <ol className="tarjeta mb-6 flex flex-wrap items-center gap-2 p-4" aria-label="Estado del pedido">
                {p.estado === 'cancelado' ? <li><Estado valor="cancelado" /> El pedido fue cancelado.</li> : PASOS.map((paso, i) => {
                    const actual = PASOS.indexOf(p.estado);
                    return (
                        <li key={paso} className="flex items-center gap-2">
                            <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${i <= actual ? 'bg-primario text-sobre-primario' : 'bg-superficie-2 text-suave'}`} aria-current={i === actual ? 'step' : undefined}>{i + 1}</span>
                            <span className={`text-sm ${i === actual ? 'font-semibold' : 'text-suave'}`}>{capitalizar(paso)}</span>
                            {i < PASOS.length - 1 && <ArrowRight className="size-4 text-suave" aria-hidden="true" />}
                        </li>
                    );
                })}
            </ol>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Tarjeta titulo="Productos">
                        <table className="tabla">
                            <thead><tr><th>Producto</th><th className="text-right">Cantidad</th><th className="text-right">Precio</th><th className="text-right">Subtotal</th></tr></thead>
                            <tbody>{d.detalles.map((x) => <tr key={x.id}><td>{x.nombre}</td><td className="text-right">{numero(x.cantidad)} {x.unidad_medida}</td><td className="text-right">{moneda(x.precio_unitario)}</td><td className="text-right">{moneda(x.subtotal)}</td></tr>)}</tbody>
                            <tfoot>
                                <tr><td colSpan={3} className="text-right">Subtotal</td><td className="text-right">{moneda(p.subtotal)}</td></tr>
                                <tr><td colSpan={3} className="text-right">Envío</td><td className="text-right">{moneda(p.costo_envio)}</td></tr>
                                <tr><td colSpan={3} className="text-right font-bold">Total</td><td className="text-right font-bold">{moneda(p.total)}</td></tr>
                            </tfoot>
                        </table>
                    </Tarjeta>

                    <Tarjeta titulo="Pagos" acciones={p.estado !== 'cancelado' && !planVigente && porPagar > 0.004 && puede('pagos', 'crear') && (
                        <div className="flex gap-2 print:hidden">
                            {!esStaff && p.estado === 'pendiente' && !d.pagos.some((x) => x.estado === 'pagado') && saldoPend >= 50 && puede('planes_pago', 'crear') && (
                                <button type="button" className="btn-secundario btn-sm" onClick={() => setPlan(true)}><CalendarClock className="size-4" /> Pagar en cuotas</button>
                            )}
                            <button type="button" className="btn-primario btn-sm" onClick={() => setPagar({ tipo: 'pedido' })}><CreditCard className="size-4" /> {esStaff ? 'Registrar pago' : 'Pagar'}</button>
                        </div>
                    )}>
                        {d.pagos.length ? (
                            <table className="tabla">
                                <thead><tr><th>Fecha</th><th>Método</th><th className="text-right">Monto</th><th>Estado</th><th>Transacción</th></tr></thead>
                                <tbody>{d.pagos.map((x) => <tr key={x.id}><td>{fechaHora(x.fecha)}</td><td>{x.metodo}{x.ultimos4 ? ` •••• ${x.ultimos4}` : ''}{x.cuota_numero ? ` · Cuota ${x.cuota_numero}` : ''}</td><td className="text-right">{moneda(x.monto)}</td><td><Estado valor={x.estado} /></td><td className="font-mono text-xs">{x.codigo_transaccion ?? '—'}</td></tr>)}</tbody>
                            </table>
                        ) : <p className="text-sm text-suave">Aún no hay pagos registrados.</p>}
                        <div className="mt-3 flex flex-wrap gap-4 text-sm">
                            <span>Cobrado: <strong className="text-exito">{moneda(saldo.cobrado)}</strong></span>
                            <span>Saldo: <strong className={saldoPend > 0 ? 'text-aviso' : 'text-exito'}>{moneda(saldoPend)}</strong></span>
                            {pagosPendientes > 0 && <span className="text-suave">Por verificar: {moneda(pagosPendientes)}</span>}
                        </div>
                    </Tarjeta>

                    {d.plan && (
                        <Tarjeta titulo={<span className="flex items-center gap-2">Plan de pagos · {d.plan.nro_cuotas} cuotas {d.plan.frecuencia}es <Estado valor={d.plan.estado} /></span>}>
                            <table className="tabla">
                                <thead><tr><th>Cuota</th><th>Vence</th><th className="text-right">Monto</th><th>Estado</th><th /></tr></thead>
                                <tbody>{d.plan.cuotas.map((c) => (
                                    <tr key={c.id}>
                                        <td>{c.numero} / {d.plan.nro_cuotas}</td><td>{fecha(c.fecha_vencimiento)}</td><td className="text-right">{moneda(c.monto)}</td><td><Estado valor={c.estado} /></td>
                                        <td className="text-right">{planVigente && proximaCuota?.id === c.id && puede('pagos', 'crear') && !d.pagos.some((x) => x.cuota_numero === c.numero && x.estado === 'pendiente') && (
                                            <button type="button" className="btn-primario btn-sm print:hidden" onClick={() => setPagar({ tipo: 'cuota', cuota: c })}>Pagar cuota</button>
                                        )}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </Tarjeta>
                    )}

                    <Tarjeta titulo={<span className="flex items-center gap-2"><Route className="size-5" /> Trazabilidad de origen</span>}>
                        {d.trazabilidad.length ? (
                            <table className="tabla">
                                <thead><tr><th>Producto</th><th className="text-right">Cant.</th><th>Lote</th><th>Productor</th><th>Comunidad</th></tr></thead>
                                <tbody>{d.trazabilidad.map((t, i) => <tr key={i}><td>{t.producto}</td><td className="text-right">{numero(t.cantidad)}</td><td className="font-mono">{t.lote}</td><td>{t.emprendimiento}</td><td>{t.comunidad}</td></tr>)}</tbody>
                            </table>
                        ) : <p className="text-sm text-suave">Sin reservas activas (pedido cancelado o sin stock reservado).</p>}
                    </Tarjeta>
                </div>

                <div className="space-y-6">
                    {esStaff && d.transiciones.length > 0 && puede('pedidos', 'editar') && (
                        <Tarjeta titulo="Procesar pedido" className="print:hidden">
                            {d.transiciones.map((t) => (
                                <button key={t} type="button" className="btn-primario w-full" disabled={ocupado} onClick={() => avanzar(t)}>
                                    {ocupado && <LoaderCircle className="size-4 animate-spin" />} {ETIQUETA[t]}
                                </button>
                            ))}
                            {p.estado === 'pendiente' && saldoPend > 0 && <p className="mt-2 text-xs text-suave">Se confirma automáticamente al completar el pago. Confirmar manualmente deja el saldo como pago contra entrega.</p>}
                        </Tarjeta>
                    )}
                    <Tarjeta titulo="Cliente">
                        <p className="font-medium">{d.cliente.nombre} {d.cliente.apellido}</p>
                        <p className="text-sm text-suave">{d.cliente.email}{d.cliente.telefono ? ` · ${d.cliente.telefono}` : ''}</p>
                        {p.nit_ci && <p className="mt-2 text-sm">Factura: NIT/CI {p.nit_ci} · {p.razon_social}</p>}
                    </Tarjeta>
                    <Tarjeta titulo="Entrega">
                        <p className="flex items-center gap-2"><MapPin className="size-4 text-secundario" /> {d.entrega.tipo === 'envio' ? 'Envío a domicilio' : 'Recojo en oficinas de FEDER'} <Estado valor={d.entrega.estado} /></p>
                        {d.entrega.direccion && <p className="mt-1 text-sm">{d.entrega.direccion}{d.entrega.referencia ? ` (${d.entrega.referencia})` : ''}</p>}
                        {d.entrega.fecha_programada && <p className="mt-1 text-sm text-suave">Programada: {fecha(d.entrega.fecha_programada)}</p>}
                        {d.entrega.fecha_entrega && <p className="mt-1 text-sm text-suave">Entregada: {fechaHora(d.entrega.fecha_entrega)} a {d.entrega.receptor}</p>}
                    </Tarjeta>
                </div>
            </div>

            {plan && <ModalPlan pedido={p} saldo={saldoPend} onCerrar={() => setPlan(false)} onCreado={(m) => { setPlan(false); aviso.ok(m); cargar(); }} />}
            {pagar?.tipo === 'pedido' && (
                <ModalPago titulo={`Pagar pedido ${p.numero}`} montoMaximo={Number(porPagar.toFixed(2))} numeroPedido={p.numero}
                    onPagar={async (datos) => (await api.post(`/pedidos/${id}/pagar`, datos)).data}
                    onCerrar={(listo) => { setPagar(null); if (listo) cargar(); }} />
            )}
            {pagar?.tipo === 'cuota' && (
                <ModalPago titulo={`Pagar cuota ${pagar.cuota.numero} de ${d.plan.nro_cuotas}`} montoMaximo={Number(pagar.cuota.monto)} montoFijo numeroPedido={p.numero}
                    onPagar={(datos) => pagarCuota(pagar.cuota, datos)}
                    onCerrar={(listo) => { setPagar(null); if (listo) cargar(); }} />
            )}
            <Confirmar abierto={cancelar} titulo="Cancelar pedido" mensaje={`¿Cancelar el pedido ${p.numero}? El stock reservado volverá a estar disponible.`} onConfirmar={confirmarCancelacion} onCerrar={() => setCancelar(false)} cargando={ocupado} textoConfirmar="Sí, cancelar" />
        </>
    );
}
