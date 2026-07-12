'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'
import BotonReservar from '../../../components/BotonReservar'

const MapaVista = dynamic(() => import('../../../components/MapaVista'), {
  ssr: false,
  loading: () => <p>Cargando mapa...</p>,
})

const seccionTituloClass = 'mb-4 border-b border-zinc-200 pb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500'

export default function DetalleClasePage() {
  const { id } = useParams()
  const [clase, setClase] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargarClase() {
      const { data, error } = await supabase.from('clases').select('*').eq('id', id).single()

      if (error || !data) {
        setError('No se ha encontrado esta clase.')
      } else {
        setClase(data)
      }
      setCargando(false)
    }
    if (id) cargarClase()
  }, [id])

  if (cargando) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  if (error || !clase) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
          {error || 'No se ha encontrado esta clase.'}{' '}
          <Link href="/clases" className="font-semibold text-[#7a9900] hover:underline">
            Volver a clases
          </Link>
          .
        </div>
      </div>
    )
  }

  const plazasMax = clase.plazas_max ?? 0
  const plazasOcupadas = clase.plazas_ocupadas ?? 0
  const plazasLibres = Math.max(plazasMax - plazasOcupadas, 0)
  const porcentajeOcupado = plazasMax > 0 ? Math.min((plazasOcupadas / plazasMax) * 100, 100) : 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/clases" className="mb-6 inline-block text-sm font-medium text-zinc-600 hover:text-black">
        ← Volver a clases
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-black sm:text-3xl">{clase.titulo}</h1>
        {clase.categoria && (
          <span className="inline-block rounded-full border border-[#B5E600] bg-[#f5fbe0] px-2.5 py-1 text-xs font-semibold text-zinc-800">
            {clase.categoria}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-10">
        <section>
          <h2 className={seccionTituloClass}>Detalles</h2>
          <div className="flex flex-col gap-1 text-sm text-zinc-600">
            {clase.modalidad && (
              <p>
                Modalidad: <span className="text-zinc-800">{clase.modalidad}</span>
              </p>
            )}
            {clase.nivel && (
              <p>
                Nivel: <span className="text-zinc-800">{clase.nivel}</span>
              </p>
            )}
            <p>
              Fecha: <span className="text-zinc-800">{clase.fecha}</span> · Hora:{' '}
              <span className="text-zinc-800">{clase.hora}</span>
            </p>
            {clase.duracion != null && (
              <p>
                Duración: <span className="text-zinc-800">{clase.duracion} min</span>
              </p>
            )}
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className={seccionTituloClass}>Ubicación</h2>
          <div className="flex flex-col gap-3 text-sm text-zinc-600">
            <p>
              Ciudad: <span className="text-zinc-800">{clase.ciudad}</span>
            </p>
            {clase.direccion && (
              <p>
                Dirección: <span className="text-zinc-800">{clase.direccion}</span>
              </p>
            )}
            {clase.punto_encuentro && (
              <p>
                Punto de encuentro: <span className="text-zinc-800">{clase.punto_encuentro}</span>
              </p>
            )}
            {clase.lat != null && clase.lng != null && (
              <div className="w-full overflow-hidden rounded-lg border border-zinc-300">
                <MapaVista lat={clase.lat} lng={clase.lng} titulo={clase.titulo} />
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className={seccionTituloClass}>Precio y plazas</h2>
          <div className="flex flex-col gap-3 text-sm text-zinc-600">
            <p>
              Precio: <span className="font-semibold text-zinc-800">{clase.precio} €</span>
            </p>
            <div>
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
          </div>
        </section>

        {clase.material && (
          <section className="border-t border-zinc-200 pt-8">
            <h2 className={seccionTituloClass}>Material necesario</h2>
            <p className="text-sm text-zinc-800">{clase.material}</p>
          </section>
        )}

        {clase.observaciones && (
          <section className="border-t border-zinc-200 pt-8">
            <h2 className={seccionTituloClass}>Observaciones</h2>
            <p className="text-sm text-zinc-800">{clase.observaciones}</p>
          </section>
        )}

        <section className="border-t border-zinc-200 pt-8">
          <BotonReservar
            clase={clase}
            tamaño="grande"
            onReservado={(nuevasPlazasOcupadas) =>
              setClase((prev) => ({ ...prev, plazas_ocupadas: nuevasPlazasOcupadas }))
            }
          />
        </section>
      </div>
    </div>
  )
}
