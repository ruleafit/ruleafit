'use client'

const clasePestanaActiva =
  'corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400]'
const clasePestanaInactiva =
  'corte-btn border border-[#E2E6CF] px-4 py-2 text-sm font-semibold text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400]'

export default function PestanasMisClases({ pestana, onCambiar }) {
  return (
    <div className="mb-8 flex gap-2">
      <button
        type="button"
        onClick={() => onCambiar('sesiones')}
        className={pestana === 'sesiones' ? clasePestanaActiva : clasePestanaInactiva}
      >
        Sesiones
      </button>
      <button
        type="button"
        onClick={() => onCambiar('bonos')}
        className={pestana === 'bonos' ? clasePestanaActiva : clasePestanaInactiva}
      >
        Bonos
      </button>
    </div>
  )
}
