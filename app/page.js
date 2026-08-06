'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Dumbbell,
  Users,
  ClipboardList,
  CircleUserRound,
  CalendarCheck,
  Wallet,
  UserRoundSearch,
  Clock,
  CalendarClock,
  Tag,
  HandCoins,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { claseYaPaso } from '../lib/ventanaEdicionClase'
import RevelarAlLlegar from '../components/RevelarAlLlegar'
import BotonInstalarApp from '../components/BotonInstalarApp'

const ACCESOS_ENTRENADOR = [
  { href: '/clases', label: 'Sesiones publicadas', Icono: Dumbbell },
  { href: '/mis-clases', label: 'Mis sesiones', Icono: Users },
  { href: '/publicar', label: 'Publicar', Icono: ClipboardList },
  { href: '/cuenta', label: 'Mi cuenta', Icono: CircleUserRound },
]

const ACCESOS_CLIENTE = [
  { href: '/clases', label: 'Busca tu sesión', Icono: Dumbbell },
  { href: '/mis-reservas', label: 'Mis reservas', Icono: CalendarCheck },
  { href: '/entrenadores', label: 'Entrenadores', Icono: UserRoundSearch },
  { href: '/cuenta', label: 'Mi cuenta', Icono: CircleUserRound },
]

const CATEGORIAS = [
  { nombre: 'Fuerza / funcional', imagen: '/imagenes/fuerza.jpg' },
  { nombre: 'Cardio', imagen: '/imagenes/running.jpg' },
  { nombre: 'Yoga / Pilates / movilidad', imagen: '/imagenes/yoga.jpg' },
  { nombre: 'Otros', imagen: '/imagenes/combate.jpg' },
]

const PUNTOS = [
  { texto: 'Sin cuota mensual', Icono: Wallet },
  { texto: 'Elige tu entrenador', Icono: UserRoundSearch },
  { texto: 'Cancela hasta 2 h antes', Icono: Clock },
]

const PUNTOS_ENTRENADOR = [
  { texto: 'Tu horario, tus normas', Icono: CalendarClock },
  { texto: 'Tú fijas el precio y las plazas', Icono: Tag },
  { texto: 'Cobros y reservas automáticos', Icono: HandCoins },
]

const botonPrimarioClass =
  'inline-flex h-12 items-center justify-center rounded-full bg-[#B5E600] px-8 text-base font-bold text-[#1F2400] shadow-sm transition motion-safe:hover:-translate-y-0.5 hover:bg-[#a3d100] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40'

const botonSecundarioClass =
  'inline-flex h-12 items-center justify-center rounded-full border-2 border-white px-8 text-base font-bold text-white transition motion-safe:hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40'

export default function Home() {
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [username, setUsername] = useState(null)
  const [scrollY, setScrollY] = useState(0)
  const [prefiereMenosMovimiento, setPrefiereMenosMovimiento] = useState(false)
  const [misClases, setMisClases] = useState(null)
  const [cargandoMisClases, setCargandoMisClases] = useState(true)

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

  useEffect(() => {
    async function cargarMisClases() {
      // Espera a que la sesión esté resuelta antes de decidir nada: si se
      // entra aquí con usuario todavía sin resolver (primer render),
      // esEntrenador daría "false" y se marcaría cargandoMisClases en false
      // prematuramente y para siempre (mismo fallo de condición de carrera
      // que hubo en app/mis-clases/[id]/editar/page.js).
      if (cargandoSesion) {
        return
      }

      const esEntrenadorActual = usuario?.user_metadata?.rol === 'entrenador'

      if (!usuario || !esEntrenadorActual) {
        setMisClases(null)
        setCargandoMisClases(false)
        return
      }

      const { data, error } = await supabase.rpc('mis_clases')

      if (error) {
        setMisClases(null)
      } else {
        setMisClases(data || [])
      }
      setCargandoMisClases(false)
    }
    cargarMisClases()
  }, [usuario, cargandoSesion])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefiereMenosMovimiento(media.matches)

    if (media.matches) return

    let frame = null
    function alHacerScroll() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        setScrollY(window.scrollY)
        frame = null
      })
    }
    window.addEventListener('scroll', alHacerScroll)
    return () => window.removeEventListener('scroll', alHacerScroll)
  }, [])

  if (cargandoSesion) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  const rol = usuario?.user_metadata?.rol
  const esEntrenador = rol === 'entrenador'
  const accesos = esEntrenador ? ACCESOS_ENTRENADOR : ACCESOS_CLIENTE
  const desplazamientoParallax = prefiereMenosMovimiento ? 0 : Math.min(scrollY * 0.2, 80)
  const puntosMostrados = esEntrenador ? PUNTOS_ENTRENADOR : PUNTOS

  const clasesActivasEntrenador = esEntrenador ? (misClases || []).filter((c) => c.estado === 'activa') : []
  const totalReservasEntrenador = clasesActivasEntrenador.reduce(
    (total, c) => total + Number(c.reservas_activas || 0),
    0
  )
  const clasesActivasAhora = esEntrenador
    ? (misClases || []).filter((c) => c.estado === 'activa' && !claseYaPaso({ fecha: c.fecha, hora: c.hora }))
    : []
  const proximaClaseEntrenador =
    clasesActivasEntrenador.filter((c) => !claseYaPaso({ fecha: c.fecha, hora: c.hora }))[0] || null
  const sinClasesPublicadas = esEntrenador && (misClases || []).length === 0

  return (
    <div className="flex flex-1 flex-col">
      {/* a) Sección principal */}
      <section
        className={`relative isolate flex w-full items-center justify-center overflow-hidden ${
          usuario ? 'min-h-[45vh]' : 'min-h-[85vh]'
        }`}
      >
        <div className="absolute -inset-x-0 -top-20 -bottom-20 -z-20 overflow-hidden">
          <div
            className="h-full w-full bg-cover bg-center"
            style={{
              backgroundImage: 'url(/imagenes/portada.jpg)',
              transform: `translateY(${desplazamientoParallax}px)`,
            }}
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/40 to-black/75" />

        <div
          className={`relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center ${
            usuario ? 'py-14 sm:py-16' : 'py-24'
          }`}
        >
          {!usuario && (
            <>
              <h1 className="flex flex-col gap-1 text-2xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                <span className="whitespace-nowrap">Tú eliges qué entrenar.</span>
                <span className="whitespace-nowrap text-[#B5E600]">Sin cuotas.</span>
              </h1>
              <p className="max-w-xl text-lg text-white/90 sm:text-xl">
                Sesiones sueltas en Sevilla y Málaga. Elige la de hoy, resérvala y ya está. Sin cuota mensual ni permanencia.
              </p>

              <div className="mt-2 flex flex-col gap-4 sm:flex-row">
                <Link href="/registro" className={botonPrimarioClass}>
                  Crear cuenta
                </Link>
                <Link href="/login" className={botonSecundarioClass}>
                  Iniciar sesión
                </Link>
              </div>
            </>
          )}

          {usuario && (
            <div className="mt-2 flex w-full flex-col items-center gap-6">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Hola, {username || 'usuario'}
                </h1>
                <p className="text-base text-white/85 sm:text-lg">¿Qué entrenas hoy?</p>
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                {accesos.map(({ href, label, Icono }) => (
                  <Link
                    key={href}
                    href={href}
                    className="tarjeta-hover flex w-[140px] flex-col items-center gap-2 rounded-xl border border-[#E2E6CF] bg-white/95 p-5 text-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2 sm:w-[160px]"
                  >
                    <Icono className="h-8 w-8 text-[#B5E600]" strokeWidth={1.75} />
                    <span className="text-sm font-bold text-[#1F2400]">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <BotonInstalarApp className={botonPrimarioClass} />

      {/* Cifras del entrenador (solo con sesión de entrenador) */}
      {esEntrenador && !cargandoMisClases && (
        <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
          {sinClasesPublicadas ? (
            <RevelarAlLlegar className="flex flex-col items-center gap-4 rounded-xl border border-[#E2E6CF] bg-white px-6 py-14 text-center shadow-sm">
              <ClipboardList className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
              <p className="text-base font-bold text-[#1F2400]">Todavía no has publicado ninguna sesión</p>
              <p className="max-w-md text-sm text-[#6B7355]">
                Publica tu primera sesión y empieza a recibir reservas.
              </p>
              <Link href="/publicar" className={botonPrimarioClass}>
                Publicar mi primera sesión
              </Link>
            </RevelarAlLlegar>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <RevelarAlLlegar className="rounded-xl border border-[#E2E6CF] bg-white p-6 text-center shadow-sm">
                <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">
                  {clasesActivasAhora.length}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6B7355]">Sesiones activas</p>
              </RevelarAlLlegar>

              <RevelarAlLlegar delayMs={80} className="rounded-xl border border-[#E2E6CF] bg-white p-6 text-center shadow-sm">
                <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{totalReservasEntrenador}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6B7355]">
                  Reservas acumuladas
                </p>
              </RevelarAlLlegar>

              <RevelarAlLlegar delayMs={160} className="rounded-xl border border-[#E2E6CF] bg-white p-6 text-center shadow-sm">
                {proximaClaseEntrenador ? (
                  <>
                    <p className="truncate text-lg font-extrabold tracking-tight text-[#1F2400]">
                      {proximaClaseEntrenador.titulo}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6B7355]">
                      Próxima sesión · {proximaClaseEntrenador.fecha}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-extrabold tracking-tight text-[#1F2400]">—</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6B7355]">
                      Sin sesiones próximas
                    </p>
                  </>
                )}
              </RevelarAlLlegar>
            </div>
          )}
        </section>
      )}

      {/* b) Franja de categorías (no se muestra al entrenador con sesión) */}
      {!esEntrenador && (
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
          <RevelarAlLlegar as="h2" className="mb-10 text-2xl font-bold tracking-tight text-[#1F2400] sm:text-3xl">
            Encuentra tu entrenamiento
          </RevelarAlLlegar>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIAS.map(({ nombre, imagen }, indice) => (
              <RevelarAlLlegar key={nombre} delayMs={indice * 100}>
                <Link
                  href="/clases"
                  className="zoom-imagen tarjeta-hover group relative isolate flex h-56 items-end rounded-xl shadow-sm sm:h-64"
                >
                  <img src={imagen} alt="" className="absolute inset-0 -z-10 h-full w-full rounded-xl object-cover" />
                  <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className="relative z-10 p-5 text-lg font-bold text-white">{nombre}</span>
                </Link>
              </RevelarAlLlegar>
            ))}
          </div>
        </section>
      )}

      {/* Captación de entrenadores (solo visible sin sesión) */}
      {!usuario && (
        <RevelarAlLlegar
          as="section"
          id="entrenadores"
          className="w-full bg-[#1A1F00] px-6 py-16 sm:py-24"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-[#B5E600] sm:text-base">
              ¿Eres entrenador?
            </p>
            <h2 className="whitespace-nowrap text-xl font-extrabold tracking-tight text-white sm:text-4xl">
              <span className="text-[#B5E600]">Tú</span> pones las reglas.
            </h2>
            <p className="max-w-xl text-base text-white/85 sm:text-lg">
              Decides qué días trabajas, a qué hora, cuánta gente entra y cuánto cobras. Sin horario fijo, sin jefe.
              Publicas tu sesión en dos minutos y cobras directamente a tus alumnos.
            </p>

            <div className="mt-4 grid w-full grid-cols-1 gap-8 sm:grid-cols-3">
              {PUNTOS_ENTRENADOR.map(({ texto, Icono }, indice) => (
                <RevelarAlLlegar
                  key={texto}
                  delayMs={indice * 100}
                  className="flex flex-col items-center gap-3 text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                    <Icono className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
                  </div>
                  <p className="text-sm font-semibold text-white">{texto}</p>
                </RevelarAlLlegar>
              ))}
            </div>

            <Link href="/registro" className={`${botonPrimarioClass} mt-4`}>
              Publica tu primera sesión
            </Link>
          </div>
        </RevelarAlLlegar>
      )}

      {/* c) Franja de comunidad (entrenador ve una llamada a publicar en su lugar) */}
      {esEntrenador ? (
        <RevelarAlLlegar as="section" className="relative isolate flex min-h-[50vh] items-center justify-center overflow-hidden px-6 py-20 text-center">
          <img
            src="/imagenes/fuerza.jpg"
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-black/60" />
          <div className="flex flex-col items-center gap-6">
            <p className="max-w-xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
              ¿Tienes hueco esta semana? Publica una sesión más.
            </p>
            <Link href="/publicar" className={botonPrimarioClass}>
              Publicar sesión
            </Link>
          </div>
        </RevelarAlLlegar>
      ) : (
        <RevelarAlLlegar as="section" className="relative isolate flex min-h-[50vh] items-center justify-center overflow-hidden px-6 py-20 text-center">
          <img
            src="/imagenes/comunidad.jpg"
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-black/60" />
          <div className="flex flex-col items-center gap-6">
            <p className="max-w-xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Solo, en pareja o en grupo. Pagas solo la sesión a la que vas.
            </p>
            <Link href="/clases" className={botonPrimarioClass}>
              Ver sesiones
            </Link>
          </div>
        </RevelarAlLlegar>
      )}

      {/* d) Tres puntos con iconos (mensajes según rol) */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {puntosMostrados.map(({ texto, Icono }, indice) => (
            <RevelarAlLlegar key={texto} delayMs={indice * 100} className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EDF5C9]">
                <Icono className="h-8 w-8 text-[#B5E600]" strokeWidth={1.75} />
              </div>
              <p className="text-base font-semibold text-[#1F2400]">{texto}</p>
            </RevelarAlLlegar>
          ))}
        </div>
      </section>
    </div>
  )
}
