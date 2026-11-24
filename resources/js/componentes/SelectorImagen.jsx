import { useEffect, useState } from 'react';
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { reducirImagen, validarImagen } from '../utils/imagen';

/**
 * Selector de imagen con vista previa. Valida (JPG/PNG/WEBP, máx. 10 MB) y reduce la foto
 * en el navegador antes de entregarla con onElegir(file).
 *  - actual: URL de la imagen guardada (o null)
 *  - archivo: archivo ya elegido y aún no guardado (o null)
 *  - vacio: contenido a mostrar sin imagen
 */
export default function SelectorImagen({ actual, archivo, onElegir, onQuitar, vacio, alto = 'h-40', etiqueta = 'Elegir imagen' }) {
    const [error, setError] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [vistaArchivo, setVistaArchivo] = useState(null);

    useEffect(() => {
        if (!archivo) return setVistaArchivo(null);
        const url = URL.createObjectURL(archivo);
        setVistaArchivo(url);
        return () => URL.revokeObjectURL(url);
    }, [archivo]);

    const elegir = async (e) => {
        const a = e.target.files?.[0];
        e.target.value = '';
        setError('');
        if (!a) return;
        const mensaje = validarImagen(a);
        if (mensaje) return setError(mensaje);
        setProcesando(true);
        onElegir(await reducirImagen(a));
        setProcesando(false);
    };

    const vista = vistaArchivo ?? actual;
    return (
        <div className="space-y-2">
            <div className="tarjeta overflow-hidden">
                {vista ? <img src={vista} alt="Vista previa de la imagen" className={`${alto} w-full object-cover`} /> : vacio}
            </div>
            <label className={`btn-secundario btn-sm w-full cursor-pointer ${procesando ? 'pointer-events-none opacity-60' : ''}`}>
                {procesando ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {procesando ? 'Optimizando…' : etiqueta}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={elegir} />
            </label>
            {vista && onQuitar && <button type="button" className="btn-fantasma btn-sm w-full text-peligro" onClick={onQuitar}><Trash2 className="size-4" /> Quitar imagen</button>}
            {error && <p className="text-sm text-peligro" role="alert">{error}</p>}
            <p className="text-xs text-suave">JPG, PNG o WEBP · hasta 10 MB (se optimiza automáticamente)</p>
        </div>
    );
}
