'use client'

import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../lib/imagenesCategoria'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import RevelarAlLlegar from '../RevelarAlLlegar'
import BotonReclamar from './BotonReclamar'

// Reserva cancelada que no se debe a ti (public.mis_reservas_canceladas_por_bloqueo):
// muestra qué sesión era y el estado del reembolso. A propósito NO enseña quién
// organizaba la sesión ni enlaza a su perfil o a la sesión.
const TEXTO_REEMBOLSO = {
  pendiente: 'Reembolso íntegro del importe pagado: pendiente de tramitar.',
  reembolsado: 'Reembolso íntegro del importe pagado: completado.',
}

export default function TarjetaReservaCanceladaAjena({ reserva, indice, onReclamar }) {
  const imagenClase = IMAGEN_POR_CATEGORIA[reserva.categoria] || IMAGEN_POR_DEFECTO
  const textoReembolso =
    TEXTO_REEMBOLSO[reserva.reembolso] ||
    (reserva.usaba_bono ? 'La sesión de tu bono vuelve a estar disponible.' : 'No había ningún importe que reembolsar.')

  return (
    <RevelarAlLlegar delayMs={Math.min(indice * 60, 240)}>
      <div className="overflow-hidden corte-card border border-red-200 bg-red-50">
        <div className="relative h-24 w-full opacity-80 sm:h-28">
          <img src={imagenClase} alt="" className="h-full w-full object-cover grayscale" />
          {reserva.categoria && (
            <span className="absolute left-3 top-3 corte-tag border border-red-200 bg-white/90 px-2.5 py-1 text-xs font-semibold text-red-400">
              {reserva.categoria}
            </span>
          )}
        </div>

        <div className="p-5">
          <span className="mb-2 block text-xs font-semibold text-red-500">Reserva cancelada</span>
          <h2 className="mb-1 text-lg font-bold text-red-500 sm:text-xl">{reserva.titulo}</h2>

          <div className="flex flex-col gap-1 text-sm text-red-400">
            {reserva.ciudad && (
              <p>
                Ciudad: <span className="text-red-500">{reserva.ciudad}</span>
              </p>
            )}
            <p>
              Fecha: <span className="text-red-500">{formatearFechaParaMostrar(reserva.fecha)}</span> · Hora:{' '}
              <span className="text-red-500">{String(reserva.hora).slice(0, 5)}</span>
            </p>
          </div>

          <p className="mt-3 border-t border-red-200 pt-3 text-sm text-red-500">
            Tu reserva para esta sesión ha sido cancelada. {textoReembolso}
          </p>
          <BotonReclamar reservaId={reserva.reserva_id} onReclamar={onReclamar} className="mt-3" />
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
