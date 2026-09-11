'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

const TAMANOS_BOTON = {
  normal: 'px-4 py-2 text-sm',
  grande: 'px-6 py-3 text-base',
}

function botonReservarClass(tamaño) {
  return (
    `inline-flex items-center justify-center rounded-full bg-[#B5E600] font-bold text-black ${TAMANOS_BOTON[tamaño]} ` +
    'hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.03] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ' +
    'disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100'
  )
}

function botonCompletaClass(tamaño) {
  return `inline-flex cursor-not-allowed items-center justify-center rounded-full bg-zinc-200 font-bold text-zinc-500 ${TAMANOS_BOTON[tamaño]}`
}

const enlaceLoginClass = 'text-sm font-semibold text-[#7a9900] hover:underline'

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
  if (!clase.fecha || !clase.hora) return false
  const horaCorta = String(clase.hora).slice(0, 5)
  const inicioClase = `${clase.fecha} ${horaCorta}`
  return inicioClase < obtenerAhoraMadridComoTexto()
}

export default function BotonReservar({ clase, onReservado, tamaño = 'normal' }) {
  const [usuario, setUsuario] = useState(null)
  const [yaReservada, setYaReservada] = useState(false)
  const [comprobandoReserva, setComprobandoReserva] = useState(true)
  const [reservando, setReservando] = useState(false)
  const [errorReserva, setErrorReserva] = useState('')

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

  // Ya no depende del rol guardado (Fase 5 de la unificación de roles, 11
  // sept 2026): cualquier usuario puede organizar unas sesiones y
  // participar en otras, así que lo relevante es si ESTA sesión concreta
  // es suya como organizador, no un rol fijo en su perfil.
  const esMiPropiaSesion = !!(usuario && clase.trainer_id === usuario.id)

  useEffect(() => {
    let cancelado = false

    async function comprobarReservaActiva() {
      if (!usuario || esMiPropiaSesion) {
        setYaReservada(false)
        setComprobandoReserva(false)
        return
      }

      setComprobandoReserva(true)

      const { data } = await supabase
        .from('reservas')
        .select('id')
        .eq('clase_id', clase.id)
        .eq('cliente_id', usuario.id)
        .eq('estado', 'activa')
        .maybeSingle()

      if (!cancelado) {
        setYaReservada(!!data)
        setComprobandoReserva(false)
      }
    }

    comprobarReservaActiva()

    return () => {
      cancelado = true
    }
  }, [usuario, esMiPropiaSesion, clase.id])

  async function handleReservar() {
    setReservando(true)
    setErrorReserva('')

    const { data, error } = await supabase.rpc('reservar_clase', { p_clase_id: clase.id })

    if (error) {
      setErrorReserva(error.message)
      setReservando(false)
      return
    }

    setYaReservada(true)
    setReservando(false)

    if (onReservado) {
      const nuevasPlazasOcupadas = data?.plazas_ocupadas ?? (clase.plazas_ocupadas ?? 0) + 1
      onReservado(nuevasPlazasOcupadas)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('primera-accion'))
    }
  }

  if (!usuario) {
    return (
      <Link href="/login" className={enlaceLoginClass}>
        Inicia sesión para reservar
      </Link>
    )
  }

  if (esMiPropiaSesion) {
    return <p className="text-sm text-zinc-500">Esta es tu propia sesión</p>
  }

  if (clase.estado !== 'activa' || claseYaPaso(clase)) {
    return <p className="text-sm text-zinc-500">Esta sesión ya no está disponible</p>
  }

  if ((clase.plazas_ocupadas ?? 0) >= (clase.plazas_max ?? 0)) {
    return (
      <button type="button" disabled className={botonCompletaClass(tamaño)}>
        Completa
      </button>
    )
  }

  if (comprobandoReserva) {
    return <p className="text-sm text-zinc-400">Comprobando disponibilidad...</p>
  }

  if (yaReservada) {
    return (
      <div
        className={`inline-flex items-center gap-2 font-semibold text-[#7a9900] ${
          tamaño === 'grande' ? 'text-base' : 'text-sm'
        }`}
      >
        <svg
          className={tamaño === 'grande' ? 'h-5 w-5' : 'h-4 w-4'}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Ya tienes esta sesión reservada
      </div>
    )
  }

  return (
    <div>
      <button type="button" onClick={handleReservar} disabled={reservando} className={botonReservarClass(tamaño)}>
        {reservando ? 'Reservando...' : 'Reservar'}
      </button>
      {errorReserva && <p className="mt-2 text-sm text-red-600">{errorReserva}</p>}
    </div>
  )
}
