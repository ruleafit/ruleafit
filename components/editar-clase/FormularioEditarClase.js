'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import BloqueDatosEditables from './BloqueDatosEditables'
import BloquePlazasEditar from './BloquePlazasEditar'
import BloqueNoEditable from './BloqueNoEditable'
import BloqueSerieEditar from './BloqueSerieEditar'
import { CATEGORIAS, NIVELES, botonPrimarioClass, botonSecundarioClass } from './constantes'

// Formulario de edición: se monta cuando la sesión (clase) ya está cargada.
export default function FormularioEditarClase({ id, clase }) {
  const router = useRouter()

  const [titulo, setTitulo] = useState(clase.titulo || '')
  const [tipoActividad, setTipoActividad] = useState(clase.tipo_actividad || '')
  const [categoria, setCategoria] = useState(clase.categoria || CATEGORIAS[0])
  const [nivel, setNivel] = useState(clase.nivel || NIVELES[0])
  const [material, setMaterial] = useState(clase.material || '')
  const [observaciones, setObservaciones] = useState(clase.observaciones || '')
  const [puntoEncuentro, setPuntoEncuentro] = useState(clase.punto_encuentro || '')
  const [plazasMin, setPlazasMin] = useState(String(clase.plazas_min ?? 1))
  const [plazasMax, setPlazasMax] = useState(String(clase.plazas_max ?? ''))
  const [valoresInicialesJSON] = useState(() =>
    JSON.stringify({
      titulo: clase.titulo || '',
      tipoActividad: clase.tipo_actividad || '',
      categoria: clase.categoria || CATEGORIAS[0],
      nivel: clase.nivel || NIVELES[0],
      material: clase.material || '',
      observaciones: clase.observaciones || '',
      puntoEncuentro: clase.punto_encuentro || '',
      plazasMin: String(clase.plazas_min ?? 1),
      plazasMax: String(clase.plazas_max ?? ''),
    })
  )
  // Sesiones de una serie (C07): alcance de los cambios y precio/duración (solo sesiones sin reservas).
  const esDeSerie = !!clase.serie_id
  const [alcance, setAlcance] = useState('solo_esta')
  const [precio, setPrecio] = useState(clase.precio != null ? String(clase.precio) : '')
  const [duracion, setDuracion] = useState(clase.duracion != null ? String(clase.duracion) : '')
  const [resultadoSerie, setResultadoSerie] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('alcance')
    if (esDeSerie && ['solo_esta', 'esta_y_siguientes', 'toda_futura'].includes(a)) setAlcance(a)
  }, [esDeSerie])

  const sinMinimoDefinido = clase.plazas_min === 0
  const formularioModificado =
    JSON.stringify({
      titulo,
      tipoActividad,
      categoria,
      nivel,
      material,
      observaciones,
      puntoEncuentro,
      plazasMin,
      plazasMax,
    }) !== valoresInicialesJSON ||
    (esDeSerie && (precio !== (clase.precio != null ? String(clase.precio) : '') || duracion !== (clase.duracion != null ? String(clase.duracion) : '') || alcance !== 'solo_esta'))

  async function handleGuardar(e) {
    e.preventDefault()

    const plazasMinNum = Number(plazasMin)
    const plazasMaxNum = Number(plazasMax)

    // El suelo de 1 solo aplica si la clase ya tenía un mínimo antes; si no
    // tenía (plazas_min = 0), el campo se muestra de solo lectura y su
    // valor no cambia, así que no hace falta validarlo aquí.
    if (!sinMinimoDefinido) {
      if (!Number.isInteger(plazasMinNum) || plazasMinNum < 1) {
        setMensaje('Las plazas mínimas no pueden ser menores que 1.')
        return
      }

      if (plazasMinNum > clase.plazas_min) {
        setMensaje('Las plazas mínimas solo se pueden reducir, no aumentar.')
        return
      }
    }

    if (!Number.isInteger(plazasMaxNum) || plazasMaxNum < 1) {
      setMensaje('Las plazas máximas deben ser un número entero de al menos 1.')
      return
    }

    if (plazasMaxNum < clase.plazas_max) {
      setMensaje('Las plazas máximas solo se pueden aumentar, no reducir.')
      return
    }

    if (plazasMinNum > plazasMaxNum) {
      setMensaje('Las plazas mínimas no pueden superar a las plazas máximas.')
      return
    }

    setGuardando(true)
    setMensaje('')

    if (esDeSerie) {
      // Mismas reglas que editar_clase para cada sesión; precio y duración solo en sesiones sin reservas.
      const campos = {
        titulo, tipo_actividad: tipoActividad, categoria, nivel, material, observaciones,
        punto_encuentro: puntoEncuentro, plazas_min: plazasMinNum, plazas_max: plazasMaxNum,
      }
      if (precio !== (clase.precio != null ? String(clase.precio) : '')) campos.precio = precio
      if (duracion !== (clase.duracion != null ? String(clase.duracion) : '')) campos.duracion = duracion
      const { data, error: errorSerie } = await supabase.rpc('editar_serie', {
        p_clase_id: id,
        p_alcance: alcance,
        p_campos: campos,
      })
      if (errorSerie) {
        setMensaje(errorSerie.message)
        setGuardando(false)
        return
      }
      if ((data?.omitidas || []).length === 0) {
        router.push('/mis-clases')
        return
      }
      setResultadoSerie(data)
      setGuardando(false)
      return
    }

    const { error } = await supabase.rpc('editar_clase', {
      p_clase_id: id,
      p_titulo: titulo,
      p_tipo_actividad: tipoActividad,
      p_categoria: categoria,
      p_nivel: nivel,
      p_material: material,
      p_observaciones: observaciones,
      p_punto_encuentro: puntoEncuentro,
      p_plazas_min: plazasMinNum,
      p_plazas_max: plazasMaxNum,
    })

    if (error) {
      setMensaje(error.message)
      setGuardando(false)
      return
    }

    router.push('/mis-clases')
  }
  const f = {
    titulo, setTitulo, tipoActividad, setTipoActividad, categoria, setCategoria,
    nivel, setNivel, material, setMaterial, observaciones, setObservaciones,
    puntoEncuentro, setPuntoEncuentro, plazasMin, setPlazasMin, plazasMax, setPlazasMax,
    alcance, setAlcance, precio, setPrecio, duracion, setDuracion,
  }

  if (resultadoSerie) {
    const omitidas = resultadoSerie.omitidas || []
    return (
      <div className="corte-card border border-[#E2E6CF] bg-white p-5 shadow-sm">
        <p className="text-base font-bold text-[#1F2400]">
          Cambios aplicados a {resultadoSerie.editadas} {resultadoSerie.editadas === 1 ? 'sesión' : 'sesiones'}
        </p>
        <p className="mt-1 text-sm text-[#6B7355]">
          {omitidas.length === 1 ? 'Una sesión no admitía' : `${omitidas.length} sesiones no admitían`} algún cambio y se han dejado como estaban:
        </p>
        <ul className="mt-3 max-h-72 divide-y divide-[#E2E6CF] overflow-y-auto rounded-lg border border-[#E2E6CF] text-sm">
          {omitidas.map((o) => (
            <li key={o.clase_id + o.motivo} className="px-3 py-2">
              <span className="font-semibold text-[#1F2400]">
                {String(o.fecha).split('-').reverse().join('/')} · {String(o.hora).slice(0, 5)}
              </span>
              <span className="block text-xs text-[#6B7355]">{o.motivo}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => router.push('/mis-clases')} className={`${botonPrimarioClass} mt-4`}>
          Volver a Mis sesiones
        </button>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleGuardar} className="flex flex-col gap-6">
        {esDeSerie && <BloqueSerieEditar f={f} />}
        <BloqueDatosEditables f={f} />
        <BloquePlazasEditar f={f} clase={clase} sinMinimoDefinido={sinMinimoDefinido} />
        <BloqueNoEditable clase={clase} />

        <div className="flex flex-col gap-3">
          <button type="submit" disabled={guardando || !formularioModificado} className={botonPrimarioClass}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/mis-clases')}
            className={botonSecundarioClass}
          >
            Cancelar
          </button>
        </div>
      </form>

      {mensaje && (
        <div className="mt-4 flex items-start gap-2 corte-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
          <p className="font-medium">{mensaje}</p>
        </div>
      )}
    </>
  )
}
