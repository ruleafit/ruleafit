'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Users, Pencil, Ban, ChevronDown, Megaphone } from 'lucide-react'
import { claseYaPaso, motivoNoEditableClase } from '../../lib/ventanaEdicionClase'
import { formatearFechaParaMostrar, diaSemanaParaMostrar } from '../../lib/formatoFecha'
import AlumnosClase from './AlumnosClase'
import DialogoCancelarSerie from './DialogoCancelarSerie'
import PanelAvisosParticipantes from './PanelAvisosParticipantes'

const botonFila =
  'inline-flex items-center gap-1 corte-tag border border-[#E2E6CF] px-2.5 py-1 text-xs font-semibold text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]'

// Una sesión de la serie en el listado desplegable: fecha, plazas, participantes, editar y cancelar.
export default function FilaSesionSerie({ clase, m, onResultado }) {
  const [verAlumnos, setVerAlumnos] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [aviso, setAviso] = useState(false)
  const haPasado = claseYaPaso({ fecha: clase.clase_fecha, hora: clase.clase_hora })
  const cancelada = clase.estado === 'cancelada'
  const editable = !motivoNoEditableClase({ fecha: clase.clase_fecha, hora: clase.clase_hora, estado: clase.estado })
  const puedeCancelar = clase.estado === 'activa' && !haPasado

  return (
    <li className={`px-3 py-2.5 ${haPasado || cancelada ? 'bg-zinc-50' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className={`text-sm font-bold ${haPasado || cancelada ? 'text-zinc-500' : 'text-[#1F2400]'}`}>
            <span className="inline-block w-[5.5rem] capitalize text-[#6B7355]">{diaSemanaParaMostrar(clase.clase_fecha)}</span>
            {formatearFechaParaMostrar(clase.clase_fecha)} · {String(clase.clase_hora).slice(0, 5)}
          </p>
          <p className="mt-0.5 text-xs text-[#6B7355]">
            {cancelada ? (
              <span className="font-semibold text-red-600">Cancelada</span>
            ) : (
              <>
                {clase.plazas_ocupadas}/{clase.plazas_max} plazas
                {haPasado && ' · celebrada'}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!cancelada && (
            <button type="button" onClick={() => setVerAlumnos((v) => !v)} aria-expanded={verAlumnos} className={botonFila}>
              <Users className="h-3.5 w-3.5" strokeWidth={2} />
              Participantes
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verAlumnos ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
          )}
          {!haPasado && !cancelada && (
            <Link href={`/clases/${clase.clase_id}?from=mis-clases`} className={botonFila}>
              Ver
            </Link>
          )}
          {puedeCancelar && (
            <button type="button" onClick={() => setAviso((v) => !v)} aria-expanded={aviso} className={botonFila}>
              <Megaphone className="h-3.5 w-3.5" strokeWidth={2} />
              Enviar aviso a participantes
            </button>
          )}
          {editable && (
            <Link href={`/mis-clases/${clase.clase_id}/editar`} className={botonFila}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              Editar
            </Link>
          )}
          {puedeCancelar && (
            <button
              type="button"
              onClick={() => setCancelando((v) => !v)}
              aria-expanded={cancelando}
              className="inline-flex items-center gap-1 corte-tag px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <Ban className="h-3.5 w-3.5" strokeWidth={2} />
              Cancelar…
            </button>
          )}
        </div>
      </div>

      {verAlumnos && <AlumnosClase clase={clase} haPasado={haPasado} />}

      {aviso && puedeCancelar && <PanelAvisosParticipantes clase={clase} onCerrar={() => setAviso(false)} />}

      {cancelando && (
        <DialogoCancelarSerie
          clase={clase}
          alcances={['solo_esta', 'esta_y_siguientes', 'toda_futura']}
          m={m}
          onResultado={(t) => {
            setCancelando(false)
            onResultado(t)
          }}
          onCerrar={() => setCancelando(false)}
        />
      )}
    </li>
  )
}
