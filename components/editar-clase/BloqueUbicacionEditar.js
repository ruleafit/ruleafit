'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { MapPin, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { geocodificarInversa } from '../../lib/geocodificarInversa'
import { crearUbicacion } from '../../lib/ubicacionSesion'
import TituloBloque from '../publicar/TituloBloque'
import DatosUbicacion from '../publicar/DatosUbicacion'
import { inputClass, labelClass, ayudaClass, tarjetaClass, soloLecturaClass } from './constantes'

const MapaSelector = dynamic(() => import('../MapaSelector'), {
  ssr: false,
  loading: () => <p className="text-sm text-[#6B7355]">Cargando mapa...</p>,
})

export const MENSAJE_CON_RESERVAS =
  'Esta sesión ya tiene reservas. No puedes cambiar su ubicación para evitar confusiones entre los participantes.'
const MENSAJE_TODAS_CON_RESERVAS =
  'Todas las sesiones seleccionadas ya tienen reservas. No puedes cambiar su ubicación para evitar confusiones entre los participantes.'

// Ubicación de una sesión ya publicada. Mismo buscador, mismo mapa y misma lógica que al publicar (una sola ubicación:
// el pin fija coordenadas, municipio y provincia). Solo se puede cambiar mientras la sesión no tenga reservas activas:
// aquí se informa (consultando al servidor qué sesiones del alcance tienen reservas) y el servidor lo vuelve a comprobar
// al guardar, dentro de la propia operación (una reserva que llegue entre medias hace que se rechace).
//   estadoRef  = ref donde se deja lo que necesita el formulario al guardar
//   onCambio   = avisa de si hay un cambio de ubicación pendiente de guardar
//   version    = número que cambia para volver a consultar las reservas (p. ej. tras un rechazo del servidor)
export default function BloqueUbicacionEditar({ id, clase, alcance, esDeSerie = false, estadoRef, onCambio, version = 0 }) {
  const [ubi, setUbi] = useState({ lat: null, lng: null, ciudad: '', provincia: '', lugar: '', origen: '', estado: 'vacio', aviso: '', foco: null, cambiada: false })
  const [zona, setZona] = useState(clase.direccion || '')
  const [previa, setPrevia] = useState(null) // null = consultando; { total, con_reservas, sin_reservas } | { error }
  const gestorRef = useRef(null)
  if (!gestorRef.current) gestorRef.current = crearUbicacion({ resolver: geocodificarInversa, alCambiar: setUbi })
  const gestor = gestorRef.current

  // Ubicación guardada de la sesión: se muestra tal cual (sin geocodificar si ya tiene municipio y provincia).
  useEffect(() => {
    gestor.cargar({ lat: clase.lat ?? null, lng: clase.lng ?? null, ciudad: clase.ciudad || '', provincia: clase.provincia || '' })
    return () => gestor.destruir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestor, clase.id])

  // ¿Qué sesiones del alcance tienen reservas? (informativo: el servidor lo decide al guardar)
  useEffect(() => {
    let vivo = true
    setPrevia(null)
    supabase.rpc('previsualizar_ubicacion_serie', { p_clase_id: id, p_alcance: alcance }).then(({ data, error }) => {
      if (!vivo) return
      setPrevia(error ? { error: error.message } : data)
    })
    return () => {
      vivo = false
    }
  }, [id, alcance, version])

  const consultado = previa && !previa.error
  const bloqueada = !!consultado && previa.total > 0 && previa.sin_reservas === 0
  const parcial = !!consultado && previa.con_reservas > 0 && previa.sin_reservas > 0
  const zonaCambiada = zona.trim() !== (clase.direccion || '').trim()
  const modificada = !bloqueada && (ubi.cambiada || zonaCambiada)

  estadoRef.current = { gestor, zona: zona.trim(), bloqueada, parcial, previa, modificada }
  useEffect(() => {
    onCambio?.(modificada)
  }, [modificada, onCambio])

  const adaptador = { ubi, corregirUbicacionManual: gestor.corregirManual, reintentarUbicacion: gestor.reintentar }

  return (
    <div className={tarjetaClass}>
      <TituloBloque Icono={MapPin}>Dónde</TituloBloque>

      {previa === null && <p className="mb-3 text-xs text-[#6B7355]">Comprobando si hay reservas…</p>}
      {previa?.error && (
        <p className="mb-3 text-xs text-amber-800">
          No hemos podido comprobar las reservas: el servidor lo verificará al guardar. {previa.error}
        </p>
      )}

      {bloqueada ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="flex items-start gap-2 corte-card border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {previa.total === 1 ? MENSAJE_CON_RESERVAS : MENSAJE_TODAS_CON_RESERVAS}
              {/* El bloqueo es solo del alcance elegido: en una serie se puede ampliar para cambiar las sesiones sin reservas. */}
              {esDeSerie && alcance === 'solo_esta' && (
                <span className="mt-1 block text-xs">
                  Si quieres cambiar la ubicación de las demás sesiones de la serie que no tienen reservas, elige arriba «Esta y las siguientes» o «Toda la serie futura».
                </span>
              )}
            </span>
          </p>
          <div>
            <label className={labelClass}>Municipio</label>
            <p className={soloLecturaClass}>
              {clase.ciudad || '—'}
              {clase.provincia && clase.provincia !== clase.ciudad ? `, ${clase.provincia}` : ''}
            </p>
          </div>
          <div>
            <label className={labelClass}>Zona<span className="font-normal text-[#6B7355]"> (Opcional)</span></label>
            <p className={soloLecturaClass}>{clase.direccion || '—'}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className={ayudaClass + ' !mt-0'}>
            Puedes cambiar la ubicación mientras la sesión no tenga reservas. Busca un lugar o toca el mapa.
          </p>
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
          {parcial && (
            <p role="status" className="corte-card border border-[#B5E600] bg-[#EDF5C9] px-3 py-2 text-xs text-[#3D4A00]">
              Hay {previa.con_reservas} {previa.con_reservas === 1 ? 'sesión' : 'sesiones'} con reservas en este alcance: conservará(n) su ubicación.
              Se podrá cambiar la de las otras {previa.sin_reservas}.
            </p>
          )}
          <div>
            <label className={labelClass}>Zona<span className="font-normal text-[#6B7355]"> (Opcional)</span></label>
            <input type="text" value={zona} onChange={(e) => setZona(e.target.value)} className={inputClass} placeholder="Ej: Sala 2" />
            <p className={ayudaClass}>El espacio concreto dentro del lugar. Si cambias el lugar, revísala.</p>
            {ubi.cambiada && !zonaCambiada && zona.trim() !== '' && (
              <p role="status" className="mt-1 text-xs font-medium text-amber-800">
                Mantienes la zona «{zona.trim()}» del lugar anterior. Si ya no corresponde al nuevo lugar, cámbiala o déjala vacía.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
