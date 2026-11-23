import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import api from '../../api/cliente';
import ProductoTarjeta, { useAgregarAlCarrito } from '../../componentes/ProductoTarjeta';
import { Alerta, Cargando, Paginacion, Vacio } from '../../componentes/ui';

export default function Catalogo() {
    const [params, setParams] = useSearchParams();
    const [categorias, setCategorias] = useState([]);
    const [resultado, setResultado] = useState(null);
    const carrito = useAgregarAlCarrito();

    const q = params.get('q') ?? '';
    const categoria = params.get('categoria') ?? '';
    const modalidad = params.get('modalidad') ?? '';
    const orden = params.get('orden') ?? 'nombre';
    const pagina = params.get('page') ?? '1';

    useEffect(() => {
        api.get('/categorias/publicas').then(({ data }) => setCategorias(data)).catch(() => {});
    }, []);

    useEffect(() => {
        setResultado(null);
        api.get('/catalogo', { params: { q, categoria, modalidad, orden, page: pagina } })
            .then(({ data }) => setResultado(data))
            .catch(() => setResultado({ data: [], meta: null }));
    }, [q, categoria, modalidad, orden, pagina]);

    const cambiar = (clave, valor) => {
        const p = new URLSearchParams(params);
        if (valor) p.set(clave, valor);
        else p.delete(clave);
        if (clave !== 'page') p.delete('page');
        setParams(p);
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <h1 className="text-3xl font-bold">Catálogo de productos</h1>
            <p className="mt-1 text-suave">{q ? <>Resultados para “<strong>{q}</strong>”</> : 'Productos de las comunidades agrícolas de FEDER'}</p>

            <div className="tarjeta mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                    <label htmlFor="f-q" className="etiqueta">Buscar</label>
                    <input id="f-q" className="campo" defaultValue={q} maxLength={80} placeholder="Nombre o descripción" onKeyDown={(e) => e.key === 'Enter' && cambiar('q', e.currentTarget.value.trim())} onBlur={(e) => e.currentTarget.value.trim() !== q && cambiar('q', e.currentTarget.value.trim())} />
                </div>
                <div>
                    <label htmlFor="f-cat" className="etiqueta">Categoría</label>
                    <select id="f-cat" className="campo" value={categoria} onChange={(e) => cambiar('categoria', e.target.value)}>
                        <option value="">Todas</option>
                        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="f-mod" className="etiqueta">Modalidad</label>
                    <select id="f-mod" className="campo" value={modalidad} onChange={(e) => cambiar('modalidad', e.target.value)}>
                        <option value="">Todas</option>
                        <option value="inmediata">Venta inmediata</option>
                        <option value="encargo">Por encargo</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="f-ord" className="etiqueta">Ordenar por</label>
                    <select id="f-ord" className="campo" value={orden} onChange={(e) => cambiar('orden', e.target.value)}>
                        <option value="nombre">Nombre (A-Z)</option>
                        <option value="precio_asc">Precio: menor a mayor</option>
                        <option value="precio_desc">Precio: mayor a menor</option>
                        <option value="vendidos">Más vendidos</option>
                    </select>
                </div>
            </div>

            <div className="my-4 space-y-2">
                <Alerta tipo="exito" onCerrar={carrito.limpiar}>{carrito.mensaje}</Alerta>
                <Alerta tipo="error" onCerrar={carrito.limpiar}>{carrito.error}</Alerta>
            </div>

            {!resultado ? <Cargando /> : resultado.data.length === 0 ? (
                <Vacio texto="No encontramos productos con esos filtros.">
                    <button type="button" className="btn-secundario btn-sm" onClick={() => setParams({})}><SlidersHorizontal className="size-4" /> Quitar filtros</button>
                </Vacio>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {resultado.data.map((p) => (
                            <ProductoTarjeta key={p.id} producto={p} onAgregar={carrito.agregarProducto} cargando={carrito.cargando === p.id} />
                        ))}
                    </div>
                    <Paginacion meta={resultado.meta} onCambiar={(n) => cambiar('page', String(n))} />
                </>
            )}
        </div>
    );
}
