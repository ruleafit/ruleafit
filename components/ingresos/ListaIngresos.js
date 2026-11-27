import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { SITUACIONES, textoLiberacion } from '../../lib/pagos/ingresos.ts'
import { formatearFechaParaMostrar, formatearHoraParaMostrar } from '../../lib/formatoFecha'

const COLOR = {
  pendiente: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  disponible: 'border-[#B5E600] bg-[#EDF5C9] text-[#3D4A00]',
  retenido: 'border-amber-300 bg-amber-50 text-amber-800',
  en_devolucion: 'border-amber-300 bg-amber-50 text-amber-800',
  devuelto: 'border-red-200 bg-red-50 text-red-700',
}

const diaMadrid = (iso) => new Date(iso).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })

// Historial: un elemento por cobro abonado, con su reparto tal como quedó guardado.
export default function ListaIngresos({ cobros, total }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
        Historial de ingresos
      </h2>
      {cobros.length === 0 && (
        <p className="text-sm text-[#6B7355]">Todavía no tienes ingresos. Aparecerán aquí cuando alguien pague una de tus sesiones.</p>
      )}
      <ul className="flex flex-col gap-3">
        {cobros.map((c) => {
          const liberacion = textoLiberacion(c.situacion, c.libera_desde)
          const perdido = c.situacion === 'devuelto' || c.situacion === 'en_devolucion'
          return (
            <li key={c.id} className="corte-card border border-[#E2E6CF] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-bold text-[#1F2400]">{c.titulo}</p>
                  <p className="text-xs text-[#6B7355]">
                    {c.fecha ? `Sesión: ${formatearFechaParaMostrar(c.fecha)} ${formatearHoraParaMostrar(c.hora)} · ` : ''}
                    Pagado el {diaMadrid(c.pagado_en)}
                  </p>
                </div>
                <p className={`whitespace-nowrap text-lg font-extrabold ${perdido ? 'text-zinc-400 line-through' : 'text-[#1F2400]'}`}>
                  {formatearEuros(c.neto_centimos)}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className={`corte-tag border px-2.5 py-0.5 text-xs font-bold ${COLOR[c.situacion] || ''}`}>
                  {SITUACIONES[c.situacion] || c.situacion}
                </span>
                <span className="text-xs text-[#6B7355]">
                  Cobrado {formatearEuros(c.importe_centimos)} · comisión {formatearEuros(c.comision_centimos)}
                </span>
              </div>
              {liberacion && <p className="mt-1 text-xs text-[#6B7355]">{liberacion}</p>}
            </li>
          )
        })}
      </ul>
      {total > cobros.length && (
        <p className="mt-3 text-xs text-[#6B7355]">
          Se muestran los {cobros.length} más recientes de {total}.
        </p>
      )}
    </section>
  )
}
