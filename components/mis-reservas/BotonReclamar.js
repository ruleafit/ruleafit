'use client'

// Acceso a la reclamación económica desde una reserva. Solo se pinta si la lista recibe onReclamar
// (hoy, solo con los pagos online visibles).
export default function BotonReclamar({ reservaId, onReclamar, className = '' }) {
  if (!onReclamar) return null
  return (
    <button
      type="button"
      onClick={() => onReclamar(reservaId)}
      className={`corte-tag border border-[#E2E6CF] bg-white px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] ${className}`}
    >
      Reclamar un cobro o reembolso
    </button>
  )
}
