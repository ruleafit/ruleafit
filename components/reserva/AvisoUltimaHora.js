'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Clock, MapPin } from 'lucide-react'
import AvisoPlazoCancelacion from '../AvisoPlazoCancelacion'

// Segunda confirmación cuando faltan menos de 30 minutos (ver lib/ultimaHora.js). «Sí, continuar» NO reserva: solo
// da paso al procedimiento habitual (con su propia confirmación y las condiciones de cancelación C33). «Volver»
// no hace nada: ni reserva, ni pago, ni consumo de bono, ni toca avisos de plaza libre.
export default function AvisoUltimaHora({ clase, onVolver, onContinuar }) {
  const ref = useRef(null)
  const volverRef = useRef(onVolver)
  volverRef.current = onVolver
  const lugar = clase.punto_encuentro || clase.direccion || ''

  useEffect(() => {
    const anterior = document.activeElement
    ref.current?.focus()
    const alTeclear = (e) => e.key === 'Escape' && volverRef.current()
    document.addEventListener('keydown', alTeclear)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflow
      anterior?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onVolver}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ultima-hora-titulo"
        aria-describedby="ultima-hora-texto"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl outline-none sm:rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EDF5C9]">
            <Clock className="h-6 w-6 text-[#3D4A00]" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 id="ultima-hora-titulo" className="text-xl font-extrabold text-[#1F2400]">
            ¡Tu clase empieza muy pronto!
          </h2>
        </div>

        <p id="ultima-hora-texto" className="mt-3 text-sm text-[#1F2400]">
          Faltan menos de 30 minutos para que comience esta actividad. ¿Seguro que puedes llegar a tiempo y quieres reservar?
        </p>

        <div className="mt-4 space-y-1 rounded-xl border border-[#E2E6CF] bg-[#F7F9EC] p-4 text-sm">
          <p className="font-bold text-[#1F2400]">{clase.titulo}</p>
          <p className="text-[#6B7355]">Empieza a las <span className="font-semibold text-[#1F2400]">{String(clase.hora).slice(0, 5)}</span></p>
          {lugar && (
            <p className="flex items-start gap-1.5 text-[#6B7355]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{lugar}</span>
            </p>
          )}
        </div>

        <AvisoPlazoCancelacion clase={clase} className="mt-3" />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onVolver}
            className="corte-btn border-2 border-[#1F2400] px-4 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onContinuar}
            className="corte-btn bg-[#B5E600] px-4 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2"
          >
            Sí, continuar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
