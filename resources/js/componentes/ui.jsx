import { Children, forwardRef, useEffect, useId, useRef } from 'react';
import { ChevronLeft, ChevronRight, Inbox, LoaderCircle, X } from 'lucide-react';
import { COLOR_ESTADO, etiquetaEstado } from '../utils/formato';

const COLORES = {
    exito: 'bg-exito/15 text-exito',
    peligro: 'bg-peligro/15 text-peligro',
    aviso: 'bg-aviso/15 text-aviso',
    info: 'bg-info/15 text-info',
    acento: 'bg-acento/20 text-texto',
    suave: 'bg-superficie-2 text-suave',
    primario: 'bg-primario/15 text-primario',
};

export function Insignia({ color = 'suave', children }) {
    return <span className={`insignia ${COLORES[color] ?? COLORES.suave}`}>{children}</span>;
}

export function Estado({ valor }) {
    return <Insignia color={COLOR_ESTADO[valor] ?? 'suave'}>{etiquetaEstado(valor)}</Insignia>;
}

/** true si los hijos no tienen nada visible (null, false, '' o solo espacios). */
const sinContenido = (children) => Children.toArray(children).every((c) => typeof c === 'string' && !c.trim());

export function Cargando({ texto = 'Cargando…', className = '' }) {
    return (
        <div role="status" className={`flex items-center justify-center gap-2 py-10 text-suave ${className}`}>
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> {texto}
        </div>
    );
}

export function Vacio({ texto = 'No hay registros para mostrar.', children }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-suave">
            <Inbox className="size-10 opacity-60" aria-hidden="true" />
            <p>{texto}</p>
            {children}
        </div>
    );
}

export function Alerta({ tipo = 'info', children, onCerrar }) {
    if (sinContenido(children)) return null;
    const estilos = {
        info: 'border-info/40 bg-info/10',
        exito: 'border-exito/40 bg-exito/10',
        error: 'border-peligro/40 bg-peligro/10 text-peligro',
        aviso: 'border-aviso/40 bg-aviso/10',
    };
    return (
        <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-tema border px-4 py-3 text-sm ${estilos[tipo]}`}>
            <div className="flex-1">{children}</div>
            {onCerrar && (
                <button type="button" onClick={onCerrar} className="opacity-70 hover:opacity-100" aria-label="Cerrar mensaje">
                    <X className="size-4" />
                </button>
            )}
        </div>
    );
}

export function Encabezado({ titulo, descripcion, children }) {
    return (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
                <h1 className="text-2xl font-bold">{titulo}</h1>
                {descripcion && <p className="mt-1 text-suave">{descripcion}</p>}
            </div>
            {children && <div className="flex flex-wrap gap-2">{children}</div>}
        </div>
    );
}

/** Campo de formulario con etiqueta y mensaje de error en español (accesible). */
export const Campo = forwardRef(function Campo(
    { etiqueta, error, ayuda, tipo = 'text', como = 'input', opciones, className = '', requerido, children, ...props },
    ref,
) {
    const id = useId();
    const clase = `campo ${error ? 'campo-error' : ''} ${className}`;
    const aria = { 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined };
    let control;
    if (como === 'select') {
        control = (
            <select id={id} ref={ref} className={clase} {...aria} {...props}>
                {opciones?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                {children}
            </select>
        );
    } else if (como === 'textarea') {
        control = <textarea id={id} ref={ref} rows={3} className={clase} {...aria} {...props} />;
    } else {
        control = <input id={id} ref={ref} type={tipo} className={clase} {...aria} {...props} />;
    }
    return (
        <div>
            {etiqueta && (
                <label htmlFor={id} className="etiqueta">
                    {etiqueta} {requerido && <span className="text-peligro" aria-hidden="true">*</span>}
                </label>
            )}
            {control}
            {error ? (
                <p id={`${id}-error`} className="mt-1 text-sm text-peligro">{error}</p>
            ) : ayuda ? (
                <p id={`${id}-ayuda`} className="mt-1 text-xs text-suave">{ayuda}</p>
            ) : null}
        </div>
    );
});

export function Modal({ abierto, titulo, onCerrar, children, ancho = 'max-w-lg', pie }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!abierto) return undefined;
        const previo = document.activeElement;
        ref.current?.querySelector('input,select,textarea,button')?.focus();
        const alTeclear = (e) => e.key === 'Escape' && onCerrar?.();
        document.addEventListener('keydown', alTeclear);
        return () => {
            document.removeEventListener('keydown', alTeclear);
            previo?.focus?.();
        };
    }, [abierto, onCerrar]);
    if (!abierto) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
            <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo} className={`tarjeta w-full ${ancho} my-8`}>
                <div className="flex items-center justify-between border-b border-borde px-5 py-3">
                    <h2 className="text-lg font-semibold">{titulo}</h2>
                    <button type="button" className="btn-fantasma btn-sm" onClick={onCerrar} aria-label="Cerrar">
                        <X className="size-5" />
                    </button>
                </div>
                <div className="px-5 py-4">{children}</div>
                {pie && <div className="flex justify-end gap-2 border-t border-borde px-5 py-3">{pie}</div>}
            </div>
        </div>
    );
}

export function Confirmar({ abierto, titulo = 'Confirmar acción', mensaje, onConfirmar, onCerrar, cargando, textoConfirmar = 'Confirmar', peligro = true }) {
    return (
        <Modal
            abierto={abierto}
            titulo={titulo}
            onCerrar={onCerrar}
            pie={
                <>
                    <button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
                    <button type="button" className={peligro ? 'btn-peligro' : 'btn-primario'} onClick={onConfirmar} disabled={cargando}>
                        {cargando && <LoaderCircle className="size-4 animate-spin" />} {textoConfirmar}
                    </button>
                </>
            }
        >
            <p>{mensaje}</p>
        </Modal>
    );
}

export function Paginacion({ meta, onCambiar }) {
    if (!meta || meta.last_page <= 1) return null;
    return (
        <nav className="flex items-center justify-between gap-2 px-3 py-3 text-sm text-suave" aria-label="Paginación">
            <span>
                Mostrando {meta.from}–{meta.to} de {meta.total}
            </span>
            <div className="flex items-center gap-1">
                <button type="button" className="btn-secundario btn-sm" disabled={meta.current_page <= 1} onClick={() => onCambiar(meta.current_page - 1)} aria-label="Página anterior">
                    <ChevronLeft className="size-4" />
                </button>
                <span className="px-2">Página {meta.current_page} de {meta.last_page}</span>
                <button type="button" className="btn-secundario btn-sm" disabled={meta.current_page >= meta.last_page} onClick={() => onCambiar(meta.current_page + 1)} aria-label="Página siguiente">
                    <ChevronRight className="size-4" />
                </button>
            </div>
        </nav>
    );
}

export function Tarjeta({ titulo, children, className = '', acciones }) {
    return (
        <section className={`tarjeta ${className}`}>
            {titulo && (
                <div className="flex items-center justify-between border-b border-borde px-4 py-3">
                    <h2 className="font-semibold">{titulo}</h2>
                    {acciones}
                </div>
            )}
            <div className="p-4">{children}</div>
        </section>
    );
}

export function Metrica({ titulo, valor, detalle, icono: IconoM, color = 'primario' }) {
    return (
        <div className="tarjeta flex items-center gap-4 p-4">
            {IconoM && (
                <div className={`rounded-tema p-3 ${COLORES[color]}`}>
                    <IconoM className="size-6" aria-hidden="true" />
                </div>
            )}
            <div className="min-w-0">
                <p className="text-sm text-suave">{titulo}</p>
                <p className="truncate text-2xl font-bold">{valor}</p>
                {detalle && <p className="text-xs text-suave">{detalle}</p>}
            </div>
        </div>
    );
}
