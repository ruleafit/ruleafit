'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircleQuestion } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const LIMITE_MENSAJE = 5000

export default function AyudaPage() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [confirmacion, setConfirmacion] = useState('')

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getUser()
      setUsuario(data.user)
      setCargando(false)
    }
    comprobarSesion()
  }, [])

  async function enviarFeedback(e) {
    e.preventDefault()
    setError('')
    setConfirmacion('')

    if (!usuario) {
      setError('Debes iniciar sesión para enviar tu mensaje.')
      return
    }

    if (mensaje.trim() === '') {
      setError('Escribe un mensaje antes de enviarlo.')
      return
    }

    setEnviando(true)

    const { error: errorInsercion } = await supabase
      .from('feedback')
      .insert({ user_id: usuario.id, mensaje: mensaje.trim() })

    setEnviando(false)

    if (errorInsercion) {
      setError('Error: ' + errorInsercion.message)
      return
    }

    setMensaje('')
    setConfirmacion('¡Gracias! Hemos recibido tu mensaje.')
    setTimeout(() => setConfirmacion(''), 5000)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EDF5C9]">
            <MessageCircleQuestion className="h-6 w-6 text-[#3D4A00]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1F2400]">Ayuda</h1>
            <p className="text-sm text-[#6B7355]">
              Cuéntanos cualquier problema, duda o sugerencia. Leemos todos los mensajes.
            </p>
          </div>
        </div>

        {!cargando && !usuario && (
          <p className="mb-4 text-sm text-[#6B7355]">
            Para enviarnos un mensaje necesitas{' '}
            <Link href="/login" className="font-semibold text-[#3D4A00] hover:underline">
              iniciar sesión
            </Link>
            .
          </p>
        )}

        <form onSubmit={enviarFeedback} className="rounded-xl border border-[#E2E6CF] bg-white p-6">
          <textarea
            value={mensaje}
            onChange={(e) => {
              setMensaje(e.target.value.slice(0, LIMITE_MENSAJE))
              if (error) setError('')
            }}
            maxLength={LIMITE_MENSAJE}
            rows={6}
            placeholder="Escribe aquí tu mensaje..."
            className="block w-full rounded-xl border border-[#E2E6CF] px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
          />
          <p className="mt-1 text-right text-xs text-[#6B7355]">
            {mensaje.length}/{LIMITE_MENSAJE}
          </p>

          {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
          {confirmacion && <p className="mb-3 text-sm font-medium text-[#3D4A00]">{confirmacion}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="rounded-full bg-[#B5E600] px-6 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  )
}
