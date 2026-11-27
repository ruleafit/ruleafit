import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { SALDOS, avisosDeSaldo } from '../../lib/pagos/ingresos.ts'

export default function TarjetasSaldo({ datos }) {
  const avisos = avisosDeSaldo(datos, formatearEuros)
  return (
    <section aria-label="Saldos">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SALDOS.map(({ clave, titulo, ayuda }) => (
          <div
            key={clave}
            className={`corte-card border bg-white p-4 shadow-sm ${clave === 'disponible_centimos' ? 'border-[#B5E600] border-l-4' : 'border-[#E2E6CF]'}`}
          >
            <dt className="text-sm font-semibold text-[#6B7355]">{titulo}</dt>
            <dd className="mt-1 text-3xl font-extrabold tracking-tight text-[#1F2400]">{formatearEuros(datos[clave] ?? 0)}</dd>
            <dd className="mt-1 text-xs text-[#6B7355]">{ayuda}</dd>
          </div>
        ))}
      </dl>
      {avisos.map((aviso) => (
        <p key={aviso} role="status" className="mt-3 corte-card border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {aviso}
        </p>
      ))}
    </section>
  )
}
