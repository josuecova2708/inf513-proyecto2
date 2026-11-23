import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/cliente';
import { FormularioModal, TablaDatos } from '../../componentes/Crud';
import { Alerta, Confirmar, Encabezado } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { texto, textoOpcional, z } from '../../validacion/esquemas';

const esquema = z.object({ nombre: texto('nombre', { min: 3, max: 80 }), descripcion: textoOpcional('descripción', 200) });
const campos = [
    { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, ancho: 'completo' },
    { nombre: 'descripcion', etiqueta: 'Descripción', como: 'textarea', maxLength: 200 },
];

/** CU4: categorías del catálogo unificado. */
export default function Categorias() {
    const { puede } = useAuth();
    const listado = useListado('/categorias', {}, { paginado: false });
    const aviso = useAviso();
    const [edicion, setEdicion] = useState(null);
    const [borrar, setBorrar] = useState(null);

    const guardar = async (d) => {
        const { data } = edicion.id ? await api.put(`/categorias/${edicion.id}`, d) : await api.post('/categorias', d);
        setEdicion(null);
        aviso.ok(data.message);
        listado.recargar();
    };
    const eliminar = async () => {
        try {
            const { data } = await api.delete(`/categorias/${borrar.id}`);
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
        setBorrar(null);
    };

    return (
        <>
            <Encabezado titulo="Categorías" descripcion="CU4 · Clasificación del catálogo unificado">
                {puede('catalogo', 'crear') && <button type="button" className="btn-primario" onClick={() => setEdicion({})}><Plus className="size-4" /> Nueva categoría</button>}
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <TablaDatos listado={listado} columnas={[
                    { titulo: 'Categoría', render: (c) => <span className="font-medium">{c.nombre}</span> },
                    { titulo: 'Descripción', campo: 'descripcion' },
                    { titulo: 'Productos', campo: 'productos', className: 'text-center' },
                    { titulo: 'Acciones', className: 'text-right whitespace-nowrap', render: (c) => (
                        <>
                            {puede('catalogo', 'editar') && <button type="button" className="btn-fantasma btn-sm" aria-label={`Editar ${c.nombre}`} onClick={() => setEdicion({ ...c, descripcion: c.descripcion ?? '' })}><Pencil className="size-4" /></button>}
                            {puede('catalogo', 'eliminar') && <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label={`Eliminar ${c.nombre}`} onClick={() => setBorrar(c)}><Trash2 className="size-4" /></button>}
                        </>
                    ) },
                ]} />
            </section>
            <FormularioModal abierto={!!edicion} titulo={edicion?.id ? 'Editar categoría' : 'Nueva categoría'} esquema={esquema} campos={campos} valores={edicion ?? {}} onCerrar={() => setEdicion(null)} onGuardar={guardar} ancho="max-w-lg" />
            <Confirmar abierto={!!borrar} titulo="Eliminar categoría" mensaje={`¿Eliminar la categoría “${borrar?.nombre}”?`} onConfirmar={eliminar} onCerrar={() => setBorrar(null)} textoConfirmar="Eliminar" />
        </>
    );
}
