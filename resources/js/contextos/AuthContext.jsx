import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { guardarToken, registrarExpiracion, tokenGuardado } from '../api/cliente';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [sesion, setSesion] = useState(null); // { usuario, permisos, menu, preferencias }
    const [cargando, setCargando] = useState(!!tokenGuardado());

    const cerrarLocal = useCallback(() => {
        guardarToken(null);
        setSesion(null);
    }, []);

    const recargar = useCallback(async () => {
        if (!tokenGuardado()) {
            setCargando(false);
            return null;
        }
        try {
            const { data } = await api.get('/auth/me');
            setSesion(data);
            return data;
        } catch {
            cerrarLocal();
            return null;
        } finally {
            setCargando(false);
        }
    }, [cerrarLocal]);

    useEffect(() => {
        registrarExpiracion(() => setSesion(null));
        recargar();
    }, [recargar]);

    const iniciarSesion = useCallback(async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        guardarToken(data.token);
        setSesion(data);
        return data;
    }, []);

    const registrarse = useCallback(async (datos) => {
        const { data } = await api.post('/auth/registro', datos);
        guardarToken(data.token);
        setSesion(data);
        return data;
    }, []);

    const cerrarSesion = useCallback(async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            /* el token pudo haber expirado */
        }
        cerrarLocal();
    }, [cerrarLocal]);

    const valor = useMemo(() => {
        const permisos = sesion?.permisos ?? {};
        return {
            usuario: sesion?.usuario ?? null,
            permisos,
            menu: sesion?.menu ?? [],
            preferencias: sesion?.preferencias ?? null,
            cargando,
            autenticado: !!sesion?.usuario,
            /** puede('productos', 'crear') según la matriz de acceso del rol */
            puede: (modulo, accion = 'ver') => !!permisos?.[modulo]?.[accion],
            esStaff: !!sesion?.usuario?.es_staff,
            rol: sesion?.usuario?.rol ?? null,
            iniciarSesion,
            registrarse,
            cerrarSesion,
            recargar,
            setSesion,
        };
    }, [sesion, cargando, iniciarSesion, registrarse, cerrarSesion, recargar]);

    return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
