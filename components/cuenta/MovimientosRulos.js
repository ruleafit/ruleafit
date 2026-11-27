'use client'

import { formatearMomentoParaMostrar } from '../../lib/formatoFecha'

export default function MovimientosRulos({ movimientos, motivos }) {
  return (
    <div className="mb-8">
      {movimientos.length === 0 ? (
        <div className="corte-card border border-dashed border-[#E2E6CF] px-6 py-8 text-center text-sm text-[#6B7355]">
          Todavía no tienes movimientos de Rulos. Cuando reserves o asistas a una sesión, aparecerán aquí.
        </div>
      ) : (
        <div className="divide-y divide-[#E2E6CF] overflow-hidden corte-card border border-[#E2E6CF] bg-white">
          {movimientos.map((mov) => (
            <div key={mov.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm text-[#1F2400]">{mov.nota || motivos[mov.motivo] || mov.motivo}</p>
                <p className="text-xs text-[#6B7355]">{formatearMomentoParaMostrar(mov.created_at)}</p>
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${mov.cantidad > 0 ? 'text-[#3D4A00]' : 'text-red-700'}`}
              >
                {mov.cantidad > 0 ? '+' : ''}
                {mov.cantidad} {Math.abs(mov.cantidad) === 1 ? 'Rulo' : 'Rulos'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
