'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import BuscadorDireccion from './BuscadorDireccion'
import { iconoBusqueda } from '../lib/iconoBusqueda'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CIUDADES_COORDS = {
  Sevilla: [37.3891, -5.9845],
  Málaga: [36.7213, -4.4214],
}

const CENTRO_POR_DEFECTO = CIUDADES_COORDS.Sevilla

function RecentradorMapa({ ciudad }) {
  const map = useMap()

  useEffect(() => {
    const coords = CIUDADES_COORDS[ciudad] || CENTRO_POR_DEFECTO
    map.setView(coords, 13)
  }, [ciudad, map])

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

function CentradorBusqueda({ coords }) {
  const map = useMap()

  useEffect(() => {
    if (!coords) return
    map.setView([coords.lat, coords.lng], 16)
  }, [coords, map])

  return null
}

export default function MapaSelector({ ciudad, lat, lng, onCambiarUbicacion }) {
  const centroInicial = CIUDADES_COORDS[ciudad] || CENTRO_POR_DEFECTO
  const posicionMarcador = lat != null && lng != null ? [lat, lng] : null
  const [coordsBusqueda, setCoordsBusqueda] = useState(null)

  function handleSeleccionarSugerencia(sugerencia) {
    setCoordsBusqueda({ lat: sugerencia.lat, lng: sugerencia.lng })
  }

  return (
    <div>
      <div className="mb-2 p-1">
        <BuscadorDireccion onSeleccionar={handleSeleccionarSugerencia} />
      </div>
      <p className="mb-2 text-xs text-[#6B7355]">
        Busca una calle para situarte y luego pincha en el mapa para marcar el punto exacto de la sesión.
      </p>
      <div className="isolate" style={{ height: 300, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
        <MapContainer center={centroInicial} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecentradorMapa ciudad={ciudad} />
          <CentradorBusqueda coords={coordsBusqueda} />
          <SelectorClic onSeleccionar={onCambiarUbicacion} />
          {posicionMarcador && <Marker position={posicionMarcador} />}
          {coordsBusqueda && (
            <Marker position={[coordsBusqueda.lat, coordsBusqueda.lng]} icon={iconoBusqueda()}>
              <Tooltip>Esta es la ubicación que buscaste</Tooltip>
              <Popup autoPanPaddingTopLeft={[20, 120]} autoPanPaddingBottomRight={[20, 20]}>
                Esta es la ubicación que buscaste
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      <p style={{ marginTop: 8, fontSize: 14 }}>
        {posicionMarcador
          ? `Coordenadas seleccionadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
          : 'Haz clic en el mapa para seleccionar la ubicación.'}
      </p>
    </div>
  )
}
