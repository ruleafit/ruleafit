'use client'

import { useState, useEffect } from 'react'
import NotificacionesToggle from '../NotificacionesToggle'
import PreferenciasNotificaciones from '../PreferenciasNotificaciones'
import HistorialNotificaciones from '../HistorialNotificaciones'
import AvisosZona from './AvisosZona'
import { AVISOS_ZONA_VISIBLES } from '../../lib/avisosZonaVisibles'

export default function NotificacionesCuenta({ usuario }) {
  const [pushActivadas, setPushActivadas] = useState(false)

  // Se monta cuando la página ya ha cargado, así que el ancla existe ya en el
  // primer fotograma (se reintenta hasta 10 veces por si tarda en pintarse).
  useEffect(() => {
    if (window.location.hash !== '#notificaciones') return

    let cancelado = false
    let intentos = 0
    function intentarScroll() {
      if (cancelado) return
      const el = document.getElementById('notificaciones')
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
    <div id="notificaciones" className="solo-web mb-8 scroll-mt-24 corte-card border border-[#E2E6CF] bg-white p-6">
      <h2 className="mb-2 text-lg font-bold text-[#1F2400]">Notificaciones</h2>
      <p className="mb-4 text-sm text-[#6B7355]">
        Recibe avisos en tu móvil cuando tus usuarios favoritos publiquen sesiones y sobre tus reservas.
      </p>
      <NotificacionesToggle usuarioActual={usuario} onCambioEstado={setPushActivadas} />
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-[#162318] mb-3">Qué notificaciones quieres recibir</h3>
        <PreferenciasNotificaciones usuarioActual={usuario} pushActivadas={pushActivadas} />
      </div>
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-[#162318] mb-3">Últimas notificaciones</h3>
        <HistorialNotificaciones usuarioActual={usuario} />
      </div>
    </div>
    {/* Fuera del bloque solo-web: la configuración se ve también en la app de iPhone. */}
    {AVISOS_ZONA_VISIBLES && <AvisosZona usuario={usuario} />}
    </>
  )
}
