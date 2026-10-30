'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PALABRA_CONFIRMACION = 'ELIMINAR'

// Borrar la propia cuenta (lo exigen Apple y Google para apps con registro, y
// el RGPD lo reconoce como derecho de supresión). Llama a eliminar_mi_cuenta()
// (sql/068), que rechaza el borrado si hay sesiones próximas con reservas y, si
// no, borra la cuenta y sus datos en cascada. Antes se intenta borrar la foto
// de perfil del almacenamiento (la base de datos no puede borrar el archivo).
export default function EliminarCuenta({ usuario }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState('')

  async function eliminar() {
    setError('')
    setBorrando(true)

    try {
      await supabase.storage.from('avatares').remove([`${usuario.id}/avatar.jpg`])
    } catch {
      // Si no hay foto o no se puede borrar, se sigue igualmente.
    }

    const { error: errorBorrado } = await supabase.rpc('eliminar_mi_cuenta')

    if (errorBorrado) {
      setBorrando(false)
      setError(
        errorBorrado.code === 'P0001'
          ? errorBorrado.message
          : 'No se pudo eliminar la cuenta. Inténtalo de nuevo o escríbenos desde Ayuda.'
      )
      return
    }

    await supabase.auth.signOut()
    window.location.assign('/')
  }

  return (
    <div className="mb-8 corte-card border border-red-200 bg-white p-6">
      <h2 className="mb-2 text-lg font-bold text-[#1F2400]">Eliminar mi cuenta</h2>
      <p className="mb-4 text-sm text-[#6B7355]">
        Puedes borrar tu cuenta y tus datos de Ruleafit en cualquier momento.
      </p>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex h-10 items-center justify-center corte-btn border border-red-300 px-5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
        >
          Eliminar mi cuenta
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#1F2400]">
            Se borrarán de forma <strong>definitiva</strong> tu perfil, tus reservas, las sesiones que hayas publicado, tus
            valoraciones, seguidores, Rulos y notificaciones. No se puede deshacer. Si tienes sesiones próximas con
            reservas, cancélalas antes.
          </p>
          <label htmlFor="confirmar-eliminar" className="text-sm font-medium text-[#1F2400]">
            Para confirmar, escribe {PALABRA_CONFIRMACION}
          </label>
          <input
            id="confirmar-eliminar"
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
            className="block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300 sm:max-w-xs"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={eliminar}
              disabled={texto.trim() !== PALABRA_CONFIRMACION || borrando}
              className="inline-flex h-10 items-center justify-center corte-btn bg-red-700 px-5 text-sm font-bold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {borrando ? 'Eliminando…' : 'Eliminar definitivamente'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false)
                setTexto('')
                setError('')
              }}
              disabled={borrando}
              className="inline-flex h-10 items-center justify-center corte-btn border border-[#E2E6CF] px-5 text-sm font-medium text-[#6B7355] hover:border-[#B5E600]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
