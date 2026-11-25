'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import BuscadorDireccion from './BuscadorDireccion'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CENTRO_ESPANA = [40.2, -3.7] // España entera, hasta que se elige una ubicación
const ZOOM_ESPANA = 6

// Centra el mapa cuando se elige un resultado de búsqueda, una ubicación habitual o se carga una sesión
// (`foco` es un objeto nuevo { lat, lng, zoom, n } cada vez). Un toque en el mapa NO mueve la vista.
function Enfocador({ foco }) {
  const map = useMap()
  const n = foco?.n
  useEffect(() => {
    if (foco) map.setView([foco.lat, foco.lng], foco.zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, map])
  return null
}

function SelectorClic({ onSeleccionar }) {
  useMapEvents({
    click(e) {
      onSeleccionar(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Selector de ubicación de la sesión. Hay UNA sola ubicación activa (lat/lng, con su único marcador): elegir un resultado
// del buscador (onSeleccionarBusqueda) o tocar el mapa (onCambiarUbicacion) la fijan al instante, sin segunda pulsación.
export default function MapaSelector({ lat, lng, foco, onCambiarUbicacion, onSeleccionarBusqueda }) {
  const posicionMarcador = lat != null && lng != null ? [lat, lng] : null

  return (
    <div>
      <div className="mb-2 p-1">
        <BuscadorDireccion
          onSeleccionar={(sugerencia) => onSeleccionarBusqueda({ lat: sugerencia.lat, lng: sugerencia.lng, nombre: sugerencia.nombre })}
        />
      </div>
      <p className="mb-2 text-xs text-[#6B7355]">
        Busca un lugar o una calle, o toca el mapa para marcar el punto exacto de la sesión.
      </p>
      <div className="isolate" style={{ height: 300, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
        <MapContainer
          center={foco ? [foco.lat, foco.lng] : posicionMarcador || CENTRO_ESPANA}
          zoom={foco ? foco.zoom : posicionMarcador ? 16 : ZOOM_ESPANA}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Enfocador foco={foco} />
          <SelectorClic onSeleccionar={onCambiarUbicacion} />
          {posicionMarcador && <Marker position={posicionMarcador} />}
        </MapContainer>
      </div>
      <p style={{ marginTop: 8, fontSize: 14 }}>
        {posicionMarcador
          ? `Coordenadas seleccionadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
          : 'Busca un lugar o toca el mapa para seleccionar la ubicación.'}
      </p>
    </div>
  )
}
