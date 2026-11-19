'use client'

import Link from 'next/link'
import RevelarAlLlegar from '../RevelarAlLlegar'
import { CATEGORIAS } from './constantes'

export default function CategoriasHome() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
      <RevelarAlLlegar as="h2" className="mb-10 text-2xl font-bold tracking-tight text-[#1F2400] sm:text-3xl">
        Encuentra tu entrenamiento
      </RevelarAlLlegar>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIAS.map(({ nombre, imagen }, indice) => (
          <RevelarAlLlegar key={nombre} delayMs={indice * 100}>
            <Link
              href="/clases"
              className="zoom-imagen tarjeta-hover group relative isolate flex h-56 items-end corte-card shadow-sm sm:h-64"
            >
              <img src={imagen} alt="" className="absolute inset-0 -z-10 h-full w-full corte-card object-cover" />
              <div className="absolute inset-0 -z-10 corte-card bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="relative z-10 p-5 text-lg font-bold text-white">{nombre}</span>
            </Link>
          </RevelarAlLlegar>
        ))}
      </div>
    </section>
  )
}
