'use client'

import { SearchX, Star, UserCheck } from 'lucide-react'
import RevelarAlLlegar from '../RevelarAlLlegar'

const contenedorClass =
  'flex flex-col items-center gap-3 corte-card border border-[#E2E6CF] bg-white px-6 py-14 text-center'
const botonClass =
  'mt-1 inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]'

// Estados vacíos: sin favoritos, sin seguidos y búsqueda sin resultados.
export default function EstadoVacioRuleros({ tipo, onBuscar, onLimpiar }) {
  if (tipo === 'busqueda') {
    return (
      <RevelarAlLlegar className={contenedorClass}>
        <SearchX className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
        <p className="text-sm text-[#6B7355]">
          No hay ruleros que coincidan con esta búsqueda. Prueba con otro término.
        </p>
        <button type="button" onClick={onLimpiar} className={botonClass}>
          Limpiar búsqueda
        </button>
      </RevelarAlLlegar>
    )
  }

  if (tipo === 'seguidos') {
    return (
      <RevelarAlLlegar className={contenedorClass}>
        <UserCheck className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
        <p className="max-w-md text-sm text-[#6B7355]">
          Todavía no sigues a nadie. Busca a otros ruleros, entra en su perfil y pulsa «Seguir».
        </p>
        <button type="button" onClick={onBuscar} className={botonClass}>
          Buscar ruleros
        </button>
      </RevelarAlLlegar>
    )
  }

  return (
    <RevelarAlLlegar className={contenedorClass}>
      <Star className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
      <h2 className="text-lg font-bold text-[#1F2400]">Aquí estarán tus ruleros favoritos</h2>
      <p className="max-w-md text-sm text-[#6B7355]">
        Guarda a tus entrenadores, centros deportivos o a quien publique las sesiones que más te
        interesan. Busca su nombre de usuario arriba, entra en su perfil y pulsa «Añadir a favoritos»:
        los tendrás aquí a un toque y te avisaremos cuando publiquen una sesión nueva.
      </p>
      <button type="button" onClick={onBuscar} className={botonClass}>
        Buscar ruleros
      </button>
    </RevelarAlLlegar>
  )
}
