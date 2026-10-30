'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Lista de usuarios bloqueados en Mi cuenta, con opción de desbloquear. Si la
// tabla bloqueos aún no existe o no hay ninguno, no se muestra nada.
export default function UsuariosBloqueados({ usuario }) {
  const [bloqueados, setBloqueados] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const { data: filas, error: errorLectura } = await supabase
        .from('bloqueos')
        .select('bloqueado_id')
        .eq('bloqueador_id', usuario.id)
      if (cancelado || errorLectura || !filas || filas.length === 0) return

      const ids = filas.map((f) => f.bloqueado_id)
      const { data: perfiles } = await supabase.from('perfiles').select('id, username').in('id', ids)
      if (cancelado) return
      const nombres = new Map((perfiles || []).map((p) => [p.id, p.username]))
      setBloqueados(ids.map((id) => ({ id, username: nombres.get(id) || 'usuario' })))
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [usuario.id])

  async function desbloquear(id) {
    setError('')
    const { error: errorBorrado } = await supabase
      .from('bloqueos')
      .delete()
      .eq('bloqueador_id', usuario.id)
      .eq('bloqueado_id', id)
    if (errorBorrado) {
      setError('No se pudo desbloquear. Inténtalo de nuevo.')
      return
    }
    setBloqueados((prev) => prev.filter((b) => b.id !== id))
  }

  if (bloqueados.length === 0) return null

  return (
    <div className="mb-8 corte-card border border-[#E2E6CF] bg-white p-6">
      <h2 className="mb-2 text-lg font-bold text-[#1F2400]">Usuarios bloqueados</h2>
      <p className="mb-4 text-sm text-[#6B7355]">No ves sus sesiones en los listados. Puedes desbloquearlos cuando quieras.</p>
      <ul className="flex flex-col gap-2">
        {bloqueados.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-[#1F2400]">@{b.username}</span>
            <button
              type="button"
              onClick={() => desbloquear(b.id)}
              className="corte-tag border border-[#E2E6CF] px-3 py-1 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600] hover:bg-[#EDF5C9]"
            >
              Desbloquear
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
