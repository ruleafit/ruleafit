'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import BuscadorDireccion from './BuscadorDireccion'
import { iconoBusqueda } from '../lib/iconoBusqueda'
import { obtenerPosicion } from '../lib/nativo'
import { iconoOrganizador } from './mapa/iconosMapa'
import ContenidoPopupSesion from './mapa/ContenidoPopupSesion'
import CapaMaximoZoom from './mapa/CapaMaximoZoom'
import PanelSesionesMapa from './mapa/PanelSesionesMapa'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Vista inicial (y cuando no hay sesiones que mostrar): España entera.
const CENTRO_ESPANA = [40.2, -3.7]
const ZOOM_ESPANA = 6

function iconoCluster(cluster) {
  const cantidad = cluster.getChildCount()

  return L.divIcon({
    html: `<div style="
        width:40px;
        height:40px;
        border-radius:50%;
        background:#3D4A00;
        border:3px solid #fff;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 4px rgba(0,0,0,0.45);
      "><span style="color:#FFFFFF;font-weight:700;font-size:14px;line-height:1;">${cantidad}</span></div>`,
    className: '',
    iconSize: [40, 40],
  })
}

function iconoUsuario() {
  return L.divIcon({
    html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;z-index:1000;">
        <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(26,115,232,0.35);"></div>
        <div style="position:relative;width:16px;height:16px;border-radius:50%;background:#1A73E8;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.45);"></div>
      </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function CentrarEnUsuario({ ubicacion }) {
  const map = useMap()

  useEffect(() => {
    if (!ubicacion) return
    map.setView([ubicacion.lat, ubicacion.lng], 14)
  }, [ubicacion, map])

  return null
}

function CentradorBusqueda({ coords }) {
  const map = useMap()

  useEffect(() => {
    if (!coords) return
    map.setView([coords.lat, coords.lng], 15)
  }, [coords, map])

  return null
}

function AjustarEncuadre({ clases }) {
  const map = useMap()
  // Solo se reencuadra cuando cambia QUÉ sesiones hay (filtros), no cada vez que el componente se
  // vuelve a pintar (abrir/cerrar el panel, cambiar de zoom...): así se conserva la posición.
  const firma = clases.map((c) => `${c.id}:${c.lat},${c.lng}`).join('|')

  useEffect(() => {
    if (clases.length === 0) {
      map.setView(CENTRO_ESPANA, ZOOM_ESPANA)
      return
    }

    const bounds = L.latLngBounds(clases.map((c) => [c.lat, c.lng]))
    map.fitBounds(bounds, { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, map])

  return null
}

// Avisa de si el mapa está en su zoom máximo. Solo ahí interviene la agrupación por organizador.
function ObservadorZoomMaximo({ onCambio }) {
  const map = useMap()
  const evaluar = () => {
    const max = map.getMaxZoom()
    onCambio(Number.isFinite(max) && map.getZoom() >= max)
  }
  useMapEvents({ zoomend: evaluar })
  useEffect(evaluar, [map])
  return null
}

export default function MapaClases({ clases }) {
  const conCoordenadas = useMemo(() => clases.filter((c) => c.lat != null && c.lng != null), [clases])
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState(null)
  const [coordsBusqueda, setCoordsBusqueda] = useState(null)
  const [enZoomMaximo, setEnZoomMaximo] = useState(false)
  const [panel, setPanel] = useState(null)

  // Al salir del zoom máximo se recupera el comportamiento normal: el panel se cierra solo.
  useEffect(() => {
    if (!enZoomMaximo) setPanel(null)
  }, [enZoomMaximo])

  function verMiUbicacion() {
    setBuscandoUbicacion(true)
    setErrorUbicacion(null)

    // Dentro de la app de iPhone usa el permiso nativo; en el navegador, el de siempre.
    obtenerPosicion()
      .then((posicion) => {
        setUbicacionUsuario(posicion)
        setBuscandoUbicacion(false)
      })
      .catch(() => {
        setErrorUbicacion('No pudimos obtener tu ubicación. Revisa los permisos del navegador.')
        setBuscandoUbicacion(false)
      })
  }

  return (
    <div>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={verMiUbicacion}
          disabled={buscandoUbicacion}
          className="shrink-0 corte-btn border-2 border-[#B5E600] bg-white px-4 py-2 text-sm font-bold text-[#16231B] shadow-md hover:bg-[#F5F7E8] disabled:opacity-70"
        >
          {buscandoUbicacion ? 'Buscando...' : 'Ver mi ubicación'}
        </button>
        <div className="flex-1 p-1">
          <BuscadorDireccion
            onSeleccionar={(sugerencia) => setCoordsBusqueda({ lat: sugerencia.lat, lng: sugerencia.lng })}
            onLimpiar={() => setCoordsBusqueda(null)}
          />
        </div>
      </div>
      {errorUbicacion && (
        <p className="mb-2 rounded-lg bg-white/90 px-3 py-2 text-xs text-[#3D4A00] shadow">
          {errorUbicacion}
        </p>
      )}
      <div className="relative isolate h-[300px] w-full overflow-hidden corte-card border border-[#E2E6CF] sm:h-[500px]">
        <MapContainer center={CENTRO_ESPANA} zoom={ZOOM_ESPANA} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AjustarEncuadre clases={conCoordenadas} />
          <CentrarEnUsuario ubicacion={ubicacionUsuario} />
          <CentradorBusqueda coords={coordsBusqueda} />
          {coordsBusqueda && (
            <Marker position={[coordsBusqueda.lat, coordsBusqueda.lng]} icon={iconoBusqueda()}>
              <Popup>Esta es la ubicación que buscaste</Popup>
            </Marker>
          )}
          {ubicacionUsuario && (
            <Marker
              position={[ubicacionUsuario.lat, ubicacionUsuario.lng]}
              icon={iconoUsuario()}
              zIndexOffset={1000}
            >
              <Popup>Estás aquí</Popup>
            </Marker>
          )}
          <ObservadorZoomMaximo onCambio={setEnZoomMaximo} />
          {enZoomMaximo ? (
            <CapaMaximoZoom
              clases={conCoordenadas}
              onAbrirSesiones={(org) =>
                setPanel({ tipo: 'sesiones', trainerId: org.trainerId, ids: org.sesiones.map((c) => c.id) })
              }
              onAbrirOrganizadores={(orgs) =>
                setPanel({ tipo: 'organizadores', ids: orgs.flatMap((o) => o.sesiones.map((c) => c.id)) })
              }
            />
          ) : (
            <MarkerClusterGroup iconCreateFunction={iconoCluster}>
              {conCoordenadas.map((clase) => (
                <Marker key={clase.id} position={[clase.lat, clase.lng]} icon={iconoOrganizador(clase.perfiles)}>
                  <Popup>
                    <ContenidoPopupSesion clase={clase} />
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}
        </MapContainer>
        <PanelSesionesMapa panel={panel} clases={conCoordenadas} onCerrar={() => setPanel(null)} />
      </div>
    </div>
  )
}
