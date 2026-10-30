'use client'

import { useEffect, useState } from 'react'
import { Ban } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// Bloquear / desbloquear a un usuario (tabla bloqueos, sql/068). Mientras
// está bloqueado, el usuario actual deja de ver sus sesiones y su perfil en los
// listados (/clases y /entrenadores). Si la tabla no existe todavía o no hay
// sesión, el botón no se muestra.
export default function BotonBloquear({ usuarioId, username, usuarioActual, onCambio, className = '' }) {
  const [disponible, setDisponible] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      if (!usuarioActual || usuarioActual.id === usuarioId) {
        setDisponible(false)
        return
      }
      const { data, error: errorLectura } = await supabase
        .from('bloqueos')
        .select('bloqueado_id')
        .eq('bloqueador_id', usuarioActual.id)
        .eq('bloqueado_id', usuarioId)
        .maybeSingle()
      if (cancelado) return
      setDisponible(!errorLectura)
      setBloqueado(!!data)
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [usuarioActual, usuarioId])

  if (!disponible) return null

  async function alternar() {
    setError('')

    if (!bloqueado) {
      const confirmado = window.confirm(
        `¿Bloquear a ${username ? '@' + username : 'este usuario'}? Dejarás de ver sus sesiones en los listados. Puedes desbloquearlo cuando quieras desde Mi cuenta.`
      )
      if (!confirmado) return
    }

    setTrabajando(true)
    const consulta = bloqueado
      ? supabase.from('bloqueos').delete().eq('bloqueador_id', usuarioActual.id).eq('bloqueado_id', usuarioId)
      : supabase.from('bloqueos').insert({ bloqueador_id: usuarioActual.id, bloqueado_id: usuarioId })
    const { error: errorEscritura } = await consulta
    setTrabajando(false)

    if (errorEscritura) {
      setError('No se pudo completar la acción. Inténtalo de nuevo.')
      return
    }
    setBloqueado(!bloqueado)
    if (onCambio) onCambio(!bloqueado)
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={alternar}
        disabled={trabajando}
        className={
          className ||
          'inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7355] underline-offset-2 hover:text-[#1F2400] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] disabled:opacity-60'
        }
      >
        <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
        {bloqueado ? 'Desbloquear usuario' : 'Bloquear usuario'}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  )
}
