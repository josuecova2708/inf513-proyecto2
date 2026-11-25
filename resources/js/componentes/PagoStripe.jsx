import { useMemo, useState } from 'react';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Lock, LoaderCircle } from 'lucide-react';
import api, { erroresCampos, mensajeError, STRIPE_KEY } from '../api/cliente';
import { Alerta, Modal } from './ui';

/**
 * Integración con Stripe (modo prueba). El número de tarjeta y el CVC se escriben en un iframe de Stripe:
 * nunca pasan por el código de FEDER ni por nuestro servidor (requisito PCI).
 * Este módulo se carga con lazy() solo cuando se registra una tarjeta o hay que completar 3D Secure.
 */
let promesaStripe = null;
const obtenerStripe = () => (promesaStripe ??= loadStripe(STRIPE_KEY, { locale: 'es' }));

/** Completa el 3D Secure que pide el banco. Devuelve un mensaje de error o '' si el cliente lo completó. */
export async function completarAutenticacion(clientSecret) {
    const stripe = await obtenerStripe();
    const { error } = await stripe.handleNextAction({ clientSecret });
    return error ? (error.message ?? 'No se pudo completar la verificación del banco.') : '';
}

const variable = (nombre, defecto) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || defecto;

function Formulario({ metodoId, onCerrar, onGuardado }) {
    const stripe = useStripe();
    const elements = useElements();
    const [d, setD] = useState({ alias: '', titular: '', predeterminado: false });
    const [errores, setErrores] = useState({});
    const [error, setError] = useState('');
    const [tarjetaCompleta, setTarjetaCompleta] = useState(false);
    const [enviando, setEnviando] = useState(false);
    // El iframe de Stripe no hereda el CSS: se le pasan los colores del tema activo
    const opciones = useMemo(() => ({
        hidePostalCode: true,
        disableLink: true, // sin el botón "Guardar con Link" de Stripe
        style: {
            base: { color: variable('--c-texto', '#1d2a21'), fontSize: '16px', fontFamily: 'system-ui, sans-serif', '::placeholder': { color: variable('--c-suave', '#6b7280') } },
            invalid: { color: variable('--c-peligro', '#b42318') },
        },
    }), []);

    const validar = () => {
        const e = {};
        if (d.alias.trim().length < 2) e.alias = 'El alias debe tener al menos 2 caracteres.';
        if (d.titular.trim().length < 3) e.titular = 'El titular debe tener al menos 3 caracteres.';
        else if (!/^[\p{L}\s'.-]+$/u.test(d.titular)) e.titular = 'El titular solo puede contener letras y espacios.';
        if (!tarjetaCompleta) e.tarjeta = 'Complete el número, el vencimiento y el CVC de la tarjeta.';
        setErrores(e);
        return !Object.keys(e).length;
    };

    const guardar = async (ev) => {
        ev.preventDefault();
        if (!stripe || !elements || !validar()) return;
        setEnviando(true);
        setError('');
        try {
            // 1) FEDER pide un SetupIntent  2) el navegador registra la tarjeta directamente en Stripe
            const { data } = await api.post('/mis-metodos-pago/setup-intent');
            const { error: e, setupIntent } = await stripe.confirmCardSetup(data.client_secret, {
                payment_method: { card: elements.getElement(CardElement), billing_details: { name: d.titular.trim() } },
            });
            if (e) {
                setError(e.message ?? 'La tarjeta fue rechazada.');
                return;
            }
            // 3) FEDER guarda solo el identificador pm_… (marca y últimos 4 dígitos los lee de Stripe)
            const r = await api.post('/mis-metodos-pago', { ...d, metodo_pago_id: metodoId, payment_method_id: setupIntent.payment_method });
            onGuardado(r.data.message);
        } catch (e) {
            setErrores(erroresCampos(e));
            setError(mensajeError(e));
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Modal abierto titulo="Registrar tarjeta" onCerrar={onCerrar} pie={
            <><button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
                <button type="submit" form="form-stripe" className="btn-primario" disabled={enviando || !stripe}>{enviando && <LoaderCircle className="size-4 animate-spin" />} Guardar tarjeta</button></>
        }>
            <form id="form-stripe" onSubmit={guardar} noValidate className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Alerta tipo="error">{error}</Alerta></div>
                <div>
                    <label htmlFor="st-alias" className="etiqueta">Alias <span className="text-peligro">*</span></label>
                    <input id="st-alias" className={`campo ${errores.alias ? 'campo-error' : ''}`} maxLength={50} placeholder="Mi Visa" value={d.alias} onChange={(e) => setD({ ...d, alias: e.target.value })} />
                    {errores.alias && <p className="mt-1 text-sm text-peligro">{errores.alias}</p>}
                </div>
                <div>
                    <label htmlFor="st-titular" className="etiqueta">Titular <span className="text-peligro">*</span></label>
                    <input id="st-titular" className={`campo ${errores.titular ? 'campo-error' : ''}`} maxLength={120} autoComplete="cc-name" value={d.titular} onChange={(e) => setD({ ...d, titular: e.target.value })} />
                    {errores.titular && <p className="mt-1 text-sm text-peligro">{errores.titular}</p>}
                </div>
                <div className="sm:col-span-2">
                    <p className="etiqueta">Datos de la tarjeta <span className="text-peligro">*</span></p>
                    <div className={`campo py-3 ${errores.tarjeta ? 'campo-error' : ''}`}>
                        <CardElement options={opciones} onChange={(e) => { setTarjetaCompleta(e.complete); setErrores((x) => ({ ...x, tarjeta: e.error?.message })); }} />
                    </div>
                    {errores.tarjeta && <p className="mt-1 text-sm text-peligro">{errores.tarjeta}</p>}
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-suave">
                        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>Procesado por Stripe (modo prueba): FEDER no ve ni guarda el número ni el CVC. Pruebe con 4242 4242 4242 4242 (aprobada), 4000 0000 0000 0341 (se registra pero el cobro se rechaza), 4000 0000 0000 9995 (sin fondos: se rechaza al registrar) o 4000 0025 0000 3155 (pide 3D Secure), con cualquier fecha futura y CVC.</span>
                    </p>
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="size-4 accent-[var(--c-primario)]" checked={d.predeterminado} onChange={(e) => setD({ ...d, predeterminado: e.target.checked })} /> Usar como método predeterminado</label>
            </form>
        </Modal>
    );
}

/** Modal para registrar una tarjeta con Stripe Elements. */
export default function FormTarjetaStripe(props) {
    return <Elements stripe={obtenerStripe()} options={{ locale: 'es' }}><Formulario {...props} /></Elements>;
}
