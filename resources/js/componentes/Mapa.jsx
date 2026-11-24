import { useEffect, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconoUrl from 'leaflet/dist/images/marker-icon.png';
import icono2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import sombraUrl from 'leaflet/dist/images/marker-shadow.png';
import { Crosshair, ExternalLink, LoaderCircle } from 'lucide-react';
import { IMG_URL, UBICACION_FEDER } from '../api/cliente';

/**
 * Mapas con Leaflet + OpenStreetMap (sin API key). Este módulo se carga con lazy()
 * para que Leaflet no engorde el bundle del catálogo.
 */

// Vite empaqueta los íconos: así funcionan también bajo la subcarpeta de tecnoweb
const iconoCliente = new L.Icon({
    iconUrl: iconoUrl, iconRetinaUrl: icono2xUrl, shadowUrl: sombraUrl,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const iconoFeder = L.divIcon({
    className: '',
    html: `<span style="display:flex;width:38px;height:38px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;border:3px solid #2f6b3a;box-shadow:0 2px 6px rgba(0,0,0,.35)"><img src="${IMG_URL}/feder-icono.png" alt="" style="width:26px;height:26px;object-fit:contain"></span>`,
    iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -18],
});

const FEDER = [UBICACION_FEDER.lat, UBICACION_FEDER.lng];
const TESELAS = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const enlaceGoogleMaps = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

function MarcadorFeder() {
    return (
        <Marker position={FEDER} icon={iconoFeder}>
            <Popup><strong>FEDER</strong><br />{UBICACION_FEDER.direccion}</Popup>
        </Marker>
    );
}

function AlHacerClic({ onElegir }) {
    useMapEvents({ click: (e) => onElegir(e.latlng.lat, e.latlng.lng) });
    return null;
}

function Centrar({ punto }) {
    const mapa = useMap();
    useEffect(() => {
        if (punto) mapa.flyTo(punto, Math.max(mapa.getZoom(), 15), { duration: 0.6 });
    }, [punto?.[0], punto?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}

const redondear = (v) => Math.round(v * 1e6) / 1e6;

/** Selector de ubicación de entrega: clic en el mapa, arrastrar el marcador o usar el GPS. */
export function SelectorUbicacion({ valor, onChange, error, alto = 'h-72' }) {
    const [buscando, setBuscando] = useState(false);
    const [errorGps, setErrorGps] = useState('');
    const punto = valor ? [valor.lat, valor.lng] : null;
    const [centrarEn, setCentrarEn] = useState(null);
    const elegir = (lat, lng) => onChange({ lat: redondear(lat), lng: redondear(lng) });

    const miUbicacion = () => {
        if (!navigator.geolocation) return setErrorGps('Su navegador no permite obtener la ubicación.');
        setBuscando(true);
        setErrorGps('');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setBuscando(false);
                elegir(pos.coords.latitude, pos.coords.longitude);
                setCentrarEn([pos.coords.latitude, pos.coords.longitude]);
            },
            () => {
                setBuscando(false);
                setErrorGps('No se pudo obtener su ubicación. Marque el punto directamente en el mapa.');
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    return (
        <div>
            <div className={`relative z-0 isolate overflow-hidden rounded-tema border ${error ? 'border-peligro' : 'border-borde'}`}>
                <MapContainer center={punto ?? FEDER} zoom={13} className={`${alto} w-full`} scrollWheelZoom aria-label="Mapa para marcar la ubicación de entrega">
                    <TileLayer url={TESELAS} attribution={ATRIBUCION} />
                    <MarcadorFeder />
                    <AlHacerClic onElegir={elegir} />
                    <Centrar punto={centrarEn} />
                    {punto && (
                        <>
                            <Polyline positions={[FEDER, punto]} pathOptions={{ color: '#2f6b3a', dashArray: '6 8', weight: 2 }} />
                            <Marker position={punto} icon={iconoCliente} draggable
                                eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); elegir(p.lat, p.lng); } }}>
                                <Popup>Entregar aquí</Popup>
                            </Marker>
                        </>
                    )}
                </MapContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-suave">
                <span>{punto ? `Ubicación: ${punto[0].toFixed(5)}, ${punto[1].toFixed(5)} · arrastre el marcador para ajustar` : 'Haga clic en el mapa para marcar dónde entregar.'}</span>
                <button type="button" className="btn-secundario btn-sm" onClick={miUbicacion} disabled={buscando}>
                    {buscando ? <LoaderCircle className="size-4 animate-spin" /> : <Crosshair className="size-4" />} Usar mi ubicación
                </button>
            </div>
            {(error || errorGps) && <p className="mt-1 text-sm text-peligro">{error || errorGps}</p>}
        </div>
    );
}

/** Mapa de solo lectura. Sin coordenadas muestra la ubicación de FEDER (recojo). */
export function MapaUbicacion({ lat, lng, alto = 'h-56' }) {
    const hay = lat != null && lng != null;
    const punto = hay ? [Number(lat), Number(lng)] : FEDER;
    return (
        <div>
            <div className="relative z-0 isolate overflow-hidden rounded-tema border border-borde">
                <MapContainer center={punto} zoom={hay ? 14 : 15} className={`${alto} w-full`} scrollWheelZoom={false}>
                    <TileLayer url={TESELAS} attribution={ATRIBUCION} />
                    <MarcadorFeder />
                    {hay && (
                        <>
                            <Polyline positions={[FEDER, punto]} pathOptions={{ color: '#2f6b3a', dashArray: '6 8', weight: 2 }} />
                            <Marker position={punto} icon={iconoCliente}><Popup>Lugar de entrega</Popup></Marker>
                        </>
                    )}
                </MapContainer>
            </div>
            <a href={enlaceGoogleMaps(...punto)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primario hover:underline">
                <ExternalLink className="size-4" /> Abrir en Google Maps
            </a>
        </div>
    );
}
