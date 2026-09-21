'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'
import CabeceraAuth from '../../components/CabeceraAuth'

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/

const inputClass =
  'block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
const labelClass = 'mb-1 block text-sm font-medium text-[#1F2400]'
const botonPrimarioClass =
  'mt-2 flex w-full items-center justify-center gap-2 corte-btn bg-[#B5E600] px-6 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100'

function traducirErrorRegistro(mensajeOriginal) {
  const m = (mensajeOriginal || '').toLowerCase()
  if (m.includes('username') || m.includes('perfiles')) {
    return 'Ese nombre de usuario ya está en uso. Prueba con otro.'
  }
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'Ya existe una cuenta con este correo.'
  }
  return 'Algo ha ido mal. Inténtalo de nuevo.'
}

export default function RegistroPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [aceptaMayoria, setAceptaMayoria] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [registroExitoso, setRegistroExitoso] = useState(false)
  const [errorUsername, setErrorUsername] = useState('')
  const [errorMayoria, setErrorMayoria] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleRegistro(e) {
    e.preventDefault()
    setMensaje('')

    if (!USERNAME_REGEX.test(username)) {
      setErrorUsername(
        'El nombre de usuario debe tener entre 3 y 20 caracteres, y solo puede contener letras (sin acentos ni ñ), números y guion bajo.'
      )
      return
    }
    setErrorUsername('')

    if (!aceptaMayoria) {
      setErrorMayoria('Marca la casilla para confirmar que eres mayor de edad y aceptar el aviso legal.')
      return
    }
    setErrorMayoria('')

    setCargando(true)

    const { data: disponible, error: errorDisponibilidad } = await supabase.rpc('username_disponible', {
      p_username: username,
    })

    if (errorDisponibilidad) {
      setMensaje('Algo ha ido mal. Inténtalo de nuevo.')
      setCargando(false)
      return
    }

    if (!disponible) {
      setErrorUsername('Ese nombre de usuario ya está en uso, prueba con otro.')
      setCargando(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { username: username },
      },
    })

    if (error) {
      setMensaje(traducirErrorRegistro(error.message))
      setCargando(false)
    } else if (data.session) {
      router.push('/')
    } else {
      setRegistroExitoso(true)
      setCargando(false)
    }
  }

  async function entrarConGoogle() {
    if (!aceptaMayoria) {
      setErrorMayoria('Marca la casilla para confirmar que eres mayor de edad y aceptar el aviso legal.')
      return
    }
    setErrorMayoria('')

    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) {
      setMensaje('No se pudo conectar con Google. Inténtalo de nuevo.')
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraAuth frase="Crea tu cuenta y empieza a moverte." />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:px-6">
        <RevelarAlLlegar className="corte-card border border-[#E2E6CF] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-[#1F2400]">
            Crear cuenta en Ruleafit
          </h1>

          {registroExitoso ? (
            <div className="flex items-start gap-2 corte-card border border-[#B5E600]/50 bg-[#EDF5C9] px-4 py-3 text-sm text-[#3D4A00]">
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
              <p className="font-medium">
                Te hemos enviado un correo para confirmar tu cuenta. Revisa tu bandeja de entrada y, si no lo ves, la
                carpeta de spam. Haz clic en el enlace del correo para activar tu cuenta y poder iniciar sesión.
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleRegistro} className="flex flex-col gap-4">
                <div>
                  <label className={labelClass}>Nombre de usuario</label>
                  <input
                    type="text"
                    placeholder="Nombre de usuario"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      if (errorUsername) setErrorUsername('')
                    }}
                    required
                    className={inputClass}
                  />
                  {errorUsername && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-red-600">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                      {errorUsername}
                    </p>
                  )}
                </div>

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

                <div>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={aceptaMayoria}
                      onChange={(e) => {
                        setAceptaMayoria(e.target.checked)
                        if (e.target.checked) setErrorMayoria('')
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#E2E6CF] accent-[#B5E600] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
                    />
                    <span className="text-sm text-[#1F2400]">
                      Declaro ser mayor de 18 años y acepto el{' '}
                      <a
                        href="/aviso-legal"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#3D4A00] underline hover:text-[#1F2400]"
                      >
                        aviso legal
                      </a>
                      .
                    </span>
                  </label>
                  {errorMayoria && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-red-600">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                      {errorMayoria}
                    </p>
                  )}
                </div>

                <button type="submit" disabled={cargando} className={botonPrimarioClass}>
                  {cargando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                      Creando cuenta...
                    </>
                  ) : (
                    'Crear cuenta'
                  )}
                </button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#E2E6CF]" />
                <span className="text-xs font-medium text-[#6B7355]">o</span>
                <div className="h-px flex-1 bg-[#E2E6CF]" />
              </div>

              <button
                type="button"
                onClick={entrarConGoogle}
                className="mt-4 flex w-full items-center justify-center gap-2 corte-btn border-2 border-zinc-200 px-6 py-3 font-semibold text-[#162318] transition hover:bg-zinc-50"
              >
                Continuar con Google
              </button>

              {mensaje && (
                <div className="mt-4 flex items-start gap-2 corte-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <p className="font-medium">{mensaje}</p>
                </div>
              )}
            </>
          )}

          <p className="mt-6 text-center text-sm text-[#6B7355]">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold text-[#3D4A00] hover:underline">
              Inicia sesión
            </Link>
          </p>
        </RevelarAlLlegar>
      </div>
    </div>
  )
}
