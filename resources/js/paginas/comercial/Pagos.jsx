import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import api from '../../api/cliente';
import { BarraFiltros, FiltroSelect, TablaDatos } from '../../componentes/Crud';
import { Alerta, Confirmar, Encabezado, Estado } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useListado, { useAviso } from '../../hooks/useListado';
import { capitalizar, fechaHora, moneda } from '../../utils/formato';

/** CU6: pagos multicanal. El personal verifica los pagos QR, transferencias y efectivo contra entrega. */
export default function Pagos() {
    const { esStaff, puede } = useAuth();
    const listado = useListado('/pagos', { q: '', estado: '', metodo_pago_id: '' });
    const aviso = useAviso();
    const [metodos, setMetodos] = useState([]);
    const [verificar, setVerificar] = useState(null);

    useEffect(() => {
        api.get('/metodos-pago').then(({ data }) => setMetodos(data)).catch(() => {});
    }, []);

    const confirmar = async () => {
        try {
            const { data } = await api.put(`/pagos/${verificar.pago.id}/verificar`, { estado: verificar.estado });
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
        setVerificar(null);
    };

    return (
        <>
            <Encabezado titulo={esStaff ? 'Pagos' : 'Mis pagos'} descripcion="CU6 · Transacciones por QR, efectivo, tarjeta y transferencia (pasarela simulada)" />
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            <section className="tarjeta">
                <BarraFiltros listado={listado} placeholder="Pedido, transacción o cliente">
                    <FiltroSelect etiqueta="Estado" valor={listado.filtros.estado} onChange={(v) => listado.setFiltro('estado', v)} opciones={['pendiente', 'pagado', 'rechazado', 'anulado'].map((e) => ({ value: e, label: capitalizar(e) }))} />
                    <FiltroSelect etiqueta="Método" valor={listado.filtros.metodo_pago_id} onChange={(v) => listado.setFiltro('metodo_pago_id', v)} opciones={metodos.map((m) => ({ value: m.id, label: m.nombre }))} />
                </BarraFiltros>
                <TablaDatos listado={listado} vacio="No hay pagos registrados." columnas={[
                    { titulo: 'Fecha', render: (p) => <span className="whitespace-nowrap">{fechaHora(p.fecha)}</span> },
                    { titulo: 'Pedido', render: (p) => <Link to={`/panel/pedidos/${p.pedido_id}`} className="text-primario hover:underline">{p.numero}</Link> },
                    ...(esStaff ? [{ titulo: 'Cliente', campo: 'cliente' }] : []),
                    { titulo: 'Método', render: (p) => <>{p.metodo}{p.ultimos4 ? <span className="text-xs text-suave"> · {p.marca} •••• {p.ultimos4}</span> : ''}{p.cuota_numero ? <span className="text-xs text-suave"> · Cuota {p.cuota_numero}</span> : ''}</> },
                    { titulo: 'Monto', className: 'text-right', render: (p) => <strong>{moneda(p.monto)}</strong> },
                    { titulo: 'Referencia', render: (p) => <span className="text-xs">{p.referencia ?? '—'}</span> },
                    { titulo: 'Transacción', render: (p) => <span className="font-mono text-xs">{p.codigo_transaccion ?? '—'}</span> },
                    { titulo: 'Estado', render: (p) => <Estado valor={p.estado} /> },
                    { titulo: 'Verificar', className: 'text-right whitespace-nowrap', render: (p) => esStaff && puede('pagos', 'editar') && p.estado === 'pendiente' && (
                        <>
                            <button type="button" className="btn-primario btn-sm" onClick={() => setVerificar({ pago: p, estado: 'pagado' })}><Check className="size-4" /> Confirmar</button>
                            <button type="button" className="btn-fantasma btn-sm text-peligro" aria-label="Rechazar pago" onClick={() => setVerificar({ pago: p, estado: 'rechazado' })}><X className="size-4" /></button>
                        </>
                    ) },
                ]} />
            </section>
            <Confirmar abierto={!!verificar} peligro={verificar?.estado !== 'pagado'} titulo={verificar?.estado === 'pagado' ? 'Confirmar pago' : 'Rechazar pago'}
                mensaje={`¿${verificar?.estado === 'pagado' ? 'Confirmar que se recibió' : 'Rechazar'} el pago de ${moneda(verificar?.pago.monto)} del pedido ${verificar?.pago.numero}?`}
                onConfirmar={confirmar} onCerrar={() => setVerificar(null)} textoConfirmar={verificar?.estado === 'pagado' ? 'Confirmar' : 'Rechazar'} />
        </>
    );
}
