import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HandHeart, MapPinned, ShieldCheck, Truck } from 'lucide-react';
import api from '../../api/cliente';
import BuscadorGlobal from '../../componentes/BuscadorGlobal';
import { LogoCompleto } from '../../layouts/PublicLayout';
import ProductoTarjeta, { useAgregarAlCarrito } from '../../componentes/ProductoTarjeta';
import { Alerta, Cargando } from '../../componentes/ui';

export default function Inicio() {
    const [datos, setDatos] = useState(null);
    const carrito = useAgregarAlCarrito();

    useEffect(() => {
        api.get('/catalogo/portada').then(({ data }) => setDatos(data)).catch(() => setDatos({ destacados: [], categorias: [], comunidades: [] }));
    }, []);

    return (
        <>
            <section className="border-b border-borde bg-gradient-to-br from-primario/15 via-fondo to-acento/15">
                <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 lg:grid-cols-2">
                    <div>
                        <LogoCompleto className="mb-5" />
                        <p className="mb-2 font-semibold text-secundario">Federación de comunidades agrícolas · Santa Cruz</p>
                        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Productos frescos, directo de quienes los cultivan</h1>
                        <p className="mt-4 max-w-xl text-lg text-suave">
                            Arroz, miel, café, hortalizas y más, con trazabilidad completa: sabes de qué comunidad y de qué lote viene cada producto.
                        </p>
                        <div className="mt-6"><BuscadorGlobal grande /></div>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Link to="/catalogo" className="btn-primario">Ver catálogo <ArrowRight className="size-4" /></Link>
                            <Link to="/registro" className="btn-secundario">Crear cuenta</Link>
                        </div>
                    </div>
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {[
                            [MapPinned, 'De comunidades reales', 'Productores de San Julián, Samaipata, El Torno y Okinawa.'],
                            [ShieldCheck, 'Trazabilidad de origen', 'Cada compra se vincula a su lote y productor.'],
                            [Truck, 'Recojo o envío', 'Retira en FEDER o recibe en tu domicilio.'],
                            [HandHeart, 'Pago justo', 'Paga al contado o en cuotas con tu plan de pagos.'],
                        ].map(([I, t, d]) => (
                            <li key={t} className="tarjeta p-5">
                                <I className="size-8 text-primario" aria-hidden="true" />
                                <h2 className="mt-2 font-semibold">{t}</h2>
                                <p className="text-sm text-suave">{d}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-10">
                <div className="mb-4 flex items-end justify-between">
                    <h2 className="text-2xl font-bold">Productos destacados</h2>
                    <Link to="/catalogo" className="text-sm font-semibold text-primario hover:underline">Ver todos</Link>
                </div>
                <div className="mb-4 space-y-2">
                    <Alerta tipo="exito" onCerrar={carrito.limpiar}>{carrito.mensaje}</Alerta>
                    <Alerta tipo="error" onCerrar={carrito.limpiar}>{carrito.error}</Alerta>
                </div>
                {!datos ? <Cargando /> : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {datos.destacados.map((p) => (
                            <ProductoTarjeta key={p.id} producto={p} onAgregar={carrito.agregarProducto} cargando={carrito.cargando === p.id} />
                        ))}
                    </div>
                )}
            </section>

            {datos?.categorias?.length > 0 && (
                <section className="mx-auto max-w-7xl px-4 pb-10">
                    <h2 className="mb-4 text-2xl font-bold">Categorías</h2>
                    <div className="flex flex-wrap gap-3">
                        {datos.categorias.map((c) => (
                            <Link key={c.id} to={`/catalogo?categoria=${c.id}`} className="tarjeta px-5 py-3 font-medium hover:border-primario">
                                {c.nombre} <span className="text-sm text-suave">({c.total})</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {datos?.comunidades?.length > 0 && (
                <section className="mx-auto max-w-7xl px-4 pb-12">
                    <h2 className="mb-4 text-2xl font-bold">Nuestras comunidades</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {datos.comunidades.map((c) => (
                            <div key={c.id} className="tarjeta p-5">
                                <MapPinned className="size-6 text-secundario" aria-hidden="true" />
                                <h3 className="mt-2 font-semibold">{c.nombre}</h3>
                                <p className="text-sm text-suave">{c.municipio}, {c.departamento}</p>
                                <p className="mt-1 text-sm">{c.descripcion}</p>
                                <p className="mt-2 text-xs text-suave">{c.productores} productor(es)</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
