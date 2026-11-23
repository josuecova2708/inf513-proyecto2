import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/cliente';
import { BarraFiltros, FiltroSelect, FormularioModal, TablaDatos } from '../../componentes/Crud';
import { Alerta, Cargando, Confirmar, Encabezado, Estado, Insignia, Modal } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { capitalizar, fecha, moneda, numero } from '../../utils/formato';
import { numeroEn, seleccion, telefono, texto, textoOpcional, z } from '../../validacion/esquemas';

const RUBROS = ['agricola', 'artesania', 'alimentos_procesados', 'textil', 'otro'];

const esquema = z.object({
    comunidad_id: seleccion('una comunidad'),
    usuario_id: z.union([z.literal(''), z.coerce.number().int().positive()]).optional(),
    nombre: texto('nombre', { min: 3, max: 120 }),
    rubro: z.enum(RUBROS, { error: 'Seleccione el rubro.' }),
    responsable: texto('responsable', { min: 3, max: 120 }).regex(/^[\p{L}\s'.-]+$/u, 'El responsable solo puede contener letras y espacios.'),
    ci_nit: z.string().trim().regex(/^\d{5,15}(-?[A-Za-z0-9]{1,3})?$/, 'El CI/NIT debe tener entre 5 y 15 dígitos.').optional().or(z.literal('')),
    telefono,
    direccion: textoOpcional('dirección', 200),
    latitud: numeroEn('latitud', { min: -90, max: 90, opcional: true }),
    longitud: numeroEn('longitud', { min: -180, max: 180, opcional: true }),
    estado: z.enum(['activo', 'inactivo']),
});

function Detalle({ id, onCerrar }) {
    const { puede } = useAuth();
    const [d, setD] = useState(null);
    const [productos, setProductos] = useState([]);
    const [oferta, setOferta] = useState({ producto_id: '', precio_referencia: '', temporada: '' });
    const [msg, setMsg] = useState({ ok: '', error: '' });

    const cargar = () => api.get(`/emprendimientos/${id}`).then(({ data }) => setD(data));
    useEffect(() => {
        cargar();
        if (puede('ofertas', 'crear')) api.get('/productos', { params: { todos: 1, estado: 'activo' } }).then(({ data }) => setProductos(data)).catch(() => {});
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const agregar = async (e) => {
        e.preventDefault();
        if (!oferta.producto_id) return setMsg({ ok: '', error: 'Seleccione un producto.' });
        if (oferta.precio_referencia !== '' && (Number(oferta.precio_referencia) < 0 || Number.isNaN(Number(oferta.precio_referencia)))) return setMsg({ ok: '', error: 'El precio de referencia debe ser un número mayor o igual a 0.' });
        try {
            const { data } = await api.post(`/emprendimientos/${id}/ofertas`, oferta);
            setMsg({ ok: data.message, error: '' });
            setOferta({ producto_id: '', precio_referencia: '', temporada: '' });
            cargar();
        } catch (ex) {
            setMsg({ ok: '', error: ex.response?.data?.message ?? 'No se pudo guardar.' });
        }
    };
    const quitar = async (pid) => {
        await api.delete(`/emprendimientos/${id}/ofertas/${pid}`).catch(() => {});
        cargar();
    };

    return (
        <Modal abierto titulo={d ? d.emprendimiento.nombre : 'Productor'} onCerrar={onCerrar} ancho="max-w-3xl">
            {!d ? <Cargando /> : (
                <div className="space-y-5">
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-suave">Comunidad</dt><dd>{d.emprendimiento.comunidad?.nombre} · {d.emprendimiento.comunidad?.municipio}</dd></div>
                        <div><dt className="text-suave">Responsable</dt><dd>{d.emprendimiento.responsable}</dd></div>
                        <div><dt className="text-suave">Rubro</dt><dd>{capitalizar(d.emprendimiento.rubro)}</dd></div>
                        <div><dt className="text-suave">Cuenta vinculada</dt><dd>{d.emprendimiento.usuario ? `${d.emprendimiento.usuario.nombre} ${d.emprendimiento.usuario.apellido} (${d.emprendimiento.usuario.email})` : 'Sin cuenta'}</dd></div>
                        {d.emprendimiento.latitud && <div className="sm:col-span-2"><dt className="text-suave">Ubicación</dt><dd><a className="text-primario underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${d.emprendimiento.latitud}&mlon=${d.emprendimiento.longitud}#map=13/${d.emprendimiento.latitud}/${d.emprendimiento.longitud}`}>{d.emprendimiento.latitud}, {d.emprendimiento.longitud} (ver mapa)</a></dd></div>}
                    </dl>
                    <div>
                        <h3 className="mb-2 font-semibold">Productos que ofrece</h3>
                        <Alerta tipo="exito">{msg.ok}</Alerta>
                        <Alerta tipo="error">{msg.error}</Alerta>
                        <table className="tabla mt-2">
                            <thead><tr><th>Producto</th><th className="text-right">Precio ref. productor</th><th className="text-right">Precio venta</th><th>Temporada</th><th /></tr></thead>
                            <tbody>
                                {d.ofertas.map((o) => (
                                    <tr key={o.producto_id}>
                                        <td>{o.nombre}</td><td className="text-right">{o.precio_referencia ? moneda(o.precio_referencia) : '—'}</td>
                                        <td className="text-right">{moneda(o.precio_venta)}</td><td>{o.temporada ?? '—'}</td>
                                        <td className="text-right">{puede('ofertas', 'eliminar') && <button type="button" className="btn-fantasma btn-sm text-peligro" onClick={() => quitar(o.producto_id)} aria-label={`Quitar ${o.nombre}`}><Trash2 className="size-4" /></button>}</td>
                                    </tr>
                                ))}
                                {!d.ofertas.length && <tr><td colSpan={5} className="text-center text-suave">Sin productos registrados.</td></tr>}
                            </tbody>
                        </table>
                        {puede('ofertas', 'crear') && (
                            <form onSubmit={agregar} className="mt-3 grid gap-2 sm:grid-cols-4" noValidate>
                                <select className="campo sm:col-span-2" value={oferta.producto_id} onChange={(e) => setOferta({ ...oferta, producto_id: e.target.value })} aria-label="Producto">
                                    <option value="">Agregar producto…</option>
                                    {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                                <input className="campo" type="number" min="0" step="0.01" placeholder="Precio ref." value={oferta.precio_referencia} onChange={(e) => setOferta({ ...oferta, precio_referencia: e.target.value })} aria-label="Precio de referencia" />
                                <input className="campo" maxLength={50} placeholder="Temporada" value={oferta.temporada} onChange={(e) => setOferta({ ...oferta, temporada: e.target.value })} aria-label="Temporada" />
                                <button type="submit" className="btn-primario sm:col-span-4"><Plus className="size-4" /> Agregar oferta</button>
                            </form>
                        )}
                    </div>
                    <div>
                        <h3 className="mb-2 font-semibold">Producción reciente</h3>
                        <table className="tabla">
                            <thead><tr><th>#</th><th>Producto</th><th>Tipo</th><th className="text-right">Cantidad</th><th>Estado</th><th>Registro</th></tr></thead>
                            <tbody>
                                {d.produccion.map((p) => <tr key={p.id}><td>{p.id}</td><td>{p.producto}</td><td>{capitalizar(p.tipo)}</td><td className="text-right">{numero(p.cantidad)} {p.unidad_medida}</td><td><Estado valor={p.estado} /></td><td>{fecha(p.fecha_registro)}</td></tr>)}
                                {!d.produccion.length && <tr><td colSpan={6} className="text-center text-suave">Sin producción registrada.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    );
}

/** CU2: productores / emprendimientos. */
export default function Emprendimientos() {
    const { puede, esStaff } = useAuth();
    const [params] = useSearchParams();
    const listado = useListado('/emprendimientos', { q: params.get('q') ?? '', comunidad_id: '', rubro: '', estado: '' });
    const aviso = useAviso();
    const [comunidades, setComunidades] = useState([]);
    const [productores, setProductores] = useState([]);
    const [edicion, setEdicion] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [borrar, setBorrar] = useState(null);

    useEffect(() => {
        api.get('/comunidades', { params: { todos: 1 } }).then(({ data }) => setComunidades(data)).catch(() => {});
        if (puede('usuarios')) {
            api.get('/roles').then(({ data }) => {
                const rol = data.find((r) => r.nombre === 'Productor');
                if (rol) api.get('/usuarios', { params: { rol_id: rol.id, por_pagina: 100 } }).then(({ data: u }) => setProductores(u.data));
            }).catch(() => {});
        }
    }, [puede]);

    const campos = [
        { nombre: 'nombre', etiqueta: 'Nombre del emprendimiento', requerido: true, ancho: 'completo' },
        { nombre: 'comunidad_id', etiqueta: 'Comunidad', como: 'select', requerido: true, ayuda: esStaff ? undefined : 'Solo FEDER puede cambiar la comunidad.', opciones: [{ value: '', label: 'Seleccione…' }, ...comunidades.map((c) => ({ value: String(c.id), label: `${c.nombre} (${c.municipio})` }))] },
        { nombre: 'rubro', etiqueta: 'Rubro', como: 'select', requerido: true, opciones: RUBROS.map((r) => ({ value: r, label: capitalizar(r) })) },
        { nombre: 'responsable', etiqueta: 'Responsable', requerido: true },
        { nombre: 'ci_nit', etiqueta: 'CI / NIT' },
        { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' },
        { nombre: 'usuario_id', etiqueta: 'Cuenta de productor vinculada', como: 'select', oculto: !esStaff, opciones: [{ value: '', label: 'Sin cuenta' }, ...productores.map((u) => ({ value: String(u.id), label: `${u.nombre} ${u.apellido} (${u.email})` }))] },
        { nombre: 'direccion', etiqueta: 'Dirección', ancho: 'completo' },
        { nombre: 'latitud', etiqueta: 'Latitud', tipo: 'number', step: 'any', ayuda: 'Ej. -17.783' },
        { nombre: 'longitud', etiqueta: 'Longitud', tipo: 'number', step: 'any', ayuda: 'Ej. -63.182' },
        { nombre: 'estado', etiqueta: 'Estado', como: 'select', oculto: !esStaff, opciones: [{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }] },
    ];

    const guardar = async (d) => {
        const { data } = edicion.id ? await api.put(`/emprendimientos/${edicion.id}`, d) : await api.post('/emprendimientos', d);
        setEdicion(null);
        aviso.ok(data.message);
        listado.recargar();
    };
    const eliminar = async () => {
        try {
            const { data } = await api.delete(`/emprendimientos/${borrar.id}`);
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
        setBorrar(null);
    };
    const editar = (e) => setEdicion({
        ...e, comunidad_id: String(e.comunidad_id), usuario_id: e.usuario_id ? String(e.usuario_id) : '', ci_nit: e.ci_nit ?? '',
        telefono: e.telefono ?? '', direccion: e.direccion ?? '', latitud: e.latitud ?? '', longitud: e.longitud ?? '',
    });

    return (
        <>
            <Encabezado titulo={esStaff ? 'Productores y emprendimientos' : 'Mi emprendimiento'} descripcion="CU2 · Productores asociados a FEDER y los productos que ofrecen">
                {puede('emprendimientos', 'crear') && <button type="button" className="btn-primario" onClick={() => setEdicion({ rubro: 'agricola', estado: 'activo', comunidad_id: '', usuario_id: '' })}><Plus className="size-4" /> Nuevo productor</button>}
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                {esStaff && (
                    <BarraFiltros listado={listado} placeholder="Nombre, responsable o comunidad">
                        <FiltroSelect etiqueta="Comunidad" valor={listado.filtros.comunidad_id} onChange={(v) => listado.setFiltro('comunidad_id', v)} opciones={comunidades.map((c) => ({ value: c.id, label: c.nombre }))} todos="Todas" />
                        <FiltroSelect etiqueta="Rubro" valor={listado.filtros.rubro} onChange={(v) => listado.setFiltro('rubro', v)} opciones={RUBROS.map((r) => ({ value: r, label: capitalizar(r) }))} />
                        <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
                    </BarraFiltros>
                )}
                <TablaDatos listado={listado} vacio={esStaff ? 'No hay productores.' : 'Tu cuenta no está vinculada a un emprendimiento.'} columnas={[
                    { titulo: 'Emprendimiento', render: (e) => <><p className="font-medium">{e.nombre}</p><p className="text-xs text-suave">{e.responsable}{e.telefono ? ` · ${e.telefono}` : ''}</p></> },
                    { titulo: 'Comunidad', render: (e) => `${e.comunidad} · ${e.municipio}` },
                    { titulo: 'Rubro', render: (e) => <Insignia color="acento">{capitalizar(e.rubro)}</Insignia> },
                    { titulo: 'Productos', campo: 'productos', className: 'text-center' },
                    { titulo: 'Cuenta', render: (e) => e.cuenta_email ?? <span className="text-suave">—</span> },
                    { titulo: 'Estado', render: (e) => <Estado valor={e.estado} /> },
                    { titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (e) => (
                        <>
                            <button type="button" className="btn-fantasma btn-sm" aria-label={`Ver ${e.nombre}`} onClick={() => setDetalle(e.id)}><Eye className="size-4" /></button>
                            {puede('emprendimientos', 'editar') && <button type="button" className="btn-fantasma btn-sm" aria-label={`Editar ${e.nombre}`} onClick={() => editar(e)}><Pencil className="size-4" /></button>}
                            {puede('emprendimientos', 'eliminar') && <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label={`Eliminar ${e.nombre}`} onClick={() => setBorrar(e)}><Trash2 className="size-4" /></button>}
                        </>
                    ) },
                ]} />
            </section>
            <FormularioModal abierto={!!edicion} titulo={edicion?.id ? 'Editar productor' : 'Nuevo productor'} esquema={esquema} campos={campos} valores={edicion ?? {}} onCerrar={() => setEdicion(null)} onGuardar={guardar} />
            {detalle && <Detalle id={detalle} onCerrar={() => setDetalle(null)} />}
            <Confirmar abierto={!!borrar} titulo="Eliminar productor" mensaje={`¿Eliminar a “${borrar?.nombre}”? Si tiene producción registrada solo se dará de baja.`} onConfirmar={eliminar} onCerrar={() => setBorrar(null)} textoConfirmar="Eliminar" />
        </>
    );
}
