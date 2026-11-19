'use client'

import dynamic from 'next/dynamic'
import { ESTILO_POR_CATEGORIA, formaSVG } from '../../lib/imagenesCategoria'

const MapaClases = dynamic(() => import('../MapaClases'), {
  ssr: false,
  loading: () => <p>Cargando mapa...</p>,
})

export default function MapaYLeyenda({ clases }) {
  return (
    <div className="md:sticky md:top-24 md:self-start">
      <MapaClases clases={clases} />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 corte-card border border-[#E2E6CF] bg-white/70 px-4 py-3 text-xs text-[#3D4A00]">
        {Object.entries(ESTILO_POR_CATEGORIA).map(([nombre, { forma, color }]) => (
          <span key={nombre} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3.5 w-3.5 shrink-0"
              dangerouslySetInnerHTML={{ __html: formaSVG(forma, color, 14) }}
            />
            {nombre}
          </span>
        ))}
      </div>
    </div>
  )
}
