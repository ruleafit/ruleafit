'use client'

import dynamic from 'next/dynamic'
import { MapPin } from 'lucide-react'
import RevelarAlLlegar from '../RevelarAlLlegar'
import BuscadorCiudad from '../BuscadorCiudad'
import TituloBloque from './TituloBloque'
import { inputClass, labelClass, ayudaClass, tarjetaClass } from './constantes'

const MapaSelector = dynamic(() => import('../MapaSelector'), {
  ssr: false,
  loading: () => <p className="text-sm text-[#6B7355]">Cargando mapa...</p>,
})

export default function BloqueDonde({ c }) {
  return (
    <RevelarAlLlegar delayMs={160} className={tarjetaClass}>
      <TituloBloque Icono={MapPin}>Dónde</TituloBloque>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="ciudad-sesion" className={labelClass}>Ciudad</label>
          <BuscadorCiudad
            id="ciudad-sesion"
            valor={c.ciudadTexto}
            ciudadElegida={c.ciudad}
            onCambiarTexto={c.setCiudadTexto}
            onSeleccionar={(ciu) => {
              c.setCiudad(ciu.nombre)
              c.setCiudadTexto(ciu.nombre)
              c.setProvincia(ciu.provincia || '')
              c.setCiudadCentro([ciu.lat, ciu.lng])
            }}
            className={inputClass}
          />
          <p className={ayudaClass}>Escribe y elige tu ciudad de la lista.</p>
        </div>

        <div>
          <label className={labelClass}>Ubicación en el mapa</label>
          <div className="w-full overflow-hidden corte-card border border-[#E2E6CF]">
            <MapaSelector
              centro={c.ciudadCentro || undefined}
              lat={c.lat}
              lng={c.lng}
              onCambiarUbicacion={(nuevaLat, nuevaLng) => {
                c.setLat(nuevaLat)
                c.setLng(nuevaLng)
              }}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Zona</label>
          <input type="text" value={c.direccion} onChange={(e) => c.setDireccion(e.target.value)} placeholder="Ej: Nervión, o C/ Larios" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Punto de encuentro</label>
          <input type="text" value={c.puntoEncuentro} onChange={(e) => c.setPuntoEncuentro(e.target.value)} className={inputClass} />
          <p className={ayudaClass}>Sé concreto: ayuda a que nadie se pierda.</p>
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
