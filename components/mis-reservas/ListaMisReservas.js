'use client'

import Link from 'next/link'
import { CalendarSearch } from 'lucide-react'
import { claseYaPaso, horasHastaClase } from '../../lib/ventanaEdicionClase'
import RevelarAlLlegar from '../RevelarAlLlegar'
import TarjetaReservaProxima from './TarjetaReservaProxima'
import TarjetaReservaCancelada from './TarjetaReservaCancelada'
import TarjetaReservaPasada from './TarjetaReservaPasada'
import TarjetaReservaCanceladaAjena from './TarjetaReservaCanceladaAjena'
import { claveFechaHora } from './datos'

// m = useMisReservas.
export default function ListaMisReservas({ m, onReclamar }) {
  const { reservas, canceladasAjenas = [], error, mensaje } = m

  const reservasActivas = reservas.filter((r) => r.estado === 'activa' && r.clases)
  const reservasCanceladasPorEntrenador = reservas.filter(
    (r) =>
      r.estado === 'cancelada' &&
      r.cancelada_por_entrenador &&
      r.clases &&
      horasHastaClase(r.clases) > -1
  )
  const sinReservas =
    reservasActivas.length === 0 && reservasCanceladasPorEntrenador.length === 0 && canceladasAjenas.length === 0

  const reservasProximas = reservasActivas
    .filter((r) => !claseYaPaso(r.clases))
    .sort((a, b) => (claveFechaHora(a.clases) < claveFechaHora(b.clases) ? -1 : 1))

  const reservasPasadas = reservasActivas
    .filter((r) => claseYaPaso(r.clases))
    .sort((a, b) => (claveFechaHora(a.clases) > claveFechaHora(b.clases) ? -1 : 1))

  const reservasPasadasRecientes = reservasPasadas.filter((r) => horasHastaClase(r.clases) > -30 * 24)

  const clasesRealizadas = reservasPasadas.length

  return (
    <>
      {mensaje && (
        <div
          role="status"
          className="mb-4 corte-card border border-[#B5E600] bg-[#EDF5C9] px-4 py-2.5 text-sm font-medium text-[#1F2400]"
        >
          {mensaje}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!error && sinReservas && (
        <RevelarAlLlegar className="flex flex-col items-center gap-4 corte-card border border-[#E2E6CF] bg-white px-6 py-16 text-center">
          <CalendarSearch className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
          <p className="text-sm text-[#6B7355]">Todavía no has reservado ninguna sesión</p>
          <Link
            href="/clases"
            className="inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
          >
            Ver sesiones
          </Link>
        </RevelarAlLlegar>
      )}

      <div className="flex flex-col gap-4">
        {reservasProximas.map((reserva, indice) => (
          <TarjetaReservaProxima
            key={reserva.id}
            reserva={reserva}
            indice={indice}
            cancelando={m.cancelandoId === reserva.id}
            errorCancelacion={m.erroresCancelacion[reserva.id]}
            onCancelar={m.handleCancelar}
            onReclamar={onReclamar}
          />
        ))}
      </div>

      {reservasCanceladasPorEntrenador.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
            Sesiones canceladas por el entrenador / organizador
          </h2>

          <div className="flex flex-col gap-4">
            {reservasCanceladasPorEntrenador.map((reserva, indice) => (
              <TarjetaReservaCancelada key={reserva.id} reserva={reserva} indice={indice} onReclamar={onReclamar} />
            ))}
          </div>
        </div>
      )}

      {canceladasAjenas.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
            Reservas canceladas
          </h2>

          <div className="flex flex-col gap-4">
            {canceladasAjenas.map((reserva, indice) => (
              <TarjetaReservaCanceladaAjena key={reserva.reserva_id} reserva={reserva} indice={indice} onReclamar={onReclamar} />
            ))}
          </div>
        </div>
      )}

      {reservasPasadas.length > 0 && (
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between border-b border-[#E2E6CF] pb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B7355]">Historial</h2>
            <span className="text-xs text-[#6B7355]">
              {clasesRealizadas} {clasesRealizadas === 1 ? 'sesión realizada' : 'sesiones realizadas'}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {reservasPasadasRecientes.map((reserva, indice) => (
              <TarjetaReservaPasada key={reserva.id} reserva={reserva} indice={indice} onReclamar={onReclamar} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
