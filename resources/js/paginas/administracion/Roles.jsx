import { useEffect, useState } from 'react';
import { LoaderCircle, Save, ShieldCheck } from 'lucide-react';
import api from '../../api/cliente';
import { Alerta, Cargando, Encabezado } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import { useAviso } from '../../hooks/useListado';

const ACCIONES = ['ver', 'crear', 'editar', 'eliminar'];

/** CU1: matriz de acceso rol × módulo × acción (define también el menú dinámico). */
export default function Roles() {
    const { puede, recargar, usuario } = useAuth();
    const [roles, setRoles] = useState([]);
    const [rolId, setRolId] = useState(null);
    const [matriz, setMatriz] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const aviso = useAviso();
    const editable = puede('roles', 'editar');

    useEffect(() => {
        api.get('/roles').then(({ data }) => {
            setRoles(data);
            setRolId(data[0]?.id ?? null);
        });
    }, []);

    useEffect(() => {
        if (!rolId) return;
        setMatriz(null);
        api.get(`/roles/${rolId}/permisos`).then(({ data }) => setMatriz(data.permisos)).catch((e) => aviso.error(e));
    }, [rolId]); // eslint-disable-line react-hooks/exhaustive-deps

    const alternar = (i, accion) => {
        setMatriz((m) => m.map((p, j) => {
            if (j !== i) return p;
            const n = { ...p, [accion]: !p[accion] };
            if (accion !== 'ver' && n[accion]) n.ver = true; // cualquier acción exige "ver"
            if (accion === 'ver' && !n.ver) ACCIONES.forEach((a) => { n[a] = false; });
            return n;
        }));
    };

    const guardar = async () => {
        setGuardando(true);
        try {
            const { data } = await api.put(`/roles/${rolId}/permisos`, {
                permisos: matriz.map((p) => ({ permiso_id: p.id, ver: !!p.ver, crear: !!p.crear, editar: !!p.editar, eliminar: !!p.eliminar })),
            });
            aviso.ok(data.message);
            if (rolId === usuario.rol_id) recargar();
        } catch (e) {
            aviso.error(e);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <>
            <Encabezado titulo="Roles y permisos" descripcion="CU1 · Matriz de acceso por recurso. El menú de cada rol se genera desde esta matriz.">
                {editable && matriz && (
                    <button type="button" className="btn-primario" onClick={guardar} disabled={guardando}>
                        {guardando ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar permisos
                    </button>
                )}
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Roles">
                {roles.map((r) => (
                    <button key={r.id} type="button" role="tab" aria-selected={rolId === r.id} onClick={() => setRolId(r.id)}
                        className={`btn border ${rolId === r.id ? 'border-primario bg-primario text-sobre-primario' : 'border-borde bg-superficie'}`}>
                        <ShieldCheck className="size-4" /> {r.nombre} <span className="text-xs opacity-80">({r.usuarios})</span>
                    </button>
                ))}
            </div>
            <section className="tarjeta overflow-x-auto">
                {!matriz ? <Cargando /> : (
                    <table className="tabla">
                        <thead>
                            <tr>
                                <th scope="col">Módulo</th>
                                {ACCIONES.map((a) => <th key={a} scope="col" className="text-center capitalize">{a}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {matriz.map((p, i) => (
                                <tr key={p.id}>
                                    <td><p className="font-medium">{p.nombre}</p><p className="font-mono text-xs text-suave">{p.modulo}</p></td>
                                    {ACCIONES.map((a) => (
                                        <td key={a} className="text-center">
                                            <input type="checkbox" className="size-5 accent-[var(--c-primario)]" checked={!!p[a]} disabled={!editable}
                                                onChange={() => alternar(i, a)} aria-label={`${a} en ${p.nombre}`} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </>
    );
}
