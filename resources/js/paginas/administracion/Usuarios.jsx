import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, UserX } from 'lucide-react';
import api from '../../api/cliente';
import { BarraFiltros, FiltroSelect, FormularioModal, TablaDatos } from '../../componentes/Crud';
import { Alerta, Confirmar, Encabezado, Estado, Insignia } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { fecha } from '../../utils/formato';
import { ci, contrasena, correo, nombrePersona, seleccion, telefono, textoOpcional, z } from '../../validacion/esquemas';

const base = {
    rol_id: seleccion('un rol'),
    nombre: nombrePersona('nombre'),
    apellido: nombrePersona('apellido'),
    ci,
    email: correo,
    telefono,
    direccion: textoOpcional('dirección', 200),
    estado: z.enum(['activo', 'inactivo'], { error: 'Seleccione el estado.' }),
};
const esquemaNuevo = z.object({ ...base, password: contrasena });
const esquemaEditar = z.object({ ...base, password: z.union([z.literal(''), contrasena]).optional() });

export default function Usuarios() {
    const { puede, usuario: yo } = useAuth();
    const [params] = useSearchParams();
    const listado = useListado('/usuarios', { q: params.get('q') ?? '', rol_id: '', estado: '' });
    const aviso = useAviso();
    const [roles, setRoles] = useState([]);
    const [edicion, setEdicion] = useState(null);
    const [baja, setBaja] = useState(null);

    useEffect(() => {
        api.get('/roles').then(({ data }) => setRoles(data)).catch(() => {});
    }, []);

    const opcionesRol = roles.map((r) => ({ value: String(r.id), label: r.nombre }));
    const campos = [
        { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
        { nombre: 'apellido', etiqueta: 'Apellido', requerido: true },
        { nombre: 'email', etiqueta: 'Correo electrónico', tipo: 'email', requerido: true },
        { nombre: 'ci', etiqueta: 'Carnet de identidad', ayuda: 'Ej. 7894561 o 7894561-1A' },
        { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', ayuda: '8 dígitos' },
        { nombre: 'rol_id', etiqueta: 'Rol', como: 'select', opciones: [{ value: '', label: 'Seleccione…' }, ...opcionesRol], requerido: true },
        { nombre: 'direccion', etiqueta: 'Dirección', ancho: 'completo' },
        { nombre: 'estado', etiqueta: 'Estado', como: 'select', opciones: [{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }] },
        { nombre: 'password', etiqueta: edicion?.id ? 'Nueva contraseña (opcional)' : 'Contraseña', tipo: 'password', requerido: !edicion?.id, ayuda: 'Mínimo 8 caracteres, con letras y números' },
    ];

    const guardar = async (datos) => {
        const { data } = edicion.id ? await api.put(`/usuarios/${edicion.id}`, datos) : await api.post('/usuarios', datos);
        setEdicion(null);
        aviso.ok(data.message);
        listado.recargar();
    };

    const darDeBaja = async () => {
        try {
            const { data } = await api.delete(`/usuarios/${baja.id}`);
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
        setBaja(null);
    };

    return (
        <>
            <Encabezado titulo="Usuarios" descripcion="CU1 · Administradores, personal de FEDER, productores y clientes">
                {puede('usuarios', 'crear') && (
                    <button type="button" className="btn-primario" onClick={() => setEdicion({ estado: 'activo', rol_id: '', password: '' })}><Plus className="size-4" /> Nuevo usuario</button>
                )}
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <BarraFiltros listado={listado} placeholder="Nombre, correo o CI">
                    <FiltroSelect etiqueta="Rol" valor={listado.filtros.rol_id} onChange={(v) => listado.setFiltro('rol_id', v)} opciones={opcionesRol} />
                    <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
                </BarraFiltros>
                <TablaDatos
                    listado={listado}
                    columnas={[
                        { titulo: 'Usuario', render: (u) => <><p className="font-medium">{u.nombre} {u.apellido}</p><p className="text-xs text-suave">{u.email}</p></> },
                        { titulo: 'Rol', render: (u) => <Insignia color={u.rol === 'Administrador' ? 'peligro' : u.rol === 'Personal' ? 'info' : u.rol === 'Productor' ? 'acento' : 'primario'}>{u.rol}</Insignia> },
                        { titulo: 'CI', campo: 'ci' },
                        { titulo: 'Teléfono', campo: 'telefono' },
                        { titulo: 'Emprendimiento', campo: 'emprendimiento' },
                        { titulo: 'Registro', render: (u) => fecha(u.fecha_registro) },
                        { titulo: 'Estado', render: (u) => <Estado valor={u.estado} /> },
                        {
                            titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (u) => (
                                <>
                                    {puede('usuarios', 'editar') && (
                                        <button type="button" className="btn-fantasma btn-sm" aria-label={`Editar ${u.nombre}`} onClick={() => setEdicion({ ...u, rol_id: String(u.rol_id), ci: u.ci ?? '', telefono: u.telefono ?? '', direccion: u.direccion ?? '', password: '' })}><Pencil className="size-4" /></button>
                                    )}
                                    {puede('usuarios', 'eliminar') && u.estado === 'activo' && u.id !== yo.id && (
                                        <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label={`Dar de baja a ${u.nombre}`} onClick={() => setBaja(u)}><UserX className="size-4" /></button>
                                    )}
                                </>
                            ),
                        },
                    ]}
                />
            </section>
            <FormularioModal
                abierto={!!edicion}
                titulo={edicion?.id ? `Editar usuario: ${edicion.nombre}` : 'Nuevo usuario'}
                esquema={edicion?.id ? esquemaEditar : esquemaNuevo}
                campos={campos}
                valores={edicion ?? {}}
                onCerrar={() => setEdicion(null)}
                onGuardar={guardar}
            />
            <Confirmar abierto={!!baja} titulo="Dar de baja usuario" mensaje={`¿Dar de baja a ${baja?.nombre} ${baja?.apellido}? Su cuenta quedará inactiva y se cerrarán sus sesiones.`} onConfirmar={darDeBaja} onCerrar={() => setBaja(null)} textoConfirmar="Dar de baja" />
        </>
    );
}
