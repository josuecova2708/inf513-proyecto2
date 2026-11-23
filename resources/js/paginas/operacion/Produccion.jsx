import { useEffect, useState } from 'react';
import { Check, PackagePlus, Plus, Trash2, X } from 'lucide-react';
import api from '../../api/cliente';
import { BarraFiltros, FiltroSelect, FormularioModal, TablaDatos } from '../../componentes/Crud';
import { Alerta, Confirmar, Encabezado, Estado, Insignia, Modal } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { capitalizar, fecha, hoyISO, numero } from '../../utils/formato';
import { fechaOpcional, numeroEn, seleccion, texto, textoOpcional, z } from '../../validacion/esquemas';

const esquemaProduccion = z.object({
    emprendimiento_id: seleccion('el productor'),
    producto_id: seleccion('un producto'),
    tipo: z.enum(['disponible', 'futura']),
    cantidad: numeroEn('cantidad', { mayorQue: 0, max: 10000000 }),
    unidad_medida: texto('unidad de medida', { max: 20 }),
    fecha_produccion: fechaOpcional,
    fecha_disponible: fechaOpcional,
    precio_propuesto: numeroEn('precio propuesto', { min: 0, max: 100000, opcional: true }),
    procedencia: textoOpcional('procedencia', 200),
    observacion: textoOpcional('observación', 1000),
}).refine((d) => !d.fecha_produccion || d.fecha_produccion <= hoyISO(), { path: ['fecha_produccion'], message: 'La fecha de producción no puede ser futura.' })
    .refine((d) => d.tipo !== 'futura' || !!d.fecha_disponible, { path: ['fecha_disponible'], message: 'Para producción futura indique la fecha en que estará disponible.' });

const esquemaLote = z.object({
    codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{2,29}$/, 'Use de 3 a 30 caracteres: mayúsculas, números o guiones (ej. ARR-002).'),
    cantidad: numeroEn('cantidad', { mayorQue: 0, max: 10000000 }),
    fecha_vencimiento: fechaOpcional.refine((v) => !v || v >= hoyISO(), 'La fecha de vencimiento no puede ser pasada.'),
    costo_unitario: numeroEn('costo unitario', { min: 0, max: 100000, opcional: true }),
});

function Validar({ produccion, onCerrar, onListo }) {
    const [obs, setObs] = useState('');
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);
    const decidir = async (estado) => {
        if (estado === 'rechazada' && obs.trim().length < 3) return setError('Indique el motivo del rechazo.');
        setEnviando(true);
        try {
            const { data } = await api.put(`/producciones/${produccion.id}/validar`, { estado, observacion: obs });
            onListo(data.message);
        } catch (e) {
            setError(e.response?.data?.message ?? 'No se pudo validar.');
            setEnviando(false);
        }
    };
    return (
        <Modal abierto titulo={`Validar producción #${produccion.id}`} onCerrar={onCerrar} pie={
            <>
                <button type="button" className="btn-peligro" disabled={enviando} onClick={() => decidir('rechazada')}><X className="size-4" /> Rechazar</button>
                <button type="button" className="btn-primario" disabled={enviando} onClick={() => decidir('validada')}><Check className="size-4" /> Validar</button>
            </>
        }>
            <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-suave">Productor</dt><dd>{produccion.emprendimiento}</dd>
                <dt className="text-suave">Producto</dt><dd>{produccion.producto}</dd>
                <dt className="text-suave">Cantidad</dt><dd>{numero(produccion.cantidad)} {produccion.unidad_medida}</dd>
                <dt className="text-suave">Tipo</dt><dd>{capitalizar(produccion.tipo)}</dd>
                <dt className="text-suave">Procedencia</dt><dd>{produccion.procedencia ?? '—'}</dd>
            </dl>
            <Alerta tipo="error">{error}</Alerta>
            <label htmlFor="obs-val" className="etiqueta mt-3">Observación (obligatoria si rechaza)</label>
            <textarea id="obs-val" className="campo" rows={3} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Modal>
    );
}

/** CU3: producción agrícola reportada por los productores y validada por FEDER. */
export default function Produccion() {
    const { puede, esStaff, usuario } = useAuth();
    const listado = useListado('/producciones', { q: '', estado: '', tipo: '' });
    const aviso = useAviso();
    const [emprendimientos, setEmprendimientos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [nueva, setNueva] = useState(null);
    const [validar, setValidar] = useState(null);
    const [lote, setLote] = useState(null);
    const [borrar, setBorrar] = useState(null);

    useEffect(() => {
        api.get('/emprendimientos', { params: { todos: 1 } }).then(({ data }) => setEmprendimientos(data)).catch(() => {});
        api.get('/productos', { params: { todos: 1, estado: 'activo' } }).then(({ data }) => setProductos(data)).catch(() => {});
    }, []);

    const camposProduccion = [
        { nombre: 'emprendimiento_id', etiqueta: 'Productor', como: 'select', requerido: true, oculto: !esStaff, opciones: [{ value: '', label: 'Seleccione…' }, ...emprendimientos.map((e) => ({ value: String(e.id), label: e.nombre }))] },
        { nombre: 'producto_id', etiqueta: 'Producto', como: 'select', requerido: true, opciones: [{ value: '', label: 'Seleccione…' }, ...productos.map((p) => ({ value: String(p.id), label: p.nombre }))] },
        { nombre: 'tipo', etiqueta: 'Tipo', como: 'select', opciones: [{ value: 'disponible', label: 'Disponible (ya cosechada)' }, { value: 'futura', label: 'Futura (por cosechar)' }] },
        { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'number', step: '0.01', min: 0, requerido: true },
        { nombre: 'unidad_medida', etiqueta: 'Unidad de medida', requerido: true, ayuda: 'kg, frasco, bolsa, unidad…' },
        { nombre: 'precio_propuesto', etiqueta: 'Precio propuesto (Bs.)', tipo: 'number', step: '0.01', min: 0 },
        { nombre: 'fecha_produccion', etiqueta: 'Fecha de producción', tipo: 'date', max: hoyISO() },
        { nombre: 'fecha_disponible', etiqueta: 'Fecha disponible', tipo: 'date' },
        { nombre: 'procedencia', etiqueta: 'Procedencia (parcela, finca…)', ancho: 'completo' },
        { nombre: 'observacion', etiqueta: 'Observación', como: 'textarea' },
    ];

    const guardar = async (d) => {
        const { data } = await api.post('/producciones', d);
        setNueva(null);
        aviso.ok(data.message);
        listado.recargar();
    };
    const guardarLote = async (d) => {
        const { data } = await api.post('/lotes', { ...d, produccion_id: lote.id });
        setLote(null);
        aviso.ok(data.message);
        listado.recargar();
    };
    const eliminar = async () => {
        try {
            const { data } = await api.delete(`/producciones/${borrar.id}`);
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
        setBorrar(null);
    };

    const propio = emprendimientos[0]?.id;
    return (
        <>
            <Encabezado titulo="Producción agrícola" descripcion="CU3 · El productor reporta su producción; FEDER la valida y la ingresa como lotes">
                {puede('produccion', 'crear') && (
                    <button type="button" className="btn-primario" onClick={() => setNueva({ emprendimiento_id: esStaff ? '' : String(propio ?? ''), producto_id: '', tipo: 'disponible', unidad_medida: 'kg', fecha_produccion: hoyISO() })}>
                        <Plus className="size-4" /> Reportar producción
                    </button>
                )}
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            {usuario.rol === 'Productor' && !propio && <div className="mb-4"><Alerta tipo="aviso">Tu cuenta no está vinculada a un emprendimiento: no puedes reportar producción.</Alerta></div>}
            <section className="tarjeta">
                <BarraFiltros listado={listado} placeholder="Producto o productor">
                    <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={['reportada', 'validada', 'rechazada'].map((e) => ({ value: e, label: capitalizar(e) }))} />
                    <FiltroSelect etiqueta="Tipo" valor={listado.filtros.tipo} onChange={(v) => listado.setFiltro('tipo', v)} opciones={[{ value: 'disponible', label: 'Disponible' }, { value: 'futura', label: 'Futura' }]} />
                </BarraFiltros>
                <TablaDatos listado={listado} columnas={[
                    { titulo: '#', campo: 'id' },
                    { titulo: 'Producto', render: (p) => <><p className="font-medium">{p.producto}</p><p className="text-xs text-suave">{p.emprendimiento} · {p.comunidad}</p></> },
                    { titulo: 'Tipo', render: (p) => <Insignia color={p.tipo === 'futura' ? 'info' : 'primario'}>{capitalizar(p.tipo)}</Insignia> },
                    { titulo: 'Cantidad', className: 'text-right', render: (p) => `${numero(p.cantidad)} ${p.unidad_medida}` },
                    { titulo: 'En lotes', className: 'text-right', render: (p) => `${numero(p.cantidad_en_lotes)} (${p.lotes})` },
                    { titulo: 'Disponible', render: (p) => fecha(p.fecha_disponible) },
                    { titulo: 'Estado', render: (p) => <><Estado valor={p.estado} />{p.validador && <p className="text-xs text-suave">por {p.validador}</p>}</> },
                    { titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (p) => (
                        <>
                            {esStaff && p.estado === 'reportada' && puede('produccion', 'editar') && <button type="button" className="btn-secundario btn-sm" onClick={() => setValidar(p)}><Check className="size-4" /> Validar</button>}
                            {esStaff && p.estado === 'validada' && Number(p.cantidad_en_lotes) < Number(p.cantidad) && puede('lotes', 'crear') && (
                                <button type="button" className="btn-secundario btn-sm" onClick={() => setLote(p)}><PackagePlus className="size-4" /> Ingresar lote</button>
                            )}
                            {p.estado !== 'validada' && Number(p.lotes) === 0 && puede('produccion', 'eliminar') && <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label="Eliminar" onClick={() => setBorrar(p)}><Trash2 className="size-4" /></button>}
                        </>
                    ) },
                ]} />
            </section>
            <FormularioModal abierto={!!nueva} titulo="Reportar producción" esquema={esquemaProduccion} campos={camposProduccion} valores={nueva ?? {}} onCerrar={() => setNueva(null)} onGuardar={guardar} textoGuardar="Reportar" />
            {validar && <Validar produccion={validar} onCerrar={() => setValidar(null)} onListo={(m) => { setValidar(null); aviso.ok(m); listado.recargar(); }} />}
            <FormularioModal
                abierto={!!lote}
                titulo={`Ingresar lote · ${lote?.producto ?? ''}`}
                esquema={esquemaLote}
                campos={[
                    { nombre: 'codigo', etiqueta: 'Código de lote', requerido: true, ayuda: 'Ej. ARR-002' },
                    { nombre: 'cantidad', etiqueta: `Cantidad (${lote?.unidad_medida ?? ''})`, tipo: 'number', step: '0.01', requerido: true, ayuda: lote ? `Pendiente de ingresar: ${numero(lote.cantidad - lote.cantidad_en_lotes)}` : '' },
                    { nombre: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tipo: 'date', min: hoyISO() },
                    { nombre: 'costo_unitario', etiqueta: 'Costo unitario (Bs.)', tipo: 'number', step: '0.01', ayuda: 'Precio pagado al productor' },
                ]}
                valores={lote ? { codigo: '', cantidad: String(lote.cantidad - lote.cantidad_en_lotes), costo_unitario: lote.precio_propuesto ?? '', fecha_vencimiento: '' } : {}}
                onCerrar={() => setLote(null)}
                onGuardar={guardarLote}
                textoGuardar="Ingresar al inventario"
            />
            <Confirmar abierto={!!borrar} titulo="Eliminar producción" mensaje={`¿Eliminar el reporte de producción #${borrar?.id}?`} onConfirmar={eliminar} onCerrar={() => setBorrar(null)} textoConfirmar="Eliminar" />
        </>
    );
}
