'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import { ESTILO_POR_CATEGORIA, ESTILO_POR_DEFECTO } from '../lib/imagenesCategoria'
import BuscadorDireccion from './BuscadorDireccion'
import { iconoBusqueda } from '../lib/iconoBusqueda'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CENTRO_SEVILLA = [37.3891, -5.9845]

// Formas dibujadas en el tramo superior del icono (viewBox 40x48, centradas en x=20).
const FORMAS_MARCADOR = {
  circulo: (color) => `<circle cx="20" cy="19" r="17" fill="${color}" stroke="#fff" stroke-width="2" />`,
  triangulo: (color) =>
    `<polygon points="20,2 37,36 3,36" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round" />`,
  cuadrado: (color) => `<rect x="3" y="2" width="34" height="34" rx="4" fill="${color}" stroke="#fff" stroke-width="2" />`,
  rombo: (color) =>
    `<rect x="7.98" y="6.98" width="24.04" height="24.04" rx="2" fill="${color}" stroke="#fff" stroke-width="2" transform="rotate(45 20 19)" />`,
}

// Pico inferior que señala el punto exacto de la clase; su punta (20,47) es el punto de anclaje del icono.
function picoMarcador(color) {
  return `<polygon points="13,37 27,37 20,47" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round" />`
}

function iconoPorCategoria(categoria) {
  const estilo = ESTILO_POR_CATEGORIA[categoria] || ESTILO_POR_DEFECTO
  const dibujarForma = FORMAS_MARCADOR[estilo.forma] || FORMAS_MARCADOR.circulo
  const svg = `<svg width="40" height="48" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">${picoMarcador(estilo.color)}${dibujarForma(estilo.color)}</svg>`

  return L.divIcon({
    html: `<div style="width:40px;height:48px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.45));">${svg}</div>`,
    className: '',
    iconSize: [40, 48],
    iconAnchor: [20, 47],
    popupAnchor: [0, -44],
  })
}

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
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState(null)
  const [coordsBusqueda, setCoordsBusqueda] = useState(null)

  function verMiUbicacion() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorUbicacion('No pudimos obtener tu ubicación. Revisa los permisos del navegador.')
      return
    }

    setBuscandoUbicacion(true)
    setErrorUbicacion(null)

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setUbicacionUsuario({ lat: posicion.coords.latitude, lng: posicion.coords.longitude })
        setBuscandoUbicacion(false)
      },
      () => {
        setErrorUbicacion('No pudimos obtener tu ubicación. Revisa los permisos del navegador.')
        setBuscandoUbicacion(false)
      }
    )
  }

  return (
    <div>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={verMiUbicacion}
          disabled={buscandoUbicacion}
          className="shrink-0 rounded-full border-2 border-[#B5E600] bg-white px-4 py-2 text-sm font-bold text-[#16231B] shadow-md hover:bg-[#F5F7E8] disabled:opacity-70"
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
      <div className="relative isolate h-[300px] w-full overflow-hidden rounded-xl border border-[#E2E6CF] sm:h-[500px]">
        <MapContainer center={CENTRO_SEVILLA} zoom={12} style={{ height: '100%', width: '100%' }}>
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
          <MarkerClusterGroup iconCreateFunction={iconoCluster}>
            {conCoordenadas.map((clase) => {
              const plazasMax = clase.plazas_max ?? 0
              const plazasOcupadas = clase.plazas_ocupadas ?? 0
              const plazasLibres = Math.max(plazasMax - plazasOcupadas, 0)

              return (
                <Marker key={clase.id} position={[clase.lat, clase.lng]} icon={iconoPorCategoria(clase.categoria)}>
                  <Popup>
                    <strong>{clase.titulo}</strong>
                    <br />
                    {clase.categoria}
                    <br />
                    {clase.precio} €
                    <br />
                    {plazasLibres}/{plazasMax} plazas libres
                    <br />
                    <Link
                      href={`/clases/${clase.id}`}
                      className="mt-2 block rounded-full bg-[#B5E600] px-4 py-2 text-center font-bold !text-white"
                    >
                      Ver detalles
                    </Link>
                  </Popup>
                </Marker>
              )
            })}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  )
}
