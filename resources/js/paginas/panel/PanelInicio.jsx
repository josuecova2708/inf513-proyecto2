import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, Boxes, CalendarClock, ClipboardList, PackageCheck, Receipt, ShoppingBag, Truck, Wheat } from 'lucide-react';
import api from '../../api/cliente';
import { Cargando, Encabezado, Estado, Metrica, Tarjeta, Vacio } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import { fecha, moneda, numero } from '../../utils/formato';

function Acceso({ to, icono: I, titulo, valor, color = 'primario' }) {
    return (
        <Link to={to} className="block transition-transform hover:-translate-y-0.5">
            <Metrica titulo={titulo} valor={valor} icono={I} color={color} />
        </Link>
    );
}

export default function PanelInicio() {
    const { usuario } = useAuth();
    const [r, setR] = useState(null);

    useEffect(() => {
        api.get('/panel/resumen').then(({ data }) => setR(data)).catch(() => setR({}));
    }, []);

    const saludo = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';

    return (
        <>
            <Encabezado titulo={`${saludo}, ${usuario?.nombre}`} descripcion={`Panel de ${usuario?.rol} · FEDER`} />
            {!r ? <Cargando /> : usuario?.rol === 'Cliente' ? (
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Acceso to="/panel/pedidos" icono={Receipt} titulo="Pedidos en curso" valor={r.pedidos_activos} />
                        <Acceso to="/panel/pagos" icono={Banknote} titulo="Saldo pendiente" valor={moneda(r.saldo_pendiente)} color={r.saldo_pendiente > 0 ? 'aviso' : 'exito'} />
                        <Acceso to="/panel/encargos" icono={ClipboardList} titulo="Encargos activos" valor={r.encargos_activos} color="info" />
                        <Acceso to="/panel/planes" icono={CalendarClock} titulo="Cuotas por pagar" valor={r.cuotas_pendientes} color="acento" />
                    </div>
                    <Tarjeta titulo="Mis últimos pedidos" acciones={<Link to="/catalogo" className="btn-primario btn-sm"><ShoppingBag className="size-4" /> Ir a la tienda</Link>}>
                        {r.ultimos_pedidos?.length ? (
                            <div className="overflow-x-auto">
                                <table className="tabla">
                                    <thead><tr><th>Pedido</th><th>Fecha</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Saldo</th></tr></thead>
                                    <tbody>
                                        {r.ultimos_pedidos.map((p) => (
                                            <tr key={p.id}>
                                                <td><Link className="font-medium text-primario hover:underline" to={`/panel/pedidos/${p.id}`}>{p.numero}</Link></td>
                                                <td>{fecha(p.fecha)}</td>
                                                <td><Estado valor={p.estado} /></td>
                                                <td className="text-right">{moneda(p.total)}</td>
                                                <td className="text-right">{moneda(p.saldo_pendiente)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <Vacio texto="Aún no tienes pedidos. ¡Visita la tienda!" />}
                    </Tarjeta>
                </div>
            ) : usuario?.rol === 'Productor' ? (
                <div className="space-y-6">
                    {!r.emprendimiento ? <Vacio texto="Tu cuenta aún no está vinculada a un emprendimiento. Comunícate con FEDER." /> : (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <Acceso to={`/panel/emprendimientos`} icono={Wheat} titulo="Mi emprendimiento" valor={r.emprendimiento.nombre} />
                                <Acceso to="/panel/produccion" icono={ClipboardList} titulo="Producción por validar" valor={r.produccion?.reportada ?? 0} color="aviso" />
                                <Acceso to="/panel/lotes" icono={Boxes} titulo="Stock en lotes" valor={numero(r.stock_lotes)} color="info" />
                                <Metrica titulo="Vendido (con trazabilidad)" valor={moneda(r.vendido)} icono={PackageCheck} color="exito" />
                            </div>
                            <Tarjeta titulo="Mis lotes recientes" acciones={<Link to="/panel/produccion" className="btn-primario btn-sm">Reportar producción</Link>}>
                                {r.lotes?.length ? (
                                    <div className="overflow-x-auto">
                                        <table className="tabla">
                                            <thead><tr><th>Lote</th><th>Producto</th><th className="text-right">Disponible</th><th>Vence</th><th>Estado</th></tr></thead>
                                            <tbody>{r.lotes.map((l) => <tr key={l.codigo}><td className="font-mono">{l.codigo}</td><td>{l.producto}</td><td className="text-right">{numero(l.stock_disponible)}</td><td>{fecha(l.fecha_vencimiento)}</td><td><Estado valor={l.estado} /></td></tr>)}</tbody>
                                        </table>
                                    </div>
                                ) : <Vacio texto="Aún no hay lotes de tu producción." />}
                            </Tarjeta>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Acceso to="/panel/pedidos" icono={Receipt} titulo="Pedidos por atender" valor={r.pedidos_por_atender} />
                        <Acceso to="/panel/pagos" icono={Banknote} titulo="Pagos por verificar" valor={r.pagos_por_verificar} color="aviso" />
                        <Acceso to="/panel/produccion" icono={Wheat} titulo="Producción por validar" valor={r.produccion_por_validar} color="info" />
                        <Acceso to="/panel/alertas" icono={AlertTriangle} titulo="Alertas de inventario" valor={r.alertas_activas} color="peligro" />
                        <Acceso to="/panel/encargos" icono={ClipboardList} titulo="Encargos nuevos" valor={r.encargos_nuevos} color="acento" />
                        <Acceso to="/panel/entregas" icono={Truck} titulo="Entregas pendientes" valor={r.entregas_pendientes} color="exito" />
                    </div>
                    {r.puede_dashboard && <Link to="/panel/dashboard" className="btn-primario">Ver panel analítico completo</Link>}
                </div>
            )}
        </>
    );
}
