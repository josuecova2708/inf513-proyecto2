import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, LoaderCircle, MapPin, ShoppingCart } from 'lucide-react';
import api, { mensajeError, urlImagen } from '../../api/cliente';
import { ImagenProducto, useAgregarAlCarrito } from '../../componentes/ProductoTarjeta';
import { Alerta, Cargando, Insignia, Vacio } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import { hoyISO, moneda, numero } from '../../utils/formato';

function FormEncargo({ producto }) {
    const { autenticado, puede } = useAuth();
    const navegar = useNavigate();
    const [d, setD] = useState({ cantidad: '1', fecha_requerida: hoyISO(1), observacion: '' });
    const [err, setErr] = useState({});
    const [msg, setMsg] = useState({ ok: '', error: '' });
    const [enviando, setEnviando] = useState(false);

    if (!autenticado) {
        return <button type="button" className="btn-secundario w-full" onClick={() => navegar('/login', { state: { desde: `/catalogo/${producto.id}` } })}><ClipboardList className="size-4" /> Inicia sesión para encargar</button>;
    }
    if (!puede('encargos', 'crear')) return null;

    const enviar = async (e) => {
        e.preventDefault();
        const errores = {};
        const cant = Number(d.cantidad);
        if (!d.cantidad || Number.isNaN(cant) || cant <= 0) errores.cantidad = 'La cantidad debe ser mayor que 0.';
        else if (cant > 100000) errores.cantidad = 'La cantidad no puede ser mayor que 100000.';
        if (!d.fecha_requerida) errores.fecha_requerida = 'La fecha requerida es obligatoria.';
        else if (d.fecha_requerida < hoyISO(1)) errores.fecha_requerida = 'La fecha requerida debe ser posterior a hoy.';
        if (d.observacion.length > 500) errores.observacion = 'La observación no puede tener más de 500 caracteres.';
        setErr(errores);
        if (Object.keys(errores).length) return;
        setEnviando(true);
        try {
            await api.post('/encargos', { fecha_requerida: d.fecha_requerida, observacion: d.observacion, items: [{ producto_id: producto.id, cantidad: cant }] });
            setMsg({ ok: 'Encargo registrado. FEDER te notificará cuando sea aceptado.', error: '' });
        } catch (ex) {
            setMsg({ ok: '', error: mensajeError(ex) });
        } finally {
            setEnviando(false);
        }
    };

    return (
        <form onSubmit={enviar} noValidate className="tarjeta space-y-3 p-4">
            <h2 className="font-semibold">Hacer un encargo</h2>
            <p className="text-sm text-suave">Para pedidos anticipados o productos de temporada.</p>
            <Alerta tipo="exito">{msg.ok}</Alerta>
            <Alerta tipo="error">{msg.error}</Alerta>
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label htmlFor="enc-cant" className="etiqueta">Cantidad ({producto.unidad_medida})</label>
                    <input id="enc-cant" type="number" min="0.01" step="0.01" className={`campo ${err.cantidad ? 'campo-error' : ''}`} value={d.cantidad} onChange={(e) => setD({ ...d, cantidad: e.target.value })} aria-invalid={!!err.cantidad} />
                    {err.cantidad && <p className="mt-1 text-sm text-peligro">{err.cantidad}</p>}
                </div>
                <div>
                    <label htmlFor="enc-fecha" className="etiqueta">Fecha requerida</label>
                    <input id="enc-fecha" type="date" min={hoyISO(1)} className={`campo ${err.fecha_requerida ? 'campo-error' : ''}`} value={d.fecha_requerida} onChange={(e) => setD({ ...d, fecha_requerida: e.target.value })} aria-invalid={!!err.fecha_requerida} />
                    {err.fecha_requerida && <p className="mt-1 text-sm text-peligro">{err.fecha_requerida}</p>}
                </div>
            </div>
            <div>
                <label htmlFor="enc-obs" className="etiqueta">Observación (opcional)</label>
                <textarea id="enc-obs" rows={2} maxLength={500} className="campo" value={d.observacion} onChange={(e) => setD({ ...d, observacion: e.target.value })} />
                {err.observacion && <p className="mt-1 text-sm text-peligro">{err.observacion}</p>}
            </div>
            <button type="submit" className="btn-secundario w-full" disabled={enviando}>
                {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <ClipboardList className="size-4" />} Enviar encargo
            </button>
        </form>
    );
}

export default function ProductoDetalle() {
    const { id } = useParams();
    const [p, setP] = useState(undefined);
    const [cantidad, setCantidad] = useState(1);
    const carrito = useAgregarAlCarrito();

    useEffect(() => {
        setP(undefined);
        api.get(`/catalogo/${id}`).then(({ data }) => setP(data)).catch(() => setP(null));
    }, [id]);

    if (p === undefined) return <Cargando />;
    if (p === null) return <div className="mx-auto max-w-3xl px-4 py-10"><Vacio texto="El producto no existe o no está disponible."><Link to="/catalogo" className="btn-secundario btn-sm">Volver al catálogo</Link></Vacio></div>;

    const disponible = Number(p.stock_disponible);
    const inmediata = p.modalidad_venta !== 'encargo';
    const encargo = p.modalidad_venta !== 'inmediata';
    const errorCantidad = cantidad <= 0 ? 'La cantidad debe ser mayor que 0.' : cantidad > disponible ? `Solo hay ${numero(disponible)} ${p.unidad_medida} disponibles.` : '';

    return (
        <div className="mx-auto max-w-6xl px-4 py-8">
            <Link to="/catalogo" className="mb-4 inline-flex items-center gap-1 text-sm text-primario hover:underline"><ArrowLeft className="size-4" /> Volver al catálogo</Link>
            <div className="grid gap-8 lg:grid-cols-2">
                <div className="tarjeta self-start overflow-hidden"><ImagenProducto producto={p} className="h-80 sm:h-96" /></div>
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Insignia color="primario">{p.categoria}</Insignia>
                        <Insignia color="info">{{ inmediata: 'Venta inmediata', encargo: 'Solo por encargo', ambas: 'Inmediata y por encargo' }[p.modalidad_venta]}</Insignia>
                    </div>
                    <h1 className="text-3xl font-bold">{p.nombre}</h1>
                    <p className="text-suave">{p.descripcion}</p>
                    <p className="text-3xl font-bold text-primario">{moneda(p.precio_venta)} <span className="text-base font-normal text-suave">/ {p.presentacion || p.unidad_medida}</span></p>
                    {inmediata && (
                        <p className={disponible > 0 ? 'text-exito' : 'text-peligro'}>
                            {disponible > 0 ? `Disponible: ${numero(disponible)} ${p.unidad_medida}` : 'Sin stock por el momento'}
                            {Number(p.produccion_futura) > 0 && <span className="ml-2 text-sm text-suave">(+{numero(p.produccion_futura)} en producción futura)</span>}
                        </p>
                    )}
                    <Alerta tipo="exito" onCerrar={carrito.limpiar}>{carrito.mensaje} {carrito.mensaje && <Link to="/carrito" className="font-semibold underline">Ir al carrito</Link>}</Alerta>
                    <Alerta tipo="error" onCerrar={carrito.limpiar}>{carrito.error}</Alerta>
                    {inmediata && disponible > 0 && (
                        <div className="tarjeta flex flex-wrap items-end gap-3 p-4">
                            <div>
                                <label htmlFor="cant" className="etiqueta">Cantidad</label>
                                <input id="cant" type="number" min="1" max={disponible} step="1" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className={`campo w-28 ${errorCantidad ? 'campo-error' : ''}`} aria-invalid={!!errorCantidad} aria-describedby="cant-err" />
                            </div>
                            <button type="button" className="btn-primario" disabled={!!errorCantidad || carrito.cargando === p.id} onClick={() => carrito.agregarProducto(p, cantidad)}>
                                {carrito.cargando === p.id ? <LoaderCircle className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />} Agregar al carrito
                            </button>
                            {errorCantidad && <p id="cant-err" className="w-full text-sm text-peligro">{errorCantidad}</p>}
                        </div>
                    )}
                    {encargo && <FormEncargo producto={p} />}
                    {p.productores?.length > 0 && (
                        <div>
                            <h2 className="mb-2 font-semibold">Producido por</h2>
                            <ul className="space-y-2">
                                {p.productores.map((e) => (
                                    <li key={e.id} className="tarjeta flex items-center gap-3 p-3">
                                        {e.imagen
                                            ? <img src={urlImagen(e.imagen)} alt={`Foto de ${e.nombre}`} className="size-16 shrink-0 rounded-full object-cover ring-2 ring-primario/20" loading="lazy" />
                                            : <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-superficie-2"><MapPin className="size-6 text-secundario" aria-hidden="true" /></span>}
                                        <div>
                                            <p className="font-medium">{e.nombre}</p>
                                            {e.responsable && <p className="text-sm">{e.responsable}</p>}
                                            <p className="text-sm text-suave">{e.comunidad} · {e.municipio}{e.temporada ? ` · Temporada: ${e.temporada}` : ''}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
