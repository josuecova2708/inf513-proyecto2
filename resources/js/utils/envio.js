/**
 * Vista previa del costo de envío. Misma fórmula que app/Services/EnvioServicio.php;
 * los parámetros (tarifa) los envía el servidor en GET /carrito. El cobro real lo calcula el servidor.
 */
export function distanciaKm(tarifa, lat, lng) {
    const rad = Math.PI / 180;
    const { lat: oLat, lng: oLng } = tarifa.origen;
    const dLat = (lat - oLat) * rad;
    const dLng = (lng - oLng) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(oLat * rad) * Math.cos(lat * rad) * Math.sin(dLng / 2) ** 2;
    const recta = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(recta * tarifa.factor_ruta * 100) / 100;
}

/** { km, costo, fueraDeZona } */
export function cotizarEnvio(tarifa, lat, lng) {
    const km = distanciaKm(tarifa, lat, lng);
    if (km > tarifa.max_km) return { km, costo: null, fueraDeZona: true };
    const costo = tarifa.base + Math.max(0, km - tarifa.km_incluidos) * tarifa.por_km;
    return { km, costo: Math.ceil(costo * 2) / 2, fueraDeZona: false };
}
