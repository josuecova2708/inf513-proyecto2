import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { BASE_PATH } from './api/cliente';
import { AuthProvider, useAuth } from './contextos/AuthContext';
import { TemaProvider } from './contextos/TemaContext';
import { CarritoProvider } from './contextos/CarritoContext';
import PublicLayout from './layouts/PublicLayout';
import PanelLayout from './layouts/PanelLayout';
import { Cargando } from './componentes/ui';
import Inicio from './paginas/publicas/Inicio';
import Catalogo from './paginas/publicas/Catalogo';
import ProductoDetalle from './paginas/publicas/ProductoDetalle';
import Login from './paginas/publicas/Login';
import Registro from './paginas/publicas/Registro';

const p = (f) => lazy(f);
const Carrito = p(() => import('./paginas/comercial/Carrito'));
const PanelInicio = p(() => import('./paginas/panel/PanelInicio'));
const Perfil = p(() => import('./paginas/panel/Perfil'));
const Dashboard = p(() => import('./paginas/administracion/Dashboard'));
const Usuarios = p(() => import('./paginas/administracion/Usuarios'));
const Roles = p(() => import('./paginas/administracion/Roles'));
const Bitacora = p(() => import('./paginas/administracion/Bitacora'));
const Finanzas = p(() => import('./paginas/administracion/Finanzas'));
const Reportes = p(() => import('./paginas/administracion/Reportes'));
const Comunidades = p(() => import('./paginas/operacion/Comunidades'));
const Emprendimientos = p(() => import('./paginas/operacion/Emprendimientos'));
const Produccion = p(() => import('./paginas/operacion/Produccion'));
const Lotes = p(() => import('./paginas/operacion/Lotes'));
const Trazabilidad = p(() => import('./paginas/operacion/Trazabilidad'));
const Categorias = p(() => import('./paginas/operacion/Categorias'));
const Productos = p(() => import('./paginas/operacion/Productos'));
const Inventario = p(() => import('./paginas/operacion/Inventario'));
const Alertas = p(() => import('./paginas/operacion/Alertas'));
const Encargos = p(() => import('./paginas/comercial/Encargos'));
const Pedidos = p(() => import('./paginas/comercial/Pedidos'));
const PedidoDetalle = p(() => import('./paginas/comercial/PedidoDetalle'));
const Entregas = p(() => import('./paginas/comercial/Entregas'));
const Pagos = p(() => import('./paginas/comercial/Pagos'));
const Planes = p(() => import('./paginas/comercial/Planes'));
const MetodosPago = p(() => import('./paginas/comercial/MetodosPago'));
const QrCobro = p(() => import('./paginas/comercial/QrCobro'));
const Notificaciones = p(() => import('./paginas/comercial/Notificaciones'));

function SinPermiso() {
    return (
        <div className="mx-auto max-w-lg py-16 text-center">
            <ShieldAlert className="mx-auto size-12 text-peligro" aria-hidden="true" />
            <h1 className="mt-3 text-2xl font-bold">Acceso restringido</h1>
            <p className="mt-2 text-suave">Tu rol no tiene permiso para ver esta sección.</p>
            <Link to="/panel" className="btn-primario mt-4">Volver a mi panel</Link>
        </div>
    );
}

function NoEncontrado() {
    return (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
            <p className="text-6xl font-bold text-primario">404</p>
            <h1 className="mt-2 text-2xl font-bold">Página no encontrada</h1>
            <p className="mt-2 text-suave">La dirección que buscas no existe.</p>
            <Link to="/" className="btn-primario mt-4">Ir al inicio</Link>
        </div>
    );
}

/** Protege rutas: exige sesión y, si se indica, permiso "ver" sobre el módulo. */
function Proteger({ modulo, children }) {
    const { autenticado, cargando, puede } = useAuth();
    const location = useLocation();
    if (cargando) return <Cargando texto="Verificando sesión…" />;
    if (!autenticado) return <Navigate to="/login" state={{ desde: location.pathname + location.search }} replace />;
    if (modulo && !modulo.split('|').some((m) => puede(m))) return <SinPermiso />;
    return <Suspense fallback={<Cargando />}>{children}</Suspense>;
}

const RUTAS_PANEL = [
    ['dashboard', 'dashboard', Dashboard],
    ['usuarios', 'usuarios', Usuarios],
    ['roles', 'roles', Roles],
    ['bitacora', 'bitacora', Bitacora],
    ['comunidades', 'comunidades', Comunidades],
    ['emprendimientos', 'emprendimientos', Emprendimientos],
    ['produccion', 'produccion', Produccion],
    ['lotes', 'lotes', Lotes],
    ['trazabilidad', 'lotes', Trazabilidad],
    ['categorias', 'inventario', Categorias],
    ['productos', 'inventario', Productos],
    ['inventario', 'inventario', Inventario],
    ['alertas', 'inventario', Alertas],
    ['encargos', 'encargos', Encargos],
    ['pedidos', 'pedidos', Pedidos],
    ['pedidos/:id', 'pedidos', PedidoDetalle],
    ['entregas', 'entregas', Entregas],
    ['pagos', 'pagos', Pagos],
    ['planes', 'planes_pago', Planes],
    ['metodos-pago', 'metodos_pago', MetodosPago],
    ['qr', 'qr', QrCobro],
    ['finanzas', 'finanzas', Finanzas],
    ['reportes', 'reportes', Reportes],
    ['notificaciones', 'notificaciones', Notificaciones],
    ['perfil', 'perfil', Perfil],
];

export default function App() {
    return (
        <BrowserRouter basename={BASE_PATH || '/'}>
            <AuthProvider>
                <TemaProvider>
                    <CarritoProvider>
                        <Routes>
                            <Route element={<PublicLayout />}>
                                <Route index element={<Inicio />} />
                                <Route path="catalogo" element={<Catalogo />} />
                                <Route path="catalogo/:id" element={<ProductoDetalle />} />
                                <Route path="login" element={<Login />} />
                                <Route path="registro" element={<Registro />} />
                                <Route path="carrito" element={<Proteger modulo="carrito"><Carrito /></Proteger>} />
                                <Route path="*" element={<NoEncontrado />} />
                            </Route>
                            <Route path="panel" element={<Proteger><PanelLayout /></Proteger>}>
                                <Route index element={<Suspense fallback={<Cargando />}><PanelInicio /></Suspense>} />
                                {RUTAS_PANEL.map(([ruta, modulo, Pagina]) => (
                                    <Route key={ruta} path={ruta} element={<Proteger modulo={modulo}><Pagina /></Proteger>} />
                                ))}
                                <Route path="*" element={<NoEncontrado />} />
                            </Route>
                        </Routes>
                    </CarritoProvider>
                </TemaProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
