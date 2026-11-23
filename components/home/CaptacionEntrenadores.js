'use client'

import Link from 'next/link'
import RevelarAlLlegar from '../RevelarAlLlegar'
import { PUNTOS_CAPTACION_ENTRENADOR, botonPrimarioClass, botonSecundarioClass } from './constantes'

export default function CaptacionEntrenadores() {
  return (
    <RevelarAlLlegar
      as="section"
      id="entrenadores"
      className="w-full bg-[#1A1F00] px-6 py-16 sm:py-24"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-[#B5E600] sm:text-base">
          ¿Eres entrenador?
        </p>
        <h2 className="whitespace-nowrap text-xl font-extrabold tracking-tight text-white sm:text-4xl">
          <span className="text-[#B5E600]">Tú</span> pones las reglas.
        </h2>
        <p className="max-w-xl text-base text-white/85 sm:text-lg">
          Decides qué días trabajas, a qué hora, cuánta gente entra y cuánto cobras. Sin horario fijo, sin jefe.
          Publicas tu sesión en dos minutos y cobras directamente a tus alumnos.
        </p>

        <div className="mt-4 grid w-full grid-cols-1 gap-8 sm:grid-cols-3">
          {PUNTOS_CAPTACION_ENTRENADOR.map(({ texto, Icono }, indice) => (
            <RevelarAlLlegar
              key={texto}
              delayMs={indice * 100}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <Icono className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
              </div>
              <p className="text-sm font-semibold text-white">{texto}</p>
            </RevelarAlLlegar>
          ))}
        </div>

        <Link href="/registro" className={`${botonPrimarioClass} mt-4`}>
          Publica tu primera sesión
        </Link>

        <div className="mt-10 flex w-full flex-col items-center gap-3 border-t border-white/15 pt-10">
          <p className="text-sm font-bold uppercase tracking-wide text-[#B5E600] sm:text-base">
            ¿Tienes un gimnasio o centro deportivo?
          </p>
          <p className="text-xl font-extrabold text-white sm:text-2xl">Llena tus clases. Simplifica tus reservas.</p>
          <Link href="/centros" className={`${botonSecundarioClass} mt-2`}>
            Descubre RuleaFit para tu centro
          </Link>
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
