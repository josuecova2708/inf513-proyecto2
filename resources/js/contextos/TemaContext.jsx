import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { tokenGuardado } from '../api/cliente';
import { useAuth } from './AuthContext';

const TemaContext = createContext(null);
const CLAVE = 'feder_tema';

export const TEMAS = [
    { id: 'ninos', nombre: 'Niños', descripcion: 'Colores vivos y letra grande' },
    { id: 'jovenes', nombre: 'Jóvenes', descripcion: 'Moderno y dinámico' },
    { id: 'adultos', nombre: 'Adultos', descripcion: 'Sobrio y clásico' },
];

const PREDETERMINADO = { tema: 'adultos', modo: 'auto', tamano_fuente: 16, contraste: 'normal' };

/** Día de 07:00 a 18:59; noche el resto (modo automático según horario). */
export const modoPorHora = (fecha = new Date()) => (fecha.getHours() >= 7 && fecha.getHours() < 19 ? 'dia' : 'noche');

function leer() {
    try {
        return { ...PREDETERMINADO, ...(JSON.parse(localStorage.getItem(CLAVE)) ?? {}) };
    } catch {
        return PREDETERMINADO;
    }
}

export function TemaProvider({ children }) {
    const { preferencias, autenticado } = useAuth();
    const [pref, setPref] = useState(leer);
    const [horaModo, setHoraModo] = useState(modoPorHora());
    const temporizador = useRef(null);

    // Al iniciar sesión, se adoptan las preferencias guardadas en la base de datos
    useEffect(() => {
        if (preferencias) setPref((p) => ({ ...p, ...preferencias }));
    }, [preferencias]);

    // Recalcula el modo automático cada minuto
    useEffect(() => {
        const id = setInterval(() => setHoraModo(modoPorHora()), 60_000);
        return () => clearInterval(id);
    }, []);

    const modoEfectivo = pref.modo === 'auto' ? horaModo : pref.modo;

    useEffect(() => {
        const r = document.documentElement;
        r.setAttribute('data-tema', pref.tema);
        r.setAttribute('data-modo', modoEfectivo);
        r.setAttribute('data-contraste', pref.contraste);
        r.style.setProperty('--tamano-base', `${pref.tamano_fuente}px`);
        try {
            localStorage.setItem(CLAVE, JSON.stringify(pref));
        } catch {
            /* almacenamiento no disponible */
        }
    }, [pref, modoEfectivo]);

    const cambiar = useCallback(
        (cambios) => {
            setPref((p) => {
                const nueva = { ...p, ...cambios };
                // Persistir en la BD (con pequeño retardo para no saturar al mover el slider)
                if (autenticado && tokenGuardado()) {
                    clearTimeout(temporizador.current);
                    temporizador.current = setTimeout(() => api.put('/preferencias', nueva).catch(() => {}), 600);
                }
                return nueva;
            });
        },
        [autenticado],
    );

    const valor = useMemo(
        () => ({
            ...pref,
            modoEfectivo,
            setTema: (tema) => cambiar({ tema }),
            setModo: (modo) => cambiar({ modo }),
            alternarModo: () => cambiar({ modo: modoEfectivo === 'dia' ? 'noche' : 'dia' }),
            setTamano: (t) => cambiar({ tamano_fuente: Math.min(22, Math.max(14, Number(t))) }),
            setContraste: (contraste) => cambiar({ contraste }),
            restablecer: () => cambiar(PREDETERMINADO),
        }),
        [pref, modoEfectivo, cambiar],
    );

    return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export const useTema = () => useContext(TemaContext);
