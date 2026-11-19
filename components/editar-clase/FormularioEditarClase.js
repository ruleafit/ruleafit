'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import BloqueDatosEditables from './BloqueDatosEditables'
import BloquePlazasEditar from './BloquePlazasEditar'
import BloqueNoEditable from './BloqueNoEditable'
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
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

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
    }) !== valoresInicialesJSON

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
  }

  return (
    <>
      <form onSubmit={handleGuardar} className="flex flex-col gap-6">
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
