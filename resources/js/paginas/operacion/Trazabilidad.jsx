import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, Boxes, MapPin, Receipt, Search, Sprout, Tractor } from 'lucide-react';
import api, { mensajeError } from '../../api/cliente';
import { Alerta, Cargando, Encabezado, Estado, Tarjeta } from '../../componentes/ui';
import { capitalizar, fecha, fechaHora, numero } from '../../utils/formato';

function Paso({ icono: I, titulo, children }) {
    return (
        <div className="tarjeta flex items-start gap-3 p-4">
            <div className="rounded-tema bg-primario/15 p-2 text-primario"><I className="size-6" aria-hidden="true" /></div>
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-suave">{titulo}</p>{children}</div>
        </div>
    );
}

/** CU3: trazabilidad de origen. Lote -> producción -> productor -> comunidad, y lote -> pedidos. */
export default function Trazabilidad() {
    const [params, setParams] = useSearchParams();
    const [codigo, setCodigo] = useState(params.get('lote') ?? '');
    const [pedido, setPedido] = useState(params.get('pedido') ?? '');
    const [res, setRes] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const buscar = async (tipo, valor) => {
        const v = valor.trim().toUpperCase();
        if (!/^[A-Z0-9-]{3,30}$/.test(v)) return setError(tipo === 'lote' ? 'Ingrese un código de lote válido (ej. ARR-001).' : 'Ingrese un número de pedido válido (ej. PED-000012).');
        setError('');
        setCargando(true);
        setParams({ [tipo]: v });
        try {
            const { data } = await api.get(`/trazabilidad/${tipo}/${encodeURIComponent(v)}`);
            setRes({ tipo, ...data });
        } catch (e) {
            setRes(null);
            setError(mensajeError(e));
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        if (params.get('lote')) buscar('lote', params.get('lote'));
        else if (params.get('pedido')) buscar('pedido', params.get('pedido'));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const l = res?.lote;
    return (
        <>
            <Encabezado titulo="Trazabilidad de origen" descripcion="CU3 · Del producto vendido hasta el lote, el productor y la comunidad" />
            <div className="mb-6 grid gap-4 md:grid-cols-2">
                <form className="tarjeta flex items-end gap-2 p-4" onSubmit={(e) => { e.preventDefault(); buscar('lote', codigo); }} noValidate>
                    <div className="flex-1"><label htmlFor="t-lote" className="etiqueta">Código de lote</label><input id="t-lote" className="campo uppercase" maxLength={30} placeholder="ARR-001" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
                    <button type="submit" className="btn-primario"><Search className="size-4" /> Rastrear</button>
                </form>
                <form className="tarjeta flex items-end gap-2 p-4" onSubmit={(e) => { e.preventDefault(); buscar('pedido', pedido); }} noValidate>
                    <div className="flex-1"><label htmlFor="t-ped" className="etiqueta">Número de pedido</label><input id="t-ped" className="campo uppercase" maxLength={30} placeholder="PED-000001" value={pedido} onChange={(e) => setPedido(e.target.value)} /></div>
                    <button type="submit" className="btn-primario"><Search className="size-4" /> Rastrear</button>
                </form>
            </div>
            <Alerta tipo="error">{error}</Alerta>
            {cargando && <Cargando />}
            {res?.tipo === 'lote' && l && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-2">
                        <Paso icono={MapPin} titulo="Comunidad de origen"><p className="font-semibold">{l.comunidad}</p><p className="text-sm text-suave">{l.municipio}{l.provincia ? `, ${l.provincia}` : ''}</p></Paso>
                        <ArrowDown className="mx-auto size-5 text-suave" aria-hidden="true" />
                        <Paso icono={Tractor} titulo="Productor"><p className="font-semibold">{l.emprendimiento}</p><p className="text-sm text-suave">Responsable: {l.responsable}</p></Paso>
                        <ArrowDown className="mx-auto size-5 text-suave" aria-hidden="true" />
                        <Paso icono={Sprout} titulo={`Producción #${l.produccion_id}`}><p className="font-semibold">{l.producto}</p><p className="text-sm text-suave">Producida: {fecha(l.fecha_produccion)} · {l.procedencia ?? '—'}</p><p className="text-sm text-suave">Validada por {l.validador ?? '—'} el {fecha(l.fecha_validacion)}</p></Paso>
                        <ArrowDown className="mx-auto size-5 text-suave" aria-hidden="true" />
                        <Paso icono={Boxes} titulo={`Lote ${l.codigo}`}><p className="text-sm">Inicial {numero(l.cantidad_inicial)} · Disponible <strong>{numero(l.stock_disponible)}</strong> · Reservado {numero(l.stock_reservado)} {l.unidad_medida}</p><p className="text-sm text-suave">Ingreso {fecha(l.fecha_ingreso)} · Vence {fecha(l.fecha_vencimiento)} · <Estado valor={l.estado} /></p></Paso>
                    </div>
                    <div className="space-y-4">
                        <Tarjeta titulo="Movimientos del lote">
                            <table className="tabla">
                                <thead><tr><th>Fecha</th><th>Tipo</th><th className="text-right">Cantidad</th><th>Motivo</th></tr></thead>
                                <tbody>{res.movimientos.map((m, i) => <tr key={i}><td>{fechaHora(m.fecha)}</td><td>{capitalizar(m.tipo)}</td><td className="text-right">{numero(m.cantidad)}</td><td className="text-xs">{m.motivo}{m.usuario ? ` · ${m.usuario}` : ''}</td></tr>)}</tbody>
                            </table>
                        </Tarjeta>
                        <Tarjeta titulo={`Pedidos abastecidos (${res.pedidos.length})`}>
                            {res.pedidos.length ? (
                                <table className="tabla">
                                    <thead><tr><th>Pedido</th><th>Cliente</th><th className="text-right">Cantidad</th><th>Reserva</th></tr></thead>
                                    <tbody>{res.pedidos.map((p, i) => <tr key={i}><td><Link className="text-primario hover:underline" to={`/panel/pedidos/${p.id}`}>{p.numero}</Link></td><td>{p.cliente}</td><td className="text-right">{numero(p.cantidad)}</td><td><Estado valor={p.estado_reserva} /></td></tr>)}</tbody>
                                </table>
                            ) : <p className="text-sm text-suave">Este lote aún no abasteció pedidos.</p>}
                        </Tarjeta>
                    </div>
                </div>
            )}
            {res?.tipo === 'pedido' && (
                <Tarjeta titulo={<span className="flex items-center gap-2"><Receipt className="size-5" /> Pedido {res.pedido.numero} · <Estado valor={res.pedido.estado} /></span>}>
                    {res.detalle.length ? (
                        <table className="tabla">
                            <thead><tr><th>Producto</th><th className="text-right">Cantidad</th><th>Lote</th><th>Productor</th><th>Comunidad</th><th>Producida</th><th>Reserva</th></tr></thead>
                            <tbody>{res.detalle.map((d, i) => <tr key={i}><td>{d.producto}</td><td className="text-right">{numero(d.cantidad)}</td><td><button type="button" className="font-mono text-primario hover:underline" onClick={() => { setCodigo(d.lote); buscar('lote', d.lote); }}>{d.lote}</button></td><td>{d.emprendimiento}</td><td>{d.comunidad}</td><td>{fecha(d.fecha_produccion)}</td><td><Estado valor={d.estado_reserva} /></td></tr>)}</tbody>
                        </table>
                    ) : <p className="text-sm text-suave">El pedido aún no tiene stock reservado (carrito o pedido cancelado).</p>}
                    <p className="mt-3 text-xs text-suave">Fuente: vista v_trazabilidad (reserva por lote, FEFO).</p>
                </Tarjeta>
            )}
        </>
    );
}
