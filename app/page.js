'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Dumbbell, Users, ClipboardList, CircleUserRound, CalendarCheck, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const ACCESOS_ENTRENADOR = [
  { href: '/clases', label: 'Clases', Icono: Dumbbell },
  { href: '/mis-alumnos', label: 'Mis alumnos', Icono: Users },
  { href: '/publicar', label: 'Publicar', Icono: ClipboardList },
  { href: '/cuenta', label: 'Mi cuenta', Icono: CircleUserRound },
]

const ACCESOS_CLIENTE = [
  { href: '/clases', label: 'Clases', Icono: Dumbbell },
  { href: '/mis-reservas', label: 'Mis reservas', Icono: CalendarCheck },
  { href: '/cuenta', label: 'Mi cuenta', Icono: CircleUserRound },
]

export default function Home() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [username, setUsername] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user || null)
      setCargandoSesion(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user || null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    async function cargarUsername() {
      if (!usuario) {
        setUsername(null)
        return
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('username')
        .eq('id', usuario.id)
        .single()

      setUsername(perfil?.username || null)
    }
    cargarUsername()
  }, [usuario])

  async function handleCerrarSesion() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (cargandoSesion) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  if (!usuario) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-8 py-32 px-16 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-black dark:text-zinc-50">
            Openfit
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Entrena al aire libre, sin gimnasio ni cuota
          </p>
          <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-6 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a] sm:w-auto"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="flex h-12 w-full items-center justify-center rounded-full bg-[#B5E600] px-6 font-bold text-black transition-colors hover:bg-[#a3d100] sm:w-auto"
            >
              Crear cuenta
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const rol = usuario.user_metadata?.rol
  const accesos = rol === 'entrenador' ? ACCESOS_ENTRENADOR : ACCESOS_CLIENTE

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold text-black sm:text-3xl">
        Hola, {username || 'usuario'}
      </h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {accesos.map(({ href, label, Icono }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-200 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out hover:shadow-md motion-safe:hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
          >
            <Icono className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
            <span className="text-base font-bold text-black">{label}</span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCerrarSesion}
        className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
        Cerrar sesión
      </button>
    </div>
  )
}
