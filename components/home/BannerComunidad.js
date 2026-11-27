'use client'

import Link from 'next/link'
import RevelarAlLlegar from '../RevelarAlLlegar'
import { botonPrimarioClass } from './constantes'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'

// Franja de comunidad: quien ya tiene sesiones propias ve una llamada a
// publicar otra, en vez de a buscar sesiones.
export default function BannerComunidad({ tieneClasesPublicadas }) {
  if (tieneClasesPublicadas) {
    return (
      <RevelarAlLlegar as="section" className="relative isolate flex min-h-[50vh] items-center justify-center overflow-hidden px-6 py-20 text-center">
        <img
          src="/imagenes/fuerza.jpg"
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/60" />
        <div className="flex flex-col items-center gap-6">
          <p className="max-w-xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
            ¿Tienes hueco esta semana? Publica una sesión más.
          </p>
          <Link href="/publicar" className={botonPrimarioClass}>
            Publicar sesión
          </Link>
        </div>
      </RevelarAlLlegar>
    )
  }

  return (
    <RevelarAlLlegar as="section" className="relative isolate flex min-h-[50vh] items-center justify-center overflow-hidden px-6 py-20 text-center">
      <img
        src="/imagenes/comunidad.jpg"
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-black/60" />
      <div className="flex flex-col items-center gap-6">
        <p className="max-w-xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {PAGOS_VISIBLES
            ? 'Solo, en pareja o en grupo. Reservas y pagas online, sesión a sesión.'
            : 'Solo, en pareja o en grupo. Tú eliges: pagas sesión a sesión o compras un bono con tu entrenador.'}
        </p>
        <Link href="/clases" className={botonPrimarioClass}>
          Ver sesiones
        </Link>
      </div>
    </RevelarAlLlegar>
  )
}
