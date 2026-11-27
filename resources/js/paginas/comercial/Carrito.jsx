import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, MapPin, Minus, Plus, ShoppingBag, Store, Trash2, Truck } from 'lucide-react';
import api, { erroresCampos, mensajeError } from '../../api/cliente';
import { ImagenProducto } from '../../componentes/ProductoTarjeta';
import { Alerta, Cargando, Vacio } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import { useCarrito } from '../../contextos/CarritoContext';
import { cotizarEnvio } from '../../utils/envio';
import { hoyISO, moneda, numero } from '../../utils/formato';

const SelectorUbicacion = lazy(() => import('../../componentes/Mapa').then((m) => ({ default: m.SelectorUbicacion })));

/** CU5: carrito de compras y confirmación de la compra (venta inmediata). */
export default function Carrito() {
    const { usuario } = useAuth();
    const { carrito, actualizar, quitar, vaciar, recargar } = useCarrito();
    const navegar = useNavigate();
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState(null);
    const [entrega, setEntrega] = useState({ tipo_entrega: 'recojo', direccion: usuario?.direccion ?? '', referencia: '', fecha_preferida: '', nit_ci: '', razon_social: '' });
    const [ubicacion, setUbicacion] = useState(null);
    const [errores, setErrores] = useState({});
    const [enviando, setEnviando] = useState(false);

    if (!carrito) return <Cargando />;

    const accion = async (id, fn) => {
        setOcupado(id);
        setError('');
        try {
            await fn();
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(null);
        }
    };

    const validar = () => {
        const e = {};
        if (entrega.tipo_entrega === 'envio') {
            if (!ubicacion) e.latitud = 'Marque su ubicación en el mapa.';
            else if (cotizacion?.fueraDeZona) e.latitud = `La ubicación está fuera de la zona de envío (máx. ${carrito.tarifa_envio.max_km} km). Elija recojo en FEDER.`;
            if (entrega.direccion.trim().length < 5) e.direccion = 'Para envío a domicilio indique la dirección (mínimo 5 caracteres).';
        }
        if (entrega.fecha_preferida && entrega.fecha_preferida < hoyISO()) e.fecha_preferida = 'La fecha no puede ser anterior a hoy.';
        if (entrega.nit_ci && !/^\d{5,15}(-?[A-Za-z0-9]{1,3})?$/.test(entrega.nit_ci.trim())) e.nit_ci = 'El NIT/CI debe tener entre 5 y 15 dígitos.';
        if (entrega.nit_ci && !entrega.razon_social.trim()) e.razon_social = 'Indique la razón social para la factura.';
        setErrores(e);
        return !Object.keys(e).length;
    };

    const confirmar = async (ev) => {
        ev.preventDefault();
        if (!validar()) return;
        setEnviando(true);
        setError('');
        try {
            const esEnvio = entrega.tipo_entrega === 'envio';
            const { data } = await api.post('/carrito/confirmar', {
                ...entrega,
                fecha_preferida: entrega.fecha_preferida || null,
                direccion: esEnvio ? entrega.direccion : null,
                latitud: esEnvio ? ubicacion?.lat : null,
                longitud: esEnvio ? ubicacion?.lng : null,
            });
            await recargar();
            navegar(`/panel/pedidos/${data.pedido_id}`, { state: { mensaje: data.message } });
        } catch (e) {
            setErrores(erroresCampos(e));
            setError(mensajeError(e));
        } finally {
            setEnviando(false);
        }
    };

    const esEnvio = entrega.tipo_entrega === 'envio';
    const cotizacion = esEnvio && ubicacion && carrito.tarifa_envio ? cotizarEnvio(carrito.tarifa_envio, ubicacion.lat, ubicacion.lng) : null;
    const envio = cotizacion?.costo ?? 0;
    const hayProblemas = carrito.detalles.some((d) => d.estado !== 'activo' || Number(d.cantidad) > Number(d.stock_disponible));

    return (
        <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-3 flex flex-wrap items-center gap-4 text-sm font-medium text-primario">
                <Link to="/panel" className="inline-flex items-center gap-1.5 hover:underline">
                    <ArrowLeft className="size-4" aria-hidden="true" /> Volver al panel
                </Link>
                <span className="text-borde" aria-hidden="true">·</span>
                <Link to="/catalogo" className="inline-flex items-center gap-1.5 hover:underline">
                    <ShoppingBag className="size-4" aria-hidden="true" /> Seguir comprando
                </Link>
            </div>
            <h1 className="mb-6 text-3xl font-bold">Mi carrito</h1>
            <div className="mb-4"><Alerta tipo="error" onCerrar={() => setError('')}>{error}</Alerta></div>
            {!carrito.detalles.length ? (
                <Vacio texto="Tu carrito está vacío.">
                    <Link to="/catalogo" className="btn-primario"><ShoppingBag className="size-4" /> Ir al catálogo</Link>
                </Vacio>
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    <section className="space-y-3 lg:col-span-2" aria-label="Productos del carrito">
                        {carrito.detalles.map((d) => {
                            const exceso = Number(d.cantidad) > Number(d.stock_disponible);
                            return (
                                <article key={d.producto_id} className="tarjeta flex gap-4 p-3">
                                    <div className="size-24 shrink-0 overflow-hidden rounded-tema"><ImagenProducto producto={d} className="h-24" /></div>
                                    <div className="flex flex-1 flex-col gap-1">
                                        <div className="flex justify-between gap-2">
                                            <div>
                                                <h2 className="font-semibold"><Link to={`/catalogo/${d.producto_id}`} className="hover:text-primario">{d.nombre}</Link></h2>
                                                <p className="text-sm text-suave">{d.presentacion} · {moneda(d.precio_unitario)} c/u</p>
                                            </div>
                                            <p className="font-bold">{moneda(d.subtotal)}</p>
                                        </div>
                                        {exceso && <p className="text-sm text-peligro">Solo hay {numero(d.stock_disponible)} disponibles. Ajusta la cantidad.</p>}
                                        {d.estado !== 'activo' && <p className="text-sm text-peligro">Este producto ya no está a la venta.</p>}
                                        <div className="mt-auto flex items-center gap-2">
                                            <button type="button" className="btn-secundario btn-sm" disabled={ocupado === d.producto_id || Number(d.cantidad) <= 1} onClick={() => accion(d.producto_id, () => actualizar(d.producto_id, Number(d.cantidad) - 1))} aria-label="Restar uno"><Minus className="size-4" /></button>
                                            <span className="w-14 text-center font-semibold" aria-label="Cantidad">{numero(d.cantidad)}</span>
                                            <button type="button" className="btn-secundario btn-sm" disabled={ocupado === d.producto_id || Number(d.cantidad) >= Number(d.stock_disponible)} onClick={() => accion(d.producto_id, () => actualizar(d.producto_id, Number(d.cantidad) + 1))} aria-label="Sumar uno"><Plus className="size-4" /></button>
                                            <span className="text-xs text-suave">{d.unidad_medida}</span>
                                            <button type="button" className="btn-fantasma btn-sm ml-auto text-peligro" onClick={() => accion(d.producto_id, () => quitar(d.producto_id))} aria-label={`Quitar ${d.nombre}`}><Trash2 className="size-4" /> Quitar</button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                        <button type="button" className="btn-fantasma btn-sm text-peligro" onClick={() => accion('todo', vaciar)}><Trash2 className="size-4" /> Vaciar carrito</button>
                    </section>

                    <form onSubmit={confirmar} noValidate className="tarjeta h-fit space-y-4 p-5" aria-label="Confirmar compra">
                        <h2 className="text-lg font-semibold">Entrega y facturación</h2>
                        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de entrega">
                            {[['recojo', 'Recojo en FEDER (gratis)', Store], ['envio', 'Envío (según distancia)', Truck]].map(([v, t, I]) => (
                                <button key={v} type="button" role="radio" aria-checked={entrega.tipo_entrega === v} onClick={() => setEntrega({ ...entrega, tipo_entrega: v })}
                                    className={`btn flex-col border py-3 text-sm ${entrega.tipo_entrega === v ? 'border-primario bg-primario/10 text-primario' : 'border-borde'}`}>
                                    <I className="size-5" /> {t}
                                </button>
                            ))}
                        </div>
                        {esEnvio && (
                            <>
                                <div>
                                    <p className="etiqueta flex items-center gap-1"><MapPin className="size-4" /> Ubicación de entrega <span className="text-peligro">*</span></p>
                                    <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
                                        <SelectorUbicacion valor={ubicacion} onChange={(u) => { setUbicacion(u); setErrores((x) => ({ ...x, latitud: undefined })); }} error={errores.latitud} alto="h-64" />
                                    </Suspense>
                                    {cotizacion && (
                                        <p className={`mt-2 rounded-tema px-3 py-2 text-sm ${cotizacion.fueraDeZona ? 'bg-peligro/10 text-peligro' : 'bg-primario/10'}`}>
                                            {cotizacion.fueraDeZona
                                                ? `Está a unos ${numero(cotizacion.km)} km: fuera de la zona de envío (máx. ${carrito.tarifa_envio.max_km} km).`
                                                : <>Distancia aprox. <strong>{numero(cotizacion.km)} km</strong> · Envío <strong>{moneda(cotizacion.costo)}</strong></>}
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-suave">
                                        Tarifa: {moneda(carrito.tarifa_envio?.base)} hasta {carrito.tarifa_envio?.km_incluidos} km, luego {moneda(carrito.tarifa_envio?.por_km)} por km.
                                    </p>
                                </div>
                                <div>
                                    <label htmlFor="c-dir" className="etiqueta">Dirección de entrega <span className="text-peligro">*</span></label>
                                    <input id="c-dir" className={`campo ${errores.direccion ? 'campo-error' : ''}`} maxLength={200} value={entrega.direccion} onChange={(e) => setEntrega({ ...entrega, direccion: e.target.value })} aria-invalid={!!errores.direccion} />
                                    {errores.direccion && <p className="mt-1 text-sm text-peligro">{errores.direccion}</p>}
                                </div>
                                <div>
                                    <label htmlFor="c-ref" className="etiqueta">Referencia</label>
                                    <input id="c-ref" className="campo" maxLength={200} placeholder="Casa verde, portón negro…" value={entrega.referencia} onChange={(e) => setEntrega({ ...entrega, referencia: e.target.value })} />
                                </div>
                            </>
                        )}
                        <div>
                            <label htmlFor="c-fecha" className="etiqueta">Fecha preferida de {esEnvio ? 'entrega' : 'recojo'} (opcional)</label>
                            <input id="c-fecha" type="date" min={hoyISO()} className={`campo ${errores.fecha_preferida ? 'campo-error' : ''}`} value={entrega.fecha_preferida} onChange={(e) => setEntrega({ ...entrega, fecha_preferida: e.target.value })} aria-describedby="c-fecha-ayuda" />
                            <p id="c-fecha-ayuda" className="mt-1 text-xs text-suave">FEDER te confirmará la fecha y hora exactas por notificación.</p>
                            {errores.fecha_preferida && <p className="mt-1 text-sm text-peligro">{errores.fecha_preferida}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label htmlFor="c-nit" className="etiqueta">NIT / CI</label>
                                <input id="c-nit" className={`campo ${errores.nit_ci ? 'campo-error' : ''}`} maxLength={18} value={entrega.nit_ci} onChange={(e) => setEntrega({ ...entrega, nit_ci: e.target.value })} />
                                {errores.nit_ci && <p className="mt-1 text-sm text-peligro">{errores.nit_ci}</p>}
                            </div>
                            <div>
                                <label htmlFor="c-rs" className="etiqueta">Razón social</label>
                                <input id="c-rs" className={`campo ${errores.razon_social ? 'campo-error' : ''}`} maxLength={120} value={entrega.razon_social} onChange={(e) => setEntrega({ ...entrega, razon_social: e.target.value })} />
                                {errores.razon_social && <p className="mt-1 text-sm text-peligro">{errores.razon_social}</p>}
                            </div>
                        </div>
                        <dl className="space-y-1 border-t border-borde pt-3 text-sm">
                            <div className="flex justify-between"><dt>Subtotal</dt><dd>{moneda(carrito.subtotal)}</dd></div>
                            <div className="flex justify-between"><dt>Envío</dt><dd>{esEnvio && !cotizacion ? 'Marque su ubicación' : moneda(envio)}</dd></div>
                            <div className="flex justify-between text-lg font-bold"><dt>Total</dt><dd>{moneda(Number(carrito.subtotal) + envio)}</dd></div>
                        </dl>
                        <button type="submit" className="btn-primario w-full" disabled={enviando || hayProblemas}>
                            {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />} Confirmar pedido
                        </button>
                        <p className="text-xs text-suave">Al confirmar, el stock se reserva por 24 horas. Luego podrás pagar al contado o en cuotas.</p>
                    </form>
                </div>
            )}
        </div>
    );
}
