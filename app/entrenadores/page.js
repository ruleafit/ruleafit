'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SearchX, User } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'

const filtroCampoClass =
  'block w-full rounded-full border border-[#E2E6CF] bg-white px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'

const botonPrimarioClass =
  'inline-flex h-10 items-center justify-center rounded-full bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]'

export default function EntrenadoresPage() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [entrenadores, setEntrenadores] = useState([])
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser()
      const usuarioActual = userData.user || null
      setUsuario(usuarioActual)

      if (usuarioActual && usuarioActual.user_metadata?.rol === 'cliente') {
        const { data, error: errorRpc } = await supabase.rpc('listar_entrenadores')

        if (errorRpc) {
          setError('Error al cargar los entrenadores: ' + errorRpc.message)
        } else {
          setEntrenadores(data || [])
        }
      }

      setCargando(false)
    }
    cargar()
  }, [])

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (!usuario) {
    return (
      <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-[#6B7355]">Inicia sesión para descubrir entrenadores.</p>
        <Link href="/login" className={botonPrimarioClass}>
          Iniciar sesión
        </Link>
      </div>
    )
  }

  if (usuario.user_metadata?.rol !== 'cliente') {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center px-6 text-center">
        <p className="text-sm text-[#6B7355]">Esta sección es para clientes.</p>
      </div>
    )
  }

  const busquedaNormalizada = busqueda.trim().toLowerCase()

  const entrenadoresFiltrados = entrenadores.filter((entrenador) => {
    if (!busquedaNormalizada) return true
    const username = (entrenador.username || '').toLowerCase()
    return username.includes(busquedaNormalizada)
  })

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate flex h-[160px] items-end overflow-hidden sm:h-[200px]">
        <img src="/imagenes/comunidad.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-6 sm:px-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Entrenadores</h1>
          <p className="mt-1 text-sm text-white/85 sm:text-base">
            Descubre entrenadores en Sevilla y Málaga y entra en su perfil.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {!error && entrenadores.length === 0 && (
          <p className="text-sm text-[#6B7355]">Todavía no hay entrenadores disponibles.</p>
        )}

        {!error && entrenadores.length > 0 && (
          <>
            <div className="mb-8 flex flex-col gap-4 rounded-xl border border-[#E2E6CF] bg-white/70 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6 sm:p-5">
              <div className="sm:w-72">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7355]">
                  Buscar
                </label>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre de usuario"
                  className={filtroCampoClass}
                />
              </div>
            </div>

            {entrenadoresFiltrados.length === 0 && (
              <RevelarAlLlegar className="flex flex-col items-center gap-3 rounded-xl border border-[#E2E6CF] bg-white px-6 py-14 text-center">
                <SearchX className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
                <p className="text-sm text-[#6B7355]">
                  No hay entrenadores que coincidan con esta búsqueda. Prueba con otro término.
                </p>
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="mt-1 inline-flex h-10 items-center justify-center rounded-full bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
                >
                  Limpiar búsqueda
                </button>
              </RevelarAlLlegar>
            )}

            {entrenadoresFiltrados.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {entrenadoresFiltrados.map((entrenador, indice) => {
                  const inicial = (entrenador.username || '?').charAt(0).toUpperCase()

                  return (
                    <RevelarAlLlegar key={entrenador.id} delayMs={Math.min(indice * 60, 240)}>
                      <Link
                        href={`/entrenador/${entrenador.username}`}
                        className="tarjeta-hover flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E6CF] bg-white shadow-sm"
                      >
                        <div className="flex flex-col items-center gap-3 p-6 text-center">
                          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#B5E600] text-2xl font-extrabold text-[#1F2400] shadow-sm">
                            {entrenador.foto_url ? (
                              <img
                                src={entrenador.foto_url}
                                alt="Foto de perfil"
                                className="h-full w-full object-cover"
                              />
                            ) : entrenador.username ? (
                              inicial
                            ) : (
                              <User className="h-8 w-8" strokeWidth={1.75} />
                            )}
                          </div>

                          <h2 className="text-lg font-bold text-[#1F2400]">@{entrenador.username}</h2>

                          <p className="line-clamp-3 text-sm text-[#6B7355]">
                            {entrenador.descripcion || 'Este entrenador aún no ha completado su perfil.'}
                          </p>
                        </div>
                      </Link>
                    </RevelarAlLlegar>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
