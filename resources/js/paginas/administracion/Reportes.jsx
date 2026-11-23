import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import api, { mensajeError } from '../../api/cliente';
import { GraficoBarras, GraficoLineas } from '../../componentes/Graficos';
import { Alerta, Cargando, Encabezado, Tarjeta, Vacio } from '../../componentes/ui';
import { capitalizar, fecha, fechaHora, hoyISO, moneda, numero } from '../../utils/formato';

const TIPOS = [
    ['ventas', 'Ventas por producto'],
    ['ingresos', 'Ingresos por día'],
    ['pedidos', 'Pedidos por estado'],
    ['metodos', 'Pagos por método'],
    ['inventario', 'Inventario'],
    ['encargos', 'Encargos'],
    ['produccion', 'Producción'],
];

const esMonto = (col) => col === 'monto';
const formatear = (col, v) => {
    if (v === null || v === undefined) return '—';
    if (esMonto(col)) return moneda(v);
    if (col === 'dia') return fecha(v);
    if (col === 'estado') return capitalizar(v);
    if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))) return numero(v);
    return v;
};

/** CU8: reportes y estadísticas con tabla, gráfico, exportación CSV e impresión. */
export default function Reportes() {
    const [tipo, setTipo] = useState('ventas');
    const [rango, setRango] = useState({ desde: hoyISO(-29), hasta: hoyISO() });
    const [r, setR] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (rango.hasta < rango.desde) return setError('La fecha "hasta" no puede ser anterior a la fecha "desde".');
        setError('');
        setR(null);
        api.get(`/reportes/${tipo}`, { params: rango }).then(({ data }) => setR(data)).catch((e) => setError(mensajeError(e)));
    }, [tipo, rango]);

    const exportar = () => {
        const cols = Object.keys(r.columnas);
        const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
        const csv = [cols.map((c) => esc(r.columnas[c])).join(';'), ...r.filas.map((f) => cols.map((c) => esc(f[c])).join(';'))].join('\r\n');
        const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: `reporte_${tipo}_${rango.desde}_${rango.hasta}.csv` });
        a.click();
        URL.revokeObjectURL(url);
    };

    const g = r?.grafico;
    const formatoY = g && esMonto(g.y) ? moneda : undefined;
    return (
        <>
            <Encabezado titulo="Reportes y estadísticas" descripcion="CU8 · Reportes del negocio por periodo">
                {r?.filas?.length > 0 && (
                    <div className="flex gap-2 print:hidden">
                        <button type="button" className="btn-secundario" onClick={exportar}><Download className="size-4" /> Exportar CSV</button>
                        <button type="button" className="btn-secundario" onClick={() => window.print()}><Printer className="size-4" /> Imprimir / PDF</button>
                    </div>
                )}
            </Encabezado>
            <div className="tarjeta mb-6 flex flex-wrap items-end gap-3 p-3 print:hidden">
                <div className="flex flex-wrap gap-1" role="tablist" aria-label="Tipo de reporte">
                    {TIPOS.map(([id, nombre]) => (
                        <button key={id} type="button" role="tab" aria-selected={tipo === id} onClick={() => setTipo(id)} className={`btn btn-sm border ${tipo === id ? 'border-primario bg-primario text-sobre-primario' : 'border-borde bg-superficie'}`}>{nombre}</button>
                    ))}
                </div>
                {tipo !== 'inventario' && (
                    <div className="ml-auto flex gap-2">
                        <div><label htmlFor="r-desde" className="etiqueta text-xs">Desde</label><input id="r-desde" type="date" className="campo" value={rango.desde} max={rango.hasta} onChange={(e) => setRango({ ...rango, desde: e.target.value })} /></div>
                        <div><label htmlFor="r-hasta" className="etiqueta text-xs">Hasta</label><input id="r-hasta" type="date" className="campo" value={rango.hasta} min={rango.desde} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} /></div>
                    </div>
                )}
            </div>
            <Alerta tipo="error">{error}</Alerta>
            {!r && !error ? <Cargando /> : r && (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold">{r.titulo}</h2>
                        <p className="text-sm text-suave">{tipo === 'inventario' ? 'Situación actual' : `Del ${fecha(r.periodo.desde)} al ${fecha(r.periodo.hasta)}`} · Generado {fechaHora(r.generado)}</p>
                    </div>
                    {!r.filas.length ? <Vacio texto="No hay datos para el periodo seleccionado." /> : (
                        <>
                            <Tarjeta titulo="Gráfico">
                                {g.tipo === 'lineas'
                                    ? <GraficoLineas datos={r.filas} x={g.x} series={[{ clave: g.y, nombre: r.columnas[g.y], color: 'primario' }]} formato={formatoY} fechaX />
                                    : <GraficoBarras datos={r.filas} x={g.x} y={g.y} nombre={r.columnas[g.y]} formato={formatoY} horizontal />}
                            </Tarjeta>
                            <Tarjeta titulo={`Detalle (${r.filas.length} filas)`}>
                                <div className="overflow-x-auto">
                                    <table className="tabla">
                                        <thead><tr>{Object.entries(r.columnas).map(([c, t]) => <th key={c} className={typeof r.filas[0][c] === 'string' && !/^-?\d/.test(r.filas[0][c]) ? '' : 'text-right'}>{t}</th>)}</tr></thead>
                                        <tbody>{r.filas.map((f, i) => (
                                            <tr key={i}>{Object.keys(r.columnas).map((c) => <td key={c} className={typeof f[c] === 'string' && !/^-?\d/.test(f[c]) ? '' : 'text-right'}>{formatear(c, f[c])}</td>)}</tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </Tarjeta>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
