'use client'

import Link from 'next/link'
import { CalendarDays, Clock } from 'lucide-react'
import { formatearFechaParaMostrar, formatearHoraParaMostrar, diaSemanaParaMostrar } from '../../lib/formatoFecha'

// Contenido de la ventana emergente de una sesión en el mapa (movido tal cual desde
// components/MapaClases.js para reutilizarlo con las sesiones del zoom máximo).
export default function ContenidoPopupSesion({ clase }) {
  const plazasMax = clase.plazas_max ?? 0
  const plazasOcupadas = clase.plazas_ocupadas ?? 0
  const plazasLibres = Math.max(plazasMax - plazasOcupadas, 0)

  return (
    <>
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
            <span className="capitalize">{diaSemanaParaMostrar(clase.fecha)}</span> {formatearFechaParaMostrar(clase.fecha)}
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
    </>
  )
}
