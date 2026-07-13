'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

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
              {clase.alumnos.map((alumno) => (
                <div key={alumno.reserva_id} className="text-xs text-zinc-500">
                  <span className="text-zinc-700">{alumno.cliente_username}</span>{' '}
                  · reservó el {new Date(alumno.reservado_en).toLocaleString('es-ES')}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
