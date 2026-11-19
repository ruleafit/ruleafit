'use client'

import { CalendarClock, Users, CircleCheck } from 'lucide-react'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../lib/imagenesCategoria'
import { textoPlazas } from '../../lib/formatoPlazas'
import { estadoConfirmacionClase, textoFaltanParaConfirmar } from '../../lib/confirmacionClase'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import RevelarAlLlegar from '../RevelarAlLlegar'
import AlumnosClase from './AlumnosClase'
import AccionesClase from './AccionesClase'

export default function TarjetaMisClase({
  clase,
  indice,
  atenuada,
  procesandoCancelacion,
  mensajeCancelacion,
  errorCancelacion,
  onCancelar,
}) {
  const haPasado = claseYaPaso({ fecha: clase.clase_fecha, hora: clase.clase_hora })
  const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO
  const porcentajeOcupado =
    clase.plazas_max > 0 ? Math.min((clase.plazas_ocupadas / clase.plazas_max) * 100, 100) : 0
  const { tieneMinimo, pendienteConfirmacion, faltanParaConfirmar } = estadoConfirmacionClase({
    plazasMin: clase.plazas_min,
    plazasOcupadas: clase.plazas_ocupadas,
  })

  const colorTarjeta = atenuada
    ? 'border-zinc-200 bg-zinc-50'
    : clase.estado === 'cancelada'
    ? 'border-red-200 bg-white'
    : 'border-[#E2E6CF] bg-white'
  const colorTitulo = atenuada ? 'text-zinc-500' : 'text-[#1F2400]'
  const colorFecha = atenuada ? 'text-zinc-500' : 'text-[#3D4A00]'

  return (
    <RevelarAlLlegar delayMs={Math.min(indice * 60, 240)}>
      <div className={`tarjeta-hover overflow-hidden corte-card border shadow-sm ${colorTarjeta}`}>
        <div className="zoom-imagen relative h-40 w-full sm:h-44">
          <img
            src={imagenClase}
            alt=""
            className={`h-full w-full object-cover ${atenuada ? 'opacity-80 grayscale' : ''}`}
          />
          {clase.estado === 'cancelada' ? (
            <span className="absolute left-3 top-3 corte-tag border border-red-300 bg-white/90 px-2.5 py-1 text-xs font-semibold text-red-700">
              Sesión cancelada
            </span>
          ) : (
            haPasado && (
              pendienteConfirmacion ? (
                <span className="absolute left-3 top-3 corte-tag border border-zinc-300 bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-500">
                  No se alcanzó el mínimo
                </span>
              ) : (
                <span className="absolute left-3 top-3 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-2.5 py-1 text-xs font-semibold text-[#3D4A00]">
                  Confirmada
                </span>
              )
            )
          )}
        </div>

        <div className="p-5">
          <h3 className={`text-lg font-bold sm:text-xl ${colorTitulo}`}>{clase.clase_titulo}</h3>

          <p className={`mt-2 inline-flex items-center gap-1.5 text-sm font-bold ${colorFecha}`}>
            <CalendarClock className="h-4 w-4" strokeWidth={2} />
            {formatearFechaParaMostrar(clase.clase_fecha)} · {clase.clase_hora}
          </p>

          <div className="mt-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#6B7355]">
              <Users className="h-3.5 w-3.5 text-[#B5E600]" strokeWidth={1.75} />
              {textoPlazas({
                esEntrenador: true,
                plazasOcupadas: clase.plazas_ocupadas,
                plazasMax: clase.plazas_max,
              })}
            </div>
            <div className="h-1.5 w-full overflow-hidden corte-barra bg-[#EDF5C9]">
              <div
                className="h-full corte-barra bg-[#B5E600] motion-safe:transition-all motion-safe:duration-300"
                style={{ width: `${porcentajeOcupado}%` }}
              />
            </div>
          </div>

          {tieneMinimo && !haPasado && (
            <div className="mt-3">
              {pendienteConfirmacion ? (
                <div className="inline-flex items-center corte-tag border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                  {textoFaltanParaConfirmar(faltanParaConfirmar)}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 corte-tag bg-[#EDF5C9] px-3 py-1.5 text-xs font-semibold text-[#3D4A00]">
                  <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  Mínimo alcanzado
                </div>
              )}
            </div>
          )}

          {haPasado && clase.estado === 'cancelada' && (
            <p className="mt-3 text-xs text-zinc-400">
              {clase.motivo_cancelacion === 'minimo'
                ? 'Esta sesión no llegó al mínimo.'
                : 'Sesión cancelada por el entrenador / organizador.'}
            </p>
          )}

          {mensajeCancelacion && <p className="mt-3 text-xs text-[#6B7355]">{mensajeCancelacion}</p>}

          <AlumnosClase clase={clase} haPasado={haPasado} />

          <AccionesClase
            clase={clase}
            haPasado={haPasado}
            procesandoCancelacion={procesandoCancelacion}
            errorCancelacion={errorCancelacion}
            onCancelar={onCancelar}
          />
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
