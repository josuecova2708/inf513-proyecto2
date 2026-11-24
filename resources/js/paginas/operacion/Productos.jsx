import { useEffect, useState } from 'react';
import { LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import api, { urlImagen } from '../../api/cliente';
import { BarraFiltros, FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { ImagenProducto } from '../../componentes/ProductoTarjeta';
import SelectorImagen from '../../componentes/SelectorImagen';
import { Alerta, Campo, Confirmar, Encabezado, Estado, Insignia, Modal } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useFormulario from '../../hooks/useFormulario';
import useListado, { useAviso } from '../../hooks/useListado';
import { capitalizar, moneda, numero } from '../../utils/formato';
import { numeroEn, seleccion, texto, textoOpcional, z } from '../../validacion/esquemas';

const MODALIDADES = [{ value: 'ambas', label: 'Inmediata y por encargo' }, { value: 'inmediata', label: 'Solo venta inmediata' }, { value: 'encargo', label: 'Solo por encargo' }];

const esquema = z.object({
    categoria_id: seleccion('una categoría'),
    nombre: texto('nombre', { min: 3, max: 120 }),
    descripcion: textoOpcional('descripción', 2000),
    presentacion: textoOpcional('presentación', 80),
    unidad_medida: texto('unidad de medida', { max: 20 }),
    precio_venta: numeroEn('precio de venta', { mayorQue: 0, max: 100000 }),
    modalidad_venta: z.enum(['inmediata', 'encargo', 'ambas']),
    stock_minimo: numeroEn('stock mínimo', { min: 0, max: 1000000 }),
    estado: z.enum(['activo', 'inactivo']),
});

function FormProducto({ producto, categorias, onCerrar, onGuardado }) {
    const f = useFormulario(esquema, producto);
    const [archivo, setArchivo] = useState(null);
    const [quitar, setQuitar] = useState(false);

    const enviar = f.enviar(async (d) => {
        const fd = new FormData();
        Object.entries(d).forEach(([k, v]) => fd.append(k, v ?? ''));
        if (archivo) fd.append('imagen', archivo);
        if (quitar) fd.append('quitar_imagen', '1');
        const { data } = producto.id ? await api.post(`/productos/${producto.id}`, fd) : await api.post('/productos', fd);
        onGuardado(data.message);
    });

    return (
        <Modal abierto titulo={producto.id ? `Editar: ${producto.nombre}` : 'Nuevo producto'} onCerrar={onCerrar} ancho="max-w-3xl" pie={
            <>
                <button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
                <button type="submit" form="form-producto" className="btn-primario" disabled={f.enviando}>{f.enviando && <LoaderCircle className="size-4 animate-spin" />} Guardar</button>
            </>
        }>
            <form id="form-producto" onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-3">
                {f.errorGeneral && <div className="sm:col-span-3"><Alerta tipo="error">{f.errorGeneral}</Alerta></div>}
                <SelectorImagen
                    actual={!quitar && producto.imagen ? urlImagen(producto.imagen) : null}
                    archivo={archivo}
                    onElegir={(a) => { setArchivo(a); setQuitar(false); }}
                    onQuitar={() => { setArchivo(null); setQuitar(true); }}
                    vacio={<ImagenProducto producto={{ ...producto, imagen: null, categoria: categorias.find((c) => String(c.id) === String(f.watch('categoria_id')))?.nombre }} />}
                />
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Campo etiqueta="Nombre" requerido {...f.campo('nombre')} /></div>
                    <Campo etiqueta="Categoría" como="select" requerido opciones={[{ value: '', label: 'Seleccione…' }, ...categorias.map((c) => ({ value: String(c.id), label: c.nombre }))]} {...f.campo('categoria_id')} />
                    <Campo etiqueta="Modalidad de venta" como="select" opciones={MODALIDADES} {...f.campo('modalidad_venta')} />
                    <Campo etiqueta="Presentación" placeholder="Bolsa 1 kg" {...f.campo('presentacion')} />
                    <Campo etiqueta="Unidad de medida" requerido placeholder="kg" {...f.campo('unidad_medida')} />
                    <Campo etiqueta="Precio de venta (Bs.)" tipo="number" step="0.01" min="0" requerido {...f.campo('precio_venta')} />
                    <Campo etiqueta="Stock mínimo" tipo="number" step="0.01" min="0" ayuda="Genera alerta si el stock baja de este valor" {...f.campo('stock_minimo')} />
                    <Campo etiqueta="Estado" como="select" opciones={[{ value: 'activo', label: 'Activo (visible en tienda)' }, { value: 'inactivo', label: 'Inactivo' }]} {...f.campo('estado')} />
                    <div className="sm:col-span-2"><Campo etiqueta="Descripción" como="textarea" {...f.campo('descripcion')} /></div>
                </div>
            </form>
        </Modal>
    );
}

/** CU4: catálogo unificado de productos con disponibilidad. */
export default function Productos() {
    const { puede } = useAuth();
    const listado = useListado('/productos', { q: '', categoria_id: '', estado: '' });
    const aviso = useAviso();
    const [categorias, setCategorias] = useState([]);
    const [edicion, setEdicion] = useState(null);
    const [borrar, setBorrar] = useState(null);

    useEffect(() => {
        api.get('/categorias').then(({ data }) => setCategorias(data)).catch(() => {});
    }, []);

    const eliminar = async () => {
        try {
            const { data } = await api.delete(`/productos/${borrar.id}`);
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
        setBorrar(null);
    };

    return (
        <>
            <Encabezado titulo="Productos" descripcion="CU4 · Catálogo unificado: precio, modalidad de venta, stock mínimo y disponibilidad">
                {puede('catalogo', 'crear') && <button type="button" className="btn-primario" onClick={() => setEdicion({ categoria_id: '', modalidad_venta: 'ambas', estado: 'activo', stock_minimo: '0', unidad_medida: 'kg', nombre: '', descripcion: '', presentacion: '', precio_venta: '' })}><Plus className="size-4" /> Nuevo producto</button>}
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <BarraFiltros listado={listado} placeholder="Nombre del producto">
                    <FiltroSelect etiqueta="Categoría" valor={listado.filtros.categoria_id} onChange={(v) => listado.setFiltro('categoria_id', v)} opciones={categorias.map((c) => ({ value: c.id, label: c.nombre }))} todos="Todas" />
                    <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
                </BarraFiltros>
                <TablaDatos listado={listado} columnas={[
                    { titulo: '', render: (p) => <div className="size-12 overflow-hidden rounded-tema"><ImagenProducto producto={p} className="h-12" /></div> },
                    { titulo: 'Producto', render: (p) => <><p className="font-medium">{p.nombre}</p><p className="text-xs text-suave">{p.categoria} · {p.presentacion}</p></> },
                    { titulo: 'Precio', className: 'text-right', render: (p) => moneda(p.precio_venta) },
                    { titulo: 'Modalidad', render: (p) => <Insignia color="info">{capitalizar(p.modalidad_venta)}</Insignia> },
                    { titulo: 'Disponible', className: 'text-right', render: (p) => <span className={Number(p.stock_disponible) < Number(p.stock_minimo) ? 'font-semibold text-peligro' : ''}>{numero(p.stock_disponible)} {p.unidad_medida}</span> },
                    { titulo: 'Reservado', className: 'text-right', render: (p) => numero(p.stock_reservado) },
                    { titulo: 'Mínimo', className: 'text-right', render: (p) => numero(p.stock_minimo) },
                    { titulo: 'Estado', render: (p) => <Estado valor={p.estado} /> },
                    { titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (p) => (
                        <>
                            {puede('catalogo', 'editar') && <button type="button" className="btn-fantasma btn-sm" aria-label={`Editar ${p.nombre}`} onClick={() => setEdicion({ ...p, categoria_id: String(p.categoria_id), descripcion: p.descripcion ?? '', presentacion: p.presentacion ?? '', precio_venta: String(p.precio_venta), stock_minimo: String(p.stock_minimo) })}><Pencil className="size-4" /></button>}
                            {puede('catalogo', 'eliminar') && <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label={`Eliminar ${p.nombre}`} onClick={() => setBorrar(p)}><Trash2 className="size-4" /></button>}
                        </>
                    ) },
                ]} />
            </section>
            {edicion && <FormProducto producto={edicion} categorias={categorias} onCerrar={() => setEdicion(null)} onGuardado={(m) => { setEdicion(null); aviso.ok(m); listado.recargar(); }} />}
            <Confirmar abierto={!!borrar} titulo="Eliminar producto" mensaje={`¿Eliminar “${borrar?.nombre}”? Si tiene ventas o producción, solo se desactivará.`} onConfirmar={eliminar} onCerrar={() => setBorrar(null)} textoConfirmar="Eliminar" />
        </>
    );
}
