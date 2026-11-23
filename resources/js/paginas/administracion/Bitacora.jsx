import { useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, ShieldX, Users } from 'lucide-react';
import api from '../../api/cliente';
import { BarraFiltros, FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { Encabezado, Estado, Metrica, Tarjeta } from '../../componentes/ui';
import { GraficoBarras, GraficoLineas } from '../../componentes/Graficos';
import useListado from '../../hooks/useListado';
import { capitalizar, fechaHora, numero } from '../../utils/formato';

const ACCIONES = ['login_ok', 'login_fallido', 'logout', 'registro', 'acceso', 'crear', 'editar', 'eliminar', 'acceso_denegado'];

/** CU1: bitácora de auditoría (logins exitosos/fallidos, IPs y recursos más accedidos). */
export default function Bitacora() {
    const listado = useListado('/bitacora', { q: '', accion: '', desde: '', hasta: '' });
    const [resumen, setResumen] = useState(null);

    useEffect(() => {
        api.get('/bitacora/resumen', { params: { dias: 7 } }).then(({ data }) => setResumen(data)).catch(() => {});
    }, []);

    const t = resumen?.totales ?? {};

    return (
        <>
            <Encabezado titulo="Bitácora de auditoría" descripcion="Inicios de sesión, intentos fallidos, direcciones IP y recursos con mayor acceso" />
            {resumen && (
                <div className="mb-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Metrica titulo="Logins exitosos (7 días)" valor={numero(t.login_ok ?? 0)} icono={KeyRound} color="exito" />
                        <Metrica titulo="Intentos fallidos" valor={numero(t.login_fallido ?? 0)} icono={ShieldX} color="peligro" />
                        <Metrica titulo="Accesos denegados" valor={numero(t.acceso_denegado ?? 0)} icono={ShieldAlert} color="aviso" />
                        <Metrica titulo="Usuarios más activos" valor={resumen.usuarios?.[0]?.usuario ?? '—'} detalle={resumen.usuarios?.[0] ? `${resumen.usuarios[0].total} acciones` : ''} icono={Users} color="info" />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                        <Tarjeta titulo="Inicios de sesión por día">
                            <GraficoLineas datos={resumen.logins_por_dia} x="dia" series={[{ clave: 'exitosos', nombre: 'Exitosos', color: 'exito' }, { clave: 'fallidos', nombre: 'Fallidos', color: 'peligro' }]} fechaX />
                        </Tarjeta>
                        <Tarjeta titulo="Recursos con mayor acceso">
                            <GraficoBarras datos={resumen.recursos} x="recurso" y="total" nombre="Accesos" horizontal />
                        </Tarjeta>
                        <Tarjeta titulo="Direcciones IP">
                            <table className="tabla">
                                <thead><tr><th>IP</th><th className="text-right">Peticiones</th><th className="text-right">Fallidos</th></tr></thead>
                                <tbody>
                                    {resumen.ips.map((ip) => (
                                        <tr key={ip.ip}><td className="font-mono">{ip.ip}</td><td className="text-right">{numero(ip.total)}</td><td className={`text-right ${ip.fallidos > 0 ? 'font-semibold text-peligro' : ''}`}>{ip.fallidos}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </Tarjeta>
                    </div>
                </div>
            )}
            <section className="tarjeta">
                <BarraFiltros listado={listado} placeholder="Usuario o correo">
                    <FiltroSelect etiqueta="Acción" valor={listado.filtros.accion} onChange={(v) => listado.setFiltro('accion', v)} opciones={ACCIONES.map((a) => ({ value: a, label: capitalizar(a) }))} todas />
                    <div>
                        <label className="etiqueta text-xs" htmlFor="b-desde">Desde</label>
                        <input id="b-desde" type="date" className="campo" value={listado.filtros.desde} onChange={(e) => listado.setFiltro('desde', e.target.value)} />
                    </div>
                    <div>
                        <label className="etiqueta text-xs" htmlFor="b-hasta">Hasta</label>
                        <input id="b-hasta" type="date" className="campo" value={listado.filtros.hasta} min={listado.filtros.desde} onChange={(e) => listado.setFiltro('hasta', e.target.value)} />
                    </div>
                </BarraFiltros>
                <TablaDatos
                    listado={listado}
                    columnas={[
                        { titulo: 'Fecha', render: (b) => <span className="whitespace-nowrap">{fechaHora(b.fecha)}</span> },
                        { titulo: 'Acción', render: (b) => <Estado valor={b.accion} /> },
                        { titulo: 'Usuario', render: (b) => b.usuario ?? b.email ?? <span className="text-suave">Visitante</span> },
                        { titulo: 'Recurso', render: (b) => <span className="font-mono text-xs">{b.metodo} {b.ruta}</span> },
                        { titulo: 'HTTP', render: (b) => <span className={b.codigo_http >= 400 ? 'text-peligro' : ''}>{b.codigo_http ?? '—'}</span> },
                        { titulo: 'IP', render: (b) => <span className="font-mono text-xs">{b.ip}</span> },
                        { titulo: 'Detalle', render: (b) => <span className="text-xs text-suave">{b.detalle ?? ''}</span> },
                    ]}
                />
            </section>
        </>
    );
}
