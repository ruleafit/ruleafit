'use client'

import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import BotonReclamar from './BotonReclamar'

// Un pago que no llegó a dar plaza (sesión completa o cancelada al confirmarse): su devolución y cómo reclamar.
export default function TarjetaPagoSinPlaza({ pago, onReclamar }) {
  return (
    <div className="corte-card border border-amber-300 bg-amber-50 p-5">
      <span className="mb-1 block text-xs font-semibold text-amber-800">Pago sin plaza</span>
      <h2 className="text-lg font-bold text-[#1F2400]">{pago.titulo}</h2>
      {pago.fecha && (
        <p className="text-sm text-[#6B7355]">
          {formatearFechaParaMostrar(pago.fecha)} · {String(pago.hora).slice(0, 5)}
        </p>
      )}
      <p className="mt-2 text-sm text-amber-900">
        No se te ha podido dar la plaza. Importe: <strong>{formatearEuros(pago.importe_centimos)}</strong>.{' '}
        {pago.estado_cobro === 'reembolsado' ? 'Devolución completada.' : 'Devolución pendiente de tramitar.'}
      </p>
      <BotonReclamar reservaId={pago.cobro_id} onReclamar={onReclamar} className="mt-3" />
    </div>
  )
}
