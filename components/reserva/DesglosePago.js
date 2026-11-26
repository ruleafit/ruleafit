'use client'

import { formatearEuros } from '../../lib/pagos/dinero.ts'
import AvisoPlazoCancelacion from '../AvisoPlazoCancelacion'

function Linea({ etiqueta, valor, fuerte = false }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${fuerte ? 'border-t border-[#E2E6CF] pt-2 text-base font-bold text-[#1F2400]' : 'text-sm text-[#6B7355]'}`}
    >
      <dt>{etiqueta}</dt>
      <dd className="whitespace-nowrap text-[#1F2400]">{valor}</dd>
    </div>
  )
}

// Desglose del precio final antes de pagar. desglose = calcularDesglose() (lib/pagos/dinero.ts), la misma función que
// usa el servidor para comprobar el total. Aquí no se calcula nada.
export default function DesglosePago({ clase, desglose, pagando, onConfirmar, onVolver }) {
  return (
    <div role="group" aria-label="Desglose del precio" className="w-full max-w-sm corte-card border border-[#B5E600] bg-white p-4 text-left shadow-sm">
      <p className="mb-2 text-sm font-bold text-[#1F2400]">Antes de pagar</p>
      <dl className="flex flex-col gap-1.5">
        <Linea etiqueta="Precio de la sesión" valor={formatearEuros(desglose.precioCentimos)} />
        <Linea etiqueta="Gastos de gestión para ti" valor={formatearEuros(desglose.recargoCentimos)} />
        <Linea etiqueta="Impuestos" valor="Incluidos en el precio" />
        <Linea etiqueta="Total a pagar" valor={formatearEuros(desglose.totalCentimos)} fuerte />
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-[#6B7355]">
        El precio lo fija quien organiza la sesión e incluye los impuestos que correspondan. La comisión de Ruleafit sale
        de su parte: no se te suma nada.
      </p>
      <div className="mt-3 border-t border-[#E2E6CF] pt-2">
        <p className="mb-1 text-xs font-semibold text-[#1F2400]">Política de cancelación</p>
        <AvisoPlazoCancelacion clase={clase} condicionesPago />
        <p className="mt-1 text-[11px] leading-snug text-[#6B7355]">
          Si quien organiza cancela la sesión, o no queda plaza al confirmarse el pago, te corresponde la devolución
          íntegra.
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={onConfirmar}
          disabled={pagando}
          className="corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-black hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pagando ? 'Abriendo el pago...' : `Confirmar y pagar ${formatearEuros(desglose.totalCentimos)}`}
        </button>
        <button
          type="button"
          onClick={onVolver}
          disabled={pagando}
          className="corte-btn border border-[#3D4A00]/30 bg-white px-4 py-2 text-sm font-bold text-[#3D4A00] disabled:opacity-60"
        >
          Volver
        </button>
      </div>
    </div>
  )
}
