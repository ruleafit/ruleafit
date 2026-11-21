'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import { geocodificarCiudad } from '../../lib/geocodificar'
import { distanciaKm } from '../../lib/distancia'
import {
  obtenerFechaHoy,
  franjaDeHora,
  coincideConBusqueda,
  coincideConCiudad,
  coincideConCuando,
} from './filtros'

// Carga de sesiones, filtros y listado resultante. `seg` viene de
// useUsuarioYFavoritos (bloqueados, favoritos y filtro de favoritos).
export default function useClasesListado(seg) {
  const { bloqueadosIds, favoritosIds, filtroSoloFavoritos, setFiltroSoloFavoritos } = seg
  // Sesiones de un solo rulero: llega por enlace desde su perfil
  // (/clases?rulero=<id>). Se lee en el navegador al montar.
  const [soloRulero, setSoloRulero] = useState(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('rulero')
    if (id) setSoloRulero(id)
  }, [])
  const [clases, setClases] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroCiudad, setFiltroCiudad] = useState('')
  // Si en la ciudad escrita no hay ninguna sesión, se localiza esa ciudad y
  // se muestran las sesiones más cercanas (puntoCiudad = { texto, nombre, lat, lng }).
  const [puntoCiudad, setPuntoCiudad] = useState(null)
  const [buscandoCiudad, setBuscandoCiudad] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [filtroCuando, setFiltroCuando] = useState('Todas')
  const [filtroFranja, setFiltroFranja] = useState('Todas')

  function handleReservado(claseId, nuevasPlazasOcupadas) {
    setClases((prev) =>
      prev.map((c) => (c.id === claseId ? { ...c, plazas_ocupadas: nuevasPlazasOcupadas } : c))
    )
  }

  const hoy = obtenerFechaHoy()

  // Todos los filtros salvo la ciudad: sobre este conjunto se aplica la
  // ciudad escrita o, si no hay sesiones allí, el orden por cercanía.
  const clasesSinCiudad = clases.filter((clase) => {
    if (clase.estado !== 'activa') return false
    if (claseYaPaso(clase)) return false
    if (bloqueadosIds.includes(clase.trainer_id)) return false

    const coincideCategoria = filtroCategoria === 'Todas' || clase.categoria === filtroCategoria
    const coincideFecha = coincideConCuando(clase.fecha, filtroCuando, hoy)
    const coincideFranja = filtroFranja === 'Todas' || franjaDeHora(clase.hora) === filtroFranja
    const coincideFavoritos = !filtroSoloFavoritos || favoritosIds.includes(clase.trainer_id)
    const coincideRulero = !soloRulero || clase.trainer_id === soloRulero

    const coincideTexto = coincideConBusqueda(clase, busqueda)

    return coincideCategoria && coincideFecha && coincideFranja && coincideFavoritos && coincideRulero && coincideTexto
  })

  // Si en la ciudad escrita no hay sesiones que cumplan los filtros (porque no
  // hay ninguna o porque ninguna encaja con la actividad, categoría, fecha...),
  // se localiza la ciudad y se ofrecen las más cercanas que sí los cumplen.
  const textoCiudad = filtroCiudad.trim()
  const hayAlgunaEnLaCiudad = clases.some((c) => coincideConCiudad(c, textoCiudad))
  const hayEnLaCiudadConFiltros = clasesSinCiudad.some((c) => coincideConCiudad(c, textoCiudad))

  useEffect(() => {
    const texto = textoCiudad
    if (texto.length < 4 || hayEnLaCiudadConFiltros) {
      setPuntoCiudad(null)
      setBuscandoCiudad(false)
      return
    }

    setBuscandoCiudad(true)
    const controlador = new AbortController()
    const temporizador = setTimeout(async () => {
      const resultado = await geocodificarCiudad(texto, { signal: controlador.signal })
      if (controlador.signal.aborted) return
      setPuntoCiudad(resultado ? { texto, ...resultado } : null)
      setBuscandoCiudad(false)
    }, 600)

    return () => {
      clearTimeout(temporizador)
      controlador.abort()
    }
  }, [textoCiudad, hayEnLaCiudadConFiltros])

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroCiudad('')
    setFiltroCategoria('Todas')
    setFiltroCuando('Todas')
    setFiltroFranja('Todas')
    setFiltroSoloFavoritos(false)
    quitarFiltroRulero()
  }

  function quitarFiltroRulero() {
    setSoloRulero(null)
    window.history.replaceState(null, '', window.location.pathname)
  }

  useEffect(() => {
    async function cargarClases() {
      const { data, error } = await supabase
        .from('clases')
        .select('*, perfiles(username, foto_url)')
        .eq('estado', 'activa')
        .order('fecha', { ascending: true })

      if (error) {
        setError('No hemos podido cargar las sesiones. Recarga la página o inténtalo en unos minutos.')
      } else {
        setClases(data || [])
      }
      setCargando(false)
    }
    cargarClases()
  }, [])

  // Sugerencias del campo de ciudad: las ciudades y provincias que tienen sesiones ahora.
  const ciudadesDisponibles = [...new Set(clases.flatMap((c) => [c.ciudad, c.provincia]).filter(Boolean))].sort()

  // Nombre del rulero filtrado (si tiene sesiones activas cargadas).
  const usernameRulero = soloRulero
    ? clases.find((c) => c.trainer_id === soloRulero)?.perfiles?.username || null
    : null

  const mostrandoCercanas = !!textoCiudad && !hayEnLaCiudadConFiltros && puntoCiudad?.texto === textoCiudad

  const clasesFiltradas = mostrandoCercanas
    ? clasesSinCiudad
        .filter((c) => c.lat != null && c.lng != null)
        .map((c) => ({ ...c, distanciaKm: distanciaKm(puntoCiudad.lat, puntoCiudad.lng, c.lat, c.lng) }))
        .sort((a, b) => a.distanciaKm - b.distanciaKm)
        .slice(0, 10)
    : clasesSinCiudad.filter((c) => coincideConCiudad(c, textoCiudad))

  return {
    cargando, error, setError, totalClases: clases.length,
    busqueda, setBusqueda, filtroCiudad, setFiltroCiudad,
    filtroCategoria, setFiltroCategoria, filtroCuando, setFiltroCuando,
    filtroFranja, setFiltroFranja,
    textoCiudad, puntoCiudad, buscandoCiudad, hayAlgunaEnLaCiudad,
    hayEnLaCiudadConFiltros, mostrandoCercanas, ciudadesDisponibles,
    clasesFiltradas, limpiarFiltros, handleReservado,
    soloRulero, usernameRulero, quitarFiltroRulero,
  }
}
