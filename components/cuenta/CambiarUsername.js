'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/

export default function CambiarUsername({ usuario, username, setUsername }) {
  const [editando, setEditando] = useState(false)
  const [nuevoUsername, setNuevoUsername] = useState('')
  const [errorUsername, setErrorUsername] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')

  function empezarEdicion() {
    setNuevoUsername(username || '')
    setErrorUsername('')
    setConfirmacion('')
    setEditando(true)
  }

  function cancelarEdicion() {
    setEditando(false)
    setErrorUsername('')
  }

  async function guardarUsername(e) {
    e.preventDefault()

    if (!USERNAME_REGEX.test(nuevoUsername)) {
      setErrorUsername(
        'El nombre de usuario debe tener entre 3 y 20 caracteres, y solo puede contener letras (sin acentos ni ñ), números y guion bajo.'
      )
      return
    }

    setErrorUsername('')

    if (nuevoUsername.toLowerCase() !== (username || '').toLowerCase()) {
      setGuardando(true)
      const { data: disponible, error: errorDisponibilidad } = await supabase.rpc('username_disponible', {
        p_username: nuevoUsername,
      })

      if (errorDisponibilidad) {
        setGuardando(false)
        setErrorUsername('No hemos podido comprobar el nombre de usuario. Inténtalo de nuevo.')
        return
      }

      if (!disponible) {
        setGuardando(false)
        setErrorUsername('Ese nombre de usuario ya está en uso, prueba con otro.')
        return
      }
    }

    setGuardando(true)

    const { error } = await supabase
      .from('perfiles')
      .update({ username: nuevoUsername })
      .eq('id', usuario.id)

    setGuardando(false)

    if (error) {
      const detalle = error.message.toLowerCase()
      if (detalle.includes('username') || detalle.includes('perfiles') || detalle.includes('duplicate')) {
        setErrorUsername('Ese nombre de usuario ya está en uso. Prueba con otro.')
      } else {
        setErrorUsername('No hemos podido guardar el nombre de usuario. Inténtalo de nuevo.')
      }
      return
    }

    setUsername(nuevoUsername)
    setEditando(false)
    setConfirmacion('Nombre de usuario actualizado correctamente.')
    setTimeout(() => setConfirmacion(''), 5000)
  }

  return (
    <>
      <p className="mb-1 text-sm text-[#6B7355]">
        Correo: <span className="text-[#1F2400]">{usuario.email}</span>
      </p>

      {!editando && (
        <p className="mb-3 text-sm text-[#6B7355]">
          Nombre de usuario: <span className="font-semibold text-[#1F2400]">{username || 'sin nombre'}</span>
        </p>
      )}

      {confirmacion && <p className="mb-3 text-sm font-medium text-[#3D4A00]">{confirmacion}</p>}

      {!editando && (
        <button
          type="button"
          onClick={empezarEdicion}
          className="text-sm font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
        >
          Cambiar nombre de usuario
        </button>
      )}

      {editando && (
        <form onSubmit={guardarUsername} className="mt-2">
          <input
            type="text"
            placeholder="Nuevo nombre de usuario"
            value={nuevoUsername}
            onChange={(e) => {
              setNuevoUsername(e.target.value)
              if (errorUsername) setErrorUsername('')
            }}
            required
            className="mb-3 block w-full corte-btn border border-[#E2E6CF] px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
          />
          {errorUsername && <p className="mb-3 text-xs text-red-600">{errorUsername}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={cancelarEdicion}
              disabled={guardando}
              className="flex-1 corte-btn border border-[#E2E6CF] px-4 py-2 text-sm font-bold text-[#1F2400] transition hover:border-[#B5E600] disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </>
  )
}
