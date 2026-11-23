'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarPlus, CalendarDays, Download, ExternalLink } from 'lucide-react'
import { claseYaPaso } from '../lib/ventanaEdicionClase'
import { eventoDeSesion, generarIcs, nombreArchivoIcs, urlGoogleCalendar } from '../lib/calendario'

// «Añadir al calendario» (C02): Google Calendar (enlace con el evento preparado) o archivo .ics para
// Apple Calendar y otros. Solo informa y entrega el evento: el usuario lo confirma en su calendario; no se
// pide ningún permiso ni se sincroniza nada. Se usa igual tras reservar y en «Mis reservas».
//   clase     sesión (fila de clases con perfiles(username)): id, titulo, fecha, hora, duracion, ciudad, direccion, punto_encuentro
//   pregunta  true → muestra «¿Quieres añadir esta sesión a tu calendario?» (justo después de reservar)
export default function BotonCalendario({ clase, pregunta = false, className = '' }) {
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState('')
  const raiz = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined
    const cerrarConEsc = (e) => e.key === 'Escape' && setAbierto(false)
    const cerrarFuera = (e) => raiz.current && !raiz.current.contains(e.target) && setAbierto(false)
    document.addEventListener('keydown', cerrarConEsc)
    document.addEventListener('pointerdown', cerrarFuera)
    return () => {
      document.removeEventListener('keydown', cerrarConEsc)
      document.removeEventListener('pointerdown', cerrarFuera)
    }
  }, [abierto])

  // Solo sesiones futuras (una sesión ya empezada no se añade al calendario).
  if (!clase || !clase.fecha || !clase.hora || claseYaPaso({ fecha: clase.fecha, hora: clase.hora })) return null

  const evento = eventoDeSesion(clase)

  function descargarIcs() {
    try {
      const blob = new Blob([generarIcs(evento)], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombreArchivoIcs(evento)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setAviso('Archivo descargado: ábrelo para añadir la sesión a tu calendario.')
    } catch {
      setAviso('No se ha podido generar el archivo. Inténtalo de nuevo o usa Google Calendar.')
    }
  }

  const opcion =
    'flex w-full items-center gap-2 corte-tag border border-[#E2E6CF] bg-white px-3 py-2 text-left text-sm font-medium text-[#1F2400] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]'

  return (
    <div ref={raiz} className={className}>
      {pregunta && <p className="mb-1.5 text-xs text-[#6B7355]">¿Quieres añadir esta sesión a tu calendario?</p>}
      <button
        type="button"
        onClick={() => {
          setAbierto((v) => !v)
          setAviso('')
        }}
        aria-expanded={abierto}
        className="inline-flex items-center gap-1.5 corte-tag border border-[#E2E6CF] bg-white px-2.5 py-1 text-xs font-medium text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
      >
        <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
        Añadir al calendario
      </button>

      {abierto && (
        <div className="mt-2 flex max-w-xs flex-col gap-1.5 text-left" role="group" aria-label="Añadir al calendario">
          <a
            href={urlGoogleCalendar(evento)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAviso('Se abre Google Calendar: revisa los datos y confirma el evento allí.')}
            className={opcion}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-[#3D4A00]" strokeWidth={2} />
            <span className="flex-1">Google Calendar</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#6B7355]" strokeWidth={2} />
          </a>
          <button type="button" onClick={descargarIcs} className={opcion}>
            <Download className="h-4 w-4 shrink-0 text-[#3D4A00]" strokeWidth={2} />
            <span className="flex-1">Apple Calendar y otros (.ics)</span>
          </button>
          {aviso && (
            <p role="status" className="text-xs text-[#6B7355]">
              {aviso}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
