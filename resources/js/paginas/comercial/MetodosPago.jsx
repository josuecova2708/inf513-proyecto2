import { useState } from 'react';
import { CreditCard, Landmark, LoaderCircle, Plus, Star, Trash2 } from 'lucide-react';
import api from '../../api/cliente';
import { Alerta, Campo, Cargando, Confirmar, Encabezado, Estado, Insignia, Modal, Vacio } from '../../componentes/ui';
import { useAuth } from '../../contextos/AuthContext';
import useFormulario from '../../hooks/useFormulario';
import useListado, { useAviso } from '../../hooks/useListado';
import { luhnValido, texto, z } from '../../validacion/esquemas';

const anioActual = new Date().getFullYear();
const mesActual = new Date().getMonth() + 1;

const esquemaTarjeta = z.object({
    alias: texto('alias', { min: 2, max: 50 }),
    titular: texto('titular', { min: 3, max: 120 }).regex(/^[\p{L}\s'.-]+$/u, 'El titular solo puede contener letras y espacios.'),
    numero_tarjeta: z.string().trim().regex(/^[\d\s-]{13,23}$/, 'El número de tarjeta debe tener entre 13 y 19 dígitos.').refine(luhnValido, 'El número de tarjeta no es válido (verificación Luhn).'),
    mes_venc: z.coerce.number({ error: 'Indique el mes.' }).int().min(1, 'Mes inválido.').max(12, 'Mes inválido.'),
    anio_venc: z.coerce.number({ error: 'Indique el año.' }).int().min(anioActual, 'La tarjeta está vencida.').max(anioActual + 15, 'Año inválido.'),
    cvv: z.string().regex(/^\d{3,4}$/, 'El CVV debe tener 3 o 4 dígitos.'),
    predeterminado: z.boolean().optional(),
}).refine((d) => d.anio_venc > anioActual || d.mes_venc >= mesActual, { path: ['mes_venc'], message: 'La tarjeta está vencida.' });

const esquemaCuenta = z.object({
    alias: texto('alias', { min: 2, max: 50 }),
    titular: texto('titular', { min: 3, max: 120 }).regex(/^[\p{L}\s'.-]+$/u, 'El titular solo puede contener letras y espacios.'),
    banco: texto('banco', { min: 2, max: 80 }),
    numero_cuenta: z.string().trim().regex(/^\d{6,20}$/, 'El número de cuenta debe tener entre 6 y 20 dígitos.'),
    predeterminado: z.boolean().optional(),
});

function FormMetodo({ tipo, metodoId, onCerrar, onGuardado }) {
    const esTarjeta = tipo === 'Tarjeta';
    const f = useFormulario(esTarjeta ? esquemaTarjeta : esquemaCuenta, esTarjeta
        ? { alias: '', titular: '', numero_tarjeta: '', mes_venc: '', anio_venc: '', cvv: '', predeterminado: false }
        : { alias: '', titular: '', banco: '', numero_cuenta: '', predeterminado: false });
    const enviar = f.enviar(async (d) => {
        const { data } = await api.post('/mis-metodos-pago', { ...d, metodo_pago_id: metodoId });
        onGuardado(data.message);
    });
    const numero = f.watch('numero_tarjeta') ?? '';
    const marca = /^4/.test(numero) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(numero) ? 'Mastercard' : /^3[47]/.test(numero) ? 'American Express' : '';

    return (
        <Modal abierto titulo={esTarjeta ? 'Registrar tarjeta' : 'Registrar cuenta bancaria'} onCerrar={onCerrar} pie={
            <><button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
                <button type="submit" form="form-metodo" className="btn-primario" disabled={f.enviando}>{f.enviando && <LoaderCircle className="size-4 animate-spin" />} Guardar</button></>
        }>
            <form id="form-metodo" onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
                {f.errorGeneral && <div className="sm:col-span-2"><Alerta tipo="error">{f.errorGeneral}</Alerta></div>}
                <Campo etiqueta="Alias" placeholder={esTarjeta ? 'Mi Visa' : 'Cuenta sueldo'} requerido {...f.campo('alias')} />
                <Campo etiqueta="Titular" requerido autoComplete="cc-name" {...f.campo('titular')} />
                {esTarjeta ? (
                    <>
                        <div className="sm:col-span-2"><Campo etiqueta={`Número de tarjeta${marca ? ` · ${marca}` : ''}`} inputMode="numeric" autoComplete="cc-number" maxLength={23} requerido ayuda="Simulado: no se guarda el número completo. Prueba: 4111 1111 1111 1111 (aprobada), 4000 0000 0000 0002 (fondos insuficientes)." {...f.campo('numero_tarjeta')} /></div>
                        <Campo etiqueta="Mes de vencimiento" como="select" requerido opciones={[{ value: '', label: 'Mes' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, '0') }))]} {...f.campo('mes_venc')} />
                        <Campo etiqueta="Año de vencimiento" como="select" requerido opciones={[{ value: '', label: 'Año' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(anioActual + i), label: String(anioActual + i) }))]} {...f.campo('anio_venc')} />
                        <Campo etiqueta="CVV" tipo="password" inputMode="numeric" maxLength={4} autoComplete="cc-csc" requerido ayuda="Solo se valida, nunca se guarda." {...f.campo('cvv')} />
                    </>
                ) : (
                    <>
                        <Campo etiqueta="Banco" requerido placeholder="Banco Unión" {...f.campo('banco')} />
                        <Campo etiqueta="Número de cuenta" inputMode="numeric" requerido {...f.campo('numero_cuenta')} />
                    </>
                )}
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="size-4 accent-[var(--c-primario)]" {...f.register('predeterminado')} /> Usar como método predeterminado</label>
            </form>
        </Modal>
    );
}

/** Métodos de pago asociados al usuario (tarjetas simuladas y cuentas bancarias). */
export default function MetodosPago() {
    const { puede, esStaff } = useAuth();
    const listado = useListado('/mis-metodos-pago', esStaff ? { todos: 1 } : {}, { paginado: false });
    const aviso = useAviso();
    const [nuevo, setNuevo] = useState(null);
    const [borrar, setBorrar] = useState(null);
    const [metodos, setMetodos] = useState(null);

    const abrir = async (tipo) => {
        const lista = metodos ?? (await api.get('/metodos-pago')).data;
        setMetodos(lista);
        setNuevo({ tipo, id: lista.find((m) => m.nombre === tipo)?.id });
    };
    const predeterminar = async (m) => {
        try {
            const { data } = await api.put(`/mis-metodos-pago/${m.id}`, { alias: m.alias, predeterminado: true });
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
    };
    const eliminar = async () => {
        try {
            const { data } = await api.delete(`/mis-metodos-pago/${borrar.id}`);
            aviso.ok(data.message);
            listado.recargar();
        } catch (e) {
            aviso.error(e);
        }
        setBorrar(null);
    };

    return (
        <>
            <Encabezado titulo={esStaff ? 'Métodos de pago de usuarios' : 'Mis métodos de pago'} descripcion="Tarjetas y cuentas registradas (simuladas: solo se guardan los últimos 4 dígitos)">
                {puede('metodos_pago', 'crear') && (
                    <>
                        <button type="button" className="btn-primario" onClick={() => abrir('Tarjeta')}><CreditCard className="size-4" /> Agregar tarjeta</button>
                        <button type="button" className="btn-secundario" onClick={() => abrir('Transferencia')}><Landmark className="size-4" /> Agregar cuenta</button>
                    </>
                )}
            </Encabezado>
            <div className="mb-4"><Alerta tipo={aviso.aviso.tipo} onCerrar={aviso.limpiar}>{aviso.aviso.texto}</Alerta></div>
            {listado.cargando ? <Cargando /> : !listado.datos.length ? (
                <Vacio texto="No tienes métodos de pago registrados.">{puede('metodos_pago', 'crear') && <button type="button" className="btn-primario btn-sm" onClick={() => abrir('Tarjeta')}><Plus className="size-4" /> Agregar tarjeta</button>}</Vacio>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {listado.datos.map((m) => (
                        <article key={m.id} className={`tarjeta relative overflow-hidden p-5 ${m.estado !== 'activo' ? 'opacity-60' : ''}`}>
                            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primario to-acento" aria-hidden="true" />
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">{m.tipo === 'Tarjeta' ? <CreditCard className="size-6 text-primario" /> : <Landmark className="size-6 text-primario" />}<span className="font-semibold">{m.alias}</span></div>
                                {m.predeterminado ? <Insignia color="primario"><Star className="size-3" /> Predeterminado</Insignia> : <Estado valor={m.estado} />}
                            </div>
                            <p className="mt-4 font-mono text-xl tracking-widest">•••• •••• •••• {m.ultimos4}</p>
                            <div className="mt-2 flex justify-between text-sm text-suave">
                                <span>{m.titular}</span>
                                <span>{m.tipo === 'Tarjeta' ? `${m.marca} · ${String(m.mes_venc).padStart(2, '0')}/${m.anio_venc}` : m.banco}</span>
                            </div>
                            {esStaff && <p className="mt-1 text-xs text-suave">Usuario: {m.usuario}</p>}
                            {!esStaff && m.estado === 'activo' && (
                                <div className="mt-4 flex gap-2">
                                    {!m.predeterminado && puede('metodos_pago', 'editar') && <button type="button" className="btn-secundario btn-sm" onClick={() => predeterminar(m)}><Star className="size-4" /> Predeterminar</button>}
                                    {puede('metodos_pago', 'eliminar') && <button type="button" className="btn-fantasma btn-sm ml-auto text-peligro" onClick={() => setBorrar(m)}><Trash2 className="size-4" /> Eliminar</button>}
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
            {nuevo && <FormMetodo tipo={nuevo.tipo} metodoId={nuevo.id} onCerrar={() => setNuevo(null)} onGuardado={(msg) => { setNuevo(null); aviso.ok(msg); listado.recargar(); }} />}
            <Confirmar abierto={!!borrar} titulo="Eliminar método de pago" mensaje={`¿Eliminar “${borrar?.alias}” (•••• ${borrar?.ultimos4})?`} onConfirmar={eliminar} onCerrar={() => setBorrar(null)} textoConfirmar="Eliminar" />
        </>
    );
}
