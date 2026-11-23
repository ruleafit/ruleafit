'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import FormularioValoracion from './FormularioValoracion'

export default function ValoracionesEntrenador({
  perfil,
  usuarioActual,
  promedioEstrellas,
  totalValoraciones,
  puedeValorar,
  valoracionPropia,
  onValoracionGuardada,
}) {
  // C16: la notificación «¿Qué tal tu entrenamiento?» abre el perfil con ?valorar=1: se lleva a la
  // persona directamente a este bloque (el formulario de siempre; si ya valoró, el de editar su valoración).
  const raiz = useRef(null)
  const [vieneDeAviso, setVieneDeAviso] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('valorar') !== '1') return undefined
    setVieneDeAviso(true)
    const t = setTimeout(() => raiz.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
    return () => clearTimeout(t)
  }, [puedeValorar])

  return (
    <div id="valorar" ref={raiz} className={`mt-8 corte-card border bg-white p-6 ${vieneDeAviso ? 'border-[#B5E600] ring-2 ring-[#B5E600]/40' : 'border-[#E2E6CF]'}`}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">Valoraciones</h2>

      {vieneDeAviso && usuarioActual && puedeValorar && (
        <p className="mb-4 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-3 py-2 text-sm font-medium text-[#3D4A00]">
          {valoracionPropia
            ? `Ya has valorado a @${perfil.username}. Aquí puedes actualizar tu valoración.`
            : `¿Qué tal tu entrenamiento con @${perfil.username}? Déjanos tu valoración aquí abajo.`}
        </p>
      )}
      {vieneDeAviso && !usuarioActual && (
        <p className="mb-4 text-sm text-[#6B7355]">
          <Link href="/login" className="font-semibold text-[#3D4A00] underline">Inicia sesión</Link> para valorar tu experiencia.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Star className="h-5 w-5 text-[#B5E600]" fill="#B5E600" strokeWidth={1.5} />
          <span className="text-lg font-bold text-[#1F2400]">
            {promedioEstrellas !== null ? promedioEstrellas.toFixed(1).replace('.', ',') : '—'}
          </span>
        </div>
        <span className="text-sm text-[#6B7355]">
          {totalValoraciones === 0
            ? 'Sin valoraciones todavía'
            : totalValoraciones === 1
              ? '(1 valoración)'
              : `(${totalValoraciones} valoraciones)`}
        </span>
      </div>

      {totalValoraciones > 0 && (
        <Link
          href={`/entrenador/${perfil.username}/opiniones`}
          className="mt-3 inline-block text-sm font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
        >
          Ver opiniones
        </Link>
      )}

      {puedeValorar && (
        <FormularioValoracion
          perfil={perfil}
          usuarioActual={usuarioActual}
          valoracionInicial={valoracionPropia}
          onGuardada={onValoracionGuardada}
        />
      )}

      {usuarioActual && usuarioActual.id !== perfil.id && !puedeValorar && (
        <p className="mt-6 border-t border-[#E2E6CF] pt-6 text-sm text-[#6B7355]">
          Solo puedes valorar a un rulero con el que hayas entrenado, o que te haya cancelado una
          sesión con menos de 2 horas de antelación.
        </p>
      )}
    </div>
  )
}
