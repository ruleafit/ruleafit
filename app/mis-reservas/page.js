'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

export default function MisReservasPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [reservas, setReservas] = useState([])
  const [cargandoReservas, setCargandoReservas] = useState(true)
  const [error, setError] = useState('')

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
          'id, clases(id, titulo, categoria, fecha, hora, duracion, ciudad, direccion, punto_encuentro, precio, plazas_max, plazas_ocupadas)'
        )
        .eq('cliente_id', usuario.id)
        .eq('estado', 'activa')
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

  if (cargandoSesion) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  if (!esCliente) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="mb-8 text-2xl font-bold text-black sm:text-3xl">Mis reservas</h1>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
          Esta página es solo para clientes. Ve a{' '}
          <Link href="/clases" className="font-semibold text-[#7a9900] hover:underline">
            ver las clases disponibles
          </Link>
          .
        </div>
      </div>
    )
  }

  if (cargandoReservas) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold text-black sm:text-3xl">Mis reservas</h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!error && reservas.length === 0 && (
        <p className="text-sm text-zinc-500">
          Todavía no tienes ninguna clase reservada. Ve a{' '}
          <Link href="/clases" className="font-semibold text-[#7a9900] hover:underline">
            ver las clases disponibles
          </Link>
          .
        </p>
      )}

      <div className="flex flex-col gap-4">
        {reservas.map((reserva) => {
          const clase = reserva.clases
          if (!clase) return null

          return (
            <div
              key={reserva.id}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                {clase.categoria && (
                  <span className="inline-block rounded-full border border-[#B5E600] bg-[#f5fbe0] px-2.5 py-1 text-xs font-semibold text-zinc-800">
                    {clase.categoria}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7a9900]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Reservada
                </span>
              </div>

              <h2 className="mb-1 text-lg font-bold text-black sm:text-xl">{clase.titulo}</h2>

              <div className="flex flex-col gap-1 text-sm text-zinc-500">
                <p>
                  Ciudad: <span className="text-zinc-700">{clase.ciudad}</span>
                </p>
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

              <div className="mt-4 border-t border-zinc-100 pt-3">
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
