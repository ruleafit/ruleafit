'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { geocodificarInversa } from '../../lib/geocodificarInversa'
import { crearUbicacion } from '../../lib/ubicacionSesion'
import { CATEGORIAS, NIVELES, proponerFechaCopia } from './constantes'

// Estado de todos los campos del formulario de publicar y precarga al copiar
// una sesión. Devuelve cada valor con su setter.
export default function useFormularioPublicar(copiarId) {
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [tipoActividad, setTipoActividad] = useState('')
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
  // true mientras la fecha es la propuesta al copiar una sesión (para avisarlo).
  const [fechaPropuesta, setFechaPropuesta] = useState(false)
  // Repetición semanal (C07). Por defecto se publica una sola sesión.
  const [repetir, setRepetir] = useState(false)
  const [repInicio, setRepInicio] = useState('')
  const [repFin, setRepFin] = useState('')
  const [patron, setPatron] = useState({ dias: [], personalizado: false, horas: [], horasPorDia: {} })

  // ---- Ubicación de la sesión: UNA sola ubicación (el pin) determina coordenadas, municipio y provincia ----
  // Toda la lógica (resultado del buscador = ubicación definitiva, geocodificación inversa, respuestas antiguas
  // descartadas, ubicación habitual, copia, corrección manual) está en lib/ubicacionSesion.js.
  const [ubi, setUbi] = useState({ lat: null, lng: null, ciudad: '', provincia: '', lugar: '', origen: '', estado: 'vacio', aviso: '', foco: null })
  const [ubicacionElegidaId, setUbicacionElegidaId] = useState('')
  const gestorRef = useRef(null)
  if (!gestorRef.current) gestorRef.current = crearUbicacion({ resolver: geocodificarInversa, alCambiar: setUbi })
  const gestor = gestorRef.current
  useEffect(() => () => gestor.destruir(), [gestor])

  // Resultado del buscador de direcciones: el pin queda YA como ubicación definitiva.
  function alElegirResultadoBusqueda(resultado) {
    setUbicacionElegidaId('')
    gestor.elegirBusqueda(resultado)
  }

  // Toque en el mapa: otro punto (se guardan las coordenadas exactas y se obtienen municipio y provincia).
  function alElegirPuntoEnMapa(nuevaLat, nuevaLng) {
    setUbicacionElegidaId('')
    gestor.elegirMapa(nuevaLat, nuevaLng)
  }

  // Ubicación habitual elegida: coordenadas, municipio y provincia; el mapa se centra en ella.
  // NO se tocan «Zona» ni «Punto de encuentro».
  function elegirUbicacionHabitual(u) {
    setUbicacionElegidaId(u.id)
    gestor.elegirGuardada(u)
  }

  function quitarUbicacionHabitual() {
    setUbicacionElegidaId('')
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
      // La ubicación (pin, municipio) de la sesión copiada; clase_para_copiar no devuelve la provincia: se obtiene del
      // punto con la geocodificación inversa.
      gestor.cargar({ lat: data.lat ?? null, lng: data.lng ?? null, ciudad: data.ciudad || '', provincia: '' })
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
    }
    cargarDatosCopia()
  }, [copiarId, gestor])

  // Tras publicar se vacían los campos (categoría y nivel se conservan para publicar otra seguida). La ubicación
  // también se vacía: la siguiente sesión debe elegir la suya (o una ubicación habitual) y no arrastrar datos antiguos.
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
    gestor.limpiar()
    setUbicacionElegidaId('')
    setRepetir(false)
    setRepInicio('')
    setRepFin('')
    setPatron({ dias: [], personalizado: false, horas: [], horasPorDia: {} })
  }

  return {
    // Ubicación (una sola fuente): lat, lng, ciudad (municipio) y provincia salen del pin.
    ubi, lat: ubi.lat, lng: ubi.lng, ciudad: ubi.ciudad, provincia: ubi.provincia,
    gestorUbicacion: gestor, ubicacionElegidaId, alElegirResultadoBusqueda, alElegirPuntoEnMapa,
    elegirUbicacionHabitual, quitarUbicacionHabitual,
    corregirUbicacionManual: gestor.corregirManual, reintentarUbicacion: gestor.reintentar,
    repetir, setRepetir, repInicio, setRepInicio, repFin, setRepFin, patron, setPatron,
    titulo, setTitulo, categoria, setCategoria, tipoActividad, setTipoActividad,
    direccion, setDireccion, puntoEncuentro, setPuntoEncuentro,
    fecha, setFecha, hora, setHora, duracion, setDuracion, nivel, setNivel,
    precio, setPrecio, plazasMax, setPlazasMax, plazasMin, setPlazasMin,
    material, setMaterial, observaciones, setObservaciones,
    fechaPropuesta, setFechaPropuesta, reiniciarTrasPublicar,
  }
}
