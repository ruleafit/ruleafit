'use client'

import { useState, useEffect, useRef } from 'react'
import { usePush } from '../lib/usePush'
import BotonInstalarApp from './BotonInstalarApp'
import { X } from 'lucide-react'

// Clave de localStorage donde recordamos rechazos.
const CLAVE = 'aviso_notif_v1'
const DIAS_ESPERA = 7

// Lee el estado de rechazos de localStorage: { rechazos: number, ultimo: ISOstring|null }
function leerEstado() {
  if (typeof window === 'undefined') return { rechazos: 0, ultimo: null }
  try {
    const raw = window.localStorage.getItem(CLAVE)
    if (!raw) return { rechazos: 0, ultimo: null }
    const parsed = JSON.parse(raw)
    return { rechazos: parsed.rechazos || 0, ultimo: parsed.ultimo || null }
  } catch (e) {
    return { rechazos: 0, ultimo: null }
  }
}

function guardarEstado(estado) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(estado))
  } catch (e) {
    // si localStorage falla, no pasa nada critico
  }
}

export default function AvisoActivarNotificaciones({ usuarioActual, disparador }) {
  const { soportado, activado, cargando, procesando, activar } = usePush(usuarioActual)
  const [visible, setVisible] = useState(false)
  const [esIOS, setEsIOS] = useState(false)
  const [pwaInstalada, setPwaInstalada] = useState(false)
  const ultimoDisparador = useRef(0)

  // Deteccion de entorno iOS/PWA (mismas comprobaciones que BotonInstalarApp).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = window.navigator.userAgent
    setEsIOS(/iPad|iPhone|iPod/.test(ua))
    setPwaInstalada(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    )
  }, [])

  // Decidir si mostrar el banner cuando el disparador se activa.
  useEffect(() => {
    // Solo actuar cuando el disparador cambia a un valor nuevo > 0 (accion real).
    if (!disparador || disparador === ultimoDisparador.current) return
    ultimoDisparador.current = disparador

    if (!usuarioActual) return
    if (cargando) return
    if (!soportado) return
    if (activado) return
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return

    const { rechazos, ultimo } = leerEstado()
    if (rechazos >= 2) return
    if (rechazos === 1 && ultimo) {
      const diasPasados = (Date.now() - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24)
      if (diasPasados < DIAS_ESPERA) return
    }

    setVisible(true)
  }, [disparador])

  function ahoraNo() {
    const { rechazos } = leerEstado()
    guardarEstado({ rechazos: rechazos + 1, ultimo: new Date().toISOString() })
    setVisible(false)
  }

  async function alActivar() {
    const ok = await activar()
    if (ok) {
      setVisible(false)
    }
    // si falla, el banner se queda; el usuario puede cerrar con "ahora no"
  }

  if (!visible) return null

  // Caso iPhone sin PWA: invitar a instalar la app en vez de pedir permiso.
  const necesitaInstalar = esIOS && !pwaInstalada

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2200] px-3 pb-3">
      <div className="mx-auto flex max-w-lg items-start gap-3 corte-card border border-zinc-200 bg-white p-4 shadow-lg">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#3D4A00]">
            {necesitaInstalar
              ? 'Instala la app para recibir avisos'
              : '¿Quieres recibir avisos?'}
          </p>
          <p className="mt-0.5 text-xs text-[#162318]/70">
            {necesitaInstalar
              ? 'Añade Ruleafit a tu pantalla de inicio para que te avisemos de tus sesiones.'
              : 'Te avisaremos cuando haya novedades en tus sesiones. Puedes cambiarlo cuando quieras.'}
          </p>
          <div className="mt-3">
            {necesitaInstalar ? (
              <BotonInstalarApp />
            ) : (
              <button
                onClick={alActivar}
                disabled={procesando}
                className="corte-btn bg-[#B5E600] px-5 py-2 text-sm font-semibold text-[#3D4A00] transition hover:brightness-95 disabled:opacity-60"
              >
                {procesando ? '...' : 'Activar notificaciones'}
              </button>
            )}
          </div>
        </div>
        <button
          onClick={ahoraNo}
          aria-label="Ahora no"
          className="shrink-0 rounded-lg p-1 text-[#162318]/50 transition-colors hover:bg-zinc-50 hover:text-[#162318]"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
