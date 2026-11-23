'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Repeat, ChevronDown, Settings2, Pencil, Ban, CalendarClock } from 'lucide-react'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import { diaSemanaIso, textoDias } from '../../lib/seriesSesiones'
import { claveFechaHora } from './datos'
import FilaSesionSerie from './FilaSesionSerie'
import CambiarPatronSerie from './CambiarPatronSerie'
import DialogoCancelarSerie from './DialogoCancelarSerie'

const POR_PAGINA = 15

function Bloque({ titulo, Icono, abierto, onToggle, children }) {
  return (
    <div className="corte-card border border-[#E2E6CF] bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-bold text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B5E600]"
      >
        <span className="inline-flex items-center gap-2">
          <Icono className="h-4 w-4 text-[#3D4A00]" strokeWidth={2} />
          {titulo}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#6B7355] transition-transform ${abierto ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      {abierto && <div className="border-t border-[#E2E6CF] p-3">{children}</div>}
    </div>
  )
}

// Una serie de sesiones recurrentes en «Mis sesiones publicadas»: una sola tarjeta con el
// resumen, «Ver sesiones» (listado desplegable) y «Gestionar serie» (editar, cambiar días y
// horas, cancelar). Las sesiones siguen siendo sesiones normales e independientes.
export default function SerieMisClases({ serie, sesiones, m }) {
  const [verSesiones, setVerSesiones] = useState(false)
  const [gestionar, setGestionar] = useState(false)
  const [bloque, setBloque] = useState(null)
  const [verTodas, setVerTodas] = useState(false)
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const [mensaje, setMensaje] = useState('')

  const ordenadas = useMemo(() => [...sesiones].sort((a, b) => (claveFechaHora(a) < claveFechaHora(b) ? -1 : 1)), [sesiones])
  const futuras = ordenadas.filter((s) => s.estado === 'activa' && !claseYaPaso({ fecha: s.clase_fecha, hora: s.clase_hora }))
  const base = futuras.length > 0 ? futuras : ordenadas.filter((s) => s.estado !== 'cancelada')
  const dias = [...new Set(base.map((s) => diaSemanaIso(s.clase_fecha)))]
  const horarios = new Set(base.map((s) => `${diaSemanaIso(s.clase_fecha)}-${String(s.clase_hora).slice(0, 5)}`)).size
  const conReservas = futuras.filter((s) => s.alumnos.length > 0).length
  const proxima = futuras[0]
  const ocultas = ordenadas.length - futuras.length
  const lista = verTodas ? ordenadas : futuras
  const mostradas = lista.slice(0, visibles)

  return (
    <div className="corte-card border border-[#B5E600] border-l-4 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDF5C9] text-[#3D4A00]">
          <Repeat className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-extrabold uppercase tracking-wide text-[#1F2400] sm:text-lg">{serie.titulo}</h3>
          <p className="mt-0.5 text-sm font-semibold text-[#3D4A00]">{dias.length ? textoDias(dias) : 'Serie sin sesiones futuras'}</p>
          <p className="mt-1 text-sm text-[#6B7355]">
            {horarios} {horarios === 1 ? 'horario semanal' : 'horarios semanales'}
          </p>
          <p className="text-sm text-[#6B7355]">
            <b className="text-[#1F2400]">{futuras.length}</b> {futuras.length === 1 ? 'sesión programada' : 'sesiones programadas'}
            {conReservas > 0 && ` · ${conReservas} con reservas`}
          </p>
          {proxima && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#3D4A00]">
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
              Próxima: {formatearFechaParaMostrar(proxima.clase_fecha)} · {String(proxima.clase_hora).slice(0, 5)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setVerSesiones((v) => !v)}
          aria-expanded={verSesiones}
          className="inline-flex items-center gap-1.5 corte-btn bg-[#B5E600] px-4 py-2 text-xs font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400]"
        >
          {verSesiones ? 'Ocultar sesiones' : 'Ver sesiones'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verSesiones ? 'rotate-180' : ''}`} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={() => setGestionar((v) => !v)}
          aria-expanded={gestionar}
          className="inline-flex items-center gap-1.5 corte-btn border border-[#B5E600] bg-white px-4 py-2 text-xs font-bold text-[#3D4A00] transition-colors hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
          Gestionar serie
        </button>
      </div>

      {mensaje && <p className="mt-3 text-sm font-medium text-[#3D4A00]">{mensaje}</p>}

      {verSesiones && (
        <div className="mt-4">
          {lista.length === 0 ? (
            <p className="text-sm text-[#6B7355]">No hay sesiones futuras en esta serie.</p>
          ) : (
            <ul className="divide-y divide-[#E2E6CF] overflow-hidden rounded-lg border border-[#E2E6CF]">
              {mostradas.map((s) => (
                <FilaSesionSerie key={s.clase_id} clase={s} m={m} onResultado={setMensaje} />
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {lista.length > visibles ? (
              <button type="button" onClick={() => setVisibles((v) => v + POR_PAGINA)} className="text-xs font-semibold text-[#3D4A00] hover:underline">
                Mostrar más ({lista.length - visibles} restantes)
              </button>
            ) : (
              <span />
            )}
            {ocultas > 0 && (
              <button type="button" onClick={() => setVerTodas((v) => !v)} className="text-xs font-semibold text-[#6B7355] hover:underline">
                {verTodas ? 'Solo las futuras' : `Incluir pasadas y canceladas (${ocultas})`}
              </button>
            )}
          </div>
        </div>
      )}

      {gestionar && (
        <div className="mt-4 flex flex-col gap-2">
          <Bloque titulo="Editar las sesiones futuras" Icono={Pencil} abierto={bloque === 'editar'} onToggle={() => setBloque(bloque === 'editar' ? null : 'editar')}>
            {proxima ? (
              <>
                <p className="mb-3 text-sm text-[#6B7355]">
                  Cambia el título, la descripción, el material, las plazas y, en las sesiones sin reservas, el precio y la duración. Elegirás si se aplica a una sesión, a las siguientes o a toda la serie futura.
                </p>
                <Link
                  href={`/mis-clases/${proxima.clase_id}/editar?alcance=toda_futura`}
                  className="inline-flex items-center gap-1.5 corte-btn bg-[#B5E600] px-4 py-2 text-xs font-bold text-[#1F2400] hover:bg-[#a3d100]"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  Editar la serie
                </Link>
              </>
            ) : (
              <p className="text-sm text-[#6B7355]">No quedan sesiones futuras que editar.</p>
            )}
          </Bloque>

          <Bloque titulo="Cambiar días y horas" Icono={CalendarClock} abierto={bloque === 'patron'} onToggle={() => setBloque(bloque === 'patron' ? null : 'patron')}>
            <CambiarPatronSerie serie={serie} sesiones={ordenadas} m={m} onResultado={setMensaje} />
          </Bloque>

          <Bloque titulo="Cancelar sesiones" Icono={Ban} abierto={bloque === 'cancelar'} onToggle={() => setBloque(bloque === 'cancelar' ? null : 'cancelar')}>
            {proxima ? (
              <>
                <p className="text-sm text-[#6B7355]">
                  Para cancelar solo una sesión o desde una fecha, usa «Cancelar…» en esa sesión dentro de «Ver sesiones».
                </p>
                <DialogoCancelarSerie clase={proxima} alcances={['toda_futura']} m={m} onResultado={setMensaje} onCerrar={() => setBloque(null)} />
              </>
            ) : (
              <p className="text-sm text-[#6B7355]">No quedan sesiones futuras que cancelar.</p>
            )}
          </Bloque>
        </div>
      )}
    </div>
  )
}
