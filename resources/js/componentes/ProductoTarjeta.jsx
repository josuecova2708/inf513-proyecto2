import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle, ShoppingCart } from 'lucide-react';
import { mensajeError, urlImagen } from '../api/cliente';
import { useAuth } from '../contextos/AuthContext';
import { useCarrito } from '../contextos/CarritoContext';
import { moneda, numero } from '../utils/formato';
import { Insignia } from './ui';

const EMOJI = { granos: '🌾', miel: '🍯', hortalizas: '🥬', frutas: '🥭', cafe: '☕', café: '☕' };

export function ImagenProducto({ producto, className = 'h-40' }) {
    const src = urlImagen(producto.imagen);
    const cat = (producto.categoria ?? producto.categoria_nombre ?? '').toLowerCase();
    const emoji = Object.entries(EMOJI).find(([k]) => cat.includes(k))?.[1] ?? '🌱';
    return src ? (
        <img src={src} alt={producto.nombre} className={`w-full object-cover ${className}`} loading="lazy" />
    ) : (
        <div className={`flex w-full items-center justify-center bg-gradient-to-br from-primario/15 to-acento/20 ${className}`} role="img" aria-label={producto.nombre}>
            <span className="text-6xl" aria-hidden="true">{emoji}</span>
        </div>
    );
}

export function useAgregarAlCarrito() {
    const { autenticado, puede } = useAuth();
    const { agregar } = useCarrito();
    const navegar = useNavigate();
    const [estado, setEstado] = useState({ cargando: null, mensaje: '', error: '' });

    const agregarProducto = async (producto, cantidad = 1) => {
        if (!autenticado) {
            navegar('/login', { state: { desde: `/catalogo/${producto.id}` } });
            return;
        }
        if (!puede('carrito', 'crear')) {
            setEstado({ cargando: null, mensaje: '', error: 'Tu rol no puede realizar compras.' });
            return;
        }
        setEstado({ cargando: producto.id, mensaje: '', error: '' });
        try {
            await agregar(producto.id, cantidad);
            setEstado({ cargando: null, mensaje: `“${producto.nombre}” se agregó al carrito.`, error: '' });
        } catch (e) {
            setEstado({ cargando: null, mensaje: '', error: mensajeError(e) });
        }
    };
    return { ...estado, agregarProducto, limpiar: () => setEstado({ cargando: null, mensaje: '', error: '' }) };
}

export default function ProductoTarjeta({ producto, onAgregar, cargando }) {
    const disponible = Number(producto.stock_disponible ?? 0);
    const soloEncargo = producto.modalidad_venta === 'encargo';
    const agotado = !soloEncargo && disponible <= 0;

    return (
        <article className="tarjeta flex flex-col overflow-hidden transition-shadow hover:shadow-md">
            <Link to={`/catalogo/${producto.id}`} className="block">
                <ImagenProducto producto={producto} />
            </Link>
            <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap gap-1">
                    <Insignia color="primario">{producto.categoria}</Insignia>
                    {soloEncargo && <Insignia color="info">Por encargo</Insignia>}
                    {agotado && <Insignia color="peligro">Agotado</Insignia>}
                </div>
                <h3 className="font-semibold leading-snug">
                    <Link to={`/catalogo/${producto.id}`} className="hover:text-primario">{producto.nombre}</Link>
                </h3>
                <p className="text-sm text-suave">{producto.presentacion}</p>
                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <div>
                        <p className="text-xl font-bold text-primario">{moneda(producto.precio_venta)}</p>
                        {!soloEncargo && <p className="text-xs text-suave">Disponible: {numero(disponible)} {producto.unidad_medida}</p>}
                    </div>
                    {soloEncargo ? (
                        <Link to={`/catalogo/${producto.id}`} className="btn-secundario btn-sm">Encargar</Link>
                    ) : (
                        <button type="button" className="btn-primario btn-sm" disabled={agotado || cargando} onClick={() => onAgregar?.(producto)} aria-label={`Agregar ${producto.nombre} al carrito`}>
                            {cargando ? <LoaderCircle className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />} Agregar
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}
