'use client'

import { Suspense } from 'react'
import useResumenZona from '../../components/sesiones-zona/useResumenZona'
import ListaResumenZona from '../../components/sesiones-zona/ListaResumenZona'
import { AVISOS_ZONA_VISIBLES } from '../../lib/avisosZonaVisibles'

function Contenido() {
  const r = useResumenZona()

  if (r.cargando) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }
  return <ListaResumenZona r={r} />
}

export default function SesionesEnMiZonaPage() {
  // Hasta el lanzamiento la función no se muestra en Producción (mismo interruptor que Mi cuenta).
  if (!AVISOS_ZONA_VISIBLES) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center px-4">
        <p className="text-[#6B7355]">Esta página todavía no está disponible.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate flex h-[140px] items-end overflow-hidden sm:h-[170px]">
        <img src="/imagenes/running.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-5 sm:px-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Sesiones en tu zona</h1>
          <p className="mt-1 text-sm text-white/85">Tu resumen diario de nuevas sesiones.</p>
        </div>
      </section>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-[#6B7355]">Cargando...</p>}>
          <Contenido />
        </Suspense>
      </div>
    </div>
  )
}
