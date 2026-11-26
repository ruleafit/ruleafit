'use client'

const clasePestanaActiva =
  'corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400]'
const clasePestanaInactiva =
  'corte-btn border border-[#E2E6CF] px-4 py-2 text-sm font-semibold text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400]'

export default function PestanasMisReservas({ pestana, onCambiar, conReclamaciones = false }) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onCambiar('reservas')}
        className={pestana === 'reservas' ? clasePestanaActiva : clasePestanaInactiva}
      >
        Reservas
      </button>
      <button
        type="button"
        onClick={() => onCambiar('bonos')}
        className={pestana === 'bonos' ? clasePestanaActiva : clasePestanaInactiva}
      >
        Bonos
      </button>
      {conReclamaciones && (
        <button
          type="button"
          onClick={() => onCambiar('reclamaciones')}
          className={pestana === 'reclamaciones' ? clasePestanaActiva : clasePestanaInactiva}
        >
          Reclamaciones
        </button>
      )}
    </div>
  )
}
