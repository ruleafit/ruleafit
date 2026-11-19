'use client'

import { History } from 'lucide-react'

export default function MovimientosRulos({ movimientos, motivos }) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1F2400]">
        <History className="h-5 w-5 text-[#B5E600]" strokeWidth={1.75} />
        Mis últimos Rulos
      </h2>

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
                <p className="text-xs text-[#6B7355]">{new Date(mov.created_at).toLocaleString('es-ES')}</p>
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
