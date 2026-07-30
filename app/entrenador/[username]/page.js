'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { claseYaPaso } from '../../../lib/ventanaEdicionClase'

const botonPrimarioClass =
  'inline-flex h-10 items-center justify-center rounded-full bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]'

function escaparParaIlike(texto) {
  return String(texto).replace(/[%_\\]/g, (caracter) => '\\' + caracter)
}

export default function PerfilEntrenadorPage() {
  const { username } = useParams()
  const [perfil, setPerfil] = useState(null)
  const [clasesActivas, setClasesActivas] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)

  useEffect(() => {
    async function cargarPerfil() {
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

      const { data: clasesData } = await supabase
        .from('clases')
        .select('fecha, hora')
        .eq('trainer_id', perfilData.id)
        .eq('estado', 'activa')

      const activas = (clasesData || []).filter((clase) => !claseYaPaso(clase)).length
      setClasesActivas(activas)

      setCargando(false)
    }
    cargarPerfil()
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
        <p className="text-sm text-[#6B7355]">Entrenador no encontrado.</p>
        <Link href="/clases" className={botonPrimarioClass}>
          Volver a clases
        </Link>
      </div>
    )
  }

  const inicial = (perfil.username || '?').charAt(0).toUpperCase()

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-col items-center gap-3 bg-[#FBFAF3] px-4 pb-10 pt-14 text-center sm:pt-16">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#B5E600] text-3xl font-extrabold text-[#1F2400] shadow-sm">
          {perfil.foto_url ? (
            <img src={perfil.foto_url} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            inicial
          )}
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-[#1F2400] sm:text-3xl">
          @{perfil.username}
        </h1>

        <span className="inline-flex items-center rounded-full bg-[#EDF5C9] px-4 py-1.5 text-sm font-semibold text-[#3D4A00]">
          {clasesActivas} {clasesActivas === 1 ? 'clase activa' : 'clases activas'}
        </span>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-[#E2E6CF] bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">Sobre mí</h2>
          <p className="text-sm text-[#1F2400]">
            {perfil.descripcion || 'Este entrenador aún no ha completado su perfil.'}
          </p>
        </div>

        {/* TODO: valoraciones (estrellas + opiniones) */}

        <div className="mt-8 text-center">
          <Link
            href="/clases"
            className="text-sm font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
          >
            Ver todas las clases
          </Link>
        </div>
      </div>
    </div>
  )
}
