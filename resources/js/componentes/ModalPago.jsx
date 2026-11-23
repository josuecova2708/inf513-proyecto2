import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CreditCard, Landmark, LoaderCircle, QrCode } from 'lucide-react';
import api, { mensajeError } from '../api/cliente';
import { useAuth } from '../contextos/AuthContext';
import { moneda } from '../utils/formato';
import { Alerta, Modal } from './ui';

const ICONOS = { QR: QrCode, Efectivo: Banknote, Tarjeta: CreditCard, Transferencia: Landmark };

/**
 * Pago de un pedido (monto total/parcial) o de una cuota (monto fijo).
 * El cliente paga con sus tarjetas guardadas, QR o transferencia; el personal registra efectivo, QR o transferencia.
 */
export default function ModalPago({ titulo, montoMaximo, montoFijo = false, numeroPedido, onPagar, onCerrar }) {
    const { esStaff } = useAuth();
    const [metodos, setMetodos] = useState([]);
    const [tarjetas, setTarjetas] = useState([]);
    const [metodo, setMetodo] = useState(null);
    const [tarjeta, setTarjeta] = useState('');
    const [monto, setMonto] = useState(String(montoMaximo));
    const [referencia, setReferencia] = useState('');
    const [error, setError] = useState('');
    const [resultado, setResultado] = useState(null);
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        api.get('/metodos-pago').then(({ data }) => {
            const lista = esStaff ? data.filter((m) => m.nombre !== 'Tarjeta') : data;
            setMetodos(lista);
            setMetodo(lista[0] ?? null);
        });
        if (!esStaff) {
            api.get('/mis-metodos-pago', { params: { activos: 1 } }).then(({ data }) => {
                const ts = data.filter((t) => t.tipo === 'Tarjeta');
                setTarjetas(ts);
                setTarjeta(String(ts.find((t) => t.predeterminado)?.id ?? ts[0]?.id ?? ''));
            }).catch(() => {});
        }
    }, [esStaff]);

    const pagar = async () => {
        setError('');
        const m = Number(monto);
        if (!montoFijo && (!monto || Number.isNaN(m) || m <= 0)) return setError('El monto debe ser mayor que 0.');
        if (!montoFijo && m > Number(montoMaximo) + 0.001) return setError(`El monto no puede superar el saldo (${moneda(montoMaximo)}).`);
        if (metodo?.nombre === 'Tarjeta' && !tarjeta) return setError('Seleccione una tarjeta registrada.');
        if (metodo?.nombre === 'Transferencia' && referencia.trim().length < 4) return setError('Indique el número de comprobante de la transferencia (mínimo 4 caracteres).');
        setEnviando(true);
        try {
            const r = await onPagar({
                metodo_pago_id: metodo.id,
                monto: montoFijo ? undefined : m,
                metodo_pago_usuario_id: metodo.nombre === 'Tarjeta' ? Number(tarjeta) : undefined,
                referencia: referencia.trim() || undefined,
            });
            setResultado(r);
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setEnviando(false);
        }
    };

    if (resultado) {
        return (
            <Modal abierto titulo="Resultado del pago" onCerrar={() => onCerrar(true)} pie={<button type="button" className="btn-primario" onClick={() => onCerrar(true)}>Aceptar</button>}>
                <Alerta tipo={resultado.estado === 'pagado' ? 'exito' : 'aviso'}>{resultado.message}</Alerta>
                {resultado.estado === 'pendiente' && metodo?.nombre === 'QR' && (
                    <div className="mt-4 text-center">
                        <img src={`${api.defaults.baseURL}/qr/activo/imagen`} alt="Código QR de cobro de FEDER" className="mx-auto w-56" />
                        <p className="mt-2 text-sm">Monto exacto: <strong>{moneda(montoFijo ? montoMaximo : monto)}</strong> · Glosa: <strong>{numeroPedido}</strong></p>
                    </div>
                )}
                <p className="mt-3 text-xs text-suave">Código de transacción: <span className="font-mono">{resultado.codigo_transaccion}</span></p>
            </Modal>
        );
    }

    return (
        <Modal abierto titulo={titulo} onCerrar={() => onCerrar(false)} pie={
            <>
                <button type="button" className="btn-secundario" onClick={() => onCerrar(false)}>Cancelar</button>
                <button type="button" className="btn-primario" onClick={pagar} disabled={enviando || !metodo}>{enviando && <LoaderCircle className="size-4 animate-spin" />} Pagar {moneda(montoFijo ? montoMaximo : monto || 0)}</button>
            </>
        }>
            <div className="space-y-4">
                <Alerta tipo="error">{error}</Alerta>
                <fieldset>
                    <legend className="etiqueta">Método de pago</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {metodos.map((m) => {
                            const I = ICONOS[m.nombre] ?? Banknote;
                            return (
                                <button key={m.id} type="button" aria-pressed={metodo?.id === m.id} onClick={() => setMetodo(m)}
                                    className={`btn flex-col border py-3 ${metodo?.id === m.id ? 'border-primario bg-primario/10 text-primario' : 'border-borde bg-superficie'}`}>
                                    <I className="size-6" /> <span className="text-sm">{m.nombre}</span>
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
                {!montoFijo && (
                    <div>
                        <label htmlFor="pago-monto" className="etiqueta">Monto a pagar (Bs.)</label>
                        <input id="pago-monto" type="number" min="0.01" step="0.01" max={montoMaximo} className="campo" value={monto} onChange={(e) => setMonto(e.target.value)} />
                        <p className="mt-1 text-xs text-suave">Saldo pendiente: {moneda(montoMaximo)}. Puede pagar una parte.</p>
                    </div>
                )}
                {metodo?.nombre === 'Tarjeta' && (
                    tarjetas.length ? (
                        <div>
                            <label htmlFor="pago-tarjeta" className="etiqueta">Tarjeta</label>
                            <select id="pago-tarjeta" className="campo" value={tarjeta} onChange={(e) => setTarjeta(e.target.value)}>
                                {tarjetas.map((t) => <option key={t.id} value={t.id}>{t.alias} · {t.marca} •••• {t.ultimos4} (vence {String(t.mes_venc).padStart(2, '0')}/{t.anio_venc})</option>)}
                            </select>
                        </div>
                    ) : <Alerta tipo="aviso">No tienes tarjetas registradas. <Link to="/panel/metodos-pago" className="font-semibold underline">Registra una aquí</Link>.</Alerta>
                )}
                {metodo?.nombre === 'QR' && <p className="text-sm text-suave">Se mostrará el QR de FEDER. El pago quedará pendiente hasta que FEDER confirme el abono.</p>}
                {metodo?.nombre === 'Efectivo' && <p className="text-sm text-suave">{esStaff ? 'El pago se registrará como cobrado.' : 'Pagarás al recibir o recoger tu pedido (quedará pendiente).'}</p>}
                {(metodo?.nombre === 'Transferencia' || metodo?.nombre === 'QR') && (
                    <div>
                        <label htmlFor="pago-ref" className="etiqueta">N.º de comprobante {metodo.nombre === 'QR' ? '(opcional)' : ''}</label>
                        <input id="pago-ref" className="campo" maxLength={100} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
                    </div>
                )}
            </div>
        </Modal>
    );
}
