import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogIn, ShoppingCart, Sprout } from 'lucide-react';
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
            <span className="flex size-10 items-center justify-center rounded-tema bg-primario text-sobre-primario">
                <Sprout className="size-6" aria-hidden="true" />
            </span>
            <span className="leading-tight">
                <span className="block font-titulo text-xl font-bold">FEDER</span>
                <span className="hidden text-xs text-suave sm:block">Del campo a tu mesa</span>
            </span>
        </Link>
    );
}

const enlace = ({ isActive }) => `rounded-tema px-3 py-2 text-sm font-medium ${isActive ? 'bg-primario/10 text-primario' : 'hover:bg-superficie-2'}`;

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
