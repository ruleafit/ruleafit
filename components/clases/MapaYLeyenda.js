'use client'

import dynamic from 'next/dynamic'

const MapaClases = dynamic(() => import('../MapaClases'), {
  ssr: false,
  loading: () => <p>Cargando mapa...</p>,
})

export default function MapaYLeyenda({ clases }) {
  return (
    <div className="md:sticky md:top-24 md:self-start">
      <MapaClases clases={clases} />
    </div>
  )
}
