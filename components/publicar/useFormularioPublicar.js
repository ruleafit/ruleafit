'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
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
  }

  return {
    titulo, setTitulo, categoria, setCategoria, tipoActividad, setTipoActividad,
    ciudad, setCiudad, ciudadTexto, setCiudadTexto, ciudadCentro, setCiudadCentro,
    provincia, setProvincia, direccion, setDireccion, puntoEncuentro, setPuntoEncuentro,
    fecha, setFecha, hora, setHora, duracion, setDuracion, nivel, setNivel,
    precio, setPrecio, plazasMax, setPlazasMax, plazasMin, setPlazasMin,
    material, setMaterial, observaciones, setObservaciones, lat, setLat, lng, setLng,
    fechaPropuesta, setFechaPropuesta, reiniciarTrasPublicar,
  }
}
