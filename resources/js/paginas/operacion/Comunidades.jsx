import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/cliente';
import { BarraFiltros, FormularioModal, TablaDatos } from '../../componentes/Crud';
import { Alerta, Confirmar, Encabezado } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { texto, textoOpcional, z } from '../../validacion/esquemas';

const esquema = z.object({
    nombre: texto('nombre', { min: 3, max: 100 }),
    municipio: texto('municipio', { min: 3, max: 80 }),
    provincia: textoOpcional('provincia', 80),
    departamento: texto('departamento', { max: 50 }),
    descripcion: textoOpcional('descripción', 1000),
});

const campos = [
    { nombre: 'nombre', etiqueta: 'Nombre de la comunidad', requerido: true, ancho: 'completo' },
    { nombre: 'municipio', etiqueta: 'Municipio', requerido: true },
    { nombre: 'provincia', etiqueta: 'Provincia' },
    { nombre: 'departamento', etiqueta: 'Departamento', requerido: true, como: 'select',
        opciones: ['Santa Cruz', 'Beni', 'Pando', 'La Paz', 'Cochabamba', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija'].map((d) => ({ value: d, label: d })) },
    { nombre: 'descripcion', etiqueta: 'Descripción / producción principal', como: 'textarea' },
];

/** CU2: comunidades agrícolas. */
export default function Comunidades() {
    const { puede } = useAuth();
    const listado = useListado('/comunidades', { q: '' });
    const aviso = useAviso();
    const [edicion, setEdicion] = useState(null);
    const [borrar, setBorrar] = useState(null);

    const guardar = async (d) => {
        const { data } = edicion.id ? await api.put(`/comunidades/${edicion.id}`, d) : await api.post('/comunidades', d);
        setEdicion(null);
        aviso.ok(data.message);
        listado.recargar();
    };

    const eliminar = async () => {
        try {
            const { data } = await api.delete(`/comunidades/${borrar.id}`);
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
        setBorrar(null);
    };

    return (
        <>
            <Encabezado titulo="Comunidades agrícolas" descripcion="CU2 · Comunidades de origen de los productores de FEDER">
                {puede('comunidades', 'crear') && <button type="button" className="btn-primario" onClick={() => setEdicion({ departamento: 'Santa Cruz' })}><Plus className="size-4" /> Nueva comunidad</button>}
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <BarraFiltros listado={listado} placeholder="Nombre, municipio o provincia" />
                <TablaDatos listado={listado} columnas={[
                    { titulo: 'Comunidad', render: (c) => <><p className="font-medium">{c.nombre}</p><p className="text-xs text-suave">{c.descripcion}</p></> },
                    { titulo: 'Municipio', campo: 'municipio' },
                    { titulo: 'Provincia', campo: 'provincia' },
                    { titulo: 'Departamento', campo: 'departamento' },
                    { titulo: 'Productores', campo: 'productores', className: 'text-center' },
                    { titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (c) => (
                        <>
                            {puede('comunidades', 'editar') && <button type="button" className="btn-fantasma btn-sm" aria-label={`Editar ${c.nombre}`} onClick={() => setEdicion({ ...c, provincia: c.provincia ?? '', descripcion: c.descripcion ?? '' })}><Pencil className="size-4" /></button>}
                            {puede('comunidades', 'eliminar') && <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label={`Eliminar ${c.nombre}`} onClick={() => setBorrar(c)}><Trash2 className="size-4" /></button>}
                        </>
                    ) },
                ]} />
            </section>
            <FormularioModal abierto={!!edicion} titulo={edicion?.id ? 'Editar comunidad' : 'Nueva comunidad'} esquema={esquema} campos={campos} valores={edicion ?? {}} onCerrar={() => setEdicion(null)} onGuardar={guardar} />
            <Confirmar abierto={!!borrar} titulo="Eliminar comunidad" mensaje={`¿Eliminar la comunidad “${borrar?.nombre}”?`} onConfirmar={eliminar} onCerrar={() => setBorrar(null)} textoConfirmar="Eliminar" />
        </>
    );
}
