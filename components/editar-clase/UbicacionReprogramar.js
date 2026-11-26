'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { geocodificarInversa } from '../../lib/geocodificarInversa'
import { crearUbicacion } from '../../lib/ubicacionSesion'
import TituloBloque from '../publicar/TituloBloque'
import DatosUbicacion from '../publicar/DatosUbicacion'
import { inputClass, labelClass, ayudaClass, tarjetaClass } from './constantes'

const MapaSelector = dynamic(() => import('../MapaSelector'), {
  ssr: false,
  loading: () => <p className="text-sm text-[#6B7355]">Cargando mapa...</p>,
})

// Nueva ubicación al reprogramar: misma lógica única que al publicar (lib/ubicacionSesion.js).
//   estadoRef = ref donde se deja { gestor, zona, modificada } para el formulario.
export default function UbicacionReprogramar({ clase, estadoRef }) {
  const [ubi, setUbi] = useState({ lat: null, lng: null, ciudad: '', provincia: '', lugar: '', origen: '', estado: 'vacio', aviso: '', foco: null, cambiada: false })
  const [zona, setZona] = useState(clase.direccion || '')
  const gestorRef = useRef(null)
  if (!gestorRef.current) gestorRef.current = crearUbicacion({ resolver: geocodificarInversa, alCambiar: setUbi })
  const gestor = gestorRef.current

  useEffect(() => {
    gestor.cargar({ lat: clase.lat ?? null, lng: clase.lng ?? null, ciudad: clase.ciudad || '', provincia: clase.provincia || '' })
    return () => gestor.destruir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestor, clase.id])

  const modificada = ubi.cambiada || zona.trim() !== (clase.direccion || '').trim()
  estadoRef.current = { gestor, zona: zona.trim(), modificada }

  const adaptador = { ubi, corregirUbicacionManual: gestor.corregirManual, reintentarUbicacion: gestor.reintentar }

  return (
    <div className={tarjetaClass}>
      <TituloBloque Icono={MapPin}>Dónde</TituloBloque>
      <div className="flex flex-col gap-4">
        <p className={ayudaClass + ' !mt-0'}>Déjalo como está si el lugar no cambia.</p>
        <div className="w-full overflow-hidden corte-card border border-[#E2E6CF]">
          <MapaSelector
            lat={ubi.lat}
            lng={ubi.lng}
            foco={ubi.foco}
            onCambiarUbicacion={gestor.elegirMapa}
            onSeleccionarBusqueda={gestor.elegirBusqueda}
          />
        </div>
        <DatosUbicacion c={adaptador} />
        <div>
          <label htmlFor="r-zona" className={labelClass}>Zona<span className="font-normal text-[#6B7355]"> (Opcional)</span></label>
          <input id="r-zona" type="text" value={zona} onChange={(e) => setZona(e.target.value)} className={inputClass} placeholder="Ej: Sala 2" />
        </div>
      </div>
    </div>
  )
}
