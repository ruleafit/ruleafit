'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const ETIQUETAS_ASISTENCIA = {
  pendiente: 'Pendiente',
  asistio: 'Asistió',
  no_asistio: 'No asistió',
}

const COLOR_ASISTENCIA = {
  pendiente: 'text-zinc-500',
  asistio: 'text-green-600',
  no_asistio: 'text-red-700',
}

function obtenerAhoraMadridComoTexto() {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const partes = formateador.formatToParts(new Date())
  const obtener = (tipo) => partes.find((p) => p.type === tipo)?.value
  return `${obtener('year')}-${obtener('month')}-${obtener('day')} ${obtener('hour')}:${obtener('minute')}`
}

function claseYaPaso(clase) {
  if (!clase.clase_fecha || !clase.clase_hora) return false
  const horaCorta = String(clase.clase_hora).slice(0, 5)
  const inicioClase = `${clase.clase_fecha} ${horaCorta}`
  return inicioClase < obtenerAhoraMadridComoTexto()
}

function agruparPorClase(filas) {
  const clases = []
  const indicePorClaseId = new Map()

  for (const fila of filas) {
    let grupo = indicePorClaseId.get(fila.clase_id)
    if (!grupo) {
      grupo = {
        clase_id: fila.clase_id,
        clase_titulo: fila.clase_titulo,
        clase_fecha: fila.clase_fecha,
        clase_hora: fila.clase_hora,
        plazas_max: fila.plazas_max,
        plazas_ocupadas: fila.plazas_ocupadas,
        alumnos: [],
      }
      indicePorClaseId.set(fila.clase_id, grupo)
      clases.push(grupo)
    }
    grupo.alumnos.push({
      reserva_id: fila.reserva_id,
      cliente_username: fila.cliente_username,
      reservado_en: fila.reservado_en,
      asistencia: fila.asistencia,
    })
  }

  return clases
}

export default function MisAlumnosPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [clasesConAlumnos, setClasesConAlumnos] = useState([])
  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [error, setError] = useState('')
  const [procesandoAsistenciaId, setProcesandoAsistenciaId] = useState(null)
  const [erroresAsistencia, setErroresAsistencia] = useState({})

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

  const esEntrenador = usuario?.user_metadata?.rol === 'entrenador'

  useEffect(() => {
    async function cargarAlumnos() {
      if (!usuario || !esEntrenador) {
        setCargandoDatos(false)
        return
      }

      const { data, error } = await supabase.rpc('reservas_de_mis_clases')

      if (error) {
        setError(error.message)
      } else {
        setClasesConAlumnos(agruparPorClase(data || []))
      }
      setCargandoDatos(false)
    }
    cargarAlumnos()
  }, [usuario, esEntrenador])

  async function handleMarcarAsistencia(reservaId, asistio) {
    setProcesandoAsistenciaId(reservaId)
    setErroresAsistencia((prev) => {
      const siguiente = { ...prev }
      delete siguiente[reservaId]
      return siguiente
    })

    const { error } = await supabase.rpc('marcar_asistencia', {
      p_reserva_id: reservaId,
      p_asistio: asistio,
    })

    if (error) {
      setErroresAsistencia((prev) => ({ ...prev, [reservaId]: error.message }))
      setProcesandoAsistenciaId(null)
      return
    }

    setClasesConAlumnos((prev) =>
      prev.map((clase) => ({
        ...clase,
        alumnos: clase.alumnos.map((alumno) =>
          alumno.reserva_id === reservaId
            ? { ...alumno, asistencia: asistio ? 'asistio' : 'no_asistio' }
            : alumno
        ),
      }))
    )
    setProcesandoAsistenciaId(null)
  }

  if (cargandoSesion) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  if (!esEntrenador) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="mb-8 text-2xl font-bold text-black sm:text-3xl">Mis alumnos</h1>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
          Esta página es solo para entrenadores. Ve a{' '}
          <Link href="/clases" className="font-semibold text-[#7a9900] hover:underline">
            ver las clases disponibles
          </Link>
          .
        </div>
      </div>
    )
  }

  if (cargandoDatos) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold text-black sm:text-3xl">Mis alumnos</h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!error && clasesConAlumnos.length === 0 && (
        <p className="text-sm text-zinc-500">
          Todavía nadie se ha apuntado a ninguna de tus clases. Ve a{' '}
          <Link href="/clases" className="font-semibold text-[#7a9900] hover:underline">
            ver las clases disponibles
          </Link>
          .
        </p>
      )}

      <div className="flex flex-col gap-4">
        {clasesConAlumnos.map((clase) => (
          <div
            key={clase.clase_id}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-md"
          >
            <h2 className="mb-1 text-lg font-bold text-black sm:text-xl">{clase.clase_titulo}</h2>

            <div className="flex flex-col gap-1 text-sm text-zinc-500">
              <p>
                Fecha: <span className="text-zinc-700">{clase.clase_fecha}</span> · Hora:{' '}
                <span className="text-zinc-700">{clase.clase_hora}</span>
              </p>
              <p>
                <span className="text-zinc-700">
                  {clase.plazas_ocupadas}/{clase.plazas_max}
                </span>{' '}
                plazas ocupadas
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-3">
              {clase.alumnos.map((alumno) => {
                const haPasado = claseYaPaso(clase)
                const procesando = procesandoAsistenciaId === alumno.reserva_id

                return (
                  <div
                    key={alumno.reserva_id}
                    className="flex flex-col gap-1 border-b border-zinc-100 pb-2 text-xs last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-zinc-500">
                        <span className="text-zinc-700">{alumno.cliente_username}</span>{' '}
                        · reservó el {new Date(alumno.reservado_en).toLocaleString('es-ES')}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${COLOR_ASISTENCIA[alumno.asistencia]}`}>
                          {ETIQUETAS_ASISTENCIA[alumno.asistencia]}
                        </span>

                        {haPasado && alumno.asistencia === 'pendiente' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleMarcarAsistencia(alumno.reserva_id, true)}
                              disabled={procesando}
                              className="rounded-md border border-green-200 px-2 py-0.5 text-[11px] font-medium text-green-700 motion-safe:transition-colors motion-safe:duration-200 hover:border-green-300 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {procesando ? '...' : 'Asistió'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarcarAsistencia(alumno.reserva_id, false)}
                              disabled={procesando}
                              className="rounded-md border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 motion-safe:transition-colors motion-safe:duration-200 hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {procesando ? '...' : 'No asistió'}
                            </button>
                          </>
                        )}

                        {alumno.asistencia !== 'pendiente' && (
                          <button
                            type="button"
                            onClick={() => handleMarcarAsistencia(alumno.reserva_id, alumno.asistencia !== 'asistio')}
                            disabled={procesando}
                            className="text-[11px] font-medium text-zinc-400 underline motion-safe:transition-colors motion-safe:duration-200 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {procesando ? 'Corrigiendo...' : 'Corregir'}
                          </button>
                        )}
                      </div>
                    </div>

                    {erroresAsistencia[alumno.reserva_id] && (
                      <p className="text-red-600">{erroresAsistencia[alumno.reserva_id]}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
