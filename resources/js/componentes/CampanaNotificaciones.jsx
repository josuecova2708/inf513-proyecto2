import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../api/cliente';
import { useAuth } from '../contextos/AuthContext';
import { fechaHora } from '../utils/formato';

/** Notificaciones web al usuario (pedido confirmado, pago confirmado, pedido listo...). */
export default function CampanaNotificaciones() {
    const { puede } = useAuth();
    const [datos, setDatos] = useState({ no_leidas: 0, recientes: [] });
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);
    const habilitado = puede('notificaciones');

    const cargar = useCallback(() => {
        if (!habilitado) return;
        api.get('/notificaciones/no-leidas').then(({ data }) => setDatos(data)).catch(() => {});
    }, [habilitado]);

    useEffect(() => {
        cargar();
        const id = setInterval(cargar, 60_000);
        return () => clearInterval(id);
    }, [cargar]);

    useEffect(() => {
        const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, []);

    if (!habilitado) return null;

    const marcar = async (n) => {
        if (!n.leida) {
            await api.put(`/notificaciones/${n.id}/leer`).catch(() => {});
            cargar();
        }
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                className="btn-fantasma btn-sm relative"
                onClick={() => {
                    setAbierto((a) => !a);
                    cargar();
                }}
                aria-label={`Notificaciones${datos.no_leidas ? `: ${datos.no_leidas} sin leer` : ''}`}
                aria-expanded={abierto}
            >
                <Bell className="size-5" />
                {datos.no_leidas > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-peligro px-1 text-xs font-bold text-white">
                        {datos.no_leidas > 9 ? '9+' : datos.no_leidas}
                    </span>
                )}
            </button>
            {abierto && (
                <div className="tarjeta absolute right-0 top-full z-50 mt-2 w-80 shadow-xl">
                    <div className="border-b border-borde px-4 py-2 font-semibold">Notificaciones</div>
                    <ul className="max-h-80 overflow-y-auto">
                        {datos.recientes.length === 0 && <li className="px-4 py-6 text-center text-sm text-suave">No tienes notificaciones.</li>}
                        {datos.recientes.map((n) => (
                            <li key={n.id}>
                                <button type="button" onClick={() => marcar(n)} className={`w-full border-b border-borde px-4 py-2 text-left text-sm hover:bg-superficie-2 ${n.leida ? 'text-suave' : ''}`}>
                                    {!n.leida && <span className="mr-1.5 inline-block size-2 rounded-full bg-primario" aria-label="Sin leer" />}
                                    {n.mensaje}
                                    <span className="mt-0.5 block text-xs text-suave">{fechaHora(n.fecha_envio)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <Link to="/panel/notificaciones" onClick={() => setAbierto(false)} className="block px-4 py-2 text-center text-sm font-medium text-primario hover:underline">
                        Ver todas
                    </Link>
                </div>
            )}
        </div>
    );
}
