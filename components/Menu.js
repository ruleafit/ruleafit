'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Menu as IconoMenu, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import CampanaNotificaciones from './CampanaNotificaciones'
import AvisoActivarNotificaciones from './AvisoActivarNotificaciones'

export default function Menu() {
  const router = useRouter()
  const pathname = usePathname()
  const [usuario, setUsuario] = useState(null)
  const [conSombra, setConSombra] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [disparadorAviso, setDisparadorAviso] = useState(0)

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

  useEffect(() => {
    function alPrimeraAccion() {
      setDisparadorAviso((n) => n + 1)
    }
    window.addEventListener('primera-accion', alPrimeraAccion)
    return () => window.removeEventListener('primera-accion', alPrimeraAccion)
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

  // Lista de enlaces calculada una sola vez a partir de usuario/rol, para no
  // repetir las condiciones entre la versión de escritorio y la de móvil.
  const enlaces = []

  if (usuario) {
    enlaces.push({ key: 'inicio', href: '/', label: 'Inicio', icon: Home })
  }

  const labelSesiones = !usuario
    ? 'Descubre sesiones'
    : rol === 'entrenador'
      ? 'Sesiones publicadas'
      : rol === 'cliente'
        ? 'Busca tu sesión'
        : 'Sesiones'

  enlaces.push({ key: 'sesiones', href: '/clases', label: labelSesiones })

  if (!usuario) {
    enlaces.push({
      key: 'eres-entrenador',
      href: '/#entrenadores',
      label: '¿Eres entrenador?',
      onClick: handleClickEresEntrenador,
      mutado: true,
    })
    enlaces.push({ key: 'login', href: '/login', label: 'Iniciar sesión' })
    enlaces.push({ key: 'registro', href: '/registro', label: 'Registrarse', esBoton: true })
  }

  if (usuario && rol === 'entrenador') {
    enlaces.push({ key: 'mis-clases', href: '/mis-clases', label: 'Mis sesiones' })
    enlaces.push({ key: 'publicar', href: '/publicar', label: 'Publicar', esBoton: true })
  }

  if (usuario && rol === 'cliente') {
    enlaces.push({ key: 'mis-reservas', href: '/mis-reservas', label: 'Mis reservas' })
    enlaces.push({ key: 'entrenadores', href: '/entrenadores', label: 'Entrenadores' })
  }

  if (usuario) {
    enlaces.push({ key: 'cuenta', href: '/cuenta', label: 'Mi cuenta' })
  }

  function renderEnlaceEscritorio(enlace) {
    if (enlace.esBoton) {
      return (
        <Link key={enlace.key} href={enlace.href} className={botonClass}>
          {enlace.label}
        </Link>
      )
    }

    if (enlace.mutado) {
      return (
        <Link
          key={enlace.key}
          href={enlace.href}
          onClick={enlace.onClick}
          className="px-0.5 py-1 text-sm text-[#6B7355] transition-colors hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
        >
          {enlace.label}
        </Link>
      )
    }

    const Icono = enlace.icon

    return (
      <Link
        key={enlace.key}
        href={enlace.href}
        className={Icono ? `inline-flex items-center gap-1.5 ${enlaceClass(enlace.href)}` : enlaceClass(enlace.href)}
      >
        {Icono && <Icono className="h-4 w-4" strokeWidth={1.75} />}
        {enlace.label}
      </Link>
    )
  }

  function renderEnlaceMovil(enlace) {
    const Icono = enlace.icon
    const activo = pathname === enlace.href

    const claseEnlaceMovil = [
      'flex items-center gap-2 rounded-lg px-3 py-3 text-base font-medium transition-colors',
      enlace.esBoton
        ? 'bg-[#B5E600] font-bold text-[#16231B] hover:bg-[#a3d100]'
        : enlace.mutado
          ? 'text-[#6B7355] hover:bg-zinc-50'
          : activo
            ? 'bg-[#EDF5C9] text-[#16231B]'
            : 'text-[#16231B] hover:bg-zinc-50',
    ].join(' ')

    return (
      <Link
        key={enlace.key}
        href={enlace.href}
        onClick={(evento) => {
          if (enlace.onClick) enlace.onClick(evento)
          setMenuAbierto(false)
        }}
        className={claseEnlaceMovil}
      >
        {Icono && <Icono className="h-5 w-5" strokeWidth={1.75} />}
        {enlace.label}
      </Link>
    )
  }

  return (
    <>
    <nav
      className={`sticky top-0 z-[2000] w-full border-b border-zinc-200 bg-white motion-safe:transition-shadow motion-safe:duration-200 ${
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
          Rulea<span style={{ color: '#B5E600' }}>fit</span>
        </Link>

        <div className="hidden items-center gap-5 md:flex">
          {enlaces.map(renderEnlaceEscritorio)}

          {usuario && (
            <button type="button" onClick={handleCerrarSesion} className={enlaceClass(null)}>
              Cerrar sesión
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {usuario && <CampanaNotificaciones usuarioActual={usuario} />}
          <button
            type="button"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
            className="inline-flex items-center gap-2 rounded-full bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#16231B] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2 md:hidden"
          >
            {menuAbierto ? (
              <>
                <X className="h-5 w-5" strokeWidth={1.75} />
                Cerrar
              </>
            ) : (
              <>
                <IconoMenu className="h-5 w-5" strokeWidth={1.75} />
                Menú
              </>
            )}
          </button>
        </div>
      </div>

      {menuAbierto && (
        <div className="border-t border-zinc-200 bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {enlaces.map(renderEnlaceMovil)}

            {usuario && (
              <button
                type="button"
                onClick={async () => {
                  await handleCerrarSesion()
                  setMenuAbierto(false)
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-3 text-left text-base font-medium text-[#16231B] transition-colors hover:bg-zinc-50"
              >
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      )}
    </nav>

    {usuario && (
      <AvisoActivarNotificaciones usuarioActual={usuario} disparador={disparadorAviso} />
    )}
    </>
  )
}
