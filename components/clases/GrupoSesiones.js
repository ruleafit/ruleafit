'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { textoPlazas } from '../../lib/formatoPlazas'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import BotonReservar from '../BotonReservar'
import TarjetaClase from './TarjetaClase'
import { textoVerMas } from './agruparSesiones'

const POR_TANDA = 10 // renderizado progresivo del desplegable

function SesionCompacta({ clase, usuario, onReservado }) {
  const esEntrenador = !!(usuario && clase.trainer_id === usuario.id)
  return (
    <li className="border-t border-[#E2E6CF] px-4 py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1F2400]">
            <span className="mr-2 text-[#3D4A00]">{String(clase.hora).slice(0, 5)}</span>
            {clase.titulo}
          </p>
          <p className="mt-0.5 text-xs text-[#6B7355]">
            {clase.precio} € · {textoPlazas({ esEntrenador, plazasOcupadas: clase.plazas_ocupadas ?? 0, plazasMax: clase.plazas_max ?? 0 })}
            {clase.duracion != null && ` · ${clase.duracion} min`}
          </p>
        </div>
        <Link
          href={`/clases/${clase.id}?from=clases`}
          className="shrink-0 corte-tag border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
        >
          Ver detalle
        </Link>
      </div>
      <div className="mt-2">
        <BotonReservar clase={clase} onReservado={(n) => onReservado(clase.id, n)} />
      </div>
    </li>
  )
}

// grupo = { clave, principal, resto, total } (agruparSesiones). `abierto` y `alternar` los lleva la lista para
// poder cerrar el desplegable cuando los filtros cambian las sesiones del grupo.
export default function GrupoSesiones({ grupo, indice, usuario, onReservado, onErrorCoordenadas, abierto, alternar }) {
  const [visibles, setVisibles] = useState(POR_TANDA)
  const hayResto = grupo.resto.length > 0
  const idPanel = `grupo-${String(grupo.clave).replace(/[^a-zA-Z0-9_-]/g, '_')}`

  return (
    <div>
      <TarjetaClase
        clase={grupo.principal}
        indice={indice}
        usuario={usuario}
        onReservado={onReservado}
        onErrorCoordenadas={onErrorCoordenadas}
      />

      {hayResto && (
        <div className="-mt-px corte-card border border-t-0 border-[#E2E6CF] bg-[#F7F9EC]">
          <button
            type="button"
            onClick={alternar}
            aria-expanded={abierto}
            aria-controls={idPanel}
            className="flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-[#3D4A00] transition-colors hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B5E600]"
          >
            {abierto ? 'Ocultar sesiones' : textoVerMas(grupo.resto.length)}
            <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          {abierto && (
            <div id={idPanel} className="border-t border-[#E2E6CF] bg-white">
              <p className="px-4 pt-3 text-xs font-medium text-[#6B7355]">
                Más sesiones de @{grupo.principal.perfiles?.username || 'este organizador'} el {formatearFechaParaMostrar(grupo.principal.fecha)}
              </p>
              <ul>
                {grupo.resto.slice(0, visibles).map((c) => (
                  <SesionCompacta key={c.id} clase={c} usuario={usuario} onReservado={onReservado} />
                ))}
              </ul>
              {visibles < grupo.resto.length && (
                <button
                  type="button"
                  onClick={() => setVisibles((v) => v + POR_TANDA)}
                  className="w-full border-t border-[#E2E6CF] px-4 py-2.5 text-sm font-semibold text-[#3D4A00] hover:bg-[#EDF5C9]"
                >
                  Mostrar más ({grupo.resto.length - visibles} restantes)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
