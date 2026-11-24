import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoaderCircle, LogIn } from 'lucide-react';
import { Alerta, Campo } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useFormulario from '../../hooks/useFormulario';
import { LogoCompleto } from '../../layouts/PublicLayout';
import { esquemaLogin } from '../../validacion/esquemas';

const DEMO = [
    ['Administrador', 'feder.admin@example.com'],
    ['Personal FEDER', 'feder.personal@example.com'],
    ['Productor', 'productor.pedro@example.com'],
    ['Cliente', 'cliente.ana@example.com'],
];

export default function Login() {
    const { iniciarSesion, autenticado } = useAuth();
    const navegar = useNavigate();
    const { state } = useLocation();
    const f = useFormulario(esquemaLogin, { email: '', password: '' });

    if (autenticado) return <Navigate to={state?.desde ?? '/panel'} replace />;

    const alEnviar = f.enviar(async (datos) => {
        await iniciarSesion(datos.email, datos.password);
        navegar(state?.desde ?? '/panel', { replace: true });
    });

    return (
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
            <section className="tarjeta p-6 sm:p-8">
                <h1 className="text-2xl font-bold">Iniciar sesión</h1>
                <p className="mt-1 text-suave">Ingresa con tu cuenta de FEDER.</p>
                <form onSubmit={alEnviar} noValidate className="mt-6 space-y-4">
                    <Alerta tipo="error">{f.errorGeneral}</Alerta>
                    <Campo etiqueta="Correo electrónico" tipo="email" autoComplete="username" requerido {...f.campo('email')} />
                    <Campo etiqueta="Contraseña" tipo="password" autoComplete="current-password" requerido {...f.campo('password')} />
                    <button type="submit" className="btn-primario w-full" disabled={f.enviando}>
                        {f.enviando ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />} Ingresar
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-suave">
                    ¿No tienes cuenta? <Link to="/registro" className="font-semibold text-primario hover:underline">Regístrate como cliente</Link>
                </p>
            </section>
            <aside className="flex flex-col justify-center gap-4">
                <LogoCompleto className="self-start" />
                <h2 className="text-xl font-semibold">Usuarios de demostración</h2>
                <p className="text-sm text-suave">Contraseña de todos: <code className="rounded bg-superficie-2 px-1.5 py-0.5">feder123</code>. Cada rol ve un menú distinto, cargado desde la base de datos.</p>
                <ul className="space-y-2">
                    {DEMO.map(([rol, email]) => (
                        <li key={email}>
                            <button
                                type="button"
                                className="tarjeta flex w-full items-center justify-between px-4 py-3 text-left hover:border-primario"
                                onClick={() => {
                                    f.setValue('email', email);
                                    f.setValue('password', 'feder123');
                                }}
                            >
                                <span className="font-medium">{rol}</span>
                                <span className="text-sm text-suave">{email}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>
        </div>
    );
}
