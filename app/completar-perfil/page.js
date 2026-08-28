'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/

export default function CompletarPerfilPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [comprobando, setComprobando] = useState(true)
  const [rol, setRol] = useState('cliente')
  const [username, setUsername] = useState('')
  const [errorUsername, setErrorUsername] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  // Al cargar: debe haber sesion. Si ya tiene rol, no pinta nada aqui: a la home.
  useEffect(() => {
    let activo = true
    async function comprobar() {
      const { data } = await supabase.auth.getSession()
      if (!activo) return
      const user = data?.session?.user
      if (!user) {
        router.replace('/login')
        return
      }
      if (user.user_metadata?.rol) {
        router.replace('/')
        return
      }
      setUsuario(user)
      setComprobando(false)
    }
    comprobar()
    return () => { activo = false }
  }, [router])

  function rolBotonClass(activo) {
    return activo
      ? 'flex-1 rounded-lg border-2 border-[#B5E600] bg-[#B5E600]/10 px-4 py-3 font-semibold text-[#3D4A00]'
      : 'flex-1 rounded-lg border-2 border-zinc-200 px-4 py-3 font-semibold text-[#162318] transition hover:border-zinc-300'
  }

  // Paso 1: validar y pedir confirmacion.
  async function continuar() {
    setMensaje('')
    setErrorUsername('')

    if (!USERNAME_REGEX.test(username)) {
      setErrorUsername('El nombre de usuario debe tener entre 3 y 20 caracteres (letras, números o guion bajo).')
      return
    }

    setCargando(true)
    // Comprobar disponibilidad del username con la RPC existente.
    const { data: disponible, error: errDisp } = await supabase.rpc('username_disponible', {
      p_username: username,
    })
    if (errDisp) {
      setMensaje('Algo ha ido mal. Inténtalo de nuevo.')
      setCargando(false)
      return
    }
    if (!disponible) {
      setErrorUsername('Ese nombre de usuario ya está en uso, prueba con otro.')
      setCargando(false)
      return
    }
    setCargando(false)
    // Todo correcto: pedir confirmacion del rol (doble clic).
    setConfirmando(true)
  }

  // Paso 2: guardar rol + username en la metadata.
  async function confirmar() {
    setCargando(true)
    setMensaje('')
    // 1. Guardar rol + username en la metadata del usuario.
    const { error: errUser } = await supabase.auth.updateUser({
      data: { rol: rol, username: username },
    })
    if (errUser) {
      setMensaje('No se pudo guardar. Inténtalo de nuevo.')
      setCargando(false)
      setConfirmando(false)
      return
    }
    // 2. Actualizar tambien la fila de perfiles (de donde la app lee el username),
    //    porque el trigger la creo con un username derivado del email.
    const { error: errPerfil } = await supabase
      .from('perfiles')
      .update({ username: username })
      .eq('id', usuario.id)
    if (errPerfil) {
      setMensaje('No se pudo guardar el nombre de usuario. Inténtalo de nuevo.')
      setCargando(false)
      setConfirmando(false)
      return
    }
    // Listo: a la home.
    router.replace('/')
  }

  if (comprobando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-[#162318]/60">Cargando...</p>
      </div>
    )
  }

  const rolTexto = rol === 'entrenador' ? 'entrenador' : 'cliente'

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h1 className="mb-2 text-xl font-bold text-[#162318]">Completa tu perfil</h1>
        <p className="mb-6 text-sm text-[#162318]/70">
          Solo falta un paso para terminar de crear tu cuenta.
        </p>

        {!confirmando ? (
          <>
            <label className="mb-2 block text-sm font-semibold text-[#162318]">
              Quiero usar Ruleafit como:
            </label>
            <div className="mb-2 flex gap-3">
              <button type="button" aria-pressed={rol === 'cliente'} onClick={() => setRol('cliente')} className={rolBotonClass(rol === 'cliente')}>
                Cliente
              </button>
              <button type="button" aria-pressed={rol === 'entrenador'} onClick={() => setRol('entrenador')} className={rolBotonClass(rol === 'entrenador')}>
                Entrenador
              </button>
            </div>
            <div className="mb-5 rounded-lg border-2 border-[#B85E60] bg-[#B85E60]/10 px-4 py-3">
              <p className="text-sm font-bold text-[#B85E60]">
                ⚠️ Importante: el tipo de cuenta NO se puede cambiar más adelante. Asegúrate de elegir correctamente.
              </p>
            </div>

            <label className="mb-2 block text-sm font-semibold text-[#162318]">
              Nombre de usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              className="mb-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-[#162318] outline-none focus:border-[#B5E600]"
            />
            {errorUsername && <p className="mb-2 text-xs text-[#B85E60]">{errorUsername}</p>}

            <button
              onClick={continuar}
              disabled={cargando}
              className="mt-4 w-full rounded-full bg-[#B5E600] px-6 py-3 font-semibold text-[#3D4A00] transition hover:brightness-95 disabled:opacity-60"
            >
              {cargando ? 'Comprobando...' : 'Continuar'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-5 rounded-lg border-2 border-[#B85E60] bg-[#B85E60]/10 px-4 py-4">
              <p className="text-base font-bold text-[#162318]">
                ¿Seguro que quieres crear tu cuenta como {rolTexto}?
              </p>
              <p className="mt-2 text-sm font-semibold text-[#B85E60]">
                Esta elección es DEFINITIVA y no se podrá cambiar en el futuro.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmando(false)}
                disabled={cargando}
                className="flex-1 rounded-full border-2 border-zinc-200 px-6 py-3 font-semibold text-[#162318] transition hover:border-zinc-300 disabled:opacity-60"
              >
                Volver
              </button>
              <button
                onClick={confirmar}
                disabled={cargando}
                className="flex-1 rounded-full bg-[#B5E600] px-6 py-3 font-semibold text-[#3D4A00] transition hover:brightness-95 disabled:opacity-60"
              >
                {cargando ? 'Guardando...' : 'Sí, continuar'}
              </button>
            </div>
          </>
        )}

        {mensaje && <p className="mt-4 text-sm text-[#B85E60]">{mensaje}</p>}
      </div>
    </div>
  )
}
