import { useCallback, useEffect, useRef, useState } from 'react';
import api, { mensajeError } from '../api/cliente';

/** Listado paginado con filtros contra un endpoint de la API ({ data, meta } o arreglo simple). */
export default function useListado(endpoint, filtrosIniciales = {}, { paginado = true } = {}) {
    const [filtros, setFiltros] = useState(filtrosIniciales);
    const [pagina, setPagina] = useState(1);
    const [estado, setEstado] = useState({ datos: [], meta: null, cargando: true, error: '' });
    const ultimo = useRef(0);

    const cargar = useCallback(async () => {
        const id = ++ultimo.current;
        setEstado((e) => ({ ...e, cargando: true, error: '' }));
        try {
            const params = Object.fromEntries(Object.entries({ ...filtros, page: paginado ? pagina : undefined }).filter(([, v]) => v !== '' && v !== null && v !== undefined));
            const { data } = await api.get(endpoint, { params });
            if (id !== ultimo.current) return;
            setEstado({ datos: Array.isArray(data) ? data : data.data ?? [], meta: data.meta ?? null, cargando: false, error: '' });
        } catch (e) {
            if (id !== ultimo.current) return;
            setEstado({ datos: [], meta: null, cargando: false, error: mensajeError(e) });
        }
    }, [endpoint, filtros, pagina, paginado]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const setFiltro = (clave, valor) => {
        setPagina(1);
        setFiltros((f) => ({ ...f, [clave]: valor }));
    };

    return { ...estado, filtros, setFiltro, setFiltros, pagina, setPagina, recargar: cargar };
}

/** Mensajes de éxito/error de una pantalla. */
export function useAviso() {
    const [aviso, setAviso] = useState({ tipo: 'exito', texto: '' });
    const t = useRef(null);
    const mostrar = (tipo, texto) => {
        clearTimeout(t.current);
        setAviso({ tipo, texto });
        if (tipo === 'exito') t.current = setTimeout(() => setAviso({ tipo, texto: '' }), 6000);
    };
    return {
        aviso,
        ok: (texto) => mostrar('exito', texto),
        error: (e) => mostrar('error', typeof e === 'string' ? e : mensajeError(e)),
        limpiar: () => setAviso({ tipo: 'exito', texto: '' }),
    };
}
