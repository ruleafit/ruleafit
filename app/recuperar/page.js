'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'
import CabeceraAuth from '../../components/CabeceraAuth'

const inputClass =
  'block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
const labelClass = 'mb-1 block text-sm font-medium text-[#1F2400]'
const botonPrimarioClass =
  'mt-2 flex w-full items-center justify-center gap-2 corte-btn bg-[#B5E600] px-6 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100'

function traducirErrorRecuperar(mensajeOriginal) {
  const m = (mensajeOriginal || '').toLowerCase()
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Has pedido demasiados enlaces seguidos. Espera unos minutos e inténtalo de nuevo.'
  }
  return 'Algo ha ido mal. Inténtalo de nuevo.'
}

export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function handleRecuperar(e) {
    e.preventDefault()
    setMensaje('')
    setCargando(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })

    if (error) {
      setMensaje(traducirErrorRecuperar(error.message))
      setCargando(false)
    } else {
      setEnviado(true)
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraAuth frase="Recupera el acceso a tu cuenta." />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:px-6">
        <RevelarAlLlegar className="corte-card border border-[#E2E6CF] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-[#1F2400]">
            Recuperar contraseña
          </h1>

          {enviado ? (
            <div className="flex items-start gap-2 corte-card border border-[#B5E600]/50 bg-[#EDF5C9] px-4 py-3 text-sm text-[#3D4A00]">
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
              <p className="font-medium">
                Si ese correo está registrado, te hemos enviado un enlace para restablecer tu contraseña. Revisa tu
                bandeja de entrada y la carpeta de spam.
              </p>
            </div>
          ) : (
            <form onSubmit={handleRecuperar} className="flex flex-col gap-4">
              <p className="text-sm text-[#6B7355]">
                Escribe el email de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
              </p>

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

              <button type="submit" disabled={cargando} className={botonPrimarioClass}>
                {cargando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    Enviando...
                  </>
                ) : (
                  'Enviar enlace de recuperación'
                )}
              </button>

              {mensaje && (
                <div className="flex items-start gap-2 corte-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <p className="font-medium">{mensaje}</p>
                </div>
              )}
            </form>
          )}

          <p className="mt-6 text-center text-sm text-[#6B7355]">
            <Link href="/login" className="font-semibold text-[#3D4A00] hover:underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </RevelarAlLlegar>
      </div>
    </div>
  )
}
