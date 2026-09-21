'use client'

import { useEffect } from 'react'
import { usePush } from '../lib/usePush'

export default function NotificacionesToggle({ usuarioActual, onCambioEstado }) {
  const { soportado, activado, cargando, procesando, error, activar, desactivar } = usePush(usuarioActual)

  useEffect(() => {
    if (onCambioEstado) onCambioEstado(activado)
  }, [activado])

  if (!soportado) {
    return (
      <p className="text-sm text-[#162318]/60">
        Tu navegador no admite notificaciones push.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={activado ? desactivar : activar}
        disabled={procesando || cargando}
        className={
          activado
            ? 'corte-btn border-2 border-[#162318] px-6 py-2 font-semibold text-[#162318] transition hover:bg-[#162318] hover:text-white disabled:opacity-60'
            : 'corte-btn bg-[#B5E600] px-6 py-2 font-semibold text-[#3D4A00] transition hover:brightness-95 disabled:opacity-60'
        }
      >
        {cargando ? '...' : procesando ? '...' : activado ? 'Desactivar notificaciones' : 'Activar notificaciones'}
      </button>
      {error && <p className="text-sm text-[#B85E60]">{error}</p>}
    </div>
  )
}
