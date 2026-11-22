'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { agruparPorUbicacion, disenarGrupo } from '../../lib/agruparMapa'
import { iconoOrganizador, iconoMasOrganizadores } from './iconosMapa'
import ContenidoPopupSesion from './ContenidoPopupSesion'

// Capa que sustituye al agrupamiento por número SOLO en el zoom máximo: las sesiones que
// siguen superpuestas se agrupan por organizador (una foto por organizador) y las fotos se
// reparten alrededor del punto para poder pulsarlas. Solo se dibujan las sesiones del área
// visible (con margen), así que nunca se crean decenas de marcadores por sesión.
//   onAbrirSesiones(organizador)      foto de un organizador con varias sesiones
//   onAbrirOrganizadores(organizadores) «+N» cuando hay demasiados organizadores en un punto
export default function CapaMaximoZoom({ clases, onAbrirSesiones, onAbrirOrganizadores }) {
  const map = useMap()
  const [limites, setLimites] = useState(() => map.getBounds().pad(0.6))
  const yaEncuadrados = useRef(new Set())

  useMapEvents({ moveend: () => setLimites(map.getBounds().pad(0.6)) })

  useEffect(() => {
    // Al entrar en el zoom máximo se recalcula el área visible; al salir se limpia el control de encuadre.
    setLimites(map.getBounds().pad(0.6))
    const guardados = yaEncuadrados.current
    return () => guardados.clear()
  }, [map])

  const grupos = useMemo(() => {
    const zoom = map.getMaxZoom()
    const visibles = clases.filter((c) => limites.contains([c.lat, c.lng]))
    const proyectar = (c) => {
      const p = map.project([c.lat, c.lng], zoom)
      return { x: p.x, y: p.y }
    }
    return agruparPorUbicacion(visibles, proyectar).map((g) => {
      const d = disenarGrupo(g)
      const unica = g.sesiones.length === 1
      const base = unica
        ? map.project([g.sesiones[0].lat, g.sesiones[0].lng], zoom)
        : L.point(g.x, g.y)
      const marcadores = d.marcadores.map((m, i) => {
        const punto = L.point(base.x + m.dx, base.y + m.dy)
        return { ...m, clave: `${Math.round(base.x)},${Math.round(base.y)}:${m.tipo}-${m.sesion?.id || m.organizador?.trainerId || 'mas'}-${i}`, latlng: map.unproject(punto, zoom), punto }
      })
      return { clave: marcadores.map((m) => m.clave).join('|'), marcadores, organizadores: d.organizadores }
    })
  }, [clases, limites, map])

  // Evita que las fotos repartidas se salgan de la pantalla: si el grupo está a la vista pero
  // alguna foto queda fuera, se desplaza el mapa lo justo (una vez por grupo).
  useEffect(() => {
    const tam = map.getSize()
    const zoom = map.getMaxZoom()
    if (map.getZoom() !== zoom) return
    const margen = 34
    for (const g of grupos) {
      if (g.marcadores.length < 2 || yaEncuadrados.current.has(g.clave)) continue
      const pts = g.marcadores.map((m) => map.latLngToContainerPoint(m.latlng))
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
      if (cx < 0 || cy < 0 || cx > tam.x || cy > tam.y) continue
      yaEncuadrados.current.add(g.clave)
      const minX = Math.min(...pts.map((p) => p.x)) - margen
      const maxX = Math.max(...pts.map((p) => p.x)) + margen
      const minY = Math.min(...pts.map((p) => p.y)) - margen
      const maxY = Math.max(...pts.map((p) => p.y)) + margen
      let dx = 0
      let dy = 0
      if (minX < 0) dx = minX
      else if (maxX > tam.x) dx = maxX - tam.x
      if (minY < 0) dy = minY
      else if (maxY > tam.y) dy = maxY - tam.y
      if (dx || dy) {
        map.panBy([dx, dy])
        break
      }
    }
  }, [grupos, map])

  return (
    <>
      {grupos.flatMap((g) =>
        g.marcadores.map((m) => {
          if (m.tipo === 'sesion') {
            return (
              <Marker key={m.clave} position={m.latlng} icon={iconoOrganizador(m.sesion.perfiles)}>
                <Popup>
                  <ContenidoPopupSesion clase={m.sesion} />
                </Popup>
              </Marker>
            )
          }
          if (m.tipo === 'organizador') {
            const nombre = m.organizador.perfil?.username
            return (
              <Marker
                key={m.clave}
                position={m.latlng}
                icon={iconoOrganizador(m.organizador.perfil)}
                title={`${nombre ? '@' + nombre + ' · ' : ''}${m.organizador.sesiones.length} sesiones aquí`}
                eventHandlers={{ click: () => onAbrirSesiones(m.organizador) }}
              />
            )
          }
          return (
            <Marker
              key={m.clave}
              position={m.latlng}
              icon={iconoMasOrganizadores(m.restantes)}
              title={`${m.restantes} organizadores más en este punto`}
              eventHandlers={{ click: () => onAbrirOrganizadores(m.organizadores) }}
            />
          )
        })
      )}
    </>
  )
}
