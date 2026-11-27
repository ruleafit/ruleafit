import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { formatearMomentoParaMostrar } from '../../lib/formatoFecha'

const ESTADOS = {
  pagado: 'Cobrado',
  fallido: 'No cobrado',
  dudoso: 'En revisión',
  requiere_reembolso: 'Devolución en marcha',
  reembolsado: 'Devuelto',
  reembolsado_parcial: 'Devuelto en parte',
}

export default function HistorialPro({ pagos = [] }) {
  if (pagos.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">Pagos de Pro</h2>
      <ul className="divide-y divide-[#E2E6CF]">
        {pagos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm text-[#1F2400]">
            <span>
              {formatearMomentoParaMostrar(p.created_at)} · {p.tipo === 'alta' ? 'Alta' : 'Renovación'}
            </span>
            <span className="font-semibold">
              {formatearEuros(p.importe_centimos)} · {ESTADOS[p.estado] || p.estado}
              {p.importe_devolver_centimos ? ` (${formatearEuros(p.importe_devolver_centimos)})` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
