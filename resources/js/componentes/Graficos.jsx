import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Vacio } from './ui';
import { capitalizar, numero } from '../utils/formato';

/*
 * Gráficos del panel analítico. Reglas: un solo eje Y, marcas delgadas (líneas de 2px, barras con
 * extremos redondeados de 4px), cuadrícula discreta, tooltip al pasar el mouse, leyenda cuando hay
 * 2 o más series, texto con los colores de texto del tema (nunca con el color de la serie).
 * Colores: una sola serie usa el primario del tema; varias series usan --serie-1..6 en orden fijo.
 */

export const COLORES = {
    primario: 'var(--c-primario)',
    exito: 'var(--estado-bueno)',
    peligro: 'var(--estado-critico)',
    s1: 'var(--serie-1)', s2: 'var(--serie-2)', s3: 'var(--serie-3)', s4: 'var(--serie-4)', s5: 'var(--serie-5)', s6: 'var(--serie-6)',
};

const ejes = { stroke: 'var(--c-borde)', tick: { fill: 'var(--c-suave)', fontSize: 12 }, tickLine: false };
const fechaCorta = (v) => {
    const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
};

function Ayuda({ active, payload, label, formato, fechaX }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="tarjeta px-3 py-2 text-sm shadow-lg">
            <p className="mb-1 font-semibold">{fechaX ? fechaCorta(label) : capitalizar(String(label))}</p>
            {payload.map((p) => (
                <p key={p.dataKey} className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
                    <span className="text-suave">{p.name}:</span>
                    <span className="font-semibold">{formato ? formato(p.value) : numero(p.value)}</span>
                </p>
            ))}
        </div>
    );
}

const normalizar = (datos, claves) => (datos ?? []).map((d) => {
    const n = { ...d };
    claves.forEach((k) => { n[k] = Number(d[k] ?? 0); });
    return n;
});

/** Barras de una serie (magnitud por categoría). horizontal=true para etiquetas largas. */
export function GraficoBarras({ datos, x, y, nombre = 'Valor', formato, horizontal = false, alto = 260, color = COLORES.primario }) {
    if (!datos?.length) return <Vacio texto="Sin datos en el periodo." />;
    const filas = normalizar(datos, [y]).map((d) => ({ ...d, [x]: capitalizar(String(d[x])) }));
    return (
        <div style={{ height: horizontal ? Math.max(alto, filas.length * 34 + 30) : alto }} role="img" aria-label={`Gráfico de barras: ${nombre}`}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filas} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, left: horizontal ? 8 : 0, bottom: 4 }} barCategoryGap={horizontal ? 6 : '20%'}>
                    <CartesianGrid stroke="var(--c-borde)" strokeOpacity={0.5} vertical={horizontal} horizontal={!horizontal} />
                    {horizontal ? (
                        <>
                            <XAxis type="number" {...ejes} tickFormatter={(v) => numero(v)} />
                            <YAxis type="category" dataKey={x} {...ejes} width={130} interval={0} />
                        </>
                    ) : (
                        <>
                            <XAxis dataKey={x} {...ejes} interval={0} angle={filas.length > 5 ? -25 : 0} textAnchor={filas.length > 5 ? 'end' : 'middle'} height={filas.length > 5 ? 60 : 30} />
                            <YAxis {...ejes} width={56} tickFormatter={(v) => numero(v)} />
                        </>
                    )}
                    <Tooltip content={<Ayuda formato={formato} />} cursor={{ fill: 'var(--c-superficie-2)' }} />
                    <Bar isAnimationActive={false} dataKey={y} name={nombre} fill={color} stroke="var(--c-superficie)" strokeWidth={2} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Completa con 0 los días sin registros para que la serie temporal sea continua. */
function completarDias(filas, x, claves) {
    if (filas.length < 2) return filas;
    const porDia = new Map(filas.map((f) => [String(f[x]).slice(0, 10), f]));
    const dias = [...porDia.keys()].sort();
    const salida = [];
    for (let d = new Date(`${dias[0]}T00:00:00`), fin = new Date(`${dias.at(-1)}T00:00:00`); d <= fin; d.setDate(d.getDate() + 1)) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        salida.push(porDia.get(k) ?? { [x]: k, ...Object.fromEntries(claves.map((c) => [c, 0])) });
    }
    return salida;
}

/** Líneas (cambio en el tiempo). series: [{ clave, nombre, color: 'primario'|'exito'|'peligro'|'s1'... }] */
export function GraficoLineas({ datos, x, series, formato, fechaX = false, alto = 260 }) {
    if (!datos?.length) return <Vacio texto="Sin datos en el periodo." />;
    const claves = series.map((s) => s.clave);
    const filas = fechaX ? completarDias(normalizar(datos, claves), x, claves) : normalizar(datos, claves);
    return (
        <div style={{ height: alto }} role="img" aria-label={`Gráfico de líneas: ${series.map((s) => s.nombre).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filas} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke="var(--c-borde)" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey={x} {...ejes} tickFormatter={fechaX ? fechaCorta : undefined} minTickGap={16} />
                    <YAxis {...ejes} width={56} tickFormatter={(v) => numero(v)} allowDecimals={false} />
                    <Tooltip content={<Ayuda formato={formato} fechaX={fechaX} />} cursor={{ stroke: 'var(--c-suave)', strokeDasharray: '3 3' }} />
                    {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'var(--c-texto)' }} iconType="plainline" />}
                    {series.map((s, i) => (
                        <Line key={s.clave} type="linear" isAnimationActive={false} dataKey={s.clave} name={s.nombre} stroke={COLORES[s.color] ?? COLORES[`s${i + 1}`]}
                            strokeWidth={2} dot={filas.length <= 15 ? { r: 3, strokeWidth: 2, fill: 'var(--c-superficie)' } : false}
                            activeDot={{ r: 5, stroke: 'var(--c-superficie)', strokeWidth: 2 }} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
