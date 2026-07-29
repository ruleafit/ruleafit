'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarSearch, CircleCheck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../lib/imagenesCategoria'
import { estadoConfirmacionClase, textoFaltanParaConfirmar } from '../../lib/confirmacionClase'
import { claseYaPaso, horasHastaClase } from '../../lib/ventanaEdicionClase'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'

function claveFechaHora(clase) {
  return `${clase.fecha} ${String(clase.hora).slice(0, 5)}`
}

function etiquetaCuentaAtras(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const objetivo = new Date(fecha + 'T00:00:00')
  const dias = Math.round((objetivo - hoy) / 86400000)

  if (dias <= 0) return 'Es hoy'
  if (dias === 1) return 'Es mañana'
  return `Faltan ${dias} días`
}

export default function MisReservasPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [reservas, setReservas] = useState([])
  const [cargandoReservas, setCargandoReservas] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cancelandoId, setCancelandoId] = useState(null)
  const [erroresCancelacion, setErroresCancelacion] = useState({})

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getSession()
      const usuarioSesion = data.session?.user || null

      if (!usuarioSesion) {
        router.push('/login')
        return
      }

      setUsuario(usuarioSesion)
      setCargandoSesion(false)
    }
    comprobarSesion()
  }, [router])

  const esCliente = usuario?.user_metadata?.rol === 'cliente'

  useEffect(() => {
    async function cargarReservas() {
      if (!usuario || !esCliente) {
        setCargandoReservas(false)
        return
      }

      const { data, error } = await supabase
        .from('reservas')
        .select(
          'id, estado, cancelled_at, cancelada_por_entrenador, clases(id, titulo, categoria, fecha, hora, duracion, ciudad, direccion, punto_encuentro, precio, plazas_max, plazas_min, plazas_ocupadas)'
        )
        .eq('cliente_id', usuario.id)
        .or('estado.eq.activa,and(estado.eq.cancelada,cancelada_por_entrenador.eq.true)')
        .order('fecha', { foreignTable: 'clases', ascending: true })
        .order('hora', { foreignTable: 'clases', ascending: true })

      if (error) {
        setError('Error al cargar tus reservas: ' + error.message)
      } else {
        setReservas(data || [])
      }
      setCargandoReservas(false)
    }
    cargarReservas()
  }, [usuario, esCliente])

  async function handleCancelar(reserva, clase) {
    const confirmado = window.confirm(
      `¿Seguro que quieres cancelar tu reserva de ${clase.titulo}? Esta acción no se puede deshacer.`
    )
    if (!confirmado) return

    setCancelandoId(reserva.id)
    setErroresCancelacion((prev) => {
      const siguiente = { ...prev }
      delete siguiente[reserva.id]
      return siguiente
    })

    const { data, error } = await supabase.rpc('cancelar_reserva', { p_reserva_id: reserva.id })

    if (error) {
      setErroresCancelacion((prev) => ({ ...prev, [reserva.id]: error.message }))
      setCancelandoId(null)
      return
    }

    setReservas((prev) => prev.filter((r) => r.id !== reserva.id))
    setMensaje(
      data?.reembolso_aplicable
        ? 'Reserva cancelada correctamente.'
        : 'Reserva cancelada. Al ser con menos de 2 horas de antelación, no habría devolución cuando exista la cartera virtual (todavía no aplica ningún cargo real).'
    )
    setCancelandoId(null)
    setTimeout(() => setMensaje(''), 6000)
  }

  if (cargandoSesion || cargandoReservas) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (!esCliente) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="mb-8 text-2xl font-bold text-[#1F2400] sm:text-3xl">Mis reservas</h1>
        <div className="rounded-xl border border-[#E2E6CF] bg-white p-6 text-sm text-[#1F2400] shadow-sm">
          Esta página es solo para clientes. Ve a{' '}
          <Link href="/clases" className="font-semibold text-[#3D4A00] hover:underline">
            ver las clases disponibles
          </Link>
          .
        </div>
      </div>
    )
  }

  const reservasActivas = reservas.filter((r) => r.estado === 'activa' && r.clases)
  const reservasCanceladasPorEntrenador = reservas.filter(
    (r) =>
      r.estado === 'cancelada' &&
      r.cancelada_por_entrenador &&
      r.clases &&
      horasHastaClase(r.clases) > -1
  )
  const sinReservas = reservasActivas.length === 0 && reservasCanceladasPorEntrenador.length === 0

  const reservasProximas = reservasActivas
    .filter((r) => !claseYaPaso(r.clases))
    .sort((a, b) => (claveFechaHora(a.clases) < claveFechaHora(b.clases) ? -1 : 1))

  const reservasPasadas = reservasActivas
    .filter((r) => claseYaPaso(r.clases))
    .sort((a, b) => (claveFechaHora(a.clases) > claveFechaHora(b.clases) ? -1 : 1))

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate flex h-[140px] items-end overflow-hidden sm:h-[180px]">
        <img src="/imagenes/comunidad.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Mis reservas</h1>
          <p className="mt-1 text-sm text-white/85 sm:text-base">Todo lo que tienes reservado, en un solo sitio.</p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        {mensaje && (
          <div className="mb-4 rounded-xl border border-[#B5E600] bg-[#EDF5C9] px-4 py-2.5 text-sm font-medium text-[#1F2400]">
            {mensaje}
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {!error && sinReservas && (
          <RevelarAlLlegar className="flex flex-col items-center gap-4 rounded-xl border border-[#E2E6CF] bg-white px-6 py-16 text-center">
            <CalendarSearch className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
            <p className="text-sm text-[#6B7355]">Todavía no has reservado ninguna clase</p>
            <Link
              href="/clases"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
            >
              Ver clases
            </Link>
          </RevelarAlLlegar>
        )}

        <div className="flex flex-col gap-4">
          {reservasProximas.map((reserva, indice) => {
            const clase = reserva.clases
            const cuentaAtras = etiquetaCuentaAtras(clase.fecha)
            const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO
            const { pendienteConfirmacion, faltanParaConfirmar } = estadoConfirmacionClase({
              plazasMin: clase.plazas_min,
              plazasOcupadas: clase.plazas_ocupadas,
            })

            return (
              <RevelarAlLlegar key={reserva.id} delayMs={Math.min(indice * 60, 240)}>
                <div className="tarjeta-hover overflow-hidden rounded-xl border border-[#E2E6CF] border-l-4 border-l-[#B5E600] bg-white shadow-sm">
                  <div className="zoom-imagen relative h-32 w-full sm:h-36">
                    <img src={imagenClase} alt="" className="h-full w-full object-cover" />
                    {clase.categoria && (
                      <span className="absolute left-3 top-3 rounded-full border border-[#B5E600] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#1F2400]">
                        {clase.categoria}
                      </span>
                    )}
                    {cuentaAtras && (
                      <span className="absolute right-3 top-3 rounded-full bg-[#1F2400]/80 px-2.5 py-1 text-xs font-semibold text-white">
                        {cuentaAtras}
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#3D4A00]">
                        <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
                        Reservada
                      </span>
                    </div>

                    <h2 className="mb-1 text-lg font-bold text-[#1F2400] sm:text-xl">{clase.titulo}</h2>

                    {pendienteConfirmacion && (
                      <div className="mb-3 flex items-center justify-between rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                        <span>{textoFaltanParaConfirmar(faltanParaConfirmar)}</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1 text-sm text-[#6B7355]">
                      <p>
                        Ciudad: <span className="text-[#1F2400]">{clase.ciudad}</span>
                      </p>
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

                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E2E6CF] pt-3">
                      <Link
                        href={`/clases/${clase.id}`}
                        className="rounded-full border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
                      >
                        Ver detalle
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleCancelar(reserva, clase)}
                        disabled={cancelandoId === reserva.id}
                        className="rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancelandoId === reserva.id ? 'Cancelando...' : 'Cancelar reserva'}
                      </button>
                    </div>

                    {erroresCancelacion[reserva.id] && (
                      <p className="mt-2 text-xs text-red-600">{erroresCancelacion[reserva.id]}</p>
                    )}
                  </div>
                </div>
              </RevelarAlLlegar>
            )
          })}
        </div>

        {reservasCanceladasPorEntrenador.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
              Clases canceladas por el entrenador
            </h2>

            <div className="flex flex-col gap-4">
              {reservasCanceladasPorEntrenador.map((reserva, indice) => {
                const clase = reserva.clases
                const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO

                return (
                  <RevelarAlLlegar key={reserva.id} delayMs={Math.min(indice * 60, 240)}>
                    <div className="overflow-hidden rounded-xl border border-red-200 border-l-4 border-l-red-300 bg-red-50">
                      <div className="relative h-32 w-full opacity-80 sm:h-36">
                        <img src={imagenClase} alt="" className="h-full w-full object-cover grayscale" />
                        {clase.categoria && (
                          <span className="absolute left-3 top-3 rounded-full border border-red-200 bg-white/90 px-2.5 py-1 text-xs font-semibold text-red-400">
                            {clase.categoria}
                          </span>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-red-500">Cancelada</span>
                        </div>

                        <h2 className="mb-1 text-lg font-bold text-red-500 sm:text-xl">{clase.titulo}</h2>

                        <div className="flex flex-col gap-1 text-sm text-red-400">
                          <p>
                            Ciudad: <span className="text-red-500">{clase.ciudad}</span>
                          </p>
                          <p>
                            Fecha: <span className="text-red-500">{clase.fecha}</span> · Hora:{' '}
                            <span className="text-red-500">{clase.hora}</span>
                          </p>
                        </div>

                        <p className="mt-3 border-t border-red-200 pt-3 text-sm text-red-500">
                          Esta clase fue cancelada por el entrenador.
                          {reserva.cancelled_at && (
                            <> El {new Date(reserva.cancelled_at).toLocaleString('es-ES')}.</>
                          )}
                        </p>

                        <div className="mt-3">
                          <Link
                            href={`/clases/${clase.id}`}
                            className="rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
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
        )}

        {reservasPasadas.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
              Historial
            </h2>

            <div className="flex flex-col gap-4">
              {reservasPasadas.map((reserva, indice) => {
                const clase = reserva.clases
                const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO

                return (
                  <RevelarAlLlegar key={reserva.id} delayMs={Math.min(indice * 60, 240)}>
                    <div className="overflow-hidden rounded-xl border border-[#E2E6CF] border-l-4 border-l-zinc-300 bg-zinc-50">
                      <div className="relative h-32 w-full opacity-80 sm:h-36">
                        <img src={imagenClase} alt="" className="h-full w-full object-cover grayscale" />
                        {clase.categoria && (
                          <span className="absolute left-3 top-3 rounded-full border border-zinc-300 bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-500">
                            {clase.categoria}
                          </span>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-500">Ya pasada</span>
                        </div>

                        <h2 className="mb-1 text-lg font-bold text-zinc-500 sm:text-xl">{clase.titulo}</h2>

                        <div className="flex flex-col gap-1 text-sm text-zinc-400">
                          <p>
                            Ciudad: <span className="text-zinc-500">{clase.ciudad}</span>
                          </p>
                          <p>
                            Fecha: <span className="text-zinc-500">{clase.fecha}</span> · Hora:{' '}
                            <span className="text-zinc-500">{clase.hora}</span>
                          </p>
                          {clase.duracion != null && (
                            <p>
                              Duración: <span className="text-zinc-500">{clase.duracion} min</span>
                            </p>
                          )}
                          <p>
                            Precio: <span className="text-zinc-500">{clase.precio} €</span>
                          </p>
                        </div>

                        <div className="mt-3 border-t border-[#E2E6CF] pt-3">
                          <Link
                            href={`/clases/${clase.id}`}
                            className="rounded-full border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
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
        )}
      </div>
    </div>
  )
}
