'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { SearchX, CircleAlert, CalendarClock, MapPin, Dumbbell, Navigation } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { textoPlazas } from '../../../lib/formatoPlazas'
import { estadoConfirmacionClase } from '../../../lib/confirmacionClase'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../../lib/imagenesCategoria'
import BotonReservar from '../../../components/BotonReservar'
import BotonCopiarCoordenadas from '../../../components/BotonCopiarCoordenadas'
import RevelarAlLlegar from '../../../components/RevelarAlLlegar'

const MapaVista = dynamic(() => import('../../../components/MapaVista'), {
  ssr: false,
  loading: () => <p className="text-sm text-[#6B7355]">Cargando mapa...</p>,
})

const tarjetaClass = 'rounded-xl border border-[#E2E6CF] bg-white p-5 shadow-sm sm:p-6'
const botonPrimarioClass =
  'inline-flex h-10 items-center justify-center rounded-full bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]'

function TituloBloque({ Icono, children }) {
  return (
    <div className="mb-5 flex items-center gap-3 border-l-4 border-[#B5E600] pl-3">
      <Icono className="h-6 w-6 shrink-0 text-[#3D4A00]" strokeWidth={1.75} />
      <h2 className="text-lg font-bold tracking-tight text-[#3D4A00] sm:text-xl">{children}</h2>
    </div>
  )
}

function CampoDetalle({ etiqueta, valor }) {
  if (!valor) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7355]">{etiqueta}</p>
      <p className="mt-0.5 text-sm text-[#1F2400]">{valor}</p>
    </div>
  )
}

function CabeceraDetalle({ clase }) {
  const imagen = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO

  return (
    <section className="relative isolate flex h-[260px] items-end overflow-hidden">
      <img src={imagen} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />

      <Link
        href="/clases"
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/40 sm:left-6 sm:top-6"
      >
        ← Clases
      </Link>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-6 sm:px-6">
        {clase.categoria && (
          <span className="mb-2 inline-block rounded-full border border-[#B5E600] bg-black/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {clase.categoria}
          </span>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">{clase.titulo}</h1>
      </div>
    </section>
  )
}

export default function DetalleClasePage() {
  const { id } = useParams()
  const [clase, setClase] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    async function cargarClase() {
      const { data, error } = await supabase
        .from('clases')
        .select('*, perfiles(username)')
        .eq('id', id)
        .single()

      if (error || !data) {
        setError('No se ha encontrado esta clase.')
      } else {
        setClase(data)
      }
      setCargando(false)
    }
    if (id) cargarClase()
  }, [id])

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

  const esEntrenador = usuario?.user_metadata?.rol === 'entrenador'

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (error || !clase) {
    return (
      <div className="flex min-h-[70vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <SearchX className="h-12 w-12 text-[#B5E600]" strokeWidth={1.75} />
        <p className="text-sm text-[#6B7355]">{error || 'No se ha encontrado esta clase.'}</p>
        <Link href="/clases" className={botonPrimarioClass}>
          Volver a clases
        </Link>
      </div>
    )
  }

  const plazasMax = clase.plazas_max ?? 0
  const plazasOcupadas = clase.plazas_ocupadas ?? 0
  const plazasMin = clase.plazas_min ?? 0
  const porcentajeOcupado = plazasMax > 0 ? Math.min((plazasOcupadas / plazasMax) * 100, 100) : 0
  const { pendienteConfirmacion } = estadoConfirmacionClase({ plazasMin, plazasOcupadas })
  const estaCancelada = clase.estado === 'cancelada'

  return (
    <div className="flex flex-1 flex-col">
      {estaCancelada && (
        <div className="flex items-center justify-center gap-2 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
          <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2} />
          Esta clase ha sido cancelada por el entrenador.
        </div>
      )}

      <CabeceraDetalle clase={clase} />

      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-8 sm:px-6 sm:pb-10">
        {clase.perfiles?.username && (
          <p className="mb-4 text-lg text-[#6B7355]">
            Clase impartida por <span className="font-semibold text-[#3D4A00]">@{clase.perfiles.username}</span>
          </p>
        )}

        <div className="flex flex-col gap-6">
          <RevelarAlLlegar className={tarjetaClass}>
            <TituloBloque Icono={CalendarClock}>Cuándo</TituloBloque>

            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <p className="text-lg font-bold text-[#1F2400] sm:text-xl">{clase.fecha}</p>
              <p className="text-lg font-bold text-[#1F2400] sm:text-xl">{clase.hora}</p>
              {clase.duracion != null && (
                <p className="text-sm text-[#6B7355]">{clase.duracion} min de duración</p>
              )}
            </div>

            <div className="mt-5 flex items-baseline gap-1.5 border-t border-[#E2E6CF] pt-5">
              <span className="text-3xl font-extrabold tracking-tight text-[#1F2400]">
                {clase.precio != null ? clase.precio : 'A consultar'}
              </span>
              {clase.precio != null && <span className="text-lg font-semibold text-[#6B7355]">€</span>}
              <span className="ml-2 text-xs text-[#6B7355]">Se paga directamente al entrenador</span>
            </div>

            <div className="mt-5">
              {pendienteConfirmacion ? (
                <div className="mb-2 flex items-center justify-between rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                  <span>
                    Pendiente de confirmación ({plazasOcupadas}/{plazasMin} plazas mínimas)
                  </span>
                </div>
              ) : (
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#6B7355]">
                  <span>{textoPlazas({ esEntrenador, plazasOcupadas, plazasMax })}</span>
                </div>
              )}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EDF5C9]">
                <div
                  className="h-full rounded-full bg-[#B5E600] motion-safe:transition-all motion-safe:duration-300"
                  style={{ width: `${porcentajeOcupado}%` }}
                />
              </div>
            </div>
          </RevelarAlLlegar>

          {(clase.tipo_actividad || clase.nivel || clase.material || clase.observaciones) && (
            <RevelarAlLlegar delayMs={80} className={tarjetaClass}>
              <TituloBloque Icono={Dumbbell}>Detalles</TituloBloque>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <CampoDetalle etiqueta="Tipo de actividad" valor={clase.tipo_actividad} />
                <CampoDetalle etiqueta="Nivel" valor={clase.nivel} />
                <CampoDetalle etiqueta="Material necesario" valor={clase.material} />
                <CampoDetalle etiqueta="Observaciones" valor={clase.observaciones} />
              </div>
            </RevelarAlLlegar>
          )}

          <RevelarAlLlegar delayMs={160} className={tarjetaClass}>
            <TituloBloque Icono={MapPin}>Dónde</TituloBloque>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-semibold text-[#1F2400]">{clase.ciudad}</p>
                {clase.direccion && <p className="text-[#1F2400]">{clase.direccion}</p>}
                {clase.punto_encuentro && (
                  <p className="text-[#6B7355]">
                    Punto de encuentro: <span className="text-[#1F2400]">{clase.punto_encuentro}</span>
                  </p>
                )}
              </div>

              {clase.lat != null && clase.lng != null && (
                <>
                  <div className="overflow-hidden rounded-xl border border-[#E2E6CF]">
                    <MapaVista lat={clase.lat} lng={clase.lng} titulo={clase.titulo} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${clase.lat},${clase.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#B5E600] px-5 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
                    >
                      <Navigation className="h-4 w-4" strokeWidth={2} />
                      Cómo llegar
                    </a>

                    <BotonCopiarCoordenadas
                      lat={clase.lat}
                      lng={clase.lng}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-[#E2E6CF] px-4 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
                    />
                  </div>
                </>
              )}
            </div>
          </RevelarAlLlegar>

          <div className="hidden sm:block">
            <BotonReservar
              clase={clase}
              tamaño="grande"
              onReservado={(nuevasPlazasOcupadas) =>
                setClase((prev) => ({ ...prev, plazas_ocupadas: nuevasPlazasOcupadas }))
              }
            />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center border-t border-[#E2E6CF] bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(31,36,0,0.1)] backdrop-blur sm:hidden">
        <BotonReservar
          clase={clase}
          tamaño="grande"
          onReservado={(nuevasPlazasOcupadas) =>
            setClase((prev) => ({ ...prev, plazas_ocupadas: nuevasPlazasOcupadas }))
          }
        />
      </div>
    </div>
  )
}
