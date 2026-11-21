'use client'

import { X } from 'lucide-react'
import { formatearFechaParaMostrar, diaSemanaParaMostrar } from '../lib/formatoFecha'

// Aviso del día elegido en el calendario + botón "Ver todas".
export default function BarraDiaCalendario({ fecha, onVerTodas }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-3 py-2 text-sm font-semibold text-[#3D4A00]">
      <span>
        Sesiones del <span className="capitalize">{diaSemanaParaMostrar(fecha)}</span>{' '}
        {formatearFechaParaMostrar(fecha)}
      </span>
      <button
        type="button"
        onClick={onVerTodas}
        className="inline-flex items-center gap-1 text-xs font-bold underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
        Ver todas
      </button>
    </div>
  )
}
