import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderCircle, Search, X } from 'lucide-react';
import api from '../api/cliente';

/**
 * Búsqueda global predictiva del header: productos, categorías, productores,
 * comunidades y, según el rol, pedidos, usuarios y opciones del menú.
 */
export default function BuscadorGlobal({ grande = false }) {
    const [q, setQ] = useState('');
    const [grupos, setGrupos] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [activo, setActivo] = useState(-1);
    const navegar = useNavigate();
    const id = useId();
    const contenedor = useRef(null);

    const planos = grupos.flatMap((g) => g.items.map((it) => ({ ...it, grupo: g.titulo })));

    useEffect(() => {
        const texto = q.trim();
        if (texto.length < 2) {
            setGrupos([]);
            return undefined;
        }
        setCargando(true);
        const controlador = new AbortController();
        const t = setTimeout(() => {
            api.get('/buscar', { params: { q: texto }, signal: controlador.signal })
                .then(({ data }) => {
                    setGrupos(data.grupos ?? []);
                    setAbierto(true);
                    setActivo(-1);
                })
                .catch(() => {})
                .finally(() => setCargando(false));
        }, 300);
        return () => {
            clearTimeout(t);
            controlador.abort();
        };
    }, [q]);

    useEffect(() => {
        const fuera = (e) => !contenedor.current?.contains(e.target) && setAbierto(false);
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, []);

    const ir = (item) => {
        setAbierto(false);
        setQ('');
        navegar(item.ruta);
    };

    const alTeclear = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAbierto(true);
            setActivo((a) => Math.min(a + 1, planos.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActivo((a) => Math.max(a - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activo >= 0 && planos[activo]) ir(planos[activo]);
            else if (q.trim().length >= 2) ir({ ruta: `/catalogo?q=${encodeURIComponent(q.trim())}` });
        } else if (e.key === 'Escape') {
            setAbierto(false);
        }
    };

    let indice = -1;
    return (
        <div ref={contenedor} className={`relative w-full ${grande ? 'max-w-2xl' : 'max-w-md'}`} role="search">
            <label htmlFor={id} className="sr-only">Buscar en FEDER</label>
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-suave" aria-hidden="true" />
                <input
                    id={id}
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onFocus={() => grupos.length && setAbierto(true)}
                    onKeyDown={alTeclear}
                    maxLength={80}
                    placeholder="Buscar productos, productores, comunidades, pedidos…"
                    className={`campo pl-10 pr-10 ${grande ? 'py-3 text-base' : ''}`}
                    role="combobox"
                    aria-expanded={abierto}
                    aria-controls={`${id}-lista`}
                    aria-autocomplete="list"
                    aria-activedescendant={activo >= 0 ? `${id}-op-${activo}` : undefined}
                    autoComplete="off"
                />
                {cargando ? (
                    <LoaderCircle className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-suave" aria-hidden="true" />
                ) : q && (
                    <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-suave" aria-label="Limpiar búsqueda">
                        <X className="size-5" />
                    </button>
                )}
            </div>
            {abierto && q.trim().length >= 2 && (
                <div id={`${id}-lista`} role="listbox" className="tarjeta absolute z-40 mt-1 max-h-[70vh] w-full overflow-y-auto py-2 shadow-lg">
                    {planos.length === 0 && !cargando && (
                        <p className="px-4 py-3 text-sm text-suave">Sin resultados para “{q}”.</p>
                    )}
                    {grupos.map((g) => (
                        <div key={g.titulo}>
                            <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-suave">{g.titulo}</p>
                            {g.items.map((it) => {
                                indice += 1;
                                const i = indice;
                                return (
                                    <button
                                        key={`${g.titulo}-${it.id}`}
                                        id={`${id}-op-${i}`}
                                        type="button"
                                        role="option"
                                        aria-selected={activo === i}
                                        onMouseEnter={() => setActivo(i)}
                                        onClick={() => ir(it)}
                                        className={`flex w-full flex-col px-4 py-2 text-left ${activo === i ? 'bg-superficie-2' : ''}`}
                                    >
                                        <span className="font-medium">{it.titulo}</span>
                                        {it.subtitulo && <span className="text-xs text-suave">{it.subtitulo}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
