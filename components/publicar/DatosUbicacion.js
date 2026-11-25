'use client'

import { useEffect, useState } from 'react'
import { MapPin, CircleCheck, Loader2, CircleAlert } from 'lucide-react'
import { inputClass, labelClass, ayudaClass } from './constantes'

const MENSAJES = {
  busqueda: 'Hemos marcado la ubicación de tu búsqueda. Si quieres ajustarla, toca otro punto del mapa.',
  ajustada: 'Ubicación ajustada en el mapa.',
  guardada: 'Hemos marcado tu ubicación habitual. Si quieres ajustarla, toca otro punto del mapa.',
}

// Bajo el mapa: confirmación breve de la ubicación y los datos obtenidos del pin (municipio y provincia). Son datos
// automáticos, no campos que haya que rellenar; solo si el servicio no los devuelve (o no son los correctos) se
// ofrece corregirlos a mano.
//   ubi  = estado de lib/ubicacionSesion.js (c.ubi)
export default function DatosUbicacion({ c }) {
  const { ubi } = c
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [ciudadManual, setCiudadManual] = useState('')
  const [provinciaManual, setProvinciaManual] = useState('')

  // Si se cambia el punto mientras se corregía, se cierra la corrección (los datos nuevos se obtienen del nuevo punto).
  useEffect(() => {
    if (ubi.estado === 'resolviendo') setCorrigiendo(false)
  }, [ubi.estado])

  if (ubi.lat == null) return null

  const mensaje = MENSAJES[ubi.aviso]
  const resolviendo = ubi.estado === 'resolviendo'
  const fallo = ubi.estado === 'fallo'
  const formularioAbierto = !resolviendo && (corrigiendo || fallo)

  function abrirCorreccion() {
    setCiudadManual(ubi.ciudad)
    setProvinciaManual(ubi.provincia)
    setCorrigiendo(true)
  }
  function aplicar(e) {
    e.preventDefault()
    if (!ciudadManual.trim()) return
    c.corregirUbicacionManual({ ciudad: ciudadManual, provincia: provinciaManual })
    setCorrigiendo(false)
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {mensaje && (
        <p role="status" className="flex items-start gap-1.5 text-xs font-medium text-[#3D4A00]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {mensaje}
        </p>
      )}

      <div className="corte-card border border-[#E2E6CF] bg-[#F7F9EC] px-3 py-2 text-sm">
        {ubi.lugar && (
          <p>
            <span className="text-[#6B7355]">Ubicación seleccionada: </span>
            <span className="font-semibold text-[#1F2400]">{ubi.lugar}</span>
          </p>
        )}
        {resolviendo ? (
          <p role="status" className="flex items-center gap-1.5 text-[#6B7355]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Identificando el municipio…
          </p>
        ) : fallo ? (
          <p role="status" className="flex items-start gap-1.5 text-amber-800">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            No hemos podido identificar el municipio de este punto. Puedes reintentarlo o indicarlo a mano; la ubicación del mapa se conserva.
          </p>
        ) : (
          <>
            <p>
              <span className="text-[#6B7355]">Municipio: </span>
              <span className="font-semibold text-[#1F2400]">{ubi.ciudad}</span>
              {ubi.estado === 'manual' && <span className="text-xs text-[#6B7355]"> (indicado a mano)</span>}
            </p>
            <p>
              <span className="text-[#6B7355]">Provincia: </span>
              <span className="font-semibold text-[#1F2400]">{ubi.provincia || '—'}</span>
            </p>
          </>
        )}

        {!resolviendo && (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {fallo && (
              <button type="button" onClick={c.reintentarUbicacion} className="text-xs font-semibold text-[#3D4A00] underline underline-offset-2">
                Reintentar
              </button>
            )}
            {!formularioAbierto && (
              <button type="button" onClick={abrirCorreccion} className="text-xs font-semibold text-[#3D4A00] underline underline-offset-2">
                Corregir municipio o provincia
              </button>
            )}
          </div>
        )}
        {ubi.estado === 'listo' && !corrigiendo && (
          <p className="mt-1 flex items-center gap-1 text-xs text-[#6B7355]">
            <CircleCheck className="h-3.5 w-3.5 text-[#5E7A00]" aria-hidden="true" />
            Se obtiene automáticamente del punto del mapa.
          </p>
        )}
      </div>

      {formularioAbierto && (
        <form onSubmit={aplicar} className="corte-card border border-[#E2E6CF] bg-white p-3">
          <p className={ayudaClass + ' mb-2'}>Solo si hace falta: indica el municipio y la provincia de este punto.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="municipio-manual" className={labelClass}>Municipio</label>
              <input id="municipio-manual" type="text" value={ciudadManual} onChange={(e) => setCiudadManual(e.target.value)} className={inputClass} maxLength={80} />
            </div>
            <div>
              <label htmlFor="provincia-manual" className={labelClass}>Provincia<span className="font-normal text-[#6B7355]"> (Opcional)</span></label>
              <input id="provincia-manual" type="text" value={provinciaManual} onChange={(e) => setProvinciaManual(e.target.value)} className={inputClass} maxLength={80} />
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={!ciudadManual.trim()} className="corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400] disabled:opacity-50">
              Usar estos datos
            </button>
            {corrigiendo && (
              <button type="button" onClick={() => setCorrigiendo(false)} className="text-sm font-semibold text-[#3D4A00] underline underline-offset-2">
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
