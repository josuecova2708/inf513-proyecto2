import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, PackageCheck, PackageSearch } from 'lucide-react';
import api from '../../api/cliente';
import { FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { Cargando, Encabezado, Insignia, Metrica, Tarjeta } from '../../componentes/ui';
import useListado from '../../hooks/useListado';
import { capitalizar, fechaHora, numero } from '../../utils/formato';

/** CU4: inventario por producto (disponible, reservado, producción reportada y futura) y kardex de movimientos. */
export default function Inventario() {
    const [disp, setDisp] = useState(null);
    const [q, setQ] = useState('');
    const movimientos = useListado('/inventario/movimientos', { tipo: '' });

    useEffect(() => {
        const t = setTimeout(() => api.get('/inventario/disponibilidad', { params: { q } }).then(({ data }) => setDisp(data)).catch(() => setDisp([])), 300);
        return () => clearTimeout(t);
    }, [q]);

    const bajos = disp?.filter((d) => d.bajo_minimo).length ?? 0;
    return (
        <>
            <Encabezado titulo="Inventario" descripcion="CU4 · Disponibilidad consolidada por producto y movimientos por lote" />
            {!disp ? <Cargando /> : (
                <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Metrica titulo="Productos activos" valor={disp.length} icono={Boxes} />
                    <Metrica titulo="Bajo stock mínimo" valor={bajos} icono={AlertTriangle} color={bajos ? 'peligro' : 'exito'} />
                    <Metrica titulo="Unidades disponibles" valor={numero(disp.reduce((s, d) => s + Number(d.stock_disponible), 0))} icono={PackageCheck} color="info" />
                    <Metrica titulo="Unidades reservadas" valor={numero(disp.reduce((s, d) => s + Number(d.stock_reservado), 0))} icono={PackageSearch} color="aviso" />
                </div>
            )}
            <Tarjeta titulo="Disponibilidad por producto" className="mb-6" acciones={
                <input type="search" className="campo w-56" placeholder="Filtrar producto" maxLength={80} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar producto" />
            }>
                {disp && (
                    <div className="overflow-x-auto">
                        <table className="tabla">
                            <thead><tr><th>Producto</th><th>Categoría</th><th className="text-right">Disponible</th><th className="text-right">Reservado</th><th className="text-right">Mínimo</th><th className="text-right">Prod. reportada</th><th className="text-right">Prod. futura</th><th className="text-center">Lotes</th><th>Estado</th></tr></thead>
                            <tbody>
                                {disp.map((d) => (
                                    <tr key={d.producto_id}>
                                        <td className="font-medium">{d.nombre}</td><td>{d.categoria}</td>
                                        <td className="text-right font-semibold">{numero(d.stock_disponible)} {d.unidad_medida}</td>
                                        <td className="text-right">{numero(d.stock_reservado)}</td><td className="text-right">{numero(d.stock_minimo)}</td>
                                        <td className="text-right">{numero(d.produccion_reportada)}</td><td className="text-right">{numero(d.produccion_futura)}</td>
                                        <td className="text-center">{d.lotes_disponibles}</td>
                                        <td>{d.bajo_minimo ? <Insignia color="peligro"><AlertTriangle className="size-3" /> Bajo mínimo</Insignia> : <Insignia color="exito">Normal</Insignia>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Tarjeta>
            <section className="tarjeta">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-borde p-3">
                    <h2 className="font-semibold">Movimientos de inventario (kárdex)</h2>
                    <FiltroSelect etiqueta="Tipo" valor={movimientos.filtros.tipo} onChange={(v) => movimientos.setFiltro('tipo', v)} opciones={['entrada', 'salida', 'devolucion', 'ajuste'].map((t) => ({ value: t, label: capitalizar(t) }))} />
                </div>
                <TablaDatos listado={movimientos} columnas={[
                    { titulo: 'Fecha', render: (m) => fechaHora(m.fecha) },
                    { titulo: 'Tipo', render: (m) => <Insignia color={{ entrada: 'exito', salida: 'info', devolucion: 'acento', ajuste: 'aviso' }[m.tipo]}>{capitalizar(m.tipo)}</Insignia> },
                    { titulo: 'Lote', render: (m) => <span className="font-mono">{m.lote}</span> },
                    { titulo: 'Producto', campo: 'producto' },
                    { titulo: 'Cantidad', className: 'text-right', render: (m) => {
                        // las salidas se guardan en positivo; los ajustes pueden ser negativos
                        const v = m.tipo === 'salida' ? -Math.abs(Number(m.cantidad)) : Number(m.cantidad);
                        return <span className={v < 0 ? 'text-peligro' : 'text-exito'}>{v > 0 ? '+' : '−'}{numero(Math.abs(v))} {m.unidad_medida}</span>;
                    } },
                    { titulo: 'Motivo', render: (m) => <span className="text-xs">{m.motivo}</span> },
                    { titulo: 'Usuario', render: (m) => m.usuario ?? 'Sistema' },
                ]} />
            </section>
        </>
    );
}
