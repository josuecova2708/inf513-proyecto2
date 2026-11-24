import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye } from 'lucide-react';
import api, { IMG_URL } from '../api/cliente';
import { numero } from '../utils/formato';

/** Normaliza la ruta para contar por página (ej. /panel/pedidos/12 -> /panel/pedidos/:id). */
function normalizar(ruta) {
    return ruta.replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/$/, '') || '/';
}

/** Contador de visitas persistente de la página actual (obligatorio en el footer de cada vista). */
export function ContadorVisitas() {
    const { pathname } = useLocation();
    const [contador, setContador] = useState(null);

    useEffect(() => {
        let activo = true;
        const pagina = normalizar(pathname);
        api.post('/visitas', { pagina })
            .then(({ data }) => activo && setContador(data.contador))
            .catch(() => activo && setContador(null));
        return () => {
            activo = false;
        };
    }, [pathname]);

    return (
        <p className="flex items-center gap-1.5" aria-live="polite">
            <Eye className="size-4" aria-hidden="true" />
            {contador === null ? 'Contando visitas…' : (
                <span>
                    Esta página ha sido visitada <strong>{numero(contador)}</strong> {contador === 1 ? 'vez' : 'veces'}
                </span>
            )}
        </p>
    );
}

export default function Footer() {
    return (
        <footer className="mt-auto border-t border-borde bg-superficie">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-sm text-suave sm:flex-row">
                <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded bg-white p-0.5"><img src={`${IMG_URL}/feder-icono.png`} alt="" className="size-full object-contain" /></span>
                    <span>
                        <strong className="text-texto">FEDER</strong> · Comunidades agrícolas de Santa Cruz · INF513 Grupo 28 · {new Date().getFullYear()}
                    </span>
                </div>
                <ContadorVisitas />
            </div>
        </footer>
    );
}
