'use client'

import RevelarAlLlegar from '../RevelarAlLlegar'
import { PUNTOS } from './constantes'

// Puntos con iconos (unificados, ya no cambian según rol).
export default function PuntosHome() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
        {PUNTOS.map(({ texto, Icono }, indice) => (
          <RevelarAlLlegar key={texto} delayMs={indice * 100} className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EDF5C9]">
              <Icono className="h-8 w-8 text-[#B5E600]" strokeWidth={1.75} />
            </div>
            <p className="text-base font-semibold text-[#1F2400]">{texto}</p>
          </RevelarAlLlegar>
        ))}
      </div>
    </section>
  )
}
