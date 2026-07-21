'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CENTRO_SEVILLA = [37.3891, -5.9845]

function AjustarEncuadre({ clases }) {
  const map = useMap()

  useEffect(() => {
    if (clases.length === 0) {
      map.setView(CENTRO_SEVILLA, 12)
      return
    }

    const bounds = L.latLngBounds(clases.map((c) => [c.lat, c.lng]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [clases, map])

  return null
}

export default function MapaClases({ clases }) {
  const conCoordenadas = clases.filter((c) => c.lat != null && c.lng != null)

  return (
    <div className="h-[300px] w-full overflow-hidden rounded-xl border border-[#E2E6CF] sm:h-[500px]">
      <MapContainer center={CENTRO_SEVILLA} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AjustarEncuadre clases={conCoordenadas} />
        {conCoordenadas.map((clase) => {
          const plazasMax = clase.plazas_max ?? 0
          const plazasOcupadas = clase.plazas_ocupadas ?? 0
          const plazasLibres = Math.max(plazasMax - plazasOcupadas, 0)

          return (
            <Marker key={clase.id} position={[clase.lat, clase.lng]}>
              <Popup>
                <strong>{clase.titulo}</strong>
                <br />
                {clase.categoria}
                <br />
                {clase.precio} €
                <br />
                {plazasLibres}/{plazasMax} plazas libres
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
