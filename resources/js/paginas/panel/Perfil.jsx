import { LoaderCircle, Save } from 'lucide-react';
import api from '../../api/cliente';
import { Alerta, Campo, Encabezado, Tarjeta } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useFormulario from '../../hooks/useFormulario';
import { useAviso } from '../../hooks/useListado';
import { esquemaPerfil } from '../../validacion/esquemas';

export default function Perfil() {
    const { usuario, setSesion, puede } = useAuth();
    const aviso = useAviso();
    const f = useFormulario(esquemaPerfil, {
        nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, telefono: usuario.telefono ?? '',
        direccion: usuario.direccion ?? '', password_actual: '', password: '', password_confirmation: '',
    });
    const editable = puede('perfil', 'editar');

    const guardar = f.enviar(async (datos) => {
        const { data } = await api.put('/auth/perfil', datos);
        setSesion((s) => ({ ...s, ...data }));
        f.reset({ ...datos, password_actual: '', password: '', password_confirmation: '' });
        aviso.ok(data.message);
    });

    return (
        <>
            <Encabezado titulo="Mi perfil" descripcion={`Rol: ${usuario.rol}${usuario.ci ? ` · CI ${usuario.ci}` : ''}`} />
            <form onSubmit={guardar} noValidate className="grid max-w-4xl gap-6 lg:grid-cols-2">
                <div className="lg:col-span-2 space-y-2">
                    <Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta>
                    <Alerta tipo="error">{f.errorGeneral}</Alerta>
                </div>
                <Tarjeta titulo="Datos personales">
                    <fieldset disabled={!editable} className="space-y-4">
                        <Campo etiqueta="Nombre" requerido {...f.campo('nombre')} />
                        <Campo etiqueta="Apellido" requerido {...f.campo('apellido')} />
                        <Campo etiqueta="Correo electrónico" tipo="email" requerido {...f.campo('email')} />
                        <Campo etiqueta="Teléfono" tipo="tel" {...f.campo('telefono')} />
                        <Campo etiqueta="Dirección" {...f.campo('direccion')} />
                    </fieldset>
                </Tarjeta>
                <Tarjeta titulo="Cambiar contraseña">
                    <fieldset disabled={!editable} className="space-y-4">
                        <p className="text-sm text-suave">Déjalo en blanco si no deseas cambiarla.</p>
                        <Campo etiqueta="Contraseña actual" tipo="password" autoComplete="current-password" {...f.campo('password_actual')} />
                        <Campo etiqueta="Nueva contraseña" tipo="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres, con letras y números" {...f.campo('password')} />
                        <Campo etiqueta="Confirmar nueva contraseña" tipo="password" autoComplete="new-password" {...f.campo('password_confirmation')} />
                    </fieldset>
                </Tarjeta>
                {editable && (
                    <div className="lg:col-span-2">
                        <button type="submit" className="btn-primario" disabled={f.enviando}>
                            {f.enviando ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar cambios
                        </button>
                    </div>
                )}
            </form>
        </>
    );
}
