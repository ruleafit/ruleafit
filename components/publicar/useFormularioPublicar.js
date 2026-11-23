'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { geocodificarInversa } from '../../lib/geocodificarInversa'
import { CATEGORIAS, NIVELES, CIUDAD_POR_DEFECTO, proponerFechaCopia } from './constantes'

// Estado de todos los campos del formulario de publicar y precarga al copiar
// una sesión. Devuelve cada valor con su setter.
export default function useFormularioPublicar(copiarId) {
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [tipoActividad, setTipoActividad] = useState('')
  // ciudad = la confirmada (la que se guarda); ciudadTexto = lo que hay escrito
  // en el campo; ciudadCentro = dónde centrar el mapa de ubicación.
  const [ciudad, setCiudad] = useState(CIUDAD_POR_DEFECTO)
  const [ciudadTexto, setCiudadTexto] = useState(CIUDAD_POR_DEFECTO)
  const [ciudadCentro, setCiudadCentro] = useState(null)
  // Provincia de la ciudad elegida: se guarda con la sesión para que buscar una
  // ciudad encuentre también las sesiones de los pueblos de su provincia.
  const [provincia, setProvincia] = useState(CIUDAD_POR_DEFECTO)
  const [direccion, setDireccion] = useState('')
  const [puntoEncuentro, setPuntoEncuentro] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [duracion, setDuracion] = useState('')
  const [nivel, setNivel] = useState(NIVELES[0])
  const [precio, setPrecio] = useState('')
  const [plazasMax, setPlazasMax] = useState('')
  const [plazasMin, setPlazasMin] = useState('0')
  const [material, setMaterial] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  // true mientras la fecha es la propuesta al copiar una sesión (para avisarlo).
  const [fechaPropuesta, setFechaPropuesta] = useState(false)
  // Repetición semanal (C07). Por defecto se publica una sola sesión.
  const [repetir, setRepetir] = useState(false)
  const [repInicio, setRepInicio] = useState('')
  const [repFin, setRepFin] = useState('')
  const [patron, setPatron] = useState({ dias: [], personalizado: false, horas: [], horasPorDia: {} })

  // ---- Ubicación y detección automática de la ciudad (N09) ----
  // ciudadOrigen: quién ha fijado la ciudad → '' (nadie) | 'auto' (detectada desde el mapa) | 'manual'
  // (escrita o elegida de la lista por la persona, o la de una sesión copiada) | 'guardada' (de una
  // ubicación habitual). La detección solo actúa si la ciudad no es 'manual' ni 'guardada': nunca pisa
  // lo que ha decidido la persona, ni una respuesta lenta o antigua del servicio una corrección posterior.
  const [ciudadOrigen, setCiudadOrigenEstado] = useState('')
  const origenRef = useRef('')
  const [detectando, setDetectando] = useState(false)
  const [avisoGeo, setAvisoGeo] = useState(null) // { tipo: 'ok' | 'fallo', texto }
  const [ubicacionElegidaId, setUbicacionElegidaId] = useState('')
  const secuenciaGeo = useRef(0)
  const temporizadorGeo = useRef(null)
  const controladorGeo = useRef(null)

  function fijarOrigen(o) {
    origenRef.current = o
    setCiudadOrigenEstado(o)
  }

  // Cancela cualquier detección pendiente o en curso (sus respuestas, si llegan, se descartan).
  function invalidarDeteccion() {
    secuenciaGeo.current += 1
    clearTimeout(temporizadorGeo.current)
    controladorGeo.current?.abort()
    setDetectando(false)
  }

  useEffect(
    () => () => {
      clearTimeout(temporizadorGeo.current)
      controladorGeo.current?.abort()
    },
    []
  )

  // Programa la detección del municipio del punto (con retardo, para no consultar en cada clic seguido).
  // soloProvincia: rellena solo la provincia (ubicación guardada sin ella), sin tocar la ciudad.
  function programarDeteccion(nuevaLat, nuevaLng, { soloProvincia = false } = {}) {
    invalidarDeteccion()
    if (!soloProvincia && (origenRef.current === 'manual' || origenRef.current === 'guardada')) return
    const miSecuencia = secuenciaGeo.current
    setDetectando(!soloProvincia)
    if (!soloProvincia) setAvisoGeo(null)
    temporizadorGeo.current = setTimeout(async () => {
      const controlador = new AbortController()
      controladorGeo.current = controlador
      const r = await geocodificarInversa(nuevaLat, nuevaLng, { signal: controlador.signal })
      if (miSecuencia !== secuenciaGeo.current) return // respuesta antigua: se ignora
      setDetectando(false)
      if (soloProvincia) {
        if (r?.provincia) setProvincia(r.provincia)
        return
      }
      if (origenRef.current === 'manual' || origenRef.current === 'guardada') return // la persona decidió mientras tanto
      if (r?.nombre) {
        setCiudad(r.nombre)
        setCiudadTexto(r.nombre)
        setProvincia(r.provincia || '')
        fijarOrigen('auto')
        setAvisoGeo({ tipo: 'ok', texto: `Ciudad detectada desde el mapa: ${r.nombre}. Puedes corregirla si no es la correcta.` })
      } else {
        setAvisoGeo({ tipo: 'fallo', texto: 'No hemos podido detectar la ciudad desde el mapa. Escríbela tú: puedes publicar igualmente.' })
      }
    }, 700)
  }

  // Clic en el mapa: se guardan las coordenadas exactas y se intenta detectar la ciudad.
  function alElegirPuntoEnMapa(nuevaLat, nuevaLng) {
    setLat(nuevaLat)
    setLng(nuevaLng)
    setUbicacionElegidaId('')
    if (origenRef.current === 'guardada') fijarOrigen('') // otro punto: la ciudad guardada ya no vale por defecto
    programarDeteccion(nuevaLat, nuevaLng)
  }

  // La persona escribe o elige la ciudad: es una decisión manual y anula cualquier detección en curso.
  function alEscribirCiudad(texto) {
    invalidarDeteccion()
    fijarOrigen('manual')
    setAvisoGeo(null)
    setCiudadTexto(texto)
  }

  function alElegirCiudadDeLista(ciu) {
    invalidarDeteccion()
    fijarOrigen('manual')
    setAvisoGeo(null)
    setCiudad(ciu.nombre)
    setCiudadTexto(ciu.nombre)
    setProvincia(ciu.provincia || '')
    setCiudadCentro([ciu.lat, ciu.lng])
  }

  // Ubicación habitual elegida: coordenadas, ciudad y provincia; el mapa se centra en ella.
  // NO se tocan «Zona» ni «Punto de encuentro».
  function elegirUbicacionHabitual(u) {
    invalidarDeteccion()
    fijarOrigen('guardada')
    setAvisoGeo(null)
    setUbicacionElegidaId(u.id)
    setLat(u.lat)
    setLng(u.lng)
    setCiudad(u.ciudad)
    setCiudadTexto(u.ciudad)
    setProvincia(u.provincia || '')
    setCiudadCentro([u.lat, u.lng])
    if (!u.provincia) programarDeteccion(u.lat, u.lng, { soloProvincia: true })
  }

  function quitarUbicacionHabitual() {
    setUbicacionElegidaId('')
    if (origenRef.current === 'guardada') fijarOrigen('')
  }

  // Copiar sesión (pedido por el usuario el 21 sept 2026): si se llega aquí
  // desde "Copiar sesión" en Mis sesiones publicadas, se precarga el
  // formulario con los datos de esa sesión, incluida fecha y hora (copia
  // exacta) - el propio aviso de fecha/hora duplicada al publicar avisa si
  // no se cambia nada.
  //
  // Se usa la función clase_para_copiar() (sql/064) en vez de una consulta
  // directa a la tabla: una consulta directa queda sujeta a la política RLS
  // "Ver clases activas" (estado = 'activa' o reserva propia), que bloquea
  // la lectura de una sesión ya cancelada por el propio entrenador -y el
  // entrenador nunca tiene una reserva propia sobre su propia sesión-, así
  // que el formulario salía vacío al copiar justo esas. clase_para_copiar()
  // es SECURITY DEFINER y comprueba ella misma que la sesión es del usuario
  // autenticado, así que funciona sea cual sea su estado.
  useEffect(() => {
    async function cargarDatosCopia() {
      if (!copiarId) return

      const { data: filas } = await supabase.rpc('clase_para_copiar', {
        p_clase_id: copiarId,
      })
      const data = filas?.[0]

      if (!data) return

      setTitulo(data.titulo || '')
      setCategoria(data.categoria || CATEGORIAS[0])
      setTipoActividad(data.tipo_actividad || '')
      setCiudad(data.ciudad || CIUDAD_POR_DEFECTO)
      if (data.ciudad) fijarOrigen('manual')
      setCiudadTexto(data.ciudad || CIUDAD_POR_DEFECTO)
      // clase_para_copiar no devuelve la provincia: se vuelve a calcular al publicar.
      setProvincia('')
      if (data.lat != null && data.lng != null) setCiudadCentro([data.lat, data.lng])
      setDireccion(data.direccion || '')
      setPuntoEncuentro(data.punto_encuentro || '')
      const horaCopia = data.hora ? String(data.hora).slice(0, 5) : ''
      const fechaNueva = data.fecha ? proponerFechaCopia(data.fecha, horaCopia) : ''
      setFecha(fechaNueva)
      setFechaPropuesta(!!fechaNueva)
      setHora(horaCopia)
      setDuracion(data.duracion != null ? String(data.duracion) : '')
      setNivel(data.nivel || NIVELES[0])
      setPrecio(data.precio != null ? String(data.precio) : '')
      setPlazasMax(data.plazas_max != null ? String(data.plazas_max) : '')
      setPlazasMin(data.plazas_min != null ? String(data.plazas_min) : '0')
      setMaterial(data.material || '')
      setObservaciones(data.observaciones || '')
      setLat(data.lat ?? null)
      setLng(data.lng ?? null)
    }
    cargarDatosCopia()
  }, [copiarId])

  // Tras publicar se vacían los mismos campos que antes (categoría, ciudad,
  // nivel y centro del mapa se conservan para publicar otra seguida).
  function reiniciarTrasPublicar() {
    setTitulo('')
    setTipoActividad('')
    setDireccion('')
    setPuntoEncuentro('')
    setFecha('')
    setHora('')
    setDuracion('')
    setPrecio('')
    setPlazasMax('')
    setPlazasMin('0')
    setMaterial('')
    setObservaciones('')
    setLat(null)
    setLng(null)
    setUbicacionElegidaId('')
    setAvisoGeo(null)
    invalidarDeteccion()
    if (origenRef.current === 'guardada') fijarOrigen('')
    setRepetir(false)
    setRepInicio('')
    setRepFin('')
    setPatron({ dias: [], personalizado: false, horas: [], horasPorDia: {} })
  }

  return {
    ciudadOrigen, detectando, avisoGeo, ubicacionElegidaId, alElegirPuntoEnMapa, alEscribirCiudad, alElegirCiudadDeLista,
    elegirUbicacionHabitual, quitarUbicacionHabitual,
    repetir, setRepetir, repInicio, setRepInicio, repFin, setRepFin, patron, setPatron,
    titulo, setTitulo, categoria, setCategoria, tipoActividad, setTipoActividad,
    ciudad, setCiudad, ciudadTexto, setCiudadTexto, ciudadCentro, setCiudadCentro,
    provincia, setProvincia, direccion, setDireccion, puntoEncuentro, setPuntoEncuentro,
    fecha, setFecha, hora, setHora, duracion, setDuracion, nivel, setNivel,
    precio, setPrecio, plazasMax, setPlazasMax, plazasMin, setPlazasMin,
    material, setMaterial, observaciones, setObservaciones, lat, setLat, lng, setLng,
    fechaPropuesta, setFechaPropuesta, reiniciarTrasPublicar,
  }
}
