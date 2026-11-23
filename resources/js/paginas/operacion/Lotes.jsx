import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Pencil, Route } from 'lucide-react';
import api from '../../api/cliente';
import { BarraFiltros, FiltroSelect, FormularioModal, TablaDatos } from '../../componentes/Crud';
import { Alerta, Encabezado, Estado } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { capitalizar, fecha, moneda, numero } from '../../utils/formato';
import { fechaOpcional, numeroEn, texto, z } from '../../validacion/esquemas';

const esquemaEditar = z.object({
    version: z.coerce.number().int(),
    estado: z.enum(['disponible', 'agotado', 'vencido']),
    fecha_vencimiento: fechaOpcional,
    costo_unitario: numeroEn('costo unitario', { min: 0, max: 100000, opcional: true }),
});

const esquemaMovimiento = z.object({
    version: z.coerce.number().int(),
    tipo: z.enum(['ajuste', 'devolucion']),
    cantidad: numeroEn('cantidad', { min: -1000000, max: 1000000 }).refine((v) => Number(v) !== 0, 'La cantidad no puede ser 0. Use negativo para restar.'),
    motivo: texto('motivo', { min: 5, max: 200 }),
}).refine((d) => d.tipo !== 'devolucion' || Number(d.cantidad) > 0, { path: ['cantidad'], message: 'Una devolución debe sumar stock (cantidad positiva).' });

/** CU3/CU4: lotes con trazabilidad de origen y control de concurrencia (versión). */
export default function Lotes() {
    const { puede, esStaff } = useAuth();
    const listado = useListado('/lotes', { q: '', estado: '' });
    const aviso = useAviso();
    const [editar, setEditar] = useState(null);
    const [mov, setMov] = useState(null);

    const guardar = async (d) => {
        const { data } = await api.put(`/lotes/${editar.id}`, d);
        setEditar(null);
        aviso.ok(data.message);
        listado.recargar();
    };
    const guardarMov = async (d) => {
        const { data } = await api.post('/inventario/movimientos', { ...d, lote_id: mov.id });
        setMov(null);
        aviso.ok(data.message);
        listado.recargar();
    };

    return (
        <>
            <Encabezado titulo="Lotes" descripcion="CU3 · Cada lote conserva su origen (productor, comunidad, producción) para la trazabilidad" />
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <BarraFiltros listado={listado} placeholder="Código, producto o productor">
                    <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={['disponible', 'agotado', 'vencido'].map((e) => ({ value: e, label: capitalizar(e) }))} />
                </BarraFiltros>
                <TablaDatos listado={listado} columnas={[
                    { titulo: 'Lote', render: (l) => <span className="font-mono font-semibold">{l.codigo}</span> },
                    { titulo: 'Producto / origen', render: (l) => <><p className="font-medium">{l.producto}</p><p className="text-xs text-suave">{l.emprendimiento} · {l.comunidad}</p></> },
                    { titulo: 'Inicial', className: 'text-right', render: (l) => numero(l.cantidad_inicial) },
                    { titulo: 'Disponible', className: 'text-right', render: (l) => <strong>{numero(l.stock_disponible)}</strong> },
                    { titulo: 'Reservado', className: 'text-right', render: (l) => numero(l.stock_reservado) },
                    { titulo: 'Costo u.', className: 'text-right', render: (l) => (l.costo_unitario ? moneda(l.costo_unitario) : '—') },
                    { titulo: 'Vence', render: (l) => <span className={l.dias_para_vencer !== null && l.dias_para_vencer <= 7 && l.estado === 'disponible' ? 'font-semibold text-peligro' : ''}>{fecha(l.fecha_vencimiento)}{l.dias_para_vencer !== null && l.estado === 'disponible' ? ` (${l.dias_para_vencer} d)` : ''}</span> },
                    { titulo: 'Estado', render: (l) => <Estado valor={l.estado} /> },
                    { titulo: 'Versión', className: 'text-center', render: (l) => <span className="font-mono text-xs" title="Control de concurrencia optimista">v{l.version}</span> },
                    { titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (l) => (
                        <>
                            <Link to={`/panel/trazabilidad?lote=${l.codigo}`} className="btn-fantasma btn-sm" aria-label={`Trazabilidad de ${l.codigo}`}><Route className="size-4" /></Link>
                            {esStaff && puede('inventario', 'crear') && <button type="button" className="btn-fantasma btn-sm" aria-label="Ajuste de inventario" title="Ajuste / devolución" onClick={() => setMov(l)}><ArrowLeftRight className="size-4" /></button>}
                            {esStaff && puede('lotes', 'editar') && <button type="button" className="btn-fantasma btn-sm" aria-label={`Editar ${l.codigo}`} onClick={() => setEditar(l)}><Pencil className="size-4" /></button>}
                        </>
                    ) },
                ]} />
            </section>
            <FormularioModal
                abierto={!!editar}
                titulo={`Editar lote ${editar?.codigo ?? ''} (versión ${editar?.version ?? ''})`}
                esquema={esquemaEditar}
                campos={[
                    { nombre: 'estado', etiqueta: 'Estado', como: 'select', opciones: ['disponible', 'agotado', 'vencido'].map((e) => ({ value: e, label: capitalizar(e) })) },
                    { nombre: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tipo: 'date' },
                    { nombre: 'costo_unitario', etiqueta: 'Costo unitario (Bs.)', tipo: 'number', step: '0.01' },
                ]}
                valores={editar ? { version: editar.version, estado: editar.estado, fecha_vencimiento: editar.fecha_vencimiento ?? '', costo_unitario: editar.costo_unitario ?? '' } : {}}
                onCerrar={() => setEditar(null)}
                onGuardar={guardar}
            />
            <FormularioModal
                abierto={!!mov}
                titulo={`Ajuste de inventario · lote ${mov?.codigo ?? ''}`}
                esquema={esquemaMovimiento}
                campos={[
                    { nombre: 'tipo', etiqueta: 'Tipo de movimiento', como: 'select', opciones: [{ value: 'ajuste', label: 'Ajuste (merma, conteo físico)' }, { value: 'devolucion', label: 'Devolución de cliente' }] },
                    { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'number', step: '0.01', requerido: true, ayuda: `Disponible actual: ${numero(mov?.stock_disponible)}. Negativo resta.` },
                    { nombre: 'motivo', etiqueta: 'Motivo', como: 'textarea', requerido: true },
                ]}
                valores={mov ? { version: mov.version, tipo: 'ajuste', cantidad: '', motivo: '' } : {}}
                onCerrar={() => setMov(null)}
                onGuardar={guardarMov}
                textoGuardar="Registrar movimiento"
            />
        </>
    );
}
