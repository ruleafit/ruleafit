'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SearchX } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../lib/imagenesCategoria'
import BotonReservar from '../../components/BotonReservar'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'

const MapaClases = dynamic(() => import('../../components/MapaClases'), {
  ssr: false,
  loading: () => <p>Cargando mapa...</p>,
})

const CIUDADES_FILTRO = ['Todas', 'Sevilla', 'Málaga']

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
  'block w-full rounded-full border border-[#E2E6CF] bg-white px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600] sm:w-auto'

const filtroLabelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7355]'

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
  const [coordenadasCopiadas, setCoordenadasCopiadas] = useState(null)
  const [filtroCiudad, setFiltroCiudad] = useState('Todas')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [filtroCuando, setFiltroCuando] = useState('Todas')
  const [filtroFranja, setFiltroFranja] = useState('Todas')

  function handleReservado(claseId, nuevasPlazasOcupadas) {
    setClases((prev) =>
      prev.map((c) => (c.id === claseId ? { ...c, plazas_ocupadas: nuevasPlazasOcupadas } : c))
    )
  }

  async function copiarCoordenadas(id, texto) {
    try {
      await navigator.clipboard.writeText(texto)
      setCoordenadasCopiadas(id)
      setTimeout(() => setCoordenadasCopiadas(null), 2000)
    } catch (err) {
      setError('No se pudieron copiar las coordenadas.')
    }
  }

  function limpiarFiltros() {
    setFiltroCiudad('Todas')
    setFiltroCategoria('Todas')
    setFiltroCuando('Todas')
    setFiltroFranja('Todas')
  }

  useEffect(() => {
    async function cargarClases() {
      const { data, error } = await supabase
        .from('clases')
        .select('*')
        .eq('estado', 'activa')
        .order('fecha', { ascending: true })

      if (error) {
        setError('Error al cargar las clases: ' + error.message)
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

  const hoy = obtenerFechaHoy()

  const clasesFiltradas = clases.filter((clase) => {
    if (clase.estado !== 'activa') return false
    if (clase.fecha && clase.fecha < hoy) return false

    const coincideCiudad = filtroCiudad === 'Todas' || clase.ciudad === filtroCiudad
    const coincideCategoria = filtroCategoria === 'Todas' || clase.categoria === filtroCategoria
    const coincideFecha = coincideConCuando(clase.fecha, filtroCuando, hoy)
    const coincideFranja = filtroFranja === 'Todas' || franjaDeHora(clase.hora) === filtroFranja

    return coincideCiudad && coincideCategoria && coincideFecha && coincideFranja
  })

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate flex h-[160px] items-end overflow-hidden sm:h-[200px]">
        <img src="/imagenes/running.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-6 sm:px-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Clases disponibles</h1>
          <p className="mt-1 text-sm text-white/85 sm:text-base">
            Entrenamientos al aire libre en Sevilla y Málaga, sin cuota ni permanencia.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {!error && clases.length === 0 && <p className="text-sm text-[#6B7355]">No hay clases disponibles por ahora.</p>}

        {!error && clases.length > 0 && (
          <>
            <div className="mb-8 flex flex-col gap-4 rounded-xl border border-[#E2E6CF] bg-white/70 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6 sm:p-5">
              <div>
                <label className={filtroLabelClass}>Ciudad</label>
                <select value={filtroCiudad} onChange={(e) => setFiltroCiudad(e.target.value)} className={filtroCampoClass}>
                  {CIUDADES_FILTRO.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
              <div className="md:sticky md:top-24 md:self-start">
                <MapaClases clases={clasesFiltradas} />
              </div>

              <div className="flex flex-col gap-4">
                {clasesFiltradas.length === 0 && (
                  <RevelarAlLlegar className="flex flex-col items-center gap-3 rounded-xl border border-[#E2E6CF] bg-white px-6 py-14 text-center">
                    <SearchX className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
                    <p className="text-sm text-[#6B7355]">
                      No hay clases que coincidan con estos filtros ahora mismo. Prueba a cambiar la ciudad o la categoría.
                    </p>
                    <button
                      type="button"
                      onClick={limpiarFiltros}
                      className="mt-1 inline-flex h-10 items-center justify-center rounded-full bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
                    >
                      Limpiar filtros
                    </button>
                  </RevelarAlLlegar>
                )}

                {clasesFiltradas.map((clase, indice) => {
                  const plazasMax = clase.plazas_max ?? 0
                  const plazasOcupadas = clase.plazas_ocupadas ?? 0
                  const plazasMin = clase.plazas_min ?? 0
                  const plazasLibres = Math.max(plazasMax - plazasOcupadas, 0)
                  const porcentajeOcupado = plazasMax > 0 ? Math.min((plazasOcupadas / plazasMax) * 100, 100) : 0
                  const pendienteConfirmacion = plazasMin > 0 && plazasOcupadas < plazasMin
                  const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO

                  return (
                    <RevelarAlLlegar key={clase.id} delayMs={Math.min(indice * 60, 240)}>
                    <div className="tarjeta-hover overflow-hidden rounded-xl border border-[#E2E6CF] bg-white shadow-sm">
                      <div className="zoom-imagen relative h-40 w-full sm:h-44">
                        <img src={imagenClase} alt="" className="h-full w-full object-cover" />
                        {clase.categoria && (
                          <span className="absolute left-3 top-3 rounded-full border border-[#B5E600] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#1F2400]">
                            {clase.categoria}
                          </span>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <h2 className="text-lg font-bold text-[#1F2400] sm:text-xl">{clase.titulo}</h2>
                          <span className="shrink-0 text-xs text-[#6B7355]">{clase.ciudad}</span>
                        </div>
                        {clase.modalidad && <p className="mb-3 text-sm text-[#6B7355]">{clase.modalidad}</p>}

                        <div className="flex flex-col gap-1 text-sm text-[#6B7355]">
                          <p>
                            Fecha: <span className="text-[#1F2400]">{clase.fecha}</span> · Hora:{' '}
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
                              Dirección: <span className="text-[#1F2400]">{clase.direccion}</span>
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
                            <div className="mb-1 flex items-center justify-between rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                              <span>Pendiente de confirmación ({plazasOcupadas}/{plazasMin} plazas mínimas)</span>
                            </div>
                          ) : (
                            <div className="mb-1 flex items-center justify-between text-xs font-medium text-[#6B7355]">
                              <span>
                                {plazasLibres}/{plazasMax} plazas libres
                              </span>
                            </div>
                          )}
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EDF5C9]">
                            <div
                              className="h-full rounded-full bg-[#B5E600] motion-safe:transition-all motion-safe:duration-300"
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
                              <button
                                type="button"
                                onClick={() => copiarCoordenadas(clase.id, `${clase.lat}, ${clase.lng}`)}
                                className="rounded-full border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
                              >
                                {coordenadasCopiadas === clase.id ? 'Copiado' : 'Copiar coordenadas'}
                              </button>
                            </>
                          )}
                          <Link
                            href={`/clases/${clase.id}`}
                            className="rounded-full border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
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
