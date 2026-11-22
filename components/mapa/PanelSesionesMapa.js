'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { X, ArrowLeft, CalendarDays, Clock, ChevronRight } from 'lucide-react'
import { agruparPorOrganizador, ordenarSesiones } from '../../lib/agruparMapa'
import { formatearFechaParaMostrar, formatearHoraParaMostrar, diaSemanaParaMostrar } from '../../lib/formatoFecha'

const POR_PAGINA = 20

function Avatar({ perfil }) {
  const inicial = (perfil?.username || '?').charAt(0).toUpperCase()
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#B5E600] text-base font-extrabold text-[#1F2400] shadow ring-2 ring-[#3D4A00]">
      {inicial}
      {perfil?.foto_url && (
        <img
          src={perfil.foto_url}
          alt=""
          onError={(e) => e.currentTarget.remove()}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  )
}

// Lista de sesiones de UN organizador en esa ubicación: más próximas primero, agrupadas por
// día y paginadas (20 en 20) para que 90 sesiones no saturen la pantalla.
function ListaSesionesOrganizador({ organizador, onVolver, onCerrar }) {
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const sesiones = organizador.sesiones
  const username = organizador.perfil?.username

  useEffect(() => setVisibles(POR_PAGINA), [organizador.trainerId])

  const mostradas = sesiones.slice(0, visibles)
  let diaAnterior = null

  return (
    <>
      <div className="flex items-center gap-3 border-b border-[#E2E6CF] p-3">
        {onVolver && (
          <button type="button" onClick={onVolver} aria-label="Volver a los organizadores" className="shrink-0 rounded-full p-1.5 text-[#3D4A00] hover:bg-[#EDF5C9]">
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
        <Avatar perfil={organizador.perfil} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#1F2400]">{username ? `@${username}` : 'Organizador'}</p>
          <p className="text-xs text-[#6B7355]">
            {sesiones.length} {sesiones.length === 1 ? 'sesión' : 'sesiones'} en este punto
          </p>
        </div>
        {username && (
          <Link
            href={`/entrenador/${encodeURIComponent(username)}`}
            className="shrink-0 corte-btn bg-[#B5E600] px-3 py-2 text-xs font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
          >
            Ir al perfil
          </Link>
        )}
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 rounded-full p-1.5 text-[#6B7355] hover:bg-[#EDF5C9] hover:text-[#1F2400]">
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {mostradas.map((s) => {
          const cabecera = s.fecha !== diaAnterior
          diaAnterior = s.fecha
          const libres = Math.max((s.plazas_max ?? 0) - (s.plazas_ocupadas ?? 0), 0)
          return (
            <li key={s.id}>
              {cabecera && s.fecha && (
                <p className="sticky top-0 z-[1] bg-[#FBFAF3] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#6B7355]">
                  <span className="capitalize">{diaSemanaParaMostrar(s.fecha)}</span> {formatearFechaParaMostrar(s.fecha)}
                </p>
              )}
              <Link
                href={`/clases/${s.id}?from=clases`}
                className="flex items-center gap-2 border-b border-[#E2E6CF] px-3 py-2.5 hover:bg-[#F5F7E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B5E600]"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-[#1F2400]">{s.titulo}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs text-[#6B7355]">
                    {s.hora && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" strokeWidth={2} />
                        {formatearHoraParaMostrar(s.hora)}
                      </span>
                    )}
                    {s.categoria && <span>{s.categoria}</span>}
                    <span>{s.precio != null ? `${s.precio} €` : ''}</span>
                    <span>{libres}/{s.plazas_max ?? 0} libres</span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#6B7355]" strokeWidth={2} />
              </Link>
            </li>
          )
        })}
        {visibles < sesiones.length && (
          <li className="p-3">
            <button
              type="button"
              onClick={() => setVisibles((v) => v + POR_PAGINA)}
              className="w-full corte-btn border-2 border-[#B5E600] bg-white px-4 py-2 text-sm font-bold text-[#3D4A00] hover:bg-[#F5F7E8]"
            >
              Mostrar más ({sesiones.length - visibles} restantes)
            </button>
          </li>
        )}
      </ul>
    </>
  )
}

// Panel sobre el mapa (hoja inferior en móvil, columna a la derecha en escritorio). No mueve el
// mapa: al cerrarlo se conservan posición y zoom.
//   panel = { tipo: 'sesiones', trainerId, ids } | { tipo: 'organizadores', ids }
// Las sesiones se vuelven a leer de `clases` (ya filtradas por los filtros y la visibilidad), así
// que el panel nunca enseña sesiones que los filtros hayan ocultado.
export default function PanelSesionesMapa({ panel, clases, onCerrar }) {
  const [elegido, setElegido] = useState(null)

  useEffect(() => setElegido(null), [panel])

  const delPanel = useMemo(() => {
    if (!panel) return []
    const ids = new Set(panel.ids)
    return clases.filter((c) => ids.has(c.id))
  }, [panel, clases])

  const organizadores = useMemo(() => agruparPorOrganizador(delPanel), [delPanel])

  if (!panel) return null

  const unico = panel.tipo === 'sesiones' ? organizadores.find((o) => o.trainerId === panel.trainerId) : null
  const seleccion = unico || (elegido ? organizadores.find((o) => o.trainerId === elegido) : null)

  return (
    <div
      role="dialog"
      aria-label="Sesiones en este punto"
      className="absolute inset-x-2 bottom-2 z-[1000] flex max-h-[85%] flex-col overflow-hidden corte-card border border-[#E2E6CF] bg-white shadow-xl sm:inset-y-2 sm:left-auto sm:right-2 sm:max-h-none sm:w-80"
    >
      {seleccion ? (
        <ListaSesionesOrganizador organizador={seleccion} onVolver={unico ? null : () => setElegido(null)} onCerrar={onCerrar} />
      ) : delPanel.length === 0 ? (
        <div className="flex items-center justify-between gap-2 p-4">
          <p className="text-sm text-[#6B7355]">Ya no hay sesiones que mostrar con los filtros actuales.</p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 rounded-full p-1.5 text-[#6B7355] hover:bg-[#EDF5C9]">
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 border-b border-[#E2E6CF] p-3">
            <div>
              <p className="text-sm font-bold text-[#1F2400]">{organizadores.length} organizadores en este punto</p>
              <p className="text-xs text-[#6B7355]">Elige uno para ver sus sesiones.</p>
            </div>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 rounded-full p-1.5 text-[#6B7355] hover:bg-[#EDF5C9] hover:text-[#1F2400]">
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {organizadores.map((o) => (
              <li key={o.trainerId}>
                <button
                  type="button"
                  onClick={() => setElegido(o.trainerId)}
                  className="flex w-full items-center gap-3 border-b border-[#E2E6CF] px-3 py-2.5 text-left hover:bg-[#F5F7E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B5E600]"
                >
                  <Avatar perfil={o.perfil} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#1F2400]">
                      {o.perfil?.username ? `@${o.perfil.username}` : 'Organizador'}
                    </span>
                    <span className="block text-xs text-[#6B7355]">
                      {o.sesiones.length} {o.sesiones.length === 1 ? 'sesión' : 'sesiones'}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#6B7355]" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

    </div>
  )
}
