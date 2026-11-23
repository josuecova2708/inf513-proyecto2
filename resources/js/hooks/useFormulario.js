import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { erroresCampos, mensajeError } from '../api/cliente';

/**
 * Formulario con validación en cliente (zod, mensajes en español) y
 * errores de servidor (422) asignados a cada campo.
 */
export default function useFormulario(esquema, valoresIniciales = {}) {
    const form = useForm({ resolver: zodResolver(esquema), defaultValues: valoresIniciales, mode: 'onTouched' });
    const [errorGeneral, setErrorGeneral] = useState('');

    const enviar = (fn) =>
        form.handleSubmit(async (datos) => {
            setErrorGeneral('');
            try {
                await fn(datos);
            } catch (e) {
                const campos = erroresCampos(e);
                const nombres = Object.keys(campos);
                nombres.forEach((c) => form.setError(c, { type: 'servidor', message: campos[c] }));
                const sinCampo = nombres.filter((c) => !(c in form.getValues()));
                if (!nombres.length || sinCampo.length) setErrorGeneral(mensajeError(e));
            }
        });

    /** Props para <Campo {...campo('nombre')} /> */
    const campo = (nombre, opciones) => ({ ...form.register(nombre, opciones), error: form.formState.errors?.[nombre]?.message });

    return { ...form, enviar, campo, errorGeneral, setErrorGeneral, enviando: form.formState.isSubmitting };
}
