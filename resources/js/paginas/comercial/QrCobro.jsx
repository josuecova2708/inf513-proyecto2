import { useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import api, { mensajeError } from '../../api/cliente';
import { TablaDatos } from '../../componentes/Crud';
import { Alerta, Encabezado, Estado, Tarjeta } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { fechaHora } from '../../utils/formato';

/** CU6: QR de cobro de FEDER que ven los clientes al pagar por QR (imagen guardada en la BD). */
export default function QrCobro() {
    const { puede } = useAuth();
    const listado = useListado('/qr', {}, { paginado: false });
    const aviso = useAviso();
    const [archivo, setArchivo] = useState(null);
    const [subiendo, setSubiendo] = useState(false);
    const [version, setVersion] = useState(Date.now());

    const elegir = (e) => {
        const a = e.target.files?.[0];
        if (!a) return;
        if (!['image/png', 'image/jpeg'].includes(a.type)) return aviso.error('El QR debe ser una imagen PNG o JPG.');
        if (a.size > 2 * 1024 * 1024) return aviso.error('La imagen no puede pesar más de 2 MB.');
        aviso.limpiar();
        setArchivo(a);
    };
    const subir = async () => {
        setSubiendo(true);
        try {
            const fd = new FormData();
            fd.append('imagen', archivo);
            const { data } = await api.post('/qr', fd);
            aviso.ok(data.message);
            setArchivo(null);
            setVersion(Date.now());
            listado.recargar();
        } catch (e) {
            aviso.error(mensajeError(e));
        } finally {
            setSubiendo(false);
        }
    };

    return (
        <>
            <Encabezado titulo="QR de cobro" descripcion="Imagen QR que se muestra al cliente cuando elige pagar por QR. Si no hay ninguna cargada se usa un QR de demostración." />
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <div className="grid gap-6 lg:grid-cols-3">
                <Tarjeta titulo="QR activo">
                    <img src={`${api.defaults.baseURL}/qr/activo/imagen?v=${version}`} alt="QR de cobro activo" className="mx-auto w-56" />
                </Tarjeta>
                {puede('qr', 'crear') && (
                    <Tarjeta titulo="Subir nuevo QR">
                        <label className="btn-secundario w-full"><Upload className="size-4" /> Elegir imagen PNG/JPG<input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={elegir} /></label>
                        {archivo && (
                            <div className="mt-3 space-y-3 text-center">
                                <img src={URL.createObjectURL(archivo)} alt="Vista previa del nuevo QR" className="mx-auto w-40" />
                                <button type="button" className="btn-primario w-full" onClick={subir} disabled={subiendo}>{subiendo && <LoaderCircle className="size-4 animate-spin" />} Activar este QR</button>
                            </div>
                        )}
                        <p className="mt-3 text-xs text-suave">El QR anterior queda en el historial y deja de mostrarse.</p>
                    </Tarjeta>
                )}
                <section className="tarjeta lg:col-span-1">
                    <h2 className="border-b border-borde px-4 py-3 font-semibold">Historial</h2>
                    <TablaDatos listado={listado} vacio="Aún no se subió ningún QR." columnas={[
                        { titulo: 'Archivo', campo: 'nombre_archivo' },
                        { titulo: 'Fecha', render: (q) => fechaHora(q.fecha) },
                        { titulo: 'Estado', render: (q) => <Estado valor={q.activo ? 'activo' : 'inactivo'} /> },
                    ]} />
                </section>
            </div>
        </>
    );
}
