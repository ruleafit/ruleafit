'use client'

import { Clock } from 'lucide-react'
import { plazoCancelacion, TEXTO_NORMA_CANCELACION } from '../lib/plazoCancelacion'

// Aviso discreto con el plazo de cancelación (solo informa; la regla la aplica el servidor).
//   variante="detalle"  bajo el botón de reservar en /clases/[id]
//   variante="reserva"  dentro de una reserva activa en «Mis reservas»
//   condicionesPago     texto extra para cuando los pagos online estén activos
export default function AvisoPlazoCancelacion({ clase, variante = 'detalle', condicionesPago = false, className = '' }) {
  const plazo = plazoCancelacion(clase)
  if (plazo.estado === 'desconocido' || plazo.yaEmpezada) return null
  const { limite } = plazo
  const base = `flex items-start gap-1.5 text-xs leading-snug text-[#6B7355] ${className}`

  if (variante === 'reserva') {
    return (
      <p className={base}>
        <Clock className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>
          {plazo.estado === 'abierto'
            ? `Puedes cancelar hasta las ${limite.hora} del ${limite.dia}`
            : 'El plazo de cancelación ha finalizado. Ya no puedes cancelar esta reserva'}
        </span>
      </p>
    )
  }

  if (plazo.estado === 'cerrado') {
    return (
      <p className={`${base} text-amber-800`}>
        <Clock className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>Esta sesión comienza en menos de 2 horas. Si reservas ahora, no podrás cancelarla desde RuleaFit.</span>
      </p>
    )
  }

  return (
    <div className={`flex items-start gap-1.5 text-xs leading-snug text-[#6B7355] ${className}`}>
      <Clock className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      <div>
        <p className="font-medium text-[#3D4A00]">
          Puedes cancelar hasta el {limite.dia} a las {limite.hora}.
        </p>
        <p className="text-[11px]">{TEXTO_NORMA_CANCELACION}</p>
        {condicionesPago && (
          <p className="mt-0.5 text-[11px]">Si cancelas dentro de plazo, la devolución se gestiona según las condiciones del pago.</p>
        )}
      </div>
    </div>
  )
}
