import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, Menu as MenuIcono, X } from 'lucide-react';
import Icono from '../componentes/Icono';
import BuscadorGlobal from '../componentes/BuscadorGlobal';
import PanelAccesibilidad from '../componentes/PanelAccesibilidad';
import CampanaNotificaciones from '../componentes/CampanaNotificaciones';
import MenuUsuario from '../componentes/MenuUsuario';
import Footer from '../componentes/Footer';
import { useAuth } from '../contextos/AuthContext';
import { Logo } from './PublicLayout';

const claseEnlace = ({ isActive }) =>
    `flex items-center gap-3 rounded-tema px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primario text-sobre-primario font-semibold' : 'hover:bg-superficie-2'}`;

/** Grupo del menú (padre con hijos), abierto si contiene la ruta actual. */
function Grupo({ item }) {
    const { pathname } = useLocation();
    const contieneActual = item.hijos.some((h) => h.ruta && pathname.startsWith(h.ruta));
    const [abierto, setAbierto] = useState(contieneActual);
    useEffect(() => {
        if (contieneActual) setAbierto(true);
    }, [contieneActual]);

    return (
        <li>
            <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} className="flex w-full items-center gap-3 rounded-tema px-3 py-2 text-sm font-semibold text-suave hover:bg-superficie-2">
                <Icono nombre={item.icono} className="size-5" />
                <span className="flex-1 text-left">{item.titulo}</span>
                <ChevronDown className={`size-4 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {abierto && (
                <ul className="ml-4 mt-1 space-y-1 border-l border-borde pl-2">
                    {item.hijos.map((h) => (
                        <li key={h.id}>
                            <NavLink to={h.ruta} end className={claseEnlace}>
                                <Icono nombre={h.icono} className="size-4" />
                                {h.titulo}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

/** Menú lateral renderizado 100% desde la base de datos según los permisos del rol. */
function MenuLateral() {
    const { menu } = useAuth();
    return (
        <nav aria-label="Menú del sistema">
            <ul className="space-y-1">
                {menu.map((item) =>
                    item.hijos?.length ? (
                        <Grupo key={item.id} item={item} />
                    ) : (
                        <li key={item.id}>
                            <NavLink to={item.ruta} end={item.ruta === '/panel'} className={claseEnlace}>
                                <Icono nombre={item.icono} className="size-5" />
                                {item.titulo}
                            </NavLink>
                        </li>
                    ),
                )}
            </ul>
        </nav>
    );
}

export default function PanelLayout() {
    const [menuMovil, setMenuMovil] = useState(false);
    const { pathname } = useLocation();
    const { usuario } = useAuth();

    useEffect(() => setMenuMovil(false), [pathname]);

    return (
        <div className="flex min-h-screen flex-col">
            <a href="#contenido" className="enlace-saltar btn-primario">Saltar al contenido</a>
            <header className="sticky top-0 z-30 border-b border-borde bg-superficie/95 backdrop-blur">
                <div className="flex items-center gap-3 px-4 py-2.5">
                    <button type="button" className="btn-fantasma btn-sm lg:hidden" onClick={() => setMenuMovil(true)} aria-label="Abrir menú">
                        <MenuIcono className="size-5" />
                    </button>
                    <Logo />
                    <div className="hidden flex-1 justify-center md:flex">
                        <BuscadorGlobal />
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <CampanaNotificaciones />
                        <PanelAccesibilidad />
                        <MenuUsuario />
                    </div>
                </div>
            </header>

            <div className="flex flex-1">
                <aside className="hidden w-64 shrink-0 border-r border-borde bg-superficie p-3 lg:block">
                    <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
                        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-suave">Rol: {usuario?.rol}</p>
                        <MenuLateral />
                    </div>
                </aside>

                {menuMovil && (
                    <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuMovil(false)}>
                        <aside className="h-full w-72 overflow-y-auto bg-superficie p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="mb-3 flex items-center justify-between">
                                <p className="px-3 text-xs font-semibold uppercase text-suave">Rol: {usuario?.rol}</p>
                                <button type="button" className="btn-fantasma btn-sm" onClick={() => setMenuMovil(false)} aria-label="Cerrar menú">
                                    <X className="size-5" />
                                </button>
                            </div>
                            <div className="mb-3 md:hidden"><BuscadorGlobal /></div>
                            <MenuLateral />
                        </aside>
                    </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                    <main id="contenido" className="flex-1 p-4 lg:p-6">
                        <Outlet />
                    </main>
                    <Footer />
                </div>
            </div>
        </div>
    );
}
