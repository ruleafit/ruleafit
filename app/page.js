'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Dumbbell,
  ClipboardList,
  CircleUserRound,
  CalendarCheck,
  Wallet,
  UserRoundSearch,
  Clock,
  CalendarClock,
  Tag,
  HandCoins,
  Whistle,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { claseYaPaso } from '../lib/ventanaEdicionClase'
import RevelarAlLlegar from '../components/RevelarAlLlegar'
import BotonInstalarApp from '../components/BotonInstalarApp'

// Tarjetas únicas para cualquier usuario logueado (Fase 3 de la unificación
// de roles, 11 sept 2026; retocado el mismo día a partir del feedback del
// usuario sobre la primera versión). "variante" diferencia los tres grupos
// que pidió el usuario: los dos enfocados a participar en sesiones
// ("participante"), los dos enfocados a organizarlas ("organizador"), y los
// dos que sirven para ambas cosas por igual ("ambos"). Ver
// estiloTarjetaAcceso más abajo para los colores de cada uno.
const ACCESOS = [
  { href: '/clases', label: 'Explora y reserva', Icono: Dumbbell, variante: 'participante' },
  { href: '/mis-reservas', label: 'Mis reservas', Icono: CalendarCheck, variante: 'participante' },
  { href: '/mis-clases', label: 'Mis sesiones publicadas', Icono: ClipboardList, variante: 'organizador' },
  { href: '/publicar', label: 'Publicar sesión', Icono: Whistle, variante: 'organizador' },
  { href: '/entrenadores', label: 'Ruleros', Icono: UserRoundSearch, variante: 'ambos' },
  { href: '/cuenta', label: 'Mi cuenta', Icono: CircleUserRound, variante: 'ambos' },
]

// Mismo criterio de color en toda la portada y en components/Menu.js:
// blanco con borde = participante, verde lima = organizador, fondo oscuro
// con icono lima = ambos (mismo estilo que ya usaba el bloque de captación
// "¿Eres entrenador?" más abajo, para que no sea un color inventado).
function estiloTarjetaAcceso(variante) {
  if (variante === 'organizador') {
    return { tarjeta: 'border-[#B5E600] bg-[#B5E600]', icono: 'text-white', texto: 'text-[#1F2400]' }
  }
  if (variante === 'ambos') {
    return { tarjeta: 'border-[#1F2400] bg-[#1F2400]', icono: 'text-[#B5E600]', texto: 'text-white' }
  }
  return { tarjeta: 'border-2 border-[#1F2400]/15 bg-white/95', icono: 'text-[#B5E600]', texto: 'text-[#1F2400]' }
}

const CATEGORIAS = [
  { nombre: 'Fuerza / funcional', imagen: '/imagenes/fuerza.jpg' },
  { nombre: 'Cardio', imagen: '/imagenes/running.jpg' },
  { nombre: 'Yoga / Pilates / movilidad', imagen: '/imagenes/yoga.jpg' },
  { nombre: 'Otros', imagen: '/imagenes/combate.jpg' },
]

// Unificados en una sola lista (Fase 3): antes eran dos ternas alternativas
// según rol ("como participante" / "como organizador"), ahora se muestran
// las seis juntas porque cualquiera puede ser ambas cosas.
const PUNTOS = [
  { texto: 'Sin cuota mensual', Icono: Wallet },
  { texto: 'Elige tu entrenador', Icono: UserRoundSearch },
  { texto: 'Cancela hasta 2 h antes', Icono: Clock },
  { texto: 'Tu horario, tus normas', Icono: CalendarClock },
  { texto: 'Tú fijas el precio y las plazas', Icono: Tag },
  { texto: 'Cobros y reservas automáticos', Icono: HandCoins },
]

// Solo para el bloque "¿Eres entrenador?" de captación (visible sin sesión
// iniciada, se mantiene sin cambios según lo decidido).
const PUNTOS_CAPTACION_ENTRENADOR = [
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
  const [misReservas, setMisReservas] = useState(null)
  const [cargandoMisReservas, setCargandoMisReservas] = useState(true)

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
      // entra aquí con usuario todavía sin resolver (primer render), se
      // marcaría cargandoMisClases en false prematuramente y para siempre
      // (mismo fallo de condición de carrera que hubo en
      // app/mis-clases/[id]/editar/page.js).
      if (cargandoSesion) {
        return
      }

      // Se pide para cualquier usuario logueado, ya no solo "entrenador"
      // (Fase 3 de la unificación de roles, 11 sept 2026): mis_clases() ya
      // no exige rol desde la Fase 1, y ahora cualquiera puede tener
      // sesiones publicadas.
      if (!usuario) {
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
    // Reservas propias como participante, para la franja de "Tus próximas
    // reservas" de la portada (pedido por el usuario el 11 sept 2026, junto
    // con dividir en dos la antigua franja de cifras del entrenador).
    async function cargarMisReservas() {
      if (cargandoSesion) {
        return
      }

      if (!usuario) {
        setMisReservas(null)
        setCargandoMisReservas(false)
        return
      }

      const { data, error } = await supabase
        .from('reservas')
        .select('id, estado, clases(id, titulo, fecha, hora)')
        .eq('cliente_id', usuario.id)
        .eq('estado', 'activa')
        .order('fecha', { foreignTable: 'clases', ascending: true })
        .order('hora', { foreignTable: 'clases', ascending: true })

      if (error) {
        setMisReservas(null)
      } else {
        setMisReservas(data || [])
      }
      setCargandoMisReservas(false)
    }
    cargarMisReservas()
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

  // Fase 3 de la unificación de roles (11 sept 2026): estas cifras ya no
  // dependen del rol guardado, sino de si el propio usuario tiene sesiones
  // publicadas (misClases, ahora pedido para cualquier logueado).
  const desplazamientoParallax = prefiereMenosMovimiento ? 0 : Math.min(scrollY * 0.2, 80)
  const tieneClasesPublicadas = (misClases || []).length > 0

  const clasesActivasPropias = (misClases || []).filter((c) => c.estado === 'activa')
  const clasesActivasAhora = clasesActivasPropias.filter(
    (c) => !claseYaPaso({ fecha: c.fecha, hora: c.hora })
  )

  const proximasReservasPropias = (misReservas || [])
    .filter((r) => r.clases && !claseYaPaso({ fecha: r.clases.fecha, hora: r.clases.hora }))
    .sort((a, b) => {
      const claveA = `${a.clases.fecha} ${String(a.clases.hora).slice(0, 5)}`
      const claveB = `${b.clases.fecha} ${String(b.clases.hora).slice(0, 5)}`
      return claveA < claveB ? -1 : 1
    })

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
                <span className="whitespace-nowrap">Tú eliges qué entrenar.</span>{' '}
                <span className="whitespace-nowrap text-[#B5E600]">Sin cuotas.</span>
              </h1>
              <p className="max-w-xl text-lg text-white/90 sm:text-xl">
                Sesiones sueltas o bonos en Sevilla y Málaga. Elige la de hoy, resérvala y ya está, o hazte un bono con tu
                entrenador. Sin cuota mensual ni permanencia.
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
                {ACCESOS.map(({ href, label, Icono, variante }) => {
                  const estilo = estiloTarjetaAcceso(variante)
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`tarjeta-hover flex w-[140px] flex-col items-center gap-2 rounded-xl border p-5 text-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2 sm:w-[160px] ${estilo.tarjeta}`}
                    >
                      <Icono className={`h-8 w-8 ${estilo.icono}`} strokeWidth={1.75} />
                      <span className={`text-sm font-bold ${estilo.texto}`}>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <BotonInstalarApp className={botonPrimarioClass} />

      {/* Dos franjas separadas: sesiones propias publicadas (como organizador)
          y reservas propias (como participante). Antes era un único bloque
          de "cifras" solo para quien tenía sesiones publicadas; a petición
          del usuario (11 sept 2026) ahora son dos listas simples en
          paralelo, visibles siempre que haya sesión iniciada. */}
      {usuario && !cargandoMisClases && !cargandoMisReservas && (
        <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <RevelarAlLlegar className="rounded-xl border border-[#E2E6CF] bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#1F2400]">
                <ClipboardList className="h-5 w-5 text-[#B5E600]" strokeWidth={1.75} />
                Tus próximas sesiones publicadas
              </h2>
              {clasesActivasAhora.length === 0 ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-[#6B7355]">Todavía no tienes ninguna sesión publicada próxima.</p>
                  <Link href="/publicar" className="text-sm font-semibold text-[#3D4A00] hover:underline">
                    Publicar una sesión →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[#E2E6CF]">
                  {clasesActivasAhora.slice(0, 4).map((c) => (
                    <Link
                      key={c.clase_id}
                      href={`/clases/${c.clase_id}?from=mis-clases`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:bg-[#F4F5EE]"
                    >
                      <span className="truncate font-semibold text-[#1F2400]">{c.titulo}</span>
                      <span className="shrink-0 text-xs text-[#6B7355]">
                        {c.fecha} · {String(c.hora).slice(0, 5)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </RevelarAlLlegar>

            <RevelarAlLlegar delayMs={80} className="rounded-xl border border-[#E2E6CF] bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#1F2400]">
                <CalendarCheck className="h-5 w-5 text-[#B5E600]" strokeWidth={1.75} />
                Tus próximas reservas
              </h2>
              {proximasReservasPropias.length === 0 ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-[#6B7355]">Todavía no tienes ninguna reserva próxima.</p>
                  <Link href="/clases" className="text-sm font-semibold text-[#3D4A00] hover:underline">
                    Buscar una sesión →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[#E2E6CF]">
                  {proximasReservasPropias.slice(0, 4).map((r) => (
                    <Link
                      key={r.id}
                      href={`/clases/${r.clases.id}?from=mis-reservas`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:bg-[#F4F5EE]"
                    >
                      <span className="truncate font-semibold text-[#1F2400]">{r.clases.titulo}</span>
                      <span className="shrink-0 text-xs text-[#6B7355]">
                        {r.clases.fecha} · {String(r.clases.hora).slice(0, 5)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </RevelarAlLlegar>
          </div>
        </section>
      )}

      {/* b) Franja de categorías (no se muestra a quien ya tiene sesiones propias publicadas) */}
      {!cargandoMisClases && !tieneClasesPublicadas && (
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
              {PUNTOS_CAPTACION_ENTRENADOR.map(({ texto, Icono }, indice) => (
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

      {/* c) Franja de comunidad (quien ya tiene sesiones propias ve una llamada a publicar otra, en vez de a buscar sesiones) */}
      {tieneClasesPublicadas ? (
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
              Solo, en pareja o en grupo. Tú eliges: pagas sesión a sesión o compras un bono con tu entrenador.
            </p>
            <Link href="/clases" className={botonPrimarioClass}>
              Ver sesiones
            </Link>
          </div>
        </RevelarAlLlegar>
      )}

      {/* d) Puntos con iconos (unificados, ya no cambian según rol) */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {PUNTOS.map(({ texto, Icono }, indice) => (
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
