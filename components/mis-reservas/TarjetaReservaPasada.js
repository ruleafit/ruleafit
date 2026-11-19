'use client'

import Link from 'next/link'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../lib/imagenesCategoria'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import RevelarAlLlegar from '../RevelarAlLlegar'

export default function TarjetaReservaPasada({ reserva, indice }) {
  const clase = reserva.clases
  const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO

  return (
    <RevelarAlLlegar delayMs={Math.min(indice * 60, 240)}>
      <div className="overflow-hidden corte-card border border-[#E2E6CF] border-l-4 border-l-zinc-300 bg-zinc-50">
        <div className="relative h-32 w-full opacity-80 sm:h-36">
          <img src={imagenClase} alt="" className="h-full w-full object-cover grayscale" />
          {clase.categoria && (
            <span className="absolute left-3 top-3 corte-tag border border-zinc-300 bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-500">
              {clase.categoria}
            </span>
          )}
        </div>

        <div className="p-5">
          <h2 className="mb-1 text-lg font-bold text-zinc-500 sm:text-xl">{clase.titulo}</h2>

          {clase.perfiles?.username && (
            <p className="mb-3 text-sm text-zinc-400">
              Entrenador / Organizador:{' '}
              <Link
                href={`/entrenador/${clase.perfiles.username}`}
                className="font-semibold text-zinc-500 hover:underline"
              >
                @{clase.perfiles.username}
              </Link>
            </p>
          )}

          <div className="flex flex-col gap-1 text-sm text-zinc-400">
            <p>
              Ciudad: <span className="text-zinc-500">{clase.ciudad}</span>
            </p>
            <p>
              Fecha: <span className="text-zinc-500">{formatearFechaParaMostrar(clase.fecha)}</span> · Hora:{' '}
              <span className="text-zinc-500">{clase.hora}</span>
            </p>
            {clase.duracion != null && (
              <p>
                Duración: <span className="text-zinc-500">{clase.duracion} min</span>
              </p>
            )}
            <p>
              Precio: <span className="text-zinc-500">{clase.precio} €</span>
            </p>
          </div>
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
