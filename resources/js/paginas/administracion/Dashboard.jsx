import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, Eye, KeyRound, Receipt, ShieldX, TrendingUp, Users } from 'lucide-react';
import api from '../../api/cliente';
import { GraficoBarras, GraficoLineas } from '../../componentes/Graficos';
import { Cargando, Encabezado, Metrica, Tarjeta } from '../../componentes/ui';
import { fechaHora, moneda, numero } from '../../utils/formato';

/** Panel analítico: actividad del negocio y flujo de accesos al sitio. */
export default function Dashboard() {
    const [dias, setDias] = useState(30);
    const [d, setD] = useState(null);

    useEffect(() => {
        setD(null);
        api.get('/dashboard', { params: { dias } }).then(({ data }) => setD(data)).catch(() => setD(false));
    }, [dias]);

    return (
        <>
            <Encabezado titulo="Panel analítico" descripcion="Métricas clave del negocio y del tráfico del sitio web">
                <div role="group" aria-label="Periodo" className="flex gap-1">
                    {[7, 30, 90].map((n) => (
                        <button key={n} type="button" aria-pressed={dias === n} onClick={() => setDias(n)} className={`btn btn-sm border ${dias === n ? 'border-primario bg-primario text-sobre-primario' : 'border-borde bg-superficie'}`}>{n} días</button>
                    ))}
                </div>
            </Encabezado>
            {d === null ? <Cargando /> : d === false ? <p className="text-peligro">No se pudo cargar el panel.</p> : (
                <div className="space-y-6">
                    <h2 className="text-lg font-semibold">Negocio · últimos {d.dias} días</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Metrica titulo="Ventas confirmadas" valor={moneda(d.negocio.ventas)} detalle={`${d.negocio.pedidos} pedidos`} icono={TrendingUp} />
                        <Metrica titulo="Cobrado" valor={moneda(d.negocio.cobrado)} detalle={`Ticket promedio ${moneda(d.negocio.ticket_promedio)}`} icono={Banknote} color="exito" />
                        <Metrica titulo="Clientes / productores" valor={`${d.negocio.clientes} / ${d.negocio.productores}`} icono={Users} color="info" />
                        <Metrica titulo="Alertas de inventario" valor={d.negocio.alertas_activas} icono={AlertTriangle} color={d.negocio.alertas_activas ? 'peligro' : 'exito'} />
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                        <Link to="/panel/pedidos?estado=confirmado" className="insignia bg-info/15 px-3 py-1 text-info"><Receipt className="size-3" /> {d.negocio.pedidos_por_atender} pedidos por atender</Link>
                        <Link to="/panel/pagos" className="insignia bg-aviso/15 px-3 py-1 text-aviso">{d.negocio.pagos_por_verificar} pagos por verificar</Link>
                        <Link to="/panel/produccion" className="insignia bg-acento/20 px-3 py-1">{d.negocio.produccion_por_validar} producciones por validar</Link>
                        <Link to="/panel/encargos" className="insignia bg-superficie-2 px-3 py-1">{d.negocio.encargos_nuevos} encargos nuevos</Link>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Tarjeta titulo="Ventas por día (Bs.)"><GraficoLineas datos={d.ventas_por_dia} x="dia" series={[{ clave: 'ventas', nombre: 'Ventas', color: 'primario' }]} formato={moneda} fechaX /></Tarjeta>
                        <Tarjeta titulo="Productos más vendidos (Bs.)"><GraficoBarras datos={d.top_productos} x="producto" y="monto" nombre="Monto" formato={moneda} horizontal /></Tarjeta>
                        <Tarjeta titulo="Pedidos por estado"><GraficoBarras datos={d.pedidos_por_estado} x="estado" y="total" nombre="Pedidos" horizontal /></Tarjeta>
                        <Tarjeta titulo="Ventas por comunidad de origen (Bs.)"><GraficoBarras datos={d.ventas_por_comunidad} x="comunidad" y="monto" nombre="Monto" formato={moneda} horizontal /></Tarjeta>
                    </div>

                    <h2 className="pt-2 text-lg font-semibold">Accesos al sitio web</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Metrica titulo="Visitas totales" valor={numero(d.accesos.visitas_total)} icono={Eye} color="info" />
                        <Metrica titulo="Inicios de sesión" valor={numero(d.accesos.logins_ok)} icono={KeyRound} color="exito" />
                        <Metrica titulo="Intentos fallidos" valor={numero(d.accesos.logins_fallidos)} icono={ShieldX} color="peligro" />
                        <Metrica titulo="Accesos denegados" valor={numero(d.accesos.accesos_denegados)} icono={ShieldX} color="aviso" />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Tarjeta titulo="Inicios de sesión por día"><GraficoLineas datos={d.accesos.logins_por_dia} x="dia" series={[{ clave: 'exitosos', nombre: 'Exitosos', color: 'exito' }, { clave: 'fallidos', nombre: 'Fallidos', color: 'peligro' }]} fechaX /></Tarjeta>
                        <Tarjeta titulo="Recursos de la API más accedidos"><GraficoBarras datos={d.accesos.recursos} x="recurso" y="total" nombre="Peticiones" horizontal color="var(--serie-1)" /></Tarjeta>
                        <Tarjeta titulo="Páginas más visitadas (contador del footer)">
                            <table className="tabla">
                                <thead><tr><th>Página</th><th className="text-right">Visitas</th><th>Última</th></tr></thead>
                                <tbody>{d.accesos.paginas.map((p) => <tr key={p.pagina}><td className="font-mono text-xs">{p.pagina}</td><td className="text-right">{numero(p.contador)}</td><td className="text-xs">{fechaHora(p.ultima_visita)}</td></tr>)}</tbody>
                            </table>
                        </Tarjeta>
                        <Tarjeta titulo="Direcciones IP con más actividad" acciones={<Link to="/panel/bitacora" className="text-sm text-primario hover:underline">Ver bitácora</Link>}>
                            <table className="tabla">
                                <thead><tr><th>IP</th><th className="text-right">Peticiones</th><th className="text-right">Logins fallidos</th></tr></thead>
                                <tbody>{d.accesos.ips.map((ip) => <tr key={ip.ip}><td className="font-mono">{ip.ip}</td><td className="text-right">{numero(ip.total)}</td><td className={`text-right ${ip.fallidos ? 'font-semibold text-peligro' : ''}`}>{ip.fallidos}</td></tr>)}</tbody>
                            </table>
                        </Tarjeta>
                    </div>
                </div>
            )}
        </>
    );
}
