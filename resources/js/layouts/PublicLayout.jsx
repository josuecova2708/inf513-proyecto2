import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogIn, ShoppingCart } from 'lucide-react';
import { IMG_URL } from '../api/cliente';
import BuscadorGlobal from '../componentes/BuscadorGlobal';
import PanelAccesibilidad from '../componentes/PanelAccesibilidad';
import CampanaNotificaciones from '../componentes/CampanaNotificaciones';
import MenuUsuario from '../componentes/MenuUsuario';
import Footer from '../componentes/Footer';
import { useAuth } from '../contextos/AuthContext';
import { useCarrito } from '../contextos/CarritoContext';

export function Logo() {
    return (
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="FEDER, ir al inicio">
            {/* Fondo blanco fijo: el ícono oficial (barras y engranaje gris) se ve igual en día, noche y alto contraste */}
            <span className="flex size-11 items-center justify-center rounded-tema border border-borde bg-white p-1 shadow-sm">
                <img src={`${IMG_URL}/feder-icono.png`} alt="" className="size-full object-contain" />
            </span>
            <span className="leading-tight">
                <span className="block font-titulo text-xl font-bold">FEDER</span>
                <span className="hidden text-xs text-suave sm:block">Del campo a tu mesa</span>
            </span>
        </Link>
    );
}

/** Logo oficial completo. Su texto es blanco, así que siempre va sobre una franja oscura fija. */
export function LogoCompleto({ className = '' }) {
    return (
        <span className={`inline-flex items-center rounded-tema bg-[#1f2a22] px-4 py-2.5 shadow ${className}`}>
            <img src={`${IMG_URL}/feder-logo.png`} alt="FEDER" className="h-9 w-auto" />
        </span>
    );
}

const enlace =({ isActive }) => `rounded-tema px-3 py-2 text-sm font-medium ${isActive ? 'bg-primario/10 text-primario' : 'hover:bg-superficie-2'}`;

export default function PublicLayout() {
    const { autenticado } = useAuth();
    const { habilitado, cantidadItems } = useCarrito();

    return (
        <div className="flex min-h-screen flex-col">
            <a href="#contenido" className="enlace-saltar btn-primario">Saltar al contenido</a>
            <header className="sticky top-0 z-30 border-b border-borde bg-superficie/95 backdrop-blur">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap">
                    <Logo />
                    <div className="order-last w-full lg:order-none lg:flex lg:flex-1 lg:justify-center">
                        <BuscadorGlobal grande />
                    </div>
                    <nav className="ml-auto flex items-center gap-1" aria-label="Navegación principal">
                        <NavLink to="/" end className={enlace}>Inicio</NavLink>
                        <NavLink to="/catalogo" className={enlace}>Catálogo</NavLink>
                        {habilitado && (
                            <Link to="/carrito" className="btn-fantasma btn-sm relative" aria-label={`Carrito: ${cantidadItems} productos`}>
                                <ShoppingCart className="size-5" />
                                {cantidadItems > 0 && (
                                    <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-secundario px-1 text-xs font-bold text-white">{cantidadItems}</span>
                                )}
                            </Link>
                        )}
                        {autenticado && <CampanaNotificaciones />}
                        <PanelAccesibilidad />
                        {autenticado ? <MenuUsuario /> : (
                            <Link to="/login" className="btn-primario btn-sm"><LogIn className="size-4" /> Ingresar</Link>
                        )}
                    </nav>
                </div>
            </header>
            <main id="contenido" className="flex-1">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
