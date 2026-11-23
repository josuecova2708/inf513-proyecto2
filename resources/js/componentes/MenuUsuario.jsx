import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, CircleUser, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../contextos/AuthContext';

export default function MenuUsuario() {
    const { usuario, cerrarSesion } = useAuth();
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);
    const navegar = useNavigate();

    useEffect(() => {
        const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, []);

    if (!usuario) return null;

    const salir = async () => {
        setAbierto(false);
        await cerrarSesion();
        navegar('/login');
    };

    return (
        <div ref={ref} className="relative">
            <button type="button" className="btn-fantasma btn-sm" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} aria-haspopup="menu">
                <span className="flex size-8 items-center justify-center rounded-full bg-primario font-bold text-sobre-primario" aria-hidden="true">
                    {usuario.nombre?.[0]}{usuario.apellido?.[0]}
                </span>
                <span className="hidden text-left leading-tight md:block">
                    <span className="block text-sm font-semibold">{usuario.nombre}</span>
                    <span className="block text-xs text-suave">{usuario.rol}</span>
                </span>
                <ChevronDown className="size-4" aria-hidden="true" />
            </button>
            {abierto && (
                <div role="menu" className="tarjeta absolute right-0 top-full z-50 mt-2 w-56 py-1 shadow-xl">
                    <div className="border-b border-borde px-4 py-2 text-sm">
                        <p className="font-semibold">{usuario.nombre_completo}</p>
                        <p className="truncate text-xs text-suave">{usuario.email}</p>
                    </div>
                    <Link role="menuitem" to="/panel" onClick={() => setAbierto(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-superficie-2">
                        <LayoutDashboard className="size-4" /> Mi panel
                    </Link>
                    <Link role="menuitem" to="/panel/perfil" onClick={() => setAbierto(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-superficie-2">
                        <CircleUser className="size-4" /> Mi perfil
                    </Link>
                    <button role="menuitem" type="button" onClick={salir} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-peligro hover:bg-superficie-2">
                        <LogOut className="size-4" /> Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    );
}
