import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LoaderCircle, UserPlus } from 'lucide-react';
import { Alerta, Campo } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useFormulario from '../../hooks/useFormulario';
import { esquemaRegistro } from '../../validacion/esquemas';

export default function Registro() {
    const { registrarse, autenticado } = useAuth();
    const navegar = useNavigate();
    const f = useFormulario(esquemaRegistro, {
        nombre: '', apellido: '', ci: '', email: '', telefono: '', direccion: '', password: '', password_confirmation: '',
    });

    if (autenticado) return <Navigate to="/panel" replace />;

    const alEnviar = f.enviar(async (datos) => {
        await registrarse(datos);
        navegar('/catalogo', { replace: true });
    });

    return (
        <div className="mx-auto max-w-2xl px-4 py-10">
            <section className="tarjeta p-6 sm:p-8">
                <h1 className="text-2xl font-bold">Crear cuenta de cliente</h1>
                <p className="mt-1 text-suave">Compra productos directo de las comunidades agrícolas.</p>
                <form onSubmit={alEnviar} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Alerta tipo="error">{f.errorGeneral}</Alerta></div>
                    <Campo etiqueta="Nombre" requerido autoComplete="given-name" {...f.campo('nombre')} />
                    <Campo etiqueta="Apellido" requerido autoComplete="family-name" {...f.campo('apellido')} />
                    <Campo etiqueta="Carnet de identidad" ayuda="Opcional. Ej. 7894561" {...f.campo('ci')} />
                    <Campo etiqueta="Teléfono" tipo="tel" ayuda="Opcional. 8 dígitos" autoComplete="tel" {...f.campo('telefono')} />
                    <div className="sm:col-span-2"><Campo etiqueta="Correo electrónico" tipo="email" requerido autoComplete="email" {...f.campo('email')} /></div>
                    <div className="sm:col-span-2"><Campo etiqueta="Dirección" ayuda="Para envíos a domicilio" autoComplete="street-address" {...f.campo('direccion')} /></div>
                    <Campo etiqueta="Contraseña" tipo="password" requerido ayuda="Mínimo 8 caracteres, con letras y números" autoComplete="new-password" {...f.campo('password')} />
                    <Campo etiqueta="Confirmar contraseña" tipo="password" requerido autoComplete="new-password" {...f.campo('password_confirmation')} />
                    <div className="sm:col-span-2">
                        <button type="submit" className="btn-primario w-full" disabled={f.enviando}>
                            {f.enviando ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Crear cuenta
                        </button>
                    </div>
                </form>
                <p className="mt-6 text-center text-sm text-suave">
                    ¿Ya tienes cuenta? <Link to="/login" className="font-semibold text-primario hover:underline">Inicia sesión</Link>
                </p>
            </section>
        </div>
    );
}
