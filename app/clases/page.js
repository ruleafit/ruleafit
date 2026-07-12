'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const CIUDADES_FILTRO = ['Todas', 'Sevilla', 'Málaga']

const CATEGORIAS_FILTRO = [
  'Todas',
  'Fuerza / funcional',
  'Baile / coreografiado',
  'Yoga / movilidad',
  'Cardio / running',
  'Combate / boxeo',
  'Otra',
]

const filtroSelectClass =
  'block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600] sm:w-auto'

export default function ClasesPage() {
  const [clases, setClases] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [coordenadasCopiadas, setCoordenadasCopiadas] = useState(null)
  const [filtroCiudad, setFiltroCiudad] = useState('Todas')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')

  async function copiarCoordenadas(id, texto) {
    try {
      await navigator.clipboard.writeText(texto)
      setCoordenadasCopiadas(id)
      setTimeout(() => setCoordenadasCopiadas(null), 2000)
    } catch (err) {
      setError('No se pudieron copiar las coordenadas.')
    }
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
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  const clasesFiltradas = clases.filter((clase) => {
    const coincideCiudad = filtroCiudad === 'Todas' || clase.ciudad === filtroCiudad
    const coincideCategoria = filtroCategoria === 'Todas' || clase.categoria === filtroCategoria
    return coincideCiudad && coincideCategoria
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold text-black sm:text-3xl">Clases disponibles</h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!error && clases.length === 0 && <p className="text-sm text-zinc-500">No hay clases disponibles por ahora.</p>}

      {!error && clases.length > 0 && (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Ciudad</label>
            <select value={filtroCiudad} onChange={(e) => setFiltroCiudad(e.target.value)} className={filtroSelectClass}>
              {CIUDADES_FILTRO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Categoría</label>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={filtroSelectClass}>
              {CATEGORIAS_FILTRO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!error && clases.length > 0 && clasesFiltradas.length === 0 && (
        <p className="py-10 text-center text-sm text-zinc-500">
          No hay clases que coincidan con estos filtros ahora mismo. Prueba a cambiar la ciudad o la categoría.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {clasesFiltradas.map((clase) => {
          const plazasMax = clase.plazas_max ?? 0
          const plazasOcupadas = clase.plazas_ocupadas ?? 0
          const plazasLibres = Math.max(plazasMax - plazasOcupadas, 0)
          const porcentajeOcupado = plazasMax > 0 ? Math.min((plazasOcupadas / plazasMax) * 100, 100) : 0

          return (
            <div
              key={clase.id}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                {clase.categoria && (
                  <span className="inline-block rounded-full border border-[#B5E600] bg-[#f5fbe0] px-2.5 py-1 text-xs font-semibold text-zinc-800">
                    {clase.categoria}
                  </span>
                )}
                <span className="text-xs text-zinc-400">{clase.ciudad}</span>
              </div>

              <h2 className="mb-1 text-lg font-bold text-black sm:text-xl">{clase.titulo}</h2>
              {clase.modalidad && <p className="mb-3 text-sm text-zinc-500">{clase.modalidad}</p>}

              <div className="flex flex-col gap-1 text-sm text-zinc-500">
                <p>
                  Fecha: <span className="text-zinc-700">{clase.fecha}</span> · Hora:{' '}
                  <span className="text-zinc-700">{clase.hora}</span>
                </p>
                {clase.duracion != null && (
                  <p>
                    Duración: <span className="text-zinc-700">{clase.duracion} min</span>
                  </p>
                )}
                <p>
                  Precio: <span className="font-semibold text-zinc-800">{clase.precio} €</span>
                </p>
                {clase.direccion && (
                  <p>
                    Dirección: <span className="text-zinc-700">{clase.direccion}</span>
                  </p>
                )}
                {clase.punto_encuentro && (
                  <p>
                    Punto de encuentro: <span className="text-zinc-700">{clase.punto_encuentro}</span>
                  </p>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-600">
                  <span>
                    {plazasLibres}/{plazasMax} plazas libres
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-[#B5E600] motion-safe:transition-all motion-safe:duration-300"
                    style={{ width: `${porcentajeOcupado}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3">
                {clase.lat != null && clase.lng != null && (
                  <>
                    <span className="select-all text-xs text-zinc-500">
                      {clase.lat}, {clase.lng}
                    </span>
                    <button
                      type="button"
                      onClick={() => copiarCoordenadas(clase.id, `${clase.lat}, ${clase.lng}`)}
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
                    >
                      {coordenadasCopiadas === clase.id ? 'Copiado' : 'Copiar coordenadas'}
                    </button>
                  </>
                )}
                <Link
                  href={`/clases/${clase.id}`}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
                >
                  Ver detalle
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
