'use client'

import Link from 'next/link'
import { ClipboardList, CalendarCheck } from 'lucide-react'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import RevelarAlLlegar from '../RevelarAlLlegar'

// Dos franjas separadas: sesiones propias publicadas (como organizador)
// y reservas propias (como participante). Antes era un único bloque
// de "cifras" solo para quien tenía sesiones publicadas; a petición
// del usuario (11 sept 2026) ahora son dos listas simples en
// paralelo, visibles siempre que haya sesión iniciada.
export default function ProximasSesionesReservas({ clasesActivasAhora, proximasReservasPropias }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <RevelarAlLlegar className="corte-card border border-[#E2E6CF] bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#1F2400]">
            <ClipboardList className="h-5 w-5 text-[#B5E600]" strokeWidth={1.75} />
            Tus próximas sesiones publicadas
          </h2>
          {clasesActivasAhora.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-[#6B7355]">Todavía no tienes ninguna sesión publicada próxima.</p>
              <Link href="/publicar" className="text-sm font-semibold text-[#3D4A00] hover:underline">
                Publicar una sesión →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[#E2E6CF]">
              {clasesActivasAhora.slice(0, 4).map((c) => (
                <Link
                  key={c.clase_id}
                  href={`/clases/${c.clase_id}?from=mis-clases`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:bg-[#F4F5EE]"
                >
                  <span className="truncate font-semibold text-[#1F2400]">{c.titulo}</span>
                  <span className="shrink-0 text-xs text-[#6B7355]">
                    {formatearFechaParaMostrar(c.fecha)} · {String(c.hora).slice(0, 5)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </RevelarAlLlegar>

        <RevelarAlLlegar delayMs={80} className="corte-card border border-[#E2E6CF] bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#1F2400]">
            <CalendarCheck className="h-5 w-5 text-[#B5E600]" strokeWidth={1.75} />
            Tus próximas reservas
          </h2>
          {proximasReservasPropias.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-[#6B7355]">Todavía no tienes ninguna reserva próxima.</p>
              <Link href="/clases" className="text-sm font-semibold text-[#3D4A00] hover:underline">
                Buscar una sesión →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[#E2E6CF]">
              {proximasReservasPropias.slice(0, 4).map((r) => (
                <Link
                  key={r.id}
                  href={`/clases/${r.clases.id}?from=mis-reservas`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:bg-[#F4F5EE]"
                >
                  <span className="truncate font-semibold text-[#1F2400]">{r.clases.titulo}</span>
                  <span className="shrink-0 text-xs text-[#6B7355]">
                    {formatearFechaParaMostrar(r.clases.fecha)} · {String(r.clases.hora).slice(0, 5)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </RevelarAlLlegar>
      </div>
    </section>
  )
}
