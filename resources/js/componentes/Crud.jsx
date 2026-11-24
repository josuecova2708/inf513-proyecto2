import { useEffect, useState } from 'react';
import { LoaderCircle, Search } from 'lucide-react';
import { Alerta, Campo, Cargando, Modal, Paginacion, Vacio } from './ui';
import useFormulario from '../hooks/useFormulario';

/** Barra de filtros: buscador con retardo + selects. */
export function BarraFiltros({ listado, buscar = true, placeholder = 'Buscar…', children }) {
    const [texto, setTexto] = useState(listado.filtros.q ?? '');
    useEffect(() => {
        const t = setTimeout(() => {
            if ((listado.filtros.q ?? '') !== texto.trim()) listado.setFiltro('q', texto.trim());
        }, 400);
        return () => clearTimeout(t);
    }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex flex-wrap items-end gap-3 border-b border-borde p-3">
            {buscar && (
                <div className="relative min-w-56 flex-1">
                    <label className="sr-only" htmlFor="filtro-buscar">Buscar</label>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-suave" aria-hidden="true" />
                    <input id="filtro-buscar" type="search" className="campo pl-9" maxLength={80} placeholder={placeholder} value={texto} onChange={(e) => setTexto(e.target.value)} />
                </div>
            )}
            {children}
        </div>
    );
}

export function FiltroSelect({ etiqueta, valor, onChange, opciones, todos = 'Todos' }) {
    return (
        <div className="min-w-40">
            <label className="etiqueta text-xs">{etiqueta}</label>
            <select className="campo" value={valor ?? ''} onChange={(e) => onChange(e.target.value)} aria-label={etiqueta}>
                <option value="">{todos}</option>
                {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

/**
 * Tabla de datos con estados de carga/vacío/error y paginación.
 * columnas: [{ titulo, campo | render(fila), className }]
 */
export function TablaDatos({ listado, columnas, vacio = 'No hay registros para mostrar.', claveFila = 'id' }) {
    if (listado.cargando && !listado.datos.length) return <Cargando />;
    if (listado.error) return <div className="p-4"><Alerta tipo="error">{listado.error}</Alerta></div>;
    if (!listado.datos.length) return <Vacio texto={vacio} />;
    return (
        <>
            <div className={`overflow-x-auto ${listado.cargando ? 'opacity-60' : ''}`}>
                <table className="tabla">
                    <thead>
                        <tr>{columnas.map((c, k) => <th key={`${k}-${c.titulo}`} scope="col" className={c.className}>{c.titulo}</th>)}</tr>
                    </thead>
                    <tbody>
                        {listado.datos.map((fila, i) => (
                            <tr key={fila[claveFila] ?? i}>
                                {columnas.map((c, k) => (
                                    <td key={`${k}-${c.titulo}`} className={c.className}>{c.render ? c.render(fila) : fila[c.campo] ?? '—'}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Paginacion meta={listado.meta} onCambiar={listado.setPagina} />
        </>
    );
}

/**
 * Formulario en modal a partir de una configuración de campos + esquema zod.
 * campos: [{ nombre, etiqueta, tipo, como, opciones, requerido, ayuda, ancho: 'completo' }]
 */
export function FormularioModal({ abierto, titulo, esquema, campos, valores, onCerrar, onGuardar, ancho = 'max-w-2xl', textoGuardar = 'Guardar' }) {
    return abierto ? (
        <FormularioInterno titulo={titulo} esquema={esquema} campos={campos} valores={valores} onCerrar={onCerrar} onGuardar={onGuardar} ancho={ancho} textoGuardar={textoGuardar} />
    ) : null;
}

function FormularioInterno({ titulo, esquema, campos, valores, onCerrar, onGuardar, ancho, textoGuardar }) {
    const f = useFormulario(esquema, valores);
    const enviar = f.enviar(async (datos) => {
        await onGuardar(datos);
    });
    return (
        <Modal
            abierto
            titulo={titulo}
            onCerrar={onCerrar}
            ancho={ancho}
            pie={
                <>
                    <button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
                    <button type="submit" form="form-crud" className="btn-primario" disabled={f.enviando}>
                        {f.enviando && <LoaderCircle className="size-4 animate-spin" />} {textoGuardar}
                    </button>
                </>
            }
        >
            <form id="form-crud" onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
                {f.errorGeneral && <div className="sm:col-span-2"><Alerta tipo="error">{f.errorGeneral}</Alerta></div>}
                {campos.filter((c) => !c.oculto).map((c) => (
                    <div key={c.nombre} className={c.ancho === 'completo' || c.como === 'textarea' ? 'sm:col-span-2' : ''}>
                        <Campo
                            etiqueta={c.etiqueta}
                            tipo={c.tipo}
                            como={c.como}
                            opciones={c.opciones}
                            requerido={c.requerido}
                            ayuda={c.ayuda}
                            disabled={c.deshabilitado}
                            step={c.step}
                            min={c.min}
                            max={c.max}
                            maxLength={c.maxLength}
                            placeholder={c.placeholder}
                            {...f.campo(c.nombre)}
                        />
                    </div>
                ))}
            </form>
        </Modal>
    );
}
