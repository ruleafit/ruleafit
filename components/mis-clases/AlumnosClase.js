'use client'

import { Users } from 'lucide-react'
import { formatearMomentoParaMostrar } from '../../lib/formatoFecha'

export default function AlumnosClase({ clase, haPasado }) {
  if (clase.alumnos.length === 0) {
    if (haPasado) {
      return clase.estado === 'cancelada' ? null : (
        <p className="mt-4 text-sm text-zinc-400">Esta sesión no tuvo reservas.</p>
      )
    }
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-[#E2E6CF] px-4 py-3 text-sm text-[#6B7355]">
        <Users className="h-4 w-4 shrink-0 text-[#B5E600]" strokeWidth={1.75} />
        Todavía no se ha apuntado nadie. En cuanto alguien reserve, lo verás aquí.
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col divide-y divide-[#E2E6CF] overflow-hidden rounded-lg border border-[#E2E6CF]">
      {clase.alumnos.map((alumno) => (
        <div
          key={alumno.reserva_id}
          className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="text-sm">
            <p className="font-semibold text-[#1F2400]">{alumno.cliente_username}</p>
            <p className="text-xs text-[#6B7355]">
              Reservó el {formatearMomentoParaMostrar(alumno.reservado_en)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
