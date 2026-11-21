'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import BuscadorDireccion from './BuscadorDireccion'
import { iconoBusqueda } from '../lib/iconoBusqueda'
import { obtenerPosicion } from '../lib/nativo'
import { CalendarDays, Clock } from 'lucide-react'
import { formatearFechaParaMostrar, formatearHoraParaMostrar, diaSemanaParaMostrar } from '../lib/formatoFecha'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Vista inicial (y cuando no hay sesiones que mostrar): España entera.
const CENTRO_ESPANA = [40.2, -3.7]
const ZOOM_ESPANA = 6

// Marcador circular con la foto de perfil de quien publica la sesión (misma
// foto_url que el perfil público, llega con la consulta de sesiones). Sin foto,
// o si no carga, se ve la inicial sobre lima, como el avatar del perfil. Los
// iconos se guardan en caché para no recrearlos en cada render.
const TAM_MARCADOR = 44
const cacheIconos = new Map()

function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function iconoOrganizador(perfil) {
  const clave = `${perfil?.foto_url || ''}|${perfil?.username || ''}`
  const guardado = cacheIconos.get(clave)
  if (guardado) return guardado

  const inicial = escaparHtml((perfil?.username || '?').charAt(0).toUpperCase())
  const foto = perfil?.foto_url
    ? `<img src="${escaparHtml(perfil.foto_url)}" alt="" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />`
    : ''

  const icono = L.divIcon({
    html: `<div style="position:relative;width:${TAM_MARCADOR}px;height:${TAM_MARCADOR}px;border-radius:50%;overflow:hidden;box-sizing:border-box;background:#B5E600;border:3px solid #fff;box-shadow:0 0 0 2px #3D4A00,0 2px 5px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:#1F2400;font-weight:800;font-size:18px;line-height:1;">${inicial}${foto}</div>`,
    className: '',
    iconSize: [TAM_MARCADOR, TAM_MARCADOR],
    iconAnchor: [TAM_MARCADOR / 2, TAM_MARCADOR / 2],
    popupAnchor: [0, -TAM_MARCADOR / 2],
  })
  cacheIconos.set(clave, icono)
  return icono
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
      map.setView(CENTRO_ESPANA, ZOOM_ESPANA)
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
          <MarkerClusterGroup iconCreateFunction={iconoCluster}>
            {conCoordenadas.map((clase) => {
              const plazasMax = clase.plazas_max ?? 0
              const plazasOcupadas = clase.plazas_ocupadas ?? 0
              const plazasLibres = Math.max(plazasMax - plazasOcupadas, 0)

              return (
                <Marker key={clase.id} position={[clase.lat, clase.lng]} icon={iconoOrganizador(clase.perfiles)}>
                  <Popup>
                    <strong>{clase.titulo}</strong>
                    <br />
                    {clase.categoria}
                    <br />
                    {/* Fecha y hora (hora de España): así se distinguen sesiones
                        idénticas de un mismo centro en distintos días. */}
                    {clase.fecha && (
                      <span className="my-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 corte-tag bg-[#EDF5C9] px-2 py-1 text-xs font-bold text-[#1F2400]">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                          <span className="capitalize">{diaSemanaParaMostrar(clase.fecha)}</span>{' '}
                          {formatearFechaParaMostrar(clase.fecha)}
                        </span>
                        {clase.hora && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                            {formatearHoraParaMostrar(clase.hora)}
                          </span>
                        )}
                      </span>
                    )}
                    {clase.precio} €
                    <br />
                    {plazasLibres}/{plazasMax} plazas libres
                    <br />
                    <Link
                      href={`/clases/${clase.id}?from=clases`}
                      className="mt-2 block corte-btn bg-[#B5E600] px-4 py-2 text-center font-bold !text-white"
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
