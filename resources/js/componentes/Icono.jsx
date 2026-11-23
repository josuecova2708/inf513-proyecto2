import {
    Apple, Banknote, Bell, Boxes, CalendarClock, ChartLine, CircleUser, ClipboardList, CreditCard, FileChartColumn,
    House, KeyRound, LayoutDashboard, MapPinned, Package, QrCode, Receipt, Route, ScrollText, ShieldCheck, ShoppingBag,
    ShoppingCart, Sprout, Store, Tags, Tractor, TrendingUp, TriangleAlert, Truck, Users, Wallet, Warehouse, Wheat, Circle,
} from 'lucide-react';

// Los nombres de iconos vienen de la tabla `menu` en la base de datos
const MAPA = {
    Apple, Banknote, Bell, Boxes, CalendarClock, ChartLine, CircleUser, ClipboardList, CreditCard, FileChartColumn,
    House, KeyRound, LayoutDashboard, MapPinned, Package, QrCode, Receipt, Route, ScrollText, ShieldCheck, ShoppingBag,
    ShoppingCart, Sprout, Store, Tags, Tractor, TrendingUp, TriangleAlert, Truck, Users, Wallet, Warehouse, Wheat,
};

export default function Icono({ nombre, ...props }) {
    const C = MAPA[nombre] ?? Circle;
    return <C aria-hidden="true" {...props} />;
}
