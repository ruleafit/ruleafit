'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function Menu() {
  const router = useRouter()
  const pathname = usePathname()
  const [usuario, setUsuario] = useState(null)
  const [conSombra, setConSombra] = useState(false)

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

  useEffect(() => {
    function alHacerScroll() {
      setConSombra(window.scrollY > 8)
    }
    alHacerScroll()
    window.addEventListener('scroll', alHacerScroll)
    return () => window.removeEventListener('scroll', alHacerScroll)
  }, [])

  const rol = usuario?.user_metadata?.rol

  async function handleCerrarSesion() {
    const confirmado = window.confirm('¿Estás seguro de que quieres cerrar sesión?')
    if (!confirmado) return

    await supabase.auth.signOut()
    router.push('/')
  }

  function handleClickEresEntrenador(evento) {
    const seccion = document.getElementById('entrenadores')
    if (seccion) {
      evento.preventDefault()
      const prefiereMenosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      seccion.scrollIntoView({ behavior: prefiereMenosMovimiento ? 'auto' : 'smooth' })
    }
  }

  function subrayadoClass(activo) {
    return [
      "relative inline-block after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-[2px] after:w-full after:bg-[#B5E600] after:origin-left",
      'motion-safe:after:transition-transform motion-safe:after:duration-200 motion-safe:after:ease-out',
      activo ? 'after:scale-x-100' : 'after:scale-x-0 motion-safe:hover:after:scale-x-100',
    ].join(' ')
  }

  function enlaceClass(href) {
    const activo = href != null && pathname === href
    return [
      'px-0.5 py-1 text-sm font-medium text-zinc-800 rounded-sm',
      'transition-colors hover:text-black',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2',
      subrayadoClass(activo),
    ].join(' ')
  }

  const botonClass =
    'inline-block rounded-full bg-[#B5E600] px-4 py-2 text-sm font-bold text-black ' +
    'hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.03] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2'

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b border-zinc-200 bg-white motion-safe:transition-shadow motion-safe:duration-200 ${
        conSombra ? 'shadow-sm' : ''
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className={`rounded-sm text-lg font-bold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2 ${subrayadoClass(
            pathname === '/'
          )}`}
        >
          Open<span style={{ color: '#B5E600' }}>fit</span>
        </Link>

        <div className="flex flex-wrap items-center gap-5">
          {usuario && (
            <Link href="/" className={`inline-flex items-center gap-1.5 ${enlaceClass('/')}`}>
              <Home className="h-4 w-4" strokeWidth={1.75} />
              Inicio
            </Link>
          )}

          <Link href="/clases" className={enlaceClass('/clases')}>
            Sesiones
          </Link>

          {!usuario && (
            <>
              <Link
                href="/#entrenadores"
                onClick={handleClickEresEntrenador}
                className="px-0.5 py-1 text-sm text-[#6B7355] transition-colors hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
              >
                ¿Eres entrenador?
              </Link>
              <Link href="/login" className={enlaceClass('/login')}>
                Iniciar sesión
              </Link>
              <Link href="/registro" className={botonClass}>
                Registrarse
              </Link>
            </>
          )}

          {usuario && rol === 'entrenador' && (
            <Link href="/mis-clases" className={enlaceClass('/mis-clases')}>
              Mis sesiones
            </Link>
          )}

          {usuario && rol === 'entrenador' && (
            <Link href="/publicar" className={botonClass}>
              Publicar
            </Link>
          )}

          {usuario && rol === 'cliente' && (
            <Link href="/mis-reservas" className={enlaceClass('/mis-reservas')}>
              Mis reservas
            </Link>
          )}

          {usuario && rol === 'cliente' && (
            <Link href="/entrenadores" className={enlaceClass('/entrenadores')}>
              Entrenadores
            </Link>
          )}

          {usuario && (
            <>
              <Link href="/cuenta" className={enlaceClass('/cuenta')}>
                Mi cuenta
              </Link>
              <button type="button" onClick={handleCerrarSesion} className={enlaceClass(null)}>
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
