'use client'

import { CircleAlert, TriangleAlert, ListChecks } from 'lucide-react'
import { formatearFechaParaMostrar, diaSemanaParaMostrar } from '../../lib/formatoFecha'
import { agruparPorFecha, resumenPorDia, textoDias } from '../../lib/seriesSesiones'

// Resumen y vista previa de la serie ANTES de publicar: actividad, días, horas, fechas, total y la
// lista de fechas y horas reales, con los errores (rojo) y avisos (ámbar) de la validación.
//   previa = { validacion: { errores, avisos, sesiones }, patron, inicio, fin }
export default function VistaPreviaSerie({ previa, titulo }) {
  const { validacion, patron, inicio, fin } = previa
  const { errores, avisos, sesiones } = validacion
  const fechas = agruparPorFecha(sesiones)
  const porDia = resumenPorDia(patron)
  const hayDatos = patron.dias.length > 0

  return (
    <div className="corte-card border border-[#B5E600] bg-[#FBFAF3] p-4" aria-live="polite">
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-[#1F2400]">
        <ListChecks className="h-4 w-4 text-[#3D4A00]" strokeWidth={2} />
        Resumen de la serie
      </p>

      {hayDatos && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-[#6B7355]">Actividad</dt>
          <dd className="font-semibold text-[#1F2400]">{titulo || 'Sin título todavía'}</dd>
          <dt className="text-[#6B7355]">Días</dt>
          <dd className="font-semibold text-[#1F2400]">{textoDias(patron.dias)}</dd>
          <dt className="text-[#6B7355]">Horas</dt>
          <dd className="text-[#1F2400]">
            {porDia.map((d) => (
              <span key={d.dia} className="block">
                <span className="font-semibold">{d.nombre}:</span> {d.horas.length ? d.horas.join(' · ') : '—'}
              </span>
            ))}
          </dd>
          <dt className="text-[#6B7355]">Desde</dt>
          <dd className="text-[#1F2400]">{inicio ? formatearFechaParaMostrar(inicio) : '—'}</dd>
          <dt className="text-[#6B7355]">Hasta</dt>
          <dd className="text-[#1F2400]">{fin ? formatearFechaParaMostrar(fin) : '—'}</dd>
        </dl>
      )}

      <p className="mt-3 text-base font-extrabold text-[#1F2400]">
        {sesiones.length === 0
          ? 'Todavía no hay sesiones que crear'
          : `${sesiones.length} ${sesiones.length === 1 ? 'sesión se creará' : 'sesiones se crearán'}`}
      </p>

      {errores.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {errores.map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-sm font-medium text-red-700">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              {e}
            </li>
          ))}
        </ul>
      )}

      {avisos.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {avisos.map((a, i) => (
            <li key={i} className="flex items-start gap-2 corte-tag border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              {a}
            </li>
          ))}
        </ul>
      )}

      {fechas.length > 0 && (
        <details className="mt-3 group" open={fechas.length <= 8}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-[#3D4A00] hover:underline">
            {fechas.length <= 8 ? 'Fechas y horas' : `Ver las ${fechas.length} fechas y horas`}
          </summary>
          <ul className="mt-2 max-h-72 divide-y divide-[#E2E6CF] overflow-y-auto rounded-lg border border-[#E2E6CF] bg-white text-sm">
            {fechas.map((f) => (
              <li key={f.fecha} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-1.5">
                <span className="font-medium text-[#1F2400]">
                  <span className="inline-block w-24 capitalize text-[#6B7355]">{diaSemanaParaMostrar(f.fecha)}</span>
                  {formatearFechaParaMostrar(f.fecha)}
                </span>
                <span className="min-w-0 text-[#3D4A00]">{f.horas.join(' · ')}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
