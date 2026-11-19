'use client'

import Link from 'next/link'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../lib/imagenesCategoria'
import { textoPlazas } from '../../lib/formatoPlazas'
import { estadoConfirmacionClase } from '../../lib/confirmacionClase'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import BotonReservar from '../BotonReservar'
import BotonCopiarCoordenadas from '../BotonCopiarCoordenadas'
import BotonCompartir from '../BotonCompartir'
import RevelarAlLlegar from '../RevelarAlLlegar'

export default function TarjetaClase({ clase, indice, usuario, onReservado, onErrorCoordenadas }) {
  const plazasMax = clase.plazas_max ?? 0
  const plazasOcupadas = clase.plazas_ocupadas ?? 0
  const plazasMin = clase.plazas_min ?? 0
  const porcentajeOcupado = plazasMax > 0 ? Math.min((plazasOcupadas / plazasMax) * 100, 100) : 0
  const { pendienteConfirmacion } = estadoConfirmacionClase({ plazasMin, plazasOcupadas })
  const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO
  // Por sesión, no por usuario (Fase 5 de la unificación de
  // roles, 11 sept 2026): un mismo usuario puede organizar
  // esta sesión y ser participante en otra de la lista.
  const esEntrenador = !!(usuario && clase.trainer_id === usuario.id)

  return (
    <RevelarAlLlegar delayMs={Math.min(indice * 60, 240)}>
    <div className="tarjeta-hover overflow-hidden corte-card border border-[#E2E6CF] bg-white shadow-sm">
      <div className="zoom-imagen relative h-40 w-full sm:h-44">
        <img src={imagenClase} alt="" className="h-full w-full object-cover" />
        {clase.categoria && (
          <span className="absolute left-3 top-3 corte-tag border border-[#B5E600] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#1F2400]">
            {clase.categoria}
          </span>
        )}
        <div className="absolute right-3 top-3">
          <BotonCompartir clase={clase} />
        </div>
      </div>

      <div className="p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[#1F2400] sm:text-xl">{clase.titulo}</h2>
          <span className="shrink-0 text-xs text-[#6B7355]">
            {clase.ciudad}
            {clase.distanciaKm != null && ` · a ${Math.round(clase.distanciaKm)} km`}
          </span>
        </div>
        {(clase.tipo_actividad || clase.perfiles?.username) && (
          <div className="mb-3 text-sm text-[#6B7355]">
            {clase.tipo_actividad && <p>{clase.tipo_actividad}</p>}
            {clase.perfiles?.username && (
              <p className="text-base">
                por{' '}
                <Link
                  href={`/entrenador/${clase.perfiles.username}`}
                  className="font-semibold text-[#3D4A00] hover:underline"
                >
                  @{clase.perfiles.username}
                </Link>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1 text-sm text-[#6B7355]">
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

        <div className="mt-4">
          {pendienteConfirmacion ? (
            <div className="mb-1 flex items-center justify-between corte-tag border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              <span>Pendiente de confirmación ({plazasOcupadas}/{plazasMin} plazas mínimas)</span>
            </div>
          ) : (
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-[#6B7355]">
              <span>{textoPlazas({ esEntrenador, plazasOcupadas, plazasMax })}</span>
            </div>
          )}
          <div className="h-1.5 w-full overflow-hidden corte-barra bg-[#EDF5C9]">
            <div
              className="h-full corte-barra bg-[#B5E600] motion-safe:transition-all motion-safe:duration-300"
              style={{ width: `${porcentajeOcupado}%` }}
            />
          </div>
        </div>

        <div className="mt-4">
          <BotonReservar clase={clase} onReservado={(nuevasPlazasOcupadas) => onReservado(clase.id, nuevasPlazasOcupadas)} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E2E6CF] pt-3">
          {clase.lat != null && clase.lng != null && (
            <>
              <span className="select-all text-xs text-[#6B7355]">
                {clase.lat}, {clase.lng}
              </span>
              <BotonCopiarCoordenadas
                lat={clase.lat}
                lng={clase.lng}
                onError={onErrorCoordenadas}
                className="corte-tag border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
              />
            </>
          )}
          <Link
            href={`/clases/${clase.id}?from=clases`}
            className="corte-tag border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
          >
            Ver detalle
          </Link>
        </div>
      </div>
    </div>
    </RevelarAlLlegar>
  )
}
