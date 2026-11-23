'use client'

import Link from 'next/link'
import { CircleCheck } from 'lucide-react'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../lib/imagenesCategoria'
import { estadoConfirmacionClase, textoFaltanParaConfirmar } from '../../lib/confirmacionClase'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import RevelarAlLlegar from '../RevelarAlLlegar'
import AvisoPlazoCancelacion from '../AvisoPlazoCancelacion'
import BotonCalendario from '../BotonCalendario'
import { etiquetaCuentaAtras, tipoReserva } from './datos'

export default function TarjetaReservaProxima({ reserva, indice, cancelando, errorCancelacion, onCancelar }) {
  const clase = reserva.clases
  const cuentaAtras = etiquetaCuentaAtras(clase.fecha)
  const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO
  const { pendienteConfirmacion, faltanParaConfirmar } = estadoConfirmacionClase({
    plazasMin: clase.plazas_min,
    plazasOcupadas: clase.plazas_ocupadas,
  })

  return (
    <RevelarAlLlegar delayMs={Math.min(indice * 60, 240)}>
      <div className="tarjeta-hover overflow-hidden corte-card border border-[#E2E6CF] border-l-4 border-l-[#B5E600] bg-white shadow-sm">
        <div className="zoom-imagen relative h-32 w-full sm:h-36">
          <img src={imagenClase} alt="" className="h-full w-full object-cover" />
          {clase.categoria && (
            <span className="absolute left-3 top-3 corte-tag border border-[#B5E600] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#1F2400]">
              {clase.categoria}
            </span>
          )}
          {cuentaAtras && (
            <span className="absolute right-3 top-3 corte-tag bg-[#1F2400]/80 px-2.5 py-1 text-xs font-semibold text-white">
              {cuentaAtras}
            </span>
          )}
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#3D4A00]">
              <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Reservada
            </span>
          </div>

          <h2 className="mb-1 text-lg font-bold text-[#1F2400] sm:text-xl">{clase.titulo}</h2>

          {clase.perfiles?.username && (
            <p className="mb-3 text-sm text-[#6B7355]">
              Entrenador / Organizador:{' '}
              <Link
                href={`/entrenador/${clase.perfiles.username}`}
                className="font-semibold text-[#3D4A00] hover:underline"
              >
                @{clase.perfiles.username}
              </Link>
            </p>
          )}

          {pendienteConfirmacion && (
            <div className="mb-3 flex items-center justify-between corte-tag border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              <span>{textoFaltanParaConfirmar(faltanParaConfirmar)}</span>
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm text-[#6B7355]">
            <p>
              Ciudad: <span className="text-[#1F2400]">{clase.ciudad}</span>
            </p>
            <p>
              Fecha: <span className="text-[#1F2400]">{formatearFechaParaMostrar(clase.fecha)}</span> · Hora:{' '}
              <span className="text-[#1F2400]">{clase.hora}</span>
            </p>
            {clase.duracion != null && (
              <p>
                Duración: <span className="text-[#1F2400]">{clase.duracion} min</span>
              </p>
            )}
            <p>
              Precio: <span className="font-semibold text-[#1F2400]">{clase.precio} €</span>
            </p>
            {clase.direccion && (
              <p>
                Zona: <span className="text-[#1F2400]">{clase.direccion}</span>
              </p>
            )}
            {clase.punto_encuentro && (
              <p>
                Punto de encuentro: <span className="text-[#1F2400]">{clase.punto_encuentro}</span>
              </p>
            )}
          </div>

          <AvisoPlazoCancelacion clase={clase} variante="reserva" tipo={tipoReserva(reserva, clase)} className="mt-3" />

          <BotonCalendario clase={clase} className="mt-3" />

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#E2E6CF] pt-3">
            <Link
              href={`/clases/${clase.id}?from=mis-reservas`}
              className="corte-tag border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
            >
              Ver detalle
            </Link>

            <button
              type="button"
              onClick={() => onCancelar(reserva, clase)}
              disabled={cancelando}
              className="corte-tag border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelando ? 'Cancelando...' : 'Cancelar reserva'}
            </button>
          </div>

          {errorCancelacion && <p className="mt-2 text-xs text-red-600">{errorCancelacion}</p>}
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
