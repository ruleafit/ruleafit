'use client'

import Link from 'next/link'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../lib/imagenesCategoria'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import RevelarAlLlegar from '../RevelarAlLlegar'
import BotonReclamar from './BotonReclamar'

export default function TarjetaReservaCancelada({ reserva, indice, onReclamar }) {
  const clase = reserva.clases
  const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO

  return (
    <RevelarAlLlegar delayMs={Math.min(indice * 60, 240)}>
      <div className="overflow-hidden corte-card border border-red-200 bg-red-50">
        <div className="relative h-32 w-full opacity-80 sm:h-36">
          <img src={imagenClase} alt="" className="h-full w-full object-cover grayscale" />
          {clase.categoria && (
            <span className="absolute left-3 top-3 corte-tag border border-red-200 bg-white/90 px-2.5 py-1 text-xs font-semibold text-red-400">
              {clase.categoria}
            </span>
          )}
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-red-500">Cancelada</span>
          </div>

          <h2 className="mb-1 text-lg font-bold text-red-500 sm:text-xl">{clase.titulo}</h2>

          <div className="flex flex-col gap-1 text-sm text-red-400">
            <p>
              Ciudad: <span className="text-red-500">{clase.ciudad}</span>
            </p>
            <p>
              Fecha: <span className="text-red-500">{formatearFechaParaMostrar(clase.fecha)}</span> · Hora:{' '}
              <span className="text-red-500">{clase.hora}</span>
            </p>
          </div>

          <p className="mt-3 border-t border-red-200 pt-3 text-sm text-red-500">
            {clase.perfiles?.username ? (
              <>
                Cancelada por el entrenador / organizador{' '}
                <Link href={`/entrenador/${clase.perfiles.username}`} className="font-semibold hover:underline">
                  @{clase.perfiles.username}
                </Link>
                .
              </>
            ) : (
              'Cancelada por el entrenador / organizador.'
            )}
            {reserva.cancelled_at && <> El {new Date(reserva.cancelled_at).toLocaleString('es-ES')}.</>}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href={`/clases/${clase.id}?from=mis-reservas`}
              className="corte-tag border border-red-200 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
            >
              Ver detalle
            </Link>
            <BotonReclamar reservaId={reserva.id} onReclamar={onReclamar} />
          </div>
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
