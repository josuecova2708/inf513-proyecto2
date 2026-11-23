import { z } from 'zod';

// Mensajes por defecto de Zod en español; los campos importantes además llevan mensajes propios.
z.config(z.locales.es());

const SOLO_LETRAS = /^[\p{L}\s'.-]+$/u;

export const texto = (etiqueta, { min = 1, max = 255 } = {}) =>
    z.string().trim()
        .min(min, min <= 1 ? `El campo ${etiqueta} es obligatorio.` : `El campo ${etiqueta} debe tener al menos ${min} caracteres.`)
        .max(max, `El campo ${etiqueta} no puede tener más de ${max} caracteres.`);

export const textoOpcional = (etiqueta, max = 255) =>
    z.string().trim().max(max, `El campo ${etiqueta} no puede tener más de ${max} caracteres.`).optional().or(z.literal(''));

export const nombrePersona = (etiqueta) => texto(etiqueta, { min: 2, max: 80 }).regex(SOLO_LETRAS, `El ${etiqueta} solo puede contener letras y espacios.`);

export const correo = z.string().trim().min(1, 'El correo electrónico es obligatorio.').max(120, 'El correo no puede tener más de 120 caracteres.')
    .email('Ingrese un correo electrónico válido (ej. nombre@correo.com).');

export const telefono = z.string().trim().regex(/^[67]\d{7}$/, 'El teléfono debe tener 8 dígitos y comenzar con 6 o 7.').optional().or(z.literal(''));

export const ci = z.string().trim().regex(/^\d{5,10}(-?[A-Za-z0-9]{1,3})?$/, 'El carnet debe tener entre 5 y 10 dígitos (complemento opcional, ej. 1234567-1A).').optional().or(z.literal(''));

export const contrasena = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(100, 'La contraseña no puede tener más de 100 caracteres.')
    .regex(/[A-Za-z]/, 'La contraseña debe contener al menos una letra.').regex(/\d/, 'La contraseña debe contener al menos un número.');

/** Número (desde input) con rango; acepta string vacío como "no indicado" si es opcional. */
export const numeroEn = (etiqueta, { min = 0, max = 1_000_000, entero = false, opcional = false, mayorQue } = {}) => {
    let n = z.coerce.number({ error: `El campo ${etiqueta} debe ser un número.` });
    if (entero) n = n.int(`El campo ${etiqueta} debe ser un número entero.`);
    n = mayorQue !== undefined ? n.gt(mayorQue, `El campo ${etiqueta} debe ser mayor que ${mayorQue}.`) : n.min(min, `El campo ${etiqueta} debe ser al menos ${min}.`);
    n = n.max(max, `El campo ${etiqueta} no puede ser mayor que ${max}.`);
    return opcional ? z.union([z.literal(''), z.null(), z.undefined(), n]) : n;
};

export const seleccion = (etiqueta) => z.coerce.number({ error: `Seleccione ${etiqueta}.` }).int().positive(`Seleccione ${etiqueta}.`);

export const fechaOpcional = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese una fecha válida.').optional().or(z.literal(''));

// ---------- Formularios de acceso ----------
export const esquemaLogin = z.object({
    email: correo,
    password: z.string().min(1, 'La contraseña es obligatoria.'),
});

export const esquemaRegistro = z.object({
    nombre: nombrePersona('nombre'),
    apellido: nombrePersona('apellido'),
    ci,
    email: correo,
    telefono,
    direccion: textoOpcional('dirección', 200),
    password: contrasena,
    password_confirmation: z.string().min(1, 'Confirme su contraseña.'),
}).refine((d) => d.password === d.password_confirmation, { path: ['password_confirmation'], message: 'Las contraseñas no coinciden.' });

export const esquemaPerfil = z.object({
    nombre: nombrePersona('nombre'),
    apellido: nombrePersona('apellido'),
    email: correo,
    telefono,
    direccion: textoOpcional('dirección', 200),
    password_actual: z.string().optional(),
    password: z.union([z.literal(''), contrasena]).optional(),
    password_confirmation: z.string().optional(),
}).refine((d) => !d.password || d.password === d.password_confirmation, { path: ['password_confirmation'], message: 'Las contraseñas no coinciden.' })
    .refine((d) => !d.password || !!d.password_actual, { path: ['password_actual'], message: 'Ingrese su contraseña actual para cambiarla.' });

/** Validación de tarjeta (algoritmo de Luhn). */
export function luhnValido(numero) {
    const d = numero.replace(/\D/g, '');
    if (d.length < 13 || d.length > 19) return false;
    let suma = 0;
    let doble = false;
    for (let i = d.length - 1; i >= 0; i -= 1) {
        let n = Number(d[i]);
        if (doble) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        suma += n;
        doble = !doble;
    }
    return suma % 10 === 0;
}

export { z };
