'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleAlert, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'
import CabeceraAuth from '../../components/CabeceraAuth'

const inputClass =
  'block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
const labelClass = 'mb-1 block text-sm font-medium text-[#1F2400]'
const botonPrimarioClass =
  'mt-2 flex w-full items-center justify-center gap-2 corte-btn bg-[#B5E600] px-6 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100'

const MIN_LONGITUD = 8

function traducirErrorNuevaContrasena(mensajeOriginal) {
  const m = (mensajeOriginal || '').toLowerCase()
  if (m.includes('same password') || m.includes('should be different')) {
    return 'La nueva contraseña debe ser distinta de la actual.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Has hecho demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.'
  }
  if (m.includes('at least') || m.includes('password')) {
    return 'La contraseña no cumple los requisitos mínimos.'
  }
  return 'Algo ha ido mal. Inténtalo de nuevo.'
}

export default function NuevaContrasenaPage() {
  const router = useRouter()
  const [estado, setEstado] = useState('verificando') // verificando | valido | invalido
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    let activo = true

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!activo) return
      if (event === 'PASSWORD_RECOVERY') {
        setEstado('valido')
      }
    })

    async function comprobarInicial() {
      const { data } = await supabase.auth.getSession()
      if (!activo) return
      if (data?.session) {
        setEstado((actual) => (actual === 'verificando' ? 'valido' : actual))
      } else {
        setEstado((actual) => (actual === 'verificando' ? 'invalido' : actual))
      }
    }
    comprobarInicial()

    return () => {
      activo = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleGuardar(e) {
    e.preventDefault()
    setMensaje('')

    if (password.length < MIN_LONGITUD) {
      setMensaje(`La contraseña debe tener al menos ${MIN_LONGITUD} caracteres.`)
      return
    }
    if (password !== password2) {
      setMensaje('Las dos contraseñas no coinciden.')
      return
    }

    setCargando(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMensaje(traducirErrorNuevaContrasena(error.message))
      setCargando(false)
      return
    }

    await supabase.auth.signOut()
    router.push('/login?reset=ok')
  }

  if (estado === 'verificando') {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraAuth frase="Crea tu nueva contraseña." />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:px-6">
          <RevelarAlLlegar className="corte-card border border-[#E2E6CF] bg-white p-6 shadow-sm sm:p-8">
            <p className="text-center text-sm text-[#6B7355]">Verificando enlace...</p>
          </RevelarAlLlegar>
        </div>
      </div>
    )
  }

  if (estado === 'invalido') {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraAuth frase="Crea tu nueva contraseña." />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:px-6">
          <RevelarAlLlegar className="corte-card border border-[#E2E6CF] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-2 corte-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
              <p className="font-medium">
                Este enlace no es válido o ha caducado. Vuelve a solicitar el restablecimiento.
              </p>
            </div>
            <p className="mt-6 text-center text-sm text-[#6B7355]">
              <Link href="/recuperar" className="font-semibold text-[#3D4A00] hover:underline">
                Solicitar nuevo enlace
              </Link>
            </p>
          </RevelarAlLlegar>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraAuth frase="Crea tu nueva contraseña." />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:px-6">
        <RevelarAlLlegar className="corte-card border border-[#E2E6CF] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-[#1F2400]">
            Nueva contraseña
          </h1>

          <form onSubmit={handleGuardar} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Nueva contraseña</label>
              <input
                type="password"
                placeholder="Tu nueva contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Repite la nueva contraseña</label>
              <input
                type="password"
                placeholder="Repite la contraseña"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <button type="submit" disabled={cargando} className={botonPrimarioClass}>
              {cargando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  Guardando...
                </>
              ) : (
                'Guardar nueva contraseña'
              )}
            </button>

            {mensaje && (
              <div className="flex items-start gap-2 corte-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
                <p className="font-medium">{mensaje}</p>
              </div>
            )}
          </form>
        </RevelarAlLlegar>
      </div>
    </div>
  )
}
