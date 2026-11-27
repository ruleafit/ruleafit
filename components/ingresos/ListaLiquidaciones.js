import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'

export default function ListaLiquidaciones({ liquidaciones }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
        Transferencias a tu cuenta
      </h2>
      {liquidaciones.length === 0 ? (
        <p className="text-sm text-[#6B7355]">
          Las transferencias todavía no están disponibles en la plataforma. Cuando se hagan, aparecerán aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {liquidaciones.map((l, i) => (
            <li key={`${l.fecha}-${i}`} className="flex flex-wrap justify-between gap-2 corte-card border border-[#E2E6CF] bg-white p-3 text-sm text-[#1F2400]">
              <span>
                {formatearFechaParaMostrar(l.fecha)}
                {l.iban_ultimos4 ? ` · cuenta terminada en ${l.iban_ultimos4}` : ''}
                {l.estado === 'pagada' ? '' : ' · pendiente'}
              </span>
              <strong>{formatearEuros(l.importe_centimos)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
