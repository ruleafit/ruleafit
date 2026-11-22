'use client'

import { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'
import NotificacionesToggle from '../NotificacionesToggle'
import PreferenciasNotificaciones from '../PreferenciasNotificaciones'
import HistorialNotificaciones from '../HistorialNotificaciones'
import AvisosZona from './AvisosZona'
import BloqueDesplegable from './BloqueDesplegable'
import { AVISOS_ZONA_VISIBLES } from '../../lib/avisosZonaVisibles'

// Bloques 3, 4 y 5 de «Mi cuenta»: Notificaciones, Avisos de sesiones en mi zona y
// Últimas notificaciones. El interruptor general de notificaciones (push del
// dispositivo) va SIEMPRE visible, encima del bloque «Notificaciones», y es el mismo
// control de siempre (NotificacionesToggle): no hay otro duplicado.
export default function NotificacionesCuenta({ usuario }) {
  const [pushActivadas, setPushActivadas] = useState(false)

  // Enlace de la campana «Ver historial de notificaciones» (/cuenta#notificaciones):
  // el bloque del historial se abre solo (BloqueDesplegable) y aquí se desplaza la
  // vista hasta él. Se reintenta hasta 10 veces por si tarda en pintarse.
  useEffect(() => {
    if (window.location.hash !== '#notificaciones') return

    let cancelado = false
    let intentos = 0
    function intentarScroll() {
      if (cancelado) return
      const el = document.getElementById('ultimas-notificaciones')
      intentos += 1
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (intentos < 10) {
        requestAnimationFrame(intentarScroll)
      }
    }
    requestAnimationFrame(intentarScroll)

    return () => {
      cancelado = true
    }
  }, [])

  return (
    <>
      <div id="notificaciones" className="solo-web mb-4 scroll-mt-24 corte-card border border-[#E2E6CF] bg-white p-5 sm:p-6">
        <h2 className="mb-2 text-lg font-bold text-[#1F2400]">Notificaciones en tu móvil</h2>
        <p className="mb-2 text-sm text-[#6B7355]">
          Activa las notificaciones para recibir avisos en este dispositivo: tus reservas, las sesiones de tus usuarios
          favoritos y los recordatorios.
        </p>
        <p className="mb-4 text-sm text-[#6B7355]">
          Los «Avisos de sesiones en mi zona» llegan siempre a la campana. Para recibirlos también como notificación en el
          móvil necesitas tener activado este interruptor.
        </p>
        <NotificacionesToggle usuarioActual={usuario} onCambioEstado={setPushActivadas} />
      </div>

      <BloqueDesplegable id="notificaciones-ajustes" titulo="Notificaciones" className="solo-web">
        <h3 className="mb-3 text-sm font-semibold text-[#162318]">Qué notificaciones quieres recibir</h3>
        <PreferenciasNotificaciones usuarioActual={usuario} pushActivadas={pushActivadas} />
      </BloqueDesplegable>

      {/* Fuera del bloque solo-web: la configuración se ve también en la app de iPhone. */}
      {AVISOS_ZONA_VISIBLES && (
        <BloqueDesplegable id="avisos-zona" titulo="Avisos de sesiones en mi zona" icono={MapPin}>
          <AvisosZona usuario={usuario} />
        </BloqueDesplegable>
      )}

      <BloqueDesplegable
        id="ultimas-notificaciones"
        titulo="Últimas notificaciones"
        abrirConHash={['notificaciones']}
        className="solo-web"
      >
        <HistorialNotificaciones usuarioActual={usuario} />
      </BloqueDesplegable>
    </>
  )
}
