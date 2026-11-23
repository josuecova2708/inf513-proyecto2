import { useEffect, useRef, useState } from 'react';
import { Contrast, Moon, Palette, RotateCcw, Sun, SunMoon, Type } from 'lucide-react';
import { TEMAS, useTema } from '../contextos/TemaContext';

/** Selector de tema (Niños/Jóvenes/Adultos), modo Día/Noche/Auto, tamaño de fuente y contraste. */
export default function PanelAccesibilidad() {
    const t = useTema();
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
        const esc = (e) => e.key === 'Escape' && setAbierto(false);
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', esc);
        };
    }, []);

    const modos = [
        { id: 'dia', nombre: 'Día', icono: Sun },
        { id: 'noche', nombre: 'Noche', icono: Moon },
        { id: 'auto', nombre: 'Auto', icono: SunMoon },
    ];

    return (
        <div ref={ref} className="relative flex items-center gap-1">
            <button
                type="button"
                className="btn-fantasma btn-sm"
                onClick={t.alternarModo}
                aria-label={t.modoEfectivo === 'dia' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
                title={t.modoEfectivo === 'dia' ? 'Modo noche' : 'Modo día'}
            >
                {t.modoEfectivo === 'dia' ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </button>
            <button
                type="button"
                className="btn-fantasma btn-sm"
                onClick={() => setAbierto((a) => !a)}
                aria-expanded={abierto}
                aria-haspopup="dialog"
                aria-label="Apariencia y accesibilidad"
                title="Apariencia y accesibilidad"
            >
                <Palette className="size-5" />
            </button>
            {abierto && (
                <div role="dialog" aria-label="Apariencia y accesibilidad" className="tarjeta absolute right-0 top-full z-50 mt-2 w-80 space-y-4 p-4 shadow-xl">
                    <fieldset>
                        <legend className="etiqueta flex items-center gap-1.5"><Palette className="size-4" /> Tema según edad</legend>
                        <div className="grid grid-cols-3 gap-2">
                            {TEMAS.map((tema) => (
                                <button
                                    key={tema.id}
                                    type="button"
                                    onClick={() => t.setTema(tema.id)}
                                    aria-pressed={t.tema === tema.id}
                                    title={tema.descripcion}
                                    className={`btn btn-sm border ${t.tema === tema.id ? 'border-primario bg-primario text-sobre-primario' : 'border-borde bg-superficie'}`}
                                >
                                    {tema.nombre}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend className="etiqueta flex items-center gap-1.5"><SunMoon className="size-4" /> Modo</legend>
                        <div className="grid grid-cols-3 gap-2">
                            {modos.map(({ id, nombre, icono: I }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => t.setModo(id)}
                                    aria-pressed={t.modo === id}
                                    className={`btn btn-sm border ${t.modo === id ? 'border-primario bg-primario text-sobre-primario' : 'border-borde bg-superficie'}`}
                                >
                                    <I className="size-4" /> {nombre}
                                </button>
                            ))}
                        </div>
                        {t.modo === 'auto' && (
                            <p className="mt-1 text-xs text-suave">Automático: día de 07:00 a 19:00, noche el resto (ahora: {t.modoEfectivo === 'dia' ? 'día' : 'noche'}).</p>
                        )}
                    </fieldset>

                    <div>
                        <label htmlFor="tamano-fuente" className="etiqueta flex items-center gap-1.5">
                            <Type className="size-4" /> Tamaño de letra: {t.tamano_fuente}px
                        </label>
                        <div className="flex items-center gap-2">
                            <button type="button" className="btn-secundario btn-sm" onClick={() => t.setTamano(t.tamano_fuente - 1)} aria-label="Reducir letra">A−</button>
                            <input
                                id="tamano-fuente"
                                type="range"
                                min="14"
                                max="22"
                                step="1"
                                value={t.tamano_fuente}
                                onChange={(e) => t.setTamano(e.target.value)}
                                className="w-full accent-[var(--c-primario)]"
                                aria-valuetext={`${t.tamano_fuente} píxeles`}
                            />
                            <button type="button" className="btn-secundario btn-sm" onClick={() => t.setTamano(t.tamano_fuente + 1)} aria-label="Aumentar letra">A+</button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="etiqueta mb-0 flex items-center gap-1.5"><Contrast className="size-4" /> Alto contraste</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={t.contraste === 'alto'}
                            onClick={() => t.setContraste(t.contraste === 'alto' ? 'normal' : 'alto')}
                            className={`relative h-6 w-11 rounded-full border border-borde transition-colors ${t.contraste === 'alto' ? 'bg-primario' : 'bg-superficie-2'}`}
                        >
                            <span className="sr-only">Alternar alto contraste</span>
                            <span className={`absolute top-0.5 size-4.5 rounded-full bg-superficie shadow transition-all ${t.contraste === 'alto' ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                    </div>

                    <button type="button" className="btn-fantasma btn-sm w-full" onClick={t.restablecer}>
                        <RotateCcw className="size-4" /> Restablecer apariencia
                    </button>
                </div>
            )}
        </div>
    );
}
