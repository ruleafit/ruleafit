'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SearchX, Star, MessageSquareText } from 'lucide-react'
import { supabase } from '../../../../lib/supabaseClient'

const botonPrimarioClass =
  'inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]'

function escaparParaIlike(texto) {
  return String(texto).replace(/[%_\\]/g, (caracter) => '\\' + caracter)
}

function Estrellas({ cantidad }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((numero) => (
        <Star
          key={numero}
          className={`h-4 w-4 ${numero <= cantidad ? 'text-[#B5E600]' : 'text-[#E2E6CF]'}`}
          fill={numero <= cantidad ? 'currentColor' : 'none'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

export default function OpinionesEntrenadorPage() {
  const { username } = useParams()
  const [perfil, setPerfil] = useState(null)
  const [opiniones, setOpiniones] = useState([])
  const [promedioEstrellas, setPromedioEstrellas] = useState(null)
  const [totalValoraciones, setTotalValoraciones] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)

  useEffect(() => {
    async function cargarOpiniones() {
      if (!username) return

      const { data: perfilData, error } = await supabase
        .from('perfiles')
        .select('id, username, descripcion, foto_url')
        .ilike('username', escaparParaIlike(username))
        .maybeSingle()

      if (error || !perfilData) {
        setNoEncontrado(true)
        setCargando(false)
        return
      }

      setPerfil(perfilData)

      const { data: valoracionesData } = await supabase
        .from('valoraciones')
        .select('estrellas')
        .eq('entrenador_id', perfilData.id)

      const lista = valoracionesData || []
      setTotalValoraciones(lista.length)
      setPromedioEstrellas(
        lista.length > 0 ? lista.reduce((suma, v) => suma + v.estrellas, 0) / lista.length : null
      )

      const { data: opinionesData } = await supabase
        .from('valoraciones')
        .select('id, estrellas, opinion, created_at')
        .eq('entrenador_id', perfilData.id)
        .not('opinion', 'is', null)
        .order('created_at', { ascending: false })

      setOpiniones(opinionesData || [])

      setCargando(false)
    }
    cargarOpiniones()
  }, [username])

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (noEncontrado) {
    return (
      <div className="flex min-h-[70vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <SearchX className="h-12 w-12 text-[#B5E600]" strokeWidth={1.75} />
        <p className="text-sm text-[#6B7355]">Rulero no encontrado.</p>
        <Link href="/clases" className={botonPrimarioClass}>
          Volver a sesiones
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-col items-center gap-3 bg-[#FBFAF3] px-4 pb-10 pt-14 text-center sm:pt-16">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1F2400] sm:text-3xl">
          Opiniones de @{perfil.username}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-1.5">
            <Star className="h-5 w-5 text-[#B5E600]" fill="#B5E600" strokeWidth={1.5} />
            <span className="text-lg font-bold text-[#1F2400]">
              {promedioEstrellas !== null ? promedioEstrellas.toFixed(1).replace('.', ',') : '—'}
            </span>
          </div>
          <span className="text-sm text-[#6B7355]">
            {totalValoraciones === 0
              ? 'Sin valoraciones todavía'
              : totalValoraciones === 1
                ? '(1 valoración)'
                : `(${totalValoraciones} valoraciones)`}
          </span>
        </div>

        <Link
          href={`/entrenador/${username}`}
          className="text-sm font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
        >
          Volver al perfil
        </Link>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        {opiniones.length === 0 ? (
          <div className="flex flex-col items-center gap-3 corte-card border border-dashed border-[#E2E6CF] px-6 py-12 text-center">
            <MessageSquareText className="h-8 w-8 text-[#B5E600]" strokeWidth={1.75} />
            <p className="text-sm text-[#6B7355]">Este rulero aún no tiene opiniones escritas.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {opiniones.map((opinion) => (
              <div key={opinion.id} className="corte-card border border-[#E2E6CF] bg-white p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Estrellas cantidad={opinion.estrellas} />
                  <span className="text-xs text-[#6B7355]">
                    {new Date(opinion.created_at).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-[#1F2400]">{opinion.opinion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
