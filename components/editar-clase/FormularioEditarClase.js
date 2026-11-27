'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import BloqueDatosEditables from './BloqueDatosEditables'
import BloquePlazasEditar from './BloquePlazasEditar'
import BloqueNoEditable from './BloqueNoEditable'
import BloqueUbicacionEditar from './BloqueUbicacionEditar'
import { prepararUbicacionParaPublicar } from '../publicar/ubicacionPublicar'
import BloqueSerieEditar from './BloqueSerieEditar'
import SelectorBonos from '../publicar/SelectorBonos'
import { confirmarBonosSinSesiones } from '../publicar/avisoBonos'
import { CATEGORIAS, NIVELES, botonPrimarioClass, botonSecundarioClass, tarjetaClass } from './constantes'

// La tarjeta se oculta sola (empty:hidden) si no tiene bonos y el selector no pinta nada.
function BonosDeLaSesion(props) {
  return (
    <div className={`${tarjetaClass} empty:hidden`}>
      <SelectorBonos {...props} />
    </div>
  )
}

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
  const [bonosAdmitidos, setBonosAdmitidos] = useState(clase.bonos_admitidos ?? null)
  const [resultadoSerie, setResultadoSerie] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  // Ubicación (cambiarla es posible solo en sesiones sin reservas: lo decide el servidor al guardar).
  const ubicacionRef = useRef(null)
  const [ubicacionModificada, setUbicacionModificada] = useState(false)
  const [confirmandoParcial, setConfirmandoParcial] = useState(null) // { aplicar, conservar } mientras se pide confirmación
  const [versionReservas, setVersionReservas] = useState(0)
  const alCambiarUbicacion = useCallback((m) => setUbicacionModificada(m), [])

  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('alcance')
    if (esDeSerie && ['solo_esta', 'esta_y_siguientes', 'toda_futura'].includes(a)) setAlcance(a)
  }, [esDeSerie])

  const sinMinimoDefinido = clase.plazas_min === 0
  const bonosModificados = JSON.stringify(bonosAdmitidos) !== JSON.stringify(clase.bonos_admitidos ?? null)
  const otrosCambios =
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
    (esDeSerie && (precio !== (clase.precio != null ? String(clase.precio) : '') || duracion !== (clase.duracion != null ? String(clase.duracion) : ''))) ||
    ubicacionModificada
  const formularioModificado = otrosCambios || bonosModificados || (esDeSerie && alcance !== 'solo_esta')

  async function handleGuardar(e, { parcialConfirmado = false } = {}) {
    e?.preventDefault?.()

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

    // Cambio de ubicación (una sola ubicación: coordenadas + municipio + provincia + zona). Se lee del gestor AL GUARDAR,
    // esperando a que termine la identificación del municipio si el pin se acaba de mover.
    const bloque = ubicacionRef.current
    let ubicacion = null
    if (bloque && bloque.modificada && !bloque.bloqueada) {
      const prep = await prepararUbicacionParaPublicar(bloque.gestor, setMensaje)
      if (!prep.ok) {
        setMensaje(prep.mensaje)
        setGuardando(false)
        return
      }
      ubicacion = { ...prep.ubicacion, direccion: bloque.zona }
      // Con sesiones que tienen reservas en el alcance, la modificación es PARCIAL: se pide confirmación expresa.
      if (bloque.parcial && !parcialConfirmado) {
        setConfirmandoParcial({ aplicar: bloque.previa.sin_reservas, conservar: bloque.previa.con_reservas })
        setMensaje('')
        setGuardando(false)
        return
      }
    }
    setConfirmandoParcial(null)

    // Bonos admitidos (sql/113): operación aparte, con el mismo alcance.
    if (bonosModificados) {
      const alcanceBonos = esDeSerie ? alcance : 'solo_esta'
      if (!(await confirmarBonosSinSesiones({ claseId: id, alcance: alcanceBonos, bonos: bonosAdmitidos }))) {
        setGuardando(false)
        return
      }
      const { error: errorBonos } = await supabase.rpc('fijar_bonos_sesion', {
        p_clase_id: id,
        p_alcance: alcanceBonos,
        p_bonos: bonosAdmitidos,
      })
      if (errorBonos) {
        setMensaje(errorBonos.message)
        setGuardando(false)
        return
      }
      if (!otrosCambios) {
        router.push('/mis-clases')
        return
      }
    }

    if (esDeSerie || ubicacion) {
      // Mismas reglas que editar_clase para cada sesión; precio y duración solo en sesiones sin reservas.
      const campos = {
        titulo, tipo_actividad: tipoActividad, categoria, nivel, material, observaciones,
        punto_encuentro: puntoEncuentro, plazas_min: plazasMinNum, plazas_max: plazasMaxNum,
      }
      if (esDeSerie && precio !== (clase.precio != null ? String(clase.precio) : '')) campos.precio = precio
      if (esDeSerie && duracion !== (clase.duracion != null ? String(clase.duracion) : '')) campos.duracion = duracion
      if (ubicacion) {
        campos.ubicacion = ubicacion
        if (parcialConfirmado) campos.confirmar_parcial = true
      }
      // Una sesión suelta con cambio de ubicación también pasa por editar_serie (alcance «solo_esta»): hace las mismas
      // comprobaciones que editar_clase y, además, bloquea la sesión y comprueba las reservas en la propia operación.
      const { data, error: errorSerie } = await supabase.rpc('editar_serie', {
        p_clase_id: id,
        p_alcance: esDeSerie ? alcance : 'solo_esta',
        p_campos: campos,
      })
      if (errorSerie) {
        setMensaje(errorSerie.message)
        setVersionReservas((v) => v + 1) // vuelve a consultar las reservas (pudo aparecer alguna mientras se editaba)
        setGuardando(false)
        return
      }
      if (!esDeSerie && (data?.editadas ?? 0) === 0) {
        // Sesión suelta: si no se pudo editar, editar_serie lo cuenta como omitida; se muestra el motivo.
        setMensaje(data?.omitidas?.[0]?.motivo || 'No se han podido guardar los cambios.')
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
  // Alcance efectivo de la ubicación: el elegido en una serie; «solo esta» en una sesión suelta.
  const alcanceUbicacion = esDeSerie ? alcance : 'solo_esta'

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
        {Number(precio) > 0 && <BonosDeLaSesion valor={bonosAdmitidos} onCambio={setBonosAdmitidos} />}
        <BloqueUbicacionEditar
          id={id}
          clase={clase}
          alcance={alcanceUbicacion}
          esDeSerie={esDeSerie}
          estadoRef={ubicacionRef}
          onCambio={alCambiarUbicacion}
          version={versionReservas}
        />
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

      {confirmandoParcial && (
        <div role="alertdialog" aria-labelledby="titulo-parcial" className="mt-4 corte-card border-2 border-[#B5E600] bg-[#EDF5C9] px-4 py-3 text-sm text-[#3D4A00]">
          <p id="titulo-parcial" className="font-bold">Modificación parcial de la ubicación</p>
          <p className="mt-1">
            Se actualizará la ubicación de {confirmandoParcial.aplicar} {confirmandoParcial.aplicar === 1 ? 'sesión' : 'sesiones'}.{' '}
            {confirmandoParcial.conservar} {confirmandoParcial.conservar === 1 ? 'sesión ya tiene reservas y conservará' : 'sesiones ya tienen reservas y conservarán'} su ubicación original.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={guardando} onClick={() => handleGuardar(null, { parcialConfirmado: true })} className="corte-btn bg-[#B5E600] px-5 py-2 text-sm font-bold text-[#1F2400] hover:bg-[#a3d100] disabled:opacity-60">
              {guardando ? 'Guardando...' : 'Confirmar cambios'}
            </button>
            <button type="button" onClick={() => setConfirmandoParcial(null)} className="corte-btn border border-[#3D4A00]/30 bg-white px-5 py-2 text-sm font-bold text-[#3D4A00]">
              Volver
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <div className="mt-4 flex items-start gap-2 corte-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
          <p className="font-medium">{mensaje}</p>
        </div>
      )}
    </>
  )
}
