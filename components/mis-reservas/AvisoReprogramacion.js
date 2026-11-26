'use client'

import { TriangleAlert } from 'lucide-react'
import { cambiosDeSesion } from '../../lib/reprogramacion'

// Cambio de fecha, hora o lugar pendiente de respuesta (sql/100). Aceptar, o cancelar sin coste.
export default function AvisoReprogramacion({ cambio, tipo, respondiendo, error, onResponder }) {
  const cambios = cambiosDeSesion(cambio.antes, cambio.despues)
  const salida =
    tipo === 'bono'
      ? 'Si cancelas, recuperas la sesión de tu bono.'
      : tipo === 'pago'
        ? 'Si cancelas, te corresponde la devolución íntegra de lo pagado.'
        : 'Puedes cancelar sin ningún coste.'

  return (
    <div role="alert" className="mt-3 corte-card border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="flex items-center gap-1.5 font-bold">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        Esta sesión ha cambiado
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {cambios.map((c) => (
          <li key={c.campo}>
            <strong>{c.campo}:</strong> <s>{c.antes}</s> → {c.despues}
          </li>
        ))}
      </ul>
      {cambio.motivo && <p className="mt-1">Motivo: {cambio.motivo}</p>}
      <p className="mt-2 text-xs">{salida} Tienes hasta que empiece la sesión; no responder no significa que lo aceptes.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={respondiendo}
          onClick={() => onResponder(true)}
          className="corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400] hover:bg-[#a3d100] disabled:opacity-60"
        >
          Acepto el cambio
        </button>
        <button
          type="button"
          disabled={respondiendo}
          onClick={() => onResponder(false)}
          className="corte-btn border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Cancelar sin coste
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  )
}
