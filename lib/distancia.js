// Distancia en km en línea recta entre dos puntos (fórmula de Haversine).
export function distanciaKm(lat1, lng1, lat2, lng2) {
  const aRadianes = (grados) => (grados * Math.PI) / 180
  const radioTierraKm = 6371
  const dLat = aRadianes(lat2 - lat1)
  const dLng = aRadianes(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(lat1)) * Math.cos(aRadianes(lat2)) * Math.sin(dLng / 2) ** 2
  return radioTierraKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
