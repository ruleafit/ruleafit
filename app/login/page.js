'use client'

import { useState } from 'react'
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
  'mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#B5E600] px-6 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100'

function traducirErrorLogin(mensajeOriginal) {
  const m = (mensajeOriginal || '').toLowerCase()
  if (m.includes('invalid login credentials')) {
    return 'El correo o la contraseña no son correctos.'
  }
  return 'Algo ha ido mal. Inténtalo de nuevo.'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setMensaje('')
    setCargando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      setMensaje(traducirErrorLogin(error.message))
      setCargando(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraAuth frase="Reserva tu próxima clase en segundos." />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:px-6">
        <RevelarAlLlegar className="rounded-xl border border-[#E2E6CF] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-[#1F2400]">
            Iniciar sesión
          </h1>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                placeholder="Tu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Contraseña</label>
              <input
                type="password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <button type="submit" disabled={cargando} className={botonPrimarioClass}>
              {cargando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {mensaje && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
              <p className="font-medium">{mensaje}</p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-[#6B7355]">
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="font-semibold text-[#3D4A00] hover:underline">
              Regístrate
            </Link>
          </p>
        </RevelarAlLlegar>
      </div>
    </div>
  )
}
