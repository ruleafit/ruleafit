'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import RevelarAlLlegar from '../RevelarAlLlegar'
import TituloBloque from './TituloBloque'
import DatosUbicacion from './DatosUbicacion'
import useUbicacionesHabituales from './useUbicacionesHabituales'
import { SelectorUbicaciones, GuardarUbicacion, PanelUbicaciones, BannerEdicionUbicacion } from './UbicacionesHabituales'
import { inputClass, labelClass, ayudaClass, tarjetaClass } from './constantes'

const MapaSelector = dynamic(() => import('../MapaSelector'), {
  ssr: false,
  loading: () => <p className="text-sm text-[#6B7355]">Cargando mapa...</p>,
})

// Etiqueta de un campo no obligatorio.
const Opcional = () => <span className="font-normal text-[#6B7355]"> (Opcional)</span>

export default function BloqueDonde({ c }) {
  const ub = useUbicacionesHabituales()
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState('')
  const [mensajeEdicion, setMensajeEdicion] = useState('')
  const enEdicion = ub.lista.find((u) => u.id === editandoId)

  return (
    <RevelarAlLlegar delayMs={160} className={tarjetaClass}>
      <TituloBloque Icono={MapPin}>Dónde</TituloBloque>
      <div className="flex flex-col gap-4">
        <SelectorUbicaciones c={c} ub={ub} onGestionar={() => setPanelAbierto((v) => !v)} panelAbierto={panelAbierto} />

        {panelAbierto && (
          <PanelUbicaciones
            c={c}
            ub={ub}
            editandoId={editandoId}
            onEditarEnMapa={(u) => {
              c.elegirUbicacionHabitual(u)
              setEditandoId(u.id)
              setMensajeEdicion('')
            }}
            onCerrar={() => setPanelAbierto(false)}
          />
        )}

        <div>
          <label className={labelClass}>Ubicación</label>
          <div className="w-full overflow-hidden corte-card border border-[#E2E6CF]">
            <MapaSelector
              lat={c.lat}
              lng={c.lng}
              foco={c.ubi.foco}
              onCambiarUbicacion={c.alElegirPuntoEnMapa}
              onSeleccionarBusqueda={c.alElegirResultadoBusqueda}
            />
          </div>
          {/* Una sola ubicación: del pin salen las coordenadas, el municipio y la provincia (sin buscador de ciudad). */}
          <DatosUbicacion c={c} />
          {enEdicion && (
            <BannerEdicionUbicacion
              key={enEdicion.id}
              c={c}
              ub={ub}
              ubicacion={enEdicion}
              onTerminar={(texto) => {
                setEditandoId('')
                setMensajeEdicion(texto)
              }}
            />
          )}
          {mensajeEdicion && (
            <p role="status" className="mt-2 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-3 py-2 text-sm font-medium text-[#3D4A00]">{mensajeEdicion}</p>
          )}
          {!enEdicion && <GuardarUbicacion c={c} ub={ub} />}
        </div>

        <div>
          <label className={labelClass}>Zona<Opcional /></label>
          <input type="text" value={c.direccion} onChange={(e) => c.setDireccion(e.target.value)} placeholder="Ej: Nervión, o C/ Larios" className={inputClass} />
          <p className={ayudaClass}>El espacio concreto dentro del lugar, por ejemplo «Sala 2». No es la dirección del mapa.</p>
        </div>

        <div>
          <label className={labelClass}>Punto de encuentro<Opcional /></label>
          <input type="text" value={c.puntoEncuentro} onChange={(e) => c.setPuntoEncuentro(e.target.value)} className={inputClass} />
          <p className={ayudaClass}>Sé concreto: ayuda a que nadie se pierda.</p>
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
