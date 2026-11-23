import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CalendarClock, Coins, HandCoins, Package, Percent, Receipt, TrendingUp } from 'lucide-react';
import api, { mensajeError } from '../../api/cliente';
import { GraficoBarras, GraficoLineas } from '../../componentes/Graficos';
import { Alerta, Cargando, Encabezado, Estado, Metrica, Tarjeta } from '../../componentes/ui';
import { fecha, hoyISO, moneda } from '../../utils/formato';

/** CU7: indicadores financieros del periodo. */
export default function Finanzas() {
    const [rango, setRango] = useState({ desde: hoyISO(-29), hasta: hoyISO() });
    const [d, setD] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (rango.hasta < rango.desde) return setError('La fecha "hasta" no puede ser anterior a la fecha "desde".');
        setError('');
        setD(null);
        api.get('/finanzas/indicadores', { params: rango }).then(({ data }) => setD(data)).catch((e) => setError(mensajeError(e)));
    }, [rango]);

    const k = d?.kpi;
    return (
        <>
            <Encabezado titulo="Indicadores financieros" descripcion="CU7 · Ventas, cobranza, margen bruto por lote de origen, inventario valorizado y planes de pago">
                <div className="flex items-end gap-2">
                    <div><label htmlFor="f-desde" className="etiqueta text-xs">Desde</label><input id="f-desde" type="date" className="campo" value={rango.desde} max={rango.hasta} onChange={(e) => setRango({ ...rango, desde: e.target.value })} /></div>
                    <div><label htmlFor="f-hasta" className="etiqueta text-xs">Hasta</label><input id="f-hasta" type="date" className="campo" value={rango.hasta} min={rango.desde} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} /></div>
                </div>
            </Encabezado>
            <Alerta tipo="error">{error}</Alerta>
            {!d && !error ? <Cargando /> : d && (
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Metrica titulo="Ventas del periodo" valor={moneda(k.ventas)} detalle={`${k.pedidos} pedidos · ${k.cancelados} cancelados`} icono={TrendingUp} />
                        <Metrica titulo="Ticket promedio" valor={moneda(k.ticket_promedio)} icono={Receipt} color="info" />
                        <Metrica titulo="Cobrado en el periodo" valor={moneda(k.cobrado)} icono={Banknote} color="exito" />
                        <Metrica titulo="Cuentas por cobrar (hoy)" valor={moneda(k.por_cobrar)} icono={HandCoins} color="aviso" />
                        <Metrica titulo="Margen bruto" valor={moneda(k.margen_bruto)} detalle={`Ingreso ${moneda(k.ingreso_vendido)} − costo ${moneda(k.costo_vendido)}`} icono={Coins} color="exito" />
                        <Metrica titulo="Margen %" valor={k.margen_porcentaje === null ? '—' : `${k.margen_porcentaje} %`} icono={Percent} color="primario" />
                        <Metrica titulo="Inventario valorizado" valor={moneda(k.inventario_costo)} detalle={`A precio de venta: ${moneda(k.inventario_venta)}`} icono={Package} color="info" />
                        <Metrica titulo="Cuotas por cobrar" valor={moneda(k.cuotas_pendientes + k.cuotas_vencidas_monto)} detalle={`${k.planes_vigentes} planes vigentes · ${k.cuotas_vencidas} cuotas vencidas`} icono={CalendarClock} color={k.cuotas_vencidas ? 'peligro' : 'acento'} />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Tarjeta titulo="Ingresos cobrados por día (Bs.)"><GraficoLineas datos={d.ingresos_por_dia} x="dia" series={[{ clave: 'monto', nombre: 'Cobrado', color: 'primario' }]} formato={moneda} fechaX /></Tarjeta>
                        <Tarjeta titulo="Cobros por método de pago (Bs.)"><GraficoBarras datos={d.por_metodo} x="metodo" y="monto" nombre="Cobrado" formato={moneda} horizontal /></Tarjeta>
                    </div>
                    <Tarjeta titulo="Margen por producto (según costo del lote de origen)">
                        <div className="overflow-x-auto">
                            <table className="tabla">
                                <thead><tr><th>Producto</th><th className="text-right">Ingreso</th><th className="text-right">Costo</th><th className="text-right">Margen</th><th className="text-right">%</th></tr></thead>
                                <tbody>{d.margen_por_producto.map((m) => {
                                    const mg = Number(m.ingreso) - Number(m.costo);
                                    return <tr key={m.producto}><td>{m.producto}</td><td className="text-right">{moneda(m.ingreso)}</td><td className="text-right">{moneda(m.costo)}</td><td className="text-right font-semibold">{moneda(mg)}</td><td className="text-right">{Number(m.ingreso) ? `${((mg * 100) / Number(m.ingreso)).toFixed(1)} %` : '—'}</td></tr>;
                                })}</tbody>
                            </table>
                        </div>
                    </Tarjeta>
                    <Tarjeta titulo={`Cuentas por cobrar (${d.cuentas_por_cobrar.length})`}>
                        <div className="overflow-x-auto">
                            <table className="tabla">
                                <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Cobrado</th><th className="text-right">Saldo</th></tr></thead>
                                <tbody>{d.cuentas_por_cobrar.map((c) => <tr key={c.id}><td><Link className="text-primario hover:underline" to={`/panel/pedidos/${c.id}`}>{c.numero}</Link>{c.plan_id && <span className="ml-1 text-xs text-suave">(plan)</span>}</td><td>{c.cliente}</td><td>{fecha(c.fecha)}</td><td><Estado valor={c.estado} /></td><td className="text-right">{moneda(c.total)}</td><td className="text-right">{moneda(c.cobrado)}</td><td className="text-right font-semibold">{moneda(c.saldo_pendiente)}</td></tr>)}</tbody>
                            </table>
                        </div>
                    </Tarjeta>
                </div>
            )}
        </>
    );
}
