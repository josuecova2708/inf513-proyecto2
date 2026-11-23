import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/cliente';
import { useAuth } from './AuthContext';

const CarritoContext = createContext(null);

/** El carrito vive en la BD (pedido "pendiente" sin entrega, igual que en el 1er parcial). */
export function CarritoProvider({ children }) {
    const { autenticado, puede } = useAuth();
    const [carrito, setCarrito] = useState(null);
    const habilitado = autenticado && puede('carrito', 'ver');

    const recargar = useCallback(async () => {
        if (!habilitado) {
            setCarrito(null);
            return;
        }
        try {
            const { data } = await api.get('/carrito');
            setCarrito(data);
        } catch {
            setCarrito(null);
        }
    }, [habilitado]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    const agregar = useCallback(async (productoId, cantidad = 1) => {
        const { data } = await api.post('/carrito/items', { producto_id: productoId, cantidad });
        setCarrito(data);
        return data;
    }, []);

    const actualizar = useCallback(async (productoId, cantidad) => {
        const { data } = await api.put(`/carrito/items/${productoId}`, { cantidad });
        setCarrito(data);
    }, []);

    const quitar = useCallback(async (productoId) => {
        const { data } = await api.delete(`/carrito/items/${productoId}`);
        setCarrito(data);
    }, []);

    const vaciar = useCallback(async () => {
        const { data } = await api.delete('/carrito');
        setCarrito(data);
    }, []);

    const valor = useMemo(
        () => ({
            carrito,
            habilitado,
            cantidadItems: carrito?.detalles?.length ?? 0,
            recargar,
            agregar,
            actualizar,
            quitar,
            vaciar,
        }),
        [carrito, habilitado, recargar, agregar, actualizar, quitar, vaciar],
    );

    return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export const useCarrito = () => useContext(CarritoContext);
