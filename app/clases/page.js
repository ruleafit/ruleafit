'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Search, SearchX, UserCheck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO, ESTILO_POR_CATEGORIA, formaSVG } from '../../lib/imagenesCategoria'
import { textoPlazas } from '../../lib/formatoPlazas'
import { estadoConfirmacionClase } from '../../lib/confirmacionClase'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import { geocodificarCiudad } from '../../lib/geocodificar'
import { distanciaKm } from '../../lib/distancia'
import BotonReservar from '../../components/BotonReservar'
import BotonCopiarCoordenadas from '../../components/BotonCopiarCoordenadas'
import BotonCompartir from '../../components/BotonCompartir'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'

const MapaClases = dynamic(() => import('../../components/MapaClases'), {
  ssr: false,
  loading: () => <p>Cargando mapa...</p>,
})

const CATEGORIAS_FILTRO = [
  'Todas',
  'Fuerza / funcional',
  'Cardio',
  'Yoga / Pilates / movilidad',
  'Otros',
]

const FRANJAS_FILTRO = [
  { valor: 'Todas', etiqueta: 'Todas' },
  { valor: 'Mañana', etiqueta: 'Desde las 00:00 hasta las 13:59' },
  { valor: 'Tarde', etiqueta: 'Desde las 14:00 hasta las 18:59' },
  { valor: 'Noche', etiqueta: 'Desde las 19:00 hasta las 23:59' },
]

const CUANDO_FILTRO = ['Todas', 'Hoy', 'Mañana', 'Próximos 7 días', 'Próximos 30 días']

const filtroCampoClass =
  'block w-full corte-btn border border-[#E2E6CF] bg-white px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600] sm:w-auto'

const filtroLabelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7355]'

// Filtro "solo sesiones de ruleros a los que sigo" (pedido por el usuario el
// 23 sept 2026): botón toggle, no un desplegable como el resto de filtros,
// ya que es un sí/no. Ajustado el mismo día a petición del usuario: el
// botón lleva solo el icono (el texto va fuera, al lado), algo más grande,
// y con el mismo marco lima grueso que "Ver mi ubicación" en el mapa
// (components/MapaClases.js) tanto apagado como encendido - encendido se
// rellena también de lima.
const filtroToggleActivoClass =
  'flex shrink-0 items-center justify-center corte-btn border-2 border-[#B5E600] bg-[#B5E600] p-2.5 text-[#1F2400] shadow-md transition-colors'
const filtroToggleInactivoClass =
  'flex shrink-0 items-center justify-center corte-btn border-2 border-[#B5E600] bg-white p-2.5 text-[#3D4A00] shadow-md transition-colors hover:bg-[#F5F7E8]'

function formatearFecha(fecha) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function obtenerFechaHoy() {
  return formatearFecha(new Date())
}

function sumarDias(fechaBase, dias) {
  const fecha = new Date(fechaBase + 'T00:00:00')
  fecha.setDate(fecha.getDate() + dias)
  return formatearFecha(fecha)
}

function franjaDeHora(hora) {
  if (!hora) return null
  if (hora < '14:00') return 'Mañana'
  if (hora < '19:00') return 'Tarde'
  return 'Noche'
}

// Buscador por palabra: sin tildes ni mayúsculas, y todas las palabras
// escritas deben aparecer en alguna parte del título, tipo de actividad,
// categoría, observaciones o material (así "boxeo" encuentra "Entreno de
// boxeo y cardio" sin tener que elegir categoría).
function normalizarTexto(texto) {
  return (texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function coincideConBusqueda(clase, busqueda) {
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return true
  const texto = normalizarTexto(
    [clase.titulo, clase.tipo_actividad, clase.categoria, clase.observaciones, clase.material].join(' ')
  )
  return palabras.every((p) => texto.includes(p))
}

// Ciudad escrita a mano: sin tildes ni mayúsculas y por coincidencia parcial
// ("sev" encuentra Sevilla, "malaga" encuentra Málaga). Se busca en la ciudad
// y en la provincia de la sesión, así "Sevilla" encuentra también las de Dos
// Hermanas, Utrera... Vacío = todas.
function coincideConCiudad(clase, textoCiudad) {
  const buscada = normalizarTexto(textoCiudad).trim()
  if (!buscada) return true
  return normalizarTexto(`${clase.ciudad} ${clase.provincia || ''}`).includes(buscada)
}

function coincideConCuando(fechaClase, cuando, hoy) {
  if (cuando === 'Todas') return true
  if (cuando === 'Hoy') return fechaClase === hoy
  if (cuando === 'Mañana') return fechaClase === sumarDias(hoy, 1)
  if (cuando === 'Próximos 7 días') return fechaClase >= hoy && fechaClase <= sumarDias(hoy, 6)
  if (cuando === 'Próximos 30 días') return fechaClase >= hoy && fechaClase <= sumarDias(hoy, 29)
  return true
}

export default function ClasesPage() {
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
  const [filtroSoloSeguidos, setFiltroSoloSeguidos] = useState(false)
  const [filtroSoloSeguidosFijado, setFiltroSoloSeguidosFijado] = useState(false)
  const [seguidosIds, setSeguidosIds] = useState([])
  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user || null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // Filtro "solo sesiones de ruleros a los que sigo" (pedido por el usuario
  // el 23 sept 2026): se carga la lista de a quién sigue el usuario logueado
  // (tabla public.seguimientos, lectura pública) y se filtra por
  // trainer_id en esa lista. Sin sesión iniciada no hay a quién seguir, así
  // que el botón ni se muestra (ver más abajo) y el filtro se apaga si el
  // usuario cierra sesión con el filtro activado.
  //
  // "Mantener este filtro activado siempre que entre" (pedido por el
  // usuario el 2 oct 2026): la preferencia se guarda en la cuenta, no en
  // este navegador (perfiles.filtro_clases_solo_seguidos, sql/065), para
  // que siga al usuario aunque cambie de dispositivo. Si está guardada como
  // activada, el filtro se enciende solo al entrar, sin tener que pulsar el
  // botón.
  useEffect(() => {
    async function cargarSeguidosYPreferencia() {
      if (!usuario) {
        setSeguidosIds([])
        setFiltroSoloSeguidos(false)
        setFiltroSoloSeguidosFijado(false)
        return
      }

      const [{ data: seguidos }, { data: perfil }] = await Promise.all([
        supabase.from('seguimientos').select('entrenador_id').eq('seguidor_id', usuario.id),
        supabase
          .from('perfiles')
          .select('filtro_clases_solo_seguidos')
          .eq('id', usuario.id)
          .maybeSingle(),
      ])

      setSeguidosIds((seguidos || []).map((fila) => fila.entrenador_id))

      const fijado = perfil?.filtro_clases_solo_seguidos ?? false
      setFiltroSoloSeguidosFijado(fijado)
      if (fijado) setFiltroSoloSeguidos(true)
    }
    cargarSeguidosYPreferencia()
  }, [usuario])

  async function handleCambiarFijado(nuevoValor) {
    setFiltroSoloSeguidosFijado(nuevoValor)
    if (nuevoValor) setFiltroSoloSeguidos(true)

    if (!usuario) return
    await supabase
      .from('perfiles')
      .update({ filtro_clases_solo_seguidos: nuevoValor })
      .eq('id', usuario.id)
  }

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

    const coincideCategoria = filtroCategoria === 'Todas' || clase.categoria === filtroCategoria
    const coincideFecha = coincideConCuando(clase.fecha, filtroCuando, hoy)
    const coincideFranja = filtroFranja === 'Todas' || franjaDeHora(clase.hora) === filtroFranja
    const coincideSeguidos = !filtroSoloSeguidos || seguidosIds.includes(clase.trainer_id)

    const coincideTexto = coincideConBusqueda(clase, busqueda)

    return coincideCategoria && coincideFecha && coincideFranja && coincideSeguidos && coincideTexto
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

  // El filtrado ya se aplica al escribir; el botón "Buscar" (o Intro) cierra
  // el teclado en móvil y lleva la vista a los resultados, para que quede
  // claro que se ha hecho la búsqueda.
  function handleBuscar(e) {
    e.preventDefault()
    document.activeElement?.blur()
    document.getElementById('resultados-sesiones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroCiudad('')
    setFiltroCategoria('Todas')
    setFiltroCuando('Todas')
    setFiltroFranja('Todas')
    setFiltroSoloSeguidos(false)
  }

  useEffect(() => {
    async function cargarClases() {
      const { data, error } = await supabase
        .from('clases')
        .select('*, perfiles(username)')
        .eq('estado', 'activa')
        .order('fecha', { ascending: true })

      if (error) {
        setError('Error al cargar las sesiones: ' + error.message)
      } else {
        setClases(data || [])
      }
      setCargando(false)
    }
    cargarClases()
  }, [])

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  // Sugerencias del campo de ciudad: las ciudades y provincias que tienen sesiones ahora.
  const ciudadesDisponibles = [...new Set(clases.flatMap((c) => [c.ciudad, c.provincia]).filter(Boolean))].sort()

  const mostrandoCercanas = !!textoCiudad && !hayEnLaCiudadConFiltros && puntoCiudad?.texto === textoCiudad

  const clasesFiltradas = mostrandoCercanas
    ? clasesSinCiudad
        .filter((c) => c.lat != null && c.lng != null)
        .map((c) => ({ ...c, distanciaKm: distanciaKm(puntoCiudad.lat, puntoCiudad.lng, c.lat, c.lng) }))
        .sort((a, b) => a.distanciaKm - b.distanciaKm)
        .slice(0, 10)
    : clasesSinCiudad.filter((c) => coincideConCiudad(c, textoCiudad))

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate flex h-[160px] items-end overflow-hidden sm:h-[200px]">
        <img src="/imagenes/running.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-6 sm:px-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Sesiones disponibles</h1>
          <p className="mt-1 text-sm text-white/85 sm:text-base">
            Sesiones sin cuota ni permanencia.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {!error && clases.length === 0 && <p className="text-sm text-[#6B7355]">No hay sesiones disponibles por ahora.</p>}

        {!error && clases.length > 0 && (
          <>
            <div className="mb-8 flex flex-col gap-4 corte-card border border-[#E2E6CF] bg-white/70 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6 sm:p-5">
              <form role="search" onSubmit={handleBuscar} className="w-full">
                <label htmlFor="busqueda-sesiones" className={filtroLabelClass}>Buscar actividad</label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#6B7355]" strokeWidth={1.75} />
                    <input
                      id="busqueda-sesiones"
                      type="search"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Ej: boxeo, yoga…"
                      className="block w-full corte-btn border border-[#E2E6CF] bg-white py-2 pl-9 pr-4 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="flex shrink-0 items-center justify-center corte-btn bg-[#B5E600] px-5 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2"
                  >
                    Buscar
                  </button>
                </div>
              </form>

              <div>
                <label htmlFor="busqueda-ciudad" className={filtroLabelClass}>Ciudad</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#6B7355]" strokeWidth={1.75} />
                  <input
                    id="busqueda-ciudad"
                    type="search"
                    list="ciudades-sesiones"
                    value={filtroCiudad}
                    onChange={(e) => setFiltroCiudad(e.target.value)}
                    placeholder="Ej: Sevilla, Málaga…"
                    autoComplete="off"
                    className={`${filtroCampoClass} pl-9 placeholder:text-[#6B7355]`}
                  />
                  <datalist id="ciudades-sesiones">
                    {ciudadesDisponibles.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className={filtroLabelClass}>Categoría</label>
                <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={filtroCampoClass}>
                  {CATEGORIAS_FILTRO.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={filtroLabelClass}>Cuándo</label>
                <select value={filtroCuando} onChange={(e) => setFiltroCuando(e.target.value)} className={filtroCampoClass}>
                  {CUANDO_FILTRO.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={filtroLabelClass}>Franja horaria</label>
                <select value={filtroFranja} onChange={(e) => setFiltroFranja(e.target.value)} className={filtroCampoClass}>
                  {FRANJAS_FILTRO.map((f) => (
                    <option key={f.valor} value={f.valor}>{f.etiqueta}</option>
                  ))}
                </select>
              </div>

              {usuario && (
                <div>
                  <label className={filtroLabelClass}>Ruleros</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFiltroSoloSeguidos((valor) => !valor)}
                      aria-pressed={filtroSoloSeguidos}
                      aria-label="Solo sesiones de ruleros a los que sigo"
                      className={filtroSoloSeguidos ? filtroToggleActivoClass : filtroToggleInactivoClass}
                    >
                      <UserCheck className="h-5 w-5" strokeWidth={1.75} />
                    </button>
                    <span className="text-sm font-medium text-[#3D4A00]">
                      Solo sesiones de ruleros a los que sigo
                    </span>
                  </div>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[#6B7355]">
                    <input
                      type="checkbox"
                      checked={filtroSoloSeguidosFijado}
                      onChange={(e) => handleCambiarFijado(e.target.checked)}
                      className="h-4 w-4 accent-[#B5E600]"
                    />
                    Mantener este filtro activado siempre que entre
                  </label>
                </div>
              )}
            </div>

            <div id="resultados-sesiones" className="grid scroll-mt-24 grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
              <div className="md:sticky md:top-24 md:self-start">
                <MapaClases clases={clasesFiltradas} />
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 corte-card border border-[#E2E6CF] bg-white/70 px-4 py-3 text-xs text-[#3D4A00]">
                  {Object.entries(ESTILO_POR_CATEGORIA).map(([nombre, { forma, color }]) => (
                    <span key={nombre} className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-3.5 w-3.5 shrink-0"
                        dangerouslySetInnerHTML={{ __html: formaSVG(forma, color, 14) }}
                      />
                      {nombre}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {buscandoCiudad && !hayEnLaCiudadConFiltros && (
                  <p className="text-sm text-[#6B7355]">Buscando sesiones cerca de {textoCiudad}…</p>
                )}

                {mostrandoCercanas && clasesFiltradas.length > 0 && (
                  <p className="corte-card border border-[#B5E600]/50 bg-[#EDF5C9] px-4 py-3 text-sm font-medium text-[#3D4A00]">
                    {hayAlgunaEnLaCiudad
                      ? `No hay sesiones en ${puntoCiudad.nombre} con estos filtros. Te mostramos las más cercanas.`
                      : `No hay sesiones en ${puntoCiudad.nombre}. Te mostramos las más cercanas.`}
                  </p>
                )}

                {!buscandoCiudad && clasesFiltradas.length === 0 && (
                  <RevelarAlLlegar className="flex flex-col items-center gap-3 corte-card border border-[#E2E6CF] bg-white px-6 py-14 text-center">
                    <SearchX className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
                    <p className="text-sm text-[#6B7355]">
                      No hay sesiones que coincidan con estos filtros ahora mismo. Prueba a cambiar la ciudad o la categoría.
                    </p>
                    <button
                      type="button"
                      onClick={limpiarFiltros}
                      className="mt-1 inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
                    >
                      Limpiar filtros
                    </button>
                  </RevelarAlLlegar>
                )}

                {clasesFiltradas.map((clase, indice) => {
                  const plazasMax = clase.plazas_max ?? 0
                  const plazasOcupadas = clase.plazas_ocupadas ?? 0
                  const plazasMin = clase.plazas_min ?? 0
                  const porcentajeOcupado = plazasMax > 0 ? Math.min((plazasOcupadas / plazasMax) * 100, 100) : 0
                  const { pendienteConfirmacion } = estadoConfirmacionClase({ plazasMin, plazasOcupadas })
                  const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO
                  // Por sesión, no por usuario (Fase 5 de la unificación de
                  // roles, 11 sept 2026): un mismo usuario puede organizar
                  // esta sesión y ser participante en otra de la lista.
                  const esEntrenador = !!(usuario && clase.trainer_id === usuario.id)

                  return (
                    <RevelarAlLlegar key={clase.id} delayMs={Math.min(indice * 60, 240)}>
                    <div className="tarjeta-hover overflow-hidden corte-card border border-[#E2E6CF] bg-white shadow-sm">
                      <div className="zoom-imagen relative h-40 w-full sm:h-44">
                        <img src={imagenClase} alt="" className="h-full w-full object-cover" />
                        {clase.categoria && (
                          <span className="absolute left-3 top-3 corte-tag border border-[#B5E600] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#1F2400]">
                            {clase.categoria}
                          </span>
                        )}
                        <div className="absolute right-3 top-3">
                          <BotonCompartir clase={clase} />
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <h2 className="text-lg font-bold text-[#1F2400] sm:text-xl">{clase.titulo}</h2>
                          <span className="shrink-0 text-xs text-[#6B7355]">
                            {clase.ciudad}
                            {clase.distanciaKm != null && ` · a ${Math.round(clase.distanciaKm)} km`}
                          </span>
                        </div>
                        {(clase.tipo_actividad || clase.perfiles?.username) && (
                          <div className="mb-3 text-sm text-[#6B7355]">
                            {clase.tipo_actividad && <p>{clase.tipo_actividad}</p>}
                            {clase.perfiles?.username && (
                              <p className="text-base">
                                por{' '}
                                <Link
                                  href={`/entrenador/${clase.perfiles.username}`}
                                  className="font-semibold text-[#3D4A00] hover:underline"
                                >
                                  @{clase.perfiles.username}
                                </Link>
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-1 text-sm text-[#6B7355]">
                          <p>
                            Fecha: <span className="text-[#1F2400]">{formatearFechaParaMostrar(clase.fecha)}</span> · Hora:{' '}
                            <span className="text-[#1F2400]">{clase.hora}</span>
                          </p>
                          {clase.duracion != null && (
                            <p>
                              Duración: <span className="text-[#1F2400]">{clase.duracion} min</span>
                            </p>
                          )}
                          <p>
                            Precio: <span className="font-semibold text-[#1F2400]">{clase.precio} €</span>
                          </p>
                          {clase.direccion && (
                            <p>
                              Zona: <span className="text-[#1F2400]">{clase.direccion}</span>
                            </p>
                          )}
                          {clase.punto_encuentro && (
                            <p>
                              Punto de encuentro: <span className="text-[#1F2400]">{clase.punto_encuentro}</span>
                            </p>
                          )}
                        </div>

                        <div className="mt-4">
                          {pendienteConfirmacion ? (
                            <div className="mb-1 flex items-center justify-between corte-tag border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                              <span>Pendiente de confirmación ({plazasOcupadas}/{plazasMin} plazas mínimas)</span>
                            </div>
                          ) : (
                            <div className="mb-1 flex items-center justify-between text-xs font-medium text-[#6B7355]">
                              <span>{textoPlazas({ esEntrenador, plazasOcupadas, plazasMax })}</span>
                            </div>
                          )}
                          <div className="h-1.5 w-full overflow-hidden corte-barra bg-[#EDF5C9]">
                            <div
                              className="h-full corte-barra bg-[#B5E600] motion-safe:transition-all motion-safe:duration-300"
                              style={{ width: `${porcentajeOcupado}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <BotonReservar clase={clase} onReservado={(nuevasPlazasOcupadas) => handleReservado(clase.id, nuevasPlazasOcupadas)} />
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E2E6CF] pt-3">
                          {clase.lat != null && clase.lng != null && (
                            <>
                              <span className="select-all text-xs text-[#6B7355]">
                                {clase.lat}, {clase.lng}
                              </span>
                              <BotonCopiarCoordenadas
                                lat={clase.lat}
                                lng={clase.lng}
                                onError={() => setError('No se pudieron copiar las coordenadas.')}
                                className="corte-tag border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
                              />
                            </>
                          )}
                          <Link
                            href={`/clases/${clase.id}?from=clases`}
                            className="corte-tag border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
                          >
                            Ver detalle
                          </Link>
                        </div>
                      </div>
                    </div>
                    </RevelarAlLlegar>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
