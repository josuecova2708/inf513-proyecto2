import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Banknote, Boxes, CalendarClock, ClipboardList, MapPinned, PackageCheck, Receipt, ShieldCheck, ShoppingBag, Truck, Wheat } from 'lucide-react';
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
                    <div className="tarjeta relative overflow-hidden bg-gradient-to-br from-primario/15 via-superficie to-acento/10 p-6 sm:p-8">
                        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                            <div className="max-w-xl space-y-2">
                                <span className="insignia bg-primario/15 text-primario">
                                    <Wheat className="size-3.5" aria-hidden="true" /> Directo de nuestras comunidades
                                </span>
                                <h2 className="text-2xl font-bold sm:text-3xl">Explora el catálogo de productos frescos</h2>
                                <p className="text-suave">
                                    Descubre granos, café, miel, hortalizas y productos de temporada cultivados por productores locales con trazabilidad de origen garantizada.
                                </p>
                                <div className="flex flex-wrap gap-4 pt-2 text-xs text-suave">
                                    <span className="inline-flex items-center gap-1.5"><MapPinned className="size-4 text-primario" aria-hidden="true" /> Comunidades agrícolas de Santa Cruz</span>
                                    <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-primario" aria-hidden="true" /> Trazabilidad por lote</span>
                                    <span className="inline-flex items-center gap-1.5"><Truck className="size-4 text-primario" aria-hidden="true" /> Recojo en FEDER o envío a domicilio</span>
                                </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-3">
                                <Link to="/catalogo" className="btn-primario px-5 py-2.5">
                                    <ShoppingBag className="size-5" aria-hidden="true" /> Ver catálogo <ArrowRight className="size-4" aria-hidden="true" />
                                </Link>
                                <Link to="/panel/pedidos" className="btn-secundario">
                                    <Receipt className="size-4" aria-hidden="true" /> Ver mis pedidos
                                </Link>
                            </div>
                        </div>
                    </div>
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
