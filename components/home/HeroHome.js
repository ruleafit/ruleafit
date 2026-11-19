'use client'

import Link from 'next/link'
import { ACCESOS, estiloTarjetaAcceso, botonPrimarioClass, botonSecundarioClass } from './constantes'

export default function HeroHome({ usuario, username, desplazamientoParallax }) {
  return (
    <section
      className={`relative isolate flex w-full items-center justify-center overflow-hidden ${
        usuario ? 'min-h-[45vh]' : 'min-h-[85vh]'
      }`}
    >
      <div className="absolute -inset-x-0 -top-20 -bottom-20 -z-20 overflow-hidden">
        <div
          className="h-full w-full bg-cover bg-center"
          style={{
            backgroundImage: 'url(/imagenes/portada.jpg)',
            transform: `translateY(${desplazamientoParallax}px)`,
          }}
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/40 to-black/75" />

      <div
        className={`relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center ${
          usuario ? 'py-14 sm:py-16' : 'py-24'
        }`}
      >
        {!usuario && (
          <>
            <h1 className="flex flex-col gap-1 text-2xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              <span className="whitespace-nowrap">Tú eliges qué entrenar.</span>{' '}
              <span className="whitespace-nowrap text-[#B5E600]">Sin cuotas.</span>
            </h1>
            <p className="max-w-xl text-lg text-white/90 sm:text-xl">
              Sesiones sueltas o bonos. Elige la de hoy, resérvala y ya está, o hazte un bono con tu
              entrenador. Sin cuota mensual ni permanencia.
            </p>

            <div className="mt-2 flex flex-col gap-4 sm:flex-row">
              <Link href="/registro" className={botonPrimarioClass}>
                Crear cuenta
              </Link>
              <Link href="/login" className={botonSecundarioClass}>
                Iniciar sesión
              </Link>
            </div>
          </>
        )}

        {usuario && (
          <div className="mt-2 flex w-full flex-col items-center gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                Hola, {username || 'usuario'}
              </h1>
              <p className="text-base text-white/85 sm:text-lg">¿Qué entrenas hoy?</p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              {ACCESOS.map(({ href, label, Icono, variante }) => {
                const estilo = estiloTarjetaAcceso(variante)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`tarjeta-hover flex w-[140px] flex-col items-center gap-2 corte-card border p-5 text-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2 sm:w-[160px] ${estilo.tarjeta}`}
                  >
                    <Icono className={`h-8 w-8 ${estilo.icono}`} strokeWidth={1.75} />
                    <span className={`text-sm font-bold ${estilo.texto}`}>{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
